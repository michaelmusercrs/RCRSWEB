/**
 * Restocks ARE somewhere. User said "all restocks are in the historical data
 * on the sheet." I missed them. Check every inventory-related tab.
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

const tabsToCheck = [
  'Stock Adjustments',
  'InventoryTransactions',
  'Inventory Counts',
  'Inventory_Products',
  'Material Orders Workflow',
  'MaterialHolds',
  'Supplier Pricing',
  'PipelineEvents',
  'PipelineOrders',
];

for (const tabName of tabsToCheck) {
  const tab = doc.sheetsByTitle[tabName];
  if (!tab) {
    console.log(`\n=== ${tabName}: NOT FOUND ===`);
    continue;
  }
  console.log(`\n=== ${tabName} ===`);
  try {
    const rows = await tab.getRows();
    console.log(`  data rows: ${rows.length}`);
    if (rows.length === 0) continue;
    const headers = Object.keys(rows[0].toObject());
    console.log(`  headers (${headers.length}): ${headers.join(', ')}`);

    // If it has qty + productId-like fields, summarize positive changes
    const qtyFields = headers.filter(h => /qty|quant|amount|change/i.test(h));
    const pidField = headers.find(h => /productId|itemId|sku/i.test(h));
    const dateField = headers.find(h => /date|timestamp|createdAt/i.test(h));
    const typeField = headers.find(h => /type|action|kind/i.test(h));

    if (qtyFields.length > 0 && pidField) {
      const positives = new Map();
      const negatives = new Map();
      let positiveRows = 0;
      let negativeRows = 0;
      for (const r of rows) {
        for (const qf of qtyFields) {
          const q = parseFloat(r.get(qf)) || 0;
          if (q > 0) {
            positiveRows++;
            const pid = r.get(pidField) || '?';
            positives.set(pid, (positives.get(pid) || 0) + q);
          } else if (q < 0) {
            negativeRows++;
            const pid = r.get(pidField) || '?';
            negatives.set(pid, (negatives.get(pid) || 0) + q);
          }
        }
      }
      console.log(`  positive (restock-like) rows: ${positiveRows}`);
      console.log(`  negative (deduct-like) rows: ${negativeRows}`);
      if (positives.size > 0) {
        console.log(`  positive sum by productId:`);
        [...positives.entries()].sort().forEach(([p, q]) => console.log(`    ${p}: +${q}`));
      }
      if (negatives.size > 0) {
        console.log(`  negative sum by productId:`);
        [...negatives.entries()].sort().forEach(([p, q]) => console.log(`    ${p}: ${q}`));
      }
    }

    // Sample
    console.log(`  first row sample:`);
    console.log(`    ${JSON.stringify(rows[0].toObject()).slice(0, 350)}`);
  } catch (err) {
    console.log(`  ERROR reading: ${err.message}`);
  }
}
