import { GoogleSpreadsheet, GoogleSpreadsheetRow } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Use a separate spreadsheet for the delivery portal
const DELIVERY_SHEETS_ID = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Sheet names
const SHEETS = {
  INVENTORY: 'Inventory',
  ORDERS: 'Material Orders',
  DELIVERIES: 'Deliveries',
  DELIVERY_PHOTOS: 'Delivery Photos',
  INVENTORY_COUNTS: 'Inventory Counts',
  RESTOCK_REQUESTS: 'Restock Requests',
  DRIVERS: 'Drivers',
  PRODUCTS: 'Products',
  PORTAL_USERS: 'Portal Users',
};

// Types
export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  vehicle: string;
  licensePlate: string;
  status: 'Available' | 'On Delivery' | 'Off Duty';
  currentLocation?: string;
  pin?: string;
}

export interface MaterialOrder {
  orderId: string;
  orderDate: string;
  jobName: string;
  jobAddress: string;
  customerName: string;
  customerPhone: string;
  projectManager: string;
  pmEmail?: string;
  pmPhone?: string;
  materials: string;
  specialInstructions?: string;
  requestedDeliveryDate: string;
  priority: 'Normal' | 'Rush' | 'Urgent';
  status: 'Pending' | 'Scheduled' | 'In Progress' | 'Delivered' | 'Cancelled';
  assignedDriver?: string;
  createdBy: string;
  jobnimbusId?: string;
}

export interface Delivery {
  deliveryId: string;
  orderId: string;
  driver: string;
  driverName?: string;
  status: 'Scheduled' | 'Loaded' | 'En Route' | 'Arrived' | 'Delivered' | 'Cancelled';
  scheduledDate: string;
  scheduledTime: string;
  jobName: string;
  jobAddress: string;
  customerName: string;
  customerPhone: string;
  materials: string;
  loadConfirmed: boolean;
  loadConfirmedTime?: string;
  loadConfirmedBy?: string;
  departedTime?: string;
  arrivedTime?: string;
  deliveredTime?: string;
  deliveryNotes?: string;
  customerSignature?: string;
  photoCount: number;
  gpsCoordinates?: string;
}

export interface InventoryItem {
  productId: string;
  productName: string;
  category: string;
  sku: string;
  unit: string;
  currentQty: number;
  minQty: number;
  maxQty: number;
  unitCost: number;
  totalValue: number;
  location: string;
  supplier: string;
  lastCountDate?: string;
  lastRestockDate?: string;
  notes?: string;
}

export interface RestockRequest {
  requestId: string;
  requestDate: string;
  requestedBy: string;
  productId: string;
  productName: string;
  currentQty: number;
  requestedQty: number;
  supplier: string;
  priority: 'Low' | 'Normal' | 'High' | 'Urgent';
  status: 'Pending' | 'Approved' | 'Ordered' | 'Received' | 'Cancelled';
  approvedBy?: string;
  approvedDate?: string;
  poNumber?: string;
  expectedDelivery?: string;
  receivedDate?: string;
  notes?: string;
}

export interface DeliveryPhoto {
  photoId: string;
  deliveryId: string;
  orderId: string;
  jobName: string;
  photoType: 'Load' | 'Delivery' | 'Before' | 'After' | 'Job Site' | 'Damage';
  photoUrl: string;
  uploadedBy: string;
  uploadTime: string;
  description?: string;
  gpsLocation?: string;
}

export interface DashboardStats {
  deliveries: {
    todayTotal: number;
    completedToday: number;
    inProgress: number;
    pending: number;
  };
  inventory: {
    totalValue: number;
    lowStockItems: number;
    totalProducts: number;
  };
  orders: {
    pending: number;
    thisWeek: number;
  };
  restocks: {
    pending: number;
  };
}

class DeliveryPortalService {
  private doc: GoogleSpreadsheet | null = null;
  private initialized = false;

  private async getDoc(): Promise<GoogleSpreadsheet> {
    if (!this.doc) {
      this.doc = new GoogleSpreadsheet(DELIVERY_SHEETS_ID!, serviceAccountAuth);
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
      sheet = await doc.addSheet({ title: name, headerValues: headers });
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
  // DRIVERS
  // ============================================

  async getDrivers(): Promise<Driver[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.DRIVERS, [
      'id', 'name', 'phone', 'email', 'vehicle', 'licensePlate', 'status', 'currentLocation', 'pin'
    ]);

    const rows = await sheet.getRows();
    return rows.map(row => ({
      id: row.get('id'),
      name: row.get('name'),
      phone: row.get('phone'),
      email: row.get('email'),
      vehicle: row.get('vehicle'),
      licensePlate: row.get('licensePlate'),
      status: row.get('status') as Driver['status'],
      currentLocation: row.get('currentLocation'),
      pin: row.get('pin'),
    }));
  }

  async getDriverByPin(pin: string): Promise<Driver | null> {
    const drivers = await this.getDrivers();
    return drivers.find(d => d.pin === pin) || null;
  }

  async updateDriverStatus(driverId: string, status: Driver['status'], location?: string): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.DRIVERS, []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('id') === driverId);

    if (row) {
      row.set('status', status);
      if (location) row.set('currentLocation', location);
      await row.save();
    }
  }

  // ============================================
  // MATERIAL ORDERS
  // ============================================

  async createOrder(data: Omit<MaterialOrder, 'orderId' | 'orderDate' | 'status'>): Promise<MaterialOrder> {
    const sheet = await this.getOrCreateSheet(SHEETS.ORDERS, [
      'orderId', 'orderDate', 'jobName', 'jobAddress', 'customerName', 'customerPhone',
      'projectManager', 'pmEmail', 'pmPhone', 'materials', 'specialInstructions',
      'requestedDeliveryDate', 'priority', 'status', 'assignedDriver', 'createdBy', 'jobnimbusId'
    ]);

    const order: MaterialOrder = {
      ...data,
      orderId: this.generateId('ORD'),
      orderDate: new Date().toISOString(),
      status: 'Pending',
    };

    await sheet.addRow(order as unknown as Record<string, string | number | boolean>);
    return order;
  }

  async getOrders(status?: MaterialOrder['status']): Promise<MaterialOrder[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.ORDERS, []);
    const rows = await sheet.getRows();

    let orders = rows.map(row => ({
      orderId: row.get('orderId'),
      orderDate: row.get('orderDate'),
      jobName: row.get('jobName'),
      jobAddress: row.get('jobAddress'),
      customerName: row.get('customerName'),
      customerPhone: row.get('customerPhone'),
      projectManager: row.get('projectManager'),
      pmEmail: row.get('pmEmail'),
      pmPhone: row.get('pmPhone'),
      materials: row.get('materials'),
      specialInstructions: row.get('specialInstructions'),
      requestedDeliveryDate: row.get('requestedDeliveryDate'),
      priority: row.get('priority') as MaterialOrder['priority'],
      status: row.get('status') as MaterialOrder['status'],
      assignedDriver: row.get('assignedDriver'),
      createdBy: row.get('createdBy'),
      jobnimbusId: row.get('jobnimbusId'),
    }));

    if (status) {
      orders = orders.filter(o => o.status === status);
    }

    return orders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }

  async updateOrderStatus(orderId: string, status: MaterialOrder['status'], assignedDriver?: string): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.ORDERS, []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('orderId') === orderId);

    if (row) {
      row.set('status', status);
      if (assignedDriver) row.set('assignedDriver', assignedDriver);
      await row.save();
    }
  }

  // ============================================
  // DELIVERIES
  // ============================================

  async createDelivery(data: Omit<Delivery, 'deliveryId' | 'loadConfirmed' | 'photoCount'>): Promise<Delivery> {
    const sheet = await this.getOrCreateSheet(SHEETS.DELIVERIES, [
      'deliveryId', 'orderId', 'driver', 'driverName', 'status', 'scheduledDate', 'scheduledTime',
      'jobName', 'jobAddress', 'customerName', 'customerPhone', 'materials',
      'loadConfirmed', 'loadConfirmedTime', 'loadConfirmedBy', 'departedTime',
      'arrivedTime', 'deliveredTime', 'deliveryNotes', 'customerSignature', 'photoCount', 'gpsCoordinates'
    ]);

    const delivery: Delivery = {
      ...data,
      deliveryId: this.generateId('DEL'),
      loadConfirmed: false,
      photoCount: 0,
    };

    await sheet.addRow({
      ...delivery,
      loadConfirmed: 'No',
    } as unknown as Record<string, string | number | boolean>);

    // Update order status
    if (data.orderId) {
      await this.updateOrderStatus(data.orderId, 'Scheduled', data.driver);
    }

    return delivery;
  }

  async getDeliveries(driverId?: string, status?: Delivery['status'], date?: string): Promise<Delivery[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.DELIVERIES, []);
    const rows = await sheet.getRows();

    let deliveries = rows.map(row => ({
      deliveryId: row.get('deliveryId'),
      orderId: row.get('orderId'),
      driver: row.get('driver'),
      driverName: row.get('driverName'),
      status: row.get('status') as Delivery['status'],
      scheduledDate: row.get('scheduledDate'),
      scheduledTime: row.get('scheduledTime'),
      jobName: row.get('jobName'),
      jobAddress: row.get('jobAddress'),
      customerName: row.get('customerName'),
      customerPhone: row.get('customerPhone'),
      materials: row.get('materials'),
      loadConfirmed: row.get('loadConfirmed') === 'Yes',
      loadConfirmedTime: row.get('loadConfirmedTime'),
      loadConfirmedBy: row.get('loadConfirmedBy'),
      departedTime: row.get('departedTime'),
      arrivedTime: row.get('arrivedTime'),
      deliveredTime: row.get('deliveredTime'),
      deliveryNotes: row.get('deliveryNotes'),
      customerSignature: row.get('customerSignature'),
      photoCount: parseInt(row.get('photoCount')) || 0,
      gpsCoordinates: row.get('gpsCoordinates'),
    }));

    if (driverId) {
      deliveries = deliveries.filter(d => d.driver === driverId);
    }
    if (status) {
      deliveries = deliveries.filter(d => d.status === status);
    }
    if (date) {
      deliveries = deliveries.filter(d => d.scheduledDate === date);
    }

    return deliveries.sort((a, b) => {
      // Sort by date, then by time
      if (a.scheduledDate !== b.scheduledDate) {
        return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
      }
      return (a.scheduledTime || '').localeCompare(b.scheduledTime || '');
    });
  }

  async getDeliveryById(deliveryId: string): Promise<Delivery | null> {
    const deliveries = await this.getDeliveries();
    return deliveries.find(d => d.deliveryId === deliveryId) || null;
  }

  private async getDeliveryRow(deliveryId: string): Promise<GoogleSpreadsheetRow | null> {
    const sheet = await this.getOrCreateSheet(SHEETS.DELIVERIES, []);
    const rows = await sheet.getRows();
    return rows.find(r => r.get('deliveryId') === deliveryId) || null;
  }

  async confirmLoad(deliveryId: string, driverName: string): Promise<void> {
    const row = await this.getDeliveryRow(deliveryId);
    if (row) {
      row.set('loadConfirmed', 'Yes');
      row.set('loadConfirmedTime', new Date().toISOString());
      row.set('loadConfirmedBy', driverName);
      row.set('status', 'Loaded');
      await row.save();
    }
  }

  async updateDeliveryStatus(
    deliveryId: string,
    status: Delivery['status'],
    updates?: Partial<Delivery>
  ): Promise<void> {
    const row = await this.getDeliveryRow(deliveryId);
    if (row) {
      row.set('status', status);

      const now = new Date().toISOString();
      if (status === 'En Route') row.set('departedTime', now);
      if (status === 'Arrived') row.set('arrivedTime', now);
      if (status === 'Delivered') row.set('deliveredTime', now);

      if (updates) {
        if (updates.deliveryNotes) row.set('deliveryNotes', updates.deliveryNotes);
        if (updates.customerSignature) row.set('customerSignature', updates.customerSignature);
        if (updates.gpsCoordinates) row.set('gpsCoordinates', updates.gpsCoordinates);
      }

      await row.save();

      // Update order status if delivered
      if (status === 'Delivered') {
        const orderId = row.get('orderId');
        if (orderId) {
          await this.updateOrderStatus(orderId, 'Delivered');
        }
      }
    }
  }

  // ============================================
  // DELIVERY PHOTOS
  // ============================================

  async addDeliveryPhoto(data: Omit<DeliveryPhoto, 'photoId' | 'uploadTime'>): Promise<DeliveryPhoto> {
    const sheet = await this.getOrCreateSheet(SHEETS.DELIVERY_PHOTOS, [
      'photoId', 'deliveryId', 'orderId', 'jobName', 'photoType', 'photoUrl',
      'uploadedBy', 'uploadTime', 'description', 'gpsLocation'
    ]);

    const photo: DeliveryPhoto = {
      ...data,
      photoId: this.generateId('PHT'),
      uploadTime: new Date().toISOString(),
    };

    await sheet.addRow(photo as unknown as Record<string, string | number | boolean>);

    // Update photo count on delivery
    const deliveryRow = await this.getDeliveryRow(data.deliveryId);
    if (deliveryRow) {
      const currentCount = parseInt(deliveryRow.get('photoCount')) || 0;
      deliveryRow.set('photoCount', (currentCount + 1).toString());
      await deliveryRow.save();
    }

    return photo;
  }

  async getDeliveryPhotos(deliveryId: string): Promise<DeliveryPhoto[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.DELIVERY_PHOTOS, []);
    const rows = await sheet.getRows();

    return rows
      .filter(row => row.get('deliveryId') === deliveryId)
      .map(row => ({
        photoId: row.get('photoId'),
        deliveryId: row.get('deliveryId'),
        orderId: row.get('orderId'),
        jobName: row.get('jobName'),
        photoType: row.get('photoType') as DeliveryPhoto['photoType'],
        photoUrl: row.get('photoUrl'),
        uploadedBy: row.get('uploadedBy'),
        uploadTime: row.get('uploadTime'),
        description: row.get('description'),
        gpsLocation: row.get('gpsLocation'),
      }));
  }

  // ============================================
  // INVENTORY
  // ============================================

  async getInventory(category?: string): Promise<InventoryItem[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.INVENTORY, [
      'productId', 'productName', 'category', 'sku', 'unit', 'currentQty',
      'minQty', 'maxQty', 'unitCost', 'totalValue', 'location', 'supplier',
      'lastCountDate', 'lastRestockDate', 'notes'
    ]);

    const rows = await sheet.getRows();
    let items = rows.map(row => ({
      productId: row.get('productId'),
      productName: row.get('productName'),
      category: row.get('category'),
      sku: row.get('sku'),
      unit: row.get('unit'),
      currentQty: parseFloat(row.get('currentQty')) || 0,
      minQty: parseFloat(row.get('minQty')) || 0,
      maxQty: parseFloat(row.get('maxQty')) || 0,
      unitCost: parseFloat(row.get('unitCost')) || 0,
      totalValue: parseFloat(row.get('totalValue')) || 0,
      location: row.get('location'),
      supplier: row.get('supplier'),
      lastCountDate: row.get('lastCountDate'),
      lastRestockDate: row.get('lastRestockDate'),
      notes: row.get('notes'),
    }));

    if (category) {
      items = items.filter(i => i.category === category);
    }

    return items.sort((a, b) => a.productName.localeCompare(b.productName));
  }

  async getLowStockItems(): Promise<InventoryItem[]> {
    const items = await this.getInventory();
    return items.filter(item => item.currentQty <= item.minQty);
  }

  async updateInventoryQty(productId: string, qtyChange: number, reason?: string): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.INVENTORY, []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('productId') === productId);

    if (row) {
      const currentQty = parseFloat(row.get('currentQty')) || 0;
      const newQty = currentQty + qtyChange;
      const unitCost = parseFloat(row.get('unitCost')) || 0;

      row.set('currentQty', newQty.toString());
      row.set('totalValue', (newQty * unitCost).toFixed(2));
      await row.save();
    }
  }

  async submitInventoryCount(
    productId: string,
    actualQty: number,
    countedBy: string,
    notes?: string
  ): Promise<{ variance: number }> {
    const invSheet = await this.getOrCreateSheet(SHEETS.INVENTORY, []);
    const countSheet = await this.getOrCreateSheet(SHEETS.INVENTORY_COUNTS, [
      'countId', 'countDate', 'countedBy', 'productId', 'productName',
      'expectedQty', 'actualQty', 'variance', 'variancePercent', 'notes', 'approvedBy'
    ]);

    // Get current expected qty
    const invRows = await invSheet.getRows();
    const invRow = invRows.find(r => r.get('productId') === productId);

    if (!invRow) throw new Error('Product not found');

    const expectedQty = parseFloat(invRow.get('currentQty')) || 0;
    const productName = invRow.get('productName');
    const variance = actualQty - expectedQty;
    const variancePercent = expectedQty > 0 ? ((variance / expectedQty) * 100).toFixed(2) : '0';

    // Add count record
    await countSheet.addRow({
      countId: this.generateId('CNT'),
      countDate: new Date().toISOString(),
      countedBy,
      productId,
      productName,
      expectedQty: expectedQty.toString(),
      actualQty: actualQty.toString(),
      variance: variance.toString(),
      variancePercent: variancePercent + '%',
      notes: notes || '',
      approvedBy: '',
    });

    // Update inventory
    const unitCost = parseFloat(invRow.get('unitCost')) || 0;
    invRow.set('currentQty', actualQty.toString());
    invRow.set('totalValue', (actualQty * unitCost).toFixed(2));
    invRow.set('lastCountDate', new Date().toISOString().slice(0, 10));
    await invRow.save();

    return { variance };
  }

  // ============================================
  // RESTOCK REQUESTS
  // ============================================

  async createRestockRequest(data: Omit<RestockRequest, 'requestId' | 'requestDate' | 'status'>): Promise<RestockRequest> {
    const sheet = await this.getOrCreateSheet(SHEETS.RESTOCK_REQUESTS, [
      'requestId', 'requestDate', 'requestedBy', 'productId', 'productName',
      'currentQty', 'requestedQty', 'supplier', 'priority', 'status',
      'approvedBy', 'approvedDate', 'poNumber', 'expectedDelivery', 'receivedDate', 'notes'
    ]);

    const request: RestockRequest = {
      ...data,
      requestId: this.generateId('RST'),
      requestDate: new Date().toISOString(),
      status: 'Pending',
    };

    await sheet.addRow(request as unknown as Record<string, string | number | boolean>);
    return request;
  }

  async getRestockRequests(status?: RestockRequest['status']): Promise<RestockRequest[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.RESTOCK_REQUESTS, []);
    const rows = await sheet.getRows();

    let requests = rows.map(row => ({
      requestId: row.get('requestId'),
      requestDate: row.get('requestDate'),
      requestedBy: row.get('requestedBy'),
      productId: row.get('productId'),
      productName: row.get('productName'),
      currentQty: parseFloat(row.get('currentQty')) || 0,
      requestedQty: parseFloat(row.get('requestedQty')) || 0,
      supplier: row.get('supplier'),
      priority: row.get('priority') as RestockRequest['priority'],
      status: row.get('status') as RestockRequest['status'],
      approvedBy: row.get('approvedBy'),
      approvedDate: row.get('approvedDate'),
      poNumber: row.get('poNumber'),
      expectedDelivery: row.get('expectedDelivery'),
      receivedDate: row.get('receivedDate'),
      notes: row.get('notes'),
    }));

    if (status) {
      requests = requests.filter(r => r.status === status);
    }

    return requests.sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
  }

  async approveRestockRequest(requestId: string, approvedBy: string): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.RESTOCK_REQUESTS, []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('requestId') === requestId);

    if (row) {
      row.set('status', 'Approved');
      row.set('approvedBy', approvedBy);
      row.set('approvedDate', new Date().toISOString());
      await row.save();
    }
  }

  // ============================================
  // DASHBOARD STATS
  // ============================================

  async getDashboardStats(): Promise<DashboardStats> {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get deliveries
    const allDeliveries = await this.getDeliveries();
    const todayDeliveries = allDeliveries.filter(d => d.scheduledDate === today);

    const completedToday = todayDeliveries.filter(d => d.status === 'Delivered').length;
    const inProgress = todayDeliveries.filter(d =>
      ['Loaded', 'En Route', 'Arrived'].includes(d.status)
    ).length;

    // Get inventory stats
    const inventory = await this.getInventory();
    const totalValue = inventory.reduce((sum, item) => sum + item.totalValue, 0);
    const lowStockCount = inventory.filter(item => item.currentQty <= item.minQty).length;

    // Get orders
    const orders = await this.getOrders();
    const pendingOrders = orders.filter(o => o.status === 'Pending').length;
    const weekOrders = orders.filter(o => o.orderDate >= weekAgo).length;

    // Get restock requests
    const restocks = await this.getRestockRequests('Pending');

    return {
      deliveries: {
        todayTotal: todayDeliveries.length,
        completedToday,
        inProgress,
        pending: todayDeliveries.length - completedToday - inProgress,
      },
      inventory: {
        totalValue,
        lowStockItems: lowStockCount,
        totalProducts: inventory.length,
      },
      orders: {
        pending: pendingOrders,
        thisWeek: weekOrders,
      },
      restocks: {
        pending: restocks.length,
      },
    };
  }
}

export const deliveryPortalService = new DeliveryPortalService();
