/**
 * Inspect the legacy "new inventory" Inventory tab in pure chronological
 * order — find what the actual first transactions are and verify the
 * data structure. No interpretation, just raw row dumps.
 *
 * READ ONLY.
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

const legacyDoc = new GoogleSpreadsheet(process.env.LEGACY_INVENTORY_SHEETS_ID, auth);
await legacyDoc.loadInfo();
console.log('Legacy sheet title:', legacyDoc.title);
console.log('Tabs:', Object.keys(legacyDoc.sheetsByTitle).join(', '));
console.log('');

const sheet = legacyDoc.sheetsByTitle['Inventory'];
await sheet.loadHeaderRow();
console.log('Inventory headers:', sheet.headerValues);
console.log('Total rows:', sheet.rowCount);
console.log('');

const rows = await sheet.getRows();
console.log(`Got ${rows.length} data rows`);

// Parse dates robustly
function parseDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  // ISO format
  if (typeof raw === 'string' && raw.match(/^\d{4}-\d{2}-\d{2}/)) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }
  // M/D/YYYY HH:MM:SS
  const m = String(raw).match(/^(\d+)\/(\d+)\/(\d+)(?:\s+(\d+):(\d+):(\d+))?/);
  if (m) {
    const d = new Date(
      parseInt(m[3]),
      parseInt(m[1]) - 1,
      parseInt(m[2]),
      parseInt(m[4] || 0),
      parseInt(m[5] || 0),
      parseInt(m[6] || 0),
    );
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

const parsed = rows
  .map((r, i) => ({
    idx: i,
    inventoryId: r.get('Inventory ID') || '',
    itemId: r.get('Item ID') || '',
    dateRaw: r.get('DateTime') || '',
    date: parseDate(r.get('DateTime')),
    amount: parseFloat(r.get('Amount') || '0'),
    rNum: r.get('R#') || '',
    price: r.get('Price') || '',
    cost: r.get('Cost') || '',
    photo: r.get('Delivery Photo') || '',
  }))
  .filter(x => x.date);

console.log(`Parsed dates on ${parsed.length}/${rows.length} rows`);
console.log('');

// Sort chronologically
parsed.sort((a, b) => a.date - b.date);

console.log('=== FIRST 30 transactions in chronological order ===');
console.log('Row | InvID    | ItemID    | Date                    | Amount | R#       | Cost');
console.log('----+----------+-----------+-------------------------+--------+----------+--------');
for (let i = 0; i < Math.min(30, parsed.length); i++) {
  const p = parsed[i];
  const dStr = p.date.toISOString().slice(0, 19);
  const sign = p.amount > 0 ? '+' : '';
  console.log(`${String(i + 1).padStart(3)} | ${String(p.inventoryId).padEnd(8)} | ${String(p.itemId).padEnd(9)} | ${dStr} | ${sign}${String(p.amount).padStart(6)} | ${String(p.rNum).padEnd(8)} | ${p.cost}`);
}

console.log('');
console.log('=== LAST 10 transactions in chronological order ===');
for (let i = Math.max(0, parsed.length - 10); i < parsed.length; i++) {
  const p = parsed[i];
  const dStr = p.date.toISOString().slice(0, 19);
  const sign = p.amount > 0 ? '+' : '';
  console.log(`${String(i + 1).padStart(4)} | ${String(p.inventoryId).padEnd(8)} | ${String(p.itemId).padEnd(9)} | ${dStr} | ${sign}${String(p.amount).padStart(6)} | ${String(p.rNum).padEnd(8)} | ${p.cost}`);
}

console.log('');
console.log('=== FIRST 5 transactions per SKU (chronologically) ===');
const bySku = new Map();
for (const p of parsed) {
  if (!bySku.has(p.itemId)) bySku.set(p.itemId, []);
  if (bySku.get(p.itemId).length < 5) bySku.get(p.itemId).push(p);
}
const skuList = [...bySku.keys()].sort();
for (const sku of skuList) {
  console.log(`\n${sku}:`);
  console.log('  Row | Date                    | Amount | R#       | Cost');
  for (const p of bySku.get(sku)) {
    const dStr = p.date.toISOString().slice(0, 19);
    const sign = p.amount > 0 ? '+' : '';
    console.log(`  ${String(p.idx).padStart(3)} | ${dStr} | ${sign}${String(p.amount).padStart(6)} | ${String(p.rNum).padEnd(8)} | ${p.cost}`);
  }
}

console.log('');
console.log('=== Amount value distribution ===');
const amounts = parsed.map(p => p.amount);
const positives = amounts.filter(a => a > 0);
const negatives = amounts.filter(a => a < 0);
const zeros = amounts.filter(a => a === 0);
console.log(`Positive Amounts: ${positives.length} (min=${Math.min(...positives)}, max=${Math.max(...positives)}, sum=${positives.reduce((a,b)=>a+b,0)})`);
console.log(`Negative Amounts: ${negatives.length} (min=${Math.min(...negatives)}, max=${Math.max(...negatives)}, sum=${negatives.reduce((a,b)=>a+b,0)})`);
console.log(`Zero Amounts: ${zeros.length}`);

console.log('');
console.log('=== R# patterns (top 20 most common) ===');
const rCounts = new Map();
for (const p of parsed) {
  const k = p.rNum || '(empty)';
  rCounts.set(k, (rCounts.get(k) || 0) + 1);
}
const topR = [...rCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
for (const [r, c] of topR) {
  console.log(`  ${r} -> ${c}`);
}

console.log('');
console.log('=== Earliest date by SKU ===');
const earliestBySku = new Map();
for (const p of parsed) {
  if (!earliestBySku.has(p.itemId) || p.date < earliestBySku.get(p.itemId).date) {
    earliestBySku.set(p.itemId, p);
  }
}
for (const sku of skuList) {
  const p = earliestBySku.get(sku);
  const dStr = p.date.toISOString().slice(0, 19);
  console.log(`  ${sku}: ${dStr}, Amount=${p.amount}, R#=${p.rNum}`);
}

console.log('');
console.log('=== Date range ===');
console.log(`Earliest: ${parsed[0].date.toISOString()}`);
console.log(`Latest: ${parsed[parsed.length-1].date.toISOString()}`);
