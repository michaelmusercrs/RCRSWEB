/**
 * GET /api/freepbx/extensions
 *
 * Returns live FreePBX extension list with registration + per-extension
 * call counts. Falls back to an empty array (and a `source: stub` flag)
 * when env vars aren't set, so the UI keeps working pre-configuration.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { listExtensions, isFreePbxConfigured } from '@/lib/freepbx-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const result = await listExtensions();
  return NextResponse.json({
    configured: isFreePbxConfigured(),
    ...result,
  });
}
