/**
 * Customer Bitcoin Payment API
 *
 * GET /api/customer/bitcoin-payment?token=...&invoiceId=...&amountUsd=...
 *   Returns a fresh BIP21 quote (locked for 15 minutes against price moves).
 *
 * GET /api/customer/bitcoin-payment?token=...&invoiceId=...&check=1&expectedBtc=...&since=...
 *   Polls mempool.space to check whether a tx with the expected amount has
 *   landed. The customer-portal page polls this every ~20 seconds while a
 *   payment is in flight.
 *
 * Auth: customer portal token (validated via customerPortalService — same
 * mechanism used by /api/customer/[token]). No JWT/session required because
 * the customer is unauthenticated by definition.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createBitcoinPaymentRequest,
  checkBitcoinPaymentStatus,
  isBitcoinConfigured,
} from '@/lib/bitcoin-service';
import { leadPortalService } from '@/lib/lead-portal-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') || '';
  const invoiceId = searchParams.get('invoiceId') || '';
  const isCheck = searchParams.get('check') === '1';

  if (!token || !invoiceId) {
    return NextResponse.json(
      { success: false, error: 'token and invoiceId are required' },
      { status: 400 }
    );
  }

  if (!isBitcoinConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: 'Bitcoin payments are not enabled (BTC_ADDRESS env var not set)',
      },
      { status: 503 }
    );
  }

  // Validate the customer token via the same service the main /api/customer/[token]
  // endpoint uses. We don't need the lead record itself, just proof that the
  // token resolves to a real, non-expired customer.
  try {
    const lead = await leadPortalService.getLeadByToken(token);
    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }
  } catch (err) {
    console.error('[bitcoin-payment] token validation failed:', err);
    return NextResponse.json(
      { success: false, error: 'Token validation failed' },
      { status: 500 }
    );
  }

  // ── Status check path ────────────────────────────────────────────────
  if (isCheck) {
    const expectedBtc = parseFloat(searchParams.get('expectedBtc') || '0');
    const since = parseInt(searchParams.get('since') || '0', 10);
    if (!(expectedBtc > 0)) {
      return NextResponse.json(
        { success: false, error: 'expectedBtc must be a positive number' },
        { status: 400 }
      );
    }
    const status = await checkBitcoinPaymentStatus(expectedBtc, Number.isFinite(since) && since > 0 ? since : undefined);
    return NextResponse.json({ success: true, status });
  }

  // ── Quote generation path ────────────────────────────────────────────
  const amountUsd = parseFloat(searchParams.get('amountUsd') || '0');
  if (!(amountUsd > 0)) {
    return NextResponse.json(
      { success: false, error: 'amountUsd must be a positive number' },
      { status: 400 }
    );
  }

  try {
    const customerLabel = searchParams.get('customerLabel') || undefined;
    const quote = await createBitcoinPaymentRequest(invoiceId, amountUsd, customerLabel);
    return NextResponse.json({ success: true, quote });
  } catch (err) {
    console.error('[bitcoin-payment] quote generation failed:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Quote generation failed' },
      { status: 500 }
    );
  }
}
