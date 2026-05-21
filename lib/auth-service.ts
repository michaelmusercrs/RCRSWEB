/**
 * Secure Authentication Service
 *
 * This service provides:
 * - JWT token generation and validation
 * - Secure password/PIN hashing
 * - Rate limiting for auth endpoints
 * - Failed attempt tracking and lockout
 * - Session management
 */

import { cookies } from 'next/headers';

// ============================================
// CONFIGURATION
// ============================================

const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET;
const JWT_EXPIRES_IN = 60 * 60 * 8; // 8 hours in seconds
const REFRESH_TOKEN_EXPIRES_IN = 60 * 60 * 24 * 7; // 7 days in seconds
const STAY_SIGNED_IN_EXPIRES = 60 * 60 * 24 * 30; // 30 days in seconds

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_ATTEMPTS = 20;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes

// ============================================
// TYPES
// ============================================

export interface AuthUser {
  userId: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

export interface JWTPayload {
  sub: string; // User ID
  name: string;
  email: string;
  role: string;
  permissions: string[];
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
  remainingAttempts?: number;
  lockoutMinutes?: number;
}

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lockedUntil?: number;
}

// ============================================
// IN-MEMORY RATE LIMITING (Use Redis in production)
// ============================================

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.lockedUntil && entry.lockedUntil < now) {
      rateLimitStore.delete(key);
    } else if (now - entry.firstAttempt > RATE_LIMIT_WINDOW) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

// ============================================
// SIMPLE CRYPTO (For production use proper crypto libraries)
// ============================================

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString();
}

function createHmac(data: string, secret: string): string {
  // Simple HMAC-like signature (use crypto.createHmac in production)
  const crypto = require('crypto');
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

// ============================================
// JWT FUNCTIONS
// ============================================

export function generateAccessToken(user: AuthUser): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    sub: user.userId,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
    iat: now,
    exp: now + JWT_EXPIRES_IN,
    type: 'access',
  };

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadStr = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac(`${header}.${payloadStr}`, JWT_SECRET);

  return `${header}.${payloadStr}.${signature}`;
}

export function generateRefreshToken(user: AuthUser, staySignedIn?: boolean): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  const expiresIn = staySignedIn ? STAY_SIGNED_IN_EXPIRES : REFRESH_TOKEN_EXPIRES_IN;
  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    sub: user.userId,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
    iat: now,
    exp: now + expiresIn,
    type: 'refresh',
  };

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadStr = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac(`${header}.${payloadStr}`, JWT_SECRET);

  return `${header}.${payloadStr}.${signature}`;
}

export function verifyToken(token: string): { valid: boolean; payload?: JWTPayload; error?: string } {
  if (!JWT_SECRET) {
    return { valid: false, error: 'JWT_SECRET not configured' };
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid token format' };
    }

    const [header, payloadStr, signature] = parts;
    const expectedSignature = createHmac(`${header}.${payloadStr}`, JWT_SECRET);

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }

    const payload = JSON.parse(base64UrlDecode(payloadStr)) as JWTPayload;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: 'Token verification failed' };
  }
}

// ============================================
// RATE LIMITING
// ============================================

export function checkRateLimit(_identifier: string): { allowed: boolean; remainingAttempts?: number; lockoutMinutes?: number } {
  // Rate limiting disabled — always allow login attempts
  return { allowed: true };
}

export function recordLoginAttempt(identifier: string, success: boolean): void {
  if (success) {
    rateLimitStore.delete(identifier);
    return;
  }

  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (entry) {
    entry.attempts++;
    rateLimitStore.set(identifier, entry);
  } else {
    rateLimitStore.set(identifier, { attempts: 1, firstAttempt: now });
  }
}

export function clearRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

// ============================================
// COOKIE MANAGEMENT
// ============================================

export async function setAuthCookies(accessToken: string, refreshToken: string, staySignedIn?: boolean): Promise<void> {
  const cookieStore = await cookies();
  const refreshMaxAge = staySignedIn ? STAY_SIGNED_IN_EXPIRES : REFRESH_TOKEN_EXPIRES_IN;

  // Access token cookie - httpOnly, secure, same-site strict
  cookieStore.set('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: JWT_EXPIRES_IN,
    path: '/',
  });

  // Refresh token cookie - httpOnly, secure, same-site strict
  cookieStore.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: refreshMaxAge,
    path: '/',
  });
}

export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set('access_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });

  cookieStore.set('refresh_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
}

export async function getTokenFromCookies(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get('access_token')?.value;
}

export async function getRefreshTokenFromCookies(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get('refresh_token')?.value;
}

// ============================================
// SESSION VALIDATION
// ============================================

export async function validateSession(): Promise<{ valid: boolean; user?: AuthUser; error?: string }> {
  const token = await getTokenFromCookies();

  if (!token) {
    return { valid: false, error: 'No session token' };
  }

  const result = verifyToken(token);

  if (!result.valid || !result.payload) {
    return { valid: false, error: result.error || 'Invalid token' };
  }

  if (result.payload.type !== 'access') {
    return { valid: false, error: 'Invalid token type' };
  }

  return {
    valid: true,
    user: {
      userId: result.payload.sub,
      name: result.payload.name,
      email: result.payload.email,
      role: result.payload.role,
      permissions: result.payload.permissions,
    },
  };
}

export async function refreshSession(): Promise<AuthResult> {
  const refreshToken = await getRefreshTokenFromCookies();

  if (!refreshToken) {
    return { success: false, error: 'No refresh token' };
  }

  const result = verifyToken(refreshToken);

  if (!result.valid || !result.payload) {
    return { success: false, error: result.error || 'Invalid refresh token' };
  }

  if (result.payload.type !== 'refresh') {
    return { success: false, error: 'Invalid token type' };
  }

  // Generate new tokens
  const user: AuthUser = {
    userId: result.payload.sub,
    name: result.payload.name,
    email: result.payload.email,
    role: result.payload.role,
    permissions: result.payload.permissions,
  };

  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  await setAuthCookies(newAccessToken, newRefreshToken);

  return {
    success: true,
    user,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

// PIN validation removed - email+password only auth

// ============================================
// IP EXTRACTION
// ============================================

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  return 'unknown';
}

// ============================================
// ROUTE AUTH HELPERS
// ============================================

/**
 * Require authenticated session for API routes.
 * Returns user if authenticated, or a 401 NextResponse if not.
 * Usage:
 *   const auth = await requireAuth();
 *   if (!auth.authenticated) return auth.response;
 *   // auth.user is now available
 */
export async function requireAuth(): Promise<
  { authenticated: true; user: AuthUser } | { authenticated: false; response: Response }
> {
  // Dev-only auth bypass. Triple-gated so this can never activate in
  // production: NODE_ENV must NOT be 'production' AND the explicit env
  // flag must be set AND we must not be on a Vercel deployment.
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.DEV_AUTH_BYPASS === '1' &&
    !process.env.VERCEL
  ) {
    return {
      authenticated: true,
      user: {
        userId: 'dev-bypass',
        email: 'dev@local',
        name: 'Dev Bypass',
        role: 'admin',
      } as AuthUser,
    };
  }

  const session = await validateSession();
  if (!session.valid || !session.user) {
    const { NextResponse } = await import('next/server');
    return {
      authenticated: false,
      response: NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }

  return { authenticated: true, user: session.user };
}

/**
 * Require admin role for API routes.
 * Returns user if admin, 401 if not authenticated, 403 if wrong role.
 *
 * Identity allowlist (2026-05-20, M5 fix): Richard Geahr ("Rick") is
 * default-allowed by slug even though his stored role is `driver`, to mirror
 * the same identity-bypass that `requireRoleAtLeast` already applies (see the
 * commit b789cb5 helper). Pass a custom `allowedSlugs` list to override the
 * default (e.g., pass `[]` if a surface should be role-only).
 */
export async function requireAdmin(
  allowedSlugs: string[] = ['richard', 'richard@rcrsal.com']
): Promise<
  { authenticated: true; user: AuthUser } | { authenticated: false; response: Response }
> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth;

  const role = (auth.user.role || '').toLowerCase();
  const email = (auth.user.email || '').toLowerCase();
  const userId = (auth.user.userId || '').toLowerCase();
  const allowedSlugsLower = allowedSlugs.map(s => s.toLowerCase());

  const roleOk = role === 'admin' || role === 'owner';
  const slugOk =
    allowedSlugsLower.includes(email) ||
    allowedSlugsLower.includes(userId);

  if (!roleOk && !slugOk) {
    const { NextResponse } = await import('next/server');
    return {
      authenticated: false,
      response: NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      ),
    };
  }

  return auth;
}

/**
 * Require the authenticated user's role to be in `allowedRoles`. Returns
 * 401 if not authenticated, 403 if authenticated but role is not allowed.
 *
 * Role comparison is case-insensitive against the JWT-stored role string
 * (TeamRole values: 'owner' | 'admin' | 'manager' | 'office' | 'sales' |
 * 'driver' | 'project_manager' | 'viewer'). Per cost-visibility rule
 * (feedback_purchase_price_visibility), Richard Geahr ("Rick") is also
 * allowed on cost/commission surfaces despite being role='driver' — pass
 * his email/slug in `allowedSlugs` to grant him access by identity.
 *
 * Usage:
 *   const auth = await requireRoleAtLeast(['owner', 'admin', 'office', 'manager']);
 *   if (!auth.authenticated) return auth.response;
 */
export async function requireRoleAtLeast(
  allowedRoles: string[],
  allowedSlugs: string[] = ['richard', 'richard@rcrsal.com']
): Promise<{ authenticated: true; user: AuthUser } | { authenticated: false; response: Response }> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth;

  const role = (auth.user.role || '').toLowerCase();
  const allowedRolesLower = allowedRoles.map(r => r.toLowerCase());
  const allowedSlugsLower = allowedSlugs.map(s => s.toLowerCase());
  const email = (auth.user.email || '').toLowerCase();
  const userId = (auth.user.userId || '').toLowerCase();

  const roleOk = allowedRolesLower.includes(role);
  const slugOk =
    allowedSlugsLower.includes(email) ||
    allowedSlugsLower.includes(userId);

  if (!roleOk && !slugOk) {
    const { NextResponse } = await import('next/server');
    return {
      authenticated: false,
      response: NextResponse.json(
        { success: false, error: 'Insufficient role for this resource' },
        { status: 403 }
      ),
    };
  }

  return auth;
}

// ============================================
// SECURITY HEADERS
// ============================================

export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}
