/**
 * Inspect this-week tickets + Ridge Vent transactions across all sources
 * to find what's still over-counting deliveries.
 *
 * READ ONLY.
 */
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) { let v = m[2]; if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); process.env[m[1]] = v; }
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
const sheet = doc.sheetsByTitle['Tickets'];
await sheet.loadHeaderRow();
const rows = await sheet.getRows();

// ========================================================================
// 1. Dump each this-week ticket in full
// ========================================================================
const thisWeekIds = ['TKT-R-10997', 'TKT-R-10923', 'TKT-R-11223', 'TKT-R-10993'];
console.log('=== This-week ticket materialsJson dump ===\n');
for (const id of thisWeekIds) {
  const row = rows.find(r => (r.get('ticketId') || '').trim() === id);
  if (!row) { console.log(`${id}: NOT FOUND\n`); continue; }
  const type = row.get('type') || row.get('ticketType') || '';
  const status = row.get('status') || '';
  const createdAt = row.get('createdAt') || '';
  console.log(`${id}: type=${type} status=${status} created=${createdAt}`);
  for (const col of ['materialsJson', 'items', 'lines', 'lineItems', 'materials']) {
    const raw = row.get(col);
    if (raw) {
      try {
        const items = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(items)) {
          for (const it of items) {
            const id2 = it.productId || it.legacyId || '?';
            const name = it.productName || '?';
            const qty = it.qty ?? it.quantity ?? it.units ?? '?';
            console.log(`  ${id2.padEnd(10)} ${String(name).padEnd(32)} qty=${qty}`);
          }
        }
      } catch { console.log(`  [unparseable ${col}]`); }
      break;
    }
  }
  console.log('');
}

// ========================================================================
// 2. Per-SKU running balance walk on master Tickets (chronological)
// ========================================================================
console.log('=== Ridge Vent (INV-0005 / item-127) chronological from master Tickets only ===\n');
const events = [];
for (const r of rows) {
  const status = (r.get('status') || '').toLowerCase().trim();
  if (status === 'voided') continue;
  const type = ((r.get('type') || r.get('ticketType') || '')).toLowerCase().trim();
  if (!['restock', 'delivery', 'return'].includes(type)) continue;
  const ticketId = r.get('ticketId') || '';
  const createdAt = r.get('createdAt') || '';
  const rNumber = r.get('rNumber') || '';
  let items = [];
  for (const col of ['materialsJson', 'items', 'lines', 'lineItems', 'materials']) {
    const raw = r.get(col);
    if (raw) {
      try { const p = typeof raw === 'string' ? JSON.parse(raw) : raw; if (Array.isArray(p)) { items = p; break; } } catch {}
    }
  }
  for (const it of items) {
    const idCandidate = (it.productId || '').trim();
    const legacyCandidate = (it.legacyId || '').trim();
    const nameCandidate = (it.productName || '').toLowerCase();
    const matchesRidgeVent =
      idCandidate === 'INV-0005' ||
      legacyCandidate === 'item-127' ||
      idCandidate === 'item-127' ||
      nameCandidate.includes('ridge vent');
    if (!matchesRidgeVent) continue;
    const qty = Number(it.qty ?? it.quantity ?? it.units ?? 0);
    if (!qty || isNaN(qty)) continue;
    let signed = qty;
    if (type === 'delivery') signed = -Math.abs(qty);
    else signed = Math.abs(qty);
    events.push({ ticketId, type, createdAt, rNumber, qty: signed });
  }
}
events.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
let running = 0;
console.log('Date                | Type      | TicketId                       | R#        | Qty   | Running');
for (const e of events) {
  running += e.qty;
  console.log(
    `${(e.createdAt || '').slice(0,19).padEnd(19)} | ${e.type.padEnd(9)} | ${e.ticketId.padEnd(30)} | ${String(e.rNumber).padEnd(9)} | ${String(e.qty).padStart(5)} | ${String(running).padStart(6)}`,
  );
}
console.log(`\nFinal running balance (Ridge Vent, master Tickets, voided excluded): ${running}`);

// ========================================================================
// 3. Histogram of Ridge Vent delivery qty per ticket — find outliers
// ========================================================================
const deliverySizes = events.filter(e => e.type === 'delivery').map(e => Math.abs(e.qty));
deliverySizes.sort((a, b) => a - b);
console.log(`\nRidge Vent delivery qty stats (per ticket-line):`);
console.log(`  N = ${deliverySizes.length}`);
console.log(`  min = ${deliverySizes[0]}, max = ${deliverySizes[deliverySizes.length - 1]}`);
console.log(`  median = ${deliverySizes[Math.floor(deliverySizes.length / 2)]}`);
const buckets = {};
for (const v of deliverySizes) {
  const b = v >= 100 ? '100+' : v >= 50 ? '50-99' : v >= 30 ? '30-49' : v >= 15 ? '15-29' : v >= 5 ? '5-14' : '1-4';
  buckets[b] = (buckets[b] || 0) + 1;
}
console.log(`  histogram: ${JSON.stringify(buckets)}`);

console.log(`\n=== Ridge Vent deliveries with qty >= 50 (potential UoM/inflation outliers) ===`);
for (const e of events) {
  if (e.type !== 'delivery' || Math.abs(e.qty) < 50) continue;
  console.log(`  ${(e.createdAt || '').slice(0,19)} | ${e.ticketId.padEnd(30)} | R#${e.rNumber.padEnd(8)} | qty=${e.qty}`);
}
