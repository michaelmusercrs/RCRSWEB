/**
 * Page Views API
 * Tracks and reports page view analytics using Google Sheets
 */

import { NextRequest, NextResponse } from 'next/server';
import { cmsSheetsService } from '@/lib/cms-sheets-service';

/**
 * GET /api/analytics/page-views
 * Get page view statistics
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path');

    const stats = await cmsSheetsService.getPageViewStats(path || undefined);

    return NextResponse.json({
      success: true,
      stats,
    });
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
