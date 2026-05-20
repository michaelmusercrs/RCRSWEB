/**
 * GET /api/freepbx/numbers
 *
 * Returns the list of RCRS VoIP DIDs (provider-managed, owner-configured
 * via FREEPBX_VOIP_NUMBERS env JSON).
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { listVoipNumbers, isFreePbxConfigured } from '@/lib/freepbx-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const result = listVoipNumbers();
  return NextResponse.json({
    configured: isFreePbxConfigured(),
    ...result,
  });
}
