/**
 * Chrisview feedback / correction queue.
 *
 * POST /api/chrisview-feedback
 *   body: { kind: 'mistake' | 'request' | 'note', pageId?: string, pageUrl?: string,
 *           valueShown?: string | number, suggestedValue?: string | number, message: string }
 *
 * Logs every entry to the `chrisview_feedback` master-sheet tab with
 * status='pending'. Owner reviews via /chrisview/qa-admin.
 *
 * GET /api/chrisview-feedback?status=pending
 *   returns the queue (owner/admin only — gated by ?adminKey query for now,
 *   ADMIN_REVIEW_KEY env var, replace with proper auth later).
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TAB = 'chrisview_feedback';
const HEADERS = [
  'id',
  'timestamp',
  'kind',
  'pageId',
  'pageUrl',
  'valueShown',
  'suggestedValue',
  'message',
  'ip',
  'status',
  'reviewedBy',
  'reviewedAt',
  'resolution',
] as const;

async function getSheet() {
  const sheetsId = process.env.GOOGLE_SHEETS_ID;
  const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const svcKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!sheetsId || !svcEmail || !svcKey) return null;
  const { GoogleSpreadsheet } = await import('google-spreadsheet');
  const { JWT } = await import('google-auth-library');
  const auth = new JWT({
    email: svcEmail,
    key: svcKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(sheetsId, auth);
  await doc.loadInfo();
  let sheet = doc.sheetsByTitle[TAB];
  if (!sheet) {
    sheet = await doc.addSheet({ title: TAB, headerValues: [...HEADERS] });
  }
  return sheet;
}

function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: NextRequest) {
  let body: {
    kind?: string;
    pageId?: string;
    pageUrl?: string;
    valueShown?: unknown;
    suggestedValue?: unknown;
    message?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const kind = String(body.kind || '').trim();
  if (!['mistake', 'request', 'note'].includes(kind)) {
    return NextResponse.json({ error: 'kind must be mistake|request|note' }, { status: 400 });
  }
  const message = String(body.message || '').trim();
  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 });
  if (message.length > 4000) return NextResponse.json({ error: 'message too long' }, { status: 400 });

  const sheet = await getSheet();
  if (!sheet) {
    return NextResponse.json({ error: 'sheets not configured — feedback logged but not persisted' }, { status: 503 });
  }
  const id = `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  await sheet.addRow({
    id,
    timestamp: new Date().toISOString(),
    kind,
    pageId: body.pageId || '',
    pageUrl: body.pageUrl || '',
    valueShown: String(body.valueShown ?? '').slice(0, 1000),
    suggestedValue: String(body.suggestedValue ?? '').slice(0, 1000),
    message: message.slice(0, 4000),
    ip: getClientIp(request),
    status: 'pending',
    reviewedBy: '',
    reviewedAt: '',
    resolution: '',
  });
  return NextResponse.json({ success: true, id });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const adminKey = searchParams.get('adminKey');
  const expected = process.env.ADMIN_REVIEW_KEY;
  if (!expected || adminKey !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const statusFilter = searchParams.get('status');
  const sheet = await getSheet();
  if (!sheet) return NextResponse.json({ rows: [] });
  const rows = await sheet.getRows();
  const out = rows
    .map(r => {
      const obj: Record<string, string> = {};
      for (const h of HEADERS) obj[h] = String(r.get(h) || '');
      return obj;
    })
    .filter(r => (statusFilter ? r.status === statusFilter : true))
    .reverse(); // newest first
  return NextResponse.json({ rows: out });
}
