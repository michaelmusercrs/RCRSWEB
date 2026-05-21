/**
 * Password Authentication API
 * POST /api/auth/login  { email: "...", password: "..." }
 * Creates JWT session with HTTP-only cookies
 *
 * On successful login:
 * - Logs to AuditLog Google Sheet tab
 * - Sends email notification to Michael
 */

import { NextRequest, NextResponse } from 'next/server';
import { TEAM_MEMBERS } from '@/lib/team-roles';
import {
  AuthUser,
  generateAccessToken,
  generateRefreshToken,
} from '@/lib/auth-service';
import { checkRequestSize } from '@/lib/request-size-limit';
import { emailService } from '@/lib/email-service';
import { googleSheetsService } from '@/lib/google-sheets-service';

export async function POST(request: NextRequest) {
  // SECURITY: Enforce request body size limit on auth endpoint
  const sizeError = checkRequestSize(request, '10kb');
  if (sizeError) return sizeError;

  try {
    const { email, password } = await request.json();

    let member;

    // Login by email + password (only supported auth method)
    if (email && password) {
      member = TEAM_MEMBERS.find(
        m => m.email?.toLowerCase() === email.toLowerCase() && m.password === password && m.isActive
      );
    }

    if (!member) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user: AuthUser = {
      userId: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      permissions: member.permissions,
    };

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const mustChangePassword = member.mustChangePassword || false;

    const response = NextResponse.json({
      success: true,
      mustChangePassword,
      user: {
        id: member.id,
        name: member.name,
        role: member.role,
        email: member.email,
      },
    });

    // Set HTTP-only cookies
    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });

    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Fire-and-forget: audit log + email notification to Michael
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const now = new Date();
    const timeStr = now.toLocaleString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', hour12: true });
    const dateStr = now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });

    // 1. Log to AuditLog sheet
    logLoginToSheet(member.email, member.name, member.role, ip, now.toISOString()).catch(err =>
      console.error('[Login] AuditLog write failed:', err)
    );

    // 2. Email notification to Michael (skip if Michael himself is logging in)
    if (member.email !== 'michaelmuse@rcrsal.com') {
      emailService.send({
        template: 'login-alert',
        to: 'michaelmuse@rcrsal.com',
        subject: `Portal Login: ${member.name}`,
        body: `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;">
            <div style="background:#000;padding:16px;text-align:center;">
              <h2 style="color:#39FF14;margin:0;">Portal Login Alert</h2>
            </div>
            <div style="padding:20px;background:#fff;">
              <p><strong>${member.name}</strong> logged into the portal.</p>
              <table style="width:100%;border-collapse:collapse;margin:12px 0;">
                <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Role</td><td style="padding:6px;border-bottom:1px solid #eee;">${member.role}</td></tr>
                <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Email</td><td style="padding:6px;border-bottom:1px solid #eee;">${member.email}</td></tr>
                <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Time</td><td style="padding:6px;border-bottom:1px solid #eee;">${timeStr} CST, ${dateStr}</td></tr>
                <tr><td style="padding:6px;font-weight:bold;">IP</td><td style="padding:6px;">${ip}</td></tr>
              </table>
            </div>
          </div>
        `,
        fromName: 'RCRS Portal',
      }).catch(err => console.error('[Login] Email notification failed:', err));
    }

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Login failed' },
      { status: 500 }
    );
  }
}

/** Write login event to AuditLog sheet tab */
async function logLoginToSheet(email: string, name: string, role: string, ip: string, timestamp: string) {
  await googleSheetsService.appendToAuditLog({
    action: 'LOGIN',
    userEmail: email,
    details: `${name} (${role}) logged in`,
    ip,
    userAgent: 'portal-login',
    timestamp,
  });
}
