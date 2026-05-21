/**
 * Estimate Win/Loss Analysis — per-PROJECT, not per-estimate.
 *
 * Rule from Michael (2026-05-21 v3 — final):
 *   - Project = job (deduped by R-number). Multiple estimates on same
 *     project still count as 1.
 *   - WON = JN job status is "Approved Jobs" OR any status PAST Approved
 *     (Materials Ordered/Scheduled, Pending Final Payment, Pending
 *     Supplement/Deprecation, Roofer Pay Needed, Job Completion Form,
 *     Payouts, Paid & Closed).
 *   - LOST = JN status is explicitly "Lost", OR the job is in a
 *     pre-Approved status (Lead / Aerial Measurements / Inspection /
 *     Estimate / Pending Approval / Contingency Signed / Signed
 *     Contract) AND has had no activity for STALE_DAYS days.
 *   - PENDING = pre-Approved status with recent activity (still alive).
 *
 * STALE_DAYS default = 60 (probe-set from 30K jobs of historical data).
 * Approved Jobs typically clears within ~6 weeks (p75 = 114 d), so 60 d
 * with no activity is a strong signal the job didn't convert.
 * Configurable via env var CHRISVIEW_STALE_DAYS.
 *
 *   conversion rate = won ÷ total            (incl. pending in denom)
 *   close rate      = won ÷ (won + lost)    (resolved only — purer)
 *
 * "Activity" timestamp = max(date_status_change, date_updated, date_created)
 * — whichever is most recent. Status changes count; so do generic updates
 * (a note added, a file uploaded, etc.) when JN exposes them.
 *
 * Cost-safe: all JN reads run through redactCostFieldsDeep.
 */
import { redactCostFieldsDeep } from './jn-redact';

const JN_KEY = process.env.JOBNIMBUS_API_KEY;
const JN_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

interface JNRelated { id?: string; jnid?: string; type?: string; number?: string }
interface JNEstimate {
  jnid: string;
  number?: string;
  date_created?: number;
  status_name?: string;
  sales_rep_name?: string;
  primary?: { id?: string; jnid?: string };
  related?: JNRelated[];
}
// Probe-verified JN job status vocabulary (2026-05-21, n=30000 jobs).
// WON = "Approved Jobs" is the gateway. Anything PAST that — Materials,
// Payouts, Pending Final Payment, etc. — is also won. Contingency Signed
// and Signed Contract are NOT won (they're pre-Approved per Michael).
const WON_RE = /^(approved\s*jobs?|materials\s*(ordered|scheduled)|materials\s*ordered\s*\/\s*scheduled|payouts?|pending\s*final\s*payment|pending\s*supplement|pending\s*deprecation|roofer\s*pay\s*needed|job\s*completion\s*form|completion\s*form|paid\s*&\s*closed)$/i;
// Explicit lost status (always lost regardless of age).
const LOST_RE = /^lost$/i;
// Pre-Approved statuses (potential lost if stale).
const PRE_APPROVED_RE = /^(lead|aerial\s*measurements|inspection|estimate|pending\s*approval|contingency\s*signed|signed\s*contract)$/i;

// Stale threshold (days). After this many days with no activity in a
// pre-Approved status, the job is auto-classified as LOST. Admin-overridable
// via CHRISVIEW_STALE_DAYS env var. Set from historical analysis: Approved
// Jobs typically clears within 6 weeks (p75 = 114 d), so 60 d catches ~83%
// of truly stale pre-Approved jobs while keeping recent leads in pending.
const STALE_DAYS_DEFAULT = 60;
function getStaleDays(): number {
  const env = parseInt(process.env.CHRISVIEW_STALE_DAYS || '', 10);
  if (Number.isFinite(env) && env > 0) return env;
  return STALE_DAYS_DEFAULT;
}

interface JNInvoice {
  jnid: string;
  number?: string;
  date_created?: number;
  primary?: { id?: string; jnid?: string };
  related?: JNRelated[];
}
interface JNJob {
  jnid: string;
  number?: string;
  status_name?: string;
  sales_rep_name?: string;
  source_name?: string;
  date_created?: number;
  /** Last status transition. Used as the primary "last activity" signal. */
  date_status_change?: number;
  /** Any update to the job (note added, file uploaded, etc.). */
  date_updated?: number;
  // JN custom fields are exposed in the API with their literal label.
  // "Claim Number" (capitalized, with space) is the canonical insurance
  // signal — NOT lowercase claim_number (which exists too but is unreliable).
  insurance_company?: string;
  insurance_company_name?: string;
  claim_number?: string;
}

async function jnFetch<T>(endpoint: string): Promise<T> {
  if (!JN_KEY) throw new Error('JN key not configured');
  const r = await fetch(`${JN_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${JN_KEY}`, 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw new Error(`JN ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return redactCostFieldsDeep(await r.json(), false) as T;
}

function relatedJobId(rec: { related?: JNRelated[] }): string | null {
  const j = rec.related?.find(r => (r?.type || '').toLowerCase() === 'job');
  return j?.id || j?.jnid || null;
}
function relatedContactId(rec: { related?: JNRelated[] }): string | null {
  const c = rec.related?.find(r => (r?.type || '').toLowerCase() === 'contact');
  return c?.id || c?.jnid || null;
}

export interface WinLossProject {
  /** R-number — canonical project key. */
  rNumber: string;
  /** JN job jnid for clicking through. */
  jobJnid: string;
  /** First estimate created for this project (only the first counts per Michael's rule). */
  firstEstimateAt: string;
  /** Total estimates created for this project in window (for visibility). */
  totalEstimates: number;
  /** Project outcome from JN job status_name + staleness rule. */
  outcome: 'won' | 'lost' | 'pending';
  /** If outcome === 'lost', why: 'explicit' = JN status 'Lost', 'stale' = aged out of pre-Approved. */
  lostReason: 'explicit' | 'stale' | null;
  /** Days since last activity (status_change OR updated OR created). */
  daysSinceActivity: number | null;
  /** Convenience flag = outcome === 'won'. */
  won: boolean;
  /** Earliest invoice date if any invoice exists (separate from won/lost — for time-to-invoice). */
  firstInvoiceAt: string | null;
  /** Days from first estimate → first invoice (only when invoice exists). */
  daysToInvoice: number | null;
  /** Days from first estimate → today (only when pending/lost — open question). */
  daysPending: number | null;
  /** Rep on the first estimate (or job, as fallback). */
  rep: string;
  /** Source from the JN job. */
  source: string;
  /** Insurance flag — job has Claim Number populated. */
  isInsurance: boolean;
  /** Job status_name for context. */
  jobStatus: string;
}

export interface WinLossRollup {
  key: string;
  totalProjects: number;
  wonProjects: number;
  lostProjects: number;
  pendingProjects: number;
  /** won ÷ total (includes still-pending in denominator). */
  conversionRate: number;
  /** won ÷ (won + lost) — closure rate among resolved only. */
  closeRate: number;
}

export interface WinLossAnalysis {
  generatedAt: string;
  windowDays: number;
  totalProjects: number;
  wonProjects: number;
  lostProjects: number;
  pendingProjects: number;
  /** won ÷ total (includes still-pending in denom). */
  overallConversionRate: number;
  /** won ÷ (won + lost) — purer "of resolved, what closed". */
  overallCloseRate: number;
  byRep: WinLossRollup[];
  bySource: WinLossRollup[];
  byInsurance: WinLossRollup[];
  /** Projects sitting in PENDING status with first estimate > 60 days ago — the "follow up" list. */
  recentLosses: WinLossProject[];
  /** All projects (small payload, sorted newest first). */
  projects: WinLossProject[];
  meta: {
    queryTimeMs: number;
    estimatesFetched: number;
    invoicesFetched: number;
    jobsFetched: number;
    distinctJobIds: number;
    wonRePattern: string;
    lostRePattern: string;
    preApprovedRePattern: string;
    /** Days of inactivity threshold for auto-lost classification. */
    staleDays: number;
    /** Count of projects lost because JN status === 'Lost'. */
    explicitLostCount: number;
    /** Count of projects lost because they aged past staleDays in a pre-Approved status. */
    staleLostCount: number;
  };
}

let _cache: { key: string; data: WinLossAnalysis; at: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;
const SHEET_CACHE_MAX_AGE_MS = 90 * 60 * 1000;
const DEFAULT_DAYS = 180;

export async function analyzeWinLoss(opts: { days?: number } = {}): Promise<WinLossAnalysis> {
  const daysWindow = Math.min(Math.max(opts.days || DEFAULT_DAYS, 1), 730);
  const cacheKey = `days:${daysWindow}`;
  if (_cache && _cache.key === cacheKey && Date.now() - _cache.at < CACHE_TTL_MS) return _cache.data;

  // Sheet-cache fast path for the default window only — custom windows
  // aren't precomputed so they always run live.
  if (daysWindow === DEFAULT_DAYS) {
    try {
      const { readChrisviewCache } = await import('./chrisview-sheet-cache');
      const cached = await readChrisviewCache<WinLossAnalysis>('win-loss');
      if (cached) {
        const age = Date.now() - new Date(cached.generatedAt).getTime();
        if (Number.isFinite(age) && age < SHEET_CACHE_MAX_AGE_MS) {
          _cache = { key: cacheKey, data: cached.payload, at: Date.now() };
          return cached.payload;
        }
      }
    } catch (err) {
      console.warn('[win-loss-analysis] sheet cache read failed:', err);
    }
  }

  const start = Date.now();
  const nowSec = Math.floor(Date.now() / 1000);
  const since = nowSec - daysWindow * 86400;
  const staleDays = getStaleDays();

  // 1. Pull /estimates in window (paginate, newest first, stop when out of range).
  const estimates: JNEstimate[] = [];
  let estimatesFetched = 0;
  {
    let offset = 0;
    const pageSize = 100;
    while (offset < 5000) {
      const res = await jnFetch<{ count?: number; results?: JNEstimate[] }>(`/estimates?limit=${pageSize}&offset=${offset}&sort=-date_created`);
      const page = res.results || [];
      if (!page.length) break;
      estimatesFetched += page.length;
      let outOfRange = false;
      for (const e of page) {
        if ((e.date_created || 0) < since) { outOfRange = true; continue; }
        estimates.push(e);
      }
      if (outOfRange) break;
      offset += pageSize;
    }
  }

  // 2. Pull /invoices in window (same pagination strategy).
  const invoices: JNInvoice[] = [];
  let invoicesFetched = 0;
  {
    let offset = 0;
    const pageSize = 100;
    while (offset < 5000) {
      const res = await jnFetch<{ count?: number; results?: JNInvoice[] }>(`/invoices?limit=${pageSize}&offset=${offset}&sort=-date_created`);
      const page = res.results || [];
      if (!page.length) break;
      invoicesFetched += page.length;
      let outOfRange = false;
      for (const inv of page) {
        if ((inv.date_created || 0) < since) { outOfRange = true; continue; }
        invoices.push(inv);
      }
      if (outOfRange) break;
      offset += pageSize;
    }
  }

  // 3. Map invoices by related job jnid (set of jnids with ANY invoice).
  const invoicedJobIds = new Map<string, JNInvoice[]>();
  for (const inv of invoices) {
    const jobId = relatedJobId(inv);
    if (!jobId) continue;
    if (!invoicedJobIds.has(jobId)) invoicedJobIds.set(jobId, []);
    invoicedJobIds.get(jobId)!.push(inv);
  }

  // 4. Group estimates by their related job jnid. Each job = 1 PROJECT.
  //    Multiple estimates on same job collapse to 1 (Michael's rule).
  const estimatesByJobId = new Map<string, JNEstimate[]>();
  for (const est of estimates) {
    const jobId = relatedJobId(est);
    if (!jobId) continue;
    if (!estimatesByJobId.has(jobId)) estimatesByJobId.set(jobId, []);
    estimatesByJobId.get(jobId)!.push(est);
  }

  // 5. Fetch each unique job (for R-number, status, insurance, source).
  //    Cap fetched job count to avoid runaway compute on huge windows.
  const jobIds = Array.from(estimatesByJobId.keys());
  const jobCache = new Map<string, JNJob | null>();
  let jobsFetched = 0;

  // Fetch in batches of 10 concurrent requests — JN can take it; the bottleneck
  // is total roundtrip count, not parallelism.
  const BATCH = 10;
  for (let i = 0; i < jobIds.length; i += BATCH) {
    const slice = jobIds.slice(i, i + BATCH);
    await Promise.all(slice.map(async id => {
      try {
        const res = await jnFetch<JNJob>(`/jobs/${id}`);
        // /jobs/{id} returns the job object directly, not wrapped.
        jobCache.set(id, res || null);
        if (res) jobsFetched += 1;
      } catch {
        jobCache.set(id, null);
      }
    }));
  }

  // 6. Build per-project records (1 per job, NOT per estimate).
  const projects: WinLossProject[] = [];
  for (const [jobId, ests] of estimatesByJobId.entries()) {
    const job = jobCache.get(jobId) || null;
    const sortedEsts = [...ests].sort((a, b) => (a.date_created || 0) - (b.date_created || 0));
    const firstEst = sortedEsts[0];
    const firstEstAt = firstEst?.date_created || 0;

    const rNumber = String(job?.number || '').trim();
    if (!rNumber) {
      // Skip estimates whose related job has no R-number (template / orphan).
      // Including them would inflate "totalProjects" with empty rows.
      continue;
    }

    // Outcome read from JN job status_name + staleness.
    // WON   — status is Approved Jobs or anything past Approved.
    // LOST  — status is explicit "Lost", OR pre-Approved status that's
    //         been stale (no activity for STALE_DAYS days).
    // PENDING — pre-Approved status with recent activity (still alive).
    const jobStatusRaw = (job?.status_name || '').trim();
    const lastActivitySec = Math.max(
      job?.date_status_change || 0,
      job?.date_updated || 0,
      job?.date_created || 0,
    );
    const daysSinceActivity = lastActivitySec > 0
      ? Math.floor((nowSec - lastActivitySec) / 86400)
      : null;

    let outcome: 'won' | 'lost' | 'pending';
    let lostReason: 'explicit' | 'stale' | null = null;
    if (LOST_RE.test(jobStatusRaw)) {
      outcome = 'lost';
      lostReason = 'explicit';
    } else if (WON_RE.test(jobStatusRaw)) {
      outcome = 'won';
    } else if (PRE_APPROVED_RE.test(jobStatusRaw)) {
      // Pre-Approved: still alive only if recently active.
      if (daysSinceActivity != null && daysSinceActivity > staleDays) {
        outcome = 'lost';
        lostReason = 'stale';
      } else {
        outcome = 'pending';
      }
    } else {
      // Unknown status — treat as pending (conservative; don't auto-lose).
      outcome = 'pending';
    }
    const won = outcome === 'won';

    // Invoice timing — kept for the time-to-invoice metric, but no longer
    // determines won/lost.
    const invs = invoicedJobIds.get(jobId) || [];
    const firstInv = invs.length > 0
      ? invs.reduce((a, b) => ((a.date_created || 0) < (b.date_created || 0) ? a : b))
      : null;
    const firstInvAt = firstInv?.date_created || 0;

    const daysToInvoice = firstEstAt && firstInvAt
      ? Math.round(((firstInvAt - firstEstAt) / 86400) * 10) / 10
      : null;
    const daysPending = outcome !== 'won' && firstEstAt
      ? Math.round(((nowSec - firstEstAt) / 86400) * 10) / 10
      : null;

    // Insurance signal — custom field "Claim Number" (capitalized, with space)
    // is the canonical flag. Fall back to lowercase variants.
    const jr = job as unknown as Record<string, unknown> | null;
    const claimNum = jr?.['Claim Number'];
    const dateOfLoss = jr?.['Date of Loss'];
    const isInsurance = !!(
      (claimNum && claimNum !== 0 && claimNum !== '0' && claimNum !== '') ||
      (dateOfLoss && dateOfLoss !== 0) ||
      job?.claim_number || job?.insurance_company || job?.insurance_company_name
    );

    const rep = (firstEst?.sales_rep_name || job?.sales_rep_name || '').trim();
    const source = (job?.source_name || '').trim();

    projects.push({
      rNumber,
      jobJnid: jobId,
      firstEstimateAt: firstEstAt ? new Date(firstEstAt * 1000).toISOString() : '',
      totalEstimates: ests.length,
      outcome,
      lostReason,
      daysSinceActivity,
      won,
      firstInvoiceAt: firstInvAt ? new Date(firstInvAt * 1000).toISOString() : null,
      daysToInvoice,
      daysPending,
      rep,
      source,
      isInsurance,
      jobStatus: jobStatusRaw,
    });
  }

  // 7. Aggregate.
  function rollup(keyFn: (p: WinLossProject) => string): WinLossRollup[] {
    const m = new Map<string, { total: number; won: number; lost: number }>();
    for (const p of projects) {
      const k = keyFn(p) || 'Unknown';
      const cur = m.get(k) || { total: 0, won: 0, lost: 0 };
      cur.total += 1;
      if (p.outcome === 'won') cur.won += 1;
      else if (p.outcome === 'lost') cur.lost += 1;
      m.set(k, cur);
    }
    return Array.from(m.entries())
      .map(([key, v]) => {
        const pending = v.total - v.won - v.lost;
        const resolved = v.won + v.lost;
        return {
          key,
          totalProjects: v.total,
          wonProjects: v.won,
          lostProjects: v.lost,
          pendingProjects: pending,
          conversionRate: v.total > 0 ? Math.round((v.won / v.total) * 1000) / 10 : 0,
          closeRate: resolved > 0 ? Math.round((v.won / resolved) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.totalProjects - a.totalProjects);
  }

  const byRep = rollup(p => p.rep || '(unassigned)');
  const bySource = rollup(p => p.source || '(no source)');
  const byInsurance = rollup(p => p.isInsurance ? 'Insurance' : 'Retail');

  // "Stalled pipeline" — pending status, first estimate > 60 days ago.
  // (Lost projects already resolved, don't need a follow-up nudge.)
  const recentLosses = projects
    .filter(p => p.outcome === 'pending' && (p.daysPending || 0) >= 60)
    .sort((a, b) => (b.daysPending || 0) - (a.daysPending || 0))
    .slice(0, 30);

  // Don't bother — actually do, but cap to first 500 newest for payload size.
  const projectsSorted = [...projects].sort((a, b) =>
    (b.firstEstimateAt || '').localeCompare(a.firstEstimateAt || ''),
  ).slice(0, 500);

  const wonProjects = projects.filter(p => p.outcome === 'won').length;
  const lostProjects = projects.filter(p => p.outcome === 'lost').length;
  const totalProjects = projects.length;
  const pendingProjects = totalProjects - wonProjects - lostProjects;
  const resolvedProjects = wonProjects + lostProjects;
  const overallConversionRate = totalProjects > 0
    ? Math.round((wonProjects / totalProjects) * 1000) / 10
    : 0;
  const overallCloseRate = resolvedProjects > 0
    ? Math.round((wonProjects / resolvedProjects) * 1000) / 10
    : 0;

  const result: WinLossAnalysis = {
    generatedAt: new Date().toISOString().slice(0, 10),
    windowDays: daysWindow,
    totalProjects,
    wonProjects,
    lostProjects,
    pendingProjects,
    overallConversionRate,
    overallCloseRate,
    byRep,
    bySource,
    byInsurance,
    recentLosses,
    projects: projectsSorted,
    meta: {
      queryTimeMs: Date.now() - start,
      estimatesFetched,
      invoicesFetched,
      jobsFetched,
      distinctJobIds: jobIds.length,
      wonRePattern: WON_RE.source,
      lostRePattern: LOST_RE.source,
      preApprovedRePattern: PRE_APPROVED_RE.source,
      staleDays,
      explicitLostCount: projects.filter(p => p.lostReason === 'explicit').length,
      staleLostCount: projects.filter(p => p.lostReason === 'stale').length,
    },
  };

  _cache = { key: cacheKey, data: result, at: Date.now() };
  return result;
}
