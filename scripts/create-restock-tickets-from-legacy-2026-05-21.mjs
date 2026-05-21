/**
 * create-restock-tickets-from-legacy-2026-05-21.mjs
 *
 * Owner directive (2026-05-21):
 *   Replace the single TKT-HISTORICAL-RESTOCK-RECON-20260516 summary ticket
 *   with 20 dated restock tickets derived from the LEGACY inventory log —
 *   one ticket per distinct restock date, grouped by date (not per SKU).
 *
 * What this script does:
 *   1) Reads the LEGACY Inventory tab directly (LEGACY_INVENTORY_SHEETS_ID)
 *      and re-categorizes all transactions. Groups positive-amount rows
 *      with R# = '' or '1234' (the bulk-restock sentinel) by date.
 *   2) Voids the existing recon ticket in master Tickets (preserves audit
 *      trail by setting status=voided + appending a note).
 *   3) Inserts one restock ticket per distinct date into master Tickets,
 *      idempotent by ticketId (RESTOCK-YYYYMMDD-001).
 *   4) Re-computes inferred currentQty after the writes and produces the
 *      owner-verification deliverable:
 *      scripts/inferred-currentqty-for-owner-verification-2026-05-21.json
 *
 * Rules:
 *   - DOES NOT touch Inventory_Products.currentQty (owner verifies physical).
 *   - DOES NOT delete the recon ticket (voided only).
 *   - Sends NO emails (silent backfill).
 *   - Idempotent — safe to re-run.
 *   - Skips legacy SKUs that have no matching Inventory_Products.legacyId,
 *     and reports them in a needs-owner-attention list.
 */
import fs from 'fs';
import path from 'path';

// ---- load .env.local ----
const envPath = path.join(process.cwd(), '.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
});

const LEGACY_SHEET_ID = process.env.LEGACY_INVENTORY_SHEETS_ID;
const MASTER_SHEET_ID = process.env.GOOGLE_SHEETS_ID || process.env.DELIVERY_SHEETS_ID;
if (!LEGACY_SHEET_ID) throw new Error('LEGACY_INVENTORY_SHEETS_ID not set in .env.local');
if (!MASTER_SHEET_ID) throw new Error('GOOGLE_SHEETS_ID (master) not set in .env.local');

const TODAY = '2026-05-21';
const RECON_TICKET_ID = 'TKT-HISTORICAL-RESTOCK-RECON-20260516';
const CREATED_BY = 'legacy-restock-backfill-2026-05-21';
const CREATED_BY_NAME = 'Legacy Restock Backfill';

const { JWT } = await import('google-auth-library');
const { GoogleSpreadsheet } = await import('google-spreadsheet');

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim(),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const stdoutLines = [];
const log = (s = '') => {
  console.log(s);
  stdoutLines.push(s);
};

// ---- helpers ----
function parseLegacyDateTime(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value) && value > 1000) {
    const d = new Date((value - 25569) * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, mo, da, yr] = m;
    return `${yr}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
  }
  const isoM = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoM) return isoM[0];
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}
function parseNum(v) {
  if (v == null || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// ============================================================
// PHASE 1 — Read legacy + group restocks by date
// ============================================================
log('=== PHASE 1: read legacy Inventory tab and group restocks by date ===');
const legacyDoc = new GoogleSpreadsheet(LEGACY_SHEET_ID, auth);
await legacyDoc.loadInfo();
log(`Legacy doc: "${legacyDoc.title}"`);

const invTab = legacyDoc.sheetsByTitle['Inventory'];
if (!invTab) throw new Error("Legacy 'Inventory' tab not found");
await invTab.loadHeaderRow();
const legacyHeaders = invTab.headerValues;
log(`Legacy headers: ${JSON.stringify(legacyHeaders)}`);
const legacyRows = await invTab.getRows();
log(`Legacy Inventory rows: ${legacyRows.length}`);

// Classify ONLY restock-type entries (positive Amount, R# = '1234' or empty)
const restockTx = [];
for (const r of legacyRows) {
  const o = r.toObject();
  const amount = parseNum(o['Amount']);
  if (amount <= 0) continue; // restocks are positive
  const rNum = (o['R#'] || '').toString().trim();
  const rUpper = rNum.toUpperCase();
  // Reject CM/return/portal back-sync rows. Restock = '' or '1234' sentinel only.
  if (rUpper.startsWith('CM') || rUpper.includes('CREDIT') || rUpper.includes('RETURN')) continue;
  if (rUpper.startsWith('TKT-')) continue;
  if (rNum !== '' && rNum !== '1234') continue;
  const itemId = (o['Item ID'] || '').toString().trim();
  if (!itemId) continue;
  const date = parseLegacyDateTime(o['DateTime']);
  if (!date) continue;
  restockTx.push({ date, itemId, qty: Math.abs(amount), rNum });
}
log(`Restock-classified rows: ${restockTx.length}`);

// Group by date
const restocksByDate = {};
for (const t of restockTx) {
  if (!restocksByDate[t.date]) restocksByDate[t.date] = [];
  restocksByDate[t.date].push(t);
}
const distinctDates = Object.keys(restocksByDate).sort();
log(`Distinct restock dates: ${distinctDates.length}`);

// ============================================================
// PHASE 2 — Load master sheet
// ============================================================
log('');
log('=== PHASE 2: load master sheet (Tickets + Inventory_Products) ===');
const masterDoc = new GoogleSpreadsheet(MASTER_SHEET_ID, auth);
await masterDoc.loadInfo();
log(`Master doc: "${masterDoc.title}"`);

const ticketsTab = masterDoc.sheetsByTitle['Tickets'];
if (!ticketsTab) throw new Error("Master 'Tickets' tab not found");
await ticketsTab.loadHeaderRow();
const ticketsHeaders = ticketsTab.headerValues;
log(`Tickets headers: ${JSON.stringify(ticketsHeaders)}`);
const ticketsHeaderSet = new Set(ticketsHeaders);

const invProductsTab = masterDoc.sheetsByTitle['Inventory_Products'];
if (!invProductsTab) throw new Error("Master 'Inventory_Products' tab not found");
const invProductRows = await invProductsTab.getRows();
const productByLegacyId = {};
for (const r of invProductRows) {
  const o = r.toObject();
  const legacyId = (o.legacyId || '').toString().trim();
  if (!legacyId) continue;
  productByLegacyId[legacyId] = {
    productId: (o.productId || '').trim(),
    legacyId,
    productName: (o.productName || '').toString(),
    currentQty: parseNum(o.currentQty),
  };
}
log(`Inventory_Products with legacyId: ${Object.keys(productByLegacyId).length}`);

const ticketRows = await ticketsTab.getRows();
log(`Existing Tickets rows: ${ticketRows.length}`);
const ticketsByTicketId = {};
for (const r of ticketRows) {
  const id = (r.get('ticketId') || '').toString().trim();
  if (id) ticketsByTicketId[id] = r;
}

// ============================================================
// PHASE 3 — Void the existing recon ticket
// ============================================================
log('');
log('=== PHASE 3: void the recon summary ticket ===');
let voidedConfirmation = '';
const reconRow = ticketsByTicketId[RECON_TICKET_ID];
if (!reconRow) {
  log(`WARNING: recon ticket ${RECON_TICKET_ID} not found in master Tickets — continuing.`);
  voidedConfirmation = `NOT_FOUND: ${RECON_TICKET_ID}`;
} else {
  const beforeStatus = reconRow.get('status') || '';
  const beforeNotes = reconRow.get('notes') || '';
  if (beforeStatus === 'voided') {
    log(`Recon ticket already voided. No-op. (status=${beforeStatus})`);
    voidedConfirmation = `ALREADY_VOIDED: ${RECON_TICKET_ID}`;
  } else {
    reconRow.set('status', 'voided');
    const newNotes =
      (beforeNotes ? `${beforeNotes}` : '') +
      `; VOIDED ${TODAY} — replaced by 20 dated restock tickets derived from legacy inventory log`;
    reconRow.set('notes', newNotes);
    await reconRow.save();
    log(`Voided ${RECON_TICKET_ID}: status "${beforeStatus}" -> "voided"`);
    log(`  notes appended.`);
    voidedConfirmation = `VOIDED: ${RECON_TICKET_ID}`;
  }
}

// ============================================================
// PHASE 4 — Create dated restock tickets
// ============================================================
log('');
log('=== PHASE 4: create dated restock tickets ===');

// Detect column variants
const col = {
  type: ticketsHeaderSet.has('type') ? 'type'
    : ticketsHeaderSet.has('ticketType') ? 'ticketType' : null,
  customer: ticketsHeaderSet.has('customer') ? 'customer'
    : ticketsHeaderSet.has('customerName') ? 'customerName' : null,
  address: ticketsHeaderSet.has('address') ? 'address'
    : ticketsHeaderSet.has('jobAddress') ? 'jobAddress' : null,
  materials: ticketsHeaderSet.has('materialsJson') ? 'materialsJson'
    : ticketsHeaderSet.has('lineItems') ? 'lineItems'
    : ticketsHeaderSet.has('items') ? 'items' : null,
  createdBy: ticketsHeaderSet.has('createdBy') ? 'createdBy' : null,
  createdByName: ticketsHeaderSet.has('createdByName') ? 'createdByName' : null,
  notes: ticketsHeaderSet.has('notes') ? 'notes' : null,
  status: ticketsHeaderSet.has('status') ? 'status' : null,
  createdAt: ticketsHeaderSet.has('createdAt') ? 'createdAt' : null,
  completedAt: ticketsHeaderSet.has('completedAt') ? 'completedAt' : null,
  ticketId: ticketsHeaderSet.has('ticketId') ? 'ticketId' : null,
};
log(`Detected columns: ${JSON.stringify(col)}`);

const needsOwnerAttention = [];
let created = 0;
let skipped = 0;
const createdTicketIds = [];

for (const date of distinctDates) {
  const ticketIdBase = `RESTOCK-${date.replace(/-/g, '')}`;
  const ticketId = `${ticketIdBase}-001`;

  if (ticketsByTicketId[ticketId]) {
    log(`SKIP (already exists): ${ticketId}`);
    skipped++;
    continue;
  }

  const lines = restocksByDate[date];
  // Build line items, mapping legacyId -> productId/productName via Inventory_Products
  const items = [];
  for (const l of lines) {
    const prod = productByLegacyId[l.itemId];
    if (!prod) {
      needsOwnerAttention.push({ date, itemId: l.itemId, qty: l.qty, reason: 'No matching Inventory_Products.legacyId' });
      continue;
    }
    items.push({
      productId: l.itemId,
      productName: prod.productName,
      qty: l.qty,
      source: 'legacy-inventory-log',
    });
  }
  if (items.length === 0) {
    log(`SKIP (no resolvable items): ${ticketId}  date=${date}`);
    continue;
  }

  // Choose a date-time for createdAt/completedAt — noon UTC on that date keeps
  // it stable and clearly historical.
  const isoDateTime = `${date}T12:00:00.000Z`;

  const row = {};
  if (col.ticketId) row[col.ticketId] = ticketId;
  if (col.type) row[col.type] = 'restock';
  if (col.status) row[col.status] = 'completed';
  if (col.createdAt) row[col.createdAt] = isoDateTime;
  if (col.completedAt) row[col.completedAt] = isoDateTime;
  if (col.customer) row[col.customer] = '';
  if (col.address) row[col.address] = '';
  if (col.notes) {
    row[col.notes] = `Restock backfill from legacy inventory log 2026-05-21. Source: LEGACY_INVENTORY_SHEETS_ID 'new inventory' Inventory tab, restock transactions on ${date}. ${items.length} line items.`;
  }
  if (col.materials) row[col.materials] = JSON.stringify(items);
  if (col.createdBy) row[col.createdBy] = CREATED_BY;
  if (col.createdByName) row[col.createdByName] = CREATED_BY_NAME;

  await ticketsTab.addRow(row);
  created++;
  createdTicketIds.push(ticketId);
  log(`CREATED: ${ticketId} (${items.length} line items, ${items.reduce((a, b) => a + b.qty, 0)} units)`);
}

// ============================================================
// PHASE 5 — Summary
// ============================================================
log('');
log('=== PHASE 5: summary ===');
const dateRange = distinctDates.length
  ? `${distinctDates[0]} to ${distinctDates[distinctDates.length - 1]}`
  : '(none)';
const summaryLines = [
  `- ${created} restock tickets created (date range ${dateRange})`,
  `- ${skipped} tickets skipped as duplicates (already exist by ticketId)`,
  `- 1 voided: ${RECON_TICKET_ID} (${voidedConfirmation})`,
  `- ${created + skipped + (voidedConfirmation.startsWith('VOIDED') ? 1 : 0)} rows touched in master Tickets total`,
];
for (const l of summaryLines) log(l);
if (needsOwnerAttention.length) {
  log('');
  log(`NEEDS OWNER ATTENTION (${needsOwnerAttention.length} legacy entries with no Inventory_Products mapping):`);
  for (const n of needsOwnerAttention) {
    log(`  ${n.date}  ${n.itemId}  qty=${n.qty}  reason=${n.reason}`);
  }
}

// ============================================================
// PHASE 6 — Re-run inferred currentQty math (post-write)
// ============================================================
log('');
log('=== PHASE 6: re-run inferred currentQty math ===');

// Pull the same JSON the read-only pass produced — we use the canonical math
// it already established (legR - legD + legRet + portR - portD + portCM).
const summaryPath = path.join(process.cwd(), 'scripts', 'legacy-inventory-log-summary-2026-05-21.json');
const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

const verification = {
  generatedAt: new Date().toISOString(),
  today: TODAY,
  note: 'Inferred currentQty per SKU after backfill. Owner to spot-check vs PHYSICAL stock. Master Inventory_Products.currentQty is STALE and was intentionally NOT updated.',
  mathIdentity: 'inferred = legacy_restocks - legacy_deliveries + legacy_returns + portal_restocks - portal_deliveries_since_cutoff + portal_credit_memos',
  ticketsCreated: created,
  ticketsSkipped: skipped,
  reconTicketVoided: voidedConfirmation,
  dateRange,
  perSku: [],
};

log('');
log('Per-SKU inferred currentQty (OWNER VERIFY AGAINST PHYSICAL STOCK):');
log('-'.repeat(120));
log(
  `${'sku'.padEnd(10)} | ${'name'.padEnd(30)} | ${'inferred'.padStart(9)} | ${'master(stale)'.padStart(13)} | note`
);
log('-'.repeat(120));
for (const row of summary.liveSkuTable) {
  const live = productByLegacyId[row.sku];
  const masterCurr = live ? live.currentQty : row.masterCurrentQty;
  const entry = {
    sku: row.sku,
    name: row.name,
    inferredCurrentQty: row.inferred,
    masterCurrentQtyStale: masterCurr,
    note: 'OWNER VERIFY THIS NUMBER AGAINST PHYSICAL STOCK',
  };
  verification.perSku.push(entry);
  log(
    `${row.sku.padEnd(10)} | ${row.name.slice(0, 30).padEnd(30)} | ${String(row.inferred).padStart(9)} | ${String(masterCurr).padStart(13)} | OWNER VERIFY`
  );
}
log('-'.repeat(120));

const verifyPath = path.join(
  process.cwd(),
  'scripts',
  'inferred-currentqty-for-owner-verification-2026-05-21.json'
);
fs.writeFileSync(verifyPath, JSON.stringify(verification, null, 2));
log('');
log(`Wrote verification deliverable: ${verifyPath}`);

// ============================================================
// PHASE 7 — Spot-check: re-read 2 random new restock rows
// ============================================================
log('');
log('=== PHASE 7: spot-check 2 random new restock rows ===');
const spotCheck = { picked: [], rows: [] };
if (createdTicketIds.length >= 2) {
  // pick 2 random
  const pool = [...createdTicketIds];
  for (let i = 0; i < 2 && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    spotCheck.picked.push(pool.splice(idx, 1)[0]);
  }
} else {
  for (const id of createdTicketIds) spotCheck.picked.push(id);
}

// Re-read tickets to pick up new rows
const freshTicketRows = await ticketsTab.getRows();
const freshById = {};
for (const r of freshTicketRows) {
  const id = (r.get('ticketId') || '').toString().trim();
  if (id) freshById[id] = r;
}

for (const id of spotCheck.picked) {
  const r = freshById[id];
  if (!r) {
    log(`SPOT-CHECK FAILED: ${id} not found on re-read`);
    spotCheck.rows.push({ ticketId: id, error: 'not_found_on_reread' });
    continue;
  }
  const snap = {
    ticketId: id,
    type: col.type ? r.get(col.type) : null,
    status: col.status ? r.get(col.status) : null,
    createdAt: col.createdAt ? r.get(col.createdAt) : null,
    completedAt: col.completedAt ? r.get(col.completedAt) : null,
    createdBy: col.createdBy ? r.get(col.createdBy) : null,
    materialsJson: col.materials ? r.get(col.materials) : null,
    notes: col.notes ? r.get(col.notes) : null,
  };
  spotCheck.rows.push(snap);
  log(`SPOT-CHECK ${id}:`);
  log(`  type=${snap.type}  status=${snap.status}`);
  log(`  createdAt=${snap.createdAt}  completedAt=${snap.completedAt}`);
  log(`  createdBy=${snap.createdBy}`);
  if (snap.materialsJson) {
    let parsed = null;
    try { parsed = JSON.parse(snap.materialsJson); } catch {}
    log(`  materialsJson: ${parsed ? `${parsed.length} items, ${parsed.reduce((a, b) => a + (b.qty || 0), 0)} total units` : '(unparseable)'}`);
    if (parsed && parsed[0]) log(`  first item: ${JSON.stringify(parsed[0])}`);
  }
  log(`  notes: ${(snap.notes || '').slice(0, 160)}`);
}
verification.spotCheck = spotCheck;

// Also confirm voided recon by re-reading
const reconFresh = freshById[RECON_TICKET_ID];
if (reconFresh) {
  const reconSnap = {
    ticketId: RECON_TICKET_ID,
    status: col.status ? reconFresh.get(col.status) : null,
    notes: col.notes ? reconFresh.get(col.notes) : null,
  };
  verification.voidedReconConfirmed = reconSnap;
  log('');
  log(`VOIDED RECON CONFIRMATION (re-read):`);
  log(`  status=${reconSnap.status}`);
  log(`  notes tail: ${(reconSnap.notes || '').slice(-200)}`);
} else {
  verification.voidedReconConfirmed = { ticketId: RECON_TICKET_ID, error: 'not_found_on_reread' };
  log('');
  log(`VOIDED RECON CONFIRMATION: recon row not found on re-read.`);
}

// Final write of verification with spot check
fs.writeFileSync(verifyPath, JSON.stringify(verification, null, 2));
log('');
log('DONE.');

// Write stdout log
const stdoutPath = path.join(
  process.cwd(),
  'scripts',
  'create-restock-tickets-from-legacy-2026-05-21.log'
);
fs.writeFileSync(stdoutPath, stdoutLines.join('\n'));
console.log(`Wrote stdout log: ${stdoutPath}`);
