import { requireAuth } from '@/lib/auth-service';
import { getPortalDashboardStats } from '@/lib/unified-data-service';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    // Use unified data service which aggregates all sources
    // JobNimbus, inventory, orders, and team data
    const stats = await getPortalDashboardStats();

    return apiSuccess(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return apiError(
      'Failed to load dashboard data. Please try again.',
      500,
      'DASHBOARD_LOAD_FAILED'
    );
  }
}
