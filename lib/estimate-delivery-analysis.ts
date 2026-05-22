/**
 * Estimate Delivery Analysis — emailed vs presented in-person.
 *
 * Per Michael (2026-05-21 v2): the v1 classifier was wrong. It treated in-
 * person and email signals as symmetric, putting 62% of estimates in
 * "Uncertain" because reps don't always log Task Completed activities or
 * meeting notes. For RCRS the BUSINESS REALITY is that in-person is the
 * default delivery mode (roofing is a physical sale); email-only is the
 * exception (mostly insurance contingencies signed remotely).
 *
 * --- Probe-verified signal architecture (2026-05-21) ---
 *
 * KEY FIX: "Estimate Sent" activities have primary.id = estimate.jnid and
 * related[] only contains the estimate. Walking activities by contact.id
 * or job.id DOES NOT find them. So we now query activities per estimate
 * jnid directly to catch the "Estimate has been mailed to {email}" event.
 *
 * "Estimate Sent" activities exist at ~30/month per active rep — they're
 * the REAL email signal, not the email/Email record_type which mostly
 * captures vendor orders + automation receipts.
 *
 * --- Classifier: decision tree, in-person as default ---
 *
 * For each estimate, evaluate signals in this order:
 *
 *   1. Hard email evidence:
 *      - sig gap > 24 hours OR
 *      - "Estimate Sent" activity matches this estimate AND no in-person evidence
 *      → CATEGORY 1 (certain emailed)
 *
 *   2. Soft email evidence:
 *      - "Estimate Sent" activity exists (with some in-person evidence too) OR
 *      - signature_status === 'Requested' OR
 *      - signature_status === 'Partially Signed' OR
 *      - sig gap between 2 and 24 hours
 *      → CATEGORY 2 (probably emailed)
 *
 *   3. Hard in-person evidence:
 *      - Task Completed activity within ±3 days of estimate.date_created OR
 *      - Note with meeting keywords within ±7 days OR
 *      - Manual signature (signed without e-sign requested)
 *      → CATEGORY 5 (certain in-person)
 *
 *   4. Soft in-person evidence:
 *      - Task Completed within ±14 days OR
 *      - sig gap ≤ 30 min (likely tablet at customer's home) OR
 *      - signature_status === 'Not Requested' (e-sign workflow not used —
 *        RCRS default is in-person) OR
 *      - estimate note/internal_note contains meeting keywords
 *      → CATEGORY 4 (probably in-person)
 *
 *   5. Otherwise: CATEGORY 3 (genuinely uncertain — should be rare)
 *
 * --- Close rate per bucket ---
 *
 * Per project (job), classify outcome using the same rule as cohort analysis:
 *   WON     — job status_name ≥ Approved Jobs
 *   LOST    — JN status 'Lost' OR pre-Approved with no activity > 60d
 *   PENDING — pre-Approved with recent activity
 *
 * Show both:
 *   trueCloseRate = won ÷ total       (cohort-style)
 *   rawCloseRate  = won ÷ (won + lost) (window-style)
 *
 * Cost-safe: every JN read runs through redactCostFieldsDeep.
 */
import { redactCostFieldsDeep } from './jn-redact';

const JN_KEY = process.env.JOBNIMBUS_API_KEY;
const JN_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

const WON_RE = /^(approved\s*jobs?|materials\s*(ordered|scheduled)|materials\s*ordered\s*\/\s*scheduled|payouts?|pending\s*final\s*payment|pending\s*supplement|pending\s*deprecation|roofer\s*pay\s*needed|job\s*completion\s*form|completion\s*form|paid\s*&\s*closed)$/i;
const LOST_RE = /^lost$/i;
const PRE_APPROVED_RE = /^(lead|aerial\s*measurements|inspection|estimate|pending\s*approval|contingency\s*signed|signed\s*contract)$/i;
const MEETING_KEYWORDS_RE = /\b(met|meeting|visited|visit|inspected|inspection|on.?site|in.?person|stopped\s*by|came\s*out|presented|showed|reviewed.*with|walked.*through)\b/i;

const STALE_DAYS = parseInt(process.env.CHRISVIEW_STALE_DAYS || '60', 10) || 60;

interface JNRelated { id?: string; jnid?: string; type?: string; number?: string }
interface JNEstimate {
  jnid: string;
  number?: string;
  date_created?: number;
  date_estimate?: number;
  date_sign_requested?: number;
  date_signed?: number;
  date_status_change?: number;
  signature_status?: string;
  note?: string;
  internal_note?: string;
  related?: JNRelated[];
  sales_rep_name?: string;
}
interface JNActivity {
  jnid: string;
  record_type_name?: string;
  date_created?: number;
  date_updated?: number;
  date_status_change?: number;
  note?: string;
  created_by_name?: string;
  primary?: { id?: string; type?: string };
  related?: JNRelated[];
}
interface JNJob {
  jnid: string;
  number?: string;
  status_name?: string;
  date_status_change?: number;
  date_updated?: number;
  date_created?: number;
}

async function jnFetch<T>(endpoint: string): Promise<T> {
  if (!JN_KEY) throw new Error('JN key not configured');
  const r = await fetch(`${JN_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${JN_KEY}`, 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw new Error(`JN ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return redactCostFieldsDeep(await r.json(), false) as T;
}

export type DeliveryCategory = 1 | 2 | 3 | 4 | 5;
export const DELIVERY_LABEL: Record<DeliveryCategory, string> = {
  1: 'Certain — emailed only',
  2: 'Probably emailed',
  3: 'Uncertain',
  4: 'Probably presented',
  5: 'Certain — presented in person',
};

export interface DeliveryEstimate {
  estimateJnid: string;
  estimateNumber: string;
  rNumber: string;
  rep: string;
  category: DeliveryCategory;
  /** Plain-English reason for the bucket assignment. */
  classifyReason: string;
  signals: {
    sigGapSeconds: number | null;
    /** Task Completed STRICTLY AFTER estimate creation, within 3 days
     *  (closing-appointment evidence — rep returned to present estimate). */
    taskAfterWithin3d: boolean;
    taskAfterWithin14d: boolean;
    noteMeetingAfter: boolean;
    estimateSentActivity: boolean;
    estimateNoteMeetingMatch: boolean;
    sigStatus: string;
    manualSignature: boolean;
    /** Diagnostic only: a pre-estimate inspection happened. NOT used in
     *  classification — inspection ≠ estimate-presentation. */
    taskBeforeForInspection: boolean;
  };
  outcome: 'won' | 'lost' | 'pending';
  jobStatus: string;
}

export interface DeliveryCategoryRow {
  category: DeliveryCategory;
  label: string;
  count: number;
  won: number;
  lost: number;
  pending: number;
  trueCloseRate: number;
  rawCloseRate: number;
}

export interface DeliverySummary {
  presented: { count: number; won: number; lost: number; pending: number; trueCloseRate: number; rawCloseRate: number };
  emailed:   { count: number; won: number; lost: number; pending: number; trueCloseRate: number; rawCloseRate: number };
  /** difference in trueCloseRate (presented - emailed), positive = in-person wins more. */
  diffTrue: number;
  diffRaw: number;
}

export interface DeliveryAnalysis {
  generatedAt: string;
  windowDays: number;
  totalEstimates: number;
  byCategory: DeliveryCategoryRow[];
  /** Certain only — buckets 5 vs 1, excludes everything else. */
  certainOnly: DeliverySummary;
  /** Including probables — buckets 4+5 vs 1+2, excludes only category 3. */
  includingProbables: DeliverySummary;
  /** Sample of estimates for inspection / spot-checking. */
  sample: DeliveryEstimate[];
  meta: {
    queryTimeMs: number;
    estimatesFetched: number;
    contactsFetched: number;
    jobsFetched: number;
    activitiesFetched: number;
    staleDays: number;
  };
}

function classifyOutcome(job: JNJob | null): 'won' | 'lost' | 'pending' {
  const status = (job?.status_name || '').trim();
  if (LOST_RE.test(status)) return 'lost';
  if (WON_RE.test(status)) return 'won';
  if (PRE_APPROVED_RE.test(status)) {
    const last = Math.max(job?.date_status_change || 0, job?.date_updated || 0, job?.date_created || 0);
    if (last > 0) {
      const ageDays = (Date.now() / 1000 - last) / 86400;
      if (ageDays > STALE_DAYS) return 'lost';
    }
    return 'pending';
  }
  return 'pending';
}

/**
 * V5 classifier — CRITICAL REWORK per Michael 2026-05-21.
 *
 * The question is "was the ESTIMATE PRESENTED in person or just EMAILED?"
 * NOT "did the rep ever visit the property?". Those are different events
 * separated by days or weeks:
 *
 *   - INSPECTION (Task Completed BEFORE estimate)
 *     Rep visits property, measures, takes photos. The estimate is then
 *     written back at the office. Does NOT tell us how the estimate
 *     itself was delivered.
 *
 *   - ESTIMATE PRESENTATION (the actual question)
 *     Either the rep returns to the customer to present the estimate
 *     (in-person), OR they email the PDF and let customer review remotely.
 *
 * So this version ONLY uses AFTER-estimate signals for in-person
 * presentation. Pre-estimate activities are kept as a diagnostic flag
 * (taskBeforeForInspection) but don't drive the bucket.
 *
 * Also dropped: job-status as evidence (jobIsSold etc). That was outcome-
 * leak — using "this job sold" to classify delivery mode then measuring
 * close rate per mode is tautological.
 */
function classifyDelivery(s: {
  sigGap: number | null;
  sigStatus: string;
  taskAfterWithin3d: boolean;
  taskAfterWithin14d: boolean;
  noteMeetingAfter: boolean;
  estimateSentActivity: boolean;
  estimateNoteMeetingMatch: boolean;
  manualSignature: boolean;
  /** Diagnostic only. NOT used in classification. */
  taskBeforeForInspection: boolean;
}): { category: DeliveryCategory; reason: string } {

  // 1. HARD EMAIL
  if (s.sigGap !== null && s.sigGap > 86400) {
    return { category: 1, reason: 'Signed > 24 hours after e-sign request — definitively remote signing' };
  }
  if (s.estimateSentActivity && !s.taskAfterWithin14d && !s.noteMeetingAfter && !s.manualSignature) {
    return { category: 1, reason: '"Estimate Sent" email logged; no follow-up Task Completed, meeting note, or manual signature AFTER estimate creation' };
  }

  // 2. SOFT EMAIL
  if (s.sigStatus === 'Requested' && !s.taskAfterWithin14d && !s.noteMeetingAfter) {
    return { category: 2, reason: 'E-sign request sent (status: Requested), not yet signed, no in-person follow-up after estimate' };
  }
  if (s.sigStatus === 'Partially Signed') {
    return { category: 2, reason: 'Partially signed via e-sign workflow' };
  }
  if (s.sigGap !== null && s.sigGap > 7200 && !s.taskAfterWithin14d) {
    return { category: 2, reason: 'Signed 2–24 hours after e-sign request — likely remote' };
  }

  // 3. HARD IN-PERSON (closing-appointment evidence AFTER estimate)
  if (s.taskAfterWithin3d) {
    return { category: 5, reason: 'Task Completed within 3 days AFTER estimate creation — closing appointment' };
  }
  if (s.noteMeetingAfter) {
    return { category: 5, reason: 'Meeting-keyword note logged AFTER estimate creation — closing visit documented' };
  }
  if (s.manualSignature) {
    return { category: 5, reason: 'Signed without e-sign request — physical/manual signature, presented in person' };
  }

  // 4. SOFT IN-PERSON
  if (s.taskAfterWithin14d) {
    return { category: 4, reason: 'Task Completed within 14 days AFTER estimate — likely closing visit' };
  }
  if (s.sigGap !== null && s.sigGap <= 1800) {
    return { category: 4, reason: 'Signed within 30 min of e-sign request — likely tablet at customer\'s home' };
  }
  if (s.estimateNoteMeetingMatch) {
    return { category: 4, reason: 'Estimate\'s own note mentions a meeting/visit' };
  }

  // 5. UNCERTAIN
  return { category: 3, reason: 'No AFTER-estimate signals (no closing task, no meeting note, no clear sign pattern, no email logged) — cannot determine delivery mode' };
}

let _cache: { key: string; data: DeliveryAnalysis; at: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;
const SHEET_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export async function analyzeEstimateDelivery(opts: { days?: number } = {}): Promise<DeliveryAnalysis> {
  const daysWindow = Math.min(Math.max(opts.days || 180, 30), 730);
  const cacheKey = `days:${daysWindow}`;
  if (_cache && _cache.key === cacheKey && Date.now() - _cache.at < CACHE_TTL_MS) return _cache.data;

  // Sheet-cache fast path for default window
  if (daysWindow === 180) {
    try {
      const { readChrisviewCache } = await import('./chrisview-sheet-cache');
      const cached = await readChrisviewCache<DeliveryAnalysis>('estimate-delivery');
      if (cached) {
        const age = Date.now() - new Date(cached.generatedAt).getTime();
        if (Number.isFinite(age) && age < SHEET_CACHE_MAX_AGE_MS) {
          _cache = { key: cacheKey, data: cached.payload, at: Date.now() };
          return cached.payload;
        }
      }
    } catch (err) {
      console.warn('[estimate-delivery] sheet cache read failed:', err);
    }
  }

  const start = Date.now();
  const nowSec = Math.floor(Date.now() / 1000);
  const since = nowSec - daysWindow * 86400;

  // 1. Pull estimates in window (cap ~2000 — enough for 180-365 days of RCRS volume).
  const estimates: JNEstimate[] = [];
  let estimatesFetched = 0;
  {
    let offset = 0;
    const pageSize = 100;
    while (offset < 2000) {
      const res = await jnFetch<{ results?: JNEstimate[] }>(`/estimates?limit=${pageSize}&offset=${offset}&sort=-date_created`);
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

  // 2. Build unique contact + job sets to walk activities once each.
  const contactIds = new Set<string>();
  const jobIds = new Set<string>();
  for (const est of estimates) {
    const cId = est.related?.find(r => r?.type === 'contact')?.id;
    const jId = est.related?.find(r => r?.type === 'job')?.id;
    if (cId) contactIds.add(cId);
    if (jId) jobIds.add(jId);
  }

  // 3. Walk activities per contact + job. Cache by id. Read both `results` and
  //    `activity` (JN endpoint inconsistency probe-verified 2026-05-21).
  const activitiesByContactId = new Map<string, JNActivity[]>();
  const activitiesByJobId = new Map<string, JNActivity[]>();
  let activitiesFetched = 0;

  async function walkActivities(id: string, isJob: boolean): Promise<JNActivity[]> {
    const target = isJob ? activitiesByJobId : activitiesByContactId;
    if (target.has(id)) return target.get(id)!;
    try {
      const fP = encodeURIComponent(JSON.stringify({ must: [{ term: { 'primary.id': id } }] }));
      const fR = encodeURIComponent(JSON.stringify({ must: [{ term: { 'related.id': id } }] }));
      const [byP, byR] = await Promise.all([
        jnFetch<{ results?: JNActivity[]; activity?: JNActivity[] }>(`/activities?filter=${fP}&sort=-date_created&limit=50`).catch(() => ({ results: [] as JNActivity[], activity: [] as JNActivity[] })),
        jnFetch<{ results?: JNActivity[]; activity?: JNActivity[] }>(`/activities?filter=${fR}&sort=-date_created&limit=50`).catch(() => ({ results: [] as JNActivity[], activity: [] as JNActivity[] })),
      ]);
      const seen = new Set<string>();
      const acts: JNActivity[] = [];
      for (const a of [...(byP.results || byP.activity || []), ...(byR.results || byR.activity || [])]) {
        if (a.jnid && !seen.has(a.jnid)) { seen.add(a.jnid); acts.push(a); }
      }
      activitiesFetched += acts.length;
      target.set(id, acts);
      return acts;
    } catch {
      target.set(id, []);
      return [];
    }
  }

  // 4. Fetch jobs for outcome classification.
  const jobCache = new Map<string, JNJob | null>();
  let jobsFetched = 0;
  const allJobIds = Array.from(jobIds);
  const BATCH = 10;
  for (let i = 0; i < allJobIds.length; i += BATCH) {
    const slice = allJobIds.slice(i, i + BATCH);
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

  // 5. Pre-walk activities for all unique contacts + jobs (parallel batches).
  const allContactIds = Array.from(contactIds);
  for (let i = 0; i < allContactIds.length; i += BATCH) {
    await Promise.all(allContactIds.slice(i, i + BATCH).map(id => walkActivities(id, false)));
  }
  for (let i = 0; i < allJobIds.length; i += BATCH) {
    await Promise.all(allJobIds.slice(i, i + BATCH).map(id => walkActivities(id, true)));
  }
  const contactsFetched = contactIds.size;

  // 5b. Per-estimate "Estimate Sent" lookup — these activities have
  // primary.id = estimate.jnid and DO NOT appear in contact/job activity
  // walks (probe-verified 2026-05-21). Query by estimate id directly.
  const estimateActsByJnid = new Map<string, JNActivity[]>();
  for (let i = 0; i < estimates.length; i += BATCH) {
    const slice = estimates.slice(i, i + BATCH);
    await Promise.all(slice.map(async est => {
      try {
        const f = encodeURIComponent(JSON.stringify({ must: [{ term: { 'primary.id': est.jnid } }] }));
        const res = await jnFetch<{ results?: JNActivity[]; activity?: JNActivity[] }>(`/activities?filter=${f}&sort=-date_created&limit=20`);
        const acts = res.results || res.activity || [];
        activitiesFetched += acts.length;
        estimateActsByJnid.set(est.jnid, acts);
      } catch {
        estimateActsByJnid.set(est.jnid, []);
      }
    }));
  }

  // 6. Score each estimate.
  const scored: DeliveryEstimate[] = [];
  for (const est of estimates) {
    const estCreated = est.date_created || 0;
    if (!estCreated) continue;
    const contactId = est.related?.find(r => r?.type === 'contact')?.id || '';
    const jobId = est.related?.find(r => r?.type === 'job')?.id || '';

    // Aggregate activities for this estimate's contact + job
    const acts = [
      ...(contactId ? activitiesByContactId.get(contactId) || [] : []),
      ...(jobId ? activitiesByJobId.get(jobId) || [] : []),
    ];

    // Signal: sig gap
    const sigReq = est.date_sign_requested || 0;
    const sigSigned = est.date_signed || 0;
    const sigGap = (sigReq > 0 && sigSigned > 0 && sigSigned >= sigReq) ? sigSigned - sigReq : null;

    // V5 SIGNALS — only AFTER-estimate matters for delivery mode.
    // Inspection visits (BEFORE estimate) say nothing about how the
    // estimate itself was delivered.

    // Task Completed STRICTLY AFTER estimate creation → closing appointment.
    const taskAfterWithin3d = acts.some(a => {
      const rtn = (a.record_type_name || '').toLowerCase();
      if (rtn !== 'task completed') return false;
      const ad = a.date_created || 0;
      return ad >= estCreated && ad <= estCreated + 3 * 86400;
    });
    const taskAfterWithin14d = !taskAfterWithin3d && acts.some(a => {
      const rtn = (a.record_type_name || '').toLowerCase();
      if (rtn !== 'task completed') return false;
      const ad = a.date_created || 0;
      return ad >= estCreated && ad <= estCreated + 14 * 86400;
    });
    // Meeting-keyword note STRICTLY AFTER estimate creation.
    const noteMeetingAfter = acts.some(a => {
      const rtn = (a.record_type_name || '').toLowerCase();
      if (rtn !== 'note') return false;
      const ad = a.date_created || 0;
      if (ad < estCreated || ad > estCreated + 14 * 86400) return false;
      return MEETING_KEYWORDS_RE.test(a.note || '');
    });
    // Diagnostic only — pre-estimate inspection happened. Not used to classify.
    const taskBeforeForInspection = acts.some(a => {
      const rtn = (a.record_type_name || '').toLowerCase();
      if (rtn !== 'task completed') return false;
      const ad = a.date_created || 0;
      return ad < estCreated && ad >= estCreated - 60 * 86400;
    });

    // Signal: "Estimate Sent" activity for THIS estimate — query was
    // by estimate.jnid directly (these don't appear in contact/job walks).
    const estActsForThisEstimate = estimateActsByJnid.get(est.jnid) || [];
    const estimateSentActivity = estActsForThisEstimate.some(a =>
      /^estimate sent$/i.test(a.record_type_name || ''),
    );

    // Signal: estimate's own note/internal_note has meeting keywords
    const estimateNoteMeetingMatch = MEETING_KEYWORDS_RE.test(est.note || '') ||
      MEETING_KEYWORDS_RE.test(est.internal_note || '');

    const sigStatus = (est.signature_status || '').trim();
    const manualSignature = sigSigned > 0 && (!sigReq || sigReq === 0);

    // Outcome from the job — used ONLY for close-rate measurement,
    // NOT for delivery classification (v5 dropped that to avoid tautology).
    const job = jobId ? jobCache.get(jobId) || null : null;
    const outcome = classifyOutcome(job);
    const jobStatusRaw = (job?.status_name || '').trim();

    // V5 classifier — AFTER-only signals.
    const { category, reason } = classifyDelivery({
      sigGap,
      sigStatus,
      taskAfterWithin3d,
      taskAfterWithin14d,
      noteMeetingAfter,
      estimateSentActivity,
      estimateNoteMeetingMatch,
      manualSignature,
      taskBeforeForInspection,
    });

    scored.push({
      estimateJnid: est.jnid,
      estimateNumber: est.number || '',
      rNumber: (job?.number || '').trim(),
      rep: (est.sales_rep_name || '').trim(),
      category,
      classifyReason: reason,
      signals: {
        sigGapSeconds: sigGap,
        taskAfterWithin3d,
        taskAfterWithin14d,
        noteMeetingAfter,
        estimateSentActivity,
        estimateNoteMeetingMatch,
        sigStatus,
        manualSignature,
        taskBeforeForInspection,
      },
      outcome,
      jobStatus: jobStatusRaw,
    });
  }

  // 7. Aggregate per category.
  function makeRow(cat: DeliveryCategory): DeliveryCategoryRow {
    const rows = scored.filter(s => s.category === cat);
    const count = rows.length;
    const won = rows.filter(s => s.outcome === 'won').length;
    const lost = rows.filter(s => s.outcome === 'lost').length;
    const pending = count - won - lost;
    const resolved = won + lost;
    return {
      category: cat,
      label: DELIVERY_LABEL[cat],
      count,
      won,
      lost,
      pending,
      trueCloseRate: count > 0 ? Math.round((won / count) * 1000) / 10 : 0,
      rawCloseRate: resolved > 0 ? Math.round((won / resolved) * 1000) / 10 : 0,
    };
  }
  const byCategory: DeliveryCategoryRow[] = [5, 4, 3, 2, 1].map(c => makeRow(c as DeliveryCategory));

  function summarize(presentedCats: DeliveryCategory[], emailedCats: DeliveryCategory[]): DeliverySummary {
    const presented = scored.filter(s => presentedCats.includes(s.category));
    const emailed = scored.filter(s => emailedCats.includes(s.category));
    function totals(rows: DeliveryEstimate[]) {
      const count = rows.length;
      const won = rows.filter(s => s.outcome === 'won').length;
      const lost = rows.filter(s => s.outcome === 'lost').length;
      const pending = count - won - lost;
      const resolved = won + lost;
      return {
        count, won, lost, pending,
        trueCloseRate: count > 0 ? Math.round((won / count) * 1000) / 10 : 0,
        rawCloseRate: resolved > 0 ? Math.round((won / resolved) * 1000) / 10 : 0,
      };
    }
    const p = totals(presented);
    const e = totals(emailed);
    return { presented: p, emailed: e, diffTrue: Math.round((p.trueCloseRate - e.trueCloseRate) * 10) / 10, diffRaw: Math.round((p.rawCloseRate - e.rawCloseRate) * 10) / 10 };
  }

  const certainOnly = summarize([5], [1]);
  const includingProbables = summarize([4, 5], [1, 2]);

  // 8. Cap sample to 100 most-recent for the inspection table
  const sample = [...scored]
    .sort((a, b) => 0) // already in newest-first order from estimate pull
    .slice(0, 100);

  const result: DeliveryAnalysis = {
    generatedAt: new Date().toISOString().slice(0, 10),
    windowDays: daysWindow,
    totalEstimates: scored.length,
    byCategory,
    certainOnly,
    includingProbables,
    sample,
    meta: {
      queryTimeMs: Date.now() - start,
      estimatesFetched,
      contactsFetched,
      jobsFetched,
      activitiesFetched,
      staleDays: STALE_DAYS,
    },
  };

  _cache = { key: cacheKey, data: result, at: Date.now() };
  return result;
}
