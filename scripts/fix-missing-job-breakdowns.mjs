/**
 * Create Job_Breakdowns rows for every Invoice that doesn't yet have one.
 * Dedup by invoiceId stored in the breakdown's notes field — bulletproof
 * idempotency, no jobId-empty-string false-positive.
 */
import { config } from 'dotenv';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import crypto from 'crypto';

config({ path: '.env.local', quiet: true });

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, auth);
await doc.loadInfo();

const invoicesSheet = doc.sheetsByTitle['Invoices'];
const breakdownsSheet = doc.sheetsByTitle['Job_Breakdowns'];
const ticketsSheet = doc.sheetsByTitle['Tickets'];

await invoicesSheet.loadHeaderRow();
await breakdownsSheet.loadHeaderRow();
await ticketsSheet.loadHeaderRow();

const invoiceRows = await invoicesSheet.getRows();
const breakdownRows = await breakdownsSheet.getRows();
const ticketRows = await ticketsSheet.getRows();

const ticketRowById = new Map(ticketRows.map(r => [r.get('ticketId'), r]));

// Dedup by invoiceId mentioned in breakdown's notes
const existingInvoiceIds = new Set();
for (const r of breakdownRows) {
  const notes = r.get('notes') || '';
  const m = notes.match(/(INV-\d{8}-\d{4})/);
  if (m) existingInvoiceIds.add(m[1]);
}
console.error(`Existing breakdowns: ${breakdownRows.length} (linked to ${existingInvoiceIds.size} invoices)`);

const toCreate = invoiceRows.filter(inv => {
  const invoiceId = inv.get('invoiceId');
  if (!invoiceId || !invoiceId.startsWith('INV-')) return false;
  if (existingInvoiceIds.has(invoiceId)) return false;
  return true;
});
console.error(`Invoices needing breakdown: ${toCreate.length}`);

async function retry(fn, label, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (err) {
      lastErr = err;
      console.error(`  retry ${i + 1}/${attempts} ${label}: ${(err.message || '').slice(0, 80)}`);
      await new Promise(r => setTimeout(r, 1000 * Math.pow(3, i)));
    }
  }
  throw lastErr;
}

let created = 0;
let errors = 0;

for (let i = 0; i < toCreate.length; i++) {
  const inv = toCreate[i];
  const invoiceId = inv.get('invoiceId');
  const ticketId = inv.get('ticketId');
  const jobId = inv.get('jobId') || '';
  const jobName = inv.get('jobName') || '';
  const customerName = inv.get('customerName') || '';
  const total = parseFloat(inv.get('total') || '0');
  const ticket = ticketRowById.get(ticketId);

  let materialsSummary = '';
  let address = '';
  let createdAt = '';
  let completedAt = '';
  let requestedDate = '';
  if (ticket) {
    try {
      const materials = JSON.parse(ticket.get('materialsJson') || '[]');
      materialsSummary = materials.slice(0, 6).map(m => `${m.quantity || 0} ${m.unit || ''} ${m.productName || m.name || ''}`).join('; ');
    } catch {}
    address = [ticket.get('jobAddress'), ticket.get('city'), ticket.get('state')].filter(Boolean).join(', ');
    createdAt = ticket.get('createdAt') || '';
    completedAt = ticket.get('completedAt') || '';
    requestedDate = ticket.get('requestedDate') || '';
  }

  const breakdownId = `BD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  try {
    await retry(() => breakdownsSheet.addRow({
      breakdownId,
      jobId,
      jobName,
      customerName,
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
      estimatedStartDate: (createdAt || '').slice(0, 10),
      estimatedEndDate: (completedAt || requestedDate || '').slice(0, 10),
      createdBy: 'fix-script-2026-05-20',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: `Auto-created from invoice ${invoiceId} (ticket ${ticketId}). No email sent.`,
    }), `breakdown for ${invoiceId}`);
    created++;
    if ((i + 1) % 20 === 0) console.error(`[${i + 1}/${toCreate.length}] created ${created}, errors ${errors}`);
  } catch (err) {
    errors++;
    console.error(`  FAIL ${invoiceId}: ${err.message}`);
  }
  await new Promise(r => setTimeout(r, 350));
}

console.error(`\n=== JOB BREAKDOWN FIX COMPLETE ===`);
console.error(`Breakdowns created: ${created}`);
console.error(`Errors: ${errors}`);
