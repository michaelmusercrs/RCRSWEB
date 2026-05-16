/**
 * One-off historical batch close-out — 2026-05-15
 *
 * Closes out the 17 historical email-webhook tickets currently in 'created'
 * status, walking each through the full lifecycle to 'completed':
 *   1. Aggregate material deductions per productId
 *   2. Decrement Inventory tab (currentQty + totalValue)
 *   3. Write a 'JobMaterialCosts' invoice row per ticket (so Sara can
 *      reconcile and so the job breakdown picks it up)
 *   4. Mark Tickets row status='completed', completedAt=now
 *   5. Write a post-deduction Inventory snapshot tab for audit
 *
 * Excludes the newest ticket (TKT-R-10997, Leanna Hooper) because that
 * physical delivery is on Rick's Monday schedule. After Rick verifies the
 * load Monday morning, the live load-verified flow will handle it normally
 * (with the office email).
 *
 * NO EMAILS are sent by this script. All 17 materials were delivered weeks
 * to months ago; an email today would be noise.
 *
 * Idempotent at the ticket level: already-completed tickets are skipped, so
 * re-running is safe.
 *
 * Usage:
 *   cd ~/river-city-roofing
 *   node scripts/backfill-historical-batch-2026-05-15.mjs
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ──────────────────────────────────────────────────────────────────────────
// Load .env.local
// ──────────────────────────────────────────────────────────────────────────
const envPath = path.join(process.cwd(), '.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
});

const { JWT } = await import('google-auth-library');
const { GoogleSpreadsheet } = await import('google-spreadsheet');

// ──────────────────────────────────────────────────────────────────────────
// Config — the one ticket NOT to touch
// ──────────────────────────────────────────────────────────────────────────
const EXCLUDE_TICKET_ID = 'TKT-R-10997'; // Leanna Hooper — Rick handles Monday 2026-05-18
const PERFORMED_BY = 'historical-backfill-script';
const PERFORMED_BY_NAME = 'Historical Backfill (2026-05-15)';
const NOTES_PREFIX = 'BACKFILL — historical Material Order email processed after the fact. Materials physically delivered weeks/months ago. No outbound email.';

// ──────────────────────────────────────────────────────────────────────────
// Auth + load workbook
// ──────────────────────────────────────────────────────────────────────────
const sheetsId = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
  key: privateKey?.trim(),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(sheetsId, auth);
await doc.loadInfo();

const ticketsTab = doc.sheetsByTitle['Tickets'];
const invTab = doc.sheetsByTitle['Inventory'];
const costsTab = doc.sheetsByTitle['Job_Material_Costs'];

if (!ticketsTab) throw new Error("'Tickets' tab not found");
if (!invTab) throw new Error("'Inventory' tab not found");
if (!costsTab) throw new Error("'Job_Material_Costs' tab not found");

// ──────────────────────────────────────────────────────────────────────────
// Step 1: identify the 17 pending tickets to close out
// ──────────────────────────────────────────────────────────────────────────
const ticketRows = await ticketsTab.getRows();
const pending = ticketRows.filter(
  r => r.get('createdBy') === 'email-webhook'
    && r.get('status') === 'created'
    && r.get('ticketId') !== EXCLUDE_TICKET_ID
);

console.log(`Found ${pending.length} historical tickets to close out`);
console.log(`Excluding: ${EXCLUDE_TICKET_ID} (Rick handles Monday)`);

if (pending.length === 0) {
  console.log('Nothing to do. Exiting.');
  process.exit(0);
}

console.log('\nTickets that will be processed:');
pending.forEach(r => {
  console.log(`  ${r.get('ticketId')} | ${r.get('referenceNumber')} | ${r.get('customerName')?.slice(0, 50)}`);
});

// ──────────────────────────────────────────────────────────────────────────
// Step 2: aggregate deductions per productId across all 17 tickets
// ──────────────────────────────────────────────────────────────────────────
const deductions = new Map();
for (const row of pending) {
  let materials = [];
  try {
    materials = JSON.parse(row.get('materialsJson') || '[]');
  } catch {
    console.warn(`  ${row.get('ticketId')} — bad materialsJson, skipping its materials`);
    continue;
  }
  for (const m of materials) {
    if (!m.productId || !m.quantity) continue;
    if (!m.productId.startsWith('INV-') && !m.productId.startsWith('item-')) continue;
    deductions.set(m.productId, (deductions.get(m.productId) || 0) + m.quantity);
  }
}

console.log(`\nAggregate deductions across the 17 tickets:`);
for (const [pid, qty] of deductions) {
  console.log(`  ${pid}: -${qty}`);
}

// ──────────────────────────────────────────────────────────────────────────
// Step 3: apply deductions to Inventory tab
// ──────────────────────────────────────────────────────────────────────────
console.log('\nApplying deductions to Inventory tab:');
const invRows = await invTab.getRows();
const beforeAfter = [];
for (const invRow of invRows) {
  const pid = invRow.get('productId');
  const before = parseFloat(invRow.get('currentQty')) || 0;
  const unitCost = parseFloat(invRow.get('unitCost')) || 0;
  const deductQty = deductions.get(pid) || 0;
  const after = Math.max(0, before - deductQty);
  if (deductQty > 0) {
    invRow.set('currentQty', String(after));
    invRow.set('totalValue', (after * unitCost).toFixed(2));
    await invRow.save();
    console.log(`  ${pid}: ${before} -> ${after}  (deducted ${deductQty})`);
  }
  beforeAfter.push({
    productId: pid,
    productName: invRow.get('productName'),
    sku: invRow.get('sku'),
    unit: invRow.get('unit'),
    beforeQty: before,
    deducted: deductQty,
    afterQty: after,
    unitCost,
    afterValue: Math.round(after * unitCost * 100) / 100,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Step 4: For each ticket — write JobMaterialCosts invoice row + mark completed
// ──────────────────────────────────────────────────────────────────────────
console.log('\nWriting invoice records + marking tickets completed:');
const nowIso = new Date().toISOString();
const stampDate = nowIso.slice(0, 10).replace(/-/g, '');

for (const row of pending) {
  const ticketId = row.get('ticketId');
  const refNum = row.get('referenceNumber');
  const customerName = row.get('customerName') || '';
  const customerAddress = row.get('jobAddress') || '';
  const salesRepName = row.get('createdByName') || '';

  let materials = [];
  try { materials = JSON.parse(row.get('materialsJson') || '[]'); } catch {}

  // Build the invoice line items
  const lines = materials.map(m => ({
    productId: m.productId,
    productName: m.productName,
    quantity: m.quantity,
    unitCost: m.unitCost || 0,
    unitPrice: m.unitPrice || 0,
    totalCost: (m.unitCost || 0) * (m.quantity || 0),
    totalPrice: m.totalPrice ?? (m.unitPrice || 0) * (m.quantity || 0),
  }));

  const totalCost = lines.reduce((s, l) => s + l.totalCost, 0);

  // Invoice ID using existing JMC-YYYYMMDD-XXXXXX convention
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  const invoiceId = `JMC-${stampDate}-${rand}`;

  // Write invoice row to JobMaterialCosts
  await costsTab.addRow({
    invoiceId,
    type: 'invoice',
    status: 'posted',
    ticketId,
    referenceNumber: refNum,
    jobId: row.get('jobId') || '',
    jobNumber: refNum,
    jobName: row.get('jobName') || '',
    customerName,
    customerAddress,
    salesRepName,
    linesJson: JSON.stringify(lines),
    totalCost: totalCost.toFixed(2),
    createdAt: nowIso,
    createdBy: PERFORMED_BY,
    createdByName: PERFORMED_BY_NAME,
    postedAt: nowIso,
    notes: NOTES_PREFIX,
  });

  // Advance the ticket to terminal status
  row.set('status', 'completed');
  try { row.set('completedAt', nowIso); } catch { /* column optional */ }
  await row.save();

  console.log(`  ${ticketId} (${refNum}) -> completed  | invoice ${invoiceId}  | totalCost $${totalCost.toFixed(2)}`);
}

// ──────────────────────────────────────────────────────────────────────────
// Step 5: snapshot of inventory state post-deduction
// ──────────────────────────────────────────────────────────────────────────
const dt = new Date();
const stamp = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}_${String(dt.getHours()).padStart(2, '0')}${String(dt.getMinutes()).padStart(2, '0')}`;
const snapshotTitle = `Inventory_Snapshot_${stamp}_historical_close`;

const totalAfter = beforeAfter.reduce((s, r) => s + r.afterValue, 0);
const totalDeducted = beforeAfter.reduce((s, r) => s + r.deducted, 0);

const newSheet = await doc.addSheet({
  title: snapshotTitle,
  headerValues: [
    'productId', 'productName', 'sku', 'unit',
    'beforeQty', 'deducted', 'afterQty', 'unitCost', 'afterValue',
  ],
});
await newSheet.addRows(beforeAfter);

console.log(`\nSnapshot written: "${snapshotTitle}"`);
console.log(`  Rows: ${beforeAfter.length}`);
console.log(`  Total units deducted: ${totalDeducted}`);
console.log(`  Inventory value after: $${totalAfter.toFixed(2)}`);

console.log('\n=== Backfill complete ===');
console.log(`  Tickets advanced to 'completed':  ${pending.length}`);
console.log(`  Invoice rows written:             ${pending.length}`);
console.log(`  Kept at 'created' for Rick:       ${EXCLUDE_TICKET_ID}`);
console.log(`  Emails sent:                      0 (intentional)`);
