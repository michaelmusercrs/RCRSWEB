/**
 * PIN Authentication API - DEPRECATED
 * PIN login has been removed. All users now login via email + password.
 * This endpoint returns 410 Gone for any PIN auth attempts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRequestSize } from '@/lib/request-size-limit';

export async function POST(request: NextRequest) {
  const sizeError = checkRequestSize(request, '10kb');
  if (sizeError) return sizeError;

  return NextResponse.json(
    { success: false, error: 'PIN login has been removed. Please use email and password at /portal.' },
    { status: 410 }
  );
}
