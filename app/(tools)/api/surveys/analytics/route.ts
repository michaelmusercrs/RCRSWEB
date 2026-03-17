/**
 * RCRS Survey Analytics API
 *
 * GET /api/surveys/analytics - Get survey analytics and insights
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { customerSurveyService } from '@/lib/customer-survey-service';

/**
 * GET /api/surveys/analytics
 *
 * Query params:
 * - surveyId: filter by specific survey (optional)
 * - startDate: date range start (YYYY-MM-DD)
 * - endDate: date range end (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const dateRange = startDate && endDate
      ? { start: startDate, end: endDate }
      : undefined;

    const analytics = customerSurveyService.getAnalytics(surveyId, dateRange);

    return NextResponse.json({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error('[Survey Analytics API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
