/**
 * Rep Weekly Numbers API Route
 *
 * GET   - Fetch weekly numbers (filter by rep email, week range)
 * POST  - Submit weekly numbers for a given week
 * PATCH - Update existing entry for a given week
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';

/**
 * Helper: Get the ISO week string for a given date (YYYY-Wnn)
 */
function getISOWeekString(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * GET /api/portal/weekly-numbers?repEmail=xxx&weekStart=2026-W01&weekEnd=2026-W07
 *
 * Returns weekly numbers records. If no repEmail is provided, returns records
 * for the authenticated user's email.
 */
export async function GET(request: NextRequest) {
  // Auth optional for GET — presentation mode needs unauthenticated read access
  const auth = await requireAuth().catch(() => ({ authenticated: false as const, response: null as unknown as Response }));
  
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

    // Also return the current week string for convenience
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
      {
        success: false,
        error: 'Failed to fetch weekly numbers',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portal/weekly-numbers
 *
 * Submit weekly numbers for a given week.
 * Body: {
 *   week?: string,       // defaults to current week
 *   doorsKnocked, appointmentsSet, inspectionsCompleted,
 *   estimatesGiven, contractsSigned, revenueClosed,
 *   leadsGenerated, followUpsMade, notes
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();

    const week = body.week || getISOWeekString();
    const repName = auth.user.name;
    const repEmail = auth.user.email;

    // Check if an entry already exists for this week/rep
    const existing = await googleSheetsService.getRepWeeklyNumbers({
      repEmail,
      weekStart: week,
      weekEnd: week,
    });

    if (existing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Entry already exists for this week. Use PATCH to update.',
          existingRecord: existing[0],
        },
        { status: 409 }
      );
    }

    const record = {
      week,
      repName,
      repEmail,
      doorsKnocked: parseInt(body.doorsKnocked) || 0,
      appointmentsSet: parseInt(body.appointmentsSet) || 0,
      inspectionsCompleted: parseInt(body.inspectionsCompleted) || 0,
      estimatesGiven: parseInt(body.estimatesGiven) || 0,
      contractsSigned: parseInt(body.contractsSigned) || 0,
      revenueClosed: parseFloat(body.revenueClosed) || 0,
      leadsGenerated: parseInt(body.leadsGenerated) || 0,
      followUpsMade: parseInt(body.followUpsMade) || 0,
      notes: body.notes || '',
      submittedAt: new Date().toISOString(),
    };

    const success = await googleSheetsService.addRepWeeklyNumbers(record);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to save weekly numbers' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Weekly numbers submitted successfully',
      record,
    });
  } catch (error) {
    console.error('Error submitting weekly numbers:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to submit weekly numbers',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/portal/weekly-numbers
 *
 * Update an existing weekly numbers entry.
 * Body: { week?: string, ...fields to update }
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();

    const week = body.week || getISOWeekString();
    const repEmail = auth.user.email;

    const updates: Record<string, string | number> = {};
    const fields = [
      'doorsKnocked', 'appointmentsSet', 'inspectionsCompleted',
      'estimatesGiven', 'contractsSigned', 'revenueClosed',
      'leadsGenerated', 'followUpsMade', 'notes',
    ];

    for (const field of fields) {
      if (body[field] !== undefined) {
        if (field === 'notes') {
          updates[field] = body[field];
        } else if (field === 'revenueClosed') {
          updates[field] = parseFloat(body[field]) || 0;
        } else {
          updates[field] = parseInt(body[field]) || 0;
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    const success = await googleSheetsService.updateRepWeeklyNumbers(week, repEmail, updates);

    if (!success) {
      // If update fails, the row might not exist yet - try creating it
      const record = {
        week,
        repName: auth.user.name,
        repEmail,
        doorsKnocked: parseInt(body.doorsKnocked) || 0,
        appointmentsSet: parseInt(body.appointmentsSet) || 0,
        inspectionsCompleted: parseInt(body.inspectionsCompleted) || 0,
        estimatesGiven: parseInt(body.estimatesGiven) || 0,
        contractsSigned: parseInt(body.contractsSigned) || 0,
        revenueClosed: parseFloat(body.revenueClosed) || 0,
        leadsGenerated: parseInt(body.leadsGenerated) || 0,
        followUpsMade: parseInt(body.followUpsMade) || 0,
        notes: body.notes || '',
        submittedAt: new Date().toISOString(),
      };

      const created = await googleSheetsService.addRepWeeklyNumbers(record);
      if (!created) {
        return NextResponse.json(
          { success: false, error: 'Failed to update or create weekly numbers' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'No existing entry found - created new record',
        record,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Weekly numbers updated successfully',
      week,
    });
  } catch (error) {
    console.error('Error updating weekly numbers:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update weekly numbers',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
