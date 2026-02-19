/**
 * Response Times API
 * GET: Fetch response time data for the dashboard
 * 
 * Admin/Owner: sees all reps
 * Sales reps: sees only their own data (if visibility enabled)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { queryResponseTimes, type ResponseTimesResult } from '@/lib/jn-response-times';
import { hasAdminAccess } from '@/lib/team-roles';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '365');
  const isAdmin = hasAdminAccess(auth.user.role as any);

  try {
    let result: ResponseTimesResult;

    if (isAdmin) {
      // Admin sees all reps
      result = await queryResponseTimes({ days });
    } else {
      // Non-admin: only their own data
      result = await queryResponseTimes({ days, rep: auth.user.name });
    }

    return NextResponse.json({
      success: true,
      data: result,
      isAdmin,
    });
  } catch (error) {
    console.error('[ResponseTimes API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
