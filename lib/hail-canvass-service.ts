/**
 * Hail Auto-Canvass Service
 *
 * Moat win #1 from docs/research-crm-comparison.md: when a hail storm hits,
 * sales reps need a list of REAL addresses inside the impact zone so they
 * can door-knock. This service is the workflow layer that joins:
 *
 *   - storm event (NOAA hail data from existing storm-report API + HailRecon)
 *   - existing on-file addresses (Geocoded_Contacts sheet, populated from
 *     JobNimbus contacts + Customer Leads + door-knock notes)
 *
 * Hard rules (per the build prompt):
 *
 *   1. ONLY return addresses already on file. Never fabricate a homeowner
 *      list. Madison County parcel GIS is publicly reachable but is an
 *      owner-input gate — see [needs-owner] notes below.
 *   2. Reuse `lib/storm-report-service.ts` (which already wraps NOAA SPC +
 *      Iowa State Mesonet + HailRecon). Do NOT reimplement NOAA fetching.
 *   3. No notifications/emails from this service. Assignment writes a sheet
 *      row only. Owner activates the rep-ping channel later.
 */

import { googleSheetsService, type GeocodedContactRecord } from './google-sheets-service';
import { geocodingService } from './geocoding-service';
import { stormReportService } from './storm-report-service';
import { hailReconService, type HailReconEvent } from './hailrecon-service';

// ---------------------------------------------------------------------------
// HQ origin — used for "distance from RCRS HQ" sort. Matches the value the
// loading-plan service already uses (lib/loading-plan-service.ts).
// ---------------------------------------------------------------------------

export const RCRS_HQ_ORIGIN = {
  lat: 34.6059,
  lng: -86.9833,
  address: 'River City Roofing Solutions, Decatur, AL',
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CanvassStormEvent {
  /** Free-form identifier the UI uses to keep assignments idempotent. */
  stormEventId: string;
  /** When the storm rolled through (ISO date). */
  date: string;
  /** Storm center latitude. */
  lat: number;
  /** Storm center longitude. */
  lng: number;
  /** Search radius in miles around the center. */
  radiusMiles: number;
  /** Minimum hail size (inches) used when scoring damage probability. */
  hailSizeMin: number;
  /** Optional human-readable label for the UI / sheet row. */
  label?: string;
}

export interface CanvassAddress {
  /** Stable identifier — JobNimbus jnid when available, else a synthetic one. */
  id: string;
  /** Display name from the existing record. */
  name: string;
  /** Full street address. */
  address: string;
  lat: number;
  lng: number;
  /** Existing lead/customer status. Maps Geocoded_Contacts.type to our buckets. */
  leadStatus: 'new' | 'contacted' | 'customer' | 'door_knock' | 'referral' | 'unknown';
  /** Current rep assignment if any. */
  currentRep?: string;
  /** Source sheet (kept so the rep can audit-trace back). */
  source: 'jobnimbus' | 'sheets' | 'lead-portal' | 'door-knock';
  /** Distance in miles from the storm center. */
  distanceFromStormMiles: number;
  /** Distance in miles from RCRS HQ. */
  distanceFromHqMiles: number;
  /** 0-100 damage probability score from `scoreDamageProbability`. */
  damageProbability: number;
  /** Last interaction date from Geocoded_Contacts (helps de-prioritize fresh customers). */
  lastInteraction?: string;
}

export interface CanvassRoute {
  repSlug: string;
  addresses: CanvassAddress[];
  /** Centroid of the route — used as the map pin for "Rep X starts here". */
  centroid: { lat: number; lng: number };
  /** Total drive-ish miles (Haversine sum, not road network). */
  approxRouteMiles: number;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/**
 * Great-circle distance in miles. Mirrors `geocodingService.calculateDistance`
 * — duplicated here so this service has zero coupling beyond the singleton.
 */
function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return geocodingService.calculateDistance(lat1, lng1, lat2, lng2);
}

// ---------------------------------------------------------------------------
// findAddressesInZone — pulls REAL addresses from Geocoded_Contacts.
// ---------------------------------------------------------------------------

/**
 * Return every on-file address whose Haversine distance from {lat,lng}
 * is <= radiusMiles. Source: the existing Geocoded_Contacts sheet, which
 * `lib/geocode-sync.ts` already keeps populated from JobNimbus contacts
 * and the Customer Leads sheet.
 *
 * No external geocoding calls happen here — we only read what's already
 * geocoded. That keeps this service safe to run unauth'd in dev (no API
 * spend) and means the canvass list reflects the same data the rest of
 * the portal sees.
 *
 * [needs-owner] To expand beyond on-file addresses (e.g. canvass an
 * entire neighborhood whose homeowners we've never met), we'd plug
 * Madison County parcel GIS here:
 *   https://maps.madisoncountyal.gov/arcgis/rest/services/Public_Parcels/
 * That requires an owner sign-off because it returns owner names + mailing
 * addresses for every parcel and we need a privacy/compliance call before
 * we put that data in a rep's phone. Until that call is made, this stays
 * on-file-only.
 */
export async function findAddressesInZone(params: {
  lat: number;
  lng: number;
  radiusMiles: number;
}): Promise<CanvassAddress[]> {
  const { lat, lng, radiusMiles } = params;

  const contacts = await googleSheetsService.getGeocodedContacts();
  const inZone: CanvassAddress[] = [];

  for (const c of contacts) {
    const cLat = parseFloat(c.lat);
    const cLng = parseFloat(c.lng);
    if (!isFinite(cLat) || !isFinite(cLng)) continue;
    if (cLat === 0 && cLng === 0) continue;

    const dist = haversineMiles(lat, lng, cLat, cLng);
    if (dist > radiusMiles) continue;

    inZone.push(toCanvassAddress(c, cLat, cLng, dist));
  }

  // Stable sort: closest first.
  inZone.sort((a, b) => a.distanceFromStormMiles - b.distanceFromStormMiles);
  return inZone;
}

function toCanvassAddress(
  c: GeocodedContactRecord,
  cLat: number,
  cLng: number,
  distFromStorm: number,
): CanvassAddress {
  const status = mapTypeToLeadStatus(c.type);
  const source = mapTypeToSource(c.type);
  return {
    id: c.jnid || `gc-${c.placeId || `${cLat},${cLng}`}`,
    name: c.name || '(no name on file)',
    address: c.address || '',
    lat: cLat,
    lng: cLng,
    leadStatus: status,
    currentRep: c.salesRep || undefined,
    source,
    distanceFromStormMiles: round(distFromStorm, 2),
    distanceFromHqMiles: round(haversineMiles(RCRS_HQ_ORIGIN.lat, RCRS_HQ_ORIGIN.lng, cLat, cLng), 2),
    // damageProbability is filled in later by scoreDamageProbability — we
    // can't compute it until we know the storm context.
    damageProbability: 0,
    lastInteraction: c.lastInteraction || undefined,
  };
}

function mapTypeToLeadStatus(type: string): CanvassAddress['leadStatus'] {
  switch (type) {
    case 'contact':
      return 'contacted';
    case 'install':
      return 'customer';
    case 'lead':
      return 'new';
    case 'referral':
      return 'referral';
    case 'door_knock':
      return 'door_knock';
    default:
      return 'unknown';
  }
}

function mapTypeToSource(type: string): CanvassAddress['source'] {
  switch (type) {
    case 'door_knock':
      return 'door-knock';
    case 'lead':
      return 'lead-portal';
    case 'install':
    case 'contact':
      return 'jobnimbus';
    default:
      return 'sheets';
  }
}

// ---------------------------------------------------------------------------
// scoreDamageProbability — combines hail size + distance from storm path.
// ---------------------------------------------------------------------------

/**
 * Score (0-100) of how likely a roof is to have storm damage. Inputs are
 * the address (with its distance from the storm center already populated
 * by `findAddressesInZone`) and the storm event metadata.
 *
 * The formula is deliberately simple and explainable to a rep at the
 * door:
 *
 *   - Base score from hail size (inches). 1" = ~50, 1.75" = ~75,
 *     2.5"+ = ~95. This is the size half of the equation.
 *   - Distance decay. Inside 1 mile of the storm path we keep the full
 *     base. By the edge of the radius we drop to 30%. Linear in between.
 *   - Customer/rep activity penalty. If the address is already an
 *     install or has been contacted in the last 30 days, drop 10 points —
 *     we don't want reps walking up to a current customer with a
 *     storm-damage pitch.
 *
 * This intentionally does NOT consult any model or external API. It is a
 * deterministic heuristic so the rep can sort confidently, and so the
 * test surface is small.
 */
export function scoreDamageProbability(params: {
  address: CanvassAddress;
  stormEvent: CanvassStormEvent;
  /** Largest measured hail size in the area (optional override). */
  largestHailInches?: number;
}): number {
  const { address, stormEvent, largestHailInches } = params;

  const hailIn = Math.max(
    stormEvent.hailSizeMin || 0,
    largestHailInches || 0,
  );

  // Base score from hail size — clamp to 0..100.
  // 0.75" hail (the NWS severe threshold) sits at ~35,
  // 1.0" at ~50, 1.75" at ~75, 2.5" at ~95.
  let base = 0;
  if (hailIn <= 0) {
    base = 25; // wind-only event still warrants a canvass
  } else {
    base = clamp(20 + hailIn * 30, 25, 95);
  }

  // Distance decay: 100% inside 1mi, 30% at the radius edge.
  const dist = address.distanceFromStormMiles;
  const radius = Math.max(stormEvent.radiusMiles, 1);
  let distFactor: number;
  if (dist <= 1) {
    distFactor = 1.0;
  } else if (dist >= radius) {
    distFactor = 0.3;
  } else {
    distFactor = 1.0 - ((dist - 1) / (radius - 1)) * 0.7;
  }

  let score = base * distFactor;

  // Customer-status adjustment — don't pitch a current customer.
  if (address.leadStatus === 'customer') {
    score -= 10;
  }
  // Recently contacted is also de-prioritized.
  if (address.leadStatus === 'contacted' && wasRecentlyTouched(address.lastInteraction, 30)) {
    score -= 5;
  }

  return Math.round(clamp(score, 0, 100));
}

function wasRecentlyTouched(lastInteraction: string | undefined, days: number): boolean {
  if (!lastInteraction) return false;
  const t = new Date(lastInteraction).getTime();
  if (!isFinite(t)) return false;
  const ageDays = (Date.now() - t) / (1000 * 60 * 60 * 24);
  return ageDays <= days;
}

// ---------------------------------------------------------------------------
// splitForReps — geographic K-means so each rep gets a contiguous route.
// ---------------------------------------------------------------------------

/**
 * Partition the canvass addresses into `repCount` geographically-contiguous
 * routes using K-means in lat/lng space. We don't need road-aware routing
 * — the goal is "Aaron takes the east side, Brendon takes the west" so a
 * rep isn't bouncing across town.
 *
 * Why K-means (not OR-tools / Google Directions): zero external deps and
 * the input size is small (tens to low hundreds of points). The two
 * tradeoffs we accept:
 *
 *   - Centroids in lat/lng are not strictly distance-preserving. Within
 *     a 25mi radius around Decatur the lat/lng-to-mile ratio is stable
 *     enough that the error is well under 5% of cluster shape.
 *   - K-means doesn't guarantee equal cluster size. We follow up with a
 *     balancing pass that nudges the largest cluster's farthest points
 *     into the smallest cluster.
 */
export function splitForReps(params: {
  addresses: CanvassAddress[];
  repSlugs: string[];
  /** Tolerance for the balancing pass — cluster sizes within this many
   *  addresses of the average are considered balanced. */
  balanceTolerance?: number;
}): CanvassRoute[] {
  const { addresses, repSlugs } = params;
  const balanceTolerance = params.balanceTolerance ?? 2;

  if (addresses.length === 0 || repSlugs.length === 0) {
    return repSlugs.map(slug => ({
      repSlug: slug,
      addresses: [],
      centroid: { lat: RCRS_HQ_ORIGIN.lat, lng: RCRS_HQ_ORIGIN.lng },
      approxRouteMiles: 0,
    }));
  }

  const k = Math.min(repSlugs.length, addresses.length);

  // Initial centroids: pick `k` addresses spread out via a simple farthest-
  // point seed. Deterministic so tests are stable.
  const centroids: { lat: number; lng: number }[] = [addresses[0]];
  while (centroids.length < k) {
    let farthest: CanvassAddress | null = null;
    let farthestDist = -1;
    for (const addr of addresses) {
      const minDist = Math.min(
        ...centroids.map(c => haversineMiles(c.lat, c.lng, addr.lat, addr.lng)),
      );
      if (minDist > farthestDist) {
        farthestDist = minDist;
        farthest = addr;
      }
    }
    if (!farthest) break;
    centroids.push({ lat: farthest.lat, lng: farthest.lng });
  }

  let assignment: number[] = new Array(addresses.length).fill(0);

  // Lloyd's algorithm — fixed 20-iter cap so we always terminate.
  for (let iter = 0; iter < 20; iter++) {
    let changed = false;

    // E-step: assign each address to nearest centroid.
    for (let i = 0; i < addresses.length; i++) {
      const a = addresses[i];
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = haversineMiles(centroids[c].lat, centroids[c].lng, a.lat, a.lng);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = c;
        }
      }
      if (assignment[i] !== bestIdx) {
        assignment[i] = bestIdx;
        changed = true;
      }
    }

    // M-step: recompute centroids.
    const sums = new Array(k).fill(0).map(() => ({ lat: 0, lng: 0, n: 0 }));
    for (let i = 0; i < addresses.length; i++) {
      const c = assignment[i];
      sums[c].lat += addresses[i].lat;
      sums[c].lng += addresses[i].lng;
      sums[c].n += 1;
    }
    for (let c = 0; c < k; c++) {
      if (sums[c].n > 0) {
        centroids[c] = { lat: sums[c].lat / sums[c].n, lng: sums[c].lng / sums[c].n };
      }
    }

    if (!changed) break;
  }

  // Balancing pass — move farthest points from biggest cluster into
  // smallest cluster until within tolerance. Bounded to avoid loops.
  const avg = addresses.length / k;
  for (let pass = 0; pass < addresses.length; pass++) {
    const counts = new Array(k).fill(0);
    assignment.forEach(c => counts[c]++);
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    if (max - min <= balanceTolerance) break;

    const bigIdx = counts.indexOf(max);
    const smallIdx = counts.indexOf(min);

    // Find the point in `bigIdx` farthest from its centroid (the one
    // least cohesive to its current cluster) and reassign.
    let candidate = -1;
    let candidateDist = -1;
    for (let i = 0; i < addresses.length; i++) {
      if (assignment[i] !== bigIdx) continue;
      const d = haversineMiles(
        centroids[bigIdx].lat,
        centroids[bigIdx].lng,
        addresses[i].lat,
        addresses[i].lng,
      );
      if (d > candidateDist) {
        candidateDist = d;
        candidate = i;
      }
    }
    if (candidate < 0) break;
    assignment[candidate] = smallIdx;
  }

  // Build the routes.
  const routes: CanvassRoute[] = repSlugs.map((slug, c) => {
    const slugAddrs: CanvassAddress[] = [];
    for (let i = 0; i < addresses.length; i++) {
      if (assignment[i] === c) slugAddrs.push(addresses[i]);
    }
    // Sort each rep's list by distance from cluster centroid so the rep's
    // first stop is the most central — practical canvass walking order.
    const centroid = c < centroids.length
      ? centroids[c]
      : { lat: RCRS_HQ_ORIGIN.lat, lng: RCRS_HQ_ORIGIN.lng };

    slugAddrs.sort((a, b) =>
      haversineMiles(centroid.lat, centroid.lng, a.lat, a.lng)
      - haversineMiles(centroid.lat, centroid.lng, b.lat, b.lng),
    );

    // Approximate the route as the sum of pairwise hops in the sorted
    // order. Not optimal, but stable and order-of-magnitude correct.
    let routeMiles = 0;
    for (let i = 1; i < slugAddrs.length; i++) {
      routeMiles += haversineMiles(
        slugAddrs[i - 1].lat,
        slugAddrs[i - 1].lng,
        slugAddrs[i].lat,
        slugAddrs[i].lng,
      );
    }

    return {
      repSlug: slug,
      addresses: slugAddrs,
      centroid,
      approxRouteMiles: round(routeMiles, 2),
    };
  });

  return routes;
}

// ---------------------------------------------------------------------------
// fetchHailContextForZone — pulls the hail size around the zone via
// existing hailReconService. Reused by both the API route and the page so
// the storm size we show matches the storm size we score against.
// ---------------------------------------------------------------------------

export interface ZoneHailContext {
  largestHailInches: number;
  totalEvents: number;
  mostRecentDate?: string;
  events: HailReconEvent[];
}

export async function fetchHailContextForZone(params: {
  lat: number;
  lng: number;
  radiusMiles: number;
}): Promise<ZoneHailContext> {
  const { lat, lng, radiusMiles } = params;
  try {
    const report = await hailReconService.getAreaHailHistory(lat, lng, radiusMiles);
    if (!report) {
      return { largestHailInches: 0, totalEvents: 0, events: [] };
    }
    return {
      largestHailInches: report.largestHailSize || 0,
      totalEvents: report.totalStorms || report.events.length,
      mostRecentDate: report.mostRecentDate,
      events: report.events,
    };
  } catch (err) {
    console.warn('[hail-canvass] hailReconService failed, using zero context:', err);
    return { largestHailInches: 0, totalEvents: 0, events: [] };
  }
}

// ---------------------------------------------------------------------------
// Storm-event picker source — derive recent storm events from Storm_Reports
// sheet (existing data the public site already produces).
// ---------------------------------------------------------------------------

/**
 * Returns CanvassStormEvent candidates derived from the existing
 * Storm_Reports sheet. We piggyback on the work the public-site storm
 * report API has been doing: every time a customer ran a report, we
 * stored a row, and rows with large hail are good canvass candidates.
 *
 * [needs-owner] A direct NOAA SPC storm-events feed would be richer
 * (county-by-county storm history without waiting for a customer to
 * trigger a report). The Iowa State Mesonet endpoint that the storm-
 * report service already consumes (`weather-service.getHailReportsByZip`)
 * is per-zip — we'd need an owner-approved expansion of that service
 * to scan all 15 service counties on a cron. Leaving manual entry as
 * the primary path for now.
 */
export async function listRecentStormEvents(maxAgeDays = 60): Promise<CanvassStormEvent[]> {
  try {
    // Use the storm-report service's internal sheet by calling its
    // public lookup methods. We don't have an "all reports" accessor
    // exposed, so we go through the geocoded contacts to derive
    // candidate centers from large-hail reports. This is a pragmatic
    // stopgap until the owner approves a dedicated cron.
    const reports = await listStoredStormReports(maxAgeDays);
    return reports
      .filter(r => r.largestHailSizeNum >= 0.75) // NWS severe threshold
      .map(r => ({
        stormEventId: r.reportId,
        date: r.generatedAt?.slice(0, 10) || '',
        lat: r.lat ?? RCRS_HQ_ORIGIN.lat,
        lng: r.lng ?? RCRS_HQ_ORIGIN.lng,
        radiusMiles: 5,
        hailSizeMin: r.largestHailSizeNum,
        label: `${r.largestHailSize || `${r.largestHailSizeNum}"`} near ${r.city || r.zip}`,
      }));
  } catch (err) {
    console.warn('[hail-canvass] listRecentStormEvents failed:', err);
    return [];
  }
}

/**
 * Internal helper — reads the Storm_Reports sheet directly. Avoids
 * adding a new method to the storm-report-service singleton (which is
 * intentionally narrow) by going through the same GoogleSpreadsheet
 * path the service uses.
 *
 * Returns the slim shape we need for the picker, not the full report.
 */
async function listStoredStormReports(maxAgeDays: number): Promise<Array<{
  reportId: string;
  generatedAt: string;
  city: string;
  zip: string;
  lat?: number;
  lng?: number;
  largestHailSize: string;
  largestHailSizeNum: number;
}>> {
  const { GoogleSpreadsheet } = await import('google-spreadsheet');
  const { JWT } = await import('google-auth-library');

  const sheetsId = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
  if (!sheetsId) return [];

  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(sheetsId, auth);
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle['Storm_Reports'];
  if (!sheet) return [];

  const rows = await sheet.getRows();
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const results: Array<{
    reportId: string;
    generatedAt: string;
    city: string;
    zip: string;
    largestHailSize: string;
    largestHailSizeNum: number;
  }> = [];

  for (const row of rows) {
    const generatedAt = row.get('generatedAt') || '';
    const t = new Date(generatedAt).getTime();
    if (!isFinite(t) || t < cutoff) continue;
    results.push({
      reportId: row.get('reportId') || '',
      generatedAt,
      city: row.get('city') || '',
      zip: row.get('zip') || '',
      largestHailSize: row.get('largestHailSize') || '',
      largestHailSizeNum: parseFloat(row.get('largestHailSizeNum')) || 0,
    });
  }

  // Most recent first.
  results.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  return results;
}

// ---------------------------------------------------------------------------
// Canvass Routes sheet — persistence layer for rep assignments.
// Idempotent on (stormEventId, repSlug).
// ---------------------------------------------------------------------------

export const CANVASS_ROUTES_SHEET = 'Canvass Routes';

export const CANVASS_ROUTES_HEADERS = [
  'timestamp',
  'stormEventId',
  'repSlug',
  'addressCount',
  'addressesJson',
  'status',
  'assignedBy',
  'centroidLat',
  'centroidLng',
  'approxRouteMiles',
  'notes',
] as const;

export interface CanvassRouteRecord {
  timestamp: string;
  stormEventId: string;
  repSlug: string;
  addressCount: number;
  addressesJson: string;
  status: 'pending' | 'walked' | 'exhausted';
  assignedBy: string;
  centroidLat: string;
  centroidLng: string;
  approxRouteMiles: string;
  notes: string;
}

export async function recordCanvassAssignment(params: {
  stormEventId: string;
  route: CanvassRoute;
  assignedBy: string;
  notes?: string;
}): Promise<{ created: boolean; updated: boolean }> {
  const { GoogleSpreadsheet } = await import('google-spreadsheet');
  const { JWT } = await import('google-auth-library');

  const sheetsId = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
  if (!sheetsId) {
    throw new Error('GOOGLE_SHEETS_ID not configured — cannot persist canvass assignment');
  }

  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(sheetsId, auth);
  await doc.loadInfo();

  let sheet = doc.sheetsByTitle[CANVASS_ROUTES_SHEET];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: CANVASS_ROUTES_SHEET,
      headerValues: [...CANVASS_ROUTES_HEADERS],
    });
  }

  const rows = await sheet.getRows();
  const existing = rows.find(r =>
    r.get('stormEventId') === params.stormEventId
    && r.get('repSlug') === params.route.repSlug,
  );

  const payload: Omit<CanvassRouteRecord, never> = {
    timestamp: new Date().toISOString(),
    stormEventId: params.stormEventId,
    repSlug: params.route.repSlug,
    addressCount: params.route.addresses.length,
    addressesJson: JSON.stringify(params.route.addresses),
    status: 'pending',
    assignedBy: params.assignedBy,
    centroidLat: String(params.route.centroid.lat),
    centroidLng: String(params.route.centroid.lng),
    approxRouteMiles: String(params.route.approxRouteMiles),
    notes: params.notes || '',
  };

  if (existing) {
    // Idempotent update — same storm + same rep just refreshes the row.
    existing.assign(payload as unknown as Record<string, string | number | boolean>);
    await existing.save();
    return { created: false, updated: true };
  }

  await sheet.addRow(payload as unknown as Record<string, string | number | boolean>);
  return { created: true, updated: false };
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round(n: number, places: number): number {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}
