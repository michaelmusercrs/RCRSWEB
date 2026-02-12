/**
 * Training Modules API Route
 *
 * GET - Returns all training modules with user's progress for each
 *
 * Combines static module data from lib/training-content.ts with
 * per-user progress records from Google Sheets.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { TRAINING_MODULES, getModulesForRole } from '@/lib/training-content';
import type { TrainingModule } from '@/lib/training-content';

/**
 * GET /api/portal/training/modules?userId=xxx&role=sales
 *
 * Query params:
 *   userId - (optional) defaults to authenticated user
 *   role   - (optional) filter modules by audience role
 *
 * Returns all training modules merged with the user's progress.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || auth.user.userId;
    const role = searchParams.get('role');

    // Get modules - optionally filtered by role
    const modules: TrainingModule[] = role
      ? getModulesForRole(role)
      : TRAINING_MODULES;

    // Get user's progress from Google Sheets
    const progressRecords = await googleSheetsService.getTrainingProgress(userId);

    // Build progress lookup by moduleId (keep best score per module)
    const progressMap: Record<string, {
      moduleId: string;
      completed: boolean;
      score: number;
      completedAt: string;
    }> = {};

    for (const record of progressRecords) {
      const moduleId = record.moduleId || '';
      const score = parseInt(record.score || '0', 10);
      const passed = record.passed === 'true';
      const completedAt = record.completedAt || record.createdAt || '';

      const existing = progressMap[moduleId];
      if (!existing || score > existing.score) {
        progressMap[moduleId] = {
          moduleId,
          completed: passed,
          score,
          completedAt,
        };
      }
    }

    // Build the progress array from the map
    const progress = Object.values(progressMap);

    return NextResponse.json({
      success: true,
      modules,
      progress,
      userId,
      totalModules: modules.length,
      totalCompleted: progress.filter(p => p.completed).length,
    });
  } catch (error) {
    console.error('Error fetching training modules:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch training modules',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
