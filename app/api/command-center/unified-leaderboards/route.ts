/**
 * Unified Leaderboards API
 * ----------------------------------------------------------------------------
 * Returns the data shape consumed by <UnifiedLeaderboards />.
 * Thin wrapper around `lib/leaderboard-data#fetchUnifiedLeaderboards`.
 *
 * Auth: gated to authenticated team members. Commission $ values are
 * sensitive (per `feedback_purchase_price_visibility` memory) — the
 * widget is rendered on admin-only pages today so this minimum bar
 * is sufficient. Tighten to owner/admin/office/manager if reused on
 * a broader surface.
 */

import { NextResponse } from 'next/server';
import { fetchUnifiedLeaderboards } from '@/lib/leaderboard-data';
import { requireAuth } from '@/lib/auth-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const timestamp = new Date().toISOString();

  try {
    const data = await fetchUnifiedLeaderboards();
    return NextResponse.json(
      { success: true, data, timestamp },
      { headers: { 'Cache-Control': 'private, max-age=30' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[unified-leaderboards] failure:', message);
    return NextResponse.json(
      { success: false, error: message, timestamp },
      { status: 500 },
    );
  }
}
