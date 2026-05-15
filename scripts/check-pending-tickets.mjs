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

const { JWT } = await import('google-auth-library');
const { GoogleSpreadsheet } = await import('google-spreadsheet');

const sheetsId = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(sheetsId, auth);
await doc.loadInfo();
console.log('Sheet:', doc.title);
const tab = doc.sheetsByTitle['Tickets'];
if (!tab) {
  console.log('\nNO "Tickets" tab in the master sheet.');
  console.log('Available tabs:', Object.keys(doc.sheetsByTitle).join(', '));
  process.exit(0);
}
const rows = await tab.getRows();
console.log('Total rows in Tickets sheet:', rows.length);
const byStatus = {};
const deliveryByStatus = {};
for (const r of rows) {
  const s = r.get('status') || 'BLANK';
  const t = r.get('ticketType') || 'BLANK';
  byStatus[s] = (byStatus[s] || 0) + 1;
  if (t === 'delivery') deliveryByStatus[s] = (deliveryByStatus[s] || 0) + 1;
}
console.log('\nAll tickets by status:', byStatus);
console.log('Delivery tickets by status:', deliveryByStatus);
console.log('\n>>> PENDING BACKFILL (delivery + status=created):', deliveryByStatus.created || 0);

console.log('\nFirst 10 delivery tickets:');
rows.filter(r => r.get('ticketType') === 'delivery').slice(0, 10).forEach(r => {
  console.log(`  ${r.get('ticketId')} | status=${r.get('status')} | job=${r.get('referenceNumber')} | customer=${r.get('customerName')} | created=${r.get('createdAt')}`);
});
