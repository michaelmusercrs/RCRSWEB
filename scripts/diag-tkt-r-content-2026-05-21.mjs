import fs from 'fs';
import path from 'path';
const envPath = path.join(process.cwd(), '.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) { let v = m[2]; if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); process.env[m[1]] = v; }
});
const { JWT } = await import('google-auth-library');
const { GoogleSpreadsheet } = await import('google-spreadsheet');
const auth = new JWT({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(), key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim(), scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, auth);
await doc.loadInfo();
const t = doc.sheetsByTitle['Tickets'];
const rows = await t.getRows();
const ids = ['TKT-R-10997','TKT-R-10923','TKT-R-10993','TKT-R-11223'];
for (const r of rows) {
  const id = (r.get('ticketId') || '').toString();
  if (!ids.includes(id)) continue;
  console.log('===', id);
  console.log('  status:', r.get('status'));
  console.log('  type:', r.get('ticketType'));
  console.log('  createdAt:', r.get('createdAt'));
  console.log('  materialsJson:', (r.get('materialsJson')||'').slice(0,300));
  console.log('  totalCost:', r.get('totalCost'), 'totalPrice:', r.get('totalPrice'));
  console.log('  jobName:', r.get('jobName'), 'customerName:', r.get('customerName'));
  console.log('  notes:', (r.get('notes')||'').slice(0,200));
}
