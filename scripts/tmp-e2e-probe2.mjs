// Differential probe: create one ticket, then repeatedly test the three read
// paths (GET by id / verify-load / warehouse-today) to distinguish flaky
// warm-instance staleness from a deterministic path bug. Cleans up at end.
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import fs from 'fs';

const BASE = 'https://rcrsal.com';
const KEY = '11a6a1ff1cd557dbaa528f9dd33b788ee4fa125bf4de8966';
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const pause = ms => new Promise(r => setTimeout(r, ms));

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'richard@rcrsal.com', password: 'ChangeMe123!' }),
});
const cookie = (login.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
console.log('login', login.status);

async function post(action, data) {
  const res = await fetch(`${BASE}/api/portal/tickets`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ action, data }),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const create = await post('create', {
  ticketType: 'delivery', referenceNumber: 'R-99997',
  jobName: 'R-99997 — PROBE2 (DELETE ME)', customerName: 'PROBE2 DELETE ME',
  jobAddress: '1 Probe St', city: 'Decatur', state: 'AL',
  materials: [{ productId: 'INV-0010', productName: 'Sealant', quantity: 1, unitPrice: 10, totalPrice: 10 }],
  notes: 'probe2', createdBy: 'probe', createdByName: 'Probe',
});
const ticketId = create.json?.ticket?.ticketId;
console.log('create', create.status, ticketId);

for (let i = 1; i <= 6; i++) {
  await pause(10_000);
  const g = await fetch(`${BASE}/api/portal/tickets?ticketId=${ticketId}`, { headers: { Cookie: cookie } });
  const today = await fetch(`${BASE}/api/warehouse/today?key=${KEY}`, { cache: 'no-store' });
  const tj = await today.json().catch(() => ({}));
  const inToday = (tj.tickets || []).some(t => t.ticketId === ticketId);
  const v = await post('verify-load', { ticketId, verifiedBy: 'Probe2' });
  console.log(`attempt ${i}: GET=${g.status} today-sees-it=${inToday} verify=${v.status}${v.status === 200 ? ' <<< SUCCESS' : ''}`);
  if (v.status === 200) break;
}

// Cleanup
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
    const blob = ['ticketId', 'jobName', 'customerName'].map(c => r.get(c) || '').join(' ');
    if (blob.includes('DELETE ME') || (ticketId && blob.includes(ticketId))) { await r.delete(); console.log('cleaned', tab); }
  }
}
const dedS = doc.sheetsByTitle['Inventory_Deductions_Log'];
if (dedS && ticketId) {
  const rows = await dedS.getRows();
  for (const r of rows) if (r.get('ticketId') === ticketId) {
    const before = parseFloat(r.get('qtyBefore')) || 0, after = parseFloat(r.get('qtyAfter')) || 0;
    if (before !== after) {
      const ip = await doc.sheetsByTitle['Inventory_Products'].getRows();
      const p = ip.find(x => x.get('productId') === 'INV-0010');
      if (p) { p.set('currentQty', String(before)); await p.save(); console.log('stock restored'); }
    }
    await r.delete(); console.log('cleaned deduction');
  }
}
