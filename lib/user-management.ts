// User Management Service with Temporary Passwords
// Handles user authentication, password management, and session management

import { TeamRole, TEAM_MEMBERS, TeamMember } from './team-roles';

export interface UserCredentials {
  id: string;
  email: string;
  tempPassword?: string;
  passwordHash?: string;
  mustChangePassword: boolean;
  lastLogin?: string;
  loginAttempts: number;
  lockedUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: TeamRole;
  permissions: string[];
  sessionId: string;
  expiresAt: string;
  createdAt: string;
}

export interface LoginResult {
  success: boolean;
  message: string;
  user?: UserSession;
  requiresPasswordChange?: boolean;
}

// Generate a temporary password
export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Generate a session ID
export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
}

// Default temporary passwords for team members (should be changed on first login)
// Email format: firstname@rivercityroofingsolutions.com (except Michael & Chris use firstlast@)
export const DEFAULT_TEMP_PASSWORDS: Record<string, string> = {
  'michael': 'Admin2024!',   // michaelmuse@rivercityroofingsolutions.com
  'sara': 'Admin2024!',       // sara@rivercityroofingsolutions.com
  'tia': 'Office2024!',       // tia@rivercityroofingsolutions.com
  'destin': 'Office2024!',    // destin@rivercityroofingsolutions.com
  'john': 'PM2024John!',      // john@rivercityroofingsolutions.com
  'bart': 'PM2024Bart!',      // bart@rivercityroofingsolutions.com
  'rick': '',                 // Uses PIN (rick@rivercityroofingsolutions.com)
  'tae': '',                  // Uses PIN (tae@rivercityroofingsolutions.com)
  'chris': 'View2024!',       // chrismuse@rivercityroofingsolutions.com
};

// User credentials store (in production, this would be in a database)
let userCredentials: Map<string, UserCredentials> = new Map();

// Initialize credentials for all team members
export function initializeUserCredentials(): void {
  TEAM_MEMBERS.forEach(member => {
    if (!userCredentials.has(member.id)) {
      const tempPassword = DEFAULT_TEMP_PASSWORDS[member.id] || generateTempPassword();
      userCredentials.set(member.id, {
        id: member.id,
        email: member.email,
        tempPassword: member.role === 'driver' ? undefined : tempPassword,
        mustChangePassword: true,
        loginAttempts: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  });
}

// Initialize on module load
initializeUserCredentials();

// Authenticate user with email and password
export function authenticateUser(email: string, password: string): LoginResult {
  const member = TEAM_MEMBERS.find(m =>
    m.email.toLowerCase() === email.toLowerCase() && m.isActive
  );

  if (!member) {
    return { success: false, message: 'Invalid email or password' };
  }

  const credentials = userCredentials.get(member.id);
  if (!credentials) {
    return { success: false, message: 'Account not set up' };
  }

  // Check if account is locked
  if (credentials.lockedUntil && new Date(credentials.lockedUntil) > new Date()) {
    const minutesLeft = Math.ceil((new Date(credentials.lockedUntil).getTime() - Date.now()) / 60000);
    return { success: false, message: `Account locked. Try again in ${minutesLeft} minutes.` };
  }

  // Check password
  const isValid = credentials.tempPassword === password || credentials.passwordHash === hashPassword(password);

  if (!isValid) {
    // Increment login attempts
    credentials.loginAttempts++;
    credentials.updatedAt = new Date().toISOString();

    // Lock account after 5 failed attempts
    if (credentials.loginAttempts >= 5) {
      credentials.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes
      return { success: false, message: 'Account locked due to too many failed attempts. Try again in 15 minutes.' };
    }

    return { success: false, message: 'Invalid email or password' };
  }

  // Successful login
  credentials.loginAttempts = 0;
  credentials.lastLogin = new Date().toISOString();
  credentials.updatedAt = new Date().toISOString();

  const session: UserSession = {
    userId: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    permissions: member.permissions,
    sessionId: generateSessionId(),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours
    createdAt: new Date().toISOString(),
  };

  return {
    success: true,
    message: 'Login successful',
    user: session,
    requiresPasswordChange: credentials.mustChangePassword,
  };
}

// Authenticate driver with PIN
export function authenticateDriver(pin: string): LoginResult {
  const member = TEAM_MEMBERS.find(m => m.pin === pin && m.role === 'driver' && m.isActive);

  if (!member) {
    return { success: false, message: 'Invalid PIN' };
  }

  const session: UserSession = {
    userId: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    permissions: member.permissions,
    sessionId: generateSessionId(),
    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // 12 hours for drivers
    createdAt: new Date().toISOString(),
  };

  return {
    success: true,
    message: 'Login successful',
    user: session,
  };
}

// Change password
export function changePassword(userId: string, currentPassword: string, newPassword: string): { success: boolean; message: string } {
  const credentials = userCredentials.get(userId);
  if (!credentials) {
    return { success: false, message: 'User not found' };
  }

  // Verify current password
  const isValid = credentials.tempPassword === currentPassword || credentials.passwordHash === hashPassword(currentPassword);
  if (!isValid) {
    return { success: false, message: 'Current password is incorrect' };
  }

  // Validate new password
  if (newPassword.length < 8) {
    return { success: false, message: 'Password must be at least 8 characters' };
  }

  // Update password
  credentials.passwordHash = hashPassword(newPassword);
  credentials.tempPassword = undefined;
  credentials.mustChangePassword = false;
  credentials.updatedAt = new Date().toISOString();

  return { success: true, message: 'Password changed successfully' };
}

// Reset password (admin function)
export function resetPassword(userId: string): { success: boolean; tempPassword?: string; message: string } {
  const member = TEAM_MEMBERS.find(m => m.id === userId);
  if (!member) {
    return { success: false, message: 'User not found' };
  }

  const credentials = userCredentials.get(userId);
  if (!credentials) {
    return { success: false, message: 'User credentials not found' };
  }

  const tempPassword = generateTempPassword();
  credentials.tempPassword = tempPassword;
  credentials.passwordHash = undefined;
  credentials.mustChangePassword = true;
  credentials.loginAttempts = 0;
  credentials.lockedUntil = undefined;
  credentials.updatedAt = new Date().toISOString();

  return {
    success: true,
    tempPassword,
    message: `Password reset for ${member.name}. New temporary password: ${tempPassword}`,
  };
}

// Simple hash function (in production, use bcrypt or similar)
function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `hash_${Math.abs(hash).toString(36)}`;
}

// Get all users for admin view
export function getAllUsers(): Array<{
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  isActive: boolean;
  lastLogin?: string;
  mustChangePassword: boolean;
  isLocked: boolean;
}> {
  return TEAM_MEMBERS.map(member => {
    const credentials = userCredentials.get(member.id);
    return {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      isActive: member.isActive,
      lastLogin: credentials?.lastLogin,
      mustChangePassword: credentials?.mustChangePassword || false,
      isLocked: credentials?.lockedUntil ? new Date(credentials.lockedUntil) > new Date() : false,
    };
  });
}

// Create new user
export function createUser(data: {
  name: string;
  email: string;
  role: TeamRole;
  pin?: string;
}): { success: boolean; user?: TeamMember; tempPassword?: string; message: string } {
  // Check if email already exists
  const existing = TEAM_MEMBERS.find(m => m.email.toLowerCase() === data.email.toLowerCase());
  if (existing) {
    return { success: false, message: 'Email already exists' };
  }

  const userId = data.name.toLowerCase().replace(/\s+/g, '-');
  const tempPassword = data.role === 'driver' ? '' : generateTempPassword();

  const newMember: TeamMember = {
    id: userId,
    name: data.name,
    slug: userId,
    email: data.email,
    role: data.role,
    pin: data.pin,
    isActive: true,
    permissions: getDefaultPermissions(data.role),
    createdAt: new Date().toISOString(),
  };

  // Add to team members (in production, this would be persisted to database)
  (TEAM_MEMBERS as TeamMember[]).push(newMember);

  // Create credentials
  userCredentials.set(userId, {
    id: userId,
    email: data.email,
    tempPassword: data.role === 'driver' ? undefined : tempPassword,
    mustChangePassword: true,
    loginAttempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return {
    success: true,
    user: newMember,
    tempPassword: data.role === 'driver' ? undefined : tempPassword,
    message: `User ${data.name} created successfully`,
  };
}

// Get default permissions for a role
function getDefaultPermissions(role: TeamRole): string[] {
  switch (role) {
    case 'owner':
    case 'admin':
      return ['*'];
    case 'office':
      return [
        'view_dashboard', 'manage_billing', 'manage_inventory', 'view_tickets',
        'update_ticket_status', 'create_invoices', 'manage_vendors', 'view_reports',
        'view_schedule', 'manage_stock'
      ];
    case 'project_manager':
      return [
        'view_dashboard', 'create_material_orders', 'create_delivery_tickets',
        'create_pickup_tickets', 'create_return_tickets', 'schedule_events',
        'view_schedule', 'view_own_tickets', 'update_own_tickets', 'view_inventory',
        'view_drivers'
      ];
    case 'driver':
      return [
        'view_assigned_tickets', 'update_delivery_status', 'upload_photos',
        'capture_signature', 'view_route', 'view_checklist', 'complete_checklist',
        'edit_stock_qty', 'create_pickup_tickets', 'create_return_tickets',
        'log_gps_activity'
      ];
    case 'viewer':
      return ['view_dashboard', 'view_tickets', 'view_schedule', 'view_reports', 'view_inventory'];
    default:
      return [];
  }
}

// Deactivate user
export function deactivateUser(userId: string): { success: boolean; message: string } {
  const member = TEAM_MEMBERS.find(m => m.id === userId);
  if (!member) {
    return { success: false, message: 'User not found' };
  }

  member.isActive = false;
  return { success: true, message: `User ${member.name} deactivated` };
}

// Unlock user account
export function unlockUser(userId: string): { success: boolean; message: string } {
  const credentials = userCredentials.get(userId);
  if (!credentials) {
    return { success: false, message: 'User not found' };
  }

  credentials.loginAttempts = 0;
  credentials.lockedUntil = undefined;
  credentials.updatedAt = new Date().toISOString();

  return { success: true, message: 'Account unlocked' };
}
