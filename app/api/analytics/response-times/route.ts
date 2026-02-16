/**
 * Response Times Analytics API
 *
 * GET /api/analytics/response-times
 * Returns response time analytics from JobNimbus API.
 *
 * Query params:
 *   - rep: string (filter by rep name)
 *   - days: number (default 30, how many days back to query)
 *   - startDate: ISO date string (legacy, still supported)
 *   - endDate: ISO date string (legacy, still supported)
 *   - leadSource: string (legacy)
 *   - source: 'jn' | 'legacy' (default 'jn' — use 'legacy' for old sheets-based analysis)
 *
 * Results are cached for 5 minutes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryResponseTimes } from '@/lib/jn-response-times';
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
    const source = searchParams.get('source')?.trim() || 'jn';

    // New JN-direct mode (default)
    if (source === 'jn') {
      const rep = searchParams.get('rep')?.trim();
      const daysParam = searchParams.get('days')?.trim();
      const days = daysParam ? parseInt(daysParam, 10) : 30;

      if (isNaN(days) || days < 1 || days > 365) {
        return NextResponse.json(
          { success: false, error: 'days must be between 1 and 365' },
          { status: 400 }
        );
      }

      const cacheKey = `analytics:response-times:jn:${days}:${rep || 'all'}`;
      const cached = cache.get<any>(cacheKey);
      if (cached) {
        return NextResponse.json(cached.body, { status: 200, headers: cached.headers });
      }

      const result = await queryResponseTimes({ days, rep: rep || undefined });

      const responseBody = {
        success: true,
        data: result,
        filters: { days, rep: rep || null },
        timestamp,
      };
      const responseHeaders = {
        'Cache-Control': 'private, max-age=60',
        'X-Data-Source': 'jobnimbus-api',
      };
      cache.set(cacheKey, { body: responseBody, headers: responseHeaders }, CACHE_TTL.MEDIUM);

      return NextResponse.json(responseBody, { status: 200, headers: responseHeaders });
    }

    // Legacy mode (sheets-based)
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

    const cacheKey = `analytics:response-times:legacy:${JSON.stringify(filters)}`;
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
