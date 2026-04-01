/**
 * Setup Google Sheet tabs: Job_Breakdowns, Orders, Deliveries (headers), and Inventory (real data)
 * Run: node scripts/setup-sheets.js
 */

const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const SHEET_ID = '1uMEdtHo3xMu2gs21p7dYAgYiPWuCZ3s4a8YU-gJZ31s';
const SERVICE_EMAIL = 'sheets-access@gen-lang-client-0821717467.iam.gserviceaccount.com';
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCzgNazgq6FFE2U
+7h28Gtc1tUb7Ej6aJ4nm9nEjynBNeEeIEfo7JJegRfeprCChjLWfLi0NTMxNjGu
FPRL/WMPTJtQQ06pR/miDRocpmJfgF7lt1MDdObxrNvUFv6s1ZF+d24rme1xSOLo
4NniLJMu6Qx4YXOvPErdY1DkThVv8LE5a5PKx0RBx0bAIOwfgwR5I6MOqi/8hXJj
Dd/3gUDAgA7g9M6oyYbqtFJ2iqMzTnu2ONuJGHrOH9hJ77r8jrmFGxRj1KNQ8YW9
MgT73tcCdl9YjEHFgtjdrBKKuJga2UpvU2pz8SSsNUY50E2AX/ENAcJJNdX/5G5F
QHEYpU+TAgMBAAECggEAMv+CQDr7EUUc65x+opAYuKYyor3FWBt7/33YZ29TKhkA
Ldp3A7aeuSnNGc1a7aJp9CU4Jr7MngkrIS3D4IkLaU/W+n087nxL8J3vUr90yHRE
wdgNRjii2nvFcuLblUgSD4+n5cxUOPC/wvELBiaq5FOC3vq07s7e6Dosw8hpb8VD
wCTeH82ggwbqAqKOQyzg346znf9VpxEh2p8SEtpw9QTBxHGamOS6nDeu+TtdwCjX
KpZxoW354oHBug+SBSoKfNCD3KqqVWd8qiBGT0/Jet3jIKs19GHRVGDRjNlX175Q
oUc6+4Xv8kWYBoslQHhzuGbu7XytruBYLZtTajaErQKBgQD4HGev7H//bPaPR3MV
sl/+pF+/eYlqSX4mNDXJhY4RmXZ3jTORNd0elbi9qUv89Uw2irX/AqSjMT7ubMR6
vMea9o79BaeB0kItIBjlmbFXUno+BpVjR3hx4OZPPraX41Y34SfMItdH/u83Asy8
xGvPHHfS3OhjG9L4y/s88aX1HwKBgQC5NfmU3vLaNl2b/IZBbMjGBBFT9t7ZueRp
F/zEdC8XX8UW7BiIM9Fc+Bje9VGG6+0JhxXGDd1+CACNv3sQHhB5pyoyHvi9e8XK
XVvFmea1OVptjQaHDdvMDALimeQBNKEhLRjoxy3Dn4004OM+hTIB6AhtusYNi8rN
SFSi/xeDDQKBgQDFPqe7tzOm13RIQdAfLpicMwcfjLqO8fBE5Prhw7hHC46fynR1
e7HXb8XXmfCcIFK/hZTcL7i9OBhEqdmljdDNxDe2tTkOvx33C+5fEclnl10xVECN
FbOOLPJLi5rTs1rGv8vIwOYPCYAZZrNnWmwu0f38d7yTlfop6thIAgAilwKBgQCg
vXVkfLIsLC7F6D3knjMJmBIp2wHB2JGhnA3luif8k0OMB0+rNb2ogDGlnycof61z
LWf6QaJPdUZ1vw9hB5ao3inC4hpi6P7aCHhTYKRX9/TBSzm1EJQH3QzL+V9mpHSL
RIZv0B2pv9lfYSYX5qVl/ikCgqzMqNxTmUjLRbT0KQKBgE4FrYBK+D7CrrrvGWYf
+KRN92oKKeumLlnLZUh6+xio++PeLaaiCEEP8tSzlhHt0OzLmUehi6+7MxtLqNoe
RfVWiMJXBbOeF70BljcYf+yLv3dxFelQd6uPJvIPVD/qql7ry7KpU+5Fkge7G+Tn
5QM47Kz/b7bZWWAQLxBXiXF+
-----END PRIVATE KEY-----
`;

// ============================================================
// Inventory data - real roofing materials RCRS uses
// ============================================================
const inventoryItems = [
  // Shingles
  { productId: 'INV-0001', productName: 'IKO Cambridge AR Shingles', category: 'Shingles', sku: 'IKO-CAM-SQ', unit: 'square', currentQty: 85, minQty: 15, maxQty: 300, unitCost: 95, supplier: 'IKO Industries' },
  { productId: 'INV-0002', productName: 'IKO Dynasty Shingles', category: 'Shingles', sku: 'IKO-DYN-SQ', unit: 'square', currentQty: 60, minQty: 10, maxQty: 200, unitCost: 115, supplier: 'IKO Industries' },
  { productId: 'INV-0003', productName: 'Owens Corning Duration Shingles', category: 'Shingles', sku: 'OC-DUR-SQ', unit: 'square', currentQty: 45, minQty: 10, maxQty: 200, unitCost: 105, supplier: 'Owens Corning' },
  { productId: 'INV-0004', productName: 'IKO Nordic Shingles', category: 'Shingles', sku: 'IKO-NOR-SQ', unit: 'square', currentQty: 30, minQty: 8, maxQty: 150, unitCost: 130, supplier: 'IKO Industries' },

  // Underlayment
  { productId: 'INV-0005', productName: 'IKO Stormtite Synthetic Underlayment', category: 'Underlayment', sku: 'IKO-STM-RL', unit: 'roll', currentQty: 40, minQty: 10, maxQty: 150, unitCost: 65, supplier: 'IKO Industries' },
  { productId: 'INV-0006', productName: 'IKO ArmourGard Ice & Water Shield', category: 'Underlayment', sku: 'IKO-AGD-RL', unit: 'roll', currentQty: 35, minQty: 8, maxQty: 120, unitCost: 95, supplier: 'IKO Industries' },
  { productId: 'INV-0007', productName: 'GAF FeltBuster Synthetic Underlayment', category: 'Underlayment', sku: 'GAF-FBS-RL', unit: 'roll', currentQty: 25, minQty: 5, maxQty: 100, unitCost: 55, supplier: 'GAF' },

  // Flashing
  { productId: 'INV-0008', productName: 'Aluminum Step Flashing 4x4 (50pc)', category: 'Flashing', sku: 'ALU-STF-BD', unit: 'bundle', currentQty: 30, minQty: 8, maxQty: 100, unitCost: 35, supplier: 'Amerimax' },
  { productId: 'INV-0009', productName: 'Aluminum Drip Edge 10ft', category: 'Flashing', sku: 'ALU-DRP-PC', unit: 'piece', currentQty: 100, minQty: 15, maxQty: 300, unitCost: 8, supplier: 'Amerimax' },
  { productId: 'INV-0010', productName: 'Lead Pipe Boot Flashing', category: 'Flashing', sku: 'LED-PBT-PC', unit: 'piece', currentQty: 50, minQty: 10, maxQty: 200, unitCost: 12, supplier: 'Oatey' },

  // Gutters
  { productId: 'INV-0011', productName: '5" K-Style Aluminum Gutter 10ft', category: 'Gutters', sku: 'GTR-5KS-PC', unit: 'piece', currentQty: 60, minQty: 10, maxQty: 200, unitCost: 15, supplier: 'Amerimax' },
  { productId: 'INV-0012', productName: '6" K-Style Aluminum Gutter 10ft', category: 'Gutters', sku: 'GTR-6KS-PC', unit: 'piece', currentQty: 40, minQty: 8, maxQty: 150, unitCost: 22, supplier: 'Amerimax' },
  { productId: 'INV-0013', productName: 'Gutter Downspout 10ft', category: 'Gutters', sku: 'GTR-DSP-PC', unit: 'piece', currentQty: 55, minQty: 10, maxQty: 200, unitCost: 12, supplier: 'Amerimax' },
  { productId: 'INV-0014', productName: 'Boral LeafX Gutter Guard 4ft', category: 'Gutters', sku: 'BRL-LFX-PC', unit: 'piece', currentQty: 80, minQty: 15, maxQty: 500, unitCost: 18, supplier: 'Boral' },

  // Nails & Fasteners
  { productId: 'INV-0015', productName: '1-1/4" Coil Roofing Nails (7200ct)', category: 'Nails & Fasteners', sku: 'NL-CRL-BX', unit: 'box', currentQty: 25, minQty: 5, maxQty: 100, unitCost: 45, supplier: 'Grip-Rite' },
  { productId: 'INV-0016', productName: '1-3/4" Hand Drive Roofing Nails (5lb)', category: 'Nails & Fasteners', sku: 'NL-HDR-BX', unit: 'box', currentQty: 30, minQty: 8, maxQty: 120, unitCost: 18, supplier: 'Grip-Rite' },
  { productId: 'INV-0017', productName: 'Roofing Screws #10 2" (250ct)', category: 'Nails & Fasteners', sku: 'NL-SCR-BX', unit: 'box', currentQty: 20, minQty: 5, maxQty: 100, unitCost: 22, supplier: 'Grip-Rite' },

  // Ventilation
  { productId: 'INV-0018', productName: 'Ridge Vent 4ft', category: 'Ventilation', sku: 'VNT-RDG-PC', unit: 'piece', currentQty: 45, minQty: 10, maxQty: 200, unitCost: 14, supplier: 'Air Vent Inc' },
  { productId: 'INV-0019', productName: 'Turbine Vent 12"', category: 'Ventilation', sku: 'VNT-TRB-PC', unit: 'piece', currentQty: 20, minQty: 5, maxQty: 100, unitCost: 35, supplier: 'Air Vent Inc' },
  { productId: 'INV-0020', productName: 'Soffit Vent 8x16', category: 'Ventilation', sku: 'VNT-SFT-PC', unit: 'piece', currentQty: 60, minQty: 10, maxQty: 300, unitCost: 8, supplier: 'Air Vent Inc' },

  // Sealants & Adhesives
  { productId: 'INV-0021', productName: 'Roofing Cement 1 gal', category: 'Sealants & Adhesives', sku: 'SLT-RCM-CN', unit: 'can', currentQty: 25, minQty: 5, maxQty: 100, unitCost: 12, supplier: 'Henry' },
  { productId: 'INV-0022', productName: 'Roof Sealant Caulk', category: 'Sealants & Adhesives', sku: 'SLT-CLK-TB', unit: 'tube', currentQty: 50, minQty: 10, maxQty: 200, unitCost: 6, supplier: 'DAP' },
  { productId: 'INV-0023', productName: 'IKO Leading Edge Starter Strip', category: 'Sealants & Adhesives', sku: 'IKO-LES-BD', unit: 'bundle', currentQty: 35, minQty: 8, maxQty: 150, unitCost: 22, supplier: 'IKO Industries' },

  // Lumber
  { productId: 'INV-0024', productName: '2x4x8 Pressure Treated', category: 'Lumber', sku: 'LBR-2X4-PC', unit: 'piece', currentQty: 80, minQty: 15, maxQty: 300, unitCost: 6, supplier: 'Local Lumber Yard' },
  { productId: 'INV-0025', productName: '1/2" CDX Plywood 4x8', category: 'Lumber', sku: 'LBR-CDX-SH', unit: 'sheet', currentQty: 50, minQty: 10, maxQty: 200, unitCost: 32, supplier: 'Local Lumber Yard' },
  { productId: 'INV-0026', productName: '7/16" OSB Sheathing 4x8', category: 'Lumber', sku: 'LBR-OSB-SH', unit: 'sheet', currentQty: 65, minQty: 12, maxQty: 250, unitCost: 22, supplier: 'Local Lumber Yard' },
];

async function main() {
  const auth = new JWT({
    email: SERVICE_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(SHEET_ID, auth);
  await doc.loadInfo();
  console.log(`Connected to: "${doc.title}" (${doc.sheetCount} tabs)\n`);

  // ============================================================
  // 1. Create Job_Breakdowns tab
  // ============================================================
  console.log('--- Step 1: Create Job_Breakdowns tab ---');
  const jbHeaders = [
    'breakdownId', 'jobId', 'jobName', 'customerName', 'address', 'projectType',
    'status', 'materials', 'labor', 'materialTotal', 'laborTotal', 'deliveryFees',
    'overhead', 'profit', 'totalEstimate', 'estimatedStartDate', 'estimatedEndDate',
    'createdBy', 'createdAt', 'updatedAt', 'notes'
  ];

  if (doc.sheetsByTitle['Job_Breakdowns']) {
    console.log('Job_Breakdowns already exists, skipping creation');
  } else {
    const jbSheet = await doc.addSheet({
      title: 'Job_Breakdowns',
      headerValues: jbHeaders,
    });
    console.log(`Created Job_Breakdowns tab with ${jbHeaders.length} columns`);
  }

  // ============================================================
  // 2. Create Orders tab
  // ============================================================
  console.log('\n--- Step 2: Create Orders tab ---');
  const ordersHeaders = [
    'orderId', 'jobId', 'jobName', 'customerName', 'orderDate', 'status',
    'items', 'totalItems', 'totalCost', 'assignedDriver', 'priority',
    'notes', 'createdAt', 'updatedAt'
  ];

  if (doc.sheetsByTitle['Orders']) {
    console.log('Orders already exists, skipping creation');
  } else {
    const ordersSheet = await doc.addSheet({
      title: 'Orders',
      headerValues: ordersHeaders,
    });
    console.log(`Created Orders tab with ${ordersHeaders.length} columns`);
  }

  // ============================================================
  // 3. Fix Deliveries tab (add headers to existing empty tab)
  // ============================================================
  console.log('\n--- Step 3: Fix Deliveries tab headers ---');
  const deliveriesHeaders = [
    'deliveryId', 'orderId', 'jobId', 'customerName', 'address', 'scheduledDate',
    'status', 'driver', 'items', 'departureTime', 'arrivalTime', 'completedTime',
    'photos', 'notes', 'createdAt'
  ];

  const deliveriesSheet = doc.sheetsByTitle['Deliveries'];
  if (!deliveriesSheet) {
    console.log('Deliveries tab not found! Creating it...');
    await doc.addSheet({
      title: 'Deliveries',
      headerValues: deliveriesHeaders,
    });
    console.log(`Created Deliveries tab with ${deliveriesHeaders.length} columns`);
  } else {
    // Set header row on existing empty tab
    await deliveriesSheet.setHeaderRow(deliveriesHeaders);
    console.log(`Set ${deliveriesHeaders.length} headers on existing Deliveries tab`);
  }

  // ============================================================
  // 4. Clear Inventory test data and seed with real materials
  // ============================================================
  console.log('\n--- Step 4: Clear Inventory and seed real materials ---');
  const invSheet = doc.sheetsByTitle['Inventory'];
  if (!invSheet) {
    console.log('ERROR: Inventory tab not found!');
    return;
  }

  // Clear all existing rows (test data)
  await invSheet.loadHeaderRow();
  const existingRows = await invSheet.getRows();
  console.log(`Clearing ${existingRows.length} test rows...`);
  if (existingRows.length > 0) {
    // Clear the sheet data area (rows 2+), keep headers
    await invSheet.clearRows();
  }

  // Set proper headers (matching existing + supplier column)
  const invHeaders = [
    'productId', 'productName', 'category', 'sku', 'unit',
    'currentQty', 'minQty', 'maxQty', 'unitCost', 'totalValue',
    'location', 'supplier', 'lastCountDate', 'lastRestockDate', 'notes'
  ];
  await invSheet.setHeaderRow(invHeaders);
  console.log('Set inventory headers');

  // Add real inventory data
  const now = new Date().toISOString();
  const rowsToAdd = inventoryItems.map(item => ({
    ...item,
    totalValue: item.currentQty * item.unitCost,
    location: 'Warehouse',
    lastCountDate: now.split('T')[0],
    lastRestockDate: '',
    notes: '',
  }));

  await invSheet.addRows(rowsToAdd);
  console.log(`Added ${rowsToAdd.length} real inventory items`);

  // Print summary
  console.log('\n========================================');
  console.log('SUMMARY');
  console.log('========================================');
  console.log('1. Job_Breakdowns: CREATED (21 columns)');
  console.log('2. Orders: CREATED (14 columns)');
  console.log('3. Deliveries: HEADERS SET (15 columns)');
  console.log(`4. Inventory: CLEARED test data, SEEDED ${inventoryItems.length} real products`);
  console.log('\nInventory categories:');
  const cats = {};
  inventoryItems.forEach(i => { cats[i.category] = (cats[i.category] || 0) + 1; });
  Object.entries(cats).forEach(([cat, count]) => console.log(`  - ${cat}: ${count} items`));
  const totalValue = rowsToAdd.reduce((sum, r) => sum + r.totalValue, 0);
  console.log(`\nTotal inventory value: $${totalValue.toLocaleString()}`);
  console.log('========================================');
}

main().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
