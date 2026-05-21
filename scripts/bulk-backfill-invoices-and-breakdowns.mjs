/**
 * Bulk backfill: for every real delivery ticket without an invoice,
 *   - Write an invoice row to Invoices tab
 *   - Write a job breakdown row to Job_Breakdowns tab
 *   - Write a Delivery Schedule row with correct status
 *   - Tag source ticket on Tickets tab with invoiceId
 *
 * Inventory deduction rule (per owner concern about historical_close snapshot):
 *   - Tickets with createdAt >= 2026-05-15 → DEDUCT inventory
 *   - Tickets older than 2026-05-15 → DO NOT deduct (snapshot already accounted)
 *
 * NO EMAILS for bulk creation per owner directive.
 *
 * Idempotent — skips tickets that already have an invoice (matched by ticketId).
 * Retry-with-backoff on transient sheet API errors.
 * Slow pacing (≈400ms between writes) to stay under per-minute write quota.
 */
import { config } from 'dotenv';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import crypto from 'crypto';

config({ path: '.env.local', quiet: true });

const HISTORICAL_CLOSE_CUTOFF = '2026-05-15';

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, auth);
await doc.loadInfo();

const invoicesSheet = doc.sheetsByTitle['Invoices'];
const inventorySheet = doc.sheetsByTitle['Inventory_Products'];
const scheduleSheet = doc.sheetsByTitle['Delivery Schedule'];
const ticketsSheet = doc.sheetsByTitle['Tickets'];
const breakdownsSheet = doc.sheetsByTitle['Job_Breakdowns'];

await invoicesSheet.loadHeaderRow();
await inventorySheet.loadHeaderRow();
await scheduleSheet.loadHeaderRow();
await ticketsSheet.loadHeaderRow();
await breakdownsSheet.loadHeaderRow();

const existingInvoiceRows = await invoicesSheet.getRows();
const alreadyInvoicedTickets = new Set(
  existingInvoiceRows.map(r => r.get('ticketId')).filter(Boolean)
);
console.error(`Existing invoiced tickets: ${alreadyInvoicedTickets.size}`);

const existingBreakdownRows = await breakdownsSheet.getRows();
const alreadyBrokenDownByJobId = new Set(
  existingBreakdownRows.map(r => r.get('jobId')).filter(Boolean)
);
const alreadyBrokenDownByJobName = new Set(
  existingBreakdownRows.map(r => r.get('jobName')).filter(Boolean)
);

const invRows = await inventorySheet.getRows();
const invByName = new Map(invRows.map(r => [(r.get('productName') || '').toLowerCase().trim(), r]));

const ticketRows = await ticketsSheet.getRows();
const ticketRowById = new Map(ticketRows.map(r => [r.get('ticketId'), r]));

async function retry(fn, label, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (err) {
      lastErr = err;
      const msg = (err.message || '').slice(0, 80);
      console.error(`  retry ${i + 1}/${attempts} ${label}: ${msg}`);
      // exponential backoff: 1s, 3s, 9s, 27s
      const delay = 1000 * Math.pow(3, i);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

const drafts = JSON.parse(fs.readFileSync('scripts/invoice-drafts.json', 'utf8'));
console.error(`Total candidate drafts: ${drafts.length}`);

const todayIso = new Date().toISOString().slice(0, 10);
let counter = 100; // start INV-20260520-0100 to not collide with first batch (which used 0001..0025)
const results = { invoiced: 0, brokenDown: 0, deducted: 0, skippedDedup: 0, errors: 0 };
let grandTotal = 0;

for (let idx = 0; idx < drafts.length; idx++) {
  const d = drafts[idx];

  if (alreadyInvoicedTickets.has(d.ticketId)) {
    results.skippedDedup++;
    if (idx % 25 === 0) console.error(`[${idx + 1}/${drafts.length}] skip ${d.ticketId} (already invoiced)`);
    continue;
  }

  const invoiceId = `INV-20260520-${String(counter).padStart(4, '0')}`;
  counter++;

  const ticket = ticketRowById.get(d.ticketId);
  let materials = [];
  if (ticket) {
    try { materials = JSON.parse(ticket.get('materialsJson') || '[]'); } catch {}
  }

  const customerEmail = ticket ? ticket.get('customerEmail') : '';
  const jobId = ticket ? ticket.get('jobId') : '';
  const createdAt = ticket ? ticket.get('createdAt') : '';
  const completedAt = ticket ? ticket.get('completedAt') : '';
  const requestedDate = ticket ? ticket.get('requestedDate') : '';

  // Determine if we should deduct inventory
  const ticketDate = (createdAt || '').slice(0, 10);
  const shouldDeduct = ticketDate && ticketDate >= HISTORICAL_CLOSE_CUTOFF;

  // 1. Invoice row
  try {
    await retry(() => invoicesSheet.addRow({
      invoiceId,
      ticketId: d.ticketId,
      jobId,
      jobName: d.jobName,
      customerName: d.customerName,
      customerEmail,
      createdAt: new Date().toISOString(),
      dueDate: '',
      paidAt: '',
      subtotal: d.total.toFixed(2),
      taxRate: '0',
      taxAmount: '0.00',
      deliveryFee: '0.00',
      rushFee: '0.00',
      total: d.total.toFixed(2),
      status: 'posted',
      paymentMethod: '',
      paymentReference: '',
      notes: `Bulk backfill 2026-05-20. ${shouldDeduct ? 'Inventory deducted.' : 'Inventory NOT deducted (predates 2026-05-15 historical_close snapshot).'} No email sent.`,
      internalNotes: '',
    }), `invoice ${invoiceId}`);
    results.invoiced++;
    grandTotal += d.total;
  } catch (err) {
    console.error(`  INVOICE FAIL ${d.ticketId}: ${err.message}`);
    results.errors++;
    continue;
  }
  await new Promise(r => setTimeout(r, 400));

  // 2. Job Breakdown row
  if (!alreadyBrokenDownByJobId.has(jobId) && !alreadyBrokenDownByJobName.has(d.jobName)) {
    const breakdownId = `BD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const materialsSummary = materials.slice(0, 6).map(m => `${m.quantity || 0} ${m.unit || ''} ${m.productName || m.name || ''}`).join('; ');
    try {
      await retry(() => breakdownsSheet.addRow({
        breakdownId,
        jobId,
        jobName: d.jobName,
        customerName: d.customerName,
        address: ticket ? [ticket.get('jobAddress'), ticket.get('city'), ticket.get('state')].filter(Boolean).join(', ') : '',
        projectType: 'delivery',
        status: 'auto-created',
        materials: materialsSummary,
        labor: '',
        materialTotal: d.total.toFixed(2),
        laborTotal: '',
        deliveryFees: '0',
        overhead: '',
        profit: '',
        totalEstimate: d.total.toFixed(2),
        estimatedStartDate: (createdAt || '').slice(0, 10),
        estimatedEndDate: (completedAt || requestedDate || '').slice(0, 10),
        createdBy: 'bulk-backfill-2026-05-20',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: `Auto-created from delivery ticket ${d.ticketId}. Linked invoice ${invoiceId}.`,
      }), `breakdown ${breakdownId}`);
      results.brokenDown++;
      alreadyBrokenDownByJobId.add(jobId);
      alreadyBrokenDownByJobName.add(d.jobName);
    } catch (err) {
      console.error(`  BREAKDOWN FAIL ${d.ticketId}: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 400));
  }

  // 3. Delivery Schedule
  let scheduleStatus = 'delivered';
  if (completedAt) scheduleStatus = 'delivered';
  else if (requestedDate && requestedDate > todayIso) scheduleStatus = 'pending';
  else scheduleStatus = 'loaded';
  const scheduledDate = (completedAt || requestedDate || todayIso).slice(0, 10);
  try {
    await retry(() => scheduleSheet.addRow({
      ticketId: d.ticketId,
      jobNumber: jobId,
      customerName: d.customerName,
      address: ticket ? [ticket.get('jobAddress'), ticket.get('city'), ticket.get('state')].filter(Boolean).join(', ') : '',
      scheduledDate,
      status: scheduleStatus,
      driverSlug: ticket ? ticket.get('assignedDriver') : '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: `Bulk backfill (${invoiceId})`,
    }), `schedule ${d.ticketId}`);
  } catch (err) {
    console.error(`  SCHEDULE FAIL ${d.ticketId}: ${err.message}`);
  }
  await new Promise(r => setTimeout(r, 400));

  // 4. Tag source ticket
  if (ticket) {
    ticket.set('invoiceId', invoiceId);
    ticket.set('invoiceStatus', 'posted-no-email');
    try {
      await retry(() => ticket.save(), `ticket-tag ${d.ticketId}`);
    } catch (err) {
      console.error(`  TICKET TAG FAIL ${d.ticketId}: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 400));
  }

  // 5. Inventory deduct (conditional)
  if (shouldDeduct) {
    for (const m of materials) {
      const productName = (m.productName || m.name || '').toLowerCase().trim();
      const qty = parseFloat(m.quantity || m.qty || 0);
      if (!productName || !qty) continue;
      const row = invByName.get(productName);
      if (!row) continue;
      const before = parseFloat(row.get('currentQty') || 0);
      const after = Math.max(0, before - qty);
      row.set('currentQty', String(after));
      try {
        await retry(() => row.save(), `deduct ${productName}`);
        results.deducted++;
      } catch (err) {
        console.error(`  deduct fail ${productName}: ${err.message}`);
      }
      await new Promise(r => setTimeout(r, 400));
    }
  }

  if ((idx + 1) % 20 === 0) {
    console.error(`[${idx + 1}/${drafts.length}] progress: ${results.invoiced} inv, ${results.brokenDown} bd, ${results.deducted} ded, ${results.skippedDedup} skip, ${results.errors} err`);
  }
}

console.error(`\n=== BULK BACKFILL COMPLETE ===`);
console.error(`Invoices created: ${results.invoiced}`);
console.error(`Job breakdowns created: ${results.brokenDown}`);
console.error(`Inventory deductions: ${results.deducted}`);
console.error(`Skipped (already invoiced): ${results.skippedDedup}`);
console.error(`Errors: ${results.errors}`);
console.error(`Grand total invoiced: $${grandTotal.toFixed(2)}`);

fs.writeFileSync('scripts/bulk-backfill-results.json', JSON.stringify({ ...results, grandTotal }, null, 2));
