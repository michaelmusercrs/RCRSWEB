/**
 * Portal Authentication API
 *
 * Secure authentication endpoint for team portal with:
 * - Email + password authentication
 * - PIN login (4-8 digit)
 * - Picture password login (3 tap points)
 * - Login method preferences
 * - Rate limiting & failed attempt tracking
 * - JWT token generation
 * - httpOnly cookie sessions
 * - Stay-signed-in (30-day persistent sessions)
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
import { credentialService } from '@/lib/credential-service';
import type { PicturePoint } from '@/lib/credential-service';

const authRateLimiter = createAuthRateLimiter();

/** Helper: build AuthUser from team member and generate tokens */
async function loginSuccess(
  member: (typeof TEAM_MEMBERS)[number],
  staySignedIn?: boolean
): Promise<{ user: AuthUser; accessToken: string; refreshToken: string }> {
  const user: AuthUser = {
    userId: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    permissions: member.permissions,
  };

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user, staySignedIn);
  await setAuthCookies(accessToken, refreshToken, staySignedIn);

  // Record login timestamp (non-blocking)
  credentialService.recordLogin(member.id).catch(() => {});

  return { user, accessToken, refreshToken };
}

/** Helper: rate-limit check + member lookup */
function lookupMember(email: string) {
  return TEAM_MEMBERS.find(
    m => m.email.toLowerCase() === (email || '').toLowerCase() && m.isActive
  );
}

export async function POST(request: NextRequest) {
  return withRateLimit(request, authRateLimiter, async () => {
    try {
      const body = await request.json();
      const { action, ...data } = body;
      const clientIP = getClientIP(request);

      switch (action) {
        // ── Get Login Method (no auth required) ──────────────
        case 'get-login-method': {
          const member = lookupMember(data.email);
          if (!member) {
            return NextResponse.json(
              { success: false, error: 'Email not found.' },
              { status: 404, headers: getSecurityHeaders() }
            );
          }

          const creds = await credentialService.getUserCredentials(data.email);
          return NextResponse.json(
            {
              success: true,
              loginMethod: creds?.loginMethod || 'password',
              loginSetupComplete: creds?.loginSetupComplete === 'true',
            },
            { headers: getSecurityHeaders() }
          );
        }

        // ── Password Login ───────────────────────────────────
        case 'login-passcode':
        case 'login-password': {
          const identifier = `portal-login:${clientIP}:${data.email}`;

          const rateLimitCheck = checkRateLimit(identifier);
          if (!rateLimitCheck.allowed) {
            return NextResponse.json(
              {
                success: false,
                error: `Too many login attempts. Please try again in ${rateLimitCheck.lockoutMinutes} minutes.`,
                remainingAttempts: 0,
              },
              { status: 429, headers: getSecurityHeaders() }
            );
          }

          const member = lookupMember(data.email);
          if (!member) {
            recordLoginAttempt(identifier, false);
            const newCheck = checkRateLimit(identifier);
            return NextResponse.json(
              { success: false, error: 'Email not found.', remainingAttempts: newCheck.remainingAttempts },
              { status: 401, headers: getSecurityHeaders() }
            );
          }

          const password = data.passcode || data.password || '';
          const verified = await credentialService.verifyPassword(data.email, password);

          if (!verified) {
            recordLoginAttempt(identifier, false);
            const newCheck = checkRateLimit(identifier);
            return NextResponse.json(
              { success: false, error: 'Invalid password.', remainingAttempts: newCheck.remainingAttempts },
              { status: 401, headers: getSecurityHeaders() }
            );
          }

          recordLoginAttempt(identifier, true);
          const { user } = await loginSuccess(member, data.staySignedIn);

          // Include loginSetupComplete so client knows whether to show setup
          const creds = await credentialService.getUserCredentials(data.email);

          return NextResponse.json(
            {
              success: true,
              user: { ...user, loginSetupComplete: creds?.loginSetupComplete === 'true' },
            },
            { headers: getSecurityHeaders() }
          );
        }

        // ── PIN Login ────────────────────────────────────────
        case 'login-pin': {
          const identifier = `portal-login:${clientIP}:${data.email}`;

          const rateLimitCheck = checkRateLimit(identifier);
          if (!rateLimitCheck.allowed) {
            return NextResponse.json(
              {
                success: false,
                error: `Too many login attempts. Please try again in ${rateLimitCheck.lockoutMinutes} minutes.`,
                remainingAttempts: 0,
              },
              { status: 429, headers: getSecurityHeaders() }
            );
          }

          const member = lookupMember(data.email);
          if (!member) {
            recordLoginAttempt(identifier, false);
            return NextResponse.json(
              { success: false, error: 'Email not found.' },
              { status: 401, headers: getSecurityHeaders() }
            );
          }

          const pinValid = await credentialService.verifyPin(data.email, data.pin || '');
          if (!pinValid) {
            recordLoginAttempt(identifier, false);
            const newCheck = checkRateLimit(identifier);
            return NextResponse.json(
              { success: false, error: 'Invalid PIN.', remainingAttempts: newCheck.remainingAttempts },
              { status: 401, headers: getSecurityHeaders() }
            );
          }

          recordLoginAttempt(identifier, true);
          const { user } = await loginSuccess(member, data.staySignedIn);

          return NextResponse.json(
            { success: true, user },
            { headers: getSecurityHeaders() }
          );
        }

        // ── Picture Password Login ───────────────────────────
        case 'login-picture': {
          const identifier = `portal-login:${clientIP}:${data.email}`;

          const rateLimitCheck = checkRateLimit(identifier);
          if (!rateLimitCheck.allowed) {
            return NextResponse.json(
              {
                success: false,
                error: `Too many login attempts. Please try again in ${rateLimitCheck.lockoutMinutes} minutes.`,
                remainingAttempts: 0,
              },
              { status: 429, headers: getSecurityHeaders() }
            );
          }

          const member = lookupMember(data.email);
          if (!member) {
            recordLoginAttempt(identifier, false);
            return NextResponse.json(
              { success: false, error: 'Email not found.' },
              { status: 401, headers: getSecurityHeaders() }
            );
          }

          const points: PicturePoint[] = data.points || [];
          const pictureValid = await credentialService.verifyPicturePoints(data.email, points);
          if (!pictureValid) {
            recordLoginAttempt(identifier, false);
            const newCheck = checkRateLimit(identifier);
            return NextResponse.json(
              { success: false, error: 'Incorrect tap points. Try again.', remainingAttempts: newCheck.remainingAttempts },
              { status: 401, headers: getSecurityHeaders() }
            );
          }

          recordLoginAttempt(identifier, true);
          const { user } = await loginSuccess(member, data.staySignedIn);

          return NextResponse.json(
            { success: true, user },
            { headers: getSecurityHeaders() }
          );
        }

        // ── Setup PIN (requires auth) ────────────────────────
        case 'setup-pin': {
          const session = await validateSession();
          if (!session.valid || !session.user) {
            return NextResponse.json(
              { success: false, error: 'Authentication required' },
              { status: 401, headers: getSecurityHeaders() }
            );
          }

          const pin = data.pin || '';
          if (pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin)) {
            return NextResponse.json(
              { success: false, error: 'PIN must be 4-8 digits.' },
              { status: 400, headers: getSecurityHeaders() }
            );
          }

          const ok = await credentialService.setPin(session.user.userId, pin);
          return NextResponse.json(
            { success: ok, error: ok ? undefined : 'Failed to save PIN.' },
            { status: ok ? 200 : 500, headers: getSecurityHeaders() }
          );
        }

        // ── Setup Picture Password (requires auth) ───────────
        case 'setup-picture': {
          const session = await validateSession();
          if (!session.valid || !session.user) {
            return NextResponse.json(
              { success: false, error: 'Authentication required' },
              { status: 401, headers: getSecurityHeaders() }
            );
          }

          const points: PicturePoint[] = data.points || [];
          if (points.length !== 3) {
            return NextResponse.json(
              { success: false, error: 'Exactly 3 points required.' },
              { status: 400, headers: getSecurityHeaders() }
            );
          }

          for (const p of points) {
            if (typeof p.x !== 'number' || typeof p.y !== 'number' ||
                p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100) {
              return NextResponse.json(
                { success: false, error: 'Invalid point coordinates.' },
                { status: 400, headers: getSecurityHeaders() }
              );
            }
          }

          const ok = await credentialService.setPicturePoints(session.user.userId, points);
          return NextResponse.json(
            { success: ok, error: ok ? undefined : 'Failed to save picture password.' },
            { status: ok ? 200 : 500, headers: getSecurityHeaders() }
          );
        }

        // ── Set Login Method (requires auth) ─────────────────
        case 'set-login-method': {
          const session = await validateSession();
          if (!session.valid || !session.user) {
            return NextResponse.json(
              { success: false, error: 'Authentication required' },
              { status: 401, headers: getSecurityHeaders() }
            );
          }

          const method = data.method;
          if (!['password', 'pin', 'picture'].includes(method)) {
            return NextResponse.json(
              { success: false, error: 'Invalid login method.' },
              { status: 400, headers: getSecurityHeaders() }
            );
          }

          // Verify the credential exists before switching to it
          if (method === 'pin' || method === 'picture') {
            const creds = await credentialService.getUserCredentialsById(session.user.userId);
            if (method === 'pin' && !creds?.pinHash) {
              return NextResponse.json(
                { success: false, error: 'Set up a PIN first.' },
                { status: 400, headers: getSecurityHeaders() }
              );
            }
            if (method === 'picture' && !creds?.picturePointsJson) {
              return NextResponse.json(
                { success: false, error: 'Set up a picture password first.' },
                { status: 400, headers: getSecurityHeaders() }
              );
            }
          }

          const ok = await credentialService.setLoginMethod(session.user.userId, method);
          return NextResponse.json(
            { success: ok },
            { status: ok ? 200 : 500, headers: getSecurityHeaders() }
          );
        }

        // ── Complete Login Setup (requires auth) ─────────────
        case 'complete-login-setup': {
          const session = await validateSession();
          if (!session.valid || !session.user) {
            return NextResponse.json(
              { success: false, error: 'Authentication required' },
              { status: 401, headers: getSecurityHeaders() }
            );
          }

          const ok = await credentialService.completeLoginSetup(session.user.userId);
          return NextResponse.json(
            { success: ok },
            { status: ok ? 200 : 500, headers: getSecurityHeaders() }
          );
        }

        // ── Set Stay Signed In (requires auth) ───────────────
        case 'set-stay-signed-in': {
          const session = await validateSession();
          if (!session.valid || !session.user) {
            return NextResponse.json(
              { success: false, error: 'Authentication required' },
              { status: 401, headers: getSecurityHeaders() }
            );
          }

          const ok = await credentialService.setStaySignedIn(session.user.userId, !!data.value);
          return NextResponse.json(
            { success: ok },
            { status: ok ? 200 : 500, headers: getSecurityHeaders() }
          );
        }

        // ── Logout ───────────────────────────────────────────
        case 'logout': {
          await clearAuthCookies();
          return NextResponse.json(
            { success: true },
            { headers: getSecurityHeaders() }
          );
        }

        // ── Validate Session ─────────────────────────────────
        case 'validate': {
          const sessionResult = await validateSession();

          if (!sessionResult.valid) {
            return NextResponse.json(
              { success: false, error: sessionResult.error },
              { status: 401, headers: getSecurityHeaders() }
            );
          }

          return NextResponse.json(
            { success: true, user: sessionResult.user },
            { headers: getSecurityHeaders() }
          );
        }

        // ── Refresh Tokens ───────────────────────────────────
        case 'refresh': {
          const result = await refreshSession();

          if (!result.success) {
            return NextResponse.json(
              { success: false, error: result.error },
              { status: 401, headers: getSecurityHeaders() }
            );
          }

          return NextResponse.json(
            { success: true, user: result.user },
            { headers: getSecurityHeaders() }
          );
        }

        // ── Check Permission ─────────────────────────────────
        case 'check-permission': {
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
