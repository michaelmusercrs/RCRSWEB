/**
 * Estimate Win/Loss Analysis — per-PROJECT, not per-estimate.
 *
 * Rule from Michael (2026-05-21):
 *   "Compare estimates created vs invoices for that project. Don't count
 *    multiple estimates toward count."
 *
 * Each PROJECT (job R-number) that has at least one estimate counts as 1
 * project. If that project also has at least one invoice → WON. If not
 * → PENDING (could be lost, could be still active, could be install-not-
 * yet-invoiced — pure data can't tell, see AboutThisData gaps).
 *
 *   win rate = won projects ÷ projects with estimates
 *
 * Linking model (probe-verified 2026-05-21):
 *   - JN /estimates payload carries `related[]` with entries of type='job'
 *     and type='contact'. NOT `primary`.
 *   - JN /invoices same — `related[]` carries job + contact entries.
 *   - The job's R-number lives on the job record itself (`number` field).
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
  /** Did any invoice fire for this job? */
  won: boolean;
  /** Earliest invoice date if won. */
  firstInvoiceAt: string | null;
  /** Days from first estimate → first invoice (only when won). */
  daysToInvoice: number | null;
  /** Days from first estimate → today (only when pending). */
  daysPending: number | null;
  /** Rep on the first estimate (or job, as fallback). */
  rep: string;
  /** Source from the JN job. */
  source: string;
  /** Insurance flag — job has Claim Number populated. */
  isInsurance: boolean;
  /** Job status_name for context (so reader can see "Lost" / "Won" / "In progress" etc.). */
  jobStatus: string;
}

export interface WinLossRollup {
  key: string;
  totalProjects: number;
  wonProjects: number;
  pendingProjects: number;
  winRate: number;
}

export interface WinLossAnalysis {
  generatedAt: string;
  windowDays: number;
  totalProjects: number;
  wonProjects: number;
  pendingProjects: number;
  overallWinRate: number;
  byRep: WinLossRollup[];
  bySource: WinLossRollup[];
  byInsurance: WinLossRollup[];
  /** Projects with estimate older than 60 days but no invoice — the "follow up" list. */
  recentLosses: WinLossProject[];
  /** All projects (small payload, sorted newest first). */
  projects: WinLossProject[];
  meta: {
    queryTimeMs: number;
    estimatesFetched: number;
    invoicesFetched: number;
    jobsFetched: number;
    distinctJobIds: number;
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

    const invs = invoicedJobIds.get(jobId) || [];
    const won = invs.length > 0;
    const firstInv = invs.length > 0
      ? invs.reduce((a, b) => ((a.date_created || 0) < (b.date_created || 0) ? a : b))
      : null;
    const firstInvAt = firstInv?.date_created || 0;

    const daysToInvoice = won && firstEstAt && firstInvAt
      ? Math.round(((firstInvAt - firstEstAt) / 86400) * 10) / 10
      : null;
    const daysPending = !won && firstEstAt
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
      won,
      firstInvoiceAt: firstInvAt ? new Date(firstInvAt * 1000).toISOString() : null,
      daysToInvoice,
      daysPending,
      rep,
      source,
      isInsurance,
      jobStatus: (job?.status_name || '').trim(),
    });
  }

  // 7. Aggregate.
  function rollup(keyFn: (p: WinLossProject) => string): WinLossRollup[] {
    const m = new Map<string, { total: number; won: number }>();
    for (const p of projects) {
      const k = keyFn(p) || 'Unknown';
      const cur = m.get(k) || { total: 0, won: 0 };
      cur.total += 1;
      if (p.won) cur.won += 1;
      m.set(k, cur);
    }
    return Array.from(m.entries())
      .map(([key, v]) => ({
        key,
        totalProjects: v.total,
        wonProjects: v.won,
        pendingProjects: v.total - v.won,
        winRate: v.total > 0 ? Math.round((v.won / v.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.totalProjects - a.totalProjects);
  }

  const byRep = rollup(p => p.rep || '(unassigned)');
  const bySource = rollup(p => p.source || '(no source)');
  const byInsurance = rollup(p => p.isInsurance ? 'Insurance' : 'Retail');

  // "Stalled pipeline" — has estimate, no invoice, first estimate > 60 days ago.
  const sixtyDaysSec = 60 * 86400;
  const recentLosses = projects
    .filter(p => !p.won && (p.daysPending || 0) >= 60)
    .sort((a, b) => (b.daysPending || 0) - (a.daysPending || 0))
    .slice(0, 30);

  // Don't bother — actually do, but cap to first 500 newest for payload size.
  const projectsSorted = [...projects].sort((a, b) =>
    (b.firstEstimateAt || '').localeCompare(a.firstEstimateAt || ''),
  ).slice(0, 500);

  const wonProjects = projects.filter(p => p.won).length;
  const totalProjects = projects.length;
  const pendingProjects = totalProjects - wonProjects;
  const overallWinRate = totalProjects > 0
    ? Math.round((wonProjects / totalProjects) * 1000) / 10
    : 0;

  const result: WinLossAnalysis = {
    generatedAt: new Date().toISOString().slice(0, 10),
    windowDays: daysWindow,
    totalProjects,
    wonProjects,
    pendingProjects,
    overallWinRate,
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
    },
  };

  _cache = { key: cacheKey, data: result, at: Date.now() };
  return result;
}
