/**
 * Warehouse GPS Ping
 *
 * Receives Rick's GPS coordinates from the warehouse mobile app while it's
 * open. Computes distance to the warehouse and triggers Tuya stub events
 * at proximity thresholds. Once Tuya is wired, the same triggers fire the
 * real device commands.
 *
 * POST /api/warehouse/gps-ping
 *   Body: { lat: number, lng: number, accuracy?: number }
 *
 * Auth: driver, admin, owner only.
 *
 * The endpoint is idempotent — sending the same coordinates twice does NOT
 * re-fire the same threshold trigger. State is held in a small per-driver
 * map keyed by userId. On Vercel cold starts the map resets, which would
 * cause one duplicate trigger; tolerable for stub mode.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { tuyaStub } from '@/lib/tuya-stub';
import { googleSheetsService, SHEET_NAMES } from '@/lib/google-sheets-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// RCRS warehouse coordinates (Decatur, AL — 3325 Central Pkwy SW)
const WAREHOUSE_LAT = parseFloat(process.env.WAREHOUSE_LAT || '34.5536');
const WAREHOUSE_LNG = parseFloat(process.env.WAREHOUSE_LNG || '-86.9806');

const DRIVER_LOCATION_HEADERS = [
  'userId',
  'userName',
  'lat',
  'lng',
  'accuracy',
  'distanceMiles',
  'updatedAt',
];

// Persist the latest known location for each driver. We upsert by userId
// so the sheet has exactly one row per driver — the office reads it and
// renders the pin on the map. Older points are discarded; we don't need
// a track history for the live map.
async function persistLocation(input: {
  userId: string;
  userName: string;
  lat: number;
  lng: number;
  accuracy?: number;
  distanceMiles: number;
}): Promise<void> {
  try {
    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.DRIVER_LOCATIONS,
      DRIVER_LOCATION_HEADERS,
      'userId',
      {
        userId: input.userId,
        userName: input.userName,
        lat: input.lat,
        lng: input.lng,
        accuracy: input.accuracy ?? '',
        distanceMiles: input.distanceMiles,
        updatedAt: new Date().toISOString(),
      },
    );
  } catch (err) {
    console.warn('[gps-ping] Failed to persist driver location:', err);
  }
}

// Per-driver last-fired threshold map. Reset on cold start.
const lastTriggered = new Map<string, Set<string>>();

function getThresholdSet(userId: string): Set<string> {
  if (!lastTriggered.has(userId)) lastTriggered.set(userId, new Set());
  return lastTriggered.get(userId)!;
}

/** Haversine distance in miles between two lat/lng pairs */
function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const R = 3959; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!['driver', 'admin', 'owner'].includes(auth.user.role)) {
    return NextResponse.json({ error: 'Driver/admin/owner role required' }, { status: 403 });
  }

  let body: { lat?: number; lng?: number; accuracy?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body.lat !== 'number' || typeof body.lng !== 'number') {
    return NextResponse.json({ error: 'lat and lng (numbers) are required' }, { status: 400 });
  }

  const distance = haversineMiles(body.lat, body.lng, WAREHOUSE_LAT, WAREHOUSE_LNG);

  // Persist the latest known location so the office can see the driver
  // pin on the manager map. Best-effort — never block the threshold logic.
  persistLocation({
    userId: auth.user.userId,
    userName: auth.user.name,
    lat: body.lat,
    lng: body.lng,
    accuracy: body.accuracy,
    distanceMiles: Math.round(distance * 100) / 100,
  }).catch(() => {});

  const fired: string[] = [];
  const thresholdSet = getThresholdSet(auth.user.userId);

  // Check thresholds in order from far to near. Once Rick is inside a
  // threshold and we've fired it, we don't fire again until he goes outside
  // and back in (we drop the threshold from the set on departure).
  if (distance <= 0.05) {
    // Arrived (~265 ft)
    if (!thresholdSet.has('arrived')) {
      thresholdSet.add('arrived');
      thresholdSet.add('quarter_mi');
      thresholdSet.add('1mi');
      thresholdSet.add('2mi');
      await tuyaStub.onArrived();
      fired.push('arrived');
    }
  } else if (distance <= 0.25) {
    if (!thresholdSet.has('quarter_mi')) {
      thresholdSet.add('quarter_mi');
      thresholdSet.add('1mi');
      thresholdSet.add('2mi');
      await tuyaStub.onProximityQuarterMile(distance);
      fired.push('quarter_mi');
    }
  } else if (distance <= 1) {
    if (!thresholdSet.has('1mi')) {
      thresholdSet.add('1mi');
      thresholdSet.add('2mi');
      await tuyaStub.onProximity1Mile(distance);
      fired.push('1mi');
    }
  } else if (distance <= 2) {
    if (!thresholdSet.has('2mi')) {
      thresholdSet.add('2mi');
      await tuyaStub.onProximity2Mile(distance);
      fired.push('2mi');
    }
  } else if (distance > 5 && thresholdSet.size > 0) {
    // Departed — clear the threshold state and fire onDeparted once
    thresholdSet.clear();
    await tuyaStub.onDeparted();
    fired.push('departed');
  }

  return NextResponse.json({
    success: true,
    distanceMiles: Math.round(distance * 100) / 100,
    triggered: fired,
    activeThresholds: Array.from(thresholdSet),
    stub: true,
  });
}
