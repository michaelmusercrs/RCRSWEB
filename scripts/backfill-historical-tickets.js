/**
 * Historical Inventory Backfill — Standalone Script
 *
 * Reads data/inventory-import/inventory-source.xlsx, groups transactions
 * by reference number, builds one delivery ticket per real job (191) plus
 * one credit memo per job that has return lines (50), and writes them to
 * the `Tickets` Google Sheet tab. ~291 rows total.
 *
 * NO JobNimbus enrichment — uses only the data in the XLSX.
 * NO notifications, NO emails, NO Sara ping. Historical catch-up is silent.
 *
 * Run with:
 *   node scripts/backfill-historical-tickets.js
 *
 * Reads credentials from .env.local (GOOGLE_SERVICE_ACCOUNT_EMAIL,
 * GOOGLE_PRIVATE_KEY, GOOGLE_SHEETS_ID).
 */

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// ---- env loader (no dotenv dep needed) ----------------------------------
function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local not found at ' + envPath);
  }
  const text = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = loadEnvLocal();
const SHEETS_ID =
  env.GOOGLE_SHEETS_ID ||
  env.GOOGLE_SHEET_ID ||
  env.DELIVERY_SHEETS_ID;

if (!SHEETS_ID) throw new Error('No Google Sheet ID found in .env.local');
if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL) throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL missing');
if (!env.GOOGLE_PRIVATE_KEY) throw new Error('GOOGLE_PRIVATE_KEY missing');

const PRIVATE_KEY = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

// ---- XLSX parsing -------------------------------------------------------
const XLSX_PATH = path.join(__dirname, '..', 'data', 'inventory-import', 'inventory-source.xlsx');
if (!fs.existsSync(XLSX_PATH)) throw new Error('XLSX not found at ' + XLSX_PATH);

const wb = XLSX.readFile(XLSX_PATH);

// Items
const itemRows = XLSX.utils.sheet_to_json(wb.Sheets['Items'], { defval: '' });
const itemsById = new Map();
for (const r of itemRows) {
  const id = String(r['Item ID'] || '').trim();
  if (!id) continue;
  itemsById.set(id, {
    itemId: id,
    name: String(r['Name'] || '').trim(),
    description: String(r['Description'] || '').trim(),
    unitCost: parseFloat(String(r['Cost'] || '0').replace(/[$,\s]/g, '')) || 0,
    unitPrice: parseFloat(String(r['Price'] || '0').replace(/[$,\s]/g, '')) || 0,
  });
}
console.log('[backfill] Loaded', itemsById.size, 'items');

// Inventory
const txRows = XLSX.utils.sheet_to_json(wb.Sheets['Inventory'], { defval: '' });
const transactions = txRows
  .filter(r => {
    const ref = String(r['R#'] || '').trim();
    const item = String(r['Item ID'] || '').trim();
    const amt = Number(r['Amount']);
    return ref !== '' && item !== '' && Number.isFinite(amt) && amt !== 0;
  })
  .map(r => {
    const serial = Number(r['DateTime']);
    const ms = Number.isFinite(serial) ? (serial - 25569) * 86400 * 1000 : Date.now();
    return {
      inventoryId: String(r['Inventory ID'] || '').trim(),
      itemId: String(r['Item ID']).trim(),
      dateTime: new Date(ms).toISOString(),
      amount: Number(r['Amount']),
      referenceNumber: String(r['R#']).trim(),
    };
  });
console.log('[backfill] Loaded', transactions.length, 'transactions');

// ---- Group by R# (skip 1234 restock pseudo-ref) -------------------------
const EXCLUDE_REFS = new Set(['1234']);
const byRef = new Map();
for (const t of transactions) {
  if (EXCLUDE_REFS.has(t.referenceNumber)) continue;
  if (!byRef.has(t.referenceNumber)) byRef.set(t.referenceNumber, []);
  byRef.get(t.referenceNumber).push(t);
}
for (const [, txs] of byRef) {
  txs.sort((a, b) => a.dateTime.localeCompare(b.dateTime));
}
console.log('[backfill] Grouped into', byRef.size, 'unique reference numbers');

// ---- Build tickets ------------------------------------------------------
function aggregate(txs) {
  const byItem = new Map();
  for (const t of txs) {
    const item = itemsById.get(t.itemId);
    const productName = item ? item.name : t.itemId;
    const qty = Math.abs(t.amount);
    if (qty === 0) continue;
    const existing = byItem.get(t.itemId);
    if (existing) {
      existing.qty += qty;
    } else {
      byItem.set(t.itemId, {
        itemId: t.itemId,
        productName,
        qty,
        unitCost: item ? item.unitCost : 0,
        unitPrice: item ? item.unitPrice : 0,
      });
    }
  }
  const materials = [];
  let totalCost = 0;
  let totalPrice = 0;
  for (const a of byItem.values()) {
    const lineCost = Math.round(a.unitCost * a.qty * 100) / 100;
    const linePrice = Math.round(a.unitPrice * a.qty * 100) / 100;
    materials.push({
      productId: a.itemId,
      productName: a.productName,
      quantity: a.qty,
      unitCost: a.unitCost,
      unitPrice: a.unitPrice,
      totalCost: lineCost,
      totalPrice: linePrice,
    });
    totalCost += lineCost;
    totalPrice += linePrice;
  }
  return {
    materials,
    totalCost: Math.round(totalCost * 100) / 100,
    totalPrice: Math.round(totalPrice * 100) / 100,
  };
}

const tickets = [];
let ticketCount = 0;
let creditMemoCount = 0;

for (const [refNumber, txs] of byRef.entries()) {
  const delivery = txs.filter(t => t.amount < 0);
  const returned = txs.filter(t => t.amount > 0);

  const firstDeliveryTime = delivery[0]?.dateTime || returned[0]?.dateTime || '';
  const lastDeliveryTime = delivery[delivery.length - 1]?.dateTime || firstDeliveryTime;
  const firstReturnTime = returned[0]?.dateTime || '';
  const lastReturnTime = returned[returned.length - 1]?.dateTime || firstReturnTime;

  if (delivery.length > 0) {
    const { materials, totalCost, totalPrice } = aggregate(delivery);
    if (materials.length > 0) {
      tickets.push({
        ticketId: `TKT-${refNumber}`,
        ticketType: 'delivery',
        status: 'completed',
        referenceNumber: refNumber,
        createdAt: firstDeliveryTime,
        completedAt: lastDeliveryTime,
        createdBy: 'historical-backfill',
        createdByName: 'Historical Import',
        assignedTo: 'driver-richard',
        assignedToName: 'Richard Geahr',
        // jobId/jobName/customer fields intentionally blank — user said
        // "if you dont have the address or phone its ok". Going forward,
        // new tickets will be created with full JN enrichment.
        jobId: '',
        jobName: '',
        jobAddress: '',
        city: '',
        state: '',
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        materials,
        totalCost,
        totalPrice,
        notes: 'Backfilled from inventory-source.xlsx historical transaction log.',
        sourceTransactionId: delivery[0]?.inventoryId || '',
      });
      ticketCount++;
    }
  }

  if (returned.length > 0) {
    const { materials, totalCost, totalPrice } = aggregate(returned);
    if (materials.length > 0) {
      tickets.push({
        ticketId: `CM-${refNumber}`,
        ticketType: 'return',
        status: 'completed',
        referenceNumber: refNumber,
        createdAt: firstReturnTime,
        completedAt: lastReturnTime,
        createdBy: 'historical-backfill',
        createdByName: 'Historical Import',
        assignedTo: 'driver-richard',
        assignedToName: 'Richard Geahr',
        jobId: '',
        jobName: '',
        jobAddress: '',
        city: '',
        state: '',
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        materials,
        totalCost,
        totalPrice,
        notes: 'Credit memo: materials returned from job back to warehouse. Backfilled from inventory-source.xlsx.',
        sourceTransactionId: returned[0]?.inventoryId || '',
      });
      creditMemoCount++;
    }
  }
}

// Sort newest-first so the sheet looks reasonable
tickets.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

console.log('[backfill] Built', ticketCount, 'tickets +', creditMemoCount, 'credit memos =', tickets.length, 'rows');

// ---- Write to Sheets ----------------------------------------------------
const TICKET_HEADERS = [
  'ticketId',
  'ticketType',
  'status',
  'referenceNumber',
  'createdAt',
  'completedAt',
  'createdBy',
  'createdByName',
  'assignedTo',
  'assignedToName',
  'jobId',
  'jobName',
  'jobAddress',
  'city',
  'state',
  'customerName',
  'customerPhone',
  'customerEmail',
  'materialsJson',
  'totalCost',
  'totalPrice',
  'notes',
  'sourceTransactionId',
];

function ticketToRow(t) {
  return {
    ticketId: t.ticketId,
    ticketType: t.ticketType,
    status: t.status,
    referenceNumber: t.referenceNumber,
    createdAt: t.createdAt,
    completedAt: t.completedAt || '',
    createdBy: t.createdBy || '',
    createdByName: t.createdByName || '',
    assignedTo: t.assignedTo || '',
    assignedToName: t.assignedToName || '',
    jobId: t.jobId || '',
    jobName: t.jobName || '',
    jobAddress: t.jobAddress || '',
    city: t.city || '',
    state: t.state || '',
    customerName: t.customerName || '',
    customerPhone: t.customerPhone || '',
    customerEmail: t.customerEmail || '',
    materialsJson: JSON.stringify(t.materials || []),
    totalCost: t.totalCost,
    totalPrice: t.totalPrice,
    notes: t.notes || '',
    sourceTransactionId: t.sourceTransactionId || '',
  };
}

(async () => {
  console.log('[backfill] Connecting to Google Sheets...');
  const auth = new JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(SHEETS_ID, auth);
  await doc.loadInfo();
  console.log('[backfill] Connected to spreadsheet:', doc.title);

  // Get or create the Tickets tab
  let sheet = doc.sheetsByTitle['Tickets'];
  if (!sheet) {
    console.log('[backfill] Creating new Tickets tab...');
    sheet = await doc.addSheet({
      title: 'Tickets',
      headerValues: TICKET_HEADERS,
      gridProperties: { columnCount: TICKET_HEADERS.length + 5 },
    });
  } else {
    try {
      await sheet.loadHeaderRow();
    } catch {
      await sheet.setHeaderRow(TICKET_HEADERS);
    }
    // Verify headers cover everything we need
    const existingHeaders = sheet.headerValues || [];
    const missing = TICKET_HEADERS.filter(h => !existingHeaders.includes(h));
    if (missing.length > 0) {
      console.log('[backfill] Adding missing headers:', missing);
      await sheet.setHeaderRow([...existingHeaders, ...missing]);
    }
  }

  // Read existing rows so we can upsert (idempotent)
  const existingRows = await sheet.getRows();
  const existingByTicketId = new Map();
  for (const row of existingRows) {
    const id = row.get('ticketId');
    if (id) existingByTicketId.set(id, row);
  }
  console.log('[backfill] Found', existingByTicketId.size, 'existing rows in Tickets tab');

  // Walk tickets — update existing rows, batch-add new ones
  const newRows = [];
  let updated = 0;
  for (const ticket of tickets) {
    const existing = existingByTicketId.get(ticket.ticketId);
    if (existing) {
      const data = ticketToRow(ticket);
      for (const [k, v] of Object.entries(data)) {
        existing.set(k, v == null ? '' : String(v));
      }
      try {
        await existing.save();
        updated++;
      } catch (err) {
        console.error('[backfill] Failed to update', ticket.ticketId, err.message);
      }
    } else {
      const data = ticketToRow(ticket);
      // Coerce all values to strings/numbers for the sheet writer
      const safe = {};
      for (const [k, v] of Object.entries(data)) safe[k] = v == null ? '' : v;
      newRows.push(safe);
    }
    if ((updated + newRows.length) % 25 === 0) {
      process.stdout.write(`\r[backfill] processed ${updated + newRows.length} of ${tickets.length}...`);
    }
  }

  // Bulk-insert new rows in chunks of 100 (Sheets API row-add cap is 500ish)
  let inserted = 0;
  if (newRows.length > 0) {
    console.log('\n[backfill] Inserting', newRows.length, 'new rows in chunks...');
    const CHUNK = 100;
    for (let i = 0; i < newRows.length; i += CHUNK) {
      const chunk = newRows.slice(i, i + CHUNK);
      try {
        await sheet.addRows(chunk);
        inserted += chunk.length;
        process.stdout.write(`\r[backfill] inserted ${inserted} of ${newRows.length}...`);
      } catch (err) {
        console.error('\n[backfill] Chunk insert failed:', err.message);
      }
    }
    process.stdout.write('\n');
  }

  console.log('');
  console.log('[backfill] DONE');
  console.log('  Total tickets built:    ', tickets.length);
  console.log('  Delivery tickets:       ', ticketCount);
  console.log('  Credit memos:           ', creditMemoCount);
  console.log('  Existing rows updated:  ', updated);
  console.log('  New rows inserted:      ', inserted);
  console.log('  Sheet:                  ', doc.title);
  console.log('  Tab:                    ', 'Tickets');
})().catch(err => {
  console.error('[backfill] FATAL:', err);
  process.exit(1);
});
