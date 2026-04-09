/**
 * Weekly Numbers Leaderboard API
 *
 * Reads Monday meeting data from data/meeting-numbers-2026.json and builds
 * a leaderboard that can be filtered by any metric and time period.
 *
 * GET /api/command-center/weekly-leaderboard
 *   ?metric=inspected|damage|signed|repair|gutter|revenue|approved|goal|referrals|agents|homeShow
 *   &period=thisWeek|lastWeek|thisMonth|thisQuarter|thisYear|allTime|custom
 *   &startDate=2026-01-01  (required for period=custom, format YYYY-MM-DD)
 *   &endDate=2026-03-15    (required for period=custom, format YYYY-MM-DD)
 */

import { NextRequest, NextResponse } from 'next/server';
import { meetingNumbersService } from '@/lib/meeting-numbers-service';
import { validateSession } from '@/lib/auth-service';
import { getMasterReviewsRaw } from '@/lib/rep-reviews';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MeetingRecord {
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

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

const VALID_METRICS = [
  'inspected', 'damage', 'signed', 'repair', 'gutter',
  'revenue', 'approved', 'goal', 'referrals', 'agents', 'homeShow',
  'reviews',
] as const;

type MetricKey = typeof VALID_METRICS[number];

const METRIC_LABELS: Record<string, string> = {
  inspected: 'Inspected',
  damage: 'Damage',
  signed: 'Signed',
  repair: 'Repair',
  gutter: 'Gutter',
  revenue: '$$$$$ (Accrual Est.)',
  approved: 'Approved',
  goal: 'Goal',
  referrals: 'Referrals',
  agents: 'Agents',
  homeShow: 'Home Show',
  reviews: '★ Reviews (Customer)',
};

// Map from our metric keys to the raw JSON field names
const METRIC_TO_FIELD: Record<string, string> = {
  inspected: 'Inspected',
  damage: 'Damage',
  signed: 'Signed',
  repair: 'Repair',
  gutter: 'Gutter',
  revenue: '$$$$$',
  approved: 'Approved',
  goal: 'Goal',
  referrals: 'Referrals',
  agents: 'Agents',
  homeShow: 'Home Show',
  // 'reviews' is computed from rep-reviews.ts master data, not a meeting field
};

// Map a meeting record's repName to a canonical rep slug for review lookup.
// Meeting records use first names ("Adam", "Brendon"); slugs match teamData.ts
// so links from the leaderboard resolve to the right /team/[slug] page.
const REP_NAME_TO_SLUG: Record<string, string> = {
  'aaron': 'aaron',
  'adam': 'adam',
  'adam rudell': 'adam',
  'rudy': 'adam',
  'brendon': 'brendon',
  'brenden': 'brendon',
  'greg': 'greg',
  'hunter': 'hunter',
  'travis': 'travis',
  'rick': 'rick',
  'joseph': 'joseph-dowd',
  'joseph dowd': 'joseph-dowd',
  'alijah': 'alijah',
  'richard geahr': 'richard',
  'richard': 'richard',
};

function lookupRepSlug(repName: string): string | null {
  return REP_NAME_TO_SLUG[repName.trim().toLowerCase()] || null;
}

/**
 * Normalize meeting record rep names so variants like "Adam" / "Adam Rudell" /
 * "Rudy" all aggregate into a single leaderboard row keyed by canonical slug.
 */
function canonicalRepKey(repName: string): string {
  const slug = lookupRepSlug(repName);
  return slug || repName.trim().toLowerCase();
}

/**
 * Build a map of {repSlug → review count} optionally filtered by date range.
 * Reviews flow from data/reviews-master.json via lib/rep-reviews.ts.
 */
function buildReviewCounts(start?: string, end?: string): Map<string, number> {
  const all = getMasterReviewsRaw();
  const counts = new Map<string, number>();
  for (const r of all) {
    if (!r.repSlug) continue;
    if (start && r.date < start) continue;
    if (end && r.date > end) continue;
    counts.set(r.repSlug, (counts.get(r.repSlug) || 0) + 1);
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------

const VALID_PERIODS = [
  'thisWeek', 'lastWeek', 'thisMonth', 'thisQuarter', 'thisYear', 'allTime', 'custom',
] as const;

const PERIOD_LABELS: Record<string, string> = {
  thisWeek: 'This Week',
  lastWeek: 'Last Week',
  thisMonth: 'This Month',
  thisQuarter: 'This Quarter',
  thisYear: 'This Year',
  allTime: 'All Time',
  custom: 'Custom Range',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a numeric string. Handles "$17,000.00" style or plain "17000". */
function parseNumericValue(raw: string | undefined | null): number {
  if (!raw || raw.trim() === '') return 0;
  // Strip $ and commas
  const cleaned = raw.replace(/[$,]/g, '').trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/** Parse an integer value. Returns 0 for empty / non-numeric. */
function parseIntValue(raw: string | undefined | null): number {
  if (!raw || raw.trim() === '') return 0;
  const val = parseInt(raw, 10);
  return isNaN(val) ? 0 : val;
}

/** Get the Monday (start) of the week for a given date. */
function getMonday(d: Date): Date {
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = result.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

/** Get the Sunday (end) of the week for a given date. */
function getSunday(d: Date): Date {
  const monday = getMonday(d);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday;
}

/** Format a Date as YYYY-MM-DD */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Compute the date range (inclusive) for a given period.
 * Returns { start, end } as YYYY-MM-DD strings, or undefined for allTime.
 */
function getDateRange(
  period: string,
  startDate?: string,
  endDate?: string,
): { start?: string; end?: string; note?: string } {
  const now = new Date();

  switch (period) {
    case 'thisWeek': {
      return { start: formatDate(getMonday(now)), end: formatDate(getSunday(now)) };
    }
    case 'lastWeek': {
      const lastWeekDate = new Date(now);
      lastWeekDate.setDate(now.getDate() - 7);
      return { start: formatDate(getMonday(lastWeekDate)), end: formatDate(getSunday(lastWeekDate)) };
    }
    case 'thisMonth': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: formatDate(firstDay), end: formatDate(lastDay) };
    }
    case 'thisQuarter': {
      const quarter = Math.floor(now.getMonth() / 3);
      const firstDay = new Date(now.getFullYear(), quarter * 3, 1);
      const lastDay = new Date(now.getFullYear(), quarter * 3 + 3, 0);
      return { start: formatDate(firstDay), end: formatDate(lastDay) };
    }
    case 'thisYear': {
      return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` };
    }
    case 'custom': {
      if (!startDate || !endDate) {
        return { note: 'Custom period requires startDate and endDate query params (YYYY-MM-DD).' };
      }
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return { note: 'Invalid date format. Use YYYY-MM-DD for startDate and endDate.' };
      }
      const s = new Date(startDate + 'T00:00:00');
      const e = new Date(endDate + 'T00:00:00');
      if (isNaN(s.getTime()) || isNaN(e.getTime())) {
        return { note: 'Invalid date values for startDate or endDate.' };
      }
      if (s > e) {
        return { note: 'startDate must be before or equal to endDate.' };
      }
      return { start: startDate, end: endDate };
    }
    case 'allTime':
    default:
      return {}; // no filtering
  }
}

/** Extract the numeric value for a metric from a raw meeting record. */
function extractMetricValue(record: MeetingRecord, metricKey: string): number {
  const fieldName = METRIC_TO_FIELD[metricKey];
  if (!fieldName) return 0;
  const raw = (record as unknown as Record<string, string>)[fieldName];
  // Revenue ($$$$) may have $ and commas
  if (metricKey === 'revenue') {
    return parseNumericValue(raw);
  }
  return parseIntValue(raw);
}

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------

function loadMeetingData(): MeetingRecord[] {
  // Use meetingNumbersService which auto-syncs from Google Sheets every 5 min
  const records = meetingNumbersService.loadAllData();
  // Map back to raw format expected by this API
  return records.map(r => ({
    meetingDate: r.meetingDate,
    tabName: '',
    repName: r.repName,
    Inspected: String(r.inspected),
    Damage: String(r.damage),
    Signed: String(r.signed),
    Repair: String(r.repair),
    Gutter: String(r.gutter),
    '$$$$$': String(r.revenue),
    Approved: String(r.approved),
    Goal: String(r.goal),
    Referrals: String(r.referrals),
    Agents: String(r.agents),
    Present: r.present,
    'Home Show': String(r.homeShow),
  }));
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const metric = (searchParams.get('metric') || 'revenue') as MetricKey;
    const period = searchParams.get('period') || 'thisWeek';
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    // Check user role for visibility rules
    // Sales reps can only see other reps' CURRENT WEEK data after Monday meeting
    // Owners/admins always see everything
    let userRole = 'owner'; // default to full access if auth fails
    let userName = '';
    try {
      const session = await validateSession();
      if (session.valid && session.user) {
        userRole = session.user.role;
        userName = session.user.name;
      }
    } catch {
      // Auth failure = allow access (might be API call from command center)
    }

    // Validate metric
    if (!VALID_METRICS.includes(metric)) {
      return NextResponse.json(
        { success: false, error: `Invalid metric. Valid: ${VALID_METRICS.join(', ')}` },
        { status: 400 },
      );
    }

    // Compute date range
    const { start, end, note: periodNote } = getDateRange(period, startDate, endDate);

    // Load raw meeting data
    let records = loadMeetingData();

    // HARD RULE: Michael, Chris, Sara NEVER on sales/commission leaderboard
    // Also exclude: PMs (John, Bart), inactive (Rudy, Tae), drivers-only (Richard),
    // Boston (marketing), office staff (Destin, Tia)
    const EXCLUDED_FROM_LEADERBOARD = [
      'michael', 'chris', 'sara', 'john', 'bart', 'rudy', 'tae',
      'richard', 'destin', 'tia', 'boston',
    ];
    records = records.filter(r => {
      const name = r.repName?.trim().toLowerCase() || '';
      return !EXCLUDED_FROM_LEADERBOARD.includes(name);
    });

    // All reps can see all data - the leaderboard is for motivation
    // Visibility restriction removed: sales reps need to see competition

    // Filter by date range
    if (start && end) {
      records = records.filter(r => r.meetingDate >= start && r.meetingDate <= end);
    }

    // Group by repName and aggregate
    const repTotals = new Map<string, {
      repName: string;
      weeksReported: number;
      totals: Record<string, number>;
      weeklyBreakdown: { meetingDate: string; value: number }[];
    }>();

    for (const record of records) {
      if (!record.repName || record.repName.trim() === '') continue;

      // Use canonical slug as the key so "Adam" + "Adam Rudell" + "Rudy" all
      // aggregate into one row instead of three.
      const key = canonicalRepKey(record.repName);

      if (!repTotals.has(key)) {
        // Prefer the cleanest display name. If we have a slug, use the canonical
        // team name; otherwise use the trimmed raw name.
        const slug = lookupRepSlug(record.repName);
        const displayName = slug
          ? record.repName.trim().split(/\s+/)[0] // first name for sales reps
          : record.repName.trim();
        repTotals.set(key, {
          repName: displayName,
          weeksReported: 0,
          totals: {},
          weeklyBreakdown: [],
        });
      }

      const rep = repTotals.get(key)!;
      rep.weeksReported++;

      // Aggregate all metrics. 'reviews' is computed once after the loop —
      // it isn't a per-meeting field.
      for (const m of VALID_METRICS) {
        if (m === 'reviews') continue;
        const val = extractMetricValue(record, m);
        rep.totals[m] = (rep.totals[m] || 0) + val;
      }

      // Track weekly breakdown for the selected metric
      const metricVal = metric === 'reviews' ? 0 : extractMetricValue(record, metric);
      rep.weeklyBreakdown.push({ meetingDate: record.meetingDate, value: metricVal });
    }

    // Inject review counts (filtered by the same date range as the selected period)
    // so the leaderboard can sort by 'reviews' and so every metric panel shows
    // each rep's review count alongside their other numbers.
    const reviewCounts = buildReviewCounts(start, end);
    for (const rep of repTotals.values()) {
      const slug = lookupRepSlug(rep.repName);
      rep.totals.reviews = slug ? (reviewCounts.get(slug) || 0) : 0;
    }

    // Sort by selected metric descending
    const sorted = Array.from(repTotals.values())
      .filter(r => r.weeksReported > 0)
      .sort((a, b) => (b.totals[metric] || 0) - (a.totals[metric] || 0));

    // Build leaderboard
    const leaderboard = sorted.map((rep, index) => ({
      rank: index + 1,
      repName: rep.repName,
      metricValue: rep.totals[metric] || 0,
      allMetrics: rep.totals,
      weeksReported: rep.weeksReported,
      weeklyBreakdown: rep.weeklyBreakdown.sort((a, b) => a.meetingDate.localeCompare(b.meetingDate)),
    }));

    return NextResponse.json({
      success: true,
      dataSource: 'monday-meeting',
      dataSourceLabel: 'Monday Meeting Numbers (Accrual Estimates — NOT actual commissions)',
      metric,
      metricLabel: METRIC_LABELS[metric] || metric,
      period,
      ...(periodNote ? { periodNote } : {}),
      dateRange: { start: start || null, end: end || null },
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
      { status: 500 },
    );
  }
}
