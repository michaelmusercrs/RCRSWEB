// Portal Users Data - Source: items for web.pdf (Page 3)
// Last Updated: December 2025

export type PortalUserRole = 'ADMIN' | 'MANAGER' | 'USER';

export interface PortalUserAccount {
  uid: string;
  userName: string;
  email: string;
  role: PortalUserRole;
  active: boolean;
  password: string; // In production, this would be hashed
  pin?: string;
  phone?: string;
  lastLogin?: string;
  createdAt: string;
  updatedAt?: string;
  loginHistory: LoginRecord[];
}

export interface LoginRecord {
  timestamp: string;
  status: 'success' | 'failed' | 'locked';
  ipAddress?: string;
  userAgent?: string;
}

// 10 System Users from PDF
export const portalUsers: PortalUserAccount[] = [
  {
    uid: 'RVR-131',
    userName: 'SARAHILL',
    email: 'sara@rcrsal.com',
    role: 'ADMIN',
    active: true,
    password: 'Admin2024!',
    pin: '1131',
    phone: '256-810-3594',
    createdAt: '2024-01-15T08:00:00Z',
    loginHistory: [
      { timestamp: '2025-12-02T08:30:00Z', status: 'success' },
      { timestamp: '2025-12-01T09:15:00Z', status: 'success' },
      { timestamp: '2025-11-30T08:45:00Z', status: 'success' }
    ]
  },
  {
    uid: 'RVR-132',
    userName: 'DESTINMCCURY',
    email: 'destin@rcrsal.com',
    role: 'MANAGER',
    active: true,
    password: 'Manager2024!',
    pin: '1132',
    phone: '256-905-7738',
    createdAt: '2024-02-01T09:00:00Z',
    loginHistory: [
      { timestamp: '2025-12-02T09:00:00Z', status: 'success' },
      { timestamp: '2025-12-01T10:30:00Z', status: 'success' }
    ]
  },
  {
    uid: 'RVR-133',
    userName: 'TIAMORRIS',
    email: 'tia@rcrsal.com',
    role: 'MANAGER',
    active: true,
    password: 'Manager2024!',
    pin: '1133',
    phone: '256-394-8396',
    createdAt: '2024-02-01T09:00:00Z',
    loginHistory: [
      { timestamp: '2025-12-02T08:15:00Z', status: 'success' },
      { timestamp: '2025-12-01T09:00:00Z', status: 'success' }
    ]
  },
  {
    uid: 'RVR-134',
    userName: 'BARTROBERTS',
    email: 'bart@rcrsal.com',
    role: 'MANAGER',
    active: true,
    password: 'Manager2024!',
    pin: '1134',
    phone: '256-654-0747',
    createdAt: '2024-03-15T10:00:00Z',
    loginHistory: [
      { timestamp: '2025-12-02T07:45:00Z', status: 'success' },
      { timestamp: '2025-12-01T08:00:00Z', status: 'success' }
    ]
  },
  {
    uid: 'RVR-135',
    userName: 'MICHAELMUSE',
    email: 'michaelmuse@rcrsal.com',
    role: 'ADMIN',
    active: true,
    password: 'Admin2024!',
    pin: '1135',
    phone: '256-221-4290',
    createdAt: '2024-01-01T08:00:00Z',
    loginHistory: [
      { timestamp: '2025-12-04T09:00:00Z', status: 'success' },
      { timestamp: '2025-12-03T10:00:00Z', status: 'success' },
      { timestamp: '2025-12-02T11:00:00Z', status: 'success' }
    ]
  },
  {
    uid: 'RVR-136',
    userName: 'RICHARDGEAHR',
    email: 'richard@rivercityroofingsolutions.com',
    role: 'USER',
    active: true,
    password: 'User2024!',
    pin: '1136',
    createdAt: '2024-04-01T09:00:00Z',
    loginHistory: [
      { timestamp: '2025-12-02T06:30:00Z', status: 'success' },
      { timestamp: '2025-12-01T07:00:00Z', status: 'success' }
    ]
  },
  {
    uid: 'RVR-137',
    userName: 'JOHNCORDONIS',
    email: 'john@rcrsal.com',
    role: 'MANAGER',
    active: true,
    password: 'Manager2024!',
    pin: '1137',
    phone: '256-654-0875',
    createdAt: '2024-02-15T10:00:00Z',
    loginHistory: [
      { timestamp: '2025-12-02T07:00:00Z', status: 'success' },
      { timestamp: '2025-12-01T08:30:00Z', status: 'success' }
    ]
  },
  {
    uid: 'RVR-138',
    userName: 'CRIS MUSE',
    email: 'chrismuse@rcrsal.com',
    role: 'USER',
    active: true,
    password: 'User2024!',
    pin: '1138',
    phone: '256-648-1224',
    createdAt: '2024-01-01T08:00:00Z',
    loginHistory: [
      { timestamp: '2025-12-03T14:00:00Z', status: 'success' },
      { timestamp: '2025-12-01T15:30:00Z', status: 'success' }
    ]
  },
  {
    uid: 'RVR-139',
    userName: 'admin',
    email: 'admin@rcrsal.com',
    role: 'ADMIN',
    active: true,
    password: 'SuperAdmin2024!',
    pin: '0000',
    createdAt: '2024-01-01T00:00:00Z',
    loginHistory: [
      { timestamp: '2025-12-04T10:00:00Z', status: 'success' }
    ]
  },
  {
    uid: 'a8ad2e33',
    userName: 'Tae Orr',
    email: 'tae@rcrsal.com',
    role: 'USER',
    active: true,
    password: 'User2024!',
    pin: '2033',
    phone: '256-200-3467',
    createdAt: '2024-05-01T09:00:00Z',
    loginHistory: [
      { timestamp: '2025-12-02T06:00:00Z', status: 'success' },
      { timestamp: '2025-12-01T06:15:00Z', status: 'success' }
    ]
  }
];

// Helper functions
export function getUserByUid(uid: string): PortalUserAccount | undefined {
  return portalUsers.find(u => u.uid === uid);
}

export function getUserByUsername(userName: string): PortalUserAccount | undefined {
  return portalUsers.find(u => u.userName.toLowerCase() === userName.toLowerCase());
}

export function getUserByEmail(email: string): PortalUserAccount | undefined {
  return portalUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
}

export function getUserByPin(pin: string): PortalUserAccount | undefined {
  return portalUsers.find(u => u.pin === pin && u.active);
}

export function getActiveUsers(): PortalUserAccount[] {
  return portalUsers.filter(u => u.active);
}

export function getUsersByRole(role: PortalUserRole): PortalUserAccount[] {
  return portalUsers.filter(u => u.role === role);
}

export function validateLogin(identifier: string, password: string): { success: boolean; user?: PortalUserAccount; error?: string } {
  // Try to find user by username, email, or PIN
  const user = getUserByUsername(identifier) ||
               getUserByEmail(identifier) ||
               getUserByPin(identifier);

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  if (!user.active) {
    return { success: false, error: 'Account is inactive' };
  }

  if (user.password !== password && user.pin !== identifier) {
    return { success: false, error: 'Invalid credentials' };
  }

  return { success: true, user };
}

// Role permissions mapping
export const rolePermissions: Record<PortalUserRole, string[]> = {
  ADMIN: [
    'view_all',
    'edit_all',
    'manage_users',
    'manage_inventory',
    'manage_billing',
    'manage_orders',
    'manage_deliveries',
    'approve_requests',
    'view_reports',
    'manage_settings',
    'view_audit_log',
    'manage_schedule'
  ],
  MANAGER: [
    'view_inventory',
    'edit_inventory',
    'view_orders',
    'create_orders',
    'view_deliveries',
    'manage_deliveries',
    'approve_requests',
    'view_reports',
    'view_schedule',
    'create_schedule'
  ],
  USER: [
    'view_inventory',
    'view_orders',
    'view_deliveries',
    'update_delivery_status',
    'upload_photos',
    'view_schedule'
  ]
};

export function hasPermission(user: PortalUserAccount, permission: string): boolean {
  const permissions = rolePermissions[user.role];
  return permissions.includes('view_all') ||
         permissions.includes('edit_all') ||
         permissions.includes(permission);
}
