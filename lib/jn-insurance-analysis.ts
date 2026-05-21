/**
 * Insurance Job Deep Dive (Phase 4 of chrisview analytics roadmap).
 *
 * Pulls all jobs with insurance flags from JN, summarizes per-carrier
 * RCV / ACV / deductible / claim metrics, and tracks supplement / adjuster
 * approval timing.
 *
 * Cost-privacy: RCV/ACV/deductible are insurance carrier figures, not
 * RCRS internal cost — those fields are NOT in jn-redact's strip list.
 * However raw JN responses still pass through redactCostFieldsDeep to
 * scrub anything else.
 */
import { redactCostFieldsDeep } from './jn-redact';

const JN_API_KEY = process.env.JOBNIMBUS_API_KEY;
const JN_API_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

interface JNJob {
  jnid: string;
  number?: string;
  name?: string;
  status_name?: string;
  date_created?: number;
  date_status_change?: number;
  sales_rep_name?: string;
  insurance_company?: string;
  insurance_company_name?: string;
  insurance_carrier?: string;
  claim_number?: string;
  policy_number?: string;
  insurance_summary?: unknown;
  rcv?: number;
  acv?: number;
  deductible?: number;
  adjuster?: string;
  adjuster_name?: string;
  date_signed?: number;
  date_approved?: number;
  // catch-all for any other field
  [key: string]: unknown;
}

interface JNActivity {
  jnid: string;
  record_type_name?: string;
  date_created?: number;
  note?: string;
  primary?: { id?: string };
  related?: Array<{ id?: string }>;
}

function jnFetch<T>(endpoint: string): Promise<T> {
  if (!JN_API_KEY) throw new Error('JobNimbus API key not configured');
  return fetch(`${JN_API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${JN_API_KEY}`, 'Content-Type': 'application/json' },
  }).then(async r => {
    if (!r.ok) throw new Error(`JN ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return redactCostFieldsDeep(await r.json(), false) as T;
  });
}

// Pull RCV/ACV/deductible from either job-level fields or a nested
// insurance_summary blob. JN's data model varies depending on how the
// fields were originally entered.
function asNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[$,\s]/g, '');
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// Carrier name normalization — collapse case + common suffixes so
// "STATE FARM", "State Farm", "State Farm Insurance" all roll up together.
function normalizeCarrier(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const lower = trimmed
    .toLowerCase()
    .replace(/\b(insurance|insurance co|insurance company|ins co|ins\.?|mutual|grp|group|llc|inc\.?|company|corp|corporation)\b/g, '')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!lower) return trimmed;
  return lower.replace(/\b\w/g, c => c.toUpperCase());
}

function extractInsurance(job: JNJob): {
  rcv: number | null; acv: number | null; deductible: number | null;
  adjuster: string; carrier: string; claim: string;
} {
  const summary = (job.insurance_summary || {}) as Record<string, unknown>;
  const rcv = asNumber(job.rcv) ?? asNumber(summary.rcv) ?? asNumber(summary.RCV);
  const acv = asNumber(job.acv) ?? asNumber(summary.acv) ?? asNumber(summary.ACV);
  const ded = asNumber(job.deductible) ?? asNumber(summary.deductible) ?? asNumber(summary.Deductible);
  const adjuster = String(job.adjuster_name || job.adjuster || summary.adjuster || summary.Adjuster || '').trim();
  const carrier = normalizeCarrier(String(
    job.insurance_company_name ||
    job.insurance_company ||
    job.insurance_carrier ||
    summary.insurance_company ||
    summary.carrier ||
    summary.Carrier ||
    ''
  ));
  const claim = String(job.claim_number || summary.claim_number || summary.ClaimNumber || '').trim();
  return { rcv, acv, deductible: ded, adjuster, carrier, claim };
}

function hasInsuranceData(j: JNJob): boolean {
  if (j.insurance_company || j.insurance_company_name || j.insurance_carrier) return true;
  if (j.claim_number) return true;
  if (j.insurance_summary && typeof j.insurance_summary === 'object' && Object.keys(j.insurance_summary).length > 0) return true;
  return false;
}

const SIGNED_RE = /signed|approved|sold|won|contract|contingency|paid/i;
const APPROVED_RE = /approved|accepted/i;

export interface InsuranceJobSummary {
  jnid: string;
  number: string;
  carrier: string;
  claim: string;
  adjuster: string;
  rep: string;
  rcv: number | null;
  acv: number | null;
  deductible: number | null;
  status: string;
  daysToApprove: number | null;
  signed: boolean;
  approved: boolean;
  supplementCount: number;
}

export interface InsuranceAnalysis {
  generatedAt: string;
  daysQueried: number;
  totalInsuranceJobs: number;
  jobs: InsuranceJobSummary[];
  byCarrier: Array<{
    carrier: string;
    count: number;
    signedCount: number;
    approvedCount: number;
    closeRate: number;
    approvalRate: number;
    avgRCV: number; avgACV: number; avgDeductible: number;
    avgDaysToApprove: number | null;
  }>;
  byAdjuster: Array<{
    adjuster: string;
    count: number;
    approvedCount: number;
    approvalRate: number;
    avgDaysToApprove: number | null;
    carriers: string[];
  }>;
  totals: { rcv: number; acv: number; deductible: number };
  meta: { queryTimeMs: number; jobsFetched: number; activitiesFetched: number };
}

let _cache: { key: string; data: InsuranceAnalysis; at: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function analyzeInsurance(opts: { days?: number } = {}): Promise<InsuranceAnalysis> {
  const days = Math.min(opts.days || 180, 730);
  const cacheKey = `days:${days}`;
  if (_cache && _cache.key === cacheKey && Date.now() - _cache.at < CACHE_TTL_MS) return _cache.data;

  // Sheet-cache fast path for the default 180-day window.
  if (days === 180) {
    try {
      const { readChrisviewCache } = await import('./chrisview-sheet-cache');
      const cached = await readChrisviewCache<InsuranceAnalysis>('insurance');
      if (cached) {
        const age = Date.now() - new Date(cached.generatedAt).getTime();
        if (Number.isFinite(age) && age < 90 * 60 * 1000) {
          _cache = { key: cacheKey, data: cached.payload, at: Date.now() };
          return cached.payload;
        }
      }
    } catch (err) {
      console.warn('[jn-insurance-analysis] sheet cache read failed:', err);
    }
  }

  const start = Date.now();
  const since = Math.floor(Date.now() / 1000) - days * 86400;

  // 1. Pull jobs
  const jobs: JNJob[] = [];
  let offset = 0;
  const pageSize = 100;
  let jobsFetched = 0;
  while (offset < 5000) {
    const res = await jnFetch<{ count?: number; results?: JNJob[] }>(`/jobs?limit=${pageSize}&offset=${offset}&sort=-date_created`);
    const page = res.results || [];
    if (!page.length) break;
    jobsFetched += page.length;
    for (const j of page) {
      if ((j.date_created || 0) < since) continue;
      if (!hasInsuranceData(j)) continue;
      jobs.push(j);
    }
    const oldest = Math.min(...page.map(j => j.date_created || 0));
    if (oldest < since) break;
    offset += pageSize;
  }

  // 2. For each insurance job (cap 300) optionally pull activity count for
  // supplement detection. Skip activity pull if jobs > 100 to keep API
  // calls bounded.
  const sample = jobs.slice(0, 300);
  const pullActivities = sample.length <= 100;

  let activitiesFetched = 0;
  async function supplementCountFor(jobJnid: string): Promise<number> {
    if (!pullActivities || !jobJnid) return 0;
    try {
      const filter = { must: [{ term: { 'related.id': jobJnid } }] };
      const res = await jnFetch<{ results?: JNActivity[] }>(`/activities?filter=${encodeURIComponent(JSON.stringify(filter))}&limit=50`);
      const acts = res.results || [];
      activitiesFetched += acts.length;
      let n = 0;
      for (const a of acts) {
        const note = (a.note || '').toLowerCase();
        if (/supplement|suppl\b/.test(note)) n += 1;
      }
      return n;
    } catch {
      return 0;
    }
  }

  const summaries: InsuranceJobSummary[] = [];
  for (const j of sample) {
    const ins = extractInsurance(j);
    const status = (j.status_name || '').toLowerCase();
    const signed = SIGNED_RE.test(status);
    const approved = APPROVED_RE.test(status);
    const signedAt = signed ? (j.date_signed || j.date_status_change || j.date_created || 0) : 0;
    const approvedAt = approved ? (j.date_approved || j.date_status_change || 0) : 0;
    const daysToApprove = signedAt && approvedAt && approvedAt > signedAt
      ? Math.round((approvedAt - signedAt) / 86400 * 10) / 10
      : null;

    const supplementCount = await supplementCountFor(j.jnid);

    summaries.push({
      jnid: j.jnid,
      number: j.number || '',
      carrier: ins.carrier || 'Unknown',
      claim: ins.claim,
      adjuster: ins.adjuster || 'Unknown',
      rep: j.sales_rep_name || '',
      rcv: ins.rcv,
      acv: ins.acv,
      deductible: ins.deductible,
      status: j.status_name || '',
      daysToApprove,
      signed,
      approved,
      supplementCount,
    });
  }

  // 3. Carrier rollup
  const byCarrierMap = new Map<string, {
    count: number; signed: number; approved: number;
    rcvSum: number; rcvN: number; acvSum: number; acvN: number;
    dedSum: number; dedN: number; daysSum: number; daysN: number;
  }>();
  for (const s of summaries) {
    const cur = byCarrierMap.get(s.carrier) || { count: 0, signed: 0, approved: 0, rcvSum: 0, rcvN: 0, acvSum: 0, acvN: 0, dedSum: 0, dedN: 0, daysSum: 0, daysN: 0 };
    cur.count += 1;
    if (s.signed) cur.signed += 1;
    if (s.approved) cur.approved += 1;
    if (s.rcv != null) { cur.rcvSum += s.rcv; cur.rcvN += 1; }
    if (s.acv != null) { cur.acvSum += s.acv; cur.acvN += 1; }
    if (s.deductible != null) { cur.dedSum += s.deductible; cur.dedN += 1; }
    if (s.daysToApprove != null) { cur.daysSum += s.daysToApprove; cur.daysN += 1; }
    byCarrierMap.set(s.carrier, cur);
  }
  const byCarrier = Array.from(byCarrierMap.entries())
    .map(([carrier, v]) => ({
      carrier,
      count: v.count,
      signedCount: v.signed,
      approvedCount: v.approved,
      closeRate: v.count > 0 ? Math.round((v.signed / v.count) * 1000) / 10 : 0,
      approvalRate: v.count > 0 ? Math.round((v.approved / v.count) * 1000) / 10 : 0,
      avgRCV: v.rcvN > 0 ? Math.round((v.rcvSum / v.rcvN) * 100) / 100 : 0,
      avgACV: v.acvN > 0 ? Math.round((v.acvSum / v.acvN) * 100) / 100 : 0,
      avgDeductible: v.dedN > 0 ? Math.round((v.dedSum / v.dedN) * 100) / 100 : 0,
      avgDaysToApprove: v.daysN > 0 ? Math.round((v.daysSum / v.daysN) * 10) / 10 : null,
    }))
    .sort((a, b) => b.count - a.count);

  // 4. Adjuster rollup
  const byAdjusterMap = new Map<string, { count: number; approved: number; daysSum: number; daysN: number; carriers: Set<string> }>();
  for (const s of summaries) {
    const cur = byAdjusterMap.get(s.adjuster) || { count: 0, approved: 0, daysSum: 0, daysN: 0, carriers: new Set<string>() };
    cur.count += 1;
    if (s.approved) cur.approved += 1;
    if (s.daysToApprove != null) { cur.daysSum += s.daysToApprove; cur.daysN += 1; }
    if (s.carrier) cur.carriers.add(s.carrier);
    byAdjusterMap.set(s.adjuster, cur);
  }
  const byAdjuster = Array.from(byAdjusterMap.entries())
    .map(([adjuster, v]) => ({
      adjuster,
      count: v.count,
      approvedCount: v.approved,
      approvalRate: v.count > 0 ? Math.round((v.approved / v.count) * 1000) / 10 : 0,
      avgDaysToApprove: v.daysN > 0 ? Math.round((v.daysSum / v.daysN) * 10) / 10 : null,
      carriers: [...v.carriers].slice(0, 5),
    }))
    .sort((a, b) => b.count - a.count);

  // 5. Totals
  const totals = summaries.reduce((acc, s) => ({
    rcv: acc.rcv + (s.rcv || 0),
    acv: acc.acv + (s.acv || 0),
    deductible: acc.deductible + (s.deductible || 0),
  }), { rcv: 0, acv: 0, deductible: 0 });

  const result: InsuranceAnalysis = {
    generatedAt: new Date().toISOString().slice(0, 10),
    daysQueried: days,
    totalInsuranceJobs: summaries.length,
    jobs: summaries,
    byCarrier,
    byAdjuster,
    totals: {
      rcv: Math.round(totals.rcv * 100) / 100,
      acv: Math.round(totals.acv * 100) / 100,
      deductible: Math.round(totals.deductible * 100) / 100,
    },
    meta: { queryTimeMs: Date.now() - start, jobsFetched, activitiesFetched },
  };

  _cache = { key: cacheKey, data: result, at: Date.now() };
  return result;
}
