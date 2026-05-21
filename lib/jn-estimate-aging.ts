/**
 * Estimate Aging Queue — extends /chrisview/funnel's no-response watchlist
 * past first-contact. Lists every OPEN estimate (not signed, not rejected)
 * bucketed by days idle since the last *manual* activity on the contact or
 * its related job(s). A rep should be nudged on anything sitting > 14 days.
 *
 * "Manual" activity follows the same exclusion regex used by
 * lib/jn-response-times.ts (Status Changed / Contact Created / etc. don't
 * count as a touch — they're auto-events). See line 37 of that file for the
 * authoritative list.
 *
 * COST-PRIVACY: every JN response is run through redactCostFieldsDeep before
 * we touch it. Cost fields never make it into the output shape; we only
 * surface estimate `total` (the customer-facing number) since this is the
 * sales pipeline view and not a margin breakout.
 *
 * Sheet-cache fast path: when called with the default days window (180), we
 * read the precomputed `aging` row from `chrisview_cache` first. Accept rows
 * up to 90 min old (survives one missed cron tick) — same pattern as the
 * other six chrisview libs.
 */
import { redactCostFieldsDeep } from './jn-redact';

const JN_KEY = process.env.JOBNIMBUS_API_KEY;
const JN_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

// Mirrors EXCLUDED_ACTIVITY_TYPES_RE in lib/jn-response-times.ts line 37.
// Status Changed, Contact Created, Assigned, Modified, etc. are auto-events
// — they don't reset the idle clock.
const EXCLUDED_ACTIVITY_TYPES_RE = /^(Contact Created|Assigned Contact|Job Created|Assigned Job|Related to job|Unassigned|Contact Modified|Job Modified|Attachment deleted|Attachment Added|Document Added|Status Changed)$/i;
const SYSTEM_AUTHORS_RE = /system|automation|webhook|portal|jobnimbus\b|^api\b|^email$/i;

// Estimate statuses that mean the deal is closed (signed/rejected/cancelled).
// Anything NOT matching these is "open" — still on the table.
const CLOSED_STATUS_RE = /signed|approved|accepted|sold|won|rejected|declined|denied|lost|dead|cancel(?:l?ed)?|void|expired|paid|installed|complete|closed/i;

interface JNEstimate {
  jnid: string;
  number?: string;
  status_name?: string;
  status?: string;
  total?: number;
  date_created?: number;
  date_status_change?: number;
  primary?: { id?: string; jnid?: string; name?: string };
  related?: Array<{ id?: string; jnid?: string; name?: string; type?: string }>;
  sales_rep_name?: string;
}

interface JNContact {
  jnid: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  sales_rep_name?: string;
}

interface JNJob {
  jnid: string;
  number?: string;
  sales_rep_name?: string;
  status_name?: string;
}

interface JNActivity {
  jnid: string;
  record_type_name?: string;
  date_created?: number;
  created_by_name?: string;
  status?: string;
  is_status_change?: boolean;
  source?: string;
}

function jnFetch<T>(endpoint: string): Promise<T> {
  if (!JN_KEY) throw new Error('JobNimbus API key not configured');
  return fetch(`${JN_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${JN_KEY}`, 'Content-Type': 'application/json' },
  }).then(async r => {
    if (!r.ok) throw new Error(`JN ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return redactCostFieldsDeep(await r.json(), false) as T;
  });
}

function isManualActivity(a: JNActivity): boolean {
  const author = (a.created_by_name || '').trim();
  if (!author) return false;
  if (SYSTEM_AUTHORS_RE.test(author)) return false;
  const type = (a.record_type_name || '').trim();
  if (EXCLUDED_ACTIVITY_TYPES_RE.test(type)) return false;
  if (a.is_status_change) return false;
  if (a.source && (a.source.startsWith('system') || a.source.includes('automation'))) return false;
  return true;
}

function isOpenEstimate(est: JNEstimate): boolean {
  const s = `${est.status_name || ''} ${est.status || ''}`.toLowerCase();
  if (!s.trim()) return true; // no status — assume open
  return !CLOSED_STATUS_RE.test(s);
}

export type AgingBucket = '0-7d' | '8-14d' | '15-30d' | '30+d';

function bucketFor(days: number): AgingBucket {
  if (days <= 7) return '0-7d';
  if (days <= 14) return '8-14d';
  if (days <= 30) return '15-30d';
  return '30+d';
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

function jnContactUrl(contactId: string, jobId?: string): string {
  // JN web UI URL — contact page if we only have a contact, job page when present.
  if (jobId) return `https://app.jobnimbus.com/job/${jobId}`;
  return `https://app.jobnimbus.com/contact/${contactId}`;
}

export interface AgingTopAged {
  estimateJnid: string;
  estimateNumber: string;
  customer: string;
  rep: string;
  amount: number;
  daysIdle: number;
  lastActivity: string | null; // ISO of last manual activity, or null if none
  lastActivityType: string | null;
  status: string;
  jobUrl: string;
}

export interface AgingByRep {
  rep: string;
  openCount: number;
  p50DaysIdle: number | null;
  p90DaysIdle: number | null;
  oldest: number; // max days idle on this rep's open estimates
}

export interface AgingBucketSummary {
  bucket: AgingBucket;
  count: number;
  percent: number;
}

export interface EstimateAgingAnalysis {
  generatedAt: string;
  windowDays: number;
  totalOpen: number;
  byBucket: AgingBucketSummary[];
  topAged: AgingTopAged[];
  byRep: AgingByRep[];
  meta: {
    queryTimeMs: number;
    estimatesFetched: number;
    estimatesOpen: number;
    activitiesFetched: number;
    contactsFetched: number;
    jobsFetched: number;
  };
}

const BUCKET_ORDER: AgingBucket[] = ['0-7d', '8-14d', '15-30d', '30+d'];
const SHEET_CACHE_MAX_AGE_MS = 90 * 60 * 1000;
const CACHE_TTL_MS = 10 * 60 * 1000;
let _cache: { key: string; data: EstimateAgingAnalysis; at: number } | null = null;

export async function analyzeEstimateAging(opts: { days?: number } = {}): Promise<EstimateAgingAnalysis> {
  const daysWindow = Math.min(Math.max(opts.days || 180, 1), 365);
  const cacheKey = `days:${daysWindow}`;
  if (_cache && _cache.key === cacheKey && Date.now() - _cache.at < CACHE_TTL_MS) return _cache.data;

  // Sheet-cache fast path for the default 180-day window.
  if (daysWindow === 180) {
    try {
      const { readChrisviewCache } = await import('./chrisview-sheet-cache');
      const cached = await readChrisviewCache<EstimateAgingAnalysis>('aging');
      if (cached) {
        const age = Date.now() - new Date(cached.generatedAt).getTime();
        if (Number.isFinite(age) && age < SHEET_CACHE_MAX_AGE_MS) {
          _cache = { key: cacheKey, data: cached.payload, at: Date.now() };
          return cached.payload;
        }
      }
    } catch (err) {
      console.warn('[jn-estimate-aging] sheet cache read failed:', err);
    }
  }

  const start = Date.now();
  const now = Math.floor(Date.now() / 1000);
  const since = now - daysWindow * 86400;

  // 1. Pull estimates created in the window
  const estimates: JNEstimate[] = [];
  let offset = 0;
  const pageSize = 100;
  let estimatesFetched = 0;
  while (offset < 2000) {
    const res = await jnFetch<{ count?: number; results?: JNEstimate[] }>(
      `/estimates?limit=${pageSize}&offset=${offset}&sort=-date_created`,
    );
    const page = res.results || [];
    if (!page.length) break;
    estimatesFetched += page.length;
    let stop = false;
    for (const e of page) {
      if ((e.date_created || 0) < since) { stop = true; break; }
      estimates.push(e);
    }
    if (stop) break;
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  // 2. Filter to OPEN estimates only
  const openEstimates = estimates.filter(isOpenEstimate);

  // 3. For each open estimate, find the last manual activity on its contact +
  //    related jobs. The contact-id cache means we only walk activities once
  //    per contact even if a customer has multiple estimates open.
  const activityCache = new Map<string, JNActivity[]>();
  const jobsByContactCache = new Map<string, JNJob[]>();
  const contactCache = new Map<string, JNContact | null>();
  let activitiesFetched = 0;
  let jobsFetched = 0;
  let contactsFetched = 0;

  async function getContact(id: string): Promise<JNContact | null> {
    if (!id) return null;
    if (contactCache.has(id)) return contactCache.get(id)!;
    try {
      const r = await jnFetch<JNContact>(`/contacts/${id}`);
      contactsFetched += 1;
      contactCache.set(id, r);
      return r;
    } catch {
      contactCache.set(id, null);
      return null;
    }
  }

  async function getJobsForContact(id: string): Promise<JNJob[]> {
    if (!id) return [];
    if (jobsByContactCache.has(id)) return jobsByContactCache.get(id)!;
    try {
      const filter = encodeURIComponent(JSON.stringify({ must: [{ term: { 'primary.id': id } }] }));
      const r = await jnFetch<{ results?: JNJob[] }>(`/jobs?filter=${filter}&limit=10`);
      const jobs = r.results || [];
      jobsFetched += jobs.length;
      jobsByContactCache.set(id, jobs);
      return jobs;
    } catch {
      jobsByContactCache.set(id, []);
      return [];
    }
  }

  async function getActivitiesFor(contactId: string, jobIds: string[]): Promise<JNActivity[]> {
    const key = `${contactId}|${jobIds.sort().join(',')}`;
    if (activityCache.has(key)) return activityCache.get(key)!;
    const seen = new Set<string>();
    const merged: JNActivity[] = [];
    const addAll = (arr?: JNActivity[]) => {
      for (const a of arr || []) {
        if (a.jnid && !seen.has(a.jnid)) { seen.add(a.jnid); merged.push(a); }
      }
    };

    if (contactId) {
      const fP = encodeURIComponent(JSON.stringify({ must: [{ term: { 'primary.id': contactId } }] }));
      const fR = encodeURIComponent(JSON.stringify({ must: [{ term: { 'related.id': contactId } }] }));
      const [byP, byR] = await Promise.all([
        jnFetch<{ results?: JNActivity[] }>(`/activities?filter=${fP}&sort=-date_created&limit=50`).catch(() => ({ results: [] })),
        jnFetch<{ results?: JNActivity[] }>(`/activities?filter=${fR}&sort=-date_created&limit=50`).catch(() => ({ results: [] })),
      ]);
      addAll(byP.results);
      addAll(byR.results);
    }

    for (const jid of jobIds) {
      if (!jid) continue;
      const fP = encodeURIComponent(JSON.stringify({ must: [{ term: { 'primary.id': jid } }] }));
      const fR = encodeURIComponent(JSON.stringify({ must: [{ term: { 'related.id': jid } }] }));
      const [byP, byR] = await Promise.all([
        jnFetch<{ results?: JNActivity[] }>(`/activities?filter=${fP}&sort=-date_created&limit=50`).catch(() => ({ results: [] })),
        jnFetch<{ results?: JNActivity[] }>(`/activities?filter=${fR}&sort=-date_created&limit=50`).catch(() => ({ results: [] })),
      ]);
      addAll(byP.results);
      addAll(byR.results);
    }

    activitiesFetched += merged.length;
    activityCache.set(key, merged);
    return merged;
  }

  interface Computed {
    est: JNEstimate;
    contact: JNContact | null;
    job: JNJob | undefined;
    daysIdle: number;
    lastActivityAt: number | null;
    lastActivityType: string | null;
  }
  const computed: Computed[] = [];

  for (let i = 0; i < openEstimates.length; i++) {
    const est = openEstimates[i];
    const contactId = est.primary?.id || est.primary?.jnid || '';
    const [contact, jobs] = await Promise.all([
      getContact(contactId),
      getJobsForContact(contactId),
    ]);
    const jobIds = jobs.map(j => j.jnid).filter(Boolean);
    const activities = await getActivitiesFor(contactId, jobIds);

    // Most recent manual activity on contact OR any related job.
    let lastManual: JNActivity | null = null;
    for (const a of activities) {
      if (!isManualActivity(a)) continue;
      if (!lastManual || (a.date_created || 0) > (lastManual.date_created || 0)) {
        lastManual = a;
      }
    }

    // Reference point for "idle since": the most recent of last manual
    // activity OR the estimate's own creation date. If there's been no
    // touch since the estimate was created, the estimate's own age is the
    // idle clock.
    const estCreated = est.date_created || 0;
    const lastTouchSec = Math.max(lastManual?.date_created || 0, estCreated);
    const daysIdle = lastTouchSec > 0 ? Math.floor((now - lastTouchSec) / 86400) : 0;

    computed.push({
      est,
      contact,
      job: jobs[0],
      daysIdle,
      lastActivityAt: lastManual?.date_created || null,
      lastActivityType: lastManual?.record_type_name || null,
    });

    // Throttle: every 10 estimates, breathe so we don't hammer JN
    if (i > 0 && i % 10 === 0) await new Promise(r => setTimeout(r, 150));
  }

  // 4. Aggregate
  const totalOpen = computed.length;
  const bucketCounts: Record<AgingBucket, number> = { '0-7d': 0, '8-14d': 0, '15-30d': 0, '30+d': 0 };
  for (const c of computed) bucketCounts[bucketFor(c.daysIdle)] += 1;
  const byBucket: AgingBucketSummary[] = BUCKET_ORDER.map(b => ({
    bucket: b,
    count: bucketCounts[b],
    percent: totalOpen > 0 ? Math.round((bucketCounts[b] / totalOpen) * 1000) / 10 : 0,
  }));

  // Top aged — sort desc by daysIdle, cap to 50 so the page stays usable
  const topAged: AgingTopAged[] = [...computed]
    .sort((a, b) => b.daysIdle - a.daysIdle)
    .slice(0, 50)
    .map(c => {
      const contactId = c.est.primary?.id || c.est.primary?.jnid || '';
      const customer = c.contact?.display_name
        || `${c.contact?.first_name || ''} ${c.contact?.last_name || ''}`.trim()
        || c.est.primary?.name
        || '(unknown)';
      return {
        estimateJnid: c.est.jnid,
        estimateNumber: c.est.number || '',
        customer,
        rep: (c.est.sales_rep_name || c.job?.sales_rep_name || c.contact?.sales_rep_name || '').trim() || '(unassigned)',
        amount: Number(c.est.total) || 0,
        daysIdle: c.daysIdle,
        lastActivity: c.lastActivityAt ? new Date(c.lastActivityAt * 1000).toISOString() : null,
        lastActivityType: c.lastActivityType,
        status: c.est.status_name || c.est.status || '',
        jobUrl: jnContactUrl(contactId, c.job?.jnid),
      };
    });

  // Per-rep summary
  const repMap = new Map<string, number[]>(); // rep -> daysIdle[]
  for (const c of computed) {
    const rep = (c.est.sales_rep_name || c.job?.sales_rep_name || c.contact?.sales_rep_name || '').trim() || '(unassigned)';
    if (!repMap.has(rep)) repMap.set(rep, []);
    repMap.get(rep)!.push(c.daysIdle);
  }
  const byRep: AgingByRep[] = Array.from(repMap.entries())
    .map(([rep, days]) => ({
      rep,
      openCount: days.length,
      p50DaysIdle: percentile(days, 50),
      p90DaysIdle: percentile(days, 90),
      oldest: days.length > 0 ? Math.max(...days) : 0,
    }))
    .sort((a, b) => b.openCount - a.openCount);

  const result: EstimateAgingAnalysis = {
    generatedAt: new Date().toISOString(),
    windowDays: daysWindow,
    totalOpen,
    byBucket,
    topAged,
    byRep,
    meta: {
      queryTimeMs: Date.now() - start,
      estimatesFetched,
      estimatesOpen: totalOpen,
      activitiesFetched,
      contactsFetched,
      jobsFetched,
    },
  };

  _cache = { key: cacheKey, data: result, at: Date.now() };
  return result;
}
