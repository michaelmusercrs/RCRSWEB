// Reproduce warm-instance staleness: hold a loaded GoogleSpreadsheet doc,
// append a row via a SECOND doc instance (simulating another lambda), then
// getRows from the warm doc. Uses a scratch tab so nothing real is touched.
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import fs from 'fs';

for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const mkAuth = () => new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const TAB = '_warm_repro_scratch';

// warm process: load doc + tab now
const warmDoc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, mkAuth());
await warmDoc.loadInfo();
let warmSheet = warmDoc.sheetsByTitle[TAB];
if (!warmSheet) {
  warmSheet = await warmDoc.addSheet({ title: TAB, headerValues: ['id', 'note'], gridProperties: { rowCount: 5, columnCount: 3 } });
  await warmDoc.loadInfo(); // re-key sheetsByTitle
  warmSheet = warmDoc.sheetsByTitle[TAB];
}
await warmSheet.loadHeaderRow();
const before = await warmSheet.getRows();
console.log('warm: rows before =', before.length, 'gridRows =', warmSheet.gridProperties.rowCount);

// fresh process: append rows until grid must expand
const freshDoc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, mkAuth());
await freshDoc.loadInfo();
const freshSheet = freshDoc.sheetsByTitle[TAB];
await freshSheet.loadHeaderRow();
for (let i = 0; i < 6; i++) {
  await freshSheet.addRow({ id: `row-${Date.now()}-${i}`, note: 'from fresh' });
}
const freshRows = await freshSheet.getRows();
console.log('fresh: rows after append =', freshRows.length, 'gridRows =', freshSheet.gridProperties.rowCount);

// warm process re-reads WITHOUT re-loadInfo (like a warm lambda)
const after = await warmSheet.getRows();
console.log('warm: rows after (no reload) =', after.length, 'cached gridRows =', warmSheet.gridProperties.rowCount);
console.log(after.length === freshRows.length
  ? 'NO STALENESS: warm sees all rows'
  : `STALE: warm sees ${after.length}, fresh sees ${freshRows.length} → getRows bounded by cached grid rowCount`);

// candidate fix: explicit large limit overrides the cached rowCount bound
const fixed = await warmSheet.getRows({ limit: 100000 });
console.log('warm with {limit:100000}: rows =', fixed.length, fixed.length === freshRows.length ? '→ FIX WORKS' : '→ fix insufficient');

// cleanup scratch tab
await freshSheet.delete();
console.log('scratch tab deleted');
