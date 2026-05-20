/**
 * GET /api/freepbx/recordings?ext=&since=&limit=
 *
 * Stored call recordings. Filename → URL is built using
 * FREEPBX_RECORDINGS_BASE so we don't expose the PBX file system path.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { listRecordings, isFreePbxConfigured } from '@/lib/freepbx-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const { searchParams } = new URL(req.url);
  const ext = searchParams.get('ext') || undefined;
  const since = searchParams.get('since') || undefined;
  const limit = Number(searchParams.get('limit') || '50');

  const result = await listRecordings({ ext, since, limit });
  return NextResponse.json({
    configured: isFreePbxConfigured(),
    ...result,
  });
}
