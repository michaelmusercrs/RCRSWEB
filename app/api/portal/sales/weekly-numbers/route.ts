/**
 * RCRS Sales Weekly Numbers Submission API
 *
 * Thin wrapper over meetingNumbersService.submitNumbers() for the sales rep
 * "Weekly Numbers" form. Writes to the Monday meeting Google Sheet and refreshes
 * the local JSON cache.
 *
 * POST /api/portal/sales/weekly-numbers
 *   Body: {
 *     weekOf: 'YYYY-MM-DD'   // Monday date
 *     repName?: string        // ADMIN/OWNER/MANAGER only: override for which rep
 *     inspected, damage, signed, repair, gutter, revenue,
 *     approved, goal, referrals, agents, present, homeShow, notes
 *   }
 *
 * GET /api/portal/sales/weekly-numbers?rep=<name>&limit=<n>
 *   Returns the last N records for a rep (default: 4) so the form can show a
 *   "Your last 4 weeks" trend table. Non-admins always see their own data.
 *
 * Notes:
 * - submitNumbers() is the existing service method; we pass it the metric dict
 *   shape it expects (Partial<Record<MeetingMetric|'present', number|string>>).
 * - The free-form "notes" text is NOT written to the meeting sheet (there is
 *   no notes column) — it's returned in the response only for display.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { meetingNumbersService, type MeetingRecord } from '@/lib/meeting-numbers-service';

type MetricPayload = {
  inspected?: number;
  damage?: number;
  signed?: number;
  repair?: number;
  gutter?: number;
  revenue?: number;
  approved?: number;
  goal?: number;
  referrals?: number;
  agents?: number;
  homeShow?: number;
  present?: string;
};

/**
 * Return the Monday (YYYY-MM-DD) of the week containing the given date.
 * Accepts JS Date or an ISO date string.
 */
function mondayOf(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : new Date(date);
  const day = d.getDay(); // 0 = Sun, 1 = Mon
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isAdminLike(role: string): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager';
}

function toNum(v: unknown): number {
  if (v === undefined || v === null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// ─── POST ──────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  // Who are we submitting for?
  const requestedRep = typeof body.repName === 'string' ? body.repName.trim() : '';
  const actingUserName = auth.user.name;
  const repName =
    requestedRep && isAdminLike(auth.user.role) ? requestedRep : actingUserName;

  // Normalize the meeting date to the Monday of that week
  const rawWeek = typeof body.weekOf === 'string' && body.weekOf
    ? body.weekOf
    : new Date().toISOString().slice(0, 10);
  const meetingDate = mondayOf(rawWeek);

  // Build the metric dict submitNumbers() expects
  const metrics: MetricPayload = {
    inspected: toNum(body.inspected),
    damage: toNum(body.damage),
    signed: toNum(body.signed),
    repair: toNum(body.repair),
    gutter: toNum(body.gutter),
    revenue: toNum(body.revenue),
    approved: toNum(body.approved),
    goal: toNum(body.goal),
    referrals: toNum(body.referrals),
    agents: toNum(body.agents),
    homeShow: toNum(body.homeShow),
    present: typeof body.present === 'string' && body.present ? body.present : '1',
  };

  const result = await meetingNumbersService.submitNumbers(repName, meetingDate, metrics);

  if (!result.success) {
    console.error('[sales/weekly-numbers] submitNumbers failed:', result.error);
    return NextResponse.json(
      {
        success: false,
        error: result.error || 'Failed to save weekly numbers',
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    message: `Numbers saved for ${repName} (week of ${meetingDate})`,
    record: {
      repName,
      meetingDate,
      ...metrics,
      notes: typeof body.notes === 'string' ? body.notes : '',
    },
  });
}

// ─── GET ───────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const { searchParams } = new URL(request.url);
  const requestedRep = searchParams.get('rep')?.trim() || '';
  const limitParam = parseInt(searchParams.get('limit') || '4', 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 26) : 4;

  // Only admins can pull another rep's history
  const repName =
    requestedRep && isAdminLike(auth.user.role) ? requestedRep : auth.user.name;

  let records: MeetingRecord[] = [];
  try {
    records = meetingNumbersService.getByRep(repName);
  } catch (err) {
    console.error('[sales/weekly-numbers] getByRep failed:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to load history' },
      { status: 500 },
    );
  }

  // Most recent first, drop empty weeks (keeps the table tight)
  const trimmed = records
    .filter(r =>
      r.inspected > 0 || r.damage > 0 || r.signed > 0 || r.revenue > 0 ||
      r.approved > 0 || r.referrals > 0 || r.agents > 0 || r.homeShow > 0 ||
      r.repair > 0 || r.gutter > 0,
    )
    .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate))
    .slice(0, limit);

  return NextResponse.json({
    success: true,
    repName,
    records: trimmed,
    total: trimmed.length,
  });
}
