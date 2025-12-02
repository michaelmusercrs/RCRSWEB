/**
 * Profile Views API
 * Tracks views of team member profiles using Google Sheets
 */

import { NextRequest, NextResponse } from 'next/server';
import { cmsSheetsService } from '@/lib/cms-sheets-service';

/**
 * GET /api/analytics/profile-views
 * Get profile view statistics
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const all = searchParams.get('all');

    if (all === 'true') {
      // Return stats for all profiles
      const stats = await cmsSheetsService.getProfileViewStats();
      return NextResponse.json({
        success: true,
        stats,
      });
    } else if (slug) {
      // Return stats for specific profile
      const stats = await cmsSheetsService.getProfileViewStats(slug);
      return NextResponse.json({
        success: true,
        stats,
      });
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
