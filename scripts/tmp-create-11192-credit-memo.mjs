// Credit memo for R-11192 (Brandon Denton): 4x 1-1/2" Black Bullet Boot
// returned per the original ticket note ("returning 4x 1-1/2 bullet boots").
// Goes through the real portal API as the driver — same path as the
// warehouse Credit Memo button. Owner approved 2026-07-02.
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

const res = await fetch(`${BASE}/api/portal/tickets`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({
    action: 'create',
    ticketType: 'return',
    jobNumber: 'R-11192',
    referenceNumber: 'R-11192',
    jobName: 'R-11192 — Brandon Denton 507 County Road 3698',
    customerName: 'Brandon Denton',
    jobAddress: '507 County Road 3698',
    materials: [{
      productId: 'INV-0006',
      productName: '1 1/2” Black Bullet Boot',
      quantity: 4,
      unitPrice: 20.89,
      totalPrice: 83.56,
    }],
    specialInstructions: 'Return per original delivery ticket TKT-R-11192 note: swapped for 3x 2" boots (invoiced INV-20260702-0001). Credit memo authorized by owner 2026-07-02.',
    createdBy: 'richard',
    createdByName: 'Richard Geahr',
  }),
});
const json = await res.json().catch(() => ({}));
console.log('create return:', res.status, JSON.stringify(json).slice(0, 300));
const cmTicketId = json?.ticket?.ticketId;

// Verify the credit memo landed in Job_Material_Costs
await pause(20000);
const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, auth);
await doc.loadInfo();
const jmc = doc.sheetsByTitle['Job_Material_Costs'];
if (jmc) {
  const rows = await jmc.getRows();
  const match = rows.filter(r => (r.get('referenceNumber') || r.get('jobNumber') || '').includes('11192') || (cmTicketId && (r.get('ticketId') || '') === cmTicketId));
  for (const r of match.slice(-3)) {
    console.log('JMC row:', ['invoiceId','ticketId','type','total','createdAt'].map(h => { try { return r.get(h); } catch { return '?'; } }).join(' | '));
  }
}
