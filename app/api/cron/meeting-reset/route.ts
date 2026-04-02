// Cron Job: Monday 11 AM Central Meeting Reset
// Runs every Monday at 16:00 UTC (11:00 AM CDT / 10:00 AM CST).
// Syncs meeting numbers from Google Sheets to ensure fresh data at the
// weekly boundary. The "reset" is conceptual — the leaderboard already
// filters by date ranges. This cron ensures data is fresh and marks the
// new week boundary.

import { NextRequest, NextResponse } from 'next/server';
import { meetingNumbersService } from '@/lib/meeting-numbers-service';

// Verify the request is from Vercel Cron or has the correct secret
function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // If no secret configured, allow (dev mode)

  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  const resetDate = new Date().toISOString();
  console.log(`[meeting-reset] Weekly reset triggered at ${resetDate}`);

  try {
    // Sync latest data from Google Sheets
    const syncResult = await meetingNumbersService.syncFromSheet();

    console.log(
      `[meeting-reset] Sync complete: ${syncResult.success ? 'OK' : 'FAILED'}` +
      ` — ${syncResult.recordCount} records` +
      (syncResult.error ? ` — ${syncResult.error}` : ''),
    );

    return NextResponse.json({
      success: syncResult.success,
      message: syncResult.success
        ? 'Weekly meeting reset complete. Data synced from Google Sheets.'
        : `Weekly meeting reset sync failed: ${syncResult.error}`,
      syncResult,
      resetDate,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[meeting-reset] Failed:', message);

    return NextResponse.json(
      {
        success: false,
        message: `Weekly meeting reset failed: ${message}`,
        syncResult: null,
        resetDate,
      },
      { status: 500 },
    );
  }
}
