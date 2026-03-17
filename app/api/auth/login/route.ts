/**
 * Password Authentication API
 * POST /api/auth/login  { email: "...", password: "..." }
 * Creates JWT session with HTTP-only cookies
 */

import { NextRequest, NextResponse } from 'next/server';
import { TEAM_MEMBERS } from '@/lib/team-roles';
import {
  AuthUser,
  generateAccessToken,
  generateRefreshToken,
} from '@/lib/auth-service';
import { checkRequestSize } from '@/lib/request-size-limit';

export async function POST(request: NextRequest) {
  // SECURITY: Enforce request body size limit on auth endpoint
  const sizeError = checkRequestSize(request, '10kb');
  if (sizeError) return sizeError;

  try {
    const { email, password, pin } = await request.json();

    let member;

    // Support login by PIN (for drivers/field)
    if (pin) {
      member = TEAM_MEMBERS.find(m => m.pin === pin && m.isActive);
    }
    // Support login by email + password
    else if (email && password) {
      member = TEAM_MEMBERS.find(
        m => m.email?.toLowerCase() === email.toLowerCase() && m.password === password && m.isActive
      );
    }
    // Support login by name + password (convenience)
    else if (password && !email) {
      // Try matching password alone (for quick owner login)
      member = TEAM_MEMBERS.find(m => m.password === password && m.isActive);
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

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Login failed' },
      { status: 500 }
    );
  }
}
