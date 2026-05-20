/**
 * Resume invoice posting. Idempotent — skips ticketIds already invoiced.
 * Retries each sheet op up to 3 times with exponential backoff.
 */
import { config } from 'dotenv';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';

config({ path: '.env.local', quiet: true });

const drafts = JSON.parse(fs.readFileSync('scripts/invoice-drafts-batch1.json', 'utf8'));

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

await invoicesSheet.loadHeaderRow();
await inventorySheet.loadHeaderRow();
await scheduleSheet.loadHeaderRow();
await ticketsSheet.loadHeaderRow();

const existingInvoiceRows = await invoicesSheet.getRows();
const alreadyInvoicedTickets = new Set(
  existingInvoiceRows.map(r => r.get('ticketId')).filter(Boolean)
);
console.error(`Existing invoiced tickets: ${alreadyInvoicedTickets.size}`);

const invRows = await inventorySheet.getRows();
const invByName = new Map(invRows.map(r => [(r.get('productName') || '').toLowerCase().trim(), r]));

const ticketRows = await ticketsSheet.getRows();
const ticketRowById = new Map(ticketRows.map(r => [r.get('ticketId'), r]));

async function retry(fn, label, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.error(`  retry ${i + 1}/${attempts} for ${label}: ${err.message?.slice(0, 100)}`);
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

const todayStr = new Date().toISOString().slice(0, 10);
const today = new Date().toLocaleDateString('en-CA');

const results = [];
let grandTotal = 0;
let nextInvoiceCounter = 14; // continue from #14

for (const d of drafts) {
  if (alreadyInvoicedTickets.has(d.ticketId)) {
    console.error(`SKIP ${d.ticketId} — already invoiced`);
    continue;
  }

  const invoiceId = `INV-20260520-${String(nextInvoiceCounter).padStart(4, '0')}`;
  nextInvoiceCounter++;

  const ticket = ticketRowById.get(d.ticketId);
  let materials = [];
  if (ticket) {
    try { materials = JSON.parse(ticket.get('materialsJson') || '[]'); } catch {}
  }

  const customerEmail = ticket ? ticket.get('customerEmail') : '';
  const jobId = ticket ? ticket.get('jobId') : '';

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
      status: 'sent',
      paymentMethod: '',
      paymentReference: '',
      notes: `Auto-generated 2026-05-20 batch (catch-up)`,
      internalNotes: '',
    }), `add invoice ${invoiceId}`);
  } catch (err) {
    console.error(`FAILED to add invoice ${invoiceId}: ${err.message}`);
    continue;
  }

  // Deduct inventory
  let deductCount = 0;
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
      deductCount++;
    } catch (err) {
      console.error(`  deduct fail ${productName}: ${err.message}`);
    }
  }

  // Delivery Schedule entry
  let scheduleStatus = 'delivered';
  if (ticket) {
    const completed = ticket.get('completedAt');
    const requested = ticket.get('requestedDate');
    if (completed) scheduleStatus = 'delivered';
    else if (requested && requested > today) scheduleStatus = 'pending';
    else scheduleStatus = 'loaded';
  }
  const scheduledDate = ticket
    ? (ticket.get('completedAt') || ticket.get('requestedDate') || todayStr).slice(0, 10)
    : todayStr;
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
      notes: `Auto-recorded from invoice batch (${invoiceId})`,
    }), `delivery schedule ${d.ticketId}`);
  } catch (err) {
    console.error(`  schedule fail ${d.ticketId}: ${err.message}`);
  }

  // Update Tickets row
  if (ticket) {
    ticket.set('invoiceId', invoiceId);
    ticket.set('invoiceStatus', 'sent');
    try {
      await retry(() => ticket.save(), `ticket update ${d.ticketId}`);
    } catch (err) {
      console.error(`  ticket save fail ${d.ticketId}: ${err.message}`);
    }
  }

  results.push({ invoiceId, ticketId: d.ticketId, customer: d.customerName.slice(0, 40), total: d.total, deductCount, scheduleStatus });
  grandTotal += d.total;
  console.error(`✓ ${invoiceId} ${d.ticketId.padEnd(15)} $${d.total.toFixed(2).padStart(10)} ${deductCount}d ${scheduleStatus}`);

  // Light pacing — avoid hammering sheets
  await new Promise(r => setTimeout(r, 250));
}

console.error(`\nNew invoices created this run: ${results.length}`);
console.error(`Grand total this run: $${grandTotal.toFixed(2)}`);
fs.writeFileSync('scripts/invoice-batch-results-resume.json', JSON.stringify({ results, grandTotal }, null, 2));
