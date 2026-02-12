import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { unifiedDataService, getCommandCenterQuickStats } from '@/lib/unified-data-service';

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    // Get comprehensive command center stats from unified data service
    const stats = await getCommandCenterQuickStats();

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching command center stats:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch stats',
      data: null,
    }, { status: 500 });
  }
}

export async function POST() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    // Force refresh all cached data
    await unifiedDataService.refreshAll();

    const stats = await getCommandCenterQuickStats();

    return NextResponse.json({
      success: true,
      message: 'Cache refreshed',
      data: stats,
    });
  } catch (error) {
    console.error('Error refreshing stats:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to refresh stats',
    }, { status: 500 });
  }
}
