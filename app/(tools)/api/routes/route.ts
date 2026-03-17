/**
 * Routes API — /api/routes
 *
 * GET:  List routes (query: driverId, date, status, limit)
 * POST: Create a new route
 */

import { NextRequest, NextResponse } from 'next/server';
import { routeTrackerService } from '@/lib/route-tracker-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/routes
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get('driverId') || undefined;
    const date = searchParams.get('date') || undefined;
    const status = searchParams.get('status') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const routes = routeTrackerService.listRoutes({
      driverId,
      date,
      status,
      limit,
    });

    const analytics = routeTrackerService.getAnalytics();

    return NextResponse.json({
      routes,
      analytics,
      total: routes.length,
    });
  } catch (error: any) {
    console.error('[API] GET /api/routes error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch routes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/routes
 * Body: { driverId, driverName, date, stops, vehicleId? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { driverId, driverName, date, stops, vehicleId } = body;

    if (!driverId || !driverName || !date || !stops || !Array.isArray(stops)) {
      return NextResponse.json(
        { error: 'Missing required fields: driverId, driverName, date, stops' },
        { status: 400 }
      );
    }

    if (stops.length === 0) {
      return NextResponse.json(
        { error: 'Route must have at least one stop' },
        { status: 400 }
      );
    }

    const route = routeTrackerService.createRoute(
      driverId,
      driverName,
      date,
      stops,
      vehicleId
    );

    return NextResponse.json({ route }, { status: 201 });
  } catch (error: any) {
    console.error('[API] POST /api/routes error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create route' },
      { status: 500 }
    );
  }
}
