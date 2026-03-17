/**
 * Admin Training Stats API Route
 *
 * GET - Returns ALL training records across all tracks (admin-training,
 *       sales, onboarding, walkthroughs) grouped by user, with completion
 *       percentages and per-track breakdowns.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { cache, CACHE_TTL } from '@/lib/cache';

// ============================================================================
// ALL tracked training modules across every track
// ============================================================================

const ADMIN_TRAINING_MODULES = [
  { id: 'portal-overview', name: 'Portal Overview', track: 'admin-training' },
  { id: 'admin-blog', name: 'Blog Management', track: 'admin-training' },
  { id: 'admin-team', name: 'Team Management', track: 'admin-training' },
  { id: 'admin-images', name: 'Image Gallery', track: 'admin-training' },
  { id: 'inventory', name: 'Inventory Management', track: 'admin-training' },
  { id: 'manager', name: 'Manager Dashboard', track: 'admin-training' },
  { id: 'driver', name: 'Driver Portal', track: 'admin-training' },
];

const SALES_MODULES = [
  { id: 'sales_m1', name: 'Company Overview', track: 'sales' },
  { id: 'sales_m2', name: 'Roofing Products & Materials', track: 'sales' },
  { id: 'sales_m3', name: 'Insurance Claim Process', track: 'sales' },
  { id: 'sales_m4', name: 'The Sales Process', track: 'sales' },
  { id: 'sales_m5', name: 'Using JobNimbus CRM', track: 'sales' },
  { id: 'sales_m6', name: 'Measurement & Estimation', track: 'sales' },
  { id: 'sales_m7', name: 'Customer Communication', track: 'sales' },
];

const ONBOARDING_MODULES = [
  { id: 'onboard_s1', name: 'Dashboard Overview', track: 'onboarding' },
  { id: 'onboard_s2', name: 'Lead Management', track: 'onboarding' },
  { id: 'onboard_s3', name: 'Customer Portal', track: 'onboarding' },
  { id: 'onboard_s4', name: 'Delivery System', track: 'onboarding' },
  { id: 'onboard_s5', name: 'Job Breakdowns & Invoicing', track: 'onboarding' },
  { id: 'onboard_s6', name: 'Calendar & Scheduling', track: 'onboarding' },
  { id: 'onboard_s7', name: 'Inventory Management', track: 'onboarding' },
  { id: 'onboard_s8', name: 'Reports & Analytics', track: 'onboarding' },
];

const ALL_MODULES = [
  ...ADMIN_TRAINING_MODULES,
  ...SALES_MODULES,
  ...ONBOARDING_MODULES,
];

// Role-based required modules
const ROLE_REQUIRED_MODULES: Record<string, string[]> = {
  admin: [
    ...ADMIN_TRAINING_MODULES.map(m => m.id),
    ...ONBOARDING_MODULES.map(m => m.id),
  ],
  manager: [
    'portal-overview', 'inventory', 'manager', 'driver',
    ...ONBOARDING_MODULES.map(m => m.id),
  ],
  office: [
    'portal-overview', 'manager',
    ...ONBOARDING_MODULES.map(m => m.id),
  ],
  sales: [
    'portal-overview',
    ...SALES_MODULES.map(m => m.id),
    ...ONBOARDING_MODULES.map(m => m.id),
  ],
  driver: [
    'portal-overview', 'driver',
    'onboard_s1', 'onboard_s4',
  ],
  pm: [
    'portal-overview', 'manager',
    ...ONBOARDING_MODULES.map(m => m.id),
  ],
  warehouse: [
    'portal-overview', 'inventory',
    'onboard_s1', 'onboard_s7',
  ],
};

interface UserTrainingSummary {
  userId: string;
  userName: string;
  completedModules: string[];
  trackProgress: {
    'admin-training': { completed: number; total: number };
    sales: { completed: number; total: number };
    onboarding: { completed: number; total: number };
  };
  moduleDetails: {
    moduleId: string;
    moduleName: string;
    track: string;
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
 * Returns all training records grouped by user with completion percentages
 * across all training tracks.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const cacheKey = 'admin:training-stats';
    const cached = cache.get(cacheKey);
    if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'private, s-maxage=30' } });

    // Get all training progress records (no userId filter = all users)
    const allRecords = await googleSheetsService.getTrainingProgress();

    // Group by user
    const userMap = new Map<string, UserTrainingSummary>();

    for (const record of allRecords) {
      const userId = record.userId;
      if (!userId || userId === 'bypass' || userId === 'anonymous') continue;

      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          userName: record.userName || 'Unknown',
          completedModules: [],
          trackProgress: {
            'admin-training': { completed: 0, total: ADMIN_TRAINING_MODULES.length },
            sales: { completed: 0, total: SALES_MODULES.length },
            onboarding: { completed: 0, total: ONBOARDING_MODULES.length },
          },
          moduleDetails: [],
          totalCompleted: 0,
          totalModules: ALL_MODULES.length,
          completionPercent: 0,
        });
      }

      const summary = userMap.get(userId)!;
      const passed = record.passed === 'true';
      const moduleInfo = ALL_MODULES.find(m => m.id === record.moduleId);

      summary.moduleDetails.push({
        moduleId: record.moduleId,
        moduleName: record.moduleName || moduleInfo?.name || record.moduleId,
        track: moduleInfo?.track || 'unknown',
        score: record.score || '0',
        passed,
        completedAt: record.completedAt || '',
      });

      if (passed && !summary.completedModules.includes(record.moduleId)) {
        summary.completedModules.push(record.moduleId);
      }
    }

    // Calculate completion percentages and track breakdowns
    const users: UserTrainingSummary[] = [];
    for (const summary of userMap.values()) {
      summary.totalCompleted = summary.completedModules.length;
      summary.completionPercent = Math.round(
        (summary.totalCompleted / summary.totalModules) * 100
      );

      // Per-track progress
      summary.trackProgress['admin-training'].completed =
        summary.completedModules.filter(id =>
          ADMIN_TRAINING_MODULES.some(m => m.id === id)
        ).length;
      summary.trackProgress.sales.completed =
        summary.completedModules.filter(id =>
          SALES_MODULES.some(m => m.id === id)
        ).length;
      summary.trackProgress.onboarding.completed =
        summary.completedModules.filter(id =>
          ONBOARDING_MODULES.some(m => m.id === id)
        ).length;

      users.push(summary);
    }

    // Sort by completion percentage (descending), then by name
    users.sort((a, b) => {
      if (b.completionPercent !== a.completionPercent) {
        return b.completionPercent - a.completionPercent;
      }
      return a.userName.localeCompare(b.userName);
    });

    // Per-module completion stats
    const moduleStats = ALL_MODULES.map(mod => {
      const completedCount = users.filter(u =>
        u.completedModules.includes(mod.id)
      ).length;
      return {
        moduleId: mod.id,
        moduleName: mod.name,
        track: mod.track,
        completedCount,
        totalUsers: users.length || 1,
        completionPercent: users.length > 0
          ? Math.round((completedCount / users.length) * 100)
          : 0,
      };
    });

    // Per-track summary
    const trackSummary = {
      'admin-training': {
        name: 'Platform Training',
        modules: ADMIN_TRAINING_MODULES.length,
        avgCompletion: users.length > 0
          ? Math.round(users.reduce((sum, u) =>
              sum + (u.trackProgress['admin-training'].completed / ADMIN_TRAINING_MODULES.length) * 100, 0
            ) / users.length)
          : 0,
      },
      sales: {
        name: 'Sales Training',
        modules: SALES_MODULES.length,
        avgCompletion: users.length > 0
          ? Math.round(users.reduce((sum, u) =>
              sum + (u.trackProgress.sales.completed / SALES_MODULES.length) * 100, 0
            ) / users.length)
          : 0,
      },
      onboarding: {
        name: 'Platform Onboarding',
        modules: ONBOARDING_MODULES.length,
        avgCompletion: users.length > 0
          ? Math.round(users.reduce((sum, u) =>
              sum + (u.trackProgress.onboarding.completed / ONBOARDING_MODULES.length) * 100, 0
            ) / users.length)
          : 0,
      },
    };

    // Overall stats
    const totalUsers = users.length;
    const fullyCompleted = users.filter(u => u.completionPercent === 100).length;
    const avgCompletion = totalUsers > 0
      ? Math.round(users.reduce((sum, u) => sum + u.completionPercent, 0) / totalUsers)
      : 0;

    const response = {
      success: true,
      stats: {
        totalUsers,
        fullyCompleted,
        avgCompletion,
        totalRecords: allRecords.length,
        totalModules: ALL_MODULES.length,
      },
      trackSummary,
      moduleStats,
      users,
      allModules: ALL_MODULES,
      roleRequirements: ROLE_REQUIRED_MODULES,
    };
    cache.set(cacheKey, response, CACHE_TTL.TEAM);
    return NextResponse.json(response, { headers: { 'Cache-Control': 'private, s-maxage=30' } });
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
