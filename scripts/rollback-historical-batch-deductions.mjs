/**
 * Rollback the inventory deduction from backfill-historical-batch-2026-05-15.mjs
 *
 * Why: the 17 historical jobs were already deducted from inventory in the
 * pre-email-era sheet flow. The backfill script double-deducted them. This
 * undoes the inventory side only — invoice rows in Job_Material_Costs and
 * ticket status='completed' are left alone (they're useful records).
 *
 * Reads the snapshot tab `Inventory_Snapshot_2026-05-15_2007_historical_close`
 * which has the pre-deduction state, and restores currentQty + totalValue
 * for every row that had deducted > 0.
 *
 * Idempotent — running twice is a no-op since the second pass finds rows
 * already at their beforeQty.
 *
 * Usage:
 *   cd ~/river-city-roofing
 *   node scripts/rollback-historical-batch-deductions.mjs
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

const SNAPSHOT_TAB = 'Inventory_Snapshot_2026-05-15_2007_historical_close';

const sheetsId = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
  key: privateKey?.trim(),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(sheetsId, auth);
await doc.loadInfo();

const snapTab = doc.sheetsByTitle[SNAPSHOT_TAB];
const invTab = doc.sheetsByTitle['Inventory'];
if (!snapTab) throw new Error(`Snapshot tab not found: ${SNAPSHOT_TAB}`);
if (!invTab) throw new Error("'Inventory' tab not found");

console.log(`Reading snapshot: ${SNAPSHOT_TAB}`);
const snapRows = await snapTab.getRows();
const targets = new Map();
for (const r of snapRows) {
  const pid = r.get('productId');
  const deducted = parseFloat(r.get('deducted')) || 0;
  if (deducted > 0) {
    targets.set(pid, {
      beforeQty: parseFloat(r.get('beforeQty')) || 0,
      deducted,
      unitCost: parseFloat(r.get('unitCost')) || 0,
    });
  }
}

console.log(`Found ${targets.size} SKUs to restore`);

const invRows = await invTab.getRows();
let restored = 0;
for (const invRow of invRows) {
  const pid = invRow.get('productId');
  if (!targets.has(pid)) continue;
  const target = targets.get(pid);
  const current = parseFloat(invRow.get('currentQty')) || 0;
  const desired = target.beforeQty;

  if (current === desired) {
    console.log(`  ${pid}: already at ${desired} — skip`);
    continue;
  }

  invRow.set('currentQty', String(desired));
  invRow.set('totalValue', (desired * target.unitCost).toFixed(2));
  await invRow.save();
  console.log(`  ${pid}: ${current} -> ${desired}  (restored ${target.deducted})`);
  restored++;
}

console.log(`\n=== Rollback complete ===`);
console.log(`  SKUs restored: ${restored}`);
console.log(`  Snapshot source: ${SNAPSHOT_TAB}`);
console.log(`  Invoice rows in Job_Material_Costs: NOT touched (kept for Sara's records)`);
console.log(`  Ticket statuses: NOT touched (still 'completed')`);
