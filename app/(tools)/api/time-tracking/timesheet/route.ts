/**
 * RCRS Timesheet API
 *
 * GET   /api/time-tracking/timesheet - Get timesheet summary
 * POST  /api/time-tracking/timesheet - Submit timesheet for approval
 * PATCH /api/time-tracking/timesheet - Approve/reject timesheet
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { timeTrackingService } from '@/lib/time-tracking-service';

/**
 * GET /api/time-tracking/timesheet
 *
 * Query params:
 * - repSlug: specific rep (omit for team view)
 * - startDate: period start (YYYY-MM-DD)
 * - endDate: period end (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repSlug = searchParams.get('repSlug') || undefined;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    if (repSlug) {
      const summary = await timeTrackingService.getTimesheetSummary(repSlug, startDate, endDate);
      return NextResponse.json({ success: true, timesheet: summary });
    }

    // Team view
    const timesheets = await timeTrackingService.getTeamTimesheets(startDate, endDate);
    return NextResponse.json({
      success: true,
      timesheets,
      total: timesheets.length,
    });
  } catch (error) {
    console.error('[Timesheet API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timesheet' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/time-tracking/timesheet
 *
 * Submit a timesheet for approval.
 * Body: { repSlug, startDate, endDate }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const body = await request.json();
    const { repSlug, startDate, endDate } = body;

    if (!repSlug || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'repSlug, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    const summary = await timeTrackingService.getTimesheetSummary(repSlug, startDate, endDate);
    // Verify all entries are completed (not still active)
    const activeEntries = summary.entries.filter((e) => e.status === 'active');
    if (activeEntries.length > 0) {
      return NextResponse.json(
        { error: 'Cannot submit timesheet with active (unclosed) entries. Please clock out first.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Timesheet submitted for approval',
      timesheet: summary,
    });
  } catch (error) {
    console.error('[Timesheet API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to submit timesheet' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/time-tracking/timesheet
 *
 * Approve or reject a timesheet.
 * Body: { repSlug, startDate, endDate, action: 'approve'|'reject', approvedBy }
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const body = await request.json();
    const { repSlug, startDate, endDate, action, approvedBy } = body;

    if (!repSlug || !startDate || !endDate || !action || !approvedBy) {
      return NextResponse.json(
        { error: 'repSlug, startDate, endDate, action, and approvedBy are required' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    await timeTrackingService.approveTimesheet(
      repSlug,
      { start: startDate, end: endDate },
      approvedBy,
      action
    );

    const summary = await timeTrackingService.getTimesheetSummary(repSlug, startDate, endDate);

    return NextResponse.json({
      success: true,
      message: `Timesheet ${action}d successfully`,
      timesheet: summary,
    });
  } catch (error) {
    console.error('[Timesheet API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update timesheet' },
      { status: 500 }
    );
  }
}
