/**
 * 18-Stage Material Order Pipeline
 * 
 * Full lifecycle management for material orders from creation to job close.
 * Each stage has requirements (photos, GPS, approvals) and triggers notifications.
 * 
 * Persistence: Google Sheets
 * Integration: Unified Inventory Service, JobNimbus, Notification Service
 */

import { GoogleSpreadsheet, GoogleSpreadsheetRow, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { unifiedInventoryService, resolveProductId } from './unified-inventory-service';

// ============================================
// CONFIGURATION
// ============================================

const SHEETS_ID = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')?.replace(/\r\n/g, '\n');
const serviceAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const SHEETS_CONFIGURED = !!(SHEETS_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && privateKey);

const JN_API_KEY = process.env.JOBNIMBUS_API_KEY || 'mb3blj22awhl50rc';
const JN_BASE_URL = 'https://app.jobnimbus.com/api1';

const SHEET_TABS = {
  PIPELINE_ORDERS: 'PipelineOrders',
  PIPELINE_ITEMS: 'PipelineItems',
  PIPELINE_EVENTS: 'PipelineEvents',
  PIPELINE_PHOTOS: 'PipelinePhotos',
  PIPELINE_GPS: 'PipelineGPS',
  INVOICES: 'PipelineInvoices',
  INVOICE_ITEMS: 'PipelineInvoiceItems',
};

// ============================================
// TYPES
// ============================================

export type PipelineStage =
  | 'ORDER_CREATED'          // Stage 1
  | 'ORDER_REVIEWED'         // Stage 2
  | 'DRIVER_ASSIGNED'        // Stage 3
  | 'WAREHOUSE_NOTIFIED'     // Stage 4
  | 'MATERIALS_PULLED'       // Stage 5
  | 'LOAD_VERIFIED'          // Stage 6
  | 'DEPARTURE_CONFIRMED'    // Stage 7
  | 'EN_ROUTE'               // Stage 8
  | 'ARRIVED_AT_SITE'        // Stage 9
  | 'UNLOADING'              // Stage 10
  | 'DELIVERY_CONFIRMED'     // Stage 11
  | 'SIGNATURE_CAPTURED'     // Stage 12
  | 'QC_PHOTOS'              // Stage 13
  | 'OFFICE_NOTIFIED'        // Stage 14
  | 'BILLING_REVIEW'         // Stage 15
  | 'INVOICE_SENT'           // Stage 16
  | 'PAYMENT_RECEIVED'       // Stage 17
  | 'JOB_CLOSED';            // Stage 18

export const PIPELINE_STAGES: PipelineStage[] = [
  'ORDER_CREATED', 'ORDER_REVIEWED', 'DRIVER_ASSIGNED', 'WAREHOUSE_NOTIFIED',
  'MATERIALS_PULLED', 'LOAD_VERIFIED', 'DEPARTURE_CONFIRMED', 'EN_ROUTE',
  'ARRIVED_AT_SITE', 'UNLOADING', 'DELIVERY_CONFIRMED', 'SIGNATURE_CAPTURED',
  'QC_PHOTOS', 'OFFICE_NOTIFIED', 'BILLING_REVIEW', 'INVOICE_SENT',
  'PAYMENT_RECEIVED', 'JOB_CLOSED'
];

export const STAGE_CONFIG: Record<PipelineStage, {
  label: string;
  number: number;
  requiresPhoto: boolean;
  requiresGPS: boolean;
  performedBy: string;      // Role that performs this stage
  estimatedMinutes: number;
  maxMinutes: number;
  notifyRoles: string[];
  autoTransition: boolean;   // Whether this stage auto-transitions to next
}> = {
  ORDER_CREATED: { label: 'Order Created', number: 1, requiresPhoto: false, requiresGPS: false, performedBy: 'pm', estimatedMinutes: 5, maxMinutes: 60, notifyRoles: ['office'], autoTransition: false },
  ORDER_REVIEWED: { label: 'Order Reviewed', number: 2, requiresPhoto: false, requiresGPS: false, performedBy: 'office', estimatedMinutes: 15, maxMinutes: 120, notifyRoles: ['pm'], autoTransition: false },
  DRIVER_ASSIGNED: { label: 'Driver Assigned', number: 3, requiresPhoto: false, requiresGPS: false, performedBy: 'office', estimatedMinutes: 10, maxMinutes: 60, notifyRoles: ['driver'], autoTransition: false },
  WAREHOUSE_NOTIFIED: { label: 'Warehouse Notified', number: 4, requiresPhoto: false, requiresGPS: false, performedBy: 'system', estimatedMinutes: 2, maxMinutes: 5, notifyRoles: ['warehouse'], autoTransition: true },
  MATERIALS_PULLED: { label: 'Materials Pulled', number: 5, requiresPhoto: true, requiresGPS: false, performedBy: 'warehouse', estimatedMinutes: 30, maxMinutes: 120, notifyRoles: ['driver', 'office'], autoTransition: false },
  LOAD_VERIFIED: { label: 'Load Verified', number: 6, requiresPhoto: true, requiresGPS: true, performedBy: 'driver', estimatedMinutes: 15, maxMinutes: 45, notifyRoles: ['office'], autoTransition: false },
  DEPARTURE_CONFIRMED: { label: 'Departure Confirmed', number: 7, requiresPhoto: false, requiresGPS: true, performedBy: 'driver', estimatedMinutes: 2, maxMinutes: 10, notifyRoles: ['pm', 'office'], autoTransition: false },
  EN_ROUTE: { label: 'En Route', number: 8, requiresPhoto: false, requiresGPS: true, performedBy: 'driver', estimatedMinutes: 45, maxMinutes: 180, notifyRoles: [], autoTransition: false },
  ARRIVED_AT_SITE: { label: 'Arrived at Site', number: 9, requiresPhoto: true, requiresGPS: true, performedBy: 'driver', estimatedMinutes: 2, maxMinutes: 10, notifyRoles: ['pm'], autoTransition: false },
  UNLOADING: { label: 'Unloading', number: 10, requiresPhoto: true, requiresGPS: false, performedBy: 'driver', estimatedMinutes: 20, maxMinutes: 60, notifyRoles: [], autoTransition: false },
  DELIVERY_CONFIRMED: { label: 'Delivery Confirmed', number: 11, requiresPhoto: true, requiresGPS: true, performedBy: 'driver', estimatedMinutes: 5, maxMinutes: 15, notifyRoles: ['pm', 'office'], autoTransition: false },
  SIGNATURE_CAPTURED: { label: 'Signature Captured', number: 12, requiresPhoto: false, requiresGPS: true, performedBy: 'driver', estimatedMinutes: 5, maxMinutes: 15, notifyRoles: ['office'], autoTransition: false },
  QC_PHOTOS: { label: 'QC Photos', number: 13, requiresPhoto: true, requiresGPS: true, performedBy: 'driver', estimatedMinutes: 5, maxMinutes: 20, notifyRoles: ['office'], autoTransition: false },
  OFFICE_NOTIFIED: { label: 'Office Notified', number: 14, requiresPhoto: false, requiresGPS: false, performedBy: 'system', estimatedMinutes: 1, maxMinutes: 5, notifyRoles: ['office', 'billing'], autoTransition: true },
  BILLING_REVIEW: { label: 'Billing Review', number: 15, requiresPhoto: false, requiresGPS: false, performedBy: 'office', estimatedMinutes: 15, maxMinutes: 4320, notifyRoles: ['admin'], autoTransition: false },
  INVOICE_SENT: { label: 'Invoice Sent', number: 16, requiresPhoto: false, requiresGPS: false, performedBy: 'office', estimatedMinutes: 5, maxMinutes: 60, notifyRoles: ['pm'], autoTransition: false },
  PAYMENT_RECEIVED: { label: 'Payment Received', number: 17, requiresPhoto: false, requiresGPS: false, performedBy: 'office', estimatedMinutes: 0, maxMinutes: 43200, notifyRoles: ['admin'], autoTransition: false },
  JOB_CLOSED: { label: 'Job Closed', number: 18, requiresPhoto: false, requiresGPS: false, performedBy: 'system', estimatedMinutes: 1, maxMinutes: 5, notifyRoles: ['pm', 'office'], autoTransition: false },
};

export type OrderPriority = 'normal' | 'rush' | 'urgent';

export interface PipelineOrderItem {
  itemId: string;
  productId: string;          // INV-XXXX
  productName: string;
  sku: string;
  category: string;
  quantity: number;
  unit: string;
  unitCost: number;           // Purchase price (INTERNAL ONLY)
  unitPrice: number;          // Final/selling price
  totalCost: number;
  totalPrice: number;
  pulledQty: number;
  verifiedQty: number;
  deliveredQty: number;
  returnedQty: number;
  holdId?: string;
  notes?: string;
}

export interface PipelineEvent {
  eventId: string;
  orderId: string;
  stage: PipelineStage;
  timestamp: string;
  performedBy: string;
  performedByName: string;
  performedByRole: string;
  photoUrls: string[];
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAddress?: string;
  notes?: string;
  metadata?: string;         // JSON string for stage-specific data
}

export interface PipelineOrder {
  orderId: string;
  currentStage: PipelineStage;
  priority: OrderPriority;
  createdAt: string;
  updatedAt: string;

  // Creator info
  createdBy: string;
  createdByName: string;
  createdByRole: string;

  // Job info
  jobId?: string;
  jobNimbusId?: string;
  jobNumber: string;
  jobName: string;

  // Customer info
  customerName: string;
  customerPhone: string;
  customerEmail?: string;

  // Delivery info
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryZip: string;
  requestedDeliveryDate: string;
  scheduledDeliveryDate?: string;
  scheduledDeliveryTime?: string;

  // Assignment
  assignedDriverId?: string;
  assignedDriverName?: string;

  // Materials
  items: PipelineOrderItem[];
  /**
   * Where the materials come from:
   *   - 'stock' (default) = pulled from our warehouse catalog; inventory
   *     holds are placed on createOrder and decremented at DELIVERY_CONFIRMED.
   *   - 'other_vendor' = purchased from an outside supplier (SRS, ABC, Beacon,
   *     etc.) for this specific job. NEVER touches our inventory — no holds,
   *     no stock deductions. Requires supplierName on the work-order side.
   * Optional on read so legacy orders without the field default to 'stock'.
   */
  orderSource?: 'stock' | 'other_vendor';
  supplierName?: string;
  totalCost: number;           // INTERNAL: purchase price total
  totalPrice: number;          // Customer-facing: final price total

  // Billing
  customerInvoiceId?: string;  // Final price only — attached to JN
  internalInvoiceId?: string;  // Purchase + final — admin/office only
  paymentStatus: 'pending' | 'invoiced' | 'partial' | 'paid';
  paymentAmount?: number;
  paymentDate?: string;

  // Status
  specialInstructions?: string;
  notes?: string;
  cancelled: boolean;
  cancelReason?: string;
  completedAt?: string;

  // Tracking
  events: PipelineEvent[];
}

export interface PipelineInvoice {
  invoiceId: string;
  orderId: string;
  type: 'customer' | 'internal';  // customer = final price only; internal = purchase + final
  jobNumber: string;
  jobName: string;
  customerName: string;
  customerEmail?: string;
  items: {
    productName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    unitCost?: number;       // Only on internal invoices
    totalCost?: number;      // Only on internal invoices
  }[];
  subtotal: number;
  tax: number;
  total: number;
  costTotal?: number;        // Only on internal invoices
  margin?: number;           // Only on internal invoices
  status: 'draft' | 'sent' | 'paid' | 'void';
  createdAt: string;
  sentAt?: string;
  paidAt?: string;
  paidAmount?: number;
  notes?: string;
}

// ============================================
// DISTRIBUTORS
// ============================================

export const DISTRIBUTORS = [
  { id: 'advance-hsv', name: 'Advance Build Products', city: 'Huntsville', state: 'AL' },
  { id: 'beacon-hsv', name: 'Beacon', city: 'Huntsville', state: 'AL' },
  { id: 'goldeagle-hsv', name: 'Gold Eagle', city: 'Huntsville', state: 'AL' },
  { id: 'goldeagle-dec', name: 'Gold Eagle', city: 'Decatur', state: 'AL' },
  { id: 'lowes', name: "Lowe's", city: 'Various', state: 'AL' },
  { id: 'homedepot', name: 'Home Depot', city: 'Various', state: 'AL' },
];

// ============================================
// SHEETS HELPER
// ============================================

async function getOrCreateSheet(tabName: string, headerValues: string[]): Promise<{ sheet: GoogleSpreadsheetWorksheet; doc: GoogleSpreadsheet } | null> {
  if (!SHEETS_CONFIGURED) return null;
  try {
    const doc = new GoogleSpreadsheet(SHEETS_ID!, serviceAuth);
    await doc.loadInfo();
    let sheet = doc.sheetsByTitle[tabName];
    if (!sheet) {
      sheet = await doc.addSheet({ title: tabName, headerValues });
    } else {
      // Ensure sheet has enough columns for our headers
      if (sheet.columnCount < headerValues.length) {
        await sheet.resize({ rowCount: sheet.rowCount, columnCount: headerValues.length });
      }
      // Ensure headers are set correctly
      await sheet.loadHeaderRow().catch((err) => console.error("[pipeline] persist failed:", err));
      if (!sheet.headerValues || sheet.headerValues.length === 0) {
        await sheet.setHeaderRow(headerValues);
      }
    }
    return { sheet, doc };
  } catch (error) {
    console.error(`Failed to get/create sheet ${tabName}:`, error);
    return null;
  }
}

// ============================================
// SERVICE CLASS
// ============================================

class MaterialOrderPipelineService {
  private orders: PipelineOrder[] = [];
  private invoices: PipelineInvoice[] = [];
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private nextIds = { order: 1, item: 1, event: 1, invoice: 1 };

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = this._load();
    return this.loadPromise;
  }

  private async _load(): Promise<void> {
    try {
      // Load orders from Sheets
      const result = await getOrCreateSheet(SHEET_TABS.PIPELINE_ORDERS, [
        'orderId', 'currentStage', 'priority', 'createdAt', 'updatedAt',
        'createdBy', 'createdByName', 'createdByRole',
        'jobId', 'jobNimbusId', 'jobNumber', 'jobName',
        'customerName', 'customerPhone', 'customerEmail',
        'deliveryAddress', 'deliveryCity', 'deliveryState', 'deliveryZip',
        'requestedDeliveryDate', 'scheduledDeliveryDate', 'scheduledDeliveryTime',
        'assignedDriverId', 'assignedDriverName',
        'totalCost', 'totalPrice',
        'customerInvoiceId', 'internalInvoiceId',
        'paymentStatus', 'paymentAmount', 'paymentDate',
        'specialInstructions', 'notes', 'cancelled', 'cancelReason', 'completedAt'
      ]);

      if (result) {
        const rows = await result.sheet.getRows();
        for (const row of rows) {
          const orderId = row.get('orderId');
          if (!orderId) continue;

          // Load items for this order
          const items = await this._loadOrderItems(orderId);
          // Load events for this order
          const events = await this._loadOrderEvents(orderId);

          this.orders.push({
            orderId,
            currentStage: (row.get('currentStage') || 'ORDER_CREATED') as PipelineStage,
            priority: (row.get('priority') || 'normal') as OrderPriority,
            createdAt: row.get('createdAt') || '',
            updatedAt: row.get('updatedAt') || '',
            createdBy: row.get('createdBy') || '',
            createdByName: row.get('createdByName') || '',
            createdByRole: row.get('createdByRole') || '',
            jobId: row.get('jobId') || undefined,
            jobNimbusId: row.get('jobNimbusId') || undefined,
            jobNumber: row.get('jobNumber') || '',
            jobName: row.get('jobName') || '',
            customerName: row.get('customerName') || '',
            customerPhone: row.get('customerPhone') || '',
            customerEmail: row.get('customerEmail') || undefined,
            deliveryAddress: row.get('deliveryAddress') || '',
            deliveryCity: row.get('deliveryCity') || '',
            deliveryState: row.get('deliveryState') || 'AL',
            deliveryZip: row.get('deliveryZip') || '',
            requestedDeliveryDate: row.get('requestedDeliveryDate') || '',
            scheduledDeliveryDate: row.get('scheduledDeliveryDate') || undefined,
            scheduledDeliveryTime: row.get('scheduledDeliveryTime') || undefined,
            assignedDriverId: row.get('assignedDriverId') || undefined,
            assignedDriverName: row.get('assignedDriverName') || undefined,
            items,
            totalCost: parseFloat(row.get('totalCost')) || 0,
            totalPrice: parseFloat(row.get('totalPrice')) || 0,
            customerInvoiceId: row.get('customerInvoiceId') || undefined,
            internalInvoiceId: row.get('internalInvoiceId') || undefined,
            paymentStatus: (row.get('paymentStatus') || 'pending') as PipelineOrder['paymentStatus'],
            paymentAmount: parseFloat(row.get('paymentAmount')) || undefined,
            paymentDate: row.get('paymentDate') || undefined,
            specialInstructions: row.get('specialInstructions') || undefined,
            notes: row.get('notes') || undefined,
            cancelled: row.get('cancelled') === 'true',
            cancelReason: row.get('cancelReason') || undefined,
            completedAt: row.get('completedAt') || undefined,
            // Default legacy rows to 'stock' so they keep decrementing
            // inventory on DELIVERY_CONFIRMED like they always did.
            orderSource: (row.get('orderSource') || 'stock') as 'stock' | 'other_vendor',
            supplierName: row.get('supplierName') || undefined,
            events,
          });
        }

        // Update next IDs
        if (this.orders.length > 0) {
          const maxOrderNum = Math.max(...this.orders.map(o => {
            const match = o.orderId.match(/MOP-\d{4}-(\d+)/);
            return match ? parseInt(match[1]) : 0;
          }));
          this.nextIds.order = Math.max(this.nextIds.order, maxOrderNum + 1);
        }
      }

      // Load invoices
      await this._loadInvoices();

      this.loaded = true;
    } catch (error) {
      console.error('Failed to load pipeline orders:', error);
      this.loaded = true;
    }
  }

  private async _loadOrderItems(orderId: string): Promise<PipelineOrderItem[]> {
    try {
      const result = await getOrCreateSheet(SHEET_TABS.PIPELINE_ITEMS, [
        'itemId', 'orderId', 'productId', 'productName', 'sku', 'category',
        'quantity', 'unit', 'unitCost', 'unitPrice', 'totalCost', 'totalPrice',
        'pulledQty', 'verifiedQty', 'deliveredQty', 'returnedQty', 'holdId', 'notes'
      ]);
      if (!result) return [];
      const rows = await result.sheet.getRows();
      return rows
        .filter((r: GoogleSpreadsheetRow) => r.get('orderId') === orderId)
        .map((r: GoogleSpreadsheetRow) => ({
          itemId: r.get('itemId') || '',
          productId: r.get('productId') || '',
          productName: r.get('productName') || '',
          sku: r.get('sku') || '',
          category: r.get('category') || '',
          quantity: parseInt(r.get('quantity')) || 0,
          unit: r.get('unit') || 'each',
          unitCost: parseFloat(r.get('unitCost')) || 0,
          unitPrice: parseFloat(r.get('unitPrice')) || 0,
          totalCost: parseFloat(r.get('totalCost')) || 0,
          totalPrice: parseFloat(r.get('totalPrice')) || 0,
          pulledQty: parseInt(r.get('pulledQty')) || 0,
          verifiedQty: parseInt(r.get('verifiedQty')) || 0,
          deliveredQty: parseInt(r.get('deliveredQty')) || 0,
          returnedQty: parseInt(r.get('returnedQty')) || 0,
          holdId: r.get('holdId') || undefined,
          notes: r.get('notes') || undefined,
        }));
    } catch {
      return [];
    }
  }

  private async _loadOrderEvents(orderId: string): Promise<PipelineEvent[]> {
    try {
      const result = await getOrCreateSheet(SHEET_TABS.PIPELINE_EVENTS, [
        'eventId', 'orderId', 'stage', 'timestamp', 'performedBy',
        'performedByName', 'performedByRole', 'photoUrls',
        'gpsLatitude', 'gpsLongitude', 'gpsAddress', 'notes', 'metadata'
      ]);
      if (!result) return [];
      const rows = await result.sheet.getRows();
      return rows
        .filter((r: GoogleSpreadsheetRow) => r.get('orderId') === orderId)
        .map((r: GoogleSpreadsheetRow) => ({
          eventId: r.get('eventId') || '',
          orderId: r.get('orderId') || '',
          stage: (r.get('stage') || 'ORDER_CREATED') as PipelineStage,
          timestamp: r.get('timestamp') || '',
          performedBy: r.get('performedBy') || '',
          performedByName: r.get('performedByName') || '',
          performedByRole: r.get('performedByRole') || '',
          photoUrls: JSON.parse(r.get('photoUrls') || '[]'),
          gpsLatitude: parseFloat(r.get('gpsLatitude')) || undefined,
          gpsLongitude: parseFloat(r.get('gpsLongitude')) || undefined,
          gpsAddress: r.get('gpsAddress') || undefined,
          notes: r.get('notes') || undefined,
          metadata: r.get('metadata') || undefined,
        }));
    } catch {
      return [];
    }
  }

  private async _loadInvoices(): Promise<void> {
    try {
      const result = await getOrCreateSheet(SHEET_TABS.INVOICES, [
        'invoiceId', 'orderId', 'type', 'jobNumber', 'jobName',
        'customerName', 'customerEmail', 'items',
        'subtotal', 'tax', 'total', 'costTotal', 'margin',
        'status', 'createdAt', 'sentAt', 'paidAt', 'paidAmount', 'notes'
      ]);
      if (!result) return;
      const rows = await result.sheet.getRows();
      this.invoices = rows.map((r: GoogleSpreadsheetRow) => ({
        invoiceId: r.get('invoiceId') || '',
        orderId: r.get('orderId') || '',
        type: (r.get('type') || 'customer') as PipelineInvoice['type'],
        jobNumber: r.get('jobNumber') || '',
        jobName: r.get('jobName') || '',
        customerName: r.get('customerName') || '',
        customerEmail: r.get('customerEmail') || undefined,
        items: JSON.parse(r.get('items') || '[]'),
        subtotal: parseFloat(r.get('subtotal')) || 0,
        tax: parseFloat(r.get('tax')) || 0,
        total: parseFloat(r.get('total')) || 0,
        costTotal: parseFloat(r.get('costTotal')) || undefined,
        margin: parseFloat(r.get('margin')) || undefined,
        status: (r.get('status') || 'draft') as PipelineInvoice['status'],
        createdAt: r.get('createdAt') || '',
        sentAt: r.get('sentAt') || undefined,
        paidAt: r.get('paidAt') || undefined,
        paidAmount: parseFloat(r.get('paidAmount')) || undefined,
        notes: r.get('notes') || undefined,
      }));
    } catch (error) {
      console.error('Failed to load invoices:', error);
    }
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  private async _persistOrder(order: PipelineOrder): Promise<void> {
    const result = await getOrCreateSheet(SHEET_TABS.PIPELINE_ORDERS, [
      'orderId', 'currentStage', 'priority', 'createdAt', 'updatedAt',
      'createdBy', 'createdByName', 'createdByRole',
      'jobId', 'jobNimbusId', 'jobNumber', 'jobName',
      'customerName', 'customerPhone', 'customerEmail',
      'deliveryAddress', 'deliveryCity', 'deliveryState', 'deliveryZip',
      'requestedDeliveryDate', 'scheduledDeliveryDate', 'scheduledDeliveryTime',
      'assignedDriverId', 'assignedDriverName',
      'totalCost', 'totalPrice',
      'customerInvoiceId', 'internalInvoiceId',
      'paymentStatus', 'paymentAmount', 'paymentDate',
      'specialInstructions', 'notes', 'cancelled', 'cancelReason', 'completedAt',
      'orderSource', 'supplierName'
    ]);
    if (!result) return;
    try {
      const rows = await result.sheet.getRows();
      const existing = rows.find((r: GoogleSpreadsheetRow) => r.get('orderId') === order.orderId);
      const data: Record<string, string> = {
        orderId: order.orderId,
        currentStage: order.currentStage,
        priority: order.priority,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        createdBy: order.createdBy,
        createdByName: order.createdByName,
        createdByRole: order.createdByRole,
        jobId: order.jobId || '',
        jobNimbusId: order.jobNimbusId || '',
        jobNumber: order.jobNumber,
        jobName: order.jobName,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail || '',
        deliveryAddress: order.deliveryAddress,
        deliveryCity: order.deliveryCity,
        deliveryState: order.deliveryState,
        deliveryZip: order.deliveryZip,
        requestedDeliveryDate: order.requestedDeliveryDate,
        scheduledDeliveryDate: order.scheduledDeliveryDate || '',
        scheduledDeliveryTime: order.scheduledDeliveryTime || '',
        assignedDriverId: order.assignedDriverId || '',
        assignedDriverName: order.assignedDriverName || '',
        totalCost: order.totalCost.toString(),
        totalPrice: order.totalPrice.toString(),
        customerInvoiceId: order.customerInvoiceId || '',
        internalInvoiceId: order.internalInvoiceId || '',
        paymentStatus: order.paymentStatus,
        paymentAmount: order.paymentAmount?.toString() || '',
        paymentDate: order.paymentDate || '',
        specialInstructions: order.specialInstructions || '',
        notes: order.notes || '',
        cancelled: order.cancelled ? 'true' : 'false',
        cancelReason: order.cancelReason || '',
        completedAt: order.completedAt || '',
        // Only write orderSource when explicitly set, so legacy rows
        // stay blank and default to 'stock' on re-read.
        orderSource: order.orderSource || '',
        supplierName: order.supplierName || '',
      };
      if (existing) {
        Object.entries(data).forEach(([k, v]) => existing.set(k, v));
        await existing.save();
      } else {
        await result.sheet.addRow(data);
      }
    } catch (error) {
      console.error('Failed to persist pipeline order:', error);
    }
  }

  private async _persistEvent(event: PipelineEvent): Promise<void> {
    const result = await getOrCreateSheet(SHEET_TABS.PIPELINE_EVENTS, [
      'eventId', 'orderId', 'stage', 'timestamp', 'performedBy',
      'performedByName', 'performedByRole', 'photoUrls',
      'gpsLatitude', 'gpsLongitude', 'gpsAddress', 'notes', 'metadata'
    ]);
    if (!result) return;
    try {
      await result.sheet.addRow({
        eventId: event.eventId,
        orderId: event.orderId,
        stage: event.stage,
        timestamp: event.timestamp,
        performedBy: event.performedBy,
        performedByName: event.performedByName,
        performedByRole: event.performedByRole,
        photoUrls: JSON.stringify(event.photoUrls),
        gpsLatitude: event.gpsLatitude?.toString() || '',
        gpsLongitude: event.gpsLongitude?.toString() || '',
        gpsAddress: event.gpsAddress || '',
        notes: event.notes || '',
        metadata: event.metadata || '',
      });
    } catch (error) {
      console.error('Failed to persist pipeline event:', error);
    }
  }

  private async _persistOrderItems(orderId: string, items: PipelineOrderItem[]): Promise<void> {
    const result = await getOrCreateSheet(SHEET_TABS.PIPELINE_ITEMS, [
      'itemId', 'orderId', 'productId', 'productName', 'sku', 'category',
      'quantity', 'unit', 'unitCost', 'unitPrice', 'totalCost', 'totalPrice',
      'pulledQty', 'verifiedQty', 'deliveredQty', 'returnedQty', 'holdId', 'notes'
    ]);
    if (!result) return;
    try {
      for (const item of items) {
        await result.sheet.addRow({
          itemId: item.itemId,
          orderId,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          category: item.category,
          quantity: item.quantity.toString(),
          unit: item.unit,
          unitCost: item.unitCost.toString(),
          unitPrice: item.unitPrice.toString(),
          totalCost: item.totalCost.toString(),
          totalPrice: item.totalPrice.toString(),
          pulledQty: item.pulledQty.toString(),
          verifiedQty: item.verifiedQty.toString(),
          deliveredQty: item.deliveredQty.toString(),
          returnedQty: item.returnedQty.toString(),
          holdId: item.holdId || '',
          notes: item.notes || '',
        });
      }
    } catch (error) {
      console.error('Failed to persist pipeline items:', error);
    }
  }

  /**
   * Update existing order items in Sheets (for pulled/verified/delivered qty updates).
   */
  private async _updateOrderItems(orderId: string, items: PipelineOrderItem[]): Promise<void> {
    const result = await getOrCreateSheet(SHEET_TABS.PIPELINE_ITEMS, [
      'itemId', 'orderId', 'productId', 'productName', 'sku', 'category',
      'quantity', 'unit', 'unitCost', 'unitPrice', 'totalCost', 'totalPrice',
      'pulledQty', 'verifiedQty', 'deliveredQty', 'returnedQty', 'holdId', 'notes'
    ]);
    if (!result) return;
    try {
      const rows = await result.sheet.getRows();
      for (const item of items) {
        const existing = rows.find((r: GoogleSpreadsheetRow) =>
          r.get('orderId') === orderId && r.get('itemId') === item.itemId
        );
        if (existing) {
          existing.set('pulledQty', item.pulledQty.toString());
          existing.set('verifiedQty', item.verifiedQty.toString());
          existing.set('deliveredQty', item.deliveredQty.toString());
          existing.set('returnedQty', item.returnedQty.toString());
          if (item.notes) existing.set('notes', item.notes);
          await existing.save();
        }
      }
    } catch (error) {
      console.error('Failed to update pipeline items:', error);
    }
  }

  /**
   * Validate that a target stage is the exact next stage (no skipping).
   * Returns { valid, error } with the expected next stage name on failure.
   */
  validateStrictNextStage(currentStage: PipelineStage, targetStage: PipelineStage): { valid: boolean; error?: string; expectedNext?: PipelineStage } {
    const currentIdx = PIPELINE_STAGES.indexOf(currentStage);
    const targetIdx = PIPELINE_STAGES.indexOf(targetStage);

    if (targetIdx === -1) {
      return { valid: false, error: `Invalid target stage: ${targetStage}` };
    }

    const expectedIdx = currentIdx + 1;
    if (expectedIdx >= PIPELINE_STAGES.length) {
      return { valid: false, error: `Order is already at final stage: ${currentStage}` };
    }

    const expectedNext = PIPELINE_STAGES[expectedIdx];
    if (targetStage !== expectedNext) {
      return {
        valid: false,
        error: `Cannot skip stages. Current: ${currentStage} (${currentIdx + 1}). Expected next: ${expectedNext} (${expectedIdx + 1}). Got: ${targetStage} (${targetIdx + 1})`,
        expectedNext,
      };
    }

    return { valid: true };
  }

  private async _persistInvoice(invoice: PipelineInvoice): Promise<void> {
    const result = await getOrCreateSheet(SHEET_TABS.INVOICES, [
      'invoiceId', 'orderId', 'type', 'jobNumber', 'jobName',
      'customerName', 'customerEmail', 'items',
      'subtotal', 'tax', 'total', 'costTotal', 'margin',
      'status', 'createdAt', 'sentAt', 'paidAt', 'paidAmount', 'notes'
    ]);
    if (!result) return;
    try {
      const rows = await result.sheet.getRows();
      const existing = rows.find((r: GoogleSpreadsheetRow) => r.get('invoiceId') === invoice.invoiceId);
      const data: Record<string, string> = {
        invoiceId: invoice.invoiceId,
        orderId: invoice.orderId,
        type: invoice.type,
        jobNumber: invoice.jobNumber,
        jobName: invoice.jobName,
        customerName: invoice.customerName,
        customerEmail: invoice.customerEmail || '',
        items: JSON.stringify(invoice.items),
        subtotal: invoice.subtotal.toString(),
        tax: invoice.tax.toString(),
        total: invoice.total.toString(),
        costTotal: invoice.costTotal?.toString() || '',
        margin: invoice.margin?.toString() || '',
        status: invoice.status,
        createdAt: invoice.createdAt,
        sentAt: invoice.sentAt || '',
        paidAt: invoice.paidAt || '',
        paidAmount: invoice.paidAmount?.toString() || '',
        notes: invoice.notes || '',
      };
      if (existing) {
        Object.entries(data).forEach(([k, v]) => existing.set(k, v));
        await existing.save();
      } else {
        await result.sheet.addRow(data);
      }
    } catch (error) {
      console.error('Failed to persist invoice:', error);
    }
  }

  // ============================================
  // ORDER OPERATIONS
  // ============================================

  /**
   * Create a new material order (Stage 1: ORDER_CREATED)
   */
  async createOrder(data: {
    createdBy: string;
    createdByName: string;
    createdByRole: string;
    priority: OrderPriority;
    jobId?: string;
    jobNimbusId?: string;
    jobNumber: string;
    jobName: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    deliveryAddress: string;
    deliveryCity: string;
    deliveryState: string;
    deliveryZip: string;
    requestedDeliveryDate: string;
    items: { productId: string; quantity: number; notes?: string }[];
    specialInstructions?: string;
    notes?: string;
    /**
     * 'stock' (default) = inventory hold placed on create, deducted on
     * DELIVERY_CONFIRMED. 'other_vendor' = pass-through buy from SRS/ABC/etc.
     * that NEVER touches our inventory. If 'other_vendor', supplierName is
     * required.
     */
    orderSource?: 'stock' | 'other_vendor';
    supplierName?: string;
  }): Promise<PipelineOrder> {
    await this.ensureLoaded();
    await unifiedInventoryService.ensureLoaded();

    const orderSource: 'stock' | 'other_vendor' =
      data.orderSource === 'other_vendor' ? 'other_vendor' : 'stock';
    if (orderSource === 'other_vendor' && !data.supplierName?.trim()) {
      throw new Error('createOrder: supplierName is required when orderSource is "other_vendor"');
    }

    const year = new Date().getFullYear();
    const orderId = `MOP-${year}-${String(this.nextIds.order++).padStart(4, '0')}`;
    const now = new Date().toISOString();

    // Build order items from inventory
    const orderItems: PipelineOrderItem[] = [];
    for (const reqItem of data.items) {
      const resolved = resolveProductId(reqItem.productId);
      const invItem = await unifiedInventoryService.getItemById(resolved);
      const itemId = `ITM-${String(this.nextIds.item++).padStart(6, '0')}`;

      const unitCost = invItem?.unitCost || 0;
      const unitPrice = invItem?.unitPrice || 0;

      orderItems.push({
        itemId,
        productId: resolved,
        productName: invItem?.productName || 'Unknown',
        sku: invItem?.sku || '',
        category: invItem ? invItem.category : '',
        quantity: reqItem.quantity,
        unit: invItem?.unit || 'each',
        unitCost,
        unitPrice,
        totalCost: unitCost * reqItem.quantity,
        totalPrice: unitPrice * reqItem.quantity,
        pulledQty: 0,
        verifiedQty: 0,
        deliveredQty: 0,
        returnedQty: 0,
        notes: reqItem.notes,
      });

      // Place inventory hold ONLY for stock orders. Other-vendor orders are
      // pass-through buys from SRS/ABC/etc. — we never hold or deduct our
      // warehouse stock for them.
      if (orderSource === 'other_vendor') {
        console.log(`[pipeline] Skipped inventory hold for other-vendor order ${orderId} item ${resolved}`);
      } else {
        const hold = await unifiedInventoryService.placeHold(resolved, reqItem.quantity, orderId, 'pipeline_order', data.createdBy);
        if (hold) {
          orderItems[orderItems.length - 1].holdId = hold.holdId;
        }
      }
    }

    const totalCost = Math.round(orderItems.reduce((sum, i) => sum + i.totalCost, 0) * 100) / 100;
    const totalPrice = Math.round(orderItems.reduce((sum, i) => sum + i.totalPrice, 0) * 100) / 100;

    const event: PipelineEvent = {
      eventId: `EVT-${String(this.nextIds.event++).padStart(6, '0')}`,
      orderId,
      stage: 'ORDER_CREATED',
      timestamp: now,
      performedBy: data.createdBy,
      performedByName: data.createdByName,
      performedByRole: data.createdByRole,
      photoUrls: [],
      notes: data.notes,
    };

    const order: PipelineOrder = {
      orderId,
      currentStage: 'ORDER_CREATED',
      priority: data.priority,
      createdAt: now,
      updatedAt: now,
      createdBy: data.createdBy,
      createdByName: data.createdByName,
      createdByRole: data.createdByRole,
      jobId: data.jobId,
      jobNimbusId: data.jobNimbusId,
      jobNumber: data.jobNumber,
      jobName: data.jobName,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail,
      deliveryAddress: data.deliveryAddress,
      deliveryCity: data.deliveryCity,
      deliveryState: data.deliveryState,
      deliveryZip: data.deliveryZip,
      requestedDeliveryDate: data.requestedDeliveryDate,
      items: orderItems,
      orderSource,
      supplierName: data.supplierName?.trim() || undefined,
      totalCost,
      totalPrice,
      paymentStatus: 'pending',
      specialInstructions: data.specialInstructions,
      notes: data.notes,
      cancelled: false,
      events: [event],
    };

    this.orders.unshift(order);

    // CRITICAL: AWAIT all persists. Vercel kills the lambda the moment the
    // response is sent, so any fire-and-forget .catch() pattern silently
    // drops the data. Settle all writes before returning.
    const persistResults = await Promise.allSettled([
      this._persistOrder(order),
      this._persistOrderItems(orderId, orderItems),
      this._persistEvent(event),
    ]);
    for (const r of persistResults) {
      if (r.status === 'rejected') {
        console.error('[pipeline] createOrder persist rejected:', r.reason);
      }
    }

    // Auto-transition to ORDER_REVIEWED if all items are in stock
    let allInStock = true;
    for (const item of orderItems) {
      const invItem = await unifiedInventoryService.getItemById(item.productId);
      if (!invItem || invItem.availableQty < item.quantity) {
        allInStock = false;
        break;
      }
    }
    if (allInStock && orderItems.length > 0) {
      const autoEvent: PipelineEvent = {
        eventId: `EVT-${String(this.nextIds.event++).padStart(6, '0')}`,
        orderId,
        stage: 'ORDER_REVIEWED',
        timestamp: new Date().toISOString(),
        performedBy: 'system',
        performedByName: 'System (Auto)',
        performedByRole: 'system',
        photoUrls: [],
        notes: 'Auto-reviewed: all items in stock',
      };
      order.currentStage = 'ORDER_REVIEWED';
      order.updatedAt = autoEvent.timestamp;
      order.events.push(autoEvent);
      const autoResults = await Promise.allSettled([
        this._persistOrder(order),
        this._persistEvent(autoEvent),
      ]);
      for (const r of autoResults) {
        if (r.status === 'rejected') {
          console.error('[pipeline] auto-review persist rejected:', r.reason);
        }
      }
    }

    // Audit log: pipeline order created
    try {
      const { auditLog } = await import('./audit-logger');
      auditLog(
        'PIPELINE_ORDER_CREATED',
        data.createdBy || 'system',
        `Order ${orderId} created for job ${order.jobNumber || order.jobId || 'unknown'} (${order.customerName}). ` +
        `Items: ${order.items.length}. Source: ${order.orderSource || 'stock'}. ` +
        `Priority: ${order.priority || 'normal'}.`
      );
    } catch (err) {
      console.warn('[pipeline] PIPELINE_ORDER_CREATED audit log failed:', err);
    }

    return order;
  }

  /**
   * Advance an order to the next stage.
   * Validates requirements (photos, GPS) before allowing transition.
   */
  async advanceStage(
    orderId: string,
    targetStage: PipelineStage,
    performedBy: string,
    performedByName: string,
    performedByRole: string,
    data?: {
      photoUrls?: string[];
      gpsLatitude?: number;
      gpsLongitude?: number;
      gpsAddress?: string;
      notes?: string;
      metadata?: Record<string, unknown>;
      // Stage-specific data
      assignedDriverId?: string;
      assignedDriverName?: string;
      scheduledDeliveryDate?: string;
      scheduledDeliveryTime?: string;
      pulledItems?: { productId: string; pulledQty: number }[];
      verifiedItems?: { productId: string; verifiedQty: number }[];
      deliveredItems?: { productId: string; deliveredQty: number }[];
    }
  ): Promise<{ success: boolean; order?: PipelineOrder; error?: string }> {
    await this.ensureLoaded();

    const order = this.orders.find(o => o.orderId === orderId);
    if (!order) return { success: false, error: 'Order not found' };
    if (order.cancelled) return { success: false, error: 'Order is cancelled' };

    const config = STAGE_CONFIG[targetStage];
    if (!config) return { success: false, error: `Invalid stage: ${targetStage}` };

    // Validate stage ordering. Rules:
    //   - currentStage must be a known stage (defensive against corrupt rows)
    //   - target must not be backward (state machine is forward-only)
    //   - target must not skip more than 2 stages without an explicit skipReason
    //     in data.metadata (allows admin overrides while catching UI bugs)
    const currentIdx = PIPELINE_STAGES.indexOf(order.currentStage);
    const targetIdx = PIPELINE_STAGES.indexOf(targetStage);
    if (currentIdx < 0) {
      return { success: false, error: `Order has corrupt current stage: ${order.currentStage}` };
    }
    if (targetIdx < currentIdx) {
      return { success: false, error: `Cannot go backward from ${order.currentStage} to ${targetStage}` };
    }
    const skip = targetIdx - currentIdx;
    if (skip > 2) {
      const meta = data?.metadata as Record<string, unknown> | undefined;
      const skipReason = meta?.skipReason;
      if (!skipReason || typeof skipReason !== 'string' || skipReason.trim().length < 5) {
        return {
          success: false,
          error: `Stage skip of ${skip} (from ${order.currentStage} to ${targetStage}) requires data.metadata.skipReason explaining why.`,
        };
      }
    }

    // Validate requirements
    if (config.requiresPhoto && (!data?.photoUrls || data.photoUrls.length === 0)) {
      return { success: false, error: `Stage ${targetStage} requires at least one photo` };
    }
    if (config.requiresGPS && (data?.gpsLatitude === undefined || data?.gpsLongitude === undefined)) {
      return { success: false, error: `Stage ${targetStage} requires GPS coordinates` };
    }

    const now = new Date().toISOString();

    // Create event
    const event: PipelineEvent = {
      eventId: `EVT-${String(this.nextIds.event++).padStart(6, '0')}`,
      orderId,
      stage: targetStage,
      timestamp: now,
      performedBy,
      performedByName,
      performedByRole,
      photoUrls: data?.photoUrls || [],
      gpsLatitude: data?.gpsLatitude,
      gpsLongitude: data?.gpsLongitude,
      gpsAddress: data?.gpsAddress,
      notes: data?.notes,
      metadata: data?.metadata ? JSON.stringify(data.metadata) : undefined,
    };

    order.events.push(event);
    order.currentStage = targetStage;
    order.updatedAt = now;

    // Stage-specific logic
    switch (targetStage) {
      case 'ORDER_REVIEWED':
        // Office reviewed and approved the order
        event.metadata = JSON.stringify({
          ...JSON.parse(event.metadata || '{}'),
          reviewedAt: new Date().toISOString(),
          reviewedBy: performedByName,
          itemCount: order.items.length,
          totalPrice: order.totalPrice,
        });
        break;

      case 'DRIVER_ASSIGNED':
        if (data?.assignedDriverId) order.assignedDriverId = data.assignedDriverId;
        if (data?.assignedDriverName) order.assignedDriverName = data.assignedDriverName;
        if (data?.scheduledDeliveryDate) order.scheduledDeliveryDate = data.scheduledDeliveryDate;
        if (data?.scheduledDeliveryTime) order.scheduledDeliveryTime = data.scheduledDeliveryTime;
        break;

      case 'WAREHOUSE_NOTIFIED':
        // Auto-generate pull sheet (data already stored with order items)
        break;

      case 'MATERIALS_PULLED':
        if (data?.pulledItems) {
          for (const pulled of data.pulledItems) {
            const item = order.items.find(i => i.productId === resolveProductId(pulled.productId));
            if (item) item.pulledQty = pulled.pulledQty;
          }
        } else {
          // Default: mark all items as fully pulled
          for (const item of order.items) {
            item.pulledQty = item.quantity;
          }
        }
        // Persist updated item quantities — AWAIT to ensure write completes
        await this._updateOrderItems(orderId, order.items).catch((err) =>
          console.error('[pipeline] MATERIALS_PULLED _updateOrderItems failed:', err)
        );
        break;

      case 'LOAD_VERIFIED':
        // Truck is loaded and about to leave the warehouse. Per business rule:
        // (1) stock deducts NOW (memory: "stock deducts at load_verified —
        //     truck loaded, about to leave warehouse"), and
        // (2) office invoice fires NOW with PRICE ONLY (memory: "Office
        //     invoice (rcrs@rcrsal.com) fires AT load_verified, NOT at ticket
        //     creation. PRICE ONLY — no cost").
        if (data?.verifiedItems) {
          for (const verified of data.verifiedItems) {
            const item = order.items.find(i => i.productId === resolveProductId(verified.productId));
            if (item) item.verifiedQty = verified.verifiedQty;
          }
        } else {
          // Default: verify matches pulled quantities
          for (const item of order.items) {
            item.verifiedQty = item.pulledQty || item.quantity;
          }
        }
        // STOCK DEDUCTION (stock orders only — never for other-vendor pass-throughs)
        if (order.orderSource === 'other_vendor') {
          console.log(`[pipeline] Skipped inventory decrement for other-vendor order ${orderId} at LOAD_VERIFIED`);
        } else {
          for (const item of order.items) {
            // Use verifiedQty (what's actually on the truck) — falls back to
            // pulled or ordered if upstream didn't fill them in.
            const qty = item.verifiedQty || item.pulledQty || item.quantity;
            if (item.holdId) {
              await unifiedInventoryService.fulfillHold(item.holdId, performedBy, performedByName, qty);
            } else {
              await unifiedInventoryService.deductStock(
                item.productId, qty, orderId, 'pipeline_delivery',
                performedBy, performedByName,
                `Load verified for ${order.jobName} — truck leaving warehouse`
              );
            }
          }
        }
        // Create invoices NOW so office has a price-only invoice in hand
        // before the truck leaves. (Idempotent: skips if already created.)
        if (!order.customerInvoiceId) {
          await this._createInvoices(order).catch(err =>
            console.error('[pipeline] LOAD_VERIFIED _createInvoices failed:', err)
          );
        }
        // Persist updated item quantities — AWAIT to ensure write completes
        await this._updateOrderItems(orderId, order.items).catch((err) =>
          console.error('[pipeline] LOAD_VERIFIED _updateOrderItems failed:', err)
        );
        break;

      case 'DEPARTURE_CONFIRMED':
        // Record departure timestamp and GPS
        event.metadata = JSON.stringify({
          ...JSON.parse(event.metadata || '{}'),
          departedAt: new Date().toISOString(),
          departureLat: data?.gpsLatitude,
          departureLng: data?.gpsLongitude,
        });
        break;

      case 'EN_ROUTE':
        // GPS tracking data captured in event (lat/lng already stored)
        break;

      case 'ARRIVED_AT_SITE':
        // Verify GPS against job address
        if (data?.gpsLatitude && data?.gpsLongitude) {
          event.metadata = JSON.stringify({
            ...JSON.parse(event.metadata || '{}'),
            gpsVerification: {
              expectedAddress: order.deliveryAddress,
              actualLat: data.gpsLatitude,
              actualLng: data.gpsLongitude,
            }
          });
        }
        break;

      case 'UNLOADING':
        // Track unloading start - photos required at this stage
        event.metadata = JSON.stringify({
          ...JSON.parse(event.metadata || '{}'),
          unloadingStartedAt: new Date().toISOString(),
          photoCount: data?.photoUrls?.length || 0,
        });
        break;

      case 'DELIVERY_CONFIRMED':
        // Stock was already deducted at LOAD_VERIFIED. This stage only
        // records what was actually delivered to the customer (final
        // confirmation, post-unload). If deliveredQty differs from
        // verifiedQty (partial drop, damaged-on-arrival), the variance
        // is captured here for reconciliation but does NOT re-touch stock.
        if (data?.deliveredItems) {
          for (const delivered of data.deliveredItems) {
            const item = order.items.find(i => i.productId === resolveProductId(delivered.productId));
            if (item) item.deliveredQty = delivered.deliveredQty;
          }
        } else {
          // Default: delivered matches what we put on the truck
          for (const item of order.items) {
            item.deliveredQty = item.verifiedQty || item.pulledQty || item.quantity;
          }
        }
        // Persist updated item quantities — AWAIT to ensure write completes
        await this._updateOrderItems(orderId, order.items).catch((err) => {
          console.error(`[pipeline] DELIVERY_CONFIRMED _updateOrderItems failed for ${orderId}:`, err);
        });
        break;

      case 'SIGNATURE_CAPTURED':
        // Customer/site rep signature captured
        event.metadata = JSON.stringify({
          ...JSON.parse(event.metadata || '{}'),
          signatureCapturedAt: new Date().toISOString(),
          signerName: data?.metadata?.signerName || '',
        });
        break;

      case 'QC_PHOTOS':
        // Quality control photos taken - record photo count and GPS
        event.metadata = JSON.stringify({
          ...JSON.parse(event.metadata || '{}'),
          qcPhotoCount: data?.photoUrls?.length || 0,
          qcCompletedAt: new Date().toISOString(),
        });
        break;

      case 'OFFICE_NOTIFIED':
        // Auto-compile delivery report
        break;

      case 'BILLING_REVIEW':
        // Invoices were created early at LOAD_VERIFIED so office had a price-only
        // invoice in hand before the truck rolled. This stage is now just for
        // office to REVIEW the existing invoices — only re-create if somehow
        // missing (e.g., legacy order created before the LOAD_VERIFIED change).
        if (!order.customerInvoiceId) {
          await this._createInvoices(order);
        }
        // Auto-create the job breakdown row tied to the original format.
        // This is the hook Michael asked for: every order that reaches
        // billing review gets a breakdown sheet entry mirroring the
        // canonical format. If creation fails, we log but don't block
        // the stage transition (the invoices are already saved).
        await this._createJobBreakdown(order, performedBy, performedByName).catch(err =>
          console.error('[pipeline] BILLING_REVIEW _createJobBreakdown failed:', err)
        );
        break;

      case 'INVOICE_SENT':
        order.paymentStatus = 'invoiced';
        // Mark customer invoice as sent — AWAIT the persist
        if (order.customerInvoiceId) {
          const custInv = this.invoices.find(i => i.invoiceId === order.customerInvoiceId);
          if (custInv) {
            custInv.status = 'sent';
            custInv.sentAt = now;
            await this._persistInvoice(custInv).catch((err) =>
              console.error('[pipeline] INVOICE_SENT _persistInvoice failed:', err)
            );
          }
        }
        break;

      case 'PAYMENT_RECEIVED':
        order.paymentStatus = 'paid';
        order.paymentDate = now;
        if (data?.metadata) {
          const meta = data.metadata as Record<string, unknown>;
          if (meta.paymentAmount) order.paymentAmount = meta.paymentAmount as number;
          // Store payment method and reference in event metadata
          event.metadata = JSON.stringify({
            ...JSON.parse(event.metadata || '{}'),
            paymentAmount: meta.paymentAmount,
            paymentMethod: meta.paymentMethod || 'unknown',
            paymentReference: meta.paymentReference || '',
          });
        }
        // Update invoices — AWAIT all persists
        if (order.customerInvoiceId) {
          const custInv = this.invoices.find(i => i.invoiceId === order.customerInvoiceId);
          if (custInv) {
            custInv.status = 'paid';
            custInv.paidAt = now;
            custInv.paidAmount = order.paymentAmount || custInv.total;
            await this._persistInvoice(custInv).catch((err) =>
              console.error('[pipeline] PAYMENT_RECEIVED customer invoice persist failed:', err)
            );
          }
        }
        if (order.internalInvoiceId) {
          const intInv = this.invoices.find(i => i.invoiceId === order.internalInvoiceId);
          if (intInv) {
            intInv.status = 'paid';
            intInv.paidAt = now;
            intInv.paidAmount = order.paymentAmount || intInv.total;
            await this._persistInvoice(intInv).catch((err) =>
              console.error('[pipeline] PAYMENT_RECEIVED internal invoice persist failed:', err)
            );
          }
        }
        break;

      case 'JOB_CLOSED':
        order.completedAt = now;
        // Archive: mark as final state
        event.metadata = JSON.stringify({
          ...JSON.parse(event.metadata || '{}'),
          archivedAt: now,
          finalPaymentStatus: order.paymentStatus,
          totalDelivered: order.items.reduce((sum, i) => sum + (i.deliveredQty || 0), 0),
          totalReturned: order.items.reduce((sum, i) => sum + (i.returnedQty || 0), 0),
        });
        break;
    }

    // CRITICAL: AWAIT all persists before responding. Vercel kills the
    // lambda the moment we return — fire-and-forget .catch() patterns
    // silently lose the data.
    const advanceResults = await Promise.allSettled([
      this._persistOrder(order),
      this._persistEvent(event),
    ]);
    for (const r of advanceResults) {
      if (r.status === 'rejected') {
        console.error('[pipeline] advanceStage persist rejected:', r.reason);
      }
    }

    // Email notifications are non-essential — fire-and-forget is acceptable
    // here because notification failure doesn't lose business data.
    this._notifyStageAdvance(order, targetStage, performedByName).catch(err => {
      console.error(`[Pipeline] Stage notification failed for ${targetStage}:`, err);
    });

    // Push a stage-transition note to the JobNimbus job so the CRM has a
    // running activity timeline. Non-essential — failure doesn't block the
    // stage transition. Only fires for stages that have business meaning in
    // JN (skip internal-only stages like ORDER_REVIEWED).
    this._pushJnActivity(order, targetStage, performedByName).catch(err => {
      console.warn(`[pipeline] JN activity push failed for ${targetStage}:`, err);
    });

    // Audit log: pipeline stage transition
    try {
      const { auditLog } = await import('./audit-logger');
      auditLog(
        'PIPELINE_STAGE_TRANSITIONED',
        performedBy || 'system',
        `Order ${orderId} → ${targetStage}. Job: ${order.jobNumber || order.jobId || 'unknown'}. ` +
        `By: ${performedByName} (${performedByRole}). ` +
        (targetStage === 'LOAD_VERIFIED' && order.orderSource !== 'other_vendor'
          ? 'Inventory decremented + customer invoice created.'
          : targetStage === 'LOAD_VERIFIED'
            ? 'Inventory skip (other_vendor) + invoice created.'
            : '')
      );
    } catch (err) {
      console.warn('[pipeline] PIPELINE_STAGE_TRANSITIONED audit log failed:', err);
    }

    return { success: true, order };
  }

  /**
   * Send email notification when a pipeline stage advances.
   * Uses the notifyRoles from STAGE_CONFIG to determine recipients.
   */
  private async _notifyStageAdvance(order: PipelineOrder, stage: PipelineStage, performedByName: string): Promise<void> {
    const config = STAGE_CONFIG[stage];
    if (!config || config.notifyRoles.length === 0) return;

    // Import email service + team roles dynamically to avoid circular deps
    const { emailService } = await import('./email-service');
    const { TEAM_MEMBERS } = await import('./team-roles');
    if (!emailService.isConfigured()) return;

    // Look up real emails by role from team-roles. Was previously hardcoded
    // and the driver email was GUESSED from `${firstname}@rcrsal.com` —
    // wrong for any driver whose email prefix doesn't match their first name.
    const emailsForRole = (role: string): string[] => {
      const matched = TEAM_MEMBERS
        .filter(m => m.isActive && m.role === role)
        .map(m => m.email)
        .filter(Boolean);
      return matched;
    };

    const roleEmails: Record<string, string[]> = {
      admin: emailsForRole('admin'),
      owner: emailsForRole('owner'),
      office: emailsForRole('office'),
      billing: emailsForRole('office'), // billing = office staff
      pm: emailsForRole('project_manager'),
      warehouse: emailsForRole('project_manager'), // warehouse handled by PMs today
      driver: [],
    };

    // Driver emails: use the ASSIGNED driver's real email if we know who
    // they are. Falls back to all active drivers if no assignment yet.
    if (order.assignedDriverId || order.assignedDriverName) {
      const driver = TEAM_MEMBERS.find(m =>
        m.isActive &&
        m.role === 'driver' &&
        (m.id === order.assignedDriverId ||
         m.name === order.assignedDriverName ||
         m.slug === (order.assignedDriverName || '').toLowerCase().replace(/\s+/g, '-'))
      );
      if (driver) {
        roleEmails.driver = [driver.email];
      }
    } else {
      // No assignment yet — notify all active drivers so someone can pick it up
      roleEmails.driver = emailsForRole('driver');
    }

    const recipients = new Set<string>();
    for (const role of config.notifyRoles) {
      const emails = roleEmails[role] || [];
      emails.forEach(e => recipients.add(e));
    }

    if (recipients.size === 0) return;

    const subject = `Delivery Update: ${config.label} — ${order.jobName || order.orderId}`;
    const body = `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;">
        <div style="background:#000;padding:16px;text-align:center;">
          <h2 style="color:#39FF14;margin:0;">Delivery Pipeline Update</h2>
        </div>
        <div style="padding:20px;background:#fff;">
          <p>Order <strong>${order.orderId}</strong> has advanced to:</p>
          <div style="background:#f0fff0;padding:12px;border-radius:8px;text-align:center;margin:12px 0;">
            <span style="font-size:18px;font-weight:bold;color:#39FF14;">Stage ${config.number}: ${config.label}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;margin:12px 0;">
            <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Job</td><td style="padding:6px;border-bottom:1px solid #eee;">${order.jobName || 'N/A'}</td></tr>
            <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Customer</td><td style="padding:6px;border-bottom:1px solid #eee;">${order.customerName || 'N/A'}</td></tr>
            <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Address</td><td style="padding:6px;border-bottom:1px solid #eee;">${order.deliveryAddress || 'N/A'}</td></tr>
            <tr><td style="padding:6px;border-bottom:1px solid #eee;font-weight:bold;">Driver</td><td style="padding:6px;border-bottom:1px solid #eee;">${order.assignedDriverName || 'Not assigned'}</td></tr>
            <tr><td style="padding:6px;font-weight:bold;">Updated by</td><td style="padding:6px;">${performedByName}</td></tr>
          </table>
        </div>
      </div>
    `;

    // AWAIT all sends in parallel. The advanceStage caller wraps this in
    // its own .catch so a notification failure doesn't fail the stage
    // transition, but we still want each individual send to complete.
    const results = await Promise.allSettled(
      Array.from(recipients).map(to =>
        emailService.send({ to, subject, body, fromName: 'RCRS Delivery' })
      )
    );
    for (const r of results) {
      if (r.status === 'rejected') {
        console.error('[pipeline] _notifyStageAdvance email rejected:', r.reason);
      }
    }

    // Phase 4: fire ntfy.sh push to each role topic in parallel. ntfy is a
    // free/OSS channel and is layered ON TOP of the existing email send —
    // not a replacement. Failures here never bubble up.
    try {
      const { pushToRoles, roleTopicFor } = await import('./ntfy-service');
      const ntfyRoles = Array.from(
        new Set(
          config.notifyRoles
            .map(r => roleTopicFor(r))
            .filter((r): r is 'office' | 'warehouse' | 'drivers' | 'admin' | 'billing' => !!r)
        )
      );
      if (ntfyRoles.length > 0) {
        const title = `Stage ${config.number}: ${config.label}`;
        const lines = [
          `Order: ${order.orderId}`,
          order.jobName ? `Job: ${order.jobName}` : '',
          order.customerName ? `Customer: ${order.customerName}` : '',
          order.deliveryAddress ? `Address: ${order.deliveryAddress}` : '',
          order.assignedDriverName ? `Driver: ${order.assignedDriverName}` : '',
          `Updated by: ${performedByName}`,
        ].filter(Boolean).join('\n');
        await pushToRoles(ntfyRoles, title, lines, {
          priority: 3,
          tags: ['truck'],
          respectQuietHours: true,
        });
      }
    } catch (err) {
      console.error('[pipeline] _notifyStageAdvance ntfy push failed:', err);
    }
  }

  /**
   * Push a stage-transition activity note to the JobNimbus job/contact so
   * the CRM has a running timeline of what's happening on the delivery.
   *
   * IMPORTANT: per business rule, JN attachments NEVER show cost — only the
   * customer-facing price. The note text below is safe (no cost numbers).
   *
   * Stages worth pushing to JN (per INVENTORY-FLOW-SPEC):
   *   3 DRIVER_ASSIGNED, 6 LOAD_VERIFIED, 7 DEPARTURE_CONFIRMED,
   *   9 ARRIVED_AT_SITE, 11 DELIVERY_CONFIRMED, 12 SIGNATURE_CAPTURED,
   *   13 QC_PHOTOS, 14 OFFICE_NOTIFIED, 15 BILLING_REVIEW, 16 INVOICE_SENT,
   *   17 PAYMENT_RECEIVED, 18 JOB_CLOSED.
   * Internal-only stages (ORDER_CREATED/REVIEWED, WAREHOUSE_NOTIFIED,
   * MATERIALS_PULLED, EN_ROUTE, UNLOADING) are skipped — they aren't
   * useful timeline events in the CRM.
   */
  private async _pushJnActivity(order: PipelineOrder, stage: PipelineStage, performedByName: string): Promise<void> {
    if (!order.jobNimbusId) return; // No JN job linked
    const stagesToPush = new Set<PipelineStage>([
      'DRIVER_ASSIGNED', 'LOAD_VERIFIED', 'DEPARTURE_CONFIRMED',
      'ARRIVED_AT_SITE', 'DELIVERY_CONFIRMED', 'SIGNATURE_CAPTURED',
      'QC_PHOTOS', 'OFFICE_NOTIFIED', 'BILLING_REVIEW', 'INVOICE_SENT',
      'PAYMENT_RECEIVED', 'JOB_CLOSED',
    ]);
    if (!stagesToPush.has(stage)) return;

    const config = STAGE_CONFIG[stage];
    if (!config) return;

    const noteLines: string[] = [
      `[RCRS Delivery] Stage ${config.number}: ${config.label}`,
      `Order: ${order.orderId}`,
    ];
    if (order.jobName) noteLines.push(`Job: ${order.jobName}`);
    if (order.assignedDriverName) noteLines.push(`Driver: ${order.assignedDriverName}`);
    if (stage === 'LOAD_VERIFIED') {
      noteLines.push(`Truck loaded with ${order.items.length} item type(s). Total price: $${(order.totalPrice || 0).toFixed(2)}.`);
    }
    if (stage === 'INVOICE_SENT' && order.customerInvoiceId) {
      noteLines.push(`Customer invoice ${order.customerInvoiceId} sent. Total: $${(order.totalPrice || 0).toFixed(2)}.`);
    }
    if (stage === 'PAYMENT_RECEIVED') {
      noteLines.push(`Payment received: $${(order.paymentAmount || order.totalPrice || 0).toFixed(2)}.`);
    }
    noteLines.push(`Performed by: ${performedByName}`);
    const noteContent = noteLines.join('\n');

    try {
      const { jobNimbusService, isJobNimbusConfigured } = await import('./jobnimbus-service');
      if (!isJobNimbusConfigured()) return;
      // primary = the related entity. JN accepts a job or contact jnid here.
      // We don't always know the contact, so we send only the related job ref.
      await jobNimbusService.createNoteOnJob(
        order.jobNimbusId,
        order.jobNimbusId, // primary fallback — JN accepts the job jnid
        noteContent
      );
    } catch (err) {
      // Non-fatal: log and move on. The stage transition already persisted.
      console.warn(`[pipeline] _pushJnActivity failed for ${stage}:`, err);
    }
  }

  /**
   * Create customer and internal invoices for an order.
   */
  private async _createInvoices(order: PipelineOrder): Promise<void> {
    const now = new Date().toISOString();

    // Customer invoice — FINAL PRICE ONLY
    const custInvoiceId = `CINV-${order.orderId.replace('MOP-', '')}`;
    const customerInvoice: PipelineInvoice = {
      invoiceId: custInvoiceId,
      orderId: order.orderId,
      type: 'customer',
      jobNumber: order.jobNumber,
      jobName: order.jobName,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      items: order.items.map(item => ({
        productName: item.productName,
        quantity: item.deliveredQty || item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice: item.unitPrice * (item.deliveredQty || item.quantity),
      })),
      subtotal: order.totalPrice,
      tax: 0, // Tax handled separately
      total: order.totalPrice,
      status: 'draft',
      createdAt: now,
    };

    // Internal invoice — PURCHASE + FINAL PRICE (admin/office only)
    const intInvoiceId = `IINV-${order.orderId.replace('MOP-', '')}`;
    const costTotal = Math.round(order.items.reduce((sum, i) => sum + i.unitCost * (i.deliveredQty || i.quantity), 0) * 100) / 100;
    const internalInvoice: PipelineInvoice = {
      invoiceId: intInvoiceId,
      orderId: order.orderId,
      type: 'internal',
      jobNumber: order.jobNumber,
      jobName: order.jobName,
      customerName: order.customerName,
      items: order.items.map(item => ({
        productName: item.productName,
        quantity: item.deliveredQty || item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice: item.unitPrice * (item.deliveredQty || item.quantity),
        unitCost: item.unitCost,
        totalCost: item.unitCost * (item.deliveredQty || item.quantity),
      })),
      subtotal: order.totalPrice,
      tax: 0,
      total: order.totalPrice,
      costTotal,
      margin: Math.round((order.totalPrice - costTotal) * 100) / 100,
      status: 'draft',
      createdAt: now,
    };

    this.invoices.push(customerInvoice, internalInvoice);
    order.customerInvoiceId = custInvoiceId;
    order.internalInvoiceId = intInvoiceId;

    // AWAIT both invoice persists — these are critical financial records
    const invResults = await Promise.allSettled([
      this._persistInvoice(customerInvoice),
      this._persistInvoice(internalInvoice),
    ]);
    for (const r of invResults) {
      if (r.status === 'rejected') {
        console.error('[pipeline] _createInvoices persist rejected:', r.reason);
      }
    }
  }

  /**
   * Auto-create a job breakdown row for an order that's reached BILLING_REVIEW.
   * Mirrors the original-format job breakdown sheet that Michael's team uses.
   * Idempotent: if a breakdown already exists for this jobId, skips creation.
   *
   * Material costs are pulled from the order's deliveredQty (or quantity if
   * not yet delivered). Labor is left empty for the office to fill in —
   * we don't have labor data in the pipeline.
   */
  private async _createJobBreakdown(
    order: PipelineOrder,
    performedBy: string,
    performedByName: string
  ): Promise<void> {
    // Dynamic import to avoid circular dependency
    const { jobBreakdownService } = await import('./job-breakdown-service');

    // Idempotency check — if a breakdown already exists for this job, skip
    const jobIdForBreakdown = order.jobId || order.jobNumber || order.orderId;
    try {
      const existing = await jobBreakdownService.getBreakdownsByJob(jobIdForBreakdown);
      if (existing.length > 0) {
        console.log(`[pipeline] Breakdown already exists for ${jobIdForBreakdown}, skipping auto-create`);
        return;
      }
    } catch (err) {
      // If the lookup fails, continue with creation rather than skipping —
      // worst case is a duplicate, which is recoverable.
      console.warn('[pipeline] Breakdown existence check failed:', err);
    }

    // Map pipeline order items into breakdown material rows
    const materials = order.items.map(item => ({
      category: item.category || 'general',
      productName: item.productName,
      quantity: item.deliveredQty || item.quantity,
      unit: item.unit,
      unitCost: item.unitCost,
      totalCost: Math.round(item.unitCost * (item.deliveredQty || item.quantity) * 100) / 100,
      supplier: '', // Pipeline doesn't track per-line supplier
      leadTime: '',
      inStock: true, // We delivered it, so it was in stock
    }));

    // Default project type — office can revise after creation
    // TODO: derive from JN job category if available
    const projectType = 'roof_replacement' as const;

    try {
      const breakdown = await jobBreakdownService.createBreakdown({
        jobId: jobIdForBreakdown,
        jobName: order.jobName || `Order ${order.orderId}`,
        customerName: order.customerName || 'Customer',
        address: {
          street: order.deliveryAddress || '',
          city: order.deliveryCity || '',
          state: order.deliveryState || 'AL',
          zip: order.deliveryZip || '',
        },
        projectType,
        materials,
        labor: [], // Office adds labor after creation
        notes: `Auto-created from material order ${order.orderId} on ${new Date().toLocaleDateString()}. Performed by ${performedByName}. Review and add labor before approving.`,
        createdBy: performedBy,
      });
      console.log(`[pipeline] Auto-created breakdown ${breakdown.breakdownId} for order ${order.orderId}`);
    } catch (err) {
      console.error('[pipeline] _createJobBreakdown createBreakdown failed:', err);
      throw err;
    }
  }

  /**
   * Cancel an order.
   */
  async cancelOrder(orderId: string, cancelledBy: string, cancelledByName: string, reason: string): Promise<PipelineOrder | null> {
    await this.ensureLoaded();
    const order = this.orders.find(o => o.orderId === orderId);
    if (!order || order.cancelled) return null;

    order.cancelled = true;
    order.cancelReason = reason;
    order.updatedAt = new Date().toISOString();

    // Release all holds
    for (const item of order.items) {
      if (item.holdId) {
        await unifiedInventoryService.releaseHold(item.holdId);
      }
    }

    const event: PipelineEvent = {
      eventId: `EVT-${String(this.nextIds.event++).padStart(6, '0')}`,
      orderId,
      stage: order.currentStage,
      timestamp: new Date().toISOString(),
      performedBy: cancelledBy,
      performedByName: cancelledByName,
      performedByRole: 'system',
      photoUrls: [],
      notes: `Order cancelled: ${reason}`,
    };

    order.events.push(event);
    // AWAIT both persists so the cancellation is durable before responding
    const cancelResults = await Promise.allSettled([
      this._persistOrder(order),
      this._persistEvent(event),
    ]);
    for (const r of cancelResults) {
      if (r.status === 'rejected') {
        console.error('[pipeline] cancelOrder persist rejected:', r.reason);
      }
    }

    return order;
  }

  // ============================================
  // QUERIES
  // ============================================

  async getOrders(filters?: {
    stage?: PipelineStage;
    priority?: OrderPriority;
    driverId?: string;
    jobNumber?: string;
    cancelled?: boolean;
    paymentStatus?: PipelineOrder['paymentStatus'];
    limit?: number;
  }): Promise<PipelineOrder[]> {
    await this.ensureLoaded();
    let orders = [...this.orders];

    if (filters) {
      if (filters.stage) orders = orders.filter(o => o.currentStage === filters.stage);
      if (filters.priority) orders = orders.filter(o => o.priority === filters.priority);
      if (filters.driverId) orders = orders.filter(o => o.assignedDriverId === filters.driverId);
      if (filters.jobNumber) orders = orders.filter(o => o.jobNumber === filters.jobNumber);
      if (filters.cancelled !== undefined) orders = orders.filter(o => o.cancelled === filters.cancelled);
      if (filters.paymentStatus) orders = orders.filter(o => o.paymentStatus === filters.paymentStatus);
    } else {
      orders = orders.filter(o => !o.cancelled);
    }

    return orders
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, filters?.limit || 100);
  }

  async getOrderById(orderId: string): Promise<PipelineOrder | undefined> {
    await this.ensureLoaded();
    return this.orders.find(o => o.orderId === orderId);
  }

  async getOrdersByDriver(driverId: string): Promise<PipelineOrder[]> {
    await this.ensureLoaded();
    return this.orders
      .filter(o => o.assignedDriverId === driverId && !o.cancelled)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getActiveOrders(): Promise<PipelineOrder[]> {
    await this.ensureLoaded();
    return this.orders
      .filter(o => !o.cancelled && o.currentStage !== 'JOB_CLOSED')
      .sort((a, b) => {
        // Priority ordering: urgent > rush > normal
        const priorityOrder: Record<OrderPriority, number> = { urgent: 0, rush: 1, normal: 2 };
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }

  async getOrdersAtStage(stage: PipelineStage): Promise<PipelineOrder[]> {
    await this.ensureLoaded();
    return this.orders.filter(o => o.currentStage === stage && !o.cancelled);
  }

  async getOrderStats(): Promise<{
    total: number;
    active: number;
    completed: number;
    cancelled: number;
    byStage: Record<PipelineStage, number>;
    byPriority: Record<OrderPriority, number>;
    totalValue: number;
    avgOrderValue: number;
  }> {
    await this.ensureLoaded();
    const active = this.orders.filter(o => !o.cancelled && o.currentStage !== 'JOB_CLOSED');
    const completed = this.orders.filter(o => o.currentStage === 'JOB_CLOSED');
    const cancelled = this.orders.filter(o => o.cancelled);

    const byStage = {} as Record<PipelineStage, number>;
    for (const stage of PIPELINE_STAGES) {
      byStage[stage] = this.orders.filter(o => o.currentStage === stage && !o.cancelled).length;
    }

    const byPriority = { normal: 0, rush: 0, urgent: 0 } as Record<OrderPriority, number>;
    for (const order of active) {
      byPriority[order.priority]++;
    }

    const totalValue = this.orders.filter(o => !o.cancelled).reduce((sum, o) => sum + o.totalPrice, 0);

    return {
      total: this.orders.length,
      active: active.length,
      completed: completed.length,
      cancelled: cancelled.length,
      byStage,
      byPriority,
      totalValue: Math.round(totalValue * 100) / 100,
      avgOrderValue: this.orders.length > 0 ? Math.round(totalValue / this.orders.filter(o => !o.cancelled).length * 100) / 100 : 0,
    };
  }

  // ============================================
  // INVOICES
  // ============================================

  async getInvoice(invoiceId: string): Promise<PipelineInvoice | undefined> {
    await this.ensureLoaded();
    return this.invoices.find(i => i.invoiceId === invoiceId);
  }

  async getInvoicesByOrder(orderId: string): Promise<PipelineInvoice[]> {
    await this.ensureLoaded();
    return this.invoices.filter(i => i.orderId === orderId);
  }

  async getInvoices(filters?: {
    type?: PipelineInvoice['type'];
    status?: PipelineInvoice['status'];
    limit?: number;
  }): Promise<PipelineInvoice[]> {
    await this.ensureLoaded();
    let inv = [...this.invoices];
    if (filters?.type) inv = inv.filter(i => i.type === filters.type);
    if (filters?.status) inv = inv.filter(i => i.status === filters.status);
    return inv.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, filters?.limit || 100);
  }

  async updateInvoiceStatus(invoiceId: string, status: PipelineInvoice['status'], paidAmount?: number): Promise<PipelineInvoice | null> {
    await this.ensureLoaded();
    const invoice = this.invoices.find(i => i.invoiceId === invoiceId);
    if (!invoice) return null;

    invoice.status = status;
    if (status === 'sent') invoice.sentAt = new Date().toISOString();
    if (status === 'paid') {
      invoice.paidAt = new Date().toISOString();
      invoice.paidAmount = paidAmount || invoice.total;
    }

    // AWAIT the persist — invoices are critical financial records
    await this._persistInvoice(invoice).catch((err) =>
      console.error('[pipeline] updateInvoiceStatus persist failed:', err)
    );
    return invoice;
  }

  /**
   * Get customer invoice (FINAL PRICE ONLY — safe for JN/sales reps).
   */
  async getCustomerInvoice(orderId: string): Promise<PipelineInvoice | undefined> {
    await this.ensureLoaded();
    return this.invoices.find(i => i.orderId === orderId && i.type === 'customer');
  }

  /**
   * Get internal invoice (PURCHASE + FINAL PRICE — admin/office only).
   * NEVER send to JN or sales reps.
   */
  async getInternalInvoice(orderId: string): Promise<PipelineInvoice | undefined> {
    await this.ensureLoaded();
    return this.invoices.find(i => i.orderId === orderId && i.type === 'internal');
  }

  // ============================================
  // PULL SHEET GENERATION
  // ============================================

  async generatePullSheet(orderId: string): Promise<{
    orderId: string;
    jobName: string;
    driverName: string;
    scheduledDate: string;
    items: { productName: string; sku: string; quantity: number; unit: string; location: string }[];
    priority: OrderPriority;
    specialInstructions?: string;
  } | null> {
    await this.ensureLoaded();
    const order = this.orders.find(o => o.orderId === orderId);
    if (!order) return null;

    const items: { productName: string; sku: string; quantity: number; unit: string; location: string }[] = [];
    for (const item of order.items) {
      const invItem = await unifiedInventoryService.getItemById(item.productId);
      items.push({
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        unit: item.unit,
        location: invItem?.location || '',
      });
    }

    return {
      orderId: order.orderId,
      jobName: order.jobName,
      driverName: order.assignedDriverName || 'Unassigned',
      scheduledDate: order.scheduledDeliveryDate || order.requestedDeliveryDate,
      items,
      priority: order.priority,
      specialInstructions: order.specialInstructions,
    };
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const materialOrderPipeline = new MaterialOrderPipelineService();
