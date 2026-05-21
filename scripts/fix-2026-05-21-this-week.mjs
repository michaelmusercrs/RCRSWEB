/**
 * Fix this-week deliveries — 2026-05-21
 *
 * WRITES TO MASTER SHEET. Owner explicitly approved this work.
 *
 * Targets the 3 this-week delivery tickets from
 * scripts/audit-2026-05-21-results.json:
 *   - TKT-R-10997 (Leanna Hooper)   status: created  -> delivered
 *   - TKT-R-10923 (Chuck Rogers)    status: completed (already correct, no status change)
 *   - TKT-R-11223 (Brenda Langham)  status: created  -> delivered
 *
 * For ALL 3, writes inventory-deduction-log entries (the
 * `Inventory_Deductions_Log` tab is lazy-created by the helper).
 *
 * CRITICAL: Does NOT touch any inventory_products.currentQty. Does NOT
 * write to any other tab. Does NOT process pre-cutoff tickets.
 * Idempotent — safe to re-run.
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
const {
  loadDeductionKeySet,
  wasDeducted,
  appendDeductionLog,
} = await import('../lib/inventory-deduction-log.mjs');

const HISTORICAL_CLOSE_CUTOFF = '2026-05-15';
const TODAY_ISO = new Date().toISOString();

const TARGET_TICKETS = ['TKT-R-10997', 'TKT-R-10923', 'TKT-R-11223'];
const STATUS_UPDATE_TICKETS = new Set(['TKT-R-10997', 'TKT-R-11223']); // NOT Chuck — already completed
const TERMINAL_STATUSES = new Set(['delivered', 'load_verified', 'completed']);

const sheetsId = process.env.GOOGLE_SHEETS_ID || process.env.DELIVERY_SHEETS_ID;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
  key: privateKey?.trim(),
  // FULL spreadsheets scope — we are writing.
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(sheetsId, auth);
await doc.loadInfo();

console.log('========================================');
console.log('RCRS Fix — This-week deliveries — 2026-05-21');
console.log('========================================');
console.log(`Sheets ID:  ${sheetsId?.slice(0, 12)}...`);
console.log(`Sheet name: ${doc.title}`);
console.log(`Today ISO:  ${TODAY_ISO}`);
console.log('');

const safeGet = (row, col) => {
  try { return row.get(col) || ''; } catch { return ''; }
};
const safeSet = (row, col, val) => {
  try { row.set(col, val); return true; } catch { return false; }
};

// ---------- Load tabs ----------
const ticketsSheet = doc.sheetsByTitle['Tickets'];
const invoicesSheet = doc.sheetsByTitle['Invoices'];
const invProductsSheet = doc.sheetsByTitle['Inventory_Products'];

if (!ticketsSheet)      throw new Error('Tickets tab not found');
if (!invoicesSheet)     throw new Error('Invoices tab not found');
if (!invProductsSheet)  throw new Error('Inventory_Products tab not found');

const ticketRows = await ticketsSheet.getRows();
const invoiceRows = await invoicesSheet.getRows();
const invProductRows = await invProductsSheet.getRows();

console.log(`Loaded Tickets:            ${ticketRows.length} rows`);
console.log(`Loaded Invoices:           ${invoiceRows.length} rows`);
console.log(`Loaded Inventory_Products: ${invProductRows.length} rows`);
console.log('');

// ---------- Build lookups ----------
const extractRNumber = (raw) => {
  if (!raw) return '';
  const m = String(raw).match(/R-?(\d{4,6})/i);
  return m ? `R-${m[1]}` : '';
};

// Invoice lookup: by ticketId direct, and by R-number fallback
const invoiceByTicketId = new Map();
const invoiceByRNumber = new Map();
for (const r of invoiceRows) {
  const tid = safeGet(r, 'ticketId');
  const inv = safeGet(r, 'invoiceId');
  const jobName = safeGet(r, 'jobName');
  if (tid && inv) invoiceByTicketId.set(tid, inv);
  const rnum = extractRNumber(jobName) || extractRNumber(tid) || extractRNumber(safeGet(r, 'customerName'));
  if (rnum && inv && !invoiceByRNumber.has(rnum)) invoiceByRNumber.set(rnum, inv);
}

// Inventory_Products lookup by normalized name
const invProductByName = new Map();
for (const r of invProductRows) {
  const name = (safeGet(r, 'productName') || '').toLowerCase().trim();
  if (!name) continue;
  invProductByName.set(name, {
    productId: safeGet(r, 'productId') || safeGet(r, 'sku') || '',
    productName: safeGet(r, 'productName'),
    currentQty: parseFloat(safeGet(r, 'currentQty')) || 0,
  });
}

console.log(`Inventory_Products SKUs by name: ${invProductByName.size}`);
console.log(`Sample SKU names: ${[...invProductByName.keys()].slice(0, 4).join(' | ')}`);
console.log('');

// ---------- Pre-load deduction key set (lazy-creates the tab) ----------
const deductionKeys = await loadDeductionKeySet(doc);
console.log(`Existing deduction-log keys: ${deductionKeys.size}`);
console.log('');

// ---------- Process each target ticket ----------
let statusesUpdated = 0;
const deductionsWritten = [];
const deductionsSkippedDuplicate = [];
const skusMissingMatch = []; // {ticketId, productName}
const ticketAnomalies = []; // freeform notes

for (const ticketId of TARGET_TICKETS) {
  console.log(`---- ${ticketId} ----`);
  const row = ticketRows.find(r => safeGet(r, 'ticketId') === ticketId);
  if (!row) {
    console.log(`  [SKIP] Ticket row not found in Tickets tab`);
    ticketAnomalies.push(`${ticketId}: row not found`);
    continue;
  }

  const createdAt = safeGet(row, 'createdAt');
  const createdDate = createdAt.slice(0, 10);
  // Cutoff applies to deduction time (post-2026-05-15 only) — these
  // tickets are being delivered NOW (post-cutoff), so they pass even
  // when createdAt is 2026-05-14. The snapshot recon also gates on
  // deductedAt, not createdAt. Owner confirmed all 3 delivered this week.

  const currentStatus = safeGet(row, 'status');
  const completedAt = safeGet(row, 'completedAt');
  const existingNotes = safeGet(row, 'notes');
  const customer = safeGet(row, 'customerName');
  const jobName = safeGet(row, 'jobName');
  const rnum = extractRNumber(jobName) || extractRNumber(ticketId) || extractRNumber(customer);
  const invoiceId = invoiceByTicketId.get(ticketId) || (rnum ? invoiceByRNumber.get(rnum) : '') || '';

  console.log(`  Customer:    ${customer?.slice(0, 60)}`);
  console.log(`  R-number:    ${rnum}`);
  console.log(`  createdAt:   ${createdAt}`);
  console.log(`  completedAt: ${completedAt || '(empty)'}`);
  console.log(`  status:      ${currentStatus}`);
  console.log(`  invoiceId:   ${invoiceId || '(none)'}`);

  // ---------- Status update ----------
  if (STATUS_UPDATE_TICKETS.has(ticketId)) {
    if (TERMINAL_STATUSES.has(currentStatus)) {
      console.log(`  [STATUS] Already terminal (${currentStatus}) — skipping status update`);
    } else {
      const noteAppend = '; backfilled status 2026-05-21 per owner';
      const newNotes = existingNotes
        ? (existingNotes.includes('backfilled status 2026-05-21')
            ? existingNotes
            : existingNotes + noteAppend)
        : noteAppend.replace(/^;\s*/, '');

      safeSet(row, 'status', 'delivered');
      safeSet(row, 'completedAt', TODAY_ISO);
      safeSet(row, 'notes', newNotes);
      try {
        await row.save();
        statusesUpdated++;
        console.log(`  [STATUS] created -> delivered, completedAt=${TODAY_ISO}, notes appended`);
      } catch (err) {
        console.log(`  [STATUS-ERR] ${err.message?.slice(0, 200)}`);
        ticketAnomalies.push(`${ticketId}: status save failed — ${err.message?.slice(0, 100)}`);
      }
    }
  } else {
    console.log(`  [STATUS] Not in status-update set (Chuck Rogers already completed) — leaving as is`);
  }

  // ---------- Materials parse ----------
  // Try the standard column name first, then a couple of fallbacks.
  let materialsRaw = safeGet(row, 'materialsJson');
  let materialsCol = 'materialsJson';
  if (!materialsRaw) {
    for (const candidate of ['items', 'lines', 'materials']) {
      const v = safeGet(row, candidate);
      if (v) { materialsRaw = v; materialsCol = candidate; break; }
    }
  }
  let materials = [];
  if (materialsRaw) {
    try {
      materials = JSON.parse(materialsRaw);
      if (!Array.isArray(materials)) materials = [];
    } catch (err) {
      console.log(`  [MATERIALS-ERR] could not parse "${materialsCol}": ${err.message?.slice(0, 100)}`);
      ticketAnomalies.push(`${ticketId}: failed to parse materials from "${materialsCol}"`);
    }
  } else {
    console.log(`  [MATERIALS] no materialsJson/items/lines/materials column had data`);
    ticketAnomalies.push(`${ticketId}: no material lines column populated`);
  }
  console.log(`  Materials column used: ${materialsCol}; lines: ${materials.length}`);

  // Best deductedAt: prefer completedAt (already updated above for the
  // backfilled tickets), then createdAt.
  // Re-read the row's completedAt now that we may have updated it.
  const deductedAt = safeGet(row, 'completedAt') || createdAt || TODAY_ISO;

  // ---------- Aggregate material lines by productName ----------
  // Multiple line items can share the same product; helper keys on
  // (ticketId, productName) so we MUST sum first, not skip-as-dup.
  const byName = new Map(); // lower-cased name -> { displayName, qty }
  for (const m of materials) {
    const lineName = (m.productName || '').trim();
    const lineQty = Math.abs(parseFloat(m.quantity) || 0);
    if (!lineName || lineQty <= 0) {
      console.log(`    [LINE-SKIP] missing name or qty: ${JSON.stringify(m).slice(0, 120)}`);
      continue;
    }
    const k = lineName.toLowerCase();
    const cur = byName.get(k) || { displayName: lineName, qty: 0 };
    cur.qty += lineQty;
    byName.set(k, cur);
  }

  // ---------- Deduction log entries (one per unique product) ----------
  for (const [, line] of byName) {
    const lineName = line.displayName;
    const lineQty = line.qty;

    // SKU match by case-insensitive exact name
    const match = invProductByName.get(lineName.toLowerCase());
    if (!match) {
      console.log(`    [NO-SKU] "${lineName}" — no Inventory_Products match, skipping`);
      skusMissingMatch.push({ ticketId, productName: lineName });
      continue;
    }

    // Idempotent dupe check (by ticketId + productName, matching helper's key)
    if (wasDeducted(deductionKeys, ticketId, match.productName)) {
      console.log(`    [DUP] already logged: ${match.productId} ${match.productName}`);
      deductionsSkippedDuplicate.push({ ticketId, productName: match.productName });
      continue;
    }

    const qtyAfter = match.currentQty;         // physical state — DO NOT change
    const qtyDelta = -lineQty;                 // negative = deduction
    const qtyBefore = qtyAfter + Math.abs(qtyDelta); // back-computed estimate

    const ok = await appendDeductionLog(doc, {
      ticketId,
      productName: match.productName,
      productId: match.productId,
      qtyBefore,
      qtyAfter,
      qtyDelta,
      invoiceId,
      deductedAt,
      source: 'backfill-2026-05-21-this-week-recovery',
    });

    if (ok) {
      // Update in-memory keys so subsequent iterations don't dup
      deductionKeys.add(`${ticketId.trim()}::${match.productName.toLowerCase().trim()}`);
      deductionsWritten.push({
        ticketId,
        productId: match.productId,
        productName: match.productName,
        qtyBefore, qtyAfter, qtyDelta,
        invoiceId, deductedAt,
      });
      console.log(`    [LOG] ${match.productId} ${match.productName} qty ${qtyBefore}->${qtyAfter} (delta ${qtyDelta})`);
    } else {
      console.log(`    [LOG-ERR] append failed for ${match.productName} (see prior console output)`);
      ticketAnomalies.push(`${ticketId}: deduction-log append failed for ${match.productName}`);
    }
  }

  console.log('');
}

// ---------- Summary ----------
console.log('========================================');
console.log('SUMMARY');
console.log('========================================');
console.log(`- Statuses updated: ${statusesUpdated}`);
console.log(`- Deduction log entries written: ${deductionsWritten.length} (${deductionsSkippedDuplicate.length} skipped as duplicates)`);
console.log(`- SKUs missing match: ${skusMissingMatch.length}`);
if (skusMissingMatch.length) {
  for (const s of skusMissingMatch) console.log(`    * ${s.ticketId}: "${s.productName}"`);
}
if (ticketAnomalies.length) {
  console.log(`- Anomalies (${ticketAnomalies.length}):`);
  for (const a of ticketAnomalies) console.log(`    * ${a}`);
}
console.log('');

// ---------- Verification re-read ----------
console.log('========================================');
console.log('VERIFICATION (re-read after writes)');
console.log('========================================');
const verifySheet = doc.sheetsByTitle['Tickets'];
const verifyRows = await verifySheet.getRows();
for (const ticketId of TARGET_TICKETS) {
  const r = verifyRows.find(rr => safeGet(rr, 'ticketId') === ticketId);
  if (!r) { console.log(`  ${ticketId}: NOT FOUND on re-read`); continue; }
  console.log(`  ${ticketId}: status=${safeGet(r, 'status')}  completedAt=${safeGet(r, 'completedAt')}  notes="${safeGet(r, 'notes')?.slice(0, 80)}"`);
}

// Re-read deduction log
const dedSheet = doc.sheetsByTitle['Inventory_Deductions_Log'];
if (dedSheet) {
  const dedRows = await dedSheet.getRows();
  const ours = dedRows.filter(r => {
    const src = safeGet(r, 'source');
    const tid = safeGet(r, 'ticketId');
    return src === 'backfill-2026-05-21-this-week-recovery' && TARGET_TICKETS.includes(tid);
  });
  console.log(`  Inventory_Deductions_Log rows from this run: ${ours.length}`);
  for (const r of ours) {
    console.log(`    * ${safeGet(r, 'ticketId')} | ${safeGet(r, 'productId')} ${safeGet(r, 'productName')} | delta ${safeGet(r, 'qtyDelta')} | inv ${safeGet(r, 'invoiceId')}`);
  }
} else {
  console.log('  Inventory_Deductions_Log: tab not found on re-read (unexpected)');
}

console.log('');
console.log('Done.');
