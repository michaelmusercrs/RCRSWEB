/**
 * Diagnose why master.Commissions returns 0 rows via getRows().
 * Probe: row count, header row, first/last data rows, sample cells.
 */
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

const sheetId = process.env.GOOGLE_SHEETS_ID;
const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');

const auth = new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const doc = new GoogleSpreadsheet(sheetId, auth);
await doc.loadInfo();

const sheet = doc.sheetsByTitle['Commissions'];
if (!sheet) {
  console.log('No tab named Commissions on master sheet.');
  // Look for anything commission-related
  const candidates = doc.sheetsByIndex.filter(s => /commis|comm_/i.test(s.title));
  console.log('Candidate tabs:', candidates.map(s => s.title));
  process.exit(0);
}

console.log(`Tab: "${sheet.title}"`);
console.log(`Declared rowCount: ${sheet.rowCount}`);
console.log(`Declared columnCount: ${sheet.columnCount}`);

// Load the actual cells to see what's there
await sheet.loadCells();

// Walk down looking for a header row + data
const sample = [];
for (let r = 0; r < Math.min(sheet.rowCount, 10); r++) {
  const rowVals = [];
  for (let c = 0; c < Math.min(sheet.columnCount, 8); c++) {
    rowVals.push(String(sheet.getCell(r, c).value || '').slice(0, 20));
  }
  sample.push(rowVals);
}
console.log('\nFirst 10 rows × first 8 cols:');
sample.forEach((row, idx) => {
  console.log(`  [${idx}]`, row.map(v => v.padEnd(20)).join(' | '));
});

// Count non-empty rows
let nonEmpty = 0;
let lastNonEmptyRow = -1;
for (let r = 0; r < sheet.rowCount; r++) {
  const hasContent =
    String(sheet.getCell(r, 0).value || '').trim() ||
    String(sheet.getCell(r, 1).value || '').trim() ||
    String(sheet.getCell(r, 2).value || '').trim();
  if (hasContent) {
    nonEmpty++;
    lastNonEmptyRow = r;
  }
}
console.log(`\nNon-empty rows: ${nonEmpty}`);
console.log(`Last non-empty row index: ${lastNonEmptyRow}`);

// Try getRows() to see what it returns
try {
  const rows = await sheet.getRows({ limit: 10 });
  console.log(`\ngetRows() returned: ${rows.length}`);
  if (rows.length > 0) {
    console.log('Header keys:', Object.keys(rows[0].toObject()));
    console.log('First row:', rows[0].toObject());
  }
} catch (err) {
  console.log('getRows() failed:', err.message);
}
