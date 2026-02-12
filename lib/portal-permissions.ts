/**
 * RCRS Portal - Permission Checking Service
 *
 * This module provides the core permission checking functionality for the
 * unified portal system. It handles:
 * - Role-to-permission mapping
 * - Permission checks for users
 * - Route access control
 * - Navigation filtering
 * - Data filtering by role
 *
 * @version 2.0.0
 */

import {
  PortalRole,
  PortalPermission,
  PortalNavItem,
  PortalUser,
  DashboardWidget,
  PORTAL_ROLE_PERMISSIONS,
  PORTAL_ROLE_HIERARCHY,
  PORTAL_ROLES,
  PORTAL_PERMISSIONS,
  isValidPortalRole,
  isValidPortalPermission,
} from '../types/portal-roles';

// =============================================================================
// PERMISSION CHECK FUNCTIONS
// =============================================================================

/**
 * Checks if a user with the given role has a specific permission.
 *
 * @param userRole - The user's role
 * @param permission - The permission to check
 * @returns true if the user has the permission, false otherwise
 */
export function hasPortalPermission(userRole: PortalRole, permission: PortalPermission): boolean {
  if (!isValidPortalRole(userRole)) {
    console.warn(`[Portal Permissions] Invalid role: ${userRole}`);
    return false;
  }

  if (!isValidPortalPermission(permission)) {
    console.warn(`[Portal Permissions] Invalid permission: ${permission}`);
    return false;
  }

  const rolePermissions = PORTAL_ROLE_PERMISSIONS[userRole];
  return rolePermissions.includes(permission);
}

/**
 * Checks if a user has ALL of the specified permissions.
 *
 * @param userRole - The user's role
 * @param permissions - Array of permissions to check
 * @returns true only if the user has ALL permissions
 */
export function hasAllPortalPermissions(userRole: PortalRole, permissions: PortalPermission[]): boolean {
  return permissions.every((permission) => hasPortalPermission(userRole, permission));
}

/**
 * Checks if a user has ANY of the specified permissions.
 *
 * @param userRole - The user's role
 * @param permissions - Array of permissions to check
 * @returns true if the user has at least ONE permission
 */
export function hasAnyPortalPermission(userRole: PortalRole, permissions: PortalPermission[]): boolean {
  return permissions.some((permission) => hasPortalPermission(userRole, permission));
}

/**
 * Gets all permissions for a given role.
 *
 * @param userRole - The user's role
 * @returns Array of permissions granted to the role
 */
export function getPortalPermissionsForRole(userRole: PortalRole): readonly PortalPermission[] {
  if (!isValidPortalRole(userRole)) {
    return [];
  }
  return PORTAL_ROLE_PERMISSIONS[userRole];
}

/**
 * Checks if one role is higher than or equal to another in the hierarchy.
 *
 * @param userRole - The user's role
 * @param minRole - The minimum required role
 * @returns true if userRole >= minRole in hierarchy
 */
export function isRoleAtLeast(userRole: PortalRole, minRole: PortalRole): boolean {
  return PORTAL_ROLE_HIERARCHY[userRole] >= PORTAL_ROLE_HIERARCHY[minRole];
}

/**
 * Compares two roles and returns which has higher permissions.
 *
 * @param role1 - First role to compare
 * @param role2 - Second role to compare
 * @returns Positive if role1 > role2, negative if role1 < role2, 0 if equal
 */
export function compareRoles(role1: PortalRole, role2: PortalRole): number {
  return PORTAL_ROLE_HIERARCHY[role1] - PORTAL_ROLE_HIERARCHY[role2];
}

// =============================================================================
// ROUTE ACCESS CONTROL
// =============================================================================

/**
 * Route access configuration
 */
interface RouteAccessConfig {
  pattern: string;
  permission?: PortalPermission;
  permissions?: PortalPermission[];
  minRole?: PortalRole;
  isPublic?: boolean;
  requiresAuth?: boolean;
}

/**
 * Portal route access configuration
 */
const PORTAL_ROUTE_ACCESS: ReadonlyArray<RouteAccessConfig> = [
  // Public routes
  { pattern: '/portal', isPublic: true, requiresAuth: false },
  { pattern: '/customer', isPublic: true, requiresAuth: false },

  // Dashboard routes
  { pattern: '/portal/dashboard', permission: 'dashboard.view' },

  // Admin routes
  { pattern: '/portal/admin', minRole: 'admin' },
  { pattern: '/portal/admin/users', permission: 'users.view' },
  { pattern: '/portal/admin/operations', minRole: 'admin' },
  { pattern: '/portal/admin/pricing', minRole: 'admin' },
  { pattern: '/portal/admin/services', minRole: 'admin' },
  { pattern: '/portal/admin/team', permission: 'users.view' },
  { pattern: '/portal/admin/blog', minRole: 'admin' },
  { pattern: '/portal/admin/images', minRole: 'admin' },
  { pattern: '/portal/admin/training', minRole: 'admin' },
  { pattern: '/portal/admin/areas', minRole: 'admin' },

  // Manager routes
  { pattern: '/portal/manager', minRole: 'manager' },

  // Sales routes
  { pattern: '/portal/sales', permission: 'leads.view_own' },

  // Driver routes
  { pattern: '/portal/driver', permission: 'deliveries.view_queue' },

  // Delivery management routes
  { pattern: '/portal/delivery', permission: 'deliveries.view_queue' },

  // Project Manager routes
  { pattern: '/portal/pm', permission: 'jobs.schedule' },

  // Office routes
  { pattern: '/portal/office', permissions: ['orders.view_all', 'billing.view'] },
  { pattern: '/portal/billing', permission: 'billing.view' },

  // Inventory routes
  { pattern: '/portal/inventory', permission: 'inventory.view' },

  // Schedule routes
  { pattern: '/portal/schedule', permission: 'schedule.view_own' },

  // Orders routes
  { pattern: '/portal/orders', permission: 'orders.view_own' },

  // Reports routes
  { pattern: '/portal/reports', permission: 'reports.view_own' },

  // Tasks routes
  { pattern: '/portal/tasks', permission: 'dashboard.view' },

  // Customer portal routes
  { pattern: '/portal/customers', permission: 'users.view' },

  // Directory routes
  { pattern: '/portal/directory', permission: 'users.view' },

  // Transactions routes
  { pattern: '/portal/transactions', permission: 'billing.view' },

  // Locations routes
  { pattern: '/portal/locations', permission: 'jobs.view_all' },

  // Customer dashboard
  { pattern: '/customer/dashboard', permission: 'customer.view_job_status' },
];

/**
 * Checks if a user can access a specific route.
 *
 * @param userRole - The user's role
 * @param route - The route path to check
 * @returns true if the user can access the route
 */
export function canAccessPortalRoute(userRole: PortalRole, route: string): boolean {
  if (!isValidPortalRole(userRole)) {
    return false;
  }

  const normalizedRoute = route.toLowerCase().replace(/\/$/, '');

  // Find matching route configuration
  const routeConfig = PORTAL_ROUTE_ACCESS.find((config) => {
    const pattern = config.pattern.toLowerCase();

    // Exact match
    if (pattern === normalizedRoute) {
      return true;
    }

    // Prefix match for nested routes
    if (normalizedRoute.startsWith(pattern + '/')) {
      return true;
    }

    return false;
  });

  // No config found - check if it's a portal route
  if (!routeConfig) {
    if (normalizedRoute.startsWith('/portal')) {
      return hasPortalPermission(userRole, 'dashboard.view');
    }
    if (normalizedRoute.startsWith('/customer')) {
      return userRole === 'customer' || isRoleAtLeast(userRole, 'sales_rep');
    }
    return true; // Allow access to unknown routes
  }

  // Public route - always allow
  if (routeConfig.isPublic) {
    return true;
  }

  // Check minimum role requirement
  if (routeConfig.minRole) {
    if (!isRoleAtLeast(userRole, routeConfig.minRole)) {
      return false;
    }
  }

  // Check single permission requirement
  if (routeConfig.permission) {
    return hasPortalPermission(userRole, routeConfig.permission);
  }

  // Check multiple permissions (needs at least one)
  if (routeConfig.permissions && routeConfig.permissions.length > 0) {
    return hasAnyPortalPermission(userRole, routeConfig.permissions);
  }

  return true;
}

/**
 * Gets the default redirect URL for a role.
 */
export function getDefaultRouteForRole(role: PortalRole): string {
  switch (role) {
    case 'admin':
      return '/portal/dashboard';
    case 'manager':
      return '/portal/dashboard';
    case 'sales_rep':
      return '/portal/dashboard';
    case 'project_manager':
      return '/portal/pm';
    case 'driver':
      return '/portal/driver';
    case 'customer':
      return '/customer/dashboard';
    default:
      return '/portal/dashboard';
  }
}

/**
 * Gets redirect URL when access is denied.
 */
export function getAccessDeniedRedirect(userRole: PortalRole): string {
  return getDefaultRouteForRole(userRole);
}

// =============================================================================
// NAVIGATION FILTERING
// =============================================================================

/**
 * Filters navigation items based on user role.
 */
function filterNavItems(items: PortalNavItem[], userRole: PortalRole): PortalNavItem[] {
  return items
    .filter((item) => {
      // Check minimum role requirement
      if (item.minRole) {
        if (!isRoleAtLeast(userRole, item.minRole)) {
          return false;
        }
      }

      // Check single permission requirement
      if (item.requiredPermission) {
        if (!hasPortalPermission(userRole, item.requiredPermission)) {
          return false;
        }
      }

      // Check multiple permissions (needs at least one)
      if (item.requiredPermissions && item.requiredPermissions.length > 0) {
        if (!hasAnyPortalPermission(userRole, item.requiredPermissions)) {
          return false;
        }
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
 * Gets visible navigation items for a user based on their role.
 *
 * @param userRole - The user's role
 * @returns Array of navigation items the user can see
 */
export function getVisiblePortalNavItems(userRole: PortalRole): PortalNavItem[] {
  if (!isValidPortalRole(userRole)) {
    return [];
  }

  return filterNavItems(PORTAL_NAVIGATION, userRole);
}

/**
 * Gets mobile navigation items for a user.
 */
export function getMobilePortalNavItems(userRole: PortalRole): PortalNavItem[] {
  return getVisiblePortalNavItems(userRole).filter((item) => item.showInMobile !== false);
}

// =============================================================================
// PORTAL NAVIGATION CONFIGURATION
// =============================================================================

/**
 * Master portal navigation configuration
 */
const PORTAL_NAVIGATION: PortalNavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/portal/dashboard',
    icon: 'LayoutDashboard',
    requiredPermission: 'dashboard.view',
    showInMobile: true,
  },
  {
    id: 'command-center',
    label: 'Command Center',
    href: '/command-center',
    icon: 'Command',
    minRole: 'manager',
    showInMobile: true,
  },
  {
    id: 'sales',
    label: 'Sales',
    href: '/portal/sales',
    icon: 'TrendingUp',
    requiredPermission: 'leads.view_own',
    showInMobile: true,
    children: [
      {
        id: 'my-leads',
        label: 'My Leads',
        href: '/portal/sales/leads',
        requiredPermission: 'leads.view_own',
      },
      {
        id: 'my-customers',
        label: 'My Customers',
        href: '/portal/sales/customers',
        requiredPermission: 'leads.view_own',
      },
      {
        id: 'my-performance',
        label: 'My Performance',
        href: '/portal/sales/performance',
        requiredPermission: 'reports.view_own',
      },
      {
        id: 'my-settings',
        label: 'Sales Settings',
        href: '/portal/sales/settings',
        requiredPermission: 'leads.view_own',
      },
    ],
  },
  {
    id: 'deliveries',
    label: 'Deliveries',
    href: '/portal/driver',
    icon: 'Truck',
    requiredPermission: 'deliveries.view_queue',
    showInMobile: true,
    children: [
      {
        id: 'driver-queue',
        label: 'My Deliveries',
        href: '/portal/driver',
        requiredPermission: 'deliveries.view_queue',
      },
      {
        id: 'delivery-management',
        label: 'Manage Deliveries',
        href: '/portal/delivery',
        requiredPermission: 'deliveries.view_all',
      },
      {
        id: 'route-planning',
        label: 'Route Planning',
        href: '/portal/delivery/route',
        requiredPermission: 'deliveries.view_queue',
      },
      {
        id: 'loading-checklist',
        label: 'Loading Checklist',
        href: '/portal/driver/loading',
        requiredPermission: 'deliveries.view_queue',
      },
    ],
  },
  {
    id: 'pm',
    label: 'Project Management',
    href: '/portal/pm',
    icon: 'ClipboardList',
    requiredPermission: 'jobs.schedule',
    showInMobile: true,
  },
  {
    id: 'office',
    label: 'Office',
    href: '/portal/office',
    icon: 'Building',
    requiredPermissions: ['orders.view_all', 'billing.view'],
    showInMobile: true,
  },
  {
    id: 'billing',
    label: 'Billing',
    href: '/portal/billing',
    icon: 'DollarSign',
    requiredPermission: 'billing.view',
    showInMobile: true,
  },
  {
    id: 'inventory',
    label: 'Inventory',
    href: '/portal/inventory',
    icon: 'Package',
    requiredPermission: 'inventory.view',
    showInMobile: true,
  },
  {
    id: 'schedule',
    label: 'Schedule',
    href: '/portal/schedule',
    icon: 'Calendar',
    requiredPermission: 'schedule.view_own',
    showInMobile: true,
  },
  {
    id: 'chat',
    label: 'Chat',
    href: '/portal/chat',
    icon: 'MessageCircle',
    requiredPermission: 'dashboard.view',
    showInMobile: true,
  },
  {
    id: 'training',
    label: 'Training',
    href: '/portal/training',
    icon: 'GraduationCap',
    requiredPermission: 'dashboard.view',
    showInMobile: false,
    children: [
      {
        id: 'sales-training',
        label: 'Sales Training',
        href: '/portal/training/sales',
        requiredPermission: 'dashboard.view',
      },
      {
        id: 'platform-onboarding',
        label: 'Platform Onboarding',
        href: '/portal/training/onboarding',
        requiredPermission: 'dashboard.view',
      },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    href: '/portal/reports',
    icon: 'BarChart',
    requiredPermission: 'reports.view_own',
    showInMobile: false,
  },
  {
    id: 'admin',
    label: 'Admin',
    href: '/portal/admin',
    icon: 'Settings',
    minRole: 'admin',
    showInMobile: false,
    children: [
      {
        id: 'admin-users',
        label: 'User Management',
        href: '/portal/admin/users',
        requiredPermission: 'users.view',
      },
      {
        id: 'admin-operations',
        label: 'Operations',
        href: '/portal/admin/operations',
        minRole: 'admin',
      },
      {
        id: 'admin-approvals',
        label: 'Approvals',
        href: '/portal/admin/approvals',
        requiredPermission: 'approvals.view_queue',
      },
      {
        id: 'admin-team',
        label: 'Team Bios',
        href: '/portal/admin/team',
        requiredPermission: 'users.view',
      },
      {
        id: 'admin-blog',
        label: 'Blog Posts',
        href: '/portal/admin/blog',
        minRole: 'admin',
      },
      {
        id: 'admin-lead-distro',
        label: 'Lead Distribution',
        href: '/portal/admin/lead-distro',
        minRole: 'admin',
      },
      {
        id: 'admin-portal-settings',
        label: 'Portal Settings',
        href: '/portal/admin/portal-settings',
        minRole: 'admin',
      },
      {
        id: 'admin-training',
        label: 'Training Stats',
        href: '/portal/admin/training',
        minRole: 'admin',
      },
      {
        id: 'admin-settings',
        label: 'Settings',
        href: '/portal/admin/settings',
        requiredPermission: 'settings.edit',
      },
    ],
  },
];

// =============================================================================
// DASHBOARD WIDGET FILTERING
// =============================================================================

/**
 * Gets visible dashboard widgets for a user based on their role.
 */
export function getVisibleDashboardWidgets(
  widgets: DashboardWidget[],
  userRole: PortalRole
): DashboardWidget[] {
  return widgets.filter((widget) => {
    if (widget.minRole) {
      if (!isRoleAtLeast(userRole, widget.minRole)) {
        return false;
      }
    }

    if (widget.requiredPermission) {
      if (!hasPortalPermission(userRole, widget.requiredPermission)) {
        return false;
      }
    }

    return true;
  });
}

// =============================================================================
// DATA FILTERING
// =============================================================================

/**
 * Configuration for fields that should be filtered based on role
 */
interface SensitiveFieldConfig {
  field: string;
  allowedRoles: PortalRole[];
  replacement?: unknown;
}

/**
 * Default sensitive field configurations
 */
const DEFAULT_SENSITIVE_FIELDS: SensitiveFieldConfig[] = [
  // Cost/pricing fields - admin and manager only
  { field: 'cost', allowedRoles: ['admin', 'manager'] },
  { field: 'unitCost', allowedRoles: ['admin', 'manager'] },
  { field: 'totalCost', allowedRoles: ['admin', 'manager'] },
  { field: 'margin', allowedRoles: ['admin', 'manager'] },
  { field: 'profit', allowedRoles: ['admin', 'manager'] },
  { field: 'markup', allowedRoles: ['admin', 'manager'] },
  { field: 'vendorPrice', allowedRoles: ['admin', 'manager'] },
  { field: 'supplierCost', allowedRoles: ['admin', 'manager'] },

  // Commission fields - admin only
  { field: 'commission', allowedRoles: ['admin'] },
  { field: 'commissionRate', allowedRoles: ['admin'] },
  { field: 'commissionAmount', allowedRoles: ['admin'] },

  // Salary/pay fields - admin only
  { field: 'salary', allowedRoles: ['admin'] },
  { field: 'hourlyRate', allowedRoles: ['admin'] },
  { field: 'payRate', allowedRoles: ['admin'] },

  // Customer sensitive data - staff only
  { field: 'ssn', allowedRoles: ['admin'] },
  { field: 'creditCard', allowedRoles: ['admin'] },
];

/**
 * Filters sensitive fields from data based on user role.
 *
 * @param data - Array of data objects to filter
 * @param userRole - The user's role
 * @param sensitiveFields - Optional custom field configurations
 * @returns Filtered array with sensitive fields removed
 */
export function filterDataByPortalRole<T extends Record<string, unknown>>(
  data: T[],
  userRole: PortalRole,
  sensitiveFields?: string[]
): T[] {
  if (!isValidPortalRole(userRole)) {
    return [];
  }

  let fieldConfigs = DEFAULT_SENSITIVE_FIELDS;

  if (sensitiveFields && sensitiveFields.length > 0) {
    fieldConfigs = sensitiveFields.map((field) => {
      const existing = DEFAULT_SENSITIVE_FIELDS.find((c) => c.field === field);
      return existing || { field, allowedRoles: ['admin'] as PortalRole[] };
    });
  }

  return data.map((item) => {
    const filtered = { ...item };

    for (const config of fieldConfigs) {
      if (config.field in filtered) {
        if (!config.allowedRoles.includes(userRole)) {
          if (config.replacement !== undefined) {
            (filtered as Record<string, unknown>)[config.field] = config.replacement;
          } else {
            delete (filtered as Record<string, unknown>)[config.field];
          }
        }
      }
    }

    return filtered;
  });
}

/**
 * Filters a single object based on user role.
 */
export function filterSingleByPortalRole<T extends Record<string, unknown>>(
  data: T,
  userRole: PortalRole,
  sensitiveFields?: string[]
): T {
  const result = filterDataByPortalRole([data], userRole, sensitiveFields);
  return result[0];
}

// =============================================================================
// OWNERSHIP CHECKING
// =============================================================================

/**
 * Checks if a user can access data based on ownership.
 *
 * @param userRole - The user's role
 * @param userId - The user's ID
 * @param resourceOwnerId - The owner ID of the resource
 * @param viewAllPermission - Permission to view all resources
 * @param viewOwnPermission - Permission to view own resources
 * @returns true if user can access the resource
 */
export function canAccessResource(
  userRole: PortalRole,
  userId: string,
  resourceOwnerId: string,
  viewAllPermission: PortalPermission,
  viewOwnPermission: PortalPermission
): boolean {
  // Can view all - access granted
  if (hasPortalPermission(userRole, viewAllPermission)) {
    return true;
  }

  // Can view own and is owner - access granted
  if (hasPortalPermission(userRole, viewOwnPermission) && userId === resourceOwnerId) {
    return true;
  }

  return false;
}

/**
 * Filters a list of resources based on ownership.
 */
export function filterResourcesByOwnership<T extends { ownerId?: string; userId?: string; assignedTo?: string }>(
  resources: T[],
  userRole: PortalRole,
  userId: string,
  viewAllPermission: PortalPermission,
  viewOwnPermission: PortalPermission
): T[] {
  // Can view all - return everything
  if (hasPortalPermission(userRole, viewAllPermission)) {
    return resources;
  }

  // Can view own - filter by ownership
  if (hasPortalPermission(userRole, viewOwnPermission)) {
    return resources.filter(
      (r) => r.ownerId === userId || r.userId === userId || r.assignedTo === userId
    );
  }

  return [];
}

// =============================================================================
// EXPORTS
// =============================================================================

export type {
  PortalRole,
  PortalPermission,
  PortalNavItem,
  PortalUser,
  DashboardWidget,
};

export {
  PORTAL_ROLE_PERMISSIONS,
  PORTAL_ROLE_HIERARCHY,
  PORTAL_ROLES,
  PORTAL_PERMISSIONS,
  isValidPortalRole,
  isValidPortalPermission,
};
