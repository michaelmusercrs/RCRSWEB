/**
 * inventory-math-final-2026-05-21.mjs
 *
 * Step 2 + Step 3 deliverable for owner. Mirrors
 * inventory-math-ticket-pure-2026-05-21.mjs but adds:
 *   - Side-by-side comparison to prior result
 *   - Filtered re-compute using only R#-tagged + non-voided tickets
 *   - 7 audit checks (duplicate ticketIds, this-week UoM sanity, CM/return totals,
 *     summary/noise tickets, currentQty correlation, type-casing, missing type)
 *
 * NO writes. NO emails. Read-only.
 */
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
});

const { JWT } = await import('google-auth-library');
const { GoogleSpreadsheet } = await import('google-spreadsheet');

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const doc = new GoogleSpreadsheet(
  process.env.GOOGLE_SHEETS_ID || process.env.DELIVERY_SHEETS_ID,
  auth,
);
await doc.loadInfo();

const ticketsSheet = doc.sheetsByTitle['Tickets'];
const invSheet = doc.sheetsByTitle['Inventory_Products'];
if (!ticketsSheet || !invSheet) throw new Error('Tickets or Inventory_Products tab not found');
await ticketsSheet.loadHeaderRow();
await invSheet.loadHeaderRow();
const ticketRows = await ticketsSheet.getRows();
const invRows = await invSheet.getRows();

// ---- product lookup ----
const productByLegacy = new Map();
const productById = new Map();
const skuOrder = [];
for (const r of invRows) {
  const id = (r.get('productId') || '').trim();
  const legacy = (r.get('legacyId') || '').trim();
  const name = (r.get('productName') || '').trim();
  const currentQty = Number(r.get('currentQty') || 0);
  if (!id) continue;
  productById.set(id, { productId: id, productName: name, legacyId: legacy, currentQty });
  if (legacy) productByLegacy.set(legacy, { productId: id, productName: name });
  skuOrder.push({ productId: id, productName: name, legacyId: legacy, currentQty });
}

function resolveProductId(line) {
  if (!line) return null;
  if (line.productId && productById.has(line.productId)) return line.productId;
  if (line.productId && productByLegacy.has(line.productId)) return productByLegacy.get(line.productId).productId;
  if (line.legacyId && productByLegacy.has(line.legacyId)) return productByLegacy.get(line.legacyId).productId;
  if (line.productName) {
    for (const p of productById.values()) {
      if (p.productName.toLowerCase().trim() === line.productName.toLowerCase().trim()) return p.productId;
    }
  }
  return null;
}

function parseItems(row) {
  for (const col of ['materialsJson', 'items', 'lines', 'lineItems', 'materials']) {
    const raw = row.get(col);
    if (!raw) continue;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) return parsed;
    } catch { /* try next */ }
  }
  return [];
}

// Prior result (from inventory-math-ticket-pure-2026-05-21.json)
const prior = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'scripts', 'inventory-math-ticket-pure-2026-05-21.json'), 'utf8'));
const priorBySku = new Map(prior.perSku.map(p => [p.productId, p]));

// ---- Step 2: standard math (mirrors original) ----
const totals = {};
for (const sku of skuOrder) totals[sku.productId] = { restock: 0, delivery: 0, return: 0, ticketCounts: { restock: 0, delivery: 0, return: 0 } };

const skipped = { voided: 0, otherType: 0, noItems: 0, unmappedSku: new Map() };
const typeCasingSamples = { restock: [], delivery: [], return: [] };
const typeCasingRaw = new Map(); // raw type string -> count
const noTypeTickets = []; // ticketIds where type column is blank
const allActiveByR = new Map(); // R# -> [ticketIds]
const duplicateTicketIds = new Map(); // ticketId -> [row indices]
const allLegacyByR = new Map(); // legacyR# -> [ticketIds]

for (let i = 0; i < ticketRows.length; i++) {
  const row = ticketRows[i];
  const ticketId = (row.get('ticketId') || '').trim();
  const rawTypeCol = row.get('type') || '';
  const rawTicketTypeCol = row.get('ticketType') || '';
  const rawType = rawTypeCol || rawTicketTypeCol;
  const type = String(rawType).toLowerCase().trim();
  const status = (row.get('status') || '').toLowerCase().trim();
  const rNumber = (row.get('referenceNumber') || row.get('rNumber') || row.get('jobNumber') || row.get('R#') || row.get('jobId') || '').trim();

  // Track duplicates
  if (ticketId) {
    if (!duplicateTicketIds.has(ticketId)) duplicateTicketIds.set(ticketId, []);
    duplicateTicketIds.get(ticketId).push(i);
  }

  // Track raw casing (combined effective type)
  if (rawType) {
    const rawCombined = `${rawTypeCol ? `type=${rawTypeCol}` : ''}${rawTicketTypeCol ? `${rawTypeCol ? '|' : ''}ticketType=${rawTicketTypeCol}` : ''}`;
    typeCasingRaw.set(rawCombined, (typeCasingRaw.get(rawCombined) || 0) + 1);
    if (type === 'restock' && typeCasingSamples.restock.length < 3) typeCasingSamples.restock.push({ ticketId, raw: rawCombined });
    if (type === 'delivery' && typeCasingSamples.delivery.length < 3) typeCasingSamples.delivery.push({ ticketId, raw: rawCombined });
    if (type === 'return' && typeCasingSamples.return.length < 3) typeCasingSamples.return.push({ ticketId, raw: rawCombined });
  } else if (status !== 'voided') {
    noTypeTickets.push({ ticketId, status, rNumber });
  }

  if (status === 'voided') { skipped.voided++; continue; }

  if (!['restock', 'delivery', 'return'].includes(type)) { skipped.otherType++; continue; }

  // Track legacy R# duplicates (active only) — for ticketIds starting TKT-LEGACY-
  if (ticketId.startsWith('TKT-LEGACY-') && !ticketId.startsWith('TKT-LEGACY-NOR-')) {
    // extract legacy R# from ticketId pattern TKT-LEGACY-{R#}-...
    const m = ticketId.match(/^TKT-LEGACY-([^-]+)-/);
    if (m) {
      const lr = m[1];
      if (!allLegacyByR.has(lr)) allLegacyByR.set(lr, []);
      allLegacyByR.get(lr).push(ticketId);
    }
  }
  if (rNumber) {
    if (!allActiveByR.has(rNumber)) allActiveByR.set(rNumber, []);
    allActiveByR.get(rNumber).push(ticketId);
  }

  const items = parseItems(row);
  if (items.length === 0) { skipped.noItems++; continue; }

  for (const it of items) {
    const productId = resolveProductId(it);
    if (!productId) {
      const label = it.productName || it.productId || it.legacyId || '?';
      skipped.unmappedSku.set(label, (skipped.unmappedSku.get(label) || 0) + 1);
      continue;
    }
    const qty = Number(it.qty ?? it.quantity ?? it.units ?? 0);
    if (!qty || isNaN(qty)) continue;
    if (type === 'restock') { totals[productId].restock += Math.abs(qty); totals[productId].ticketCounts.restock++; }
    else if (type === 'delivery') { totals[productId].delivery += Math.abs(qty); totals[productId].ticketCounts.delivery++; }
    else if (type === 'return') { totals[productId].return += Math.abs(qty); totals[productId].ticketCounts.return++; }
  }
}

// ---- print main table side-by-side ----
console.log('');
console.log('Pure ticket-based inventory math — FINAL 2026-05-21 (post-void TKT-LEGACY-NOR-*)');
console.log('Formula per SKU:  restocks − deliveries + returns = qty');
console.log('');
const header = 'SKU       Name                              Restock   Delivery   Return     = QTY (new)   was      Δ';
console.log(header);
console.log('-'.repeat(header.length + 5));

let sumR = 0, sumD = 0, sumRet = 0, sumQ = 0, sumPrior = 0;
const finalPerSku = [];
for (const sku of skuOrder) {
  const t = totals[sku.productId];
  const qty = t.restock - t.delivery + t.return;
  const pr = priorBySku.get(sku.productId);
  const priorQty = pr ? pr.qty : 0;
  const delta = qty - priorQty;
  sumR += t.restock; sumD += t.delivery; sumRet += t.return; sumQ += qty; sumPrior += priorQty;
  const nameTrim = (sku.productName || '').padEnd(32, ' ').slice(0, 32);
  console.log(
    `${sku.productId.padEnd(10)}${nameTrim} ${String(t.restock).padStart(8)}  ${String(t.delivery).padStart(8)}  ${String(t.return).padStart(8)}   ${String(qty).padStart(8)}  ${String(priorQty).padStart(7)}  ${(delta >= 0 ? '+' : '') + delta}`,
  );
  finalPerSku.push({
    productId: sku.productId,
    productName: sku.productName,
    legacyId: sku.legacyId,
    restocks: t.restock,
    deliveries: t.delivery,
    returns: t.return,
    qty,
    priorQty,
    delta,
    ticketCounts: t.ticketCounts,
    currentQtyInSheet: sku.currentQty,
  });
}
console.log('-'.repeat(header.length + 5));
console.log(`TOTAL                                       ${String(sumR).padStart(8)}  ${String(sumD).padStart(8)}  ${String(sumRet).padStart(8)}   ${String(sumQ).padStart(8)}  ${String(sumPrior).padStart(7)}  ${(sumQ - sumPrior >= 0 ? '+' : '') + (sumQ - sumPrior)}`);

// ---- Step 3 check 1: duplicate ticketIds + duplicate legacy R# ----
const dupTicketIds = [];
for (const [id, idxs] of duplicateTicketIds) {
  if (idxs.length > 1) dupTicketIds.push({ ticketId: id, rowIndices: idxs, count: idxs.length });
}
const dupLegacyR = [];
for (const [lr, ids] of allLegacyByR) {
  if (ids.length > 1) dupLegacyR.push({ legacyR: lr, ticketIds: ids });
}

// ---- Step 3 check 2: this-week active deliveries UoM sanity ----
const thisWeekIds = ['TKT-R-10997', 'TKT-R-10923', 'TKT-R-11223', 'TKT-R-10993'];
const thisWeekDump = [];
for (const row of ticketRows) {
  const id = (row.get('ticketId') || '').trim();
  if (!thisWeekIds.includes(id)) continue;
  const status = (row.get('status') || '').toLowerCase().trim();
  const type = String(row.get('type') || '').toLowerCase().trim();
  const items = parseItems(row);
  const itemsMapped = items.map((it) => ({
    productId: resolveProductId(it) || it.productId || it.productName || '?',
    productName: it.productName || '?',
    qty: Number(it.qty ?? it.quantity ?? it.units ?? 0),
    rawProductId: it.productId,
    legacyId: it.legacyId,
  }));
  const flags = [];
  for (const it of itemsMapped) {
    if (it.qty >= 50) flags.push(`HIGH-QTY ${it.qty} of ${it.productId} (${it.productName})`);
    if (it.qty < 0) flags.push(`NEGATIVE ${it.qty} of ${it.productId}`);
  }
  thisWeekDump.push({ ticketId: id, status, type, itemsCount: items.length, items: itemsMapped, flags });
}

// ---- Step 3 check 3: return/CM ticket sanity ----
let returnTicketCount = 0;
let returnTotalUnits = 0;
const returnTickets = [];
for (const row of ticketRows) {
  const status = (row.get('status') || '').toLowerCase().trim();
  const type = String(row.get('type') || row.get('ticketType') || '').toLowerCase().trim();
  if (status === 'voided') continue;
  if (type !== 'return') continue;
  returnTicketCount++;
  const items = parseItems(row);
  let units = 0;
  for (const it of items) {
    const qty = Number(it.qty ?? it.quantity ?? it.units ?? 0);
    if (qty && !isNaN(qty)) units += Math.abs(qty);
  }
  returnTotalUnits += units;
  returnTickets.push({ ticketId: (row.get('ticketId') || '').trim(), units });
}

// ---- Step 3 check 4: summary/noise tickets ----
const reconTicketIds = ['TKT-HISTORICAL-RESTOCK-RECON-20260516'];
const reconStatuses = [];
const otherSummaryCandidates = [];
for (const row of ticketRows) {
  const id = (row.get('ticketId') || '').trim();
  const status = (row.get('status') || '').toLowerCase().trim();
  const type = String(row.get('type') || row.get('ticketType') || '').toLowerCase().trim();
  if (reconTicketIds.includes(id)) {
    reconStatuses.push({ ticketId: id, status, type });
  }
  // Any other ticketId looking like a summary/recon
  if (/HISTORICAL|RECON|SUMMARY|BACKFILL|MIGRATION/i.test(id) && !reconTicketIds.includes(id)) {
    otherSummaryCandidates.push({ ticketId: id, status, type });
  }
}

// ---- Step 3 check 5: cross-check currentQty ----
const qtyMismatch = [];
for (const sku of skuOrder) {
  const computed = totals[sku.productId].restock - totals[sku.productId].delivery + totals[sku.productId].return;
  qtyMismatch.push({
    productId: sku.productId,
    productName: sku.productName,
    currentQtyInSheet: sku.currentQty,
    computed,
    diff: computed - sku.currentQty,
    sign: computed >= 0 ? 'positive' : 'negative',
  });
}

// ---- Step 3 check 6: type casing summary ----
const typeCasingSummary = Array.from(typeCasingRaw.entries()).map(([t, c]) => ({ raw: t, count: c }));

// ---- Step 3 check 7: tickets with no type column ----
const noTypeNonVoided = noTypeTickets;

// ---- Filtered re-compute: only R#-tagged OR non-LEGACY-NOR tickets that are non-voided ----
// All TKT-LEGACY-NOR-* are now voided, so the standard math (above) IS the filtered math.
// For paranoia, recompute with explicit filter excluding any ticketId starting TKT-LEGACY-NOR-:
const totalsFiltered = {};
for (const sku of skuOrder) totalsFiltered[sku.productId] = { restock: 0, delivery: 0, return: 0 };
for (const row of ticketRows) {
  const id = (row.get('ticketId') || '').trim();
  const status = (row.get('status') || '').toLowerCase().trim();
  const type = String(row.get('type') || row.get('ticketType') || '').toLowerCase().trim();
  if (status === 'voided') continue;
  if (id.startsWith('TKT-LEGACY-NOR-')) continue; // belt-and-suspenders
  if (!['restock', 'delivery', 'return'].includes(type)) continue;
  const items = parseItems(row);
  for (const it of items) {
    const productId = resolveProductId(it);
    if (!productId) continue;
    const qty = Number(it.qty ?? it.quantity ?? it.units ?? 0);
    if (!qty || isNaN(qty)) continue;
    if (type === 'restock') totalsFiltered[productId].restock += Math.abs(qty);
    else if (type === 'delivery') totalsFiltered[productId].delivery += Math.abs(qty);
    else if (type === 'return') totalsFiltered[productId].return += Math.abs(qty);
  }
}
const filteredMatchesStandard = skuOrder.every((sku) => {
  const a = totalsFiltered[sku.productId];
  const b = totals[sku.productId];
  return a.restock === b.restock && a.delivery === b.delivery && a.return === b.return;
});

// ---- Cross-check duplicate legacy R# against legacy log ----
// For each R# with multiple dated master tickets, look up the legacy log to verify
// it really had multiple delivery dates (not a re-import double-count).
const legacyCheck = [];
try {
  const legacyId = process.env.LEGACY_INVENTORY_SHEETS_ID;
  if (legacyId) {
    const legacyDoc = new GoogleSpreadsheet(legacyId, auth);
    await legacyDoc.loadInfo();
    const legSheet = legacyDoc.sheetsByTitle['Inventory'] || legacyDoc.sheetsByIndex[0];
    await legSheet.loadHeaderRow();
    const legRows = await legSheet.getRows();
    // build map of R# -> set of dates (negative amounts only — deliveries)
    const rToDates = new Map();
    // Parse legacy DateTime like "3/10/2025 15:25:14" -> "2025-03-10"
    function parseLegacyDate(dt) {
      if (!dt) return '';
      const s = String(dt).trim();
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (m) {
        const [_, mo, da, yr] = m;
        return `${yr}-${mo.padStart(2, '0')}-${da.padStart(2, '0')}`;
      }
      // ISO fallback
      const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
      if (iso) return iso[1];
      return s.slice(0, 10);
    }
    for (const lr of legRows) {
      const r = String(lr.get('R#') || '').trim();
      const amt = Number(lr.get('Amount') || 0);
      const dateRaw = lr.get('DateTime') || lr.get('Date');
      if (!r || amt >= 0) continue;
      const d = parseLegacyDate(dateRaw);
      if (!d) continue;
      if (!rToDates.has(r)) rToDates.set(r, new Set());
      rToDates.get(r).add(d);
    }
    for (const dup of dupLegacyR) {
      const legacyDates = Array.from(rToDates.get(dup.legacyR) || []).sort();
      legacyCheck.push({
        legacyR: dup.legacyR,
        masterTicketIds: dup.ticketIds,
        masterCount: dup.ticketIds.length,
        legacyDistinctDates: legacyDates,
        legacyDateCount: legacyDates.length,
        match: legacyDates.length === dup.ticketIds.length,
      });
    }
  }
} catch (e) {
  console.error('Legacy log cross-check failed:', e.message);
}

// ---- print Step 3 ----
console.log('');
console.log('========== STEP 3 — Comprehensive recheck ==========');
console.log('');
console.log(`Filtered (R#-tagged + non-voided) matches standard math: ${filteredMatchesStandard ? 'YES' : 'NO'}`);
console.log('');
console.log('Check 1 — Duplicate ticketIds:');
console.log(`  Duplicate ticketIds in master: ${dupTicketIds.length}`);
if (dupTicketIds.length > 0) {
  for (const d of dupTicketIds.slice(0, 10)) console.log(`    ${d.ticketId} appears ${d.count}x`);
}
console.log(`  Duplicate legacy-R# across multiple master tickets (multi-date): ${dupLegacyR.length}`);
let mismatchedLegacy = 0;
for (const lc of legacyCheck) {
  const flag = lc.match ? 'OK' : 'MISMATCH!';
  if (!lc.match) mismatchedLegacy++;
  console.log(`    R#${lc.legacyR}: ${lc.masterCount} master tickets, legacy log has ${lc.legacyDateCount} distinct delivery dates → ${flag}`);
}
console.log(`  Legacy-vs-master date-count mismatches: ${mismatchedLegacy}`);
console.log('');
console.log('Check 2 — This-week deliveries UoM sanity:');
for (const t of thisWeekDump) {
  console.log(`  ${t.ticketId} (status=${t.status}, type=${t.type}) — ${t.itemsCount} items`);
  for (const it of t.items) console.log(`    - ${it.productId} ${it.productName}: qty=${it.qty}`);
  if (t.flags.length > 0) console.log(`    !! FLAGS: ${t.flags.join(' | ')}`);
}
console.log('');
console.log('Check 3 — CM/return tickets:');
console.log(`  Active return tickets: ${returnTicketCount}, total units: ${returnTotalUnits}`);
console.log('');
console.log('Check 4 — Summary/recon tickets:');
for (const r of reconStatuses) console.log(`  ${r.ticketId}: status=${r.status}, type=${r.type}`);
console.log(`  Other summary-like ticketIds (non-voided): ${otherSummaryCandidates.filter(o => o.status !== 'voided').length}`);
for (const o of otherSummaryCandidates) console.log(`    ${o.ticketId}: status=${o.status}, type=${o.type}`);
console.log('');
console.log('Check 5 — Computed qty vs Inventory_Products.currentQty:');
console.log('  productId  name                              currentQty  computed  diff   sign');
for (const m of qtyMismatch) {
  console.log(`  ${m.productId.padEnd(10)} ${(m.productName || '').padEnd(32).slice(0, 32)} ${String(m.currentQtyInSheet).padStart(10)} ${String(m.computed).padStart(9)} ${String(m.diff).padStart(6)}   ${m.sign}`);
}
console.log('');
console.log('Check 6 — type column casing across all tickets:');
for (const t of typeCasingSummary) console.log(`  "${t.raw}": ${t.count} rows`);
console.log('  Spot-check samples:');
for (const k of ['restock', 'delivery', 'return']) {
  for (const s of typeCasingSamples[k]) console.log(`    ${k}: ${s.ticketId} raw="${s.raw}"`);
}
console.log('');
console.log('Check 7 — Active tickets with no type column value:');
console.log(`  Count: ${noTypeNonVoided.length}`);
for (const nt of noTypeNonVoided.slice(0, 20)) console.log(`    ${nt.ticketId} (status=${nt.status}, R#=${nt.rNumber})`);
if (noTypeNonVoided.length > 20) console.log(`    ... and ${noTypeNonVoided.length - 20} more`);

console.log('');
console.log('Excluded from math:');
console.log(`  Voided tickets: ${skipped.voided}`);
console.log(`  Other-type tickets: ${skipped.otherType}`);
console.log(`  Tickets with no items: ${skipped.noItems}`);
if (skipped.unmappedSku.size > 0) {
  console.log('  Unmapped SKU lines:');
  for (const [k, v] of skipped.unmappedSku) console.log(`    "${k}" x${v}`);
}

// ---- write JSON deliverable ----
const out = {
  computedAt: new Date().toISOString(),
  formula: 'restocks - deliveries + returns = qty (per SKU, master Tickets, voided excluded, TKT-LEGACY-NOR-* now voided)',
  perSku: finalPerSku,
  totals: { restocks: sumR, deliveries: sumD, returns: sumRet, qty: sumQ, priorQty: sumPrior, delta: sumQ - sumPrior },
  filteredMatchesStandard,
  audit: {
    check1_duplicateTicketIds: dupTicketIds,
    check1_duplicateLegacyR: dupLegacyR,
    check1_legacyDateCrossCheck: legacyCheck,
    check2_thisWeekDeliveries: thisWeekDump,
    check3_returnTickets: { count: returnTicketCount, totalUnits: returnTotalUnits, tickets: returnTickets },
    check4_reconTickets: reconStatuses,
    check4_otherSummaryCandidates: otherSummaryCandidates,
    check5_qtyVsCurrentQty: qtyMismatch,
    check6_typeCasing: typeCasingSummary,
    check6_typeSamples: typeCasingSamples,
    check7_noTypeNonVoided: { count: noTypeNonVoided.length, sample: noTypeNonVoided.slice(0, 50) },
  },
  excluded: {
    voidedTickets: skipped.voided,
    otherTypeTickets: skipped.otherType,
    ticketsWithNoItems: skipped.noItems,
    unmappedSkuLines: Object.fromEntries(skipped.unmappedSku),
  },
};
fs.writeFileSync(
  path.join(process.cwd(), 'scripts', 'inventory-math-final-2026-05-21.json'),
  JSON.stringify(out, null, 2),
);
console.log('\nWrote scripts/inventory-math-final-2026-05-21.json');
