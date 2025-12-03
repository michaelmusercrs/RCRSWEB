import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Billing statuses with strict workflow progression
export type BillingStatus =
  | 'pending_review'      // Material order created, waiting for office review
  | 'approved'            // Office approved the order
  | 'materials_out'       // Materials left warehouse
  | 'delivered'           // Confirmed delivery
  | 'pending_billing'     // Ready to be billed to job
  | 'billed'              // Invoice created
  | 'paid'                // Payment received
  | 'credit_pending'      // Return/credit in progress
  | 'credited'            // Credit applied
  | 'disputed'            // Billing dispute
  | 'write_off'           // Approved write-off (loss)
  | 'flagged';            // Flagged for review (anomaly detected)

export type VendorSource = 'in_house' | 'lowes' | 'advanced_roofing' | 'gulf_eagle' | 'abc_supply' | 'beacon' | 'other';

export type TransactionType =
  | 'material_delivery'   // Materials going to job
  | 'material_return'     // Materials coming back from job
  | 'stock_purchase'      // Buying from vendor
  | 'stock_return'        // Returning to vendor
  | 'internal_transfer'   // Moving between locations
  | 'inventory_adjustment' // Count correction
  | 'loss_damage';        // Damaged/lost materials

export interface BillingRecord {
  billingId: string;
  ticketId?: string;
  jobId: string;
  jobName: string;
  jobAddress: string;
  transactionType: TransactionType;
  billingStatus: BillingStatus;

  // Material details
  materials: BillingMaterial[];
  totalOurCost: number;
  totalChargeAmount: number;
  markup: number;

  // Vendor info (for purchases)
  vendorSource: VendorSource;
  vendorInvoiceNumber?: string;
  vendorInvoiceDate?: string;
  vendorPaymentDue?: string;
  vendorPaymentStatus?: 'unpaid' | 'paid' | 'disputed';

  // Job billing
  customerInvoiceNumber?: string;
  customerInvoiceDate?: string;
  customerPaymentDue?: string;
  customerPaymentStatus?: 'unbilled' | 'billed' | 'paid' | 'partial' | 'overdue';

  // Tracking
  createdBy: string;
  createdByName: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  billedBy?: string;
  billedAt?: string;

  // Safeguards
  requiresApproval: boolean;
  approvalReason?: string;
  flaggedReason?: string;
  daysSinceDelivery?: number;
  billingDeadline?: string;

  // Audit trail
  statusHistory: StatusChange[];
  notes: string[];
}

export interface BillingMaterial {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  ourCost: number;
  chargeAmount: number;
  returned?: number;
  damaged?: number;
  actualUsed?: number;
}

export interface StatusChange {
  fromStatus: BillingStatus;
  toStatus: BillingStatus;
  changedBy: string;
  changedByName: string;
  changedAt: string;
  reason?: string;
}

export interface BillingAlert {
  alertId: string;
  alertType: 'unbilled_delivery' | 'overdue_billing' | 'cost_variance' | 'unusual_quantity' |
             'return_without_credit' | 'loss_detected' | 'approval_required' | 'vendor_payment_due';
  severity: 'low' | 'medium' | 'high' | 'critical';
  billingId?: string;
  ticketId?: string;
  jobId?: string;
  title: string;
  description: string;
  amount?: number;
  createdAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolution?: string;
}

export interface VendorPurchase {
  purchaseId: string;
  vendorSource: VendorSource;
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  paymentDue: string;

  items: VendorPurchaseItem[];
  subtotal: number;
  tax: number;
  total: number;

  // Assignment
  jobId?: string;
  jobName?: string;
  ticketId?: string;

  // Status
  paymentStatus: 'pending' | 'paid' | 'partial' | 'disputed' | 'returned';
  billedToJob: boolean;
  billingRecordId?: string;

  // Tracking
  purchasedBy: string;
  purchasedByName: string;
  createdAt: string;
  paidAt?: string;
  paidBy?: string;

  notes: string;
  receiptUrl?: string;
}

export interface VendorPurchaseItem {
  description: string;
  sku?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  category?: string;
}

export interface LossReport {
  lossId: string;
  billingId?: string;
  ticketId?: string;
  jobId: string;
  jobName: string;

  lossType: 'theft' | 'damage' | 'shortage' | 'miscount' | 'unaccounted';
  materials: BillingMaterial[];
  totalLossValue: number;

  discoveredBy: string;
  discoveredByName: string;
  discoveredAt: string;

  investigation: string;
  rootCause?: string;
  preventiveMeasures?: string;

  status: 'reported' | 'investigating' | 'resolved' | 'written_off';
  approvedWriteOff: boolean;
  approvedBy?: string;
  approvedAt?: string;
}

export interface ReconciliationReport {
  reportId: string;
  reportDate: string;
  periodStart: string;
  periodEnd: string;

  // Summary
  totalDeliveries: number;
  totalBilled: number;
  totalUnbilled: number;
  unbilledAmount: number;

  totalReturns: number;
  totalCredited: number;
  uncreditedReturns: number;

  totalVendorPurchases: number;
  totalVendorPaid: number;
  vendorAmountDue: number;

  // Discrepancies
  discrepancies: Discrepancy[];

  // Generated by
  generatedBy: string;
  generatedAt: string;
}

export interface Discrepancy {
  type: 'unbilled' | 'uncredited' | 'cost_mismatch' | 'quantity_mismatch' | 'missing_delivery';
  billingId?: string;
  jobId: string;
  description: string;
  amount: number;
  severity: 'low' | 'medium' | 'high';
}

// Billing thresholds for automatic flagging
const BILLING_THRESHOLDS = {
  maxDaysUnbilled: 3,           // Days before delivery becomes overdue for billing
  maxSingleOrderAmount: 5000,   // Require approval for orders over this amount
  maxQuantityPerItem: 100,      // Flag unusual quantities
  minMarkupPercent: 15,         // Flag if markup is below this
  maxMarkupPercent: 100,        // Flag if markup is above this
  costVarianceThreshold: 0.10,  // 10% variance from expected cost
  vendorPaymentDays: 30,        // Days until vendor payment due
};

class BillingWorkflowService {
  private doc: GoogleSpreadsheet | null = null;
  private initialized = false;

  private async getDoc(): Promise<GoogleSpreadsheet> {
    if (this.doc && this.initialized) {
      return this.doc;
    }

    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!serviceAccountEmail || !privateKey || !sheetId) {
      throw new Error('Missing Google Sheets credentials');
    }

    const jwt = new JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.doc = new GoogleSpreadsheet(sheetId, jwt);
    await this.doc.loadInfo();
    this.initialized = true;

    return this.doc;
  }

  private async getOrCreateSheet(sheetName: string, headers: string[]) {
    const doc = await this.getDoc();
    let sheet = doc.sheetsByTitle[sheetName];

    if (!sheet) {
      sheet = await doc.addSheet({ title: sheetName, headerValues: headers });
    }

    return sheet;
  }

  // ============ BILLING RECORD MANAGEMENT ============

  async createBillingRecord(data: {
    ticketId?: string;
    jobId: string;
    jobName: string;
    jobAddress: string;
    transactionType: TransactionType;
    materials: BillingMaterial[];
    vendorSource: VendorSource;
    vendorInvoiceNumber?: string;
    createdBy: string;
    createdByName: string;
  }): Promise<BillingRecord> {
    const sheet = await this.getOrCreateSheet('Billing_Records', [
      'billingId', 'ticketId', 'jobId', 'jobName', 'jobAddress', 'transactionType',
      'billingStatus', 'materials', 'totalOurCost', 'totalChargeAmount', 'markup',
      'vendorSource', 'vendorInvoiceNumber', 'vendorInvoiceDate', 'vendorPaymentDue',
      'vendorPaymentStatus', 'customerInvoiceNumber', 'customerInvoiceDate',
      'customerPaymentDue', 'customerPaymentStatus', 'createdBy', 'createdByName',
      'createdAt', 'approvedBy', 'approvedAt', 'billedBy', 'billedAt',
      'requiresApproval', 'approvalReason', 'flaggedReason', 'daysSinceDelivery',
      'billingDeadline', 'statusHistory', 'notes'
    ]);

    const billingId = `BIL-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const now = new Date().toISOString();

    // Calculate totals
    const totalOurCost = data.materials.reduce((sum, m) => sum + (m.ourCost * m.quantity), 0);
    const totalChargeAmount = data.materials.reduce((sum, m) => sum + (m.chargeAmount * m.quantity), 0);
    const markup = totalOurCost > 0 ? ((totalChargeAmount - totalOurCost) / totalOurCost) * 100 : 0;

    // Determine if approval is required
    const { requiresApproval, approvalReason } = this.checkApprovalRequired(data, totalChargeAmount, markup);

    // Set initial status based on transaction type and approval
    let initialStatus: BillingStatus = 'pending_review';
    if (data.transactionType === 'material_return') {
      initialStatus = 'credit_pending';
    }

    // Calculate billing deadline (3 days from now for deliveries)
    const billingDeadline = new Date();
    billingDeadline.setDate(billingDeadline.getDate() + BILLING_THRESHOLDS.maxDaysUnbilled);

    const billingRecord: BillingRecord = {
      billingId,
      ticketId: data.ticketId,
      jobId: data.jobId,
      jobName: data.jobName,
      jobAddress: data.jobAddress,
      transactionType: data.transactionType,
      billingStatus: initialStatus,
      materials: data.materials,
      totalOurCost,
      totalChargeAmount,
      markup,
      vendorSource: data.vendorSource,
      vendorInvoiceNumber: data.vendorInvoiceNumber,
      customerPaymentStatus: 'unbilled',
      createdBy: data.createdBy,
      createdByName: data.createdByName,
      createdAt: now,
      requiresApproval,
      approvalReason,
      billingDeadline: billingDeadline.toISOString(),
      statusHistory: [{
        fromStatus: 'pending_review',
        toStatus: initialStatus,
        changedBy: data.createdBy,
        changedByName: data.createdByName,
        changedAt: now,
        reason: 'Initial creation'
      }],
      notes: []
    };

    await sheet.addRow({
      ...billingRecord,
      materials: JSON.stringify(billingRecord.materials),
      statusHistory: JSON.stringify(billingRecord.statusHistory),
      notes: JSON.stringify(billingRecord.notes)
    });

    // Create alert if approval required
    if (requiresApproval) {
      await this.createAlert({
        alertType: 'approval_required',
        severity: totalChargeAmount > 10000 ? 'critical' : 'high',
        billingId,
        jobId: data.jobId,
        title: `Approval Required: ${data.jobName}`,
        description: approvalReason || 'Order requires manager approval',
        amount: totalChargeAmount,
        createdBy: data.createdBy
      });
    }

    // Notify office of new billing record
    await this.notifyOffice(billingRecord, 'new_order');

    return billingRecord;
  }

  private checkApprovalRequired(data: any, totalAmount: number, markup: number): { requiresApproval: boolean; approvalReason?: string } {
    const reasons: string[] = [];

    // Check total amount threshold
    if (totalAmount > BILLING_THRESHOLDS.maxSingleOrderAmount) {
      reasons.push(`Order exceeds $${BILLING_THRESHOLDS.maxSingleOrderAmount}`);
    }

    // Check markup thresholds
    if (markup < BILLING_THRESHOLDS.minMarkupPercent) {
      reasons.push(`Markup (${markup.toFixed(1)}%) below minimum ${BILLING_THRESHOLDS.minMarkupPercent}%`);
    }
    if (markup > BILLING_THRESHOLDS.maxMarkupPercent) {
      reasons.push(`Markup (${markup.toFixed(1)}%) exceeds maximum ${BILLING_THRESHOLDS.maxMarkupPercent}%`);
    }

    // Check unusual quantities
    const unusualQty = data.materials.find((m: BillingMaterial) => m.quantity > BILLING_THRESHOLDS.maxQuantityPerItem);
    if (unusualQty) {
      reasons.push(`Unusual quantity: ${unusualQty.quantity} ${unusualQty.productName}`);
    }

    return {
      requiresApproval: reasons.length > 0,
      approvalReason: reasons.length > 0 ? reasons.join('; ') : undefined
    };
  }

  async updateBillingStatus(
    billingId: string,
    newStatus: BillingStatus,
    updatedBy: string,
    updatedByName: string,
    reason?: string
  ): Promise<BillingRecord | null> {
    const sheet = await this.getOrCreateSheet('Billing_Records', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('billingId') === billingId);

    if (!row) return null;

    const oldStatus = row.get('billingStatus') as BillingStatus;
    const now = new Date().toISOString();

    // Validate status transition
    if (!this.isValidStatusTransition(oldStatus, newStatus)) {
      throw new Error(`Invalid status transition from ${oldStatus} to ${newStatus}`);
    }

    // Update status history
    const statusHistory = JSON.parse(row.get('statusHistory') || '[]');
    statusHistory.push({
      fromStatus: oldStatus,
      toStatus: newStatus,
      changedBy: updatedBy,
      changedByName: updatedByName,
      changedAt: now,
      reason
    });

    row.set('billingStatus', newStatus);
    row.set('statusHistory', JSON.stringify(statusHistory));

    // Update related fields based on new status
    if (newStatus === 'approved') {
      row.set('approvedBy', updatedBy);
      row.set('approvedAt', now);
    } else if (newStatus === 'billed') {
      row.set('billedBy', updatedBy);
      row.set('billedAt', now);
      row.set('customerPaymentStatus', 'billed');
    } else if (newStatus === 'materials_out') {
      // Start countdown for billing deadline
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + BILLING_THRESHOLDS.maxDaysUnbilled);
      row.set('billingDeadline', deadline.toISOString());
    }

    await row.save();

    return this.rowToBillingRecord(row);
  }

  private isValidStatusTransition(from: BillingStatus, to: BillingStatus): boolean {
    const validTransitions: Record<BillingStatus, BillingStatus[]> = {
      pending_review: ['approved', 'flagged', 'credit_pending'],
      approved: ['materials_out', 'flagged'],
      materials_out: ['delivered', 'flagged'],
      delivered: ['pending_billing', 'credit_pending', 'flagged'],
      pending_billing: ['billed', 'flagged', 'disputed'],
      billed: ['paid', 'disputed', 'credit_pending'],
      paid: ['credit_pending'],
      credit_pending: ['credited', 'disputed'],
      credited: [],
      disputed: ['pending_billing', 'write_off', 'flagged'],
      write_off: [],
      flagged: ['pending_review', 'approved', 'write_off']
    };

    return validTransitions[from]?.includes(to) ?? false;
  }

  async getBillingRecords(filters?: {
    status?: BillingStatus;
    jobId?: string;
    ticketId?: string;
    vendorSource?: VendorSource;
    dateFrom?: string;
    dateTo?: string;
    unbilledOnly?: boolean;
  }): Promise<BillingRecord[]> {
    const sheet = await this.getOrCreateSheet('Billing_Records', []);
    const rows = await sheet.getRows();

    let records = rows.map(row => this.rowToBillingRecord(row));

    if (filters) {
      if (filters.status) {
        records = records.filter(r => r.billingStatus === filters.status);
      }
      if (filters.jobId) {
        records = records.filter(r => r.jobId === filters.jobId);
      }
      if (filters.ticketId) {
        records = records.filter(r => r.ticketId === filters.ticketId);
      }
      if (filters.vendorSource) {
        records = records.filter(r => r.vendorSource === filters.vendorSource);
      }
      if (filters.unbilledOnly) {
        records = records.filter(r =>
          r.customerPaymentStatus === 'unbilled' &&
          ['delivered', 'pending_billing'].includes(r.billingStatus)
        );
      }
      if (filters.dateFrom) {
        records = records.filter(r => r.createdAt >= filters.dateFrom!);
      }
      if (filters.dateTo) {
        records = records.filter(r => r.createdAt <= filters.dateTo!);
      }
    }

    return records;
  }

  private rowToBillingRecord(row: any): BillingRecord {
    return {
      billingId: row.get('billingId'),
      ticketId: row.get('ticketId'),
      jobId: row.get('jobId'),
      jobName: row.get('jobName'),
      jobAddress: row.get('jobAddress'),
      transactionType: row.get('transactionType') as TransactionType,
      billingStatus: row.get('billingStatus') as BillingStatus,
      materials: JSON.parse(row.get('materials') || '[]'),
      totalOurCost: parseFloat(row.get('totalOurCost')) || 0,
      totalChargeAmount: parseFloat(row.get('totalChargeAmount')) || 0,
      markup: parseFloat(row.get('markup')) || 0,
      vendorSource: row.get('vendorSource') as VendorSource,
      vendorInvoiceNumber: row.get('vendorInvoiceNumber'),
      vendorInvoiceDate: row.get('vendorInvoiceDate'),
      vendorPaymentDue: row.get('vendorPaymentDue'),
      vendorPaymentStatus: row.get('vendorPaymentStatus'),
      customerInvoiceNumber: row.get('customerInvoiceNumber'),
      customerInvoiceDate: row.get('customerInvoiceDate'),
      customerPaymentDue: row.get('customerPaymentDue'),
      customerPaymentStatus: row.get('customerPaymentStatus'),
      createdBy: row.get('createdBy'),
      createdByName: row.get('createdByName'),
      createdAt: row.get('createdAt'),
      approvedBy: row.get('approvedBy'),
      approvedAt: row.get('approvedAt'),
      billedBy: row.get('billedBy'),
      billedAt: row.get('billedAt'),
      requiresApproval: row.get('requiresApproval') === 'true',
      approvalReason: row.get('approvalReason'),
      flaggedReason: row.get('flaggedReason'),
      daysSinceDelivery: parseInt(row.get('daysSinceDelivery')) || undefined,
      billingDeadline: row.get('billingDeadline'),
      statusHistory: JSON.parse(row.get('statusHistory') || '[]'),
      notes: JSON.parse(row.get('notes') || '[]')
    };
  }

  // ============ VENDOR PURCHASE MANAGEMENT ============

  async createVendorPurchase(data: {
    vendorSource: VendorSource;
    vendorName: string;
    invoiceNumber: string;
    invoiceDate: string;
    items: VendorPurchaseItem[];
    jobId?: string;
    jobName?: string;
    ticketId?: string;
    purchasedBy: string;
    purchasedByName: string;
    notes?: string;
    receiptUrl?: string;
  }): Promise<VendorPurchase> {
    const sheet = await this.getOrCreateSheet('Vendor_Purchases', [
      'purchaseId', 'vendorSource', 'vendorName', 'invoiceNumber', 'invoiceDate',
      'paymentDue', 'items', 'subtotal', 'tax', 'total', 'jobId', 'jobName',
      'ticketId', 'paymentStatus', 'billedToJob', 'billingRecordId', 'purchasedBy',
      'purchasedByName', 'createdAt', 'paidAt', 'paidBy', 'notes', 'receiptUrl'
    ]);

    const purchaseId = `VP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const now = new Date().toISOString();

    // Calculate totals
    const subtotal = data.items.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * 0.09; // 9% tax estimate
    const total = subtotal + tax;

    // Calculate payment due date
    const paymentDue = new Date(data.invoiceDate);
    paymentDue.setDate(paymentDue.getDate() + BILLING_THRESHOLDS.vendorPaymentDays);

    const purchase: VendorPurchase = {
      purchaseId,
      vendorSource: data.vendorSource,
      vendorName: data.vendorName,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate,
      paymentDue: paymentDue.toISOString(),
      items: data.items,
      subtotal,
      tax,
      total,
      jobId: data.jobId,
      jobName: data.jobName,
      ticketId: data.ticketId,
      paymentStatus: 'pending',
      billedToJob: false,
      purchasedBy: data.purchasedBy,
      purchasedByName: data.purchasedByName,
      createdAt: now,
      notes: data.notes || '',
      receiptUrl: data.receiptUrl
    };

    await sheet.addRow({
      ...purchase,
      items: JSON.stringify(purchase.items)
    });

    // Create billing record if job is specified
    if (data.jobId && data.jobName) {
      const billingRecord = await this.createBillingRecord({
        ticketId: data.ticketId,
        jobId: data.jobId,
        jobName: data.jobName,
        jobAddress: '', // Will be filled from job data
        transactionType: 'stock_purchase',
        materials: data.items.map(item => ({
          productId: item.sku || item.description,
          productName: item.description,
          quantity: item.quantity,
          unit: item.unit,
          ourCost: item.unitPrice,
          chargeAmount: item.unitPrice * 1.25 // 25% markup default
        })),
        vendorSource: data.vendorSource,
        vendorInvoiceNumber: data.invoiceNumber,
        createdBy: data.purchasedBy,
        createdByName: data.purchasedByName
      });

      // Update purchase with billing record link
      const rows = await sheet.getRows();
      const row = rows.find(r => r.get('purchaseId') === purchaseId);
      if (row) {
        row.set('billingRecordId', billingRecord.billingId);
        await row.save();
      }
    }

    // Alert if not assigned to job
    if (!data.jobId) {
      await this.createAlert({
        alertType: 'approval_required',
        severity: 'medium',
        title: `Vendor Purchase Not Assigned to Job`,
        description: `Purchase from ${data.vendorName} ($${total.toFixed(2)}) has no job assignment`,
        amount: total,
        createdBy: data.purchasedBy
      });
    }

    return purchase;
  }

  async getVendorPurchases(filters?: {
    vendorSource?: VendorSource;
    jobId?: string;
    paymentStatus?: string;
    unbilledOnly?: boolean;
  }): Promise<VendorPurchase[]> {
    const sheet = await this.getOrCreateSheet('Vendor_Purchases', []);
    const rows = await sheet.getRows();

    let purchases = rows.map(row => ({
      purchaseId: row.get('purchaseId'),
      vendorSource: row.get('vendorSource') as VendorSource,
      vendorName: row.get('vendorName'),
      invoiceNumber: row.get('invoiceNumber'),
      invoiceDate: row.get('invoiceDate'),
      paymentDue: row.get('paymentDue'),
      items: JSON.parse(row.get('items') || '[]'),
      subtotal: parseFloat(row.get('subtotal')) || 0,
      tax: parseFloat(row.get('tax')) || 0,
      total: parseFloat(row.get('total')) || 0,
      jobId: row.get('jobId'),
      jobName: row.get('jobName'),
      ticketId: row.get('ticketId'),
      paymentStatus: row.get('paymentStatus') as 'pending' | 'paid' | 'partial' | 'disputed' | 'returned',
      billedToJob: row.get('billedToJob') === 'true',
      billingRecordId: row.get('billingRecordId'),
      purchasedBy: row.get('purchasedBy'),
      purchasedByName: row.get('purchasedByName'),
      createdAt: row.get('createdAt'),
      paidAt: row.get('paidAt'),
      paidBy: row.get('paidBy'),
      notes: row.get('notes'),
      receiptUrl: row.get('receiptUrl')
    }));

    if (filters) {
      if (filters.vendorSource) {
        purchases = purchases.filter(p => p.vendorSource === filters.vendorSource);
      }
      if (filters.jobId) {
        purchases = purchases.filter(p => p.jobId === filters.jobId);
      }
      if (filters.paymentStatus) {
        purchases = purchases.filter(p => p.paymentStatus === filters.paymentStatus);
      }
      if (filters.unbilledOnly) {
        purchases = purchases.filter(p => !p.billedToJob);
      }
    }

    return purchases;
  }

  // ============ ALERTS MANAGEMENT ============

  async createAlert(data: {
    alertType: BillingAlert['alertType'];
    severity: BillingAlert['severity'];
    billingId?: string;
    ticketId?: string;
    jobId?: string;
    title: string;
    description: string;
    amount?: number;
    createdBy: string;
  }): Promise<BillingAlert> {
    const sheet = await this.getOrCreateSheet('Billing_Alerts', [
      'alertId', 'alertType', 'severity', 'billingId', 'ticketId', 'jobId',
      'title', 'description', 'amount', 'createdAt', 'acknowledgedBy',
      'acknowledgedAt', 'resolvedBy', 'resolvedAt', 'resolution'
    ]);

    const alertId = `ALT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const now = new Date().toISOString();

    const alert: BillingAlert = {
      alertId,
      alertType: data.alertType,
      severity: data.severity,
      billingId: data.billingId,
      ticketId: data.ticketId,
      jobId: data.jobId,
      title: data.title,
      description: data.description,
      amount: data.amount,
      createdAt: now
    };

    await sheet.addRow({
      alertId: alert.alertId,
      alertType: alert.alertType,
      severity: alert.severity,
      billingId: alert.billingId || '',
      ticketId: alert.ticketId || '',
      jobId: alert.jobId || '',
      title: alert.title,
      description: alert.description,
      amount: alert.amount?.toString() || '',
      createdAt: alert.createdAt,
      acknowledgedBy: '',
      acknowledgedAt: '',
      resolvedBy: '',
      resolvedAt: '',
      resolution: ''
    });

    return alert;
  }

  async getAlerts(filters?: {
    unresolved?: boolean;
    severity?: BillingAlert['severity'];
    alertType?: BillingAlert['alertType'];
  }): Promise<BillingAlert[]> {
    const sheet = await this.getOrCreateSheet('Billing_Alerts', []);
    const rows = await sheet.getRows();

    let alerts: BillingAlert[] = rows.map(row => ({
      alertId: row.get('alertId'),
      alertType: row.get('alertType') as BillingAlert['alertType'],
      severity: row.get('severity') as BillingAlert['severity'],
      billingId: row.get('billingId'),
      ticketId: row.get('ticketId'),
      jobId: row.get('jobId'),
      title: row.get('title'),
      description: row.get('description'),
      amount: parseFloat(row.get('amount')) || undefined,
      createdAt: row.get('createdAt'),
      acknowledgedBy: row.get('acknowledgedBy'),
      acknowledgedAt: row.get('acknowledgedAt'),
      resolvedBy: row.get('resolvedBy'),
      resolvedAt: row.get('resolvedAt'),
      resolution: row.get('resolution')
    }));

    if (filters) {
      if (filters.unresolved) {
        alerts = alerts.filter(a => !a.resolvedAt);
      }
      if (filters.severity) {
        alerts = alerts.filter(a => a.severity === filters.severity);
      }
      if (filters.alertType) {
        alerts = alerts.filter(a => a.alertType === filters.alertType);
      }
    }

    // Sort by severity and date
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    alerts.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return alerts;
  }

  async resolveAlert(
    alertId: string,
    resolvedBy: string,
    resolution: string
  ): Promise<BillingAlert | null> {
    const sheet = await this.getOrCreateSheet('Billing_Alerts', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('alertId') === alertId);

    if (!row) return null;

    row.set('resolvedBy', resolvedBy);
    row.set('resolvedAt', new Date().toISOString());
    row.set('resolution', resolution);
    await row.save();

    return {
      alertId: row.get('alertId'),
      alertType: row.get('alertType'),
      severity: row.get('severity'),
      billingId: row.get('billingId'),
      ticketId: row.get('ticketId'),
      jobId: row.get('jobId'),
      title: row.get('title'),
      description: row.get('description'),
      amount: parseFloat(row.get('amount')) || undefined,
      createdAt: row.get('createdAt'),
      acknowledgedBy: row.get('acknowledgedBy'),
      acknowledgedAt: row.get('acknowledgedAt'),
      resolvedBy: row.get('resolvedBy'),
      resolvedAt: row.get('resolvedAt'),
      resolution: row.get('resolution')
    };
  }

  // ============ LOSS TRACKING ============

  async reportLoss(data: {
    billingId?: string;
    ticketId?: string;
    jobId: string;
    jobName: string;
    lossType: LossReport['lossType'];
    materials: BillingMaterial[];
    discoveredBy: string;
    discoveredByName: string;
    investigation: string;
  }): Promise<LossReport> {
    const sheet = await this.getOrCreateSheet('Loss_Reports', [
      'lossId', 'billingId', 'ticketId', 'jobId', 'jobName', 'lossType',
      'materials', 'totalLossValue', 'discoveredBy', 'discoveredByName',
      'discoveredAt', 'investigation', 'rootCause', 'preventiveMeasures',
      'status', 'approvedWriteOff', 'approvedBy', 'approvedAt'
    ]);

    const lossId = `LOSS-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const now = new Date().toISOString();

    const totalLossValue = data.materials.reduce((sum, m) => sum + (m.ourCost * m.quantity), 0);

    const lossReport: LossReport = {
      lossId,
      billingId: data.billingId,
      ticketId: data.ticketId,
      jobId: data.jobId,
      jobName: data.jobName,
      lossType: data.lossType,
      materials: data.materials,
      totalLossValue,
      discoveredBy: data.discoveredBy,
      discoveredByName: data.discoveredByName,
      discoveredAt: now,
      investigation: data.investigation,
      status: 'reported',
      approvedWriteOff: false
    };

    await sheet.addRow({
      ...lossReport,
      materials: JSON.stringify(lossReport.materials)
    });

    // Create critical alert
    await this.createAlert({
      alertType: 'loss_detected',
      severity: totalLossValue > 500 ? 'critical' : 'high',
      billingId: data.billingId,
      ticketId: data.ticketId,
      jobId: data.jobId,
      title: `Loss Reported: ${data.lossType}`,
      description: `${data.jobName}: $${totalLossValue.toFixed(2)} loss - ${data.investigation}`,
      amount: totalLossValue,
      createdBy: data.discoveredBy
    });

    return lossReport;
  }

  // ============ RECONCILIATION ============

  async runReconciliation(
    periodStart: string,
    periodEnd: string,
    generatedBy: string
  ): Promise<ReconciliationReport> {
    const billingRecords = await this.getBillingRecords({
      dateFrom: periodStart,
      dateTo: periodEnd
    });

    const vendorPurchases = await this.getVendorPurchases();

    // Calculate metrics
    const deliveries = billingRecords.filter(r => r.transactionType === 'material_delivery');
    const unbilledDeliveries = deliveries.filter(r => r.customerPaymentStatus === 'unbilled');
    const returns = billingRecords.filter(r => r.transactionType === 'material_return');
    const uncreditedReturns = returns.filter(r => r.billingStatus !== 'credited');

    const discrepancies: Discrepancy[] = [];

    // Find unbilled deliveries past deadline
    unbilledDeliveries.forEach(record => {
      if (record.billingDeadline && new Date(record.billingDeadline) < new Date()) {
        discrepancies.push({
          type: 'unbilled',
          billingId: record.billingId,
          jobId: record.jobId,
          description: `Delivery to ${record.jobName} past billing deadline`,
          amount: record.totalChargeAmount,
          severity: record.totalChargeAmount > 1000 ? 'high' : 'medium'
        });
      }
    });

    // Find uncredited returns
    uncreditedReturns.forEach(record => {
      discrepancies.push({
        type: 'uncredited',
        billingId: record.billingId,
        jobId: record.jobId,
        description: `Return from ${record.jobName} not credited`,
        amount: record.totalChargeAmount,
        severity: 'medium'
      });
    });

    // Find vendor purchases not billed to job
    const unbilledPurchases = vendorPurchases.filter(p => p.jobId && !p.billedToJob);
    unbilledPurchases.forEach(purchase => {
      discrepancies.push({
        type: 'unbilled',
        jobId: purchase.jobId!,
        description: `Vendor purchase from ${purchase.vendorName} not billed to ${purchase.jobName}`,
        amount: purchase.total,
        severity: 'high'
      });
    });

    const report: ReconciliationReport = {
      reportId: `REC-${Date.now()}`,
      reportDate: new Date().toISOString(),
      periodStart,
      periodEnd,
      totalDeliveries: deliveries.length,
      totalBilled: deliveries.filter(d => d.customerPaymentStatus !== 'unbilled').length,
      totalUnbilled: unbilledDeliveries.length,
      unbilledAmount: unbilledDeliveries.reduce((sum, d) => sum + d.totalChargeAmount, 0),
      totalReturns: returns.length,
      totalCredited: returns.filter(r => r.billingStatus === 'credited').length,
      uncreditedReturns: uncreditedReturns.length,
      totalVendorPurchases: vendorPurchases.length,
      totalVendorPaid: vendorPurchases.filter(p => p.paymentStatus === 'paid').length,
      vendorAmountDue: vendorPurchases
        .filter(p => p.paymentStatus === 'pending')
        .reduce((sum, p) => sum + p.total, 0),
      discrepancies,
      generatedBy,
      generatedAt: new Date().toISOString()
    };

    // Create alerts for high/critical discrepancies
    for (const disc of discrepancies.filter(d => d.severity === 'high')) {
      await this.createAlert({
        alertType: disc.type === 'unbilled' ? 'unbilled_delivery' : 'return_without_credit',
        severity: 'high',
        jobId: disc.jobId,
        billingId: disc.billingId,
        title: `Reconciliation Issue: ${disc.type}`,
        description: disc.description,
        amount: disc.amount,
        createdBy: generatedBy
      });
    }

    return report;
  }

  // ============ AUTOMATED SAFEGUARDS ============

  async runDailyBillingCheck(): Promise<{
    alertsCreated: number;
    overdueItems: number;
    issues: string[]
  }> {
    const issues: string[] = [];
    let alertsCreated = 0;
    let overdueItems = 0;

    // Check for overdue unbilled deliveries
    const billingRecords = await this.getBillingRecords({ unbilledOnly: true });
    const now = new Date();

    for (const record of billingRecords) {
      if (record.billingDeadline && new Date(record.billingDeadline) < now) {
        overdueItems++;
        const daysPastDue = Math.floor((now.getTime() - new Date(record.billingDeadline).getTime()) / (1000 * 60 * 60 * 24));

        await this.createAlert({
          alertType: 'overdue_billing',
          severity: daysPastDue > 7 ? 'critical' : 'high',
          billingId: record.billingId,
          jobId: record.jobId,
          title: `Overdue Billing: ${record.jobName}`,
          description: `Delivery ${daysPastDue} days past billing deadline. Amount: $${record.totalChargeAmount.toFixed(2)}`,
          amount: record.totalChargeAmount,
          createdBy: 'system'
        });
        alertsCreated++;
        issues.push(`${record.jobName}: $${record.totalChargeAmount.toFixed(2)} - ${daysPastDue} days overdue`);
      }
    }

    // Check for vendor payments due
    const vendorPurchases = await this.getVendorPurchases({ paymentStatus: 'pending' });
    for (const purchase of vendorPurchases) {
      if (purchase.paymentDue && new Date(purchase.paymentDue) < now) {
        await this.createAlert({
          alertType: 'vendor_payment_due',
          severity: 'high',
          title: `Vendor Payment Due: ${purchase.vendorName}`,
          description: `Invoice #${purchase.invoiceNumber} payment overdue. Amount: $${purchase.total.toFixed(2)}`,
          amount: purchase.total,
          createdBy: 'system'
        });
        alertsCreated++;
        issues.push(`Vendor ${purchase.vendorName}: $${purchase.total.toFixed(2)} payment due`);
      }
    }

    return { alertsCreated, overdueItems, issues };
  }

  // ============ OFFICE NOTIFICATIONS ============

  private async notifyOffice(billingRecord: BillingRecord, eventType: string): Promise<void> {
    const sheet = await this.getOrCreateSheet('Office_Notifications', [
      'notificationId', 'eventType', 'billingId', 'jobId', 'jobName',
      'message', 'amount', 'priority', 'createdAt', 'readBy', 'readAt'
    ]);

    const notificationId = `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    let message = '';
    let priority = 'normal';

    switch (eventType) {
      case 'new_order':
        message = `New ${billingRecord.transactionType} order for ${billingRecord.jobName}`;
        priority = billingRecord.requiresApproval ? 'high' : 'normal';
        break;
      case 'approval_needed':
        message = `Approval required: ${billingRecord.jobName} - ${billingRecord.approvalReason}`;
        priority = 'high';
        break;
      case 'materials_out':
        message = `Materials left warehouse for ${billingRecord.jobName} - billing deadline started`;
        priority = 'normal';
        break;
      case 'delivered':
        message = `Delivery confirmed: ${billingRecord.jobName} - ready to bill`;
        priority = 'high';
        break;
    }

    await sheet.addRow({
      notificationId,
      eventType,
      billingId: billingRecord.billingId,
      jobId: billingRecord.jobId,
      jobName: billingRecord.jobName,
      message,
      amount: billingRecord.totalChargeAmount,
      priority,
      createdAt: new Date().toISOString()
    });
  }

  async getOfficeNotifications(unreadOnly = true): Promise<any[]> {
    const sheet = await this.getOrCreateSheet('Office_Notifications', []);
    const rows = await sheet.getRows();

    let notifications = rows.map(row => ({
      notificationId: row.get('notificationId'),
      eventType: row.get('eventType'),
      billingId: row.get('billingId'),
      jobId: row.get('jobId'),
      jobName: row.get('jobName'),
      message: row.get('message'),
      amount: parseFloat(row.get('amount')) || 0,
      priority: row.get('priority'),
      createdAt: row.get('createdAt'),
      readBy: row.get('readBy'),
      readAt: row.get('readAt')
    }));

    if (unreadOnly) {
      notifications = notifications.filter(n => !n.readAt);
    }

    return notifications.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // ============ DASHBOARD STATS ============

  async getBillingDashboardStats(): Promise<{
    unbilledDeliveries: { count: number; amount: number };
    overdueItems: { count: number; amount: number };
    pendingApprovals: { count: number; amount: number };
    vendorPaymentsDue: { count: number; amount: number };
    activeAlerts: { critical: number; high: number; medium: number; low: number };
    todayActivity: { deliveries: number; returns: number; purchases: number };
    weeklyTotals: { billed: number; cost: number; profit: number };
  }> {
    const billingRecords = await this.getBillingRecords();
    const vendorPurchases = await this.getVendorPurchases();
    const alerts = await this.getAlerts({ unresolved: true });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Unbilled deliveries
    const unbilledDeliveries = billingRecords.filter(r =>
      r.transactionType === 'material_delivery' &&
      r.customerPaymentStatus === 'unbilled' &&
      ['delivered', 'pending_billing'].includes(r.billingStatus)
    );

    // Overdue items
    const overdueItems = unbilledDeliveries.filter(r =>
      r.billingDeadline && new Date(r.billingDeadline) < now
    );

    // Pending approvals
    const pendingApprovals = billingRecords.filter(r =>
      r.requiresApproval && r.billingStatus === 'pending_review'
    );

    // Vendor payments due
    const vendorPaymentsDue = vendorPurchases.filter(p =>
      p.paymentStatus === 'pending' &&
      p.paymentDue &&
      new Date(p.paymentDue) < now
    );

    // Alert counts by severity
    const alertCounts = {
      critical: alerts.filter(a => a.severity === 'critical').length,
      high: alerts.filter(a => a.severity === 'high').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
      low: alerts.filter(a => a.severity === 'low').length
    };

    // Today's activity
    const todayRecords = billingRecords.filter(r => r.createdAt >= todayStart);

    // Weekly totals
    const weekRecords = billingRecords.filter(r =>
      r.createdAt >= weekAgo &&
      r.billingStatus === 'billed'
    );

    return {
      unbilledDeliveries: {
        count: unbilledDeliveries.length,
        amount: unbilledDeliveries.reduce((sum, r) => sum + r.totalChargeAmount, 0)
      },
      overdueItems: {
        count: overdueItems.length,
        amount: overdueItems.reduce((sum, r) => sum + r.totalChargeAmount, 0)
      },
      pendingApprovals: {
        count: pendingApprovals.length,
        amount: pendingApprovals.reduce((sum, r) => sum + r.totalChargeAmount, 0)
      },
      vendorPaymentsDue: {
        count: vendorPaymentsDue.length,
        amount: vendorPaymentsDue.reduce((sum, p) => sum + p.total, 0)
      },
      activeAlerts: alertCounts,
      todayActivity: {
        deliveries: todayRecords.filter(r => r.transactionType === 'material_delivery').length,
        returns: todayRecords.filter(r => r.transactionType === 'material_return').length,
        purchases: vendorPurchases.filter(p => p.createdAt >= todayStart).length
      },
      weeklyTotals: {
        billed: weekRecords.reduce((sum, r) => sum + r.totalChargeAmount, 0),
        cost: weekRecords.reduce((sum, r) => sum + r.totalOurCost, 0),
        profit: weekRecords.reduce((sum, r) => sum + (r.totalChargeAmount - r.totalOurCost), 0)
      }
    };
  }
}

export const billingWorkflowService = new BillingWorkflowService();
