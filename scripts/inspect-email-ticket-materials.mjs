/**
 * Look at the actual materialsJson for the email-webhook tickets.
 * The productId + productName together will tell me which catalog
 * the PDF parser used.
 */
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
const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim(),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(sheetsId, auth);
await doc.loadInfo();

const tab = doc.sheetsByTitle['Tickets'];
const rows = await tab.getRows();
const email = rows.filter(r => r.get('createdBy') === 'email-webhook');
console.log(`${email.length} email-webhook tickets\n`);

// Aggregate (productId, productName) lines
const byKey = new Map();   // "productId|productName" -> total qty
for (const r of email) {
  let mats = [];
  try { mats = JSON.parse(r.get('materialsJson') || '[]'); } catch {}
  for (const m of mats) {
    const key = `${m.productId || '?'} | ${m.productName || '?'}`;
    byKey.set(key, (byKey.get(key) || 0) + (m.quantity || 0));
  }
}
console.log('=== Aggregate by (productId | productName) ===');
[...byKey.entries()].sort().forEach(([k, q]) => console.log(`  ${q.toString().padStart(6)}  ${k}`));

// Sample one full ticket
console.log('\n=== Full materials of first ticket ===');
const sample = email[0];
console.log(`Ticket: ${sample.get('ticketId')}, job ${sample.get('referenceNumber')}`);
let mats = [];
try { mats = JSON.parse(sample.get('materialsJson') || '[]'); } catch {}
mats.forEach(m => console.log(`  ${(m.quantity||0).toString().padStart(4)} x ${m.productName} [${m.productId}]  @ $${m.unitPrice}`));
