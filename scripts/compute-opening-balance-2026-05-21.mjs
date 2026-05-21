/**
 * Compute per-SKU opening balance — 2026-05-21
 *
 * Structural finding: the legacy inventory app went live on a
 * warehouse that already had stock. 2025-02-18 is NOT an opening
 * balance load — it's just the first restock day. To make the math
 * consistent end-to-end, we need an explicit opening balance.
 *
 * Method: walk each SKU's legacy transactions chronologically, find
 * the minimum running balance. Opening = max(0, -minRunning). This
 * is the smallest pre-existing stock needed for the historical
 * deliveries to be physically possible.
 *
 * This is NOT a fabricated restock. It's an honest acknowledgment
 * that pre-2025-02-18 stock existed and wasn't recorded.
 *
 * READ ONLY. No sheet writes.
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

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

// Read legacy log
const legacyDoc = new GoogleSpreadsheet(process.env.LEGACY_INVENTORY_SHEETS_ID, auth);
await legacyDoc.loadInfo();
const legacySheet = legacyDoc.sheetsByTitle['Inventory'];
await legacySheet.loadHeaderRow();
const legacyRows = await legacySheet.getRows();

// Read master Inventory_Products for SKU mapping + product names
const masterDoc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID || process.env.DELIVERY_SHEETS_ID, auth);
await masterDoc.loadInfo();
const invProductsSheet = masterDoc.sheetsByTitle['Inventory_Products'];
await invProductsSheet.loadHeaderRow();
const invProductRows = await invProductsSheet.getRows();

// Build legacyId -> productInfo map
const productByLegacyId = new Map();
const productOrder = [];
for (const r of invProductRows) {
  const productId = (r.get('productId') || '').trim();
  const legacyId = (r.get('legacyId') || '').trim();
  const productName = (r.get('productName') || '').trim();
  const currentQty = parseFloat(r.get('currentQty') || '0');
  if (productId) {
    productByLegacyId.set(legacyId, { productId, legacyId, productName, currentQty });
    productOrder.push({ productId, legacyId, productName, currentQty });
  }
}

// Group legacy transactions by SKU
const txnsBySku = new Map(); // legacyId -> [{date, amount, rNum}]
for (const row of legacyRows) {
  const itemId = (row.get('Item ID') || '').trim();
  const dateRaw = row.get('DateTime');
  const amount = parseFloat(row.get('Amount') || '0');
  const rNum = (row.get('R#') || '').trim();
  if (!itemId || !dateRaw) continue;
  let date;
  // Try parsing as ISO first, then as M/D/YYYY HH:MM:SS
  if (dateRaw.match(/^\d{4}-\d{2}-\d{2}/)) {
    date = new Date(dateRaw);
  } else {
    // M/D/YYYY HH:MM:SS format
    const m = dateRaw.match(/^(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+):(\d+)/);
    if (m) {
      date = new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2]),
                       parseInt(m[4]), parseInt(m[5]), parseInt(m[6]));
    } else {
      date = new Date(dateRaw);
    }
  }
  if (isNaN(date.getTime())) continue;
  if (!txnsBySku.has(itemId)) txnsBySku.set(itemId, []);
  txnsBySku.get(itemId).push({ date: date.getTime(), amount, rNum });
}

// Walk each SKU chronologically, find min running balance
console.log('');
console.log('Opening-balance backsolve (max stock owed by chronology, per SKU)');
console.log('Formula: opening = max(0, -minRunningBalance)');
console.log('');
console.log('SKU       legacyId  Name                            Tx count  Min running  Opening  Hit-bottom date');
console.log('---------------------------------------------------------------------------------------------------');

const openings = {};
let totalOpening = 0;
const log = [];

for (const sku of productOrder) {
  const txns = (txnsBySku.get(sku.legacyId) || []).slice().sort((a, b) => a.date - b.date);
  let running = 0;
  let minRunning = 0;
  let minRunningDate = null;
  for (const t of txns) {
    running += t.amount;
    if (running < minRunning) {
      minRunning = running;
      minRunningDate = new Date(t.date).toISOString().slice(0, 10);
    }
  }
  const opening = Math.max(0, -minRunning);
  openings[sku.productId] = {
    legacyId: sku.legacyId,
    productName: sku.productName,
    txCount: txns.length,
    minRunning,
    minRunningDate,
    finalRunning: running,
    opening,
  };
  totalOpening += opening;

  const skuPad = sku.productId.padEnd(10, ' ');
  const legacyPad = sku.legacyId.padEnd(10, ' ');
  const namePad = (sku.productName || '').slice(0, 32).padEnd(32, ' ');
  const tx = String(txns.length).padStart(8, ' ');
  const minR = String(minRunning).padStart(12, ' ');
  const op = String(opening).padStart(7, ' ');
  const md = (minRunningDate || '   --     ').padStart(15, ' ');
  console.log(`${skuPad}${legacyPad}${namePad}${tx}${minR}${op}${md}`);

  log.push({
    productId: sku.productId,
    legacyId: sku.legacyId,
    productName: sku.productName,
    txCount: txns.length,
    minRunning,
    minRunningDate,
    finalRunning: running,
    opening,
  });
}
console.log('---------------------------------------------------------------------------------------------------');
console.log(`TOTAL                                                                                  ${String(totalOpening).padStart(7, ' ')}`);

console.log('');
console.log('Implied per-SKU final qty (opening + sum(amounts)):');
console.log('  This is what each SKU should equal in inventory IF the legacy log is complete from app launch.');
console.log('');
console.log('SKU       Name                            Opening  + sum(legacy)  = Implied currentQty (legacy only)');
console.log('--------------------------------------------------------------------------------------------------');
for (const sku of productOrder) {
  const o = openings[sku.productId];
  const implied = o.opening + o.finalRunning;
  const namePad = (sku.productName || '').slice(0, 32).padEnd(32, ' ');
  console.log(`${sku.productId.padEnd(10, ' ')}${namePad}${String(o.opening).padStart(8, ' ')}    ${String(o.finalRunning).padStart(11, ' ')}    ${String(implied).padStart(20, ' ')}`);
}

// Save deliverable
fs.writeFileSync(
  path.join(process.cwd(), 'scripts', 'opening-balance-2026-05-21.json'),
  JSON.stringify({ computedAt: new Date().toISOString(), openings: log, totalOpening }, null, 2),
);
console.log('');
console.log('Wrote scripts/opening-balance-2026-05-21.json');
