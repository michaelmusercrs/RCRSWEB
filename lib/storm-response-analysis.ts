/**
 * Storm-to-Job Response Analysis.
 *
 * Overlays Hail Recon storm events on RCRS lead/job creation so we can
 * answer: when does a hailstorm hit, how many jobs/leads come out of it,
 * and how fast?
 *
 * Approach:
 *   1. Pull recent Hail Recon events for our north Alabama service area
 *      (lat ~34.7, lon ~-86.6) within a configurable window (default 90 d).
 *   2. Pull JN contacts created in the same window — they carry the JN
 *      `geo` field (lat/lng) per the 2026-05-21 probe.
 *   3. Pull JN jobs created in the same window (for the totals + per-storm
 *      job counts).
 *   4. For each storm, find contacts/jobs created within (a) 14 days AFTER
 *      the storm AND (b) within `MATCH_RADIUS_MILES` of the storm centroid.
 *
 * Cost-safe: no purchase-price fields read or surfaced.
 * Cache: writes via lib/chrisview-sheet-cache (slug `storm-response`).
 */

import { hailReconService, type HailReconEvent } from './hailrecon-service';
import { readChrisviewCache } from './chrisview-sheet-cache';

const JN_KEY = process.env.JOBNIMBUS_API_KEY;
const JN_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

// North Alabama service-area centroid (Huntsville area).
const SERVICE_CENTER_LAT = 34.7;
const SERVICE_CENTER_LON = -86.6;
const HAIL_SEARCH_RADIUS_MILES = 80;

// A lead/job counts as "from" a storm if it was created within
// MATCH_WINDOW_DAYS after the storm AND within MATCH_RADIUS_MILES of
// the storm's geo. Both must be true.
const MATCH_WINDOW_DAYS = 14;
const MATCH_RADIUS_MILES = 25;

// ─── Types ──────────────────────────────────────────────────────────────

interface JNContactGeo {
  jnid: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  date_created?: number;
  city?: string;
  state_text?: string;
  state?: string;
  geo?: { lat?: number; lng?: number; lon?: number };
  sales_rep_name?: string;
  source_name?: string;
  status_name?: string;
}
interface JNJobGeo {
  jnid: string;
  number?: string;
  date_created?: number;
  status_name?: string;
  sales_rep_name?: string;
  geo?: { lat?: number; lng?: number; lon?: number };
  primary?: { id?: string };
}

export interface StormRecord {
  date: string;
  hailSize: number;
  hailSizeLabel: string;
  latitude: number;
  longitude: number;
  county: string;
  state: string;
  location: string;
  source: string;
  affectedLeads: number;
  affectedJobs: number;
  /** First lead created within match window; null if none. */
  firstLeadAt: string | null;
  firstLeadHoursAfter: number | null;
}

export interface CountyAggregate {
  county: string;
  state: string;
  storms: number;
  affectedLeads: number;
  affectedJobs: number;
  maxHailSize: number;
  maxHailSizeLabel: string;
  leadsPerStorm: number;
}

export interface StormResponseAnalysis {
  generatedAt: string;
  windowDays: number;
  matchWindowDays: number;
  matchRadiusMiles: number;
  hailReconConfigured: boolean;
  hailDataAvailable: boolean;
  // Totals
  totalStorms: number;
  totalAffectedLeads: number;
  totalAffectedJobs: number;
  leadsPerStorm: number;
  biggestHailSize: number;
  biggestHailSizeLabel: string;
  // Drill-downs
  byStorm: StormRecord[];
  byCounty: CountyAggregate[];
  topRecentStorms: StormRecord[];
  // Diagnostics
  meta: {
    queryTimeMs: number;
    hailEventsFetched: number;
    contactsFetched: number;
    contactsWithGeo: number;
    contactsWithoutGeo: number;
    jobsFetched: number;
    jobsWithGeo: number;
    jobsWithoutGeo: number;
    note: string;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────

async function jnFetch<T>(endpoint: string): Promise<T> {
  if (!JN_KEY) throw new Error('JN key not configured');
  const r = await fetch(`${JN_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${JN_KEY}`, 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw new Error(`JN ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()) as T;
}

/** Haversine distance in miles between two lat/lon points. */
function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function contactLatLon(c: JNContactGeo): { lat: number; lon: number } | null {
  const lat = c.geo?.lat;
  const lon = c.geo?.lng ?? c.geo?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat === 0 && lon === 0) return null;
  return { lat, lon };
}
function jobLatLon(j: JNJobGeo): { lat: number; lon: number } | null {
  const lat = j.geo?.lat;
  const lon = j.geo?.lng ?? j.geo?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat === 0 && lon === 0) return null;
  return { lat, lon };
}

function getHailSizeLabel(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return 'unknown';
  if (size >= 4.5) return `${size}" (softball+)`;
  if (size >= 2.75) return `${size}" (baseball)`;
  if (size >= 2.0) return `${size}" (hen egg)`;
  if (size >= 1.75) return `${size}" (golf ball)`;
  if (size >= 1.5) return `${size}" (ping pong)`;
  if (size >= 1.0) return `${size}" (quarter)`;
  if (size >= 0.75) return `${size}" (penny)`;
  if (size >= 0.5) return `${size}" (marble)`;
  return `${size}" (pea)`;
}

// ─── Cache layer ────────────────────────────────────────────────────────

let _cache: { key: string; data: StormResponseAnalysis; at: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;
const SHEET_CACHE_MAX_AGE_MS = 90 * 60 * 1000;

// ─── Main analysis ──────────────────────────────────────────────────────

export async function analyzeStormResponse(
  opts: { days?: number } = {},
): Promise<StormResponseAnalysis> {
  const daysWindow = Math.min(Math.max(opts.days || 90, 1), 365);
  const cacheKey = `days:${daysWindow}`;
  if (_cache && _cache.key === cacheKey && Date.now() - _cache.at < CACHE_TTL_MS) {
    return _cache.data;
  }

  // Sheet cache only for the default 90-day window.
  if (daysWindow === 90) {
    try {
      const cached = await readChrisviewCache<StormResponseAnalysis>('storm-response');
      if (cached) {
        const age = Date.now() - new Date(cached.generatedAt).getTime();
        if (Number.isFinite(age) && age < SHEET_CACHE_MAX_AGE_MS) {
          _cache = { key: cacheKey, data: cached.payload, at: Date.now() };
          return cached.payload;
        }
      }
    } catch (err) {
      console.warn('[storm-response-analysis] sheet cache read failed:', err);
    }
  }

  const start = Date.now();
  const sinceSec = Math.floor(Date.now() / 1000) - daysWindow * 86400;

  // ─── 1. Pull Hail Recon area history ──────────────────────────────────
  const hailReport = await hailReconService
    .getAreaHailHistory(SERVICE_CENTER_LAT, SERVICE_CENTER_LON, HAIL_SEARCH_RADIUS_MILES)
    .catch(() => null);

  const allHail: HailReconEvent[] = hailReport?.events || [];
  // Filter to events within the window
  const sinceMs = Date.now() - daysWindow * 86400 * 1000;
  const windowedHail = allHail.filter(e => {
    const t = new Date(e.date).getTime();
    return Number.isFinite(t) && t >= sinceMs;
  });

  // ─── 2. Pull JN contacts in window ────────────────────────────────────
  const contacts: JNContactGeo[] = [];
  let contactsFetched = 0;
  let offset = 0;
  while (offset < 5000) {
    const res = await jnFetch<{ count?: number; results?: JNContactGeo[] }>(
      `/contacts?limit=100&offset=${offset}&sort=-date_created`,
    ).catch(() => ({ results: [] as JNContactGeo[] }));
    const page = res.results || [];
    if (!page.length) break;
    contactsFetched += page.length;
    let outOfRange = false;
    for (const c of page) {
      if ((c.date_created || 0) < sinceSec) {
        outOfRange = true;
        break;
      }
      contacts.push(c);
    }
    if (outOfRange) break;
    offset += 100;
  }

  // ─── 3. Pull JN jobs in window ────────────────────────────────────────
  const jobs: JNJobGeo[] = [];
  let jobsFetched = 0;
  offset = 0;
  while (offset < 5000) {
    const res = await jnFetch<{ count?: number; results?: JNJobGeo[] }>(
      `/jobs?limit=100&offset=${offset}&sort=-date_created`,
    ).catch(() => ({ results: [] as JNJobGeo[] }));
    const page = res.results || [];
    if (!page.length) break;
    jobsFetched += page.length;
    let outOfRange = false;
    for (const j of page) {
      if ((j.date_created || 0) < sinceSec) {
        outOfRange = true;
        break;
      }
      jobs.push(j);
    }
    if (outOfRange) break;
    offset += 100;
  }

  // ─── 4. Pre-compute geo for contacts / jobs ───────────────────────────
  const contactPoints = contacts
    .map(c => {
      const ll = contactLatLon(c);
      if (!ll) return null;
      return { jnid: c.jnid, lat: ll.lat, lon: ll.lon, t: (c.date_created || 0) * 1000 };
    })
    .filter((x): x is { jnid: string; lat: number; lon: number; t: number } => x !== null);

  const jobPoints = jobs
    .map(j => {
      const ll = jobLatLon(j);
      if (!ll) return null;
      return { jnid: j.jnid, lat: ll.lat, lon: ll.lon, t: (j.date_created || 0) * 1000 };
    })
    .filter((x): x is { jnid: string; lat: number; lon: number; t: number } => x !== null);

  const contactsWithGeo = contactPoints.length;
  const contactsWithoutGeo = contacts.length - contactsWithGeo;
  const jobsWithGeo = jobPoints.length;
  const jobsWithoutGeo = jobs.length - jobsWithGeo;

  // ─── 5. Per-storm match ───────────────────────────────────────────────
  const matchWindowMs = MATCH_WINDOW_DAYS * 86400 * 1000;

  const byStorm: StormRecord[] = windowedHail
    .filter(e => Number.isFinite(e.latitude) && Number.isFinite(e.longitude))
    .map(e => {
      const stormMs = new Date(e.date).getTime();
      const matched = contactPoints.filter(p => {
        if (p.t < stormMs || p.t > stormMs + matchWindowMs) return false;
        return distanceMiles(e.latitude, e.longitude, p.lat, p.lon) <= MATCH_RADIUS_MILES;
      });
      const matchedJobs = jobPoints.filter(p => {
        if (p.t < stormMs || p.t > stormMs + matchWindowMs) return false;
        return distanceMiles(e.latitude, e.longitude, p.lat, p.lon) <= MATCH_RADIUS_MILES;
      });
      const firstLead = matched.sort((a, b) => a.t - b.t)[0] || null;
      return {
        date: e.date,
        hailSize: e.hailSize,
        hailSizeLabel: e.hailSizeLabel || getHailSizeLabel(e.hailSize),
        latitude: e.latitude,
        longitude: e.longitude,
        county: e.county || '',
        state: e.state || '',
        location: e.location || '',
        source: e.source || 'HailRecon',
        affectedLeads: matched.length,
        affectedJobs: matchedJobs.length,
        firstLeadAt: firstLead ? new Date(firstLead.t).toISOString() : null,
        firstLeadHoursAfter: firstLead
          ? Math.round(((firstLead.t - stormMs) / 3600000) * 10) / 10
          : null,
      } satisfies StormRecord;
    });

  // ─── 6. County aggregates ─────────────────────────────────────────────
  const countyMap = new Map<string, CountyAggregate>();
  for (const s of byStorm) {
    const key = `${(s.county || 'Unknown').trim()}|${(s.state || '').trim()}`;
    const existing = countyMap.get(key);
    if (existing) {
      existing.storms += 1;
      existing.affectedLeads += s.affectedLeads;
      existing.affectedJobs += s.affectedJobs;
      if (s.hailSize > existing.maxHailSize) {
        existing.maxHailSize = s.hailSize;
        existing.maxHailSizeLabel = s.hailSizeLabel;
      }
    } else {
      countyMap.set(key, {
        county: s.county || 'Unknown',
        state: s.state || '',
        storms: 1,
        affectedLeads: s.affectedLeads,
        affectedJobs: s.affectedJobs,
        maxHailSize: s.hailSize,
        maxHailSizeLabel: s.hailSizeLabel,
        leadsPerStorm: 0,
      });
    }
  }
  const byCounty = Array.from(countyMap.values())
    .map(c => ({
      ...c,
      leadsPerStorm: c.storms > 0 ? Math.round((c.affectedLeads / c.storms) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.affectedLeads - a.affectedLeads || b.storms - a.storms);

  // ─── 7. Totals + top recent ───────────────────────────────────────────
  // De-dupe lead/job counts across storms — a contact 25 mi from two
  // separate storms shouldn't be counted twice in the rollup totals.
  const uniqueLeadIds = new Set<string>();
  const uniqueJobIds = new Set<string>();
  for (const e of windowedHail) {
    if (!Number.isFinite(e.latitude) || !Number.isFinite(e.longitude)) continue;
    const stormMs = new Date(e.date).getTime();
    for (const p of contactPoints) {
      if (p.t < stormMs || p.t > stormMs + matchWindowMs) continue;
      if (distanceMiles(e.latitude, e.longitude, p.lat, p.lon) <= MATCH_RADIUS_MILES) {
        uniqueLeadIds.add(p.jnid);
      }
    }
    for (const p of jobPoints) {
      if (p.t < stormMs || p.t > stormMs + matchWindowMs) continue;
      if (distanceMiles(e.latitude, e.longitude, p.lat, p.lon) <= MATCH_RADIUS_MILES) {
        uniqueJobIds.add(p.jnid);
      }
    }
  }

  const totalStorms = byStorm.length;
  const totalAffectedLeads = uniqueLeadIds.size;
  const totalAffectedJobs = uniqueJobIds.size;
  const leadsPerStorm =
    totalStorms > 0 ? Math.round((totalAffectedLeads / totalStorms) * 10) / 10 : 0;
  const biggestHailSize = byStorm.reduce((m, s) => (s.hailSize > m ? s.hailSize : m), 0);
  const biggestHailSizeLabel = biggestHailSize > 0 ? getHailSizeLabel(biggestHailSize) : 'None';

  const topRecentStorms = [...byStorm]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  // Sort byStorm by date desc for the on-page chart/table.
  byStorm.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const note = !hailReconService.isConfigured()
    ? 'Hail Recon API not configured (missing HAILRECON_API_KEY / HAILRECON_API_SECRET) — no storm overlay possible.'
    : !hailReport
      ? 'Hail Recon configured but no usable response from the API for this area. Likely an upstream coverage gap.'
      : windowedHail.length === 0
        ? `Hail Recon returned ${allHail.length} historic events but none in the last ${daysWindow} days for the service area.`
        : contactsWithoutGeo > 0
          ? `${contactsWithoutGeo} of ${contacts.length} contacts lack a JN geo field and cannot be matched to a storm by distance.`
          : 'OK';

  const result: StormResponseAnalysis = {
    generatedAt: new Date().toISOString(),
    windowDays: daysWindow,
    matchWindowDays: MATCH_WINDOW_DAYS,
    matchRadiusMiles: MATCH_RADIUS_MILES,
    hailReconConfigured: hailReconService.isConfigured(),
    hailDataAvailable: !!hailReport && windowedHail.length > 0,
    totalStorms,
    totalAffectedLeads,
    totalAffectedJobs,
    leadsPerStorm,
    biggestHailSize,
    biggestHailSizeLabel,
    byStorm,
    byCounty,
    topRecentStorms,
    meta: {
      queryTimeMs: Date.now() - start,
      hailEventsFetched: allHail.length,
      contactsFetched,
      contactsWithGeo,
      contactsWithoutGeo,
      jobsFetched,
      jobsWithGeo,
      jobsWithoutGeo,
      note,
    },
  };

  _cache = { key: cacheKey, data: result, at: Date.now() };
  return result;
}
