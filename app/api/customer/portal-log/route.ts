/**
 * Customer Portal Log API
 *
 * POST: Log a portal action (called from customer portal frontend)
 * GET: Retrieve portal activity for a customer (admin use)
 *
 * All data persists to the CustomerPortalLog Google Sheets tab.
 */

import { NextRequest, NextResponse } from 'next/server';
import { googleSheetsService, CustomerPortalLogRecord } from '@/lib/google-sheets-service';
import { requireAdmin } from '@/lib/auth-service';

/**
 * Extract client IP from request headers.
 * Checks x-forwarded-for (Vercel/proxy), x-real-ip, then falls back to 'unknown'.
 */
function getClientIP(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xri = request.headers.get('x-real-ip');
  if (xri) return xri;
  return 'unknown';
}

/**
 * POST /api/customer/portal-log
 *
 * Log a customer portal action to Google Sheets.
 * Called from the customer portal frontend on key interactions.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerName,
      customerEmail,
      customerId,
      jobId,
      action,
      details,
    } = body;

    // Validate required fields
    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action is required' },
        { status: 400 }
      );
    }

    // Valid actions
    const validActions = [
      'portal_opened',
      'document_viewed',
      'document_downloaded',
      'message_sent',
      'appointment_scheduled',
      'payment_viewed',
      'photo_viewed',
      'file_uploaded',
      'tab_changed',
      'qr_downloaded',
      'rep_contacted',
      'reminder_set',
    ];

    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Build details JSON, including customerId for lookups
    const detailsObj = typeof details === 'string'
      ? (() => { try { return JSON.parse(details); } catch { return { raw: details }; } })()
      : details || {};
    if (customerId) detailsObj.customerId = customerId;

    const logRecord: CustomerPortalLogRecord = {
      logId: `PLOG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      customerName: customerName || 'Unknown',
      customerEmail: customerEmail || '',
      jobId: jobId || '',
      action,
      timestamp: new Date().toISOString(),
      ipAddress,
      userAgent: userAgent.substring(0, 500), // Truncate long UAs
      details: JSON.stringify(detailsObj),
    };

    const success = await googleSheetsService.addPortalLog(logRecord);

    // If this is a portal_opened action, also increment visit count in CustomerPortalData
    if (action === 'portal_opened' && customerId) {
      // Fire-and-forget: increment visit counter
      googleSheetsService.incrementPortalVisit(customerId).catch(err => {
        console.error('Failed to increment portal visit:', err);
      });
    }

    // If this is a message_sent action, increment message count
    if (action === 'message_sent' && customerId) {
      googleSheetsService.incrementPortalStat(customerId, 'messagesSent').catch(err => {
        console.error('Failed to increment messagesSent:', err);
      });
    }

    // If this is a document_viewed or document_downloaded, increment docs viewed
    if ((action === 'document_viewed' || action === 'document_downloaded') && customerId) {
      googleSheetsService.incrementPortalStat(customerId, 'documentsViewed').catch(err => {
        console.error('Failed to increment documentsViewed:', err);
      });
    }

    if (success) {
      return NextResponse.json({ success: true, logId: logRecord.logId });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to write log to Google Sheets' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Portal log error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error logging portal action' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/customer/portal-log
 *
 * Retrieve portal activity logs.
 * Query params:
 *   - customerEmail: filter by customer email
 *   - customerId: filter by customer ID (checked in details JSON)
 *   - action: filter by action type
 *   - limit: max records to return (default 100)
 *   - startDate: ISO date string
 *   - endDate: ISO date string
 */
export async function GET(request: NextRequest) {
  // SECURITY: Reading portal logs is admin-only. Contains customer activity data.
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const customerEmail = searchParams.get('customerEmail') || undefined;
    const customerId = searchParams.get('customerId') || undefined;
    const action = searchParams.get('action') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100') || 100;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const logs = await googleSheetsService.getPortalLogs({
      customerEmail,
      customerId,
      action,
      limit,
      startDate,
      endDate,
    });

    return NextResponse.json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error('Portal log fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch portal logs' },
      { status: 500 }
    );
  }
}
