/**
 * Admin Impersonation API
 *
 * Allows owner/admin users to impersonate any team member to view the portal
 * from their perspective. Uses a separate `impersonating` cookie so the
 * admin's real session (JWT) is fully preserved.
 *
 * POST   - Start impersonating (sets cookie)
 * DELETE - Stop impersonating (clears cookie)
 * GET    - Check current impersonation status
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  validateSession,
  getSecurityHeaders,
  getClientIP,
} from '@/lib/auth-service';
import { TEAM_MEMBERS } from '@/lib/team-roles';
import { googleSheetsService } from '@/lib/google-sheets-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const IMPERSONATE_COOKIE = 'impersonating';

/**
 * POST - Start impersonating a target user
 */
export async function POST(request: NextRequest) {
  try {
    const session = await validateSession();
    if (!session.valid || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401, headers: getSecurityHeaders() }
      );
    }

    // Only owner and admin can impersonate
    const callerRole = session.user.role;
    if (callerRole !== 'owner' && callerRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Only owners and admins can impersonate users.' },
        { status: 403, headers: getSecurityHeaders() }
      );
    }

    const body = await request.json();
    const { targetEmail } = body;

    if (!targetEmail || typeof targetEmail !== 'string') {
      return NextResponse.json(
        { success: false, error: 'targetEmail is required.' },
        { status: 400, headers: getSecurityHeaders() }
      );
    }

    // Find the target team member
    const targetMember = TEAM_MEMBERS.find(
      (m) => m.email.toLowerCase() === targetEmail.toLowerCase()
    );

    if (!targetMember) {
      return NextResponse.json(
        { success: false, error: 'Target user not found in team roster.' },
        { status: 404, headers: getSecurityHeaders() }
      );
    }

    // Prevent impersonating yourself
    if (session.user.email.toLowerCase() === targetEmail.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'You cannot impersonate yourself.' },
        { status: 400, headers: getSecurityHeaders() }
      );
    }

    // Log to AuditLog
    const ip = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';
    try {
      await googleSheetsService.appendToAuditLog({
        action: 'IMPERSONATE_START',
        userEmail: session.user.email,
        details: `${session.user.name} (${callerRole}) started impersonating ${targetMember.name} (${targetMember.email}, ${targetMember.role})`,
        ip,
        userAgent,
      });
    } catch {
      // Audit log failure should not block impersonation
    }

    // Set the impersonating cookie
    const response = NextResponse.json(
      {
        success: true,
        impersonating: {
          email: targetMember.email,
          name: targetMember.name,
          role: targetMember.role,
          userId: targetMember.id,
        },
      },
      { status: 200, headers: getSecurityHeaders() }
    );

    response.cookies.set(IMPERSONATE_COOKIE, targetMember.email, {
      httpOnly: false, // Client-side needs to read this for the banner
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 4, // 4 hours max impersonation
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Impersonate POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: getSecurityHeaders() }
    );
  }
}

/**
 * DELETE - Stop impersonating
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await validateSession();
    if (!session.valid || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401, headers: getSecurityHeaders() }
      );
    }

    const impersonatingEmail = request.cookies.get(IMPERSONATE_COOKIE)?.value;

    // Log to AuditLog
    if (impersonatingEmail) {
      const ip = getClientIP(request);
      const userAgent = request.headers.get('user-agent') || '';
      try {
        await googleSheetsService.appendToAuditLog({
          action: 'IMPERSONATE_STOP',
          userEmail: session.user.email,
          details: `${session.user.name} stopped impersonating ${impersonatingEmail}`,
          ip,
          userAgent,
        });
      } catch {
        // Audit log failure should not block
      }
    }

    // Clear the impersonating cookie
    const response = NextResponse.json(
      { success: true, message: 'Impersonation ended.' },
      { status: 200, headers: getSecurityHeaders() }
    );

    response.cookies.set(IMPERSONATE_COOKIE, '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Impersonate DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: getSecurityHeaders() }
    );
  }
}

/**
 * GET - Check current impersonation status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await validateSession();
    if (!session.valid || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401, headers: getSecurityHeaders() }
      );
    }

    const impersonatingEmail = request.cookies.get(IMPERSONATE_COOKIE)?.value;

    if (!impersonatingEmail) {
      return NextResponse.json(
        { success: true, impersonating: null },
        { status: 200, headers: getSecurityHeaders() }
      );
    }

    const targetMember = TEAM_MEMBERS.find(
      (m) => m.email.toLowerCase() === impersonatingEmail.toLowerCase()
    );

    if (!targetMember) {
      // Cookie references someone no longer in the team — clear it
      const response = NextResponse.json(
        { success: true, impersonating: null },
        { status: 200, headers: getSecurityHeaders() }
      );
      response.cookies.set(IMPERSONATE_COOKIE, '', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/',
      });
      return response;
    }

    return NextResponse.json(
      {
        success: true,
        impersonating: {
          email: targetMember.email,
          name: targetMember.name,
          role: targetMember.role,
          userId: targetMember.id,
        },
        impersonatedBy: {
          email: session.user.email,
          name: session.user.name,
          role: session.user.role,
        },
      },
      { status: 200, headers: getSecurityHeaders() }
    );
  } catch (error) {
    console.error('Impersonate GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: getSecurityHeaders() }
    );
  }
}
