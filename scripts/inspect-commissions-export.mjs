/**
 * Dump the raw structure of the YTD commissions export so we can write a
 * correct parser. QB exports group rows by rep with sub-totals.
 */
import XLSX from 'xlsx';
import path from 'path';
import os from 'os';

const home = os.homedir();
const source = path.join(home, 'Downloads', '33026', 'This_YTD_Commissions_by_transaction (2).xls');
const wb = XLSX.readFile(source);
const sheet = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log(`Rows: ${raw.length}, Cols: ${Math.max(...raw.map(r => (r ? r.length : 0)))}`);
console.log(`First 30 rows × first 8 cols:\n`);
raw.slice(0, 30).forEach((r, i) => {
  const cells = (r || []).slice(0, 8).map(v => String(v ?? '').slice(0, 22).padEnd(22));
  console.log(`  [${String(i).padStart(2)}]  ${cells.join(' | ')}`);
});

console.log(`\n--- Last 15 rows ---`);
raw.slice(-15).forEach((r, i) => {
  const cells = (r || []).slice(0, 8).map(v => String(v ?? '').slice(0, 22).padEnd(22));
  console.log(`  [${raw.length - 15 + i}]  ${cells.join(' | ')}`);
});
