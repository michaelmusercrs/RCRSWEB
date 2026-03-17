/**
 * Simple PIN Authentication API
 * POST /api/auth/pin  { pin: "1135" }
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
    const { pin } = await request.json();

    if (!pin) {
      return NextResponse.json(
        { success: false, error: 'PIN is required' },
        { status: 400 }
      );
    }

    const member = TEAM_MEMBERS.find(m => m.pin === pin);

    if (!member) {
      return NextResponse.json(
        { success: false, error: 'Invalid PIN' },
        { status: 401 }
      );
    }

    // Create AuthUser and generate JWT tokens
    const user: AuthUser = {
      userId: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      permissions: member.permissions,
    };

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set HTTP-only cookies on the response
    const response = NextResponse.json({
      success: true,
      user: {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        permissions: member.permissions,
      },
      accessToken,
      refreshToken,
    });

    const isProduction = process.env.NODE_ENV === 'production';
    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 60 * 60 * 8,
      path: '/',
    });
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('PIN auth error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
