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

// The warehouse runs on Chicago time; the server runs UTC. Every "today"
// comparison uses the Chicago calendar date (en-CA = ISO YYYY-MM-DD format),
// and the greeting uses the Chicago hour — new Date().getHours() on Vercel
// is UTC and used to greet Rick "Good afternoon" at 7am.
const CHICAGO_TZ = 'America/Chicago';
function chicagoToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CHICAGO_TZ }).format(new Date());
}
function chicagoHour(): number {
  const h = new Intl.DateTimeFormat('en-US', {
    timeZone: CHICAGO_TZ, hour: '2-digit', hour12: false,
  }).format(new Date());
  return parseInt(h, 10) % 24;
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

  // Pull active tickets and weather in parallel. Weather is best-effort.
  // Tickets go through the cached reader, which serves a last-known-good
  // snapshot (flagged stale) if the live Sheets read fails — so a rate-limit
  // blip shows the previous board, never a false-empty one.
  const weatherPromise = weatherService.getWeather('Decatur, AL').catch(() => null);

  let ticketsResult: { tickets: Awaited<ReturnType<typeof ticketSheetService.getAll>>; stale: boolean };
  try {
    ticketsResult = await ticketSheetService.getAllCached();
  } catch (err) {
    // No cached snapshot to fall back to (cold instance + Sheets unavailable).
    // Return an explicit degraded state so the UI shows "reconnecting", NOT an
    // empty board that reads as "no deliveries today".
    console.error('[warehouse/today] ticket read failed with no cached fallback:', err);
    return NextResponse.json(
      {
        degraded: true,
        error: 'schedule_unavailable',
        message: 'Live schedule is briefly unavailable (Google rate limit). It will refresh automatically.',
        greeting: greetingForHour(chicagoHour()),
        timestamp: new Date().toISOString(),
        weather: await weatherPromise,
        counts: { total: 0, created: 0, assigned: 0, materials_pulled: 0, en_route: 0, arrived: 0, overdue: 0, today: 0, upcoming: 0 },
        cities: [],
        totals: { totalPrice: 0, totalCost: 0 },
        tickets: [],
        sections: { overdue: [], today: [], upcoming: [] },
      },
      { status: 503 },
    );
  }
  const allTickets = ticketsResult.tickets;
  const weather = await weatherPromise;

  // Filter to active (not completed) tickets, deliveries only
  const activeTickets = allTickets.filter(t =>
    t.ticketType === 'delivery' && ACTIVE_STATUSES.has(t.status)
  );

  // ── Date-aware buckets (Chicago calendar day) ──────────────────────────
  //   overdue  — scheduled before today and still not delivered
  //   today    — scheduled today, OR undated (a legacy/unmigrated ticket
  //              must fail VISIBLE on today's board, never hide)
  //   upcoming — scheduled after today (collapsed in the UIs)
  const todayYmd = chicagoToday();
  const overdueTickets = activeTickets.filter(
    t => t.scheduledDate && t.scheduledDate < todayYmd,
  );
  const todayTickets = activeTickets.filter(
    t => !t.scheduledDate || t.scheduledDate === todayYmd,
  );
  const upcomingTickets = activeTickets
    .filter(t => !!t.scheduledDate && t.scheduledDate > todayYmd)
    .sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || ''));

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

  // Shared per-ticket shape for both the flat list and the sections.
  const mapTicket = (t: (typeof activeTickets)[number]) => ({
    ticketId: t.ticketId,
    jobNumber: t.referenceNumber,
    jobName: t.jobName,
    customerName: t.customerName,
    address: [t.jobAddress, t.city, t.state].filter(Boolean).join(', '),
    city: t.city,
    status: t.status,
    // Delivery-date awareness. `overdue` is computed on READ against the
    // Chicago calendar day — never stored — so it can't go stale.
    scheduledDate: t.scheduledDate || null,
    scheduleSource: t.scheduleSource || null,
    overdue: Boolean(t.scheduledDate && t.scheduledDate < todayYmd),
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
  });

  const payload = {
    greeting: greetingForHour(chicagoHour()),
    timestamp: now.toISOString(),
    // True when the live Sheets read failed and we served the previous
    // snapshot. The board stays populated; the UI can show a subtle indicator.
    stale: ticketsResult.stale,
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
      overdue: overdueTickets.length,
      today: todayTickets.length,
      upcoming: upcomingTickets.length,
    },
    cities,
    totals: {
      totalPrice: Math.round(totalPrice * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
    },
    // Backward-compat flat list: what needs attention NOW (overdue first,
    // then today's). Upcoming tickets are NOT in this list — an old client
    // build simply won't show them until their day comes.
    tickets: [...overdueTickets, ...todayTickets].map(mapTicket),
    // Date-aware sections for the updated dashboard + kiosk.
    sections: {
      overdue: overdueTickets.map(mapTicket),
      today: todayTickets.map(mapTicket),
      upcoming: upcomingTickets.map(mapTicket),
    },
  };

  return NextResponse.json(filterCostByRole(payload, viewerRole));
}
