/**
 * Load-Verified Aftermath
 *
 * Single source of truth for what happens after a delivery ticket is
 * verified loaded at the warehouse:
 *
 *   1. Deduct each material line from the master `Inventory` tab
 *   2. Dual-write negative transactions to the legacy external inventory
 *      app (no-op when `LEGACY_INVENTORY_SHEETS_ID` is unset)
 *   3. Send a price-only invoice to the office (rcrs@rcrsal.com)
 *
 * Two call sites use this:
 *   - app/api/portal/tickets/route.ts (verify-load case) — when Rick clicks
 *     "Verify Load" in the delivery portal
 *   - app/api/admin/stock-backfill/route.ts — when admin runs the historical
 *     email backfill from /admin/stock-backfill
 *
 * Idempotency: callers should check ticket status before invoking so this
 * isn't run twice for the same ticket. The deduction itself is NOT
 * idempotent (each call subtracts again).
 */

import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import type { SheetTicket } from './ticket-sheet-service';
import { inventoryTabSync } from './inventory-tab-sync';
import { emailService } from './email-service';
import { jobMaterialCostService } from './job-material-cost-service';

export interface AftermathResult {
  deductedItems: number;
  missingFromCatalog: string[];
  legacyWritten: number;
  invoiceSent: boolean;
  invoiceId: string;
  errors: string[];
}

async function deductFromMasterInventory(
  materials: SheetTicket['materials'],
): Promise<{ deducted: number; missing: string[]; error?: string }> {
  const sheetsId = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!sheetsId || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !privateKey) {
    return {
      deducted: 0,
      missing: materials.map(m => m.productId),
      error: 'Google Sheets credentials not configured',
    };
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
    return {
      deducted: 0,
      missing: materials.map(m => m.productId),
      error: 'Master Inventory tab not found',
    };
  }
  const rows = await invSheet.getRows();

  const missing: string[] = [];
  let deducted = 0;
  for (const m of materials) {
    if (!m.productId) continue;
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

/**
 * Run the full load-verified aftermath for a single ticket. Caller is
 * responsible for idempotency (don't call twice for the same ticket).
 */
export async function runLoadVerifiedAftermath(input: {
  ticket: SheetTicket;
  verifiedAtIso: string;
  verifiedByName: string;
  notesPrefix?: string;
  // When true, skip the office-invoice email. Used for historical backfill
  // where materials were physically delivered months ago and an email today
  // would be noise. Inventory is still deducted and invoice records still
  // written — only the outbound email is suppressed.
  silent?: boolean;
}): Promise<AftermathResult> {
  const { ticket, verifiedAtIso, verifiedByName, notesPrefix, silent } = input;
  const errors: string[] = [];

  // 1. Deduct from master Inventory tab
  let deductedItems = 0;
  let missingFromCatalog: string[] = [];
  try {
    const result = await deductFromMasterInventory(ticket.materials);
    deductedItems = result.deducted;
    missingFromCatalog = result.missing;
    if (result.error) errors.push(`Deduction: ${result.error}`);
  } catch (err) {
    errors.push(`Deduction threw: ${String(err)}`);
  }

  // 2. Mirror to legacy external inventory app (no-op if env unset)
  let legacyWritten = 0;
  try {
    const legacyResult = await inventoryTabSync.pushTransactions({
      referenceNumber: ticket.referenceNumber,
      timestamp: verifiedAtIso,
      lines: ticket.materials
        .filter(m => m.productId && m.productId.startsWith('item-'))
        .map(m => ({
          itemId: m.productId,
          amount: -Math.abs(m.quantity),
          unitPrice: m.unitPrice,
        })),
    });
    legacyWritten = legacyResult.written;
    if (legacyResult.error) errors.push(`Legacy sync: ${legacyResult.error}`);
  } catch (err) {
    errors.push(`Legacy sync threw: ${String(err)}`);
  }

  // 3. Resolve invoice ID then send the price-only office email
  //    Skip the email entirely when silent=true (historical backfill mode).
  //    Inventory deduction + invoice record still happen — only the outbound
  //    email is suppressed.
  let invoiceSent = false;
  let invoiceId = ticket.ticketId;
  try {
    const invoiceRecords = await jobMaterialCostService.getByTicket(ticket.ticketId);
    const interofficeInvoice = invoiceRecords.find(r => r.type === 'invoice');
    if (interofficeInvoice?.invoiceId) invoiceId = interofficeInvoice.invoiceId;

    if (silent) {
      // Silent mode: invoice record exists (or will be created by job-material-cost-service
      // elsewhere); we just don't email the office. Mark "sent" as false but no error.
      invoiceSent = false;
    } else {
      const fullAddress = [ticket.jobAddress, ticket.city, ticket.state]
        .filter(Boolean)
        .join(', ');
      const materialsForEmail = ticket.materials.map(m => ({
        name: m.productName,
        qty: m.quantity,
        unitPrice: m.unitPrice || 0,
        linePrice: m.totalPrice ?? (m.unitPrice || 0) * m.quantity,
      }));
      const totalPrice = materialsForEmail.reduce((sum, m) => sum + m.linePrice, 0);

      const notes = notesPrefix
        ? `${notesPrefix}${ticket.notes ? ' — ' + ticket.notes : ''}`
        : ticket.notes;

      const res = await emailService.sendLoadVerifiedInvoice({
        ticketId: ticket.ticketId,
        invoiceId,
        jobNumber: ticket.referenceNumber,
        customerName: ticket.customerName || '',
        address: fullAddress,
        salesRepName: ticket.createdByName || '',
        verifiedByName,
        verifiedAt: verifiedAtIso,
        materials: materialsForEmail,
        totalPrice: Math.round(totalPrice * 100) / 100,
        notes,
      });
      invoiceSent = res.success;
      if (!res.success && res.error) errors.push(`Invoice email: ${res.error}`);
    }
  } catch (err) {
    errors.push(`Invoice email threw: ${String(err)}`);
  }

  return {
    deductedItems,
    missingFromCatalog,
    legacyWritten,
    invoiceSent,
    invoiceId,
    errors,
  };
}
