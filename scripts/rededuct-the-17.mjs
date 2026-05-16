/**
 * Re-deduct the 17 email-webhook tickets I incorrectly rolled back.
 *
 * Per Michael: the 17 historical jobs DID need to come out of inventory.
 * The 241 'historical-backfill' rows were already in the inventory
 * accounting separately. My earlier rollback was wrong — undoing it.
 *
 * Reads the snapshot tab to get the exact amounts that were originally
 * deducted (deducted column), then re-applies those deductions.
 * Idempotent — checks current state vs intended state.
 *
 * Usage: node scripts/rededuct-the-17.mjs
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

const snapRows = await snapTab.getRows();
const deductions = new Map();
for (const r of snapRows) {
  const d = parseFloat(r.get('deducted')) || 0;
  if (d > 0) deductions.set(r.get('productId'), {
    qty: d,
    intendedAfter: parseFloat(r.get('afterQty')) || 0,
  });
}

console.log(`Re-deducting ${deductions.size} SKUs:`);
const invRows = await invTab.getRows();
for (const invRow of invRows) {
  const pid = invRow.get('productId');
  if (!deductions.has(pid)) continue;
  const target = deductions.get(pid);
  const current = parseFloat(invRow.get('currentQty')) || 0;
  const unitCost = parseFloat(invRow.get('unitCost')) || 0;
  // Target post-deduction state per snapshot
  const desired = target.intendedAfter;
  if (current === desired) {
    console.log(`  ${pid}: already at ${desired} — skip`);
    continue;
  }
  invRow.set('currentQty', String(desired));
  invRow.set('totalValue', (desired * unitCost).toFixed(2));
  await invRow.save();
  console.log(`  ${pid}: ${current} -> ${desired}  (re-deducted ${target.qty})`);
}

console.log('\n=== Re-deduction complete ===');
console.log('Inventory now reflects the 17 email-webhook deliveries going out.');
console.log('Next: restock backfill to add the IN-side of historical material movement.');
