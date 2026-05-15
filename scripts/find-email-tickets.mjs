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
const tab = doc.sheetsByTitle['Tickets'];
const rows = await tab.getRows();

const deliveryRows = rows.filter(r => r.get('ticketType') === 'delivery');
console.log('Total delivery tickets:', deliveryRows.length);

const byCreator = {};
for (const r of deliveryRows) {
  const c = r.get('createdBy') || 'BLANK';
  byCreator[c] = (byCreator[c] || 0) + 1;
}
console.log('\nDelivery tickets by createdBy:', byCreator);

// Show ALL non-historical tickets
const fromEmail = deliveryRows.filter(r => r.get('createdBy') === 'email-webhook');
console.log(`\nTickets from email-webhook: ${fromEmail.length}`);
fromEmail.forEach(r => {
  console.log(`  ${r.get('ticketId')} | status=${r.get('status')} | job=${r.get('referenceNumber')} | customer=${r.get('customerName')} | created=${r.get('createdAt')}`);
});

// Show any with non-historical-backfill, non-email-webhook createdBy
const otherCreators = deliveryRows.filter(r => {
  const c = r.get('createdBy');
  return c !== 'historical-backfill' && c !== 'email-webhook';
});
console.log(`\nDelivery tickets from OTHER sources: ${otherCreators.length}`);
otherCreators.slice(0, 20).forEach(r => {
  console.log(`  ${r.get('ticketId')} | createdBy=${r.get('createdBy')} | status=${r.get('status')} | job=${r.get('referenceNumber')} | created=${r.get('createdAt')}`);
});

// Latest 5 by date
console.log('\nMOST RECENT 10 delivery tickets:');
deliveryRows.sort((a, b) => (b.get('createdAt') || '').localeCompare(a.get('createdAt') || ''));
deliveryRows.slice(0, 10).forEach(r => {
  console.log(`  ${r.get('ticketId')} | ${r.get('createdAt')} | createdBy=${r.get('createdBy')} | job=${r.get('referenceNumber')}`);
});
