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

// Define team members - Updated from PDF (items for web.pdf)
export const TEAM_MEMBERS: TeamMember[] = [
  // Owners - Full access to everything
  {
    id: 'RVR-135',
    name: 'Michael Muse',
    slug: 'michael-muse',
    email: 'michaelmuse@rcrsal.com',
    phone: '256-221-4290',
    role: 'owner',
    pin: '1135',
    isActive: true,
    permissions: ['*'], // All permissions
    createdAt: '2024-01-01'
  },
  {
    id: 'RVR-138',
    name: 'Chris Muse',
    slug: 'chris-muse',
    email: 'chrismuse@rcrsal.com',
    phone: '256-648-1224',
    role: 'owner',
    pin: '1138',
    isActive: true,
    permissions: ['*'],
    createdAt: '2024-01-01'
  },

  // Admin - Full access
  {
    id: 'RVR-131',
    name: 'Sara Hill',
    slug: 'sara-hill',
    email: 'sara@rcrsal.com',
    phone: '256-810-3594',
    role: 'admin',
    pin: '1131',
    isActive: true,
    permissions: ['*'],
    createdAt: '2024-01-15'
  },
  {
    id: 'RVR-139',
    name: 'Admin',
    slug: 'admin',
    email: 'admin@rcrsal.com',
    role: 'admin',
    pin: '0000',
    isActive: true,
    permissions: ['*'],
    createdAt: '2024-01-01'
  },

  // Managers
  {
    id: 'RVR-132',
    name: 'Destin McCury',
    slug: 'destin',
    email: 'destin@rcrsal.com',
    phone: '256-905-7738',
    role: 'office',
    pin: '1132',
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
    createdAt: '2024-02-01'
  },
  {
    id: 'RVR-133',
    name: 'Tia Morris',
    slug: 'tia',
    email: 'tia@rcrsal.com',
    phone: '256-394-8396',
    role: 'office',
    pin: '1133',
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
    createdAt: '2024-02-01'
  },
  {
    id: 'RVR-134',
    name: 'Bart Roberts',
    slug: 'bart',
    email: 'bart@rcrsal.com',
    phone: '256-654-0747',
    role: 'project_manager',
    pin: '1134',
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
    createdAt: '2024-03-15'
  },
  {
    id: 'RVR-137',
    name: 'John Cordonis',
    slug: 'john',
    email: 'john@rcrsal.com',
    phone: '256-654-0875',
    role: 'project_manager',
    pin: '1137',
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
    createdAt: '2024-02-15'
  },

  // Drivers - View assigned, complete deliveries
  {
    id: 'RVR-136',
    name: 'Richard Geahr',
    slug: 'richard',
    email: 'richard@rivercityroofingsolutions.com',
    role: 'driver',
    pin: '1136', // Driver login PIN from PDF
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
    createdAt: '2024-04-01'
  },
  {
    id: 'a8ad2e33',
    name: 'Tae Orr',
    slug: 'tae',
    email: 'tae@rcrsal.com',
    phone: '256-200-3467',
    role: 'driver',
    pin: '2033', // Driver login PIN from PDF
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
    createdAt: '2024-05-01'
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
