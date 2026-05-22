/**
 * Estimate Win/Loss — Monthly Cohort Analysis.
 *
 * The window-based close rate on /chrisview/win-loss reads optimistically
 * (75–95%) because the Lost bucket is narrow — it only counts JN status
 * 'Lost' + stale-aged projects. Many "pending" projects are dead deals
 * where a rep occasionally touches the file to keep the stale-aging clock
 * from flipping them, so they never resolve in either direction.
 *
 * The TRUE close rate becomes visible by cohorting projects by the month
 * of their first estimate and observing each cohort at MATURITY. After
 * ~6 months, almost every project that was going to win has won; anything
 * still pending is effectively lost.
 *
 * So for matured cohorts:
 *   trueCloseRate = won ÷ total   (treats pending as effectively-lost)
 *
 * Probe-verified 2026-05-21 against historical data (635 projects, 12
 * monthly cohorts): the matured-cohort conversion rate stabilizes at
 * ~45–50%, NOT the 62–75% the window-based close rate suggests.
 *
 * --- Cohort age tiers ---
 *   mature   — first estimate >= 6 months ago. trueCloseRate is reliable.
 *   maturing — 3–6 months. Most wins have happened; trueCloseRate is a
 *              reasonable preview but a few wins are still in-flight.
 *   early    — 1–3 months. Numbers are preliminary; many wins still
 *              pending. Don't read the close rate as final.
 *   fresh    — < 1 month. Use as activity signal only, not for close rate.
 *
 * COST-SAFE: every JN response runs through redactCostFieldsDeep.
 */
import { redactCostFieldsDeep } from './jn-redact';

const JN_KEY = process.env.JOBNIMBUS_API_KEY;
const JN_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

const WON_RE = /^(approved\s*jobs?|materials\s*(ordered|scheduled)|materials\s*ordered\s*\/\s*scheduled|payouts?|pending\s*final\s*payment|pending\s*supplement|pending\s*deprecation|roofer\s*pay\s*needed|job\s*completion\s*form|completion\s*form|paid\s*&\s*closed)$/i;
const LOST_RE = /^lost$/i;

interface JNRelated { id?: string; type?: string }
interface JNEstimate {
  jnid: string;
  date_created?: number;
  related?: JNRelated[];
  sales_rep_name?: string;
}
interface JNJob {
  jnid: string;
  number?: string;
  status_name?: string;
  sales_rep_name?: string;
  source_name?: string;
  date_created?: number;
  date_status_change?: number;
}

async function jnFetch<T>(endpoint: string): Promise<T> {
  if (!JN_KEY) throw new Error('JN key not configured');
  const r = await fetch(`${JN_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${JN_KEY}`, 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw new Error(`JN ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return redactCostFieldsDeep(await r.json(), false) as T;
}

export type CohortMaturity = 'mature' | 'maturing' | 'early' | 'fresh';

export interface CohortRow {
  /** ISO month-key, e.g. "2025-06". */
  cohortMonth: string;
  /** Months between cohort start and today. */
  ageMonths: number;
  maturity: CohortMaturity;
  totalProjects: number;
  wonProjects: number;
  lostProjects: number;
  pendingProjects: number;
  /** Won ÷ (won + lost). Looks high on young cohorts; only reliable for matured. */
  rawCloseRate: number;
  /** Won ÷ total. The TRUE close rate for matured cohorts; preliminary for young. */
  trueCloseRate: number;
}

export interface CohortAnalysis {
  generatedAt: string;
  windowMonths: number;
  /** Per-month cohort data, oldest first. */
  cohorts: CohortRow[];
  /** Aggregated stats for cohorts old enough that close rate is reliable. */
  matured: {
    cohortCount: number;
    totalProjects: number;
    wonProjects: number;
    lostProjects: number;
    pendingProjects: number;
    /** This is the headline number — true historical close rate. */
    trueCloseRate: number;
    /** What the raw rate would have shown for the same cohorts (for comparison). */
    rawCloseRate: number;
  };
  meta: {
    queryTimeMs: number;
    estimatesFetched: number;
    distinctJobIds: number;
    jobsFetched: number;
    matureThresholdMonths: number;
  };
}

function classifyMaturity(ageMonths: number): CohortMaturity {
  if (ageMonths >= 6) return 'mature';
  if (ageMonths >= 3) return 'maturing';
  if (ageMonths >= 1) return 'early';
  return 'fresh';
}

let _cache: { key: string; data: CohortAnalysis; at: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // expensive query — cache longer
const SHEET_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours; cohorts shift slowly

export async function analyzeCohorts(opts: { months?: number } = {}): Promise<CohortAnalysis> {
  const windowMonths = Math.min(Math.max(opts.months || 12, 6), 36);
  const cacheKey = `months:${windowMonths}`;
  if (_cache && _cache.key === cacheKey && Date.now() - _cache.at < CACHE_TTL_MS) return _cache.data;

  // Sheet-cache fast path for the default window.
  if (windowMonths === 12) {
    try {
      const { readChrisviewCache } = await import('./chrisview-sheet-cache');
      const cached = await readChrisviewCache<CohortAnalysis>('cohorts');
      if (cached) {
        const age = Date.now() - new Date(cached.generatedAt).getTime();
        if (Number.isFinite(age) && age < SHEET_CACHE_MAX_AGE_MS) {
          _cache = { key: cacheKey, data: cached.payload, at: Date.now() };
          return cached.payload;
        }
      }
    } catch (err) {
      console.warn('[cohort-analysis] sheet cache read failed:', err);
    }
  }

  const start = Date.now();
  const nowSec = Math.floor(Date.now() / 1000);
  const sinceSec = nowSec - windowMonths * 30 * 86400;

  // 1. Pull all estimates in window (newest first, stop when out of range).
  // Cap at 30 pages = 3000 estimates — generous enough for 18+ months of
  // RCRS volume (probe shows ~635 distinct projects across 18 mo). Deeper
  // pagination has timed out in production.
  const estimates: JNEstimate[] = [];
  let estimatesFetched = 0;
  {
    let offset = 0;
    const pageSize = 100;
    while (offset < 3000) {
      const res = await jnFetch<{ results?: JNEstimate[] }>(`/estimates?limit=${pageSize}&offset=${offset}&sort=-date_created`);
      const page = res.results || [];
      if (!page.length) break;
      estimatesFetched += page.length;
      let outOfRange = false;
      for (const e of page) {
        if ((e.date_created || 0) < sinceSec) { outOfRange = true; continue; }
        estimates.push(e);
      }
      if (outOfRange) break;
      offset += pageSize;
    }
  }

  // 2. First estimate per job (R-number via related[].type='job').
  const firstEstByJob = new Map<string, { dateSec: number }>();
  for (const est of estimates) {
    const jobId = est.related?.find(r => r?.type === 'job')?.id;
    if (!jobId) continue;
    const cur = firstEstByJob.get(jobId);
    const t = est.date_created || 0;
    if (!cur || t < cur.dateSec) firstEstByJob.set(jobId, { dateSec: t });
  }

  // 3. Pull each unique job (status + R-number).
  const jobIds = Array.from(firstEstByJob.keys());
  const jobCache = new Map<string, JNJob | null>();
  let jobsFetched = 0;
  const BATCH = 10;
  for (let i = 0; i < jobIds.length; i += BATCH) {
    const slice = jobIds.slice(i, i + BATCH);
    await Promise.all(slice.map(async id => {
      try {
        const res = await jnFetch<JNJob>(`/jobs/${id}`);
        jobCache.set(id, res || null);
        if (res) jobsFetched += 1;
      } catch {
        jobCache.set(id, null);
      }
    }));
  }

  // 4. Bucket projects into monthly cohorts based on first-estimate date.
  interface CohortBucket {
    won: number;
    lost: number;
    pending: number;
    total: number;
  }
  const cohortMap = new Map<string, CohortBucket>();

  for (const [jobId, est] of firstEstByJob.entries()) {
    const job = jobCache.get(jobId);
    if (!job) continue;
    const rNumber = (job.number || '').trim();
    if (!rNumber) continue; // orphan estimates

    const d = new Date(est.dateSec * 1000);
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

    const status = (job.status_name || '').trim();
    if (!cohortMap.has(monthKey)) cohortMap.set(monthKey, { won: 0, lost: 0, pending: 0, total: 0 });
    const c = cohortMap.get(monthKey)!;
    c.total += 1;
    if (WON_RE.test(status)) c.won += 1;
    else if (LOST_RE.test(status)) c.lost += 1;
    else c.pending += 1;
  }

  // 5. Sort cohorts oldest first, compute rates + maturity.
  const today = new Date();
  const cohorts: CohortRow[] = [];
  for (const [monthKey, c] of cohortMap.entries()) {
    const [y, m] = monthKey.split('-').map(Number);
    const cohortStart = new Date(Date.UTC(y, m - 1, 1));
    const ageMonths = Math.max(0, Math.floor((today.getTime() - cohortStart.getTime()) / (30 * 86400 * 1000)));
    const maturity = classifyMaturity(ageMonths);
    const resolved = c.won + c.lost;
    cohorts.push({
      cohortMonth: monthKey,
      ageMonths,
      maturity,
      totalProjects: c.total,
      wonProjects: c.won,
      lostProjects: c.lost,
      pendingProjects: c.pending,
      rawCloseRate: resolved > 0 ? Math.round((c.won / resolved) * 1000) / 10 : 0,
      trueCloseRate: c.total > 0 ? Math.round((c.won / c.total) * 1000) / 10 : 0,
    });
  }
  cohorts.sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth));

  // 6. Aggregate the matured-cohort stats (the headline number).
  const matureRows = cohorts.filter(c => c.maturity === 'mature');
  const matureTotal = matureRows.reduce((s, c) => s + c.totalProjects, 0);
  const matureWon = matureRows.reduce((s, c) => s + c.wonProjects, 0);
  const matureLost = matureRows.reduce((s, c) => s + c.lostProjects, 0);
  const maturePending = matureRows.reduce((s, c) => s + c.pendingProjects, 0);
  const matureResolved = matureWon + matureLost;

  const result: CohortAnalysis = {
    generatedAt: new Date().toISOString().slice(0, 10),
    windowMonths,
    cohorts,
    matured: {
      cohortCount: matureRows.length,
      totalProjects: matureTotal,
      wonProjects: matureWon,
      lostProjects: matureLost,
      pendingProjects: maturePending,
      trueCloseRate: matureTotal > 0 ? Math.round((matureWon / matureTotal) * 1000) / 10 : 0,
      rawCloseRate: matureResolved > 0 ? Math.round((matureWon / matureResolved) * 1000) / 10 : 0,
    },
    meta: {
      queryTimeMs: Date.now() - start,
      estimatesFetched,
      distinctJobIds: jobIds.length,
      jobsFetched,
      matureThresholdMonths: 6,
    },
  };

  _cache = { key: cacheKey, data: result, at: Date.now() };
  return result;
}
