// One-off: clear the GAF_Report_Queue data rows (removes the duplicate 'new'
// rows left by the stale-read bug). Header stays. Read/write to Sheets only.
//   node scripts/gaf-clear-queue.mjs
import fs from 'node:fs';
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

for (const f of ['.env.local', '.env']) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const jwt = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, jwt);
await doc.loadInfo();

const tabName = process.argv[2] || 'GAF_Report_Queue';
const sheet = doc.sheetsByTitle[tabName];
if (!sheet) { console.log(`${tabName}: not found (nothing to clear)`); process.exit(0); }
const rows = await sheet.getRows({ limit: 100000 });
console.log(`${tabName}: ${rows.length} rows → clearing…`);
for (const row of rows.reverse()) { await row.delete(); }
console.log(`${tabName}: cleared. Now ${(await sheet.getRows({ limit: 100000 })).length} rows.`);
