/**
 * Look at historical-backfill tickets WITH ticketType breakdown.
 * Previously I only summed deliveries. Michael says restocks are in
 * the same data — find them.
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
const sheetsId = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim(),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(sheetsId, auth);
await doc.loadInfo();

const ticketsTab = doc.sheetsByTitle['Tickets'];
const rows = await ticketsTab.getRows();
const hist = rows.filter(r => r.get('createdBy') === 'historical-backfill');

// Type breakdown
const byType = {};
for (const r of hist) {
  const t = r.get('ticketType') || 'BLANK';
  byType[t] = (byType[t] || 0) + 1;
}
console.log('Historical-backfill ticket types:');
for (const [t, n] of Object.entries(byType)) console.log(`  ${t}: ${n}`);

// SKU breakdown by ticket type
const byTypeAndSku = {};
for (const r of hist) {
  const t = r.get('ticketType') || 'BLANK';
  let materials = [];
  try { materials = JSON.parse(r.get('materialsJson') || '[]'); } catch {}
  for (const m of materials) {
    if (!m.productId) continue;
    const scheme = m.productId.startsWith('INV-') ? 'INV-*' :
                   m.productId.startsWith('item-') ? 'item-*' : 'OTHER';
    const key = `${t} / ${scheme}`;
    byTypeAndSku[key] = (byTypeAndSku[key] || 0) + 1;
  }
}
console.log('\nMaterial lines by ticketType / SKU scheme:');
for (const [k, n] of Object.entries(byTypeAndSku)) console.log(`  ${k}: ${n} lines`);

// Now actually compute net inventory change per SKU across ALL historical types
console.log('\n=== Net inventory change per SKU across ALL historical-backfill tickets ===');
const netChange = new Map();
for (const r of hist) {
  const t = r.get('ticketType') || '';
  // Deliveries go OUT (negative). Restocks come IN (positive). Returns come back IN.
  const sign = (t === 'delivery') ? -1
             : (t === 'restock' || t === 'return') ? 1
             : 0;
  if (sign === 0) continue;
  let materials = [];
  try { materials = JSON.parse(r.get('materialsJson') || '[]'); } catch {}
  for (const m of materials) {
    if (!m.productId || !m.quantity) continue;
    const change = sign * m.quantity;
    const existing = netChange.get(m.productId) || { qty: 0, name: m.productName };
    existing.qty += change;
    netChange.set(m.productId, existing);
  }
}

const sorted = [...netChange.entries()].sort((a, b) => a[0].localeCompare(b[0]));
console.log(`SKUs with net change: ${sorted.length}`);
for (const [pid, data] of sorted) {
  console.log(`  ${pid}: ${data.qty > 0 ? '+' : ''}${data.qty}  (${data.name})`);
}

// Status breakdown too
const byStatus = {};
for (const r of hist) {
  const s = r.get('status') || 'BLANK';
  byStatus[s] = (byStatus[s] || 0) + 1;
}
console.log('\nHistorical-backfill ticket statuses:');
for (const [s, n] of Object.entries(byStatus)) console.log(`  ${s}: ${n}`);
