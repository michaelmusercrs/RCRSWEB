/**
 * Response Times Analytics API
 *
 * GET /api/analytics/response-times
 * Returns response time analytics across all data sources.
 *
 * Query params:
 *   - rep: string (filter by rep slug or name)
 *   - startDate: ISO date string
 *   - endDate: ISO date string
 *   - leadSource: string
 *
 * Results are cached for 5 minutes to avoid hammering Sheets/JN.
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeResponseTimes, AnalyticsFilters } from '@/lib/lead-response-analysis';
import { requireAuth } from '@/lib/auth-service';
import { cache, CACHE_TTL } from '@/lib/cache';

export async function GET(request: NextRequest) {
  // SECURITY: Require authentication — internal analytics data
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const timestamp = new Date().toISOString();

  try {
    const { searchParams } = new URL(request.url);

    const filters: AnalyticsFilters = {};

    const rep = searchParams.get('rep')?.trim();
    if (rep) filters.rep = rep;

    const startDate = searchParams.get('startDate')?.trim();
    if (startDate) filters.startDate = startDate;

    const endDate = searchParams.get('endDate')?.trim();
    if (endDate) filters.endDate = endDate;

    const leadSource = searchParams.get('leadSource')?.trim();
    if (leadSource) filters.leadSource = leadSource;

    const hasFilters = Object.keys(filters).length > 0;

    const cacheKey = `analytics:response-times:${JSON.stringify(filters)}`;
    const cached = cache.get<any>(cacheKey);
    if (cached) return NextResponse.json(cached.body, { status: 200, headers: cached.headers });

    const analytics = await analyzeResponseTimes(hasFilters ? filters : undefined);

    const responseBody = {
      success: true,
      data: analytics,
      filters: hasFilters ? filters : null,
      timestamp,
    };
    const responseHeaders = {
      'Cache-Control': 'private, max-age=60',
      'X-Data-Sources': analytics.dataSource,
    };
    cache.set(cacheKey, { body: responseBody, headers: responseHeaders }, CACHE_TTL.MEDIUM);

    return NextResponse.json(responseBody, { status: 200, headers: responseHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ResponseTimes API Error]', message);

    return NextResponse.json(
      {
        success: false,
        error: message,
        timestamp,
      },
      { status: 500 }
    );
  }
}
