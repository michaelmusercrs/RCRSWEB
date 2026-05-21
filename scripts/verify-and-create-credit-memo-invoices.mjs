/**
 * Verify and create credit-memo invoices — 2026-05-21
 *
 * The 2026-05-20 bulk-backfill created delivery invoices but never created
 * the credit-memo invoices for the 50 historical return (CM-*) tickets that
 * were imported from inventory-source.xlsx. This script:
 *
 *   Phase 1 (read-only): verifies tickets vs invoices, lists the gap.
 *   Phase 2 (write):     creates one CM-YYYYMMDD-NNNN invoice row per
 *                        return ticket missing a credit-memo invoice,
 *                        appends a marker to the ticket's notes.
 *   Phase 3 (report):    prints summary + per-SKU unit rollup, writes
 *                        scripts/credit-memo-units-by-sku-2026-05-21.json.
 *
 * Idempotent. Silent (no email). Does not touch inventory currentQty.
 * Does not touch Job_Material_Costs (CM tickets have empty jobId).
 *
 * Owner-approved write per directive #1 (2026-05-21): "go back and check
 * invoices based on material orders, verify all including credit memos."
 */
import { config } from 'dotenv';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

config({ path: '.env.local', quiet: true });

const TODAY = '2026-05-21';
const ID_DATE = TODAY.replace(/-/g, '');
const RUN_TS_ISO = new Date().toISOString();
const EXPECTED_CM_COUNT = 50;
const STOP_IF_OVER = 75; // safety stop — if reality jumps >50%, halt and report

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, auth);
await doc.loadInfo();

const invoicesSheet = doc.sheetsByTitle['Invoices'];
const ticketsSheet  = doc.sheetsByTitle['Tickets'];

if (!invoicesSheet) throw new Error('Invoices tab not found');
if (!ticketsSheet)  throw new Error('Tickets tab not found');

await invoicesSheet.loadHeaderRow();
await ticketsSheet.loadHeaderRow();

const invHeaders = invoicesSheet.headerValues;
const tktHeaders = ticketsSheet.headerValues;

console.log('========================================');
console.log('RCRS verify-and-create-credit-memo-invoices — 2026-05-21');
console.log('========================================');
console.log(`Invoices headers (${invHeaders.length}): ${invHeaders.join(', ')}`);
console.log(`Tickets headers  (${tktHeaders.length}): ${tktHeaders.join(', ')}`);
console.log('');

// ---------- Helpers ----------
const safeGet = (row, col) => {
  try { return row.get(col) || ''; } catch { return ''; }
};
const extractRNumber = (raw) => {
  if (!raw) return '';
  const m = String(raw).match(/R-?(\d{4,6})/i);
  return m ? `R-${m[1]}` : '';
};

async function retry(fn, label, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (err) {
      lastErr = err;
      const msg = (err.message || '').slice(0, 90);
      console.error(`  retry ${i + 1}/${attempts} ${label}: ${msg}`);
      const delay = 1000 * Math.pow(3, i);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ---------- Load existing rows ----------
console.log('Loading Tickets + Invoices...');
const ticketRows  = await ticketsSheet.getRows();
const invoiceRows = await invoicesSheet.getRows();
console.log(`  Tickets:  ${ticketRows.length}`);
console.log(`  Invoices: ${invoiceRows.length}`);

// ---------- Phase 1: Verify ----------
console.log('');
console.log('========================================');
console.log('PHASE 1 — VERIFY');
console.log('========================================');

const ticketIdsWithInvoice = new Set();
const rNumbersWithInvoice  = new Set();
const cmInvoiceIdSet       = new Set(); // existing CM-* invoiceIds in Invoices tab
const invIdsAll            = new Set();

for (const r of invoiceRows) {
  const invoiceId = safeGet(r, 'invoiceId');
  const ticketId  = safeGet(r, 'ticketId');
  const linked    = safeGet(r, 'linkedTicketId');
  const rNum      = safeGet(r, 'rNumber');
  const jobName   = safeGet(r, 'jobName');
  if (invoiceId) invIdsAll.add(invoiceId);
  if (invoiceId && /^CM-/i.test(invoiceId)) cmInvoiceIdSet.add(invoiceId);
  if (ticketId) ticketIdsWithInvoice.add(ticketId);
  if (linked)   ticketIdsWithInvoice.add(linked);
  if (rNum)     rNumbersWithInvoice.add(rNum);
  const jobR = extractRNumber(jobName);
  if (jobR)    rNumbersWithInvoice.add(jobR);
}

const byType = {};
for (const r of ticketRows) {
  const t = safeGet(r, 'ticketType') || '(blank)';
  byType[t] = (byType[t] || 0) + 1;
}

const isReturnTicket = (r) => {
  const id = safeGet(r, 'ticketId');
  const t  = safeGet(r, 'ticketType');
  return id.startsWith('CM-') || t === 'return' || t === 'credit_memo';
};
const isRestockTicket = (r) => safeGet(r, 'ticketType') === 'restock';
const isDeliveryTicket = (r) => safeGet(r, 'ticketType') === 'delivery';

const verify = {
  totalByType: byType,
  deliveryCount: 0,
  deliveryWithInvoice: 0,
  deliveryMissing: [],
  returnCount: 0,
  returnWithInvoice: 0,
  returnMissing: [],
  restockCount: 0,
};

for (const r of ticketRows) {
  const ticketId = safeGet(r, 'ticketId');
  const customer = safeGet(r, 'customerName');
  const createdAt = safeGet(r, 'createdAt');
  const jobName = safeGet(r, 'jobName');
  const rNum = extractRNumber(jobName) || extractRNumber(ticketId) || extractRNumber(customer);
  const hasInv = ticketIdsWithInvoice.has(ticketId) || (rNum && rNumbersWithInvoice.has(rNum));

  if (isRestockTicket(r)) {
    verify.restockCount++;
    continue;
  }
  if (isDeliveryTicket(r)) {
    verify.deliveryCount++;
    if (hasInv) verify.deliveryWithInvoice++;
    else verify.deliveryMissing.push({
      ticketId, rNumber: rNum, customer, createdAt: createdAt?.slice(0, 10),
    });
    continue;
  }
  if (isReturnTicket(r)) {
    verify.returnCount++;
    if (hasInv) verify.returnWithInvoice++;
    else verify.returnMissing.push({
      ticketId, rNumber: rNum, customer, createdAt: createdAt?.slice(0, 10),
    });
  }
}

console.log('Tickets by type:');
for (const [t, n] of Object.entries(byType).sort()) console.log(`  ${t.padEnd(15)}: ${n}`);
console.log('');
console.log('Verification table:');
console.log('  type      | total | w/invoice | missing');
console.log('  ----------|-------|-----------|--------');
console.log(`  delivery  | ${String(verify.deliveryCount).padStart(5)} | ${String(verify.deliveryWithInvoice).padStart(9)} | ${String(verify.deliveryMissing.length).padStart(7)}`);
console.log(`  return    | ${String(verify.returnCount).padStart(5)} | ${String(verify.returnWithInvoice).padStart(9)} | ${String(verify.returnMissing.length).padStart(7)}`);
console.log(`  restock   | ${String(verify.restockCount).padStart(5)} | (n/a — warehouse-level, no customer invoice)`);
console.log('');

if (verify.deliveryMissing.length) {
  console.log(`Delivery tickets missing invoice (${verify.deliveryMissing.length}):`);
  for (const t of verify.deliveryMissing.slice(0, 20)) {
    console.log(`  ${t.ticketId.padEnd(16)} ${(t.rNumber || '-').padEnd(10)} ${t.createdAt?.padEnd(12)} ${(t.customer || '').slice(0, 40)}`);
  }
  if (verify.deliveryMissing.length > 20) console.log(`  ... and ${verify.deliveryMissing.length - 20} more`);
  console.log('');
}

console.log(`Return tickets missing credit-memo invoice (${verify.returnMissing.length}):`);
for (const t of verify.returnMissing) {
  console.log(`  ${t.ticketId.padEnd(16)} ${(t.rNumber || '-').padEnd(10)} ${t.createdAt?.padEnd(12)} ${(t.customer || '(empty)').slice(0, 40)}`);
}
console.log('');

if (verify.returnMissing.length > STOP_IF_OVER) {
  console.error(`STOP: ${verify.returnMissing.length} missing CM invoices exceeds safety threshold ${STOP_IF_OVER}. Audit assumption was ${EXPECTED_CM_COUNT}.`);
  process.exit(1);
}
if (verify.returnMissing.length === 0) {
  console.log('Nothing to do — every return ticket already has an invoice.');
  process.exit(0);
}
if (verify.returnMissing.length !== EXPECTED_CM_COUNT) {
  console.log(`NOTE: expected ${EXPECTED_CM_COUNT} missing CM invoices, found ${verify.returnMissing.length}. Continuing (within safety bound).`);
}

// ---------- Phase 2: Create missing CM invoices ----------
console.log('========================================');
console.log('PHASE 2 — CREATE MISSING CM INVOICES');
console.log('========================================');

// Allocate CM-YYYYMMDD-NNNN starting at next unused slot
let counter = 1;
const allocateCmId = () => {
  while (cmInvoiceIdSet.has(`CM-${ID_DATE}-${String(counter).padStart(4, '0')}`)) counter++;
  const id = `CM-${ID_DATE}-${String(counter).padStart(4, '0')}`;
  cmInvoiceIdSet.add(id);
  counter++;
  return id;
};

const ticketRowById = new Map(ticketRows.map(r => [safeGet(r, 'ticketId'), r]));

const results = {
  created: 0,
  skipped: 0,
  errors: 0,
  needsOwnerAttention: [],
  createdIds: [],
};
let sumTotalPrice = 0;
let sumTotalCost  = 0;
const perSkuUnits = new Map(); // key: productId|productName -> { productId, productName, unitsCredited, lines, dollarsCredited }
const createdSamples = []; // keep for end-of-run spot check

for (const missing of verify.returnMissing) {
  const ticketRow = ticketRowById.get(missing.ticketId);
  if (!ticketRow) {
    console.error(`  [SKIP] ticket ${missing.ticketId} disappeared from Tickets — race condition?`);
    results.skipped++;
    continue;
  }

  const ticketId = safeGet(ticketRow, 'ticketId');
  const totalPriceStr = safeGet(ticketRow, 'totalPrice');
  const totalCostStr  = safeGet(ticketRow, 'totalCost');
  const totalPrice = parseFloat(totalPriceStr);
  const totalCost  = parseFloat(totalCostStr);
  const createdAt  = safeGet(ticketRow, 'createdAt');
  const customer   = safeGet(ticketRow, 'customerName');
  const jobId      = safeGet(ticketRow, 'jobId');
  const jobName    = safeGet(ticketRow, 'jobName');
  const matsStr    = safeGet(ticketRow, 'materialsJson');
  const existingNotes = safeGet(ticketRow, 'notes');

  if (!Number.isFinite(totalPrice) && !Number.isFinite(totalCost)) {
    console.error(`  [NEEDS OWNER] ${ticketId} has neither totalPrice nor totalCost`);
    results.needsOwnerAttention.push({
      ticketId, reason: 'no totalPrice and no totalCost',
      totalPrice: totalPriceStr, totalCost: totalCostStr,
    });
    continue;
  }

  let items = [];
  try { items = JSON.parse(matsStr || '[]'); } catch (e) {
    console.error(`  [WARN] ${ticketId} materialsJson parse failed: ${e.message?.slice(0, 60)}`);
  }

  // Roll up per-SKU units credited (we count the return as units returned/credited)
  for (const it of items) {
    const pid = it.productId || '';
    const pname = it.productName || it.name || '';
    const key = pid || pname.toLowerCase().trim();
    if (!key) continue;
    const qty = parseFloat(it.quantity) || 0;
    const lineDollars = parseFloat(it.totalPrice) || 0;
    const cur = perSkuUnits.get(key) || { productId: pid, productName: pname, unitsCredited: 0, lines: 0, dollarsCredited: 0 };
    cur.unitsCredited += qty;
    cur.lines++;
    cur.dollarsCredited += lineDollars;
    if (!cur.productId && pid) cur.productId = pid;
    if (!cur.productName && pname) cur.productName = pname;
    perSkuUnits.set(key, cur);
  }

  const cmInvoiceId = allocateCmId();
  const priceForInvoice = Number.isFinite(totalPrice) ? totalPrice : 0;

  // Build invoice row matching the 20-column delivery-workflow-service schema
  // currently in use in the Invoices tab. We also fold credit-memo specifics
  // into existing columns (notes carries line items, status carries type).
  const lineItemsJson = JSON.stringify(items);
  const noteParts = [
    'Credit memo invoice backfilled 2026-05-21 from historical CM ticket',
    `type=credit_memo`,
    `totalCost=${Number.isFinite(totalCost) ? totalCost.toFixed(2) : 'n/a'}`,
    `lineItems=${lineItemsJson}`,
  ];

  const invoiceRow = {
    invoiceId:        cmInvoiceId,
    ticketId:         ticketId,
    jobId:            jobId || '',
    jobName:          jobName || '',
    customerName:     customer || '',
    customerEmail:    safeGet(ticketRow, 'customerEmail'),
    createdAt:        createdAt || RUN_TS_ISO,
    dueDate:          '',
    paidAt:           '',
    subtotal:         priceForInvoice.toFixed(2),
    taxRate:          '0',
    taxAmount:        '0.00',
    deliveryFee:      '0.00',
    rushFee:          '0.00',
    total:            priceForInvoice.toFixed(2),
    status:           'posted-no-email',
    paymentMethod:    '',
    paymentReference: '',
    notes:            noteParts.join(' | '),
    internalNotes:    `createdBy=historical-backfill-2026-05-21; type=credit_memo; runAt=${RUN_TS_ISO}`,
  };

  try {
    await retry(() => invoicesSheet.addRow(invoiceRow), `invoice ${cmInvoiceId}`);
    results.created++;
    results.createdIds.push(cmInvoiceId);
    sumTotalPrice += priceForInvoice;
    sumTotalCost  += Number.isFinite(totalCost) ? totalCost : 0;
    if (createdSamples.length < 3) createdSamples.push({ ticketId, cmInvoiceId });
    if (results.created <= 5 || results.created % 10 === 0) {
      console.log(`  [${results.created}/${verify.returnMissing.length}] ${ticketId} → ${cmInvoiceId}  $${priceForInvoice.toFixed(2)} (${items.length} lines)`);
    }
  } catch (err) {
    console.error(`  [ERR] failed to write ${cmInvoiceId} for ${ticketId}: ${err.message}`);
    results.errors++;
    continue;
  }
  await new Promise(r => setTimeout(r, 400));

  // Tag the source ticket: Tickets has no invoiceId column, so we append
  // to notes. Don't duplicate if a previous run already tagged it.
  const tagMarker = `CM invoice ${cmInvoiceId} created 2026-05-21`;
  if (!existingNotes.includes('CM invoice ')) {
    const newNotes = existingNotes
      ? `${existingNotes}; ${tagMarker}`
      : tagMarker;
    try {
      ticketRow.set('notes', newNotes);
      await retry(() => ticketRow.save(), `ticket-tag ${ticketId}`);
    } catch (err) {
      console.error(`  [WARN] failed to tag ticket ${ticketId}: ${err.message?.slice(0, 80)}`);
    }
    await new Promise(r => setTimeout(r, 400));
  }
}

// ---------- Phase 3: Summary ----------
console.log('');
console.log('========================================');
console.log('PHASE 3 — SUMMARY');
console.log('========================================');
console.log(`CM invoices created: ${results.created}`);
console.log(`Skipped:             ${results.skipped}`);
console.log(`Errors:              ${results.errors}`);
console.log(`Needs owner attention: ${results.needsOwnerAttention.length}`);
console.log(`Sum totalPrice (customer-side credit):  $${sumTotalPrice.toFixed(2)}`);
console.log(`Sum totalCost  (internal cost tracking): $${sumTotalCost.toFixed(2)}`);
console.log('');

console.log('Per-SKU unit rollup (units credited across all backfilled CM invoices):');
console.log('  productId          | productName                       | units | lines | $ value');
console.log('  -------------------|-----------------------------------|-------|-------|---------');
const skuEntries = [...perSkuUnits.values()].sort((a, b) => b.unitsCredited - a.unitsCredited);
for (const e of skuEntries) {
  console.log(
    `  ${(e.productId || '-').padEnd(18)} | ${(e.productName || '-').slice(0, 33).padEnd(33)} | ${String(e.unitsCredited).padStart(5)} | ${String(e.lines).padStart(5)} | $${e.dollarsCredited.toFixed(2)}`
  );
}
console.log('');

if (results.needsOwnerAttention.length) {
  console.log('Needs owner attention:');
  for (const n of results.needsOwnerAttention) {
    console.log(`  ${n.ticketId}: ${n.reason} (totalPrice=${n.totalPrice}, totalCost=${n.totalCost})`);
  }
  console.log('');
}

// Write JSON for downstream restock-math phase
const outPath = path.join(process.cwd(), 'scripts', 'credit-memo-units-by-sku-2026-05-21.json');
const out = {
  generatedAt: RUN_TS_ISO,
  today: TODAY,
  source: 'verify-and-create-credit-memo-invoices.mjs',
  ticketsReturned: verify.returnCount,
  ticketsBackfilledThisRun: results.created,
  ticketsSkippedThisRun: results.skipped,
  ticketsAlreadyHadInvoice: verify.returnWithInvoice,
  sumTotalPrice: Number(sumTotalPrice.toFixed(2)),
  sumTotalCost: Number(sumTotalCost.toFixed(2)),
  createdInvoiceIds: results.createdIds,
  needsOwnerAttention: results.needsOwnerAttention,
  perSku: skuEntries.map(e => ({
    productId: e.productId,
    productName: e.productName,
    unitsCredited: e.unitsCredited,
    lines: e.lines,
    dollarsCredited: Number(e.dollarsCredited.toFixed(2)),
  })),
};
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote: ${outPath}`);
console.log('');

// ---------- Spot check: re-read Invoices tab and confirm a created row ----------
if (createdSamples.length) {
  console.log('Spot-check — re-reading Invoices to confirm a created row landed:');
  const freshSheet = doc.sheetsByTitle['Invoices'];
  const freshRows = await freshSheet.getRows();
  const sample = createdSamples[0];
  const found = freshRows.find(r => safeGet(r, 'invoiceId') === sample.cmInvoiceId);
  if (found) {
    const o = {};
    for (const h of freshSheet.headerValues) o[h] = safeGet(found, h);
    console.log(`  Found ${sample.cmInvoiceId} (sourced from ticket ${sample.ticketId}):`);
    console.log(JSON.stringify(o, null, 2));
  } else {
    console.log(`  WARNING — could not re-read ${sample.cmInvoiceId} after write. Investigate.`);
  }
}

console.log('');
console.log('Done.');
