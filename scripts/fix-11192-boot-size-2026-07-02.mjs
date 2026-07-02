// Fix TKT-R-11192: parser boot-size bug priced "3x 2-inch bullet boots" as
// 1-1/2". Note on ticket: "Adding 3x 2" bullets boots, returning 4x 1-1/2"
// bullet boots". This corrects the material line to the real 2" SKU/price.
// Run with --apply to write; default is a dry run that prints the plan.
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import fs from 'fs';

const APPLY = process.argv.includes('--apply');

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

// 1. Show all boot SKUs in the canonical catalog
const invProd = await doc.sheetsByTitle['Inventory_Products'].getRows();
console.log('=== Boot SKUs in Inventory_Products ===');
const boots = invProd.filter(r => /boot/i.test(r.get('productName') || ''));
for (const r of boots) {
  console.log([r.get('productId'), r.get('productName'), 'qty=' + r.get('currentQty'), 'unitCost=' + r.get('unitCost'), 'unitPrice=' + r.get('unitPrice')].join(' | '));
}

// 2. The ticket
const tickets = await doc.sheetsByTitle['Tickets'].getRows();
const t = tickets.find(r => r.get('ticketId') === 'TKT-R-11192');
if (!t) { console.log('ticket not found'); process.exit(1); }
console.log('\n=== Current materialsJson ===');
console.log(t.get('materialsJson'));

const twoInch = boots.find(r => /2\s*("|”|in)/i.test(r.get('productName')) && !/1\s*1\/2|1-1\/2|1½/i.test(r.get('productName')));
if (!twoInch) { console.log('\nNo 2" boot SKU found — stopping.'); process.exit(1); }

const unitPrice = parseFloat(twoInch.get('unitPrice')) || 0;
const unitCost = parseFloat(twoInch.get('unitCost')) || 0;
const newMats = [{
  productId: twoInch.get('productId'),
  productName: twoInch.get('productName'),
  quantity: 3,
  unitCost,
  unitPrice,
  totalPrice: Math.round(unitPrice * 3 * 100) / 100,
}];
const newTotal = newMats[0].totalPrice;

console.log('\n=== Planned fix ===');
console.log(JSON.stringify(newMats, null, 1));
console.log('newTotalPrice:', newTotal);

if (APPLY) {
  t.set('materialsJson', JSON.stringify(newMats));
  t.set('totalPrice', String(newTotal));
  t.set('totalCost', String(Math.round(unitCost * 3 * 100) / 100));
  const prevNotes = t.get('notes') || '';
  t.set('notes', prevNotes + '\n[SIZE-CORRECTED 2026-07-02] Parser mis-sized boots as 1-1/2"; corrected to 3x 2" per ticket note. Return of 4x 1-1/2" boots still needs office credit memo.');
  await t.save();
  console.log('\nAPPLIED.');
} else {
  console.log('\nDry run only. Re-run with --apply to write.');
}
