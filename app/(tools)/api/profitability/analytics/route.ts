/**
 * Profitability Analytics API — /api/profitability/analytics
 *
 * GET: Get profitability analytics (query: startDate, endDate, repSlug)
 */

import { NextRequest, NextResponse } from 'next/server';
import { profitabilityService } from '@/lib/profitability-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/profitability/analytics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const repSlug = searchParams.get('repSlug') || undefined;

    // If repSlug is provided, also return rep-specific profitability
    let repProfitability = null;
    if (repSlug) {
      repProfitability = profitabilityService.getRepProfitability(repSlug);
    }

    const analytics = profitabilityService.getAnalytics(startDate, endDate);

    return NextResponse.json({
      analytics,
      repProfitability,
    });
  } catch (error: any) {
    console.error('[API] GET /api/profitability/analytics error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch profitability analytics' },
      { status: 500 }
    );
  }
}
