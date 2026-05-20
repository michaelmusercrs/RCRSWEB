/**
 * POST /api/admin/canvass/generate
 *
 * Generate a hail-canvass list for either:
 *   - a stored storm event (by stormEventId — looks up the stored
 *     Storm_Reports row to recover lat/lng/hail size), OR
 *   - a manual zone definition: { lat, lng, radiusMiles, hailSizeMin? }
 *
 * Returns the in-zone addresses (ONLY real on-file addresses) with a
 * computed damageProbability per address. No PII leaves the server —
 * the admin layout is auth-gated and this route is admin/owner-only.
 *
 * Per the build prompt: this route reuses the storm-report data layer
 * — it does NOT re-implement NOAA fetching. We call `fetchHailContextForZone`
 * which goes through the existing hailReconService singleton.
 *
 * See lib/hail-canvass-service.ts for the [needs-owner] note on
 * Madison County parcel GIS.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAtLeast } from '@/lib/auth-service';
import {
  findAddressesInZone,
  scoreDamageProbability,
  fetchHailContextForZone,
  listRecentStormEvents,
  type CanvassStormEvent,
  type CanvassAddress,
} from '@/lib/hail-canvass-service';

interface GenerateBody {
  stormEventId?: string;
  lat?: number;
  lng?: number;
  radiusMiles?: number;
  hailSizeMin?: number;
  date?: string;
  label?: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireRoleAtLeast(['owner', 'admin', 'manager']);
  if (!auth.authenticated) return auth.response;

  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  let stormEvent: CanvassStormEvent | null = null;

  // Path 1: storm event id — resolve from the recent storm events list.
  if (body.stormEventId) {
    const events = await listRecentStormEvents();
    const found = events.find(e => e.stormEventId === body.stormEventId);
    if (!found) {
      return NextResponse.json(
        {
          success: false,
          error: `Storm event ${body.stormEventId} not found in recent reports`,
        },
        { status: 404 },
      );
    }
    // Allow overriding the radius from the request — same id, wider sweep.
    stormEvent = {
      ...found,
      radiusMiles: body.radiusMiles ?? found.radiusMiles,
      hailSizeMin: body.hailSizeMin ?? found.hailSizeMin,
    };
  }

  // Path 2: manual coords.
  if (!stormEvent) {
    if (
      typeof body.lat !== 'number'
      || typeof body.lng !== 'number'
      || typeof body.radiusMiles !== 'number'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Provide stormEventId OR { lat, lng, radiusMiles }',
        },
        { status: 400 },
      );
    }
    if (body.radiusMiles <= 0 || body.radiusMiles > 100) {
      return NextResponse.json(
        { success: false, error: 'radiusMiles must be between 0 and 100' },
        { status: 400 },
      );
    }
    stormEvent = {
      stormEventId: `manual-${body.date || new Date().toISOString().slice(0, 10)}-${body.lat.toFixed(3)}-${body.lng.toFixed(3)}`,
      date: body.date || new Date().toISOString().slice(0, 10),
      lat: body.lat,
      lng: body.lng,
      radiusMiles: body.radiusMiles,
      hailSizeMin: body.hailSizeMin ?? 0,
      label: body.label,
    };
  }

  // Pull real addresses + hail context in parallel.
  const [addresses, hailContext] = await Promise.all([
    findAddressesInZone({
      lat: stormEvent.lat,
      lng: stormEvent.lng,
      radiusMiles: stormEvent.radiusMiles,
    }),
    fetchHailContextForZone({
      lat: stormEvent.lat,
      lng: stormEvent.lng,
      radiusMiles: stormEvent.radiusMiles,
    }),
  ]);

  // Score each address against the storm context.
  const scored: CanvassAddress[] = addresses.map(addr => ({
    ...addr,
    damageProbability: scoreDamageProbability({
      address: addr,
      stormEvent: stormEvent!,
      largestHailInches: hailContext.largestHailInches,
    }),
  }));

  // Default sort: highest damage probability first (UI can re-sort).
  scored.sort((a, b) => b.damageProbability - a.damageProbability);

  return NextResponse.json({
    success: true,
    data: {
      stormEvent,
      hailContext: {
        largestHailInches: hailContext.largestHailInches,
        totalEvents: hailContext.totalEvents,
        mostRecentDate: hailContext.mostRecentDate,
      },
      addresses: scored,
      count: scored.length,
      generatedAt: new Date().toISOString(),
      generatedBy: auth.user.email || auth.user.userId,
    },
  });
}

// ---------------------------------------------------------------------------
// GET — surface the recent storm events for the picker. Read-only.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const auth = await requireRoleAtLeast(['owner', 'admin', 'manager']);
  if (!auth.authenticated) return auth.response;

  const { searchParams } = new URL(request.url);
  const maxAgeDays = parseInt(searchParams.get('maxAgeDays') || '60', 10);

  const events = await listRecentStormEvents(isFinite(maxAgeDays) ? maxAgeDays : 60);

  return NextResponse.json({
    success: true,
    data: { events, count: events.length },
  });
}
