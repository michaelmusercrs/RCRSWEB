// Minimal repro probe: login as Rick → create → pull-materials → verify-load.
// Cleans up its rows. Run while `vercel logs` is streaming.
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import fs from 'fs';

const BASE = 'https://rcrsal.com';
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

async function api(action, data) {
  const res = await fetch(`${BASE}/api/portal/tickets`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ action, data }),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const create = await api('create', {
  ticketType: 'delivery', referenceNumber: 'R-99998',
  jobName: 'R-99998 — PROBE (DELETE ME)', customerName: 'PROBE DELETE ME',
  jobAddress: '1 Probe St', city: 'Decatur', state: 'AL',
  materials: [{ productId: 'INV-0010', productName: 'Sealant', quantity: 1, unitPrice: 10, totalPrice: 10 }],
  notes: 'probe', createdBy: 'probe', createdByName: 'Probe',
});
const ticketId = create.json?.ticket?.ticketId;
console.log('create', create.status, ticketId);

await pause(20000);
const pull = await api('pull-materials', { ticketId });
console.log('pull', pull.status, JSON.stringify(pull.json).slice(0, 120));
await pause(20000);
const verify = await api('verify-load', { ticketId, verifiedBy: 'Probe' });
console.log('verify', verify.status, JSON.stringify(verify.json).slice(0, 200));

// Also: does the GET endpoint see it?
const get = await fetch(`${BASE}/api/portal/tickets?ticketId=${ticketId}`, { headers: { Cookie: cookie } });
console.log('GET ticket', get.status, JSON.stringify(await get.json().catch(() => ({}))).slice(0, 200));

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
    if (blob.includes('DELETE ME') || (ticketId && blob.includes(ticketId))) {
      await r.delete();
      console.log('cleaned', tab);
    }
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
