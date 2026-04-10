/**
 * Audit Log API
 *
 * GET    - Retrieve audit log entries
 * POST   - Add a manual audit log entry
 * DELETE - Clear the audit log (dev only — adds a final "cleared" entry)
 *
 * As of the 2026-04-09 persistence migration this route is backed entirely by
 * the AuditLog tab on the master Google Sheet. Earlier versions dual-wrote to
 * Vercel Blob and a local data/audit-log.json fallback; both have been removed
 * because (a) Vercel's filesystem is read-only at runtime so the JSON fallback
 * was silently failing in prod, and (b) the master sheet is the canonical
 * source of truth per the system directive.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createAuditLogEntry,
  getEnvironment,
  type AuditLogEntry,
} from '@/lib/feature-flags';
import { requireAdmin } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';

/**
 * The AuditLog sheet stores: Timestamp, Action, UserEmail, Details, IP, UserAgent.
 * AuditLogEntry from feature-flags has a richer in-process shape, so we map
 * between them here.
 */
function sheetRowToEntry(row: Record<string, string>): AuditLogEntry {
  let parsedDetails: Record<string, unknown> = {};
  try {
    parsedDetails = row.Details ? JSON.parse(row.Details) : {};
  } catch {
    parsedDetails = { raw: row.Details };
  }
  // The original entry shape carries resource + userId + environment, which we
  // encode into Details when writing. Pull them back out on read with safe
  // defaults so older rows (or rows written by other systems) still parse.
  const detailsObj =
    typeof parsedDetails === 'object' && parsedDetails
      ? (parsedDetails as Record<string, unknown>)
      : {};
  const resource = String(detailsObj.resource ?? '');
  const userId = String(detailsObj.userId ?? '');
  const environment = String(detailsObj.environment ?? getEnvironment()) as AuditLogEntry['environment'];
  return {
    id: `${row.Timestamp}-${row.Action}-${userId}`,
    timestamp: row.Timestamp || new Date().toISOString(),
    action: row.Action || '',
    resource,
    userId,
    userEmail: row.UserEmail || undefined,
    details: detailsObj,
    ipAddress: row.IP || undefined,
    environment,
  };
}

async function readAuditLog(): Promise<AuditLogEntry[]> {
  const rows = await googleSheetsService.getAuditLog();
  return rows.map(sheetRowToEntry);
}

async function appendAuditLog(entry: AuditLogEntry): Promise<void> {
  // Encode resource + userId + environment into the Details JSON so the sheet
  // schema stays flat while we still preserve the full entry on read.
  const detailsBlob = JSON.stringify({
    ...(entry.details ?? {}),
    resource: entry.resource,
    userId: entry.userId,
    environment: entry.environment,
  });

  await googleSheetsService.appendToAuditLog({
    action: entry.action,
    userEmail: entry.userEmail || '',
    details: detailsBlob,
    ip: entry.ipAddress,
    timestamp: entry.timestamp,
  });
}

// GET handler — Retrieve audit log
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const action = searchParams.get('action');
    const resource = searchParams.get('resource');
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let entries = await readAuditLog();

    // Apply filters
    if (action) {
      entries = entries.filter((e) => e.action.includes(action));
    }
    if (resource) {
      entries = entries.filter((e) => e.resource.includes(resource));
    }
    if (userId) {
      entries = entries.filter((e) => e.userId === userId);
    }
    if (startDate) {
      entries = entries.filter((e) => new Date(e.timestamp) >= new Date(startDate));
    }
    if (endDate) {
      entries = entries.filter((e) => new Date(e.timestamp) <= new Date(endDate));
    }

    // Sort by timestamp descending (most recent first)
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply pagination
    const total = entries.length;
    const paginatedEntries = entries.slice(offset, offset + limit);

    // Get summary statistics
    const actionCounts = entries.reduce(
      (acc, entry) => {
        acc[entry.action] = (acc[entry.action] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return NextResponse.json({
      success: true,
      data: {
        entries: paginatedEntries,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        statistics: {
          totalEntries: total,
          actionCounts,
          environment: getEnvironment(),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit log' },
      { status: 500 },
    );
  }
}

// POST handler — Add an audit log entry
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action, resource, userId, userEmail, details = {} } = body;

    if (!action || !resource || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: action, resource, userId' },
        { status: 400 },
      );
    }

    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';

    const entry = createAuditLogEntry(
      action,
      resource,
      userId,
      details,
      userEmail,
      ipAddress,
    );

    await appendAuditLog(entry);

    return NextResponse.json({
      success: true,
      message: 'Audit log entry created',
      data: { entry },
    });
  } catch (error) {
    console.error('Error creating audit log entry:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create audit log entry' },
      { status: 500 },
    );
  }
}

// DELETE handler — Add a "cleared" marker entry (dev only)
//
// Truly clearing the AuditLog tab from a route handler is dangerous (a sheet
// row delete loop would be slow and racy). Instead, we record a clear marker
// and rely on humans to wipe the tab manually if they really want to.
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const environment = getEnvironment();

    if (environment !== 'development') {
      return NextResponse.json(
        { success: false, error: 'Audit log can only be cleared in development' },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const clearEntry = createAuditLogEntry(
      'audit-log-cleared',
      'system:audit-log',
      body.userId || 'system',
      { clearedAt: new Date().toISOString(), environment },
      body.userEmail,
    );

    await appendAuditLog(clearEntry);

    return NextResponse.json({
      success: true,
      message: 'Audit log clear marker recorded (manual sheet wipe required to actually clear)',
      data: { entry: clearEntry },
    });
  } catch (error) {
    console.error('Error clearing audit log:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clear audit log' },
      { status: 500 },
    );
  }
}
