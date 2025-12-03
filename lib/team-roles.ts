// Team Member Roles and Permissions for River City Roofing Portal
// Role hierarchy: owner > admin > office > project_manager > driver > viewer

export type TeamRole = 'owner' | 'admin' | 'office' | 'project_manager' | 'driver' | 'viewer';

export interface TeamMember {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  role: TeamRole;
  pin?: string; // 4-digit PIN for driver login
  isActive: boolean;
  permissions: string[];
  createdAt: string;
}

// Define team members
export const TEAM_MEMBERS: TeamMember[] = [
  // Owners - Full access to everything
  {
    id: 'michael',
    name: 'Michael Muse',
    slug: 'michael-muse',
    email: 'michaelmuse@rivercityroofingsolutions.com',
    role: 'owner',
    isActive: true,
    permissions: ['*'], // All permissions
    createdAt: '2024-01-01'
  },
  {
    id: 'sara',
    name: 'Sara',
    slug: 'sara-hill',
    email: 'sara@rivercityroofingsolutions.com',
    role: 'admin', // Full access like owner
    isActive: true,
    permissions: ['*'],
    createdAt: '2024-01-01'
  },

  // Office Staff - Billing, inventory, office portal
  {
    id: 'tia',
    name: 'Tia',
    slug: 'tia',
    email: 'tia@rivercityroofingsolutions.com',
    role: 'office',
    isActive: true,
    permissions: [
      'view_dashboard',
      'manage_billing',
      'manage_inventory',
      'view_tickets',
      'update_ticket_status',
      'create_invoices',
      'manage_vendors',
      'view_reports',
      'view_schedule',
      'manage_stock'
    ],
    createdAt: '2024-01-01'
  },
  {
    id: 'destin',
    name: 'Destin',
    slug: 'destin',
    email: 'destin@rivercityroofingsolutions.com',
    role: 'office',
    isActive: true,
    permissions: [
      'view_dashboard',
      'manage_billing',
      'manage_inventory',
      'view_tickets',
      'update_ticket_status',
      'create_invoices',
      'manage_vendors',
      'view_reports',
      'view_schedule',
      'manage_stock'
    ],
    createdAt: '2024-01-01'
  },

  // Project Managers - Create orders, schedule deliveries
  {
    id: 'john',
    name: 'John',
    slug: 'john',
    email: 'john@rivercityroofingsolutions.com',
    role: 'project_manager',
    isActive: true,
    permissions: [
      'view_dashboard',
      'create_material_orders',
      'create_delivery_tickets',
      'create_pickup_tickets',
      'create_return_tickets',
      'schedule_events',
      'view_schedule',
      'view_own_tickets',
      'update_own_tickets',
      'view_inventory',
      'view_drivers'
    ],
    createdAt: '2024-01-01'
  },
  {
    id: 'bart',
    name: 'Bart',
    slug: 'bart',
    email: 'bart@rivercityroofingsolutions.com',
    role: 'project_manager',
    isActive: true,
    permissions: [
      'view_dashboard',
      'create_material_orders',
      'create_delivery_tickets',
      'create_pickup_tickets',
      'create_return_tickets',
      'schedule_events',
      'view_schedule',
      'view_own_tickets',
      'update_own_tickets',
      'view_inventory',
      'view_drivers'
    ],
    createdAt: '2024-01-01'
  },

  // Drivers - View assigned, complete deliveries
  {
    id: 'rick',
    name: 'Richard',
    slug: 'richard',
    email: 'richard@rivercityroofingsolutions.com',
    role: 'driver',
    pin: '1234', // Driver login PIN
    isActive: true,
    permissions: [
      'view_assigned_tickets',
      'update_delivery_status',
      'upload_photos',
      'capture_signature',
      'view_route',
      'view_checklist',
      'complete_checklist',
      'edit_stock_qty',
      'create_pickup_tickets',
      'create_return_tickets',
      'log_gps_activity'
    ],
    createdAt: '2024-01-01'
  },
  {
    id: 'tae',
    name: 'Tae',
    slug: 'tae',
    email: 'tae@rivercityroofingsolutions.com',
    role: 'driver',
    pin: '5678', // Driver login PIN
    isActive: true,
    permissions: [
      'view_assigned_tickets',
      'update_delivery_status',
      'upload_photos',
      'capture_signature',
      'view_route',
      'view_checklist',
      'complete_checklist',
      'edit_stock_qty',
      'create_pickup_tickets',
      'create_return_tickets',
      'log_gps_activity'
    ],
    createdAt: '2024-01-01'
  },

  // Viewer - Read only
  {
    id: 'chris',
    name: 'Chris Muse',
    slug: 'chris-muse',
    email: 'chrismuse@rivercityroofingsolutions.com',
    role: 'viewer',
    isActive: true,
    permissions: [
      'view_dashboard',
      'view_tickets',
      'view_schedule',
      'view_reports',
      'view_inventory'
    ],
    createdAt: '2024-01-01'
  }
];

// Role-based portal access
export const ROLE_PORTAL_ACCESS: Record<TeamRole, string[]> = {
  owner: ['/portal/pm', '/portal/office', '/portal/billing', '/portal/inventory', '/portal/driver', '/portal/admin'],
  admin: ['/portal/pm', '/portal/office', '/portal/billing', '/portal/inventory', '/portal/driver', '/portal/admin'],
  office: ['/portal/office', '/portal/billing', '/portal/inventory'],
  project_manager: ['/portal/pm'],
  driver: ['/portal/driver'],
  viewer: ['/portal/office'] // Read-only view
};

// Permission descriptions
export const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  '*': 'Full access to all features',
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
  'log_gps_activity': 'Log GPS activities'
};

// Helper functions
export function getTeamMember(id: string): TeamMember | undefined {
  return TEAM_MEMBERS.find(m => m.id === id);
}

export function getTeamMemberByEmail(email: string): TeamMember | undefined {
  return TEAM_MEMBERS.find(m => m.email.toLowerCase() === email.toLowerCase());
}

export function getTeamMemberByPin(pin: string): TeamMember | undefined {
  return TEAM_MEMBERS.find(m => m.pin === pin && m.role === 'driver');
}

export function getTeamMembersByRole(role: TeamRole): TeamMember[] {
  return TEAM_MEMBERS.filter(m => m.role === role && m.isActive);
}

export function hasPermission(member: TeamMember, permission: string): boolean {
  if (member.permissions.includes('*')) return true;
  return member.permissions.includes(permission);
}

export function canAccessPortal(member: TeamMember, portalPath: string): boolean {
  const allowedPortals = ROLE_PORTAL_ACCESS[member.role];
  return allowedPortals.some(path => portalPath.startsWith(path));
}

export function getDrivers(): TeamMember[] {
  return getTeamMembersByRole('driver');
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
  office: 'Office Staff',
  project_manager: 'Project Manager',
  driver: 'Driver',
  viewer: 'Viewer'
};

// Role colors for UI
export const ROLE_COLORS: Record<TeamRole, string> = {
  owner: 'bg-purple-500',
  admin: 'bg-red-500',
  office: 'bg-blue-500',
  project_manager: 'bg-green-500',
  driver: 'bg-orange-500',
  viewer: 'bg-gray-500'
};
