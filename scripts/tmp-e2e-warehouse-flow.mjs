/**
 * E2E test of Rick's warehouse flow against a local dev server (real sheets).
 * Creates a clearly-marked TEST ticket, walks it through every button Rick
 * would tap, verifies each step lands on the master Tickets tab + the
 * aftermath artifacts (Invoices/Job_Breakdowns/Inventory_Deductions_Log),
 * then cleans everything up.
 *
 * Prereq: dev server running with DEV_AUTH_BYPASS=1 (npm run dev).
 */
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import fs from 'fs';

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const TEST_JOB = 'R-99999';

for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
}

// Human pacing: Rick taps buttons minutes apart. Back-to-back calls blow the
// Sheets 60-reads/min quota (each step triggers several full-tab reads on
// both the route side and our verification side).
const PACE_MS = 25_000;
const pause = (ms = PACE_MS) => new Promise(r => setTimeout(r, ms));

// Real login (production): authenticate as the actual driver account so the
// test exercises the same auth path Rick's phone uses.
let sessionCookie = '';
if (process.env.E2E_LOGIN_EMAIL) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.E2E_LOGIN_EMAIL,
      password: process.env.E2E_LOGIN_PASSWORD,
    }),
  });
  const setCookie = res.headers.getSetCookie?.() || [res.headers.get('set-cookie')].filter(Boolean);
  sessionCookie = setCookie.map(c => c.split(';')[0]).join('; ');
  console.log(`login as ${process.env.E2E_LOGIN_EMAIL}: ${res.status} cookie=${sessionCookie ? 'yes' : 'NO'}`);
  if (!sessionCookie) process.exit(1);
}

async function api(action, body) {
  const res = await fetch(`${BASE}/api/portal/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(sessionCookie ? { Cookie: sessionCookie } : {}) },
    body: JSON.stringify({ action, data: body }),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function openDoc() {
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, auth);
  await doc.loadInfo();
  return doc;
}

async function ticketsRow(doc, ticketId) {
  const rows = await doc.sheetsByTitle['Tickets'].getRows();
  return rows.find(r => r.get('ticketId') === ticketId);
}

// ── 1. Create test ticket ────────────────────────────────────────────────
const createRes = await api('create', {
  ticketType: 'delivery',
  referenceNumber: TEST_JOB,
  jobName: `${TEST_JOB} — TEST TICKET (DELETE ME)`,
  customerName: 'E2E Test — DELETE ME',
  jobAddress: '123 Test Ln',
  city: 'Decatur',
  state: 'AL',
  materials: [{ productId: 'INV-0010', productName: 'Sealant', quantity: 1, unitPrice: 10, totalPrice: 10 }],
  notes: 'Automated E2E test 2026-07-02 — safe to delete',
  createdBy: 'e2e-test',
  createdByName: 'E2E Test',
});
const ticketId = createRes.json?.ticket?.ticketId || createRes.json?.sheetTicket?.ticketId || `TKT-${TEST_JOB}`;
check('create ticket', createRes.status === 200 && createRes.json.success === true, `id=${ticketId} status=${createRes.status}`);

let doc = await openDoc();
let row = await ticketsRow(doc, ticketId);
check('ticket exists on Tickets tab', Boolean(row), `status=${row?.get('status')}`);

// ── 2. Pull materials (the previously-dead button) ──────────────────────
await pause();
const pull = await api('pull-materials', { ticketId });
check('pull-materials 200', pull.status === 200 && pull.json.success === true, JSON.stringify(pull.json).slice(0, 150));
await pause();
row = await ticketsRow(await openDoc(), ticketId);
check('Tickets tab shows materials_pulled', row?.get('status') === 'materials_pulled', `got=${row?.get('status')}`);

// ── 3. Verify load (fires aftermath: invoice + breakdown + deduction) ───
await pause();
const verify = await api('verify-load', { ticketId, verifiedBy: 'E2E Test' });
check('verify-load 200', verify.status === 200 && verify.json.success === true, JSON.stringify(verify.json).slice(0, 300));
const aftermath = verify.json.aftermath;
check('aftermath ran', Boolean(aftermath), JSON.stringify(aftermath || {}).slice(0, 200));
check('aftermath created invoice', aftermath?.invoiceCreated === true, `invoiceId=${aftermath?.invoiceId}`);
check('aftermath errors empty (except email-disabled)',
  (aftermath?.errors || []).filter(e => !/email/i.test(e)).length === 0,
  JSON.stringify(aftermath?.errors || []));

await pause();
doc = await openDoc();
row = await ticketsRow(doc, ticketId);
check('Tickets tab shows load_verified', row?.get('status') === 'load_verified', `got=${row?.get('status')}`);

const invRows = await doc.sheetsByTitle['Invoices'].getRows();
const inv = invRows.find(r => r.get('ticketId') === ticketId);
check('Invoices row exists (posted)', inv?.get('status') === 'posted', `id=${inv?.get('invoiceId')} total=${inv?.get('total')}`);

const dedRows = await doc.sheetsByTitle['Inventory_Deductions_Log'].getRows();
const ded = dedRows.filter(r => r.get('ticketId') === ticketId);
check('Deduction logged from Inventory_Products', ded.length === 1 && ded[0]?.get('source') === 'load-verified-aftermath', `rows=${ded.length}`);

// idempotency: second verify-load must not double anything
await pause();
const verify2 = await api('verify-load', { ticketId, verifiedBy: 'E2E Test' });
check('second verify-load skips aftermath', verify2.json.aftermath === null || verify2.json.aftermath === undefined, JSON.stringify(verify2.json.aftermath || null).slice(0, 120));

// ── 4. Delivery steps ────────────────────────────────────────────────────
for (const [action, expected] of [
  ['start-delivery', 'en_route'],
  ['mark-arrived', 'arrived'],
  ['complete-delivery', 'delivered'],
]) {
  await pause();
  const r = await api(action, { ticketId });
  await pause();
  row = await ticketsRow(await openDoc(), ticketId);
  check(`${action} → Tickets tab ${expected}`, r.status === 200 && row?.get('status') === expected, `got=${row?.get('status')}`);
}

// ── 5. Cleanup (this run's rows + any strays from earlier runs) ─────────
console.log('\n=== Cleanup ===');
await pause();
doc = await openDoc();
const allTicketRows = await doc.sheetsByTitle['Tickets'].getRows();
for (const r of allTicketRows.filter(r => r.get('ticketId') === ticketId || (r.get('customerName') || '').includes('DELETE ME'))) {
  await r.delete();
  console.log(`Tickets row deleted (${r.get('ticketId')})`);
}
row = null;

for (const [tab, col] of [['Invoices', 'ticketId'], ['Job_Breakdowns', 'jobName'], ['Delivery Tickets', 'ticketId']]) {
  const sheet = doc.sheetsByTitle[tab];
  if (!sheet) continue;
  const rows = await sheet.getRows();
  const matchVal = col === 'jobName' ? `${TEST_JOB} — TEST TICKET (DELETE ME)` : ticketId;
  for (const r of rows.filter(r => r.get(col) === matchVal)) {
    await r.delete();
    console.log(`${tab} row deleted`);
  }
}
// restore stock (deduction floored at whatever it was; add back 1 sealant if it actually decremented)
if (ded.length === 1) {
  const before = parseFloat(ded[0].get('qtyBefore')) || 0;
  const after = parseFloat(ded[0].get('qtyAfter')) || 0;
  if (before !== after) {
    const invProd = await doc.sheetsByTitle['Inventory_Products'].getRows();
    const p = invProd.find(r => r.get('productId') === 'INV-0010');
    if (p) {
      p.set('currentQty', String(before));
      await p.save();
      console.log('Inventory_Products sealant qty restored to', before);
    }
  }
  await ded[0].delete();
  console.log('Deduction log row deleted');
}
// legacy Inventory tab mirror rows + delivery schedule
const legacyLines = doc.sheetsByTitle['Delivery Schedule'];
if (legacyLines) {
  const rows = await legacyLines.getRows();
  for (const r of rows.filter(r => (r.get('jobName') || '').includes('DELETE ME') || r.get('ticketId') === ticketId)) {
    await r.delete();
    console.log('Delivery Schedule row deleted');
  }
}

const failed = results.filter(r => !r.ok);
console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
process.exit(failed.length ? 1 : 0);
