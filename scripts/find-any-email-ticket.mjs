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

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.DELIVERY_SHEETS_ID, auth);
await doc.loadInfo();
const tab = doc.sheetsByTitle['Tickets'];
const rows = await tab.getRows();

console.log('Total rows in Tickets:', rows.length);

// All rows with createdBy=email-webhook, ANY ticketType
const emailRows = rows.filter(r => r.get('createdBy') === 'email-webhook');
console.log('Rows with createdBy=email-webhook:', emailRows.length);
emailRows.forEach(r => {
  console.log('  ', r.get('ticketId'), '|', r.get('createdAt'), '| type=' + r.get('ticketType'), '| status=' + r.get('status'), '| ref=' + r.get('referenceNumber'));
});

// All rows with ticketId containing R-10997 or R10997
const r10997 = rows.filter(r => {
  const tid = r.get('ticketId') || '';
  const ref = r.get('referenceNumber') || '';
  return tid.includes('10997') || ref.includes('10997');
});
console.log('\nRows referencing 10997:', r10997.length);
r10997.forEach(r => {
  console.log('  ', r.get('ticketId'), '|', r.get('createdAt'), '| createdBy=' + r.get('createdBy'), '| type=' + r.get('ticketType'), '| status=' + r.get('status'));
});

// Sort all rows by createdAt and show top 5 absolute newest
rows.sort((a, b) => (b.get('createdAt') || '').localeCompare(a.get('createdAt') || ''));
console.log('\nABSOLUTE NEWEST 5 rows by createdAt:');
rows.slice(0, 5).forEach(r => {
  console.log('  ', r.get('ticketId'), '|', r.get('createdAt'), '| createdBy=' + r.get('createdBy'), '| type=' + r.get('ticketType'));
});
