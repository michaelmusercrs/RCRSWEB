/**
 * Activity Leaderboard — third of the "Three Separate Leaderboards"
 *
 * Reads the `RepWeeklyNumbers` Google Sheet tab and aggregates self-reported
 * activity per rep over the selected period. Mirrors the shape of
 * /api/command-center/meetings/leaderboard so the page can swap between
 * Sales / Commission / Activity views with consistent UI.
 *
 * GET /api/command-center/meetings/activity-leaderboard
 * Query params:
 *   period: 'thisWeek' | 'thisMonth' | 'thisYear' | 'allTime' (default: 'thisMonth')
 *   metric: sort metric (default: 'revenueClosed')
 *
 * Per hard rule: this is THE activity leaderboard.
 *   - "Sales" leaderboard = Monday meeting accrual ($$$$$ column)
 *   - "Commission" leaderboard = actual QB 1099 payouts
 *   - "Activity" leaderboard = doors knocked, appointments set, etc. (THIS endpoint)
 * The three are intentionally separate. Don't combine.
 */

import { NextRequest, NextResponse } from 'next/server';
import { googleSheetsService } from '@/lib/google-sheets-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface AggregatedRep {
  repName: string;
  initials: string;
  doorsKnocked: number;
  appointmentsSet: number;
  inspectionsCompleted: number;
  estimatesGiven: number;
  contractsSigned: number;
  revenueClosed: number;
  leadsGenerated: number;
  followUpsMade: number;
  weeksReporting: number;
  rank: number;
}

const EXCLUDED_FROM_LEADERBOARD = [
  'michael', 'chris', 'sara', 'john', 'bart', 'rudy', 'tae',
  'richard', 'destin', 'tia', 'boston',
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Convert ISO week 'YYYY-Wnn' to Monday YYYY-MM-DD for period filtering. */
function isoWeekToMonday(weekStr: string): string {
  const m = (weekStr || '').match(/^(\d{4})-W(\d{2})$/);
  if (!m) return '';
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow = jan4.getUTCDay() || 7;
  const monday = new Date(jan4.getTime());
  monday.setUTCDate(jan4.getUTCDate() - dow + 1 + (week - 1) * 7);
  return monday.toISOString().slice(0, 10);
}

function getPeriodBounds(period: string): { start: string; end: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  switch (period) {
    case 'thisWeek': {
      const day = now.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const mon = new Date(now);
      mon.setDate(now.getDate() + diff);
      return { start: mon.toISOString().slice(0, 10), end: today };
    }
    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: start.toISOString().slice(0, 10), end: today };
    }
    case 'thisYear':
      return { start: `${now.getFullYear()}-01-01`, end: today };
    case 'allTime':
    default:
      return { start: '2019-01-01', end: today };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'thisMonth';
  const sortMetric = (searchParams.get('metric') || 'revenueClosed') as keyof AggregatedRep;

  try {
    const records = await googleSheetsService.getRepWeeklyNumbers();
    if (!records || records.length === 0) {
      return NextResponse.json({
        success: true,
        data: { leaderboard: [], summary: { totalReps: 0 } },
        period,
        message: 'No RepWeeklyNumbers data found',
      });
    }

    const { start, end } = getPeriodBounds(period);
    const inRange = records.filter(r => {
      const monday = isoWeekToMonday(r.week);
      if (!monday) return false;
      return monday >= start && monday <= end;
    });

    const byRep = new Map<string, AggregatedRep>();
    for (const r of inRange) {
      const name = (r.repName || '').trim();
      if (!name) continue;
      const lower = name.toLowerCase();
      if (EXCLUDED_FROM_LEADERBOARD.some(ex => lower.includes(ex))) continue;

      const existing = byRep.get(name) || {
        repName: name,
        initials: getInitials(name),
        doorsKnocked: 0,
        appointmentsSet: 0,
        inspectionsCompleted: 0,
        estimatesGiven: 0,
        contractsSigned: 0,
        revenueClosed: 0,
        leadsGenerated: 0,
        followUpsMade: 0,
        weeksReporting: 0,
        rank: 0,
      };
      existing.doorsKnocked        += r.doorsKnocked        || 0;
      existing.appointmentsSet     += r.appointmentsSet     || 0;
      existing.inspectionsCompleted+= r.inspectionsCompleted|| 0;
      existing.estimatesGiven      += r.estimatesGiven      || 0;
      existing.contractsSigned     += r.contractsSigned     || 0;
      existing.revenueClosed       += r.revenueClosed       || 0;
      existing.leadsGenerated      += r.leadsGenerated      || 0;
      existing.followUpsMade       += r.followUpsMade       || 0;
      existing.weeksReporting      += 1;
      byRep.set(name, existing);
    }

    const leaderboard = [...byRep.values()];
    leaderboard.sort((a, b) => (b[sortMetric] as number) - (a[sortMetric] as number));
    leaderboard.forEach((rep, i) => { rep.rank = i + 1; });

    const summary = {
      totalReps: leaderboard.length,
      totalWeeksReporting: leaderboard.reduce((s, r) => s + r.weeksReporting, 0),
      totalDoorsKnocked: leaderboard.reduce((s, r) => s + r.doorsKnocked, 0),
      totalAppointments: leaderboard.reduce((s, r) => s + r.appointmentsSet, 0),
      totalContractsSigned: leaderboard.reduce((s, r) => s + r.contractsSigned, 0),
      totalRevenueClosed: leaderboard.reduce((s, r) => s + r.revenueClosed, 0),
    };

    return NextResponse.json({
      success: true,
      data: { leaderboard, summary },
      period,
      periodBounds: { start, end },
      sortMetric,
      recordsInPeriod: inRange.length,
      timestamp: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    });
  } catch (err) {
    console.error('[ActivityLeaderboard] Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
