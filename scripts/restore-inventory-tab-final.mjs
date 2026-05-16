/**
 * Final fix: restore the Inventory tab to its pre-my-script state.
 *
 * The Inventory tab is a SEPARATE catalog (shingles, lumber, etc.) — NOT
 * the canonical stock catalog. The canonical stock catalog is
 * Inventory_Products (1 1/4 EG Nails, RCRS Syn Felt, Ridge Vent 4LF, etc.).
 *
 * Email-webhook tickets use INV-* IDs that resolve to Inventory_Products.
 * Inventory_Products currentQty values ALREADY reflect the 17 jobs being
 * deducted (Michael confirmed: his current inventory is positive). So no
 * deduction needs to be applied — the books already match reality.
 *
 * What I broke: the Inventory tab where my script wrongly applied the
 * 17-job deductions. Restoring INV-0001, INV-0002, INV-0006 to their
 * pre-script values (30, 51, 2) per the snapshot.
 *
 * INV-0003, 0004, 0005, 0010 were already at 0 in Inventory tab before
 * my script and stay at 0 (no change needed).
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
const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim(),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(sheetsId, auth);
await doc.loadInfo();

// Target values per the pre-script snapshot (Inventory_Snapshot_2026-05-15_2007_historical_close)
const RESTORE = {
  'INV-0001': 30,   // IKO Cambridge AR Shingles
  'INV-0002': 51,   // IKO Dynasty Shingles
  'INV-0006': 2,    // IKO ArmourGard Ice & Water Shield
};

const invTab = doc.sheetsByTitle['Inventory'];
const rows = await invTab.getRows();

let changed = 0;
for (const r of rows) {
  const pid = r.get('productId');
  if (!(pid in RESTORE)) continue;
  const desired = RESTORE[pid];
  const current = parseFloat(r.get('currentQty')) || 0;
  const unitCost = parseFloat(r.get('unitCost')) || 0;
  if (current === desired) {
    console.log(`${pid}: already at ${desired} (${r.get('productName')}) — skip`);
    continue;
  }
  r.set('currentQty', String(desired));
  r.set('totalValue', (desired * unitCost).toFixed(2));
  await r.save();
  console.log(`${pid}: ${current} -> ${desired}  (${r.get('productName')})`);
  changed++;
}

console.log(`\nDone. ${changed} rows restored.`);
console.log(`\nKey insight: Inventory_Products is the live stock catalog (11 items, all positive). The Inventory tab is a separate shingle/lumber/gutters catalog that my script wrongly touched. Now restored.`);
