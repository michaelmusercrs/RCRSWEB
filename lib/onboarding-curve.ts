/**
 * Rookie Ramp Curve — per-rep onboarding analysis.
 *
 * For each rep we measure:
 *   - first appearance in the Monday meeting sheet (their start week)
 *   - weeks elapsed until their first non-zero Signed entry
 *   - weeks elapsed until their first commission payment in commissions.json
 *   - cumulative signed count week-by-week from start (the ramp curve)
 *
 * Each rep's curve is normalized to "weeks since first appearance" so
 * reps with different calendar start dates can be overlaid for comparison.
 *
 * Per [[project-attendance-rules]] excused weeks (Present = E/EX/EXC/EXCUSED)
 * do not count against the denominator — we still count weeks of tenure
 * by calendar (week index from first appearance) but a rep with mostly
 * excused weeks early on still gets a fair "weeks to first signed" since
 * we measure to the first non-zero Signed regardless of attendance.
 *
 * Baselines are the median across reps with >= 12 weeks of history.
 * Reps with < 12 weeks are flagged "still ramping" and not used to build
 * the baseline (avoids skewing toward recent hires).
 *
 * Sources:
 *   data/meeting-numbers-all.json       — Monday rep-weeks 2019 → 2025
 *   data/meeting-numbers-2026.json      — current year overlay
 *   data/commissions.json               — QB-booked commission payments
 *
 * Sheet-cache slug: 'onboarding'.
 */

import { promises as fs } from 'fs';
import path from 'path';

interface MeetingRow {
  meetingDate: string;
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
  tabName: string;
}

interface CommissionRow {
  salesRep: string;
  date: string;       // MM/DD/YYYY
  amount: number;
  balance: number;
  jobNumber: string;
  customer: string;
}

/**
 * The Monday sheet uses first names ("Hunter", "Aaron") while
 * commissions.json uses full legal names ("Hunter Rivers", "Aaron Lussi").
 * This map joins them. Only includes reps that appear in BOTH datasets
 * with a signed/commission history we can reason about.
 *
 * Order: meeting-sheet name -> commissions.json name.
 */
const REP_ALIASES: Record<string, string> = {
  'Hunter': 'Hunter Rivers',
  'Dustin': 'Dustin Shariett',
  'Wess': 'Christopher Wess Cozelos',
  'Ryan': 'Ryan Butcher',
  'Sean': 'Sean Newberry',
  'Brandon': 'Brandon Smith',
  'John': 'John Cordonis',
  'Adam': 'Adam Rudell',
  'Aaron': 'Aaron Lussi',
  'Aaron B': 'Aaron Boykin',
  'Boykin': 'Aaron Boykin',
  'Gary': 'Gary Lindsey',
  'Jacob': 'Jacob Hill',
  'Taylor': 'Taylor Jones',
  'Brendon': 'Brendon Muse',
  'Tim': 'Tim Hall',
  'Ethan': 'Ethan Frith',
  'Brian': 'Brian Sullivan',
  'Danny': 'Daniel Ganas',
  'Greg': 'Greg Muse',
  'Clay': 'Roger Braden Speegle',  // "Clay" is Braden's go-by
  'Travis': 'Travis Wages',
  'Joseph': 'Joseph Dowd',
  'Joseph Dowd': 'Joseph Dowd',
  'Alijah': 'Alijah Coleman',
  'Rudy': 'Rudy', // rep LLC — no direct commission match
  'Rick': 'Rick',
  'Chris': 'Chris Muse',
  'Michael': 'Michael Muse',
  'Wayne': 'Wayne',
  'M.J.': 'MJ Muse',
  'Jason': 'Jason Cagle',
  'Buck': 'Buck',
  'Richard Geahr': 'Richard Geahr',
  'Adam Rudell': 'Adam Rudell',
};

function parseN(v: unknown): number {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').replace(/[,$]/g, '').trim();
  if (!s) return 0;
  const lo = s.toLowerCase();
  if (lo === 'e' || lo === 'ex' || lo === 'exc' || lo === 'excused') return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function isExcused(v: string | undefined): boolean {
  const s = String(v ?? '').trim().toUpperCase();
  return s === 'E' || s === 'EX' || s === 'EXC' || s === 'EXCUSED';
}

/**
 * Parse "MM/DD/YYYY" → YYYY-MM-DD (sortable). Returns '' on bad input.
 */
function commissionDateToIso(d: string): string {
  if (!d) return '';
  const parts = d.split('/');
  if (parts.length !== 3) return '';
  const [m, dd, y] = parts;
  if (!m || !dd || !y) return '';
  return `${y}-${m.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

/**
 * Whole weeks between two ISO dates (a → b), floored to integer.
 */
function weeksBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms)) return 0;
  return Math.floor(ms / (7 * 86400000));
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export interface OnboardingRep {
  rep: string;                        // canonical display name (commissions name if available, else meeting name)
  meetingAlias: string;               // what the meeting sheet calls them
  firstWeek: string;                  // ISO date of first appearance in meeting sheet
  lastWeek: string;                   // most recent meeting-sheet appearance
  weeksOnTeam: number;                // weeks from firstWeek → today (or lastWeek for departed reps)
  weeksOfHistory: number;             // distinct meeting weeks logged (includes excused, since we want tenure)
  weeksToFirstSigned: number | null;  // null if never signed
  weeksToFirstCommission: number | null;  // null if no commission yet
  totalSignedYr1: number;             // signed count in first 52 weeks (capped at weeksOnTeam)
  totalCommissionYr1: number;         // commission $ in first 52 weeks
  signedCountByWeek: Array<{ weekIndex: number; cumSigned: number; signedThisWeek: number }>;
  status: 'ahead' | 'on-track' | 'behind' | 'still-ramping';
  note: string;                       // human-readable summary line
}

export interface OnboardingResponse {
  generatedAt: string;
  baseline: {
    medianWeeksToFirstSigned: number;
    medianWeeksToFirstCommission: number;
    totalSignedYr1Median: number;
    repsInBaseline: number;        // count of reps with >= 12 weeks AND a first-signed event
    minWeeksForBaseline: number;   // = 12 (exposed for the UI footer)
  };
  reps: OnboardingRep[];
  meta: {
    meetingRows: number;
    commissionRows: number;
    repsAnalyzed: number;
    repsStillRamping: number;
  };
}

const _cache: { data: OnboardingResponse; at: number } = {
  data: null as unknown as OnboardingResponse,
  at: 0,
};
const CACHE_TTL_MS = 10 * 60 * 1000;
// Accept a sheet-cache row up to 90 min old (one missed cron tick).
const SHEET_CACHE_MAX_AGE_MS = 90 * 60 * 1000;

const MIN_WEEKS_FOR_BASELINE = 12;
const YR1_WEEKS = 52;

export async function getOnboardingCurve(): Promise<OnboardingResponse> {
  if (_cache.data && Date.now() - _cache.at < CACHE_TTL_MS) return _cache.data;

  // Try the precomputed sheet cache before paying for live compute.
  try {
    const { readChrisviewCache } = await import('./chrisview-sheet-cache');
    const cached = await readChrisviewCache<OnboardingResponse>('onboarding');
    if (cached) {
      const age = Date.now() - new Date(cached.generatedAt).getTime();
      if (Number.isFinite(age) && age < SHEET_CACHE_MAX_AGE_MS) {
        _cache.data = cached.payload;
        _cache.at = Date.now();
        return cached.payload;
      }
    }
  } catch (err) {
    // Sheet cache is best-effort — fall through to live compute on any failure.
    console.warn('[onboarding-curve] sheet cache read failed:', err);
  }

  const data = await computeOnboardingCurve();
  _cache.data = data;
  _cache.at = Date.now();
  return data;
}

async function computeOnboardingCurve(): Promise<OnboardingResponse> {
  const meetingFile = path.join(process.cwd(), 'data', 'meeting-numbers-all.json');
  const yearFile = path.join(process.cwd(), 'data', 'meeting-numbers-2026.json');
  const commissionsFile = path.join(process.cwd(), 'data', 'commissions.json');

  const [allRaw, yearRaw, commissionsRaw] = await Promise.all([
    fs.readFile(meetingFile, 'utf8').then(JSON.parse) as Promise<MeetingRow[]>,
    fs.readFile(yearFile, 'utf8').then(JSON.parse).catch(() => [] as MeetingRow[]) as Promise<MeetingRow[]>,
    fs.readFile(commissionsFile, 'utf8').then(JSON.parse) as Promise<CommissionRow[]>,
  ]);

  // Mirror meeting-history.ts: the year file overrides any same (date,rep) rows
  const overlapKeys = new Set(yearRaw.map(r => `${r.meetingDate}|${r.repName}`));
  const meetingRows: MeetingRow[] = [
    ...allRaw.filter(r => !overlapKeys.has(`${r.meetingDate}|${r.repName}`)),
    ...yearRaw,
  ];

  // Index commissions by rep -> sorted list of {iso, amount}
  const commissionByRep = new Map<string, Array<{ iso: string; amount: number }>>();
  for (const c of commissionsRaw) {
    const iso = commissionDateToIso(c.date);
    if (!iso) continue;
    if (!commissionByRep.has(c.salesRep)) commissionByRep.set(c.salesRep, []);
    commissionByRep.get(c.salesRep)!.push({ iso, amount: Number(c.amount) || 0 });
  }
  for (const arr of commissionByRep.values()) arr.sort((a, b) => a.iso.localeCompare(b.iso));

  // Group meeting rows by canonical rep identity. The Monday sheet often
  // has the same person under two names (e.g. "Joseph" + "Joseph Dowd",
  // "Adam" + "Adam Rudell"). We canonicalize via REP_ALIASES so the two
  // rows merge into one rep with a single ramp curve.
  const canonicalize = (raw: string): { canonical: string; alias: string } => {
    const alias = raw.trim();
    const canonical = REP_ALIASES[alias] || alias;
    return { canonical, alias };
  };

  const repWeeks = new Map<string, { canonical: string; alias: string; rows: MeetingRow[] }>();
  for (const r of meetingRows) {
    const name = (r.repName || '').trim();
    if (!name || !r.meetingDate) continue;
    const { canonical, alias } = canonicalize(name);
    const key = canonical;
    if (!repWeeks.has(key)) repWeeks.set(key, { canonical, alias, rows: [] });
    const entry = repWeeks.get(key)!;
    entry.rows.push(r);
    // If we see multiple aliases for the same canonical, prefer the longer one
    // (typically the full name).
    if (alias.length > entry.alias.length) entry.alias = alias;
  }

  // "Today" reference for tenure clamping
  const todayIso = new Date().toISOString().slice(0, 10);

  const repsOut: OnboardingRep[] = [];
  for (const entry of repWeeks.values()) {
    const meetingAlias = entry.alias;
    const canonical = entry.canonical;
    const rows = entry.rows;
    rows.sort((a, b) => a.meetingDate.localeCompare(b.meetingDate));
    const firstWeek = rows[0].meetingDate;
    const lastWeek = rows[rows.length - 1].meetingDate;

    const weeksOnTeam = Math.max(0, weeksBetween(firstWeek, todayIso));
    const weeksOfHistory = new Set(rows.map(r => r.meetingDate)).size;

    // Bucket signed counts by week-since-first-appearance.
    // Cap the visible curve at min(weeksOnTeam, YR1_WEEKS).
    const weeklySigned = new Map<number, number>();
    let firstSignedWeekIndex: number | null = null;
    let totalSignedYr1 = 0;
    for (const r of rows) {
      const wi = weeksBetween(firstWeek, r.meetingDate);
      if (wi < 0) continue;
      const s = parseN(r.Signed);
      // Skip excused weeks for the totals but they still count as a calendar
      // week — we leave the week index intact so the curve doesn't jump.
      if (isExcused(r.Present) && s === 0) {
        // excused with no signed — skip from totals
        continue;
      }
      weeklySigned.set(wi, (weeklySigned.get(wi) || 0) + s);
      if (s > 0 && firstSignedWeekIndex === null) firstSignedWeekIndex = wi;
      if (wi < YR1_WEEKS) totalSignedYr1 += s;
    }

    // Build cumulative curve up to first 52 weeks (or as far as tenure goes)
    const maxIdx = Math.min(YR1_WEEKS, Math.max(weeksOnTeam, weeksOfHistory));
    const signedCountByWeek: OnboardingRep['signedCountByWeek'] = [];
    let cum = 0;
    for (let wi = 0; wi <= maxIdx; wi++) {
      const sw = weeklySigned.get(wi) || 0;
      cum += sw;
      signedCountByWeek.push({ weekIndex: wi, cumSigned: cum, signedThisWeek: sw });
    }

    // Commission lookup (canonical name is already resolved during grouping)
    const commissionPayouts = commissionByRep.get(canonical) || [];
    const firstPaidCommission = commissionPayouts.find(c => c.amount > 0);
    const weeksToFirstCommission = firstPaidCommission
      ? Math.max(0, weeksBetween(firstWeek, firstPaidCommission.iso))
      : null;
    const totalCommissionYr1 = commissionPayouts
      .filter(c => {
        const wi = weeksBetween(firstWeek, c.iso);
        return wi >= 0 && wi < YR1_WEEKS;
      })
      .reduce((s, c) => s + c.amount, 0);

    repsOut.push({
      rep: canonical,
      meetingAlias,
      firstWeek,
      lastWeek,
      weeksOnTeam,
      weeksOfHistory,
      weeksToFirstSigned: firstSignedWeekIndex,
      weeksToFirstCommission,
      totalSignedYr1,
      totalCommissionYr1: Math.round(totalCommissionYr1),
      signedCountByWeek,
      status: 'on-track', // overwritten below
      note: '',           // overwritten below
    });
  }

  // Baseline: median over reps with >= 12 weeks of meeting history AND a first-signed event
  const baselineReps = repsOut.filter(
    r => r.weeksOfHistory >= MIN_WEEKS_FOR_BASELINE && r.weeksToFirstSigned !== null,
  );
  const medianWeeksToFirstSigned = median(baselineReps.map(r => r.weeksToFirstSigned!));
  const baselineCommissionReps = repsOut.filter(
    r => r.weeksOfHistory >= MIN_WEEKS_FOR_BASELINE && r.weeksToFirstCommission !== null,
  );
  const medianWeeksToFirstCommission = median(baselineCommissionReps.map(r => r.weeksToFirstCommission!));
  const yr1BaselineReps = repsOut.filter(
    r => r.weeksOfHistory >= YR1_WEEKS,    // full year of data
  );
  const totalSignedYr1Median = median(yr1BaselineReps.map(r => r.totalSignedYr1));

  // Status assignment.
  //   still-ramping: < 12 weeks history (too early to judge)
  //   ahead:        first-signed reached AND <= 75% of baseline weeks
  //   behind:       first-signed never reached in first 12 weeks, OR > 150% of baseline
  //   on-track:     everything else
  for (const r of repsOut) {
    if (r.weeksOfHistory < MIN_WEEKS_FOR_BASELINE) {
      r.status = 'still-ramping';
      r.note = `Only ${r.weeksOfHistory} wk of history — too early to judge`;
    } else if (r.weeksToFirstSigned === null) {
      r.status = 'behind';
      r.note = `${r.weeksOfHistory} wk in, never logged a signed contract`;
    } else if (medianWeeksToFirstSigned > 0 && r.weeksToFirstSigned <= medianWeeksToFirstSigned * 0.75) {
      r.status = 'ahead';
      r.note = `First signed wk ${r.weeksToFirstSigned} (baseline ${medianWeeksToFirstSigned})`;
    } else if (medianWeeksToFirstSigned > 0 && r.weeksToFirstSigned > medianWeeksToFirstSigned * 1.5) {
      r.status = 'behind';
      r.note = `First signed wk ${r.weeksToFirstSigned} vs baseline ${medianWeeksToFirstSigned}`;
    } else {
      r.status = 'on-track';
      r.note = `First signed wk ${r.weeksToFirstSigned} (baseline ${medianWeeksToFirstSigned})`;
    }
  }

  // Sort: still-ramping first (most recent hires), then by weeksToFirstSigned ascending (best ramps first)
  repsOut.sort((a, b) => {
    if (a.status === 'still-ramping' && b.status !== 'still-ramping') return -1;
    if (b.status === 'still-ramping' && a.status !== 'still-ramping') return 1;
    const aw = a.weeksToFirstSigned ?? 9999;
    const bw = b.weeksToFirstSigned ?? 9999;
    if (aw !== bw) return aw - bw;
    return b.totalSignedYr1 - a.totalSignedYr1;
  });

  return {
    generatedAt: new Date().toISOString(),
    baseline: {
      medianWeeksToFirstSigned,
      medianWeeksToFirstCommission,
      totalSignedYr1Median,
      repsInBaseline: baselineReps.length,
      minWeeksForBaseline: MIN_WEEKS_FOR_BASELINE,
    },
    reps: repsOut,
    meta: {
      meetingRows: meetingRows.length,
      commissionRows: commissionsRaw.length,
      repsAnalyzed: repsOut.length,
      repsStillRamping: repsOut.filter(r => r.status === 'still-ramping').length,
    },
  };
}
