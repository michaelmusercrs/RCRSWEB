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
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(sheetsId, auth);
await doc.loadInfo();
console.log('Tabs found:', Object.keys(doc.sheetsByTitle).join(', '));

// 1. Look up the JobMaterialCosts tab (interoffice invoices)
const invTabName = ['JobMaterialCosts', 'PipelineInvoices', 'Invoices'].find(n => doc.sheetsByTitle[n]);
console.log('\nInvoice tab:', invTabName || '(none found)');
if (invTabName) {
  const rows = await doc.sheetsByTitle[invTabName].getRows();
  console.log('Total rows:', rows.length);
  const sample = rows.slice(0, 3);
  console.log('Sample columns:', Object.keys(rows[0]?._rawData ? rows[0].toObject() : {}));
  console.log('First 3 records:');
  sample.forEach(r => {
    console.log('  ', JSON.stringify(r.toObject()).substring(0, 250));
  });
  // count distinct ticketIds covered
  const ticketIds = new Set(rows.map(r => r.get('ticketId')).filter(Boolean));
  console.log(`\nDistinct ticketIds with invoices: ${ticketIds.size}`);
}

// 2. Check Inventory tab for current state — look at any transactions tabs
console.log('\n--- Inventory state ---');
const invMain = doc.sheetsByTitle['Inventory'];
if (invMain) {
  const rows = await invMain.getRows();
  console.log(`Inventory items: ${rows.length}`);
  const nonZero = rows.filter(r => parseFloat(r.get('currentQty')) > 0);
  console.log(`Items with stock > 0: ${nonZero.length}`);
  const sum = rows.reduce((s, r) => s + (parseFloat(r.get('totalValue')) || 0), 0);
  console.log(`Total inventory value: $${sum.toFixed(2)}`);
}

// 3. AuditLog or InventoryLogs for evidence of deductions
const auditTabName = ['InventoryLogs', 'AuditLog'].find(n => doc.sheetsByTitle[n]);
console.log(`\n--- ${auditTabName || 'No audit tab'} ---`);
if (auditTabName) {
  const rows = await doc.sheetsByTitle[auditTabName].getRows();
  console.log(`Total log rows: ${rows.length}`);
  // Show recent activity
  console.log('Last 5 entries:');
  rows.slice(-5).forEach(r => {
    console.log('  ', JSON.stringify(r.toObject()).substring(0, 200));
  });
}
