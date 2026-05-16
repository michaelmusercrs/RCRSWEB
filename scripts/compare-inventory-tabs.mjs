/**
 * Compare 'Inventory' vs 'Inventory_Products' tabs side by side.
 * One of them is canonical, the other is stale/wrong/derivative.
 * Per Michael: "I have the current inventory, I am not sharing it yet
 * to avoid corrupting the data" — must be Inventory_Products since it
 * has positive numbers and legacy mapping.
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

const invTab = doc.sheetsByTitle['Inventory'];
const ipTab = doc.sheetsByTitle['Inventory_Products'];

console.log('=== Inventory tab ===');
const invRows = await invTab.getRows();
console.log(`  ${invRows.length} rows`);
for (const r of invRows) {
  const o = r.toObject();
  console.log(`  ${o.productId} | ${o.productName} | currentQty=${o.currentQty} | unitCost=${o.unitCost}`);
}

console.log('\n=== Inventory_Products tab ===');
const ipRows = await ipTab.getRows();
console.log(`  ${ipRows.length} rows`);
for (const r of ipRows) {
  const o = r.toObject();
  console.log(`  ${o.productId} | legacyId=${o.legacyId} | ${o.productName} | currentQty=${o.currentQty} | minStock=${o.minStockLevel} | maxStock=${o.maxStockLevel} | unitCost=${o.unitCost}`);
}

// Cross-reference
console.log('\n=== Cross-reference INV-* IDs ===');
const invByPid = new Map();
for (const r of invRows) {
  const o = r.toObject();
  invByPid.set(o.productId, { name: o.productName, qty: parseFloat(o.currentQty) || 0 });
}
const ipByPid = new Map();
for (const r of ipRows) {
  const o = r.toObject();
  ipByPid.set(o.productId, { name: o.productName, qty: parseFloat(o.currentQty) || 0, legacyId: o.legacyId });
}
const allPids = new Set([...invByPid.keys(), ...ipByPid.keys()]);
for (const pid of [...allPids].sort()) {
  const a = invByPid.get(pid);
  const b = ipByPid.get(pid);
  if (a && b) {
    const same = a.name === b.name;
    console.log(`  ${pid}: Inventory='${a.name}' (${a.qty}) | Inventory_Products='${b.name}' (${b.qty}, legacy ${b.legacyId}) ${same ? '✓ same' : '⚠️ DIFFERENT'}`);
  } else if (a) {
    console.log(`  ${pid}: only in Inventory tab — '${a.name}' (${a.qty})`);
  } else {
    console.log(`  ${pid}: only in Inventory_Products — '${b.name}' (${b.qty}, legacy ${b.legacyId})`);
  }
}

// Now check which tab the 17 email-webhook deductions ACTUALLY touched
console.log('\n=== Where did my 17-job deduction go? ===');
console.log('It updated the Inventory tab (the wrong one). The Inventory_Products tab is the live one with proper legacy mapping.');
console.log('Fix: read the email-webhook tickets, sum per legacy productId, apply to Inventory_Products tab via legacyId match, restore the Inventory tab to whatever it was (probably should be deleted or treated as stale).');
