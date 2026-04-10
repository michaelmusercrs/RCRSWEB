/**
 * Loading Plan API
 *
 * Returns today's daily loading plan: optimized delivery route + load order
 * (heaviest first, last-stop-first), grouped by warehouse bay. Powers the
 * warehouse TV display and the loading-assist (TTS) walkthrough.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { loadingPlanService } from '@/lib/loading-plan-service';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || undefined;
    // Skip geocoding if explicitly requested (faster, useful for previews)
    const skipGeocode = searchParams.get('geocode') === 'false';

    const plan = await loadingPlanService.getDailyPlan(date, !skipGeocode);
    return NextResponse.json(plan);
  } catch (error) {
    console.error('[loading-plan] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to build loading plan' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'optimizeRoute') {
      if (!Array.isArray(body.orderIds) || body.orderIds.length === 0) {
        return NextResponse.json(
          { error: 'orderIds (non-empty array) required' },
          { status: 400 }
        );
      }
      const result = await loadingPlanService.optimizeRoute(body.orderIds);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('[loading-plan] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
