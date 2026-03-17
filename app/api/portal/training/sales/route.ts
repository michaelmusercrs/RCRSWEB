/**
 * Sales Training Progress API Route
 *
 * GET  - Get sales training progress for a user (query: ?userId=xxx)
 * POST - Record sales quiz completion (moduleId, score, passed, answers)
 *
 * All sales training moduleIds are prefixed with "sales_"
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { gradeQuiz, SALES_MODULE_QUESTIONS } from '@/lib/sales-training-answers';
import { cache, CACHE_TTL } from '@/lib/cache';

/**
 * GET /api/portal/training/sales?userId=xxx
 * Returns sales training progress records for the given user.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || auth.user.userId;

    const cacheKey = `portal:training-sales:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'private, s-maxage=30' } });

    const allRecords = await googleSheetsService.getTrainingProgress(userId);

    // Filter to only sales training records (moduleId starts with "sales_")
    const salesRecords = allRecords.filter(r => r.moduleId?.startsWith('sales_'));

    const completedModules = salesRecords
      .filter(r => r.passed?.toLowerCase() === 'true')
      .map(r => r.moduleId);

    // Build per-module best scores
    const moduleScores: Record<string, { score: number; passed: boolean; completedAt: string }> = {};
    for (const record of salesRecords) {
      const score = parseInt(record.score || '0', 10);
      const passed = record.passed?.toLowerCase() === 'true';
      const existing = moduleScores[record.moduleId];
      if (!existing || score > existing.score) {
        moduleScores[record.moduleId] = {
          score,
          passed,
          completedAt: record.completedAt || record.createdAt || '',
        };
      }
    }

    const response = {
      success: true,
      userId,
      records: salesRecords,
      completedModules: [...new Set(completedModules)],
      moduleScores,
      totalCompleted: new Set(completedModules).size,
    };
    cache.set(cacheKey, response, CACHE_TTL.TEAM);
    return NextResponse.json(response, { headers: { 'Cache-Control': 'private, s-maxage=30' } });
  } catch (error) {
    console.error('Error fetching sales training progress:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sales training progress',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portal/training/sales
 * Records a sales training quiz completion with SERVER-SIDE answer validation.
 *
 * Body: { userId, userName, moduleId, moduleName, answers: Record<questionId, selectedIndex> }
 *
 * The server grades the quiz using the answer key in lib/sales-training-answers.ts.
 * This prevents users from cheating by editing localStorage or sending fake scores.
 *
 * For backward compatibility, also accepts pre-computed { score, passed } when
 * answers are not provided (legacy flow), but server-validated results take priority.
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

    // Ensure moduleId has sales_ prefix
    const moduleId = body.moduleId.startsWith('sales_')
      ? body.moduleId
      : `sales_${body.moduleId}`;

    let score: number;
    let passed: boolean;

    // Server-side grading when answers are provided
    if (body.answers && typeof body.answers === 'object' && SALES_MODULE_QUESTIONS[moduleId]) {
      const result = gradeQuiz(moduleId, body.answers);
      score = result.score;
      passed = result.passed;
    } else {
      // Legacy fallback: trust client-provided score (backward compatibility)
      score = parseInt(String(body.score ?? '0'), 10);
      passed = body.passed === true || body.passed === 'true';
    }

    const record: Record<string, string> = {
      id: `train_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId: body.userId,
      userName: body.userName,
      moduleId,
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
          error: 'Failed to record sales training completion. Google Sheets may not be configured.',
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
        ? 'Congratulations! You passed the quiz.'
        : 'Quiz submitted. Review the material and try again.',
    });
  } catch (error) {
    console.error('Error recording sales training completion:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to record sales training completion',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
