/**
 * Rep Weekly Numbers API Route
 *
 * Uses the REAL Monday meeting column names:
 * Inspected | Damage | Signed | Repair | Gutter | $$$$$ | Approved | Goal | Referrals | Agents | Present | Home Show
 *
 * GET   - Fetch weekly numbers for the logged-in rep
 * POST  - Submit weekly numbers for a given week
 * PATCH - Update existing entry for a given week
 *
 * Saves to the master RCRS Google Sheet (RepWeeklyNumbers tab)
 * AND to the Monday meeting sheet via meeting-numbers-service.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { meetingNumbersService } from '@/lib/meeting-numbers-service';

function getISOWeekString(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Convert an ISO week string (e.g., "2026-W12") to the Monday date as YYYY-MM-DD.
 */
function isoWeekToMonday(weekStr: string): string {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return new Date().toISOString().slice(0, 10);
  const year = parseInt(match[1]);
  const week = parseInt(match[2]);
  // Jan 4 is always in week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // Monday=1
  const monday = new Date(jan4.getTime());
  monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7);
  return monday.toISOString().slice(0, 10);
}

/**
 * Fire-and-forget sync of submitted numbers to the Monday meeting sheet.
 */
async function syncToMeetingSheet(
  repName: string,
  weekStr: string,
  body: Record<string, unknown>,
): Promise<void> {
  const meetingDate = isoWeekToMonday(weekStr);
  await meetingNumbersService.submitNumbers(repName, meetingDate, {
    inspected: parseInt(String(body.inspected)) || 0,
    damage: parseInt(String(body.damage)) || 0,
    signed: parseInt(String(body.signed)) || 0,
    repair: parseInt(String(body.repair)) || 0,
    gutter: parseInt(String(body.gutter)) || 0,
    revenue: parseFloat(String(body.revenue)) || 0,
    approved: parseInt(String(body.approved)) || 0,
    goal: parseInt(String(body.goal)) || 0,
    referrals: parseInt(String(body.referrals)) || 0,
    agents: parseInt(String(body.agents)) || 0,
    present: String(body.present || '1'),
    homeShow: parseInt(String(body.homeShow)) || 0,
  });
}

// The fields that match the Monday meeting sheet columns
const MEETING_FIELDS = [
  'inspected', 'damage', 'signed', 'repair', 'gutter',
  'revenue', 'approved', 'goal', 'referrals', 'agents',
  'present', 'homeShow',
] as const;

/**
 * Map new field names to old RepWeeklyNumbers sheet columns for backward compat.
 * This keeps data flowing to the master RCRS sheet while we use the new names.
 */
function mapToLegacyRecord(body: Record<string, unknown>, repName: string, repEmail: string, week: string) {
  return {
    week,
    repName,
    repEmail,
    doorsKnocked: parseInt(String(body.inspected)) || 0,
    appointmentsSet: parseInt(String(body.damage)) || 0,
    inspectionsCompleted: parseInt(String(body.signed)) || 0,
    estimatesGiven: parseInt(String(body.repair)) || 0,
    contractsSigned: parseInt(String(body.gutter)) || 0,
    revenueClosed: parseFloat(String(body.revenue)) || 0,
    leadsGenerated: parseInt(String(body.approved)) || 0,
    followUpsMade: parseInt(String(body.goal)) || 0,
    notes: `Referrals:${body.referrals || 0} Agents:${body.agents || 0} Present:${body.present || ''} HomeShow:${body.homeShow || 0}`,
    submittedAt: new Date().toISOString(),
  };
}

/**
 * Build a clean response record using the new field names.
 */
function buildResponseRecord(body: Record<string, unknown>, repName: string, week: string) {
  return {
    week,
    repName,
    inspected: parseInt(String(body.inspected)) || 0,
    damage: parseInt(String(body.damage)) || 0,
    signed: parseInt(String(body.signed)) || 0,
    repair: parseInt(String(body.repair)) || 0,
    gutter: parseInt(String(body.gutter)) || 0,
    revenue: parseFloat(String(body.revenue)) || 0,
    approved: parseInt(String(body.approved)) || 0,
    goal: parseInt(String(body.goal)) || 0,
    referrals: parseInt(String(body.referrals)) || 0,
    agents: parseInt(String(body.agents)) || 0,
    present: String(body.present || '1'),
    homeShow: parseInt(String(body.homeShow)) || 0,
    submittedAt: new Date().toISOString(),
  };
}

// ─── GET ────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireAuth().catch(() => ({
    authenticated: false as const,
    response: null as unknown as Response,
  }));

  try {
    const { searchParams } = new URL(request.url);
    const repEmail = searchParams.get('repEmail') || (auth.authenticated ? auth.user.email : '');
    const weekStart = searchParams.get('weekStart') || undefined;
    const weekEnd = searchParams.get('weekEnd') || undefined;
    const allReps = searchParams.get('allReps') === 'true';

    const records = await googleSheetsService.getRepWeeklyNumbers({
      repEmail: allReps ? undefined : repEmail,
      weekStart,
      weekEnd,
    });

    const currentWeek = getISOWeekString();

    return NextResponse.json({
      success: true,
      currentWeek,
      records,
      total: records.length,
    });
  } catch (error) {
    console.error('Error fetching weekly numbers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch weekly numbers' },
      { status: 500 },
    );
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const week = body.week || getISOWeekString();
    const repName = auth.user.name;
    const repEmail = auth.user.email;

    // Check if entry already exists
    const existing = await googleSheetsService.getRepWeeklyNumbers({
      repEmail,
      weekStart: week,
      weekEnd: week,
    });

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Entry already exists for this week. Use PATCH to update.', existingRecord: existing[0] },
        { status: 409 },
      );
    }

    // Save to master RCRS sheet (legacy format)
    const legacyRecord = mapToLegacyRecord(body, repName, repEmail, week);
    const success = await googleSheetsService.addRepWeeklyNumbers(legacyRecord);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to save weekly numbers' },
        { status: 500 },
      );
    }

    // Sync to Monday meeting sheet (fire-and-forget so it doesn't block the response)
    syncToMeetingSheet(repName, week, body).catch(err => {
      console.error('[WeeklyNumbers] Meeting sheet sync failed:', err);
    });

    const record = buildResponseRecord(body, repName, week);
    return NextResponse.json({ success: true, message: 'Numbers submitted', record });
  } catch (error) {
    console.error('Error submitting weekly numbers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit weekly numbers' },
      { status: 500 },
    );
  }
}

// ─── PATCH ──────────────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const week = body.week || getISOWeekString();
    const repEmail = auth.user.email;

    // Build updates using new field names mapped to legacy columns
    const updates: Record<string, string | number> = {};
    const fieldMap: Record<string, string> = {
      inspected: 'doorsKnocked',
      damage: 'appointmentsSet',
      signed: 'inspectionsCompleted',
      repair: 'estimatesGiven',
      gutter: 'contractsSigned',
      revenue: 'revenueClosed',
      approved: 'leadsGenerated',
      goal: 'followUpsMade',
    };

    for (const [newField, legacyField] of Object.entries(fieldMap)) {
      if (body[newField] !== undefined) {
        if (newField === 'revenue') {
          updates[legacyField] = parseFloat(String(body[newField])) || 0;
        } else {
          updates[legacyField] = parseInt(String(body[newField])) || 0;
        }
      }
    }

    // Pack extra fields into notes
    const notesParts: string[] = [];
    if (body.referrals !== undefined) notesParts.push(`Referrals:${body.referrals}`);
    if (body.agents !== undefined) notesParts.push(`Agents:${body.agents}`);
    if (body.present !== undefined) notesParts.push(`Present:${body.present}`);
    if (body.homeShow !== undefined) notesParts.push(`HomeShow:${body.homeShow}`);
    if (notesParts.length > 0) updates.notes = notesParts.join(' ');

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    const success = await googleSheetsService.updateRepWeeklyNumbers(week, repEmail, updates);

    if (!success) {
      // Try creating if doesn't exist
      const legacyRecord = mapToLegacyRecord(body, auth.user.name, repEmail, week);
      const created = await googleSheetsService.addRepWeeklyNumbers(legacyRecord);
      if (!created) {
        return NextResponse.json(
          { success: false, error: 'Failed to update or create weekly numbers' },
          { status: 500 },
        );
      }
      const record = buildResponseRecord(body, auth.user.name, week);
      return NextResponse.json({ success: true, message: 'Created new record', record });
    }

    // Sync to Monday meeting sheet (fire-and-forget)
    syncToMeetingSheet(auth.user.name, week, body).catch(err => {
      console.error('[WeeklyNumbers] Meeting sheet sync failed:', err);
    });

    return NextResponse.json({ success: true, message: 'Numbers updated', week });
  } catch (error) {
    console.error('Error updating weekly numbers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update weekly numbers' },
      { status: 500 },
    );
  }
}
