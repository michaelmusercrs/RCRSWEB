/**
 * Parse the full-history "1099 Transaction Detail Report" XLSX and merge any
 * new rows into data/commissions.json.
 *
 * Column layout (verified 2026-05-19 against the May 19 export):
 *   col 0:  entity / group header / "Total for X" / "TOTAL AMOUNT" / footer
 *   col 1:  Date              (M/D/YYYY)
 *   col 2:  Transaction Type  (Check, Bill, etc.)
 *   col 3:  Num               (check #)
 *   col 4:  Memo/Description
 *   col 5:  1099 Box          (NEC)
 *   col 6:  Account
 *   col 7:  Split
 *   col 8:  Amount
 *   col 9:  Balance
 *   col 10: Tax ID
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import XLSX from 'xlsx';

const home = os.homedir();
const candidates = [
  path.join(home, 'Downloads', 'River+City+Roofing+Solutions,+Inc._1099+Transaction+Detail+Report.xlsx'),
  // Fall back to YTD if all-dates isn't available
  path.join(home, 'Downloads', '33026', 'This_YTD_Commissions_by_transaction (2).xls'),
  path.join(home, 'Downloads', 'This_YTD_Commissions_by_transaction.xls'),
];

let source = null;
let sourceMtime = 0;
for (const p of candidates) {
  try {
    const stat = fs.statSync(p);
    if (stat.mtimeMs > sourceMtime) { sourceMtime = stat.mtimeMs; source = p; }
  } catch { /* skip */ }
}

if (!source) {
  console.error('No commission export found. Looked in:');
  candidates.forEach(c => console.error('  -', c));
  process.exit(1);
}

console.log(`Source: ${path.basename(source)}`);
console.log(`Mtime:  ${new Date(sourceMtime).toISOString()}\n`);

// Entity-name remapping (matches lib/team-roles.ts + project_rcrs_rep_entities memory).
// Anything not here is kept as-is (the entity name is itself a valid rep name
// in many cases — Bart Roberts, John Cordonis, Aaron Boykin, etc.).
const REP_ENTITY_MAP = {
  'BCM Contracting LLC': 'Brendon Muse',
  'Rudys Roofing Insights LLC': 'Adam Rudell',
  'Roof Angel, LLC': 'Aaron Lussi',
  'Roof Angel LLC': 'Aaron Lussi',
  'Jeremy T. Wages': 'Travis Wages',
  'Jeremy T Wages': 'Travis Wages',
  'Gregory Ray Muse': 'Greg Muse',
  // From the existing snapshot:
  'Antony Barton Roberts': 'Bart Roberts',
};
function repFromEntity(entity) {
  const trimmed = (entity || '').trim();
  return REP_ENTITY_MAP[trimmed] || trimmed;
}

function excelDateToMDY(v) {
  if (typeof v === 'number' && v > 30000 && v < 100000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`;
  }
  const s = String(v || '').trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s;
  return '';
}

const wb = XLSX.readFile(source);
const sheet = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

// Find header row
let headerRow = -1;
for (let r = 0; r < Math.min(raw.length, 20); r++) {
  const row = raw[r] || [];
  if (String(row[1] || '').trim() === 'Date' && String(row[8] || '').trim() === 'Amount') {
    headerRow = r;
    break;
  }
  if (String(row[1] || '').trim() === 'Date' && String(row[2] || '').trim() === 'Amount') {
    // YTD format — fall through to old layout
    headerRow = r;
    break;
  }
}
if (headerRow < 0) {
  console.error('Could not find header row.');
  process.exit(1);
}

// Detect layout — full vs YTD
const fullLayout = String(raw[headerRow][8] || '').trim() === 'Amount';
const COL_ENTITY = 0;
const COL_DATE = 1;
const COL_TYPE = fullLayout ? 2 : -1;
const COL_NUM = fullLayout ? 3 : 3;
const COL_MEMO = fullLayout ? 4 : -1;
const COL_AMOUNT = fullLayout ? 8 : 2;

console.log(`Layout: ${fullLayout ? 'full 1099 detail' : 'YTD short'} (Amount at col ${COL_AMOUNT})\n`);

const records = [];
let currentEntity = '';
let skipped = 0;

for (let r = headerRow + 1; r < raw.length; r++) {
  const row = raw[r] || [];
  const entityCell = String(row[COL_ENTITY] || '').trim();
  const dateCell = excelDateToMDY(row[COL_DATE]);
  const amountCell = row[COL_AMOUNT];

  // Group header (entity name, no date)
  if (entityCell && !dateCell) {
    if (entityCell.startsWith('Total for ')) continue;
    if (entityCell.startsWith('TOTAL AMOUNT')) continue;
    if (/^[A-Za-z]+day,/.test(entityCell)) continue; // "Tuesday, May 19 2026 …"
    currentEntity = entityCell;
    continue;
  }

  // Transaction row
  if (!dateCell) continue;

  // Filter out obvious typos that produce stray years (1986, 2028, 2031, 2034)
  const year = parseInt(dateCell.slice(-4), 10);
  if (year < 2018 || year > 2026) { skipped++; continue; }

  const amount = parseFloat(String(amountCell || '0').replace(/[$,]/g, '')) || 0;
  if (amount === 0) continue; // skip blanks

  const num = String(row[COL_NUM] || '').trim();
  const memo = fullLayout ? String(row[COL_MEMO] || '').trim() : '';

  records.push({
    salesRep: repFromEntity(currentEntity),
    date: dateCell,
    amount,
    balance: 0,
    jobNumber: num,
    customer: `QuickBooks 1099 - ${currentEntity}`,
    memo: memo || undefined,
  });
}

console.log(`Parsed ${records.length} transactions (skipped ${skipped} pre-2018 / post-2026 typo rows).`);
const exportTotal = records.reduce((s, r) => s + r.amount, 0);
console.log(`Export total (2018-2026 only): $${exportTotal.toFixed(2)}\n`);

// Group by year for sanity
const byYear = {};
for (const r of records) {
  const y = r.date.slice(-4);
  byYear[y] = (byYear[y] || 0) + 1;
}
console.log('Export rows by year:', JSON.stringify(byYear));

const snapshot = JSON.parse(fs.readFileSync('data/commissions.json', 'utf8'));
const snapByYear = {};
for (const r of snapshot) {
  if (!r.date) continue;
  const y = r.date.slice(-4);
  snapByYear[y] = (snapByYear[y] || 0) + 1;
}
console.log('Snapshot rows by year:', JSON.stringify(snapByYear));

// Dedup key: date + amount + entity-customer (exclude rep / jobNumber — those
// can vary between original import and this parse)
function tx(r) {
  return `${r.date}|${r.amount.toFixed(2)}|${r.customer}`;
}
const snapshotKeys = new Set(snapshot.map(tx));

const toAdd = records.filter(r => !snapshotKeys.has(tx(r)));
console.log(`\n  Rows in export NOT in snapshot: ${toAdd.length}`);

const addByYear = {};
for (const r of toAdd) {
  const y = r.date.slice(-4);
  addByYear[y] = (addByYear[y] || 0) + 1;
}
console.log('  New rows by year:', JSON.stringify(addByYear));

if (toAdd.length > 0) {
  console.log('\n  First 5 new rows:');
  toAdd.slice(0, 5).forEach(r =>
    console.log(`    ${r.salesRep.padEnd(20)} ${r.date}  $${r.amount.toFixed(2)}  ${r.jobNumber.padEnd(6)}  ${r.customer.slice(0, 40)}`),
  );

  // Strip the temp `memo` field before persisting (snapshot doesn't carry it)
  const cleanAdd = toAdd.map(r => ({
    salesRep: r.salesRep,
    date: r.date,
    amount: r.amount,
    balance: r.balance,
    jobNumber: r.jobNumber,
    customer: r.customer,
  }));
  const merged = [...snapshot, ...cleanAdd];
  fs.writeFileSync('data/commissions.json', JSON.stringify(merged, null, 2));
  console.log(`\nWrote ${merged.length} rows to data/commissions.json (+${cleanAdd.length}).`);
} else {
  console.log('\n✓ Snapshot already in sync.');
}
