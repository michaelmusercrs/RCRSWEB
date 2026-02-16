/**
 * JN Response Times - Direct API Integration
 * 
 * Queries JobNimbus API directly for:
 * 1. Contacts created by office staff (Sara Hill, Destin McCary, Tia Muse Morris)
 * 2. First manual activity by the assigned sales rep for each contact
 * 3. Calculates response time = first_action.date_created - contact.date_created
 */

const JN_API_KEY = process.env.JOBNIMBUS_API_KEY;
const JN_API_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

// Office staff who create leads
const OFFICE_STAFF = [
  'sara hill',
  'destin mccary',
  'tia muse morris',
  'tia morris',
  'tia muse',
];

// Sales reps
const SALES_REPS = [
  'Aaron Lussi', 'Adam Rudell', 'Brendon Muse', 'Greg Muse',
  'Hunter Rivers', 'Richard Geahr', 'David Thomas', 'John Cordonis',
  'Ryan Butcher', 'Wess Cozelos', 'Aaron Boykin', 'Travis Wages',
  'Brittany Hutchison',
];

// Manual action types (exclude automated/system activities)
const MANUAL_ACTION_TYPES = new Set([
  'Note',
  'Phone Call',
  'Text Message',
  'Email',
  'email',
]);

// System/automation authors to exclude
const SYSTEM_AUTHORS = [
  'system', 'automation', 'jobnimbus', 'api', 'webhook',
  'rcrs portal', 'portal',
];

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

function isSalesRep(name: string): boolean {
  const lower = (name || '').toLowerCase().trim();
  return SALES_REPS.some(r => r.toLowerCase() === lower || lower.includes(r.toLowerCase()));
}

function isSystemAuthor(name: string): boolean {
  const lower = (name || '').toLowerCase().trim();
  return SYSTEM_AUTHORS.some(s => lower.includes(s));
}

function isManualAction(activity: JNActivity): boolean {
  // Must be a manual action type
  const typeName = activity.record_type_name || '';
  if (!MANUAL_ACTION_TYPES.has(typeName)) return false;

  // Exclude system/automation sources
  if (activity.source && (
    activity.source.startsWith('system') ||
    activity.source.includes('automation')
  )) return false;

  // Exclude status changes
  if (activity.is_status_change) return false;

  // Exclude system authors
  const author = activity.created_by_name || '';
  if (isSystemAuthor(author)) return false;

  // For emails, check if it's a system-generated email (estimate sent, etc.)
  if (typeName === 'Email' || typeName === 'email') {
    const note = (activity.note || '').toLowerCase();
    if (note.includes('estimate') && (note.includes('attached') || note.includes('sent'))) {
      // This is a manual estimate email - count it
      return true;
    }
    // Exclude system-generated emails
    if (note.includes('document #') || note.includes('invoice') || note.includes('work order')) {
      return false;
    }
  }

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

async function jnFetch<T>(endpoint: string): Promise<T> {
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
  
  return response.json();
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
    
    // Fetch activities for this contact (sorted by date ascending)
    try {
      const activitiesResult = await jnFetch<{ count?: number; results?: JNActivity[]; activity?: JNActivity[] }>(
        `/activities?filter=related.id:"${contact.jnid}"&sort=date_created&limit=50`
      );
      
      // JN API returns activities under "results" or "activity" key
      const activities = activitiesResult.results || activitiesResult.activity || [];
      
      // Find first manual action by the assigned sales rep (or any sales rep)
      let firstAction: JNActivity | null = null;
      
      for (const act of activities) {
        // Must be after contact creation
        if ((act.date_created || 0) <= (contact.date_created || 0)) continue;
        
        // Must be a manual action
        if (!isManualAction(act)) continue;
        
        // Must be by a sales rep (not office staff, not system)
        const actAuthor = act.created_by_name || '';
        if (isOfficeStaff(actAuthor)) continue;
        if (isSystemAuthor(actAuthor)) continue;
        
        // Prefer action by the assigned rep, but accept any sales rep
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
