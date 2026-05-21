/**
 * Cross-check: aggregate legacy delivery units per legacyId from the
 * source-of-truth (LEGACY Inventory tab), then aggregate active
 * TKT-LEGACY-* materialsJson units per productId from master, and
 * compare per SKU.
 */
import fs from 'fs';
import path from 'path';
const envPath = path.join(process.cwd(), '.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
});
const { JWT } = await import('google-auth-library');
const { GoogleSpreadsheet } = await import('google-spreadsheet');
const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim(),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
function parseNum(v) { if (v == null || v === '') return 0; const n = parseFloat(String(v).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; }

// Legacy
const legacyDoc = new GoogleSpreadsheet(process.env.LEGACY_INVENTORY_SHEETS_ID, auth);
await legacyDoc.loadInfo();
const li = legacyDoc.sheetsByTitle['Inventory'];
const liRows = await li.getRows();
const legacyByItem = {};
for (const r of liRows) {
  const o = r.toObject();
  const amount = parseNum(o['Amount']);
  if (amount >= 0) continue;
  const itemId = (o['Item ID'] || '').toString().trim();
  if (!itemId) continue;
  legacyByItem[itemId] = (legacyByItem[itemId] || 0) + Math.abs(amount);
}

// Master TKT-LEGACY-*
const master = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, auth);
await master.loadInfo();
const t = master.sheetsByTitle['Tickets'];
const tRows = await t.getRows();
const masterByLegacyId = {};
const masterByProductId = {};
for (const r of tRows) {
  const id = (r.get('ticketId') || '').toString();
  if (!id.startsWith('TKT-LEGACY-')) continue;
  const status = (r.get('status') || '').toLowerCase().trim();
  if (status === 'voided') continue;
  let arr = [];
  try { arr = JSON.parse(r.get('materialsJson') || '[]'); } catch {}
  for (const it of arr) {
    const qty = Math.abs(Number(it.qty ?? 0));
    if (it.legacyId) masterByLegacyId[it.legacyId] = (masterByLegacyId[it.legacyId] || 0) + qty;
    if (it.productId) masterByProductId[it.productId] = (masterByProductId[it.productId] || 0) + qty;
  }
}

// Diff
console.log('Per-legacyId: legacy total vs master TKT-LEGACY-* total');
const ids = new Set([...Object.keys(legacyByItem), ...Object.keys(masterByLegacyId)]);
let sumLeg = 0, sumMaster = 0;
for (const id of [...ids].sort()) {
  const l = legacyByItem[id] || 0;
  const m = masterByLegacyId[id] || 0;
  sumLeg += l; sumMaster += m;
  console.log(`  ${id.padEnd(10)} legacy=${String(l).padStart(6)}  master=${String(m).padStart(6)}  diff=${String(m - l).padStart(5)}`);
}
console.log(`TOTAL legacy=${sumLeg}  master=${sumMaster}  diff=${sumMaster - sumLeg}`);
