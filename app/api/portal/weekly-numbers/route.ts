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
import { cache, CACHE_TTL } from '@/lib/cache';
import { meetingNumbersService } from '@/lib/meeting-numbers-service';
import { emailService } from '@/lib/email-service';

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

// Numeric fields eligible for increment mode
const INCREMENTABLE_FIELDS = [
  'inspected', 'damage', 'signed', 'repair', 'gutter',
  'revenue', 'approved', 'goal', 'referrals', 'agents', 'homeShow',
] as const;

/**
 * Parse a legacy RepWeeklyNumbers record back into new field names.
 * The notes field contains: "Referrals:N Agents:N Present:X HomeShow:N"
 */
function legacyRecordToNewFields(record: Record<string, unknown>): Record<string, number | string> {
  const result: Record<string, number | string> = {
    inspected: parseInt(String(record.doorsKnocked)) || 0,
    damage: parseInt(String(record.appointmentsSet)) || 0,
    signed: parseInt(String(record.inspectionsCompleted)) || 0,
    repair: parseInt(String(record.estimatesGiven)) || 0,
    gutter: parseInt(String(record.contractsSigned)) || 0,
    revenue: parseFloat(String(record.revenueClosed)) || 0,
    approved: parseInt(String(record.leadsGenerated)) || 0,
    goal: parseInt(String(record.followUpsMade)) || 0,
    referrals: 0,
    agents: 0,
    present: '1',
    homeShow: 0,
  };

  // Parse extra fields from the notes string
  const notes = String(record.notes || '');
  const referralsMatch = notes.match(/Referrals:(\d+)/);
  const agentsMatch = notes.match(/Agents:(\d+)/);
  const presentMatch = notes.match(/Present:(\S+)/);
  const homeShowMatch = notes.match(/HomeShow:(\d+)/);

  if (referralsMatch) result.referrals = parseInt(referralsMatch[1]) || 0;
  if (agentsMatch) result.agents = parseInt(agentsMatch[1]) || 0;
  if (presentMatch) result.present = presentMatch[1];
  if (homeShowMatch) result.homeShow = parseInt(homeShowMatch[1]) || 0;

  return result;
}

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

    const cacheKey = `sheets:weekly-numbers:${allReps ? 'all' : repEmail}:${weekStart || ''}:${weekEnd || ''}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData, {
        headers: { 'Cache-Control': 'private, s-maxage=30' },
      });
    }

    const records = await googleSheetsService.getRepWeeklyNumbers({
      repEmail: allReps ? undefined : repEmail,
      weekStart,
      weekEnd,
    });

    const currentWeek = getISOWeekString();

    const responseData = {
      success: true,
      currentWeek,
      records,
      total: records.length,
    };
    cache.set(cacheKey, responseData, CACHE_TTL.MEETING);
    return NextResponse.json(responseData, {
      headers: { 'Cache-Control': 'private, s-maxage=30' },
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

    cache.invalidatePattern('^sheets:weekly-numbers:');
    cache.invalidatePattern('^sheets:meeting-data:');

    // Sync to Monday meeting sheet (fire-and-forget so it doesn't block the response)
    syncToMeetingSheet(repName, week, body).catch(err => {
      console.error('[WeeklyNumbers] Meeting sheet sync failed:', err);
    });

    // Fire-and-forget: Email notification to Michael about the submission
    const record = buildResponseRecord(body, repName, week);
    notifyWeeklyNumbersSubmitted(repName, week, record).catch(err => {
      console.error('[WeeklyNumbers] Notification failed:', err);
    });

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
    const incrementMode = body.increment === true;

    // In increment mode, fetch the existing record and add incoming values to current values
    let mergedBody = { ...body };
    if (incrementMode) {
      const existing = await googleSheetsService.getRepWeeklyNumbers({
        repEmail,
        weekStart: week,
        weekEnd: week,
      });

      if (existing.length > 0) {
        const currentValues = legacyRecordToNewFields(existing[0] as unknown as Record<string, unknown>);

        // Add incoming numeric values to existing values
        for (const field of INCREMENTABLE_FIELDS) {
          if (mergedBody[field] !== undefined) {
            const incomingValue = field === 'revenue'
              ? parseFloat(String(mergedBody[field])) || 0
              : parseInt(String(mergedBody[field])) || 0;
            const currentValue = typeof currentValues[field] === 'number' ? currentValues[field] as number : 0;
            mergedBody[field] = currentValue + incomingValue;
          }
        }

        // Non-numeric fields (present) overwrite, not increment - already in mergedBody from spread
      }
      // If no existing record, increment mode just uses the incoming values as-is (base of 0)
    }

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
      if (mergedBody[newField] !== undefined) {
        if (newField === 'revenue') {
          updates[legacyField] = parseFloat(String(mergedBody[newField])) || 0;
        } else {
          updates[legacyField] = parseInt(String(mergedBody[newField])) || 0;
        }
      }
    }

    // Pack extra fields into notes
    const notesParts: string[] = [];
    if (mergedBody.referrals !== undefined) notesParts.push(`Referrals:${mergedBody.referrals}`);
    if (mergedBody.agents !== undefined) notesParts.push(`Agents:${mergedBody.agents}`);
    if (mergedBody.present !== undefined) notesParts.push(`Present:${mergedBody.present}`);
    if (mergedBody.homeShow !== undefined) notesParts.push(`HomeShow:${mergedBody.homeShow}`);
    if (notesParts.length > 0) updates.notes = notesParts.join(' ');

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    const success = await googleSheetsService.updateRepWeeklyNumbers(week, repEmail, updates);
    cache.invalidatePattern('^sheets:weekly-numbers:');
    cache.invalidatePattern('^sheets:meeting-data:');

    if (!success) {
      // Try creating if doesn't exist
      const legacyRecord = mapToLegacyRecord(mergedBody, auth.user.name, repEmail, week);
      const created = await googleSheetsService.addRepWeeklyNumbers(legacyRecord);
      if (!created) {
        return NextResponse.json(
          { success: false, error: 'Failed to update or create weekly numbers' },
          { status: 500 },
        );
      }
      const record = buildResponseRecord(mergedBody, auth.user.name, week);
      return NextResponse.json({ success: true, message: 'Created new record', record });
    }

    // Sync to Monday meeting sheet (fire-and-forget) - use merged values
    syncToMeetingSheet(auth.user.name, week, mergedBody).catch(err => {
      console.error('[WeeklyNumbers] Meeting sheet sync failed:', err);
    });

    // Notification on update too
    const updatedRecord = buildResponseRecord(mergedBody, auth.user.name, week);
    notifyWeeklyNumbersSubmitted(auth.user.name, week, updatedRecord, true).catch(err => {
      console.error('[WeeklyNumbers] Update notification failed:', err);
    });

    return NextResponse.json({ success: true, message: incrementMode ? 'Numbers incremented' : 'Numbers updated', week });
  } catch (error) {
    console.error('Error updating weekly numbers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update weekly numbers' },
      { status: 500 },
    );
  }
}

// ─── NOTIFICATION ─────────────────────────────────────────────────────────
/** Email Michael when a rep submits or updates weekly numbers */
async function notifyWeeklyNumbersSubmitted(
  repName: string,
  week: string,
  record: Record<string, unknown>,
  isUpdate = false,
) {
  const action = isUpdate ? 'Updated' : 'Submitted';
  const revenue = record.revenue ? `$${Number(record.revenue).toLocaleString()}` : '$0';

  await emailService.send({
    to: 'michaelmuse@rcrsal.com',
    subject: `Weekly Numbers ${action}: ${repName} (${week})`,
    body: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;">
        <div style="background:#000;padding:16px;text-align:center;">
          <h2 style="color:#39FF14;margin:0;">Weekly Numbers ${action}</h2>
        </div>
        <div style="padding:20px;background:#fff;">
          <p><strong>${repName}</strong> ${action.toLowerCase()} their numbers for week <strong>${week}</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:12px 0;">
            <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Inspected</td><td style="padding:6px;border-bottom:1px solid #eee;">${record.inspected}</td></tr>
            <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Damage</td><td style="padding:6px;border-bottom:1px solid #eee;">${record.damage}</td></tr>
            <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Signed</td><td style="padding:6px;border-bottom:1px solid #eee;">${record.signed}</td></tr>
            <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Repair</td><td style="padding:6px;border-bottom:1px solid #eee;">${record.repair}</td></tr>
            <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Gutter</td><td style="padding:6px;border-bottom:1px solid #eee;">${record.gutter}</td></tr>
            <tr style="background:#f0fff0;"><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Revenue ($$$$$)</td><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;color:#39FF14;">${revenue}</td></tr>
            <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Approved</td><td style="padding:6px;border-bottom:1px solid #eee;">${record.approved}</td></tr>
            <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Referrals</td><td style="padding:6px;border-bottom:1px solid #eee;">${record.referrals}</td></tr>
            <tr><td style="padding:6px;font-weight:bold;">Agents</td><td style="padding:6px;">${record.agents}</td></tr>
          </table>
        </div>
      </div>
    `,
    fromName: 'RCRS Portal',
  });

  // Also log to AuditLog
  try {
    const initialized = await googleSheetsService.init();
    if (initialized) {
      const doc = (googleSheetsService as any).doc;
      if (doc) {
        const sheet = doc.sheetsByTitle['AuditLog'];
        if (sheet) {
          await sheet.addRow({
            Timestamp: new Date().toISOString(),
            Action: `WEEKLY_NUMBERS_${isUpdate ? 'UPDATED' : 'SUBMITTED'}`,
            UserEmail: repName,
            Details: `${repName} ${action.toLowerCase()} week ${week}: Revenue=${revenue}, Inspected=${record.inspected}, Signed=${record.signed}`,
            IP: '',
            UserAgent: 'weekly-numbers-api',
          });
        }
      }
    }
  } catch (e) {
    console.error('[WeeklyNumbers] AuditLog failed:', e);
  }
}
