/**
 * Estimate close-rate analysis (Phase 3 of chrisview analytics roadmap).
 *
 * For each recent estimate in JN:
 *   1. Was there a completed appointment BEFORE the estimate's date_created?
 *      → in-person delivery
 *   2. Was there ANY contact note mentioning a meeting/visit/inspection
 *      BEFORE the estimate? → also in-person
 *   3. Otherwise → online
 *
 * Then bucket close rate (signed / total) by:
 *   - delivery channel (in-person vs online)
 *   - insurance vs non-insurance (job has insurance summary?)
 *   - first-contact method (Phone / Text / Email) from the rep's first
 *     manual activity on the contact
 *   - rep
 *
 * Cost-privacy: this module never reads cost fields. The JN responses
 * are passed through redactCostFieldsDeep before any aggregation.
 */
import { redactCostFieldsDeep } from './jn-redact';

const JN_API_KEY = process.env.JOBNIMBUS_API_KEY;
const JN_API_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

interface JNEstimate {
  jnid: string;
  number?: string;
  status?: string;
  status_name?: string;
  total?: number;
  date_created?: number;
  date_status_change?: number;
  primary?: { id?: string; jnid?: string };
  related?: Array<{ id?: string; jnid?: string; type?: string }>;
  sales_rep_name?: string;
}

interface JNActivity {
  jnid: string;
  record_type_name?: string;
  type?: string;
  date_created?: number;
  date_end?: number;
  status?: string;
  created_by_name?: string;
  note?: string;
  primary?: { id?: string; jnid?: string };
  related?: Array<{ id?: string; jnid?: string }>;
}

interface JNJob {
  jnid: string;
  number?: string;
  insurance_summary?: unknown;
  insurance_company?: string;
  claim_number?: string;
  sales_rep_name?: string;
  status_name?: string;
}

const SIGNED_STATUSES = new Set([
  'signed', 'approved', 'accepted', 'sold', 'won',
  'estimate signed', 'contract signed', 'contingency signed',
]);

function jnFetch<T>(endpoint: string): Promise<T> {
  if (!JN_API_KEY) throw new Error('JobNimbus API key not configured');
  return fetch(`${JN_API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${JN_API_KEY}`, 'Content-Type': 'application/json' },
  }).then(async r => {
    if (!r.ok) throw new Error(`JN ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return redactCostFieldsDeep(await r.json(), false) as T;
  });
}

function isSigned(status: string | undefined): boolean {
  const s = (status || '').toLowerCase().trim();
  return SIGNED_STATUSES.has(s) || s.includes('signed') || s.includes('won');
}

function isAppointment(activity: JNActivity): boolean {
  const t = (activity.record_type_name || activity.type || '').toLowerCase();
  return t.includes('appointment') || t === 'task';
}

function isCompleted(activity: JNActivity): boolean {
  const s = (activity.status || '').toLowerCase();
  return s === 'completed' || s === 'done' || s === 'complete';
}

function noteMentionsMeeting(activity: JNActivity): boolean {
  const t = (activity.record_type_name || '').toLowerCase();
  if (t !== 'note') return false;
  const note = (activity.note || '').toLowerCase();
  return /\b(met|meeting|visited|inspection|inspected|in.?person|on.?site|stopped by|came out)\b/.test(note);
}

interface EstimateBucket {
  delivery: 'in_person' | 'online' | 'unknown';
  insurance: 'insurance' | 'retail' | 'unknown';
  firstContactMethod: string;
  rep: string;
  signed: boolean;
  amount: number;
  daysToSigned: number | null;
  estimateDate: string;
}

export interface CloseRateAnalysis {
  generatedAt: string;
  daysQueried: number;
  totalEstimates: number;
  estimates: EstimateBucket[];
  byDelivery: Array<{ key: string; total: number; signed: number; rate: number; avgAmount: number }>;
  byInsurance: Array<{ key: string; total: number; signed: number; rate: number; avgAmount: number }>;
  byCombo: Array<{ key: string; total: number; signed: number; rate: number; avgAmount: number }>;
  byRep: Array<{ key: string; total: number; signed: number; rate: number; avgAmount: number }>;
  byContactMethod: Array<{ key: string; total: number; signed: number; rate: number; avgAmount: number }>;
  meta: { queryTimeMs: number; estimatesFetched: number; jobsFetched: number; activitiesFetched: number };
}

let _cache: { key: string; data: CloseRateAnalysis; at: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function analyzeCloseRates(opts: { days?: number } = {}): Promise<CloseRateAnalysis> {
  const days = Math.min(opts.days || 90, 365);
  const cacheKey = `days:${days}`;
  if (_cache && _cache.key === cacheKey && Date.now() - _cache.at < CACHE_TTL_MS) {
    return _cache.data;
  }

  // Sheet-cache fast path for the default 90-day window (what the page hits).
  if (days === 90) {
    try {
      const { readChrisviewCache } = await import('./chrisview-sheet-cache');
      const cached = await readChrisviewCache<CloseRateAnalysis>('close-rates');
      if (cached) {
        const age = Date.now() - new Date(cached.generatedAt).getTime();
        if (Number.isFinite(age) && age < 90 * 60 * 1000) {
          _cache = { key: cacheKey, data: cached.payload, at: Date.now() };
          return cached.payload;
        }
      }
    } catch (err) {
      console.warn('[jn-close-rate-analysis] sheet cache read failed:', err);
    }
  }

  const start = Date.now();
  const now = Math.floor(Date.now() / 1000);
  const since = now - days * 86400;

  // 1. Pull recent estimates (last N days, paginate)
  const estimates: JNEstimate[] = [];
  let offset = 0;
  const pageSize = 100;
  let estimatesFetched = 0;
  while (offset < 1000) { // hard cap
    const res = await jnFetch<{ count?: number; results?: JNEstimate[] }>(`/estimates?limit=${pageSize}&offset=${offset}&sort=-date_created`);
    const page = res.results || [];
    if (!page.length) break;
    estimatesFetched += page.length;
    let pageInRange = 0;
    for (const e of page) {
      if ((e.date_created || 0) < since) continue;
      estimates.push(e);
      pageInRange += 1;
    }
    // Stop if oldest in this page is older than `since`
    const oldest = Math.min(...page.map(e => e.date_created || 0));
    if (oldest < since) break;
    if (pageInRange === 0) break;
    offset += pageSize;
  }

  // 2. For each estimate, fetch related job (for insurance flag) and activities
  // To keep this responsive, cap to 200 most recent estimates
  const sample = estimates.slice(0, 200);

  // Cache job + activity lookups by contact id
  const jobCache = new Map<string, JNJob | null>();
  const activityCache = new Map<string, JNActivity[]>();
  let jobsFetched = 0;
  let activitiesFetched = 0;

  async function getJobsForContact(contactId: string): Promise<JNJob[]> {
    if (!contactId) return [];
    if (jobCache.has(contactId)) {
      const v = jobCache.get(contactId);
      return v ? [v] : [];
    }
    try {
      const filter = { must: [{ term: { 'primary.id': contactId } }] };
      const res = await jnFetch<{ results?: JNJob[] }>(`/jobs?filter=${encodeURIComponent(JSON.stringify(filter))}&limit=5`);
      const jobs = res.results || [];
      jobsFetched += jobs.length;
      jobCache.set(contactId, jobs[0] || null);
      return jobs;
    } catch {
      jobCache.set(contactId, null);
      return [];
    }
  }

  async function getActivitiesForContact(contactId: string): Promise<JNActivity[]> {
    if (!contactId) return [];
    if (activityCache.has(contactId)) return activityCache.get(contactId)!;
    try {
      const filter = { must: [{ term: { 'primary.id': contactId } }] };
      const res = await jnFetch<{ results?: JNActivity[] }>(`/activities?filter=${encodeURIComponent(JSON.stringify(filter))}&sort=date_created&limit=100`);
      const acts = res.results || [];
      activitiesFetched += acts.length;
      activityCache.set(contactId, acts);
      return acts;
    } catch {
      activityCache.set(contactId, []);
      return [];
    }
  }

  const buckets: EstimateBucket[] = [];

  for (const est of sample) {
    const contactId = est.primary?.id || est.primary?.jnid || '';
    if (!contactId) continue;

    const [jobs, acts] = await Promise.all([
      getJobsForContact(contactId),
      getActivitiesForContact(contactId),
    ]);

    const job = jobs[0];
    const hasInsurance = !!(job?.insurance_summary || job?.insurance_company || job?.claim_number);

    // Activities BEFORE this estimate
    const estCreated = est.date_created || 0;
    const before = acts.filter(a => (a.date_created || 0) < estCreated);

    const completedApptBefore = before.some(a => isAppointment(a) && isCompleted(a));
    const meetingNoteBefore = before.some(noteMentionsMeeting);
    const delivery = completedApptBefore || meetingNoteBefore ? 'in_person' : 'online';

    // First-contact method = first manual activity by the assigned rep
    const repName = est.sales_rep_name || job?.sales_rep_name || '';
    const firstManual = acts.find(a => {
      const t = (a.record_type_name || '').toLowerCase();
      if (!['note', 'phone call', 'text message', 'email'].includes(t)) return false;
      const author = (a.created_by_name || '').trim();
      if (!author) return false;
      // Match the broader system/automation exclusion used in jn-response-times.ts
      if (/system|automation|webhook|portal|jobnimbus\b|^api\b|^email$/i.test(author)) return false;
      // Exclude office staff so the method reflects the rep's outreach, not office logging
      const a_lc = author.toLowerCase();
      if (/^(sara hill|destin mc ?cary|tia (muse )?morris|tia muse|boston|office)$/.test(a_lc)) return false;
      return true;
    });
    const firstContactMethod = firstManual?.record_type_name || 'unknown';

    const signed = isSigned(est.status_name) || isSigned(est.status);
    const signedAt = signed ? (est.date_status_change || est.date_created || 0) : 0;
    const daysToSigned = signedAt && estCreated ? Math.round((signedAt - estCreated) / 86400 * 10) / 10 : null;

    buckets.push({
      delivery,
      insurance: hasInsurance ? 'insurance' : 'retail',
      firstContactMethod,
      rep: repName,
      signed,
      amount: 0, // intentionally not reading cost-sensitive amount
      daysToSigned,
      estimateDate: estCreated ? new Date(estCreated * 1000).toISOString().slice(0, 10) : '',
    });
  }

  // Aggregate helpers
  function rollup<K extends keyof EstimateBucket | 'combo'>(keyFn: (b: EstimateBucket) => string) {
    const m = new Map<string, { total: number; signed: number; amountSum: number }>();
    for (const b of buckets) {
      const k = keyFn(b);
      const cur = m.get(k) || { total: 0, signed: 0, amountSum: 0 };
      cur.total += 1;
      if (b.signed) cur.signed += 1;
      cur.amountSum += b.amount;
      m.set(k, cur);
    }
    return Array.from(m.entries())
      .map(([key, v]) => ({
        key,
        total: v.total,
        signed: v.signed,
        rate: v.total > 0 ? Math.round((v.signed / v.total) * 1000) / 10 : 0,
        avgAmount: v.total > 0 ? Math.round((v.amountSum / v.total) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }

  const result: CloseRateAnalysis = {
    generatedAt: new Date().toISOString().slice(0, 10),
    daysQueried: days,
    totalEstimates: buckets.length,
    estimates: buckets,
    byDelivery: rollup(b => b.delivery),
    byInsurance: rollup(b => b.insurance),
    byCombo: rollup(b => `${b.delivery} · ${b.insurance}`),
    byRep: rollup(b => b.rep || 'Unassigned'),
    byContactMethod: rollup(b => b.firstContactMethod),
    meta: {
      queryTimeMs: Date.now() - start,
      estimatesFetched,
      jobsFetched,
      activitiesFetched,
    },
  };

  _cache = { key: cacheKey, data: result, at: Date.now() };
  return result;
}
