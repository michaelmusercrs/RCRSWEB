// Cleanup-only: remove E2E test rows (DEL-20260702-SPTL / DELETE ME) from all
// tabs, restore sealant stock if the deduction actually decremented, delete
// the deduction-log row. Paced to respect Sheets read quota.
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import fs from 'fs';

const TICKET_ID = 'DEL-20260702-SPTL';
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const pause = ms => new Promise(r => setTimeout(r, ms));

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, auth);
await doc.loadInfo();

for (const tab of ['Tickets', 'Delivery Tickets', 'Delivery Schedule', 'Invoices', 'Job_Breakdowns']) {
  const s = doc.sheetsByTitle[tab];
  if (!s) continue;
  const rows = await s.getRows();
  for (const r of rows) {
    const blob = ['ticketId', 'jobName', 'customerName'].map(c => { try { return r.get(c) || ''; } catch { return ''; } }).join(' ');
    if (blob.includes('DELETE ME') || blob.includes(TICKET_ID)) {
      await r.delete();
      console.log('deleted from', tab);
      await pause(1500);
    }
  }
  await pause(3000);
}

const dedS = doc.sheetsByTitle['Inventory_Deductions_Log'];
if (dedS) {
  const rows = await dedS.getRows();
  for (const r of rows) {
    if (r.get('ticketId') === TICKET_ID) {
      const before = parseFloat(r.get('qtyBefore')) || 0;
      const after = parseFloat(r.get('qtyAfter')) || 0;
      console.log(`deduction row: ${r.get('productName')} ${before} -> ${after}`);
      if (before !== after) {
        const ip = await doc.sheetsByTitle['Inventory_Products'].getRows();
        const p = ip.find(x => x.get('productId') === r.get('productId'));
        if (p) {
          p.set('currentQty', String(before));
          p.set('totalValue', (before * (parseFloat(p.get('unitCost')) || 0)).toFixed(2));
          await p.save();
          console.log('stock restored to', before);
        }
      }
      await r.delete();
      console.log('deduction log row deleted');
      await pause(1500);
    }
  }
}
console.log('cleanup complete');
