/**
 * Estimate Delivery Analysis — emailed vs presented in-person, close rate per delivery mode.
 *
 * Per Michael (2026-05-21):
 *   Five certainty buckets ranging from CERTAIN-EMAILED to CERTAIN-PRESENTED.
 *   Show close rate per bucket. Then two summaries:
 *     - Certain-only (bucket 1 vs bucket 5)
 *     - Including-probables (1+2 vs 4+5)
 *   Accuracy more important than speed.
 *
 * --- Signals (probe-verified 2026-05-21 against ~1000 JN estimates) ---
 *
 * STRONGEST signal: `signature_status` + gap between date_sign_requested
 * and date_signed:
 *   - 260 of 1000 estimates are "Fully Signed" with both timestamps populated
 *   - Of those, 171 (66%) were signed within 5 MINUTES of the e-sign request
 *     → very likely the rep was sitting next to the customer on a tablet
 *   - Only 21 (8%) were signed > 24 hours later → genuinely remote/email signing
 *
 * NEXT-STRONGEST: activity feed on the contact + related jobs
 *   - "Task Completed" activity within ±3 days of the estimate's date_created
 *     → strong evidence a physical visit happened around the estimate event
 *   - Notes mentioning met / visited / inspected / on-site / in-person /
 *     stopped by / came out / presented / showed → moderate evidence
 *
 * AUXILIARY: "Estimate Sent" record_type_name activity → confirms an email
 *   was actually sent through JN (rather than just the html field being
 *   populated, which doesn't prove sending).
 *
 * --- Scoring (each signal awards points to its side; net diff → bucket) ---
 *
 * IN-PERSON points (max ~5 useful):
 *   +3  sig gap <= 5 minutes (within-arm-reach signature)
 *   +2  sig gap 5–30 minutes
 *   +3  Task Completed activity within ±3 days of estimate.date_created
 *   +1  Task Completed within ±14 days (loose match)
 *   +2  Note (record_type='Note') within ±7 days of estimate with meeting keywords
 *   +2  date_signed populated AND date_sign_requested empty (manual signature mark)
 *   +1  estimate's own note/internal_note contains meeting keywords
 *
 * EMAIL points (max ~5 useful):
 *   +3  sig gap > 24 hours (definitively remote signing)
 *   +2  sig gap 2–24 hours (likely remote)
 *   +2  signature_status === 'Requested' (e-sign sent, not yet signed)
 *   +1  signature_status === 'Partially Signed' (some signers via e-sign)
 *   +3  any "Estimate Sent" activity referencing this estimate's jnid
 *   +1  date_sign_requested populated AND no Task Completed in window
 *
 * --- Bucket logic ---
 *   net = inPoints - outPoints
 *
 *   net >=  3  →  5  CERTAIN PRESENTED IN PERSON
 *   net   1–2  →  4  PROBABLY PRESENTED
 *   net     0  →  3  UNCERTAIN
 *   net  -1–-2 →  2  PROBABLY EMAILED
 *   net <= -3  →  1  CERTAIN EMAILED
 *
 * --- Close rate per bucket ---
 *   Per project (job), classify outcome using the same rule the cohort
 *   analysis uses:
 *     WON     — job status_name ≥ Approved Jobs
 *     LOST    — JN status 'Lost' OR pre-Approved with no activity >60d
 *     PENDING — pre-Approved with recent activity
 *
 *   Show both:
 *     trueCloseRate = won ÷ total          (cohort-style, matures right)
 *     rawCloseRate  = won ÷ (won + lost)  (window-style, looks high)
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
  inPoints: number;
  outPoints: number;
  netScore: number;
  category: DeliveryCategory;
  signals: {
    sigGapSeconds: number | null;
    taskWithin3d: boolean;
    taskWithin14d: boolean;
    noteMeetingMatch: boolean;
    estimateSentActivity: boolean;
    estimateNoteMeetingMatch: boolean;
    sigStatus: string;
    manualSignature: boolean;
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

function bucketForNet(net: number): DeliveryCategory {
  if (net >= 3) return 5;
  if (net >= 1) return 4;
  if (net === 0) return 3;
  if (net >= -2) return 2;
  return 1;
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

    // Signal: Task Completed near estimate.date_created
    const taskWithin3d = acts.some(a => {
      const rtn = (a.record_type_name || '').toLowerCase();
      if (rtn !== 'task completed') return false;
      const ad = a.date_created || 0;
      return Math.abs(ad - estCreated) <= 3 * 86400;
    });
    const taskWithin14d = !taskWithin3d && acts.some(a => {
      const rtn = (a.record_type_name || '').toLowerCase();
      if (rtn !== 'task completed') return false;
      const ad = a.date_created || 0;
      return Math.abs(ad - estCreated) <= 14 * 86400;
    });

    // Signal: meeting-mentioning note within ±7 days
    const noteMeetingMatch = acts.some(a => {
      const rtn = (a.record_type_name || '').toLowerCase();
      if (rtn !== 'note') return false;
      const ad = a.date_created || 0;
      if (Math.abs(ad - estCreated) > 7 * 86400) return false;
      return MEETING_KEYWORDS_RE.test(a.note || '');
    });

    // Signal: "Estimate Sent" activity referencing this estimate
    const estimateSentActivity = acts.some(a => {
      const rtn = (a.record_type_name || '').toLowerCase();
      if (rtn !== 'estimate sent') return false;
      // Check if this Estimate Sent references our estimate by jnid
      const refsThis = a.primary?.id === est.jnid ||
        (a.related || []).some(r => r?.id === est.jnid);
      return refsThis;
    });

    // Signal: estimate's own note/internal_note has meeting keywords
    const estimateNoteMeetingMatch = MEETING_KEYWORDS_RE.test(est.note || '') ||
      MEETING_KEYWORDS_RE.test(est.internal_note || '');

    const sigStatus = (est.signature_status || '').trim();
    const manualSignature = sigSigned > 0 && (!sigReq || sigReq === 0);

    // --- Score ---
    let inPoints = 0;
    let outPoints = 0;

    // IN-PERSON
    if (sigGap !== null && sigGap <= 300) inPoints += 3;          // <= 5 min
    else if (sigGap !== null && sigGap <= 1800) inPoints += 2;    // 5-30 min
    if (taskWithin3d) inPoints += 3;
    else if (taskWithin14d) inPoints += 1;
    if (noteMeetingMatch) inPoints += 2;
    if (manualSignature) inPoints += 2;
    if (estimateNoteMeetingMatch) inPoints += 1;

    // EMAIL
    if (sigGap !== null && sigGap > 86400) outPoints += 3;         // > 24 hr
    else if (sigGap !== null && sigGap > 7200) outPoints += 2;    // 2-24 hr
    if (sigStatus === 'Requested') outPoints += 2;
    if (sigStatus === 'Partially Signed') outPoints += 1;
    if (estimateSentActivity) outPoints += 3;
    if (sigReq > 0 && !taskWithin3d && !taskWithin14d) outPoints += 1;

    const netScore = inPoints - outPoints;
    const category = bucketForNet(netScore);

    // Outcome from the job
    const job = jobId ? jobCache.get(jobId) || null : null;
    const outcome = classifyOutcome(job);

    scored.push({
      estimateJnid: est.jnid,
      estimateNumber: est.number || '',
      rNumber: (job?.number || '').trim(),
      rep: (est.sales_rep_name || '').trim(),
      inPoints,
      outPoints,
      netScore,
      category,
      signals: {
        sigGapSeconds: sigGap,
        taskWithin3d,
        taskWithin14d,
        noteMeetingMatch,
        estimateSentActivity,
        estimateNoteMeetingMatch,
        sigStatus,
        manualSignature,
      },
      outcome,
      jobStatus: (job?.status_name || '').trim(),
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
