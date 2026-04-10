/**
 * Inventory Tab → Tickets Sync Cron
 *
 * The reverse half of the 2-way sync. The portal already pushes new
 * tickets into the legacy `Inventory` tab on every create. This cron
 * handles the OTHER direction: when Richard's inventory app adds rows
 * directly to the `Inventory` tab (via the standalone app, not the
 * portal), this poll detects new R# values and creates matching ticket
 * rows in the `Tickets` tab so the portal sees the same picture.
 *
 * Trigger: GET /api/cron/sync-inventory-tab
 * Auth: CRON_SECRET header OR admin/owner session
 * Schedule (vercel.json): every 10 minutes
 *   { "path": "/api/cron/sync-inventory-tab", "schedule": "* /10 * * * *" }
 *
 * SILENT — does NOT send notifications, does NOT create interoffice
 * invoices, does NOT email anyone. Pure data sync. The reasoning: rows
 * added to the Inventory tab by Richard's app already represent live
 * material movement that he physically handled — by the time we see them,
 * the action is in the past and notifying is just noise.
 *
 * Idempotent — re-running upserts the same ticket rows.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import {
  ticketSheetService,
  type SheetTicket,
  type TicketMaterial,
} from '@/lib/ticket-sheet-service';
import { unifiedInventoryService } from '@/lib/unified-inventory-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;
// MUST be the standalone inventory app's sheet, NOT the master rcrsal sheet.
// See lib/inventory-tab-sync.ts for the same guard. If unset, the cron
// returns "not configured" without doing any reads — safe default.
const SHEETS_ID = process.env.LEGACY_INVENTORY_SHEETS_ID;

const LEGACY_TAB = 'Inventory';
const EXCLUDE_REFS = new Set(['1234']); // restock pseudo-ref

interface LegacyRow {
  inventoryId: string;
  itemId: string;
  dateTime: string;
  amount: number;
  referenceNumber: string;
}

function excelSerialToIso(serial: number | string): string {
  const n = typeof serial === 'number' ? serial : parseFloat(String(serial));
  if (!Number.isFinite(n)) return new Date().toISOString();
  const ms = (n - 25569) * 86400 * 1000;
  return new Date(ms).toISOString();
}

async function fetchLegacyRows(): Promise<LegacyRow[]> {
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

  const sheet = doc.sheetsByTitle[LEGACY_TAB];
  if (!sheet) return [];

  const rows = await sheet.getRows();
  const out: LegacyRow[] = [];
  for (const row of rows) {
    const ref = String(row.get('R#') || '').trim();
    const item = String(row.get('Item ID') || '').trim();
    const amountRaw = row.get('Amount');
    const amount = typeof amountRaw === 'number' ? amountRaw : parseFloat(String(amountRaw || '0'));
    if (!ref || !item || !Number.isFinite(amount) || amount === 0) continue;
    out.push({
      inventoryId: String(row.get('Inventory ID') || '').trim(),
      itemId: item,
      dateTime: excelSerialToIso(row.get('DateTime')),
      amount,
      referenceNumber: ref,
    });
  }
  return out;
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

  // If the legacy sheet ID isn't set, this cron is a no-op. The new ticket
  // persistence still works without it.
  if (!SHEETS_ID) {
    return NextResponse.json({
      success: true,
      configured: false,
      message: 'LEGACY_INVENTORY_SHEETS_ID not set — sync is disabled. Set the env var to the inventory app spreadsheet ID to enable.',
    });
  }

  try {
    // Fetch the entire legacy Inventory tab + the existing Tickets we know about.
    const [legacyRows, existingTickets, catalog] = await Promise.all([
      fetchLegacyRows(),
      ticketSheetService.getAll(),
      unifiedInventoryService.getInventory(),
    ]);

    const existingTicketIds = new Set(existingTickets.map(t => t.ticketId));
    const catalogById = new Map(catalog.map(c => [c.productId, c] as const));

    // Group legacy rows by R#
    const byRef = new Map<string, LegacyRow[]>();
    for (const r of legacyRows) {
      if (EXCLUDE_REFS.has(r.referenceNumber)) continue;
      if (!byRef.has(r.referenceNumber)) byRef.set(r.referenceNumber, []);
      byRef.get(r.referenceNumber)!.push(r);
    }

    // Build tickets for any R# not yet in the Tickets tab
    const newTickets: SheetTicket[] = [];
    for (const [refNumber, rows] of byRef.entries()) {
      const deliveryId = `TKT-${refNumber}`;
      const creditMemoId = `CM-${refNumber}`;

      // Sort rows oldest-first
      rows.sort((a, b) => a.dateTime.localeCompare(b.dateTime));

      const negatives = rows.filter(r => r.amount < 0);
      const positives = rows.filter(r => r.amount > 0);

      // Aggregate by item for the delivery side
      if (negatives.length > 0 && !existingTicketIds.has(deliveryId)) {
        const byItem = new Map<string, { qty: number; firstId: string }>();
        for (const r of negatives) {
          const existing = byItem.get(r.itemId);
          if (existing) {
            existing.qty += Math.abs(r.amount);
          } else {
            byItem.set(r.itemId, { qty: Math.abs(r.amount), firstId: r.inventoryId });
          }
        }
        const materials: TicketMaterial[] = [];
        let totalCost = 0;
        let totalPrice = 0;
        for (const [itemId, agg] of byItem) {
          const cat = catalogById.get(itemId);
          const unitCost = cat?.unitCost || 0;
          const unitPrice = cat?.unitPrice || 0;
          const lineCost = Math.round(unitCost * agg.qty * 100) / 100;
          const linePrice = Math.round(unitPrice * agg.qty * 100) / 100;
          materials.push({
            productId: itemId,
            productName: cat?.productName || itemId,
            quantity: agg.qty,
            unitCost,
            unitPrice,
            totalCost: lineCost,
            totalPrice: linePrice,
          });
          totalCost += lineCost;
          totalPrice += linePrice;
        }
        if (materials.length > 0) {
          newTickets.push({
            ticketId: deliveryId,
            ticketType: 'delivery',
            status: 'completed',
            referenceNumber: refNumber,
            createdAt: negatives[0].dateTime,
            completedAt: negatives[negatives.length - 1].dateTime,
            createdBy: 'inventory-app-sync',
            createdByName: 'Inventory App Sync',
            materials,
            totalCost: Math.round(totalCost * 100) / 100,
            totalPrice: Math.round(totalPrice * 100) / 100,
            notes: 'Auto-synced from legacy Inventory tab. Created by Richard\'s inventory app.',
            sourceTransactionId: negatives[0].inventoryId,
          });
        }
      }

      // Same logic for the return side → credit memo
      if (positives.length > 0 && !existingTicketIds.has(creditMemoId)) {
        const byItem = new Map<string, { qty: number; firstId: string }>();
        for (const r of positives) {
          const existing = byItem.get(r.itemId);
          if (existing) {
            existing.qty += r.amount;
          } else {
            byItem.set(r.itemId, { qty: r.amount, firstId: r.inventoryId });
          }
        }
        const materials: TicketMaterial[] = [];
        let totalCost = 0;
        let totalPrice = 0;
        for (const [itemId, agg] of byItem) {
          const cat = catalogById.get(itemId);
          const unitCost = cat?.unitCost || 0;
          const unitPrice = cat?.unitPrice || 0;
          const lineCost = Math.round(unitCost * agg.qty * 100) / 100;
          const linePrice = Math.round(unitPrice * agg.qty * 100) / 100;
          materials.push({
            productId: itemId,
            productName: cat?.productName || itemId,
            quantity: agg.qty,
            unitCost,
            unitPrice,
            totalCost: lineCost,
            totalPrice: linePrice,
          });
          totalCost += lineCost;
          totalPrice += linePrice;
        }
        if (materials.length > 0) {
          newTickets.push({
            ticketId: creditMemoId,
            ticketType: 'return',
            status: 'completed',
            referenceNumber: refNumber,
            createdAt: positives[0].dateTime,
            completedAt: positives[positives.length - 1].dateTime,
            createdBy: 'inventory-app-sync',
            createdByName: 'Inventory App Sync',
            materials,
            totalCost: Math.round(totalCost * 100) / 100,
            totalPrice: Math.round(totalPrice * 100) / 100,
            notes: 'Credit memo: materials returned to warehouse. Auto-synced from legacy Inventory tab.',
            sourceTransactionId: positives[0].inventoryId,
          });
        }
      }
    }

    if (newTickets.length === 0) {
      return NextResponse.json({
        success: true,
        legacyRowsScanned: legacyRows.length,
        uniqueRefs: byRef.size,
        newTicketsCreated: 0,
        message: 'Nothing new to sync',
      });
    }

    const result = await ticketSheetService.upsertMany(newTickets);
    return NextResponse.json({
      success: result.failed === 0,
      legacyRowsScanned: legacyRows.length,
      uniqueRefs: byRef.size,
      newTicketsCreated: result.written,
      failed: result.failed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
