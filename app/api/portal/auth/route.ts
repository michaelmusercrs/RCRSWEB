/**
 * Portal Authentication API
 *
 * Secure authentication endpoint for team portal with:
 * - Rate limiting
 * - Failed attempt tracking
 * - JWT token generation
 * - httpOnly cookie sessions
 * - Enhanced PIN security
 */

import { NextRequest, NextResponse } from 'next/server';
import { portalAuthService } from '@/lib/portal-auth';
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
import { TEAM_MEMBERS } from '@/lib/team-roles';

const authRateLimiter = createAuthRateLimiter();

export async function POST(request: NextRequest) {
  return withRateLimit(request, authRateLimiter, async () => {
    try {
      const body = await request.json();
      const { action, ...data } = body;
      const clientIP = getClientIP(request);

      switch (action) {
        case 'login-pin': {
          // PIN login deprecated - use email+password instead
          return NextResponse.json(
            {
              success: false,
              error: 'PIN login has been removed. Please use email and password.',
            },
            {
              status: 410, // Gone
              headers: getSecurityHeaders(),
            }
          );
        }

        case 'login-passcode': {
          const identifier = `portal-passcode:${clientIP}:${data.email}`;

          // Check rate limit
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

          const result = await portalAuthService.authenticateByTempPasscode(data.email, data.passcode);

          if (!result.success || !result.user) {
            recordLoginAttempt(identifier, false);
            const newCheck = checkRateLimit(identifier);

            return NextResponse.json(
              {
                success: false,
                error: result.error || 'Invalid passcode',
                remainingAttempts: newCheck.remainingAttempts,
              },
              {
                status: 401,
                headers: getSecurityHeaders(),
              }
            );
          }

          // Successful login
          recordLoginAttempt(identifier, true);

          // Generate JWT tokens
          const user: AuthUser = {
            userId: result.user.userId,
            name: result.user.name,
            email: result.user.email,
            role: result.user.role,
            permissions: Object.entries(portalAuthService.getPermissions(result.user.role))
              .filter(([_, value]) => value === true)
              .map(([key]) => key),
          };

          const accessToken = generateAccessToken(user);
          const refreshToken = generateRefreshToken(user);

          // Set secure cookies
          await setAuthCookies(accessToken, refreshToken);

          return NextResponse.json(
            {
              success: true,
              user: {
                userId: result.user.userId,
                name: result.user.name,
                email: result.user.email,
                role: result.user.role,
                permissions: portalAuthService.getPermissions(result.user.role),
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

        case 'check-permission': {
          // Validate session first
          const sessionResult = await validateSession();
          if (!sessionResult.valid) {
            return NextResponse.json(
              { hasPermission: false },
              { headers: getSecurityHeaders() }
            );
          }

          const user = await portalAuthService.getUserById(data.userId);
          if (!user) {
            return NextResponse.json(
              { hasPermission: false },
              { headers: getSecurityHeaders() }
            );
          }
          const hasPermission = portalAuthService.hasPermission(user, data.permission);
          return NextResponse.json(
            { hasPermission },
            { headers: getSecurityHeaders() }
          );
        }

        default:
          return NextResponse.json(
            { error: 'Invalid action' },
            { status: 400, headers: getSecurityHeaders() }
          );
      }
    } catch (error) {
      console.error('Auth API error:', error);
      return NextResponse.json(
        { error: 'Server error' },
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
