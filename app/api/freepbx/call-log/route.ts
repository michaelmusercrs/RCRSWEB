/**
 * GET /api/freepbx/call-log?ext=&since=&limit=
 *
 * CDR pulled from FreePBX. Read-only — for write/append use the
 * separate `/api/freepbx/originate` route.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { getCallLog, isFreePbxConfigured } from '@/lib/freepbx-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const { searchParams } = new URL(req.url);
  const ext = searchParams.get('ext') || undefined;
  const since = searchParams.get('since') || undefined;
  const limit = Number(searchParams.get('limit') || '50');

  const result = await getCallLog({ ext, since, limit });
  return NextResponse.json({
    configured: isFreePbxConfigured(),
    ...result,
  });
}
