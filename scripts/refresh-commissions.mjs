/**
 * Re-parse the most recent QuickBooks 1099 commission export and merge any
 * new rows into data/commissions.json.
 *
 * The QB "1099 Transaction Detail" XLS has this structure:
 *   row 0..3: company / report name / date range / blank
 *   row 4:    headers — col 0 is the rep group label (empty here), then
 *             col 1=Date, col 2=Amount, col 3=Num (check#), col 4=1099 Box
 *   row 5+:   for each entity:
 *               • a row with the entity name in col 0 and other cols empty
 *               • N transaction rows (date / amount / num)
 *               • a "Total for <entity>" row with the sum in col 2
 *   final row: "TOTAL AMOUNT" + grand total
 *
 * Reps are mapped from their 1099 business entity name to their human name
 * (e.g. BCM Contracting LLC → Brendon Muse) via REP_ENTITY_MAP.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import XLSX from 'xlsx';

const home = os.homedir();
const candidates = [
  path.join(home, 'Downloads', '33026', 'This_YTD_Commissions_by_transaction (2).xls'),
  path.join(home, 'Downloads', '33026', 'This_YTD_Commissions_by_transaction (1).xls'),
  path.join(home, 'Downloads', 'This_YTD_Commissions_by_transaction.xls'),
  path.join(home, 'Downloads', 'commissionreport_extracted', 'This_YTD_Commissions_by_transaction.xls'),
  'H:\\My Drive\\This_YTD_Commissions_by_transaction (1).xls',
  'H:\\My Drive\\This_YTD_Commissions_by_transaction.xls',
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
  console.error('No YTD commission export found. Looked in:');
  candidates.forEach(c => console.error('  -', c));
  process.exit(1);
}

console.log(`Source: ${source}`);
console.log(`Mtime:  ${new Date(sourceMtime).toISOString()}\n`);

// 1099 entity → human rep name. Matches lib/team-roles.ts mapping +
// project_rcrs_rep_entities memory. Direct hits (rep name = entity name)
// pass through unchanged.
const REP_ENTITY_MAP = {
  'BCM Contracting LLC': 'Brendon Muse',
  'Rudys Roofing Insights LLC': 'Adam Rudell',
  'Roof Angel, LLC': 'Aaron Lussi',
  'Roof Angel LLC': 'Aaron Lussi',
  'Jeremy T. Wages': 'Travis Wages',
  'Jeremy T Wages': 'Travis Wages',
  'Gregory Ray Muse': 'Greg Muse',
};

function repFromEntity(entity) {
  if (!entity) return '';
  const trimmed = entity.trim();
  if (REP_ENTITY_MAP[trimmed]) return REP_ENTITY_MAP[trimmed];
  return trimmed; // already a human name (Bart Roberts, John Cordonis, etc.)
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

// Columns in the QB 1099 detail export
const COL_ENTITY = 0;
const COL_DATE = 1;
const COL_AMOUNT = 2;
const COL_NUM = 3;

const records = [];
let currentEntity = '';

// Skip header rows (first 5 — title / date range / column headers)
for (let r = 5; r < raw.length; r++) {
  const row = raw[r] || [];
  const entityCell = String(row[COL_ENTITY] || '').trim();
  const dateCell = excelDateToMDY(row[COL_DATE]);
  const amountCell = row[COL_AMOUNT];

  // Group header: entity name in col 0, no date in col 1
  if (entityCell && !dateCell) {
    if (entityCell.startsWith('Total for ')) continue; // sub-total
    if (entityCell.startsWith('TOTAL AMOUNT')) continue; // grand total
    if (/^[A-Za-z]+,\s+[A-Z][a-z]+\s+\d/.test(entityCell)) continue; // "Monday, Mar 30 2026 …" footer
    currentEntity = entityCell;
    continue;
  }

  // Transaction row
  if (!dateCell) continue;
  const amount = parseFloat(String(amountCell || '0').replace(/[$,]/g, '')) || 0;
  const num = String(row[COL_NUM] || '').trim();

  records.push({
    salesRep: repFromEntity(currentEntity),
    date: dateCell,
    amount,
    balance: 0,
    jobNumber: num,
    customer: `QuickBooks 1099 - ${currentEntity}`,
  });
}

console.log(`Parsed ${records.length} transactions from export.`);
const exportTotal = records.reduce((s, r) => s + r.amount, 0);
console.log(`Export total: $${exportTotal.toFixed(2)}\n`);

const snapshot = JSON.parse(fs.readFileSync('data/commissions.json', 'utf8'));
const snapshot2026 = snapshot.filter(r => r.date?.endsWith('/2026'));
const snapshot2026Total = snapshot2026.reduce((s, r) => s + (r.amount || 0), 0);
console.log(`Snapshot: ${snapshot.length} total rows, ${snapshot2026.length} 2026 rows totaling $${snapshot2026Total.toFixed(2)}.\n`);

// Dedup key intentionally excludes salesRep AND jobNumber:
//   - rep: different mapping vintages produce different rep names
//   - jobNumber: original March snapshot left jobNumber empty for 1099 rows;
//     we now extract the check# from col 3. customer holds the original
//     entity name as the stable identifier.
function tx(r) {
  return `${r.date}|${r.amount.toFixed(2)}|${r.customer}`;
}
const snapshotKeys = new Set(snapshot.map(tx));
const exportKeys = new Set(records.map(tx));

const toAdd = records.filter(r => !snapshotKeys.has(tx(r)));
const inSnapshotNotInExport2026 = snapshot2026.filter(r => !exportKeys.has(tx(r)));

console.log(`  Rows in export NOT in snapshot: ${toAdd.length}`);
console.log(`  2026 rows in snapshot NOT in export: ${inSnapshotNotInExport2026.length}`);

if (toAdd.length === 0 && inSnapshotNotInExport2026.length === 0) {
  console.log('\n✓ Snapshot already matches export. No refresh needed.');
  console.log('  To get newer data, download a fresh QB report and drop it in ~/Downloads.');
} else {
  if (toAdd.length > 0) {
    console.log('\n  New rows being added (first 5):');
    toAdd.slice(0, 5).forEach(r =>
      console.log(`    ${r.salesRep.padEnd(20)} ${r.date}  $${r.amount.toFixed(2)}  ${r.jobNumber}  ${r.customer.slice(0, 40)}`),
    );
    const merged = [...snapshot, ...toAdd];
    fs.writeFileSync('data/commissions.json', JSON.stringify(merged, null, 2));
    console.log(`\nWrote ${merged.length} rows to data/commissions.json (+${toAdd.length}).`);
  }
}
