/**
 * Quiz Submission API Route
 *
 * POST - Handles quiz submission for a training module.
 *        Records the result to Google Sheets and returns pass/fail
 *        with an optional certificate ID for passing scores.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { TRAINING_MODULES } from '@/lib/training-content';

/**
 * POST /api/portal/training/quiz-submit
 *
 * Body:
 *   moduleId       - ID of the training module
 *   answers        - Array of { questionId: string, selectedAnswer: number }
 *   score          - Numeric score (0-100)
 *   passed         - Whether the user met the passing threshold
 *
 * Returns:
 *   success        - boolean
 *   score          - echoed back
 *   passed         - echoed back
 *   certificate    - certificate ID string (only if passed)
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();

    // Validate required fields
    const { moduleId, answers, score, passed } = body;

    if (!moduleId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: moduleId' },
        { status: 400 }
      );
    }

    if (!Array.isArray(answers)) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: answers (must be an array)' },
        { status: 400 }
      );
    }

    if (score === undefined || score === null) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: score' },
        { status: 400 }
      );
    }

    if (passed === undefined || passed === null) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: passed' },
        { status: 400 }
      );
    }

    // Resolve module name from the static data (fall back to moduleId)
    const module = TRAINING_MODULES.find(m => m.id === moduleId);
    const moduleName = module?.title || moduleId;

    // Generate certificate ID for passing attempts
    const now = new Date().toISOString();
    let certificate: string | undefined;
    if (passed) {
      certificate = `CERT-${moduleId}-${auth.user.userId}-${Date.now().toString(36)}`.toUpperCase();
    }

    // Record to Google Sheets
    const record: Record<string, string> = {
      id: `train_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId: auth.user.userId,
      userName: auth.user.name,
      moduleId,
      moduleName,
      score: String(score),
      passed: String(passed),
      completedAt: now,
    };

    const success = await googleSheetsService.recordTrainingCompletion(record);

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to record quiz submission. Google Sheets may not be configured.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      score,
      passed,
      ...(certificate ? { certificate } : {}),
      message: passed
        ? 'Congratulations! You passed the quiz.'
        : 'Quiz submitted. Review the material and try again.',
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to submit quiz',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
