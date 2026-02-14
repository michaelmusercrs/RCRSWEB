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

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_ATTEMPTS = 5;
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

function hashPin(pin: string, salt: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(pin + salt).digest('hex');
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

export function generateRefreshToken(user: AuthUser): string {
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
    exp: now + REFRESH_TOKEN_EXPIRES_IN,
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

export function checkRateLimit(identifier: string): { allowed: boolean; remainingAttempts?: number; lockoutMinutes?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // Check if locked out
  if (entry?.lockedUntil && entry.lockedUntil > now) {
    const lockoutMinutes = Math.ceil((entry.lockedUntil - now) / 60000);
    return { allowed: false, remainingAttempts: 0, lockoutMinutes };
  }

  // Check if window expired
  if (entry && now - entry.firstAttempt > RATE_LIMIT_WINDOW) {
    rateLimitStore.delete(identifier);
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }

  // Check attempts
  if (entry && entry.attempts >= MAX_LOGIN_ATTEMPTS) {
    // Lock out the user
    entry.lockedUntil = now + LOCKOUT_DURATION;
    rateLimitStore.set(identifier, entry);
    const lockoutMinutes = Math.ceil(LOCKOUT_DURATION / 60000);
    return { allowed: false, remainingAttempts: 0, lockoutMinutes };
  }

  const remainingAttempts = entry ? MAX_LOGIN_ATTEMPTS - entry.attempts : MAX_LOGIN_ATTEMPTS;
  return { allowed: true, remainingAttempts };
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

export async function setAuthCookies(accessToken: string, refreshToken: string): Promise<void> {
  const cookieStore = await cookies();

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
    maxAge: REFRESH_TOKEN_EXPIRES_IN,
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

// ============================================
// PIN VALIDATION WITH ENHANCED SECURITY
// ============================================

export function validatePin(inputPin: string, storedPin: string, salt?: string): boolean {
  // If salt is provided, compare hashes
  if (salt) {
    return hashPin(inputPin, salt) === storedPin;
  }

  // Fallback to direct comparison (for legacy data)
  // Use timing-safe comparison to prevent timing attacks
  if (inputPin.length !== storedPin.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < inputPin.length; i++) {
    result |= inputPin.charCodeAt(i) ^ storedPin.charCodeAt(i);
  }
  return result === 0;
}

export function generateSecurePin(length: number = 6): string {
  const crypto = require('crypto');
  const max = Math.pow(10, length) - 1;
  const min = Math.pow(10, length - 1);
  const randomNum = crypto.randomInt(min, max + 1);
  return randomNum.toString().padStart(length, '0');
}

export function generateSalt(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(16).toString('hex');
}

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
 */
export async function requireAdmin(): Promise<
  { authenticated: true; user: AuthUser } | { authenticated: false; response: Response }
> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth;

  if (auth.user.role !== 'admin' && auth.user.role !== 'owner') {
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
