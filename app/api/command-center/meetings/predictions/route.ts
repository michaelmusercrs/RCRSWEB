/**
 * RCRS Command Center - Rep Predictions API
 *
 * Provides pre-calculated rep statistics, goal predictions using the 85/10/5
 * blended formula, and anonymized company comparisons for personalized dashboards.
 *
 * GET /api/command-center/meetings/predictions
 * Query params:
 *   - rep: Rep first name (required, e.g. "Greg")
 *   - goal: Goal inspections (optional, e.g. "5") - triggers prediction
 *
 * Returns:
 *   - repStats: Full pre-calculated stats for the rep
 *   - companyStats: Summary company-wide averages (no individual rep data)
 *   - prediction: Goal prediction if ?goal= was provided
 *   - comparison: Anonymized strengths, vs-company rates, encouragement
 *
 * Auth required.
 *
 * @author RCRS Development Team
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { repStatsService } from '@/lib/rep-stats-service';

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    // Auth check
    const auth = await requireAuth();
    if (!auth.authenticated) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const repName = searchParams.get('rep');
    const goalParam = searchParams.get('goal');

    if (!repName || repName.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'Missing required query parameter: rep (e.g. ?rep=Greg)',
        timestamp,
      }, { status: 400 });
    }

    // Get rep stats
    const repStats = repStatsService.getRepStats(repName.trim());
    if (!repStats) {
      return NextResponse.json({
        success: false,
        error: `No data found for rep "${repName}". Check spelling or verify they have meeting number records.`,
        timestamp,
      }, { status: 404 });
    }

    // Get company stats (summary only - no individual rep data exposed)
    const companyStats = repStatsService.getCompanyStats();

    // Get anonymized comparison
    const comparison = repStatsService.getRepComparison(repName.trim());

    // Build response
    const responseData: Record<string, unknown> = {
      repStats,
      companyStats: {
        overallAverages: companyStats.overallAverages,
        momentum: companyStats.momentum,
        totalActiveReps: companyStats.totalActiveReps,
        totalWeeksOfData: companyStats.totalWeeksOfData,
        // Expose monthly averages for the current month only (not all months)
        currentMonthAverages: companyStats.monthlyAverages[new Date().getMonth() + 1] || null,
      },
      comparison,
    };

    // Goal prediction (only if goal parameter is provided)
    if (goalParam) {
      const goalInspections = parseInt(goalParam, 10);
      if (isNaN(goalInspections) || goalInspections < 1) {
        return NextResponse.json({
          success: false,
          error: 'Invalid goal parameter. Must be a positive integer (e.g. ?goal=5)',
          timestamp,
        }, { status: 400 });
      }

      const prediction = repStatsService.predictGoal(repName.trim(), goalInspections);
      if (prediction) {
        responseData.prediction = prediction;
      }
    }

    return NextResponse.json({
      success: true,
      data: responseData,
      dataSource: 'meeting-numbers',
      dataLabel: 'Pre-calculated from Monday meeting numbers (85/10/5 blended formula)',
      timestamp,
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    console.error('[Predictions API Error]', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp,
    }, { status: 500 });
  }
}
