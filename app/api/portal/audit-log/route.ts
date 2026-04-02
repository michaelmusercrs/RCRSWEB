/**
 * Audit Log API - Logs all user actions to Google Sheets
 *
 * POST /api/portal/audit-log
 * Body: { action, userEmail, details, timestamp }
 *
 * Logs to the "AuditLog" tab on the main RCRS Google Sheet.
 * Actions: LOGIN, LOGOUT, PASSWORD_CHANGE, PROFILE_EDIT, LEAD_CREATED,
 *          WEEKLY_NUMBERS_SUBMITTED, SETTINGS_CHANGED, etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { googleSheetsService } from '@/lib/google-sheets-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userEmail, details, timestamp } = body;

    if (!action || !userEmail) {
      return NextResponse.json({ success: false, error: 'Missing action or userEmail' }, { status: 400 });
    }

    // Try to log to Google Sheets
    try {
      const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
      const ua = request.headers.get('user-agent') || 'unknown';

      await googleSheetsService.appendToAuditLog({
        action,
        userEmail,
        details: details || '',
        ip: typeof ip === 'string' ? ip.split(',')[0].trim() : 'unknown',
        userAgent: ua.substring(0, 200),
        timestamp: timestamp || undefined,
      });
    } catch (sheetError) {
      // Log to console if Sheets fails - don't block the user
      console.error('[AuditLog] Failed to write to Sheets:', sheetError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AuditLog] Error:', error);
    return NextResponse.json({ success: true }); // Always return success - don't block user actions
  }
}
