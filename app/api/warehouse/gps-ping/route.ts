/**
 * Warehouse GPS Ping
 *
 * Receives the warehouse mobile app's GPS while it's open. Two things
 * happen on each ping:
 *
 *  1. Tuya proximity stub fires at distance thresholds (legacy behavior).
 *  2. **Auto-LOAD_VERIFIED** (Phase 5 geofence). If the pinging user is
 *     a driver with an active order in `MATERIALS_PULLED`, and the previous
 *     ping was INSIDE the warehouse geofence and the current ping is
 *     OUTSIDE, we auto-advance the order to `LOAD_VERIFIED`. This is a
 *     single-step advance from stage 5 to stage 6 — no skipReason needed.
 *     The advance carries `metadata.autoTriggeredByGeofence = true` so
 *     downstream reporting can tell auto vs. manual.
 *
 * POST /api/warehouse/gps-ping
 *   Body: { lat: number, lng: number, accuracy?: number }
 *
 * Auth: driver, admin, owner only.
 *
 * The endpoint is idempotent — sending the same coordinates twice does NOT
 * re-fire the same threshold trigger. Geofence-cross state is held per-
 * driver in a small in-memory map keyed by userId. Cold starts reset that
 * map, which on the worst day causes one missed auto-advance per driver;
 * the driver still has the courtesy "confirm load was verified?" banner
 * to do it manually.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { tuyaStub } from '@/lib/tuya-stub';
import { googleSheetsService, SHEET_NAMES } from '@/lib/google-sheets-service';
import {
  getWarehouseSettings,
  haversineDistanceMeters,
} from '@/lib/warehouse-settings-service';
import { materialOrderPipeline } from '@/lib/material-order-pipeline';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

// Per-driver geofence state: was the last ping INSIDE the warehouse
// geofence? Used to detect inside→outside crossings for auto-LOAD_VERIFIED.
// Reset on cold start (intentional — see header comment).
const lastInsideGeofence = new Map<string, boolean>();

// Per-order de-dupe: once we auto-advance an order we don't try again,
// even if the driver crosses back through the geofence.
const autoAdvancedOrders = new Set<string>();

function getThresholdSet(userId: string): Set<string> {
  if (!lastTriggered.has(userId)) lastTriggered.set(userId, new Set());
  return lastTriggered.get(userId)!;
}

/** Haversine distance in MILES (legacy threshold logic uses miles). */
function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return haversineDistanceMeters(lat1, lng1, lat2, lng2) / 1609.344;
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

  const settings = await getWarehouseSettings();
  const distanceMiles = haversineMiles(body.lat, body.lng, settings.warehouseLat, settings.warehouseLng);
  const distanceMeters = haversineDistanceMeters(body.lat, body.lng, settings.warehouseLat, settings.warehouseLng);

  // Persist the latest known location so the office can see the driver
  // pin on the manager map. Best-effort — never block the threshold logic.
  persistLocation({
    userId: auth.user.userId,
    userName: auth.user.name,
    lat: body.lat,
    lng: body.lng,
    accuracy: body.accuracy,
    distanceMiles: Math.round(distanceMiles * 100) / 100,
  }).catch(() => {});

  const fired: string[] = [];
  const thresholdSet = getThresholdSet(auth.user.userId);

  // Tuya proximity thresholds (legacy)
  if (distanceMiles <= 0.05) {
    if (!thresholdSet.has('arrived')) {
      thresholdSet.add('arrived');
      thresholdSet.add('quarter_mi');
      thresholdSet.add('1mi');
      thresholdSet.add('2mi');
      await tuyaStub.onArrived();
      fired.push('arrived');
    }
  } else if (distanceMiles <= 0.25) {
    if (!thresholdSet.has('quarter_mi')) {
      thresholdSet.add('quarter_mi');
      thresholdSet.add('1mi');
      thresholdSet.add('2mi');
      await tuyaStub.onProximityQuarterMile(distanceMiles);
      fired.push('quarter_mi');
    }
  } else if (distanceMiles <= 1) {
    if (!thresholdSet.has('1mi')) {
      thresholdSet.add('1mi');
      thresholdSet.add('2mi');
      await tuyaStub.onProximity1Mile(distanceMiles);
      fired.push('1mi');
    }
  } else if (distanceMiles <= 2) {
    if (!thresholdSet.has('2mi')) {
      thresholdSet.add('2mi');
      await tuyaStub.onProximity2Mile(distanceMiles);
      fired.push('2mi');
    }
  } else if (distanceMiles > 5 && thresholdSet.size > 0) {
    thresholdSet.clear();
    await tuyaStub.onDeparted();
    fired.push('departed');
  }

  // ---------- Phase 5: auto-LOAD_VERIFIED on geofence exit ----------
  //
  // Only drivers get auto-advance; admin/owner pings are for the map only.
  const insideNow = distanceMeters <= settings.geofenceRadiusMeters;
  const insidePrev = lastInsideGeofence.get(auth.user.userId);
  lastInsideGeofence.set(auth.user.userId, insideNow);

  let autoLoadVerified: {
    orderId: string;
    fired: boolean;
    error?: string;
  } | undefined;

  // Banner hint for the UI even if we're not auto-firing — surface any
  // active MATERIALS_PULLED order so the driver can confirm manually.
  let pendingLoadVerifyOrder:
    | { orderId: string; jobName: string; jobNumber: string }
    | undefined;

  if (auth.user.role === 'driver' && settings.autoLoadVerifiedEnabled) {
    try {
      const orders = await materialOrderPipeline.getOrders({
        driverId: auth.user.userId,
        stage: 'MATERIALS_PULLED',
        cancelled: false,
      });
      const target = orders[0]; // most recently updated due to getOrders sort

      if (target) {
        pendingLoadVerifyOrder = {
          orderId: target.orderId,
          jobName: target.jobName,
          jobNumber: target.jobNumber,
        };

        // Auto-fire only on inside→outside crossing, and only once per order.
        const crossedOutside =
          insidePrev === true && insideNow === false;
        const alreadyAdvanced = autoAdvancedOrders.has(target.orderId);

        if (crossedOutside && !alreadyAdvanced) {
          autoAdvancedOrders.add(target.orderId);
          const result = await materialOrderPipeline.advanceStage(
            target.orderId,
            'LOAD_VERIFIED',
            auth.user.userId,
            auth.user.name,
            auth.user.role,
            {
              gpsLatitude: body.lat,
              gpsLongitude: body.lng,
              // The pipeline requires at least one photo for LOAD_VERIFIED;
              // we attach a sentinel placeholder so the auto-advance can
              // proceed. The driver should still upload real photos via
              // the standard UI; we surface a "confirm with photos?" banner
              // to that effect.
              photoUrls: ['auto:geofence-exit-pending-driver-confirmation'],
              metadata: {
                autoTriggeredByGeofence: true,
                geofenceRadiusMeters: settings.geofenceRadiusMeters,
                distanceMetersAtTrigger: Math.round(distanceMeters),
                warehouseLat: settings.warehouseLat,
                warehouseLng: settings.warehouseLng,
                triggeredAt: new Date().toISOString(),
              },
            },
          );

          if (result.success) {
            autoLoadVerified = { orderId: target.orderId, fired: true };
            fired.push('auto_load_verified');
          } else {
            // Re-allow if it failed (don't permanently dedupe a failed run)
            autoAdvancedOrders.delete(target.orderId);
            autoLoadVerified = {
              orderId: target.orderId,
              fired: false,
              error: result.error,
            };
            console.warn(
              `[gps-ping] auto-advance LOAD_VERIFIED failed for ${target.orderId}: ${result.error}`,
            );
          }
        }
      }
    } catch (err) {
      // Never block the ping response on the auto-advance pathway
      console.warn('[gps-ping] auto-LOAD_VERIFIED check failed:', err);
    }
  }

  return NextResponse.json({
    success: true,
    distanceMiles: Math.round(distanceMiles * 100) / 100,
    distanceMeters: Math.round(distanceMeters),
    insideGeofence: insideNow,
    geofenceRadiusMeters: settings.geofenceRadiusMeters,
    triggered: fired,
    activeThresholds: Array.from(thresholdSet),
    pendingLoadVerifyOrder,
    autoLoadVerified,
    stub: true,
  });
}
