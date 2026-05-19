import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
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

const sheetId = process.env.MONDAY_MEETING_SHEET_ID || '1tEbMVUrvrRIkptISumvIrcgUhSWN5X2ldYro9ADTXF0';
const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');

function tabNameToDate(tab) {
  const m = tab.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const [_, mo, d, y] = m;
  return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
}
function parseDollar(v) {
  if (v == null) return 0;
  return parseFloat(String(v).replace(/[^0-9.\-]/g, '')) || 0;
}

const auth = new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const doc = new GoogleSpreadsheet(sheetId, auth);
await doc.loadInfo();

// rep -> month (YYYY-MM) -> total
const data = {};
const monthsSeen = new Set();

for (const sheet of doc.sheetsByIndex) {
  const date = tabNameToDate(sheet.title);
  if (!date || !date.startsWith('2026')) continue;
  const month = date.substring(0, 7);

  await sheet.loadCells();
  const rows = sheet.rowCount;
  const cols = Math.min(sheet.columnCount, 13);

  const header = {};
  for (let c = 0; c < cols; c++) header[c] = String(sheet.getCell(0,c).value||'').trim();
  const hasHeader = Object.values(header).some(h => h.toLowerCase() === 'inspected');
  let revCol = 6;
  if (hasHeader) {
    for (let c = 0; c < cols; c++) {
      if (header[c] === '$$$$$' || /revenue/i.test(header[c])) revCol = c;
    }
  }
  const start = hasHeader ? 1 : 0;
  for (let r = start; r < rows; r++) {
    const rep = String(sheet.getCell(r,0).value||'').trim();
    if (!rep || rep.toLowerCase() === 'total') continue;
    const cell = sheet.getCell(r, revCol);
    const rev = parseDollar(cell.formattedValue ?? cell.value);
    if (rev > 0) {
      monthsSeen.add(month);
      if (!data[rep]) data[rep] = {};
      data[rep][month] = (data[rep][month] || 0) + rev;
    }
  }
}

const months = [...monthsSeen].sort();
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const monthLabel = m => MONTH_NAMES[parseInt(m.split('-')[1], 10) - 1];

// Compute YTD per rep, sort desc
const reps = Object.entries(data).map(([rep, m]) => {
  const ytd = Object.values(m).reduce((s,v)=>s+v,0);
  return { rep, months: m, ytd };
}).sort((a,b) => b.ytd - a.ytd);

// Print table
const fmt = n => n ? '$' + n.toLocaleString() : '—';
const colWidths = { rep: 16 };
months.forEach(m => colWidths[m] = 12);
colWidths.ytd = 14;

const header = 'Rep'.padEnd(colWidths.rep) + months.map(m => monthLabel(m).padStart(colWidths[m])).join('') + 'YTD'.padStart(colWidths.ytd);
const sep = '-'.repeat(header.length);
console.log('\n=== 2026 SALES BY MONTH PER REP (Monday Meeting accrual) ===\n');
console.log(header);
console.log(sep);

for (const { rep, months: m, ytd } of reps) {
  let row = rep.padEnd(colWidths.rep);
  for (const mo of months) row += fmt(m[mo] || 0).padStart(colWidths[mo]);
  row += fmt(ytd).padStart(colWidths.ytd);
  console.log(row);
}
console.log(sep);

// Monthly totals
let totalRow = 'TOTAL'.padEnd(colWidths.rep);
let grandTotal = 0;
for (const mo of months) {
  const t = reps.reduce((s,r)=>s+(r.months[mo]||0),0);
  grandTotal += t;
  totalRow += fmt(t).padStart(colWidths[mo]);
}
totalRow += fmt(grandTotal).padStart(colWidths.ytd);
console.log(totalRow);

fs.writeFileSync('data/sales-2026-monthly.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  months,
  byRep: Object.fromEntries(reps.map(r => [r.rep, { ...r.months, ytd: r.ytd }])),
}, null, 2));
console.log('\nWrote data/sales-2026-monthly.json');
