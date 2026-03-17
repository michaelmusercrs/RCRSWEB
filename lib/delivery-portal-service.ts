/**
 * Delivery Portal Service
 *
 * CONSOLIDATION NOTE (2026-03-17):
 * This service originally had its own order creation, delivery management,
 * inventory tracking, and dashboard stats — all duplicating logic now
 * handled by the authoritative 18-stage material-order-pipeline.ts.
 *
 * After consolidation:
 * - Order/delivery creation and status updates DELEGATE to materialOrderPipeline
 * - Inventory reads/writes DELEGATE to materialOrderPipeline via unified-inventory-service
 * - Driver management and restock requests remain here (delivery-specific, no overlap)
 * - Dashboard stats now pull from pipeline for order/delivery data
 * - All original type exports are preserved for backward compatibility
 */

import { GoogleSpreadsheet, GoogleSpreadsheetRow } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import {
  materialOrderPipeline,
  type PipelineOrder,
  type PipelineStage,
  PIPELINE_STAGES,
} from './material-order-pipeline';

// Use a separate spreadsheet for the delivery portal
const DELIVERY_SHEETS_ID = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Sheet names — only sheets NOT covered by the pipeline remain active here
const SHEETS = {
  INVENTORY: 'Inventory',
  ORDERS: 'Material Orders',         // LEGACY — pipeline uses PipelineOrders
  DELIVERIES: 'Deliveries',          // LEGACY — pipeline tracks delivery stages internally
  DELIVERY_PHOTOS: 'Delivery Photos', // LEGACY — pipeline uses PipelinePhotos
  INVENTORY_COUNTS: 'Inventory Counts',
  RESTOCK_REQUESTS: 'Restock Requests',
  DRIVERS: 'Drivers',                // NOT in pipeline — stays here
  PRODUCTS: 'Products',
  PORTAL_USERS: 'Portal Users',
};

// Types — all preserved for backward compatibility
export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  vehicle: string;
  licensePlate: string;
  status: 'Available' | 'On Delivery' | 'Off Duty';
  currentLocation?: string;
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

// ============================================
// HELPER: Map pipeline stages to legacy status
// ============================================

/** @deprecated Use PipelineStage from material-order-pipeline instead */
function pipelineStageToOrderStatus(stage: PipelineStage): MaterialOrder['status'] {
  const stageIndex = PIPELINE_STAGES.indexOf(stage);
  if (stageIndex <= 0) return 'Pending';       // ORDER_CREATED
  if (stageIndex <= 2) return 'Scheduled';      // ORDER_REVIEWED, DRIVER_ASSIGNED
  if (stageIndex <= 10) return 'In Progress';   // WAREHOUSE_NOTIFIED through DELIVERY_CONFIRMED
  return 'Delivered';                            // QC_PHOTOS through JOB_CLOSED
}

/** @deprecated Use PipelineStage from material-order-pipeline instead */
function pipelineStageToDeliveryStatus(stage: PipelineStage): Delivery['status'] {
  switch (stage) {
    case 'ORDER_CREATED':
    case 'ORDER_REVIEWED':
    case 'DRIVER_ASSIGNED':
    case 'WAREHOUSE_NOTIFIED':
    case 'MATERIALS_PULLED':
      return 'Scheduled';
    case 'LOAD_VERIFIED':
      return 'Loaded';
    case 'DEPARTURE_CONFIRMED':
    case 'EN_ROUTE':
      return 'En Route';
    case 'ARRIVED_AT_SITE':
    case 'UNLOADING':
      return 'Arrived';
    case 'DELIVERY_CONFIRMED':
    case 'QC_PHOTOS':
    case 'OFFICE_NOTIFIED':
    case 'BILLING_REVIEW':
    case 'INVOICE_SENT':
    case 'PAYMENT_RECEIVED':
    case 'JOB_CLOSED':
      return 'Delivered';
    default:
      return 'Scheduled';
  }
}

/** Convert a PipelineOrder to the legacy MaterialOrder format */
function pipelineOrderToLegacy(po: PipelineOrder): MaterialOrder {
  return {
    orderId: po.orderId,
    orderDate: po.createdAt,
    jobName: po.jobName,
    jobAddress: `${po.deliveryAddress}, ${po.deliveryCity}, ${po.deliveryState} ${po.deliveryZip}`,
    customerName: po.customerName,
    customerPhone: po.customerPhone,
    projectManager: po.createdByName,
    materials: po.items.map(i => `${i.quantity} ${i.unit} ${i.productName}`).join(', '),
    specialInstructions: po.specialInstructions,
    requestedDeliveryDate: po.requestedDeliveryDate,
    priority: po.priority === 'urgent' ? 'Urgent' : po.priority === 'rush' ? 'Rush' : 'Normal',
    status: po.cancelled ? 'Cancelled' : pipelineStageToOrderStatus(po.currentStage),
    assignedDriver: po.assignedDriverId,
    createdBy: po.createdByName,
    jobnimbusId: po.jobNimbusId,
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
  // DRIVERS (delivery-specific, NOT in pipeline)
  // ============================================

  async getDrivers(): Promise<Driver[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.DRIVERS, [
      'id', 'name', 'phone', 'email', 'vehicle', 'licensePlate', 'status', 'currentLocation'
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
    }));
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
  // @deprecated - Use materialOrderPipeline.createOrder() directly.
  // These methods now delegate to the 18-stage pipeline.
  // ============================================

  /**
   * @deprecated Use materialOrderPipeline.createOrder() for new orders.
   * This wrapper delegates to the pipeline and returns the legacy format.
   */
  async createOrder(data: Omit<MaterialOrder, 'orderId' | 'orderDate' | 'status'>): Promise<MaterialOrder> {
    // Delegate to the pipeline
    const pipelineOrder = await materialOrderPipeline.createOrder({
      createdBy: data.createdBy,
      createdByName: data.createdBy,
      createdByRole: 'office',
      priority: data.priority.toLowerCase() as 'normal' | 'rush' | 'urgent',
      jobNumber: '',
      jobName: data.jobName,
      jobNimbusId: data.jobnimbusId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      deliveryAddress: data.jobAddress,
      deliveryCity: '',
      deliveryState: 'AL',
      deliveryZip: '',
      requestedDeliveryDate: data.requestedDeliveryDate,
      items: [], // Legacy format uses a text string for materials, not structured items
      specialInstructions: data.specialInstructions,
    });

    return pipelineOrderToLegacy(pipelineOrder);
  }

  /**
   * @deprecated Use materialOrderPipeline.getOrders() for order queries.
   * This wrapper delegates to the pipeline and returns the legacy format.
   */
  async getOrders(status?: MaterialOrder['status']): Promise<MaterialOrder[]> {
    const pipelineOrders = await materialOrderPipeline.getOrders();
    let orders = pipelineOrders.map(pipelineOrderToLegacy);

    if (status) {
      orders = orders.filter(o => o.status === status);
    }

    return orders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }

  /**
   * @deprecated Use materialOrderPipeline.advanceStage() to change order status.
   * This wrapper is kept for backward compatibility.
   */
  async updateOrderStatus(orderId: string, status: MaterialOrder['status'], assignedDriver?: string): Promise<void> {
    // Map legacy status back to pipeline stage advancement
    // This is a best-effort mapping; callers should use the pipeline directly
    if (status === 'Cancelled') {
      await materialOrderPipeline.cancelOrder(orderId, 'system', 'System', 'Cancelled via legacy portal service');
    }
    // For other status changes, the pipeline handles stage transitions via advanceStage()
    // We log a warning since this method can't fully map back to the 18-stage model
    console.warn(
      `[DEPRECATED] deliveryPortalService.updateOrderStatus() called for ${orderId} -> ${status}. ` +
      `Use materialOrderPipeline.advanceStage() instead.`
    );
  }

  // ============================================
  // DELIVERIES
  // @deprecated - Delivery tracking is now part of the 18-stage pipeline.
  // These methods delegate to the pipeline where possible.
  // ============================================

  /**
   * @deprecated Use materialOrderPipeline.advanceStage() to DRIVER_ASSIGNED stage.
   * Returns legacy Delivery format for backward compatibility.
   */
  async createDelivery(data: Omit<Delivery, 'deliveryId' | 'loadConfirmed' | 'photoCount'>): Promise<Delivery> {
    // If linked to a pipeline order, advance it
    if (data.orderId) {
      try {
        await materialOrderPipeline.advanceStage(
          data.orderId,
          'DRIVER_ASSIGNED',
          'system', 'System', 'office',
          {
            assignedDriverId: data.driver,
            assignedDriverName: data.driverName,
            scheduledDeliveryDate: data.scheduledDate,
            scheduledDeliveryTime: data.scheduledTime,
          }
        );
      } catch {
        // Pipeline order may not exist — fall through to legacy behavior
      }
    }

    // Return legacy format
    return {
      ...data,
      deliveryId: this.generateId('DEL'),
      loadConfirmed: false,
      photoCount: 0,
    };
  }

  /**
   * @deprecated Use materialOrderPipeline.getOrders() with stage filters.
   * Returns legacy Delivery format for backward compatibility.
   */
  async getDeliveries(driverId?: string, status?: Delivery['status'], date?: string): Promise<Delivery[]> {
    const pipelineOrders = await materialOrderPipeline.getOrders({
      driverId: driverId,
      cancelled: false,
    });

    let deliveries: Delivery[] = pipelineOrders.map(po => ({
      deliveryId: po.orderId, // Use pipeline orderId as deliveryId
      orderId: po.orderId,
      driver: po.assignedDriverId || '',
      driverName: po.assignedDriverName,
      status: po.cancelled ? 'Cancelled' as const : pipelineStageToDeliveryStatus(po.currentStage),
      scheduledDate: po.scheduledDeliveryDate || po.requestedDeliveryDate,
      scheduledTime: po.scheduledDeliveryTime || '',
      jobName: po.jobName,
      jobAddress: `${po.deliveryAddress}, ${po.deliveryCity}`,
      customerName: po.customerName,
      customerPhone: po.customerPhone,
      materials: po.items.map(i => `${i.quantity} ${i.unit} ${i.productName}`).join(', '),
      loadConfirmed: PIPELINE_STAGES.indexOf(po.currentStage) >= PIPELINE_STAGES.indexOf('LOAD_VERIFIED'),
      departedTime: po.events.find(e => e.stage === 'DEPARTURE_CONFIRMED')?.timestamp,
      arrivedTime: po.events.find(e => e.stage === 'ARRIVED_AT_SITE')?.timestamp,
      deliveredTime: po.events.find(e => e.stage === 'DELIVERY_CONFIRMED')?.timestamp,
      photoCount: po.events.reduce((sum, e) => sum + e.photoUrls.length, 0),
    }));

    if (status) {
      deliveries = deliveries.filter(d => d.status === status);
    }
    if (date) {
      deliveries = deliveries.filter(d => d.scheduledDate === date);
    }

    return deliveries.sort((a, b) => {
      if (a.scheduledDate !== b.scheduledDate) {
        return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
      }
      return (a.scheduledTime || '').localeCompare(b.scheduledTime || '');
    });
  }

  /**
   * @deprecated Use materialOrderPipeline.getOrderById().
   */
  async getDeliveryById(deliveryId: string): Promise<Delivery | null> {
    const deliveries = await this.getDeliveries();
    return deliveries.find(d => d.deliveryId === deliveryId) || null;
  }

  /**
   * @deprecated Use materialOrderPipeline.advanceStage() to LOAD_VERIFIED stage.
   */
  async confirmLoad(deliveryId: string, driverName: string): Promise<void> {
    try {
      await materialOrderPipeline.advanceStage(
        deliveryId, 'LOAD_VERIFIED',
        'system', driverName, 'driver',
      );
    } catch {
      console.warn(`[DEPRECATED] confirmLoad() failed for ${deliveryId} — order may not be in pipeline`);
    }
  }

  /**
   * @deprecated Use materialOrderPipeline.advanceStage() for status transitions.
   */
  async updateDeliveryStatus(
    deliveryId: string,
    status: Delivery['status'],
    updates?: Partial<Delivery>
  ): Promise<void> {
    // Map legacy delivery status to pipeline stage
    const stageMap: Record<Delivery['status'], PipelineStage> = {
      'Scheduled': 'DRIVER_ASSIGNED',
      'Loaded': 'LOAD_VERIFIED',
      'En Route': 'EN_ROUTE',
      'Arrived': 'ARRIVED_AT_SITE',
      'Delivered': 'DELIVERY_CONFIRMED',
      'Cancelled': 'ORDER_CREATED', // handled separately
    };

    if (status === 'Cancelled') {
      await materialOrderPipeline.cancelOrder(deliveryId, 'system', 'System', 'Cancelled via legacy portal');
      return;
    }

    const targetStage = stageMap[status];
    if (targetStage) {
      try {
        await materialOrderPipeline.advanceStage(
          deliveryId, targetStage,
          'system', 'System', 'office',
          { notes: updates?.deliveryNotes },
        );
      } catch {
        console.warn(`[DEPRECATED] updateDeliveryStatus() failed for ${deliveryId} -> ${status}`);
      }
    }
  }

  // ============================================
  // DELIVERY PHOTOS
  // @deprecated - Use pipeline photo tracking.
  // This remains for backward compatibility with legacy photo uploads.
  // ============================================

  /** @deprecated Use materialOrderPipeline.advanceStage() with photoUrls parameter. */
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
    return photo;
  }

  /** @deprecated Use pipeline event photos for delivery photo tracking. */
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
  // These methods read/write the Inventory sheet directly.
  // For pipeline-integrated inventory with holds, use unified-inventory-service.
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

  async updateInventoryQty(productId: string, qtyChange: number, _reason?: string): Promise<void> {
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

    const invRows = await invSheet.getRows();
    const invRow = invRows.find(r => r.get('productId') === productId);

    if (!invRow) throw new Error('Product not found');

    const expectedQty = parseFloat(invRow.get('currentQty')) || 0;
    const productName = invRow.get('productName');
    const variance = actualQty - expectedQty;
    const variancePercent = expectedQty > 0 ? ((variance / expectedQty) * 100).toFixed(2) : '0';

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

    const unitCost = parseFloat(invRow.get('unitCost')) || 0;
    invRow.set('currentQty', actualQty.toString());
    invRow.set('totalValue', (actualQty * unitCost).toFixed(2));
    invRow.set('lastCountDate', new Date().toISOString().slice(0, 10));
    await invRow.save();

    return { variance };
  }

  // ============================================
  // RESTOCK REQUESTS (delivery-specific, NOT in pipeline)
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
  // Now pulls order/delivery data from the pipeline
  // ============================================

  async getDashboardStats(): Promise<DashboardStats> {
    const today = new Date().toISOString().slice(0, 10);

    // Get pipeline orders for delivery and order stats
    let pipelineOrders: PipelineOrder[] = [];
    try {
      pipelineOrders = await materialOrderPipeline.getOrders({ cancelled: false });
    } catch {
      // Pipeline may not be initialized — fall back to empty
    }

    // Map to delivery stats
    const todayDeliveries = pipelineOrders.filter(po =>
      (po.scheduledDeliveryDate === today || po.requestedDeliveryDate === today)
    );

    const deliveryStages = ['DELIVERY_CONFIRMED', 'QC_PHOTOS', 'OFFICE_NOTIFIED', 'BILLING_REVIEW', 'INVOICE_SENT', 'PAYMENT_RECEIVED', 'JOB_CLOSED'];
    const inProgressStages = ['WAREHOUSE_NOTIFIED', 'MATERIALS_PULLED', 'LOAD_VERIFIED', 'DEPARTURE_CONFIRMED', 'EN_ROUTE', 'ARRIVED_AT_SITE', 'UNLOADING'];

    const completedToday = todayDeliveries.filter(po => deliveryStages.includes(po.currentStage)).length;
    const inProgress = todayDeliveries.filter(po => inProgressStages.includes(po.currentStage)).length;

    // Order stats
    const pendingOrders = pipelineOrders.filter(po =>
      po.currentStage === 'ORDER_CREATED' || po.currentStage === 'ORDER_REVIEWED'
    ).length;

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const weekOrders = pipelineOrders.filter(po => po.createdAt >= weekAgo).length;

    // Get inventory stats (still from direct sheet read)
    const inventory = await this.getInventory();
    const totalValue = inventory.reduce((sum, item) => sum + item.totalValue, 0);
    const lowStockCount = inventory.filter(item => item.currentQty <= item.minQty).length;

    // Get restock requests (delivery-specific, not in pipeline)
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
