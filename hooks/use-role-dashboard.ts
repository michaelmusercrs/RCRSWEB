'use client';

import { useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { TeamRole } from '@/lib/team-roles';
import {
  getDashboardConfig,
  getRoleFeatures,
  ADMIN_DASHBOARD_CONFIG,
  MANAGER_DASHBOARD_CONFIG,
  SALES_REP_DASHBOARD_CONFIG,
  DRIVER_DASHBOARD_CONFIG,
  PROJECT_MANAGER_DASHBOARD_CONFIG,
  CUSTOMER_DASHBOARD_CONFIG,
  RoleFeatures,
} from '@/lib/role-dashboards';

/**
 * Hook to get role-specific dashboard configuration
 */
export function useRoleDashboard() {
  const { user } = useAuth();

  const dashboardConfig = useMemo(() => {
    if (!user) return null;

    // Map TeamRole to dashboard config role
    const roleMap: Record<TeamRole, string> = {
      owner: 'admin',
      admin: 'admin',
      manager: 'manager',
      sales: 'sales_rep',
      office: 'manager', // Office staff use manager dashboard with some restrictions
      project_manager: 'project_manager',
      driver: 'driver',
      viewer: 'sales_rep',
    };

    const dashboardRole = roleMap[user.role] || 'sales_rep';

    switch (dashboardRole) {
      case 'admin':
        return ADMIN_DASHBOARD_CONFIG;
      case 'manager':
        return MANAGER_DASHBOARD_CONFIG;
      case 'sales_rep':
        return SALES_REP_DASHBOARD_CONFIG;
      case 'driver':
        return DRIVER_DASHBOARD_CONFIG;
      case 'project_manager':
        return PROJECT_MANAGER_DASHBOARD_CONFIG;
      default:
        return SALES_REP_DASHBOARD_CONFIG;
    }
  }, [user]);

  const features = useMemo((): RoleFeatures | null => {
    if (!user) return null;

    // Map TeamRole to portal role for features
    const roleMap: Record<TeamRole, 'admin' | 'manager' | 'sales_rep' | 'driver' | 'project_manager' | 'customer'> = {
      owner: 'admin',
      admin: 'admin',
      manager: 'manager',
      sales: 'sales_rep',
      office: 'manager',
      project_manager: 'project_manager',
      driver: 'driver',
      viewer: 'sales_rep',
    };

    return getRoleFeatures(roleMap[user.role]);
  }, [user]);

  return {
    config: dashboardConfig,
    features,
    role: user?.role,
    isAdmin: user?.role === 'owner' || user?.role === 'admin',
    isManager: user?.role === 'manager' || user?.role === 'owner' || user?.role === 'admin',
    isSales: user?.role === 'sales',
    isDriver: user?.role === 'driver',
    isProjectManager: user?.role === 'project_manager',
    isOffice: user?.role === 'office',
  };
}

/**
 * Hook to check if user has specific feature access
 */
export function useRoleFeature(feature: keyof RoleFeatures): boolean {
  const { features } = useRoleDashboard();
  return features?.[feature] ?? false;
}

/**
 * Hook to get navigation items for current user
 */
export function useRoleNavigation() {
  const { config, role } = useRoleDashboard();

  return useMemo(() => {
    if (!config || !role) return [];

    return config.navigation || [];
  }, [config, role]);
}

/**
 * Hook to get stats configuration for current user
 */
export function useRoleStats() {
  const { config } = useRoleDashboard();

  return useMemo(() => {
    if (!config) return [];

    return config.stats || [];
  }, [config]);
}

export default useRoleDashboard;
