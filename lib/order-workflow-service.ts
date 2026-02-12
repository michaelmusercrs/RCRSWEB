// Order Workflow Service
// Manages the complete material ordering workflow from creation to billing

import { GoogleSpreadsheet, GoogleSpreadsheetRow } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const SHEETS_ID = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Sheet names
const SHEETS = {
  MATERIAL_ORDERS: 'Material Orders Workflow',
  ORDER_ITEMS: 'Order Items',
  LOADING_MANIFEST: 'Loading Manifests',
  ORDER_INVOICES: 'Order Invoices',
  CUSTOMER_BREAKDOWN: 'Customer Breakdown Sheets',
  ORDER_TRACKING: 'Order Tracking',
  RETURNS: 'Returns',
  DELIVERY_ROUTES: 'Delivery Routes',
};

// Types
export type OrderStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'processing'
  | 'loading'
  | 'ready_for_delivery'
  | 'in_transit'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'on_hold';

export type OrderPriority = 'normal' | 'rush' | 'urgent';

export interface OrderItem {
  itemId: string;
  orderId: string;
  productId: string;
  productName: string;
  sku?: string;
  category: string;
  quantity: number;
  unit: string;
  unitCost: number;
  unitPrice: number;
  totalCost: number;
  totalPrice: number;
  pulled: boolean;
  pulledQty?: number;
  verified: boolean;
  notes?: string;
}

export interface MaterialOrderFull {
  orderId: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  status: OrderStatus;
  priority: OrderPriority;

  // Job Information
  jobId?: string;
  jobNimbusId?: string;
  jobNumber: string;
  jobName: string;

  // Customer Information
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress: string;
  city: string;
  state: string;
  zipCode: string;

  // Delivery Details
  requestedDeliveryDate: string;
  requestedDeliveryTime?: string;
  scheduledDeliveryDate?: string;
  scheduledDeliveryTime?: string;
  estimatedArrival?: string;

  // Assignment
  assignedDriver?: string;
  assignedDriverName?: string;
  assignedVehicle?: string;

  // Materials
  items: OrderItem[];
  totalItems: number;
  totalCost: number;
  totalPrice: number;

  // Notes
  specialInstructions?: string;
  internalNotes?: string;

  // Workflow
  approvedBy?: string;
  approvedAt?: string;
  loadedAt?: string;
  loadedBy?: string;
  departedAt?: string;
  deliveredAt?: string;
  completedAt?: string;

  // Invoice
  invoiceId?: string;
  invoiceStatus?: 'pending' | 'generated' | 'sent' | 'paid';

  // Customer Breakdown
  hasBreakdownSheet: boolean;
  breakdownSheetId?: string;

  // Inspector/Timing
  inspectorRequired: boolean;
  inspectorName?: string;
  inspectorPhone?: string;
  inspectorArrivalTime?: string;

  // Quality Check
  qualityCheckComplete: boolean;
  qualityCheckBy?: string;
  qualityCheckAt?: string;
  qualityCheckNotes?: string;
}

export interface LoadingManifest {
  manifestId: string;
  orderId: string;
  createdAt: string;
  createdBy: string;
  items: Array<{
    productId: string;
    productName: string;
    location: string;
    quantity: number;
    pulled: boolean;
    pulledBy?: string;
    pulledAt?: string;
  }>;
  totalItems: number;
  itemsPulled: number;
  complete: boolean;
  completedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface OrderInvoice {
  invoiceId: string;
  orderId: string;
  jobId?: string;
  jobName: string;
  customerName: string;
  customerEmail?: string;
  createdAt: string;
  dueDate: string;

  // Line Items
  subtotal: number;
  deliveryFee: number;
  rushFee: number;
  handlingFee: number;
  taxRate: number;
  taxAmount: number;
  total: number;

  // Status
  status: 'draft' | 'pending' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  sentAt?: string;
  paidAt?: string;
  paymentMethod?: string;
  paymentReference?: string;

  // Google Workspace
  googleSheetId?: string;
  googleSheetUrl?: string;
  attachedToBreakdown: boolean;

  notes?: string;
}

export interface CustomerBreakdownSheet {
  sheetId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  jobId: string;
  jobName: string;
  createdAt: string;
  googleSheetId?: string;
  googleSheetUrl?: string;
  lastUpdated: string;

  // Sections
  materialOrderIds: string[];
  invoiceIds: string[];
  totalMaterialCost: number;
  totalLabor: number;
  totalOther: number;
  grandTotal: number;
}

export interface ReturnOrder {
  returnId: string;
  originalOrderId: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;

  // Items to return
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    condition: 'new' | 'used' | 'damaged';
    reason: string;
    restockable: boolean;
  }>;

  // Status
  status: 'pending' | 'approved' | 'scheduled' | 'picked_up' | 'processed' | 'completed' | 'cancelled';
  scheduledPickupDate?: string;
  scheduledPickupTime?: string;
  assignedDriver?: string;
  assignedDriverName?: string;

  // Processing
  pickedUpAt?: string;
  processedAt?: string;
  processedBy?: string;
  restockedQty: number;
  creditAmount: number;
  creditApplied: boolean;

  notes?: string;
}

export interface DeliveryRoute {
  routeId: string;
  date: string;
  driverId: string;
  driverName: string;
  vehicleId?: string;
  startTime?: string;
  endTime?: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';

  // Stops
  stops: Array<{
    sequence: number;
    orderId: string;
    jobName: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    estimatedArrival: string;
    actualArrival?: string;
    completedAt?: string;
    status: 'pending' | 'arrived' | 'completed' | 'skipped';
    notes?: string;
  }>;

  totalStops: number;
  completedStops: number;
  totalDistance?: number;
  estimatedDuration?: number;

  // Navigation
  optimized: boolean;
  navigationUrl?: string;
}

export interface QualityChecklist {
  checklistId: string;
  orderId: string;
  createdAt: string;
  completedAt?: string;
  completedBy?: string;

  items: Array<{
    checkId: string;
    description: string;
    required: boolean;
    checked: boolean;
    checkedBy?: string;
    checkedAt?: string;
    notes?: string;
  }>;

  allRequired: boolean;
  allCompleted: boolean;
  passedQC: boolean;
}

class OrderWorkflowService {
  private doc: GoogleSpreadsheet | null = null;
  private initialized = false;

  private async getDoc(): Promise<GoogleSpreadsheet> {
    if (!this.doc) {
      this.doc = new GoogleSpreadsheet(SHEETS_ID!, serviceAccountAuth);
    }
    if (!this.initialized) {
      await this.doc.loadInfo();
      this.initialized = true;
    }
    return this.doc;
  }

  private async getOrCreateSheet(name: string, headers: string[]) {
    const doc = await this.getDoc();
    let sheet = doc.sheetsByTitle[name];
    if (!sheet) {
      sheet = await doc.addSheet({ title: name, headerValues: headers, gridProperties: { columnCount: Math.max(headers.length + 5, 26) } });
    } else {
      // Ensure headers exist - fix for sheets created without headers
      try {
        await sheet.loadHeaderRow();
      } catch {
        if (sheet.gridProperties.columnCount < headers.length) {
          await sheet.resize({ rowCount: sheet.gridProperties.rowCount, columnCount: headers.length + 5 });
        }
        await sheet.setHeaderRow(headers);
      }
    }
    return sheet;
  }

  private generateId(prefix: string): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${dateStr}-${random}`;
  }

  // ============================================
  // MATERIAL ORDERS
  // ============================================

  private getOrderHeaders() {
    return [
      'orderId', 'createdAt', 'createdBy', 'createdByName', 'status', 'priority',
      'jobId', 'jobNimbusId', 'jobNumber', 'jobName',
      'customerId', 'customerName', 'customerPhone', 'customerEmail', 'customerAddress', 'city', 'state', 'zipCode',
      'requestedDeliveryDate', 'requestedDeliveryTime', 'scheduledDeliveryDate', 'scheduledDeliveryTime', 'estimatedArrival',
      'assignedDriver', 'assignedDriverName', 'assignedVehicle',
      'totalItems', 'totalCost', 'totalPrice',
      'specialInstructions', 'internalNotes',
      'approvedBy', 'approvedAt', 'loadedAt', 'loadedBy', 'departedAt', 'deliveredAt', 'completedAt',
      'invoiceId', 'invoiceStatus', 'hasBreakdownSheet', 'breakdownSheetId',
      'inspectorRequired', 'inspectorName', 'inspectorPhone', 'inspectorArrivalTime',
      'qualityCheckComplete', 'qualityCheckBy', 'qualityCheckAt', 'qualityCheckNotes'
    ];
  }

  async createOrder(data: {
    createdBy: string;
    createdByName: string;
    priority?: OrderPriority;
    jobId?: string;
    jobNimbusId?: string;
    jobNumber: string;
    jobName: string;
    customerId?: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    customerAddress: string;
    city: string;
    state: string;
    zipCode: string;
    requestedDeliveryDate: string;
    requestedDeliveryTime?: string;
    items: Array<{
      productId: string;
      productName: string;
      sku?: string;
      category: string;
      quantity: number;
      unit: string;
      unitCost: number;
      unitPrice: number;
    }>;
    specialInstructions?: string;
    internalNotes?: string;
    inspectorRequired?: boolean;
    inspectorName?: string;
    inspectorPhone?: string;
    inspectorArrivalTime?: string;
  }): Promise<MaterialOrderFull> {
    const sheet = await this.getOrCreateSheet(SHEETS.MATERIAL_ORDERS, this.getOrderHeaders());

    const orderId = this.generateId('MO');

    // Calculate totals
    const orderItems: OrderItem[] = data.items.map(item => ({
      itemId: this.generateId('OI'),
      orderId,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      unitCost: item.unitCost,
      unitPrice: item.unitPrice,
      totalCost: item.quantity * item.unitCost,
      totalPrice: item.quantity * item.unitPrice,
      pulled: false,
      verified: false,
    }));

    const totalCost = orderItems.reduce((sum, i) => sum + i.totalCost, 0);
    const totalPrice = orderItems.reduce((sum, i) => sum + i.totalPrice, 0);

    const order: MaterialOrderFull = {
      orderId,
      createdAt: new Date().toISOString(),
      createdBy: data.createdBy,
      createdByName: data.createdByName,
      status: 'submitted',
      priority: data.priority || 'normal',
      jobId: data.jobId,
      jobNimbusId: data.jobNimbusId,
      jobNumber: data.jobNumber,
      jobName: data.jobName,
      customerId: data.customerId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail,
      customerAddress: data.customerAddress,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      requestedDeliveryDate: data.requestedDeliveryDate,
      requestedDeliveryTime: data.requestedDeliveryTime,
      items: orderItems,
      totalItems: orderItems.length,
      totalCost,
      totalPrice,
      specialInstructions: data.specialInstructions,
      internalNotes: data.internalNotes,
      inspectorRequired: data.inspectorRequired || false,
      inspectorName: data.inspectorName,
      inspectorPhone: data.inspectorPhone,
      inspectorArrivalTime: data.inspectorArrivalTime,
      hasBreakdownSheet: false,
      qualityCheckComplete: false,
    };

    // Save order
    await sheet.addRow({
      ...order,
      hasBreakdownSheet: 'No',
      inspectorRequired: order.inspectorRequired ? 'Yes' : 'No',
      qualityCheckComplete: 'No',
    } as unknown as Record<string, string | number | boolean>);

    // Save order items
    await this.saveOrderItems(orderItems);

    // Check/create customer breakdown sheet
    await this.ensureCustomerBreakdownSheet(order);

    return order;
  }

  private async saveOrderItems(items: OrderItem[]): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.ORDER_ITEMS, [
      'itemId', 'orderId', 'productId', 'productName', 'sku', 'category',
      'quantity', 'unit', 'unitCost', 'unitPrice', 'totalCost', 'totalPrice',
      'pulled', 'pulledQty', 'verified', 'notes'
    ]);

    for (const item of items) {
      await sheet.addRow({
        ...item,
        pulled: item.pulled ? 'Yes' : 'No',
        verified: item.verified ? 'Yes' : 'No',
        pulledQty: item.pulledQty?.toString() || '',
      } as unknown as Record<string, string | number | boolean>);
    }
  }

  async getOrderById(orderId: string): Promise<MaterialOrderFull | null> {
    const sheet = await this.getOrCreateSheet(SHEETS.MATERIAL_ORDERS, this.getOrderHeaders());
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('orderId') === orderId);
    if (!row) return null;

    const items = await this.getOrderItems(orderId);
    return this.rowToOrder(row, items);
  }

  private async getOrderItems(orderId: string): Promise<OrderItem[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.ORDER_ITEMS, []);
    const rows = await sheet.getRows();

    return rows
      .filter(r => r.get('orderId') === orderId)
      .map(r => ({
        itemId: r.get('itemId'),
        orderId: r.get('orderId'),
        productId: r.get('productId'),
        productName: r.get('productName'),
        sku: r.get('sku'),
        category: r.get('category'),
        quantity: parseFloat(r.get('quantity')) || 0,
        unit: r.get('unit'),
        unitCost: parseFloat(r.get('unitCost')) || 0,
        unitPrice: parseFloat(r.get('unitPrice')) || 0,
        totalCost: parseFloat(r.get('totalCost')) || 0,
        totalPrice: parseFloat(r.get('totalPrice')) || 0,
        pulled: r.get('pulled') === 'Yes',
        pulledQty: r.get('pulledQty') ? parseFloat(r.get('pulledQty')) : undefined,
        verified: r.get('verified') === 'Yes',
        notes: r.get('notes'),
      }));
  }

  private rowToOrder(row: GoogleSpreadsheetRow, items: OrderItem[]): MaterialOrderFull {
    return {
      orderId: row.get('orderId'),
      createdAt: row.get('createdAt'),
      createdBy: row.get('createdBy'),
      createdByName: row.get('createdByName'),
      status: row.get('status') as OrderStatus,
      priority: row.get('priority') as OrderPriority,
      jobId: row.get('jobId'),
      jobNimbusId: row.get('jobNimbusId'),
      jobNumber: row.get('jobNumber'),
      jobName: row.get('jobName'),
      customerId: row.get('customerId'),
      customerName: row.get('customerName'),
      customerPhone: row.get('customerPhone'),
      customerEmail: row.get('customerEmail'),
      customerAddress: row.get('customerAddress'),
      city: row.get('city'),
      state: row.get('state'),
      zipCode: row.get('zipCode'),
      requestedDeliveryDate: row.get('requestedDeliveryDate'),
      requestedDeliveryTime: row.get('requestedDeliveryTime'),
      scheduledDeliveryDate: row.get('scheduledDeliveryDate'),
      scheduledDeliveryTime: row.get('scheduledDeliveryTime'),
      estimatedArrival: row.get('estimatedArrival'),
      assignedDriver: row.get('assignedDriver'),
      assignedDriverName: row.get('assignedDriverName'),
      assignedVehicle: row.get('assignedVehicle'),
      items,
      totalItems: parseInt(row.get('totalItems')) || items.length,
      totalCost: parseFloat(row.get('totalCost')) || 0,
      totalPrice: parseFloat(row.get('totalPrice')) || 0,
      specialInstructions: row.get('specialInstructions'),
      internalNotes: row.get('internalNotes'),
      approvedBy: row.get('approvedBy'),
      approvedAt: row.get('approvedAt'),
      loadedAt: row.get('loadedAt'),
      loadedBy: row.get('loadedBy'),
      departedAt: row.get('departedAt'),
      deliveredAt: row.get('deliveredAt'),
      completedAt: row.get('completedAt'),
      invoiceId: row.get('invoiceId'),
      invoiceStatus: row.get('invoiceStatus') as MaterialOrderFull['invoiceStatus'],
      hasBreakdownSheet: row.get('hasBreakdownSheet') === 'Yes',
      breakdownSheetId: row.get('breakdownSheetId'),
      inspectorRequired: row.get('inspectorRequired') === 'Yes',
      inspectorName: row.get('inspectorName'),
      inspectorPhone: row.get('inspectorPhone'),
      inspectorArrivalTime: row.get('inspectorArrivalTime'),
      qualityCheckComplete: row.get('qualityCheckComplete') === 'Yes',
      qualityCheckBy: row.get('qualityCheckBy'),
      qualityCheckAt: row.get('qualityCheckAt'),
      qualityCheckNotes: row.get('qualityCheckNotes'),
    };
  }

  async getOrders(filters?: {
    status?: OrderStatus | OrderStatus[];
    priority?: OrderPriority;
    customerId?: string;
    jobId?: string;
    date?: string;
    createdBy?: string;
    assignedDriver?: string;
    limit?: number;
  }): Promise<MaterialOrderFull[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.MATERIAL_ORDERS, this.getOrderHeaders());
    const rows = await sheet.getRows();

    let orders: MaterialOrderFull[] = [];

    for (const row of rows) {
      const items = await this.getOrderItems(row.get('orderId'));
      orders.push(this.rowToOrder(row, items));
    }

    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      orders = orders.filter(o => statuses.includes(o.status));
    }
    if (filters?.priority) {
      orders = orders.filter(o => o.priority === filters.priority);
    }
    if (filters?.customerId) {
      orders = orders.filter(o => o.customerId === filters.customerId);
    }
    if (filters?.jobId) {
      orders = orders.filter(o => o.jobId === filters.jobId);
    }
    if (filters?.date) {
      orders = orders.filter(o =>
        o.requestedDeliveryDate === filters.date ||
        o.scheduledDeliveryDate === filters.date
      );
    }
    if (filters?.createdBy) {
      orders = orders.filter(o => o.createdBy === filters.createdBy);
    }
    if (filters?.assignedDriver) {
      orders = orders.filter(o => o.assignedDriver === filters.assignedDriver);
    }

    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filters?.limit) {
      orders = orders.slice(0, filters.limit);
    }

    return orders;
  }

  private async getOrderRow(orderId: string): Promise<GoogleSpreadsheetRow | null> {
    const sheet = await this.getOrCreateSheet(SHEETS.MATERIAL_ORDERS, this.getOrderHeaders());
    const rows = await sheet.getRows();
    return rows.find(r => r.get('orderId') === orderId) || null;
  }

  async updateOrderStatus(orderId: string, status: OrderStatus, updates?: Partial<MaterialOrderFull>): Promise<void> {
    const row = await this.getOrderRow(orderId);
    if (!row) return;

    row.set('status', status);
    const now = new Date().toISOString();

    if (status === 'approved' && updates?.approvedBy) {
      row.set('approvedBy', updates.approvedBy);
      row.set('approvedAt', now);
    }
    if (status === 'loading' && updates?.loadedBy) {
      row.set('loadedAt', now);
      row.set('loadedBy', updates.loadedBy);
    }
    if (status === 'in_transit') {
      row.set('departedAt', now);
    }
    if (status === 'delivered') {
      row.set('deliveredAt', now);
    }
    if (status === 'completed') {
      row.set('completedAt', now);
    }

    if (updates?.assignedDriver) row.set('assignedDriver', updates.assignedDriver);
    if (updates?.assignedDriverName) row.set('assignedDriverName', updates.assignedDriverName);
    if (updates?.assignedVehicle) row.set('assignedVehicle', updates.assignedVehicle);
    if (updates?.scheduledDeliveryDate) row.set('scheduledDeliveryDate', updates.scheduledDeliveryDate);
    if (updates?.scheduledDeliveryTime) row.set('scheduledDeliveryTime', updates.scheduledDeliveryTime);
    if (updates?.estimatedArrival) row.set('estimatedArrival', updates.estimatedArrival);
    if (updates?.internalNotes) row.set('internalNotes', updates.internalNotes);

    await row.save();
  }

  async approveOrder(orderId: string, approvedBy: string): Promise<MaterialOrderFull | null> {
    await this.updateOrderStatus(orderId, 'approved', { approvedBy });
    return this.getOrderById(orderId);
  }

  async scheduleDelivery(orderId: string, data: {
    assignedDriver: string;
    assignedDriverName: string;
    assignedVehicle?: string;
    scheduledDeliveryDate: string;
    scheduledDeliveryTime?: string;
  }): Promise<void> {
    await this.updateOrderStatus(orderId, 'processing', data);
  }

  // ============================================
  // LOADING MANIFEST
  // ============================================

  async createLoadingManifest(orderId: string, createdBy: string): Promise<LoadingManifest> {
    const order = await this.getOrderById(orderId);
    if (!order) throw new Error('Order not found');

    const sheet = await this.getOrCreateSheet(SHEETS.LOADING_MANIFEST, [
      'manifestId', 'orderId', 'createdAt', 'createdBy', 'items',
      'totalItems', 'itemsPulled', 'complete', 'completedAt', 'verifiedBy', 'verifiedAt'
    ]);

    // Get inventory locations for items
    const items = order.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      location: 'Warehouse A', // Would come from inventory lookup
      quantity: item.quantity,
      pulled: false,
    }));

    const manifest: LoadingManifest = {
      manifestId: this.generateId('LM'),
      orderId,
      createdAt: new Date().toISOString(),
      createdBy,
      items,
      totalItems: items.length,
      itemsPulled: 0,
      complete: false,
    };

    await sheet.addRow({
      ...manifest,
      items: JSON.stringify(manifest.items),
      complete: 'No',
    } as unknown as Record<string, string | number | boolean>);

    return manifest;
  }

  async getLoadingManifest(orderId: string): Promise<LoadingManifest | null> {
    const sheet = await this.getOrCreateSheet(SHEETS.LOADING_MANIFEST, []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('orderId') === orderId);
    if (!row) return null;

    let items = [];
    try {
      items = JSON.parse(row.get('items') || '[]');
    } catch {}

    return {
      manifestId: row.get('manifestId'),
      orderId: row.get('orderId'),
      createdAt: row.get('createdAt'),
      createdBy: row.get('createdBy'),
      items,
      totalItems: parseInt(row.get('totalItems')) || 0,
      itemsPulled: parseInt(row.get('itemsPulled')) || 0,
      complete: row.get('complete') === 'Yes',
      completedAt: row.get('completedAt'),
      verifiedBy: row.get('verifiedBy'),
      verifiedAt: row.get('verifiedAt'),
    };
  }

  async updateManifestItem(manifestId: string, productId: string, pulledBy: string): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.LOADING_MANIFEST, []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('manifestId') === manifestId);
    if (!row) return;

    let items = [];
    try {
      items = JSON.parse(row.get('items') || '[]');
    } catch {}

    const itemIndex = items.findIndex((i: any) => i.productId === productId);
    if (itemIndex >= 0) {
      items[itemIndex].pulled = true;
      items[itemIndex].pulledBy = pulledBy;
      items[itemIndex].pulledAt = new Date().toISOString();
    }

    const itemsPulled = items.filter((i: any) => i.pulled).length;
    const complete = itemsPulled === items.length;

    row.set('items', JSON.stringify(items));
    row.set('itemsPulled', itemsPulled.toString());
    row.set('complete', complete ? 'Yes' : 'No');
    if (complete) {
      row.set('completedAt', new Date().toISOString());
    }

    await row.save();
  }

  async verifyLoad(manifestId: string, verifiedBy: string): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.LOADING_MANIFEST, []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('manifestId') === manifestId);
    if (!row) return;

    row.set('verifiedBy', verifiedBy);
    row.set('verifiedAt', new Date().toISOString());
    await row.save();

    // Update order status
    const orderId = row.get('orderId');
    await this.updateOrderStatus(orderId, 'ready_for_delivery');
  }

  // ============================================
  // INVOICES
  // ============================================

  async generateInvoice(orderId: string): Promise<OrderInvoice> {
    const order = await this.getOrderById(orderId);
    if (!order) throw new Error('Order not found');

    const sheet = await this.getOrCreateSheet(SHEETS.ORDER_INVOICES, [
      'invoiceId', 'orderId', 'jobId', 'jobName', 'customerName', 'customerEmail',
      'createdAt', 'dueDate', 'subtotal', 'deliveryFee', 'rushFee', 'handlingFee',
      'taxRate', 'taxAmount', 'total', 'status', 'sentAt', 'paidAt',
      'paymentMethod', 'paymentReference', 'googleSheetId', 'googleSheetUrl',
      'attachedToBreakdown', 'notes'
    ]);

    const subtotal = order.totalPrice;
    const deliveryFee = 75;
    const rushFee = order.priority === 'urgent' ? 100 : order.priority === 'rush' ? 50 : 0;
    const handlingFee = 0;
    const taxRate = 0.09;
    const taxAmount = subtotal * taxRate;
    const total = subtotal + deliveryFee + rushFee + handlingFee + taxAmount;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const invoice: OrderInvoice = {
      invoiceId: this.generateId('INV'),
      orderId,
      jobId: order.jobId,
      jobName: order.jobName,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      createdAt: new Date().toISOString(),
      dueDate: dueDate.toISOString().slice(0, 10),
      subtotal,
      deliveryFee,
      rushFee,
      handlingFee,
      taxRate,
      taxAmount,
      total,
      status: 'pending',
      attachedToBreakdown: false,
    };

    await sheet.addRow({
      ...invoice,
      attachedToBreakdown: 'No',
    } as unknown as Record<string, string | number | boolean>);

    // Update order with invoice
    const orderRow = await this.getOrderRow(orderId);
    if (orderRow) {
      orderRow.set('invoiceId', invoice.invoiceId);
      orderRow.set('invoiceStatus', 'generated');
      await orderRow.save();
    }

    // Attach to breakdown sheet
    await this.attachInvoiceToBreakdown(order.customerId!, invoice.invoiceId);

    return invoice;
  }

  async getInvoice(invoiceId: string): Promise<OrderInvoice | null> {
    const sheet = await this.getOrCreateSheet(SHEETS.ORDER_INVOICES, []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('invoiceId') === invoiceId);
    if (!row) return null;

    return {
      invoiceId: row.get('invoiceId'),
      orderId: row.get('orderId'),
      jobId: row.get('jobId'),
      jobName: row.get('jobName'),
      customerName: row.get('customerName'),
      customerEmail: row.get('customerEmail'),
      createdAt: row.get('createdAt'),
      dueDate: row.get('dueDate'),
      subtotal: parseFloat(row.get('subtotal')) || 0,
      deliveryFee: parseFloat(row.get('deliveryFee')) || 0,
      rushFee: parseFloat(row.get('rushFee')) || 0,
      handlingFee: parseFloat(row.get('handlingFee')) || 0,
      taxRate: parseFloat(row.get('taxRate')) || 0,
      taxAmount: parseFloat(row.get('taxAmount')) || 0,
      total: parseFloat(row.get('total')) || 0,
      status: row.get('status') as OrderInvoice['status'],
      sentAt: row.get('sentAt'),
      paidAt: row.get('paidAt'),
      paymentMethod: row.get('paymentMethod'),
      paymentReference: row.get('paymentReference'),
      googleSheetId: row.get('googleSheetId'),
      googleSheetUrl: row.get('googleSheetUrl'),
      attachedToBreakdown: row.get('attachedToBreakdown') === 'Yes',
      notes: row.get('notes'),
    };
  }

  // ============================================
  // CUSTOMER BREAKDOWN SHEETS
  // ============================================

  async ensureCustomerBreakdownSheet(order: MaterialOrderFull): Promise<CustomerBreakdownSheet> {
    const sheet = await this.getOrCreateSheet(SHEETS.CUSTOMER_BREAKDOWN, [
      'sheetId', 'customerId', 'customerName', 'customerEmail', 'jobId', 'jobName',
      'createdAt', 'googleSheetId', 'googleSheetUrl', 'lastUpdated',
      'materialOrderIds', 'invoiceIds', 'totalMaterialCost', 'totalLabor', 'totalOther', 'grandTotal'
    ]);

    const rows = await sheet.getRows();
    let existingRow = rows.find(r =>
      r.get('customerId') === order.customerId && r.get('jobId') === order.jobId
    );

    if (existingRow) {
      // Update existing
      let orderIds = [];
      try {
        orderIds = JSON.parse(existingRow.get('materialOrderIds') || '[]');
      } catch {}

      if (!orderIds.includes(order.orderId)) {
        orderIds.push(order.orderId);
        existingRow.set('materialOrderIds', JSON.stringify(orderIds));

        const currentTotal = parseFloat(existingRow.get('totalMaterialCost')) || 0;
        existingRow.set('totalMaterialCost', (currentTotal + order.totalPrice).toString());
        existingRow.set('lastUpdated', new Date().toISOString());
        await existingRow.save();
      }

      // Update order to mark it has breakdown
      const orderRow = await this.getOrderRow(order.orderId);
      if (orderRow) {
        orderRow.set('hasBreakdownSheet', 'Yes');
        orderRow.set('breakdownSheetId', existingRow.get('sheetId'));
        await orderRow.save();
      }

      return this.rowToBreakdown(existingRow);
    }

    // Create new breakdown sheet
    const breakdown: CustomerBreakdownSheet = {
      sheetId: this.generateId('CBS'),
      customerId: order.customerId || order.customerName.replace(/\s+/g, '-').toLowerCase(),
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      jobId: order.jobId || order.jobNumber,
      jobName: order.jobName,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      materialOrderIds: [order.orderId],
      invoiceIds: [],
      totalMaterialCost: order.totalPrice,
      totalLabor: 0,
      totalOther: 0,
      grandTotal: order.totalPrice,
    };

    await sheet.addRow({
      ...breakdown,
      materialOrderIds: JSON.stringify(breakdown.materialOrderIds),
      invoiceIds: JSON.stringify(breakdown.invoiceIds),
    } as unknown as Record<string, string | number | boolean>);

    // Update order
    const orderRow = await this.getOrderRow(order.orderId);
    if (orderRow) {
      orderRow.set('hasBreakdownSheet', 'Yes');
      orderRow.set('breakdownSheetId', breakdown.sheetId);
      await orderRow.save();
    }

    return breakdown;
  }

  private rowToBreakdown(row: GoogleSpreadsheetRow): CustomerBreakdownSheet {
    let materialOrderIds = [];
    let invoiceIds = [];
    try {
      materialOrderIds = JSON.parse(row.get('materialOrderIds') || '[]');
      invoiceIds = JSON.parse(row.get('invoiceIds') || '[]');
    } catch {}

    return {
      sheetId: row.get('sheetId'),
      customerId: row.get('customerId'),
      customerName: row.get('customerName'),
      customerEmail: row.get('customerEmail'),
      jobId: row.get('jobId'),
      jobName: row.get('jobName'),
      createdAt: row.get('createdAt'),
      googleSheetId: row.get('googleSheetId'),
      googleSheetUrl: row.get('googleSheetUrl'),
      lastUpdated: row.get('lastUpdated'),
      materialOrderIds,
      invoiceIds,
      totalMaterialCost: parseFloat(row.get('totalMaterialCost')) || 0,
      totalLabor: parseFloat(row.get('totalLabor')) || 0,
      totalOther: parseFloat(row.get('totalOther')) || 0,
      grandTotal: parseFloat(row.get('grandTotal')) || 0,
    };
  }

  async attachInvoiceToBreakdown(customerId: string, invoiceId: string): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.CUSTOMER_BREAKDOWN, []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('customerId') === customerId);
    if (!row) return;

    let invoiceIds = [];
    try {
      invoiceIds = JSON.parse(row.get('invoiceIds') || '[]');
    } catch {}

    if (!invoiceIds.includes(invoiceId)) {
      invoiceIds.push(invoiceId);
      row.set('invoiceIds', JSON.stringify(invoiceIds));
      row.set('lastUpdated', new Date().toISOString());
      await row.save();
    }
  }

  // ============================================
  // RETURNS
  // ============================================

  async createReturn(data: {
    originalOrderId: string;
    createdBy: string;
    createdByName: string;
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      condition: 'new' | 'used' | 'damaged';
      reason: string;
    }>;
    notes?: string;
  }): Promise<ReturnOrder> {
    const sheet = await this.getOrCreateSheet(SHEETS.RETURNS, [
      'returnId', 'originalOrderId', 'createdAt', 'createdBy', 'createdByName',
      'items', 'status', 'scheduledPickupDate', 'scheduledPickupTime',
      'assignedDriver', 'assignedDriverName', 'pickedUpAt', 'processedAt', 'processedBy',
      'restockedQty', 'creditAmount', 'creditApplied', 'notes'
    ]);

    const returnOrder: ReturnOrder = {
      returnId: this.generateId('RET'),
      originalOrderId: data.originalOrderId,
      createdAt: new Date().toISOString(),
      createdBy: data.createdBy,
      createdByName: data.createdByName,
      items: data.items.map(item => ({
        ...item,
        restockable: item.condition === 'new',
      })),
      status: 'pending',
      restockedQty: 0,
      creditAmount: 0,
      creditApplied: false,
      notes: data.notes,
    };

    await sheet.addRow({
      ...returnOrder,
      items: JSON.stringify(returnOrder.items),
      creditApplied: 'No',
    } as unknown as Record<string, string | number | boolean>);

    return returnOrder;
  }

  async getReturns(filters?: {
    status?: ReturnOrder['status'];
    orderId?: string;
    limit?: number;
  }): Promise<ReturnOrder[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.RETURNS, []);
    const rows = await sheet.getRows();

    let returns = rows.map(r => {
      let items = [];
      try {
        items = JSON.parse(r.get('items') || '[]');
      } catch {}

      return {
        returnId: r.get('returnId'),
        originalOrderId: r.get('originalOrderId'),
        createdAt: r.get('createdAt'),
        createdBy: r.get('createdBy'),
        createdByName: r.get('createdByName'),
        items,
        status: r.get('status') as ReturnOrder['status'],
        scheduledPickupDate: r.get('scheduledPickupDate'),
        scheduledPickupTime: r.get('scheduledPickupTime'),
        assignedDriver: r.get('assignedDriver'),
        assignedDriverName: r.get('assignedDriverName'),
        pickedUpAt: r.get('pickedUpAt'),
        processedAt: r.get('processedAt'),
        processedBy: r.get('processedBy'),
        restockedQty: parseInt(r.get('restockedQty')) || 0,
        creditAmount: parseFloat(r.get('creditAmount')) || 0,
        creditApplied: r.get('creditApplied') === 'Yes',
        notes: r.get('notes'),
      } as ReturnOrder;
    });

    if (filters?.status) {
      returns = returns.filter(r => r.status === filters.status);
    }
    if (filters?.orderId) {
      returns = returns.filter(r => r.originalOrderId === filters.orderId);
    }

    returns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filters?.limit) {
      returns = returns.slice(0, filters.limit);
    }

    return returns;
  }

  // ============================================
  // DELIVERY ROUTES
  // ============================================

  async createRoute(data: {
    date: string;
    driverId: string;
    driverName: string;
    vehicleId?: string;
    orderIds: string[];
  }): Promise<DeliveryRoute> {
    const sheet = await this.getOrCreateSheet(SHEETS.DELIVERY_ROUTES, [
      'routeId', 'date', 'driverId', 'driverName', 'vehicleId',
      'startTime', 'endTime', 'status', 'stops', 'totalStops', 'completedStops',
      'totalDistance', 'estimatedDuration', 'optimized', 'navigationUrl'
    ]);

    // Get orders for stops
    const stops = [];
    let sequence = 1;
    for (const orderId of data.orderIds) {
      const order = await this.getOrderById(orderId);
      if (order) {
        stops.push({
          sequence,
          orderId,
          jobName: order.jobName,
          address: order.customerAddress,
          city: order.city,
          state: order.state,
          zip: order.zipCode,
          estimatedArrival: order.scheduledDeliveryTime || '',
          status: 'pending' as const,
        });
        sequence++;
      }
    }

    const route: DeliveryRoute = {
      routeId: this.generateId('RT'),
      date: data.date,
      driverId: data.driverId,
      driverName: data.driverName,
      vehicleId: data.vehicleId,
      status: 'planned',
      stops,
      totalStops: stops.length,
      completedStops: 0,
      optimized: false,
    };

    // Generate Google Maps navigation URL
    if (stops.length > 0) {
      const waypoints = stops.map(s => encodeURIComponent(`${s.address}, ${s.city}, ${s.state} ${s.zip}`));
      route.navigationUrl = `https://www.google.com/maps/dir/${waypoints.join('/')}`;
    }

    await sheet.addRow({
      ...route,
      stops: JSON.stringify(route.stops),
      optimized: 'No',
    } as unknown as Record<string, string | number | boolean>);

    return route;
  }

  async getRoute(routeId: string): Promise<DeliveryRoute | null> {
    const sheet = await this.getOrCreateSheet(SHEETS.DELIVERY_ROUTES, []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('routeId') === routeId);
    if (!row) return null;

    let stops = [];
    try {
      stops = JSON.parse(row.get('stops') || '[]');
    } catch {}

    return {
      routeId: row.get('routeId'),
      date: row.get('date'),
      driverId: row.get('driverId'),
      driverName: row.get('driverName'),
      vehicleId: row.get('vehicleId'),
      startTime: row.get('startTime'),
      endTime: row.get('endTime'),
      status: row.get('status') as DeliveryRoute['status'],
      stops,
      totalStops: parseInt(row.get('totalStops')) || 0,
      completedStops: parseInt(row.get('completedStops')) || 0,
      totalDistance: row.get('totalDistance') ? parseFloat(row.get('totalDistance')) : undefined,
      estimatedDuration: row.get('estimatedDuration') ? parseInt(row.get('estimatedDuration')) : undefined,
      optimized: row.get('optimized') === 'Yes',
      navigationUrl: row.get('navigationUrl'),
    };
  }

  async getDriverRoutes(driverId: string, date?: string): Promise<DeliveryRoute[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.DELIVERY_ROUTES, []);
    const rows = await sheet.getRows();

    let routes = rows
      .filter(r => r.get('driverId') === driverId)
      .map(r => {
        let stops = [];
        try {
          stops = JSON.parse(r.get('stops') || '[]');
        } catch {}

        return {
          routeId: r.get('routeId'),
          date: r.get('date'),
          driverId: r.get('driverId'),
          driverName: r.get('driverName'),
          vehicleId: r.get('vehicleId'),
          startTime: r.get('startTime'),
          endTime: r.get('endTime'),
          status: r.get('status') as DeliveryRoute['status'],
          stops,
          totalStops: parseInt(r.get('totalStops')) || 0,
          completedStops: parseInt(r.get('completedStops')) || 0,
          totalDistance: r.get('totalDistance') ? parseFloat(r.get('totalDistance')) : undefined,
          estimatedDuration: r.get('estimatedDuration') ? parseInt(r.get('estimatedDuration')) : undefined,
          optimized: r.get('optimized') === 'Yes',
          navigationUrl: r.get('navigationUrl'),
        } as DeliveryRoute;
      });

    if (date) {
      routes = routes.filter(r => r.date === date);
    }

    return routes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // ============================================
  // QUALITY CHECK
  // ============================================

  async createQualityChecklist(orderId: string): Promise<QualityChecklist> {
    const checklistItems = [
      { description: 'All materials match order', required: true },
      { description: 'Quantities verified against manifest', required: true },
      { description: 'No damaged items', required: true },
      { description: 'Delivery location confirmed', required: true },
      { description: 'Customer signature obtained', required: true },
      { description: 'Photo documentation complete', required: true },
      { description: 'Special instructions followed', required: false },
      { description: 'Site left clean', required: false },
    ];

    return {
      checklistId: this.generateId('QC'),
      orderId,
      createdAt: new Date().toISOString(),
      items: checklistItems.map(item => ({
        checkId: this.generateId('QCI'),
        description: item.description,
        required: item.required,
        checked: false,
      })),
      allRequired: false,
      allCompleted: false,
      passedQC: false,
    };
  }

  async completeQualityCheck(orderId: string, completedBy: string, notes?: string): Promise<void> {
    const row = await this.getOrderRow(orderId);
    if (!row) return;

    row.set('qualityCheckComplete', 'Yes');
    row.set('qualityCheckBy', completedBy);
    row.set('qualityCheckAt', new Date().toISOString());
    if (notes) row.set('qualityCheckNotes', notes);
    await row.save();
  }

  // ============================================
  // DASHBOARD / STATS
  // ============================================

  async getOrderStats(): Promise<{
    total: number;
    byStatus: Record<OrderStatus, number>;
    todayDeliveries: number;
    pendingApproval: number;
    inTransit: number;
    totalValue: number;
    returns: { pending: number; processed: number };
  }> {
    const orders = await this.getOrders();
    const today = new Date().toISOString().slice(0, 10);

    const byStatus: Record<OrderStatus, number> = {
      draft: 0,
      submitted: 0,
      approved: 0,
      processing: 0,
      loading: 0,
      ready_for_delivery: 0,
      in_transit: 0,
      delivered: 0,
      completed: 0,
      cancelled: 0,
      on_hold: 0,
    };

    orders.forEach(o => {
      byStatus[o.status]++;
    });

    const returns = await this.getReturns();

    return {
      total: orders.length,
      byStatus,
      todayDeliveries: orders.filter(o =>
        o.scheduledDeliveryDate === today &&
        ['ready_for_delivery', 'in_transit', 'delivered'].includes(o.status)
      ).length,
      pendingApproval: byStatus.submitted,
      inTransit: byStatus.in_transit,
      totalValue: orders.reduce((sum, o) => sum + o.totalPrice, 0),
      returns: {
        pending: returns.filter(r => r.status === 'pending').length,
        processed: returns.filter(r => r.status === 'completed').length,
      },
    };
  }
}

export const orderWorkflowService = new OrderWorkflowService();
