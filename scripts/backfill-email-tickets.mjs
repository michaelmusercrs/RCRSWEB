/**
 * Email-webhook ticket backfill
 *
 * For every Tickets row with createdBy='email-webhook' and status='created':
 *   1. Sum up the materials per productId
 *   2. Decrement the Inventory tab's currentQty + totalValue
 *   3. Mark the ticket status='load_verified' + loadVerifiedAt/By
 *   4. Write a snapshot to a NEW sheet 'Inventory_Snapshot_<YYYY-MM-DD_HHMM>'
 *      that captures the post-deduction state of every inventory item
 *
 * Idempotent: tickets already at load_verified are skipped.
 *
 * Usage: node scripts/backfill-email-tickets.mjs
 */
import fs from 'fs';
import path from 'path';

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

if (!ticketsTab) throw new Error('Tickets tab not found');
if (!invTab) throw new Error('Inventory tab not found');

// ──────────────────────────────────────────────────────────────────────────
// Step 1: find pending email-webhook tickets
// ──────────────────────────────────────────────────────────────────────────
const ticketRows = await ticketsTab.getRows();
const pending = ticketRows.filter(
  r => r.get('createdBy') === 'email-webhook' && r.get('status') === 'created'
);
console.log(`Found ${pending.length} pending email-webhook tickets`);

if (pending.length === 0) {
  console.log('Nothing to backfill. Exiting.');
  process.exit(0);
}

// ──────────────────────────────────────────────────────────────────────────
// Step 2: aggregate deductions per productId
// ──────────────────────────────────────────────────────────────────────────
const deductions = new Map(); // productId -> qty to deduct
const ticketLineCounts = [];

for (const row of pending) {
  const ticketId = row.get('ticketId');
  const refNum = row.get('referenceNumber');
  let materials = [];
  try {
    materials = JSON.parse(row.get('materialsJson') || '[]');
  } catch (e) {
    console.warn(`  ${ticketId} — bad materialsJson, skipping`);
    continue;
  }

  let counted = 0;
  for (const m of materials) {
    if (!m.productId || !m.quantity) continue;
    // Only catalog-matched productIds (start with INV- or item-) deduct
    if (!m.productId.startsWith('INV-') && !m.productId.startsWith('item-')) continue;
    deductions.set(m.productId, (deductions.get(m.productId) || 0) + m.quantity);
    counted++;
  }
  ticketLineCounts.push({ ticketId, refNum, counted, total: materials.length });
}

console.log('\nPer-ticket material line counts:');
ticketLineCounts.forEach(t =>
  console.log(`  ${t.ticketId} (${t.refNum}): ${t.counted}/${t.total} lines matched to catalog`)
);

console.log(`\nAggregated deductions across ${pending.length} tickets:`);
for (const [pid, qty] of deductions) {
  console.log(`  ${pid}: -${qty}`);
}

// ──────────────────────────────────────────────────────────────────────────
// Step 3: apply deductions to Inventory tab
// ──────────────────────────────────────────────────────────────────────────
const invRows = await invTab.getRows();
const beforeAfter = []; // for snapshot

for (const invRow of invRows) {
  const pid = invRow.get('productId');
  const before = parseFloat(invRow.get('currentQty')) || 0;
  const unitCost = parseFloat(invRow.get('unitCost')) || 0;
  const deductQty = deductions.get(pid) || 0;
  const after = Math.max(0, before - deductQty);

  if (deductQty > 0) {
    invRow.set('currentQty', String(after));
    invRow.set('totalValue', (after * unitCost).toFixed(2));
    invRow.set('lastRestockDate', invRow.get('lastRestockDate') || '');
    await invRow.save();
    console.log(`  Inventory ${pid}: ${before} -> ${after}  (deducted ${deductQty})`);
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
// Step 4: mark tickets load_verified
// ──────────────────────────────────────────────────────────────────────────
const nowIso = new Date().toISOString();
for (const row of pending) {
  row.set('status', 'load_verified');
  // Best-effort — Tickets tab may not have these columns; ignored if missing
  try {
    row.set('completedAt', nowIso);
  } catch (e) { /* column doesn't exist, that's fine */ }
  await row.save();
}
console.log(`\nMarked ${pending.length} tickets as load_verified`);

// ──────────────────────────────────────────────────────────────────────────
// Step 5: write snapshot sheet
// ──────────────────────────────────────────────────────────────────────────
const dt = new Date();
const stamp = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}_${String(dt.getHours()).padStart(2, '0')}${String(dt.getMinutes()).padStart(2, '0')}`;
const snapshotTitle = `Inventory_Snapshot_${stamp}`;

const totalAfter = beforeAfter.reduce((s, r) => s + r.afterValue, 0);
const totalDeducted = beforeAfter.reduce((s, r) => s + r.deducted, 0);

const newSheet = await doc.addSheet({
  title: snapshotTitle,
  headerValues: [
    'productId',
    'productName',
    'sku',
    'unit',
    'beforeQty',
    'deducted',
    'afterQty',
    'unitCost',
    'afterValue',
  ],
});

await newSheet.addRows(beforeAfter);

console.log(`\nSnapshot written to tab "${snapshotTitle}"`);
console.log(`  Rows: ${beforeAfter.length}`);
console.log(`  Total units deducted: ${totalDeducted}`);
console.log(`  Inventory value after deductions: $${totalAfter.toFixed(2)}`);
console.log('\nDone.');
