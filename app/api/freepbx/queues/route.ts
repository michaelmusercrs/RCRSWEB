/**
 * GET /api/freepbx/queues
 *
 * Live queue dashboard — members, waiting calls, avg wait, abandon rate.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { listQueues, isFreePbxConfigured } from '@/lib/freepbx-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const result = await listQueues();
  return NextResponse.json({
    configured: isFreePbxConfigured(),
    ...result,
  });
}
