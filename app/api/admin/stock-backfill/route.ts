/**
 * Stock Backfill — historical Material Order email catch-up
 *
 * Use case: when first turning on the email→ticket pipeline, the
 * stock@rcrsal.com inbox already contains weeks/months of Material Order
 * PDFs that were physically delivered long ago. Once the Apps Script
 * forwarder runs `resetAllLabels` and re-forwards them, the webhook creates
 * one ticket per email in status='created'. This route finishes the lifecycle
 * for every such ticket in one shot:
 *
 *   for each ticket where status='created':
 *     1. deduct stock from the master Inventory tab
 *     2. update Tickets row to status='load_verified' + loadVerifiedAt/By
 *     3. dual-write -negative transactions into the legacy Inventory app
 *     4. send a price-only invoice to rcrs@rcrsal.com (the office inbox)
 *
 * Idempotent: tickets already past 'created' status are skipped, so running
 * twice has the same effect as running once.
 *
 * Auth: admin only. The page that calls it (/portal/admin/stock-backfill)
 * is owner/admin only too.
 *
 * GET  /api/admin/stock-backfill            → preview: list pending tickets
 * POST /api/admin/stock-backfill            → process them all
 *      Body (optional): { ticketIds?: string[] } to limit to specific tickets
 */

import { NextRequest, NextResponse } from 'next/server';
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { requireAdmin } from '@/lib/auth-service';
import { ticketSheetService, type SheetTicket } from '@/lib/ticket-sheet-service';
import { inventoryTabSync } from '@/lib/inventory-tab-sync';
import { emailService } from '@/lib/email-service';
import { jobMaterialCostService } from '@/lib/job-material-cost-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface BackfillResult {
  ticketId: string;
  jobNumber: string;
  customerName: string;
  materialsCount: number;
  totalPrice: number;
  status: 'processed' | 'skipped' | 'failed';
  reason?: string;
}

/**
 * Deduct material quantities from the master Sheet's `Inventory` tab.
 * Standalone (does not depend on delivery-workflow-service.getTicketRow,
 * which reads a different tab). Mirrors the deductInventory logic from
 * that service so backfilled tickets land in the same place as live ones.
 */
async function deductFromMasterInventory(
  materials: SheetTicket['materials'],
): Promise<{ deducted: number; missing: string[] }> {
  const sheetsId = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!sheetsId || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !privateKey) {
    return { deducted: 0, missing: materials.map(m => m.productId) };
  }

  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(sheetsId, auth);
  await doc.loadInfo();
  const invSheet = doc.sheetsByTitle['Inventory'];
  if (!invSheet) {
    return { deducted: 0, missing: materials.map(m => m.productId) };
  }
  const rows = await invSheet.getRows();

  const missing: string[] = [];
  let deducted = 0;
  for (const m of materials) {
    const row = rows.find(r => r.get('productId') === m.productId);
    if (!row) {
      missing.push(m.productId);
      continue;
    }
    const currentQty = parseFloat(row.get('currentQty')) || 0;
    const newQty = Math.max(0, currentQty - m.quantity);
    const unitCost = parseFloat(row.get('unitCost')) || 0;
    row.set('currentQty', newQty.toString());
    row.set('totalValue', (newQty * unitCost).toFixed(2));
    await row.save();
    deducted++;
  }
  return { deducted, missing };
}

async function getPendingTickets(specificIds?: string[]): Promise<SheetTicket[]> {
  const all = await ticketSheetService.getAll();
  return all.filter(t => {
    if (t.status !== 'created') return false;
    if (t.ticketType !== 'delivery') return false;
    if (specificIds && specificIds.length > 0 && !specificIds.includes(t.ticketId)) return false;
    return true;
  });
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const pending = await getPendingTickets();
    return NextResponse.json({
      success: true,
      pendingCount: pending.length,
      tickets: pending.map(t => ({
        ticketId: t.ticketId,
        jobNumber: t.referenceNumber,
        customerName: t.customerName || '',
        materialsCount: t.materials?.length || 0,
        totalPrice: t.totalPrice || 0,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  let body: { ticketIds?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    /* no body, process all */
  }

  const performedBy = auth.user?.userId || 'system-backfill';
  const performedByName = auth.user?.name || 'Stock Backfill';

  try {
    const pending = await getPendingTickets(body.ticketIds);
    const results: BackfillResult[] = [];

    for (const ticket of pending) {
      const baseResult: BackfillResult = {
        ticketId: ticket.ticketId,
        jobNumber: ticket.referenceNumber,
        customerName: ticket.customerName || '',
        materialsCount: ticket.materials?.length || 0,
        totalPrice: ticket.totalPrice || 0,
        status: 'processed',
      };

      try {
        const verifiedAt = new Date().toISOString();

        // 1. Deduct from master Inventory tab
        const { deducted, missing } = await deductFromMasterInventory(ticket.materials);

        // 2. Mark Tickets row as load_verified (idempotent — updateStatus
        //    is safe to call repeatedly; this is also what writes
        //    loadVerifiedAt / loadVerifiedBy on the sheet)
        await ticketSheetService.updateStatus(
          ticket.ticketId,
          'load_verified',
        );

        // 3. Mirror to the legacy external inventory app (no-op if env unset)
        try {
          await inventoryTabSync.pushTransactions({
            referenceNumber: ticket.referenceNumber,
            timestamp: verifiedAt,
            lines: ticket.materials
              .filter(m => m.productId.startsWith('item-'))
              .map(m => ({
                itemId: m.productId,
                amount: -Math.abs(m.quantity),
                unitPrice: m.unitPrice,
              })),
          });
        } catch (legacyErr) {
          console.warn('[stock-backfill] Legacy mirror skipped:', legacyErr);
        }

        // 4. Send price-only invoice to office (rcrs@rcrsal.com)
        const invoiceRecords = await jobMaterialCostService.getByTicket(ticket.ticketId);
        const interofficeInvoice = invoiceRecords.find(r => r.type === 'invoice');
        const invoiceId = interofficeInvoice?.invoiceId || ticket.ticketId;

        const fullAddress = [ticket.jobAddress, ticket.city, ticket.state].filter(Boolean).join(', ');
        const materialsForEmail = ticket.materials.map(m => ({
          name: m.productName,
          qty: m.quantity,
          unitPrice: m.unitPrice || 0,
          linePrice: m.totalPrice ?? (m.unitPrice || 0) * m.quantity,
        }));
        const totalPriceCalc = materialsForEmail.reduce((sum, m) => sum + m.linePrice, 0);

        await emailService.sendLoadVerifiedInvoice({
          ticketId: ticket.ticketId,
          invoiceId,
          jobNumber: ticket.referenceNumber,
          customerName: ticket.customerName || '',
          address: fullAddress,
          salesRepName: ticket.createdByName || '',
          verifiedByName: performedByName,
          verifiedAt,
          materials: materialsForEmail,
          totalPrice: Math.round(totalPriceCalc * 100) / 100,
          notes: ticket.notes ? `BACKFILL: ${ticket.notes}` : 'Historical backfill — materials delivered prior to this app going live.',
        });

        if (missing.length > 0) {
          baseResult.reason = `Deducted ${deducted}/${ticket.materials.length}; missing in catalog: ${missing.join(', ')}`;
        }
        results.push(baseResult);
      } catch (err) {
        baseResult.status = 'failed';
        baseResult.reason = String(err);
        results.push(baseResult);
      }
    }

    const summary = {
      total: results.length,
      processed: results.filter(r => r.status === 'processed').length,
      failed: results.filter(r => r.status === 'failed').length,
      performedBy: performedByName,
      performedAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, summary, results });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    );
  }
}
