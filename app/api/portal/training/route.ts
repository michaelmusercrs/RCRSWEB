/**
 * Training Progress API Route
 *
 * GET  - Get training progress for a user (query: ?userId=xxx)
 * POST - Record training completion (with optional server-side grading for onboarding quizzes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { gradeOnboardingQuiz, ONBOARDING_QUIZ_ANSWERS } from '@/lib/onboarding-quiz-answers';
import { cache, CACHE_TTL } from '@/lib/cache';

/**
 * GET /api/portal/training?userId=xxx
 * Returns training progress records for the given user.
 * If no userId provided, returns records for the authenticated user.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || auth.user.userId;

    const cacheKey = `portal:training:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'private, s-maxage=30' } });

    const records = await googleSheetsService.getTrainingProgress(userId);

    const response = {
      success: true,
      userId,
      records,
      completedModules: records.filter(r => r.passed?.toLowerCase() === 'true').map(r => r.moduleId),
      totalCompleted: records.filter(r => r.passed?.toLowerCase() === 'true').length,
    };
    cache.set(cacheKey, response, CACHE_TTL.TEAM);
    return NextResponse.json(response, { headers: { 'Cache-Control': 'private, s-maxage=30' } });
  } catch (error) {
    console.error('Error fetching training progress:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch training progress',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portal/training
 * Records a training module completion.
 *
 * Body: { userId, userName, moduleId, moduleName, score, passed, completedAt }
 *
 * For onboarding modules (moduleId starts with "onboard_"), if `answers` is provided,
 * the server grades the quiz and ignores client-provided score/passed.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();

    // Validate required fields
    const required = ['userId', 'userName', 'moduleId', 'moduleName'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    let score: number;
    let passed: boolean;

    // Server-side grading for onboarding quizzes when answers are provided
    if (
      body.moduleId.startsWith('onboard_') &&
      body.answers &&
      typeof body.answers === 'object' &&
      ONBOARDING_QUIZ_ANSWERS[body.moduleId]
    ) {
      const result = gradeOnboardingQuiz(body.moduleId, body.answers);
      score = result.score;
      passed = result.passed;
    } else {
      // Trust client-provided score (for non-quiz completions like "mark complete")
      score = parseInt(String(body.score ?? '100'), 10);
      passed = body.passed === true || body.passed === 'true';
    }

    const record: Record<string, string> = {
      id: `train_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId: body.userId,
      userName: body.userName,
      moduleId: body.moduleId,
      moduleName: body.moduleName,
      score: String(score),
      passed: String(passed),
      completedAt: body.completedAt || new Date().toISOString(),
    };

    const success = await googleSheetsService.recordTrainingCompletion(record);

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to record training completion. Google Sheets may not be configured.',
        },
        { status: 500 }
      );
    }

    cache.invalidatePattern('^portal:training');
    cache.invalidatePattern('^admin:training');
    return NextResponse.json({
      success: true,
      record,
      score,
      passed,
      message: passed
        ? 'Training completion recorded successfully'
        : 'Quiz submitted. Review the material and try again.',
    });
  } catch (error) {
    console.error('Error recording training completion:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to record training completion',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
