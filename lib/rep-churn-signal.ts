/**
 * Rep Churn Signal — Early-warning detector for reps who are quietly
 * winding down before they leave.
 *
 * For each rep with >= 12 weeks of meeting-sheet history we compare:
 *   - recent4: last 4 non-excused weeks of activity
 *   - baseline12: weeks 5-16 ago (the 12-week window before recent4)
 *
 * Signals:
 *   - inspectedTrendPct = (recent4 avg - baseline12 avg) / baseline12 avg
 *   - signedTrendPct   = same idea
 *   - attendanceDeltaPct = recent4 present% - baseline12 present%
 *   - daysSinceLastCommission = days since latest commission payment
 *
 * churnScore is a weighted [0..1] composite where higher = more concerning:
 *   - signedTrend     40%  (most actionable — they stopped closing)
 *   - inspectedTrend  20%  (they stopped working leads)
 *   - attendanceDelta 20%  (showing up less)
 *   - daysSincePay    20%  (longer = staler activity, but heavily damped:
 *                          1099 payments lag 2-6 weeks anyway)
 *
 * riskLevel buckets:
 *   - 'still-ramping'  < 12 wks history (can't judge own baseline)
 *   - 'high'           churnScore >= 0.6
 *   - 'medium'         churnScore >= 0.35
 *   - 'low'            everything else
 *
 * Honesty caveats (surfaced in `note`):
 *   - baseline12 of zero on inspected OR signed → can't compute % → "no baseline"
 *   - 3+ excused weeks in recent4 → recent4 average is unreliable → "low signal"
 *
 * Sources:
 *   data/meeting-numbers-all.json    Monday rep-weeks 2019 → 2025
 *   data/meeting-numbers-2026.json   current-year overlay
 *   data/commissions.json            QB-booked commission payments
 *
 * Sheet-cache slug: 'rep-churn'.
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
  date: string; // MM/DD/YYYY
  amount: number;
  balance: number;
  jobNumber: string;
  customer: string;
}

/**
 * Mirror of REP_ALIASES in onboarding-curve.ts. Maps Monday-sheet first
 * names → commissions.json legal names so we can pair a rep's activity
 * with their actual pay history.
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
  'Clay': 'Roger Braden Speegle',
  'Travis': 'Travis Wages',
  'Joseph': 'Joseph Dowd',
  'Joseph Dowd': 'Joseph Dowd',
  'Alijah': 'Alijah Coleman',
  'Rudy': 'Rudy',
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

function isPresent(v: string | undefined): boolean {
  const s = String(v ?? '').trim();
  return s === '1' || s.toLowerCase() === 'yes' || s.toLowerCase() === 'p';
}

/** Parse "MM/DD/YYYY" → ISO YYYY-MM-DD. Returns '' on bad input. */
function commissionDateToIso(d: string): string {
  if (!d) return '';
  const parts = d.split('/');
  if (parts.length !== 3) return '';
  const [m, dd, y] = parts;
  if (!m || !dd || !y) return '';
  return `${y}-${m.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function daysBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms)) return 0;
  return Math.floor(ms / 86400000);
}

export interface RepChurnRep {
  rep: string;              // canonical (commissions.json) name when matched, else meeting alias
  meetingAlias: string;     // raw Monday-sheet name
  firstWeek: string;        // ISO of first sheet appearance
  lastWeek: string;         // ISO of most recent sheet appearance
  weeksOfHistory: number;   // distinct meeting weeks since first appearance
  daysSinceLastAppearance: number;  // days from rep's lastWeek to latest dataset week

  recent4: { inspected: number; signed: number; present: number; weeks: number; excusedWeeks: number };
  baseline12: { inspected: number; signed: number; present: number; weeks: number; excusedWeeks: number };

  // Per-week AVERAGES (so we can compare even if one window has fewer weeks).
  recent4InspectedAvg: number;
  recent4SignedAvg: number;
  baseline12InspectedAvg: number;
  baseline12SignedAvg: number;

  inspectedTrendPct: number | null;  // null if baseline is zero
  signedTrendPct: number | null;     // null if baseline is zero
  recent4Attendance: number;         // 0..100
  baseline12Attendance: number;      // 0..100
  attendanceDeltaPct: number;        // recent - baseline, signed

  daysSinceLastCommission: number | null;  // null if no commission history
  lastCommissionDate: string | null;        // ISO

  churnScore: number;         // 0..1, higher = worse
  riskLevel: 'high' | 'medium' | 'low' | 'still-ramping' | 'departed';
  note: string;               // human-readable summary
  lowSignal: boolean;         // recent4 had >= 3 excused weeks
}

export interface RepChurnResponse {
  generatedAt: string;
  datasetLatestDate: string;  // ISO of most recent meeting in the data — anchors "recent"
  weights: { signedTrend: number; inspectedTrend: number; attendanceDelta: number; daysSincePay: number };
  thresholds: {
    minWeeksForBaseline: number;
    highRiskScore: number;
    mediumRiskScore: number;
    lowSignalExcusedThreshold: number;
    departedAfterDays: number;
  };
  reps: RepChurnRep[];
  highRiskCount: number;
  mediumRiskCount: number;
  stillRampingCount: number;
  departedCount: number;
  totalMonitored: number;     // reps with >= 12 wk of history AND currently active
  meta: { meetingRows: number; commissionRows: number; repsAnalyzed: number };
}

const _cache: { data: RepChurnResponse; at: number } = {
  data: null as unknown as RepChurnResponse,
  at: 0,
};
const CACHE_TTL_MS = 10 * 60 * 1000;
const SHEET_CACHE_MAX_AGE_MS = 90 * 60 * 1000;

const MIN_WEEKS_FOR_BASELINE = 12;
const RECENT_WINDOW = 4;       // last N non-excused weeks
const BASELINE_WINDOW = 12;    // 12 weeks before recent
const HIGH_RISK_SCORE = 0.6;
const MEDIUM_RISK_SCORE = 0.35;
const LOW_SIGNAL_EXCUSED_THRESHOLD = 3; // 3+ excused in recent4 → low signal
// If a rep hasn't appeared on the sheet in this many days, they're departed,
// not "at risk." We don't score them for churn (no point — they're already gone).
const DEPARTED_AFTER_DAYS = 56; // 8 weeks

const WEIGHTS = {
  signedTrend: 0.4,
  inspectedTrend: 0.2,
  attendanceDelta: 0.2,
  daysSincePay: 0.2,
};

export async function getRepChurnSignal(): Promise<RepChurnResponse> {
  if (_cache.data && Date.now() - _cache.at < CACHE_TTL_MS) return _cache.data;

  // Sheet cache first.
  try {
    const { readChrisviewCache } = await import('./chrisview-sheet-cache');
    const cached = await readChrisviewCache<RepChurnResponse>('rep-churn');
    if (cached) {
      const age = Date.now() - new Date(cached.generatedAt).getTime();
      if (Number.isFinite(age) && age < SHEET_CACHE_MAX_AGE_MS) {
        _cache.data = cached.payload;
        _cache.at = Date.now();
        return cached.payload;
      }
    }
  } catch (err) {
    console.warn('[rep-churn-signal] sheet cache read failed:', err);
  }

  const data = await computeRepChurn();
  _cache.data = data;
  _cache.at = Date.now();
  return data;
}

async function computeRepChurn(): Promise<RepChurnResponse> {
  const meetingFile = path.join(process.cwd(), 'data', 'meeting-numbers-all.json');
  const yearFile = path.join(process.cwd(), 'data', 'meeting-numbers-2026.json');
  const commissionsFile = path.join(process.cwd(), 'data', 'commissions.json');

  const [allRaw, yearRaw, commissionsRaw] = await Promise.all([
    fs.readFile(meetingFile, 'utf8').then(JSON.parse) as Promise<MeetingRow[]>,
    fs.readFile(yearFile, 'utf8').then(JSON.parse).catch(() => [] as MeetingRow[]) as Promise<MeetingRow[]>,
    fs.readFile(commissionsFile, 'utf8').then(JSON.parse) as Promise<CommissionRow[]>,
  ]);

  // Year file overrides any same (date, rep) rows in the all-file.
  const overlapKeys = new Set(yearRaw.map(r => `${r.meetingDate}|${r.repName}`));
  const meetingRows: MeetingRow[] = [
    ...allRaw.filter(r => !overlapKeys.has(`${r.meetingDate}|${r.repName}`)),
    ...yearRaw,
  ];

  // Latest commission per rep (canonical name).
  const lastCommissionByRep = new Map<string, string>(); // canonical → ISO date
  for (const c of commissionsRaw) {
    const iso = commissionDateToIso(c.date);
    if (!iso) continue;
    // Only count actual payments (amount > 0) — zero-dollar rows are placeholders.
    if (!(Number(c.amount) > 0)) continue;
    const prev = lastCommissionByRep.get(c.salesRep);
    if (!prev || iso > prev) lastCommissionByRep.set(c.salesRep, iso);
  }

  // Group meeting rows by canonical rep.
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
    if (!repWeeks.has(canonical)) repWeeks.set(canonical, { canonical, alias, rows: [] });
    const entry = repWeeks.get(canonical)!;
    entry.rows.push(r);
    if (alias.length > entry.alias.length) entry.alias = alias;
  }

  // Most recent meeting date in the dataset — anchor for the recent/baseline
  // calendar windows. We use this rather than "today" because the sheet may
  // be a week or two behind real-time and we want windows aligned to the
  // data we actually have.
  const allDates = meetingRows.map(r => r.meetingDate).filter(Boolean).sort();
  const latestDataDate = allDates[allDates.length - 1] || new Date().toISOString().slice(0, 10);
  // For "days since last commission paid" we use real-world today — the
  // question is "how long since they got paid in calendar time."
  const todayIso = new Date().toISOString().slice(0, 10);

  const repsOut: RepChurnRep[] = [];

  for (const entry of repWeeks.values()) {
    const rows = [...entry.rows].sort((a, b) => a.meetingDate.localeCompare(b.meetingDate));
    const firstWeek = rows[0].meetingDate;
    const lastWeek = rows[rows.length - 1].meetingDate;
    const weeksOfHistory = new Set(rows.map(r => r.meetingDate)).size;

    // Commission lookup. Try canonical first, then raw alias.
    const lastCommissionDate =
      lastCommissionByRep.get(entry.canonical) ||
      lastCommissionByRep.get(entry.alias) ||
      null;
    const daysSinceLastCommission = lastCommissionDate
      ? daysBetween(lastCommissionDate, todayIso)
      : null;

    const daysSinceLastAppearance = daysBetween(lastWeek, latestDataDate);

    // RECENT WINDOW: anchor on the dataset's most recent week, walk backward
    // through calendar dates regardless of whether the rep appeared. We collect
    // up to RECENT_WINDOW non-excused weeks of the rep's data. If they didn't
    // show up at all in that calendar span (departed reps), recentRows will be
    // empty and we'll route them to the 'departed' bucket below.
    //
    // We pick the rep's rows that fall within the recent calendar window.
    // The "recent calendar window" is bounded by: latestDataDate back to
    // (latestDataDate - RECENT_WINDOW weeks worth of meetings + slack for excused).
    //
    // Simpler approach: take the rep's rows that occurred on or after
    // (latestDataDate - RECENT_WINDOW * 7 days). If they have fewer than
    // RECENT_WINDOW rows in that span, we keep what we have (the rep simply
    // missed weeks — counted as zero-activity by the average).
    const recentCutoff = new Date(latestDataDate);
    recentCutoff.setDate(recentCutoff.getDate() - RECENT_WINDOW * 7);
    const recentCutoffIso = recentCutoff.toISOString().slice(0, 10);

    const baselineCutoff = new Date(latestDataDate);
    baselineCutoff.setDate(baselineCutoff.getDate() - (RECENT_WINDOW + BASELINE_WINDOW) * 7);
    const baselineCutoffIso = baselineCutoff.toISOString().slice(0, 10);

    const recentRows = rows.filter(r => r.meetingDate > recentCutoffIso && r.meetingDate <= latestDataDate);
    const baselineRows = rows.filter(r => r.meetingDate > baselineCutoffIso && r.meetingDate <= recentCutoffIso);

    const recentExcusedCount = recentRows.filter(r => isExcused(r.Present)).length;
    const baselineExcusedCount = baselineRows.filter(r => isExcused(r.Present)).length;

    // Aggregate recent vs baseline. Excused rows contribute zero AND shrink
    // the denominator (per excused-week rule). Missing weeks (rep didn't show
    // up that Monday) average to zero — denominator is the calendar window
    // size minus excused weeks.
    const recentNonExcused = recentRows.filter(r => !isExcused(r.Present));
    const baselineNonExcused = baselineRows.filter(r => !isExcused(r.Present));

    const recentInspectedTotal = recentNonExcused.reduce((s, r) => s + parseN(r.Inspected), 0);
    const recentSignedTotal = recentNonExcused.reduce((s, r) => s + parseN(r.Signed), 0);
    const recentPresent = recentNonExcused.filter(r => isPresent(r.Present)).length;

    const baselineInspectedTotal = baselineNonExcused.reduce((s, r) => s + parseN(r.Inspected), 0);
    const baselineSignedTotal = baselineNonExcused.reduce((s, r) => s + parseN(r.Signed), 0);
    const baselinePresent = baselineNonExcused.filter(r => isPresent(r.Present)).length;

    // Denominator = calendar window size minus excused weeks. So a rep who
    // missed 2 weeks of a 4-week window has denominator 4 (their misses
    // bring the average down to 0); a rep with 2 excused weeks has denom 2.
    const recentDenom = Math.max(0, RECENT_WINDOW - recentExcusedCount);
    const baselineDenom = Math.max(0, BASELINE_WINDOW - baselineExcusedCount);

    const recentInspectedAvg = recentDenom > 0 ? recentInspectedTotal / recentDenom : 0;
    const recentSignedAvg = recentDenom > 0 ? recentSignedTotal / recentDenom : 0;
    const baselineInspectedAvg = baselineDenom > 0 ? baselineInspectedTotal / baselineDenom : 0;
    const baselineSignedAvg = baselineDenom > 0 ? baselineSignedTotal / baselineDenom : 0;

    const inspectedTrendPct = baselineInspectedAvg > 0
      ? (recentInspectedAvg - baselineInspectedAvg) / baselineInspectedAvg
      : null;
    const signedTrendPct = baselineSignedAvg > 0
      ? (recentSignedAvg - baselineSignedAvg) / baselineSignedAvg
      : null;

    // Attendance: present / (calendar weeks - excused). Misses count as
    // absent (not excused), so they pull the rate down.
    const recentAttendance = recentDenom > 0 ? (recentPresent / recentDenom) * 100 : 0;
    const baselineAttendance = baselineDenom > 0 ? (baselinePresent / baselineDenom) * 100 : 0;
    const attendanceDeltaPct = recentAttendance - baselineAttendance;

    const lowSignal = recentExcusedCount >= LOW_SIGNAL_EXCUSED_THRESHOLD;

    // Risk scoring.
    // Each sub-signal is normalized to a [0..1] "concern" value where 0 = fine
    // and 1 = maximum concern, then combined with WEIGHTS.
    //
    //   signedTrendConcern = clamp(-signedTrendPct, 0, 1)
    //     A 100% drop ⇒ 1.0 concern; +X% improvement ⇒ 0 concern.
    //   inspectedTrendConcern = same shape, capped.
    //   attendanceConcern = clamp(-attendanceDeltaPct / 50, 0, 1)
    //     A 50-pt drop in attendance% ⇒ 1.0 concern.
    //   daysSincePayConcern = clamp((daysSincePay - 30) / 60, 0, 1)
    //     0-30 days: not concerning (normal 1099 lag). 30-90 days: ramps up.
    //     90+: full concern. Null commission → 0.5 (unknown, mild concern).
    //
    // If a trend is null (no baseline), it contributes 0 to the score.

    const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
    const signedConcern = signedTrendPct === null ? 0 : clamp(-signedTrendPct, 0, 1);
    const inspectedConcern = inspectedTrendPct === null ? 0 : clamp(-inspectedTrendPct, 0, 1);
    const attendanceConcern = clamp(-attendanceDeltaPct / 50, 0, 1);
    const daysConcern = daysSinceLastCommission === null
      ? 0.5
      : clamp((daysSinceLastCommission - 30) / 60, 0, 1);

    const churnScore =
      WEIGHTS.signedTrend * signedConcern +
      WEIGHTS.inspectedTrend * inspectedConcern +
      WEIGHTS.attendanceDelta * attendanceConcern +
      WEIGHTS.daysSincePay * daysConcern;

    // Risk bucket.
    let riskLevel: RepChurnRep['riskLevel'];
    let note = '';
    if (daysSinceLastAppearance >= DEPARTED_AFTER_DAYS) {
      // Already gone. Mark separately — not "winding down," they wound.
      // Don't score them for the active-rep buckets; we keep churnScore
      // computed for record-keeping but ignore it for ranking.
      riskLevel = 'departed';
      const wks = Math.floor(daysSinceLastAppearance / 7);
      note = `Departed — last on sheet ${lastWeek} (${wks} wk ago)`;
    } else if (weeksOfHistory < MIN_WEEKS_FOR_BASELINE) {
      riskLevel = 'still-ramping';
      note = `Only ${weeksOfHistory} wk of history — too early to compare to own baseline`;
    } else if (lowSignal) {
      // We deliberately demote low-signal reps from high risk — the data
      // isn't reliable enough to alarm.
      riskLevel = churnScore >= MEDIUM_RISK_SCORE ? 'medium' : 'low';
      note = `Low signal — ${recentExcusedCount} of last ${recentRows.length} weeks excused`;
    } else if (signedTrendPct === null && inspectedTrendPct === null) {
      riskLevel = 'low';
      note = 'No baseline activity to compare to';
    } else if (churnScore >= HIGH_RISK_SCORE) {
      riskLevel = 'high';
      const reasons: string[] = [];
      if (signedTrendPct !== null && signedTrendPct < -0.3) {
        reasons.push(`signed ${Math.round(signedTrendPct * 100)}%`);
      }
      if (inspectedTrendPct !== null && inspectedTrendPct < -0.3) {
        reasons.push(`inspected ${Math.round(inspectedTrendPct * 100)}%`);
      }
      if (attendanceDeltaPct < -10) {
        reasons.push(`attendance ${Math.round(attendanceDeltaPct)}pt`);
      }
      if (daysSinceLastCommission !== null && daysSinceLastCommission > 60) {
        reasons.push(`${daysSinceLastCommission} days since paid`);
      }
      note = reasons.length
        ? `High risk — ${reasons.join(', ')}`
        : 'High risk — composite signal';
    } else if (churnScore >= MEDIUM_RISK_SCORE) {
      riskLevel = 'medium';
      note = 'Some softening vs own baseline';
    } else {
      riskLevel = 'low';
      note = 'Steady vs own baseline';
    }

    repsOut.push({
      rep: entry.canonical,
      meetingAlias: entry.alias,
      firstWeek,
      lastWeek,
      weeksOfHistory,
      daysSinceLastAppearance,
      recent4: {
        inspected: recentInspectedTotal,
        signed: recentSignedTotal,
        present: recentPresent,
        weeks: recentNonExcused.length,
        excusedWeeks: recentExcusedCount,
      },
      baseline12: {
        inspected: baselineInspectedTotal,
        signed: baselineSignedTotal,
        present: baselinePresent,
        weeks: baselineNonExcused.length,
        excusedWeeks: baselineExcusedCount,
      },
      recent4InspectedAvg: Math.round(recentInspectedAvg * 10) / 10,
      recent4SignedAvg: Math.round(recentSignedAvg * 10) / 10,
      baseline12InspectedAvg: Math.round(baselineInspectedAvg * 10) / 10,
      baseline12SignedAvg: Math.round(baselineSignedAvg * 10) / 10,
      inspectedTrendPct: inspectedTrendPct === null ? null : Math.round(inspectedTrendPct * 1000) / 10,
      signedTrendPct: signedTrendPct === null ? null : Math.round(signedTrendPct * 1000) / 10,
      recent4Attendance: Math.round(recentAttendance * 10) / 10,
      baseline12Attendance: Math.round(baselineAttendance * 10) / 10,
      attendanceDeltaPct: Math.round(attendanceDeltaPct * 10) / 10,
      daysSinceLastCommission,
      lastCommissionDate,
      churnScore: Math.round(churnScore * 1000) / 1000,
      riskLevel,
      note,
      lowSignal,
    });
  }

  // Sort: high risk → medium → low → still-ramping → departed; ties by score desc.
  const order: Record<RepChurnRep['riskLevel'], number> = {
    'high': 0,
    'medium': 1,
    'low': 2,
    'still-ramping': 3,
    'departed': 4,
  };
  repsOut.sort((a, b) => {
    if (order[a.riskLevel] !== order[b.riskLevel]) return order[a.riskLevel] - order[b.riskLevel];
    return b.churnScore - a.churnScore;
  });

  const highRiskCount = repsOut.filter(r => r.riskLevel === 'high').length;
  const mediumRiskCount = repsOut.filter(r => r.riskLevel === 'medium').length;
  const stillRampingCount = repsOut.filter(r => r.riskLevel === 'still-ramping').length;
  const departedCount = repsOut.filter(r => r.riskLevel === 'departed').length;
  // "Monitored" = currently-active reps with enough history to score
  const totalMonitored = repsOut.filter(
    r => r.riskLevel === 'high' || r.riskLevel === 'medium' || r.riskLevel === 'low',
  ).length;

  return {
    generatedAt: new Date().toISOString(),
    datasetLatestDate: latestDataDate,
    weights: WEIGHTS,
    thresholds: {
      minWeeksForBaseline: MIN_WEEKS_FOR_BASELINE,
      highRiskScore: HIGH_RISK_SCORE,
      mediumRiskScore: MEDIUM_RISK_SCORE,
      lowSignalExcusedThreshold: LOW_SIGNAL_EXCUSED_THRESHOLD,
      departedAfterDays: DEPARTED_AFTER_DAYS,
    },
    reps: repsOut,
    highRiskCount,
    mediumRiskCount,
    stillRampingCount,
    departedCount,
    totalMonitored,
    meta: {
      meetingRows: meetingRows.length,
      commissionRows: commissionsRaw.length,
      repsAnalyzed: repsOut.length,
    },
  };
}
