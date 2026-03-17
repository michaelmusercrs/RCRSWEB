/**
 * RCRS Command Center - Meeting Numbers Sync API
 *
 * Triggers a fresh sync of Monday meeting numbers from the Google Sheet
 * to the local data/meeting-numbers-{year}.json cache file.
 *
 * POST /api/command-center/meetings/sync
 *   Body (optional):
 *     - year: number (default: current year)
 *
 * GET /api/command-center/meetings/sync
 *   Returns last sync info and current data stats.
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { meetingNumbersService } from '@/lib/meeting-numbers-service';

// Track last sync time in memory (resets on deploy/restart)
let lastSyncTime: string | null = null;
let lastSyncResult: { success: boolean; recordCount: number; error?: string } | null = null;

// =============================================================================
// GET - Sync status and data summary
// =============================================================================

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const allData = meetingNumbersService.loadAllData();
    const weekDates = meetingNumbersService.getWeekDates();
    const reps = meetingNumbersService.getAllReps();
    const latestDate = meetingNumbersService.getLatestMeetingDate();

    return NextResponse.json({
      success: true,
      data: {
        totalRecords: allData.length,
        totalWeeks: weekDates.length,
        totalReps: reps.length,
        reps,
        latestMeetingDate: latestDate,
        dateRange: weekDates.length > 0
          ? { earliest: weekDates[0], latest: weekDates[weekDates.length - 1] }
          : null,
        lastSync: lastSyncTime
          ? { time: lastSyncTime, result: lastSyncResult }
          : null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Meeting Sync API] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get sync status',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Trigger sync from Google Sheet
// =============================================================================

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const year = body.year ? parseInt(body.year, 10) : undefined;

    // Validate year if provided
    if (year !== undefined && (isNaN(year) || year < 2019 || year > 2030)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid year. Must be between 2019 and 2030.',
        },
        { status: 400 }
      );
    }

    const targetYear = year || new Date().getFullYear();

    // Run the sync
    const result = await meetingNumbersService.syncFromSheet(targetYear);

    // Track sync time
    lastSyncTime = new Date().toISOString();
    lastSyncResult = result;

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Sync failed',
          timestamp: lastSyncTime,
        },
        { status: 500 }
      );
    }

    // Reload data to get fresh stats
    const allData = meetingNumbersService.loadAllData();
    const reps = meetingNumbersService.getAllReps();
    const latestDate = meetingNumbersService.getLatestMeetingDate();

    return NextResponse.json({
      success: true,
      message: `Synced ${result.recordCount} records for ${targetYear} from Google Sheet`,
      data: {
        year: targetYear,
        recordCount: result.recordCount,
        totalRecordsLoaded: allData.length,
        reps,
        latestMeetingDate: latestDate,
      },
      timestamp: lastSyncTime,
    });
  } catch (error) {
    console.error('[Meeting Sync API] POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 }
    );
  }
}
