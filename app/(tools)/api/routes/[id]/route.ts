/**
 * Route Detail API — /api/routes/[id]
 *
 * GET:   Get route details
 * PATCH: Update route (start, arrive, depart, complete, skip, optimize)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { routeTrackerService } from '@/lib/route-tracker-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/routes/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const route = await routeTrackerService.getRoute(params.id);
    if (!route) {
      return NextResponse.json(
        { error: 'Route not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ route });
  } catch (error: any) {
    console.error('[API] GET /api/routes/[id] error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch route' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/routes/[id]
 * Body: { action, stopId?, notes?, photos?, reason? }
 *
 * Actions:
 *  - start:    Start the route
 *  - arrive:   Mark arrival at stop (requires stopId)
 *  - depart:   Depart from stop (requires stopId, optional notes/photos)
 *  - complete: Complete the entire route
 *  - skip:     Skip a stop (requires stopId, reason)
 *  - optimize: Optimize the route stop order
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const body = await request.json();
    const { action, stopId, notes, photos, reason } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing required field: action' },
        { status: 400 }
      );
    }

    const routeId = params.id;

    switch (action) {
      case 'start': {
        const route = await routeTrackerService.startRoute(routeId);
        return NextResponse.json({ route });
      }

      case 'arrive': {
        if (!stopId) {
          return NextResponse.json(
            { error: 'Missing required field: stopId' },
            { status: 400 }
          );
        }
        const stop = await routeTrackerService.arriveAtStop(routeId, stopId);
        const route = await routeTrackerService.getRoute(routeId);
        return NextResponse.json({ stop, route });
      }

      case 'depart': {
        if (!stopId) {
          return NextResponse.json(
            { error: 'Missing required field: stopId' },
            { status: 400 }
          );
        }
        const stop = await routeTrackerService.departStop(
          routeId,
          stopId,
          notes,
          photos
        );
        const route = await routeTrackerService.getRoute(routeId);
        return NextResponse.json({ stop, route });
      }

      case 'complete': {
        const route = await routeTrackerService.completeRoute(routeId);
        return NextResponse.json({ route });
      }

      case 'skip': {
        if (!stopId || !reason) {
          return NextResponse.json(
            { error: 'Missing required fields: stopId, reason' },
            { status: 400 }
          );
        }
        const stop = await routeTrackerService.skipStop(routeId, stopId, reason);
        const route = await routeTrackerService.getRoute(routeId);
        return NextResponse.json({ stop, route });
      }

      case 'optimize': {
        const route = await routeTrackerService.optimizeRoute(routeId);
        return NextResponse.json({ route });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[API] PATCH /api/routes/[id] error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update route' },
      { status: 500 }
    );
  }
}
