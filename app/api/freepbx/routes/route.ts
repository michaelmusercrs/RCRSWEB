/**
 * GET /api/freepbx/routes
 *
 * Inbound call routing config — DID → destination, time conditions,
 * after-hours fallback.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { listCallRoutes, isFreePbxConfigured } from '@/lib/freepbx-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const result = await listCallRoutes();
  return NextResponse.json({
    configured: isFreePbxConfigured(),
    ...result,
  });
}
