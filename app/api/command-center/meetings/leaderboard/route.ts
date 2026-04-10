/**
 * RCRS Command Center - Meeting Leaderboard API
 *
 * Provides leaderboard data from the REAL Monday meeting numbers
 * (data/meeting-numbers-2026.json and data/meeting-numbers-all.json).
 *
 * Shows ESTIMATED meeting sheet columns: Inspected, Damage, Signed, $$$$$,
 * Approved, Referrals, Agents, etc. Default sort by $$$$$ (estimated revenue).
 * ALL numbers are self-reported estimates from Monday meetings, NOT actual commissions.
 *
 * GET /api/command-center/meetings/leaderboard
 * Query params:
 *   - view: 'full' | 'compact' (default: 'full')
 *   - animate: 'true' | 'false' (include animation triggers)
 *   - metric: sort metric key (default: 'revenue' = $$$$$ column)
 *   - period: 'thisWeek' | 'thisMonth' | 'thisYear' | 'allTime' (default: 'thisYear')
 *
 * @author RCRS Development Team
 * @version 2.0.0 - Now reads from meeting-numbers cached JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import * as path from 'path';
import { meetingNumbersService } from '@/lib/meeting-numbers-service';
import { resolveCommissionName } from '@/lib/team-roles';

// Commission record from QuickBooks (data/commissions.json)
interface CommissionRecord {
  salesRep: string;
  date: string;
  amount: number;
  balance?: number;
  jobNumber?: string;
  customer?: string;
}

// ============================================================================
// Types
// ============================================================================

interface RawMeetingRecord {
  meetingDate: string;
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

interface LeaderboardRep {
  rank: number;
  name: string;
  initials: string;
  avatarColor: string;

  // Meeting sheet metrics (REAL data)
  meetingMetrics: {
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
    attendanceRate: number;
  };

  // Correctly-named: meeting revenue (self-reported $$$$$ from Monday meetings)
  estimatedSalesAllTime: number;
  estimatedSalesWeekly: number;
  estimatedSalesMonthly: number;
  estimatedSalesYTD: number;

  // REAL commissions (1099 payouts from QuickBooks)
  actualCommissionsYTD: number;

  // Backward-compatible fields (deprecated — use estimatedSales* / actualCommissions*)
  totalCommissions: number;
  weeklyCommissions: number;
  monthlyCommissions: number;
  ytdCommissions: number;
  totalTransactions: number;
  weeklyTransactions: number;
  monthlyTransactions: number;
  avgTransaction: number;
  percentOfTeamTotal: number;

  // Status
  streak: 'hot' | 'cold' | 'neutral';
  rankChange: number;
  isTopPerformer: boolean;

  // Achievements
  achievements: Array<{
    id: string;
    icon: string;
    name: string;
    tier: 'legendary' | 'epic' | 'rare' | 'common';
  }>;

  // Animation triggers
  animations: Array<{
    type: 'confetti' | 'fireworks' | 'glow' | 'shake';
    reason: string;
  }>;
}

// ============================================================================
// Constants
// ============================================================================

const AVATAR_COLORS = [
  'from-yellow-400 to-amber-500',   // Gold
  'from-gray-400 to-gray-500',      // Silver
  'from-orange-600 to-amber-700',   // Bronze
  'from-blue-500 to-blue-600',
  'from-green-500 to-green-600',
  'from-purple-500 to-purple-600',
  'from-pink-500 to-pink-600',
  'from-red-500 to-red-600',
  'from-cyan-500 to-cyan-600',
  'from-rose-500 to-rose-600',
];

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
  // Use meetingNumbersService which auto-syncs from Google Sheets
  // This ensures data is always fresh (syncs every 5 min in background)
  const records = meetingNumbersService.loadAllData();
  return records.map(r => ({
    meetingDate: r.meetingDate,
    repName: r.repName,
    inspected: r.inspected,
    damage: r.damage,
    signed: r.signed,
    repair: r.repair,
    gutter: r.gutter,
    revenue: r.revenue,
    approved: r.approved,
    goal: r.goal,
    referrals: r.referrals,
    agents: r.agents,
    present: r.present,
    homeShow: r.homeShow,
  }));
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Get the current date in US Central Time (America/Chicago).
 * The server runs in UTC, but RCRS is in Alabama (Central Time).
 * Without this, "this month" on March 31 CDT would return April
 * because UTC is already April 1.
 */
function getCentralDate(): Date {
  const now = new Date();
  // Convert UTC to Central Time by formatting in that timezone
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
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: formatDateISO(monday), end: formatDateISO(sunday) };
}

function getMonthBoundaries(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: formatDateISO(start), end: formatDateISO(end) };
}

function getYTDBoundaries(date: Date): { start: string; end: string } {
  return { start: `${date.getFullYear()}-01-01`, end: formatDateISO(date) };
}

function filterByRange(records: ParsedRecord[], start: string, end: string): ParsedRecord[] {
  return records.filter(r => r.meetingDate >= start && r.meetingDate <= end);
}

function isPresent(val: string): boolean {
  return val === '1';
}

function isExcused(val: string): boolean {
  const lower = val.toLowerCase().trim();
  return lower === 'e' || lower === 'ex' || lower === 'excused';
}

// ============================================================================
// Achievement Calculator
// ============================================================================

function calculateAchievements(
  revenue: number,
  signed: number,
  inspected: number,
  referrals: number,
  attendanceRate: number,
): LeaderboardRep['achievements'] {
  const achievements: LeaderboardRep['achievements'] = [];

  // Revenue milestones
  if (revenue >= 500000) {
    achievements.push({ id: 'half-million', icon: '💰', name: 'Half-Million Club', tier: 'legendary' });
  } else if (revenue >= 250000) {
    achievements.push({ id: 'quarter-million', icon: '💵', name: 'Quarter-Million Club', tier: 'epic' });
  } else if (revenue >= 100000) {
    achievements.push({ id: '100k-club', icon: '💎', name: '$100K Club', tier: 'rare' });
  }

  // Signing achievements
  if (signed >= 50) {
    achievements.push({ id: 'closer-50', icon: '🎯', name: 'Master Closer (50+)', tier: 'epic' });
  } else if (signed >= 20) {
    achievements.push({ id: 'closer-20', icon: '📝', name: 'Proven Closer (20+)', tier: 'rare' });
  }

  // Inspection achievements
  if (inspected >= 100) {
    achievements.push({ id: 'inspector-100', icon: '🔍', name: 'Century Inspector', tier: 'epic' });
  }

  // Referral achievements
  if (referrals >= 20) {
    achievements.push({ id: 'referral-king', icon: '🤝', name: 'Referral King', tier: 'rare' });
  }

  // Attendance
  if (attendanceRate >= 0.95) {
    achievements.push({ id: 'always-there', icon: '⭐', name: 'Always There (95%+)', tier: 'common' });
  }

  return achievements;
}

// ============================================================================
// API Handler
// ============================================================================

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'full';
    const includeAnimations = searchParams.get('animate') === 'true';
    const sortMetric = searchParams.get('metric') || 'revenue';
    const periodParam = searchParams.get('period') || 'thisYear';

    // Load real commission data from QuickBooks (commissions.json)
    let commissionRecords: CommissionRecord[] = [];
    try {
      const commPath = path.join(process.cwd(), 'data', 'commissions.json');
      if (existsSync(commPath)) {
        commissionRecords = JSON.parse(readFileSync(commPath, 'utf-8'));
      }
    } catch (err) {
      console.error('[Leaderboard] Error loading commissions.json:', err);
    }

    // Helper: parse commission dates (MM/DD/YYYY) to YYYY-MM-DD for comparison
    function parseCommissionDate(dateStr: string): string {
      const parts = dateStr.split('/');
      if (parts.length !== 3) return '';
      const [mm, dd, yyyy] = parts;
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }

    // Filter commissions by date range and sum by resolved rep name
    function getCommissionsByRep(startDate: string, endDate: string): Map<string, number> {
      const result = new Map<string, number>();
      for (const rec of commissionRecords) {
        const isoDate = parseCommissionDate(rec.date);
        if (isoDate >= startDate && isoDate <= endDate && rec.amount > 0) {
          const canonicalName = resolveCommissionName(rec.salesRep);
          result.set(canonicalName, (result.get(canonicalName) || 0) + rec.amount);
        }
      }
      return result;
    }

    // Use Central Time so "this month" and "this week" match Alabama local dates
    const now = getCentralDate();

    // HARD RULE: Michael, Chris, Sara NEVER on sales/commission leaderboard
    // Also exclude: PMs (John, Bart), inactive (Rudy, Tae), drivers-only (Richard),
    // Boston (marketing), office staff (Destin, Tia)
    const EXCLUDED_FROM_LEADERBOARD = [
      'michael', 'chris', 'sara', 'john', 'bart', 'rudy', 'tae',
      'richard', 'destin', 'tia', 'boston',
    ];

    // Active sales reps only
    const ACTIVE_SALES_REPS = [
      'hunter', 'aaron', 'greg', 'brendon', 'adam', 'joseph',
      'alijah', 'travis', 'rick',
    ];

    const allRecords = loadMeetingData().filter(r => {
      const name = r.repName.toLowerCase().trim();
      return !EXCLUDED_FROM_LEADERBOARD.includes(name);
    });

    if (allRecords.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No meeting numbers data found',
        timestamp,
      }, { status: 404 });
    }

    // Date boundaries
    const weekBounds = getWeekBoundaries(now);
    const monthBounds = getMonthBoundaries(now);
    const ytdBounds = getYTDBoundaries(now);
    const prevWeekStart = new Date(now);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekBounds = getWeekBoundaries(prevWeekStart);

    // Get real YTD commission totals from QuickBooks
    const ytdCommissionsByRep = getCommissionsByRep(ytdBounds.start, ytdBounds.end);

    // Determine the primary filter period for the leaderboard ranking
    let periodStart: string | undefined;
    let periodEnd: string | undefined;

    switch (periodParam) {
      case 'thisWeek':
        periodStart = weekBounds.start;
        periodEnd = weekBounds.end;
        break;
      case 'thisMonth':
        periodStart = monthBounds.start;
        periodEnd = monthBounds.end;
        break;
      case 'thisYear':
        periodStart = ytdBounds.start;
        periodEnd = ytdBounds.end;
        break;
      case 'allTime':
      default:
        // No filter - all data
        break;
    }

    // Filter records for the primary period
    const periodRecords = periodStart && periodEnd
      ? filterByRange(allRecords, periodStart, periodEnd)
      : allRecords;

    // Aggregate by rep
    const repMap = new Map<string, {
      records: ParsedRecord[];
      weekRecords: ParsedRecord[];
      prevWeekRecords: ParsedRecord[];
      monthRecords: ParsedRecord[];
      ytdRecords: ParsedRecord[];
    }>();

    for (const rec of allRecords) {
      if (!repMap.has(rec.repName)) {
        repMap.set(rec.repName, {
          records: [],
          weekRecords: [],
          prevWeekRecords: [],
          monthRecords: [],
          ytdRecords: [],
        });
      }
      const bucket = repMap.get(rec.repName)!;

      // All-time records for this rep
      bucket.records.push(rec);

      // Weekly
      if (rec.meetingDate >= weekBounds.start && rec.meetingDate <= weekBounds.end) {
        bucket.weekRecords.push(rec);
      }
      // Previous week
      if (rec.meetingDate >= prevWeekBounds.start && rec.meetingDate <= prevWeekBounds.end) {
        bucket.prevWeekRecords.push(rec);
      }
      // Monthly
      if (rec.meetingDate >= monthBounds.start && rec.meetingDate <= monthBounds.end) {
        bucket.monthRecords.push(rec);
      }
      // YTD
      if (rec.meetingDate >= ytdBounds.start && rec.meetingDate <= ytdBounds.end) {
        bucket.ytdRecords.push(rec);
      }
    }

    // Build leaderboard entries
    let grandTotal = 0;
    let weeklyTotal = 0;
    let monthlyTotal = 0;
    let ytdTotal = 0;
    let totalTransactions = 0;

    const leaderboard: LeaderboardRep[] = [];

    repMap.forEach((bucket, repName) => {
      // Use period-filtered records for the primary metric ranking
      const periodRecs = periodStart && periodEnd
        ? bucket.records.filter(r => r.meetingDate >= periodStart! && r.meetingDate <= periodEnd!)
        : bucket.records;

      // Sum all metrics for the period
      const sumMetric = (recs: ParsedRecord[], field: keyof ParsedRecord) =>
        recs.reduce((s, r) => s + (typeof r[field] === 'number' ? r[field] as number : 0), 0);

      const periodRevenue = sumMetric(periodRecs, 'revenue');
      const periodInspected = sumMetric(periodRecs, 'inspected');
      const periodDamage = sumMetric(periodRecs, 'damage');
      const periodSigned = sumMetric(periodRecs, 'signed');
      const periodRepair = sumMetric(periodRecs, 'repair');
      const periodGutter = sumMetric(periodRecs, 'gutter');
      const periodApproved = sumMetric(periodRecs, 'approved');
      const periodGoal = sumMetric(periodRecs, 'goal');
      const periodReferrals = sumMetric(periodRecs, 'referrals');
      const periodAgents = sumMetric(periodRecs, 'agents');
      const periodHomeShow = sumMetric(periodRecs, 'homeShow');

      // Attendance
      const periodPresent = periodRecs.filter(r => isPresent(r.present)).length;
      const periodExcused = periodRecs.filter(r => isExcused(r.present)).length;
      const eligibleWeeks = periodRecs.length - periodExcused;
      const attendanceRate = eligibleWeeks > 0 ? periodPresent / eligibleWeeks : 0;

      // Weekly / monthly / YTD revenue for backward compat
      const weekRevenue = sumMetric(bucket.weekRecords, 'revenue');
      const monthRevenue = sumMetric(bucket.monthRecords, 'revenue');
      const ytdRevenue = sumMetric(bucket.ytdRecords, 'revenue');
      const allTimeRevenue = sumMetric(bucket.records, 'revenue');

      // All-time totals for "totalCommissions"
      grandTotal += allTimeRevenue;
      weeklyTotal += weekRevenue;
      monthlyTotal += monthRevenue;
      ytdTotal += ytdRevenue;
      totalTransactions += bucket.records.length;

      // Streak: compare this week vs previous week revenue
      const prevWeekRevenue = sumMetric(bucket.prevWeekRecords, 'revenue');
      let streak: 'hot' | 'cold' | 'neutral' = 'neutral';
      if (weekRevenue > prevWeekRevenue * 1.2 && weekRevenue > 0) {
        streak = 'hot';
      } else if (weekRevenue < prevWeekRevenue * 0.8 && prevWeekRevenue > 0) {
        streak = 'cold';
      }

      // Achievements (based on all-time data)
      const allTimeSigned = sumMetric(bucket.records, 'signed');
      const allTimeInspected = sumMetric(bucket.records, 'inspected');
      const allTimeReferrals = sumMetric(bucket.records, 'referrals');
      const achievements = calculateAchievements(
        allTimeRevenue, allTimeSigned, allTimeInspected, allTimeReferrals, attendanceRate,
      );

      // Animations
      const animations: LeaderboardRep['animations'] = [];
      if (includeAnimations) {
        if (weekRevenue > 20000) {
          animations.push({ type: 'confetti', reason: 'Big week!' });
        }
        if (streak === 'hot') {
          animations.push({ type: 'glow', reason: 'On fire!' });
        }
        if (periodSigned >= 3) {
          animations.push({ type: 'fireworks', reason: 'Signing machine!' });
        }
      }

      // Determine the value to sort by
      const metricMap: Record<string, number> = {
        revenue: periodRevenue,
        inspected: periodInspected,
        damage: periodDamage,
        signed: periodSigned,
        repair: periodRepair,
        gutter: periodGutter,
        approved: periodApproved,
        goal: periodGoal,
        referrals: periodReferrals,
        agents: periodAgents,
        homeShow: periodHomeShow,
      };

      // Look up real commission for this rep
      const repActualCommissionsYTD = ytdCommissionsByRep.get(repName) || 0;

      leaderboard.push({
        rank: 0,
        name: repName,
        initials: getInitials(repName),
        avatarColor: '',

        meetingMetrics: {
          inspected: periodInspected,
          damage: periodDamage,
          signed: periodSigned,
          repair: periodRepair,
          gutter: periodGutter,
          revenue: Math.round(periodRevenue * 100) / 100,
          approved: periodApproved,
          goal: periodGoal,
          referrals: periodReferrals,
          agents: periodAgents,
          homeShow: periodHomeShow,
          weeksPresent: periodPresent,
          totalWeeks: periodRecs.length,
          attendanceRate: Math.round(attendanceRate * 1000) / 10,
        },

        // Correctly-named: meeting revenue (self-reported $$$$$ from Monday meetings)
        estimatedSalesAllTime: Math.round(allTimeRevenue * 100) / 100,
        estimatedSalesWeekly: Math.round(weekRevenue * 100) / 100,
        estimatedSalesMonthly: Math.round(monthRevenue * 100) / 100,
        estimatedSalesYTD: Math.round(ytdRevenue * 100) / 100,

        // REAL commissions (1099 payouts from QuickBooks)
        actualCommissionsYTD: Math.round(repActualCommissionsYTD * 100) / 100,

        // Backward-compatible fields (deprecated — mapped from revenue / $$$$$ column)
        totalCommissions: Math.round(allTimeRevenue * 100) / 100,
        weeklyCommissions: Math.round(weekRevenue * 100) / 100,
        monthlyCommissions: Math.round(monthRevenue * 100) / 100,
        ytdCommissions: Math.round(ytdRevenue * 100) / 100,
        totalTransactions: bucket.records.length,
        weeklyTransactions: bucket.weekRecords.length,
        monthlyTransactions: bucket.monthRecords.length,
        avgTransaction: bucket.records.length > 0
          ? Math.round((allTimeRevenue / bucket.records.length) * 100) / 100
          : 0,
        percentOfTeamTotal: 0, // calculated after sorting

        streak,
        rankChange: 0,
        isTopPerformer: false,
        achievements,
        animations,

        // Stash sort value for sorting
        _sortValue: metricMap[sortMetric] ?? periodRevenue,
      } as LeaderboardRep & { _sortValue: number });
    });

    // Sort by the selected metric
    leaderboard.sort((a, b) => {
      const aVal = (a as LeaderboardRep & { _sortValue?: number })._sortValue ?? 0;
      const bVal = (b as LeaderboardRep & { _sortValue?: number })._sortValue ?? 0;
      return bVal - aVal;
    });

    // Filter out inactive reps with zero activity in the period
    // Only show reps who are active OR have any numbers in the selected period
    const filteredLeaderboard = leaderboard.filter(rep => {
      const name = rep.name.toLowerCase().trim();
      const hasActivity = rep.meetingMetrics.revenue > 0 ||
        rep.meetingMetrics.inspected > 0 ||
        rep.meetingMetrics.signed > 0 ||
        rep.meetingMetrics.weeksPresent > 0;
      // Always show active reps, and show inactive ones only if they have activity
      return ACTIVE_SALES_REPS.includes(name) || hasActivity;
    });

    // Replace leaderboard with filtered version
    leaderboard.length = 0;
    leaderboard.push(...filteredLeaderboard);

    // Assign ranks, colors, percentages
    leaderboard.forEach((rep, index) => {
      rep.rank = index + 1;
      rep.isTopPerformer = index < 3;
      rep.percentOfTeamTotal = grandTotal > 0
        ? Math.round((rep.totalCommissions / grandTotal) * 1000) / 10
        : 0;

      // Rank-based colors
      if (index < AVATAR_COLORS.length) {
        rep.avatarColor = AVATAR_COLORS[index];
      } else {
        rep.avatarColor = AVATAR_COLORS[AVATAR_COLORS.length - 1];
      }

      // Clean up internal sort field
      delete (rep as LeaderboardRep & { _sortValue?: number })._sortValue;
    });

    // Celebration triggers
    const celebrationTriggers: Array<{
      type: 'milestone' | 'record' | 'achievement';
      message: string;
      rep?: string;
      value?: number;
      animation: 'confetti' | 'fireworks' | 'spotlight';
    }> = [];

    for (const rep of leaderboard) {
      if (rep.weeklyCommissions > 20000) {
        celebrationTriggers.push({
          type: 'record',
          message: `${rep.name} had a massive week with $${rep.weeklyCommissions.toLocaleString()} in revenue!`,
          rep: rep.name,
          value: rep.weeklyCommissions,
          animation: 'confetti',
        });
      }
      if (rep.meetingMetrics.signed >= 3 && rep.meetingMetrics.revenue > 0) {
        celebrationTriggers.push({
          type: 'achievement',
          message: `${rep.name} signed ${rep.meetingMetrics.signed} contracts!`,
          rep: rep.name,
          value: rep.meetingMetrics.signed,
          animation: 'fireworks',
        });
      }
    }

    // Team revenue milestones
    if (ytdTotal >= 1000000) {
      celebrationTriggers.push({
        type: 'milestone',
        message: `Team has surpassed $${(ytdTotal / 1000000).toFixed(1)}M YTD revenue!`,
        value: ytdTotal,
        animation: 'fireworks',
      });
    }

    // Sum real YTD commissions for team total
    let teamActualCommissionsYTD = 0;
    ytdCommissionsByRep.forEach(v => { teamActualCommissionsYTD += v; });

    const response = {
      success: true,
      data: {
        leaderboard: view === 'compact' ? leaderboard.slice(0, 6) : leaderboard,
        summary: {
          // Correctly-named fields
          estimatedSalesAllTime: Math.round(grandTotal * 100) / 100,
          estimatedSalesWeekly: Math.round(weeklyTotal * 100) / 100,
          estimatedSalesMonthly: Math.round(monthlyTotal * 100) / 100,
          estimatedSalesYTD: Math.round(ytdTotal * 100) / 100,
          actualCommissionsYTD: Math.round(teamActualCommissionsYTD * 100) / 100,
          // Backward compat (deprecated — these are meeting revenue, NOT commissions)
          totalTeamCommissions: Math.round(grandTotal * 100) / 100,
          totalTransactions,
          weeklyTotal: Math.round(weeklyTotal * 100) / 100,
          monthlyTotal: Math.round(monthlyTotal * 100) / 100,
          ytdTotal: Math.round(ytdTotal * 100) / 100,
          avgTeamTransaction: totalTransactions > 0
            ? Math.round((grandTotal / totalTransactions) * 100) / 100
            : 0,
          dateGenerated: new Date().toISOString(),
        },
        celebrationTriggers,
      },
      dataSource: 'meeting-numbers',
      dataLabel: 'Estimated (Self-Reported from Monday Meetings)',
      revenueLabel: '$$$$$ = Estimated Sales (Accrual) — NOT actual commission',
      timestamp,
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=30',
      },
    });
  } catch (error) {
    console.error('[Leaderboard API Error]', error);
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
