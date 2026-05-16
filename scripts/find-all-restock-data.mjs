/**
 * The user says all restocks are in the historical data. I found 0 restock
 * tickets in 'historical-backfill'. Where are they?
 *
 * Search:
 *   - Every tab name with restock/receive/po/order in it
 *   - All distinct ticketType values
 *   - All distinct createdBy values
 *   - Any RestockRequests / Restock_Orders / Inventory_Receive tab
 *   - InventoryLogs entries with positive qtyChange
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

console.log('=== All tabs on the master sheet ===');
const allTabs = Object.keys(doc.sheetsByTitle).sort();
allTabs.forEach(t => console.log(`  ${t}`));

console.log('\n=== Tabs with restock/receive/po/order in name ===');
const candidateTabs = allTabs.filter(t => /restock|receive|^po\b|purchase|inbound|inventory_log/i.test(t));
candidateTabs.forEach(t => console.log(`  ${t}`));

// In Tickets tab — distinct values
console.log('\n=== Tickets tab — distinct ticketType + createdBy ===');
const ticketsTab = doc.sheetsByTitle['Tickets'];
if (ticketsTab) {
  const rows = await ticketsTab.getRows();
  const types = new Map();
  const creators = new Map();
  for (const r of rows) {
    const t = r.get('ticketType') || '_blank';
    const c = r.get('createdBy') || '_blank';
    types.set(t, (types.get(t) || 0) + 1);
    creators.set(c, (creators.get(c) || 0) + 1);
  }
  console.log('  ticketType counts:');
  [...types.entries()].sort().forEach(([k, n]) => console.log(`    ${k}: ${n}`));
  console.log('  createdBy counts:');
  [...creators.entries()].sort().forEach(([k, n]) => console.log(`    ${k}: ${n}`));
}

// Dig into each candidate tab — show its row count and headers
for (const tabName of candidateTabs) {
  const tab = doc.sheetsByTitle[tabName];
  if (!tab) continue;
  console.log(`\n=== ${tabName} ===`);
  console.log(`  rowCount=${tab.rowCount}, colCount=${tab.columnCount}`);
  const rows = await tab.getRows();
  console.log(`  data rows: ${rows.length}`);
  if (rows.length > 0) {
    const headers = Object.keys(rows[0].toObject());
    console.log(`  headers: ${headers.join(', ')}`);
    console.log(`  first 3 rows:`);
    rows.slice(0, 3).forEach((r, i) => {
      console.log(`    [${i}] ${JSON.stringify(r.toObject()).slice(0, 250)}`);
    });
  }
}

// InventoryLogs — look for positive qty changes (restocks)
const logsTab = doc.sheetsByTitle['InventoryLogs'] || doc.sheetsByTitle['Inventory_Logs'];
if (logsTab) {
  console.log('\n=== InventoryLogs — positive qty changes (restock-like) ===');
  const rows = await logsTab.getRows();
  let positiveCount = 0;
  const positiveByPid = new Map();
  for (const r of rows) {
    const q = parseFloat(r.get('qtyChange') || r.get('quantityChange') || '0');
    if (q > 0) {
      positiveCount++;
      const pid = r.get('productId') || r.get('itemId') || '?';
      positiveByPid.set(pid, (positiveByPid.get(pid) || 0) + q);
    }
  }
  console.log(`  Total positive log entries: ${positiveCount}`);
  [...positiveByPid.entries()].sort().forEach(([p, q]) => console.log(`    ${p}: +${q}`));
}
