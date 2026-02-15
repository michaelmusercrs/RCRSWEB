// Portal Users Data - Source: items for web.pdf (Page 3)
// Last Updated: February 2026
// SECURITY: Passwords are PBKDF2-hashed (sha512, 100k iterations)
// PINs are for driver quick-login only (low-sensitivity)

import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';

export type PortalUserRole = 'ADMIN' | 'MANAGER' | 'USER';

export interface PortalUserAccount {
  uid: string;
  userName: string;
  email: string;
  role: PortalUserRole;
  active: boolean;
  passwordHash: string; // PBKDF2 salt:hash
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

// =============================================================================
// Password Hashing Utilities
// =============================================================================

/**
 * Hash a password with PBKDF2 (sha512, 100k iterations, random salt)
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a PBKDF2 hash (timing-safe comparison)
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const candidateHash = pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  // Use timing-safe comparison to prevent timing attacks
  try {
    return timingSafeEqual(Buffer.from(candidateHash, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

// =============================================================================
// Portal Users - Passwords hashed with PBKDF2
// =============================================================================

const portalUsers: PortalUserAccount[] = [
  {
    uid: 'RVR-131',
    userName: 'SARAHILL',
    email: 'sara@rcrsal.com',
    role: 'ADMIN',
    active: true,
    passwordHash: '262f909270e19f520475f9ec734d7ba0:59b23bd532f766391ff2fe305e2f82e0bf77cb42bc716a15bf13c820bacb32fd9626c49fd50bb4259a1124df23ae968a233030e4b9a43e36cc6a07635e9cbd51',
    pin: '1131',
    createdAt: '2024-01-15T08:00:00Z',
    loginHistory: []
  },
  {
    uid: 'RVR-132',
    userName: 'DESTINMCCURY',
    email: 'destin@rcrsal.com',
    role: 'MANAGER',
    active: true,
    passwordHash: 'e3062f76a978eb03241e9ddd0e400f69:a9e6846336230647ed60cb6ca82422da679444eeb324e9f579d721f37b0928d7e26be4222ac949f664061e1be8077e723266a0c76779000ed08f2ef459beb28c',
    pin: '1132',
    createdAt: '2024-02-01T09:00:00Z',
    loginHistory: []
  },
  {
    uid: 'RVR-133',
    userName: 'TIAMORRIS',
    email: 'tia@rcrsal.com',
    role: 'MANAGER',
    active: true,
    passwordHash: 'e3062f76a978eb03241e9ddd0e400f69:a9e6846336230647ed60cb6ca82422da679444eeb324e9f579d721f37b0928d7e26be4222ac949f664061e1be8077e723266a0c76779000ed08f2ef459beb28c',
    pin: '1133',
    createdAt: '2024-02-01T09:00:00Z',
    loginHistory: []
  },
  {
    uid: 'RVR-134',
    userName: 'BARTROBERTS',
    email: 'bart@rcrsal.com',
    role: 'MANAGER',
    active: true,
    passwordHash: 'e3062f76a978eb03241e9ddd0e400f69:a9e6846336230647ed60cb6ca82422da679444eeb324e9f579d721f37b0928d7e26be4222ac949f664061e1be8077e723266a0c76779000ed08f2ef459beb28c',
    pin: '1134',
    createdAt: '2024-03-15T10:00:00Z',
    loginHistory: []
  },
  {
    uid: 'RVR-135',
    userName: 'MICHAELMUSE',
    email: 'michaelmuse@rcrsal.com',
    role: 'ADMIN',
    active: true,
    passwordHash: '262f909270e19f520475f9ec734d7ba0:59b23bd532f766391ff2fe305e2f82e0bf77cb42bc716a15bf13c820bacb32fd9626c49fd50bb4259a1124df23ae968a233030e4b9a43e36cc6a07635e9cbd51',
    pin: '1135',
    createdAt: '2024-01-01T08:00:00Z',
    loginHistory: []
  },
  {
    uid: 'RVR-136',
    userName: 'RICHARDGEAHR',
    email: 'richard@rivercityroofingsolutions.com',
    role: 'USER',
    active: true,
    passwordHash: '56e3e755cb07d11a03c5ce70be19c5e9:8d7fed6fb5ccc5fb72e092ed427ae6280f9a88abac6fdd1163a29115c6ed4ecc4a5072ab3579171f1f1af1681c1919d2a98b1f2725932afaa9796b0c1d66b0e0',
    pin: '1136',
    createdAt: '2024-04-01T09:00:00Z',
    loginHistory: []
  },
  {
    uid: 'RVR-137',
    userName: 'JOHNCORDONIS',
    email: 'john@rcrsal.com',
    role: 'MANAGER',
    active: true,
    passwordHash: 'e3062f76a978eb03241e9ddd0e400f69:a9e6846336230647ed60cb6ca82422da679444eeb324e9f579d721f37b0928d7e26be4222ac949f664061e1be8077e723266a0c76779000ed08f2ef459beb28c',
    pin: '1137',
    createdAt: '2024-02-15T10:00:00Z',
    loginHistory: []
  },
  {
    uid: 'RVR-138',
    userName: 'CHRISMUSE',
    email: 'chrismuse@rcrsal.com',
    role: 'USER',
    active: true,
    passwordHash: '56e3e755cb07d11a03c5ce70be19c5e9:8d7fed6fb5ccc5fb72e092ed427ae6280f9a88abac6fdd1163a29115c6ed4ecc4a5072ab3579171f1f1af1681c1919d2a98b1f2725932afaa9796b0c1d66b0e0',
    pin: '1138',
    createdAt: '2024-01-01T08:00:00Z',
    loginHistory: []
  },
  {
    uid: 'RVR-139',
    userName: 'admin',
    email: 'admin@rcrsal.com',
    role: 'ADMIN',
    active: true,
    passwordHash: '87f6d05a2295c0ea609771ad7228199c:6174072ef6542a9a16764b870d71672c2d39d9ccf0ab7cf72d4e5be2683443a91f53992b31a0b3ab1d3970dcd128612efb47136afa88fb5497d23f44c2e1b050',
    pin: undefined, // SECURITY: Admin accounts should not have PIN login
    createdAt: '2024-01-01T00:00:00Z',
    loginHistory: []
  },
  {
    uid: 'a8ad2e33',
    userName: 'TAEORR',
    email: 'tae@rcrsal.com',
    role: 'USER',
    active: false, // Inactive - not in Google Workspace
    passwordHash: '56e3e755cb07d11a03c5ce70be19c5e9:8d7fed6fb5ccc5fb72e092ed427ae6280f9a88abac6fdd1163a29115c6ed4ecc4a5072ab3579171f1f1af1681c1919d2a98b1f2725932afaa9796b0c1d66b0e0',
    pin: '2033',
    createdAt: '2024-05-01T09:00:00Z',
    loginHistory: []
  }
];

// =============================================================================
// Helper Functions
// =============================================================================

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

/**
 * Validate login with hashed password comparison (timing-safe)
 */
export function validateLogin(identifier: string, password: string): { success: boolean; user?: PortalUserAccount; error?: string } {
  // Try to find user by username, email, or PIN
  const user = getUserByUsername(identifier) ||
               getUserByEmail(identifier) ||
               getUserByPin(identifier);

  if (!user) {
    // Still hash to prevent timing-based user enumeration
    verifyPassword(password, 'dummy:dummy');
    return { success: false, error: 'Invalid credentials' };
  }

  if (!user.active) {
    return { success: false, error: 'Account is inactive' };
  }

  // PIN-based login (driver quick login) — PIN is the password itself
  // When identifier matches a PIN, the password param must also match the PIN
  if (user.pin === identifier && password === identifier) {
    return { success: true, user };
  }

  // Password-based login
  if (verifyPassword(password, user.passwordHash)) {
    return { success: true, user };
  }

  return { success: false, error: 'Invalid credentials' };
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
