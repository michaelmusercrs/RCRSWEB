/**
 * Job Lifecycle Analysis (Phase 5 of chrisview analytics roadmap).
 *
 * For each job pulled from JN over the chosen window:
 *
 *   - Time to contract  (lead created → signed)
 *   - Time to install   (signed → install scheduled / completed)
 *   - Time to paid      (signed → final paid)
 *   - Trips to job      (count of completed appointments on the job)
 *   - Rework flag       (any activity note mentions "rework" / "redo")
 *   - 90-day unpaid     (deposit > 90 days ago and not paid in full)
 *   - First contact     (method + minutes from lead-created)
 *
 * Rollups:
 *   - By rep, by carrier, by month, by first-contact method
 *   - Overall histograms (time-to-contract, time-to-install, etc.)
 *
 * Cost-privacy: every JN response runs through redactCostFieldsDeep.
 */
import { redactCostFieldsDeep } from './jn-redact';

const JN_API_KEY = process.env.JOBNIMBUS_API_KEY;
const JN_API_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

interface JNJob {
  jnid: string;
  number?: string;
  name?: string;
  status_name?: string;
  sales_rep_name?: string;
  insurance_company?: string;
  insurance_company_name?: string;
  claim_number?: string;
  date_created?: number;
  date_status_change?: number;
  date_signed?: number;
  date_approved?: number;
  date_install_scheduled?: number;
  date_installed?: number;
  date_paid?: number;
  primary?: { id?: string };
  [k: string]: unknown;
}

interface JNActivity {
  jnid: string;
  record_type_name?: string;
  date_created?: number;
  date_end?: number;
  status?: string;
  created_by_name?: string;
  note?: string;
  primary?: { id?: string };
  related?: Array<{ id?: string }>;
}

interface JNInvoice {
  jnid: string;
  total?: number;
  amount_paid?: number;
  balance?: number;
  date_created?: number;
  date_paid?: number;
  status?: string;
  related?: Array<{ id?: string }>;
}

const SIGNED_RE = /signed|contract|contingency|approved|sold|won|paid/i;
const PAID_RE = /paid|closed/i;
const INSTALL_RE = /install/i;
const REWORK_RE = /\b(rework|redo|punch list|re.do|callback|callbacks)\b/i;
const FIRST_CONTACT_TYPES = new Set([
  'Note', 'Phone Call', 'Text Message', 'Email', 'email',
  'Appointment', 'appointment', 'Task', 'task',
]);
const SYSTEM_AUTHORS_RE = /system|automation|jobnimbus|api|webhook|portal/i;

function jnFetch<T>(endpoint: string): Promise<T> {
  if (!JN_API_KEY) throw new Error('JobNimbus API key not configured');
  return fetch(`${JN_API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${JN_API_KEY}`, 'Content-Type': 'application/json' },
  }).then(async r => {
    if (!r.ok) throw new Error(`JN ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return redactCostFieldsDeep(await r.json(), false) as T;
  });
}

function isFirstContactActivity(a: JNActivity): boolean {
  const t = (a.record_type_name || '').trim();
  if (!FIRST_CONTACT_TYPES.has(t)) return false;
  const author = (a.created_by_name || '').toLowerCase();
  if (SYSTEM_AUTHORS_RE.test(author)) return false;
  return true;
}

function days(a: number | undefined, b: number | undefined): number | null {
  if (!a || !b || b < a) return null;
  return Math.round((b - a) / 86400 * 10) / 10;
}

export interface LifecycleJob {
  jnid: string;
  number: string;
  customer: string;
  rep: string;
  carrier: string;
  status: string;
  isInsurance: boolean;
  createdAt: number;
  signedAt: number | null;
  installedAt: number | null;
  paidAt: number | null;
  firstContactAt: number | null;
  firstContactMethod: string | null;
  responseMinutes: number | null;
  daysToContract: number | null;
  daysToInstall: number | null;
  daysToPaid: number | null;
  tripCount: number;
  reworkCount: number;
  unpaidOver90Days: boolean;
  outstandingBalance: number;
}

export interface LifecycleAnalysis {
  generatedAt: string;
  daysQueried: number;
  jobsAnalyzed: number;
  jobs: LifecycleJob[];
  byRep: Array<RollupRow>;
  byMethod: Array<RollupRow>;
  byInsurance: Array<RollupRow>;
  histograms: {
    daysToContract: HistBucket[];
    daysToInstall: HistBucket[];
    daysToPaid: HistBucket[];
  };
  overall: {
    medianDaysToContract: number | null;
    medianDaysToInstall: number | null;
    medianDaysToPaid: number | null;
    avgTrips: number;
    pctWithRework: number;
    unpaidOver90Count: number;
    unpaidOver90Total: number;
  };
  meta: { queryTimeMs: number; jobsFetched: number; activitiesFetched: number; invoicesFetched: number };
}

interface RollupRow {
  key: string;
  jobs: number;
  signed: number;
  installed: number;
  paid: number;
  medianResponseMin: number | null;
  medianDaysToContract: number | null;
  medianDaysToInstall: number | null;
  medianDaysToPaid: number | null;
  avgTrips: number;
  reworkPct: number;
  unpaidOver90: number;
}

interface HistBucket {
  bucket: string;
  count: number;
}

function median(arr: number[]): number | null {
  const v = arr.filter(x => x != null && Number.isFinite(x));
  if (!v.length) return null;
  v.sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2 * 10) / 10;
}

function bucketize(values: number[], edges: number[]): HistBucket[] {
  const buckets: HistBucket[] = [];
  for (let i = 0; i < edges.length; i++) {
    const lo = i === 0 ? 0 : edges[i - 1];
    const hi = edges[i];
    const label = i === 0 ? `0-${hi}` : `${lo}-${hi}`;
    buckets.push({ bucket: label, count: values.filter(v => v >= lo && v < hi).length });
  }
  buckets.push({ bucket: `${edges[edges.length - 1]}+`, count: values.filter(v => v >= edges[edges.length - 1]).length });
  return buckets;
}

let _cache: { key: string; data: LifecycleAnalysis; at: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function analyzeJobLifecycle(opts: { days?: number } = {}): Promise<LifecycleAnalysis> {
  const daysWindow = Math.min(opts.days || 180, 730);
  const cacheKey = `days:${daysWindow}`;
  if (_cache && _cache.key === cacheKey && Date.now() - _cache.at < CACHE_TTL_MS) return _cache.data;

  // Sheet-cache fast path for the default 180-day window.
  if (daysWindow === 180) {
    try {
      const { readChrisviewCache } = await import('./chrisview-sheet-cache');
      const cached = await readChrisviewCache<LifecycleAnalysis>('lifecycle');
      if (cached) {
        const age = Date.now() - new Date(cached.generatedAt).getTime();
        if (Number.isFinite(age) && age < 90 * 60 * 1000) {
          _cache = { key: cacheKey, data: cached.payload, at: Date.now() };
          return cached.payload;
        }
      }
    } catch (err) {
      console.warn('[jn-job-lifecycle] sheet cache read failed:', err);
    }
  }

  const start = Date.now();
  const now = Math.floor(Date.now() / 1000);
  const since = now - daysWindow * 86400;

  // 1. Pull jobs in window (cap 1000)
  const jobs: JNJob[] = [];
  let offset = 0;
  const pageSize = 100;
  let jobsFetched = 0;
  while (offset < 1500) {
    const res = await jnFetch<{ count?: number; results?: JNJob[] }>(`/jobs?limit=${pageSize}&offset=${offset}&sort=-date_created`);
    const page = res.results || [];
    if (!page.length) break;
    jobsFetched += page.length;
    for (const j of page) {
      if ((j.date_created || 0) < since) continue;
      jobs.push(j);
    }
    const oldest = Math.min(...page.map(j => j.date_created || 0));
    if (oldest < since) break;
    offset += pageSize;
  }

  const sample = jobs.slice(0, 250); // cap for API budget
  let activitiesFetched = 0;
  let invoicesFetched = 0;

  // 2. For each job: activities (for first contact + trip count + rework) and invoices (for paid status)
  async function getActivitiesForJob(jobJnid: string): Promise<JNActivity[]> {
    // Activities on a job are indexed via BOTH `primary.id` and `related.id`
    // — checking only one misses half the touches. Matches the pattern in
    // jn-deep-funnel.ts and jn-response-times.ts.
    try {
      const fP = encodeURIComponent(JSON.stringify({ must: [{ term: { 'primary.id': jobJnid } }] }));
      const fR = encodeURIComponent(JSON.stringify({ must: [{ term: { 'related.id': jobJnid } }] }));
      const [byP, byR] = await Promise.all([
        jnFetch<{ results?: JNActivity[]; activity?: JNActivity[] }>(`/activities?filter=${fP}&sort=date_created&limit=100`).catch(() => ({ results: [] as JNActivity[], activity: [] as JNActivity[] })),
        jnFetch<{ results?: JNActivity[]; activity?: JNActivity[] }>(`/activities?filter=${fR}&sort=date_created&limit=100`).catch(() => ({ results: [] as JNActivity[], activity: [] as JNActivity[] })),
      ]);
      const seen = new Set<string>();
      const acts: JNActivity[] = [];
      // JN /activities response uses `activity` not `results`.
      for (const a of [...(byP.results || byP.activity || []), ...(byR.results || byR.activity || [])]) {
        if (a.jnid && !seen.has(a.jnid)) { seen.add(a.jnid); acts.push(a); }
      }
      activitiesFetched += acts.length;
      return acts;
    } catch {
      return [];
    }
  }

  async function getInvoicesForJob(jobJnid: string): Promise<JNInvoice[]> {
    try {
      const filter = { must: [{ term: { 'related.id': jobJnid } }] };
      const res = await jnFetch<{ results?: JNInvoice[] }>(`/invoices?filter=${encodeURIComponent(JSON.stringify(filter))}&limit=20`);
      const invs = res.results || [];
      invoicesFetched += invs.length;
      return invs;
    } catch {
      return [];
    }
  }

  const lifecycle: LifecycleJob[] = [];

  for (const j of sample) {
    const [acts, invs] = await Promise.all([
      getActivitiesForJob(j.jnid),
      getInvoicesForJob(j.jnid),
    ]);

    const status = (j.status_name || '').toLowerCase();
    const carrier = String(j.insurance_company_name || j.insurance_company || '').trim();
    const isInsurance = !!(carrier || j.claim_number);

    const firstContact = acts.find(isFirstContactActivity);
    const firstContactAt = firstContact?.date_created || null;
    const firstContactMethod = firstContact?.record_type_name || null;
    const responseMinutes = firstContactAt && j.date_created
      ? Math.round(((firstContactAt - j.date_created) / 60) * 10) / 10
      : null;

    // Signed / installed / paid timestamps
    const isSignedStatus = SIGNED_RE.test(status);
    const signedAt = isSignedStatus
      ? (j.date_signed || j.date_status_change || j.date_created || null)
      : null;

    // In JN, appointments are surfaced as "Task Completed" / "Task Created"
    // activity events — NOT a record_type_name of 'appointment'. Probe-
    // verified 2026-05-21.
    const installEvent = acts.find(a => {
      const t = (a.record_type_name || '').toLowerCase();
      const note = (a.note || '').toLowerCase();
      return (t === 'task completed' && INSTALL_RE.test(note)) ||
        (t === 'note' && /install (complete|done|finished)/i.test(note));
    });
    const installedAt =
      asNum(j.date_installed) ??
      asNum(j.date_install_scheduled) ??
      installEvent?.date_created ??
      null;

    // Trip count = `Task Completed` events on the job
    const trips = acts.filter(a =>
      (a.record_type_name || '').toLowerCase() === 'task completed'
    ).length;

    // Rework activities
    const reworkCount = acts.filter(a => REWORK_RE.test(a.note || '')).length;

    // Invoices: total, paid, balance
    const totalAmount = invs.reduce((s, inv) => s + (Number(inv.total) || 0), 0);
    const paidAmount = invs.reduce((s, inv) => s + (Number(inv.amount_paid) || 0), 0);
    const balance = invs.reduce((s, inv) => s + (Number(inv.balance) || 0), 0);
    const fullyPaid = totalAmount > 0 && Math.abs(balance) < 1;
    const earliestInvoice = invs.length > 0
      ? invs.reduce((min, inv) => Math.min(min, inv.date_created || Infinity), Infinity)
      : null;
    const paidAt = fullyPaid && earliestInvoice
      ? Math.max(...invs.map(i => i.date_paid || 0).filter(t => t > 0)) || null
      : null;
    const earliestUnpaid = !fullyPaid && totalAmount > 0
      ? (signedAt || earliestInvoice || j.date_created || 0)
      : 0;
    const unpaidOver90 = earliestUnpaid > 0 && (now - earliestUnpaid) > 90 * 86400 && balance > 1;

    lifecycle.push({
      jnid: j.jnid,
      number: j.number || '',
      customer: j.name || '',
      rep: j.sales_rep_name || '',
      carrier,
      status: j.status_name || '',
      isInsurance,
      createdAt: j.date_created || 0,
      signedAt,
      installedAt,
      paidAt,
      firstContactAt,
      firstContactMethod,
      responseMinutes,
      daysToContract: days(j.date_created, signedAt || undefined),
      daysToInstall: days(signedAt || undefined, installedAt || undefined),
      daysToPaid: days(signedAt || undefined, paidAt || undefined),
      tripCount: trips,
      reworkCount,
      unpaidOver90Days: unpaidOver90,
      outstandingBalance: Math.round(balance * 100) / 100,
    });
  }

  // 3. Rollups
  function rollup(keyFn: (j: LifecycleJob) => string): RollupRow[] {
    const m = new Map<string, LifecycleJob[]>();
    for (const j of lifecycle) {
      const k = keyFn(j) || 'Unknown';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(j);
    }
    return Array.from(m.entries()).map(([key, group]) => {
      const responseMins = group.map(g => g.responseMinutes).filter((x): x is number => x != null);
      return {
        key,
        jobs: group.length,
        signed: group.filter(g => g.signedAt).length,
        installed: group.filter(g => g.installedAt).length,
        paid: group.filter(g => g.paidAt).length,
        medianResponseMin: median(responseMins),
        medianDaysToContract: median(group.map(g => g.daysToContract).filter((x): x is number => x != null)),
        medianDaysToInstall: median(group.map(g => g.daysToInstall).filter((x): x is number => x != null)),
        medianDaysToPaid: median(group.map(g => g.daysToPaid).filter((x): x is number => x != null)),
        avgTrips: group.length > 0 ? Math.round((group.reduce((s, g) => s + g.tripCount, 0) / group.length) * 10) / 10 : 0,
        reworkPct: group.length > 0 ? Math.round((group.filter(g => g.reworkCount > 0).length / group.length) * 1000) / 10 : 0,
        unpaidOver90: group.filter(g => g.unpaidOver90Days).length,
      };
    }).sort((a, b) => b.jobs - a.jobs);
  }

  const byRep = rollup(j => j.rep);
  const byMethod = rollup(j => j.firstContactMethod || 'no-contact');
  const byInsurance = rollup(j => j.isInsurance ? 'insurance' : 'retail');

  // Overall histograms
  const HIST_EDGES = [1, 3, 7, 14, 30, 60, 90];
  const histograms = {
    daysToContract: bucketize(lifecycle.map(j => j.daysToContract).filter((x): x is number => x != null), HIST_EDGES),
    daysToInstall: bucketize(lifecycle.map(j => j.daysToInstall).filter((x): x is number => x != null), HIST_EDGES),
    daysToPaid: bucketize(lifecycle.map(j => j.daysToPaid).filter((x): x is number => x != null), HIST_EDGES),
  };

  const overall = {
    medianDaysToContract: median(lifecycle.map(j => j.daysToContract).filter((x): x is number => x != null)),
    medianDaysToInstall: median(lifecycle.map(j => j.daysToInstall).filter((x): x is number => x != null)),
    medianDaysToPaid: median(lifecycle.map(j => j.daysToPaid).filter((x): x is number => x != null)),
    avgTrips: lifecycle.length > 0
      ? Math.round((lifecycle.reduce((s, j) => s + j.tripCount, 0) / lifecycle.length) * 10) / 10
      : 0,
    pctWithRework: lifecycle.length > 0
      ? Math.round((lifecycle.filter(j => j.reworkCount > 0).length / lifecycle.length) * 1000) / 10
      : 0,
    unpaidOver90Count: lifecycle.filter(j => j.unpaidOver90Days).length,
    unpaidOver90Total: Math.round(lifecycle.filter(j => j.unpaidOver90Days).reduce((s, j) => s + j.outstandingBalance, 0) * 100) / 100,
  };

  const result: LifecycleAnalysis = {
    generatedAt: new Date().toISOString().slice(0, 10),
    daysQueried: daysWindow,
    jobsAnalyzed: lifecycle.length,
    jobs: lifecycle,
    byRep,
    byMethod,
    byInsurance,
    histograms,
    overall,
    meta: { queryTimeMs: Date.now() - start, jobsFetched, activitiesFetched, invoicesFetched },
  };

  _cache = { key: cacheKey, data: result, at: Date.now() };
  return result;
}

function asNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}
