/**
 * reimport-deliveries-from-legacy-2026-05-21.mjs
 *
 * Owner directive (verbatim, 2026-05-21):
 *   "2 I WANT IT CORRECT. JUST MAKE SURE NOT TO SEND EMAILS,
 *    NOTIFICATIONS OR ALERTS FOR INVOICES DELIVERS OR JOB
 *    BREAKDOWNS DURING RE AUDIT"
 *
 * Option 2: void the bulk-backfilled delivery tickets in master Tickets
 * and re-import deliveries from the LEGACY inventory log with corrected
 * unit-of-measure (legacy Amount is the truth, in real units).
 *
 * Pure ticket math currently shows -2,207 units total across SKUs because
 * master Tickets has ~6x more unit-deductions than legacy supports. The
 * bulk historical-tickets backfill miscalculated UoM. Owner wants the math
 * correct, not skewed.
 *
 * CRITICAL safety:
 *   - DIRECT SHEET WRITES ONLY via google-spreadsheet.
 *   - NO emailService, NO riverBot, NO GroupMe, NO JN webhook handlers,
 *     NO ticket-creation route handlers, NO breakdown-service methods,
 *     NO materialOrderPipeline. Silent backfill.
 *   - DO NOT touch Invoices, Job_Breakdowns, CustomerBreakdowns,
 *     Inventory_Products.currentQty, or Delivery Schedule.
 *   - Idempotent.
 *
 * Phase A: void bulk-backfilled delivery tickets in master Tickets.
 * Phase B: re-import legacy deliveries (grouped by (R#, date)) as new
 *          delivery tickets in master Tickets.
 * Phase C: re-run pure ticket math and print before/after.
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
const BACKFILL_ERA_CUTOFF_ISO = '2026-05-13T00:00:00Z'; // anything older = bulk-backfill era
const HISTORICAL_BACKFILL_REGEX = /historical[-_]?backfill/i;
const KEEP_LIST = new Set(['TKT-R-10997', 'TKT-R-10923', 'TKT-R-11223']);
const VOID_NOTE_SUFFIX = `VOIDED ${TODAY} — replaced by legacy-log re-import (UoM-corrected) per owner re-audit`;
const REIMPORT_CREATED_BY = 'legacy-delivery-reimport-2026-05-21';
const REIMPORT_CREATED_BY_NAME = 'Legacy Delivery Re-Import';

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
// PHASE 0 — Load master sheet and inspect columns
// ============================================================
log('=== PHASE 0: load master sheet + Inventory_Products + Tickets ===');
const masterDoc = new GoogleSpreadsheet(MASTER_SHEET_ID, auth);
await masterDoc.loadInfo();
log(`Master doc: "${masterDoc.title}"`);

const ticketsTab = masterDoc.sheetsByTitle['Tickets'];
if (!ticketsTab) throw new Error("Master 'Tickets' tab not found");
await ticketsTab.loadHeaderRow();
const ticketsHeaders = ticketsTab.headerValues;
const ticketsHeaderSet = new Set(ticketsHeaders);
log(`Tickets headers: ${JSON.stringify(ticketsHeaders)}`);

const invProductsTab = masterDoc.sheetsByTitle['Inventory_Products'];
if (!invProductsTab) throw new Error("Master 'Inventory_Products' tab not found");
const invProductRows = await invProductsTab.getRows();
const productByLegacyId = {};
const productById = {};
const skuOrder = [];
for (const r of invProductRows) {
  const o = r.toObject();
  const legacyId = (o.legacyId || '').toString().trim();
  const productId = (o.productId || '').trim();
  const productName = (o.productName || '').toString();
  if (!productId) continue;
  const rec = { productId, legacyId, productName, currentQty: parseNum(o.currentQty) };
  if (legacyId) productByLegacyId[legacyId] = rec;
  productById[productId] = rec;
  skuOrder.push(rec);
}
log(`Inventory_Products rows: ${invProductRows.length}, with legacyId: ${Object.keys(productByLegacyId).length}`);

// Detect column variants (match existing convention)
const col = {
  ticketId: ticketsHeaderSet.has('ticketId') ? 'ticketId' : null,
  type: ticketsHeaderSet.has('type') ? 'type'
    : ticketsHeaderSet.has('ticketType') ? 'ticketType' : null,
  status: ticketsHeaderSet.has('status') ? 'status' : null,
  createdAt: ticketsHeaderSet.has('createdAt') ? 'createdAt' : null,
  completedAt: ticketsHeaderSet.has('completedAt') ? 'completedAt' : null,
  customer: ticketsHeaderSet.has('customer') ? 'customer'
    : ticketsHeaderSet.has('customerName') ? 'customerName' : null,
  address: ticketsHeaderSet.has('address') ? 'address'
    : ticketsHeaderSet.has('jobAddress') ? 'jobAddress' : null,
  rNumber: ticketsHeaderSet.has('rNumber') ? 'rNumber'
    : ticketsHeaderSet.has('R#') ? 'R#'
    : ticketsHeaderSet.has('referenceNumber') ? 'referenceNumber' : null,
  materials: ticketsHeaderSet.has('materialsJson') ? 'materialsJson'
    : ticketsHeaderSet.has('lineItems') ? 'lineItems'
    : ticketsHeaderSet.has('items') ? 'items' : null,
  createdBy: ticketsHeaderSet.has('createdBy') ? 'createdBy' : null,
  createdByName: ticketsHeaderSet.has('createdByName') ? 'createdByName' : null,
  notes: ticketsHeaderSet.has('notes') ? 'notes' : null,
  invoiceId: ticketsHeaderSet.has('invoiceId') ? 'invoiceId' : null,
};
log(`Detected ticket columns: ${JSON.stringify(col)}`);

const ticketRows = await ticketsTab.getRows();
log(`Tickets row count: ${ticketRows.length}`);
const ticketsByTicketId = {};
for (const r of ticketRows) {
  const id = (r.get('ticketId') || '').toString().trim();
  if (id) ticketsByTicketId[id] = r;
}

// ============================================================
// PHASE A-PRE — Heal: un-void any TKT-LEGACY-* tickets accidentally voided
// by an earlier run-pass of this script (before the LEGACY exclusion rule
// existed). Safe no-op if none are voided. Idempotent.
// ============================================================
log('');
log('=== PHASE A-PRE: heal accidentally-voided TKT-LEGACY-* tickets ===');
const anomalies = [];
let healed = 0;
for (const r of ticketRows) {
  const ticketId = (r.get('ticketId') || '').toString().trim();
  if (!/^TKT-LEGACY-/.test(ticketId)) continue;
  const status = ((col.status ? r.get(col.status) : '') || '').toString().toLowerCase().trim();
  if (status !== 'voided') continue;
  // Verify it was voided by THIS audit (note suffix present) and that the
  // createdBy is our reimport. Otherwise leave it — it might be a real void.
  const createdBy = ((col.createdBy ? r.get(col.createdBy) : '') || '').toString();
  const notes = (col.notes ? r.get(col.notes) : '') || '';
  if (createdBy !== REIMPORT_CREATED_BY) continue;
  if (!notes.includes(VOID_NOTE_SUFFIX)) continue;
  if (col.status) r.set(col.status, 'completed');
  if (col.notes) r.set(col.notes, notes.replace(`; ${VOID_NOTE_SUFFIX}`, '').replace(VOID_NOTE_SUFFIX, ''));
  let healSaved = false;
  for (let attempt = 1; attempt <= 4 && !healSaved; attempt++) {
    try {
      await r.save();
      healSaved = true;
    } catch (err) {
      const msg = (err.message || '').slice(0, 120);
      if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
        await new Promise((res) => setTimeout(res, 8000 * attempt));
      } else {
        anomalies.push({ ticketId, reason: `heal-unvoid failed: ${msg}` });
        break;
      }
    }
  }
  if (healSaved) {
    healed++;
    if (healed % 25 === 0) log(`  healed ${healed}…`);
  } else if (!anomalies.find((a) => a.ticketId === ticketId)) {
    anomalies.push({ ticketId, reason: 'heal-unvoid failed: 429 after retries' });
  }
  await new Promise((res) => setTimeout(res, 1100));
}
log(`Heal pass: ${healed} TKT-LEGACY-* tickets restored from voided to completed.`);

// ============================================================
// PHASE A — Void bulk-backfilled delivery tickets
// ============================================================
log('');
log('=== PHASE A: void bulk-backfilled delivery tickets ===');
log(`Rules: type=delivery (case-insensitive) AND status!=voided AND`);
log(`       (createdBy ~= /historical[-_]?backfill/i OR createdAt < ${BACKFILL_ERA_CUTOFF_ISO})`);
log(`       AND ticketId NOT IN [${[...KEEP_LIST].join(', ')}]`);

let aVoided = 0;
let aAlreadyVoided = 0;
let aKeepList = 0;
let aNotDelivery = 0;
let aTooNewOrNotBackfill = 0;

const voidedTicketIds = [];

for (const r of ticketRows) {
  const ticketId = (r.get('ticketId') || '').toString().trim();
  const type = ((col.type ? r.get(col.type) : '') || '').toString().toLowerCase().trim();
  if (type !== 'delivery') { aNotDelivery++; continue; }

  const status = ((col.status ? r.get(col.status) : '') || '').toString().toLowerCase().trim();
  if (status === 'voided') { aAlreadyVoided++; continue; }

  if (KEEP_LIST.has(ticketId)) { aKeepList++; continue; }

  const createdBy = ((col.createdBy ? r.get(col.createdBy) : '') || '').toString();
  const createdAtRaw = ((col.createdAt ? r.get(col.createdAt) : '') || '').toString().trim();

  // CRITICAL: never void the legacy-reimport tickets we just created in Phase B.
  // They carry old createdAt values (legacy dates) so the cutoff check would
  // otherwise sweep them up. They also live under TKT-LEGACY-* IDs.
  if (createdBy === REIMPORT_CREATED_BY) continue;
  if (/^TKT-LEGACY-/.test(ticketId)) continue;

  const isHistoricalBackfill = HISTORICAL_BACKFILL_REGEX.test(createdBy);
  let isBeforeCutoff = false;
  if (createdAtRaw) {
    // Try Date parse
    const d = new Date(createdAtRaw);
    if (!isNaN(d.getTime())) {
      if (d.toISOString() < BACKFILL_ERA_CUTOFF_ISO) isBeforeCutoff = true;
    } else if (createdAtRaw < BACKFILL_ERA_CUTOFF_ISO) {
      // string-compare fallback for ISO-like strings
      isBeforeCutoff = true;
    }
  } else {
    // No createdAt — treat as historical (safer; this-week tickets always have createdAt)
    isBeforeCutoff = true;
    anomalies.push({ ticketId, reason: 'no_createdAt — treating as historical' });
  }

  if (!isHistoricalBackfill && !isBeforeCutoff) {
    aTooNewOrNotBackfill++;
    continue;
  }

  // Void this row
  const existingNotes = (col.notes ? r.get(col.notes) : '') || '';
  const newNotes = existingNotes
    ? `${existingNotes}; ${VOID_NOTE_SUFFIX}`
    : VOID_NOTE_SUFFIX;
  if (col.status) r.set(col.status, 'voided');
  if (col.notes) r.set(col.notes, newNotes);

  // Throttle + retry to stay under 60 writes/min/user
  let saved = false;
  for (let attempt = 1; attempt <= 4 && !saved; attempt++) {
    try {
      await r.save();
      saved = true;
    } catch (err) {
      const msg = (err.message || '').slice(0, 120);
      if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
        // Exponential backoff
        await new Promise((res) => setTimeout(res, 8000 * attempt));
      } else {
        anomalies.push({ ticketId, reason: `save failed: ${msg}` });
        break;
      }
    }
  }
  if (saved) {
    aVoided++;
    voidedTicketIds.push(ticketId);
    if (aVoided % 25 === 0) log(`  voided ${aVoided}…`);
  } else if (!anomalies.find((a) => a.ticketId === ticketId)) {
    anomalies.push({ ticketId, reason: 'save failed: 429 after retries' });
  }
  // Steady pacing: ~1.1s between writes = 54/min, safely under quota
  await new Promise((res) => setTimeout(res, 1100));
}

log('');
log(`Phase A results:`);
log(`  Voided: ${aVoided}`);
log(`  Already voided (skipped): ${aAlreadyVoided}`);
log(`  In keep-list (skipped): ${aKeepList}`);
log(`  Not delivery (skipped): ${aNotDelivery}`);
log(`  Delivery but too new / not backfill (skipped): ${aTooNewOrNotBackfill}`);
log(`  Anomalies: ${anomalies.length}`);
for (const a of anomalies.slice(0, 10)) log(`    - ${a.ticketId}: ${a.reason}`);

// ============================================================
// PHASE B — Re-import deliveries from legacy log
// ============================================================
log('');
log('=== PHASE B: re-import deliveries from legacy inventory log ===');

const legacyDoc = new GoogleSpreadsheet(LEGACY_SHEET_ID, auth);
await legacyDoc.loadInfo();
log(`Legacy doc: "${legacyDoc.title}"`);

const legacyInv = legacyDoc.sheetsByTitle['Inventory'];
if (!legacyInv) throw new Error("Legacy 'Inventory' tab (sheet title 'Inventory' under doc 'new inventory') not found");
await legacyInv.loadHeaderRow();
log(`Legacy Inventory headers: ${JSON.stringify(legacyInv.headerValues)}`);
const legacyRows = await legacyInv.getRows();
log(`Legacy Inventory rows: ${legacyRows.length}`);

// Filter to deliveries: Amount < 0
const deliveryTx = [];
for (const r of legacyRows) {
  const o = r.toObject();
  const amount = parseNum(o['Amount']);
  if (amount >= 0) continue; // deliveries are negative
  const itemId = (o['Item ID'] || '').toString().trim();
  if (!itemId) continue;
  const date = parseLegacyDateTime(o['DateTime']);
  if (!date) continue;
  const rNum = (o['R#'] || '').toString().trim();
  deliveryTx.push({ date, itemId, qty: Math.abs(amount), rNum });
}
log(`Legacy delivery rows: ${deliveryTx.length}`);

// Group by (R#, date). Empty R# stays grouped per-date with a sequence disambig.
const groupKeyToRows = new Map(); // key -> { rNum, date, rows: [] }
for (const t of deliveryTx) {
  const key = t.rNum ? `R:${t.rNum}|D:${t.date}` : `NOR:${t.date}`;
  if (!groupKeyToRows.has(key)) groupKeyToRows.set(key, { rNum: t.rNum, date: t.date, rows: [] });
  groupKeyToRows.get(key).rows.push(t);
}

// For empty-R# groups, we have key='NOR:<date>' — only ONE empty-R# group per date.
// Build deterministic ticket ids.
const empByDateSeq = {}; // not needed since we only collapse empty-R# per date

const sortedGroups = [...groupKeyToRows.values()].sort((a, b) => {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return (a.rNum || '').localeCompare(b.rNum || '');
});
log(`Distinct (R#, date) delivery groups: ${sortedGroups.length}`);

// Generate ticketIds
function dateCompact(d) { return d.replace(/-/g, ''); }
for (const g of sortedGroups) {
  if (g.rNum) {
    g.ticketId = `TKT-LEGACY-${g.rNum}-${dateCompact(g.date)}`;
  } else {
    // empty R# — one group per date, seq 001
    g.ticketId = `TKT-LEGACY-NOR-${dateCompact(g.date)}-001`;
  }
}

// Idempotency: detect collisions inside the new ID set + existing in master.
const newIdSet = new Set();
for (const g of sortedGroups) {
  if (newIdSet.has(g.ticketId)) {
    // This shouldn't happen given grouping rules; surface anomaly.
    anomalies.push({ ticketId: g.ticketId, reason: 'duplicate ticketId after grouping — investigate' });
  }
  newIdSet.add(g.ticketId);
}

let bCreated = 0;
let bSkippedExisting = 0;
let bSkippedNoItems = 0;
const unmappable = new Map(); // itemId -> count
const createdTicketIds = [];

for (const g of sortedGroups) {
  if (ticketsByTicketId[g.ticketId]) {
    bSkippedExisting++;
    continue;
  }

  // Aggregate same legacyId within group (sum qty so the materialsJson is clean)
  const perItem = new Map();
  for (const r of g.rows) {
    const cur = perItem.get(r.itemId) || 0;
    perItem.set(r.itemId, cur + r.qty);
  }

  const items = [];
  let totalUnits = 0;
  for (const [itemId, qty] of perItem) {
    const prod = productByLegacyId[itemId];
    if (!prod) {
      unmappable.set(itemId, (unmappable.get(itemId) || 0) + 1);
      continue;
    }
    items.push({
      productId: prod.productId,
      legacyId: itemId,
      productName: prod.productName,
      qty,
      source: 'legacy-inventory-log',
    });
    totalUnits += qty;
  }

  if (items.length === 0) {
    bSkippedNoItems++;
    continue;
  }

  const isoDateTime = `${g.date}T12:00:00.000Z`;
  const row = {};
  if (col.ticketId) row[col.ticketId] = g.ticketId;
  if (col.type) row[col.type] = 'delivery';
  if (col.status) row[col.status] = 'completed';
  if (col.createdAt) row[col.createdAt] = isoDateTime;
  if (col.completedAt) row[col.completedAt] = isoDateTime;
  if (col.rNumber) row[col.rNumber] = g.rNum || '';
  if (col.customer) row[col.customer] = '';
  if (col.address) row[col.address] = '';
  if (col.notes) {
    row[col.notes] = `Imported from legacy inventory log 2026-05-21 — UoM-corrected re-audit. ${items.length} line items, total ${totalUnits} units. Source: LEGACY_INVENTORY_SHEETS_ID 'new inventory' Inventory tab, R#=${g.rNum || '(none)'} on ${g.date}.`;
  }
  if (col.materials) row[col.materials] = JSON.stringify(items);
  if (col.createdBy) row[col.createdBy] = REIMPORT_CREATED_BY;
  if (col.createdByName) row[col.createdByName] = REIMPORT_CREATED_BY_NAME;
  // DO NOT set invoiceId. These tickets are intentionally orphaned from invoices.

  let added = false;
  for (let attempt = 1; attempt <= 4 && !added; attempt++) {
    try {
      await ticketsTab.addRow(row);
      added = true;
    } catch (err) {
      const msg = (err.message || '').slice(0, 120);
      if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
        await new Promise((res) => setTimeout(res, 8000 * attempt));
      } else {
        anomalies.push({ ticketId: g.ticketId, reason: `addRow failed: ${msg}` });
        break;
      }
    }
  }
  if (added) {
    bCreated++;
    createdTicketIds.push(g.ticketId);
    if (bCreated % 25 === 0) log(`  created ${bCreated}…`);
  } else if (!anomalies.find((a) => a.ticketId === g.ticketId)) {
    anomalies.push({ ticketId: g.ticketId, reason: 'addRow failed: 429 after retries' });
  }
  await new Promise((res) => setTimeout(res, 1100));
}

log('');
log(`Phase B results:`);
log(`  Distinct (R#, date) groups: ${sortedGroups.length}`);
log(`  Created: ${bCreated}`);
log(`  Skipped (already existed by ticketId): ${bSkippedExisting}`);
log(`  Skipped (no mappable items): ${bSkippedNoItems}`);
if (unmappable.size > 0) {
  log(`  Unmappable legacy item IDs (count of group occurrences):`);
  for (const [k, v] of unmappable) log(`    ${k}: ${v} group(s)`);
} else {
  log(`  Unmappable legacy item IDs: 0`);
}

// ============================================================
// PHASE C — Re-run the pure ticket math
// ============================================================
log('');
log('=== PHASE C: re-run pure ticket math ===');

// Reload tickets fresh after writes
const freshTicketsTab = masterDoc.sheetsByTitle['Tickets'];
const freshTicketRows = await freshTicketsTab.getRows();
log(`Re-read Tickets row count: ${freshTicketRows.length}`);

function parseItems(row) {
  for (const c of ['materialsJson', 'items', 'lines', 'lineItems', 'materials']) {
    const raw = row.get(c);
    if (!raw) continue;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

// Build name->productId lookup for resolution fallback
function resolveProductId(line) {
  if (!line) return null;
  if (line.productId && productById[line.productId]) return line.productId;
  if (line.productId && productByLegacyId[line.productId]) return productByLegacyId[line.productId].productId;
  if (line.legacyId && productByLegacyId[line.legacyId]) return productByLegacyId[line.legacyId].productId;
  if (line.productName) {
    const want = line.productName.toLowerCase().trim();
    for (const p of Object.values(productById)) {
      if ((p.productName || '').toLowerCase().trim() === want) return p.productId;
    }
  }
  return null;
}

const totals = {};
for (const sku of skuOrder) {
  totals[sku.productId] = { restock: 0, delivery: 0, return: 0, tc: { restock: 0, delivery: 0, return: 0 } };
}
const skipped = { voided: 0, otherStatus: 0, otherType: 0, noItems: 0, unmappedSku: new Map() };

for (const r of freshTicketRows) {
  const type = ((col.type ? r.get(col.type) : '') || '').toString().toLowerCase().trim();
  const status = ((col.status ? r.get(col.status) : '') || '').toString().toLowerCase().trim();
  if (status === 'voided') { skipped.voided++; continue; }
  if (!['restock', 'delivery', 'return'].includes(type)) { skipped.otherType++; continue; }
  const items = parseItems(r);
  if (items.length === 0) { skipped.noItems++; continue; }
  for (const it of items) {
    const pid = resolveProductId(it);
    if (!pid) {
      const label = it.productName || it.productId || it.legacyId || '?';
      skipped.unmappedSku.set(label, (skipped.unmappedSku.get(label) || 0) + 1);
      continue;
    }
    const qty = Number(it.qty ?? it.quantity ?? it.units ?? 0);
    if (!qty || isNaN(qty)) continue;
    if (type === 'restock') { totals[pid].restock += Math.abs(qty); totals[pid].tc.restock++; }
    else if (type === 'delivery') { totals[pid].delivery += Math.abs(qty); totals[pid].tc.delivery++; }
    else if (type === 'return') { totals[pid].return += Math.abs(qty); totals[pid].tc.return++; }
  }
}

// Load "was" values from the prior pure-math json (for before/after comparison)
const priorPath = path.join(process.cwd(), 'scripts', 'inventory-math-ticket-pure-2026-05-21.json');
const priorByPid = {};
try {
  const prior = JSON.parse(fs.readFileSync(priorPath, 'utf8'));
  for (const r of prior.perSku) priorByPid[r.productId] = r.qty;
} catch {}

log('');
log('Pure ticket math AFTER re-audit (master Tickets only, voided excluded):');
log('Formula: restocks - deliveries + returns = qty');
log('');
log('SKU       Name                              Restock      Delivery     Return       = QTY (new)    QTY (was)');
log('-------------------------------------------------------------------------------------------------------------');
let sumR = 0, sumD = 0, sumRet = 0, sumQNew = 0, sumQWas = 0;
const finalPerSku = [];
for (const sku of skuOrder) {
  const t = totals[sku.productId];
  const qty = t.restock - t.delivery + t.return;
  const was = priorByPid[sku.productId] ?? null;
  sumR += t.restock; sumD += t.delivery; sumRet += t.return; sumQNew += qty;
  if (was !== null) sumQWas += was;
  const nameTrim = (sku.productName || '').padEnd(32, ' ').slice(0, 32);
  log(
    `${sku.productId.padEnd(10, ' ')}${nameTrim} ${String(t.restock).padStart(10, ' ')}   ${String(t.delivery).padStart(10, ' ')}   ${String(t.return).padStart(10, ' ')}   ${String(qty).padStart(10, ' ')}   ${String(was ?? 'n/a').padStart(8, ' ')}`
  );
  finalPerSku.push({
    productId: sku.productId, legacyId: sku.legacyId, productName: sku.productName,
    restocks: t.restock, deliveries: t.delivery, returns: t.return, qty,
    qtyWas: was, ticketCounts: t.tc,
  });
}
log('-------------------------------------------------------------------------------------------------------------');
log(`TOTAL                                       ${String(sumR).padStart(10, ' ')}   ${String(sumD).padStart(10, ' ')}   ${String(sumRet).padStart(10, ' ')}   ${String(sumQNew).padStart(10, ' ')}   ${String(sumQWas).padStart(8, ' ')}`);
log('');
log(`Excluded: voided=${skipped.voided}, otherType=${skipped.otherType}, noItems=${skipped.noItems}, unmappedSkuLines=${skipped.unmappedSku.size}`);
if (skipped.unmappedSku.size > 0) {
  for (const [k, v] of skipped.unmappedSku) log(`    ${k}: ${v}`);
}

// ============================================================
// PHASE D — Spot-check 2 created + 2 voided
// ============================================================
log('');
log('=== PHASE D: spot-check (re-read 2 new + 2 voided) ===');
const freshById = {};
for (const r of freshTicketRows) {
  const id = (r.get('ticketId') || '').toString().trim();
  if (id) freshById[id] = r;
}
const pickedNew = [];
const poolNew = [...createdTicketIds];
for (let i = 0; i < 2 && poolNew.length; i++) {
  const idx = Math.floor(Math.random() * poolNew.length);
  pickedNew.push(poolNew.splice(idx, 1)[0]);
}
const pickedVoided = [];
const poolV = [...voidedTicketIds];
for (let i = 0; i < 2 && poolV.length; i++) {
  const idx = Math.floor(Math.random() * poolV.length);
  pickedVoided.push(poolV.splice(idx, 1)[0]);
}
const spotCheck = { created: [], voided: [] };

for (const id of pickedNew) {
  const r = freshById[id];
  if (!r) { spotCheck.created.push({ ticketId: id, error: 'not_found_on_reread' }); log(`  NEW ${id}: NOT FOUND on re-read`); continue; }
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
  spotCheck.created.push(snap);
  log(`  NEW ${id}:`);
  log(`    type=${snap.type}  status=${snap.status}  createdAt=${snap.createdAt}`);
  log(`    createdBy=${snap.createdBy}`);
  if (snap.materialsJson) {
    let parsed;
    try { parsed = JSON.parse(snap.materialsJson); } catch {}
    log(`    materialsJson: ${parsed ? `${parsed.length} items, ${parsed.reduce((a, b) => a + (b.qty || 0), 0)} total units` : '(unparseable)'}`);
    if (parsed && parsed[0]) log(`    first item: ${JSON.stringify(parsed[0])}`);
  }
  log(`    notes: ${(snap.notes || '').slice(0, 160)}`);
}

for (const id of pickedVoided) {
  const r = freshById[id];
  if (!r) { spotCheck.voided.push({ ticketId: id, error: 'not_found_on_reread' }); log(`  VOIDED ${id}: NOT FOUND on re-read`); continue; }
  const snap = {
    ticketId: id,
    type: col.type ? r.get(col.type) : null,
    status: col.status ? r.get(col.status) : null,
    notes: col.notes ? r.get(col.notes) : null,
  };
  spotCheck.voided.push(snap);
  log(`  VOIDED ${id}: status=${snap.status} type=${snap.type}`);
  log(`    notes tail: ${(snap.notes || '').slice(-220)}`);
}

// ============================================================
// PHASE E — Write deliverables
// ============================================================
const out = {
  generatedAt: new Date().toISOString(),
  today: TODAY,
  source: 'scripts/reimport-deliveries-from-legacy-2026-05-21.mjs',
  inputs: {
    legacySheetId: LEGACY_SHEET_ID,
    masterSheetId: MASTER_SHEET_ID,
    backfillEraCutoffIso: BACKFILL_ERA_CUTOFF_ISO,
    keepList: [...KEEP_LIST],
  },
  phaseA: {
    voided: aVoided,
    alreadyVoidedSkipped: aAlreadyVoided,
    keepListSkipped: aKeepList,
    notDeliverySkipped: aNotDelivery,
    tooNewOrNotBackfillSkipped: aTooNewOrNotBackfill,
    voidedTicketIdsSample: voidedTicketIds.slice(0, 10),
  },
  phaseB: {
    legacyDeliveryRows: deliveryTx.length,
    distinctGroups: sortedGroups.length,
    created: bCreated,
    skippedExisting: bSkippedExisting,
    skippedNoItems: bSkippedNoItems,
    unmappableLegacyIds: Object.fromEntries(unmappable),
    createdTicketIdsSample: createdTicketIds.slice(0, 10),
  },
  phaseC: {
    perSku: finalPerSku,
    totals: { restock: sumR, delivery: sumD, return: sumRet, qtyNew: sumQNew, qtyWas: sumQWas },
    excluded: {
      voidedTickets: skipped.voided,
      otherTypeTickets: skipped.otherType,
      ticketsWithNoItems: skipped.noItems,
      unmappedSkuLines: Object.fromEntries(skipped.unmappedSku),
    },
  },
  spotCheck,
  anomalies,
  ticketsTouchedTotal: aVoided + bCreated,
};

const outJsonPath = path.join(process.cwd(), 'scripts', 'reimport-deliveries-from-legacy-2026-05-21.json');
const outLogPath = path.join(process.cwd(), 'scripts', 'reimport-deliveries-from-legacy-2026-05-21.log');
fs.writeFileSync(outJsonPath, JSON.stringify(out, null, 2));
fs.writeFileSync(outLogPath, stdoutLines.join('\n'));
log('');
log(`Wrote: ${outJsonPath}`);
log(`Wrote: ${outLogPath}`);
log('');
log(`TOTAL TICKETS TOUCHED: ${aVoided + bCreated}  (voided=${aVoided}, created=${bCreated})`);
log('DONE.');
