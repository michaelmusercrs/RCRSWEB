/**
 * Warehouse "Today" API
 *
 * Returns everything Rick needs to see when he opens the warehouse app
 * (mobile dashboard) or when the X88 kiosk loads. One round-trip:
 *   - Greeting + current weather (Decatur AL)
 *   - List of today's tickets (status != completed/cancelled)
 *   - Unique cities + count
 *   - Announcements (Monday meeting notes)
 *   - Quick stats: total cost, total price, weight estimates
 *
 * GET /api/warehouse/today
 *
 * Auth: warehouse role (driver) or admin/owner. Sales reps can't see cost
 * data, so we use filterCostByRole at the response boundary.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { ticketSheetService } from '@/lib/ticket-sheet-service';
import { weatherService } from '@/lib/weather-service';
import { filterCostByRole } from '@/lib/cost-visibility';

export const dynamic = 'force-dynamic';
// Belt-and-suspenders with the instrumentation.ts googleapis patch: the
// sheets client passes cache:'default', which a GET handler would otherwise
// happily serve from the per-deployment Data Cache — freezing the board.
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

const ACTIVE_STATUSES = new Set([
  'created',
  'assigned',
  'materials_pulled',
  'load_verified',
  'en_route',
  'arrived',
]);

function greetingForHour(h: number): string {
  if (h < 5) return 'Late shift';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Late shift';
}

export async function GET(request: NextRequest) {
  // X88 kiosk path: the warehouse wall display runs chromium --kiosk with no
  // login session. It authenticates with ?key=<WAREHOUSE_DISPLAY_KEY>
  // (env-gated; anonymous access stays impossible until the env var is set).
  // The payload is operational status only — no cost data.
  const displayKey = process.env.WAREHOUSE_DISPLAY_KEY;
  const providedKey =
    new URL(request.url).searchParams.get('key') ||
    request.headers.get('x-display-key');
  const kioskAuthorized = Boolean(displayKey && providedKey && providedKey === displayKey);

  // Kiosk requests have no role → filterCostByRole strips all cost fields.
  let viewerRole: string | undefined;
  if (!kioskAuthorized) {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    // Allowed roles: driver (Rick/Tae), admin, owner, manager, office
    const allowed = new Set(['driver', 'admin', 'owner', 'manager', 'office']);
    if (!allowed.has(auth.user.role)) {
      return NextResponse.json({ error: 'Warehouse access required' }, { status: 403 });
    }
    viewerRole = auth.user.role;
  }

  // Pull active tickets and weather in parallel
  const [allTickets, weather] = await Promise.all([
    ticketSheetService.getAll().catch(() => []),
    weatherService.getWeather('Decatur, AL').catch(() => null),
  ]);

  // Filter to active (not completed) tickets, deliveries only
  const activeTickets = allTickets.filter(t =>
    t.ticketType === 'delivery' && ACTIVE_STATUSES.has(t.status)
  );

  // Group by city for the display
  const cityCounts = new Map<string, number>();
  for (const t of activeTickets) {
    const city = (t.city || 'Unknown').trim() || 'Unknown';
    cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
  }
  const cities = Array.from(cityCounts.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count);

  // Aggregate stats
  let totalPrice = 0;
  let totalCost = 0;
  for (const t of activeTickets) {
    totalPrice += t.totalPrice || 0;
    totalCost += t.totalCost || 0;
  }

  const now = new Date();
  const hour = now.getHours();

  const payload = {
    greeting: greetingForHour(hour),
    timestamp: now.toISOString(),
    weather: weather
      ? {
          temp: weather.current?.temp ?? null,
          condition: weather.current?.condition ?? '',
          high: weather.forecast?.[0]?.high ?? null,
          low: weather.forecast?.[0]?.low ?? null,
          icon: weather.current?.icon ?? '',
          isWorkable: weather.current?.isWorkable ?? null,
        }
      : null,
    counts: {
      total: activeTickets.length,
      created: activeTickets.filter(t => t.status === 'created').length,
      assigned: activeTickets.filter(t => t.status === 'assigned').length,
      materials_pulled: activeTickets.filter(t => t.status === 'materials_pulled').length,
      en_route: activeTickets.filter(t => t.status === 'en_route').length,
      arrived: activeTickets.filter(t => t.status === 'arrived').length,
    },
    cities,
    totals: {
      totalPrice: Math.round(totalPrice * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
    },
    tickets: activeTickets.map(t => ({
      ticketId: t.ticketId,
      jobNumber: t.referenceNumber,
      jobName: t.jobName,
      customerName: t.customerName,
      address: [t.jobAddress, t.city, t.state].filter(Boolean).join(', '),
      city: t.city,
      status: t.status,
      itemCount: (t.materials || []).length,
      totalPieces: (t.materials || []).reduce((sum, m) => sum + (m.quantity || 0), 0),
      // Driver-safe line items for the pull checklist — name + qty only, NO
      // cost/price (those are stripped by filterCostByRole anyway, but we
      // never even include them here).
      materials: (t.materials || []).map(m => ({
        productName: m.productName,
        quantity: m.quantity,
        unit: (m as { unit?: string }).unit || '',
      })),
      totalCost: t.totalCost,
      totalPrice: t.totalPrice,
      notes: t.notes,
      // Pass the stock-vs-vendor distinction through so Rick's mobile
      // dashboard can badge each card. Default to 'stock' on legacy rows.
      orderSource: t.orderSource || 'stock',
      supplierName: t.supplierName,
      // Direct link to JN job — opens in a new tab from the UI
      jobnimbusUrl: t.referenceNumber
        ? `https://app.jobnimbus.com/job/${encodeURIComponent(t.referenceNumber)}`
        : null,
    })),
  };

  return NextResponse.json(filterCostByRole(payload, viewerRole));
}
