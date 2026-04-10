/**
 * RCRS Command Center Calls API
 *
 * Provides call data for the command center dashboard.
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { callsService } from '@/lib/calls-service';

/**
 * GET /api/command-center/calls
 *
 * Get calls summary for command center dashboard
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);

    // Get recent calls
    const recentLimit = parseInt(searchParams.get('recent') || '10');
    const recentCalls = await callsService.getRecentCalls(recentLimit);

    // Get today's calls
    const todaysCalls = await callsService.getTodaysCalls();

    // Get overall stats
    const stats = await callsService.getStats();

    // Get 7-day analytics
    const analytics = await callsService.getAnalytics(7);

    // Calculate today's summary
    const todaySummary = {
      total: todaysCalls.length,
      inbound: todaysCalls.filter(c => c.direction === 'inbound').length,
      outbound: todaysCalls.filter(c => c.direction === 'outbound').length,
      missed: todaysCalls.filter(c => c.status === 'missed').length,
      completed: todaysCalls.filter(c => c.status === 'completed').length,
      totalDuration: todaysCalls.reduce((sum, c) => sum + c.duration, 0),
      activeReps: new Set(todaysCalls.map(c => c.repId).filter(Boolean)).size,
    };

    // Get calls that need attention (missed calls without follow-up)
    const needsAttention = todaysCalls
      .filter(c => c.status === 'missed' && !c.notes)
      .slice(0, 5);

    return NextResponse.json({
      today: todaySummary,
      recentCalls,
      needsAttention,
      stats,
      analytics: {
        dailyVolume: analytics.dailyVolume,
        topReps: analytics.byRep.slice(0, 5),
        peakHours: analytics.peakHours.slice(0, 3),
      },
    });
  } catch (error) {
    console.error('[Command Center Calls API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch call data' },
      { status: 500 }
    );
  }
}
