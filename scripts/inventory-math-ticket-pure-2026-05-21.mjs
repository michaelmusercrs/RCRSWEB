/**
 * Pure ticket-based inventory math — 2026-05-21
 *
 * Owner directive (verbatim):
 *   "TAKE THE RESTOCK TICKETS, REMOVE DELIVERY TICKETS ADD BACK STOCK
 *    RETURNS AND COME UP WITH A NUMBER. I DONT WANT TO SKEW THE NUMBERS.
 *    I WANT TO SEE WHAT WE HAVE PAID TO BE STOCKED AND WHAT WE HAVE
 *    CHARGED BACK TO JOBS, IN QTY NOT PRICE/COST AS OF NOW."
 *
 * Math per SKU:
 *   restocks(qty) − deliveries(qty) + returns(qty) = inventory(qty)
 *
 * Source: master Tickets tab ONLY. No legacy log overlay. No snapshot
 * blend. Voided tickets excluded. Quantities only, no $ figures.
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

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID || process.env.DELIVERY_SHEETS_ID, auth);
await doc.loadInfo();

const ticketsSheet = doc.sheetsByTitle['Tickets'];
const invSheet = doc.sheetsByTitle['Inventory_Products'];
if (!ticketsSheet || !invSheet) throw new Error('Tickets or Inventory_Products tab not found');

await ticketsSheet.loadHeaderRow();
await invSheet.loadHeaderRow();

const ticketRows = await ticketsSheet.getRows();
const invRows = await invSheet.getRows();

// Build product lookup: productId -> name + legacyId
const productByLegacy = new Map(); // 'item-123' -> {productId, productName}
const productById = new Map();     // 'INV-0001' -> {productId, productName, legacyId}
const skuOrder = [];
for (const r of invRows) {
  const id = (r.get('productId') || '').trim();
  const legacy = (r.get('legacyId') || '').trim();
  const name = (r.get('productName') || '').trim();
  if (!id) continue;
  productById.set(id, { productId: id, productName: name, legacyId: legacy });
  if (legacy) productByLegacy.set(legacy, { productId: id, productName: name });
  skuOrder.push({ productId: id, productName: name, legacyId: legacy });
}

// Resolve any productId/legacyId/name to canonical productId
function resolveProductId(line) {
  if (!line) return null;
  // try productId first
  if (line.productId && productById.has(line.productId)) return line.productId;
  // try legacyId (e.g. "item-127")
  if (line.productId && productByLegacy.has(line.productId)) return productByLegacy.get(line.productId).productId;
  if (line.legacyId && productByLegacy.has(line.legacyId)) return productByLegacy.get(line.legacyId).productId;
  // try name
  if (line.productName) {
    for (const p of productById.values()) {
      if (p.productName.toLowerCase().trim() === line.productName.toLowerCase().trim()) return p.productId;
    }
  }
  return null;
}

// Parse the materialsJson / items / lines column on each ticket
function parseItems(row) {
  // try multiple possible column names
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

const totals = {}; // productId -> { restock: 0, delivery: 0, return: 0 }
for (const sku of skuOrder) {
  totals[sku.productId] = { restock: 0, delivery: 0, return: 0, ticketCounts: { restock: 0, delivery: 0, return: 0 } };
}

const skipped = { voided: 0, otherStatus: 0, otherType: 0, noItems: 0, unmappedSku: new Map() };

for (const row of ticketRows) {
  const type = (row.get('type') || row.get('ticketType') || '').toLowerCase().trim();
  const status = (row.get('status') || '').toLowerCase().trim();

  // Exclude voided tickets
  if (status === 'voided') { skipped.voided++; continue; }

  // Only restock / delivery / return contribute
  if (!['restock', 'delivery', 'return'].includes(type)) { skipped.otherType++; continue; }

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
    if (type === 'restock') {
      totals[productId].restock += Math.abs(qty);
      totals[productId].ticketCounts.restock++;
    } else if (type === 'delivery') {
      totals[productId].delivery += Math.abs(qty);
      totals[productId].ticketCounts.delivery++;
    } else if (type === 'return') {
      totals[productId].return += Math.abs(qty);
      totals[productId].ticketCounts.return++;
    }
  }
}

// Print the table
console.log('');
console.log('Pure ticket-based inventory math (master Tickets tab only, voided excluded)');
console.log('Formula per SKU:  restocks − deliveries + returns = qty');
console.log('');
console.log('SKU       Name                              Restock      Delivery     Return       = QTY');
console.log('-----------------------------------------------------------------------------------------');

let sumR = 0, sumD = 0, sumRet = 0, sumQ = 0;
for (const sku of skuOrder) {
  const t = totals[sku.productId];
  const qty = t.restock - t.delivery + t.return;
  sumR += t.restock; sumD += t.delivery; sumRet += t.return; sumQ += qty;
  const nameTrim = (sku.productName || '').padEnd(32, ' ').slice(0, 32);
  console.log(
    `${sku.productId.padEnd(10, ' ')}${nameTrim} ${String(t.restock).padStart(10, ' ')}   ${String(t.delivery).padStart(10, ' ')}   ${String(t.return).padStart(10, ' ')}   ${String(qty).padStart(7, ' ')}`
  );
}
console.log('-----------------------------------------------------------------------------------------');
console.log(`TOTAL                                       ${String(sumR).padStart(10, ' ')}   ${String(sumD).padStart(10, ' ')}   ${String(sumRet).padStart(10, ' ')}   ${String(sumQ).padStart(7, ' ')}`);

console.log('');
console.log('Ticket counts per type per SKU:');
for (const sku of skuOrder) {
  const c = totals[sku.productId].ticketCounts;
  console.log(`  ${sku.productId} ${sku.productName}: ${c.restock} restock, ${c.delivery} delivery, ${c.return} return`);
}

console.log('');
console.log('Excluded:');
console.log(`  Voided tickets: ${skipped.voided}`);
console.log(`  Other-type tickets: ${skipped.otherType}`);
console.log(`  Tickets with no parseable items: ${skipped.noItems}`);
if (skipped.unmappedSku.size > 0) {
  console.log(`  Line items with unmapped SKU:`);
  for (const [label, count] of skipped.unmappedSku) {
    console.log(`    "${label}" — ${count} lines`);
  }
} else {
  console.log(`  Line items with unmapped SKU: 0`);
}

// Write JSON deliverable
const out = {
  computedAt: new Date().toISOString(),
  formula: 'restocks - deliveries + returns = qty (per SKU, from master Tickets tab only, voided excluded)',
  perSku: skuOrder.map(sku => ({
    productId: sku.productId,
    legacyId: sku.legacyId,
    productName: sku.productName,
    restocks: totals[sku.productId].restock,
    deliveries: totals[sku.productId].delivery,
    returns: totals[sku.productId].return,
    qty: totals[sku.productId].restock - totals[sku.productId].delivery + totals[sku.productId].return,
    ticketCounts: totals[sku.productId].ticketCounts,
  })),
  excluded: {
    voidedTickets: skipped.voided,
    otherTypeTickets: skipped.otherType,
    ticketsWithNoItems: skipped.noItems,
    unmappedSkuLines: Object.fromEntries(skipped.unmappedSku),
  },
};
fs.writeFileSync(
  path.join(process.cwd(), 'scripts', 'inventory-math-ticket-pure-2026-05-21.json'),
  JSON.stringify(out, null, 2),
);
console.log('\nWrote scripts/inventory-math-ticket-pure-2026-05-21.json');
