/**
 * Extract division-leader / recruiter-override checks from the QB 1099
 * Transaction Detail Report. Detects checks where the memo line indicates
 * a recruit/division payout (e.g. "DIVISION LEADER FOR BRANDON",
 * "OCTOBER 2023 DIVISION LEADER BONUS", "BONUS RECRUIT MAY 2023").
 *
 * Writes data/division-leader-checks.json with per-check detail and
 * per-recipient rollups. Re-run after a fresh QB export lands.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import XLSX from 'xlsx';

const file = path.join(
  os.homedir(),
  'Downloads',
  'River+City+Roofing+Solutions,+Inc._1099+Transaction+Detail+Report.xlsx',
);

if (!fs.existsSync(file)) {
  console.error('Not found:', file);
  process.exit(1);
}

const wb = XLSX.readFile(file);
const sh = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '' });

// Entity → human rep mapping (matches refresh-commissions-full.mjs)
const REP_MAP = {
  'BCM Contracting LLC': 'Brendon Muse',
  'Rudys Roofing Insights LLC': 'Adam Rudell',
  'Roof Angel, LLC': 'Aaron Lussi',
  'Roof Angel LLC': 'Aaron Lussi',
  'Jeremy T. Wages': 'Travis Wages',
  'Jeremy T Wages': 'Travis Wages',
  'Gregory Ray Muse': 'Greg Muse',
  'Antony Barton Roberts': 'Bart Roberts',
  'Boykin Dream Big Win Big LLC': 'Aaron Boykin',
  'BPB Contracting LLC': 'Brandon Bradford',
  'Richard  Geahr': 'Richard Geahr',
};
const rep = e => (REP_MAP[(e || '').trim()] || (e || '').trim());

const COL_DATE = 1, COL_TYPE = 2, COL_NUM = 3, COL_MEMO = 4, COL_AMOUNT = 8;

let headerRow = -1;
for (let r = 0; r < 20; r++) {
  if (String(raw[r]?.[1] || '').trim() === 'Date') { headerRow = r; break; }
}

const checks = [];
let currentEntity = '';

const PATTERN = /division|recruit|override|leader|mentor|team\s*lead|manager.{0,2}share|trail/i;

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
  if (!memo || !PATTERN.test(memo)) continue;
  const amount = parseFloat(String(row[COL_AMOUNT] || '0').replace(/[$,]/g, '')) || 0;
  checks.push({
    date: dateCell,
    entity: currentEntity,
    recipient: rep(currentEntity),
    type: String(row[COL_TYPE] || '').trim(),
    num: String(row[COL_NUM] || '').trim(),
    amount,
    memo,
  });
}

// Sort newest first
checks.sort((a, b) => {
  const isoOf = d => { const [m, dd, y] = d.split('/'); return `${y}-${m.padStart(2, '0')}-${dd.padStart(2, '0')}`; };
  return isoOf(b.date).localeCompare(isoOf(a.date));
});

// Rollups by recipient
const byRecipient = {};
for (const c of checks) {
  if (!byRecipient[c.recipient]) {
    byRecipient[c.recipient] = { recipient: c.recipient, total: 0, count: 0, entities: new Set() };
  }
  byRecipient[c.recipient].total += c.amount;
  byRecipient[c.recipient].count += 1;
  byRecipient[c.recipient].entities.add(c.entity);
}
const rollup = Object.values(byRecipient)
  .map(r => ({ ...r, total: Math.round(r.total * 100) / 100, entities: [...r.entities] }))
  .sort((a, b) => b.total - a.total);

// By year
const byYear = {};
for (const c of checks) {
  const y = c.date.slice(-4);
  byYear[y] = (byYear[y] || 0) + c.amount;
}
const yearRollup = Object.entries(byYear)
  .map(([year, total]) => ({ year, total: Math.round(total * 100) / 100 }))
  .sort((a, b) => a.year.localeCompare(b.year));

const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  source: path.basename(file),
  totalChecks: checks.length,
  totalAmount: Math.round(checks.reduce((s, c) => s + c.amount, 0) * 100) / 100,
  byRecipient: rollup,
  byYear: yearRollup,
  checks,
};

fs.writeFileSync('data/division-leader-checks.json', JSON.stringify(out, null, 2));

console.log(`Wrote data/division-leader-checks.json`);
console.log(`Total: ${out.totalChecks} checks, $${out.totalAmount.toFixed(2)}`);
console.log(`\nBy recipient:`);
for (const r of rollup) {
  console.log(`  ${r.recipient.padEnd(25)} $${r.total.toFixed(2).padStart(10)}  (${r.count} checks)`);
}
console.log(`\nBy year:`);
for (const y of yearRollup) {
  console.log(`  ${y.year}  $${y.total.toFixed(2)}`);
}
