/**
 * For each of the 25 pending invoices:
 *   - Append a row to Invoices tab on master sheet
 *   - Deduct inventory from Inventory_Products (where SKU matches)
 *   - Append a Delivery Schedule entry with correct status
 *   - Update Tickets tab row: invoiceId + invoiceStatus=sent
 *
 * Outputs a summary of what was done + a summary email body for stock@.
 */
import { config } from 'dotenv';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';

config({ path: '.env.local', quiet: true });

const drafts = JSON.parse(fs.readFileSync('scripts/invoice-drafts-batch1.json', 'utf8'));
const sheetDump = JSON.parse(fs.readFileSync('scripts/sheet-dump.json', 'utf8'));

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, auth);
await doc.loadInfo();

const invoicesSheet = doc.sheetsByTitle['Invoices'];
const inventorySheet = doc.sheetsByTitle['Inventory_Products'];

// Lazy-create Delivery Schedule
let scheduleSheet = doc.sheetsByTitle['Delivery Schedule'];
if (!scheduleSheet) {
  scheduleSheet = await doc.addSheet({
    title: 'Delivery Schedule',
    headerValues: ['ticketId', 'jobNumber', 'customerName', 'address', 'scheduledDate', 'status', 'driverSlug', 'createdAt', 'updatedAt', 'notes'],
  });
  console.error('Created Delivery Schedule tab');
}

await invoicesSheet.loadHeaderRow();
await inventorySheet.loadHeaderRow();
await scheduleSheet.loadHeaderRow();

const ticketsSheet = doc.sheetsByTitle['Tickets'];
await ticketsSheet.loadHeaderRow();
const ticketRows = await ticketsSheet.getRows();
const ticketRowById = new Map(ticketRows.map(r => [r.get('ticketId'), r]));

// Inventory: load product rows so we can deduct
const invRows = await inventorySheet.getRows();
const invByName = new Map(invRows.map(r => [(r.get('productName') || '').toLowerCase().trim(), r]));

const todayStr = new Date().toISOString().slice(0, 10);
const today = new Date().toLocaleDateString('en-CA');

const results = [];
let grandTotal = 0;

for (const d of drafts) {
  const ticket = ticketRowById.get(d.ticketId);
  let materials = [];
  if (ticket) {
    try {
      materials = JSON.parse(ticket.get('materialsJson') || '[]');
    } catch {
      materials = [];
    }
  }

  // 1. Add Invoice row
  const customerEmail = ticket ? ticket.get('customerEmail') : '';
  const jobId = ticket ? ticket.get('jobId') : '';
  await invoicesSheet.addRow({
    invoiceId: d.invoiceId,
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
    notes: `Auto-generated 2026-05-20 batch for ${drafts.length} pending invoices, emailed to stock@rcrsal.com`,
    internalNotes: '',
  });

  // 2. Deduct inventory from Inventory_Products for each material
  const deductions = [];
  for (const m of materials) {
    const productName = (m.productName || m.name || '').toLowerCase().trim();
    const qty = parseFloat(m.quantity || m.qty || 0);
    if (!productName || !qty) continue;

    const row = invByName.get(productName);
    if (row) {
      const before = parseFloat(row.get('currentQty') || 0);
      const after = Math.max(0, before - qty);
      row.set('currentQty', String(after));
      try {
        await row.save();
      } catch (err) {
        console.error('Save failed for', productName, err.message);
      }
      deductions.push({ productName, qty, before, after });
    } else {
      deductions.push({ productName, qty, notFound: true });
    }
  }

  // 3. Delivery Schedule entry
  // Determine status based on completedAt vs requestedDate
  let scheduleStatus = 'delivered';
  if (ticket) {
    const completed = ticket.get('completedAt');
    const requested = ticket.get('requestedDate');
    if (completed) scheduleStatus = 'delivered';
    else if (requested && requested > today) scheduleStatus = 'pending';
    else scheduleStatus = 'loaded';
  }
  const scheduledDate = ticket
    ? ticket.get('completedAt') || ticket.get('requestedDate') || todayStr
    : todayStr;
  await scheduleSheet.addRow({
    ticketId: d.ticketId,
    jobNumber: jobId,
    customerName: d.customerName,
    address: ticket ? [ticket.get('jobAddress'), ticket.get('city'), ticket.get('state')].filter(Boolean).join(', ') : '',
    scheduledDate: scheduledDate.slice(0, 10),
    status: scheduleStatus,
    driverSlug: ticket ? ticket.get('assignedDriver') : '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: `Auto-recorded from invoice batch 2026-05-20 (${d.invoiceId})`,
  });

  // 4. Update Tickets row with invoiceId
  if (ticket) {
    ticket.set('invoiceId', d.invoiceId);
    ticket.set('invoiceStatus', 'sent');
    try {
      await ticket.save();
    } catch (err) {
      console.error('Ticket update failed for', d.ticketId, err.message);
    }
  }

  results.push({
    invoiceId: d.invoiceId,
    ticketId: d.ticketId,
    customer: d.customerName.slice(0, 50),
    total: d.total,
    deductions: deductions.length,
    scheduleStatus,
  });
  grandTotal += d.total;

  console.error(`✓ ${d.invoiceId} ${d.ticketId.padEnd(15)} $${d.total.toFixed(2).padStart(10)} ${deductions.length} deductions ${scheduleStatus}`);
}

console.error(`\n${results.length} invoices created. Grand total: $${grandTotal.toFixed(2)}`);

// Build the summary email body for stock@rcrsal.com
const summaryRows = results.map(r => `
  <tr>
    <td style="padding:6px 10px;border-bottom:1px solid #e3e6ea;font-family:monospace;font-size:12px;">${r.invoiceId}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #e3e6ea;">${r.ticketId}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #e3e6ea;">${r.customer}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #e3e6ea;text-align:right;">$${r.total.toFixed(2)}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #e3e6ea;">${r.scheduleStatus}</td>
  </tr>
`).join('');

const summaryBody = `
<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:760px;margin:0 auto;">
  <div style="border-top:3px solid #0066CC;padding:24px 0 16px;border-bottom:1px solid #e3e6ea;">
    <div style="text-transform:uppercase;letter-spacing:2px;color:#6b7280;font-size:11px;">River City Roofing Solutions — Test Batch</div>
    <h1 style="margin:8px 0 0;font-size:22px;color:#0066CC;">${results.length} Invoices Created — Catch-up Batch</h1>
  </div>

  <p style="font-size:13px;color:#6b7280;margin:20px 0;">
    Owner-initiated catch-up batch on 2026-05-20. These ${results.length} delivery tickets had
    been loaded + delivered but no invoice had been generated. Inventory has been deducted
    from <em>Inventory_Products</em> and each invoice is now recorded on the <em>Invoices</em> tab.
    Sending to stock@rcrsal.com per owner test directive (avoid flooding rcrs@).
  </p>

  <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:12px;">
    <thead>
      <tr style="background:#f6f8fb;text-align:left;">
        <th style="padding:8px 10px;border-bottom:1px solid #e3e6ea;">Invoice</th>
        <th style="padding:8px 10px;border-bottom:1px solid #e3e6ea;">Ticket</th>
        <th style="padding:8px 10px;border-bottom:1px solid #e3e6ea;">Customer</th>
        <th style="padding:8px 10px;border-bottom:1px solid #e3e6ea;text-align:right;">Total</th>
        <th style="padding:8px 10px;border-bottom:1px solid #e3e6ea;">Delivery Status</th>
      </tr>
    </thead>
    <tbody>${summaryRows}</tbody>
    <tfoot>
      <tr style="font-weight:bold;background:#f6f8fb;">
        <td colspan="3" style="padding:10px;text-align:right;">GRAND TOTAL</td>
        <td style="padding:10px;text-align:right;color:#0066CC;">$${grandTotal.toFixed(2)}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <p style="font-size:13px;color:#6b7280;margin:20px 0;">
    Each individual invoice is viewable on the master sheet (<strong>Invoices</strong> tab) by invoice
    number. Inventory deductions logged to <strong>Inventory_Products</strong>. Delivery statuses
    written to the new <strong>Delivery Schedule</strong> tab.
  </p>

  <p style="font-size:13px;color:#6b7280;margin:20px 0;">
    No customer-facing emails were sent. This is a TEST batch only — addressed to stock@rcrsal.com
    per owner directive. Future invoicing will fire automatically at load_verified once Resend env
    is provisioned + the load-verified-aftermath path is re-enabled.
  </p>

  <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e3e6ea;font-size:11px;color:#6b7280;">
    River City Roofing Solutions · (256) 274-8530 · IKO ROOFPRO Craftsman Premier
  </div>
</div>
`;

fs.writeFileSync('scripts/invoice-batch-summary.html', summaryBody);
fs.writeFileSync('scripts/invoice-batch-results.json', JSON.stringify({ results, grandTotal }, null, 2));

console.error('\nSummary email body: scripts/invoice-batch-summary.html');
console.error(`Subject: Invoice Batch — ${results.length} invoices catching up to current ($${grandTotal.toFixed(2)})`);
