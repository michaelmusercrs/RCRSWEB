/**
 * Lead Source Effectiveness Analysis.
 *
 * For each contact in JN over the window, capture:
 *   - source_name (or first non-empty alternative)
 *   - sales_rep_name
 *   - did the contact convert to a signed job?
 *   - days from contact created to job signed
 *
 * Roll up by source: count, conversions, close %, median days to convert,
 * top-3 reps for that source.
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
}

interface JNJob {
  jnid: string;
  status_name?: string;
  date_status_change?: number;
  date_created?: number;
  primary?: { id?: string };
  sales_rep_name?: string;
}

const SIGNED_RE = /signed|contract|contingency|approved|sold|won|paid|installed|complete/i;

function jnFetch<T>(endpoint: string): Promise<T> {
  if (!JN_API_KEY) throw new Error('JobNimbus API key not configured');
  return fetch(`${JN_API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${JN_API_KEY}`, 'Content-Type': 'application/json' },
  }).then(async r => {
    if (!r.ok) throw new Error(`JN ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return redactCostFieldsDeep(await r.json(), false) as T;
  });
}

function median(values: number[]): number | null {
  const v = values.filter(x => x != null && Number.isFinite(x));
  if (!v.length) return null;
  v.sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2 * 10) / 10;
}

export interface SourceRow {
  source: string;
  leads: number;
  converted: number;
  closeRate: number;
  medianDaysToClose: number | null;
  topReps: Array<{ rep: string; leads: number; converted: number }>;
}

export interface LeadSourceAnalysis {
  generatedAt: string;
  daysQueried: number;
  totalLeads: number;
  bySource: SourceRow[];
  byRep: Array<{ rep: string; leads: number; converted: number; closeRate: number; topSources: string[] }>;
  meta: { queryTimeMs: number; contactsFetched: number; jobsFetched: number };
}

let _cache: { key: string; data: LeadSourceAnalysis; at: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function analyzeLeadSources(opts: { days?: number } = {}): Promise<LeadSourceAnalysis> {
  const days = Math.min(opts.days || 180, 730);
  const cacheKey = `days:${days}`;
  if (_cache && _cache.key === cacheKey && Date.now() - _cache.at < CACHE_TTL_MS) return _cache.data;

  // Sheet-cache fast path for the default 180-day window.
  if (days === 180) {
    try {
      const { readChrisviewCache } = await import('./chrisview-sheet-cache');
      const cached = await readChrisviewCache<LeadSourceAnalysis>('lead-sources');
      if (cached) {
        const age = Date.now() - new Date(cached.generatedAt).getTime();
        if (Number.isFinite(age) && age < 90 * 60 * 1000) {
          _cache = { key: cacheKey, data: cached.payload, at: Date.now() };
          return cached.payload;
        }
      }
    } catch (err) {
      console.warn('[jn-lead-sources] sheet cache read failed:', err);
    }
  }

  const start = Date.now();
  const since = Math.floor(Date.now() / 1000) - days * 86400;

  // Pull contacts
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

  // Pull jobs (used to determine which contacts converted)
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

  // Build contact → best matching job
  const jobsByContact = new Map<string, JNJob[]>();
  for (const j of jobs) {
    const cid = j.primary?.id || '';
    if (!cid) continue;
    if (!jobsByContact.has(cid)) jobsByContact.set(cid, []);
    jobsByContact.get(cid)!.push(j);
  }

  interface Bucket {
    source: string;
    rep: string;
    leads: number;
    converted: number;
    daysToClose: number[];
  }
  const bySourceMap = new Map<string, Bucket>();
  const byRepSourceMap = new Map<string, Map<string, { leads: number; converted: number }>>();

  for (const c of contacts) {
    const source = (c.source_name || c.source || '(unknown)').toString().trim() || '(unknown)';
    const rep = (c.sales_rep_name || '').trim() || '(unassigned)';
    const myJobs = jobsByContact.get(c.jnid) || [];
    const signed = myJobs.some(j => SIGNED_RE.test(j.status_name || ''));
    let daysToClose: number | null = null;
    if (signed) {
      const signedJob = myJobs.find(j => SIGNED_RE.test(j.status_name || ''));
      const t = signedJob?.date_status_change || signedJob?.date_created || 0;
      const created = c.date_created || 0;
      if (t > created) daysToClose = Math.round((t - created) / 86400 * 10) / 10;
    }

    const bucket = bySourceMap.get(source) || { source, rep: '', leads: 0, converted: 0, daysToClose: [] };
    bucket.leads += 1;
    if (signed) bucket.converted += 1;
    if (daysToClose != null) bucket.daysToClose.push(daysToClose);
    bySourceMap.set(source, bucket);

    if (!byRepSourceMap.has(rep)) byRepSourceMap.set(rep, new Map());
    const repBuckets = byRepSourceMap.get(rep)!;
    const repBucket = repBuckets.get(source) || { leads: 0, converted: 0 };
    repBucket.leads += 1;
    if (signed) repBucket.converted += 1;
    repBuckets.set(source, repBucket);
  }

  const bySource: SourceRow[] = Array.from(bySourceMap.values())
    .map(b => {
      // top reps for this source
      const repsForThisSource: Array<{ rep: string; leads: number; converted: number }> = [];
      for (const [rep, sources] of byRepSourceMap.entries()) {
        const v = sources.get(b.source);
        if (v && v.leads > 0) repsForThisSource.push({ rep, leads: v.leads, converted: v.converted });
      }
      repsForThisSource.sort((a, b) => b.leads - a.leads);
      return {
        source: b.source,
        leads: b.leads,
        converted: b.converted,
        closeRate: b.leads > 0 ? Math.round((b.converted / b.leads) * 1000) / 10 : 0,
        medianDaysToClose: median(b.daysToClose),
        topReps: repsForThisSource.slice(0, 3),
      };
    })
    .sort((a, b) => b.leads - a.leads);

  const byRep = Array.from(byRepSourceMap.entries())
    .map(([rep, sources]) => {
      let leads = 0;
      let converted = 0;
      const sourceList: Array<[string, number]> = [];
      for (const [src, v] of sources.entries()) {
        leads += v.leads;
        converted += v.converted;
        sourceList.push([src, v.leads]);
      }
      sourceList.sort((a, b) => b[1] - a[1]);
      return {
        rep,
        leads,
        converted,
        closeRate: leads > 0 ? Math.round((converted / leads) * 1000) / 10 : 0,
        topSources: sourceList.slice(0, 3).map(([s]) => s),
      };
    })
    .sort((a, b) => b.leads - a.leads);

  const result: LeadSourceAnalysis = {
    generatedAt: new Date().toISOString().slice(0, 10),
    daysQueried: days,
    totalLeads: contacts.length,
    bySource,
    byRep,
    meta: { queryTimeMs: Date.now() - start, contactsFetched, jobsFetched },
  };

  _cache = { key: cacheKey, data: result, at: Date.now() };
  return result;
}
