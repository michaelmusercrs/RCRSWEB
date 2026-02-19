const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const wb = XLSX.readFile('C:\\Users\\Michael\\Downloads\\Items.xlsx');

// Parse Items sheet
const items = XLSX.utils.sheet_to_json(wb.Sheets['Items']);
// Parse Inventory (transactions) sheet
const inv = XLSX.utils.sheet_to_json(wb.Sheets['Inventory']);

console.log(`Items: ${items.length}, Transactions: ${inv.length}`);

// Excel date serial to ISO string
function excelDateToISO(serial) {
  const epoch = new Date(1899, 11, 30);
  const d = new Date(epoch.getTime() + serial * 86400000);
  return d.toISOString().replace('Z', '').slice(0, 19);
}

// Read existing inventoryData.ts to preserve metadata not in Excel
const existingData = fs.readFileSync(path.join(__dirname, '..', 'lib', 'inventoryData.ts'), 'utf-8');

// Build products from Items sheet, preserving existing metadata where possible
// Extract existing products for merging
const existingProducts = {};
const prodRegex = /productId: '([^']+)'[\s\S]*?category: '([^']+)'[\s\S]*?unit: '([^']+)'[\s\S]*?minQty: (\d+)[\s\S]*?maxQty: (\d+)[\s\S]*?supplier: '([^']*)'[\s\S]*?location: '([^']*)'/g;
let m;
while ((m = prodRegex.exec(existingData)) !== null) {
  existingProducts[m[1]] = {
    category: m[2], unit: m[3], minQty: parseInt(m[4]),
    maxQty: parseInt(m[5]), supplier: m[6], location: m[7]
  };
}

// Generate inventoryData.ts
let productsTS = `// Inventory Data - Source: Items.xlsx
// Last Updated: ${new Date().toISOString().slice(0, 10)}
// Products: ${items.length}

export interface InventoryProduct {
  productId: string;
  productName: string;
  description: string;
  imageUrl: string;
  cost: number;
  price: number;
  category: string;
  unit: string;
  minQty: number;
  maxQty: number;
  currentQty: number;
  supplier: string;
  location: string;
}

export const inventoryProducts: InventoryProduct[] = [\n`;

for (const item of items) {
  const id = item['Item ID'];
  const existing = existingProducts[id] || {};
  productsTS += `  {
    productId: '${id}',
    productName: '${(item['Name'] || '').replace(/'/g, "\\'")}',
    description: '${(item['Description'] || '').replace(/'/g, "\\'")}',
    imageUrl: '${item['Image'] || ''}',
    cost: ${item['Cost'] || 0},
    price: ${item['Price'] || 0},
    category: '${existing.category || 'Roofing'}',
    unit: '${existing.unit || 'each'}',
    minQty: ${existing.minQty || 10},
    maxQty: ${existing.maxQty || 100},
    currentQty: 0,
    supplier: '${existing.supplier || ''}',
    location: '${existing.location || 'Warehouse'}',
  },\n`;
}
productsTS += '];\n';

// Generate inventoryTransactions.ts  
// Determine type from amount and figure out price per unit from items lookup
const itemPriceMap = {};
for (const item of items) {
  itemPriceMap[item['Item ID']] = { cost: item['Cost'] || 0, price: item['Price'] || 0 };
}

let txTS = `// Inventory Transaction History - Real Data from Items.xlsx
// Total Transactions: ${inv.length}
// Data imported: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}

export interface InventoryTransaction {
  inventoryId: string;
  itemId: string;
  dateTime: string;
  amount: number;
  referenceNumber: string;
  price: number;
  cost: number;
  deliveryPhoto?: string;
  status: 'completed' | 'pending' | 'cancelled';
  type: 'delivery' | 'restock' | 'return' | 'adjustment' | 'count';
  notes?: string;
}

export const inventoryTransactions: InventoryTransaction[] = [\n`;

for (const tx of inv) {
  const itemId = tx['Item ID'];
  const amount = tx['Amount'] || 0;
  const ref = tx['R#'] || '';
  const costTotal = tx['Cost'] || 0;
  const itemInfo = itemPriceMap[itemId] || { cost: 0, price: 0 };
  const type = amount >= 0 ? 'restock' : 'delivery';
  const dateTime = typeof tx['DateTime'] === 'number' ? excelDateToISO(tx['DateTime']) : tx['DateTime'];
  
  txTS += `  { inventoryId: '${tx['Inventory ID']}', itemId: '${itemId}', dateTime: '${dateTime}', amount: ${amount}, referenceNumber: '${ref}', price: ${itemInfo.price}, cost: ${itemInfo.cost}, status: 'completed', type: '${type}' },\n`;
}
txTS += '];\n';

fs.writeFileSync(path.join(__dirname, '..', 'lib', 'inventoryData.ts'), productsTS);
fs.writeFileSync(path.join(__dirname, '..', 'lib', 'inventoryTransactions.ts'), txTS);

// Also save JSON to data/
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, 'inventory-products.json'), JSON.stringify(items, null, 2));
fs.writeFileSync(path.join(dataDir, 'inventory-transactions.json'), JSON.stringify(inv, null, 2));

// Compute and display stock levels
const stock = {};
for (const item of items) stock[item['Item ID']] = { name: item['Name'], qty: 0 };
for (const tx of inv) {
  if (stock[tx['Item ID']]) stock[tx['Item ID']].qty += tx['Amount'] || 0;
}
console.log('\nComputed Stock Levels:');
for (const [id, info] of Object.entries(stock)) {
  console.log(`  ${id}: ${info.name} = ${info.qty}`);
}
console.log('\nDone! Files written.');
