/**
 * RCRS Command Center - Meeting Statistics API
 *
 * Provides aggregated statistics from the REAL Monday meeting numbers data
 * (data/meeting-numbers-2026.json and data/meeting-numbers-all.json).
 *
 * Includes:
 * - Weekly/Monthly/YTD summaries using real meeting sheet columns
 * - Rep performance comparisons (Inspected, Damage, Signed, $$$$$, etc.)
 * - Goal tracking metrics
 * - Period-over-period comparisons
 *
 * GET /api/command-center/meetings/stats
 * Query params:
 *   - period: 'week' | 'month' | 'ytd' (default: 'week')
 *
 * @author RCRS Development Team
 * @version 2.0.0 - Now reads from meeting-numbers cached JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface RawMeetingRecord {
  meetingDate: string;   // YYYY-MM-DD
  tabName: string;
  repName: string;
  Inspected: string;
  Damage: string;
  Signed: string;
  Repair: string;
  Gutter: string;
  '$$$$$': string;
  Approved: string;
  Goal: string;
  Referrals: string;
  Agents: string;
  Present: string;
  'Home Show': string;
}

interface ParsedRecord {
  meetingDate: string;
  repName: string;
  inspected: number;
  damage: number;
  signed: number;
  repair: number;
  gutter: number;
  revenue: number;
  approved: number;
  goal: number;
  referrals: number;
  agents: number;
  present: string;
  homeShow: number;
}

interface RepPeriodStats {
  name: string;
  // Meeting sheet metrics
  inspected: number;
  damage: number;
  signed: number;
  repair: number;
  gutter: number;
  revenue: number;
  approved: number;
  goal: number;
  referrals: number;
  agents: number;
  homeShow: number;
  weeksPresent: number;
  totalWeeks: number;
  // Derived / comparison
  currentPeriod: number;        // revenue for this period (backward compat)
  previousPeriod: number;       // revenue for previous period
  change: number;
  changePercent: number;
  transactionCount: number;     // number of weeks with data
  avgTransaction: number;       // average revenue per week
  rank: number;
  isHot: boolean;
  isCold: boolean;
}

interface MeetingStats {
  period: 'week' | 'month' | 'ytd';
  periodLabel: string;
  dateRange: {
    start: string;
    end: string;
  };
  // Backward-compatible commission fields (now sourced from meeting $$$$$ column)
  totalCommissions: number;
  totalTransactions: number;
  avgTransaction: number;
  previousPeriod: {
    totalCommissions: number;
    totalTransactions: number;
  };
  change: {
    commissions: number;
    commissionsPercent: number;
    transactions: number;
    transactionsPercent: number;
  };
  topPerformer: {
    name: string;
    amount: number;
    percentOfTotal: number;
  };
  repStats: RepPeriodStats[];
  // Meeting-specific team totals
  teamTotals: {
    inspected: number;
    damage: number;
    signed: number;
    repair: number;
    gutter: number;
    revenue: number;
    approved: number;
    referrals: number;
    agents: number;
    homeShow: number;
  };
  goals: {
    weeklyTarget: number;
    monthlyTarget: number;
    yearlyTarget: number;
    weeklyProgress: number;
    monthlyProgress: number;
    yearlyProgress: number;
  };
  milestones: Array<{
    type: 'achievement' | 'record' | 'streak';
    title: string;
    description: string;
    rep?: string;
    value?: number;
  }>;
  dataSource: string;
}

// ============================================================================
// Goals Configuration
// ============================================================================

const GOALS = {
  weeklyTarget: 50000,    // $50K per week target (team total from meeting sheet)
  monthlyTarget: 200000,  // $200K per month target
  yearlyTarget: 2400000,  // $2.4M per year target
};

// ============================================================================
// Helpers
// ============================================================================

function parseNum(val: string | undefined | null): number {
  if (!val || val.trim() === '') return 0;
  const cleaned = val.replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseRecord(raw: RawMeetingRecord): ParsedRecord {
  return {
    meetingDate: raw.meetingDate,
    repName: raw.repName,
    inspected: parseNum(raw.Inspected),
    damage: parseNum(raw.Damage),
    signed: parseNum(raw.Signed),
    repair: parseNum(raw.Repair),
    gutter: parseNum(raw.Gutter),
    revenue: parseNum(raw['$$$$$']),
    approved: parseNum(raw.Approved),
    goal: parseNum(raw.Goal),
    referrals: parseNum(raw.Referrals),
    agents: parseNum(raw.Agents),
    present: (raw.Present || '').trim(),
    homeShow: parseNum(raw['Home Show']),
  };
}

function loadMeetingData(): ParsedRecord[] {
  // Try combined all-years file first, then fall back to 2026
  const allPath = path.join(process.cwd(), 'data', 'meeting-numbers-all.json');
  const yearPath = path.join(process.cwd(), 'data', 'meeting-numbers-2026.json');

  let rawRecords: RawMeetingRecord[] = [];

  try {
    if (existsSync(allPath)) {
      rawRecords = JSON.parse(readFileSync(allPath, 'utf-8'));
    } else if (existsSync(yearPath)) {
      rawRecords = JSON.parse(readFileSync(yearPath, 'utf-8'));
    }
  } catch (err) {
    console.error('[Meeting Stats] Error loading meeting data:', err);
    return [];
  }

  // Parse and filter out Total rows and empty names
  return rawRecords
    .filter(r => r.repName && r.repName.trim() !== '' && r.repName.toLowerCase() !== 'total')
    .map(parseRecord);
}

/**
 * Get the current date in US Central Time (America/Chicago).
 * The server runs in UTC, but RCRS is in Alabama (Central Time).
 * Without this, "this month" on March 31 CDT would return April
 * because UTC is already April 1.
 */
function getCentralDate(): Date {
  const now = new Date();
  const central = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  return central;
}

function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekBoundaries(date: Date): { start: string; end: string } {
  // Meeting weeks run Monday-Sunday
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: formatDateISO(monday), end: formatDateISO(sunday) };
}

function getPreviousWeekBoundaries(date: Date): { start: string; end: string } {
  const prev = new Date(date);
  prev.setDate(prev.getDate() - 7);
  return getWeekBoundaries(prev);
}

function getMonthBoundaries(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: formatDateISO(start), end: formatDateISO(end) };
}

function getPreviousMonthBoundaries(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const end = new Date(date.getFullYear(), date.getMonth(), 0);
  return { start: formatDateISO(start), end: formatDateISO(end) };
}

function getYTDBoundaries(date: Date): { start: string; end: string } {
  return { start: `${date.getFullYear()}-01-01`, end: formatDateISO(date) };
}

function getPreviousYTDBoundaries(date: Date): { start: string; end: string } {
  const prevYear = date.getFullYear() - 1;
  const sameDay = new Date(prevYear, date.getMonth(), date.getDate());
  return { start: `${prevYear}-01-01`, end: formatDateISO(sameDay) };
}

function filterByRange(records: ParsedRecord[], start: string, end: string): ParsedRecord[] {
  return records.filter(r => r.meetingDate >= start && r.meetingDate <= end);
}

// ============================================================================
// API Handler
// ============================================================================

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get('period') || 'week';
    const period = (['week', 'month', 'ytd'].includes(periodParam)
      ? periodParam
      : 'week') as 'week' | 'month' | 'ytd';

    // Use Central Time so "this month" and "this week" match Alabama local dates
    const now = getCentralDate();
    // HARD RULE: Michael, Chris, Sara, Boston NEVER on leaderboards
    const EXCLUDED_FROM_STATS = [
      'michael', 'chris', 'sara', 'john', 'bart', 'rudy', 'tae',
      'richard', 'destin', 'tia', 'boston',
    ];
    const allRecords = loadMeetingData().filter(r => {
      const name = r.repName.toLowerCase().trim();
      return !EXCLUDED_FROM_STATS.includes(name);
    });

    if (allRecords.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No meeting numbers data found. Run a sync first.',
        timestamp,
      }, { status: 404 });
    }

    // Get date boundaries based on period
    let currentBounds: { start: string; end: string };
    let previousBounds: { start: string; end: string };
    let periodLabel: string;

    switch (period) {
      case 'week':
        currentBounds = getWeekBoundaries(now);
        previousBounds = getPreviousWeekBoundaries(now);
        periodLabel = 'This Week';
        break;
      case 'month':
        currentBounds = getMonthBoundaries(now);
        previousBounds = getPreviousMonthBoundaries(now);
        periodLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        break;
      case 'ytd':
        currentBounds = getYTDBoundaries(now);
        previousBounds = getPreviousYTDBoundaries(now);
        periodLabel = `YTD ${now.getFullYear()}`;
        break;
    }

    const currentRecords = filterByRange(allRecords, currentBounds.start, currentBounds.end);
    const previousRecords = filterByRange(allRecords, previousBounds.start, previousBounds.end);

    // Group by rep for current period
    const currentByRep = new Map<string, ParsedRecord[]>();
    for (const rec of currentRecords) {
      const existing = currentByRep.get(rec.repName) || [];
      existing.push(rec);
      currentByRep.set(rec.repName, existing);
    }

    // Group by rep for previous period
    const previousByRep = new Map<string, ParsedRecord[]>();
    for (const rec of previousRecords) {
      const existing = previousByRep.get(rec.repName) || [];
      existing.push(rec);
      previousByRep.set(rec.repName, existing);
    }

    // Calculate team totals for current period
    const teamTotals = {
      inspected: 0, damage: 0, signed: 0, repair: 0, gutter: 0,
      revenue: 0, approved: 0, referrals: 0, agents: 0, homeShow: 0,
    };

    for (const rec of currentRecords) {
      teamTotals.inspected += rec.inspected;
      teamTotals.damage += rec.damage;
      teamTotals.signed += rec.signed;
      teamTotals.repair += rec.repair;
      teamTotals.gutter += rec.gutter;
      teamTotals.revenue += rec.revenue;
      teamTotals.approved += rec.approved;
      teamTotals.referrals += rec.referrals;
      teamTotals.agents += rec.agents;
      teamTotals.homeShow += rec.homeShow;
    }

    // Previous period revenue total
    let previousRevenueTotal = 0;
    for (const rec of previousRecords) {
      previousRevenueTotal += rec.revenue;
    }

    // Build rep stats
    const repStats: RepPeriodStats[] = [];

    currentByRep.forEach((records, repName) => {
      const prevRecords = previousByRep.get(repName) || [];

      const currentRevenue = records.reduce((sum, r) => sum + r.revenue, 0);
      const previousRevenue = prevRecords.reduce((sum, r) => sum + r.revenue, 0);
      const change = currentRevenue - previousRevenue;
      const changePercent = previousRevenue > 0
        ? ((change / previousRevenue) * 100)
        : (currentRevenue > 0 ? 100 : 0);

      const weeksPresent = records.filter(r => r.present === '1').length;

      repStats.push({
        name: repName,
        inspected: records.reduce((s, r) => s + r.inspected, 0),
        damage: records.reduce((s, r) => s + r.damage, 0),
        signed: records.reduce((s, r) => s + r.signed, 0),
        repair: records.reduce((s, r) => s + r.repair, 0),
        gutter: records.reduce((s, r) => s + r.gutter, 0),
        revenue: currentRevenue,
        approved: records.reduce((s, r) => s + r.approved, 0),
        goal: records.reduce((s, r) => s + r.goal, 0),
        referrals: records.reduce((s, r) => s + r.referrals, 0),
        agents: records.reduce((s, r) => s + r.agents, 0),
        homeShow: records.reduce((s, r) => s + r.homeShow, 0),
        weeksPresent,
        totalWeeks: records.length,
        currentPeriod: Math.round(currentRevenue * 100) / 100,
        previousPeriod: Math.round(previousRevenue * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 10) / 10,
        transactionCount: records.length,
        avgTransaction: records.length > 0 ? Math.round((currentRevenue / records.length) * 100) / 100 : 0,
        rank: 0,
        isHot: false,
        isCold: false,
      });
    });

    // Sort by revenue ($$$$$ column) descending and assign ranks
    repStats.sort((a, b) => b.revenue - a.revenue);
    repStats.forEach((rep, index) => {
      rep.rank = index + 1;
      rep.isHot = index < 3 || rep.changePercent > 20;
      rep.isCold = index >= repStats.length - 2 || rep.changePercent < -20;
    });

    // Top performer
    const topPerformer = repStats[0] || { name: 'N/A', revenue: 0 };
    const topPerformerPercent = teamTotals.revenue > 0
      ? (topPerformer.revenue / teamTotals.revenue) * 100
      : 0;

    // Revenue change
    const revenueChange = teamTotals.revenue - previousRevenueTotal;
    const revenueChangePercent = previousRevenueTotal > 0
      ? (revenueChange / previousRevenueTotal) * 100
      : (teamTotals.revenue > 0 ? 100 : 0);

    const weekCountChange = currentRecords.length - previousRecords.length;
    const weekCountChangePercent = previousRecords.length > 0
      ? (weekCountChange / previousRecords.length) * 100
      : (currentRecords.length > 0 ? 100 : 0);

    // Goal progress: use the current year's data for YTD calculations
    const weekBounds = getWeekBoundaries(now);
    const monthBounds = getMonthBoundaries(now);
    const ytdBounds = getYTDBoundaries(now);

    const weekRevenue = filterByRange(allRecords, weekBounds.start, weekBounds.end)
      .reduce((s, r) => s + r.revenue, 0);
    const monthRevenue = filterByRange(allRecords, monthBounds.start, monthBounds.end)
      .reduce((s, r) => s + r.revenue, 0);
    const ytdRevenue = filterByRange(allRecords, ytdBounds.start, ytdBounds.end)
      .reduce((s, r) => s + r.revenue, 0);

    // Milestones
    const milestones: MeetingStats['milestones'] = [];

    for (const rep of repStats) {
      if (rep.changePercent > 50) {
        milestones.push({
          type: 'streak',
          title: 'On Fire!',
          description: `${rep.name} is up ${rep.changePercent.toFixed(1)}% vs last period`,
          rep: rep.name,
          value: rep.changePercent,
        });
      }
      if (rep.revenue > 20000) {
        milestones.push({
          type: 'record',
          title: 'Big Period!',
          description: `${rep.name} hit $${(rep.revenue / 1000).toFixed(1)}K in revenue`,
          rep: rep.name,
          value: rep.revenue,
        });
      }
      if (rep.signed >= 3) {
        milestones.push({
          type: 'achievement',
          title: 'Signing Machine!',
          description: `${rep.name} signed ${rep.signed} contracts`,
          rep: rep.name,
          value: rep.signed,
        });
      }
    }

    // Unique meeting dates in current period (for "transactions" backward compat)
    const uniqueWeeks = new Set(currentRecords.map(r => r.meetingDate));

    const stats: MeetingStats = {
      period,
      periodLabel,
      dateRange: {
        start: currentBounds.start,
        end: currentBounds.end,
      },
      // Backward-compatible: map revenue -> totalCommissions, weeks -> transactions
      totalCommissions: Math.round(teamTotals.revenue * 100) / 100,
      totalTransactions: uniqueWeeks.size,
      avgTransaction: uniqueWeeks.size > 0
        ? Math.round((teamTotals.revenue / uniqueWeeks.size) * 100) / 100
        : 0,
      previousPeriod: {
        totalCommissions: Math.round(previousRevenueTotal * 100) / 100,
        totalTransactions: new Set(previousRecords.map(r => r.meetingDate)).size,
      },
      change: {
        commissions: Math.round(revenueChange * 100) / 100,
        commissionsPercent: Math.round(revenueChangePercent * 10) / 10,
        transactions: weekCountChange,
        transactionsPercent: Math.round(weekCountChangePercent * 10) / 10,
      },
      topPerformer: {
        name: topPerformer.name,
        amount: Math.round(topPerformer.revenue * 100) / 100,
        percentOfTotal: Math.round(topPerformerPercent * 10) / 10,
      },
      repStats,
      teamTotals: {
        inspected: teamTotals.inspected,
        damage: teamTotals.damage,
        signed: teamTotals.signed,
        repair: teamTotals.repair,
        gutter: teamTotals.gutter,
        revenue: Math.round(teamTotals.revenue * 100) / 100,
        approved: teamTotals.approved,
        referrals: teamTotals.referrals,
        agents: teamTotals.agents,
        homeShow: teamTotals.homeShow,
      },
      goals: {
        weeklyTarget: GOALS.weeklyTarget,
        monthlyTarget: GOALS.monthlyTarget,
        yearlyTarget: GOALS.yearlyTarget,
        weeklyProgress: Math.round((weekRevenue / GOALS.weeklyTarget) * 1000) / 10,
        monthlyProgress: Math.round((monthRevenue / GOALS.monthlyTarget) * 1000) / 10,
        yearlyProgress: Math.round((ytdRevenue / GOALS.yearlyTarget) * 1000) / 10,
      },
      milestones: milestones.slice(0, 5),
      dataSource: 'meeting-numbers',
    };

    return NextResponse.json(
      {
        success: true,
        data: stats,
        timestamp,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30',
        },
      }
    );
  } catch (error) {
    console.error('[Meeting Stats API Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
      },
      { status: 500 }
    );
  }
}
