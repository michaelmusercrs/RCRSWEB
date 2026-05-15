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

// Show the headers for context
console.log('Tickets sheet headers:', tab.headerValues.join(' | '));

// Pick one ticket and dump everything
const sample = rows.filter(r => r.get('ticketType') === 'delivery').slice(0, 3);
sample.forEach((r, i) => {
  console.log(`\n=== Sample ${i+1} (${r.get('ticketId')}) ===`);
  Object.entries(r.toObject()).forEach(([k, v]) => {
    const sv = String(v || '').substring(0, 200);
    console.log(`  ${k}: ${sv}`);
  });
});

// How many have a materials column populated?
let withMaterials = 0;
let withoutMaterials = 0;
const matCol = ['materials', 'materialsJson'].find(c => tab.headerValues.includes(c));
console.log('\nMaterials column name:', matCol);
if (matCol) {
  for (const r of rows.filter(r => r.get('ticketType') === 'delivery')) {
    const m = r.get(matCol);
    if (m && m.length > 5) withMaterials++; else withoutMaterials++;
  }
  console.log(`Delivery tickets WITH materials data: ${withMaterials}`);
  console.log(`Delivery tickets WITHOUT materials data: ${withoutMaterials}`);
}
