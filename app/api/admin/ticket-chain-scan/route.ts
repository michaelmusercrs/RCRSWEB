/**
 * Ticket-Chain Self-Check API
 *
 * Runs the read-only reconciliation scan over recent delivery tickets and
 * returns the findings + proposed (never auto-applied) inventory adjustments.
 * Owner/admin only. Also persists a summary row the system-health dashboard
 * reads cheaply.
 *
 * GET /api/admin/ticket-chain-scan?windowDays=14
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAtLeast } from '@/lib/auth-service';
import { scanTicketChain } from '@/lib/ticket-chain-scan';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const auth = await requireRoleAtLeast(['owner', 'admin']);
  if (!auth.authenticated) return auth.response;

  const raw = parseInt(new URL(request.url).searchParams.get('windowDays') || '14', 10);
  const windowDays = Math.min(90, Math.max(1, Number.isFinite(raw) ? raw : 14));

  try {
    const report = await scanTicketChain(windowDays);
    return NextResponse.json(report);
  } catch (e) {
    console.error('[ticket-chain-scan] failed:', e);
    return NextResponse.json({ error: 'Scan failed', detail: String(e) }, { status: 500 });
  }
}
