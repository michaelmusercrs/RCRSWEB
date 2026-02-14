/**
 * Audit Log API
 *
 * GET - Retrieve audit log entries
 * POST - Add manual audit log entry
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createAuditLogEntry,
  getEnvironment,
  type AuditLogEntry,
} from '@/lib/feature-flags';
import { requireAdmin } from '@/lib/auth-service';

const BLOB_KEY = 'data/audit-log.json';
const LOCAL_PATH = 'data/audit-log.json';

async function readBlobData(key: string): Promise<any | null> {
  try {
    const { list } = await import('@vercel/blob');
    const blobs = await list({ prefix: key });
    if (blobs.blobs.length > 0) {
      const res = await fetch(blobs.blobs[0].url, { cache: 'no-store' });
      if (res.ok) return await res.json();
    }
  } catch (e) { /* blob not available */ }
  return null;
}

async function writeBlobData(key: string, data: any): Promise<boolean> {
  try {
    const { put } = await import('@vercel/blob');
    await put(key, JSON.stringify(data, null, 2), {
      access: 'public', contentType: 'application/json', addRandomSuffix: false,
    });
    return true;
  } catch (e) { return false; }
}

// Read audit log
async function readAuditLog(): Promise<AuditLogEntry[]> {
  // Try blob first
  const blobData = await readBlobData(BLOB_KEY);
  if (blobData) return blobData;
  // Fallback to local file
  try {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), LOCAL_PATH);
    if (!fs.existsSync(filePath)) return [];
    const logData = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(logData);
  } catch {
    return [];
  }
}

// Write audit log
async function writeAuditLog(entries: AuditLogEntry[]): Promise<void> {
  const wrote = await writeBlobData(BLOB_KEY, entries);
  if (!wrote) {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), LOCAL_PATH);
    const dataDir = path.dirname(filePath);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(entries, null, 2));
  }
}

// Append to audit log
async function appendAuditLog(entry: AuditLogEntry): Promise<void> {
  const entries = await readAuditLog();
  entries.push(entry);

  // Keep only last 1000 entries to prevent file from growing too large
  const trimmedEntries = entries.slice(-1000);
  await writeAuditLog(trimmedEntries);
}

// GET handler - Retrieve audit log
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
      entries = entries.filter(e => e.action.includes(action));
    }
    if (resource) {
      entries = entries.filter(e => e.resource.includes(resource));
    }
    if (userId) {
      entries = entries.filter(e => e.userId === userId);
    }
    if (startDate) {
      entries = entries.filter(e => new Date(e.timestamp) >= new Date(startDate));
    }
    if (endDate) {
      entries = entries.filter(e => new Date(e.timestamp) <= new Date(endDate));
    }

    // Sort by timestamp descending (most recent first)
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply pagination
    const total = entries.length;
    const paginatedEntries = entries.slice(offset, offset + limit);

    // Get summary statistics
    const actionCounts = entries.reduce((acc, entry) => {
      acc[entry.action] = (acc[entry.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

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
      { status: 500 }
    );
  }
}

// POST handler - Add audit log entry
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const {
      action,
      resource,
      userId,
      userEmail,
      details = {},
    } = body;

    if (!action || !resource || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: action, resource, userId' },
        { status: 400 }
      );
    }

    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';

    const entry = createAuditLogEntry(
      action,
      resource,
      userId,
      details,
      userEmail,
      ipAddress
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
      { status: 500 }
    );
  }
}

// DELETE handler - Clear audit log (development only)
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const environment = getEnvironment();

    // Only allow clearing in development
    if (environment !== 'development') {
      return NextResponse.json(
        { success: false, error: 'Audit log can only be cleared in development' },
        { status: 403 }
      );
    }

    // Create a final entry before clearing
    const body = await request.json().catch(() => ({}));
    const clearEntry = createAuditLogEntry(
      'audit-log-cleared',
      'system:audit-log',
      body.userId || 'system',
      { clearedAt: new Date().toISOString(), environment },
      body.userEmail
    );

    // Reset log with just the clear entry
    await writeAuditLog([clearEntry]);

    return NextResponse.json({
      success: true,
      message: 'Audit log cleared',
      data: { entry: clearEntry },
    });
  } catch (error) {
    console.error('Error clearing audit log:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clear audit log' },
      { status: 500 }
    );
  }
}
