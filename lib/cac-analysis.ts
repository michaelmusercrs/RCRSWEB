/**
 * Chris View - Customer Acquisition Cost (CAC) per Source.
 *
 * For each marketing channel:
 *   - Ad spend (LIFETIME, from data/company-overview.json → expenses.advertisingMarketing)
 *   - Leads acquired (JN contacts in the last N days bucketed by source_name)
 *   - Customers acquired (those leads who match a paying customer in customer-ltv.json)
 *   - CAC = spend / customers
 *   - LTV = avg lifetime revenue per matched customer (from customer-ltv.json)
 *   - LTV-to-CAC ratio (industry rule of thumb: >= 3:1 is healthy)
 *   - Payback months = CAC / (LTV / avg months_as_customer)
 *
 * IMPORTANT caveats baked into this lib:
 *   - Spend totals are LIFETIME (since QB opened) but lead pull is windowed.
 *     This is disclosed in AboutThisData on the page; ratio is most useful
 *     for cross-channel COMPARISON, not absolute payback math.
 *   - Source names from JN are messy ("Google" / "google" / "Google Ads").
 *     We normalize via SOURCE_BUCKET_MAP into a canonical set of buckets
 *     that line up with the QB spend keys. Anything we cannot map drops
 *     into `unmatchedLeads` with the original source label preserved.
 *   - Customer match against customer-ltv uses the same conservative
 *     name-normalization pattern as segmented-ltv-analysis.
 *   - BCM, Rudys, Roof Angel are rep LLCs, NOT lead sources — they are
 *     deliberately routed into the `referral`/`other` bucket if seen.
 */
import { redactCostFieldsDeep } from './jn-redact';
import companyOverview from '@/data/company-overview.json';
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
  source_name?: string;
  source?: string;
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

function jnFetch<T>(endpoint: string): Promise<T> {
  if (!JN_API_KEY) throw new Error('JobNimbus API key not configured');
  return fetch(`${JN_API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${JN_API_KEY}`, 'Content-Type': 'application/json' },
  }).then(async r => {
    if (!r.ok) throw new Error(`JN ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return redactCostFieldsDeep(await r.json(), false) as T;
  });
}

/**
 * Conservative name-normalization for matching JN contacts against the
 * QB customer string in customer-ltv.json. Mirrors segmented-ltv-analysis.
 */
function normalizeName(raw: string): string {
  if (!raw) return '';
  let s = String(raw);
  s = s.replace(/\s+R\d+\s*$/i, '');
  s = s.replace(/\([^)]*\)/g, ' ');
  s = s.replace(/\b(llc|inc\.?|incorporated|co\.?|corp\.?|corporation|ltd\.?|limited|company)\b/gi, ' ');
  s = s.replace(/[.,&'`"\-_/\\]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();
  return s;
}

/**
 * Lowercase + collapse for source-name matching (looser than name match).
 */
function normalizeSource(raw: string): string {
  return String(raw || '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Canonical buckets that line up with QB advertisingMarketing line items.
 * Order matters: first match wins. Each pattern is a substring test against
 * normalizeSource(jn_source). The bucket label is what the UI displays.
 */
const SOURCE_BUCKET_MAP: Array<{ patterns: string[]; bucket: string }> = [
  { patterns: ['google'], bucket: 'Google' },
  { patterns: ['facebook', 'meta', 'instagram', 'fb '], bucket: 'Facebook/Meta' },
  { patterns: ['bni'], bucket: 'BNI' },
  { patterns: ['home show', 'homeshow'], bucket: 'Home Shows' },
  { patterns: ['waff'], bucket: 'WAFF' },
  { patterns: ['whnt'], bucket: 'WHNT' },
  { patterns: ['waay'], bucket: 'WAAY31' },
  { patterns: ['bbb', 'better business bureau'], bucket: 'BBB' },
  { patterns: ['referral', 'word of mouth', 'wom', 'friend', 'family'], bucket: 'Referral' },
  { patterns: ['repeat customer', 'past customer'], bucket: 'Repeat Customer' },
  { patterns: ['insurance', 'adjuster', 'agent'], bucket: 'Insurance/Agent' },
  { patterns: ['canvass', 'door knock', 'door to door', 'd2d'], bucket: 'Canvassing' },
  { patterns: ['yelp'], bucket: 'Yelp' },
  { patterns: ['nextdoor'], bucket: 'Nextdoor' },
  { patterns: ['angi', 'angie'], bucket: 'Angi' },
  { patterns: ['website', 'web form', 'organic', 'seo'], bucket: 'Website/Organic' },
  { patterns: ['mail', 'flyer', 'door hanger'], bucket: 'Mail/Flyers' },
  { patterns: ['salesgenie'], bucket: 'Salesgenie' },
  { patterns: ['banquet'], bucket: 'Banquet' },
  { patterns: ['tn valley', 'tnvalley'], bucket: 'TN Valley Media' },
];

/**
 * For each bucket, the keys in expenses.advertisingMarketing to sum.
 * Buckets without a spend entry (e.g. Referral, Repeat Customer, Canvassing)
 * resolve to spend=0 — which is a real, valuable answer (organic CAC=$0).
 */
const SPEND_KEY_MAP: Record<string, string[]> = {
  'Google': ['google', 'googleLLC'],
  'Facebook/Meta': ['facebook', 'meta'],
  'BNI': ['bni'],
  'Home Shows': ['homeShows2021', 'homeShows2022', 'homeShow2023', 'homeShows2024', 'homeShow2025', 'homeShows2026'],
  'WAFF': ['waff'],
  'WHNT': ['whnt'],
  'WAAY31': ['waay31'],
  'BBB': ['bbb'],
  'Mail/Flyers': ['mailDropFlyers'],
  'Salesgenie': ['salesgenie'],
  'Banquet': ['banquet2022'],
  'TN Valley Media': ['tnValleyMedia'],
  'Referral': ['referralFees'],
  // Organic / repeat / canvassing / insurance / yelp / nextdoor / angi: no QB line, spend = 0
};

/**
 * Buckets that are explicitly NOT spend-driven channels and should be
 * surfaced separately (CAC of $0 is meaningful here, not an error).
 */
const ORGANIC_BUCKETS = new Set(['Referral', 'Repeat Customer', 'Insurance/Agent', 'Canvassing', 'Website/Organic', 'Yelp', 'Nextdoor', 'Angi']);

/**
 * Rep LLCs that look like sources but aren't. If JN has source_name set
 * to one of these, route into the unmatched pool with a note.
 */
const REP_LLC_BLOCKLIST = new Set(['bcm', 'rudys', 'rudy s', 'roof angel', 'roofangel']);

function bucketForSource(rawSource: string): string | null {
  const s = normalizeSource(rawSource);
  if (!s) return null;
  if (REP_LLC_BLOCKLIST.has(s)) return null; // rep LLCs - not lead sources
  for (const entry of SOURCE_BUCKET_MAP) {
    for (const p of entry.patterns) {
      if (s.includes(p)) return entry.bucket;
    }
  }
  return null;
}

export interface CacSourceRow {
  source: string;
  isOrganic: boolean;
  leads: number;
  customers: number;
  conversionRate: number;          // customers / leads * 100
  spend: number;                   // lifetime QB ad-spend matched to bucket
  cac: number | null;              // spend / customers (null when 0 customers)
  revenue: number;                 // sum of total lifetime invoiced for matched customers
  ltv: number | null;              // revenue / customers
  ltvToCacRatio: number | null;    // ltv / cac
  paybackMonths: number | null;    // cac / monthly-avg-revenue-per-customer
  isHealthy: boolean | null;       // true if ratio >= 3, null when undefined
  spendKeys: string[];             // which QB keys we summed
}

export interface CacAnalysis {
  generatedAt: string;
  daysQueried: number;
  totals: {
    adSpend: number;            // total ad spend across PAID buckets only
    adSpendAll: number;         // raw QB advertisingMarketing.total
    leads: number;              // leads in window across all buckets
    customers: number;          // customers acquired in window across all buckets
    revenue: number;            // revenue from those customers
    blendedCac: number | null;  // adSpend / customersFromPaidChannels
    blendedLtv: number | null;  // revenue / customers
    blendedRatio: number | null;
  };
  bySource: CacSourceRow[];
  unmatchedLeads: {
    count: number;
    sampleSources: Array<{ source: string; count: number }>;
  };
  unmatchedSpend: {
    total: number;
    keys: Array<{ key: string; amount: number }>;
  };
  meta: {
    queryTimeMs: number;
    contactsFetched: number;
    contactsInWindow: number;
    ltvCustomersPool: number;
    matchedLtvCustomers: number;
    spendIsLifetime: boolean;
  };
}

let _cache: { key: string; data: CacAnalysis; at: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;
const SHEET_CACHE_MAX_AGE_MS = 90 * 60 * 1000;

export async function analyzeCac(opts: { days?: number } = {}): Promise<CacAnalysis> {
  const days = Math.min(Math.max(opts.days || 365, 1), 730);
  const cacheKey = `days:${days}`;
  if (_cache && _cache.key === cacheKey && Date.now() - _cache.at < CACHE_TTL_MS) return _cache.data;

  // Sheet cache fast path (default 365-day window only)
  if (days === 365) {
    try {
      const { readChrisviewCache } = await import('./chrisview-sheet-cache');
      const cached = await readChrisviewCache<CacAnalysis>('cac');
      if (cached) {
        const age = Date.now() - new Date(cached.generatedAt).getTime();
        if (Number.isFinite(age) && age < SHEET_CACHE_MAX_AGE_MS) {
          _cache = { key: cacheKey, data: cached.payload, at: Date.now() };
          return cached.payload;
        }
      }
    } catch (err) {
      console.warn('[cac-analysis] sheet cache read failed:', err);
    }
  }

  const result = await computeCac(days);
  _cache = { key: cacheKey, data: result, at: Date.now() };
  return result;
}

/**
 * Exposed for the precompute cron — forces a fresh compute + sheet write.
 */
export async function computeCacViaSheetCache(): Promise<{
  payload: CacAnalysis;
  fromCache: boolean;
  generatedAt: string;
}> {
  return withChrisviewCache<CacAnalysis>('cac', () => computeCac(365));
}

async function computeCac(days: number): Promise<CacAnalysis> {
  const start = Date.now();
  const since = Math.floor(Date.now() / 1000) - days * 86400;

  // ---- 1. Build LTV lookup from customer-ltv.json (allCustomers = full QB book) ----
  const ltvJson = ltvData as unknown as {
    totalCustomers: number;
    allCustomers?: LTVRecord[];
    topCustomers?: LTVRecord[];
    repeatCustomers?: LTVRecord[];
    recentBig?: LTVRecord[];
  };
  const ltvPool: LTVRecord[] = ltvJson.allCustomers && ltvJson.allCustomers.length > 0
    ? ltvJson.allCustomers
    : [
        ...(ltvJson.topCustomers || []),
        ...(ltvJson.repeatCustomers || []).filter(c => !(ltvJson.topCustomers || []).some(t => t.customer === c.customer)),
        ...(ltvJson.recentBig || []).filter(c =>
          !(ltvJson.topCustomers || []).some(t => t.customer === c.customer) &&
          !(ltvJson.repeatCustomers || []).some(t => t.customer === c.customer)),
      ];
  const ltvByNormName = new Map<string, LTVRecord>();
  for (const c of ltvPool) {
    const k = normalizeName(c.customer);
    if (!k) continue;
    if (!ltvByNormName.has(k)) ltvByNormName.set(k, c);
  }

  // ---- 2. Pull JN contacts ----
  const contacts: JNContact[] = [];
  let offset = 0;
  const pageSize = 100;
  let contactsFetched = 0;
  while (offset < 8000) {
    const res = await jnFetch<{ count?: number; results?: JNContact[] }>(
      `/contacts?limit=${pageSize}&offset=${offset}&sort=-date_created`,
    );
    const page = res.results || [];
    if (!page.length) break;
    contactsFetched += page.length;
    let oldestInPage = Infinity;
    for (const c of page) {
      const created = c.date_created || 0;
      if (created < oldestInPage) oldestInPage = created;
      if (created < since) continue;
      contacts.push(c);
    }
    if (oldestInPage < since) break;
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  // ---- 3. Bucket leads + match to LTV customers ----
  interface Bucket {
    source: string;
    isOrganic: boolean;
    leads: number;
    customers: number;
    revenue: number;
    monthsAccum: number;  // accumulator for payback calc
    monthsN: number;
  }
  const bucketMap = new Map<string, Bucket>();
  const unmatchedBySource = new Map<string, number>();
  let matchedLtvCustomers = 0;

  for (const c of contacts) {
    const rawSource = c.source_name || c.source || '';
    const bucket = bucketForSource(rawSource);
    const display = c.display_name || `${c.first_name || ''} ${c.last_name || ''}`.trim();
    const ltvHit = ltvByNormName.get(normalizeName(display));

    if (!bucket) {
      const key = rawSource.trim() || '(no source)';
      unmatchedBySource.set(key, (unmatchedBySource.get(key) || 0) + 1);
      continue;
    }

    let b = bucketMap.get(bucket);
    if (!b) {
      b = {
        source: bucket,
        isOrganic: ORGANIC_BUCKETS.has(bucket),
        leads: 0,
        customers: 0,
        revenue: 0,
        monthsAccum: 0,
        monthsN: 0,
      };
      bucketMap.set(bucket, b);
    }
    b.leads += 1;
    if (ltvHit) {
      b.customers += 1;
      b.revenue += ltvHit.total;
      const months = Math.max(1, ltvHit.daysAsCustomer / 30.44);
      b.monthsAccum += months;
      b.monthsN += 1;
      matchedLtvCustomers += 1;
    }
  }

  // ---- 4. Pull ad spend from company-overview ----
  const adv = (companyOverview as unknown as {
    expenses: { advertisingMarketing: Record<string, number> };
  }).expenses.advertisingMarketing;
  const advTotal = Number(adv.total) || 0;

  const usedKeys = new Set<string>(['total']); // total isn't a real line item
  for (const keys of Object.values(SPEND_KEY_MAP)) for (const k of keys) usedKeys.add(k);

  // unmatched spend = QB lines we didn't route to any bucket
  const unmatchedSpendEntries: Array<{ key: string; amount: number }> = [];
  let unmatchedSpendTotal = 0;
  for (const [k, v] of Object.entries(adv)) {
    if (usedKeys.has(k)) continue;
    const amount = Number(v) || 0;
    if (amount === 0) continue;
    unmatchedSpendEntries.push({ key: k, amount });
    unmatchedSpendTotal += amount;
  }
  unmatchedSpendEntries.sort((a, b) => b.amount - a.amount);

  // ---- 5. Build per-source rows ----
  const allBuckets = new Set<string>(bucketMap.keys());
  // Surface paid buckets even if they had zero leads in the window, so
  // Chris can see "we spent $X on Y but got nothing"
  for (const b of Object.keys(SPEND_KEY_MAP)) allBuckets.add(b);

  const bySource: CacSourceRow[] = [];
  let paidSpend = 0;
  let paidCustomers = 0;
  let paidRevenue = 0;
  let totalLeads = 0;
  let totalCustomers = 0;
  let totalRevenue = 0;

  for (const bucket of allBuckets) {
    const b = bucketMap.get(bucket) || {
      source: bucket,
      isOrganic: ORGANIC_BUCKETS.has(bucket),
      leads: 0,
      customers: 0,
      revenue: 0,
      monthsAccum: 0,
      monthsN: 0,
    };
    const spendKeys = SPEND_KEY_MAP[bucket] || [];
    const spend = spendKeys.reduce((s, k) => s + (Number(adv[k]) || 0), 0);
    const cac = b.customers > 0 ? Math.round((spend / b.customers) * 100) / 100 : null;
    const ltv = b.customers > 0 ? Math.round((b.revenue / b.customers) * 100) / 100 : null;
    const ratio = cac != null && cac > 0 && ltv != null
      ? Math.round((ltv / cac) * 100) / 100
      : (cac === 0 && ltv != null ? Infinity : null);
    const avgMonths = b.monthsN > 0 ? b.monthsAccum / b.monthsN : null;
    const monthlyRev = avgMonths != null && ltv != null ? ltv / avgMonths : null;
    const paybackMonths = cac != null && cac > 0 && monthlyRev != null && monthlyRev > 0
      ? Math.round((cac / monthlyRev) * 10) / 10
      : (cac === 0 ? 0 : null);

    const conversionRate = b.leads > 0 ? Math.round((b.customers / b.leads) * 1000) / 10 : 0;
    const isHealthy = ratio == null ? null : (ratio === Infinity ? true : ratio >= 3);

    bySource.push({
      source: bucket,
      isOrganic: b.isOrganic,
      leads: b.leads,
      customers: b.customers,
      conversionRate,
      spend: Math.round(spend * 100) / 100,
      cac,
      revenue: Math.round(b.revenue * 100) / 100,
      ltv,
      ltvToCacRatio: ratio === Infinity ? null : ratio, // serialize-safe — UI treats null+spend=0 as N/A
      paybackMonths,
      isHealthy,
      spendKeys,
    });

    totalLeads += b.leads;
    totalCustomers += b.customers;
    totalRevenue += b.revenue;
    if (spend > 0) {
      paidSpend += spend;
      paidCustomers += b.customers;
      paidRevenue += b.revenue;
    }
  }

  // Sort: paid channels first by spend desc, then organic by leads desc
  bySource.sort((a, b) => {
    if ((a.spend > 0) !== (b.spend > 0)) return b.spend > 0 ? 1 : -1;
    if (a.spend > 0) return b.spend - a.spend;
    return b.leads - a.leads;
  });

  const unmatchedLeadsTotal = Array.from(unmatchedBySource.values()).reduce((s, n) => s + n, 0);
  const sampleSources = Array.from(unmatchedBySource.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([source, count]) => ({ source, count }));

  const blendedCac = paidCustomers > 0 ? Math.round((paidSpend / paidCustomers) * 100) / 100 : null;
  const blendedLtv = paidCustomers > 0 ? Math.round((paidRevenue / paidCustomers) * 100) / 100 : null;
  const blendedRatio = blendedCac != null && blendedCac > 0 && blendedLtv != null
    ? Math.round((blendedLtv / blendedCac) * 100) / 100
    : null;

  const result: CacAnalysis = {
    generatedAt: new Date().toISOString().slice(0, 10),
    daysQueried: days,
    totals: {
      adSpend: Math.round(paidSpend * 100) / 100,
      adSpendAll: Math.round(advTotal * 100) / 100,
      leads: totalLeads,
      customers: totalCustomers,
      revenue: Math.round(totalRevenue * 100) / 100,
      blendedCac,
      blendedLtv,
      blendedRatio,
    },
    bySource,
    unmatchedLeads: {
      count: unmatchedLeadsTotal,
      sampleSources,
    },
    unmatchedSpend: {
      total: Math.round(unmatchedSpendTotal * 100) / 100,
      keys: unmatchedSpendEntries,
    },
    meta: {
      queryTimeMs: Date.now() - start,
      contactsFetched,
      contactsInWindow: contacts.length,
      ltvCustomersPool: ltvPool.length,
      matchedLtvCustomers,
      spendIsLifetime: true,
    },
  };

  return result;
}
