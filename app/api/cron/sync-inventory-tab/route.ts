/**
 * Inventory Sync Cron — Portal → Legacy (One-Way)
 *
 * Legacy sheet is READ-ONLY mirror. All writes go through
 * unified-inventory-service. Rick uses /portal/inventory/restock
 * instead of editing the legacy sheet directly.
 *
 * Previously this cron also read FROM the legacy Inventory tab and
 * created tickets in the portal (legacy → portal direction). That
 * direction has been disabled. The env var LEGACY_SHEET_READ_ONLY
 * (default: 'true') gates the old legacy→portal read path. When
 * 'true' the cron only pushes portal state to the legacy sheet so
 * Rick's standalone app can read it.
 *
 * Trigger: GET /api/cron/sync-inventory-tab
 * Auth: CRON_SECRET header OR admin/owner session
 * Schedule (vercel.json): every 10 minutes
 *   { "path": "/api/cron/sync-inventory-tab", "schedule": "* /10 * * * *" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { unifiedInventoryService } from '@/lib/unified-inventory-service';
import { withCronLock } from '@/lib/cron-lock';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;
// MUST be the standalone inventory app's sheet, NOT the master rcrsal sheet.
// If unset, the cron returns "not configured" without doing any writes — safe default.
const SHEETS_ID = process.env.LEGACY_INVENTORY_SHEETS_ID;

// When 'true' (the default), the legacy sheet is treated as read-only from the
// portal's perspective — we WRITE to it but never read FROM it to create tickets.
const LEGACY_READ_ONLY = (process.env.LEGACY_SHEET_READ_ONLY ?? 'true') === 'true';

const LEGACY_TAB = 'Inventory';

/**
 * Push the current portal inventory state to the legacy Inventory tab
 * so Rick's standalone app can read from it.
 */
async function pushPortalToLegacy(): Promise<{
  written: number;
  errors: string[];
}> {
  if (!SHEETS_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Missing Google Sheets credentials');
  }

  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(SHEETS_ID, auth);
  await doc.loadInfo();

  let sheet = doc.sheetsByTitle[LEGACY_TAB];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: LEGACY_TAB,
      headerValues: ['Item ID', 'Product Name', 'Category', 'Current Qty', 'Unit', 'Unit Cost', 'Unit Price', 'Location', 'Supplier', 'Last Updated'],
    });
  }

  const catalog = await unifiedInventoryService.getInventory();
  const errors: string[] = [];

  // Clear existing data rows and rewrite — ensures legacy sheet is a
  // perfect mirror of portal state with no stale rows.
  const existingRows = await sheet.getRows();
  if (existingRows.length > 0) {
    // Delete rows from bottom up to avoid index shifting issues
    for (let i = existingRows.length - 1; i >= 0; i--) {
      try {
        await existingRows[i].delete();
      } catch (err) {
        errors.push(`Failed to delete legacy row ${i}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  let written = 0;
  for (const item of catalog) {
    try {
      await sheet.addRow({
        'Item ID': item.productId,
        'Product Name': item.productName,
        'Category': item.category,
        'Current Qty': String(item.currentQty),
        'Unit': item.unit,
        'Unit Cost': String(item.unitCost),
        'Unit Price': String(item.unitPrice),
        'Location': item.location,
        'Supplier': item.supplier,
        'Last Updated': new Date().toISOString(),
      });
      written++;
    } catch (err) {
      errors.push(`Failed to write ${item.productId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { written, errors };
}

export async function GET(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get('authorization') || '';
  const isVercelCron = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (!isVercelCron) {
    const { requireAuth } = await import('@/lib/auth-service');
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    if (!['admin', 'owner'].includes(auth.user.role)) {
      return NextResponse.json(
        { error: 'CRON_SECRET header or admin/owner role required' },
        { status: 403 },
      );
    }
  }

  return withCronLock('sync-inventory-tab', { staleMinutes: 15 }, async () => {
    // If the legacy sheet ID isn't set, this cron is a no-op.
    if (!SHEETS_ID) {
      return NextResponse.json({
        success: true,
        configured: false,
        message: 'LEGACY_INVENTORY_SHEETS_ID not set — sync is disabled. Set the env var to the inventory app spreadsheet ID to enable.',
      });
    }

    const start = Date.now();

    try {
      // ── Portal → Legacy (push portal inventory to legacy sheet for Rick) ──
      const pushResult = await pushPortalToLegacy();

      // ── Legacy → Portal (DISABLED by default) ───────────────────────────
      // Previously this cron read rows from the legacy Inventory tab and
      // created ticket rows in the portal. That path is now disabled because
      // the legacy sheet is a READ-ONLY mirror maintained by this cron.
      // Rick uses /portal/inventory/restock to add stock, which flows
      // through unified-inventory-service and automatically mirrors here.
      //
      // To re-enable the old legacy→portal read path (NOT recommended),
      // set LEGACY_SHEET_READ_ONLY=false in the environment.
      let legacyReadResult: { message: string } = {
        message: 'Legacy→portal read DISABLED (LEGACY_SHEET_READ_ONLY=true). All writes go through unified-inventory-service.',
      };

      if (!LEGACY_READ_ONLY) {
        legacyReadResult = {
          message: 'Legacy→portal read path is enabled but has been removed from this cron. Set LEGACY_SHEET_READ_ONLY=true (default) to suppress this message.',
        };
      }

      const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
      await recordCronHeartbeat('sync-inventory-tab', 'success', Date.now() - start, `Pushed ${pushResult.written} items to legacy sheet`);

      return NextResponse.json({
        success: pushResult.errors.length === 0,
        syncDirection: 'portal → legacy (one-way)',
        legacyReadOnly: LEGACY_READ_ONLY,
        portalToLegacy: {
          itemsWritten: pushResult.written,
          errors: pushResult.errors.length > 0 ? pushResult.errors : undefined,
        },
        legacyToPortal: legacyReadResult,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      try {
        const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
        await recordCronHeartbeat('sync-inventory-tab', 'error', Date.now() - start, message);
      } catch { /* heartbeat failure should not mask the real error */ }
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  });
}
