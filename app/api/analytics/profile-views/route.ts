/**
 * Profile Views API
 * Tracks views of team member profiles using Google Sheets
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { cmsSheetsService } from '@/lib/cms-sheets-service';
import { cache, CACHE_TTL } from '@/lib/cache';

/**
 * GET /api/analytics/profile-views
 * Get profile view statistics
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const all = searchParams.get('all');

    const cacheKey = `analytics:profile-views:${slug || (all === 'true' ? 'all' : 'none')}`;
    const cached = cache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    if (all === 'true') {
      const stats = await cmsSheetsService.getProfileViewStats();
      const response = { success: true, stats };
      cache.set(cacheKey, response, CACHE_TTL.MEDIUM);
      return NextResponse.json(response);
    } else if (slug) {
      const stats = await cmsSheetsService.getProfileViewStats(slug);
      const response = { success: true, stats };
      cache.set(cacheKey, response, CACHE_TTL.MEDIUM);
      return NextResponse.json(response);
    } else {
      return NextResponse.json(
        { success: false, error: 'Missing slug or all parameter' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error fetching profile views:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch profile views' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analytics/profile-views
 * Record a profile view
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, teamMemberName, source } = body;

    if (!slug || !teamMemberName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const view = await cmsSheetsService.addProfileView({
      slug,
      teamMemberName,
      source,
    });

    cache.invalidatePattern('^analytics:profile-views:');
    return NextResponse.json({
      success: true,
      view,
    });
  } catch (error) {
    console.error('Error recording profile view:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record profile view' },
      { status: 500 }
    );
  }
}
