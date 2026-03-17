/**
 * RCRS Time Tracking API
 *
 * GET  /api/time-tracking - List time entries (query: repSlug, date, startDate, endDate, status)
 * POST /api/time-tracking - Clock in (body: repSlug, repName, category, notes, jobId)
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { timeTrackingService } from '@/lib/time-tracking-service';

/**
 * GET /api/time-tracking
 *
 * Query params:
 * - repSlug: filter by rep
 * - date: specific date (YYYY-MM-DD)
 * - startDate: range start
 * - endDate: range end
 * - status: active | completed | approved | rejected
 * - category: office | field | travel | training | meeting | admin
 * - active: "true" to get active entry for repSlug
 * - weekly: "true" to get weekly hours for repSlug
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repSlug = searchParams.get('repSlug') || undefined;
    const date = searchParams.get('date') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const status = searchParams.get('status') || undefined;
    const category = searchParams.get('category') || undefined;
    const active = searchParams.get('active');
    const weekly = searchParams.get('weekly');

    // Get active entry for a rep
    if (active === 'true' && repSlug) {
      const entry = timeTrackingService.getActiveEntry(repSlug);
      return NextResponse.json({ success: true, entry });
    }

    // Get weekly hours for a rep
    if (weekly === 'true' && repSlug) {
      const hours = timeTrackingService.getWeeklyHours(repSlug);
      return NextResponse.json({ success: true, hours });
    }

    const entries = timeTrackingService.getEntries({
      repSlug,
      date,
      startDate,
      endDate,
      status,
      category,
    });

    return NextResponse.json({
      success: true,
      entries,
      total: entries.length,
    });
  } catch (error) {
    console.error('[TimeTracking API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch time entries' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/time-tracking
 *
 * Clock in a rep.
 * Body: { repSlug, repName, category, notes?, jobId?, location? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { repSlug, repName, category } = body;
    if (!repSlug || !repName) {
      return NextResponse.json(
        { error: 'Missing required fields: repSlug, repName' },
        { status: 400 }
      );
    }

    const validCategories = ['office', 'field', 'travel', 'training', 'meeting', 'admin'];
    if (!category || !validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    const entry = timeTrackingService.clockIn(
      repSlug,
      repName,
      category,
      body.notes,
      body.jobId,
      body.location
    );

    return NextResponse.json({ success: true, entry }, { status: 201 });
  } catch (error: any) {
    console.error('[TimeTracking API] POST error:', error);
    const message = error?.message || 'Failed to clock in';
    const statusCode = message.includes('already clocked in') ? 409 : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
