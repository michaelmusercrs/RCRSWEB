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
      const initialized = await googleSheetsService.init();
      if (initialized) {
        // getOrCreateSheet will create the AuditLog tab if it doesn't exist
        const doc = (googleSheetsService as any).doc;
        if (doc) {
          let sheet = doc.sheetsByTitle['AuditLog'];
          if (!sheet) {
            sheet = await doc.addSheet({
              title: 'AuditLog',
              headerValues: ['Timestamp', 'Action', 'UserEmail', 'Details', 'IP', 'UserAgent'],
            });
          }

          const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
          const ua = request.headers.get('user-agent') || 'unknown';

          await sheet.addRow({
            Timestamp: timestamp || new Date().toISOString(),
            Action: action,
            UserEmail: userEmail,
            Details: details || '',
            IP: typeof ip === 'string' ? ip.split(',')[0].trim() : 'unknown',
            UserAgent: ua.substring(0, 200),
          });
        }
      }
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
