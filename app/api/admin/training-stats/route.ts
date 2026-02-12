/**
 * Admin Training Stats API Route
 *
 * GET - Returns all training records grouped by user, plus completion percentages
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';

// All training modules that exist in the system
const ALL_MODULES = [
  { id: 'portal-overview', name: 'Portal Overview' },
  { id: 'admin-blog', name: 'Blog Management' },
  { id: 'admin-team', name: 'Team Management' },
  { id: 'admin-images', name: 'Image Gallery' },
  { id: 'inventory', name: 'Inventory Management' },
  { id: 'manager', name: 'Manager Dashboard' },
  { id: 'driver', name: 'Driver Portal' },
];

interface UserTrainingSummary {
  userId: string;
  userName: string;
  completedModules: string[];
  moduleDetails: {
    moduleId: string;
    moduleName: string;
    score: string;
    passed: boolean;
    completedAt: string;
  }[];
  totalCompleted: number;
  totalModules: number;
  completionPercent: number;
}

/**
 * GET /api/admin/training-stats
 * Returns all training records grouped by user with completion percentages.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    // Get all training progress records (no userId filter = all users)
    const allRecords = await googleSheetsService.getTrainingProgress();

    // Group by user
    const userMap = new Map<string, UserTrainingSummary>();

    for (const record of allRecords) {
      const userId = record.userId;
      if (!userId) continue;

      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          userName: record.userName || 'Unknown',
          completedModules: [],
          moduleDetails: [],
          totalCompleted: 0,
          totalModules: ALL_MODULES.length,
          completionPercent: 0,
        });
      }

      const summary = userMap.get(userId)!;
      const passed = record.passed === 'true';

      summary.moduleDetails.push({
        moduleId: record.moduleId,
        moduleName: record.moduleName,
        score: record.score || '0',
        passed,
        completedAt: record.completedAt || '',
      });

      if (passed && !summary.completedModules.includes(record.moduleId)) {
        summary.completedModules.push(record.moduleId);
      }
    }

    // Calculate completion percentages
    const users: UserTrainingSummary[] = [];
    for (const summary of userMap.values()) {
      summary.totalCompleted = summary.completedModules.length;
      summary.completionPercent = Math.round(
        (summary.totalCompleted / summary.totalModules) * 100
      );
      users.push(summary);
    }

    // Sort by completion percentage (descending), then by name
    users.sort((a, b) => {
      if (b.completionPercent !== a.completionPercent) {
        return b.completionPercent - a.completionPercent;
      }
      return a.userName.localeCompare(b.userName);
    });

    // Calculate per-module completion stats
    const moduleStats = ALL_MODULES.map(mod => {
      const completedCount = users.filter(u =>
        u.completedModules.includes(mod.id)
      ).length;
      return {
        moduleId: mod.id,
        moduleName: mod.name,
        completedCount,
        totalUsers: users.length || 1,
        completionPercent: users.length > 0
          ? Math.round((completedCount / users.length) * 100)
          : 0,
      };
    });

    // Overall stats
    const totalUsers = users.length;
    const fullyCompleted = users.filter(u => u.completionPercent === 100).length;
    const avgCompletion = totalUsers > 0
      ? Math.round(users.reduce((sum, u) => sum + u.completionPercent, 0) / totalUsers)
      : 0;

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        fullyCompleted,
        avgCompletion,
        totalRecords: allRecords.length,
      },
      moduleStats,
      users,
      allModules: ALL_MODULES,
    });
  } catch (error) {
    console.error('Error fetching training stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch training stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
