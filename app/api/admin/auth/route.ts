/**
 * Admin Authentication API
 *
 * Secure authentication endpoint for admin panel with:
 * - Rate limiting
 * - Failed attempt tracking
 * - JWT token generation
 * - httpOnly cookie sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateAccessToken,
  generateRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  validateSession,
  refreshSession,
  checkRateLimit,
  recordLoginAttempt,
  getClientIP,
  getSecurityHeaders,
  AuthUser,
} from '@/lib/auth-service';
import { createAuthRateLimiter, withRateLimit } from '@/lib/rate-limiter';

// Server-side only password - NOT exposed to client
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  console.error('CRITICAL: ADMIN_PASSWORD environment variable is not set!');
}

// Admin users (in production, store in database)
const ADMIN_USERS: Record<string, { password: string; name: string; email: string; role: string; permissions: string[] }> = {
  admin: {
    password: ADMIN_PASSWORD || '',
    name: 'Admin',
    email: 'admin@rcrsal.com',
    role: 'admin',
    permissions: ['*'],
  },
};

const authRateLimiter = createAuthRateLimiter();

export async function POST(request: NextRequest) {
  return withRateLimit(request, authRateLimiter, async () => {
    try {
      const body = await request.json();
      const { action, username, password } = body;
      const clientIP = getClientIP(request);
      const identifier = `admin:${clientIP}`;

      switch (action) {
        case 'login': {
          // Check rate limit for this IP
          const rateLimitCheck = checkRateLimit(identifier);
          if (!rateLimitCheck.allowed) {
            return NextResponse.json(
              {
                success: false,
                error: `Too many login attempts. Please try again in ${rateLimitCheck.lockoutMinutes} minutes.`,
                remainingAttempts: 0,
              },
              {
                status: 429,
                headers: getSecurityHeaders(),
              }
            );
          }

          // Validate credentials
          const adminUser = ADMIN_USERS[username || 'admin'];

          if (!adminUser || password !== adminUser.password) {
            recordLoginAttempt(identifier, false);
            const newCheck = checkRateLimit(identifier);

            return NextResponse.json(
              {
                success: false,
                error: 'Invalid credentials',
                remainingAttempts: newCheck.remainingAttempts,
              },
              {
                status: 401,
                headers: getSecurityHeaders(),
              }
            );
          }

          // Successful login - clear rate limit
          recordLoginAttempt(identifier, true);

          // Generate tokens
          const user: AuthUser = {
            userId: `admin-${username || 'admin'}`,
            name: adminUser.name,
            email: adminUser.email,
            role: adminUser.role,
            permissions: adminUser.permissions,
          };

          const accessToken = generateAccessToken(user);
          const refreshToken = generateRefreshToken(user);

          // Set httpOnly cookies
          await setAuthCookies(accessToken, refreshToken);

          return NextResponse.json(
            {
              success: true,
              user: {
                userId: user.userId,
                name: user.name,
                email: user.email,
                role: user.role,
              },
            },
            { headers: getSecurityHeaders() }
          );
        }

        case 'logout': {
          await clearAuthCookies();
          return NextResponse.json(
            { success: true },
            { headers: getSecurityHeaders() }
          );
        }

        case 'validate': {
          const sessionResult = await validateSession();

          if (!sessionResult.valid) {
            return NextResponse.json(
              { success: false, error: sessionResult.error },
              { status: 401, headers: getSecurityHeaders() }
            );
          }

          return NextResponse.json(
            {
              success: true,
              user: sessionResult.user,
            },
            { headers: getSecurityHeaders() }
          );
        }

        case 'refresh': {
          const result = await refreshSession();

          if (!result.success) {
            return NextResponse.json(
              { success: false, error: result.error },
              { status: 401, headers: getSecurityHeaders() }
            );
          }

          return NextResponse.json(
            {
              success: true,
              user: result.user,
            },
            { headers: getSecurityHeaders() }
          );
        }

        default:
          return NextResponse.json(
            { success: false, error: 'Invalid action' },
            { status: 400, headers: getSecurityHeaders() }
          );
      }
    } catch (error) {
      console.error('Admin auth error:', error);
      return NextResponse.json(
        { success: false, error: 'Server error' },
        { status: 500, headers: getSecurityHeaders() }
      );
    }
  });
}

export async function GET(request: NextRequest) {
  // Validate session endpoint
  try {
    const sessionResult = await validateSession();

    if (!sessionResult.valid) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401, headers: getSecurityHeaders() }
      );
    }

    return NextResponse.json(
      {
        authenticated: true,
        user: sessionResult.user,
      },
      { headers: getSecurityHeaders() }
    );
  } catch (error) {
    return NextResponse.json(
      { authenticated: false, error: 'Server error' },
      { status: 500, headers: getSecurityHeaders() }
    );
  }
}
