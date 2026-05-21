/**
 * investigate-inventory-structural-2026-05-21.mjs
 *
 * READ-ONLY structural investigation of legacy "new inventory" sheet.
 * Tests 9 hypotheses about why pure ticket math gives -297 Ridge Vent
 * when owner says nothing is out of stock.
 *
 * NO WRITES. NO COMMITS.
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

const LEGACY_SHEET_ID = process.env.LEGACY_INVENTORY_SHEETS_ID;
if (!LEGACY_SHEET_ID) { console.error('NO LEGACY_INVENTORY_SHEETS_ID'); process.exit(1); }

const { JWT } = await import('google-auth-library');
const { GoogleSpreadsheet } = await import('google-spreadsheet');

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim(),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

function parseNum(v) {
  if (v == null || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function parseLegacyDateTime(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value) && value > 1000) {
    const d = new Date((value - 25569) * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, mo, da, yr] = m;
    return `${yr}-${String(mo).padStart(2,'0')}-${String(da).padStart(2,'0')}`;
  }
  const isoM = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoM) return isoM[0];
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

console.log('=== OPENING LEGACY SHEET ===');
const doc = new GoogleSpreadsheet(LEGACY_SHEET_ID, auth);
await doc.loadInfo();
console.log(`Title: "${doc.title}"`);
console.log(`Tabs: ${Object.keys(doc.sheetsByTitle).join(', ')}`);
console.log('');

// ============================================================
// HYPOTHESIS 1 — Items tab has opening balances
// ============================================================
console.log('================================================================');
console.log('HYPOTHESIS 1 — Items tab opening balances');
console.log('================================================================');
const itemsTab = doc.sheetsByTitle['Items'];
await itemsTab.loadHeaderRow();
const itemsHeaders = itemsTab.headerValues;
console.log(`Items tab headers (verbatim): ${JSON.stringify(itemsHeaders)}`);

// Also load raw cells in case header is detected weirdly
await itemsTab.loadCells();
console.log(`Items tab dimensions: ${itemsTab.rowCount} rows x ${itemsTab.columnCount} cols`);
console.log('Raw first 3 rows (all cells, A..end):');
for (let r = 0; r < Math.min(itemsTab.rowCount, 5); r++) {
  const cells = [];
  for (let c = 0; c < itemsTab.columnCount; c++) {
    const cell = itemsTab.getCell(r, c);
    cells.push(cell.value === null ? '' : String(cell.value));
  }
  console.log(`  R${r}: ${JSON.stringify(cells)}`);
}

const itemsRows = await itemsTab.getRows();
console.log('');
console.log(`Items tab row count: ${itemsRows.length}`);
console.log('Full Items rows (object dump):');
for (const r of itemsRows) {
  const o = r.toObject();
  console.log(`  ${JSON.stringify(o)}`);
}

// Look explicitly for any column that could be opening qty
const openingKeywords = ['open', 'initial', 'start', 'current', 'qty', 'stock', 'balance', 'on hand', 'onhand', 'count'];
console.log('');
console.log('Columns possibly indicating an opening balance:');
for (const h of itemsHeaders) {
  const hl = h.toLowerCase();
  for (const kw of openingKeywords) {
    if (hl.includes(kw)) {
      console.log(`  FOUND: "${h}"`);
      // sum the column
      let sum = 0, nonzero = 0;
      for (const r of itemsRows) {
        const v = parseNum(r.get(h));
        if (v !== 0) nonzero++;
        sum += v;
      }
      console.log(`    sum=${sum}, nonzero rows=${nonzero}/${itemsRows.length}`);
      break;
    }
  }
}

// ============================================================
// HYPOTHESIS 2 — Unit-of-measure mismatch between restock and delivery
// ============================================================
console.log('');
console.log('================================================================');
console.log('HYPOTHESIS 2 — Unit-of-measure mismatch (bundle/stick)');
console.log('================================================================');
const invTab = doc.sheetsByTitle['Inventory'];
await invTab.loadHeaderRow();
const invRows = await invTab.getRows();
console.log(`Inventory tab rows: ${invRows.length}`);

function classify(row) {
  const o = row.toObject();
  const amount = parseNum(o['Amount']);
  const rNum = (o['R#'] || '').toString().trim();
  const itemId = (o['Item ID'] || '').toString().trim();
  const date = parseLegacyDateTime(o['DateTime']);
  let kind;
  const rUpper = rNum.toUpperCase();
  if (amount === 0) kind = 'adjustment';
  else if (amount < 0) kind = 'delivery';
  else {
    if (rUpper.startsWith('CM') || rUpper.includes('CREDIT') || rUpper.includes('RETURN')) kind = 'return';
    else if (rUpper.startsWith('TKT-') && rUpper.includes('RESTOCK')) kind = 'restock';
    else if (rUpper.startsWith('TKT-')) kind = 'return';
    else if (rNum === '' || rNum === '1234') kind = 'restock';
    else if (/^\d{4,5}$/.test(rNum)) kind = 'return';
    else kind = 'restock';
  }
  return { itemId, amount, rNum, date, kind, raw: o };
}

const parsed = invRows.map(classify);

// Per-SKU restock vs delivery distribution
function median(arr) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a,b) => a-b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid-1] + s[mid]) / 2;
}

const skus = ['item-123','item-124','item-125','item-126','item-127','item-128','item-129','item-130','item-131','item-132','item-133'];
const skuNames = {
  'item-123':'1 1/4 EG Nails',
  'item-124':'Bottom Caps',
  'item-125':'RCRS Syn Felt',
  'item-126':'Ice & Water Shield',
  'item-127':'Ridge Vent 4LF',
  'item-128':'1.5" Bullet Boot',
  'item-129':'2" Bullet Boot',
  'item-130':'3" Bullet Boot',
  'item-131':'4" Bullet Boot',
  'item-132':'Sealant',
  'item-133':'Zipper Boot',
};
console.log('');
console.log('Per-SKU |Amount| distribution: restock vs delivery');
console.log('sku        name                  | restock: n med  max  mode | delivery: n med  max  mode | ratio');
console.log('----------------------------------------------------------------------------------------------');
for (const id of skus) {
  const rArr = parsed.filter(p => p.itemId === id && p.kind === 'restock').map(p => Math.abs(p.amount));
  const dArr = parsed.filter(p => p.itemId === id && p.kind === 'delivery').map(p => Math.abs(p.amount));
  const rMode = (() => {
    const c = {}; for (const v of rArr) c[v] = (c[v]||0)+1;
    return Object.entries(c).sort((a,b)=>b[1]-a[1])[0]?.[0] || 0;
  })();
  const dMode = (() => {
    const c = {}; for (const v of dArr) c[v] = (c[v]||0)+1;
    return Object.entries(c).sort((a,b)=>b[1]-a[1])[0]?.[0] || 0;
  })();
  const rMed = median(rArr), dMed = median(dArr);
  const ratio = dMed > 0 ? (rMed / dMed).toFixed(2) : 'n/a';
  console.log(`${id.padEnd(10)} ${skuNames[id].padEnd(20)} | ${String(rArr.length).padStart(3)} ${String(rMed).padStart(4)} ${String(Math.max(0,...rArr)).padStart(4)} ${String(rMode).padStart(4)} | ${String(dArr.length).padStart(3)} ${String(dMed).padStart(4)} ${String(Math.max(0,...dArr)).padStart(4)} ${String(dMode).padStart(4)} | ${ratio}`);
}

// Ridge Vent deep dive
console.log('');
console.log('Ridge Vent (item-127) full distribution of restock |Amount| values (with frequency):');
const rv = parsed.filter(p => p.itemId === 'item-127' && p.kind === 'restock').map(p => Math.abs(p.amount));
const rvCounts = {}; for (const v of rv) rvCounts[v] = (rvCounts[v]||0)+1;
console.log(`  ${JSON.stringify(rvCounts)}`);
console.log('Ridge Vent (item-127) full distribution of delivery |Amount| values (with frequency, top 20):');
const dv = parsed.filter(p => p.itemId === 'item-127' && p.kind === 'delivery').map(p => Math.abs(p.amount));
const dvCounts = {}; for (const v of dv) dvCounts[v] = (dvCounts[v]||0)+1;
const dvSorted = Object.entries(dvCounts).sort((a,b)=>b[1]-a[1]).slice(0,20);
console.log(`  ${JSON.stringify(Object.fromEntries(dvSorted))}`);
console.log(`  Ridge Vent total deliveries: count=${dv.length}, sum=${dv.reduce((a,b)=>a+b,0)}`);

// ============================================================
// HYPOTHESIS 3 — SalesOrder tab
// ============================================================
console.log('');
console.log('================================================================');
console.log('HYPOTHESIS 3 — SalesOrder tab');
console.log('================================================================');
const soTab = doc.sheetsByTitle['SalesOrder'];
if (soTab) {
  await soTab.loadHeaderRow();
  const soHeaders = soTab.headerValues;
  console.log(`SalesOrder headers: ${JSON.stringify(soHeaders)}`);
  const soRows = await soTab.getRows();
  console.log(`SalesOrder rows: ${soRows.length}`);
  console.log('First 3 SalesOrder rows:');
  for (const r of soRows.slice(0,3)) console.log(`  ${JSON.stringify(r.toObject())}`);
  console.log('Last 3 SalesOrder rows:');
  for (const r of soRows.slice(-3)) console.log(`  ${JSON.stringify(r.toObject())}`);

  // Date range
  let minD = null, maxD = null;
  const soNumSet = new Set();
  for (const r of soRows) {
    const o = r.toObject();
    // try common date columns
    for (const k of ['Date','DateTime','date','Created','CreatedAt','SO Date']) {
      if (o[k]) {
        const d = parseLegacyDateTime(o[k]);
        if (d) {
          if (!minD || d < minD) minD = d;
          if (!maxD || d > maxD) maxD = d;
        }
        break;
      }
    }
    for (const k of ['SalesOrder','SalesOrder ID','SO#','SO ID','SO Number','SO','R#','OrderNumber']) {
      const v = (o[k] || '').toString().trim();
      if (v) { soNumSet.add(v); break; }
    }
  }
  console.log(`SalesOrder distinct order#s found: ${soNumSet.size}`);
  console.log(`SalesOrder date range: ${minD} -> ${maxD}`);

  // Inventory tab R# coverage
  const invRNums = new Set();
  for (const p of parsed) if (p.rNum && p.rNum !== '1234') invRNums.add(p.rNum);
  console.log(`Inventory distinct non-1234 R#s: ${invRNums.size}`);

  // Intersection
  let inBoth = 0, onlyInv = 0, onlySo = 0;
  for (const r of invRNums) if (soNumSet.has(r)) inBoth++; else onlyInv++;
  for (const s of soNumSet) if (!invRNums.has(s)) onlySo++;
  console.log(`R# overlap: in both inv & so = ${inBoth}, only in inv = ${onlyInv}, only in SO = ${onlySo}`);
  console.log(`-> ${onlySo} SalesOrders have NO matching Inventory transactions (potential off-log deliveries)`);

  if (onlySo > 0) {
    let i = 0;
    console.log('First 10 SOs with no Inventory rows:');
    for (const s of soNumSet) {
      if (!invRNums.has(s)) {
        console.log(`  ${s}`);
        if (++i >= 10) break;
      }
    }
  }
} else {
  console.log('NO SalesOrder tab found');
}

// ============================================================
// HYPOTHESIS 4 — Data range / truncation
// ============================================================
console.log('');
console.log('================================================================');
console.log('HYPOTHESIS 4 — Data range / truncation');
console.log('================================================================');
const allDates = parsed.map(p => p.date).filter(Boolean).sort();
console.log(`Inventory tab earliest: ${allDates[0]}`);
console.log(`Inventory tab latest:   ${allDates[allDates.length-1]}`);

// Check if 2025-02-18 has overwhelming activity (signs of "import day")
const dayCounts = {};
for (const d of allDates) dayCounts[d] = (dayCounts[d]||0)+1;
const topDays = Object.entries(dayCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);
console.log('Top 10 busiest days by tx count:');
for (const [d,c] of topDays) console.log(`  ${d}: ${c} transactions`);

// What kind of txs are on 2025-02-18?
const opening = parsed.filter(p => p.date === '2025-02-18');
const openingByKind = {};
for (const p of opening) openingByKind[p.kind] = (openingByKind[p.kind]||0) + 1;
console.log(`2025-02-18 (the very first day) breakdown: ${JSON.stringify(openingByKind)}`);

// What does the 2025-02-18 look like for Ridge Vent specifically?
const rvOpening = parsed.filter(p => p.date === '2025-02-18' && p.itemId === 'item-127');
console.log(`Ridge Vent (item-127) on 2025-02-18:`);
for (const r of rvOpening) console.log(`  kind=${r.kind} amount=${r.amount} R#=${r.rNum}`);

// ============================================================
// HYPOTHESIS 5 — Returns wrongly classified
// ============================================================
console.log('');
console.log('================================================================');
console.log('HYPOTHESIS 5 — Returns wrongly classified');
console.log('================================================================');
const allSoNums = new Set();
if (soTab) {
  const soRows = await soTab.getRows();
  for (const r of soRows) {
    const o = r.toObject();
    for (const k of ['SalesOrder','SalesOrder ID','SO#','SO ID','SO Number','SO','R#','OrderNumber','Sales Order']) {
      const v = (o[k] || '').toString().trim();
      if (v) { allSoNums.add(v); break; }
    }
  }
}
console.log(`SalesOrder #s loaded for return-classification verification: ${allSoNums.size}`);
const claimedReturns = parsed.filter(p => p.kind === 'return');
console.log(`Classified as return: ${claimedReturns.length}`);
let verifiedReturns = 0, unknownRNum = 0;
const unknownReturns = [];
for (const p of claimedReturns) {
  if (allSoNums.has(p.rNum)) verifiedReturns++;
  else { unknownRNum++; unknownReturns.push(p); }
}
console.log(`  -> matches a real SalesOrder: ${verifiedReturns}`);
console.log(`  -> R# NOT in SalesOrder tab: ${unknownRNum} (these may actually be restocks/vendor POs)`);
if (unknownReturns.length > 0) {
  console.log('First 10 "unknown return" rows:');
  for (const r of unknownReturns.slice(0,10)) {
    console.log(`  ${r.date} ${r.itemId} qty=${r.amount} R#=${r.rNum}`);
  }
}

// ============================================================
// HYPOTHESIS 6 — Amount sign convention spot check
// ============================================================
console.log('');
console.log('================================================================');
console.log('HYPOTHESIS 6 — Amount sign convention spot-check (20 random)');
console.log('================================================================');
const seed = 42;
function lcg(s) { let x = s; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x; }; }
const rng = lcg(seed);
const idxSet = new Set();
while (idxSet.size < 20) idxSet.add(rng() % parsed.length);
const sample = [...idxSet].map(i => parsed[i]);
for (const s of sample) {
  console.log(`  ${s.date || '?'} | item=${s.itemId} amt=${s.amount} R#=${s.rNum.padEnd(8)} | classified=${s.kind} | raw=${JSON.stringify(s.raw)}`);
}

// ============================================================
// HYPOTHESIS 7 — Other inventory data sources
// ============================================================
console.log('');
console.log('================================================================');
console.log('HYPOTHESIS 7 — Other sheet IDs in env');
console.log('================================================================');
const env = fs.readFileSync(envPath, 'utf8');
const sheetIdLines = env.split('\n').filter(l => /SHEET|SHEETS|INVENTORY|STOCK|WAREHOUSE/i.test(l) && /=/.test(l));
for (const l of sheetIdLines) {
  // mask the value
  const [k,v] = l.split('=');
  console.log(`  ${k}=${v.slice(0,20)}...`);
}

// ============================================================
// HYPOTHESIS 8 — Initial restock gap for Ridge Vent
// ============================================================
console.log('');
console.log('================================================================');
console.log('HYPOTHESIS 8 — Initial-restock gap for Ridge Vent');
console.log('================================================================');
const rvAll = parsed.filter(p => p.itemId === 'item-127').sort((a,b) => (a.date||'').localeCompare(b.date||''));
let running = 0;
let firstNegativeRunningAt = null;
let minRunning = 0, minRunningAt = null;
console.log('Ridge Vent chronological running balance (restocks +, deliveries -, returns +):');
for (const p of rvAll.slice(0, 30)) {
  const delta = (p.kind === 'restock' ? Math.abs(p.amount) : p.kind === 'return' ? Math.abs(p.amount) : -Math.abs(p.amount));
  running += delta;
  if (running < 0 && !firstNegativeRunningAt) firstNegativeRunningAt = { date: p.date, running };
  if (running < minRunning) { minRunning = running; minRunningAt = { date: p.date, running }; }
  console.log(`  ${p.date} | ${p.kind.padEnd(8)} | delta=${delta>0?'+'+delta:delta} | running=${running} | R#=${p.rNum}`);
}
// continue silently for the rest
for (const p of rvAll.slice(30)) {
  const delta = (p.kind === 'restock' ? Math.abs(p.amount) : p.kind === 'return' ? Math.abs(p.amount) : -Math.abs(p.amount));
  running += delta;
  if (running < 0 && !firstNegativeRunningAt) firstNegativeRunningAt = { date: p.date, running };
  if (running < minRunning) { minRunning = running; minRunningAt = { date: p.date, running }; }
}
console.log(`...`);
console.log(`Final Ridge Vent running balance: ${running}`);
console.log(`First date running goes negative: ${JSON.stringify(firstNegativeRunningAt)}`);
console.log(`Most negative running balance:    ${JSON.stringify(minRunningAt)} = ${minRunning}`);

// Same for the other negatives
for (const id of ['item-123','item-125','item-129']) {
  const arr = parsed.filter(p => p.itemId === id).sort((a,b) => (a.date||'').localeCompare(b.date||''));
  let r = 0, firstNeg = null, minR = 0;
  for (const p of arr) {
    const d = (p.kind === 'restock' || p.kind === 'return') ? Math.abs(p.amount) : -Math.abs(p.amount);
    r += d;
    if (r < 0 && !firstNeg) firstNeg = { date: p.date, running: r };
    if (r < minR) minR = r;
  }
  console.log(`${id} ${skuNames[id]}: final=${r}, firstNegative=${JSON.stringify(firstNeg)}, lowest=${minR}`);
}

// ============================================================
// HYPOTHESIS 9 — Adjustment rows
// ============================================================
console.log('');
console.log('================================================================');
console.log('HYPOTHESIS 9 — Adjustment rows (Amount=0)');
console.log('================================================================');
const adj = parsed.filter(p => p.kind === 'adjustment');
console.log(`Adjustment row count: ${adj.length}`);
for (const a of adj) {
  console.log(`  ${a.date} | ${a.itemId} | amt=${a.amount} R#=${a.rNum} | raw=${JSON.stringify(a.raw)}`);
}

// ============================================================
// BONUS — Restock with R# "1234" — what is the actual structure
// ============================================================
console.log('');
console.log('================================================================');
console.log('BONUS — Restock R# distribution');
console.log('================================================================');
const restocks = parsed.filter(p => p.kind === 'restock');
const rRnumDist = {};
for (const r of restocks) {
  const key = r.rNum === '' ? '(empty)' : r.rNum;
  rRnumDist[key] = (rRnumDist[key] || 0) + 1;
}
console.log(`Restock R# distribution: ${JSON.stringify(rRnumDist)}`);

// ============================================================
// BONUS — Look at Login Check / Users / Employee for dates
// ============================================================
console.log('');
console.log('================================================================');
console.log('BONUS — Login Check / Users / Employee earliest dates');
console.log('================================================================');
for (const tabName of ['Login Check', 'Users', 'Employee']) {
  const t = doc.sheetsByTitle[tabName];
  if (!t) { console.log(`No tab "${tabName}"`); continue; }
  await t.loadHeaderRow();
  const headers = t.headerValues;
  const rows = await t.getRows();
  console.log(`${tabName}: ${rows.length} rows, headers=${JSON.stringify(headers)}`);
  let minD = null, maxD = null;
  for (const r of rows) {
    const o = r.toObject();
    for (const k of Object.keys(o)) {
      if (/date|time|created|login/i.test(k)) {
        const d = parseLegacyDateTime(o[k]);
        if (d) {
          if (!minD || d < minD) minD = d;
          if (!maxD || d > maxD) maxD = d;
        }
      }
    }
  }
  console.log(`  Date range: ${minD} -> ${maxD}`);
  if (rows.length > 0) console.log(`  First row: ${JSON.stringify(rows[0].toObject())}`);
}

console.log('');
console.log('=== INVESTIGATION COMPLETE ===');
