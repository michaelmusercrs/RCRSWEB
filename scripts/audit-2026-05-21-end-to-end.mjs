/**
 * End-to-end integrity audit — 2026-05-21
 *
 * READ-ONLY. Does not write to any sheet. Does not commit anything.
 *
 * Loads Tickets, Invoices, Delivery Schedule, Inventory_Products, and the
 * 2026-05-15 post-restock snapshot. Cross-references everything to find:
 *   A. This-week delivery integrity (last 7 days)
 *   B. All-time ticket integrity
 *   C. Inventory math reconciliation since the historical close cutoff
 *   D. The earliest non-restock ticket (the backfill anchor)
 *
 * Outputs human-readable lines + writes scripts/audit-2026-05-21-results.json.
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
const { INVENTORY_DEDUCTIONS_LOG_TAB, makeDeductionKey } = await import('../lib/inventory-deduction-log.node.mjs');

// READ-ONLY variant of loadDeductionKeySet: never auto-creates the tab.
async function loadDeductionKeySetReadOnly(docInst) {
  const sheet = docInst.sheetsByTitle[INVENTORY_DEDUCTIONS_LOG_TAB];
  if (!sheet) {
    console.log(`  [WARN] "${INVENTORY_DEDUCTIONS_LOG_TAB}" tab does not exist on master sheet — deduction set will be empty`);
    return { keys: new Set(), rows: [] };
  }
  const rows = await sheet.getRows();
  const keys = new Set();
  for (const r of rows) {
    const ticketId = (() => { try { return r.get('ticketId'); } catch { return ''; } })();
    const productName = (() => { try { return r.get('productName'); } catch { return ''; } })();
    if (!ticketId || !productName) continue;
    keys.add(makeDeductionKey(ticketId, productName));
  }
  return { keys, rows };
}

const HISTORICAL_CLOSE_CUTOFF = '2026-05-15';
const TODAY = '2026-05-21';
const SEVEN_DAYS_AGO_ISO = (() => {
  const d = new Date(TODAY + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
})();
const TOLERANCE_UNITS = 2;

const sheetsId = process.env.GOOGLE_SHEETS_ID || process.env.DELIVERY_SHEETS_ID;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
  key: privateKey?.trim(),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const doc = new GoogleSpreadsheet(sheetsId, auth);
await doc.loadInfo();

const safeGetSheet = (name) => doc.sheetsByTitle[name] || null;
const safeRows = async (sheetName) => {
  try {
    const sheet = safeGetSheet(sheetName);
    if (!sheet) {
      console.log(`  [WARN] Tab "${sheetName}" not found — skipping`);
      return [];
    }
    return await sheet.getRows();
  } catch (err) {
    console.log(`  [WARN] Failed to read "${sheetName}": ${err.message?.slice(0, 100)}`);
    return [];
  }
};

const safeGet = (row, col) => {
  try { return row.get(col) || ''; } catch { return ''; }
};

console.log('========================================');
console.log('RCRS End-to-End Audit — 2026-05-21');
console.log('========================================');
console.log(`Sheets ID: ${sheetsId?.slice(0, 12)}...`);
console.log(`This-week window: ${SEVEN_DAYS_AGO_ISO} .. ${TODAY}`);
console.log(`Historical close cutoff: ${HISTORICAL_CLOSE_CUTOFF}`);
console.log('');

// ---------- Locate the snapshot tabs ----------
const snapshotTabs = Object.keys(doc.sheetsByTitle)
  .filter(n => n.startsWith('Inventory_Snapshot_'))
  .sort();
const primarySnap = 'Inventory_Snapshot_2026-05-15_2050_post_restock_recon';
const newestSnap = snapshotTabs[snapshotTabs.length - 1];
console.log(`Snapshot tabs found: ${snapshotTabs.length}`);
console.log(`Primary snapshot: ${doc.sheetsByTitle[primarySnap] ? primarySnap : '(MISSING)'}`);
console.log(`Newest snapshot: ${newestSnap || '(none)'}`);
console.log('');

// ---------- Load everything ----------
console.log('Loading data...');
const ticketRows     = await safeRows('Tickets');
const invoiceRows    = await safeRows('Invoices');
const deliverySched  = await safeRows('Delivery Schedule');
const invProducts    = await safeRows('Inventory_Products');
const snapPrimary    = doc.sheetsByTitle[primarySnap] ? await safeRows(primarySnap) : [];
const snapNewest     = (newestSnap && newestSnap !== primarySnap) ? await safeRows(newestSnap) : [];
const { keys: deductedKeys, rows: deductedKeyRows } = await loadDeductionKeySetReadOnly(doc);

console.log(`  Tickets: ${ticketRows.length}`);
console.log(`  Invoices: ${invoiceRows.length}`);
console.log(`  Delivery Schedule: ${deliverySched.length}`);
console.log(`  Inventory_Products: ${invProducts.length}`);
console.log(`  Primary snapshot rows: ${snapPrimary.length}`);
console.log(`  Newest extra snapshot rows: ${snapNewest.length}`);
console.log(`  Deduction-log keys: ${deductedKeys.size}`);
console.log('');

// ---------- Helpers ----------
const extractRNumber = (raw) => {
  if (!raw) return '';
  const s = String(raw);
  const m = s.match(/R-?(\d{4,6})/i);
  return m ? `R-${m[1]}` : '';
};

const ticketIdsByInvoice = new Map(); // invoiceId -> ticketId
const invoicesByTicketId = new Map(); // ticketId -> invoiceRow
const invoicesByRNumber  = new Map(); // R-12345 -> invoiceRow[]
for (const r of invoiceRows) {
  const ticketId = safeGet(r, 'ticketId');
  const invoiceId = safeGet(r, 'invoiceId');
  const jobName = safeGet(r, 'jobName');
  const customer = safeGet(r, 'customerName');
  if (invoiceId && ticketId) ticketIdsByInvoice.set(invoiceId, ticketId);
  if (ticketId) invoicesByTicketId.set(ticketId, r);
  const rnum = extractRNumber(jobName) || extractRNumber(ticketId) || extractRNumber(customer);
  if (rnum) {
    if (!invoicesByRNumber.has(rnum)) invoicesByRNumber.set(rnum, []);
    invoicesByRNumber.get(rnum).push(r);
  }
}

const deliveryScheduleByTicket = new Map();
const deliveryScheduleByR = new Map();
for (const r of deliverySched) {
  const tid = safeGet(r, 'ticketId') || safeGet(r, 'ticketID');
  const jobName = safeGet(r, 'jobName') || safeGet(r, 'job') || '';
  if (tid) deliveryScheduleByTicket.set(tid, r);
  const rnum = extractRNumber(jobName) || extractRNumber(tid);
  if (rnum) deliveryScheduleByR.set(rnum, r);
}

const hasDeductionForTicket = (ticketId) => {
  if (!ticketId) return false;
  const prefix = `${ticketId}::`;
  for (const k of deductedKeys) {
    if (k.startsWith(prefix)) return true;
  }
  return false;
};

// ---------- A. THIS-WEEK DELIVERIES ----------
console.log('========================================');
console.log('A. THIS-WEEK DELIVERIES (last 7 days)');
console.log('========================================');

const thisWeekDeliveries = ticketRows.filter(r => {
  const t = safeGet(r, 'ticketType');
  if (t !== 'delivery') return false;
  const createdAt = safeGet(r, 'createdAt');
  const d = createdAt.slice(0, 10);
  return d >= SEVEN_DAYS_AGO_ISO && d <= TODAY;
});

console.log(`This-week delivery tickets: ${thisWeekDeliveries.length}`);
const thisWeekDetail = [];
let weekWithInvoice = 0, weekWithDeduction = 0, weekWithSchedule = 0;
for (const r of thisWeekDeliveries) {
  const ticketId = safeGet(r, 'ticketId');
  const customer = safeGet(r, 'customerName') || safeGet(r, 'customer');
  const jobName = safeGet(r, 'jobName') || '';
  const status = safeGet(r, 'status');
  const createdAt = safeGet(r, 'createdAt');
  const completedAt = safeGet(r, 'completedAt');
  const rnum = extractRNumber(jobName) || extractRNumber(ticketId) || extractRNumber(customer);

  const hasInv = invoicesByTicketId.has(ticketId)
    || (rnum && invoicesByRNumber.has(rnum));
  const hasDed = hasDeductionForTicket(ticketId);
  const hasSched = deliveryScheduleByTicket.has(ticketId)
    || (rnum && deliveryScheduleByR.has(rnum));
  const statusOk = ['delivered', 'load_verified', 'completed'].includes(status);

  if (hasInv) weekWithInvoice++;
  if (hasDed) weekWithDeduction++;
  if (hasSched) weekWithSchedule++;

  console.log(`  ${ticketId} | ${rnum || '(no R#)'} | ${customer?.slice(0, 28).padEnd(28)} | ${status?.padEnd(15)} | ${createdAt.slice(0, 10)} | inv:${hasInv ? 'Y' : 'N'} ded:${hasDed ? 'Y' : 'N'} sched:${hasSched ? 'Y' : 'N'}`);
  thisWeekDetail.push({
    ticketId, rNumber: rnum, customer, status, createdAt, completedAt,
    hasInvoice: hasInv, hasDeduction: hasDed, hasSchedule: hasSched, statusReflectsReality: statusOk,
  });
}
console.log(`Summary: invoiced ${weekWithInvoice}/${thisWeekDeliveries.length}  deducted ${weekWithDeduction}/${thisWeekDeliveries.length}  on-sched ${weekWithSchedule}/${thisWeekDeliveries.length}`);
console.log('');

// ---------- B. ALL-TIME TICKET INTEGRITY ----------
console.log('========================================');
console.log('B. ALL-TIME TICKET INTEGRITY');
console.log('========================================');

const byType = {};
for (const r of ticketRows) {
  const t = safeGet(r, 'ticketType') || '(blank)';
  byType[t] = (byType[t] || 0) + 1;
}
console.log('Tickets by type:');
for (const [t, n] of Object.entries(byType).sort()) console.log(`  ${t}: ${n}`);
console.log(`Total tickets: ${ticketRows.length}`);
console.log(`Total invoices: ${invoiceRows.length}`);

const deliveryTickets = ticketRows.filter(r => safeGet(r, 'ticketType') === 'delivery');
const deliveriesNoInvoice = [];
let deliveryNoInvoicePost = 0, deliveryNoInvoicePre = 0;
for (const r of deliveryTickets) {
  const ticketId = safeGet(r, 'ticketId');
  const jobName = safeGet(r, 'jobName') || '';
  const rnum = extractRNumber(jobName) || extractRNumber(ticketId);
  const hasInv = invoicesByTicketId.has(ticketId)
    || (rnum && invoicesByRNumber.has(rnum));
  if (!hasInv) {
    const createdAt = safeGet(r, 'createdAt').slice(0, 10);
    const post = createdAt && createdAt >= HISTORICAL_CLOSE_CUTOFF;
    if (post) deliveryNoInvoicePost++; else deliveryNoInvoicePre++;
    deliveriesNoInvoice.push({
      ticketId, rNumber: rnum, jobName,
      customer: safeGet(r, 'customerName'),
      createdAt, post,
    });
  }
}
console.log(`Delivery tickets without invoice (post-${HISTORICAL_CLOSE_CUTOFF}): ${deliveryNoInvoicePost}`);
console.log(`Delivery tickets without invoice (pre-${HISTORICAL_CLOSE_CUTOFF}):  ${deliveryNoInvoicePre}`);

const deliveredNoDeduction = [];
for (const r of deliveryTickets) {
  const status = safeGet(r, 'status');
  if (!['delivered', 'load_verified', 'completed'].includes(status)) continue;
  const ticketId = safeGet(r, 'ticketId');
  const createdAt = safeGet(r, 'createdAt').slice(0, 10);
  if (createdAt < HISTORICAL_CLOSE_CUTOFF) continue; // pre-cutoff handled by snapshot
  if (!hasDeductionForTicket(ticketId)) {
    deliveredNoDeduction.push({ ticketId, customerName: safeGet(r, 'customerName'), createdAt, status });
  }
}
console.log(`Delivered status (post-cutoff) but no deduction log entry: ${deliveredNoDeduction.length}`);

const cmTickets = ticketRows.filter(r => {
  const id = safeGet(r, 'ticketId');
  const t = safeGet(r, 'ticketType');
  return id.startsWith('CM-') || t === 'credit_memo' || t === 'return';
});
const cmNoCreditInvoice = [];
for (const r of cmTickets) {
  const ticketId = safeGet(r, 'ticketId');
  const hasMatch = invoicesByTicketId.has(ticketId);
  if (!hasMatch) {
    cmNoCreditInvoice.push({
      ticketId, customerName: safeGet(r, 'customerName'),
      ticketType: safeGet(r, 'ticketType'),
      createdAt: safeGet(r, 'createdAt'),
    });
  }
}
console.log(`Credit-memo / return tickets without credit-memo invoice: ${cmNoCreditInvoice.length}`);

const restockTickets = ticketRows.filter(r => safeGet(r, 'ticketType') === 'restock');
let restockMinDate = '9999';
let restockMaxDate = '0';
for (const r of restockTickets) {
  const d = safeGet(r, 'createdAt').slice(0, 10);
  if (d && d < restockMinDate) restockMinDate = d;
  if (d && d > restockMaxDate) restockMaxDate = d;
}
console.log(`Restock tickets: ${restockTickets.length}  (range: ${restockTickets.length ? `${restockMinDate} .. ${restockMaxDate}` : 'n/a'})`);
console.log('');

// ---------- C. INVENTORY MATH RECONCILIATION ----------
console.log('========================================');
console.log('C. INVENTORY MATH RECONCILIATION');
console.log('========================================');

// Reuse the deduction log rows already loaded read-only above.
const dedLogRows = deductedKeyRows;
console.log(`Deduction log rows (raw, all-time): ${dedLogRows.length}`);

// Sum deductions since cutoff per productId / productName
const deductionsBySku = new Map(); // key: productId or normalized name -> qty
for (const r of dedLogRows) {
  const dedAt = safeGet(r, 'deductedAt').slice(0, 10);
  if (dedAt && dedAt < HISTORICAL_CLOSE_CUTOFF) continue;
  const productId = safeGet(r, 'productId') || '';
  const productName = safeGet(r, 'productName') || '';
  const key = productId || productName.toLowerCase().trim();
  if (!key) continue;
  const delta = parseFloat(safeGet(r, 'qtyDelta')) || 0;
  // qtyDelta is negative (deduction). Use abs for "deliveries out" total.
  const cur = deductionsBySku.get(key) || { productId, productName, qty: 0 };
  cur.qty += Math.abs(delta);
  deductionsBySku.set(key, cur);
}

// Sum restock movements since cutoff per SKU (from Tickets, materialsJson)
const restocksBySku = new Map();
for (const r of restockTickets) {
  const created = safeGet(r, 'createdAt').slice(0, 10);
  if (created && created < HISTORICAL_CLOSE_CUTOFF) continue;
  let materials = [];
  try { materials = JSON.parse(safeGet(r, 'materialsJson') || '[]'); } catch {}
  for (const m of materials) {
    const pid = m.productId || '';
    const pname = m.productName || '';
    const key = pid || pname.toLowerCase().trim();
    if (!key) continue;
    const qty = parseFloat(m.quantity) || 0;
    const cur = restocksBySku.get(key) || { productId: pid, productName: pname, qty: 0 };
    cur.qty += qty;
    restocksBySku.set(key, cur);
  }
}

// Build snapshot lookup — column names vary across snapshot eras, so probe
// the header row of the primary snapshot once and pick the best matches.
const snapByKey = new Map();
let snapHeaders = [];
try {
  if (doc.sheetsByTitle[primarySnap]) {
    snapHeaders = doc.sheetsByTitle[primarySnap].headerValues || [];
  }
} catch {}
const pickHeader = (candidates) => candidates.find(c => snapHeaders.includes(c));
const snapPidCol  = pickHeader(['productId', 'sku', 'id', 'product_id']) || 'productId';
const snapNameCol = pickHeader(['productName', 'name', 'product_name', 'product']) || 'productName';
// 'after' is the post-restock-recon column on the 2026-05-15 snapshot.
const snapQtyCol  = pickHeader(['after', 'currentQty', 'qty', 'quantity', 'stockQty', 'on_hand', 'opening_qty']) || 'after';
console.log(`Snapshot column mapping: id=${snapPidCol}, name=${snapNameCol}, qty=${snapQtyCol}  (headers: ${snapHeaders.slice(0, 12).join(', ')}${snapHeaders.length > 12 ? '…' : ''})`);
for (const r of snapPrimary) {
  const pid = safeGet(r, snapPidCol);
  const pname = safeGet(r, snapNameCol);
  const key = pid || pname.toLowerCase().trim();
  if (!key) continue;
  const qty = parseFloat(safeGet(r, snapQtyCol)) || 0;
  snapByKey.set(key, { productId: pid, productName: pname, qty });
}

// Compare per Inventory_Products row
const reconRows = [];
console.log(`SKU | currQty | deliveries+ | restocks- | implied open | snap open | diff | flag`);
console.log(`---`);
for (const r of invProducts) {
  const pid = safeGet(r, 'productId') || safeGet(r, 'sku') || '';
  const pname = safeGet(r, 'productName') || safeGet(r, 'name') || '';
  const key = pid || pname.toLowerCase().trim();
  const currentQty = parseFloat(safeGet(r, 'currentQty')) || 0;
  const deliveries = deductionsBySku.get(key)?.qty || 0;
  const restocks = restocksBySku.get(key)?.qty || 0;
  const impliedOpening = currentQty + deliveries - restocks;
  const snap = snapByKey.get(key);
  const snapQty = snap?.qty;
  const diff = (snapQty !== undefined) ? (impliedOpening - snapQty) : null;
  const flag = (diff === null) ? 'NO_SNAP'
             : (Math.abs(diff) <= TOLERANCE_UNITS) ? 'OK'
             : 'MISMATCH';
  reconRows.push({
    productId: pid, productName: pname, currentQty,
    deliveriesSinceCutoff: deliveries,
    restocksSinceCutoff: restocks,
    impliedOpeningQty: impliedOpening,
    snapshotOpeningQty: snapQty ?? null,
    diff, flag,
  });
  console.log(`  ${(pid || pname).slice(0, 22).padEnd(22)} | ${String(currentQty).padStart(6)} | ${String(deliveries).padStart(8)} | ${String(restocks).padStart(8)} | ${String(impliedOpening).padStart(8)} | ${String(snapQty ?? '?').padStart(8)} | ${diff === null ? '   ?' : String(diff).padStart(4)} | ${flag}`);
}
console.log('');

// ---------- D. EARLIEST NON-RESTOCK TICKET ----------
console.log('========================================');
console.log('D. EARLIEST NON-RESTOCK TICKET (backfill anchor)');
console.log('========================================');
let earliest = null;
for (const r of ticketRows) {
  const t = safeGet(r, 'ticketType');
  if (t === 'restock') continue;
  if (t !== 'delivery') continue; // owner cares about delivery (inventory-stock) anchor
  const createdAt = safeGet(r, 'createdAt');
  const d = createdAt.slice(0, 10);
  if (!d) continue;
  if (!earliest || d < earliest.createdAt.slice(0, 10)) {
    earliest = {
      ticketId: safeGet(r, 'ticketId'),
      ticketType: t,
      customerName: safeGet(r, 'customerName'),
      createdAt,
      jobName: safeGet(r, 'jobName'),
      materialsJson: safeGet(r, 'materialsJson'),
    };
  }
}
if (earliest) {
  let items = [];
  try { items = JSON.parse(earliest.materialsJson || '[]'); } catch {}
  const itemsBrief = items.map(m => `${m.productName || m.productId} x${m.quantity || '?'}`).slice(0, 6).join('; ');
  console.log(`  Ticket: ${earliest.ticketId}`);
  console.log(`  Date:   ${earliest.createdAt}`);
  console.log(`  Type:   ${earliest.ticketType}`);
  console.log(`  Cust:   ${earliest.customerName}`);
  console.log(`  Job:    ${earliest.jobName}`);
  console.log(`  Items:  ${itemsBrief}${items.length > 6 ? ` ... (+${items.length - 6} more)` : ''}`);
} else {
  console.log('  (no delivery tickets found)');
}
console.log('');

// ---------- SUMMARY: GAPS NEEDING OWNER ACTION ----------
console.log('========================================');
console.log('SUMMARY — Gaps needing owner action');
console.log('========================================');

const gaps = [];

// this-week delivery gaps
for (const d of thisWeekDetail) {
  if (!d.hasInvoice) {
    gaps.push(`Ticket ${d.ticketId} (${d.createdAt?.slice(0,10)}, ${d.customer || ''}) has no invoice — needs INV-... created`);
  }
  if (!d.hasDeduction && ['delivered', 'load_verified', 'completed'].includes(d.status)) {
    gaps.push(`Ticket ${d.ticketId} status=${d.status} but NO inventory deduction logged`);
  }
  if (!d.hasSchedule) {
    gaps.push(`Ticket ${d.ticketId} (${d.customer || ''}) missing from Delivery Schedule tab`);
  }
}

// post-cutoff delivery gaps beyond this week
const postCutoffNoInvOlderThanWeek = deliveriesNoInvoice.filter(d =>
  d.post && d.createdAt && d.createdAt < SEVEN_DAYS_AGO_ISO
);
if (postCutoffNoInvOlderThanWeek.length) {
  gaps.push(`${postCutoffNoInvOlderThanWeek.length} additional post-${HISTORICAL_CLOSE_CUTOFF} delivery tickets without invoices (older than 7 days)`);
}

// delivered-no-deduction outside this-week
for (const d of deliveredNoDeduction) {
  if (d.createdAt < SEVEN_DAYS_AGO_ISO) {
    gaps.push(`Ticket ${d.ticketId} (${d.createdAt}) status=${d.status} but no deduction log entry`);
  }
}

// returns without credit memo
if (cmNoCreditInvoice.length) {
  gaps.push(`${cmNoCreditInvoice.length} returns / credit-memo tickets without a credit-memo invoice row`);
  for (const cm of cmNoCreditInvoice.slice(0, 8)) {
    gaps.push(`   - ${cm.ticketId} (${cm.createdAt?.slice(0,10)}, ${cm.customerName || ''})`);
  }
}

// inventory math mismatches
for (const r of reconRows) {
  if (r.flag === 'MISMATCH') {
    gaps.push(`Inventory ${r.productId || r.productName}: implied opening ${r.impliedOpeningQty} vs snapshot ${r.snapshotOpeningQty} (diff ${r.diff}) — math doesn't reconcile`);
  }
  if (r.currentQty <= 0 && r.deliveriesSinceCutoff > 0 && r.restocksSinceCutoff === 0) {
    gaps.push(`Inventory ${r.productId || r.productName} at ${r.currentQty}, ${r.deliveriesSinceCutoff} deducted since cutoff, NO restock — needs restock ticket`);
  }
}

if (gaps.length === 0) {
  console.log('  (no gaps detected — everything reconciles)');
} else {
  for (const g of gaps) console.log(`  - ${g}`);
}
console.log('');
console.log(`Total actionable gaps: ${gaps.length}`);

// ---------- WRITE JSON SNAPSHOT ----------
const out = {
  generatedAt: new Date().toISOString(),
  today: TODAY,
  thisWeekStart: SEVEN_DAYS_AGO_ISO,
  historicalCloseCutoff: HISTORICAL_CLOSE_CUTOFF,
  counts: {
    tickets: ticketRows.length,
    invoices: invoiceRows.length,
    deliverySchedule: deliverySched.length,
    inventoryProducts: invProducts.length,
    deductionLogRows: dedLogRows.length,
    deductionKeys: deductedKeys.size,
    snapshotPrimaryRows: snapPrimary.length,
    snapshotTabs: snapshotTabs,
    primarySnapshot: primarySnap,
    newestSnapshot: newestSnap,
  },
  ticketsByType: byType,
  thisWeekDeliveries: thisWeekDetail,
  thisWeekRollup: {
    total: thisWeekDeliveries.length,
    withInvoice: weekWithInvoice,
    withDeduction: weekWithDeduction,
    withSchedule: weekWithSchedule,
  },
  allTime: {
    deliveryTickets: deliveryTickets.length,
    deliveriesWithoutInvoicePostCutoff: deliveryNoInvoicePost,
    deliveriesWithoutInvoicePreCutoff: deliveryNoInvoicePre,
    deliveredNoDeductionPostCutoff: deliveredNoDeduction.length,
    creditMemoTickets: cmTickets.length,
    creditMemoWithoutInvoice: cmNoCreditInvoice.length,
    restockTickets: restockTickets.length,
    restockDateRange: restockTickets.length ? { min: restockMinDate, max: restockMaxDate } : null,
  },
  deliveriesWithoutInvoice: deliveriesNoInvoice.slice(0, 200),
  deliveredNoDeduction: deliveredNoDeduction.slice(0, 200),
  creditMemoMissingInvoice: cmNoCreditInvoice,
  inventoryReconciliation: reconRows,
  earliestDeliveryAnchor: earliest,
  gaps,
};

const outPath = path.join(process.cwd(), 'scripts', 'audit-2026-05-21-results.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`\nWrote JSON snapshot: ${outPath}`);
console.log('Audit complete (READ-ONLY — no sheet writes performed).');
