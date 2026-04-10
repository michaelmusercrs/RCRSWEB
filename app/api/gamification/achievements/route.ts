/**
 * Gamification Achievements API
 *
 * GET /api/gamification/achievements
 * Query params:
 *   - repSlug: string (optional) - Get achievements for a specific rep
 *   - checkAll: 'true' (optional) - Run achievement checks for all reps
 */

import { NextRequest, NextResponse } from 'next/server';
import { gamificationService, ACHIEVEMENTS } from '@/lib/gamification-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repSlug = searchParams.get('repSlug');
    const checkAll = searchParams.get('checkAll') === 'true';

    // Optionally run achievement checks
    if (checkAll) {
      await gamificationService.checkAllAchievements();
    }

    if (repSlug) {
      // Run achievement check for this rep first
      const newAchievements = await gamificationService.checkAndAwardAchievements(repSlug);
      const allRepAchievements = await gamificationService.getRepAchievements(repSlug);
      const profile = await gamificationService.getRepProfile(repSlug);

      return NextResponse.json({
        success: true,
        data: {
          repSlug,
          achievements: allRepAchievements,
          newlyAwarded: newAchievements,
          allAchievements: ACHIEVEMENTS,
          profile,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Return all achievement definitions and all earned achievements
    const allAchievements = gamificationService.getAchievements();

    // Gather achievements by rep
    const leaderboard = await gamificationService.getLeaderboard('all_time');
    const achievementsByRep: Record<string, { repName: string; achievements: string[] }> = {};

    for (const entry of leaderboard) {
      if (entry.achievements.length > 0) {
        achievementsByRep[entry.repSlug] = {
          repName: entry.repName,
          achievements: entry.achievements,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        achievements: allAchievements,
        achievementsByRep,
        totalEarned: Object.values(achievementsByRep).reduce(
          (sum, r) => sum + r.achievements.length, 0
        ),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Gamification Achievements API Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load achievements',
      },
      { status: 500 }
    );
  }
}
