// Lead Metrics Dashboard API
// GET: Returns KPIs, rep metrics, active timers, and recent distributions

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { leadMetricsService } from '@/lib/lead-metrics-service';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const repSlug = searchParams.get('repSlug');

    // If a specific rep is requested, return only their metrics
    if (repSlug) {
      const repMetric = await leadMetricsService.getRepMetric(repSlug);

      if (!repMetric) {
        return NextResponse.json(
          { success: false, error: `Rep "${repSlug}" not found` },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: repMetric,
      });
    }

    // Otherwise return the full dashboard payload
    const [kpis, reps, activeTimers, recentDistributions] = await Promise.all([
      leadMetricsService.getKPIMetrics(),
      leadMetricsService.getRepMetrics(),
      Promise.resolve(leadMetricsService.getActiveTimerStates()),
      leadMetricsService.getDistributionHistory(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        kpis,
        reps,
        activeTimers,
        recentDistributions,
      },
    });
  } catch (error) {
    console.error('[Leads Metrics API] Error fetching metrics:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
