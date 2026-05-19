/**
 * Predictive Stock Forecast API
 *
 * Returns the 14-day material consumption forecast on demand for the
 * `/portal/inventory/forecast` page.
 *
 * GET /api/portal/inventory/forecast
 *   Optional: ?days=N (override horizon, capped to 30) and ?storm=1 to
 *   force-apply the storm buffer (admin testing only).
 *
 * Auth: any authenticated portal user (office/admin/owner/pm/warehouse).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { predictiveStockService } from '@/lib/predictive-stock-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const ALLOWED_ROLES = ['admin', 'owner', 'office', 'pm', 'manager', 'warehouse', 'driver'];

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!ALLOWED_ROLES.includes(auth.user.role)) {
    return NextResponse.json({ error: 'Forecast not available for your role' }, { status: 403 });
  }

  const url = new URL(request.url);
  const daysRaw = url.searchParams.get('days');
  let horizonDays: number | undefined;
  if (daysRaw) {
    const n = Number(daysRaw);
    if (Number.isFinite(n) && n > 0) horizonDays = Math.min(n, 30);
  }

  const stormParam = url.searchParams.get('storm');
  const forceStormBuffer = stormParam === '1' || stormParam === 'true' ? true : undefined;
  // Only admins may force the buffer on/off
  const forceArg = (forceStormBuffer !== undefined && ['admin', 'owner'].includes(auth.user.role))
    ? forceStormBuffer
    : undefined;

  try {
    const forecast = await predictiveStockService.generateForecast({
      horizonDays,
      forceStormBuffer: forceArg,
    });
    return NextResponse.json({ success: true, forecast });
  } catch (err) {
    console.error('[inventory/forecast] failed:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Forecast failed' },
      { status: 500 },
    );
  }
}
