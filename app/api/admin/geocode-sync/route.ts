// Admin Geocode Sync API
// POST: Trigger batch geocoding of all contacts (JobNimbus + Google Sheets Customers)
// GET: Check sync progress
// Uses Nominatim (free, no API key needed, 1 req/sec rate limit)

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { runGeocodeSync, getSyncProgress } from '@/lib/geocode-sync';

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    // Check if already running
    const currentProgress = getSyncProgress();
    if (['fetching', 'geocoding', 'saving'].includes(currentProgress.status)) {
      return NextResponse.json({
        success: false,
        error: 'Sync already in progress',
        progress: currentProgress,
      }, { status: 409 });
    }

    // Start sync in background (don't await - it can take minutes)
    runGeocodeSync().catch(err => {
      console.error('[GeocodeSync API] Background sync error:', err);
    });

    return NextResponse.json({
      success: true,
      message: 'Geocode sync started',
      progress: getSyncProgress(),
    });
  } catch (error) {
    console.error('Error starting geocode sync:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const progress = getSyncProgress();
    return NextResponse.json({
      success: true,
      progress,
    });
  } catch (error) {
    console.error('Error checking sync progress:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
