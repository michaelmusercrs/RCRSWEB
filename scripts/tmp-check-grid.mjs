import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import fs from 'fs';

for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, auth);
await doc.loadInfo();
for (const name of ['Tickets', 'Delivery Tickets', 'Invoices', 'Job_Breakdowns', 'Inventory_Products']) {
  const s = doc.sheetsByTitle[name];
  if (!s) { console.log(name, '→ missing'); continue; }
  const rows = await s.getRows();
  console.log(`${name}: gridRows=${s.gridProperties.rowCount} usedDataRows=${rows.length} headroom=${s.gridProperties.rowCount - 1 - rows.length}`);
}
