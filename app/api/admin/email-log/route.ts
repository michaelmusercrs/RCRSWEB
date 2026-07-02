/**
 * Email Log Viewer API
 *
 * GET /api/admin/email-log
 *
 * Reads the "Email Log" tab on the master Google Sheet (same sheet
 * lib/email-log.ts writes to) and returns the most recent rows for
 * the admin viewer page at /admin/email-log.
 *
 * Uses the same google-spreadsheet + JWT pattern as lib/form-service.ts
 * saveToSheet — no new env vars, no new library.
 *
 * Query params (all optional):
 *   status     - filter by EmailLogStatus value (exact match)
 *   template   - filter by template name (exact match)
 *   recipient  - free-text substring match against to/cc/bcc/from
 *   since      - ISO timestamp; only rows with timestamp >= this value
 *   limit      - max rows to return (default 200, hard cap 500)
 *
 * Returns the last N rows newest-first plus per-status counts for the
 * current filter so the page can render the "Sent / Dropped / Failed"
 * summary without a second round trip.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';

const SHEET_TAB = 'Email Log';
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

interface EmailLogRow {
  timestamp: string;
  template: string;
  to: string;
  cc: string;
  bcc: string;
  from: string;
  subject: string;
  status: string;
  error: string;
  source: string;
}

async function readEmailLogRows(): Promise<EmailLogRow[]> {
  const sheetsId = process.env.GOOGLE_SHEETS_ID;
  const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const svcKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!sheetsId || !svcEmail || !svcKey) {
    // Sheet credentials missing — return empty so the page renders an
    // "unconfigured" empty state instead of 500-ing.
    return [];
  }

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
    template: String(r.get('template') ?? ''),
    to: String(r.get('to') ?? ''),
    cc: String(r.get('cc') ?? ''),
    bcc: String(r.get('bcc') ?? ''),
    from: String(r.get('from') ?? ''),
    subject: String(r.get('subject') ?? ''),
    status: String(r.get('status') ?? ''),
    error: String(r.get('error') ?? ''),
    source: String(r.get('source') ?? ''),
  }));
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status')?.trim() || '';
    const templateFilter = searchParams.get('template')?.trim() || '';
    const recipientFilter = searchParams.get('recipient')?.trim().toLowerCase() || '';
    const sinceParam = searchParams.get('since')?.trim() || '';
    const limitRaw = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT),
    );

    const sinceTs = sinceParam ? Date.parse(sinceParam) : NaN;

    let rows = await readEmailLogRows();

    // Sort newest-first by timestamp before filtering so the per-status
    // counts and the limit both reflect "the most recent activity."
    rows.sort((a, b) => {
      const at = Date.parse(a.timestamp);
      const bt = Date.parse(b.timestamp);
      if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
      if (Number.isNaN(at)) return 1;
      if (Number.isNaN(bt)) return -1;
      return bt - at;
    });

    // Apply filters
    if (statusFilter) {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    if (templateFilter) {
      rows = rows.filter((r) => r.template === templateFilter);
    }
    if (recipientFilter) {
      rows = rows.filter((r) => {
        const blob = `${r.to} ${r.cc} ${r.bcc} ${r.from}`.toLowerCase();
        return blob.includes(recipientFilter);
      });
    }
    if (!Number.isNaN(sinceTs)) {
      rows = rows.filter((r) => {
        const t = Date.parse(r.timestamp);
        return !Number.isNaN(t) && t >= sinceTs;
      });
    }

    // Per-status counts on the filtered set so the page summary updates
    // with the active filters.
    const counts: Record<string, number> = {};
    for (const r of rows) {
      counts[r.status] = (counts[r.status] || 0) + 1;
    }

    // Distinct template + status lists so the page can build select
    // dropdowns from real data without hardcoding.
    const templates = Array.from(new Set(rows.map((r) => r.template).filter(Boolean))).sort();
    const statuses = Array.from(new Set(rows.map((r) => r.status).filter(Boolean))).sort();

    const total = rows.length;
    const limited = rows.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        rows: limited,
        total,
        limit,
        counts,
        templates,
        statuses,
        configured: Boolean(
          process.env.GOOGLE_SHEETS_ID &&
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
            process.env.GOOGLE_PRIVATE_KEY,
        ),
      },
    });
  } catch (error) {
    console.error('GET /api/admin/email-log error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read email log',
      },
      { status: 500 },
    );
  }
}
