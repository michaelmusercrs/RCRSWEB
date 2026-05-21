/**
 * JN Response Times - Direct API Integration
 *
 * Queries JobNimbus API directly for:
 * 1. Contacts created by office staff (Sara Hill, Destin McCary, Tia Muse Morris)
 * 2. First manual activity by the assigned sales rep for each contact
 * 3. Calculates response time = first_action.date_created - contact.date_created
 *
 * COST-PRIVACY: this module talks to JN via its own fetch helper (not the
 * jobnimbus-service singleton). The data we surface is response-time
 * aggregates (avg / median / counts) and lead metadata — no cost fields are
 * read into the output shape. As belt-and-suspenders, every raw JN response
 * is passed through redactCostFieldsDeep before downstream processing. See
 * docs/research-crm-comparison.md moat #3 + feedback_purchase_price_visibility.
 */

import { redactCostFieldsDeep } from './jn-redact';

const JN_API_KEY = process.env.JOBNIMBUS_API_KEY;
const JN_API_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

// Office staff who create leads
const OFFICE_STAFF = [
  'sara hill',
  'destin mccary',
  'destin mc cary',
  'tia muse morris',
  'tia morris',
  'tia muse',
  'boston',
  'office',
];

// Excluded "activity" types that are auto-system events masquerading as activities.
// Per the deep-audit script (scripts/deep-audit-lead-response.mjs) these never count
// as first-rep-contact even if they show up in /activities.
const EXCLUDED_ACTIVITY_TYPES_RE = /^(Contact Created|Assigned Contact|Job Created|Assigned Job|Related to job|Unassigned|Contact Modified|Job Modified|Attachment deleted|Attachment Added|Document Added|Status Changed)$/i;

// System/automation authors to exclude (regex form matches jn-deep-funnel.ts)
const SYSTEM_AUTHORS_RE = /system|automation|webhook|portal|jobnimbus\b|^api\b|^email$/i;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JNContact {
  jnid: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  created_by_name?: string;
  sales_rep_name?: string;
  sales_rep?: string;
  date_created?: number;
  source_name?: string;
}

interface JNActivity {
  jnid: string;
  created_by_name?: string;
  created_by?: string;
  record_type_name?: string;
  date_created?: number;
  is_editable?: boolean;
  is_status_change?: boolean;
  source?: string;
  note?: string;
  primary?: { id?: string; type?: string; name?: string };
  related?: Array<{ id?: string; type?: string }>;
}

export interface LeadResponseEntry {
  contactJnid: string;
  contactName: string;
  repName: string;
  createdBy: string;
  leadSource: string;
  contactCreatedAt: number;     // unix
  firstActionAt: number | null; // unix
  firstActionType: string | null;
  firstActionBy: string | null;
  responseMinutes: number | null;
}

export interface RepAverage {
  repName: string;
  avgMinutes: number;
  medianMinutes: number;
  fastestMinutes: number;
  slowestMinutes: number;
  totalLeads: number;
  respondedLeads: number;
  noResponseLeads: number;
  under5Min: number;
  under15Min: number;
  under30Min: number;
  over60Min: number;
  grade: string;
}

export interface ResponseTimesResult {
  repAverages: RepAverage[];
  leads: LeadResponseEntry[];
  summary: {
    totalLeads: number;
    totalResponded: number;
    overallAvgMinutes: number;
    overallMedianMinutes: number;
  };
  meta: {
    daysQueried: number;
    queryTimeMs: number;
    contactsFetched: number;
    timestamp: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isOfficeStaff(name: string): boolean {
  const lower = (name || '').toLowerCase().trim();
  return OFFICE_STAFF.some(s => lower.includes(s));
}

function isSystemAuthor(name: string): boolean {
  return SYSTEM_AUTHORS_RE.test(name || '');
}

/**
 * Per Michael 2026-05-19 audit: a "manual rep action" is ANY activity that
 *   1. Is NOT an excluded auto-generated activity type
 *      (Contact Created, Assigned, Status Changed, Modified, etc.)
 *   2. Was authored by someone who is NOT office staff AND NOT a system
 *      author (automation/webhook/portal/api/jobnimbus).
 *
 * We don't whitelist Note/Phone Call/Email/Appointment/Task explicitly,
 * because if a rep performs anything else (custom record types,
 * inspection reports, etc.) it should still count. Match the strict
 * filter used by lib/jn-deep-funnel.ts so /chrisview/response-times and
 * /chrisview/funnel agree.
 */
function isManualAction(activity: JNActivity): boolean {
  const author = (activity.created_by_name || '').trim();
  if (!author) return false;
  if (isOfficeStaff(author)) return false;
  if (isSystemAuthor(author)) return false;

  const typeName = (activity.record_type_name || '').trim();
  if (EXCLUDED_ACTIVITY_TYPES_RE.test(typeName)) return false;

  // Reject status changes either via the boolean flag or via the type name
  if (activity.is_status_change) return false;

  // Exclude system/automation sources at the record level
  if (activity.source && (
    activity.source.startsWith('system') ||
    activity.source.includes('automation')
  )) return false;

  return true;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function gradeResponseTime(avgMinutes: number): string {
  if (avgMinutes <= 5) return 'A';
  if (avgMinutes <= 15) return 'B';
  if (avgMinutes <= 30) return 'C';
  if (avgMinutes <= 60) return 'D';
  return 'F';
}

/**
 * Direct JN fetch with cost-field redaction.
 *
 * `viewerCanSeeCost` defaults to FALSE (fail-safe). The only caller of this
 * module — queryResponseTimes — is a server-internal aggregator whose output
 * is reduced to counts/timestamps, so we can safely strip cost from the raw
 * response without losing information. If a future caller needs cost data
 * preserved, it must pass viewerCanSeeCost=true explicitly.
 */
async function jnFetch<T>(endpoint: string, viewerCanSeeCost: boolean = false): Promise<T> {
  if (!JN_API_KEY) throw new Error('JobNimbus API key not configured');

  const url = `${JN_API_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${JN_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`JN API error ${response.status}: ${await response.text()}`);
  }

  const raw = await response.json();
  return redactCostFieldsDeep(raw, viewerCanSeeCost) as T;
}

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: ResponseTimesResult;
  createdAt: number;
  key: string;
}

let responseCache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Main query function
// ---------------------------------------------------------------------------

export async function queryResponseTimes(opts: {
  days?: number;
  rep?: string;
}): Promise<ResponseTimesResult> {
  const days = opts.days || 30;
  const repFilter = opts.rep?.toLowerCase().trim();
  const cacheKey = `${days}:${repFilter || 'all'}`;
  
  // Check cache
  if (responseCache && responseCache.key === cacheKey && 
      Date.now() - responseCache.createdAt < CACHE_TTL_MS) {
    return responseCache.data;
  }
  
  const startTime = Date.now();
  const now = Math.floor(Date.now() / 1000);
  const sinceTimestamp = now - (days * 86400);
  
  // Step 1: Fetch contacts created in the date range
  // We paginate through all contacts and filter by created_by_name + date
  const officeContacts: JNContact[] = [];
  let offset = 0;
  const pageSize = 100;
  let hasMore = true;
  
  while (hasMore) {
    const result = await jnFetch<{ count: number; results: JNContact[] }>(
      `/contacts?limit=${pageSize}&offset=${offset}&sort=-date_created`
    );
    
    const contacts = result.results || [];
    if (contacts.length === 0) break;
    
    for (const c of contacts) {
      // Stop if we've gone past our date range
      if ((c.date_created || 0) < sinceTimestamp) {
        hasMore = false;
        break;
      }
      
      // Only contacts created by office staff
      if (!isOfficeStaff(c.created_by_name || '')) continue;
      
      // Must have a sales rep assigned
      if (!c.sales_rep_name) continue;
      
      // Apply rep filter if specified
      if (repFilter && !c.sales_rep_name.toLowerCase().includes(repFilter)) continue;
      
      officeContacts.push(c);
    }
    
    // If the last contact in this page is still in range, continue
    const lastContact = contacts[contacts.length - 1];
    if (hasMore && (lastContact?.date_created || 0) >= sinceTimestamp) {
      offset += pageSize;
    } else {
      hasMore = false;
    }
    
    // Safety: max 200 pages
    if (offset >= 20000) break;
  }
  
  // Step 2: For each office contact, find first manual activity by sales rep
  const leads: LeadResponseEntry[] = [];
  
  // Process in batches to avoid hammering the API
  for (let i = 0; i < officeContacts.length; i++) {
    const contact = officeContacts[i];
    
    // Fetch activities for this contact AND any related jobs. Per Michael's
    // 2026-05-20 correction: activities can be logged against the JOB record
    // rather than the contact directly, so we need to check both — otherwise
    // appts/notes logged on a job are missed.
    try {
      const seen = new Set<string>();
      const merged: JNActivity[] = [];
      const addAll = (arr?: JNActivity[]) => {
        for (const a of arr || []) {
          if (a.jnid && !seen.has(a.jnid)) { seen.add(a.jnid); merged.push(a); }
        }
      };

      // Contact activities (primary + related)
      const contactPrim = encodeURIComponent(JSON.stringify({ must: [{ term: { 'primary.id': contact.jnid } }] }));
      const contactRel = encodeURIComponent(JSON.stringify({ must: [{ term: { 'related.id': contact.jnid } }] }));
      const [byPrimary, byRelated] = await Promise.all([
        jnFetch<{ count?: number; results?: JNActivity[]; activity?: JNActivity[] }>(`/activities?filter=${contactPrim}&sort=date_created&limit=100`).catch(() => ({ results: [] as JNActivity[], activity: [] as JNActivity[] })),
        jnFetch<{ count?: number; results?: JNActivity[]; activity?: JNActivity[] }>(`/activities?filter=${contactRel}&sort=date_created&limit=100`).catch(() => ({ results: [] as JNActivity[], activity: [] as JNActivity[] })),
      ]);
      addAll(byPrimary.results || byPrimary.activity);
      addAll(byRelated.results || byRelated.activity);

      // Pull related jobs and also fetch their activities. Some reps log
      // appts/notes directly on the job — if we only check the contact, we miss them.
      try {
        const jobsRes = await jnFetch<{ results?: Array<{ jnid: string }> }>(
          `/jobs?filter=${encodeURIComponent(JSON.stringify({ must: [{ term: { 'primary.id': contact.jnid } }] }))}&limit=10`,
        ).catch(() => ({ results: [] as Array<{ jnid: string }> }));
        const jobs = jobsRes.results || [];
        for (const j of jobs) {
          const [jp, jr] = await Promise.all([
            jnFetch<{ results?: JNActivity[]; activity?: JNActivity[] }>(`/activities?filter=${encodeURIComponent(JSON.stringify({ must: [{ term: { 'primary.id': j.jnid } }] }))}&sort=date_created&limit=100`).catch(() => ({ results: [] as JNActivity[], activity: [] as JNActivity[] })),
            jnFetch<{ results?: JNActivity[]; activity?: JNActivity[] }>(`/activities?filter=${encodeURIComponent(JSON.stringify({ must: [{ term: { 'related.id': j.jnid } }] }))}&sort=date_created&limit=100`).catch(() => ({ results: [] as JNActivity[], activity: [] as JNActivity[] })),
          ]);
          addAll(jp.results || jp.activity);
          addAll(jr.results || jr.activity);
        }
      } catch {
        // ignore — job activities are best-effort
      }

      merged.sort((a, b) => (a.date_created || 0) - (b.date_created || 0));
      const activities = merged;

      // Find first manual action by ANY rep (not office, not system)
      let firstAction: JNActivity | null = null;

      for (const act of activities) {
        if ((act.date_created || 0) <= (contact.date_created || 0)) continue;
        if (!isManualAction(act)) continue;
        firstAction = act;
        break;
      }
      
      const responseMinutes = firstAction
        ? round1(((firstAction.date_created || 0) - (contact.date_created || 0)) / 60)
        : null;
      
      // Skip obviously bad data (negative or > 30 days)
      if (responseMinutes !== null && (responseMinutes < 0 || responseMinutes > 43200)) continue;
      
      leads.push({
        contactJnid: contact.jnid,
        contactName: contact.display_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
        repName: contact.sales_rep_name || 'Unknown',
        createdBy: contact.created_by_name || 'Unknown',
        leadSource: contact.source_name || 'Unknown',
        contactCreatedAt: contact.date_created || 0,
        firstActionAt: firstAction?.date_created || null,
        firstActionType: firstAction?.record_type_name || null,
        firstActionBy: firstAction?.created_by_name || null,
        responseMinutes,
      });
    } catch (err) {
      console.warn(`[ResponseTimes] Error fetching activities for ${contact.jnid}:`, err);
      continue;
    }
    
    // Rate limit: 200ms delay every 5 contacts
    if (i > 0 && i % 5 === 0) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  
  // Step 3: Calculate per-rep averages
  const repMap = new Map<string, { times: number[]; total: number; noResponse: number }>();
  
  for (const lead of leads) {
    if (!repMap.has(lead.repName)) {
      repMap.set(lead.repName, { times: [], total: 0, noResponse: 0 });
    }
    const rep = repMap.get(lead.repName)!;
    rep.total++;
    if (lead.responseMinutes !== null) {
      rep.times.push(lead.responseMinutes);
    } else {
      rep.noResponse++;
    }
  }
  
  const repAverages: RepAverage[] = [];
  for (const [name, data] of repMap) {
    const avg = data.times.length > 0
      ? round1(data.times.reduce((a, b) => a + b, 0) / data.times.length)
      : 0;
    
    repAverages.push({
      repName: name,
      avgMinutes: avg,
      medianMinutes: round1(median(data.times)),
      fastestMinutes: data.times.length > 0 ? round1(Math.min(...data.times)) : 0,
      slowestMinutes: data.times.length > 0 ? round1(Math.max(...data.times)) : 0,
      totalLeads: data.total,
      respondedLeads: data.times.length,
      noResponseLeads: data.noResponse,
      under5Min: data.times.filter(t => t <= 5).length,
      under15Min: data.times.filter(t => t <= 15).length,
      under30Min: data.times.filter(t => t <= 30).length,
      over60Min: data.times.filter(t => t > 60).length,
      grade: data.times.length > 0 ? gradeResponseTime(avg) : 'N/A',
    });
  }
  
  // Sort by avg response time (fastest first), push N/A to end
  repAverages.sort((a, b) => {
    if (a.grade === 'N/A' && b.grade !== 'N/A') return 1;
    if (b.grade === 'N/A' && a.grade !== 'N/A') return -1;
    return a.avgMinutes - b.avgMinutes;
  });
  
  // Overall summary
  const allTimes = leads.filter(l => l.responseMinutes !== null).map(l => l.responseMinutes!);
  
  const result: ResponseTimesResult = {
    repAverages,
    leads,
    summary: {
      totalLeads: leads.length,
      totalResponded: allTimes.length,
      overallAvgMinutes: allTimes.length > 0
        ? round1(allTimes.reduce((a, b) => a + b, 0) / allTimes.length)
        : 0,
      overallMedianMinutes: round1(median(allTimes)),
    },
    meta: {
      daysQueried: days,
      queryTimeMs: Date.now() - startTime,
      contactsFetched: officeContacts.length,
      timestamp: new Date().toISOString(),
    },
  };
  
  // Cache the result
  responseCache = { data: result, createdAt: Date.now(), key: cacheKey };
  
  return result;
}
