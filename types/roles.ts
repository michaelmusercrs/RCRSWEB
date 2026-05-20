/**
 * RCRS Command Center - Role & Permission Type Definitions
 *
 * This file defines the core types for the role-based access control (RBAC) system.
 * These types are the foundation for all permission checks throughout the application.
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

// =============================================================================
// ROLE DEFINITIONS
// =============================================================================

/**
 * Application roles ordered by permission level (highest to lowest).
 *
 * - Owner: Full system access (Michael Muse, Chris Muse)
 * - Admin: Full access except some financial details (Sara Hill)
 * - Manager: Operations, team oversight, inventory management (Destin)
 * - ProjectManager: Job scheduling and delivery coordination (Bart, John) — no cost visibility
 * - Office: Billing, schedule, customer management (Tia)
 * - Sales: Leaderboard, own stats, inventory quantities only (Hunter, Aaron, Greg, etc.)
 * - Driver: Deliveries, inventory for assigned jobs only (Richard, Tae)
 * - Viewer: Read-only access for non-sales staff (Boston / marketing)
 */
export type Role =
  | 'Owner'
  | 'Admin'
  | 'Manager'
  | 'ProjectManager'
  | 'Sales'
  | 'Driver'
  | 'Office'
  | 'Viewer';

/**
 * All valid role values as a readonly array for runtime validation.
 */
export const ROLES = [
  'Owner',
  'Admin',
  'Manager',
  'ProjectManager',
  'Sales',
  'Driver',
  'Office',
  'Viewer',
] as const;

/**
 * Role hierarchy for permission inheritance.
 * Higher index = higher permission level.
 */
export const ROLE_HIERARCHY: Record<Role, number> = {
  Owner: 8,
  Admin: 7,
  Manager: 6,
  ProjectManager: 5,
  Office: 4,
  Sales: 3,
  Driver: 2,
  Viewer: 1,
} as const;

// =============================================================================
// PERMISSION DEFINITIONS
// =============================================================================

/**
 * All permissions available in the RCRS Command Center.
 * Organized by module/feature area.
 */
export type Permission =
  // Dashboard permissions
  | 'dashboard.view'
  | 'dashboard.viewAll'
  // Sales permissions
  | 'sales.view'
  | 'sales.viewOwn'
  | 'sales.viewCommissions'
  // Inventory permissions
  | 'inventory.view'
  | 'inventory.viewCosts'
  | 'inventory.edit'
  | 'inventory.delete'
  // Marketing permissions
  | 'marketing.view'
  | 'marketing.edit'
  // Phone/Communication permissions
  | 'phone.view'
  | 'phone.viewAll'
  | 'phone.manage'
  // Team permissions
  | 'team.view'
  | 'team.edit'
  // Billing permissions
  | 'billing.view'
  | 'billing.edit'
  // Schedule permissions
  | 'schedule.view'
  | 'schedule.edit'
  // Reports permissions
  | 'reports.view'
  | 'reports.export';

/**
 * All valid permission values as a readonly array for runtime validation.
 */
export const PERMISSIONS: readonly Permission[] = [
  'dashboard.view',
  'dashboard.viewAll',
  'sales.view',
  'sales.viewOwn',
  'sales.viewCommissions',
  'inventory.view',
  'inventory.viewCosts',
  'inventory.edit',
  'inventory.delete',
  'marketing.view',
  'marketing.edit',
  'phone.view',
  'phone.viewAll',
  'phone.manage',
  'team.view',
  'team.edit',
  'billing.view',
  'billing.edit',
  'schedule.view',
  'schedule.edit',
  'reports.view',
  'reports.export',
] as const;

// =============================================================================
// NAVIGATION TYPES
// =============================================================================

/**
 * Navigation item configuration for role-based menu rendering.
 */
export interface NavItem {
  /** Unique identifier for the nav item */
  id: string;
  /** Display label in the navigation */
  label: string;
  /** Route path for navigation */
  href: string;
  /** Optional icon identifier (e.g., Lucide icon name) */
  icon?: string;
  /** Permission required to view this nav item */
  requiredPermission?: Permission;
  /** Minimum role required (uses hierarchy) */
  minRole?: Role;
  /** Child navigation items for dropdowns/submenus */
  children?: NavItem[];
  /** Whether this item is visible in mobile navigation */
  showInMobile?: boolean;
  /** Badge content (e.g., notification count) */
  badge?: string | number;
}

// =============================================================================
// USER TYPES
// =============================================================================

/**
 * Basic user information for permission checks.
 */
export interface RoleUser {
  /** Unique user identifier */
  id: string;
  /** User's assigned role */
  role: Role;
  /** User's display name */
  name: string;
  /** User's email address */
  email: string;
}

// =============================================================================
// PERMISSION CHECK RESULT TYPES
// =============================================================================

/**
 * Result of a permission check with detailed information.
 */
export interface PermissionCheckResult {
  /** Whether the permission is granted */
  allowed: boolean;
  /** Reason for denial (if not allowed) */
  reason?: string;
  /** Required permission that was checked */
  requiredPermission?: Permission;
  /** User's role at time of check */
  userRole: Role;
}

// =============================================================================
// SENSITIVE FIELD CONFIGURATION
// =============================================================================

/**
 * Configuration for fields that should be filtered based on role.
 */
export interface SensitiveFieldConfig {
  /** Field name/path */
  field: string;
  /** Roles that can view this field */
  allowedRoles: Role[];
  /** Replacement value when filtered (undefined = remove field) */
  replacement?: unknown;
}

// =============================================================================
// ROUTE CONFIGURATION
// =============================================================================

/**
 * Route access configuration for canAccess checks.
 */
export interface RouteConfig {
  /** Route path pattern (supports wildcards) */
  path: string;
  /** Permission required to access this route */
  requiredPermission?: Permission;
  /** Minimum role required (uses hierarchy) */
  minRole?: Role;
  /** Whether route requires authentication */
  requiresAuth: boolean;
  /** Redirect path if access denied */
  redirectTo?: string;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if a string is a valid Role.
 */
export function isValidRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLES.includes(value as Role);
}

/**
 * Type guard to check if a string is a valid Permission.
 */
export function isValidPermission(value: unknown): value is Permission {
  return typeof value === 'string' && PERMISSIONS.includes(value as Permission);
}
