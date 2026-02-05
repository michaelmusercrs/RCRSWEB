'use client';

import * as React from 'react';
import { useAuth } from '@/lib/auth-context';
import { TeamRole } from '@/lib/team-roles';
import {
  hasPermission as roleHasPermission,
  hasAnyPermission as roleHasAnyPermission,
  hasAllPermissions as roleHasAllPermissions,
  Role,
  Permission,
  isValidPermission,
} from '@/lib/permissions';

// =============================================================================
// ROLE MAPPING
// =============================================================================

/**
 * Maps TeamRole (from auth-context) to Role (from permissions system).
 * This bridges the two role systems used in the application.
 *
 * TeamRole -> Role mapping:
 * - 'owner' -> 'Owner'
 * - 'admin' -> 'Admin'
 * - 'office' -> 'Office'
 * - 'project_manager' -> 'Manager'
 * - 'driver' -> 'Driver'
 * - 'viewer' -> 'Sales' (viewers get sales-level access)
 */
export function mapTeamRoleToRole(teamRole: TeamRole | string): Role {
  const mapping: Record<string, Role> = {
    owner: 'Owner',
    admin: 'Admin',
    office: 'Office',
    project_manager: 'Manager',
    driver: 'Driver',
    viewer: 'Sales',
  };
  return mapping[teamRole] || 'Driver';
}

// =============================================================================
// TYPES
// =============================================================================

export interface PermissionGateProps {
  /** Single permission to check */
  permission?: string;
  /** Multiple permissions to check (user needs at least one) */
  permissions?: string[];
  /** If true, user must have ALL permissions instead of just one */
  requireAll?: boolean;
  /** Content to render when user has permission */
  children: React.ReactNode;
  /** Optional content to render when user lacks permission */
  fallback?: React.ReactNode;
  /** If true, shows nothing when permission denied (default: true) */
  hideOnDeny?: boolean;
}

// =============================================================================
// PERMISSION GATE COMPONENT
// =============================================================================

/**
 * PermissionGate component for conditionally rendering content based on user permissions.
 * Wraps children and only displays them if the current user has the required permission(s).
 *
 * This component bridges the TeamRole system (auth-context) with the Role-based
 * permission system (lib/permissions.ts).
 *
 * @example
 * // Single permission
 * <PermissionGate permission="inventory.edit">
 *   <EditButton />
 * </PermissionGate>
 *
 * @example
 * // Multiple permissions (any)
 * <PermissionGate permissions={['reports.view', 'reports.export']}>
 *   <ReportsSection />
 * </PermissionGate>
 *
 * @example
 * // Multiple permissions (all required)
 * <PermissionGate permissions={['billing.view', 'billing.edit']} requireAll>
 *   <BillingEditor />
 * </PermissionGate>
 *
 * @example
 * // With fallback
 * <PermissionGate permission="dashboard.viewAll" fallback={<AccessDenied />}>
 *   <AdminPanel />
 * </PermissionGate>
 */
function PermissionGate({
  permission,
  permissions,
  requireAll = false,
  children,
  fallback = null,
  hideOnDeny = true,
}: PermissionGateProps): React.ReactElement | null {
  const { user, isLoading } = useAuth();

  // While loading auth state, don't render anything
  if (isLoading) {
    return null;
  }

  // No user means no permission
  if (!user) {
    return hideOnDeny ? null : (fallback as React.ReactElement | null);
  }

  // Build list of permissions to check
  const permissionsToCheck: string[] = [];
  if (permission) {
    permissionsToCheck.push(permission);
  }
  if (permissions && permissions.length > 0) {
    permissionsToCheck.push(...permissions);
  }

  // If no permissions specified, allow access (component is effectively just a wrapper)
  if (permissionsToCheck.length === 0) {
    return <>{children}</>;
  }

  // Map the user's TeamRole to Role for permission checking
  const userRole = mapTeamRoleToRole(user.role);

  // Check if user has wildcard permission (owners/admins with '*')
  if (user.permissions.includes('*')) {
    return <>{children}</>;
  }

  // Check permissions using the Role-based system
  let hasAccess: boolean;

  // Filter to only valid Permission types
  const validPermissions = permissionsToCheck.filter(isValidPermission) as Permission[];

  if (validPermissions.length === 0) {
    // If none of the permissions are valid Permission types, fall back to legacy check
    const legacyHasAccess = requireAll
      ? permissionsToCheck.every((p) => user.permissions.includes(p))
      : permissionsToCheck.some((p) => user.permissions.includes(p));
    hasAccess = legacyHasAccess;
  } else if (requireAll) {
    // User must have ALL permissions
    hasAccess = roleHasAllPermissions(userRole, validPermissions);
  } else {
    // User needs at least ONE permission
    hasAccess = roleHasAnyPermission(userRole, validPermissions);
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  // User doesn't have permission
  if (hideOnDeny && !fallback) {
    return null;
  }

  return <>{fallback}</>;
}

PermissionGate.displayName = 'PermissionGate';

// =============================================================================
// PERMISSION CHECK HOOK
// =============================================================================

/**
 * Hook version of PermissionGate for use in logic rather than JSX.
 * Returns true if the current user has the specified permission(s).
 *
 * This hook bridges the TeamRole system (auth-context) with the Role-based
 * permission system (lib/permissions.ts).
 *
 * @example
 * const canEdit = usePermissionCheck('inventory.edit');
 * if (canEdit) {
 *   // Show edit options
 * }
 *
 * @example
 * const canViewAllReports = usePermissionCheck(['reports.view', 'reports.export'], true);
 */
function usePermissionCheck(permission: string): boolean;
function usePermissionCheck(permissions: string[], requireAll?: boolean): boolean;
function usePermissionCheck(
  permissionOrPermissions: string | string[],
  requireAll = false
): boolean {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) {
    return false;
  }

  // Check if user has wildcard permission (owners/admins with '*')
  if (user.permissions.includes('*')) {
    return true;
  }

  const permissionsToCheck = Array.isArray(permissionOrPermissions)
    ? permissionOrPermissions
    : [permissionOrPermissions];

  if (permissionsToCheck.length === 0) {
    return true;
  }

  // Map the user's TeamRole to Role for permission checking
  const userRole = mapTeamRoleToRole(user.role);

  // Filter to only valid Permission types
  const validPermissions = permissionsToCheck.filter(isValidPermission) as Permission[];

  if (validPermissions.length === 0) {
    // If none of the permissions are valid Permission types, fall back to legacy check
    return requireAll
      ? permissionsToCheck.every((p) => user.permissions.includes(p))
      : permissionsToCheck.some((p) => user.permissions.includes(p));
  }

  if (requireAll) {
    return roleHasAllPermissions(userRole, validPermissions);
  }

  return roleHasAnyPermission(userRole, validPermissions);
}

export { PermissionGate, usePermissionCheck };
