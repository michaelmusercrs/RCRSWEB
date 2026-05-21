/**
 * Chris View - Segmented Customer LTV (Insurance vs Retail).
 *
 * Splits the existing customer-ltv.json data into two cohorts:
 *   - Insurance: customer has at least one JN job flagged as insurance
 *   - Retail:    customer has JN jobs, none of them are insurance
 *   - Unknown:   customer name from QB could not be matched to a JN contact
 *
 * Name matching is intentionally conservative. The QB customer string
 * looks like "Joan Theusch R3827" - a person/business name followed by a
 * QB record number ("R" + digits). We strip the record number, parenthetical
 * notes ("(Main)", "(Gym Full)") and common business suffixes (LLC, Inc...)
 * then normalize to lower-case before comparing to JN contact display_name.
 * If a customer cannot be matched cleanly it stays in "unknown segment".
 *
 * Data caveat: customer-ltv.json only ships the top 100 customers (plus top
 * 100 repeats + 90 recent). It does NOT contain all 3194 customers. We dedupe
 * across those three arrays for the working pool, then report the coverage
 * (working pool size / 3194) so the UI can surface it honestly.
 *
 * Cost-privacy: chrisview is owner-facing, but JN reads still pass through
 * redactCostFieldsDeep via the shared jnFetch helper.
 */
import { redactCostFieldsDeep } from './jn-redact';
import ltvData from '@/data/customer-ltv.json';
import { withChrisviewCache } from './chrisview-sheet-cache';

const JN_API_KEY = process.env.JOBNIMBUS_API_KEY;
const JN_API_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

interface JNContact {
  jnid: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  company?: string;
  date_created?: number;
}

interface JNJob {
  jnid: string;
  name?: string;
  primary?: { id?: string };
  related?: Array<{ id?: string; type?: string }>;
  insurance_company?: string;
  insurance_company_name?: string;
  insurance_carrier?: string;
  claim_number?: string;
  insurance_summary?: unknown;
  date_created?: number;
  [key: string]: unknown;
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

// Mirror of hasInsuranceData() from jn-insurance-analysis.ts.
// Replicated here so we don't take a dependency on that file just for one
// helper - keeps this module standalone for the sheet-cache cron.
function hasInsuranceData(j: JNJob): boolean {
  if (j.insurance_company || j.insurance_company_name || j.insurance_carrier) return true;
  if (j.claim_number) return true;
  if (j.insurance_summary && typeof j.insurance_summary === 'object' && Object.keys(j.insurance_summary).length > 0) return true;
  return false;
}

/**
 * Normalize a customer/contact display name for matching:
 *   - strip "R" + digits trailing record number (QB-style "Joan Theusch R3827")
 *   - drop parenthetical notes ("(Main)", "(Gym Full)")
 *   - drop common business suffixes (LLC, Inc, Co, Corp, Ltd)
 *   - lower-case + collapse whitespace
 *
 * Two strings that normalize to the same non-empty value are treated as
 * the same entity. Anything that normalizes to empty or 1-token gibberish
 * is considered unmatchable on the QB side.
 */
function normalizeName(raw: string): string {
  if (!raw) return '';
  let s = String(raw);
  // strip "R12345" record-number suffix (QB-customer convention)
  s = s.replace(/\s+R\d+\s*$/i, '');
  // drop parenthetical content
  s = s.replace(/\([^)]*\)/g, ' ');
  // common business suffixes (whole-word)
  s = s.replace(/\b(llc|inc\.?|incorporated|co\.?|corp\.?|corporation|ltd\.?|limited|company)\b/gi, ' ');
  // punctuation
  s = s.replace(/[.,&'`"\-_/\\]/g, ' ');
  // collapse whitespace
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();
  return s;
}

interface SegmentTotals {
  customers: number;
  revenue: number;
  repeatCustomers: number;
  repeatRate: number;
  avgLTV: number;
}

interface CohortBySegmentRow {
  year: string;
  segment: 'insurance' | 'retail' | 'unknown';
  newCustomers: number;
  repeatCount: number;
  repeatPct: number;
  revenue: number;
}

interface SegmentedCustomer {
  customer: string;
  total: number;
  invoiceCount: number;
  firstDate: string;
  lastDate: string;
  daysAsCustomer: number;
  avgInvoice: number;
  recentInvoices: number;
  isRepeat: boolean;
  reps: string[];
  segment: 'insurance' | 'retail' | 'unknown';
  matchedJnid: string | null;
}

export interface SegmentedLTVAnalysis {
  generatedAt: string;
  totals: {
    insurance: SegmentTotals;
    retail: SegmentTotals;
    unknown: SegmentTotals;
  };
  cohortsBySegment: CohortBySegmentRow[];
  topByInsurance: SegmentedCustomer[];
  topByRetail: SegmentedCustomer[];
  meta: {
    workingPoolSize: number;        // unique customers we had LTV data for
    totalCustomersInQB: number;     // full QB customer count (for context)
    coverageOfQB: number;           // workingPoolSize / totalCustomersInQB * 100
    jnContactsFetched: number;
    jnJobsFetched: number;
    matchedCount: number;
    matchRatePct: number;           // matchedCount / workingPoolSize * 100
    queryTimeMs: number;
  };
}

interface LTVRecord {
  customer: string;
  total: number;
  invoiceCount: number;
  firstDate: string;
  lastDate: string;
  daysAsCustomer: number;
  avgInvoice: number;
  recentInvoices: number;
  isRepeat: boolean;
  reps: string[];
}

// Sheet cache fast path - inline cached payload accepted up to 90 min old.
let _cache: { data: SegmentedLTVAnalysis; at: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;
const SHEET_CACHE_MAX_AGE_MS = 90 * 60 * 1000;

export async function analyzeSegmentedLTV(): Promise<SegmentedLTVAnalysis> {
  if (_cache && Date.now() - _cache.at < CACHE_TTL_MS) return _cache.data;

  // Sheet cache - mirrors the pattern in jn-deep-funnel.ts.
  try {
    const { readChrisviewCache } = await import('./chrisview-sheet-cache');
    const cached = await readChrisviewCache<SegmentedLTVAnalysis>('segmented-ltv');
    if (cached) {
      const age = Date.now() - new Date(cached.generatedAt).getTime();
      if (Number.isFinite(age) && age < SHEET_CACHE_MAX_AGE_MS) {
        _cache = { data: cached.payload, at: Date.now() };
        return cached.payload;
      }
    }
  } catch (err) {
    console.warn('[segmented-ltv-analysis] sheet cache read failed:', err);
  }

  const result = await computeSegmentedLTV();
  _cache = { data: result, at: Date.now() };
  return result;
}

/**
 * Exposed for the precompute cron - lets it bypass the in-memory cache
 * and force a fresh compute + write through withChrisviewCache.
 */
export async function computeSegmentedLTVViaSheetCache(): Promise<{
  payload: SegmentedLTVAnalysis;
  fromCache: boolean;
  generatedAt: string;
}> {
  return withChrisviewCache<SegmentedLTVAnalysis>('segmented-ltv', computeSegmentedLTV);
}

async function computeSegmentedLTV(): Promise<SegmentedLTVAnalysis> {
  const start = Date.now();

  // ---- 1. Build working customer pool from customer-ltv.json ----
  //
  // The JSON ships top 100 by lifetime + top 100 repeats + 90 recent. Dedupe
  // by customer string (which is unique - QB record-number suffix guarantees it).
  const pool = new Map<string, LTVRecord>();
  const ltvJson = ltvData as unknown as {
    totalCustomers: number;
    topCustomers: LTVRecord[];
    repeatCustomers: LTVRecord[];
    recentBig: LTVRecord[];
  };
  for (const c of ltvJson.topCustomers || []) pool.set(c.customer, c);
  for (const c of ltvJson.repeatCustomers || []) if (!pool.has(c.customer)) pool.set(c.customer, c);
  for (const c of ltvJson.recentBig || []) if (!pool.has(c.customer)) pool.set(c.customer, c);
  const workingPool = Array.from(pool.values());

  // ---- 2. Pull JN contacts + jobs, build per-contact insurance flag ----
  const contacts: JNContact[] = [];
  let contactsFetched = 0;
  {
    let offset = 0;
    const pageSize = 100;
    while (offset < 3000) {
      const res = await jnFetch<{ count?: number; results?: JNContact[] }>(
        `/contacts?limit=${pageSize}&offset=${offset}&sort=-date_created`
      );
      const page = res.results || [];
      if (!page.length) break;
      contactsFetched += page.length;
      contacts.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }
  }

  // Map normalized contact name -> { jnid, hasInsurance }.
  // Multiple contacts can share a name; collapse to a single record but OR
  // the insurance flag so any insurance job in the contact's history flips it.
  const byNormName = new Map<string, { jnid: string; hasInsurance: boolean }>();
  for (const c of contacts) {
    const display = c.display_name || `${c.first_name || ''} ${c.last_name || ''}`.trim();
    const key = normalizeName(display);
    if (!key) continue;
    if (!byNormName.has(key)) byNormName.set(key, { jnid: c.jnid, hasInsurance: false });
  }

  // ---- 3. Walk JN jobs, OR the insurance flag onto the matching contact ----
  let jobsFetched = 0;
  const contactInsuranceByJnid = new Map<string, boolean>();
  {
    let offset = 0;
    const pageSize = 100;
    while (offset < 5000) {
      const res = await jnFetch<{ count?: number; results?: JNJob[] }>(
        `/jobs?limit=${pageSize}&offset=${offset}&sort=-date_created`
      );
      const page = res.results || [];
      if (!page.length) break;
      jobsFetched += page.length;
      for (const j of page) {
        const ins = hasInsuranceData(j);
        const contactId = j.primary?.id || (j.related || []).find(r => r?.type === 'contact')?.id;
        if (contactId) {
          contactInsuranceByJnid.set(contactId, contactInsuranceByJnid.get(contactId) || ins);
        }
      }
      if (page.length < pageSize) break;
      offset += pageSize;
    }
  }

  // Roll the per-contact-id insurance flag back onto the by-name map.
  for (const c of contacts) {
    const display = c.display_name || `${c.first_name || ''} ${c.last_name || ''}`.trim();
    const key = normalizeName(display);
    if (!key) continue;
    const entry = byNormName.get(key);
    if (!entry) continue;
    if (contactInsuranceByJnid.get(c.jnid)) entry.hasInsurance = true;
  }

  // ---- 4. Classify each LTV customer ----
  const classified: SegmentedCustomer[] = workingPool.map(c => {
    const norm = normalizeName(c.customer);
    const hit = norm ? byNormName.get(norm) : undefined;
    let segment: 'insurance' | 'retail' | 'unknown';
    let matchedJnid: string | null = null;
    if (!hit) {
      segment = 'unknown';
    } else {
      matchedJnid = hit.jnid;
      segment = hit.hasInsurance ? 'insurance' : 'retail';
    }
    return {
      customer: c.customer,
      total: c.total,
      invoiceCount: c.invoiceCount,
      firstDate: c.firstDate,
      lastDate: c.lastDate,
      daysAsCustomer: c.daysAsCustomer,
      avgInvoice: c.avgInvoice,
      recentInvoices: c.recentInvoices,
      isRepeat: c.isRepeat,
      reps: c.reps || [],
      segment,
      matchedJnid,
    };
  });

  // ---- 5. Per-segment totals ----
  function rollup(rows: SegmentedCustomer[]): SegmentTotals {
    const customers = rows.length;
    const revenue = rows.reduce((s, r) => s + r.total, 0);
    const repeats = rows.filter(r => r.isRepeat).length;
    return {
      customers,
      revenue: Math.round(revenue * 100) / 100,
      repeatCustomers: repeats,
      repeatRate: customers > 0 ? Math.round((repeats / customers) * 1000) / 10 : 0,
      avgLTV: customers > 0 ? Math.round((revenue / customers) * 100) / 100 : 0,
    };
  }

  const insRows = classified.filter(c => c.segment === 'insurance');
  const retRows = classified.filter(c => c.segment === 'retail');
  const unkRows = classified.filter(c => c.segment === 'unknown');

  // ---- 6. Cohorts by year x segment ----
  const cohortMap = new Map<string, {
    year: string; segment: 'insurance' | 'retail' | 'unknown';
    newCustomers: number; repeatCount: number; revenue: number;
  }>();
  for (const r of classified) {
    const year = (r.firstDate || '').slice(0, 4);
    if (!year) continue;
    const key = `${year}:${r.segment}`;
    const cur = cohortMap.get(key) || { year, segment: r.segment, newCustomers: 0, repeatCount: 0, revenue: 0 };
    cur.newCustomers += 1;
    if (r.isRepeat) cur.repeatCount += 1;
    cur.revenue += r.total;
    cohortMap.set(key, cur);
  }
  const cohortsBySegment: CohortBySegmentRow[] = Array.from(cohortMap.values())
    .map(c => ({
      year: c.year,
      segment: c.segment,
      newCustomers: c.newCustomers,
      repeatCount: c.repeatCount,
      repeatPct: c.newCustomers > 0 ? Math.round((c.repeatCount / c.newCustomers) * 1000) / 10 : 0,
      revenue: Math.round(c.revenue * 100) / 100,
    }))
    .sort((a, b) => a.year.localeCompare(b.year) || a.segment.localeCompare(b.segment));

  // ---- 7. Top 20 by segment ----
  const sortByTotal = (a: SegmentedCustomer, b: SegmentedCustomer) => b.total - a.total;
  const topByInsurance = [...insRows].sort(sortByTotal).slice(0, 20);
  const topByRetail = [...retRows].sort(sortByTotal).slice(0, 20);

  const matchedCount = classified.filter(c => c.segment !== 'unknown').length;
  const workingPoolSize = workingPool.length;

  const result: SegmentedLTVAnalysis = {
    generatedAt: new Date().toISOString().slice(0, 10),
    totals: {
      insurance: rollup(insRows),
      retail: rollup(retRows),
      unknown: rollup(unkRows),
    },
    cohortsBySegment,
    topByInsurance,
    topByRetail,
    meta: {
      workingPoolSize,
      totalCustomersInQB: ltvJson.totalCustomers || 0,
      coverageOfQB: (ltvJson.totalCustomers || 0) > 0
        ? Math.round((workingPoolSize / (ltvJson.totalCustomers || 1)) * 1000) / 10
        : 0,
      jnContactsFetched: contactsFetched,
      jnJobsFetched: jobsFetched,
      matchedCount,
      matchRatePct: workingPoolSize > 0
        ? Math.round((matchedCount / workingPoolSize) * 1000) / 10
        : 0,
      queryTimeMs: Date.now() - start,
    },
  };

  return result;
}
