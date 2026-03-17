/**
 * Gamification Leaderboard API
 *
 * GET /api/gamification/leaderboard
 * Query params:
 *   - period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'all_time' (default: 'all_time')
 */

import { NextRequest, NextResponse } from 'next/server';
import { gamificationService } from '@/lib/gamification-service';

type ValidPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'all_time';

const VALID_PERIODS: ValidPeriod[] = ['daily', 'weekly', 'monthly', 'quarterly', 'all_time'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get('period') || 'all_time';
    const period: ValidPeriod = VALID_PERIODS.includes(periodParam as ValidPeriod)
      ? (periodParam as ValidPeriod)
      : 'all_time';

    // Also run achievement checks to keep data fresh
    gamificationService.checkAllAchievements();

    const leaderboard = gamificationService.getLeaderboard(period);
    const dailyChallenge = gamificationService.getDailyChallenge();
    const activeContests = gamificationService.getActiveContests();

    return NextResponse.json({
      success: true,
      data: {
        leaderboard,
        dailyChallenge,
        activeContests,
        period,
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
