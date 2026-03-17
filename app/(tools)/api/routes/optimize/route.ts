/**
 * Route Optimization API — /api/routes/optimize
 *
 * POST: Optimize a route's stop order or a raw stops array
 */

import { NextRequest, NextResponse } from 'next/server';
import { routeTrackerService } from '@/lib/route-tracker-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/routes/optimize
 *
 * Body option A: { routeId } — optimize an existing saved route
 * Body option B: { stops: [{ lat, lng, ...}] } — optimize a raw stops array, returns order
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { routeId, stops } = body;

    if (routeId) {
      // Optimize an existing route
      const route = routeTrackerService.optimizeRoute(routeId);
      return NextResponse.json({ route, optimizedOrder: route.optimizedOrder });
    }

    if (stops && Array.isArray(stops) && stops.length > 0) {
      // Validate stops have lat/lng
      for (let i = 0; i < stops.length; i++) {
        if (typeof stops[i].lat !== 'number' || typeof stops[i].lng !== 'number') {
          return NextResponse.json(
            { error: `Stop at index ${i} missing lat/lng coordinates` },
            { status: 400 }
          );
        }
      }

      const optimizedOrder = routeTrackerService.optimizeStops(stops);

      // Build optimized stops in order
      const optimizedStops = optimizedOrder.map((idx) => stops[idx]);

      // Calculate total distance in the optimized order
      let totalMiles = 0;
      // From warehouse (Huntsville)
      const warehouseLat = 34.7304;
      const warehouseLng = -86.5861;

      if (optimizedStops.length > 0) {
        totalMiles += routeTrackerService.calculateDistance(
          warehouseLat,
          warehouseLng,
          optimizedStops[0].lat,
          optimizedStops[0].lng
        );
        for (let i = 1; i < optimizedStops.length; i++) {
          totalMiles += routeTrackerService.calculateDistance(
            optimizedStops[i - 1].lat,
            optimizedStops[i - 1].lng,
            optimizedStops[i].lat,
            optimizedStops[i].lng
          );
        }
      }

      return NextResponse.json({
        optimizedOrder,
        optimizedStops,
        totalMiles: Math.round(totalMiles * 10) / 10,
      });
    }

    return NextResponse.json(
      { error: 'Provide routeId or stops array' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[API] POST /api/routes/optimize error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to optimize route' },
      { status: 500 }
    );
  }
}
