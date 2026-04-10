/**
 * Gamification Leaderboard API
 *
 * GET /api/gamification/leaderboard
 * Query params:
 *   - period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'all_time'
 *           | 'lastWeek' | 'lastMonth' | 'last7Days' | 'last30Days' | 'last90Days'
 *           | 'custom' (default: 'all_time')
 *   - startDate: YYYY-MM-DD (required when period=custom)
 *   - endDate:   YYYY-MM-DD (required when period=custom)
 */

import { NextRequest, NextResponse } from 'next/server';
import { gamificationService, type LeaderboardPeriod } from '@/lib/gamification-service';

const VALID_PERIODS: LeaderboardPeriod[] = [
  'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'all_time',
  'lastWeek', 'lastMonth', 'last7Days', 'last30Days', 'last90Days',
  'custom',
];

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get('period') || 'all_time';
    const period: LeaderboardPeriod = VALID_PERIODS.includes(periodParam as LeaderboardPeriod)
      ? (periodParam as LeaderboardPeriod)
      : 'all_time';

    // Custom date range — required when period=custom, ignored otherwise
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    if (period === 'custom') {
      if (!startDate || !endDate) {
        return NextResponse.json(
          { success: false, error: 'Custom period requires startDate and endDate (YYYY-MM-DD)' },
          { status: 400 }
        );
      }
      if (!DATE_REGEX.test(startDate) || !DATE_REGEX.test(endDate)) {
        return NextResponse.json(
          { success: false, error: 'startDate and endDate must be YYYY-MM-DD format' },
          { status: 400 }
        );
      }
      if (startDate > endDate) {
        return NextResponse.json(
          { success: false, error: 'startDate must be on or before endDate' },
          { status: 400 }
        );
      }
    }

    // Also run achievement checks to keep data fresh
    await gamificationService.checkAllAchievements();

    const leaderboard = await gamificationService.getLeaderboard(period, startDate, endDate);
    const dailyChallenge = await gamificationService.getDailyChallenge();
    const activeContests = await gamificationService.getActiveContests();

    return NextResponse.json({
      success: true,
      data: {
        leaderboard,
        dailyChallenge,
        activeContests,
        period,
        dateRange: period === 'custom' ? { start: startDate, end: endDate } : undefined,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Gamification Leaderboard API Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load leaderboard',
      },
      { status: 500 }
    );
  }
}
