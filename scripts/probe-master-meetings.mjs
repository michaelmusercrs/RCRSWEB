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

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, auth);
await doc.loadInfo();

for (const tabName of ['MeetingNumbers_2026', 'MeetingPrep']) {
  const sheet = doc.sheetsByTitle[tabName];
  if (!sheet) { console.log(`(no tab ${tabName})`); continue; }
  console.log(`\n=== ${tabName} ===`);
  console.log(`Declared rows: ${sheet.rowCount}`);
  await sheet.loadCells();
  let nonEmpty = 0;
  for (let r = 0; r < sheet.rowCount; r++) {
    const v = String(sheet.getCell(r, 0).value || '').trim();
    if (v) nonEmpty++;
  }
  console.log(`Non-empty rows (col A): ${nonEmpty}`);
  // Show first 3 rows × 12 cols
  const cols = Math.min(sheet.columnCount, 12);
  for (let r = 0; r < Math.min(4, sheet.rowCount); r++) {
    const vals = [];
    for (let c = 0; c < cols; c++) vals.push(String(sheet.getCell(r, c).value || '').slice(0, 15));
    console.log(`  [${r}]`, vals.map(v => v.padEnd(15)).join(' | '));
  }
}
