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
import { enqueueReviewRequest } from './review-request-queue';

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

  // 4. Enqueue a customer review-request (sweep/review-automation).
  //
  // We enqueue here at load_verified so the queue has a record the
  // moment materials leave the warehouse. The actual email DOES NOT
  // fire from this path — it fires from the daily cron
  // /api/cron/review-request-queue, which drains rows whose `sendAfter`
  // has elapsed, and only when ENABLE_REVIEW_REQUESTS=true.
  //
  // TODO(owner): decide the timing model.
  //   Option A — delay-based (current default): sendAfter = now +
  //     REVIEW_REQUEST_DELAY_DAYS (default 3 days). Cron drains when
  //     the timer is up. Simple but doesn't know the job actually
  //     wrapped on the customer end.
  //   Option B — completion-gated: cron only drains rows whose
  //     corresponding ticket is in status 'completed'. Tighter ask, but
  //     depends on PMs actually marking tickets completed.
  //   Option C — fire-immediately at load_verified. Risky — load_verified
  //     is "materials loaded onto Rick's truck", NOT "job done". Asking
  //     for a Google review while the truck is still pulling out of the
  //     warehouse is a terrible look. NOT recommended.
  //
  // If/when Option C is ever desired, the actual emailService.sendReviewRequest()
  // call would go HERE (after the enqueue), gated by an env or a config flag.
  // For this pass we ship Option A as the default and let the owner flip
  // the timing knob without touching code.
  //
  // Suppressed in `silent` mode — historical backfill should never queue a
  // months-old job for a "leave us a review" email.
  if (!silent) {
    try {
      const fullAddress = [ticket.jobAddress, ticket.city, ticket.state]
        .filter(Boolean)
        .join(', ');
      // Best-guess project type from the ticket. Most delivery tickets are
      // roofing material runs; if the ticket has a more specific projectType
      // field downstream we can refine this later.
      const projectType = ticket.notes && /repair|tarp|gutter|siding/i.test(ticket.notes)
        ? 'project'
        : 'new roof';
      if (ticket.customerEmail && ticket.customerEmail.includes('@')) {
        const result = await enqueueReviewRequest({
          ticketId: ticket.ticketId,
          jobNumber: ticket.referenceNumber,
          customerName: ticket.customerName || '',
          customerEmail: ticket.customerEmail,
          projectAddress: fullAddress,
          projectType,
          // sendAfter omitted — defaults to now + REVIEW_REQUEST_DELAY_DAYS
        });
        if (!result.enqueued && result.reason && result.reason !== 'already-queued') {
          errors.push(`Review queue: ${result.reason}`);
        }
      }
    } catch (err) {
      errors.push(`Review enqueue threw: ${String(err)}`);
    }
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
