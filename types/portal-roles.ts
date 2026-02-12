/**
 * RCRS Portal - Unified Role & Permission Type Definitions
 *
 * This file defines the comprehensive role-based access control (RBAC) system
 * for all portal experiences including internal staff and customers.
 *
 * Role Hierarchy (Internal):
 * - ADMIN (Michael, Sara): Full system access, approval authority
 * - MANAGER (Destin): Operations oversight, view all, limited edit
 * - SALES_REP (John, Bart, Tia, Boston): Own leads/jobs, personal stats
 * - DRIVER: Delivery queue, route navigation, photo upload
 * - PROJECT_MANAGER: Job scheduling, inventory coordination
 * - CUSTOMER: Job status, weather alerts, document viewing
 *
 * @version 2.0.0
 */

// =============================================================================
// PORTAL ROLE DEFINITIONS
// =============================================================================

/**
 * All portal roles including internal staff and customers
 */
export type PortalRole =
  | 'admin'
  | 'manager'
  | 'sales_rep'
  | 'driver'
  | 'project_manager'
  | 'customer';

/**
 * Role hierarchy levels for permission inheritance
 */
export const PORTAL_ROLE_HIERARCHY: Record<PortalRole, number> = {
  admin: 100,
  manager: 80,
  project_manager: 60,
  sales_rep: 50,
  driver: 40,
  customer: 10,
};

/**
 * Valid portal roles as array for runtime validation
 */
export const PORTAL_ROLES: readonly PortalRole[] = [
  'admin',
  'manager',
  'sales_rep',
  'driver',
  'project_manager',
  'customer',
] as const;

// =============================================================================
// PERMISSION DEFINITIONS
// =============================================================================

/**
 * All portal permissions organized by module
 */
export type PortalPermission =
  // Dashboard permissions
  | 'dashboard.view'
  | 'dashboard.view_all'
  | 'dashboard.view_own'

  // User management
  | 'users.view'
  | 'users.create'
  | 'users.edit'
  | 'users.delete'
  | 'users.manage_roles'

  // Profile management
  | 'profile.view_own'
  | 'profile.edit_own'
  | 'profile.approve_edits'
  | 'profile.view_all'

  // Leads & Sales
  | 'leads.view_all'
  | 'leads.view_own'
  | 'leads.create'
  | 'leads.edit_own'
  | 'leads.edit_all'
  | 'leads.delete'
  | 'leads.assign'

  // Jobs
  | 'jobs.view_all'
  | 'jobs.view_own'
  | 'jobs.view_assigned'
  | 'jobs.create'
  | 'jobs.edit'
  | 'jobs.delete'
  | 'jobs.schedule'
  | 'jobs.assign'

  // Inventory
  | 'inventory.view'
  | 'inventory.view_costs'
  | 'inventory.edit'
  | 'inventory.create'
  | 'inventory.delete'
  | 'inventory.restock'
  | 'inventory.adjust_qty'

  // Deliveries
  | 'deliveries.view_all'
  | 'deliveries.view_own'
  | 'deliveries.view_queue'
  | 'deliveries.create'
  | 'deliveries.assign'
  | 'deliveries.update_status'
  | 'deliveries.upload_photos'
  | 'deliveries.confirm'
  | 'deliveries.route_navigation'

  // Orders
  | 'orders.view_all'
  | 'orders.view_own'
  | 'orders.create'
  | 'orders.edit'
  | 'orders.approve'
  | 'orders.cancel'

  // Billing & Invoices
  | 'billing.view'
  | 'billing.view_own'
  | 'billing.create'
  | 'billing.edit'
  | 'billing.send'
  | 'billing.void'

  // Schedule
  | 'schedule.view_all'
  | 'schedule.view_own'
  | 'schedule.create'
  | 'schedule.edit'
  | 'schedule.delete'

  // Reports & Analytics
  | 'reports.view_all'
  | 'reports.view_own'
  | 'reports.export'
  | 'reports.financial'

  // Communications
  | 'communications.view_all'
  | 'communications.view_own'
  | 'communications.send'
  | 'communications.templates'

  // Documents
  | 'documents.view_all'
  | 'documents.view_own'
  | 'documents.upload'
  | 'documents.delete'

  // Settings & Admin
  | 'settings.view'
  | 'settings.edit'
  | 'settings.system'

  // Approvals
  | 'approvals.view_queue'
  | 'approvals.approve'
  | 'approvals.reject'

  // Weather & Alerts
  | 'weather.view_alerts'
  | 'weather.create_alerts'

  // Customer-specific
  | 'customer.view_job_status'
  | 'customer.upload_images'
  | 'customer.view_documents'
  | 'customer.contact_rep'
  | 'customer.view_weather';

/**
 * All valid permissions as array for runtime validation
 */
export const PORTAL_PERMISSIONS: readonly PortalPermission[] = [
  'dashboard.view',
  'dashboard.view_all',
  'dashboard.view_own',
  'users.view',
  'users.create',
  'users.edit',
  'users.delete',
  'users.manage_roles',
  'profile.view_own',
  'profile.edit_own',
  'profile.approve_edits',
  'profile.view_all',
  'leads.view_all',
  'leads.view_own',
  'leads.create',
  'leads.edit_own',
  'leads.edit_all',
  'leads.delete',
  'leads.assign',
  'jobs.view_all',
  'jobs.view_own',
  'jobs.view_assigned',
  'jobs.create',
  'jobs.edit',
  'jobs.delete',
  'jobs.schedule',
  'jobs.assign',
  'inventory.view',
  'inventory.view_costs',
  'inventory.edit',
  'inventory.create',
  'inventory.delete',
  'inventory.restock',
  'inventory.adjust_qty',
  'deliveries.view_all',
  'deliveries.view_own',
  'deliveries.view_queue',
  'deliveries.create',
  'deliveries.assign',
  'deliveries.update_status',
  'deliveries.upload_photos',
  'deliveries.confirm',
  'deliveries.route_navigation',
  'orders.view_all',
  'orders.view_own',
  'orders.create',
  'orders.edit',
  'orders.approve',
  'orders.cancel',
  'billing.view',
  'billing.view_own',
  'billing.create',
  'billing.edit',
  'billing.send',
  'billing.void',
  'schedule.view_all',
  'schedule.view_own',
  'schedule.create',
  'schedule.edit',
  'schedule.delete',
  'reports.view_all',
  'reports.view_own',
  'reports.export',
  'reports.financial',
  'communications.view_all',
  'communications.view_own',
  'communications.send',
  'communications.templates',
  'documents.view_all',
  'documents.view_own',
  'documents.upload',
  'documents.delete',
  'settings.view',
  'settings.edit',
  'settings.system',
  'approvals.view_queue',
  'approvals.approve',
  'approvals.reject',
  'weather.view_alerts',
  'weather.create_alerts',
  'customer.view_job_status',
  'customer.upload_images',
  'customer.view_documents',
  'customer.contact_rep',
  'customer.view_weather',
] as const;

// =============================================================================
// ROLE-TO-PERMISSION MAPPING
// =============================================================================

/**
 * Master mapping of portal roles to their granted permissions
 */
export const PORTAL_ROLE_PERMISSIONS: Readonly<Record<PortalRole, readonly PortalPermission[]>> = {
  /**
   * ADMIN (Michael, Sara)
   * Full access to everything including:
   * - User management
   * - Approval queue for profile edits
   * - System settings
   * - All reports and analytics
   */
  admin: [
    // Dashboard - Full access
    'dashboard.view',
    'dashboard.view_all',
    'dashboard.view_own',
    // Users - Full access
    'users.view',
    'users.create',
    'users.edit',
    'users.delete',
    'users.manage_roles',
    // Profile - Full access
    'profile.view_own',
    'profile.edit_own',
    'profile.approve_edits',
    'profile.view_all',
    // Leads - Full access
    'leads.view_all',
    'leads.view_own',
    'leads.create',
    'leads.edit_own',
    'leads.edit_all',
    'leads.delete',
    'leads.assign',
    // Jobs - Full access
    'jobs.view_all',
    'jobs.view_own',
    'jobs.view_assigned',
    'jobs.create',
    'jobs.edit',
    'jobs.delete',
    'jobs.schedule',
    'jobs.assign',
    // Inventory - Full access
    'inventory.view',
    'inventory.view_costs',
    'inventory.edit',
    'inventory.create',
    'inventory.delete',
    'inventory.restock',
    'inventory.adjust_qty',
    // Deliveries - Full access
    'deliveries.view_all',
    'deliveries.view_own',
    'deliveries.view_queue',
    'deliveries.create',
    'deliveries.assign',
    'deliveries.update_status',
    'deliveries.upload_photos',
    'deliveries.confirm',
    'deliveries.route_navigation',
    // Orders - Full access
    'orders.view_all',
    'orders.view_own',
    'orders.create',
    'orders.edit',
    'orders.approve',
    'orders.cancel',
    // Billing - Full access
    'billing.view',
    'billing.view_own',
    'billing.create',
    'billing.edit',
    'billing.send',
    'billing.void',
    // Schedule - Full access
    'schedule.view_all',
    'schedule.view_own',
    'schedule.create',
    'schedule.edit',
    'schedule.delete',
    // Reports - Full access
    'reports.view_all',
    'reports.view_own',
    'reports.export',
    'reports.financial',
    // Communications - Full access
    'communications.view_all',
    'communications.view_own',
    'communications.send',
    'communications.templates',
    // Documents - Full access
    'documents.view_all',
    'documents.view_own',
    'documents.upload',
    'documents.delete',
    // Settings - Full access
    'settings.view',
    'settings.edit',
    'settings.system',
    // Approvals - Full access
    'approvals.view_queue',
    'approvals.approve',
    'approvals.reject',
    // Weather - Full access
    'weather.view_alerts',
    'weather.create_alerts',
  ],

  /**
   * MANAGER (Destin)
   * Operations oversight role:
   * - View all data, limited edit
   * - Team performance dashboards
   * - Approval workflows (view only)
   * - Inventory oversight
   * - Schedule management
   */
  manager: [
    // Dashboard - Full view
    'dashboard.view',
    'dashboard.view_all',
    'dashboard.view_own',
    // Users - View only
    'users.view',
    // Profile - View all, edit own
    'profile.view_own',
    'profile.edit_own',
    'profile.view_all',
    // Leads - View all, limited edit
    'leads.view_all',
    'leads.view_own',
    'leads.edit_own',
    // Jobs - Full view, limited edit
    'jobs.view_all',
    'jobs.view_own',
    'jobs.view_assigned',
    'jobs.schedule',
    // Inventory - Full access except delete
    'inventory.view',
    'inventory.view_costs',
    'inventory.edit',
    'inventory.restock',
    'inventory.adjust_qty',
    // Deliveries - View all, assign
    'deliveries.view_all',
    'deliveries.view_own',
    'deliveries.view_queue',
    'deliveries.assign',
    // Orders - View all, approve
    'orders.view_all',
    'orders.view_own',
    'orders.approve',
    // Billing - View only
    'billing.view',
    'billing.view_own',
    // Schedule - Full access
    'schedule.view_all',
    'schedule.view_own',
    'schedule.create',
    'schedule.edit',
    // Reports - View all, export
    'reports.view_all',
    'reports.view_own',
    'reports.export',
    // Communications - View all
    'communications.view_all',
    'communications.view_own',
    'communications.send',
    // Documents - View all
    'documents.view_all',
    'documents.view_own',
    // Approvals - View only
    'approvals.view_queue',
    // Weather - View alerts
    'weather.view_alerts',
  ],

  /**
   * SALES_REP (John, Bart, Tia, Boston)
   * Sales-focused role:
   * - Their own leads and jobs only
   * - Personal performance stats
   * - Profile editor (pending approval)
   * - Customer communication
   * - Commission tracking
   */
  sales_rep: [
    // Dashboard - Own data only
    'dashboard.view',
    'dashboard.view_own',
    // Profile - Own only, edits require approval
    'profile.view_own',
    'profile.edit_own',
    // Leads - Own only
    'leads.view_own',
    'leads.create',
    'leads.edit_own',
    // Jobs - Own only
    'jobs.view_own',
    // Inventory - View only (quantities)
    'inventory.view',
    // Deliveries - View own
    'deliveries.view_own',
    // Orders - Own only
    'orders.view_own',
    'orders.create',
    // Billing - View own
    'billing.view_own',
    // Schedule - View own
    'schedule.view_own',
    // Reports - Own only
    'reports.view_own',
    // Communications - Own
    'communications.view_own',
    'communications.send',
    // Documents - Own
    'documents.view_own',
    'documents.upload',
  ],

  /**
   * DRIVER (Richard Geahr, Tae)
   * Delivery-focused role:
   * - Delivery queue
   * - Route navigation
   * - Loading checklists
   * - Delivery confirmation
   * - Photo upload for deliveries
   */
  driver: [
    // Dashboard - Basic view
    'dashboard.view',
    'dashboard.view_own',
    // Profile - Own only
    'profile.view_own',
    // Jobs - Assigned only
    'jobs.view_assigned',
    // Inventory - View for deliveries, adjust qty
    'inventory.view',
    'inventory.adjust_qty',
    // Deliveries - Own queue, full workflow
    'deliveries.view_own',
    'deliveries.view_queue',
    'deliveries.update_status',
    'deliveries.upload_photos',
    'deliveries.confirm',
    'deliveries.route_navigation',
    // Schedule - View own
    'schedule.view_own',
    // Documents - Upload only (delivery photos)
    'documents.upload',
  ],

  /**
   * PROJECT_MANAGER (Bart, John)
   * Project coordination role:
   * - Job scheduling
   * - Inventory needs for jobs
   * - Delivery coordination
   * - JobNimbus data access
   * - Customer communication
   */
  project_manager: [
    // Dashboard - View all for oversight
    'dashboard.view',
    'dashboard.view_all',
    'dashboard.view_own',
    // Profile - Own only
    'profile.view_own',
    'profile.edit_own',
    // Leads - View all for coordination
    'leads.view_all',
    'leads.view_own',
    // Jobs - Full access
    'jobs.view_all',
    'jobs.view_own',
    'jobs.view_assigned',
    'jobs.create',
    'jobs.edit',
    'jobs.schedule',
    // Inventory - View and request
    'inventory.view',
    'inventory.restock',
    // Deliveries - View and create
    'deliveries.view_all',
    'deliveries.view_own',
    'deliveries.create',
    // Orders - Create and view
    'orders.view_all',
    'orders.view_own',
    'orders.create',
    'orders.edit',
    // Schedule - Full access
    'schedule.view_all',
    'schedule.view_own',
    'schedule.create',
    'schedule.edit',
    // Communications - Full send
    'communications.view_own',
    'communications.send',
    // Documents - View and upload
    'documents.view_all',
    'documents.view_own',
    'documents.upload',
  ],

  /**
   * CUSTOMER (External)
   * Customer portal access:
   * - Their job status only
   * - Weather/storm alerts
   * - Document viewing
   * - Rep contact info
   * - Image uploads
   */
  customer: [
    // Dashboard - Own only
    'dashboard.view_own',
    // Profile - View own
    'profile.view_own',
    // Customer-specific permissions
    'customer.view_job_status',
    'customer.upload_images',
    'customer.view_documents',
    'customer.contact_rep',
    'customer.view_weather',
    // Documents - View own, upload
    'documents.view_own',
    'documents.upload',
    // Weather - View alerts
    'weather.view_alerts',
  ],
};

// =============================================================================
// USER TYPE DEFINITIONS
// =============================================================================

/**
 * Portal user with role and permissions
 */
export interface PortalUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: PortalRole;
  permissions: PortalPermission[];
  isActive: boolean;
  pin?: string;
  slug?: string;
  createdAt: string;
  lastLogin?: string;
}

/**
 * Staff member configuration
 */
export interface StaffMember extends PortalUser {
  role: Exclude<PortalRole, 'customer'>;
  department?: string;
  reportingTo?: string;
  commissionRate?: number;
}

/**
 * Customer user configuration
 */
export interface CustomerUser extends PortalUser {
  role: 'customer';
  jobId?: string;
  salesRepId?: string;
  accessCode?: string;
  accessCodeExpiry?: string;
}

// =============================================================================
// NAVIGATION & UI TYPES
// =============================================================================

/**
 * Portal navigation item
 */
export interface PortalNavItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  requiredPermission?: PortalPermission;
  requiredPermissions?: PortalPermission[];
  minRole?: PortalRole;
  badge?: number | string;
  children?: PortalNavItem[];
  showInMobile?: boolean;
  isExternal?: boolean;
}

/**
 * Dashboard widget configuration
 */
export interface DashboardWidget {
  id: string;
  title: string;
  type: 'stat' | 'chart' | 'list' | 'action' | 'alert';
  requiredPermission?: PortalPermission;
  minRole?: PortalRole;
  size?: 'small' | 'medium' | 'large';
  position?: number;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if a string is a valid PortalRole
 */
export function isValidPortalRole(value: unknown): value is PortalRole {
  return typeof value === 'string' && PORTAL_ROLES.includes(value as PortalRole);
}

/**
 * Type guard to check if a string is a valid PortalPermission
 */
export function isValidPortalPermission(value: unknown): value is PortalPermission {
  return typeof value === 'string' && PORTAL_PERMISSIONS.includes(value as PortalPermission);
}

// =============================================================================
// ROLE DISPLAY CONFIGURATION
// =============================================================================

/**
 * Role display names and colors for UI
 */
export const PORTAL_ROLE_CONFIG: Record<PortalRole, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  textColor: string;
  icon: string;
}> = {
  admin: {
    label: 'Administrator',
    description: 'Full system access and approval authority',
    color: 'red',
    bgColor: 'bg-red-500',
    textColor: 'text-red-500',
    icon: 'Shield',
  },
  manager: {
    label: 'Manager',
    description: 'Operations oversight and team management',
    color: 'blue',
    bgColor: 'bg-blue-500',
    textColor: 'text-blue-500',
    icon: 'Users',
  },
  sales_rep: {
    label: 'Sales Representative',
    description: 'Lead and customer management',
    color: 'green',
    bgColor: 'bg-green-500',
    textColor: 'text-green-500',
    icon: 'TrendingUp',
  },
  driver: {
    label: 'Driver',
    description: 'Delivery and logistics',
    color: 'orange',
    bgColor: 'bg-orange-500',
    textColor: 'text-orange-500',
    icon: 'Truck',
  },
  project_manager: {
    label: 'Project Manager',
    description: 'Job coordination and scheduling',
    color: 'purple',
    bgColor: 'bg-purple-500',
    textColor: 'text-purple-500',
    icon: 'Calendar',
  },
  customer: {
    label: 'Customer',
    description: 'Job status and communication',
    color: 'teal',
    bgColor: 'bg-teal-500',
    textColor: 'text-teal-500',
    icon: 'User',
  },
};
