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
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')?.trim(),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(process.env.DELIVERY_SHEETS_ID, auth);
await doc.loadInfo();
const rows = await doc.sheetsByTitle['Tickets'].getRows();

const emailTickets = rows.filter(r => r.get('createdBy') === 'email-webhook');
console.log(`Inspecting ${emailTickets.length} email-webhook tickets:\n`);

for (const r of emailTickets) {
  const matJson = r.get('materialsJson') || '[]';
  let parsed;
  try { parsed = JSON.parse(matJson); } catch { parsed = null; }
  console.log(`${r.get('ticketId')} ref=${r.get('referenceNumber')}`);
  console.log(`  totalCost=${r.get('totalCost')} totalPrice=${r.get('totalPrice')}`);
  console.log(`  customer=${r.get('customerName')} address=${r.get('jobAddress')}, ${r.get('city')}, ${r.get('state')}`);
  console.log(`  materialsJson length: ${matJson.length}, parsed: ${parsed ? parsed.length + ' items' : 'PARSE ERROR'}`);
  if (parsed && parsed.length > 0) {
    parsed.slice(0, 3).forEach(m => console.log(`    - ${m.productName || m.itemName} qty=${m.quantity} pid=${m.productId}`));
  }
  console.log('');
}
