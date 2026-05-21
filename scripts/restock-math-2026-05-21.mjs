/**
 * restock-math-2026-05-21.mjs  —  READ-ONLY phase
 *
 * Owner directive #3 (2026-05-21):
 *   "i would like for the restock backfill to have a ticket created for
 *    each occurrence not each item. so all restocks from the same day
 *    would go on 1 ticket. etc. we should be able to take all restock
 *    tickets minus all delivery tickets add back credit memos and come
 *    up with a inventory number. triple check it then i will check
 *    against actual stock numbers."
 *
 * Math identity to verify, per SKU:
 *   sum(restock_units) - sum(delivery_units) + sum(cm_units) = currentQty
 *
 * Restock tickets must group by DATE (one ticket per restock day), not
 * per SKU. CM units come from CM tickets (type=return) line items.
 *
 * This pass writes NOTHING to the sheet. It computes the math three ways,
 * cross-references date signals from various tabs, and emits a proposal
 * JSON + a human-readable log for owner review before phase 2.
 *
 * Output files:
 *   scripts/restock-backfill-proposal-2026-05-21.json
 *   scripts/restock-backfill-proposal-2026-05-21.log
 */
import fs from 'fs';
import path from 'path';

// ---------- env ----------
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

const sheetsId = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim(),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const doc = new GoogleSpreadsheet(sheetsId, auth);
await doc.loadInfo();

const TODAY = '2026-05-21';
const HIST_CUTOFF = '2026-05-15'; // historical_close snapshot reference date
const FIRST_DELIVERY = '2025-02-18'; // owner-stated: TKT-9716 first delivery
const RUN_TS = new Date().toISOString();

const lines = [];
const log = (s = '') => { lines.push(s); console.log(s); };

log('========================================');
log('RCRS restock-math (READ-ONLY) — 2026-05-21');
log('========================================');
log(`Run at: ${RUN_TS}`);
log('');

// ---------- safe helpers ----------
const safeGet = (row, col) => {
  try { return row.get(col) || ''; } catch { return ''; }
};
const parseJsonSilent = (s, fallback = []) => {
  if (!s) return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
};
const dateOnly = (s) => {
  if (!s) return '';
  const m = String(s).match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
};

// ---------- 1. Load Inventory_Products (canonical SKU set + currentQty) ----------
log('Loading Inventory_Products...');
const invProductsTab = doc.sheetsByTitle['Inventory_Products'];
if (!invProductsTab) throw new Error('Inventory_Products tab not found');
const invProductRows = await invProductsTab.getRows();

// Build a SKU map: prefer legacyId (item-NNN) as the canonical key the
// historical tickets use; track Inventory_Products' productId (INV-NNNN)
// alongside, plus name + currentQty.
const skuMap = new Map(); // key: canonical legacy "item-NNN" id used by tickets
const invByInvId = new Map(); // productId (INV-*) -> sku entry
const invByName = new Map();  // lowercase productName -> sku entry

for (const r of invProductRows) {
  const productId = safeGet(r, 'productId') || safeGet(r, 'sku');
  const legacyId = safeGet(r, 'legacyId') || '';
  const name = safeGet(r, 'productName') || safeGet(r, 'name') || '';
  const currentQty = parseFloat(safeGet(r, 'currentQty') || '0') || 0;
  const canonicalKey = legacyId || productId;
  if (!canonicalKey) continue;
  const entry = {
    canonicalKey,
    invProductId: productId,
    legacyId,
    productName: name,
    currentQty,
    aliases: new Set([
      canonicalKey,
      productId,
      legacyId,
      name.toLowerCase().trim(),
    ].filter(Boolean)),
  };
  skuMap.set(canonicalKey, entry);
  if (productId) invByInvId.set(productId, entry);
  if (name) invByName.set(name.toLowerCase().trim(), entry);
}
log(`  Inventory_Products SKUs: ${skuMap.size}`);
for (const e of skuMap.values()) {
  log(`    ${e.canonicalKey.padEnd(10)} | ${(e.invProductId || '-').padEnd(10)} | currentQty=${String(e.currentQty).padStart(5)} | ${e.productName}`);
}
log('');

// Resolve any productId/name to canonical SKU entry
const resolveSku = (pid, pname) => {
  if (!pid && !pname) return null;
  if (pid && skuMap.has(pid)) return skuMap.get(pid);
  if (pid && invByInvId.has(pid)) return invByInvId.get(pid);
  if (pname) {
    const hit = invByName.get(String(pname).toLowerCase().trim());
    if (hit) return hit;
  }
  // Try fuzzy on name fragments — only inside the 11 canonical SKUs
  if (pname) {
    const n = String(pname).toLowerCase();
    for (const e of skuMap.values()) {
      if (e.productName && n.includes(e.productName.toLowerCase())) return e;
      if (e.productName && e.productName.toLowerCase().includes(n) && n.length > 5) return e;
    }
  }
  return null;
};

// ---------- 2. Load Tickets ----------
log('Loading Tickets...');
const ticketsTab = doc.sheetsByTitle['Tickets'];
if (!ticketsTab) throw new Error('Tickets tab not found');
const ticketRows = await ticketsTab.getRows();
log(`  Tickets: ${ticketRows.length}`);

// Type breakdown for visibility
const typeBreakdown = {};
for (const r of ticketRows) {
  const t = safeGet(r, 'ticketType') || '(blank)';
  typeBreakdown[t] = (typeBreakdown[t] || 0) + 1;
}
log('  ticketType breakdown:');
for (const [t, n] of Object.entries(typeBreakdown).sort()) {
  log(`    ${t.padEnd(15)} : ${n}`);
}
log('');

// Accumulators per SKU
const perSku = new Map(); // key: canonical -> { totals }
const ensureSku = (key, name = '') => {
  if (!perSku.has(key)) {
    const inv = skuMap.get(key);
    perSku.set(key, {
      canonicalKey: key,
      productName: name || inv?.productName || '',
      invProductId: inv?.invProductId || '',
      legacyId: inv?.legacyId || '',
      currentQty: inv?.currentQty ?? 0,
      totalRestockUnits: 0,
      totalDeliveryUnits: 0,
      totalCmUnits: 0,
      restocksSinceCutoff: 0,
      deliveriesSinceCutoff: 0,
      cmsSinceCutoff: 0,
      restocksBeforeCutoff: 0,
      deliveriesBeforeCutoff: 0,
      cmsBeforeCutoff: 0,
      restockTickets: [], // {ticketId, date, qty}
      deliveryTickets: [],
      cmTickets: [],
      dateSignalsFound: [],
    });
  }
  return perSku.get(key);
};

// First-pass: track all SKU keys seen on tickets even outside Inventory_Products
const unknownSkuLines = []; // for diagnostics

for (const r of ticketRows) {
  const ticketId = safeGet(r, 'ticketId');
  const ticketType = safeGet(r, 'ticketType');
  const createdAt = safeGet(r, 'createdAt');
  const completedAt = safeGet(r, 'completedAt');
  const matsJson = safeGet(r, 'materialsJson');
  const notes = safeGet(r, 'notes');
  const status = safeGet(r, 'status');
  const tDate = dateOnly(completedAt) || dateOnly(createdAt);

  // Determine ticket "kind" for our math
  // type=delivery -> deduct
  // type=restock -> add
  // type=return OR ticketId starts CM- OR ticketType==credit_memo -> add (back)
  const isDelivery = ticketType === 'delivery';
  const isRestock = ticketType === 'restock';
  const isReturn = ticketType === 'return' || ticketType === 'credit_memo' || ticketId.startsWith('CM-');
  if (!isDelivery && !isRestock && !isReturn) continue;

  const items = parseJsonSilent(matsJson, []);
  // Some return tickets carry lineItems inside the notes field as JSON, mirror that fallback
  let usedItems = items;
  if (!usedItems.length && /lineItems=/.test(notes)) {
    const m = notes.match(/lineItems=(\[.*?\])(?:\s*\||\s*$)/s);
    if (m) usedItems = parseJsonSilent(m[1], []);
  }

  for (const it of usedItems) {
    const pid = it.productId || it.sku || '';
    const pname = it.productName || it.name || '';
    const qty = parseFloat(it.quantity ?? it.qty ?? 0) || 0;
    if (!qty) continue;

    const skuEntry = resolveSku(pid, pname);
    if (!skuEntry) {
      unknownSkuLines.push({ ticketId, ticketType, pid, pname, qty, date: tDate });
      continue;
    }
    const bucket = ensureSku(skuEntry.canonicalKey, skuEntry.productName);

    if (isDelivery) {
      bucket.totalDeliveryUnits += qty;
      bucket.deliveryTickets.push({ ticketId, date: tDate, qty });
      if (tDate && tDate >= HIST_CUTOFF) bucket.deliveriesSinceCutoff += qty;
      else bucket.deliveriesBeforeCutoff += qty;
    } else if (isRestock) {
      bucket.totalRestockUnits += qty;
      bucket.restockTickets.push({ ticketId, date: tDate, qty });
      if (tDate && tDate >= HIST_CUTOFF) bucket.restocksSinceCutoff += qty;
      else bucket.restocksBeforeCutoff += qty;
    } else if (isReturn) {
      bucket.totalCmUnits += qty;
      bucket.cmTickets.push({ ticketId, date: tDate, qty });
      if (tDate && tDate >= HIST_CUTOFF) bucket.cmsSinceCutoff += qty;
      else bucket.cmsBeforeCutoff += qty;
    }
  }
}

// Ensure all canonical SKUs are in perSku, even if they had no ticket activity
for (const [key, inv] of skuMap.entries()) ensureSku(key, inv.productName);

log(`Ticket aggregation complete. Unknown-SKU lines (outside catalog): ${unknownSkuLines.length}`);
if (unknownSkuLines.length) {
  log('  Unknown-SKU samples:');
  for (const u of unknownSkuLines.slice(0, 5)) {
    log(`    ${u.ticketId} ${u.ticketType} pid=${u.pid} name="${u.pname}" qty=${u.qty} date=${u.date}`);
  }
  if (unknownSkuLines.length > 5) log(`    ... +${unknownSkuLines.length - 5} more`);
}
log('');

// ---------- 3. Load Invoices (CM-20260521-* sanity check) ----------
log('Loading Invoices (CM-20260521-* sanity)...');
const invoicesTab = doc.sheetsByTitle['Invoices'];
const invoiceRows = invoicesTab ? await invoicesTab.getRows() : [];
let cmInvoiceCount = 0;
let cmUnitsFromInvoiceNotes = 0;
for (const r of invoiceRows) {
  const id = safeGet(r, 'invoiceId');
  if (!/^CM-20260521-/.test(id)) continue;
  cmInvoiceCount++;
  const notes = safeGet(r, 'notes');
  const m = notes.match(/lineItems=(\[.*?\])(?:\s*\||\s*$)/s);
  if (!m) continue;
  const items = parseJsonSilent(m[1], []);
  for (const it of items) {
    const qty = parseFloat(it.quantity ?? it.qty ?? 0) || 0;
    cmUnitsFromInvoiceNotes += qty;
  }
}
log(`  CM-20260521-* invoices found: ${cmInvoiceCount}`);
log(`  Units totalled from invoice notes lineItems: ${cmUnitsFromInvoiceNotes}`);
// Compare to ticket-side CM totals
let cmUnitsFromTickets = 0;
for (const e of perSku.values()) cmUnitsFromTickets += e.totalCmUnits;
log(`  Units totalled from CM ticket materialsJson: ${cmUnitsFromTickets}`);
log('');

// ---------- 4. Load snapshots ----------
log('Loading historical inventory snapshots...');
const snapshotTabName = 'Inventory_Snapshot_2026-05-15_2007_historical_close';
const snapshotReconName = 'Inventory_Snapshot_2026-05-15_2050_post_restock_recon';

// Strict snapshot matching: only EXACT productId (item-NNN) match OR
// EXACT case-insensitive productName match. Avoids fuzzy false positives
// (e.g., snapshot's "IKO ArmourGard Ice & Water Shield" ≠ our "Ice & Water Shield").
const strictResolveSku = (pid, pname) => {
  if (pid && skuMap.has(pid)) return skuMap.get(pid);
  if (pname) {
    const hit = invByName.get(String(pname).toLowerCase().trim());
    if (hit) return hit;
  }
  return null;
};

const loadSnapshot = async (tabName) => {
  const tab = doc.sheetsByTitle[tabName];
  if (!tab) { log(`  ${tabName}: NOT FOUND`); return null; }
  const rows = await tab.getRows();
  const headers = rows.length ? Object.keys(rows[0].toObject()) : [];
  const qtyCol = ['currentQty', 'afterQty', 'after', 'qty'].find(c => headers.includes(c));
  const map = new Map();
  let mappedToCatalog = 0;
  let unmappedSamples = [];
  for (const r of rows) {
    const pid = safeGet(r, 'productId') || safeGet(r, 'sku');
    const legacyId = safeGet(r, 'legacyId');
    const name = safeGet(r, 'productName') || safeGet(r, 'name');
    const qty = qtyCol ? (parseFloat(safeGet(r, qtyCol)) || 0) : 0;
    // Try legacyId first (item-NNN), then strict pid/name match
    const skuEntry =
      (legacyId && skuMap.get(legacyId)) ||
      strictResolveSku(pid, name);
    if (skuEntry) {
      map.set(skuEntry.canonicalKey, { pid, legacyId, name, qty });
      mappedToCatalog++;
    } else if (unmappedSamples.length < 3) {
      unmappedSamples.push(`${pid}|${name}`);
    }
  }
  log(`  ${tabName}: ${rows.length} rows -> ${mappedToCatalog} strict matches to our 11-SKU catalog (qtyCol=${qtyCol || 'n/a'})`);
  if (mappedToCatalog === 0 && unmappedSamples.length) {
    log(`    NOTE: snapshot uses a DIFFERENT SKU universe. Sample unmapped: ${unmappedSamples.join('; ')}`);
  }
  return map;
};

const histCloseSnapshot = await loadSnapshot(snapshotTabName);
const postReconSnapshot = await loadSnapshot(snapshotReconName);
// Require a meaningful number of matches before we trust the snapshot.
// (We saw 12 fuzzy matches earlier, none were our actual SKUs.)
const histSnapshotApplicable = histCloseSnapshot && histCloseSnapshot.size >= 6;
if (!histSnapshotApplicable) {
  log('  -> historical_close snapshot does NOT cover our 11-SKU catalog. Methods 2/3 will be marked n/a.');
}
log('');

// ---------- 5. Date-signal hunt ----------
log('Hunting for restock date signals in source tabs...');

const SIGNAL_KEYWORDS = /(restock|stock arrived|po confirm|po confirmation|received|received load|delivery to warehouse|delivered to (the )?warehouse|pulled from truck|inventory received|new shipment|backstock|warehouse received|order arrived|abc supply|beacon|srs distribution|stock order)/i;

const candidateSignalTabs = [
  'Email Log',
  'Notifications',
  'Material Orders Workflow',
  'Customer_Documents',
  'JN_Activities_Recent',
  'Stock Adjustments',
  'InventoryLogs',
  'Inventory Counts',
];

const allSignals = []; // { tab, rowIndex, date, snippet, skuMatches:[canonicalKey], raw }

const findSkuMentions = (text) => {
  if (!text) return [];
  const hits = new Set();
  const lower = String(text).toLowerCase();
  for (const e of skuMap.values()) {
    if (e.canonicalKey && lower.includes(e.canonicalKey.toLowerCase())) hits.add(e.canonicalKey);
    if (e.invProductId && lower.includes(e.invProductId.toLowerCase())) hits.add(e.canonicalKey);
    if (e.legacyId && e.legacyId !== e.canonicalKey && lower.includes(e.legacyId.toLowerCase())) hits.add(e.canonicalKey);
    if (e.productName && e.productName.length > 3) {
      const nm = e.productName.toLowerCase();
      if (lower.includes(nm)) hits.add(e.canonicalKey);
      // Also try first-token of name (e.g., "Ridge Vent")
      const firstTwo = nm.split(/\s+/).slice(0, 2).join(' ');
      if (firstTwo.length > 4 && lower.includes(firstTwo)) hits.add(e.canonicalKey);
    }
  }
  return [...hits];
};

for (const tabName of candidateSignalTabs) {
  const tab = doc.sheetsByTitle[tabName];
  if (!tab) { log(`  ${tabName}: NOT FOUND`); continue; }
  let rows;
  try { rows = await tab.getRows(); } catch (e) { log(`  ${tabName}: read error ${e.message?.slice(0,60)}`); continue; }
  log(`  ${tabName}: ${rows.length} rows`);
  if (!rows.length) continue;
  const headers = Object.keys(rows[0].toObject());
  // Concatenate all string fields per row, scan once
  let hitCount = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const obj = r.toObject();
    let concat = '';
    for (const h of headers) {
      const v = obj[h];
      if (v == null) continue;
      concat += ` ${h}=${v}`;
    }
    const isRestockSignal = SIGNAL_KEYWORDS.test(concat);
    if (!isRestockSignal) continue;
    // Try to extract a date
    let date = '';
    for (const h of headers) {
      if (/date|timestamp|createdAt|sentAt|receivedAt|completedAt/i.test(h)) {
        const d = dateOnly(obj[h]);
        if (d) { date = d; break; }
      }
    }
    if (!date) date = dateOnly(concat);
    const skuMatches = findSkuMentions(concat);
    if (!skuMatches.length) continue; // only keep signals that mention one of our 11 SKUs
    hitCount++;
    allSignals.push({
      tab: tabName,
      rowIndex: i + 2, // header is row 1
      date,
      skuMatches,
      snippet: concat.slice(0, 280).replace(/\s+/g, ' ').trim(),
    });
  }
  log(`    -> signal hits (SKU-mentioned + restock keyword): ${hitCount}`);
}
log(`  Total restock signals across all tabs: ${allSignals.length}`);
log('');

// Attach signals to SKUs
for (const sig of allSignals) {
  for (const k of sig.skuMatches) {
    const bucket = perSku.get(k);
    if (!bucket) continue;
    bucket.dateSignalsFound.push({
      tab: sig.tab,
      rowIndex: sig.rowIndex,
      date: sig.date,
      snippet: sig.snippet,
    });
  }
}

// ---------- 6. Triple-check math ----------
log('========================================');
log('TRIPLE-CHECK MATH');
log('========================================');
log('');

const skuRows = [...perSku.values()].sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey));

const fmtN = (n) => String(Math.round(n));

log('Per-SKU totals (all-time):');
log('  key       | name                                 | curQty | rstk | dlvy | cm  | rstk≥cutoff | dlvy≥cutoff | cm≥cutoff');
log('  ----------|--------------------------------------|--------|------|------|-----|-------------|-------------|----------');
for (const e of skuRows) {
  log(
    `  ${e.canonicalKey.padEnd(10)}| ${(e.productName || '-').slice(0, 36).padEnd(36)} | ${fmtN(e.currentQty).padStart(6)} | ${fmtN(e.totalRestockUnits).padStart(4)} | ${fmtN(e.totalDeliveryUnits).padStart(4)} | ${fmtN(e.totalCmUnits).padStart(3)} | ${fmtN(e.restocksSinceCutoff).padStart(11)} | ${fmtN(e.deliveriesSinceCutoff).padStart(11)} | ${fmtN(e.cmsSinceCutoff).padStart(8)}`
  );
}
log('');

log('Triple-check (Method 1 / Method 2 / Method 3):');
log('  M1 = sum(rstk) - sum(dlvy) + sum(cm) - currentQty   (all-time forward from zero)');
log('  M2 = opening - dlvy_since + rstk_since + cm_since - currentQty  (forward from historical_close)');
log('  M3 = (currentQty + dlvy_since - rstk_since - cm_since) - opening (backward sanity; should equal -M2)');
log('');
log('  SKU       | name                           | curQty | M1 gap | M2 gap | M3 diff | restock-need | signals');
log('  ----------|--------------------------------|--------|--------|--------|---------|--------------|--------');

for (const e of skuRows) {
  // Method 1 — all-time forward from zero
  const m1Computed = e.totalRestockUnits - e.totalDeliveryUnits + e.totalCmUnits;
  const m1Gap = m1Computed - e.currentQty; // negative => need MORE restocks

  // Method 2 — forward from historical_close snapshot
  let m2Gap = null;
  const opening = histCloseSnapshot?.get(e.canonicalKey)?.qty;
  if (Number.isFinite(opening)) {
    const m2Computed = opening - e.deliveriesSinceCutoff + e.restocksSinceCutoff + e.cmsSinceCutoff;
    m2Gap = m2Computed - e.currentQty;
  }

  // Method 3 — backward from currentQty
  let m3Diff = null;
  if (Number.isFinite(opening)) {
    const impliedOpening = e.currentQty + e.deliveriesSinceCutoff - e.restocksSinceCutoff - e.cmsSinceCutoff;
    m3Diff = impliedOpening - opening; // should equal -m2Gap
  }

  e.method1Gap = m1Gap;
  e.method2Gap = m2Gap;
  e.method3Diff = m3Diff;
  e.opening = opening ?? null;

  // restock units needed = -m1Gap (i.e. units to ADD on the restock side
  // so that book balances). Floor to zero — never propose negative.
  const restockNeeded = m1Gap < 0 ? Math.abs(m1Gap) : 0;
  e.restockUnitsNeeded = restockNeeded;

  // Method disagreement check (only meaningful when M2 exists AND
  // snapshot universe matches our SKU catalog)
  let disagreement = false;
  if (m2Gap != null && histSnapshotApplicable) {
    if (Math.abs(m1Gap - m2Gap) > 5) disagreement = true;
    if (m3Diff != null && Math.abs(m3Diff + m2Gap) > 0.001) {
      // M3 diff should be -M2 gap by construction; if not, math broke
      disagreement = true;
    }
  }
  e.methodDisagreement = disagreement;
  e.method2Applicable = !!(m2Gap != null && histSnapshotApplicable);

  const sigCount = e.dateSignalsFound.length;
  const m1Str = ((m1Gap >= 0 ? '+' : '') + fmtN(m1Gap)).padStart(6);
  const m2Str = (!e.method2Applicable || m2Gap == null) ? '   n/a' : ((m2Gap >= 0 ? '+' : '') + fmtN(m2Gap)).padStart(6);
  const m3Str = (!e.method2Applicable || m3Diff == null) ? '    n/a' : ((m3Diff >= 0 ? '+' : '') + fmtN(m3Diff)).padStart(7);
  log(
    `  ${e.canonicalKey.padEnd(10)}| ${(e.productName || '-').slice(0, 30).padEnd(30)} | ${fmtN(e.currentQty).padStart(6)} | ${m1Str} | ${m2Str} | ${m3Str} | ${fmtN(restockNeeded).padStart(12)} | ${String(sigCount).padStart(7)}${disagreement ? ' [DISAGREE]' : ''}`
  );
}
log('');

// ---------- 7. Build proposed tickets ----------
log('Building proposed restock tickets...');
const balancedSkus = [];
const unbalancedSkus = [];
const flaggedSkus = [];

const perSkuProposal = {};

for (const e of skuRows) {
  const propose = [];
  if (e.methodDisagreement) {
    flaggedSkus.push(e.canonicalKey);
  } else if (e.restockUnitsNeeded === 0) {
    balancedSkus.push(e.canonicalKey);
  } else {
    unbalancedSkus.push(e.canonicalKey);
    // Group date signals by date. Only propose grouped tickets if we have
    // signals; otherwise propose a single catch-all on FIRST_DELIVERY date.
    const byDate = new Map();
    for (const sig of e.dateSignalsFound) {
      if (!sig.date) continue;
      if (!byDate.has(sig.date)) byDate.set(sig.date, []);
      byDate.get(sig.date).push(sig);
    }

    if (!byDate.size) {
      propose.push({
        date: FIRST_DELIVERY,
        qty: e.restockUnitsNeeded,
        note: 'opening balance reconciliation — no date signal found, units inferred from triple-check math 2026-05-21',
        signalSource: [],
      });
    } else {
      // Phase 1 (read-only) cannot determine per-date QTY from signals
      // alone; the math only gives us the TOTAL needed. Owner directive says
      // group by date — we therefore propose ONE ticket on the EARLIEST
      // signal date, plus document the other dates as candidates the owner
      // can split manually in phase 2. This keeps the math identity exact
      // and lets the owner adjust allocations after seeing actual stock.
      const sortedDates = [...byDate.keys()].sort();
      const earliest = sortedDates[0];
      propose.push({
        date: earliest,
        qty: e.restockUnitsNeeded,
        note: `opening balance reconciliation — earliest restock signal date; ${sortedDates.length} candidate dates total. Owner may split before phase-2 write.`,
        signalSource: byDate.get(earliest).map(s => ({ tab: s.tab, rowIndex: s.rowIndex, snippet: s.snippet.slice(0, 200) })),
        otherCandidateDates: sortedDates.slice(1),
      });
    }
  }

  perSkuProposal[e.canonicalKey] = {
    canonicalKey: e.canonicalKey,
    invProductId: e.invProductId,
    legacyId: e.legacyId,
    productName: e.productName,
    currentQty: e.currentQty,
    totalDeliveries: e.totalDeliveryUnits,
    totalCmCredits: e.totalCmUnits,
    existingRestocks: e.totalRestockUnits,
    method1Gap: e.method1Gap,
    method2Gap: e.method2Gap,
    method3Diff: e.method3Diff,
    openingFromHistCloseSnapshot: e.opening,
    methodDisagreement: e.methodDisagreement,
    restockUnitsNeeded: e.restockUnitsNeeded,
    dateSignalsFound: e.dateSignalsFound.map(s => ({
      tab: s.tab, rowIndex: s.rowIndex, date: s.date, snippet: s.snippet.slice(0, 200),
    })),
    proposedTickets: propose,
    breakdown: {
      restocksSinceCutoff: e.restocksSinceCutoff,
      deliveriesSinceCutoff: e.deliveriesSinceCutoff,
      cmsSinceCutoff: e.cmsSinceCutoff,
      restocksBeforeCutoff: e.restocksBeforeCutoff,
      deliveriesBeforeCutoff: e.deliveriesBeforeCutoff,
      cmsBeforeCutoff: e.cmsBeforeCutoff,
      restockTicketsRecorded: e.restockTickets.length,
      deliveryTicketsRecorded: e.deliveryTickets.length,
      cmTicketsRecorded: e.cmTickets.length,
    },
  };
}

let totalProposedTickets = 0;
let totalProposedUnits = 0;
for (const k of unbalancedSkus) {
  for (const t of perSkuProposal[k].proposedTickets) {
    totalProposedTickets++;
    totalProposedUnits += t.qty;
  }
}

log(`Balanced SKUs (gap=0):      ${balancedSkus.length} — ${balancedSkus.join(', ') || '(none)'}`);
log(`Unbalanced SKUs (need restocks): ${unbalancedSkus.length} — ${unbalancedSkus.join(', ') || '(none)'}`);
log(`Flagged SKUs (method disagreement >5u): ${flaggedSkus.length} — ${flaggedSkus.join(', ') || '(none)'}`);
log(`Total proposed restock tickets: ${totalProposedTickets}`);
log(`Total proposed restock units:   ${totalProposedUnits}`);
log('');

// ---------- 8. Write proposal JSON + log ----------
const proposal = {
  computedAt: RUN_TS,
  today: TODAY,
  source: 'restock-math-2026-05-21.mjs',
  mathIdentity: 'sum(restocks) - sum(deliveries) + sum(credit_memos) = currentQty',
  inputs: {
    sheetId: sheetsId,
    historicalCutoff: HIST_CUTOFF,
    firstDeliveryDate: FIRST_DELIVERY,
    cmInvoiceCount2026_05_21: cmInvoiceCount,
    cmUnitsFromInvoiceNotes: cmUnitsFromInvoiceNotes,
    cmUnitsFromTickets: cmUnitsFromTickets,
    ticketTypeBreakdown: typeBreakdown,
    unknownSkuLineCount: unknownSkuLines.length,
    snapshotsLoaded: {
      historicalClose: !!histCloseSnapshot,
      postRestockRecon: !!postReconSnapshot,
    },
    signalsScannedTabs: candidateSignalTabs,
    totalRestockSignalsFound: allSignals.length,
  },
  summary: {
    totalSkus: skuRows.length,
    balancedSkus,
    unbalancedSkus,
    flaggedSkus,
    totalProposedTickets,
    totalProposedUnits,
  },
  perSku: perSkuProposal,
};

const proposalPath = path.join(process.cwd(), 'scripts', 'restock-backfill-proposal-2026-05-21.json');
fs.writeFileSync(proposalPath, JSON.stringify(proposal, null, 2));
log(`Wrote: ${proposalPath}`);

const logPath = path.join(process.cwd(), 'scripts', 'restock-backfill-proposal-2026-05-21.log');
fs.writeFileSync(logPath, lines.join('\n'));
log(`Wrote: ${logPath}`);
log('');
log('READ-ONLY pass complete. No data was written to the sheet.');
