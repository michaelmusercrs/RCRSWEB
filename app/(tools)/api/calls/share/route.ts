/**
 * RCRS Call Sharing API
 *
 * Share call records with team members for collaboration.
 * Stores sharing data in data/call-shares.json.
 *
 * POST /api/calls/share - Share a call with team members
 * GET  /api/calls/share - Get shared calls for a user
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

export interface CallShare {
  /** Unique share identifier */
  id: string;
  /** The call being shared */
  callId: string;
  /** Who shared it */
  sharedBy: string;
  /** Who it was shared with (user IDs) */
  sharedWith: string[];
  /** Optional message accompanying the share */
  message: string;
  /** When it was shared */
  sharedAt: string;
}

interface CallSharesData {
  shares: CallShare[];
  lastUpdated: string;
}

// =============================================================================
// DATA HELPERS
// =============================================================================

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'call-shares.json');

function readSharesData(): CallSharesData {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const content = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Error reading call shares data:', error);
  }

  return {
    shares: [],
    lastUpdated: new Date().toISOString(),
  };
}

function writeSharesData(data: CallSharesData): void {
  // Best-effort local write — Vercel's filesystem is read-only at runtime so
  // we log and swallow rather than 500-ing the request. The Phase 1 backup
  // cron snapshots data/*.json hourly so dev writes are still captured.
  try {
    const dir = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.warn('[calls/share] Local write skipped (read-only fs?):', error);
  }
}

function generateShareId(): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `SHARE-${timestamp}-${random}`;
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * GET /api/calls/share
 *
 * Get calls shared with a specific user.
 *
 * Query params:
 * - userId (required): The user ID to get shared calls for
 * - callId: Optional - get shares for a specific call
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const callId = searchParams.get('callId');

    if (!userId && !callId) {
      return NextResponse.json(
        { error: 'userId or callId query parameter is required' },
        { status: 400 }
      );
    }

    const data = readSharesData();
    let shares = [...data.shares];

    if (userId) {
      shares = shares.filter(s => s.sharedWith.includes(userId));
    }

    if (callId) {
      shares = shares.filter(s => s.callId === callId);
    }

    // Sort by most recent first
    shares.sort((a, b) => new Date(b.sharedAt).getTime() - new Date(a.sharedAt).getTime());

    return NextResponse.json({
      shares,
      total: shares.length,
    });
  } catch (error) {
    console.error('[Call Share API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shared calls' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calls/share
 *
 * Share a call with team members.
 *
 * Body:
 * - callId (required): The call ID to share
 * - shareWith (required): Array of user IDs to share with
 * - sharedBy: Who is sharing (defaults to 'system')
 * - message: Optional message to include with the share
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const body = await request.json();

    if (!body.callId) {
      return NextResponse.json(
        { error: 'callId is required' },
        { status: 400 }
      );
    }

    if (!body.shareWith || !Array.isArray(body.shareWith) || body.shareWith.length === 0) {
      return NextResponse.json(
        { error: 'shareWith must be a non-empty array of user IDs' },
        { status: 400 }
      );
    }

    const data = readSharesData();
    const now = new Date().toISOString();

    const newShare: CallShare = {
      id: generateShareId(),
      callId: body.callId,
      sharedBy: body.sharedBy || 'system',
      sharedWith: body.shareWith,
      message: body.message || '',
      sharedAt: now,
    };

    data.shares.unshift(newShare);
    writeSharesData(data);

    return NextResponse.json({
      success: true,
      share: newShare,
    });
  } catch (error) {
    console.error('[Call Share API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to share call' },
      { status: 500 }
    );
  }
}
