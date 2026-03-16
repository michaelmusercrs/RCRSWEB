/**
 * Weekly Numbers Leaderboard API
 *
 * Reads RepWeeklyNumbers from Google Sheets and builds a leaderboard
 * that can be filtered by any metric. This is the REAL data pipeline:
 * reps enter numbers → Google Sheets → this API → leaderboard page.
 *
 * GET /api/command-center/weekly-leaderboard
 *   ?metric=doorsKnocked|appointmentsSet|inspectionsCompleted|estimatesGiven|
 *           contractsSigned|estimatedRevenue|revenueClosed|realSales|
 *           leadsGenerated|followUpsMade|points
 *   &period=thisWeek|lastWeek|thisMonth|thisQuarter|thisYear|allTime|day|biannual|custom
 *   &week=2026-W11  (optional: specific week)
 *   &startDate=2026-01-01  (required for period=custom, format YYYY-MM-DD)
 *   &endDate=2026-03-15    (required for period=custom, format YYYY-MM-DD)
 */

import { NextRequest, NextResponse } from 'next/server';
import { googleSheetsService, RepWeeklyNumbersRecord } from '@/lib/google-sheets-service';

// Valid metrics that can be used for ranking
// These match the RepWeeklyNumbers sheet columns exactly
const VALID_METRICS = [
  'doorsKnocked', 'appointmentsSet', 'inspectionsCompleted',
  'estimatesGiven', 'contractsSigned',
  'revenueClosed', 'leadsGenerated', 'followUpsMade',
  'points', // composite score
] as const;

type MetricKey = typeof VALID_METRICS[number];

const METRIC_LABELS: Record<string, string> = {
  doorsKnocked: 'Doors Knocked',
  appointmentsSet: 'Appointments Set',
  inspectionsCompleted: 'Inspections Completed',
  estimatesGiven: 'Estimates Given',
  contractsSigned: 'Contracts Signed',
  revenueClosed: 'Revenue Closed',
  leadsGenerated: 'Leads Generated',
  followUpsMade: 'Follow-ups Made',
  points: 'Total Points',
};

// Excluded from leaderboard (owners, managers, office, subs)
const EXCLUDED_NAMES = [
  'michael muse', 'chris muse', 'sara hill',
  'john cordonis', 'bart roberts', 'destin mccary',
  'tia muse morris', 'diego garcia', 'jesus lara',
  'jesus m lara', 'rogelio gonzalez', 'rogelio gonzalez-flores',
];

function getISOWeekString(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// All supported period values
const VALID_PERIODS = [
  'thisWeek', 'lastWeek', 'thisMonth', 'thisQuarter', 'thisYear', 'allTime',
  'day', 'biannual', 'custom',
] as const;

const PERIOD_LABELS: Record<string, string> = {
  thisWeek: 'This Week',
  lastWeek: 'Last Week',
  thisMonth: 'This Month',
  thisQuarter: 'This Quarter',
  thisYear: 'This Year',
  allTime: 'All Time',
  day: 'Today (Weekly Granularity)',
  biannual: 'This Half-Year',
  custom: 'Custom Range',
};

function getWeekRange(
  period: string,
  specificWeek?: string,
  startDate?: string,
  endDate?: string,
): { weekStart?: string; weekEnd?: string; note?: string } {
  const now = new Date();
  const currentWeek = getISOWeekString(now);

  if (specificWeek) {
    return { weekStart: specificWeek, weekEnd: specificWeek };
  }

  switch (period) {
    case 'thisWeek':
      return { weekStart: currentWeek, weekEnd: currentWeek };
    case 'day':
      // Weekly numbers don't have day-level granularity, so return current week
      return {
        weekStart: currentWeek,
        weekEnd: currentWeek,
        note: 'Weekly data does not have day-level granularity. Showing current week data.',
      };
    case 'lastWeek': {
      const match = currentWeek.match(/^(\d{4})-W(\d{2})$/);
      if (!match) return {};
      let year = parseInt(match[1]);
      let weekNum = parseInt(match[2]) - 1;
      if (weekNum < 1) { year--; weekNum = 52; }
      const lastWeek = `${year}-W${String(weekNum).padStart(2, '0')}`;
      return { weekStart: lastWeek, weekEnd: lastWeek };
    }
    case 'thisMonth': {
      const year = now.getFullYear();
      const month = now.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      return { weekStart: getISOWeekString(firstDay), weekEnd: getISOWeekString(lastDay) };
    }
    case 'thisQuarter': {
      const year = now.getFullYear();
      const quarter = Math.floor(now.getMonth() / 3);
      const firstDay = new Date(year, quarter * 3, 1);
      const lastDay = new Date(year, quarter * 3 + 3, 0);
      return { weekStart: getISOWeekString(firstDay), weekEnd: getISOWeekString(lastDay) };
    }
    case 'biannual': {
      const year = now.getFullYear();
      const month = now.getMonth(); // 0-indexed
      if (month < 6) {
        // H1: January through June → W01-W26
        return { weekStart: `${year}-W01`, weekEnd: `${year}-W26` };
      } else {
        // H2: July through December → W27-W52
        return { weekStart: `${year}-W27`, weekEnd: `${year}-W52` };
      }
    }
    case 'thisYear': {
      const year = now.getFullYear();
      return { weekStart: `${year}-W01`, weekEnd: `${year}-W52` };
    }
    case 'custom': {
      if (!startDate || !endDate) {
        return {
          note: 'Custom period requires startDate and endDate query params (YYYY-MM-DD).',
        };
      }
      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return {
          note: 'Invalid date format. Use YYYY-MM-DD for startDate and endDate.',
        };
      }
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T00:00:00');
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return {
          note: 'Invalid date values for startDate or endDate.',
        };
      }
      if (start > end) {
        return {
          note: 'startDate must be before or equal to endDate.',
        };
      }
      return { weekStart: getISOWeekString(start), weekEnd: getISOWeekString(end) };
    }
    case 'allTime':
    default:
      return {};
  }
}

// Calculate a composite points score from all metrics
function calculatePoints(totals: Record<string, number>): number {
  return (
    (totals.doorsKnocked || 0) * 1 +
    (totals.appointmentsSet || 0) * 3 +
    (totals.inspectionsCompleted || 0) * 5 +
    (totals.estimatesGiven || 0) * 4 +
    (totals.contractsSigned || 0) * 10 +
    Math.floor((totals.revenueClosed || 0) / 1000) * 2 +
    (totals.leadsGenerated || 0) * 2 +
    (totals.followUpsMade || 0) * 1
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const metric = (searchParams.get('metric') || 'points') as MetricKey;
    const period = searchParams.get('period') || 'thisWeek';
    const specificWeek = searchParams.get('week') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    if (!VALID_METRICS.includes(metric)) {
      return NextResponse.json(
        { success: false, error: `Invalid metric. Valid: ${VALID_METRICS.join(', ')}` },
        { status: 400 }
      );
    }

    // Get week range for the period
    const { weekStart, weekEnd, note: periodNote } = getWeekRange(period, specificWeek, startDate, endDate);

    // Fetch ALL reps' weekly numbers from Google Sheets
    const records = await googleSheetsService.getRepWeeklyNumbers({
      weekStart,
      weekEnd,
    });

    // Group by rep and aggregate
    const repTotals = new Map<string, {
      repName: string;
      repEmail: string;
      weeksReported: number;
      totals: Record<string, number>;
      weeklyBreakdown: { week: string; value: number }[];
    }>();

    for (const record of records) {
      // Skip excluded names
      if (EXCLUDED_NAMES.includes(record.repName.toLowerCase())) continue;
      if (!record.repName || !record.repEmail) continue;

      const key = record.repEmail.toLowerCase();
      if (!repTotals.has(key)) {
        repTotals.set(key, {
          repName: record.repName,
          repEmail: record.repEmail,
          weeksReported: 0,
          totals: {},
          weeklyBreakdown: [],
        });
      }

      const rep = repTotals.get(key)!;
      rep.weeksReported++;

      // Aggregate all numeric fields (matches RepWeeklyNumbers sheet columns)
      const numericFields = [
        'doorsKnocked', 'appointmentsSet', 'inspectionsCompleted',
        'estimatesGiven', 'contractsSigned',
        'revenueClosed', 'leadsGenerated', 'followUpsMade',
      ];

      for (const field of numericFields) {
        const val = (record as Record<string, unknown>)[field] as number || 0;
        rep.totals[field] = (rep.totals[field] || 0) + val;
      }

      // Track weekly breakdown for the selected metric
      const metricVal = metric === 'points'
        ? 0  // calculated after
        : (record as Record<string, unknown>)[metric] as number || 0;
      rep.weeklyBreakdown.push({ week: record.week, value: metricVal });
    }

    // Calculate points for each rep
    for (const [, rep] of repTotals) {
      rep.totals.points = calculatePoints(rep.totals);
      // Update weekly breakdown for points metric
      if (metric === 'points') {
        // For points, we just show the total - breakdown isn't per-week
        rep.weeklyBreakdown = [{ week: 'total', value: rep.totals.points }];
      }
    }

    // Sort by selected metric
    const sorted = Array.from(repTotals.values())
      .filter(r => r.weeksReported > 0)
      .sort((a, b) => (b.totals[metric] || 0) - (a.totals[metric] || 0));

    // Build leaderboard
    const leaderboard = sorted.map((rep, index) => ({
      rank: index + 1,
      repName: rep.repName,
      repEmail: rep.repEmail,
      metricValue: rep.totals[metric] || 0,
      weeksReported: rep.weeksReported,
      allMetrics: rep.totals,
      weeklyBreakdown: rep.weeklyBreakdown.sort((a, b) => a.week.localeCompare(b.week)),
    }));

    return NextResponse.json({
      success: true,
      dataSource: 'monday-meeting',
      dataSourceLabel: 'Monday Meeting Numbers (Self-Reported)',
      metric,
      metricLabel: METRIC_LABELS[metric] || metric,
      period,
      ...(periodNote ? { periodNote } : {}),
      weekRange: { weekStart, weekEnd },
      currentWeek: getISOWeekString(),
      leaderboard,
      totalReps: leaderboard.length,
      availableMetrics: VALID_METRICS.map(m => ({
        key: m,
        label: METRIC_LABELS[m] || m,
      })),
      availablePeriods: VALID_PERIODS.map(p => ({
        key: p,
        label: PERIOD_LABELS[p] || p,
      })),
    });
  } catch (error) {
    console.error('Error building weekly leaderboard:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to build leaderboard',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
