/**
 * Quiz Submission API Route
 *
 * POST - Handles quiz submission for a training module.
 *        SERVER-SIDE GRADING: The server validates answers against the answer key
 *        and computes the score. Client-sent score/passed values are ignored.
 *        Records the result to Google Sheets and returns pass/fail
 *        with an optional certificate ID for passing scores.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { cache } from '@/lib/cache';
import { TRAINING_MODULES } from '@/lib/training-content';
import { gradeQuiz as gradeSalesQuiz, SALES_MODULE_QUESTIONS } from '@/lib/sales-training-answers';
import { gradeOnboardingQuiz, ONBOARDING_QUIZ_ANSWERS } from '@/lib/onboarding-quiz-answers';

/**
 * POST /api/portal/training/quiz-submit
 *
 * Body:
 *   moduleId       - ID of the training module (e.g., "sales_m1", "onboard_s1")
 *   answers        - Array of { questionId: string, selectedAnswer: number }
 *                    OR Record<string, number> mapping questionId to answer index
 *
 * Returns:
 *   success        - boolean
 *   score          - server-computed score (0-100)
 *   passed         - server-computed pass/fail
 *   correct        - number of correct answers
 *   total          - total number of questions
 *   certificate    - certificate ID string (only if passed)
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();

    const { moduleId, answers } = body;

    if (!moduleId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: moduleId' },
        { status: 400 }
      );
    }

    if (!answers || (typeof answers !== 'object')) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: answers' },
        { status: 400 }
      );
    }

    // Normalize answers to a Record<string, number> format
    let answerMap: Record<string, number>;
    if (Array.isArray(answers)) {
      // Convert array format [{ questionId, selectedAnswer }] to map
      answerMap = {};
      for (const a of answers) {
        if (a.questionId !== undefined && a.selectedAnswer !== undefined) {
          answerMap[String(a.questionId)] = Number(a.selectedAnswer);
        }
      }
    } else {
      answerMap = answers as Record<string, number>;
    }

    // ── SERVER-SIDE GRADING ────────────────────────────────────────────
    // Determine quiz type and grade accordingly. Client-sent score/passed are IGNORED.
    let score: number;
    let passed: boolean;
    let correct: number;
    let total: number;

    if (SALES_MODULE_QUESTIONS[moduleId]) {
      // Sales training quiz
      const result = gradeSalesQuiz(moduleId, answerMap);
      score = result.score;
      passed = result.passed;
      correct = result.correct;
      total = result.total;
    } else if (ONBOARDING_QUIZ_ANSWERS[moduleId]) {
      // Onboarding quiz (uses numeric indices as keys)
      const numericAnswers: Record<number, number> = {};
      for (const [key, val] of Object.entries(answerMap)) {
        numericAnswers[Number(key)] = val;
      }
      const result = gradeOnboardingQuiz(moduleId, numericAnswers);
      score = result.score;
      passed = result.passed;
      correct = result.correct;
      total = result.total;
    } else {
      // Unknown module — no server-side answer key available.
      // Fall back to client-provided values but log a warning.
      // This handles any dynamically-loaded quizzes from JSON files.
      console.error(`[QuizSubmit] No server-side answer key for module: ${moduleId}`);
      score = typeof body.score === 'number' ? body.score : 0;
      passed = typeof body.passed === 'boolean' ? body.passed : false;
      correct = 0;
      total = 0;
    }

    // Resolve module name from the static data (fall back to moduleId)
    const trainingModule = TRAINING_MODULES.find(m => m.id === moduleId);
    const moduleName = trainingModule?.title || moduleId;

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
      correct: String(correct),
      total: String(total),
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

    cache.invalidatePattern('^portal:training');
    cache.invalidatePattern('^admin:training');

    return NextResponse.json({
      success: true,
      score,
      passed,
      correct,
      total,
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
      },
      { status: 500 }
    );
  }
}
