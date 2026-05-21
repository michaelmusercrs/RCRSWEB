/**
 * legacy-inventory-log-read-2026-05-21.mjs
 *
 * READ-ONLY. Pulls the LEGACY Inventory tab (the standalone inventory app's
 * spreadsheet) which is the original source-of-truth transaction log with
 * dates. Categorizes every row, builds a per-SKU summary, groups restocks
 * by date (for owner's "one restock ticket per day" backfill plan), and
 * re-runs the math (inferred currentQty).
 *
 * Outputs:
 *   scripts/legacy-inventory-log-summary-2026-05-21.json
 *   scripts/legacy-inventory-log-summary-2026-05-21.log
 *
 * Does NOT write to any sheet. Does NOT commit.
 */
import fs from 'fs';
import path from 'path';

// ---- load .env.local ----
const envPath = path.join(process.cwd(), '.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
});

const LEGACY_SHEET_ID = process.env.LEGACY_INVENTORY_SHEETS_ID;
if (!LEGACY_SHEET_ID) {
  console.error('LEGACY_INVENTORY_SHEETS_ID is not set in .env.local');
  process.exit(1);
}
console.log(`[env] LEGACY_INVENTORY_SHEETS_ID = ${LEGACY_SHEET_ID}`);

const MASTER_SHEET_ID = process.env.GOOGLE_SHEETS_ID;
console.log(`[env] GOOGLE_SHEETS_ID (master) = ${MASTER_SHEET_ID}`);

const { JWT } = await import('google-auth-library');
const { GoogleSpreadsheet } = await import('google-spreadsheet');

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim(),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// ---- helpers ----
const HISTORICAL_CUTOFF = '2026-05-15';

const logLines = [];
function log(s = '') {
  console.log(s);
  logLines.push(s);
}

/**
 * Parse the legacy DateTime cell. Coming via getRows() it's a formatted
 * string like "11/4/2025 16:50:30" (M/D/YYYY H:MM:SS). Coming via loadCells()
 * it's the underlying excel serial number. We accept both.
 *
 * Returns ISO date "YYYY-MM-DD" or null.
 */
function parseLegacyDateTime(value) {
  if (value == null || value === '') return null;

  // numeric (excel serial)
  if (typeof value === 'number' && Number.isFinite(value) && value > 1000) {
    const d = new Date((value - 25569) * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  const s = String(value).trim();
  // try US-format "M/D/YYYY [HH:MM[:SS]]"
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, mo, da, yr] = m;
    const isoMo = String(mo).padStart(2, '0');
    const isoDa = String(da).padStart(2, '0');
    return `${yr}-${isoMo}-${isoDa}`;
  }

  // try ISO-ish
  const isoM = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoM) return isoM[0];

  // last resort: Date parser
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function parseNum(v) {
  if (v == null || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// ---- 1. Load legacy sheet & Items catalog ----
log('');
log('=== PHASE 1: open legacy sheet ===');
const legacyDoc = new GoogleSpreadsheet(LEGACY_SHEET_ID, auth);
await legacyDoc.loadInfo();
log(`Legacy doc title: "${legacyDoc.title}"`);
log(`Legacy tabs: ${Object.keys(legacyDoc.sheetsByTitle).join(', ')}`);

const itemsTab = legacyDoc.sheetsByTitle['Items'];
const itemsRows = itemsTab ? await itemsTab.getRows() : [];
const itemNameById = {};
const itemPriceById = {};
for (const r of itemsRows) {
  const o = r.toObject();
  const id = (o['Item ID'] || o['ItemID'] || o['itemID'] || '').toString().trim();
  if (!id) continue;
  itemNameById[id] = (o['Name'] || o['Item Name'] || o['Description'] || '').toString().trim();
  itemPriceById[id] = parseNum(o['Price'] || o['Cost']);
}
log(`Items catalog loaded: ${Object.keys(itemNameById).length} entries`);

// ---- 2. Read all Inventory rows ----
log('');
log('=== PHASE 2: parse Inventory log ===');
const invTab = legacyDoc.sheetsByTitle['Inventory'];
if (!invTab) {
  log('ERROR: no "Inventory" tab on legacy sheet');
  process.exit(2);
}
await invTab.loadHeaderRow();
const headers = invTab.headerValues;
log(`Inventory tab headers (verbatim): ${JSON.stringify(headers)}`);

const invRows = await invTab.getRows();
log(`Inventory tab total rows: ${invRows.length}`);

// ---- 3. Categorize ----
log('');
log('=== PHASE 3: categorize transactions ===');

/*
 * Schema (from lib/inventory-tab-sync.ts and inventory-source.xlsx):
 *   Inventory ID | Item ID | DateTime | Amount | R# | Price | Cost | Delivery Photo
 *
 *   - Amount sign is the truth: negative = OUT (delivery), positive = IN (restock/return).
 *   - There is no explicit transactionType column; we infer:
 *       * Amount < 0  → DELIVERY (out)
 *       * Amount > 0 + R# starts with "TKT-" or contains "CM" → RETURN/CM
 *       * Amount > 0 + R# blank or restock-like → RESTOCK (inbound)
 *       * Amount = 0  → ADJUSTMENT (rare)
 *     We also flag rows whose R# matches a credit memo pattern.
 */

function classify(row) {
  const o = row.toObject();
  const amount = parseNum(o['Amount']);
  const rNum = (o['R#'] || '').toString().trim();
  const itemId = (o['Item ID'] || '').toString().trim();
  const dateRaw = o['DateTime'];
  const date = parseLegacyDateTime(dateRaw);
  const photo = (o['Delivery Photo'] || '').toString().trim();

  let kind;
  const rUpper = rNum.toUpperCase();
  if (amount === 0) {
    kind = 'adjustment';
  } else if (amount < 0) {
    kind = 'delivery';
  } else {
    // positive amount
    if (rUpper.startsWith('CM') || rUpper.includes('CREDIT') || rUpper.includes('RETURN')) {
      kind = 'return';
    } else if (rUpper.startsWith('TKT-') && rUpper.includes('RESTOCK')) {
      kind = 'restock';
    } else if (rUpper.startsWith('TKT-')) {
      kind = 'return'; // portal-side ticket back-sync, positive amount = return
    } else if (rNum === '' || rNum === '1234') {
      // empty or the legacy "1234" sentinel = bulk warehouse restock
      kind = 'restock';
    } else if (/^\d{4,5}$/.test(rNum)) {
      // numeric SalesOrder reference + positive amount = return on that order
      kind = 'return';
    } else {
      // anything else with a positive amount we treat as a restock by default
      kind = 'restock';
    }
  }
  return {
    invId: (o['Inventory ID'] || '').toString().trim(),
    itemId,
    amount,
    rNum,
    date,
    dateRaw,
    photo,
    kind,
  };
}

const parsed = invRows.map(classify);

const counts = { delivery: 0, restock: 0, return: 0, adjustment: 0, unparseableDate: 0, missingItem: 0 };
for (const p of parsed) {
  counts[p.kind]++;
  if (!p.date) counts.unparseableDate++;
  if (!p.itemId) counts.missingItem++;
}
log(`Category counts: ${JSON.stringify(counts)}`);

// Spot check first 5 and last 5
log('');
log('First 5 parsed rows:');
for (const p of parsed.slice(0, 5)) {
  log(`  ${p.date || '(no date)'} | ${p.itemId.padEnd(10)} | ${String(p.amount).padStart(6)} | ${p.kind.padEnd(10)} | R#=${p.rNum}`);
}
log('');
log('Last 5 parsed rows:');
for (const p of parsed.slice(-5)) {
  log(`  ${p.date || '(no date)'} | ${p.itemId.padEnd(10)} | ${String(p.amount).padStart(6)} | ${p.kind.padEnd(10)} | R#=${p.rNum}`);
}

// ---- 4. Per-SKU summary ----
log('');
log('=== PHASE 4: per-SKU aggregation ===');

const transactionsPerSku = {};
function ensureSku(id) {
  if (!transactionsPerSku[id]) {
    transactionsPerSku[id] = {
      itemId: id,
      itemName: itemNameById[id] || '',
      restockUnits: 0,
      restockCount: 0,
      restockFirstDate: null,
      restockLastDate: null,
      deliveryUnits: 0,
      deliveryCount: 0,
      deliveryFirstDate: null,
      deliveryLastDate: null,
      returnUnits: 0,
      returnCount: 0,
      adjustmentUnits: 0,
      adjustmentCount: 0,
      adjustmentFirstDate: null,
      adjustmentLastDate: null,
      restockDates: [], // [{date,qty,rNum}]
    };
  }
  return transactionsPerSku[id];
}

function trackDate(slot, key, date) {
  if (!date) return;
  if (!slot[`${key}FirstDate`] || date < slot[`${key}FirstDate`]) slot[`${key}FirstDate`] = date;
  if (!slot[`${key}LastDate`] || date > slot[`${key}LastDate`]) slot[`${key}LastDate`] = date;
}

for (const p of parsed) {
  if (!p.itemId) continue;
  const s = ensureSku(p.itemId);
  const absQty = Math.abs(p.amount);
  if (p.kind === 'restock') {
    s.restockUnits += absQty;
    s.restockCount++;
    trackDate(s, 'restock', p.date);
    s.restockDates.push({ date: p.date, qty: absQty, rNum: p.rNum });
  } else if (p.kind === 'delivery') {
    s.deliveryUnits += absQty;
    s.deliveryCount++;
    trackDate(s, 'delivery', p.date);
  } else if (p.kind === 'return') {
    s.returnUnits += absQty;
    s.returnCount++;
  } else if (p.kind === 'adjustment') {
    s.adjustmentUnits += p.amount; // keep sign
    s.adjustmentCount++;
    trackDate(s, 'adjustment', p.date);
  }
}

// ---- 5. Group restocks BY DATE across all SKUs ----
log('');
log('=== PHASE 5: group restocks by date ===');
const restocksByDate = {}; // dateISO → [{itemId, qty, rNum, name}]
for (const p of parsed) {
  if (p.kind !== 'restock' || !p.itemId) continue;
  const d = p.date || 'UNDATED';
  if (!restocksByDate[d]) restocksByDate[d] = [];
  restocksByDate[d].push({
    itemId: p.itemId,
    name: itemNameById[p.itemId] || '',
    qty: Math.abs(p.amount),
    rNum: p.rNum,
  });
}
const restockDateKeys = Object.keys(restocksByDate).sort();
log(`Distinct restock dates: ${restockDateKeys.length}`);
log(`First 5 distinct restock dates:`);
for (const d of restockDateKeys.slice(0, 5)) {
  const lines = restocksByDate[d];
  const summary = lines.map(l => `${l.itemId}x${l.qty}`).join(', ');
  log(`  ${d}: ${lines.length} line(s) — ${summary}`);
}
log(`Last 5 distinct restock dates:`);
for (const d of restockDateKeys.slice(-5)) {
  const lines = restocksByDate[d];
  const summary = lines.map(l => `${l.itemId}x${l.qty}`).join(', ');
  log(`  ${d}: ${lines.length} line(s) — ${summary}`);
}

const totalRestockUnitsAllDates = Object.values(restocksByDate)
  .reduce((acc, arr) => acc + arr.reduce((a, b) => a + b.qty, 0), 0);
const distinctSkusInRestocks = new Set();
for (const arr of Object.values(restocksByDate)) for (const l of arr) distinctSkusInRestocks.add(l.itemId);
log(`Total restock units across all dated entries: ${totalRestockUnitsAllDates} across ${distinctSkusInRestocks.size} SKUs`);

// ---- 6. Re-run math vs master sheet Inventory_Products ----
log('');
log('=== PHASE 6: re-run math vs master sheet ===');

const masterDoc = new GoogleSpreadsheet(MASTER_SHEET_ID, auth);
await masterDoc.loadInfo();
const invProductsTab = masterDoc.sheetsByTitle['Inventory_Products'];
const invProductRows = invProductsTab ? await invProductsTab.getRows() : [];
const masterByLegacyId = {};
const masterByProductId = {};
for (const r of invProductRows) {
  const o = r.toObject();
  const legacyId = (o.legacyId || '').trim();
  const productId = (o.productId || '').trim();
  const rec = {
    productId,
    legacyId,
    productName: o.productName || '',
    currentQty: parseNum(o.currentQty),
    minStockLevel: parseNum(o.minStockLevel),
    unitCost: parseNum(o.unitCost),
    unitPrice: parseNum(o.unitPrice),
  };
  if (legacyId) masterByLegacyId[legacyId] = rec;
  if (productId) masterByProductId[productId] = rec;
}
log(`Master Inventory_Products rows: ${invProductRows.length}`);

// Read prior proposal & CM-by-sku for portal-side numbers
const proposalPath = path.join(process.cwd(), 'scripts', 'restock-backfill-proposal-2026-05-21.json');
const cmPath = path.join(process.cwd(), 'scripts', 'credit-memo-units-by-sku-2026-05-21.json');
const proposal = JSON.parse(fs.readFileSync(proposalPath, 'utf8'));
const cmData = JSON.parse(fs.readFileSync(cmPath, 'utf8'));
const cmBySku = Object.fromEntries(cmData.perSku.map(r => [r.productId, r.unitsCredited]));

// Live SKUs are item-123 through item-133
const LIVE_SKUS = [
  'item-123','item-124','item-125','item-126','item-127','item-128',
  'item-129','item-130','item-131','item-132','item-133',
];

const inferredCurrentQty = {};
log('');
log('Per-SKU inferred currentQty:');
log('-'.repeat(140));
log(`${'sku'.padEnd(10)} | ${'name'.padEnd(28)} | ${'legR'.padStart(6)} ${'legD'.padStart(6)} ${'legRet'.padStart(6)} ${'portR'.padStart(5)} ${'portD'.padStart(6)} ${'portCM'.padStart(6)} | ${'inferred'.padStart(9)} | ${'currentQty'.padStart(10)} | ${'gap'.padStart(8)}`);
log('-'.repeat(140));

const portalDeliveriesSinceCutoff = {}; // from proposal.breakdown.deliveriesSinceCutoff
const portalExistingRestocks = {}; // proposal.breakdown.restockTicketsRecorded (count) — we need units. Use proposal.existingRestocks
for (const id of LIVE_SKUS) {
  const p = proposal.perSku?.[id];
  if (p) {
    portalDeliveriesSinceCutoff[id] = p.breakdown?.deliveriesSinceCutoff ?? 0;
    // The portal has 1 historical restock ticket per SKU (existingRestocks reflects sum of all portal restocks).
    // Owner says only TKT-HISTORICAL-RESTOCK-RECON-20260516 exists, so the unit value = p.existingRestocks.
    portalExistingRestocks[id] = p.existingRestocks ?? 0;
  } else {
    portalDeliveriesSinceCutoff[id] = 0;
    portalExistingRestocks[id] = 0;
  }
}

let inferredAtZeroOrBelow = 0;
const perSkuTable = [];
for (const id of LIVE_SKUS) {
  const sku = transactionsPerSku[id] || {
    itemId: id, itemName: '', restockUnits: 0, deliveryUnits: 0, returnUnits: 0, adjustmentUnits: 0,
  };
  const legR = sku.restockUnits;
  const legD = sku.deliveryUnits;
  const legRet = sku.returnUnits;
  const portR = portalExistingRestocks[id] || 0;
  const portD = portalDeliveriesSinceCutoff[id] || 0;
  const portCM = cmBySku[id] || 0;
  // canonical math (per spec):
  //   inferred = legR − legD + legRet + portR − portD + portCM
  const inferred = legR - legD + legRet + portR - portD + portCM;
  const master = masterByLegacyId[id]?.currentQty ?? null;
  const gap = master == null ? null : inferred - master;
  inferredCurrentQty[id] = inferred;
  if (inferred <= 0) inferredAtZeroOrBelow++;
  perSkuTable.push({
    sku: id,
    name: masterByLegacyId[id]?.productName || sku.itemName || '',
    legR, legD, legRet, portR, portD, portCM,
    inferred, masterCurrentQty: master, gap,
  });
  log(`${id.padEnd(10)} | ${(masterByLegacyId[id]?.productName || sku.itemName || '').slice(0,28).padEnd(28)} | ${String(legR).padStart(6)} ${String(legD).padStart(6)} ${String(legRet).padStart(6)} ${String(portR).padStart(5)} ${String(portD).padStart(6)} ${String(portCM).padStart(6)} | ${String(inferred).padStart(9)} | ${String(master ?? 'n/a').padStart(10)} | ${String(gap ?? 'n/a').padStart(8)}`);
}
log('-'.repeat(140));
log(`SKUs whose inferred qty is <=0: ${inferredAtZeroOrBelow}/${LIVE_SKUS.length}  (owner expects 0)`);

// ---- 7. Overlap risk analysis ----
log('');
log('=== PHASE 7: overlap risk analysis (portal vs legacy since 2026-05-15) ===');
// Find latest date in legacy log overall and per kind
const legacyDateRange = { min: null, max: null };
for (const p of parsed) {
  if (!p.date) continue;
  if (!legacyDateRange.min || p.date < legacyDateRange.min) legacyDateRange.min = p.date;
  if (!legacyDateRange.max || p.date > legacyDateRange.max) legacyDateRange.max = p.date;
}
log(`Legacy log overall date range: ${legacyDateRange.min} → ${legacyDateRange.max}`);

const sinceCutoff = parsed.filter(p => p.date && p.date >= HISTORICAL_CUTOFF);
const sinceCutoffByKind = {};
for (const p of sinceCutoff) {
  sinceCutoffByKind[p.kind] = (sinceCutoffByKind[p.kind] || 0) + 1;
}
log(`Legacy rows with date >= ${HISTORICAL_CUTOFF}: ${sinceCutoff.length} ${JSON.stringify(sinceCutoffByKind)}`);

const portalRefsInLegacy = parsed.filter(p => p.rNum && p.rNum.toUpperCase().startsWith('TKT-')).length;
log(`Legacy rows whose R# starts with TKT- (portal back-sync evidence): ${portalRefsInLegacy}`);

const overlapRisk = {
  rangeOverlaps: legacyDateRange.max >= HISTORICAL_CUTOFF,
  portalSyncRowsInLegacy: portalRefsInLegacy,
  notes: portalRefsInLegacy > 0
    ? `Legacy log already contains ${portalRefsInLegacy} rows with TKT- R#s — portal IS dual-writing to the legacy tab. Portal deliveries since ${HISTORICAL_CUTOFF} are DUPLICATED in the legacy delivery total. To avoid double-counting in the inferred-currentQty math, either (a) subtract portalDeliveriesSinceCutoff from legD before applying it, or (b) trust legacy delivery total and drop the portal-since-cutoff term entirely.`
    : `No TKT-prefixed R#s found in legacy — back-sync likely not active during the data we read.`,
};
log(`Overlap risk: ${overlapRisk.notes}`);

// Recompute alt inferred (no double-count: treat legacy as the only delivery source)
log('');
log('Alt math (avoiding portal+legacy delivery double-count): inferred = legR - legD + legRet + portR + portCM');
log('-'.repeat(140));
log(`${'sku'.padEnd(10)} | ${'inferred_alt'.padStart(13)} | ${'currentQty'.padStart(10)} | ${'gap'.padStart(8)}`);
log('-'.repeat(140));
const altInferredCurrentQty = {};
for (const id of LIVE_SKUS) {
  const sku = transactionsPerSku[id] || { restockUnits:0, deliveryUnits:0, returnUnits:0 };
  const portR = portalExistingRestocks[id] || 0;
  const portCM = cmBySku[id] || 0;
  const inferredAlt = sku.restockUnits - sku.deliveryUnits + sku.returnUnits + portR + portCM;
  altInferredCurrentQty[id] = inferredAlt;
  const master = masterByLegacyId[id]?.currentQty ?? null;
  const gap = master == null ? null : inferredAlt - master;
  log(`${id.padEnd(10)} | ${String(inferredAlt).padStart(13)} | ${String(master ?? 'n/a').padStart(10)} | ${String(gap ?? 'n/a').padStart(8)}`);
}

// ---- 8. Top-3 most-restocked SKUs ----
log('');
log('=== PHASE 8: top 3 most-restocked SKUs ===');
const restockRanked = Object.values(transactionsPerSku)
  .filter(s => s.restockUnits > 0)
  .sort((a,b) => b.restockUnits - a.restockUnits)
  .slice(0, 3);
for (const s of restockRanked) {
  log(`  ${s.itemId} ${s.itemName}: restock ${s.restockUnits}u / ${s.restockCount}tx vs delivery ${s.deliveryUnits}u / ${s.deliveryCount}tx`);
}

// ---- 9. Write outputs ----
log('');
log('=== PHASE 9: write outputs ===');
const out = {
  generatedAt: new Date().toISOString(),
  today: '2026-05-21',
  source: 'scripts/legacy-inventory-log-read-2026-05-21.mjs',
  inputs: {
    legacySheetId: LEGACY_SHEET_ID,
    masterSheetId: MASTER_SHEET_ID,
    historicalCutoff: HISTORICAL_CUTOFF,
  },
  legacyTab: {
    title: 'Inventory',
    rowCount: invRows.length,
    headers,
    dateRange: legacyDateRange,
  },
  categoryCounts: counts,
  transactionsPerSku,
  restocksByDate,
  distinctRestockDates: restockDateKeys.length,
  totalRestockUnitsAllDates,
  distinctSkusInRestocks: [...distinctSkusInRestocks],
  liveSkuTable: perSkuTable,
  inferredCurrentQty,
  altInferredCurrentQty,
  gapVsCurrentQtyValue: Object.fromEntries(
    LIVE_SKUS.map(id => [id, {
      inferred: inferredCurrentQty[id],
      master: masterByLegacyId[id]?.currentQty ?? null,
      gap: masterByLegacyId[id]?.currentQty == null ? null : inferredCurrentQty[id] - masterByLegacyId[id].currentQty,
    }])
  ),
  overlapRisk,
  topRestockedSkus: restockRanked.map(s => ({
    itemId: s.itemId, itemName: s.itemName, restockUnits: s.restockUnits,
    restockCount: s.restockCount, deliveryUnits: s.deliveryUnits, deliveryCount: s.deliveryCount,
  })),
  // Limit first/last samples for the json file
  firstFiveParsed: parsed.slice(0, 5),
  lastFiveParsed: parsed.slice(-5),
  // Restock date proposal (sorted)
  proposedRestockTicketsByDate: restockDateKeys.map(d => ({
    date: d,
    lines: restocksByDate[d],
    totalUnits: restocksByDate[d].reduce((a,b) => a + b.qty, 0),
    skuCount: new Set(restocksByDate[d].map(l => l.itemId)).size,
  })),
};

const outJsonPath = path.join(process.cwd(), 'scripts', 'legacy-inventory-log-summary-2026-05-21.json');
const outLogPath  = path.join(process.cwd(), 'scripts', 'legacy-inventory-log-summary-2026-05-21.log');
fs.writeFileSync(outJsonPath, JSON.stringify(out, null, 2));
fs.writeFileSync(outLogPath,  logLines.join('\n'));
console.log('');
console.log(`Wrote: ${outJsonPath}`);
console.log(`Wrote: ${outLogPath}`);

// ---- 10. Conclusion line ----
const totalProposedUnits = totalRestockUnitsAllDates;
const totalProposedTickets = restockDateKeys.length;
const totalProposedSkus = distinctSkusInRestocks.size;
console.log('');
console.log(`CONCLUSION: ${totalProposedTickets} restock-ticket-days proposed, totaling ${totalProposedUnits} units across ${totalProposedSkus} SKUs.`);
