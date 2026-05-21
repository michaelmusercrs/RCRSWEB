/**
 * Inspect negative-Amount rows with EMPTY R# in legacy Inventory log.
 *
 * Hypothesis: these may be duplicates of nearby job-tagged deliveries,
 * which would explain why pure ticket math comes out negative even
 * after correct legacy-log replay.
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
const sheet = legacyDoc.sheetsByTitle['Inventory'];
await sheet.loadHeaderRow();
const rows = await sheet.getRows();

function parseDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === 'string' && raw.match(/^\d{4}-\d{2}-\d{2}/)) {
    const d = new Date(raw); if (!isNaN(d.getTime())) return d;
  }
  const m = String(raw).match(/^(\d+)\/(\d+)\/(\d+)(?:\s+(\d+):(\d+):(\d+))?/);
  if (m) {
    const d = new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2]),
      parseInt(m[4]||0), parseInt(m[5]||0), parseInt(m[6]||0));
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(raw); return isNaN(d.getTime()) ? null : d;
}

const all = rows.map(r => ({
  inventoryId: r.get('Inventory ID') || '',
  itemId: r.get('Item ID') || '',
  date: parseDate(r.get('DateTime')),
  amount: parseFloat(r.get('Amount') || '0'),
  rNum: (r.get('R#') || '').trim(),
  cost: r.get('Cost') || '',
})).filter(x => x.date);
all.sort((a, b) => a.date - b.date);

// Categorize all rows
const categories = {
  posWithRnumEmpty: [],
  posWithRnum1234: [],
  posWithRnumOther: [],
  negWithRnumEmpty: [],
  negWithRnumOther: [],
  zero: [],
};

for (const t of all) {
  if (t.amount === 0) { categories.zero.push(t); continue; }
  if (t.amount > 0) {
    if (!t.rNum) categories.posWithRnumEmpty.push(t);
    else if (t.rNum === '1234') categories.posWithRnum1234.push(t);
    else categories.posWithRnumOther.push(t);
  } else {
    if (!t.rNum) categories.negWithRnumEmpty.push(t);
    else categories.negWithRnumOther.push(t);
  }
}

console.log('=== Row categorization ===');
console.log(`Positive Amount, R# empty:     ${categories.posWithRnumEmpty.length} (likely restocks — initial loads)`);
console.log(`Positive Amount, R# = '1234':  ${categories.posWithRnum1234.length} (restocks)`);
console.log(`Positive Amount, R# = job#:    ${categories.posWithRnumOther.length} (returns)`);
console.log(`Negative Amount, R# empty:     ${categories.negWithRnumEmpty.length} (??? — UNCLASSIFIED)`);
console.log(`Negative Amount, R# present:   ${categories.negWithRnumOther.length} (deliveries to jobs)`);
console.log(`Zero amount:                   ${categories.zero.length}`);

console.log('');
console.log('=== Negative + empty R# rows ===');
const negEmpty = categories.negWithRnumEmpty;
console.log(`Total: ${negEmpty.length} rows`);
console.log(`Total units removed: ${Math.abs(negEmpty.reduce((s, t) => s + t.amount, 0))}`);

// Per-SKU breakdown of negative-empty-R# rows
const bySku = new Map();
for (const t of negEmpty) {
  if (!bySku.has(t.itemId)) bySku.set(t.itemId, { count: 0, units: 0 });
  bySku.get(t.itemId).count++;
  bySku.get(t.itemId).units += Math.abs(t.amount);
}
console.log('');
console.log('Per-SKU breakdown of NEGATIVE + EMPTY R#:');
for (const [sku, data] of [...bySku.entries()].sort()) {
  console.log(`  ${sku}: ${data.count} rows, ${data.units} units`);
}

console.log('');
console.log('=== Sample of first 30 NEGATIVE + EMPTY R# rows ===');
console.log('Date                    | ItemID    | Amount | Cost');
for (let i = 0; i < Math.min(30, negEmpty.length); i++) {
  const t = negEmpty[i];
  console.log(`${t.date.toISOString().slice(0, 19)} | ${String(t.itemId).padEnd(9)} | ${String(t.amount).padStart(6)} | ${t.cost}`);
}

console.log('');
console.log('=== Check for DUPLICATES: negative-empty-R# rows that match a nearby job-tagged delivery ===');
console.log('Looking for: same SKU + same Amount + within 24h of a job-tagged row');
console.log('');

const dupCheck = [];
for (const empty of negEmpty) {
  const candidates = categories.negWithRnumOther.filter(t =>
    t.itemId === empty.itemId &&
    t.amount === empty.amount &&
    Math.abs(t.date - empty.date) <= 24 * 60 * 60 * 1000
  );
  if (candidates.length > 0) {
    dupCheck.push({
      empty,
      candidates,
      bestMatch: candidates.sort((a, b) => Math.abs(a.date - empty.date) - Math.abs(b.date - empty.date))[0],
    });
  }
}

console.log(`${dupCheck.length} of ${negEmpty.length} negative-empty-R# rows have a matching job-tagged delivery within 24h`);
console.log(`(${(dupCheck.length / negEmpty.length * 100).toFixed(1)}% match rate)`);

// Show top 20 matches
console.log('');
console.log('Sample of 20 likely-duplicate pairs:');
console.log('EmptyR# row                                       | Matching job-tagged row                          | Hours apart');
for (const d of dupCheck.slice(0, 20)) {
  const e = d.empty;
  const c = d.bestMatch;
  const hours = (Math.abs(c.date - e.date) / 1000 / 60 / 60).toFixed(1);
  console.log(
    `${e.date.toISOString().slice(0,19)} ${e.itemId.padEnd(9)} ${String(e.amount).padStart(5)} (empty) | ` +
    `${c.date.toISOString().slice(0,19)} ${c.itemId.padEnd(9)} ${String(c.amount).padStart(5)} (R#${c.rNum}) | ${hours}h`,
  );
}

// Per-SKU duplicate count + units
console.log('');
console.log('Per-SKU summary of LIKELY DUPLICATES (would shrink delivery total if removed):');
const dupBySku = new Map();
for (const d of dupCheck) {
  const sku = d.empty.itemId;
  if (!dupBySku.has(sku)) dupBySku.set(sku, { count: 0, units: 0 });
  dupBySku.get(sku).count++;
  dupBySku.get(sku).units += Math.abs(d.empty.amount);
}
for (const [sku, data] of [...dupBySku.entries()].sort()) {
  console.log(`  ${sku}: ${data.count} likely-duplicate rows totaling ${data.units} units`);
}

// What if we EXCLUDE the negative-empty-R# rows entirely from deliveries?
console.log('');
console.log('=== Math if negative-empty-R# rows are NOT real deliveries ===');
const restockSums = new Map(); // by sku
const deliveryWithRnum = new Map();
const deliveryEmptyRnum = new Map();
const returnSums = new Map();

for (const t of categories.posWithRnumEmpty) {
  restockSums.set(t.itemId, (restockSums.get(t.itemId) || 0) + t.amount);
}
for (const t of categories.posWithRnum1234) {
  restockSums.set(t.itemId, (restockSums.get(t.itemId) || 0) + t.amount);
}
for (const t of categories.posWithRnumOther) {
  returnSums.set(t.itemId, (returnSums.get(t.itemId) || 0) + t.amount);
}
for (const t of categories.negWithRnumOther) {
  deliveryWithRnum.set(t.itemId, (deliveryWithRnum.get(t.itemId) || 0) + Math.abs(t.amount));
}
for (const t of categories.negWithRnumEmpty) {
  deliveryEmptyRnum.set(t.itemId, (deliveryEmptyRnum.get(t.itemId) || 0) + Math.abs(t.amount));
}

console.log('SKU       Restock  Returns  Delivery(R#)  Delivery(empty)  Math-WITH-empty  Math-WITHOUT-empty');
console.log('-----------------------------------------------------------------------------------------------');
const allSkus = new Set([
  ...restockSums.keys(),
  ...deliveryWithRnum.keys(),
  ...deliveryEmptyRnum.keys(),
  ...returnSums.keys(),
]);
for (const sku of [...allSkus].sort()) {
  const R = restockSums.get(sku) || 0;
  const Ret = returnSums.get(sku) || 0;
  const Dr = deliveryWithRnum.get(sku) || 0;
  const De = deliveryEmptyRnum.get(sku) || 0;
  const withEmpty = R + Ret - Dr - De;
  const withoutEmpty = R + Ret - Dr;
  console.log(
    `${sku.padEnd(10)}${String(R).padStart(7)}  ${String(Ret).padStart(7)}  ${String(Dr).padStart(12)}  ${String(De).padStart(15)}  ${String(withEmpty).padStart(15)}  ${String(withoutEmpty).padStart(18)}`,
  );
}
