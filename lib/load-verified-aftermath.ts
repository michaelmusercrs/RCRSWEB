/**
 * Load-Verified Aftermath
 *
 * Single source of truth for what happens after a delivery ticket is
 * verified loaded at the warehouse:
 *
 *   1. Write an Invoices row (status='posted') — idempotent per ticketId
 *   2. Write a Job_Breakdowns row if the job has none
 *   3. Deduct each material line from `Inventory_Products` (canonical stock)
 *   4. Dual-write negative transactions to the legacy external inventory
 *      app (no-op when `LEGACY_INVENTORY_SHEETS_ID` is unset)
 *   5. Send a price-only invoice to the office (rcrs@rcrsal.com)
 *
 * This mirrors the auto-finalize cron (`lib/auto-finalize-service.ts`) and
 * the 2026-06-30 backfill exactly — the three paths MUST stay consistent.
 * Historical bug (fixed 2026-07-02): this path used to deduct from the
 * `Inventory` tab (job-materials catalog, NOT stock) and never wrote an
 * Invoices row, so organic verify-load clicks diverged from the cron.
 *
 * Two call sites use this:
 *   - app/api/portal/tickets/route.ts (verify-load case) — when Rick clicks
 *     "Verify Load" in the delivery portal
 *   - app/api/admin/stock-backfill/route.ts — when admin runs the historical
 *     email backfill from /admin/stock-backfill
 *
 * Idempotency: safe to call twice. Invoices are deduped by ticketId,
 * deductions by (ticketId, productName) via Inventory_Deductions_Log.
 */

import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import crypto from 'crypto';
import type { SheetTicket } from './ticket-sheet-service';
import { emailService } from './email-service';
import {
  ensureInventoryDeductionsLogSheet,
  loadDeductionKeySet,
  loadTicketDeductions,
  wasDeducted,
  appendDeductionLog,
  makeDeductionKey,
} from './inventory-deduction-log';

const DEDUCTION_SOURCE = 'load-verified-aftermath';

export interface AftermathResult {
  invoiceCreated: boolean;
  invoiceId: string;
  breakdownCreated: boolean;
  /** True when an EXISTING breakdown had this delivery's price added to it. */
  breakdownUpdated: boolean;
  deductedItems: number;
  missingFromCatalog: string[];
  legacyWritten: number;
  invoiceSent: boolean;
  errors: string[];
}

function num(v: unknown): number {
  return parseFloat(String(v ?? '').replace(/[$,]/g, '')) || 0;
}

async function openMasterDoc(): Promise<GoogleSpreadsheet | null> {
  const sheetsId =
    process.env.GOOGLE_SHEETS_ID ||
    process.env.DELIVERY_SHEETS_ID ||
    process.env.GOOGLE_SHEET_ID;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  if (!sheetsId || !email || !privateKey) return null;
  const auth = new JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(sheetsId, auth);
  await doc.loadInfo();
  return doc;
}

/**
 * Write the Invoices row (idempotent per ticketId) and a Job_Breakdowns row
 * if the job doesn't have one. Same schema + numbering as the auto-finalize
 * cron (`INV-YYYYMMDD-####`, next free sequence for today).
 */
async function writeInvoiceAndBreakdown(
  doc: GoogleSpreadsheet,
  ticket: SheetTicket,
  verifiedAtIso: string,
): Promise<{ invoiceId: string; invoiceCreated: boolean; breakdownCreated: boolean; breakdownUpdated: boolean; error?: string }> {
  const invoicesSheet = doc.sheetsByTitle['Invoices'];
  const breakdownsSheet = doc.sheetsByTitle['Job_Breakdowns'];
  if (!invoicesSheet) {
    return { invoiceId: ticket.ticketId, invoiceCreated: false, breakdownCreated: false, breakdownUpdated: false, error: 'Invoices tab not found' };
  }

  const invoiceRows = await invoicesSheet.getRows({ limit: 100000 });

  // Idempotency: an invoice already exists for this ticket → reuse its id.
  const existing = invoiceRows.find(r => r.get('ticketId') === ticket.ticketId);
  if (existing) {
    return {
      invoiceId: existing.get('invoiceId') || ticket.ticketId,
      invoiceCreated: false,
      breakdownCreated: false,
      breakdownUpdated: false,
    };
  }

  // Collision-proof numbering: next sequence after today's max.
  const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const todayPrefix = `INV-${dateTag}-`;
  let seq = 0;
  for (const r of invoiceRows) {
    const id = r.get('invoiceId') || '';
    if (id.startsWith(todayPrefix)) {
      const n = parseInt(id.slice(todayPrefix.length), 10);
      if (Number.isFinite(n) && n > seq) seq = n;
    }
  }
  const invoiceId = `${todayPrefix}${String(seq + 1).padStart(4, '0')}`;
  const total = num(ticket.totalPrice);

  await invoicesSheet.addRow({
    invoiceId,
    ticketId: ticket.ticketId,
    jobId: ticket.jobId || '',
    jobName: ticket.jobName || '',
    customerName: ticket.customerName || '',
    customerEmail: ticket.customerEmail || '',
    createdAt: verifiedAtIso,
    dueDate: '',
    paidAt: '',
    subtotal: total.toFixed(2),
    taxRate: '0',
    taxAmount: '0.00',
    deliveryFee: '0.00',
    rushFee: '0.00',
    total: total.toFixed(2),
    status: 'posted',
    paymentMethod: '',
    paymentReference: '',
    notes: `Created at verify-load by ${DEDUCTION_SOURCE}. Inventory deducted from Inventory_Products.`,
    internalNotes: '',
  });

  // Breakdown row if the job has none; otherwise increment the existing one.
  let breakdownCreated = false;
  let breakdownUpdated = false;
  if (breakdownsSheet && (ticket.jobId || ticket.jobName)) {
    const breakdownRows = await breakdownsSheet.getRows({ limit: 100000 });
    const bdRow = breakdownRows.find(
      r =>
        (ticket.jobId && r.get('jobId') === ticket.jobId) ||
        (ticket.jobName && r.get('jobName') === ticket.jobName),
    );
    if (!bdRow) {
      const breakdownId = `BD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const materialsSummary = ticket.materials
        .slice(0, 6)
        .map(m => `${m.quantity || 0} ${m.productName || ''}`)
        .join('; ');
      const address = [ticket.jobAddress, ticket.city, ticket.state].filter(Boolean).join(', ');
      await breakdownsSheet.addRow({
        breakdownId,
        jobId: ticket.jobId || '',
        jobName: ticket.jobName || '',
        customerName: ticket.customerName || '',
        address,
        projectType: 'delivery',
        status: 'auto-created',
        materials: materialsSummary,
        labor: '',
        materialTotal: total.toFixed(2),
        laborTotal: '',
        deliveryFees: '0',
        overhead: '',
        profit: '',
        totalEstimate: total.toFixed(2),
        estimatedStartDate: (ticket.createdAt || verifiedAtIso).slice(0, 10),
        estimatedEndDate: (ticket.createdAt || verifiedAtIso).slice(0, 10),
        createdBy: DEDUCTION_SOURCE,
        createdAt: verifiedAtIso,
        updatedAt: verifiedAtIso,
        notes: `Auto-created from delivery ticket ${ticket.ticketId}. Linked invoice ${invoiceId}.`,
      });
      breakdownCreated = true;
    } else {
      // 2nd+ delivery for a job that already has a breakdown: add THIS
      // delivery's price to the material figures instead of silently
      // skipping (a second load used to never reach the breakdown at all).
      // Idempotent: we only get here when a NEW invoice was just created for
      // this ticket — the invoice dedup gate above early-returns on retries,
      // so the same delivery can never be added twice.
      const prevMaterial = num(bdRow.get('materialTotal'));
      const prevEstimate = num(bdRow.get('totalEstimate'));
      bdRow.set('materialTotal', (prevMaterial + total).toFixed(2));
      bdRow.set('totalEstimate', (prevEstimate + total).toFixed(2));
      bdRow.set('updatedAt', verifiedAtIso);
      const bdNote = `+$${total.toFixed(2)} materials from delivery ticket ${ticket.ticketId} (invoice ${invoiceId}).`;
      bdRow.set('notes', [bdRow.get('notes') || '', bdNote].filter(Boolean).join('\n'));
      await bdRow.save();
      breakdownUpdated = true;
    }
  }

  return { invoiceId, invoiceCreated: true, breakdownCreated, breakdownUpdated };
}

/**
 * Deduct material lines from `Inventory_Products` (canonical stock).
 * Matches by productName (lowercased) first, productId fallback — same as
 * the auto-finalize cron. Idempotent via Inventory_Deductions_Log.
 */
async function deductFromStock(
  doc: GoogleSpreadsheet,
  ticketId: string,
  materials: SheetTicket['materials'],
  invoiceIdHint?: string,
): Promise<{ deducted: number; missing: string[]; skippedIdempotent: number; error?: string }> {
  const invProdSheet = doc.sheetsByTitle['Inventory_Products'];
  if (!invProdSheet) {
    return {
      deducted: 0,
      missing: materials.map(m => m.productName || m.productId).filter(Boolean) as string[],
      skippedIdempotent: 0,
      error: 'Inventory_Products tab not found',
    };
  }
  const rows = await invProdSheet.getRows({ limit: 100000 });
  const byName = new Map(rows.map(r => [(r.get('productName') || '').toLowerCase().trim(), r]));
  const byId = new Map(rows.map(r => [r.get('productId'), r]));

  // Defense-in-depth: check Inventory_Deductions_Log so a duplicate
  // verify-load click (or a retry of a partially-completed aftermath run)
  // can never double-decrement. Same key format as the cron + .mjs scripts.
  await ensureInventoryDeductionsLogSheet(doc);
  const deductedKeys = await loadDeductionKeySet(doc);

  const missing: string[] = [];
  let deducted = 0;
  let skippedIdempotent = 0;
  for (const m of materials) {
    const productName = (m.productName || '').toLowerCase().trim();
    const qty = num(m.quantity);
    if (!qty || (!productName && !m.productId)) continue;
    if (productName && wasDeducted(deductedKeys, ticketId, productName)) {
      skippedIdempotent++;
      continue;
    }

    const row = byName.get(productName) || byId.get(m.productId || '');
    if (!row) {
      missing.push(m.productName || m.productId || 'unknown');
      continue;
    }
    const before = num(row.get('currentQty'));
    const after = Math.max(0, before - qty);
    const unitCost = num(row.get('unitCost'));
    row.set('currentQty', String(after));
    row.set('totalValue', (after * unitCost).toFixed(2));
    await row.save();
    deducted++;

    if (productName) {
      await appendDeductionLog(doc, {
        ticketId,
        productName,
        productId: row.get('productId') || '',
        qtyBefore: before,
        qtyAfter: after,
        qtyDelta: -qty,
        invoiceId: invoiceIdHint,
        source: DEDUCTION_SOURCE,
      });
      // Claim the key in-memory regardless of audit-write outcome.
      deductedKeys.add(makeDeductionKey(ticketId, productName));
    }
  }
  return { deducted, missing, skippedIdempotent };
}

/**
 * Run the full load-verified aftermath for a single ticket. Safe to call
 * twice — invoice write and deductions are both idempotent.
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

  const result: AftermathResult = {
    invoiceCreated: false,
    invoiceId: ticket.ticketId,
    breakdownCreated: false,
    breakdownUpdated: false,
    deductedItems: 0,
    missingFromCatalog: [],
    legacyWritten: 0,
    invoiceSent: false,
    errors,
  };

  const doc = await openMasterDoc();
  if (!doc) {
    errors.push('Google Sheets credentials not configured');
    return result;
  }

  // 1+2. Invoices row (idempotent) + Job_Breakdowns row if missing.
  try {
    const inv = await writeInvoiceAndBreakdown(doc, ticket, verifiedAtIso);
    result.invoiceId = inv.invoiceId;
    result.invoiceCreated = inv.invoiceCreated;
    result.breakdownCreated = inv.breakdownCreated;
    result.breakdownUpdated = inv.breakdownUpdated;
    if (inv.error) errors.push(`Invoice: ${inv.error}`);
  } catch (err) {
    errors.push(`Invoice threw: ${String(err)}`);
  }

  // 3. Deduct from Inventory_Products — skipped entirely for other_vendor
  //    tickets (those materials never entered our stock).
  if (ticket.orderSource !== 'other_vendor') {
    try {
      const ded = await deductFromStock(doc, ticket.ticketId, ticket.materials, result.invoiceId);
      result.deductedItems = ded.deducted;
      result.missingFromCatalog = ded.missing;
      if (ded.skippedIdempotent > 0) {
        console.warn(
          `[load-verified-aftermath] Skipped ${ded.skippedIdempotent} already-deducted material(s) for ticket ${ticket.ticketId}`,
        );
      }
      if (ded.error) errors.push(`Deduction: ${ded.error}`);
    } catch (err) {
      errors.push(`Deduction threw: ${String(err)}`);
    }
  }

  // 4. (REMOVED 2026-08-18) Legacy Inventory-tab transaction dual-write.
  // Was a no-op (item- filter never matched INV-* ids) and schema-conflicting:
  // the sync-inventory-tab cron rewrites that tab as full catalog state every
  // 15 min, wiping any transaction rows. The cron is the sole Portal->legacy
  // mirror. Field kept at 0 for back-compat with AftermathResult consumers.
  result.legacyWritten = 0;

  // 5. Price-only office email. Skipped when silent=true (backfill mode).
  if (!silent) {
    try {
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
        invoiceId: result.invoiceId,
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
      result.invoiceSent = res.success;
      if (!res.success && res.error) errors.push(`Invoice email: ${res.error}`);
    } catch (err) {
      errors.push(`Invoice email threw: ${String(err)}`);
    }
  }

  return result;
}

export interface UndoVerifyLoadResult {
  restored: number;
  restoredItems: Array<{ productName: string; qty: number }>;
  errors: string[];
}

/**
 * Reverse the INVENTORY effect of an accidental verify-load: for every material
 * still net-deducted for this ticket, add the quantity back to Inventory_Products
 * and append a matching POSITIVE reversal row to Inventory_Deductions_Log (so the
 * log nets to zero and a later re-verify deducts again exactly once).
 *
 * Deliberately does NOT touch the Invoices row, Job_Breakdowns, or the
 * interoffice Job_Material_Costs invoice. The aftermath's invoice dedup matches
 * any existing row per ticketId, so a re-verify REUSES the same invoice and does
 * NOT re-increment the breakdown — meaning the money side needs no reversal here,
 * only the stock does. (Caller is responsible for moving the ticket status back
 * to materials_pulled.)
 *
 * Idempotent: once reversed, loadTicketDeductions returns [] so a repeat call is
 * a safe no-op. Order mirrors the deduction path (save inventory, then log) and
 * accepts the same rare partial-failure window — a failed reversal-log append is
 * surfaced in `errors` for operator reconciliation.
 */
export async function undoVerifyLoad(ticket: SheetTicket): Promise<UndoVerifyLoadResult> {
  const result: UndoVerifyLoadResult = { restored: 0, restoredItems: [], errors: [] };
  const doc = await openMasterDoc();
  if (!doc) { result.errors.push('Sheets not configured'); return result; }

  const invProdSheet = doc.sheetsByTitle['Inventory_Products'];
  if (!invProdSheet) { result.errors.push('Inventory_Products tab not found'); return result; }

  const deductions = await loadTicketDeductions(doc, ticket.ticketId);
  if (deductions.length === 0) return result; // nothing currently deducted — no-op

  const rows = await invProdSheet.getRows({ limit: 100000 });
  const byName = new Map(rows.map(r => [(r.get('productName') || '').toLowerCase().trim(), r]));
  const byId = new Map(rows.map(r => [r.get('productId'), r]));

  for (const d of deductions) {
    const qtyToRestore = Math.abs(d.netQty);
    if (!qtyToRestore) continue;
    const key = (d.productName || '').toLowerCase().trim();
    const row = byName.get(key) || byId.get(d.productId || '');
    if (!row) { result.errors.push(`No Inventory_Products row for ${d.productName}`); continue; }
    const before = num(row.get('currentQty'));
    const after = before + qtyToRestore;
    const unitCost = num(row.get('unitCost'));
    row.set('currentQty', String(after));
    row.set('totalValue', (after * unitCost).toFixed(2));
    try {
      await row.save();
    } catch (e) {
      result.errors.push(`Restore failed for ${d.productName}: ${String(e)}`);
      continue;
    }
    // Positive reversal row zeroes the net so a re-verify re-deducts once.
    const logged = await appendDeductionLog(doc, {
      ticketId: ticket.ticketId,
      productName: d.productName,
      productId: d.productId,
      qtyBefore: before,
      qtyAfter: after,
      qtyDelta: qtyToRestore, // positive = restored
      invoiceId: d.lastInvoiceId,
      source: 'undo-verify-load',
    });
    if (!logged) {
      result.errors.push(
        `Stock restored for ${d.productName} but the reversal-log row failed to write — ` +
        `verify the deduction log before re-running to avoid a double restore.`,
      );
    }
    result.restored++;
    result.restoredItems.push({ productName: d.productName, qty: qtyToRestore });
  }
  return result;
}
