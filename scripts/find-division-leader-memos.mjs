/**
 * Read-only scan of the QB 1099 Transaction Detail Report memo column
 * looking for division-leader / recruiter override patterns.
 */
import XLSX from 'xlsx';
import path from 'path';
import os from 'os';

const file = path.join(os.homedir(), 'Downloads', 'River+City+Roofing+Solutions,+Inc._1099+Transaction+Detail+Report.xlsx');
const wb = XLSX.readFile(file);
const sh = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '' });

// Find header row, then walk
let headerRow = -1;
for (let r = 0; r < 20; r++) {
  if (String(raw[r]?.[0] || '').trim() === 'Transaction type' ||
      String(raw[r]?.[1] || '').trim() === 'Date') { headerRow = r; break; }
}

const COL_DATE = 1, COL_NUM = 3, COL_MEMO = 4, COL_AMOUNT = 8;

let currentEntity = '';
const flagged = [];
const allMemos = [];

function isHit(memo) {
  const m = memo.toLowerCase();
  return /division|recruit|override|leader|team\s*lead|manager(?:s)?\s*share|trail|mentor|recru/i.test(memo);
}

for (let r = headerRow + 1; r < raw.length; r++) {
  const row = raw[r] || [];
  const entityCell = String(row[0] || '').trim();
  const dateCell = String(row[COL_DATE] || '').trim();
  if (entityCell && !dateCell) {
    if (entityCell.startsWith('Total for ') || entityCell.startsWith('TOTAL') ||
        /^[A-Za-z]+day,/.test(entityCell)) continue;
    currentEntity = entityCell;
    continue;
  }
  if (!dateCell) continue;
  const memo = String(row[COL_MEMO] || '').trim();
  if (!memo) continue;
  const amount = parseFloat(String(row[COL_AMOUNT] || '0').replace(/[$,]/g, '')) || 0;
  const num = String(row[COL_NUM] || '').trim();
  allMemos.push({ entity: currentEntity, date: dateCell, memo, amount, num });
  if (isHit(memo)) {
    flagged.push({ entity: currentEntity, date: dateCell, memo, amount, num });
  }
}

console.log('Total memo rows:', allMemos.length);
console.log('Flagged (division/recruit/override/leader/mentor/trail):', flagged.length);
console.log();

// Bucket flagged memos by entity
const byEntity = {};
for (const f of flagged) {
  if (!byEntity[f.entity]) byEntity[f.entity] = { count: 0, total: 0, examples: [] };
  byEntity[f.entity].count += 1;
  byEntity[f.entity].total += f.amount;
  if (byEntity[f.entity].examples.length < 4) byEntity[f.entity].examples.push({ date: f.date, memo: f.memo.slice(0, 70), amount: f.amount });
}

console.log('By recipient entity:');
for (const [e, v] of Object.entries(byEntity).sort((a, b) => b[1].total - a[1].total)) {
  console.log(`\n  ${e}  ($${v.total.toFixed(2)} across ${v.count} checks)`);
  for (const ex of v.examples) console.log(`    ${ex.date}  $${ex.amount.toFixed(2).padStart(10)}  ${ex.memo}`);
}

// Also show top distinct memo phrases
const memoCount = {};
for (const f of flagged) memoCount[f.memo] = (memoCount[f.memo] || 0) + 1;
console.log('\nTop 15 distinct memo phrases (flagged):');
Object.entries(memoCount).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([m, n]) => console.log(`  ${n}× ${m}`));
