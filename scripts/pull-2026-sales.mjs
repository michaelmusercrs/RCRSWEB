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

if (!sheetId || !email || !key) {
  console.error('Missing env vars'); process.exit(1);
}

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

const totals = {};
const tabsRead = [];
let recordCount = 0;

for (const sheet of doc.sheetsByIndex) {
  const date = tabNameToDate(sheet.title);
  if (!date || !date.startsWith('2026')) continue;
  tabsRead.push(sheet.title);

  await sheet.loadCells();
  const rows = sheet.rowCount;
  const cols = Math.min(sheet.columnCount, 13);

  // Detect header row
  const header = {};
  for (let c = 0; c < cols; c++) header[c] = String(sheet.getCell(0,c).value||'').trim();
  const hasHeader = Object.values(header).some(h => h.toLowerCase() === 'inspected');

  // Find revenue column
  let revCol = 6; // default
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
      totals[rep] = (totals[rep]||0) + rev;
      recordCount++;
    }
  }
}

const sorted = Object.entries(totals).sort((a,b)=>b[1]-a[1]);
const total = sorted.reduce((s,[,v])=>s+v,0);

console.log('2026 tabs read:', tabsRead.length);
console.log('Tabs:', tabsRead.join(', '));
console.log('Records:', recordCount);
console.log('\n=== 2026 YTD SALES BY REP ===');
console.log('Total: $' + total.toLocaleString());
for (const [rep, rev] of sorted) {
  console.log('  ' + rep.padEnd(20) + ' $' + rev.toLocaleString());
}

fs.writeFileSync('data/sales-2026-ytd.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  tabsRead,
  recordCount,
  total,
  byRep: Object.fromEntries(sorted),
}, null, 2));
console.log('\nWrote data/sales-2026-ytd.json');
