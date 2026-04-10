/**
 * RCRS Call Analytics API
 *
 * Get detailed call analytics for reporting and dashboards.
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { callsService } from '@/lib/calls-service';

/**
 * GET /api/calls/analytics
 *
 * Get call analytics with optional date range
 *
 * Query params:
 * - days: Number of days to analyze (default 30)
 * - repId: Filter by rep
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const daysBack = parseInt(searchParams.get('days') || '30');
    const repId = searchParams.get('repId');

    // Get analytics
    const analytics = await callsService.getAnalytics(daysBack);
    const stats = await callsService.getStats();

    // Filter by rep if specified
    let filteredAnalytics = analytics;
    if (repId) {
      filteredAnalytics = {
        ...analytics,
        byRep: analytics.byRep.filter(r => r.repId === repId),
      };
    }

    // Get today's calls
    const todaysCalls = await callsService.getTodaysCalls();

    // Calculate additional metrics
    const todaysStats = {
      totalCalls: todaysCalls.length,
      inboundCalls: todaysCalls.filter(c => c.direction === 'inbound').length,
      outboundCalls: todaysCalls.filter(c => c.direction === 'outbound').length,
      missedCalls: todaysCalls.filter(c => c.status === 'missed').length,
      completedCalls: todaysCalls.filter(c => c.status === 'completed').length,
      totalDuration: todaysCalls.reduce((sum, c) => sum + c.duration, 0),
    };

    return NextResponse.json({
      analytics: filteredAnalytics,
      stats,
      today: todaysStats,
      period: {
        days: daysBack,
        startDate: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Call Analytics API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
