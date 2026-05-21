/**
 * Deep Funnel Analysis (lead → estimate → sold → paid).
 *
 * For each office-created lead in window:
 *   - Pull contact + every related job + every activity on both
 *   - Compute first-rep-action (any non-automation by a sales rep)
 *   - Detect what happened AFTER a status change (call? appt? note?)
 *   - Time to estimate sent (first activity type=Estimate or status=Estimate Sent)
 *   - Time to signed contract
 *   - Time to paid in full
 *   - Trips to house (completed Appointment activities)
 *   - Estimate-delivery certainty:
 *       HIGH "in_person": completed appt logged within 24h BEFORE estimate sent
 *       PROBABLE "in_person": note mentions met/visited/inspected/onsite before estimate
 *       HIGH "online": estimate sent + no appt/visit note before it
 *       UNKNOWN: not enough signal
 *   - Close rate by certainty × rep × method
 *
 * Cost-safe: all JN responses run through redactCostFieldsDeep. Output
 * never reads cost fields.
 */
import { redactCostFieldsDeep } from './jn-redact';

const JN_KEY = process.env.JOBNIMBUS_API_KEY;
const JN_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

const OFFICE_STAFF = [
  'sara hill', 'destin mccary', 'destin mc cary', 'tia muse morris', 'tia morris', 'tia muse',
  'boston', 'office',
];
const SYSTEM_AUTHORS_RE = /system|automation|webhook|portal|jobnimbus\b|^api\b|^email$/i;

function isOffice(name: string): boolean {
  const lower = (name || '').toLowerCase().trim();
  return OFFICE_STAFF.some(s => lower === s || lower.includes(s));
}
function isSystemAuthor(name: string): boolean {
  return SYSTEM_AUTHORS_RE.test(name || '');
}
function isManualByRep(a: { record_type_name?: string; created_by_name?: string }): boolean {
  const author = (a.created_by_name || '').trim();
  if (!author) return false;
  if (isOffice(author)) return false;
  if (isSystemAuthor(author)) return false;
  const type = (a.record_type_name || '').trim();
  // Real first-contact / engagement actions by a rep
  // Excluding pure assignment events
  if (/^(Contact Created|Assigned Contact|Job Created|Assigned Job|Related to job|Unassigned|Contact Modified|Job Modified|Attachment deleted|Attachment Added|Document Added|Status Changed)$/i.test(type)) return false;
  return true;
}

async function jnFetch<T>(endpoint: string): Promise<T> {
  if (!JN_KEY) throw new Error('JN key not configured');
  const r = await fetch(`${JN_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${JN_KEY}`, 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw new Error(`JN ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return redactCostFieldsDeep(await r.json(), false) as T;
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
  primary?: { id?: string };
  related?: Array<{ id?: string }>;
}
interface JNJob {
  jnid: string; number?: string; status_name?: string; sales_rep_name?: string;
  insurance_company?: string; insurance_company_name?: string; claim_number?: string;
  date_created?: number; date_status_change?: number; primary?: { id?: string };
}
interface JNContact {
  jnid: string; first_name?: string; last_name?: string; display_name?: string;
  date_created?: number; created_by_name?: string; sales_rep_name?: string;
  source_name?: string; status_name?: string;
}
interface JNEstimate {
  jnid: string; status_name?: string; date_created?: number; date_status_change?: number;
  primary?: { id?: string }; related?: Array<{ id?: string }>; sales_rep_name?: string;
}
interface JNInvoice {
  jnid: string; total?: number; amount_paid?: number; balance?: number;
  date_created?: number; date_paid?: number; status?: string; related?: Array<{ id?: string }>;
}

const SIGNED_RE = /signed|contract|contingency|approved|sold|won|paid|installed|complete|closed/i;

export type EstimateCertainty = 'in_person_high' | 'in_person_probable' | 'online_high' | 'online_probable' | 'unknown';

export interface FunnelLead {
  contactJnid: string;
  contactName: string;
  rep: string;
  createdAt: string;
  createdBy: string;
  source: string;
  jobNumber: string;
  jobStatus: string;
  isInsurance: boolean;
  carrier: string;
  // Response
  firstRepActionAt: string | null;
  firstRepActionType: string | null;
  responseMinutes: number | null;
  // Subsequent flow
  statusChangeFollowups: Array<{ statusChangeAt: string; followupType: string | null; followupAt: string | null; followupMins: number | null }>;
  // Estimate
  estimateSentAt: string | null;
  daysToEstimate: number | null;
  estimateCertainty: EstimateCertainty;
  estimateEvidence: string[];
  signedAt: string | null;
  daysToSigned: number | null;
  paidAt: string | null;
  daysToPaid: number | null;
  trips: number;
  signed: boolean;
  paid: boolean;
}

export interface FunnelAnalysis {
  generatedAt: string;
  windowDays: number;
  totalLeads: number;
  responded: number;
  responseRate: number;
  byRep: Array<{
    rep: string; leads: number; responded: number;
    medianResponseMin: number | null;
    medianDaysToEstimate: number | null;
    medianDaysToSigned: number | null;
    medianDaysToPaid: number | null;
    avgTrips: number;
    closeRate: number;
  }>;
  byMethod: Array<{
    method: string; leads: number; signed: number; closeRate: number;
    medianDaysToSigned: number | null;
  }>;
  closeByCertainty: Array<{ certainty: EstimateCertainty; leads: number; signed: number; closeRate: number; medianDaysSignedAfterEstimate: number | null }>;
  closeByTrips: Array<{ tripBucket: string; leads: number; signed: number; closeRate: number }>;
  leads: FunnelLead[];
  meta: { queryTimeMs: number; contactsFetched: number; activitiesFetched: number; jobsFetched: number; estimatesFetched: number; invoicesFetched: number };
}

let _cache: { key: string; data: FunnelAnalysis; at: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;
// Accept a sheet-cache row up to 90 min old (one missed cron tick).
const SHEET_CACHE_MAX_AGE_MS = 90 * 60 * 1000;

export async function analyzeDeepFunnel(opts: { days?: number } = {}): Promise<FunnelAnalysis> {
  const daysWindow = Math.min(opts.days || 30, 365);
  const cacheKey = `days:${daysWindow}`;
  if (_cache && _cache.key === cacheKey && Date.now() - _cache.at < CACHE_TTL_MS) return _cache.data;

  // Try the precomputed sheet cache before paying for live JN walks.
  // Only applied to the default 30-day window — custom windows aren't precomputed.
  if (daysWindow === 30) {
    try {
      const { readChrisviewCache } = await import('./chrisview-sheet-cache');
      const cached = await readChrisviewCache<FunnelAnalysis>('funnel');
      if (cached) {
        const age = Date.now() - new Date(cached.generatedAt).getTime();
        if (Number.isFinite(age) && age < SHEET_CACHE_MAX_AGE_MS) {
          _cache = { key: cacheKey, data: cached.payload, at: Date.now() };
          return cached.payload;
        }
      }
    } catch (err) {
      // Sheet cache is best-effort — fall through to live compute on any failure.
      console.warn('[jn-deep-funnel] sheet cache read failed:', err);
    }
  }

  const start = Date.now();
  const since = Math.floor(Date.now() / 1000) - daysWindow * 86400;

  // 1. Pull contacts
  const contacts: JNContact[] = [];
  let offset = 0;
  let contactsFetched = 0;
  while (offset < 3000) {
    const res = await jnFetch<{ count?: number; results?: JNContact[] }>(`/contacts?limit=100&offset=${offset}&sort=-date_created`);
    const page = res.results || [];
    if (!page.length) break;
    contactsFetched += page.length;
    let outOfRange = false;
    for (const c of page) {
      if ((c.date_created || 0) < since) { outOfRange = true; break; }
      if (!isOffice(c.created_by_name || '')) continue;
      if (!c.sales_rep_name) continue;
      const src = (c.source_name || '').toLowerCase();
      if (src.includes('referral') || src.includes('personal')) continue;
      contacts.push(c);
    }
    if (outOfRange) break;
    offset += 100;
  }

  let activitiesFetched = 0;
  let jobsFetched = 0;
  let estimatesFetched = 0;
  let invoicesFetched = 0;

  const leads: FunnelLead[] = [];

  for (const c of contacts) {
    // Activities by primary + related
    const [actP, actR] = await Promise.all([
      jnFetch<{ results?: JNActivity[]; activity?: JNActivity[] }>(`/activities?filter=${encodeURIComponent(JSON.stringify({ must: [{ term: { 'primary.id': c.jnid } }] }))}&sort=date_created&limit=100`).catch(() => ({ results: [] as JNActivity[], activity: [] as JNActivity[] })),
      jnFetch<{ results?: JNActivity[]; activity?: JNActivity[] }>(`/activities?filter=${encodeURIComponent(JSON.stringify({ must: [{ term: { 'related.id': c.jnid } }] }))}&sort=date_created&limit=100`).catch(() => ({ results: [] as JNActivity[], activity: [] as JNActivity[] })),
    ]);
    const seenAct = new Set<string>();
    const allActs: JNActivity[] = [];
    for (const a of [...(actP.results || actP.activity || []), ...(actR.results || actR.activity || [])]) {
      if (a.jnid && !seenAct.has(a.jnid)) { seenAct.add(a.jnid); allActs.push(a); }
    }
    activitiesFetched += allActs.length;

    // Jobs
    const jobsRes = await jnFetch<{ results?: JNJob[] }>(`/jobs?filter=${encodeURIComponent(JSON.stringify({ must: [{ term: { 'primary.id': c.jnid } }] }))}&limit=10`).catch(() => ({ results: [] }));
    const jobs = jobsRes.results || [];
    jobsFetched += jobs.length;
    const job = jobs[0];
    const carrier = String(job?.insurance_company_name || job?.insurance_company || '').trim();
    const isInsurance = !!(carrier || job?.claim_number);

    // Job activities + estimates + invoices
    for (const j of jobs) {
      const [jp, jr] = await Promise.all([
        jnFetch<{ results?: JNActivity[]; activity?: JNActivity[] }>(`/activities?filter=${encodeURIComponent(JSON.stringify({ must: [{ term: { 'primary.id': j.jnid } }] }))}&sort=date_created&limit=100`).catch(() => ({ results: [] as JNActivity[], activity: [] as JNActivity[] })),
        jnFetch<{ results?: JNActivity[]; activity?: JNActivity[] }>(`/activities?filter=${encodeURIComponent(JSON.stringify({ must: [{ term: { 'related.id': j.jnid } }] }))}&sort=date_created&limit=100`).catch(() => ({ results: [] as JNActivity[], activity: [] as JNActivity[] })),
      ]);
      // JN's /activities endpoint uses `activity` (singular) not `results`.
      const jpActs = jp.results || jp.activity || [];
      const jrActs = jr.results || jr.activity || [];
      for (const a of [...jpActs, ...jrActs]) {
        if (a.jnid && !seenAct.has(a.jnid)) { seenAct.add(a.jnid); allActs.push(a); }
      }
      activitiesFetched += jpActs.length + jrActs.length;
    }

    // Pull estimates for this contact
    // JN indexes /estimates by `related.id`, NOT `primary.id`. Probe-verified
    // 2026-05-21: primary.id returns count=0, related.id returns matching estimates.
    const estRes = await jnFetch<{ results?: JNEstimate[] }>(`/estimates?filter=${encodeURIComponent(JSON.stringify({ must: [{ term: { 'related.id': c.jnid } }] }))}&sort=date_created&limit=20`).catch(() => ({ results: [] }));
    const estimates = estRes.results || [];
    estimatesFetched += estimates.length;
    const firstEst = estimates[0];

    // Pull invoices for the job
    let invs: JNInvoice[] = [];
    if (job) {
      const invRes = await jnFetch<{ results?: JNInvoice[] }>(`/invoices?filter=${encodeURIComponent(JSON.stringify({ must: [{ term: { 'related.id': job.jnid } }] }))}&limit=20`).catch(() => ({ results: [] }));
      invs = invRes.results || [];
      invoicesFetched += invs.length;
    }

    allActs.sort((a, b) => (a.date_created || 0) - (b.date_created || 0));

    // First rep action after lead created
    const firstRepAct = allActs.find(a =>
      isManualByRep(a) && (a.date_created || 0) > (c.date_created || 0),
    );

    // Status change followups
    const statusChanges = allActs.filter(a => (a.record_type_name || '') === 'Status Changed' && (a.date_created || 0) > (c.date_created || 0));
    const statusChangeFollowups: FunnelLead['statusChangeFollowups'] = [];
    for (const sc of statusChanges) {
      const nextAction = allActs.find(a =>
        (a.date_created || 0) > (sc.date_created || 0) &&
        isManualByRep(a),
      );
      statusChangeFollowups.push({
        statusChangeAt: new Date((sc.date_created || 0) * 1000).toISOString(),
        followupType: nextAction?.record_type_name || null,
        followupAt: nextAction ? new Date((nextAction.date_created || 0) * 1000).toISOString() : null,
        followupMins: nextAction?.date_created && sc.date_created
          ? Math.round((nextAction.date_created - sc.date_created) / 60)
          : null,
      });
    }

    // Estimate sent timestamp
    const estimateSentAt = firstEst?.date_created || null;

    // Estimate delivery certainty
    let certainty: EstimateCertainty = 'unknown';
    const evidence: string[] = [];
    if (estimateSentAt) {
      const before = allActs.filter(a => (a.date_created || 0) < estimateSentAt);
      const completedApptBefore = before.find(a =>
        /appointment|appt|visit|inspection/i.test(a.record_type_name || '') &&
        /completed|done|complete/i.test(a.status || '') &&
        estimateSentAt - (a.date_created || 0) < 7 * 86400, // within 7 days
      );
      const meetingNoteBefore = before.find(a =>
        (a.record_type_name || '') === 'Note' &&
        /\b(met|meeting|visited|inspection|inspected|in.person|on.site|stopped by|came out|presented)\b/i.test(a.note || ''),
      );
      if (completedApptBefore) {
        certainty = 'in_person_high';
        evidence.push(`Completed appt ${new Date((completedApptBefore.date_created || 0) * 1000).toISOString().slice(0, 10)} before estimate ${new Date(estimateSentAt * 1000).toISOString().slice(0, 10)}`);
      } else if (meetingNoteBefore) {
        certainty = 'in_person_probable';
        evidence.push(`Meeting note: "${(meetingNoteBefore.note || '').slice(0, 80)}"`);
      } else {
        // No before-estimate touch — likely just emailed
        // High certainty online only if there's clear evidence of email send
        const emailRecord = allActs.find(a => /email/i.test(a.record_type_name || '') && (a.date_created || 0) >= estimateSentAt - 86400 && (a.date_created || 0) <= estimateSentAt + 86400);
        if (emailRecord) {
          certainty = 'online_high';
          evidence.push('Email activity within ±24h of estimate sent');
        } else {
          certainty = 'online_probable';
          evidence.push('No meeting note or appt before estimate — assumed online');
        }
      }
    }

    // Signed detection — from estimate status OR job status
    const signedEst = estimates.find(e => SIGNED_RE.test(e.status_name || ''));
    const isJobSigned = SIGNED_RE.test(job?.status_name || '');
    const signedAt = signedEst?.date_status_change || (isJobSigned ? (job?.date_status_change || job?.date_created) : null) || null;
    const signed = !!signedAt;

    // Paid detection — from invoices
    const totalAmt = invs.reduce((s, i) => s + (Number(i.total) || 0), 0);
    const balance = invs.reduce((s, i) => s + (Number(i.balance) || 0), 0);
    const fullyPaid = totalAmt > 0 && Math.abs(balance) < 1;
    const paidAt = fullyPaid ? Math.max(...invs.map(i => i.date_paid || 0)) || null : null;

    // Trips
    const trips = allActs.filter(a =>
      /appointment|appt/i.test(a.record_type_name || '') &&
      /completed|done|complete/i.test(a.status || '')
    ).length;

    const responseMins = firstRepAct?.date_created && c.date_created
      ? Math.round((firstRepAct.date_created - c.date_created) / 60)
      : null;

    leads.push({
      contactJnid: c.jnid,
      contactName: c.display_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.jnid,
      rep: (c.sales_rep_name || '').trim(),
      createdAt: new Date((c.date_created || 0) * 1000).toISOString(),
      createdBy: c.created_by_name || '',
      source: c.source_name || '',
      jobNumber: job?.number || '',
      jobStatus: job?.status_name || c.status_name || '',
      isInsurance,
      carrier,
      firstRepActionAt: firstRepAct?.date_created ? new Date(firstRepAct.date_created * 1000).toISOString() : null,
      firstRepActionType: firstRepAct?.record_type_name || null,
      responseMinutes: responseMins,
      statusChangeFollowups,
      estimateSentAt: estimateSentAt ? new Date(estimateSentAt * 1000).toISOString() : null,
      daysToEstimate: estimateSentAt && c.date_created
        ? Math.round(((estimateSentAt - c.date_created) / 86400) * 10) / 10
        : null,
      estimateCertainty: certainty,
      estimateEvidence: evidence,
      signedAt: signedAt ? new Date(signedAt * 1000).toISOString() : null,
      daysToSigned: signedAt && c.date_created
        ? Math.round(((signedAt - c.date_created) / 86400) * 10) / 10
        : null,
      paidAt: paidAt ? new Date(paidAt * 1000).toISOString() : null,
      daysToPaid: paidAt && c.date_created
        ? Math.round(((paidAt - c.date_created) / 86400) * 10) / 10
        : null,
      trips,
      signed,
      paid: fullyPaid,
    });
  }

  // Aggregates
  function median(arr: number[]): number | null {
    const v = arr.filter(x => x != null && Number.isFinite(x));
    if (!v.length) return null;
    v.sort((a, b) => a - b);
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2 * 10) / 10;
  }

  const byRepMap = new Map<string, FunnelLead[]>();
  for (const l of leads) {
    const k = l.rep || '(unassigned)';
    if (!byRepMap.has(k)) byRepMap.set(k, []);
    byRepMap.get(k)!.push(l);
  }
  const byRep = Array.from(byRepMap.entries()).map(([rep, ls]) => ({
    rep,
    leads: ls.length,
    responded: ls.filter(l => l.firstRepActionAt).length,
    medianResponseMin: median(ls.map(l => l.responseMinutes).filter((x): x is number => x != null)),
    medianDaysToEstimate: median(ls.map(l => l.daysToEstimate).filter((x): x is number => x != null)),
    medianDaysToSigned: median(ls.map(l => l.daysToSigned).filter((x): x is number => x != null)),
    medianDaysToPaid: median(ls.map(l => l.daysToPaid).filter((x): x is number => x != null)),
    avgTrips: ls.length > 0 ? Math.round((ls.reduce((s, l) => s + l.trips, 0) / ls.length) * 10) / 10 : 0,
    closeRate: ls.length > 0 ? Math.round((ls.filter(l => l.signed).length / ls.length) * 1000) / 10 : 0,
  })).sort((a, b) => b.leads - a.leads);

  const byMethodMap = new Map<string, FunnelLead[]>();
  for (const l of leads) {
    const k = l.firstRepActionType || 'no-contact';
    if (!byMethodMap.has(k)) byMethodMap.set(k, []);
    byMethodMap.get(k)!.push(l);
  }
  const byMethod = Array.from(byMethodMap.entries()).map(([method, ls]) => ({
    method,
    leads: ls.length,
    signed: ls.filter(l => l.signed).length,
    closeRate: ls.length > 0 ? Math.round((ls.filter(l => l.signed).length / ls.length) * 1000) / 10 : 0,
    medianDaysToSigned: median(ls.map(l => l.daysToSigned).filter((x): x is number => x != null)),
  })).sort((a, b) => b.leads - a.leads);

  const byCertaintyMap = new Map<EstimateCertainty, FunnelLead[]>();
  for (const l of leads) {
    if (l.estimateCertainty === 'unknown' && !l.estimateSentAt) continue; // skip leads without an estimate
    if (!byCertaintyMap.has(l.estimateCertainty)) byCertaintyMap.set(l.estimateCertainty, []);
    byCertaintyMap.get(l.estimateCertainty)!.push(l);
  }
  const closeByCertainty = Array.from(byCertaintyMap.entries()).map(([certainty, ls]) => ({
    certainty,
    leads: ls.length,
    signed: ls.filter(l => l.signed).length,
    closeRate: ls.length > 0 ? Math.round((ls.filter(l => l.signed).length / ls.length) * 1000) / 10 : 0,
    medianDaysSignedAfterEstimate: median(
      ls.map(l => {
        if (!l.signedAt || !l.estimateSentAt) return null;
        return (new Date(l.signedAt).getTime() - new Date(l.estimateSentAt).getTime()) / 86400000;
      }).filter((x): x is number => x != null),
    ),
  }));

  function tripBucket(n: number) {
    if (n === 0) return '0 trips';
    if (n === 1) return '1 trip';
    if (n <= 3) return '2-3 trips';
    if (n <= 5) return '4-5 trips';
    return '6+ trips';
  }
  const tripMap = new Map<string, FunnelLead[]>();
  for (const l of leads) {
    const k = tripBucket(l.trips);
    if (!tripMap.has(k)) tripMap.set(k, []);
    tripMap.get(k)!.push(l);
  }
  const closeByTrips = Array.from(tripMap.entries()).map(([tripBucket, ls]) => ({
    tripBucket,
    leads: ls.length,
    signed: ls.filter(l => l.signed).length,
    closeRate: ls.length > 0 ? Math.round((ls.filter(l => l.signed).length / ls.length) * 1000) / 10 : 0,
  })).sort((a, b) => {
    const order = ['0 trips', '1 trip', '2-3 trips', '4-5 trips', '6+ trips'];
    return order.indexOf(a.tripBucket) - order.indexOf(b.tripBucket);
  });

  const responded = leads.filter(l => l.firstRepActionAt).length;
  const responseRate = leads.length > 0 ? Math.round((responded / leads.length) * 1000) / 10 : 0;

  const result: FunnelAnalysis = {
    generatedAt: new Date().toISOString().slice(0, 10),
    windowDays: daysWindow,
    totalLeads: leads.length,
    responded,
    responseRate,
    byRep,
    byMethod,
    closeByCertainty,
    closeByTrips,
    leads,
    meta: { queryTimeMs: Date.now() - start, contactsFetched, activitiesFetched, jobsFetched, estimatesFetched, invoicesFetched },
  };

  _cache = { key: cacheKey, data: result, at: Date.now() };
  return result;
}
