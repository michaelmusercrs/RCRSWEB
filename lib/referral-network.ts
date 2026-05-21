/**
 * Referral Network Analysis (chrisview).
 *
 * Surfaces which leads come through referrals — explicit "Referral" /
 * "Customer Referral" source tags, person-shaped source names (someone's
 * customer who refers their neighbor), and "referred by NAME" patterns
 * embedded in the contact description / notes.
 *
 * For each contact in JN over the chosen window:
 *   - source_name (or first non-empty alternative)
 *   - bucket into: explicit referral / person-name referral / other
 *   - if a referrer name is extractable, attribute the lead to that person
 *   - did the contact convert to a signed job?
 *   - dollar value of the resulting signed job (best-effort: job total /
 *     approved_invoice_total / approved_estimate_total — falls back to 0
 *     when JN doesn't surface a number)
 *
 * Rollups:
 *   - Per rep: how many of their leads were referral-sourced + downstream
 *     signed count + referral revenue
 *   - Per referrer person: leads sent, how many signed, total revenue,
 *     most recent activity
 *   - Per source bucket: count + signed count + close %
 *
 * Honesty: not every "referred by" string in notes parses cleanly. The
 * page surfaces the `unmatchedReferrerCount` so Chris knows what slice
 * of the referrals could not be attributed to a specific person.
 *
 * Cost-privacy: every JN response runs through redactCostFieldsDeep.
 * Sheet-cache slug: 'referral-network'.
 */
import { redactCostFieldsDeep } from './jn-redact';

const JN_API_KEY = process.env.JOBNIMBUS_API_KEY;
const JN_API_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

interface JNContact {
  jnid: string;
  date_created?: number;
  source_name?: string;
  source?: string;
  sales_rep_name?: string;
  status_name?: string;
  description?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  customer_note?: string;
  notes?: string;
}

interface JNJob {
  jnid: string;
  status_name?: string;
  date_status_change?: number;
  date_created?: number;
  primary?: { id?: string };
  sales_rep_name?: string;
  total?: number;
  approved_invoice_total?: number;
  approved_estimate_total?: number;
  rcv?: number;
  acv?: number;
  [k: string]: unknown;
}

const SIGNED_RE = /signed|contract|contingency|approved|sold|won|paid|installed|complete/i;

// Explicit referral source-name patterns
const EXPLICIT_REFERRAL_RE = /\b(referr?al|word.of.mouth|friend|neighbor|family)\b/i;
// "Customer Referral" / "Past Customer" / "Repeat customer"
const CUSTOMER_REFERRAL_RE = /customer\s+referr?al|past\s+customer|repeat/i;
// BNI / networking groups
const BNI_RE = /\bbni\b|networking|chamber|rotary/i;
// Channels that are NOT referrals (used to exclude when the source is a
// known marketing/lead-aggregator channel)
const NON_REFERRAL_SOURCES = /google|facebook|instagram|website|web\s*form|yelp|angi|home\s*advisor|thumbtack|nextdoor|sign|truck|door.knock|canvass|email|mailer|tv|radio|billboard/i;

// Pattern: a source name that looks like a person ("First Last") rather
// than a channel. Two words, both Title Case, no digits.
const PERSON_NAME_RE = /^[A-Z][a-z'.-]+(?:\s+[A-Z][a-z'.-]+){1,3}$/;

// "referred by NAME" extraction from description / notes. NAME is 1-4
// title-case words. We intentionally stop at punctuation, line breaks,
// and lowercase glue words ("and", "from") so we don't suck in a whole
// sentence.
const REFERRED_BY_RE = /referr?ed\s+by[:\s]+([A-Z][a-z'.-]+(?:\s+[A-Z][a-z'.-]+){0,3})/i;

function jnFetch<T>(endpoint: string): Promise<T> {
  if (!JN_API_KEY) throw new Error('JobNimbus API key not configured');
  return fetch(`${JN_API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${JN_API_KEY}`, 'Content-Type': 'application/json' },
  }).then(async r => {
    if (!r.ok) throw new Error(`JN ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return redactCostFieldsDeep(await r.json(), false) as T;
  });
}

function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s'.-]/g, '')
    .toLowerCase();
}

function titleCase(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function jobRevenue(j: JNJob | undefined): number {
  if (!j) return 0;
  // Try a sequence of likely fields. Numbers come back as numbers OR strings
  // depending on JN endpoint quirks, so coerce defensively.
  const candidates = [
    j.approved_invoice_total,
    j.approved_estimate_total,
    j.total,
    j.rcv,
    j.acv,
  ];
  for (const v of candidates) {
    const n = typeof v === 'string' ? parseFloat(v) : (typeof v === 'number' ? v : 0);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

export type ReferralBucket =
  | 'Explicit Referral'
  | 'Customer Referral'
  | 'Person Name'
  | 'BNI / Networking'
  | 'Referred-by Note'
  | 'Other';

function classifySource(source: string, description: string): { bucket: ReferralBucket; isReferral: boolean; referrerName: string | null } {
  const src = source.trim();
  const lower = src.toLowerCase();

  // First check for "referred by NAME" in description/notes — even an
  // "Other" source can be a referral if the rep noted it in the memo.
  const noteMatch = description.match(REFERRED_BY_RE);
  const noteReferrer = noteMatch ? titleCase(noteMatch[1]) : null;

  // Customer Referral has to be tested BEFORE the generic referral check
  if (CUSTOMER_REFERRAL_RE.test(src)) {
    return { bucket: 'Customer Referral', isReferral: true, referrerName: noteReferrer };
  }
  if (BNI_RE.test(src)) {
    return { bucket: 'BNI / Networking', isReferral: true, referrerName: noteReferrer };
  }
  if (EXPLICIT_REFERRAL_RE.test(src)) {
    return { bucket: 'Explicit Referral', isReferral: true, referrerName: noteReferrer };
  }
  // A source that LOOKS like a person's name and is not a known channel
  if (PERSON_NAME_RE.test(src) && !NON_REFERRAL_SOURCES.test(lower)) {
    return { bucket: 'Person Name', isReferral: true, referrerName: titleCase(src) };
  }
  // Source isn't tagged as a referral but the memo says "referred by NAME"
  if (noteReferrer) {
    return { bucket: 'Referred-by Note', isReferral: true, referrerName: noteReferrer };
  }
  return { bucket: 'Other', isReferral: false, referrerName: null };
}

export interface RepReferralRow {
  rep: string;
  totalLeads: number;
  referralLeads: number;
  referralPct: number;
  signedReferrals: number;
  referralRevenue: number;
}

export interface TopReferrerRow {
  name: string;
  leadsReferred: number;
  signed: number;
  totalRevenue: number;
  mostRecentLeadDate: string | null;
}

export interface SourceBreakdownRow {
  source: ReferralBucket;
  leads: number;
  signed: number;
  closeRate: number;
}

export interface ReferralNetworkAnalysis {
  generatedAt: string;
  daysQueried: number;
  totalLeads: number;
  referralLeads: number;
  referralPct: number;
  unmatchedReferrerCount: number;
  byRep: RepReferralRow[];
  topReferrers: TopReferrerRow[];
  sourceBreakdown: SourceBreakdownRow[];
  meta: { queryTimeMs: number; contactsFetched: number; jobsFetched: number };
}

let _cache: { key: string; data: ReferralNetworkAnalysis; at: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;
const SHEET_CACHE_MAX_AGE_MS = 90 * 60 * 1000;

export async function analyzeReferralNetwork(opts: { days?: number } = {}): Promise<ReferralNetworkAnalysis> {
  const days = Math.min(opts.days || 365, 730);
  const cacheKey = `days:${days}`;
  if (_cache && _cache.key === cacheKey && Date.now() - _cache.at < CACHE_TTL_MS) return _cache.data;

  // Sheet-cache fast path for the default 365-day window.
  if (days === 365) {
    try {
      const { readChrisviewCache } = await import('./chrisview-sheet-cache');
      const cached = await readChrisviewCache<ReferralNetworkAnalysis>('referral-network');
      if (cached) {
        const age = Date.now() - new Date(cached.generatedAt).getTime();
        if (Number.isFinite(age) && age < SHEET_CACHE_MAX_AGE_MS) {
          _cache = { key: cacheKey, data: cached.payload, at: Date.now() };
          return cached.payload;
        }
      }
    } catch (err) {
      console.warn('[referral-network] sheet cache read failed:', err);
    }
  }

  const start = Date.now();
  const since = Math.floor(Date.now() / 1000) - days * 86400;

  // Pull contacts (cap 5000 — same as jn-lead-sources)
  const contacts: JNContact[] = [];
  let offset = 0;
  const pageSize = 100;
  let contactsFetched = 0;
  while (offset < 5000) {
    const res = await jnFetch<{ count?: number; results?: JNContact[] }>(`/contacts?limit=${pageSize}&offset=${offset}&sort=-date_created`);
    const page = res.results || [];
    if (!page.length) break;
    contactsFetched += page.length;
    for (const c of page) {
      if ((c.date_created || 0) < since) continue;
      contacts.push(c);
    }
    const oldest = Math.min(...page.map(c => c.date_created || 0));
    if (oldest < since) break;
    offset += pageSize;
  }

  // Pull jobs (used to determine conversion + revenue)
  const jobs: JNJob[] = [];
  offset = 0;
  let jobsFetched = 0;
  while (offset < 5000) {
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

  // contact id → jobs[]
  const jobsByContact = new Map<string, JNJob[]>();
  for (const j of jobs) {
    const cid = j.primary?.id || '';
    if (!cid) continue;
    if (!jobsByContact.has(cid)) jobsByContact.set(cid, []);
    jobsByContact.get(cid)!.push(j);
  }

  // Per-rep totals
  interface RepAcc {
    rep: string;
    totalLeads: number;
    referralLeads: number;
    signedReferrals: number;
    referralRevenue: number;
  }
  const byRepMap = new Map<string, RepAcc>();

  // Per-referrer totals — keyed on normalized name, displayed in title case
  interface ReferrerAcc {
    name: string;          // displayed (title case)
    leadsReferred: number;
    signed: number;
    totalRevenue: number;
    mostRecentTs: number;
  }
  const byReferrerMap = new Map<string, ReferrerAcc>();

  // Per-source-bucket totals
  const sourceMap = new Map<ReferralBucket, { leads: number; signed: number }>();

  let referralLeads = 0;
  let unmatchedReferrerCount = 0;

  for (const c of contacts) {
    const source = (c.source_name || c.source || '').toString().trim();
    const description = [
      c.description || '',
      c.customer_note || '',
      c.notes || '',
    ].join(' ');

    const rep = (c.sales_rep_name || '').trim() || '(unassigned)';
    const myJobs = jobsByContact.get(c.jnid) || [];
    const signedJob = myJobs.find(j => SIGNED_RE.test(j.status_name || ''));
    const isSigned = !!signedJob;
    const revenue = isSigned ? jobRevenue(signedJob) : 0;

    const cls = classifySource(source, description);

    // Per-rep accumulation (every contact counts toward the rep total)
    if (!byRepMap.has(rep)) {
      byRepMap.set(rep, { rep, totalLeads: 0, referralLeads: 0, signedReferrals: 0, referralRevenue: 0 });
    }
    const repAcc = byRepMap.get(rep)!;
    repAcc.totalLeads += 1;
    if (cls.isReferral) {
      repAcc.referralLeads += 1;
      if (isSigned) {
        repAcc.signedReferrals += 1;
        repAcc.referralRevenue += revenue;
      }
    }

    // Bucket counters (only buckets that have any leads)
    if (cls.isReferral) {
      referralLeads += 1;
      const bucket = sourceMap.get(cls.bucket) || { leads: 0, signed: 0 };
      bucket.leads += 1;
      if (isSigned) bucket.signed += 1;
      sourceMap.set(cls.bucket, bucket);

      // Per-referrer accumulation (only when we actually have a name)
      if (cls.referrerName) {
        const key = normalizeName(cls.referrerName);
        if (key) {
          if (!byReferrerMap.has(key)) {
            byReferrerMap.set(key, {
              name: titleCase(cls.referrerName),
              leadsReferred: 0,
              signed: 0,
              totalRevenue: 0,
              mostRecentTs: 0,
            });
          }
          const r = byReferrerMap.get(key)!;
          r.leadsReferred += 1;
          if (isSigned) {
            r.signed += 1;
            r.totalRevenue += revenue;
          }
          const ts = c.date_created || 0;
          if (ts > r.mostRecentTs) r.mostRecentTs = ts;
        }
      } else {
        // Referral source but no extractable referrer name
        unmatchedReferrerCount += 1;
      }
    }
  }

  const byRep: RepReferralRow[] = Array.from(byRepMap.values())
    .map(r => ({
      rep: r.rep,
      totalLeads: r.totalLeads,
      referralLeads: r.referralLeads,
      referralPct: r.totalLeads > 0 ? Math.round((r.referralLeads / r.totalLeads) * 1000) / 10 : 0,
      signedReferrals: r.signedReferrals,
      referralRevenue: Math.round(r.referralRevenue * 100) / 100,
    }))
    .sort((a, b) => b.referralLeads - a.referralLeads || b.totalLeads - a.totalLeads);

  const topReferrers: TopReferrerRow[] = Array.from(byReferrerMap.values())
    .map(r => ({
      name: r.name,
      leadsReferred: r.leadsReferred,
      signed: r.signed,
      totalRevenue: Math.round(r.totalRevenue * 100) / 100,
      mostRecentLeadDate: r.mostRecentTs > 0 ? new Date(r.mostRecentTs * 1000).toISOString().slice(0, 10) : null,
    }))
    .sort((a, b) =>
      b.totalRevenue - a.totalRevenue
      || b.signed - a.signed
      || b.leadsReferred - a.leadsReferred,
    );

  // Sort source breakdown by lead volume, but always start with explicit
  // referral types so the page reads top→bottom in tagging strictness.
  const orderedBuckets: ReferralBucket[] = [
    'Explicit Referral', 'Customer Referral', 'Person Name', 'BNI / Networking', 'Referred-by Note', 'Other',
  ];
  const sourceBreakdown: SourceBreakdownRow[] = orderedBuckets
    .filter(b => sourceMap.has(b))
    .map(b => {
      const v = sourceMap.get(b)!;
      return {
        source: b,
        leads: v.leads,
        signed: v.signed,
        closeRate: v.leads > 0 ? Math.round((v.signed / v.leads) * 1000) / 10 : 0,
      };
    });

  const result: ReferralNetworkAnalysis = {
    generatedAt: new Date().toISOString().slice(0, 10),
    daysQueried: days,
    totalLeads: contacts.length,
    referralLeads,
    referralPct: contacts.length > 0 ? Math.round((referralLeads / contacts.length) * 1000) / 10 : 0,
    unmatchedReferrerCount,
    byRep,
    topReferrers,
    sourceBreakdown,
    meta: { queryTimeMs: Date.now() - start, contactsFetched, jobsFetched },
  };

  _cache = { key: cacheKey, data: result, at: Date.now() };
  return result;
}
