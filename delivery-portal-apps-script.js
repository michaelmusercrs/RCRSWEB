/**
 * River City Roofing - Delivery & Warehouse Portal
 * Google Apps Script for managing deliveries, inventory, and job materials
 *
 * SETUP:
 * 1. Create a new Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. Paste this code
 * 4. Run setupAllSheets() once to create all tabs
 * 5. Deploy as Web App (Execute as: Me, Who has access: Anyone)
 * 6. Connect to AppSheet for mobile access
 */

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  SPREADSHEET_ID: '', // Leave empty to use the bound spreadsheet, or paste a specific ID
  NOTIFICATION_EMAIL: 'rcs@rivercityroofingsolutions.com',
  COMPANY_NAME: 'River City Roofing Solutions',

  // Sheet Names
  SHEETS: {
    INVENTORY: 'Inventory',
    ORDERS: 'Material Orders',
    DELIVERIES: 'Deliveries',
    DELIVERY_PHOTOS: 'Delivery Photos',
    INVENTORY_COUNTS: 'Inventory Counts',
    RESTOCK_REQUESTS: 'Restock Requests',
    DRIVERS: 'Drivers',
    PRODUCTS: 'Products',
    SUPPLIERS: 'Suppliers',
    JOB_COSTS: 'Job Costs'
  }
};

// ============================================
// SPREADSHEET SETUP
// ============================================

function getSpreadsheet() {
  if (CONFIG.SPREADSHEET_ID) {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Run this once to set up all sheets with proper headers
 */
function setupAllSheets() {
  const ss = getSpreadsheet();

  // Inventory Sheet
  createOrUpdateSheet(ss, CONFIG.SHEETS.INVENTORY, [
    'Product ID', 'Product Name', 'Category', 'SKU', 'Unit',
    'Current Qty', 'Min Qty', 'Max Qty', 'Unit Cost', 'Total Value',
    'Location', 'Supplier', 'Last Count Date', 'Last Restock Date', 'Notes'
  ]);

  // Material Orders Sheet (from JobNimbus)
  createOrUpdateSheet(ss, CONFIG.SHEETS.ORDERS, [
    'Order ID', 'Order Date', 'Job Name', 'Job Address', 'Customer Name',
    'Customer Phone', 'Project Manager', 'PM Email', 'PM Phone',
    'Materials Needed', 'Special Instructions', 'Requested Delivery Date',
    'Priority', 'Status', 'Assigned Driver', 'Created By', 'JobNimbus ID'
  ]);

  // Deliveries Sheet
  createOrUpdateSheet(ss, CONFIG.SHEETS.DELIVERIES, [
    'Delivery ID', 'Order ID', 'Driver', 'Status', 'Scheduled Date', 'Scheduled Time',
    'Job Name', 'Job Address', 'Customer Name', 'Customer Phone',
    'Materials', 'Load Confirmed', 'Load Confirmed Time', 'Load Confirmed By',
    'Departed Time', 'Arrived Time', 'Delivered Time',
    'Delivery Notes', 'Customer Signature', 'Photo Count', 'GPS Coordinates'
  ]);

  // Delivery Photos Sheet
  createOrUpdateSheet(ss, CONFIG.SHEETS.DELIVERY_PHOTOS, [
    'Photo ID', 'Delivery ID', 'Order ID', 'Job Name', 'Photo Type',
    'Photo URL', 'Uploaded By', 'Upload Time', 'Description', 'GPS Location'
  ]);

  // Inventory Counts Sheet (weekly counts)
  createOrUpdateSheet(ss, CONFIG.SHEETS.INVENTORY_COUNTS, [
    'Count ID', 'Count Date', 'Counted By', 'Product ID', 'Product Name',
    'Expected Qty', 'Actual Qty', 'Variance', 'Variance %', 'Notes', 'Approved By'
  ]);

  // Restock Requests Sheet
  createOrUpdateSheet(ss, CONFIG.SHEETS.RESTOCK_REQUESTS, [
    'Request ID', 'Request Date', 'Requested By', 'Product ID', 'Product Name',
    'Current Qty', 'Requested Qty', 'Supplier', 'Priority', 'Status',
    'Approved By', 'Approved Date', 'PO Number', 'Expected Delivery', 'Received Date', 'Notes'
  ]);

  // Drivers Sheet
  createOrUpdateSheet(ss, CONFIG.SHEETS.DRIVERS, [
    'Driver ID', 'Name', 'Phone', 'Email', 'Vehicle', 'License Plate',
    'Status', 'Current Location', 'Deliveries Today', 'Deliveries This Week',
    'Avg Delivery Time', 'On Time %', 'Notes'
  ]);

  // Products Catalog Sheet
  createOrUpdateSheet(ss, CONFIG.SHEETS.PRODUCTS, [
    'Product ID', 'Product Name', 'Category', 'SKU', 'Barcode',
    'Description', 'Unit', 'Cost', 'Markup %', 'Sell Price',
    'Supplier', 'Supplier SKU', 'Lead Time Days', 'Active'
  ]);

  // Suppliers Sheet
  createOrUpdateSheet(ss, CONFIG.SHEETS.SUPPLIERS, [
    'Supplier ID', 'Company Name', 'Contact Name', 'Phone', 'Email',
    'Address', 'Account Number', 'Payment Terms', 'Notes'
  ]);

  // Job Costs Sheet (for manager analytics)
  createOrUpdateSheet(ss, CONFIG.SHEETS.JOB_COSTS, [
    'Job ID', 'Job Name', 'Job Address', 'Customer', 'Start Date', 'End Date',
    'Total Material Cost', 'Total Delivery Cost', 'Labor Cost', 'Total Cost',
    'Contract Price', 'Profit', 'Profit %', 'Deliveries Count', 'Notes'
  ]);

  // Add sample data
  addSampleProducts(ss);
  addSampleDrivers(ss);

  Logger.log('All sheets created successfully!');
  return 'Setup complete! All sheets have been created.';
}

function createOrUpdateSheet(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  // Set headers
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#1a5f2a'); // Green header
  headerRange.setFontColor('#ffffff');

  // Freeze header row
  sheet.setFrozenRows(1);

  // Auto-resize columns
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }

  return sheet;
}

function addSampleProducts(ss) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PRODUCTS);
  if (sheet.getLastRow() > 1) return; // Already has data

  const products = [
    ['P001', 'OC Duration Shingles - Onyx Black', 'Shingles', 'OC-DUR-ONX', '', 'Owens Corning Duration architectural shingles', 'Bundle', 32.50, 25, 40.63, 'ABC Supply', 'ABC-12345', 2, 'Yes'],
    ['P002', 'OC Duration Shingles - Estate Gray', 'Shingles', 'OC-DUR-GRY', '', 'Owens Corning Duration architectural shingles', 'Bundle', 32.50, 25, 40.63, 'ABC Supply', 'ABC-12346', 2, 'Yes'],
    ['P003', 'Ice & Water Shield', 'Underlayment', 'IWS-200', '', 'Self-adhering waterproofing underlayment', 'Roll', 85.00, 30, 110.50, 'ABC Supply', 'ABC-22001', 2, 'Yes'],
    ['P004', 'Synthetic Underlayment', 'Underlayment', 'SYN-UL-4', '', '4-square synthetic underlayment', 'Roll', 45.00, 25, 56.25, 'ABC Supply', 'ABC-22002', 2, 'Yes'],
    ['P005', 'Ridge Vent - 4ft', 'Ventilation', 'RV-4FT', '', '4-foot ridge vent section', 'Piece', 12.50, 30, 16.25, 'ABC Supply', 'ABC-33001', 3, 'Yes'],
    ['P006', 'Drip Edge - White 10ft', 'Metal', 'DE-WHT-10', '', '10-foot white drip edge', 'Piece', 8.00, 25, 10.00, 'ABC Supply', 'ABC-44001', 1, 'Yes'],
    ['P007', 'Roofing Nails 1.25"', 'Fasteners', 'RN-125', '', 'Coil roofing nails 1-1/4 inch', 'Box', 45.00, 20, 54.00, 'Home Depot', 'HD-55001', 1, 'Yes'],
    ['P008', 'Pipe Boot - 2"', 'Flashing', 'PB-2IN', '', '2-inch pipe boot flashing', 'Each', 15.00, 30, 19.50, 'ABC Supply', 'ABC-66001', 2, 'Yes'],
    ['P009', 'Starter Strip', 'Shingles', 'SS-UNIV', '', 'Universal starter strip shingles', 'Bundle', 28.00, 25, 35.00, 'ABC Supply', 'ABC-12400', 2, 'Yes'],
    ['P010', 'Hip & Ridge Shingles', 'Shingles', 'HR-BLK', '', 'Hip and ridge cap shingles - black', 'Bundle', 55.00, 25, 68.75, 'ABC Supply', 'ABC-12500', 2, 'Yes']
  ];

  if (products.length > 0) {
    sheet.getRange(2, 1, products.length, products[0].length).setValues(products);
  }
}

function addSampleDrivers(ss) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.DRIVERS);
  if (sheet.getLastRow() > 1) return; // Already has data

  const drivers = [
    ['D001', 'Sample Driver 1', '256-555-0001', 'driver1@rcrs.com', 'Ford F-350', 'ABC-1234', 'Available', '', 0, 0, '', '', ''],
    ['D002', 'Sample Driver 2', '256-555-0002', 'driver2@rcrs.com', 'Chevy 3500', 'XYZ-5678', 'Available', '', 0, 0, '', '', '']
  ];

  if (drivers.length > 0) {
    sheet.getRange(2, 1, drivers.length, drivers[0].length).setValues(drivers);
  }
}


// ============================================
// WEB APP - HANDLES ALL REQUESTS
// ============================================

function doGet(e) {
  const action = e.parameter.action || 'status';

  try {
    switch (action) {
      case 'status':
        return jsonResponse({ status: 'online', message: 'Delivery Portal API is running' });

      case 'getDeliveries':
        return jsonResponse(getDeliveries(e.parameter.driverId, e.parameter.status));

      case 'getInventory':
        return jsonResponse(getInventory(e.parameter.category));

      case 'getOrders':
        return jsonResponse(getOrders(e.parameter.status));

      case 'getDrivers':
        return jsonResponse(getDrivers());

      case 'getDashboard':
        return jsonResponse(getManagerDashboard());

      case 'getLowStock':
        return jsonResponse(getLowStockItems());

      default:
        return jsonResponse({ error: 'Unknown action: ' + action });
    }
  } catch (error) {
    return jsonResponse({ error: error.toString() });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    switch (action) {
      // Material Orders
      case 'createOrder':
        return jsonResponse(createMaterialOrder(data));

      case 'updateOrderStatus':
        return jsonResponse(updateOrderStatus(data.orderId, data.status));

      // Deliveries
      case 'createDelivery':
        return jsonResponse(createDelivery(data));

      case 'confirmLoad':
        return jsonResponse(confirmLoad(data.deliveryId, data.driverName));

      case 'updateDeliveryStatus':
        return jsonResponse(updateDeliveryStatus(data.deliveryId, data.status, data.notes));

      case 'completeDelivery':
        return jsonResponse(completeDelivery(data));

      case 'addDeliveryPhoto':
        return jsonResponse(addDeliveryPhoto(data));

      // Inventory
      case 'updateInventory':
        return jsonResponse(updateInventoryQty(data.productId, data.qty, data.reason));

      case 'submitCount':
        return jsonResponse(submitInventoryCount(data));

      case 'requestRestock':
        return jsonResponse(requestRestock(data));

      case 'approveRestock':
        return jsonResponse(approveRestock(data.requestId, data.approvedBy));

      // Drivers
      case 'updateDriverStatus':
        return jsonResponse(updateDriverStatus(data.driverId, data.status, data.location));

      default:
        return jsonResponse({ error: 'Unknown action: ' + action });
    }
  } catch (error) {
    return jsonResponse({ error: error.toString() });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


// ============================================
// MATERIAL ORDERS (from Project Manager)
// ============================================

function createMaterialOrder(data) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.ORDERS);

  const orderId = 'ORD-' + Utilities.formatDate(new Date(), 'America/Chicago', 'yyyyMMdd') + '-' + (sheet.getLastRow());
  const timestamp = new Date();

  const row = [
    orderId,
    timestamp,
    data.jobName || '',
    data.jobAddress || '',
    data.customerName || '',
    data.customerPhone || '',
    data.projectManager || '',
    data.pmEmail || '',
    data.pmPhone || '',
    data.materials || '',
    data.specialInstructions || '',
    data.requestedDeliveryDate || '',
    data.priority || 'Normal',
    'Pending',
    '',
    data.createdBy || '',
    data.jobnimbusId || ''
  ];

  sheet.appendRow(row);

  // Send notification email
  sendOrderNotification(orderId, data);

  return {
    success: true,
    orderId: orderId,
    message: 'Material order created successfully'
  };
}

function getOrders(status) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.ORDERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const orders = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const order = {};
    headers.forEach((header, index) => {
      order[header] = row[index];
    });

    if (!status || order['Status'] === status) {
      orders.push(order);
    }
  }

  return orders;
}

function updateOrderStatus(orderId, newStatus) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.ORDERS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === orderId) {
      sheet.getRange(i + 1, 14).setValue(newStatus); // Status column
      return { success: true, message: 'Order status updated' };
    }
  }

  return { success: false, error: 'Order not found' };
}

function sendOrderNotification(orderId, data) {
  const subject = `New Material Order: ${orderId} - ${data.jobName}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <div style="background: #1a5f2a; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">New Material Order</h1>
      </div>
      <div style="padding: 20px; background: #f5f5f5;">
        <h2 style="color: #1a5f2a;">Order #${orderId}</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Job Name:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.jobName}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Address:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.jobAddress}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Customer:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.customerName} - ${data.customerPhone}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Project Manager:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.projectManager}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Requested Delivery:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.requestedDeliveryDate}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Priority:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.priority}</td></tr>
        </table>
        <h3 style="color: #1a5f2a; margin-top: 20px;">Materials Needed:</h3>
        <div style="background: white; padding: 15px; border-radius: 5px;">${data.materials}</div>
        ${data.specialInstructions ? `<h3 style="color: #1a5f2a; margin-top: 20px;">Special Instructions:</h3><div style="background: white; padding: 15px; border-radius: 5px;">${data.specialInstructions}</div>` : ''}
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: CONFIG.NOTIFICATION_EMAIL,
    subject: subject,
    htmlBody: html
  });
}


// ============================================
// DELIVERIES (for Drivers)
// ============================================

function createDelivery(data) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.DELIVERIES);

  const deliveryId = 'DEL-' + Utilities.formatDate(new Date(), 'America/Chicago', 'yyyyMMdd') + '-' + (sheet.getLastRow());

  const row = [
    deliveryId,
    data.orderId || '',
    data.driver || '',
    'Scheduled',
    data.scheduledDate || '',
    data.scheduledTime || '',
    data.jobName || '',
    data.jobAddress || '',
    data.customerName || '',
    data.customerPhone || '',
    data.materials || '',
    'No', // Load Confirmed
    '', // Load Confirmed Time
    '', // Load Confirmed By
    '', // Departed Time
    '', // Arrived Time
    '', // Delivered Time
    '', // Delivery Notes
    '', // Customer Signature
    0,  // Photo Count
    ''  // GPS Coordinates
  ];

  sheet.appendRow(row);

  // Update order status
  if (data.orderId) {
    updateOrderStatus(data.orderId, 'Delivery Scheduled');
  }

  return {
    success: true,
    deliveryId: deliveryId,
    message: 'Delivery created successfully'
  };
}

function getDeliveries(driverId, status) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.DELIVERIES);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const deliveries = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const delivery = {};
    headers.forEach((header, index) => {
      delivery[header] = row[index];
    });

    const matchesDriver = !driverId || delivery['Driver'] === driverId;
    const matchesStatus = !status || delivery['Status'] === status;

    if (matchesDriver && matchesStatus) {
      deliveries.push(delivery);
    }
  }

  return deliveries;
}

function confirmLoad(deliveryId, driverName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.DELIVERIES);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === deliveryId) {
      const now = new Date();
      sheet.getRange(i + 1, 12).setValue('Yes'); // Load Confirmed
      sheet.getRange(i + 1, 13).setValue(now);   // Load Confirmed Time
      sheet.getRange(i + 1, 14).setValue(driverName); // Load Confirmed By
      sheet.getRange(i + 1, 4).setValue('Loaded'); // Status
      return { success: true, message: 'Load confirmed' };
    }
  }

  return { success: false, error: 'Delivery not found' };
}

function updateDeliveryStatus(deliveryId, status, notes) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.DELIVERIES);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === deliveryId) {
      const now = new Date();
      sheet.getRange(i + 1, 4).setValue(status); // Status

      if (status === 'En Route') {
        sheet.getRange(i + 1, 15).setValue(now); // Departed Time
      } else if (status === 'Arrived') {
        sheet.getRange(i + 1, 16).setValue(now); // Arrived Time
      }

      if (notes) {
        sheet.getRange(i + 1, 18).setValue(notes); // Delivery Notes
      }

      return { success: true, message: 'Delivery status updated to ' + status };
    }
  }

  return { success: false, error: 'Delivery not found' };
}

function completeDelivery(data) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.DELIVERIES);
  const sheetData = sheet.getDataRange().getValues();

  for (let i = 1; i < sheetData.length; i++) {
    if (sheetData[i][0] === data.deliveryId) {
      const now = new Date();
      sheet.getRange(i + 1, 4).setValue('Delivered'); // Status
      sheet.getRange(i + 1, 17).setValue(now); // Delivered Time
      sheet.getRange(i + 1, 18).setValue(data.notes || ''); // Delivery Notes
      sheet.getRange(i + 1, 19).setValue(data.signature || ''); // Customer Signature
      sheet.getRange(i + 1, 21).setValue(data.gps || ''); // GPS Coordinates

      // Update order status
      const orderId = sheetData[i][1];
      if (orderId) {
        updateOrderStatus(orderId, 'Delivered');
      }

      // Send completion notification
      sendDeliveryCompletionEmail(data.deliveryId, sheetData[i]);

      return { success: true, message: 'Delivery completed successfully' };
    }
  }

  return { success: false, error: 'Delivery not found' };
}

function addDeliveryPhoto(data) {
  const ss = getSpreadsheet();
  const photoSheet = ss.getSheetByName(CONFIG.SHEETS.DELIVERY_PHOTOS);
  const deliverySheet = ss.getSheetByName(CONFIG.SHEETS.DELIVERIES);

  const photoId = 'PHT-' + Utilities.formatDate(new Date(), 'America/Chicago', 'yyyyMMddHHmmss');

  const row = [
    photoId,
    data.deliveryId || '',
    data.orderId || '',
    data.jobName || '',
    data.photoType || 'Delivery', // Types: Load, Delivery, Job Site, Before, After
    data.photoUrl || '',
    data.uploadedBy || '',
    new Date(),
    data.description || '',
    data.gps || ''
  ];

  photoSheet.appendRow(row);

  // Update photo count on delivery
  const deliveryData = deliverySheet.getDataRange().getValues();
  for (let i = 1; i < deliveryData.length; i++) {
    if (deliveryData[i][0] === data.deliveryId) {
      const currentCount = deliveryData[i][19] || 0;
      deliverySheet.getRange(i + 1, 20).setValue(currentCount + 1);
      break;
    }
  }

  return {
    success: true,
    photoId: photoId,
    message: 'Photo added successfully'
  };
}

function sendDeliveryCompletionEmail(deliveryId, deliveryRow) {
  const subject = `Delivery Completed: ${deliveryId} - ${deliveryRow[6]}`; // Job Name

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <div style="background: #1a5f2a; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">Delivery Completed</h1>
      </div>
      <div style="padding: 20px; background: #f5f5f5;">
        <h2 style="color: #1a5f2a;">Delivery #${deliveryId}</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Job:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${deliveryRow[6]}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Address:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${deliveryRow[7]}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Driver:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${deliveryRow[2]}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Delivered At:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${deliveryRow[16]}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Photos:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${deliveryRow[19]} uploaded</td></tr>
        </table>
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: CONFIG.NOTIFICATION_EMAIL,
    subject: subject,
    htmlBody: html
  });
}


// ============================================
// INVENTORY MANAGEMENT
// ============================================

function getInventory(category) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.INVENTORY);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const inventory = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index];
    });

    if (!category || item['Category'] === category) {
      inventory.push(item);
    }
  }

  return inventory;
}

function getLowStockItems() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.INVENTORY);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const lowStock = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const currentQty = row[5]; // Current Qty
    const minQty = row[6];     // Min Qty

    if (currentQty <= minQty) {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = row[index];
      });
      item['Shortage'] = minQty - currentQty;
      lowStock.push(item);
    }
  }

  return lowStock;
}

function updateInventoryQty(productId, qtyChange, reason) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.INVENTORY);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === productId) {
      const currentQty = data[i][5] || 0;
      const newQty = currentQty + qtyChange;
      const unitCost = data[i][8] || 0;

      sheet.getRange(i + 1, 6).setValue(newQty); // Current Qty
      sheet.getRange(i + 1, 10).setValue(newQty * unitCost); // Total Value

      // Check if now low stock
      const minQty = data[i][6];
      if (newQty <= minQty) {
        // Could trigger automatic restock request here
      }

      return {
        success: true,
        productId: productId,
        previousQty: currentQty,
        newQty: newQty,
        message: 'Inventory updated'
      };
    }
  }

  return { success: false, error: 'Product not found' };
}

function submitInventoryCount(data) {
  const ss = getSpreadsheet();
  const countSheet = ss.getSheetByName(CONFIG.SHEETS.INVENTORY_COUNTS);
  const invSheet = ss.getSheetByName(CONFIG.SHEETS.INVENTORY);

  const countId = 'CNT-' + Utilities.formatDate(new Date(), 'America/Chicago', 'yyyyMMdd-HHmmss');
  const now = new Date();

  // Get current expected qty from inventory
  const invData = invSheet.getDataRange().getValues();
  let expectedQty = 0;
  let productName = '';
  let rowIndex = -1;

  for (let i = 1; i < invData.length; i++) {
    if (invData[i][0] === data.productId) {
      expectedQty = invData[i][5] || 0;
      productName = invData[i][1];
      rowIndex = i;
      break;
    }
  }

  const variance = data.actualQty - expectedQty;
  const variancePercent = expectedQty > 0 ? ((variance / expectedQty) * 100).toFixed(2) : 0;

  const row = [
    countId,
    now,
    data.countedBy || '',
    data.productId,
    productName,
    expectedQty,
    data.actualQty,
    variance,
    variancePercent + '%',
    data.notes || '',
    ''
  ];

  countSheet.appendRow(row);

  // Update inventory with actual count
  if (rowIndex > 0) {
    invSheet.getRange(rowIndex + 1, 6).setValue(data.actualQty); // Current Qty
    invSheet.getRange(rowIndex + 1, 13).setValue(now); // Last Count Date
  }

  return {
    success: true,
    countId: countId,
    variance: variance,
    message: 'Count submitted successfully'
  };
}

function requestRestock(data) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.RESTOCK_REQUESTS);

  const requestId = 'RST-' + Utilities.formatDate(new Date(), 'America/Chicago', 'yyyyMMdd') + '-' + (sheet.getLastRow());
  const now = new Date();

  const row = [
    requestId,
    now,
    data.requestedBy || '',
    data.productId || '',
    data.productName || '',
    data.currentQty || 0,
    data.requestedQty || 0,
    data.supplier || '',
    data.priority || 'Normal',
    'Pending',
    '', // Approved By
    '', // Approved Date
    '', // PO Number
    '', // Expected Delivery
    '', // Received Date
    data.notes || ''
  ];

  sheet.appendRow(row);

  // Send notification
  sendRestockRequestEmail(requestId, data);

  return {
    success: true,
    requestId: requestId,
    message: 'Restock request submitted'
  };
}

function approveRestock(requestId, approvedBy) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.RESTOCK_REQUESTS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === requestId) {
      sheet.getRange(i + 1, 10).setValue('Approved'); // Status
      sheet.getRange(i + 1, 11).setValue(approvedBy); // Approved By
      sheet.getRange(i + 1, 12).setValue(new Date()); // Approved Date
      return { success: true, message: 'Restock request approved' };
    }
  }

  return { success: false, error: 'Request not found' };
}

function sendRestockRequestEmail(requestId, data) {
  const subject = `Restock Request: ${requestId} - ${data.productName}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <div style="background: #d97706; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">Restock Request</h1>
      </div>
      <div style="padding: 20px; background: #f5f5f5;">
        <h2 style="color: #d97706;">Request #${requestId}</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Product:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.productName}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Current Qty:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.currentQty}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Requested Qty:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.requestedQty}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Supplier:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.supplier}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Priority:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.priority}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Requested By:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.requestedBy}</td></tr>
        </table>
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: CONFIG.NOTIFICATION_EMAIL,
    subject: subject,
    htmlBody: html
  });
}


// ============================================
// DRIVERS
// ============================================

function getDrivers() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.DRIVERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const drivers = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const driver = {};
    headers.forEach((header, index) => {
      driver[header] = row[index];
    });
    drivers.push(driver);
  }

  return drivers;
}

function updateDriverStatus(driverId, status, location) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.DRIVERS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === driverId) {
      sheet.getRange(i + 1, 7).setValue(status); // Status
      if (location) {
        sheet.getRange(i + 1, 8).setValue(location); // Current Location
      }
      return { success: true, message: 'Driver status updated' };
    }
  }

  return { success: false, error: 'Driver not found' };
}


// ============================================
// MANAGER DASHBOARD
// ============================================

function getManagerDashboard() {
  const ss = getSpreadsheet();

  // Get delivery stats
  const deliverySheet = ss.getSheetByName(CONFIG.SHEETS.DELIVERIES);
  const deliveryData = deliverySheet.getDataRange().getValues();

  let todayDeliveries = 0;
  let completedToday = 0;
  let inProgress = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i < deliveryData.length; i++) {
    const scheduledDate = new Date(deliveryData[i][4]);
    scheduledDate.setHours(0, 0, 0, 0);

    if (scheduledDate.getTime() === today.getTime()) {
      todayDeliveries++;
      if (deliveryData[i][3] === 'Delivered') {
        completedToday++;
      } else if (['Loaded', 'En Route', 'Arrived'].includes(deliveryData[i][3])) {
        inProgress++;
      }
    }
  }

  // Get inventory stats
  const invSheet = ss.getSheetByName(CONFIG.SHEETS.INVENTORY);
  const invData = invSheet.getDataRange().getValues();

  let totalValue = 0;
  let lowStockCount = 0;

  for (let i = 1; i < invData.length; i++) {
    totalValue += invData[i][9] || 0; // Total Value
    if ((invData[i][5] || 0) <= (invData[i][6] || 0)) {
      lowStockCount++;
    }
  }

  // Get pending orders
  const orderSheet = ss.getSheetByName(CONFIG.SHEETS.ORDERS);
  const orderData = orderSheet.getDataRange().getValues();

  let pendingOrders = 0;
  for (let i = 1; i < orderData.length; i++) {
    if (orderData[i][13] === 'Pending') {
      pendingOrders++;
    }
  }

  // Get pending restock requests
  const restockSheet = ss.getSheetByName(CONFIG.SHEETS.RESTOCK_REQUESTS);
  const restockData = restockSheet.getDataRange().getValues();

  let pendingRestocks = 0;
  for (let i = 1; i < restockData.length; i++) {
    if (restockData[i][9] === 'Pending') {
      pendingRestocks++;
    }
  }

  return {
    deliveries: {
      todayTotal: todayDeliveries,
      completedToday: completedToday,
      inProgress: inProgress,
      pending: todayDeliveries - completedToday - inProgress
    },
    inventory: {
      totalValue: totalValue.toFixed(2),
      lowStockItems: lowStockCount,
      totalProducts: invData.length - 1
    },
    orders: {
      pending: pendingOrders
    },
    restocks: {
      pending: pendingRestocks
    }
  };
}


// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate a simple report for a date range
 */
function generateDeliveryReport(startDate, endDate) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.DELIVERIES);
  const data = sheet.getDataRange().getValues();

  const start = new Date(startDate);
  const end = new Date(endDate);

  let totalDeliveries = 0;
  let onTimeDeliveries = 0;
  const driverStats = {};

  for (let i = 1; i < data.length; i++) {
    const deliveryDate = new Date(data[i][16]); // Delivered Time

    if (deliveryDate >= start && deliveryDate <= end && data[i][3] === 'Delivered') {
      totalDeliveries++;

      const driver = data[i][2];
      if (!driverStats[driver]) {
        driverStats[driver] = { total: 0, onTime: 0 };
      }
      driverStats[driver].total++;

      // Check if on time (simplified - delivered on scheduled date)
      const scheduledDate = new Date(data[i][4]);
      if (deliveryDate.toDateString() === scheduledDate.toDateString()) {
        onTimeDeliveries++;
        driverStats[driver].onTime++;
      }
    }
  }

  return {
    period: { start: startDate, end: endDate },
    totalDeliveries: totalDeliveries,
    onTimeDeliveries: onTimeDeliveries,
    onTimeRate: totalDeliveries > 0 ? ((onTimeDeliveries / totalDeliveries) * 100).toFixed(1) + '%' : 'N/A',
    driverStats: driverStats
  };
}

/**
 * Test function - create a sample order
 */
function testCreateOrder() {
  const result = createMaterialOrder({
    jobName: 'Test Job - Smith Residence',
    jobAddress: '123 Main St, Huntsville, AL 35801',
    customerName: 'John Smith',
    customerPhone: '256-555-1234',
    projectManager: 'Chris Muse',
    pmEmail: 'chris@rcrs.com',
    pmPhone: '256-555-0001',
    materials: '30 bundles OC Duration (Onyx Black), 5 rolls synthetic underlayment, 2 rolls ice & water shield',
    specialInstructions: 'Gate code: 1234. Stack materials in driveway.',
    requestedDeliveryDate: '2024-12-03',
    priority: 'Normal',
    createdBy: 'Test Script'
  });

  Logger.log(result);
  return result;
}

/**
 * Test function - create a sample delivery
 */
function testCreateDelivery() {
  const result = createDelivery({
    orderId: 'ORD-20241202-1',
    driver: 'D001',
    scheduledDate: '2024-12-03',
    scheduledTime: '8:00 AM',
    jobName: 'Test Job - Smith Residence',
    jobAddress: '123 Main St, Huntsville, AL 35801',
    customerName: 'John Smith',
    customerPhone: '256-555-1234',
    materials: '30 bundles OC Duration (Onyx Black), 5 rolls synthetic underlayment'
  });

  Logger.log(result);
  return result;
}
