/**
 * Page Views API
 * Tracks and reports page view analytics using Google Sheets
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { cmsSheetsService } from '@/lib/cms-sheets-service';
import { cache, CACHE_TTL } from '@/lib/cache';

/**
 * GET /api/analytics/page-views
 * Get page view statistics
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path');

    const cacheKey = `analytics:page-views:${path || 'all'}`;
    const cached = cache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    const stats = await cmsSheetsService.getPageViewStats(path || undefined);

    const response = {
      success: true,
      stats,
    };
    cache.set(cacheKey, response, CACHE_TTL.MEDIUM);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching page views:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch page views' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analytics/page-views
 * Record a page view
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { path: viewPath, referrer } = body;

    if (!viewPath) {
      return NextResponse.json(
        { success: false, error: 'Missing path' },
        { status: 400 }
      );
    }

    const view = await cmsSheetsService.addPageView({
      path: viewPath,
      referrer,
    });

    cache.invalidatePattern('^analytics:page-views:');
    return NextResponse.json({
      success: true,
      view,
    });
  } catch (error) {
    console.error('Error recording page view:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record page view' },
      { status: 500 }
    );
  }
}
