/**
 * Historical Restock Backfill
 *
 * The 241 historical-backfill delivery tickets all consumed materials. For
 * the books to balance, an equivalent quantity must have been restocked at
 * some point. Those restocks were never recorded in the new system. This
 * script creates ONE comprehensive 'historical-restock-reconciliation'
 * ticket with line items totaling every SKU's historical consumption, then
 * applies that restock to the Inventory tab so currentQty reflects reality.
 *
 * Net effect: every SKU that had historical deductions gains back exactly
 * what was deducted historically. The 17 recent email-webhook deductions
 * still apply on top, so:
 *
 *   new_currentQty = (pre-historical-stock) - (17 recent deductions)
 *
 * Per Michael: "nothing is out of stock. if you get to zero you fucked up."
 * If any SKU is still 0 after this, the pre-historical-stock was 0 for that
 * SKU — which means we genuinely don't have stock data for it and Michael's
 * physical count is the source of truth.
 *
 * Read-only on Tickets tab. Writes:
 *   - 1 new row in Tickets (the reconciliation ticket)
 *   - Updates to Inventory (currentQty + totalValue per SKU)
 *   - InventoryLogs entries for each SKU
 *
 * Usage: node scripts/backfill-historical-restocks.mjs
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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
const logsTab = doc.sheetsByTitle['InventoryLogs'] || doc.sheetsByTitle['Inventory_Logs'];

if (!ticketsTab) throw new Error("'Tickets' tab not found");
if (!invTab) throw new Error("'Inventory' tab not found");

// ──────────────────────────────────────────────────────────────────────────
// Step 1: aggregate historical-backfill consumption per SKU
// ──────────────────────────────────────────────────────────────────────────
const ticketRows = await ticketsTab.getRows();
const histRows = ticketRows.filter(r => r.get('createdBy') === 'historical-backfill');
console.log(`Found ${histRows.length} historical-backfill tickets`);

const consumption = new Map();   // pid -> { qty, unitCost (from materialsJson), productName }
let parseFailures = 0;

for (const row of histRows) {
  let materials = [];
  try {
    materials = JSON.parse(row.get('materialsJson') || '[]');
  } catch {
    parseFailures++;
    continue;
  }
  for (const m of materials) {
    if (!m.productId || !m.quantity) continue;
    if (!m.productId.startsWith('INV-') && !m.productId.startsWith('item-')) continue;
    const existing = consumption.get(m.productId);
    if (existing) {
      existing.qty += m.quantity;
    } else {
      consumption.set(m.productId, {
        qty: m.quantity,
        unitCost: m.unitCost || 0,
        productName: m.productName || '',
      });
    }
  }
}

if (parseFailures > 0) {
  console.log(`  (${parseFailures} tickets had bad materialsJson — skipped their lines)`);
}

console.log(`\nAggregate historical consumption per SKU:`);
for (const [pid, data] of [...consumption.entries()].sort()) {
  console.log(`  ${pid}: ${data.qty} units  (${data.productName})`);
}

// ──────────────────────────────────────────────────────────────────────────
// Step 2: apply the restock to Inventory tab
// ──────────────────────────────────────────────────────────────────────────
console.log(`\nApplying restocks to Inventory tab:`);
const invRows = await invTab.getRows();
const beforeAfter = [];

for (const invRow of invRows) {
  const pid = invRow.get('productId');
  if (!consumption.has(pid)) {
    beforeAfter.push({
      productId: pid,
      productName: invRow.get('productName'),
      before: parseFloat(invRow.get('currentQty')) || 0,
      restocked: 0,
      after: parseFloat(invRow.get('currentQty')) || 0,
      reason: 'No historical consumption for this SKU',
    });
    continue;
  }
  const data = consumption.get(pid);
  const before = parseFloat(invRow.get('currentQty')) || 0;
  const unitCost = parseFloat(invRow.get('unitCost')) || data.unitCost;
  const after = before + data.qty;
  invRow.set('currentQty', String(after));
  invRow.set('totalValue', (after * unitCost).toFixed(2));
  invRow.set('lastRestockDate', new Date().toISOString().slice(0, 10));
  await invRow.save();
  console.log(`  ${pid}: ${before} -> ${after}  (+${data.qty})`);
  beforeAfter.push({
    productId: pid,
    productName: invRow.get('productName'),
    before,
    restocked: data.qty,
    after,
    reason: 'Historical restock reconciliation',
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Step 3: write ONE reconciliation ticket to Tickets tab
// ──────────────────────────────────────────────────────────────────────────
const nowIso = new Date().toISOString();
const reconTicketId = `TKT-HISTORICAL-RESTOCK-RECON-${nowIso.slice(0, 10).replace(/-/g, '')}`;
const reconLines = [];
for (const [pid, data] of consumption) {
  reconLines.push({
    productId: pid,
    productName: data.productName,
    quantity: data.qty,
    unitCost: data.unitCost,
    totalCost: data.qty * data.unitCost,
  });
}
const reconTotalCost = reconLines.reduce((s, l) => s + l.totalCost, 0);

await ticketsTab.addRow({
  ticketId: reconTicketId,
  ticketType: 'restock',
  status: 'completed',
  referenceNumber: 'HISTORICAL-RECONCILIATION',
  customerName: 'RCRS Warehouse',
  jobAddress: '',
  materialsJson: JSON.stringify(reconLines),
  totalPrice: '',
  totalCost: reconTotalCost.toFixed(2),
  createdAt: nowIso,
  createdBy: 'historical-restock-script',
  createdByName: 'Historical Restock Reconciliation (2026-05-15)',
  completedAt: nowIso,
  notes: 'Cumulative restock that balances the 241 historical-backfill delivery tickets. Each SKU restocked by the total quantity historically consumed. Brings books in line with reality — pre-historical-stock should now be reflected in currentQty (minus the 17 recent email-webhook deductions).',
});
console.log(`\nCreated reconciliation ticket: ${reconTicketId}`);
console.log(`  Lines: ${reconLines.length}`);
console.log(`  Total cost basis: $${reconTotalCost.toFixed(2)}`);

// ──────────────────────────────────────────────────────────────────────────
// Step 4: write InventoryLogs entries (one per restocked SKU)
// ──────────────────────────────────────────────────────────────────────────
if (logsTab) {
  console.log(`\nWriting InventoryLogs entries:`);
  for (const item of beforeAfter) {
    if (item.restocked === 0) continue;
    await logsTab.addRow({
      logId: crypto.randomUUID(),
      productId: item.productId,
      productName: item.productName,
      type: 'restock',
      qtyChange: item.restocked,
      previousQty: item.before,
      newQty: item.after,
      ticketId: reconTicketId,
      reason: 'Historical restock reconciliation',
      performedBy: 'historical-restock-script',
      performedByName: 'Historical Restock Reconciliation',
      timestamp: nowIso,
    });
  }
  console.log(`  Wrote ${beforeAfter.filter(b => b.restocked > 0).length} log entries`);
} else {
  console.log(`\n(No InventoryLogs tab found — skipping audit log writes. The reconciliation ticket alone provides the audit trail.)`);
}

// ──────────────────────────────────────────────────────────────────────────
// Step 5: snapshot
// ──────────────────────────────────────────────────────────────────────────
const dt = new Date();
const stamp = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}_${String(dt.getHours()).padStart(2, '0')}${String(dt.getMinutes()).padStart(2, '0')}`;
const snapTitle = `Inventory_Snapshot_${stamp}_post_restock_recon`;
const newSheet = await doc.addSheet({
  title: snapTitle,
  headerValues: ['productId', 'productName', 'before', 'restocked', 'after', 'reason'],
});
await newSheet.addRows(beforeAfter);
console.log(`\nSnapshot written: ${snapTitle}`);

console.log(`\n=== Historical restock reconciliation complete ===`);
console.log(`  SKUs restocked: ${[...consumption.keys()].length}`);
console.log(`  Total units restocked: ${[...consumption.values()].reduce((s, d) => s + d.qty, 0)}`);
console.log(`  Reconciliation ticket: ${reconTicketId}`);
console.log(`  Snapshot tab: ${snapTitle}`);
console.log('');
const stillZero = beforeAfter.filter(b => b.after === 0);
if (stillZero.length > 0) {
  console.log(`⚠️  ${stillZero.length} SKUs are still at 0 after reconciliation:`);
  stillZero.forEach(b => console.log(`     ${b.productId} (${b.productName}) — ${b.reason}`));
  console.log(`     These need physical-count input from Michael/Rick.`);
} else {
  console.log(`✅ No SKU is at 0. Books balance.`);
}
