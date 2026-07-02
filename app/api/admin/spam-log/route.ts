/**
 * Spam Log Viewer API
 *
 * GET /api/admin/spam-log
 *
 * Reads the "Spam Log" tab on the master Google Sheet (same sheet
 * lib/spam-log.ts writes to) and returns the most recent rows for
 * the admin viewer page at /admin/spam-log.
 *
 * Mirrors app/api/admin/email-log/route.ts — same google-spreadsheet
 * + JWT pattern, no new env vars.
 *
 * Query params (all optional):
 *   gate           - filter by gate (honeypot | spam-filter | turnstile | rate-limit)
 *   route          - filter by route URL (exact match)
 *   submitter      - free-text substring against submitterEmail/submitterName/ip
 *   since          - ISO timestamp; only rows with timestamp >= this value
 *   limit          - max rows to return (default 200, hard cap 500)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';

const SHEET_TAB = 'Spam Log';
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

interface SpamLogRow {
  timestamp: string;
  gate: string;
  route: string;
  ip: string;
  submitterEmail: string;
  submitterName: string;
  reason: string;
  details: string;
}

async function readSpamLogRows(): Promise<SpamLogRow[]> {
  const sheetsId = process.env.GOOGLE_SHEETS_ID;
  const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const svcKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!sheetsId || !svcEmail || !svcKey) return [];

  const { GoogleSpreadsheet } = await import('google-spreadsheet');
  const { JWT } = await import('google-auth-library');

  const auth = new JWT({
    email: svcEmail,
    key: svcKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const doc = new GoogleSpreadsheet(sheetsId, auth);
  await doc.loadInfo();

  const sheet = doc.sheetsByTitle[SHEET_TAB];
  if (!sheet) return [];

  const rows = await sheet.getRows({ limit: 100000 });
  return rows.map((r) => ({
    timestamp: String(r.get('timestamp') ?? ''),
    gate: String(r.get('gate') ?? ''),
    route: String(r.get('route') ?? ''),
    ip: String(r.get('ip') ?? ''),
    submitterEmail: String(r.get('submitterEmail') ?? ''),
    submitterName: String(r.get('submitterName') ?? ''),
    reason: String(r.get('reason') ?? ''),
    details: String(r.get('details') ?? ''),
  }));
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const gateFilter = searchParams.get('gate')?.trim() || '';
    const routeFilter = searchParams.get('route')?.trim() || '';
    const submitterFilter = searchParams.get('submitter')?.trim().toLowerCase() || '';
    const sinceParam = searchParams.get('since')?.trim() || '';
    const limitRaw = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT),
    );

    const sinceTs = sinceParam ? Date.parse(sinceParam) : NaN;

    let rows = await readSpamLogRows();

    rows.sort((a, b) => {
      const at = Date.parse(a.timestamp);
      const bt = Date.parse(b.timestamp);
      if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
      if (Number.isNaN(at)) return 1;
      if (Number.isNaN(bt)) return -1;
      return bt - at;
    });

    if (gateFilter) rows = rows.filter((r) => r.gate === gateFilter);
    if (routeFilter) rows = rows.filter((r) => r.route === routeFilter);
    if (submitterFilter) {
      rows = rows.filter((r) => {
        const blob = `${r.submitterEmail} ${r.submitterName} ${r.ip}`.toLowerCase();
        return blob.includes(submitterFilter);
      });
    }
    if (!Number.isNaN(sinceTs)) {
      rows = rows.filter((r) => {
        const t = Date.parse(r.timestamp);
        return !Number.isNaN(t) && t >= sinceTs;
      });
    }

    const counts: Record<string, number> = {};
    for (const r of rows) {
      counts[r.gate] = (counts[r.gate] || 0) + 1;
    }

    const gates = Array.from(new Set(rows.map((r) => r.gate).filter(Boolean))).sort();
    const routes = Array.from(new Set(rows.map((r) => r.route).filter(Boolean))).sort();

    const total = rows.length;
    const limited = rows.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        rows: limited,
        total,
        limit,
        counts,
        gates,
        routes,
        configured: Boolean(
          process.env.GOOGLE_SHEETS_ID &&
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
            process.env.GOOGLE_PRIVATE_KEY,
        ),
      },
    });
  } catch (error) {
    console.error('GET /api/admin/spam-log error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read spam log',
      },
      { status: 500 },
    );
  }
}
