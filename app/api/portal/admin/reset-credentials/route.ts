/**
 * Admin Credential Reset API
 *
 * Allows authorized users to reset passwords and login methods
 * for team members below them in the hierarchy.
 *
 * Hierarchy: owner > admin > manager > office (each resets levels below)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  validateSession,
  getSecurityHeaders,
  getClientIP,
} from '@/lib/auth-service';
import { TEAM_MEMBERS, canResetCredentials, TeamRole } from '@/lib/team-roles';
import { credentialService } from '@/lib/credential-service';
import { logConfigChange } from '@/lib/audit-sheet-logger';

export async function POST(request: NextRequest) {
  try {
    // Require authenticated session
    const session = await validateSession();
    if (!session.valid || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401, headers: getSecurityHeaders() }
      );
    }

    const body = await request.json();
    const { targetUserId, resetType, sendEmail } = body;

    if (!targetUserId || !['password', 'login-method', 'both'].includes(resetType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request. Provide targetUserId and resetType.' },
        { status: 400, headers: getSecurityHeaders() }
      );
    }

    // Find target user
    const targetMember = TEAM_MEMBERS.find(m => m.id === targetUserId);
    if (!targetMember) {
      return NextResponse.json(
        { success: false, error: 'Target user not found.' },
        { status: 404, headers: getSecurityHeaders() }
      );
    }

    // Check hierarchy — actor must have authority over target
    const actorRole = session.user.role as TeamRole;
    const targetRole = targetMember.role;

    if (!canResetCredentials(actorRole, targetRole)) {
      return NextResponse.json(
        { success: false, error: `You do not have permission to reset credentials for ${targetMember.name}.` },
        { status: 403, headers: getSecurityHeaders() }
      );
    }

    // Perform the reset
    const ok = await credentialService.resetCredentials(targetUserId, resetType, session.user.email);

    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to reset credentials. Try again.' },
        { status: 500, headers: getSecurityHeaders() }
      );
    }

    // Write audit log
    const resetDescription = resetType === 'both'
      ? 'password and login method'
      : resetType === 'password'
        ? 'password'
        : 'login method';

    try {
      await logConfigChange({
        action: 'credential_reset',
        section: 'user_credentials',
        changedBy: session.user.email,
        changedByName: session.user.name,
        before: JSON.stringify({ targetUser: targetMember.name, role: targetRole }),
        after: JSON.stringify({ resetType, sendEmail: !!sendEmail }),
        details: `${session.user.name} reset ${resetDescription} for ${targetMember.name} (${targetRole})`,
        ipAddress: getClientIP(request),
      });
    } catch {
      // Audit logging failure should not block the reset
    }

    // Send email notification if requested
    if (sendEmail && targetMember.email) {
      try {
        // Use existing email service pattern — non-blocking
        fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/notifications/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: targetMember.email,
            subject: 'Your RCRS Portal Login Has Been Reset',
            html: `
              <p>Hi ${targetMember.name.split(' ')[0]},</p>
              <p>Your ${resetDescription} has been reset by an administrator.</p>
              ${resetType !== 'login-method' ? '<p>Your temporary password is: <strong>ChangeMe123!</strong></p>' : ''}
              <p>Please log in at <a href="https://rcrsal.com">rcrsal.com</a> to set up your new credentials.</p>
              <p>- River City Roofing Solutions</p>
            `,
          }),
        }).catch(() => {});
      } catch {
        // Email failure should not block the reset
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `${resetDescription} reset for ${targetMember.name}. ${sendEmail ? 'Email notification sent.' : ''}`,
      },
      { headers: getSecurityHeaders() }
    );
  } catch (error) {
    console.error('Admin reset-credentials error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500, headers: getSecurityHeaders() }
    );
  }
}
