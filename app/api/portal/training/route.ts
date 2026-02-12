/**
 * Training Progress API Route
 *
 * GET  - Get training progress for a user (query: ?userId=xxx)
 * POST - Record training completion
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';

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

    const records = await googleSheetsService.getTrainingProgress(userId);

    return NextResponse.json({
      success: true,
      userId,
      records,
      completedModules: records.filter(r => r.passed === 'true').map(r => r.moduleId),
      totalCompleted: records.filter(r => r.passed === 'true').length,
    });
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
 * Body: { userId, userName, moduleId, moduleName, score, passed, completedAt }
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
          {
            success: false,
            error: `Missing required field: ${field}`,
          },
          { status: 400 }
        );
      }
    }

    const record: Record<string, string> = {
      id: `train_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId: body.userId,
      userName: body.userName,
      moduleId: body.moduleId,
      moduleName: body.moduleName,
      score: String(body.score ?? '100'),
      passed: String(body.passed ?? true),
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

    return NextResponse.json({
      success: true,
      record,
      message: 'Training completion recorded successfully',
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
