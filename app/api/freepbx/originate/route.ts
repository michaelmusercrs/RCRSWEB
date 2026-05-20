/**
 * POST /api/freepbx/originate
 *
 * Click-to-call. Tells FreePBX to ring `fromExt` first, then bridge it to
 * `toNumber` once the user picks up their device. Logs the originate
 * intent to the `Phone Call Log` master sheet tab regardless of whether
 * the PBX is configured (so we can audit dead clicks too).
 *
 * Body: { fromExt: string, toNumber: string, customerName?, customerId?, jobNumber?, notes? }
 *
 * Returns 503 only if env is missing AND no fallback should be attempted.
 * Default behavior when env missing: 200 with `source: 'stub'` so the UI
 * gives a clean "not configured" toast instead of an error.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { originateCall, isFreePbxConfigured } from '@/lib/freepbx-service';
import { appendPhoneCallLog } from '@/lib/phone-call-log';

export const dynamic = 'force-dynamic';

interface OriginateBody {
  fromExt?: string;
  toNumber?: string;
  customerName?: string;
  customerId?: string;
  jobNumber?: string;
  notes?: string;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  let body: OriginateBody;
  try {
    body = (await req.json()) as OriginateBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const fromExt = (body.fromExt || '').trim();
  const toNumber = (body.toNumber || '').trim();
  if (!fromExt || !toNumber) {
    return NextResponse.json(
      { ok: false, error: 'fromExt and toNumber are required' },
      { status: 400 },
    );
  }

  const result = await originateCall({
    fromExt,
    toNumber,
    context: {
      customerName: body.customerName,
      customerId: body.customerId,
      jobNumber: body.jobNumber,
      notes: body.notes,
    },
  });

  // Always log the click — even stub originate (so we can show the user
  // their intent fired and audit unconfigured deploys).
  void appendPhoneCallLog({
    timestamp: new Date().toISOString(),
    fromExt,
    fromName: auth.user.name || '',
    toNumber,
    customerName: body.customerName,
    customerId: body.customerId,
    jobNumber: body.jobNumber,
    status: result.ok && result.data ? 'originated' : 'failed',
    callId: result.data?.callId,
    notes: body.notes,
    source: 'click-to-call',
  });

  return NextResponse.json({
    configured: isFreePbxConfigured(),
    ...result,
  });
}
