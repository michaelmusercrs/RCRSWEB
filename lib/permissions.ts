/**
 * RCRS Command Center - Role-Based Permission System
 *
 * This module provides the core permission checking functionality for the entire
 * RCRS Command Center application. It handles:
 * - Role-to-permission mapping
 * - Permission checks for users
 * - Route access control
 * - Navigation filtering
 * - Sensitive data filtering
 *
 * IMPORTANT: This is a FOUNDATIONAL module. Changes here affect the entire application.
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import {
  Role,
  Permission,
  NavItem,
  ROLES,
  ROLE_HIERARCHY,
  isValidRole,
  isValidPermission,
  PermissionCheckResult,
  SensitiveFieldConfig,
} from '../types/roles';

// =============================================================================
// ROLE-TO-PERMISSION MAPPING
// =============================================================================

/**
 * Master mapping of roles to their granted permissions.
 *
 * Role Breakdown:
 * - OWNER (Michael Muse, Chris Muse): Full access to everything
 * - ADMIN (Sara Hill): Full access except some financial details
 * - MANAGER (Destin): Operations, team oversight, inventory management
 * - SALES (Hunter, Aaron, Greg, Brendon, Rick, Rudy, Adam): Leaderboard, own stats, inventory quantities only
 * - DRIVER (Richard Geahr, Tae): Deliveries, inventory for their jobs only
 * - OFFICE (Tia, Bart, Boston, John): Billing, schedule, customer management
 */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  Owner: [
    // Dashboard - Full access
    'dashboard.view',
    'dashboard.viewAll',
    // Sales - Full access
    'sales.view',
    'sales.viewOwn',
    'sales.viewCommissions',
    // Inventory - Full access
    'inventory.view',
    'inventory.viewCosts',
    'inventory.edit',
    'inventory.delete',
    // Marketing - Full access
    'marketing.view',
    'marketing.edit',
    // Phone - Full access
    'phone.view',
    'phone.viewAll',
    'phone.manage',
    // Team - Full access
    'team.view',
    'team.edit',
    // Billing - Full access
    'billing.view',
    'billing.edit',
    // Schedule - Full access
    'schedule.view',
    'schedule.edit',
    // Reports - Full access
    'reports.view',
    'reports.export',
  ],

  Admin: [
    // Dashboard - Full access
    'dashboard.view',
    'dashboard.viewAll',
    // Sales - Full access (can view all sales and commissions)
    'sales.view',
    'sales.viewOwn',
    'sales.viewCommissions',
    // Inventory - Full access except delete
    'inventory.view',
    'inventory.viewCosts',
    'inventory.edit',
    // Note: No inventory.delete - only Owners can delete inventory
    // Marketing - Full access
    'marketing.view',
    'marketing.edit',
    // Phone - Full access
    'phone.view',
    'phone.viewAll',
    'phone.manage',
    // Team - Full access
    'team.view',
    'team.edit',
    // Billing - Full access
    'billing.view',
    'billing.edit',
    // Schedule - Full access
    'schedule.view',
    'schedule.edit',
    // Reports - Full access
    'reports.view',
    'reports.export',
  ],

  Manager: [
    // Dashboard - Full view access
    'dashboard.view',
    'dashboard.viewAll',
    // Sales - Can view all sales but not commissions
    'sales.view',
    'sales.viewOwn',
    // Note: No sales.viewCommissions - managers don't see commission details
    // Inventory - Full management except delete
    'inventory.view',
    'inventory.viewCosts',
    'inventory.edit',
    // Note: No inventory.delete
    // Marketing - View only
    'marketing.view',
    // Note: No marketing.edit - managers don't edit marketing
    // Phone - View all
    'phone.view',
    'phone.viewAll',
    // Note: No phone.manage
    // Team - View and edit
    'team.view',
    'team.edit',
    // Billing - View only
    'billing.view',
    // Note: No billing.edit - managers don't edit billing
    // Schedule - Full access
    'schedule.view',
    'schedule.edit',
    // Reports - View and export
    'reports.view',
    'reports.export',
  ],

  Office: [
    // Dashboard - Basic view
    'dashboard.view',
    // Note: No dashboard.viewAll - office sees relevant metrics only
    // Sales - View only
    'sales.view',
    'sales.viewOwn',
    // Note: No sales.viewCommissions
    // Inventory - View only (no costs)
    'inventory.view',
    // Note: No inventory.viewCosts, inventory.edit, inventory.delete
    // Marketing - No access
    // Phone - View own
    'phone.view',
    // Note: No phone.viewAll, phone.manage
    // Team - View only
    'team.view',
    // Note: No team.edit
    // Billing - Full access (primary responsibility)
    'billing.view',
    'billing.edit',
    // Schedule - Full access (primary responsibility)
    'schedule.view',
    'schedule.edit',
    // Reports - View only
    'reports.view',
    // Note: No reports.export
  ],

  Sales: [
    // Dashboard - Basic view
    'dashboard.view',
    // Note: No dashboard.viewAll
    // Sales - Own stats and leaderboard
    'sales.view',
    'sales.viewOwn',
    // Note: No sales.viewCommissions - sales reps don't see commission breakdowns
    // Inventory - Quantities only (no costs/prices)
    'inventory.view',
    // Note: No inventory.viewCosts, inventory.edit, inventory.delete
    // Marketing - No access
    // Phone - View own only
    'phone.view',
    // Note: No phone.viewAll, phone.manage
    // Team - View only
    'team.view',
    // Note: No team.edit
    // Billing - No access
    // Schedule - View only
    'schedule.view',
    // Note: No schedule.edit
    // Reports - No access
  ],

  Driver: [
    // Dashboard - Basic view
    'dashboard.view',
    // Note: No dashboard.viewAll
    // Sales - No access
    // Inventory - View only for assigned jobs
    'inventory.view',
    // Note: No inventory.viewCosts, inventory.edit, inventory.delete
    // Marketing - No access
    // Phone - No access
    // Team - No access
    // Billing - No access
    // Schedule - View only (for deliveries)
    'schedule.view',
    // Note: No schedule.edit
    // Reports - No access
  ],
} as const;

// =============================================================================
// PERMISSION CHECK FUNCTIONS
// =============================================================================

/**
 * Checks if a user with the given role has a specific permission.
 *
 * @param userRole - The user's role
 * @param permission - The permission to check
 * @returns true if the user has the permission, false otherwise
 *
 * @example
 * ```ts
 * if (hasPermission('Sales', 'inventory.viewCosts')) {
 *   // Show cost column - will be false for Sales role
 * }
 * ```
 */
export function hasPermission(userRole: Role, permission: Permission): boolean {
  // Validate inputs
  if (!isValidRole(userRole)) {
    console.warn(`[Permissions] Invalid role provided: ${userRole}`);
    return false;
  }

  if (!isValidPermission(permission)) {
    console.warn(`[Permissions] Invalid permission provided: ${permission}`);
    return false;
  }

  const rolePermissions = ROLE_PERMISSIONS[userRole];
  return rolePermissions.includes(permission);
}

/**
 * Checks if a user has permission and returns detailed result.
 *
 * @param userRole - The user's role
 * @param permission - The permission to check
 * @returns Detailed permission check result
 */
export function checkPermission(userRole: Role, permission: Permission): PermissionCheckResult {
  const allowed = hasPermission(userRole, permission);

  return {
    allowed,
    reason: allowed ? undefined : `Role "${userRole}" does not have permission "${permission}"`,
    requiredPermission: permission,
    userRole,
  };
}

/**
 * Checks if a user has ALL of the specified permissions.
 *
 * @param userRole - The user's role
 * @param permissions - Array of permissions to check
 * @returns true only if the user has ALL permissions
 */
export function hasAllPermissions(userRole: Role, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(userRole, permission));
}

/**
 * Checks if a user has ANY of the specified permissions.
 *
 * @param userRole - The user's role
 * @param permissions - Array of permissions to check
 * @returns true if the user has at least ONE permission
 */
export function hasAnyPermission(userRole: Role, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(userRole, permission));
}

/**
 * Gets all permissions for a given role.
 *
 * @param userRole - The user's role
 * @returns Array of permissions granted to the role
 */
export function getPermissionsForRole(userRole: Role): readonly Permission[] {
  if (!isValidRole(userRole)) {
    console.warn(`[Permissions] Invalid role provided: ${userRole}`);
    return [];
  }

  return ROLE_PERMISSIONS[userRole];
}

// =============================================================================
// ROUTE ACCESS CONTROL
// =============================================================================

/**
 * Route-to-permission/role mapping for access control.
 * Supports exact matches and wildcard patterns.
 */
const ROUTE_PERMISSIONS: ReadonlyArray<{
  pattern: string;
  permission?: Permission;
  minRole?: Role;
  isPublic?: boolean;
}> = [
  // Public routes
  { pattern: '/', isPublic: true },
  { pattern: '/login', isPublic: true },
  { pattern: '/services', isPublic: true },
  { pattern: '/about', isPublic: true },
  { pattern: '/contact', isPublic: true },
  { pattern: '/reviews', isPublic: true },
  { pattern: '/blog', isPublic: true },

  // Dashboard routes
  { pattern: '/command-center', permission: 'dashboard.view' },
  { pattern: '/command-center/dashboard', permission: 'dashboard.view' },

  // Sales routes
  { pattern: '/command-center/sales', permission: 'sales.view' },
  { pattern: '/command-center/sales/leaderboard', permission: 'sales.view' },
  { pattern: '/command-center/sales/commissions', permission: 'sales.viewCommissions' },
  { pattern: '/command-center/sales/my-stats', permission: 'sales.viewOwn' },

  // Inventory routes
  { pattern: '/command-center/inventory', permission: 'inventory.view' },
  { pattern: '/command-center/inventory/edit', permission: 'inventory.edit' },
  { pattern: '/command-center/inventory/costs', permission: 'inventory.viewCosts' },

  // Marketing routes
  { pattern: '/command-center/marketing', permission: 'marketing.view' },
  { pattern: '/command-center/marketing/edit', permission: 'marketing.edit' },

  // Phone/Communication routes
  { pattern: '/command-center/phone', permission: 'phone.view' },
  { pattern: '/command-center/phone/all', permission: 'phone.viewAll' },
  { pattern: '/command-center/phone/manage', permission: 'phone.manage' },

  // Team routes
  { pattern: '/command-center/team', permission: 'team.view' },
  { pattern: '/command-center/team/edit', permission: 'team.edit' },

  // Billing routes
  { pattern: '/command-center/billing', permission: 'billing.view' },
  { pattern: '/command-center/billing/edit', permission: 'billing.edit' },

  // Schedule routes
  { pattern: '/command-center/schedule', permission: 'schedule.view' },
  { pattern: '/command-center/schedule/edit', permission: 'schedule.edit' },

  // Reports routes
  { pattern: '/command-center/reports', permission: 'reports.view' },
  { pattern: '/command-center/reports/export', permission: 'reports.export' },

  // Admin routes (Owner/Admin only)
  { pattern: '/command-center/admin', minRole: 'Admin' },
  { pattern: '/command-center/settings', minRole: 'Admin' },

  // Portal routes (existing system)
  { pattern: '/portal/office', permission: 'billing.view' },
  { pattern: '/portal/billing', permission: 'billing.view' },
  { pattern: '/portal/inventory', permission: 'inventory.view' },
  { pattern: '/portal/driver', permission: 'schedule.view' },
  { pattern: '/portal/pm', permission: 'schedule.view' },
  { pattern: '/portal/admin', minRole: 'Admin' },
] as const;

/**
 * Checks if a user with the given role can access a specific route.
 *
 * @param userRole - The user's role
 * @param route - The route path to check
 * @returns true if the user can access the route, false otherwise
 *
 * @example
 * ```ts
 * if (!canAccess(user.role, '/command-center/sales/commissions')) {
 *   redirect('/command-center');
 * }
 * ```
 */
export function canAccess(userRole: Role, route: string): boolean {
  // Validate role
  if (!isValidRole(userRole)) {
    console.warn(`[Permissions] Invalid role for route access: ${userRole}`);
    return false;
  }

  // Normalize route (remove trailing slash, lowercase)
  const normalizedRoute = route.replace(/\/$/, '').toLowerCase();

  // Find matching route configuration
  const routeConfig = ROUTE_PERMISSIONS.find((config) => {
    // Exact match
    if (config.pattern.toLowerCase() === normalizedRoute) {
      return true;
    }

    // Wildcard match (pattern ends with /*)
    if (config.pattern.endsWith('/*')) {
      const basePattern = config.pattern.slice(0, -2).toLowerCase();
      return normalizedRoute.startsWith(basePattern);
    }

    // Prefix match for nested routes
    if (normalizedRoute.startsWith(config.pattern.toLowerCase() + '/')) {
      return true;
    }

    return false;
  });

  // No config found - default to allowing authenticated users basic access
  if (!routeConfig) {
    // Unknown routes in command-center require at least dashboard.view
    if (normalizedRoute.startsWith('/command-center')) {
      return hasPermission(userRole, 'dashboard.view');
    }
    // Unknown portal routes require at least some permission
    if (normalizedRoute.startsWith('/portal')) {
      return hasAnyPermission(userRole, ['billing.view', 'schedule.view', 'inventory.view']);
    }
    // Other unknown routes - allow access
    return true;
  }

  // Public route - always allow
  if (routeConfig.isPublic) {
    return true;
  }

  // Check minimum role requirement
  if (routeConfig.minRole) {
    const userHierarchy = ROLE_HIERARCHY[userRole];
    const requiredHierarchy = ROLE_HIERARCHY[routeConfig.minRole];
    if (userHierarchy < requiredHierarchy) {
      return false;
    }
  }

  // Check permission requirement
  if (routeConfig.permission) {
    return hasPermission(userRole, routeConfig.permission);
  }

  // Route has config but no specific requirements - allow
  return true;
}

/**
 * Gets the redirect URL for a user who cannot access a route.
 *
 * @param userRole - The user's role
 * @returns The appropriate redirect URL based on the user's permissions
 */
export function getAccessDeniedRedirect(userRole: Role): string {
  // Determine the best landing page based on role
  if (hasPermission(userRole, 'dashboard.view')) {
    return '/command-center';
  }

  if (hasPermission(userRole, 'schedule.view')) {
    return '/portal/driver';
  }

  return '/';
}

// =============================================================================
// NAVIGATION FILTERING
// =============================================================================

/**
 * Master navigation configuration for the Command Center.
 * Each item specifies its visibility requirements.
 */
const COMMAND_CENTER_NAV: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/command-center',
    icon: 'LayoutDashboard',
    requiredPermission: 'dashboard.view',
    showInMobile: true,
  },
  {
    id: 'sales',
    label: 'Sales',
    href: '/command-center/sales',
    icon: 'TrendingUp',
    requiredPermission: 'sales.view',
    showInMobile: true,
    children: [
      {
        id: 'sales-leaderboard',
        label: 'Leaderboard',
        href: '/command-center/sales/leaderboard',
        requiredPermission: 'sales.view',
      },
      {
        id: 'sales-my-stats',
        label: 'My Stats',
        href: '/command-center/sales/my-stats',
        requiredPermission: 'sales.viewOwn',
      },
      {
        id: 'sales-commissions',
        label: 'Commissions',
        href: '/command-center/sales/commissions',
        requiredPermission: 'sales.viewCommissions',
      },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    href: '/command-center/inventory',
    icon: 'Package',
    requiredPermission: 'inventory.view',
    showInMobile: true,
    children: [
      {
        id: 'inventory-list',
        label: 'View Inventory',
        href: '/command-center/inventory',
        requiredPermission: 'inventory.view',
      },
      {
        id: 'inventory-costs',
        label: 'Costs & Pricing',
        href: '/command-center/inventory/costs',
        requiredPermission: 'inventory.viewCosts',
      },
      {
        id: 'inventory-manage',
        label: 'Manage Items',
        href: '/command-center/inventory/edit',
        requiredPermission: 'inventory.edit',
      },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    href: '/command-center/marketing',
    icon: 'Megaphone',
    requiredPermission: 'marketing.view',
    showInMobile: true,
  },
  {
    id: 'phone',
    label: 'Phone System',
    href: '/command-center/phone',
    icon: 'Phone',
    requiredPermission: 'phone.view',
    showInMobile: true,
    children: [
      {
        id: 'phone-my-calls',
        label: 'My Calls',
        href: '/command-center/phone',
        requiredPermission: 'phone.view',
      },
      {
        id: 'phone-all-calls',
        label: 'All Calls',
        href: '/command-center/phone/all',
        requiredPermission: 'phone.viewAll',
      },
      {
        id: 'phone-manage',
        label: 'Manage System',
        href: '/command-center/phone/manage',
        requiredPermission: 'phone.manage',
      },
    ],
  },
  {
    id: 'team',
    label: 'Team',
    href: '/command-center/team',
    icon: 'Users',
    requiredPermission: 'team.view',
    showInMobile: true,
  },
  {
    id: 'billing',
    label: 'Billing',
    href: '/command-center/billing',
    icon: 'CreditCard',
    requiredPermission: 'billing.view',
    showInMobile: true,
  },
  {
    id: 'schedule',
    label: 'Schedule',
    href: '/command-center/schedule',
    icon: 'Calendar',
    requiredPermission: 'schedule.view',
    showInMobile: true,
  },
  {
    id: 'reports',
    label: 'Reports',
    href: '/command-center/reports',
    icon: 'BarChart3',
    requiredPermission: 'reports.view',
    showInMobile: false,
    children: [
      {
        id: 'reports-view',
        label: 'View Reports',
        href: '/command-center/reports',
        requiredPermission: 'reports.view',
      },
      {
        id: 'reports-export',
        label: 'Export Data',
        href: '/command-center/reports/export',
        requiredPermission: 'reports.export',
      },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/command-center/settings',
    icon: 'Settings',
    minRole: 'Admin',
    showInMobile: false,
  },
];

/**
 * Recursively filters navigation items based on user role.
 *
 * @param items - Navigation items to filter
 * @param userRole - The user's role
 * @returns Filtered navigation items the user can access
 */
function filterNavItems(items: NavItem[], userRole: Role): NavItem[] {
  return items
    .filter((item) => {
      // Check minimum role requirement
      if (item.minRole) {
        const userHierarchy = ROLE_HIERARCHY[userRole];
        const requiredHierarchy = ROLE_HIERARCHY[item.minRole];
        if (userHierarchy < requiredHierarchy) {
          return false;
        }
      }

      // Check permission requirement
      if (item.requiredPermission) {
        return hasPermission(userRole, item.requiredPermission);
      }

      return true;
    })
    .map((item) => {
      // Recursively filter children
      if (item.children && item.children.length > 0) {
        const filteredChildren = filterNavItems(item.children, userRole);
        return {
          ...item,
          children: filteredChildren.length > 0 ? filteredChildren : undefined,
        };
      }
      return item;
    });
}

/**
 * Gets the navigation items visible to a user based on their role.
 *
 * @param userRole - The user's role
 * @returns Array of navigation items the user can see
 *
 * @example
 * ```tsx
 * const navItems = getVisibleNavItems(user.role);
 * return (
 *   <nav>
 *     {navItems.map(item => (
 *       <NavLink key={item.id} href={item.href}>{item.label}</NavLink>
 *     ))}
 *   </nav>
 * );
 * ```
 */
export function getVisibleNavItems(userRole: Role): NavItem[] {
  if (!isValidRole(userRole)) {
    console.warn(`[Permissions] Invalid role for navigation: ${userRole}`);
    return [];
  }

  return filterNavItems(COMMAND_CENTER_NAV, userRole);
}

/**
 * Gets mobile-visible navigation items for a user.
 *
 * @param userRole - The user's role
 * @returns Array of navigation items for mobile view
 */
export function getMobileNavItems(userRole: Role): NavItem[] {
  return getVisibleNavItems(userRole).filter((item) => item.showInMobile !== false);
}

// =============================================================================
// DATA FILTERING
// =============================================================================

/**
 * Default sensitive field configurations.
 * These fields are filtered out for roles that shouldn't see them.
 */
const DEFAULT_SENSITIVE_FIELDS: SensitiveFieldConfig[] = [
  // Cost/pricing fields - only Owner, Admin, Manager can see
  { field: 'cost', allowedRoles: ['Owner', 'Admin', 'Manager'], replacement: null },
  { field: 'unitCost', allowedRoles: ['Owner', 'Admin', 'Manager'], replacement: null },
  { field: 'totalCost', allowedRoles: ['Owner', 'Admin', 'Manager'], replacement: null },
  { field: 'margin', allowedRoles: ['Owner', 'Admin', 'Manager'], replacement: null },
  { field: 'profit', allowedRoles: ['Owner', 'Admin', 'Manager'], replacement: null },
  { field: 'markup', allowedRoles: ['Owner', 'Admin', 'Manager'], replacement: null },

  // Commission fields - only Owner, Admin can see
  { field: 'commission', allowedRoles: ['Owner', 'Admin'], replacement: null },
  { field: 'commissionRate', allowedRoles: ['Owner', 'Admin'], replacement: null },
  { field: 'commissionAmount', allowedRoles: ['Owner', 'Admin'], replacement: null },

  // Salary/pay fields - only Owner can see
  { field: 'salary', allowedRoles: ['Owner'], replacement: null },
  { field: 'hourlyRate', allowedRoles: ['Owner'], replacement: null },
  { field: 'payRate', allowedRoles: ['Owner'], replacement: null },

  // Vendor pricing - only Owner, Admin, Manager can see
  { field: 'vendorPrice', allowedRoles: ['Owner', 'Admin', 'Manager'], replacement: null },
  { field: 'supplierCost', allowedRoles: ['Owner', 'Admin', 'Manager'], replacement: null },
];

/**
 * Type for objects with string keys and unknown values.
 */
type DataObject = Record<string, unknown>;

/**
 * Filters sensitive fields from a data object based on user role.
 *
 * @param data - The data object to filter
 * @param userRole - The user's role
 * @param sensitiveFields - Optional custom field configurations
 * @returns The data object with sensitive fields filtered
 */
function filterObjectFields<T extends DataObject>(
  data: T,
  userRole: Role,
  sensitiveFields: SensitiveFieldConfig[] = DEFAULT_SENSITIVE_FIELDS
): T {
  const filtered = { ...data };

  for (const fieldConfig of sensitiveFields) {
    if (fieldConfig.field in filtered) {
      if (!fieldConfig.allowedRoles.includes(userRole)) {
        if (fieldConfig.replacement !== undefined) {
          (filtered as DataObject)[fieldConfig.field] = fieldConfig.replacement;
        } else {
          delete (filtered as DataObject)[fieldConfig.field];
        }
      }
    }
  }

  return filtered;
}

/**
 * Filters sensitive data from an array of objects based on user role.
 * Removes or replaces fields that the user's role should not see.
 *
 * @param data - Array of data objects to filter
 * @param userRole - The user's role
 * @param sensitiveFields - Array of field names to check (uses defaults if not provided)
 * @returns Filtered array with sensitive fields removed/replaced
 *
 * @example
 * ```ts
 * const inventory = await getInventory();
 * const filteredInventory = filterDataByRole(inventory, 'Sales', ['cost', 'margin']);
 * // Sales users won't see cost or margin fields
 * ```
 */
export function filterDataByRole<T extends DataObject>(
  data: T[],
  userRole: Role,
  sensitiveFields?: string[]
): T[] {
  if (!isValidRole(userRole)) {
    console.warn(`[Permissions] Invalid role for data filtering: ${userRole}`);
    return [];
  }

  // Convert simple field names to config format if provided
  let fieldConfigs = DEFAULT_SENSITIVE_FIELDS;
  if (sensitiveFields && sensitiveFields.length > 0) {
    fieldConfigs = sensitiveFields.map((field) => {
      // Find existing config or create default
      const existing = DEFAULT_SENSITIVE_FIELDS.find((c) => c.field === field);
      return existing || { field, allowedRoles: ['Owner', 'Admin'] as Role[], replacement: null };
    });
  }

  return data.map((item) => filterObjectFields(item, userRole, fieldConfigs));
}

/**
 * Filters a single data object based on user role.
 *
 * @param data - Data object to filter
 * @param userRole - The user's role
 * @param sensitiveFields - Array of field names to check
 * @returns Filtered object with sensitive fields removed/replaced
 */
export function filterSingleByRole<T extends DataObject>(
  data: T,
  userRole: Role,
  sensitiveFields?: string[]
): T {
  const result = filterDataByRole([data], userRole, sensitiveFields);
  return result[0];
}

// =============================================================================
// ROLE UTILITY FUNCTIONS
// =============================================================================

/**
 * Compares two roles and returns which has higher permissions.
 *
 * @param role1 - First role to compare
 * @param role2 - Second role to compare
 * @returns Positive if role1 > role2, negative if role1 < role2, 0 if equal
 */
export function compareRoles(role1: Role, role2: Role): number {
  return ROLE_HIERARCHY[role1] - ROLE_HIERARCHY[role2];
}

/**
 * Checks if one role is higher than or equal to another in the hierarchy.
 *
 * @param userRole - The user's role
 * @param minRole - The minimum required role
 * @returns true if userRole >= minRole in hierarchy
 */
export function isRoleAtLeast(userRole: Role, minRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

/**
 * Gets the display name for a role.
 *
 * @param role - The role to get display name for
 * @returns Human-readable role name
 */
export function getRoleDisplayName(role: Role): string {
  const displayNames: Record<Role, string> = {
    Owner: 'Owner',
    Admin: 'Administrator',
    Manager: 'Manager',
    Sales: 'Sales Representative',
    Driver: 'Driver',
    Office: 'Office Staff',
  };

  return displayNames[role] || role;
}

/**
 * Gets the color associated with a role for UI display.
 *
 * @param role - The role to get color for
 * @returns Tailwind CSS color class
 */
export function getRoleColor(role: Role): string {
  const colors: Record<Role, string> = {
    Owner: 'bg-purple-500',
    Admin: 'bg-red-500',
    Manager: 'bg-blue-500',
    Sales: 'bg-green-500',
    Driver: 'bg-orange-500',
    Office: 'bg-cyan-500',
  };

  return colors[role] || 'bg-gray-500';
}

/**
 * Gets the text color associated with a role for UI display.
 *
 * @param role - The role to get text color for
 * @returns Tailwind CSS text color class
 */
export function getRoleTextColor(role: Role): string {
  const colors: Record<Role, string> = {
    Owner: 'text-purple-500',
    Admin: 'text-red-500',
    Manager: 'text-blue-500',
    Sales: 'text-green-500',
    Driver: 'text-orange-500',
    Office: 'text-cyan-500',
  };

  return colors[role] || 'text-gray-500';
}

// =============================================================================
// EXPORTS
// =============================================================================

// Re-export types for convenience
export type { Role, Permission, NavItem, PermissionCheckResult, SensitiveFieldConfig };
export { ROLES, ROLE_HIERARCHY, isValidRole, isValidPermission };
