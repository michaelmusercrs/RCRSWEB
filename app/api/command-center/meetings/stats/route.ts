/**
 * RCRS Command Center - Meeting Statistics API
 *
 * Provides aggregated statistics for Monday meetings including:
 * - Weekly/Monthly/YTD commission summaries
 * - Rep performance comparisons
 * - Goal tracking metrics
 * - Period-over-period comparisons
 *
 * GET /api/command-center/meetings/stats
 * Query params:
 *   - period: 'week' | 'month' | 'ytd' (default: 'week')
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import commissionsData from '@/data/commissions.json';

// ============================================================================
// Types
// ============================================================================

interface CommissionEntry {
  salesRep: string;
  date: Date;
  amount: number;
  balance: number;
  dateString: string;
}

interface RepPeriodStats {
  name: string;
  currentPeriod: number;
  previousPeriod: number;
  change: number;
  changePercent: number;
  transactionCount: number;
  avgTransaction: number;
  rank: number;
  isHot: boolean; // Top performer or improving
  isCold: boolean; // Underperforming
}

interface MeetingStats {
  period: 'week' | 'month' | 'ytd';
  periodLabel: string;
  dateRange: {
    start: string;
    end: string;
  };
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
}

interface RawCommissionRecord {
  salesRep: string;
  date: string;
  amount: number;
  balance: number;
}

// ============================================================================
// Goals Configuration
// ============================================================================

const GOALS = {
  weeklyTarget: 15000, // $15K per week target
  monthlyTarget: 65000, // $65K per month target
  yearlyTarget: 780000, // $780K per year target
};

// ============================================================================
// Utility Functions
// ============================================================================

function parseDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;

  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);

  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  if (year < 100) {
    year = 2000 + year;
  }

  if (year < 2019 || year > 2030) return null;

  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1) return null;

  return date;
}

function normalizeRepName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getWeekBoundaries(date: Date): { start: Date; end: Date } {
  const dayOfWeek = date.getDay();
  const start = new Date(date);
  start.setDate(date.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function getPreviousWeekBoundaries(date: Date): { start: Date; end: Date } {
  const current = getWeekBoundaries(date);
  const start = new Date(current.start);
  start.setDate(start.getDate() - 7);
  const end = new Date(current.end);
  end.setDate(end.getDate() - 7);
  return { start, end };
}

function getMonthBoundaries(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function getPreviousMonthBoundaries(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const end = new Date(date.getFullYear(), date.getMonth(), 0, 23, 59, 59, 999);
  return { start, end };
}

function getYTDBoundaries(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), 0, 1);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getPreviousYTDBoundaries(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear() - 1, 0, 1);
  const end = new Date(date.getFullYear() - 1, date.getMonth(), date.getDate());
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// ============================================================================
// Data Processing
// ============================================================================

function loadAndParseData(): CommissionEntry[] {
  const rawData = commissionsData as RawCommissionRecord[];
  const entries: CommissionEntry[] = [];

  for (const record of rawData) {
    const salesRep = normalizeRepName(record.salesRep);
    const date = parseDate(record.date);

    if (!date || !salesRep) continue;

    entries.push({
      salesRep,
      date,
      amount: record.amount,
      balance: record.balance,
      dateString: record.date,
    });
  }

  return entries.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function filterByDateRange(
  entries: CommissionEntry[],
  start: Date,
  end: Date
): CommissionEntry[] {
  return entries.filter((e) => e.date >= start && e.date <= end);
}

function calculateRepStats(
  currentEntries: CommissionEntry[],
  previousEntries: CommissionEntry[]
): RepPeriodStats[] {
  const currentMap = new Map<string, { total: number; count: number }>();
  const previousMap = new Map<string, { total: number; count: number }>();

  let grandTotal = 0;

  for (const entry of currentEntries) {
    if (!currentMap.has(entry.salesRep)) {
      currentMap.set(entry.salesRep, { total: 0, count: 0 });
    }
    const stats = currentMap.get(entry.salesRep)!;
    stats.total += entry.amount;
    stats.count++;
    grandTotal += entry.amount;
  }

  for (const entry of previousEntries) {
    if (!previousMap.has(entry.salesRep)) {
      previousMap.set(entry.salesRep, { total: 0, count: 0 });
    }
    const stats = previousMap.get(entry.salesRep)!;
    stats.total += entry.amount;
    stats.count++;
  }

  const repStats: RepPeriodStats[] = [];

  for (const [name, current] of currentMap.entries()) {
    const previous = previousMap.get(name) || { total: 0, count: 0 };
    const change = current.total - previous.total;
    const changePercent =
      previous.total > 0 ? ((change / previous.total) * 100) : (current.total > 0 ? 100 : 0);

    repStats.push({
      name,
      currentPeriod: Math.round(current.total * 100) / 100,
      previousPeriod: Math.round(previous.total * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 10) / 10,
      transactionCount: current.count,
      avgTransaction:
        current.count > 0 ? Math.round((current.total / current.count) * 100) / 100 : 0,
      rank: 0,
      isHot: false,
      isCold: false,
    });
  }

  // Sort by current period and assign ranks
  repStats.sort((a, b) => b.currentPeriod - a.currentPeriod);
  repStats.forEach((rep, index) => {
    rep.rank = index + 1;
    // Top 3 or improving significantly
    rep.isHot = index < 3 || rep.changePercent > 20;
    // Bottom performers or declining significantly
    rep.isCold = index >= repStats.length - 2 || rep.changePercent < -20;
  });

  return repStats;
}

function detectMilestones(
  repStats: RepPeriodStats[],
  allTimeStats: Map<string, number>
): MeetingStats['milestones'] {
  const milestones: MeetingStats['milestones'] = [];

  for (const rep of repStats) {
    const allTimeTotal = allTimeStats.get(rep.name) || 0;

    // Career milestones
    if (allTimeTotal >= 700000 && allTimeTotal < 750000) {
      milestones.push({
        type: 'achievement',
        title: 'Approaching $750K!',
        description: `${rep.name} is closing in on $750K career commissions`,
        rep: rep.name,
        value: allTimeTotal,
      });
    }

    if (allTimeTotal >= 600000 && allTimeTotal < 650000) {
      milestones.push({
        type: 'achievement',
        title: '$600K Club',
        description: `${rep.name} has reached $600K in career commissions`,
        rep: rep.name,
        value: allTimeTotal,
      });
    }

    // Weekly streaks
    if (rep.changePercent > 50) {
      milestones.push({
        type: 'streak',
        title: 'On Fire!',
        description: `${rep.name} is up ${rep.changePercent.toFixed(1)}% vs last period`,
        rep: rep.name,
        value: rep.changePercent,
      });
    }

    // Record weeks
    if (rep.currentPeriod > 5000) {
      milestones.push({
        type: 'record',
        title: 'Big Week!',
        description: `${rep.name} closed $${(rep.currentPeriod / 1000).toFixed(1)}K this period`,
        rep: rep.name,
        value: rep.currentPeriod,
      });
    }
  }

  return milestones.slice(0, 5); // Limit to 5 milestones
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

    const now = new Date();
    const allEntries = loadAndParseData();

    // Get date boundaries based on period
    let currentBoundaries: { start: Date; end: Date };
    let previousBoundaries: { start: Date; end: Date };
    let periodLabel: string;

    switch (period) {
      case 'week':
        currentBoundaries = getWeekBoundaries(now);
        previousBoundaries = getPreviousWeekBoundaries(now);
        periodLabel = 'This Week';
        break;
      case 'month':
        currentBoundaries = getMonthBoundaries(now);
        previousBoundaries = getPreviousMonthBoundaries(now);
        periodLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        break;
      case 'ytd':
        currentBoundaries = getYTDBoundaries(now);
        previousBoundaries = getPreviousYTDBoundaries(now);
        periodLabel = `YTD ${now.getFullYear()}`;
        break;
    }

    // Filter entries
    const currentEntries = filterByDateRange(
      allEntries,
      currentBoundaries.start,
      currentBoundaries.end
    );
    const previousEntries = filterByDateRange(
      allEntries,
      previousBoundaries.start,
      previousBoundaries.end
    );

    // Calculate totals
    let currentTotal = 0;
    let previousTotal = 0;

    for (const e of currentEntries) currentTotal += e.amount;
    for (const e of previousEntries) previousTotal += e.amount;

    currentTotal = Math.round(currentTotal * 100) / 100;
    previousTotal = Math.round(previousTotal * 100) / 100;

    const commissionChange = currentTotal - previousTotal;
    const commissionChangePercent =
      previousTotal > 0 ? (commissionChange / previousTotal) * 100 : currentTotal > 0 ? 100 : 0;

    const transactionChange = currentEntries.length - previousEntries.length;
    const transactionChangePercent =
      previousEntries.length > 0
        ? (transactionChange / previousEntries.length) * 100
        : currentEntries.length > 0
          ? 100
          : 0;

    // Calculate rep stats
    const repStats = calculateRepStats(currentEntries, previousEntries);

    // Calculate all-time totals for milestones
    const allTimeStats = new Map<string, number>();
    for (const e of allEntries) {
      allTimeStats.set(e.salesRep, (allTimeStats.get(e.salesRep) || 0) + e.amount);
    }

    // Find top performer
    const topPerformer = repStats[0] || { name: 'N/A', currentPeriod: 0 };
    const topPerformerPercent =
      currentTotal > 0 ? (topPerformer.currentPeriod / currentTotal) * 100 : 0;

    // Detect milestones
    const milestones = detectMilestones(repStats, allTimeStats);

    // Calculate goal progress
    const weekBoundaries = getWeekBoundaries(now);
    const monthBoundaries = getMonthBoundaries(now);
    const ytdBoundaries = getYTDBoundaries(now);

    let weekTotal = 0;
    let monthTotal = 0;
    let ytdTotal = 0;

    for (const e of allEntries) {
      if (e.date >= weekBoundaries.start && e.date <= weekBoundaries.end) {
        weekTotal += e.amount;
      }
      if (e.date >= monthBoundaries.start && e.date <= monthBoundaries.end) {
        monthTotal += e.amount;
      }
      if (e.date >= ytdBoundaries.start && e.date <= ytdBoundaries.end) {
        ytdTotal += e.amount;
      }
    }

    const stats: MeetingStats = {
      period,
      periodLabel,
      dateRange: {
        start: formatDateISO(currentBoundaries.start),
        end: formatDateISO(currentBoundaries.end),
      },
      totalCommissions: currentTotal,
      totalTransactions: currentEntries.length,
      avgTransaction:
        currentEntries.length > 0
          ? Math.round((currentTotal / currentEntries.length) * 100) / 100
          : 0,
      previousPeriod: {
        totalCommissions: previousTotal,
        totalTransactions: previousEntries.length,
      },
      change: {
        commissions: Math.round(commissionChange * 100) / 100,
        commissionsPercent: Math.round(commissionChangePercent * 10) / 10,
        transactions: transactionChange,
        transactionsPercent: Math.round(transactionChangePercent * 10) / 10,
      },
      topPerformer: {
        name: topPerformer.name,
        amount: topPerformer.currentPeriod,
        percentOfTotal: Math.round(topPerformerPercent * 10) / 10,
      },
      repStats,
      goals: {
        weeklyTarget: GOALS.weeklyTarget,
        monthlyTarget: GOALS.monthlyTarget,
        yearlyTarget: GOALS.yearlyTarget,
        weeklyProgress: Math.round((weekTotal / GOALS.weeklyTarget) * 1000) / 10,
        monthlyProgress: Math.round((monthTotal / GOALS.monthlyTarget) * 1000) / 10,
        yearlyProgress: Math.round((ytdTotal / GOALS.yearlyTarget) * 1000) / 10,
      },
      milestones,
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
