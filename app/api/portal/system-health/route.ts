/**
 * System Health API
 *
 * GET /api/portal/system-health
 *
 * Returns cron heartbeats, webhook info, sheet tab sizes, and
 * inventory sync status. Admin/owner only.
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { unifiedInventoryService } from '@/lib/unified-inventory-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CronStatus {
  name: string;
  lastRunAt: string | null;
  status: 'success' | 'error' | 'unknown';
  duration?: number;
  details?: string;
}

interface WebhookStatus {
  name: string;
  lastReceivedAt: string | null;
  totalReceived: number;
  lastError?: string;
}

interface SheetTabInfo {
  tabName: string;
  rowCount: number;
  status: 'ok' | 'large' | 'empty';
}

interface SystemHealthResponse {
  success: true;
  crons: CronStatus[];
  webhooks: WebhookStatus[];
  sheets: SheetTabInfo[];
  inventory: {
    portalItemCount: number;
    legacySyncDirection: string;
  };
  timestamp: string;
}

// ── Sheet helpers ─────────────────────────────────────────────────────────────

async function getDoc(): Promise<GoogleSpreadsheet> {
  const sheetsId = process.env.GOOGLE_SHEETS_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!sheetsId || !email || !key) {
    throw new Error('Google Sheets credentials not configured');
  }

  const auth = new JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(sheetsId, auth);
  await doc.loadInfo();
  return doc;
}

// ── Cron heartbeats ───────────────────────────────────────────────────────────

const SYSTEM_HEALTH_TAB = 'SystemHealth';

async function getCronStatuses(doc: GoogleSpreadsheet): Promise<CronStatus[]> {
  const knownCrons = [
    'check-lead-timers',
    'auto-reassign',
    'publish-blog',
    'weekly-numbers-reminder',
    'meeting-reset',
    'backup-sheets',
    'low-stock-alert',
    'sync-inventory-tab',
  ];

  const sheet = doc.sheetsByTitle[SYSTEM_HEALTH_TAB];
  if (!sheet) {
    // Tab doesn't exist yet — all crons unknown
    return knownCrons.map(name => ({ name, lastRunAt: null, status: 'unknown' as const }));
  }

  try {
    await sheet.loadHeaderRow();
  } catch {
    return knownCrons.map(name => ({ name, lastRunAt: null, status: 'unknown' as const }));
  }

  const rows = await sheet.getRows();
  const rowMap = new Map<string, { lastRunAt: string; status: string; durationMs: string; details: string }>();
  for (const row of rows) {
    const cronName = row.get('cronName');
    if (cronName) {
      rowMap.set(cronName, {
        lastRunAt: row.get('lastRunAt') || '',
        status: row.get('status') || 'unknown',
        durationMs: row.get('durationMs') || '0',
        details: row.get('details') || '',
      });
    }
  }

  return knownCrons.map(name => {
    const data = rowMap.get(name);
    if (!data) {
      return { name, lastRunAt: null, status: 'unknown' as const };
    }
    return {
      name,
      lastRunAt: data.lastRunAt || null,
      status: (data.status === 'success' || data.status === 'error' ? data.status : 'unknown') as CronStatus['status'],
      duration: parseInt(data.durationMs) || undefined,
      details: data.details || undefined,
    };
  });
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

function getWebhookStatuses(): WebhookStatus[] {
  // Static webhook info — these are the configured webhooks.
  // Future: read from a WebhookHealth section if we add tracking.
  return [
    { name: 'jobnimbus', lastReceivedAt: null, totalReceived: 0 },
    { name: 'groupme', lastReceivedAt: null, totalReceived: 0 },
    { name: 'material-order-email', lastReceivedAt: null, totalReceived: 0 },
  ];
}

// ── Sheet sizes ───────────────────────────────────────────────────────────────

function getSheetTabSizes(doc: GoogleSpreadsheet): SheetTabInfo[] {
  const tabs: SheetTabInfo[] = [];

  for (const sheet of doc.sheetsByIndex) {
    const rowCount = sheet.gridProperties.rowCount;
    let status: SheetTabInfo['status'] = 'ok';
    if (rowCount === 0 || rowCount === 1) status = 'empty';
    else if (rowCount > 5000) status = 'large';

    tabs.push({
      tabName: sheet.title,
      rowCount,
      status,
    });
  }

  // Sort by rowCount descending
  tabs.sort((a, b) => b.rowCount - a.rowCount);
  return tabs;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const doc = await getDoc();

    const [crons, inventoryValue] = await Promise.all([
      getCronStatuses(doc),
      unifiedInventoryService.getInventoryValue(),
    ]);

    const webhooks = getWebhookStatuses();
    const sheets = getSheetTabSizes(doc);

    const legacyReadOnly = (process.env.LEGACY_SHEET_READ_ONLY ?? 'true') === 'true';

    const response: SystemHealthResponse = {
      success: true,
      crons,
      webhooks,
      sheets,
      inventory: {
        portalItemCount: inventoryValue.itemCount,
        legacySyncDirection: legacyReadOnly ? 'portal -> legacy (one-way)' : 'bidirectional (legacy)',
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[system-health] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch system health' },
      { status: 500 },
    );
  }
}
