// Team Member Roles and Permissions for River City Roofing Portal
// Role hierarchy: owner > admin > manager > sales > office > project_manager > driver > viewer
//
// ROLE ASSIGNMENTS (Updated 2026-03-16 from Google Workspace):
// - OWNER (Michael Muse, Chris Muse): Full system access
// - ADMIN (Sara Hill): Full system access, approval authority
// - MANAGER (Destin Mccary): Operations oversight, view all, limited edit
// - OFFICE (Tia Muse Morris): Billing, inventory, scheduling
// - PROJECT_MANAGER (Bart Roberts, John Cordonis): Job scheduling, inventory coordination
// - SALES (Aaron Lussi, Adam Rudell, Boston Muse, Brendon Muse, Greg Muse, Hunter Rivers, Joseph Dowd, Alijah): Own leads/jobs, personal stats
// - DRIVER (Travis Wages - also sells, Tae Orr - inactive): Delivery queue, route navigation, photo upload
// - DUAL ROLE: Richard Geahr "Rick" (driver + sales) - gets role picker on login
// - INACTIVE: Tae Orr, Rudy (not in Google Workspace)
// - CUSTOMER: External - job status, weather alerts, document viewing
//
// AUTH: Email + password only. PIN system removed 2026-03-16.

export type TeamRole = 'owner' | 'admin' | 'manager' | 'sales' | 'office' | 'project_manager' | 'driver' | 'viewer';

// Granular permission strings
export type Permission =
  | '*'                  // Wildcard - all permissions (owners/admin)
  | 'dashboard'          // Access to main dashboard
  | 'sales'              // Sales portal access
  | 'sales.leads'        // Lead management
  | 'sales.customers'    // Customer management
  | 'inventory'          // Inventory access
  | 'inventory.manage'   // Can add/edit inventory
  | 'delivery'           // Delivery portal access
  | 'delivery.driver'    // Driver-specific features
  | 'billing'            // Billing access
  | 'billing.invoices'   // Invoice management
  | 'reports'            // Reports access
  | 'schedule'           // Schedule management
  | 'team'               // Team management (admin)
  | 'customers.portal'   // Customer portal management
  | 'command-center'     // Command center access
  | 'monday-notes'       // Monday notes access
  | 'training'           // Training management
  | 'blog'               // Blog management
  | 'settings';          // System settings

export interface TeamMember {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  role: TeamRole;
  roles?: TeamRole[];          // For dual-role users (e.g., Richard Geahr: driver + sales)
  aliases?: string[];          // Alternative names (e.g., "Rick" for Richard Geahr)
  password: string;            // Password for staff login
  mustChangePassword: boolean; // Force password change on first login
  isActive: boolean;
  permissions: string[];
  createdAt: string;
}

// Human-readable labels for each permission (for admin UI)
export const PERMISSION_LABELS: Record<string, string> = {
  '*': 'Full Access (All Permissions)',
  'dashboard': 'Dashboard',
  'sales': 'Sales Portal',
  'sales.leads': 'Lead Management',
  'sales.customers': 'Customer Management',
  'inventory': 'Inventory Access',
  'inventory.manage': 'Inventory Management (Add/Edit)',
  'delivery': 'Delivery Portal',
  'delivery.driver': 'Driver Features',
  'billing': 'Billing Access',
  'billing.invoices': 'Invoice Management',
  'reports': 'Reports',
  'schedule': 'Schedule Management',
  'team': 'Team Management',
  'customers.portal': 'Customer Portal Management',
  'command-center': 'Command Center',
  'monday-notes': 'Monday Notes',
  'training': 'Training Management',
  'blog': 'Blog Management',
  'settings': 'System Settings',
};

// Define team members - Updated 2026-03-16
export const TEAM_MEMBERS: TeamMember[] = [
  // Owners - Full access to everything
  {
    id: 'RVR-135',
    name: 'Michael Muse',
    slug: 'michael-muse',
    email: 'michaelmuse@rcrsal.com',
    phone: '256-221-4290',
    role: 'owner',
    password: 'ChangeMe123!',
    mustChangePassword: true,
    isActive: true,
    permissions: ['*'],
    createdAt: '2024-01-01'
  },
  {
    id: 'RVR-138',
    name: 'Chris Muse',
    slug: 'chris-muse',
    email: 'chrismuse@rcrsal.com',
    phone: '256-648-1224',
    role: 'owner',
    password: 'ChangeMe123!',
    mustChangePassword: true,
    isActive: true,
    permissions: ['*'],
    createdAt: '2024-01-01'
  },

  // Admin - Full access except settings
  {
    id: 'RVR-131',
    name: 'Sara Hill',
    slug: 'sara-hill',
    email: 'sara@rcrsal.com',
    phone: '256-810-3594',
    role: 'admin',
    password: 'ChangeMe123!',
    mustChangePassword: true,
    isActive: true,
    permissions: [
      'dashboard', 'sales', 'sales.leads', 'sales.customers',
      'inventory', 'inventory.manage', 'delivery', 'delivery.driver',
      'billing', 'billing.invoices', 'reports', 'schedule',
      'team', 'customers.portal', 'command-center', 'monday-notes',
      'training', 'blog'
    ],
    createdAt: '2024-01-15'
  },

  // Manager - Operations Oversight
  {
    id: 'RVR-132',
    name: 'Destin Mccary',
    slug: 'destin',
    email: 'destin@rcrsal.com',
    phone: '256-905-7738',
    role: 'manager',
    password: 'ChangeMe123!',
    mustChangePassword: true,
    isActive: true,
    permissions: [
      'dashboard', 'reports', 'sales.leads', 'schedule',
      'inventory', 'billing', 'delivery', 'monday-notes',
      'command-center'
    ],
    createdAt: '2024-02-01'
  },

  // Office Staff
  {
    id: 'RVR-133',
    name: 'Tia Muse Morris',
    slug: 'tia',
    email: 'tia@rcrsal.com',
    phone: '256-394-8396',
    role: 'office',
    password: 'ChangeMe123!',
    mustChangePassword: true,
    isActive: true,
    permissions: [
      'dashboard', 'billing', 'billing.invoices', 'inventory',
      'schedule', 'customers.portal', 'monday-notes'
    ],
    createdAt: '2024-02-01'
  },

  // Project Managers
  {
    id: 'RVR-134',
    name: 'Bart Roberts',
    slug: 'bart',
    email: 'bart@rcrsal.com',
    phone: '256-654-0747',
    role: 'project_manager',
    password: 'ChangeMe123!',
    mustChangePassword: true,
    isActive: true,
    permissions: [
      'dashboard', 'delivery', 'inventory', 'inventory.manage',
      'schedule', 'billing', 'monday-notes'
    ],
    createdAt: '2024-03-15'
  },
  {
    id: 'RVR-137',
    name: 'John Cordonis',
    slug: 'john',
    email: 'john@rcrsal.com',
    phone: '256-654-0875',
    role: 'project_manager',
    password: 'ChangeMe123!',
    mustChangePassword: true,
    isActive: true,
    permissions: [
      'dashboard', 'delivery', 'inventory', 'inventory.manage',
      'schedule', 'billing', 'monday-notes',
      'sales', 'sales.leads', 'sales.customers', 'command-center'
    ],
    createdAt: '2024-02-15'
  },

  // Dual-role: Driver + Sales (Richard Geahr / "Rick")
  // Gets role picker on login. Single entry - NOT duplicated.
  {
    id: 'RVR-136',
    name: 'Richard Geahr',
    slug: 'richard',
    email: 'richard@rcrsal.com',
    phone: '256-701-7376',
    role: 'driver',
    roles: ['driver', 'sales'],
    aliases: ['Rick'],
    password: 'ChangeMe123!',
    mustChangePassword: true,
    isActive: true,
    permissions: [
      'dashboard', 'delivery', 'delivery.driver', 'inventory',
      'sales', 'sales.leads', 'sales.customers', 'monday-notes'
    ],
    createdAt: '2024-04-01'
  },

  // Inactive driver
  {
    id: 'a8ad2e33',
    name: 'Tae Orr',
    slug: 'tae',
    email: 'tae@rcrsal.com',
    phone: '256-200-3467',
    role: 'driver',
    password: 'ChangeMe123!',
    mustChangePassword: true,
    isActive: false, // Not in Google Workspace - inactive
    permissions: [
      'dashboard', 'delivery', 'delivery.driver'
    ],
    createdAt: '2024-05-01'
  },

  // Sales Representatives
  {
    id: 'RVR-201',
    name: 'Hunter Rivers',
    slug: 'hunter',
    email: 'hunter@rcrsal.com',
    phone: '256-221-0548',
    role: 'sales',
    password: 'ChangeMe123!',
    mustChangePassword: true,
    isActive: true,
    permissions: [
      'dashboard', 'sales', 'sales.leads', 'sales.customers',
      'monday-notes', 'training'
    ],
    createdAt: '2024-01-15'
  },
  {
    id: 'RVR-202',
    name: 'Aaron Lussi',
    slug: 'aaron',
    email: 'aaron@rcrsal.com',
    phone: '256-656-7856',
    role: 'sales',
    password: 'ChangeMe123!',
    mustChangePassword: true,
    isActive: true,
    permissions: [
      'dashboard', 'sales', 'sales.leads', 'sales.customers',
      'monday-notes', 'training'
    ],
    createdAt: '2024-02-01'
  },
  {
    id: 'RVR-203',
    name: 'Greg Muse',
    slug: 'greg',
    email: 'greg@rcrsal.com',
    phone: '256-221-1809',
    role: 'sales',
    password: 'ChangeMe123!',
    mustChangePassword: true,
    isActive: true,
    permissions: [
      'dashboard', 'sales', 'sales.leads', 'sales.customers',
      'monday-notes', 'training'
    ],
    createdAt: '2024-03-01'
  },
  {
    id: 'RVR-204',
    name: 'Brendon Muse',
    slug: 'brendon',
    email: 'brendon@rcrsal.com',
    phone: '256-616-6174',
    role: 'sales',
    password: 'ChangeMe123!',
    mustChangePassword: true,
    isActive: true,
    permissions: [
      'dashboard', 'sales', 'sales.leads', 'sales.customers',
      'monday-notes', 'training'
    ],
    createdAt: '2024-01-01'
  },
  {
    id: 'RVR-206',
    name: 'Rudy',
    slug: 'rudy',
    email: 'rudy@rcrsal.com',
    phone: '',
    role: 'sales',
    password: 'ChangeMe123!',
    mustChangePassword: true,
    isActive: false, // Not in Google Workspace - inactive
    permissions: [
      'dashboard', 'sales', 'sales.leads', 'sales.customers',
      'monday-notes', 'training'
    ],
    createdAt: '2024-05-01'
  },
  {
    id: 'RVR-207',
    name: 'Adam Rudell',
    slug: 'adam',
    email: 'adam@rcrsal.com',
    phone: '256-654-3631',
    role: 'sales',
    password: 'ChangeMe123!',
    mustChangePassword: true,
    isActive: true,
    permissions: [
      'dashboard', 'sales', 'sales.leads', 'sales.customers',
      'monday-notes', 'training'
    ],
    createdAt: '2024-06-01'
  },
  {
    id: 'RVR-208',
    name: 'Boston Muse',
    slug: 'boston',
    email: 'boston@rcrsal.com',
    phone: '',
    role: 'sales',
    password: 'ChangeMe123!',
    mustChangePassword: true,
    isActive: true,
    permissions: [
      'dashboard', 'sales', 'sales.leads', 'sales.customers',
      'monday-notes', 'training', 'blog'
    ],
    createdAt: '2026-02-10'
  },
  {
    id: 'RVR-209',
    name: 'Joseph Dowd',
    slug: 'joseph',
    email: 'joseph@rcrsal.com',
    phone: '256-751-7297',
    role: 'sales',
    password: 'ChangeMe123!',
    mustChangePassword: true,
    isActive: true,
    permissions: [
      'dashboard', 'sales', 'sales.leads', 'sales.customers',
      'monday-notes', 'training'
    ],
    createdAt: '2026-02-10'
  },
  {
    id: 'RVR-210',
    name: 'Alijah',
    slug: 'alijah',
    email: 'alijah@rcrsal.com',
    role: 'sales',
    password: 'ChangeMe123!',
    mustChangePassword: true,
    isActive: true,
    permissions: [
      'dashboard', 'sales', 'sales.leads', 'sales.customers',
      'monday-notes', 'training'
    ],
    createdAt: '2026-03-16'
  },

  // Driver who also sells
  {
    id: 'RVR-140',
    name: 'Travis Wages',
    slug: 'travis',
    email: 'travis@rcrsal.com',
    phone: '256-466-0956',
    role: 'sales',
    password: 'ChangeMe123!',
    mustChangePassword: true,
    isActive: true,
    permissions: [
      'dashboard', 'sales', 'sales.leads', 'sales.customers',
      'monday-notes', 'leaderboard'
    ],
    createdAt: '2026-02-10'
  }
];

// Role-based portal access
export const ROLE_PORTAL_ACCESS: Record<TeamRole, string[]> = {
  owner: ['/portal/pm', '/portal/office', '/portal/billing', '/portal/inventory', '/portal/driver', '/portal/admin', '/portal/sales', '/portal/manager', '/portal/chat', '/command-center'],
  admin: ['/portal/pm', '/portal/office', '/portal/billing', '/portal/inventory', '/portal/driver', '/portal/admin', '/portal/sales', '/portal/manager', '/portal/chat', '/command-center'],
  manager: ['/portal/dashboard', '/portal/manager', '/portal/office', '/portal/billing', '/portal/inventory', '/portal/schedule', '/portal/reports', '/portal/chat', '/command-center'],
  sales: ['/portal/dashboard', '/portal/sales', '/portal/inventory', '/portal/schedule', '/portal/chat', '/command-center/sales'],
  office: ['/portal/dashboard', '/portal/office', '/portal/billing', '/portal/inventory', '/portal/schedule', '/portal/chat', '/command-center'],
  project_manager: ['/portal/dashboard', '/portal/pm', '/portal/inventory', '/portal/schedule', '/portal/chat', '/command-center', '/portal/sales'],
  driver: ['/portal/dashboard', '/portal/driver', '/portal/inventory', '/portal/chat'],
  viewer: ['/portal/dashboard', '/portal/office', '/portal/reports', '/portal/chat'] // Read-only view
};

// Command Center module access by role
export const COMMAND_CENTER_ACCESS: Record<TeamRole, string[]> = {
  owner: ['dashboard', 'sales', 'inventory', 'marketing', 'phone', 'meetings', 'team', 'settings', 'reports', 'billing', 'schedule', 'leads'],
  admin: ['dashboard', 'sales', 'inventory', 'marketing', 'phone', 'meetings', 'team', 'settings', 'reports', 'billing', 'schedule', 'leads'],
  manager: ['dashboard', 'sales', 'inventory', 'phone', 'meetings', 'team', 'reports', 'schedule', 'leads'],
  sales: ['dashboard', 'sales', 'phone', 'meetings', 'schedule', 'leads'],
  office: ['dashboard', 'inventory', 'phone', 'meetings', 'billing', 'schedule', 'leads'],
  project_manager: ['dashboard', 'inventory', 'meetings', 'schedule', 'sales', 'leads'],
  driver: ['dashboard'],
  viewer: ['dashboard', 'reports']
};

// Permission descriptions (legacy - kept for backward compatibility)
export const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  '*': 'Full access to all features',
  'dashboard': 'View main dashboard',
  'sales': 'Sales portal access',
  'sales.leads': 'Lead management',
  'sales.customers': 'Customer management',
  'inventory': 'Inventory access',
  'inventory.manage': 'Inventory management (add/edit)',
  'delivery': 'Delivery portal access',
  'delivery.driver': 'Driver-specific features',
  'billing': 'Billing access',
  'billing.invoices': 'Invoice management',
  'reports': 'Reports access',
  'schedule': 'Schedule management',
  'team': 'Team management (admin)',
  'customers.portal': 'Customer portal management',
  'command-center': 'Command center access',
  'monday-notes': 'Monday notes access',
  'training': 'Training management',
  'blog': 'Blog management',
  'settings': 'System settings',
  // Legacy permission names (for backward compat with existing code)
  'view_dashboard': 'View main dashboard',
  'manage_billing': 'Create and manage invoices, billing records',
  'manage_inventory': 'Full inventory management',
  'view_tickets': 'View all tickets',
  'view_own_tickets': 'View only own tickets',
  'update_ticket_status': 'Update any ticket status',
  'update_own_tickets': 'Update own tickets only',
  'create_invoices': 'Create and send invoices',
  'manage_vendors': 'Manage vendor purchases',
  'view_reports': 'View all reports',
  'view_schedule': 'View calendar and schedule',
  'manage_stock': 'Adjust stock levels',
  'create_material_orders': 'Create new material orders',
  'create_delivery_tickets': 'Create delivery tickets',
  'create_pickup_tickets': 'Create pickup tickets',
  'create_return_tickets': 'Create return tickets',
  'schedule_events': 'Schedule deliveries and events',
  'view_inventory': 'View inventory levels',
  'view_drivers': 'View driver information',
  'view_assigned_tickets': 'View assigned tickets only',
  'update_delivery_status': 'Update delivery status',
  'upload_photos': 'Upload delivery/proof photos',
  'capture_signature': 'Capture customer signatures',
  'view_route': 'View optimized route',
  'view_checklist': 'View delivery checklist',
  'complete_checklist': 'Complete checklist items',
  'edit_stock_qty': 'Edit stock quantities (logged)',
  'log_gps_activity': 'Log GPS activities',
  'view_leads': 'View all leads',
  'manage_leads': 'Manage and assign leads',
  'view_own_leads': 'View only assigned leads',
  'update_lead_status': 'Update lead status',
  'schedule_inspections': 'Schedule roof inspections',
  'create_quotes': 'Create quotes for customers',
  'send_quotes': 'Send quotes to customers',
  'view_own_stats': 'View personal performance stats',
  'view_leaderboard': 'View sales leaderboard',
  'view_customer_portal': 'View customer portal data',
  'send_customer_messages': 'Send messages to customers',
  'lead_distro_admin': 'Configure lead distribution algorithm and weights',
  'lead_distro_manage': 'Toggle rep availability and view lead distribution',
  'enter_leads': 'Enter new leads into the system',
  'view_lead_distro': 'View lead distribution settings and history'
};

// Helper functions
export function getTeamMember(id: string): TeamMember | undefined {
  return TEAM_MEMBERS.find(m => m.id === id);
}

export function getTeamMemberByEmail(email: string): TeamMember | undefined {
  return TEAM_MEMBERS.find(m => m.email.toLowerCase() === email.toLowerCase());
}

export function getTeamMembersByRole(role: TeamRole): TeamMember[] {
  return TEAM_MEMBERS.filter(m => m.role === role && m.isActive);
}

/**
 * Check if a team member has a specific permission.
 *
 * Rules:
 * 1. If member has '*', return true for everything.
 * 2. Parent permission grants child: having 'sales' grants 'sales.leads', 'sales.customers', etc.
 * 3. Exact match check.
 */
export function hasPermission(member: TeamMember, permission: string): boolean {
  // Wildcard grants everything
  if (member.permissions.includes('*')) return true;

  // Exact match
  if (member.permissions.includes(permission)) return true;

  // Parent permission check: if checking 'sales.leads', also check if they have 'sales'
  if (permission.includes('.')) {
    const parent = permission.split('.')[0];
    if (member.permissions.includes(parent)) return true;
  }

  return false;
}

/**
 * Look up a team member by alias (e.g., "Rick" -> Richard Geahr).
 */
export function getTeamMemberByAlias(alias: string): TeamMember | undefined {
  return TEAM_MEMBERS.find(m =>
    m.aliases?.some(a => a.toLowerCase() === alias.toLowerCase())
  );
}

/**
 * Check if a team member has dual roles (e.g., driver + sales).
 */
export function hasDualRole(member: TeamMember): boolean {
  return (member.roles?.length ?? 0) > 1;
}

export function canAccessPortal(member: TeamMember, portalPath: string): boolean {
  const allowedPortals = ROLE_PORTAL_ACCESS[member.role];
  return allowedPortals.some(path => portalPath.startsWith(path));
}

export function getDrivers(): TeamMember[] {
  return TEAM_MEMBERS.filter(m =>
    m.isActive && (m.role === 'driver' || m.roles?.includes('driver'))
  );
}

export function getProjectManagers(): TeamMember[] {
  return getTeamMembersByRole('project_manager');
}

export function getOfficeStaff(): TeamMember[] {
  return getTeamMembersByRole('office');
}

// Role display names
export const ROLE_DISPLAY_NAMES: Record<TeamRole, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  manager: 'Manager',
  sales: 'Sales Rep',
  office: 'Office Staff',
  project_manager: 'Project Manager',
  driver: 'Driver',
  viewer: 'Viewer'
};

// Role colors for UI
export const ROLE_COLORS: Record<TeamRole, string> = {
  owner: 'bg-purple-500',
  admin: 'bg-red-500',
  manager: 'bg-blue-600',
  sales: 'bg-green-500',
  office: 'bg-cyan-500',
  project_manager: 'bg-indigo-500',
  driver: 'bg-orange-500',
  viewer: 'bg-gray-500'
};

// Check if a role can access a Command Center module
export function canAccessCommandCenterModule(role: TeamRole, module: string): boolean {
  const allowedModules = COMMAND_CENTER_ACCESS[role];
  return allowedModules?.includes(module) ?? false;
}

// Get all Command Center modules accessible by a role
export function getAccessibleCommandCenterModules(role: TeamRole): string[] {
  return COMMAND_CENTER_ACCESS[role] ?? [];
}

// Check if role has elevated access (owner, admin, or manager)
export function hasElevatedAccess(role: TeamRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager';
}

// Check if role has full admin access
export function hasAdminAccess(role: TeamRole): boolean {
  return role === 'owner' || role === 'admin';
}

// Check if role is manager level (can view all but not edit all)
export function isManagerRole(role: TeamRole): boolean {
  return role === 'manager';
}

// Get managers
export function getManagers(): TeamMember[] {
  return getTeamMembersByRole('manager');
}

// Check if role can manage team members
export function canManageTeam(role: TeamRole): boolean {
  return role === 'owner' || role === 'admin';
}

// Check if role can view sales data
export function canViewSales(role: TeamRole): boolean {
  return ['owner', 'admin', 'manager', 'sales'].includes(role);
}

// Check if role is a sales rep
export function isSalesRole(role: TeamRole): boolean {
  return role === 'sales';
}

// Get all sales reps
export function getSalesReps(): TeamMember[] {
  return getTeamMembersByRole('sales');
}

// Check if role can manage inventory
export function canManageInventory(role: TeamRole): boolean {
  return ['owner', 'admin', 'manager', 'office'].includes(role);
}

// Check if role can access marketing
export function canAccessMarketing(role: TeamRole): boolean {
  return ['owner', 'admin'].includes(role);
}

// Convert TeamRole to CommandCenterRole for the permission system
export type CommandCenterRole = 'owner' | 'admin' | 'manager' | 'sales' | 'sales_manager' | 'office_manager' | 'project_manager' | 'driver';

export function toCommandCenterRole(teamRole: TeamRole): CommandCenterRole {
  switch (teamRole) {
    case 'owner':
      return 'owner';
    case 'admin':
      return 'admin';
    case 'manager':
      return 'manager';
    case 'sales':
      return 'sales';
    case 'office':
      return 'office_manager';
    case 'project_manager':
      return 'project_manager';
    case 'driver':
      return 'driver';
    case 'viewer':
      return 'driver'; // Viewers have minimal access like drivers
    default:
      return 'driver';
  }
}

// Role hierarchy levels
export const ROLE_HIERARCHY: Record<TeamRole, number> = {
  owner: 100,
  admin: 90,
  manager: 80,
  sales: 50,
  office: 50,
  project_manager: 50,
  driver: 30,
  viewer: 10,
};

// Check if role1 is higher than or equal to role2
export function isRoleAtLeast(userRole: TeamRole, requiredRole: TeamRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// Role descriptions for UI
export const ROLE_DESCRIPTIONS: Record<TeamRole, string> = {
  owner: 'Full system access with all permissions',
  admin: 'Full system access with approval authority',
  manager: 'Operations oversight with view-all access',
  sales: 'Lead and customer management for own assignments',
  office: 'Billing, inventory, and schedule management',
  project_manager: 'Job scheduling and delivery coordination',
  driver: 'Delivery queue and route management',
  viewer: 'Read-only access to reports',
};

// Check if user can enter leads
export function canEnterLeads(role: TeamRole): boolean {
  return ['owner', 'admin', 'manager', 'office', 'project_manager'].includes(role);
}

// Check if user can manage lead distribution (toggle reps on/off)
export function canManageLeadDistro(role: TeamRole): boolean {
  return ['owner', 'admin', 'manager', 'office'].includes(role);
}

// Check if user can configure lead distribution algorithm
export function canAdminLeadDistro(role: TeamRole): boolean {
  return ['owner', 'admin'].includes(role);
}

// Get all reps eligible for lead distribution (sales reps + owners who sell)
export function getLeadEligibleReps(): TeamMember[] {
  return TEAM_MEMBERS.filter(m =>
    m.isActive && (m.role === 'sales' || (m.role === 'owner' && m.slug !== 'admin'))
  );
}

// =============================================================================
// TEAM ACCESS OVERRIDES
// =============================================================================

// All Command Center modules
export const ALL_COMMAND_CENTER_MODULES = [
  'dashboard', 'sales', 'inventory', 'marketing', 'phone',
  'meetings', 'team', 'leads', 'reports', 'billing', 'schedule', 'settings'
] as const;

export type CommandCenterModule = typeof ALL_COMMAND_CENTER_MODULES[number];

// Module display names
export const MODULE_DISPLAY_NAMES: Record<string, string> = {
  dashboard: 'Dashboard',
  sales: 'Sales',
  inventory: 'Inventory',
  marketing: 'Marketing',
  phone: 'Phone System',
  meetings: 'Meetings',
  team: 'Team',
  leads: 'Leads',
  reports: 'Reports',
  billing: 'Billing',
  schedule: 'Schedule',
  settings: 'Settings',
};

export interface AccessOverride {
  memberId: string;
  moduleOverrides: Record<string, boolean>;
  updatedBy: string;
  updatedAt: string;
}

// In-memory cache for overrides (populated from API)
let accessOverridesCache: Map<string, AccessOverride> = new Map();

// Set overrides cache (called after API fetch)
export function setAccessOverridesCache(overrides: AccessOverride[]) {
  accessOverridesCache = new Map();
  for (const override of overrides) {
    accessOverridesCache.set(override.memberId, override);
  }
}

// Get cached override for a member
export function getCachedOverride(memberId: string): AccessOverride | undefined {
  return accessOverridesCache.get(memberId);
}

// Calculate effective access for a member (role defaults + overrides)
export function getEffectiveAccess(memberId: string, role: TeamRole, overrides?: Record<string, boolean>): string[] {
  const defaults = COMMAND_CENTER_ACCESS[role] || [];
  const memberOverrides = overrides || getCachedOverride(memberId)?.moduleOverrides;

  if (!memberOverrides) return [...defaults];

  const effective = new Set(defaults);
  for (const [module, enabled] of Object.entries(memberOverrides)) {
    if (enabled) {
      effective.add(module);
    } else {
      effective.delete(module);
    }
  }
  return Array.from(effective);
}

// Check if a member has custom overrides
export function hasCustomOverrides(memberId: string): boolean {
  const override = getCachedOverride(memberId);
  if (!override) return false;
  return Object.keys(override.moduleOverrides).length > 0;
}

// Get override count for a member
export function getOverrideCount(memberId: string): number {
  const override = getCachedOverride(memberId);
  if (!override) return 0;
  return Object.keys(override.moduleOverrides).length;
}

// ============================================
// COMMISSION HELPERS
// ============================================

// Subcontractors — NOT internal sales reps (they get 1099 subcontractor pay, not commissions)
// TRUE subcontractors — NOT sales reps
// BCM Contracting = Brendon Muse (SALES REP), Roof Angel = Aaron Lussi (SALES REP),
// Rudys Roofing = Adam Rudell (SALES REP) — these are NOT subcontractors!
const SUBCONTRACTOR_NAMES = [
  'pablo compuzano', 'pablo compuzano-cruz', 'jesus lara', 'jesus m lara',
  'martin martinez', 'martin martinez-mendoza', 'patrick manuel',
  'diego garcia', 'mr. rogelio gonzalez', 'rogelio gonzalez',
  'dollins & associates', 'dollins', 'spradlin construction',
  'reggie jackson', 'taylor maid', 'taylor maid cleaning',
];

/** The ONLY names that should appear on sales/commission leaderboards.
 *  Uses first name for matching since commission reports vary (entity names vs personal).
 *  Each entry is [firstName, lastName?] for precise matching.
 */
const SALES_REP_CANONICAL = [
  'Hunter Rivers', 'Aaron Lussi', 'Greg Muse', 'Brendon Muse',
  'Adam Rudell', 'Joseph Dowd', 'Boston Muse', 'Alijah',
  'Travis Wages', 'Rick',
];

/** Returns true if the name belongs to an internal sales rep */
export function isInternalSalesRep(name: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase().trim();
  // Check exact match or first-name-starts-with for single-name reps
  return SALES_REP_CANONICAL.some(rep => {
    const repLower = rep.toLowerCase();
    // Exact match
    if (lower === repLower) return true;
    // Check if the name starts with the rep's first name AND has matching last name
    const repParts = repLower.split(' ');
    const nameParts = lower.split(' ');
    if (repParts.length === 1) {
      // Single name like "Alijah" or "Rick" - must be exact first word match
      return nameParts[0] === repParts[0];
    }
    // Full name: first AND last must match
    return nameParts[0] === repParts[0] && nameParts.some(p => p === repParts[1]);
  });
}

/** Normalize commission name variants to canonical names */
const NAME_ALIASES: Record<string, string> = {
  // === CRITICAL: 1099 Business Entity -> Personal Name ===
  // All sales reps are 1099 contractors. Commission reports use entity names.
  'bcm contracting llc': 'Brendon Muse',
  'bcm contracting': 'Brendon Muse',
  'rudys roofing insights llc': 'Adam Rudell',
  'rudys roofing insights': 'Adam Rudell',
  'rudys roofing': 'Adam Rudell',
  'rudys roof consulting': 'Adam Rudell',
  'roof angel, llc': 'Aaron Lussi',
  'roof angel llc': 'Aaron Lussi',
  'roof angel': 'Aaron Lussi',
  'jeremy t. wages': 'Travis Wages',
  'jeremy wages': 'Travis Wages',
  // === Personal name variations ===
  'greg muse': 'Greg Muse',
  'gregory ray muse': 'Greg Muse',
  'gregory muse': 'Greg Muse',
  'adam rudell': 'Adam Rudell',
  'rudy': 'Adam Rudell',
  'aaron lussi': 'Aaron Lussi',
  'brendon muse': 'Brendon Muse',
  'brendon russell': 'Brendon Muse',
  'boston muse': 'Boston Muse',
  'hunter rivers': 'Hunter Rivers',
  'richard geahr': 'Richard Geahr',
  'richard  geahr': 'Richard Geahr',
  'joseph dowd': 'Joseph Dowd',
  'travis wages': 'Travis Wages',
  'john cordonis': 'John Cordonis',
  // === Non-sales (for reference, NOT on sales leaderboard) ===
  'michael muse': 'Michael Muse',
  'chris muse': 'Chris Muse',
  'sara hill': 'Sara Hill',
  'sara muse': 'Sara Hill',
  'destin mccary': 'Destin Mccary',
  'destin woodall': 'Destin Mccary',
  'tia muse morris': 'Tia Muse Morris',
  'tia woodall': 'Tia Muse Morris',
};

export function resolveCommissionName(name: string): string {
  if (!name) return name;
  const lower = name.toLowerCase().trim();
  return NAME_ALIASES[lower] || name.trim();
}
