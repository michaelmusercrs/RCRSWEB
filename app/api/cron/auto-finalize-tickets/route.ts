/**
 * Auto-Finalize Tickets — daily safety net
 *
 * Finalizes any delivery ticket stuck in 'created' for >48h: writes the
 * invoice + breakdown, deducts Inventory_Products, and flips the ticket to
 * load_verified. This is what prevents a repeat of the weeks-long silent
 * lapse where orders shipped but were never tracked or invoiced.
 *
 * The warehouse verify-load button still works for same-day confirmation;
 * this only catches what nobody finalized within 48h.
 *
 * GET /api/cron/auto-finalize-tickets            → run for real
 * GET /api/cron/auto-finalize-tickets?dryRun=1   → list what WOULD finalize
 * Auth: CRON_SECRET bearer (Vercel) or admin/owner session (manual run).
 * Schedule (vercel.json): "0 13 * * *"  (7am CT = 13 UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronLock } from '@/lib/cron-lock';
import { autoFinalizeStuckTickets } from '@/lib/auto-finalize-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  // Auth: Vercel cron secret, or an admin/owner/manager session for manual runs.
  const authHeader = request.headers.get('authorization') || '';
  const isVercelCron = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (!isVercelCron) {
    const { requireAuth } = await import('@/lib/auth-service');
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    if (!['admin', 'owner', 'manager'].includes(auth.user.role)) {
      return NextResponse.json(
        { error: 'CRON_SECRET header or admin/owner/manager role required' },
        { status: 403 },
      );
    }
  }

  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1';

  // dryRun is read-only — no lock needed. Real runs take the lock so two
  // overlapping invocations can't double-process.
  if (dryRun) {
    const summary = await autoFinalizeStuckTickets({ dryRun: true });
    return NextResponse.json({ success: true, ...summary });
  }

  return withCronLock('auto-finalize-tickets', { staleMinutes: 15 }, async () => {
    const summary = await autoFinalizeStuckTickets({ dryRun: false });
    return NextResponse.json({ success: true, ...summary });
  });
}
