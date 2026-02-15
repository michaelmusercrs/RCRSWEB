/**
 * RCRS Portal - Role-Specific Dashboard Configurations
 *
 * This module defines the dashboard layouts, widgets, and navigation
 * for each user role. Each role sees exactly what they need - no more, no less.
 *
 * @version 2.0.0
 */

import { PortalRole, DashboardWidget, PortalPermission } from '../types/portal-roles';

// =============================================================================
// DASHBOARD WIDGET DEFINITIONS
// =============================================================================

/**
 * Stat widget for numeric KPIs
 */
export interface StatWidget extends DashboardWidget {
  type: 'stat';
  dataKey: string;
  format?: 'number' | 'currency' | 'percentage';
  trend?: boolean;
  color?: string;
  icon?: string;
}

/**
 * Action widget for quick actions
 */
export interface ActionWidget extends DashboardWidget {
  type: 'action';
  actions: {
    id: string;
    label: string;
    href: string;
    icon?: string;
    color?: string;
    requiredPermission?: PortalPermission;
  }[];
}

/**
 * List widget for data lists
 */
export interface ListWidget extends DashboardWidget {
  type: 'list';
  dataKey: string;
  limit?: number;
  showViewAll?: boolean;
  viewAllHref?: string;
}

/**
 * Alert widget for notifications
 */
export interface AlertWidget extends DashboardWidget {
  type: 'alert';
  alertTypes: ('warning' | 'info' | 'success' | 'error')[];
  dataKey: string;
}

// =============================================================================
// ADMIN DASHBOARD CONFIGURATION
// =============================================================================

export const ADMIN_DASHBOARD_CONFIG = {
  title: 'Admin Dashboard',
  subtitle: 'Full system overview and management',
  greeting: 'Full access to all portal features and system administration.',

  stats: [
    { id: 'active-deliveries', label: 'Active Deliveries', dataKey: 'activeDeliveries', icon: 'Truck', color: 'blue' },
    { id: 'pending-orders', label: 'Pending Orders', dataKey: 'pendingOrders', icon: 'Clock', color: 'orange' },
    { id: 'low-stock', label: 'Low Stock Items', dataKey: 'lowStockItems', icon: 'AlertCircle', color: 'red' },
    { id: 'pending-approvals', label: 'Pending Approvals', dataKey: 'pendingApprovals', icon: 'CheckSquare', color: 'purple' },
  ],

  navigation: [
    { id: 'command-center', label: 'Command Center', href: '/command-center', icon: 'Command', color: 'bg-gradient-to-r from-lime-500/30 to-emerald-500/30 text-lime-400 ring-1 ring-lime-500/30', featured: true },
    { id: 'operations', label: 'Operations Center', href: '/portal/admin/operations', icon: 'Shield', color: 'bg-red-500/20 text-red-400' },
    { id: 'customers', label: 'Customer Portals', href: '/portal/customers', icon: 'Link2', color: 'bg-teal-500/20 text-teal-400' },
    { id: 'approvals', label: 'Approval Queue', href: '/portal/admin/approvals', icon: 'CheckSquare', color: 'bg-purple-500/20 text-purple-400' },
    { id: 'office', label: 'Office Portal', href: '/portal/office', icon: 'BarChart3', color: 'bg-emerald-500/20 text-emerald-400' },
    { id: 'pm', label: 'PM Portal', href: '/portal/pm', icon: 'Package', color: 'bg-cyan-500/20 text-cyan-400' },
    { id: 'billing', label: 'Billing', href: '/portal/billing', icon: 'DollarSign', color: 'bg-green-500/20 text-green-400' },
    { id: 'inventory', label: 'Inventory', href: '/portal/inventory', icon: 'Box', color: 'bg-orange-500/20 text-orange-400' },
    { id: 'schedule', label: 'Schedule', href: '/portal/schedule', icon: 'Calendar', color: 'bg-purple-500/20 text-purple-400' },
    { id: 'reports', label: 'Reports', href: '/portal/reports', icon: 'BarChart3', color: 'bg-blue-500/20 text-blue-400' },
    { id: 'users', label: 'User Management', href: '/portal/admin/users', icon: 'Users', color: 'bg-pink-500/20 text-pink-400' },
    { id: 'team', label: 'Team Bios', href: '/portal/admin/team', icon: 'UserCircle', color: 'bg-indigo-500/20 text-indigo-400' },
    { id: 'blog', label: 'Blog Posts', href: '/portal/admin/blog', icon: 'BookOpen', color: 'bg-amber-500/20 text-amber-400' },
    { id: 'images', label: 'Image Library', href: '/portal/admin/images', icon: 'Image', color: 'bg-rose-500/20 text-rose-400' },
    { id: 'admin', label: 'Website Settings', href: '/portal/admin', icon: 'Settings', color: 'bg-violet-500/20 text-violet-400' },
  ],

  showRecentActivity: true,
  showAlerts: true,
};

// =============================================================================
// MANAGER DASHBOARD CONFIGURATION
// =============================================================================

export const MANAGER_DASHBOARD_CONFIG = {
  title: 'Manager Dashboard',
  subtitle: 'Team and operations overview',
  greeting: 'Monitor team performance, manage schedules, and oversee inventory.',

  stats: [
    { id: 'active-deliveries', label: 'Active Deliveries', dataKey: 'activeDeliveries', icon: 'Truck', color: 'blue' },
    { id: 'completed-today', label: 'Completed Today', dataKey: 'completedToday', icon: 'CheckCircle', color: 'green' },
    { id: 'pending-orders', label: 'Pending Orders', dataKey: 'pendingOrders', icon: 'Clock', color: 'orange' },
    { id: 'low-stock', label: 'Low Stock Items', dataKey: 'lowStockItems', icon: 'AlertCircle', color: 'red' },
  ],

  navigation: [
    { id: 'command-center', label: 'Command Center', href: '/command-center', icon: 'Command', color: 'bg-gradient-to-r from-lime-500/30 to-emerald-500/30 text-lime-400', featured: true },
    { id: 'team-performance', label: 'Team Performance', href: '/command-center/sales', icon: 'TrendingUp', color: 'bg-green-500/20 text-green-400' },
    { id: 'deliveries', label: 'All Deliveries', href: '/portal/manager/deliveries', icon: 'Truck', color: 'bg-blue-500/20 text-blue-400' },
    { id: 'inventory', label: 'Inventory', href: '/portal/inventory', icon: 'Box', color: 'bg-orange-500/20 text-orange-400' },
    { id: 'schedule', label: 'Schedule', href: '/portal/schedule', icon: 'Calendar', color: 'bg-purple-500/20 text-purple-400' },
    { id: 'reports', label: 'Reports', href: '/portal/reports', icon: 'BarChart3', color: 'bg-blue-500/20 text-blue-400' },
  ],

  showRecentActivity: true,
  showAlerts: true,
  showTeamStatus: true,
};

// =============================================================================
// SALES REP DASHBOARD CONFIGURATION
// =============================================================================

export const SALES_REP_DASHBOARD_CONFIG = {
  title: 'Sales Dashboard',
  subtitle: 'Your leads, jobs, and performance',
  greeting: 'Track your leads, manage your jobs, and view your performance stats.',

  stats: [
    { id: 'my-leads', label: 'My Active Leads', dataKey: 'myActiveLeads', icon: 'Users', color: 'blue' },
    { id: 'my-jobs', label: 'My Active Jobs', dataKey: 'myActiveJobs', icon: 'Briefcase', color: 'green' },
    { id: 'closed-this-month', label: 'Closed This Month', dataKey: 'closedThisMonth', icon: 'CheckCircle', color: 'emerald' },
    { id: 'pipeline-value', label: 'Pipeline Value', dataKey: 'pipelineValue', icon: 'DollarSign', color: 'purple', format: 'currency' },
  ],

  navigation: [
    { id: 'my-leads', label: 'My Leads', href: '/portal/sales/leads', icon: 'Users', color: 'bg-blue-500/20 text-blue-400' },
    { id: 'my-jobs', label: 'My Jobs', href: '/portal/sales/jobs', icon: 'Briefcase', color: 'bg-green-500/20 text-green-400' },
    { id: 'my-stats', label: 'My Performance', href: '/portal/sales/stats', icon: 'TrendingUp', color: 'bg-purple-500/20 text-purple-400' },
    { id: 'my-profile', label: 'Edit My Profile', href: '/portal/sales/profile', icon: 'UserCircle', color: 'bg-indigo-500/20 text-indigo-400' },
    { id: 'inventory', label: 'Check Inventory', href: '/portal/inventory', icon: 'Box', color: 'bg-orange-500/20 text-orange-400' },
    { id: 'schedule', label: 'My Schedule', href: '/portal/schedule', icon: 'Calendar', color: 'bg-cyan-500/20 text-cyan-400' },
  ],

  showMyActivity: true,
  showLeaderboard: true,
  showCommissionTracker: true,
};

// =============================================================================
// DRIVER DASHBOARD CONFIGURATION
// =============================================================================

export const DRIVER_DASHBOARD_CONFIG = {
  title: 'Driver Portal',
  subtitle: 'Your deliveries and route',
  greeting: 'Check your assigned deliveries and update their status.',

  stats: [
    { id: 'todays-deliveries', label: "Today's Deliveries", dataKey: 'todaysDeliveries', icon: 'Truck', color: 'blue' },
    { id: 'completed', label: 'Completed', dataKey: 'completedToday', icon: 'CheckCircle', color: 'green' },
    { id: 'remaining', label: 'Remaining', dataKey: 'remaining', icon: 'Clock', color: 'orange' },
    { id: 'urgent', label: 'Urgent', dataKey: 'urgentDeliveries', icon: 'AlertCircle', color: 'red' },
  ],

  navigation: [
    { id: 'my-deliveries', label: 'My Deliveries', href: '/portal/driver', icon: 'Truck', color: 'bg-blue-500/20 text-blue-400', featured: true },
    { id: 'route', label: 'View Route', href: '/portal/driver/route', icon: 'MapPin', color: 'bg-green-500/20 text-green-400' },
    { id: 'inventory-check', label: 'Check Inventory', href: '/portal/inventory', icon: 'Box', color: 'bg-orange-500/20 text-orange-400' },
  ],

  showDeliveryQueue: true,
  showRouteMap: true,
  showChecklist: true,
};

// =============================================================================
// PROJECT MANAGER DASHBOARD CONFIGURATION
// =============================================================================

export const PROJECT_MANAGER_DASHBOARD_CONFIG = {
  title: 'Project Manager Portal',
  subtitle: 'Job scheduling and coordination',
  greeting: 'Create material orders and manage your job schedules.',

  stats: [
    { id: 'active-jobs', label: 'Active Jobs', dataKey: 'activeJobs', icon: 'Briefcase', color: 'blue' },
    { id: 'pending-orders', label: 'Pending Orders', dataKey: 'pendingOrders', icon: 'Package', color: 'orange' },
    { id: 'scheduled-deliveries', label: 'Scheduled Deliveries', dataKey: 'scheduledDeliveries', icon: 'Truck', color: 'green' },
    { id: 'upcoming', label: 'Upcoming This Week', dataKey: 'upcomingThisWeek', icon: 'Calendar', color: 'purple' },
  ],

  navigation: [
    { id: 'create-order', label: 'Create Material Order', href: '/portal/pm/order', icon: 'Plus', color: 'bg-brand-green/20 text-brand-green', featured: true },
    { id: 'my-jobs', label: 'My Jobs', href: '/portal/pm/jobs', icon: 'Briefcase', color: 'bg-blue-500/20 text-blue-400' },
    { id: 'deliveries', label: 'Track Deliveries', href: '/portal/pm/deliveries', icon: 'Truck', color: 'bg-cyan-500/20 text-cyan-400' },
    { id: 'schedule', label: 'Schedule', href: '/portal/schedule', icon: 'Calendar', color: 'bg-purple-500/20 text-purple-400' },
    { id: 'inventory', label: 'Inventory', href: '/portal/inventory', icon: 'Box', color: 'bg-orange-500/20 text-orange-400' },
    { id: 'jobnimbus', label: 'JobNimbus Sync', href: '/portal/pm/jobnimbus', icon: 'RefreshCw', color: 'bg-indigo-500/20 text-indigo-400' },
  ],

  showActiveOrders: true,
  showDeliveryTimeline: true,
  showJobCalendar: true,
};

// =============================================================================
// CUSTOMER DASHBOARD CONFIGURATION
// =============================================================================

export const CUSTOMER_DASHBOARD_CONFIG = {
  title: 'Customer Portal',
  subtitle: 'Your project status and updates',
  greeting: 'View your project status, weather updates, and communicate with your rep.',

  stats: [
    { id: 'job-status', label: 'Project Status', dataKey: 'jobStatus', icon: 'Briefcase', color: 'blue' },
    { id: 'next-appointment', label: 'Next Appointment', dataKey: 'nextAppointment', icon: 'Calendar', color: 'green' },
    { id: 'weather-status', label: 'Weather Status', dataKey: 'weatherStatus', icon: 'Cloud', color: 'cyan' },
    { id: 'documents', label: 'Documents', dataKey: 'documentCount', icon: 'FileText', color: 'purple' },
  ],

  navigation: [
    { id: 'job-status', label: 'Project Status', href: '/customer/dashboard', icon: 'Briefcase', color: 'bg-blue-500/20 text-blue-400', featured: true },
    { id: 'weather', label: 'Weather Updates', href: '/customer/weather', icon: 'Cloud', color: 'bg-cyan-500/20 text-cyan-400' },
    { id: 'documents', label: 'My Documents', href: '/customer/documents', icon: 'FileText', color: 'bg-purple-500/20 text-purple-400' },
    { id: 'upload', label: 'Upload Images', href: '/customer/upload', icon: 'Upload', color: 'bg-orange-500/20 text-orange-400' },
    { id: 'contact-rep', label: 'Contact My Rep', href: '/customer/contact', icon: 'MessageCircle', color: 'bg-green-500/20 text-green-400' },
  ],

  showProjectTimeline: true,
  showWeatherAlerts: true,
  showRepInfo: true,
};

// =============================================================================
// GET DASHBOARD CONFIG BY ROLE
// =============================================================================

/**
 * Gets the dashboard configuration for a specific role.
 */
export function getDashboardConfig(role: PortalRole) {
  switch (role) {
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
    case 'customer':
      return CUSTOMER_DASHBOARD_CONFIG;
    default:
      return SALES_REP_DASHBOARD_CONFIG;
  }
}

// =============================================================================
// ROLE-SPECIFIC FEATURE FLAGS
// =============================================================================

export interface RoleFeatures {
  canViewAllData: boolean;
  canEditAllData: boolean;
  canApproveRequests: boolean;
  canManageUsers: boolean;
  canViewCosts: boolean;
  canViewCommissions: boolean;
  canExportData: boolean;
  canAccessSettings: boolean;
  canCreateOrders: boolean;
  canAssignDeliveries: boolean;
  canUpdateDeliveryStatus: boolean;
  canUploadPhotos: boolean;
  canUseRouteNavigation: boolean;
  canViewWeatherAlerts: boolean;
  canContactRep: boolean;
  profileEditRequiresApproval: boolean;
}

/**
 * Gets feature flags for a specific role.
 */
export function getRoleFeatures(role: PortalRole): RoleFeatures {
  switch (role) {
    case 'admin':
      return {
        canViewAllData: true,
        canEditAllData: true,
        canApproveRequests: true,
        canManageUsers: true,
        canViewCosts: true,
        canViewCommissions: true,
        canExportData: true,
        canAccessSettings: true,
        canCreateOrders: true,
        canAssignDeliveries: true,
        canUpdateDeliveryStatus: true,
        canUploadPhotos: true,
        canUseRouteNavigation: true,
        canViewWeatherAlerts: true,
        canContactRep: false,
        profileEditRequiresApproval: false,
      };

    case 'manager':
      return {
        canViewAllData: true,
        canEditAllData: false,
        canApproveRequests: false,
        canManageUsers: false,
        canViewCosts: true,
        canViewCommissions: false,
        canExportData: true,
        canAccessSettings: false,
        canCreateOrders: true,
        canAssignDeliveries: true,
        canUpdateDeliveryStatus: true,
        canUploadPhotos: true,
        canUseRouteNavigation: true,
        canViewWeatherAlerts: true,
        canContactRep: false,
        profileEditRequiresApproval: true,
      };

    case 'sales_rep':
      return {
        canViewAllData: false,
        canEditAllData: false,
        canApproveRequests: false,
        canManageUsers: false,
        canViewCosts: false,
        canViewCommissions: false,
        canExportData: false,
        canAccessSettings: false,
        canCreateOrders: true,
        canAssignDeliveries: false,
        canUpdateDeliveryStatus: false,
        canUploadPhotos: true,
        canUseRouteNavigation: false,
        canViewWeatherAlerts: true,
        canContactRep: false,
        profileEditRequiresApproval: true,
      };

    case 'driver':
      return {
        canViewAllData: false,
        canEditAllData: false,
        canApproveRequests: false,
        canManageUsers: false,
        canViewCosts: false,
        canViewCommissions: false,
        canExportData: false,
        canAccessSettings: false,
        canCreateOrders: false,
        canAssignDeliveries: false,
        canUpdateDeliveryStatus: true,
        canUploadPhotos: true,
        canUseRouteNavigation: true,
        canViewWeatherAlerts: true,
        canContactRep: false,
        profileEditRequiresApproval: true,
      };

    case 'project_manager':
      return {
        canViewAllData: true,
        canEditAllData: false,
        canApproveRequests: false,
        canManageUsers: false,
        canViewCosts: false,
        canViewCommissions: false,
        canExportData: false,
        canAccessSettings: false,
        canCreateOrders: true,
        canAssignDeliveries: false,
        canUpdateDeliveryStatus: false,
        canUploadPhotos: true,
        canUseRouteNavigation: false,
        canViewWeatherAlerts: true,
        canContactRep: false,
        profileEditRequiresApproval: true,
      };

    case 'customer':
      return {
        canViewAllData: false,
        canEditAllData: false,
        canApproveRequests: false,
        canManageUsers: false,
        canViewCosts: false,
        canViewCommissions: false,
        canExportData: false,
        canAccessSettings: false,
        canCreateOrders: false,
        canAssignDeliveries: false,
        canUpdateDeliveryStatus: false,
        canUploadPhotos: true,
        canUseRouteNavigation: false,
        canViewWeatherAlerts: true,
        canContactRep: true,
        profileEditRequiresApproval: false,
      };

    default:
      return {
        canViewAllData: false,
        canEditAllData: false,
        canApproveRequests: false,
        canManageUsers: false,
        canViewCosts: false,
        canViewCommissions: false,
        canExportData: false,
        canAccessSettings: false,
        canCreateOrders: false,
        canAssignDeliveries: false,
        canUpdateDeliveryStatus: false,
        canUploadPhotos: false,
        canUseRouteNavigation: false,
        canViewWeatherAlerts: false,
        canContactRep: false,
        profileEditRequiresApproval: true,
      };
  }
}
