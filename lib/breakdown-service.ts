// Customer Breakdown Sheet & Invoice Service
// Manages job breakdowns, invoices, and material tracking with Google Sheets integration

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { InventoryProduct, getProductById } from './inventoryData';
import { jobNimbusService } from './jobnimbus-service';

// ============ TYPE DEFINITIONS ============

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled' | 'disputed';
export type BreakdownStatus = 'active' | 'pending_invoice' | 'invoiced' | 'closed';
export type LaborType = 'installation' | 'repair' | 'inspection' | 'cleanup' | 'other';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | null;

export interface BreakdownChange {
  changeId: string;
  action: string; // 'addMaterial', 'removeMaterial', 'addLabor', 'removeLabor', 'applyDiscount', etc.
  description: string;
  changedBy: string;
  changedByName: string;
  changedAt: string;
  previousValue?: string;
  newValue?: string;
}

export interface MaterialEntry {
  productId: string;
  productName: string;
  description?: string;
  quantity: number;
  unit: string;
  costPrice: number;      // Our cost
  sellPrice: number;      // Customer price
  totalCost: number;      // quantity * costPrice
  totalPrice: number;     // quantity * sellPrice
  addedAt: string;
  addedBy: string;
  addedByName: string;
  notes?: string;
  // Inventory tracking
  fromInventory: boolean;
  inventoryDeducted: boolean;
  inventoryDeductedAt?: string;
}

export interface LaborEntry {
  laborId: string;
  laborType: LaborType;
  description: string;
  hours: number;
  rate: number;
  total: number;
  workerId: string;
  workerName: string;
  workDate: string;
  addedAt: string;
  addedBy: string;
  notes?: string;
}

export interface CustomerBreakdown {
  breakdownId: string;

  // Customer Info
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress: string;
  customerCity: string;
  customerState: string;
  customerZip: string;

  // Job Info
  jobId: string;
  jobNimbusId?: string;       // Link to JobNimbus
  jobName: string;
  jobAddress: string;
  jobDescription?: string;
  projectManager: string;
  projectManagerName: string;

  // Materials
  materials: MaterialEntry[];
  materialsCost: number;      // Sum of all material costs
  materialsPrice: number;     // Sum of all material sell prices
  materialMargin: number;     // Profit margin percentage

  // Labor
  laborEntries: LaborEntry[];
  laborCost: number;

  // Totals
  subtotal: number;           // Materials + Labor
  taxRate: number;            // Tax percentage (e.g., 9.0 for 9%)
  taxAmount: number;          // Calculated tax
  discountAmount: number;     // Any discounts applied
  discountReason?: string;
  totalCost: number;          // Our total cost
  totalPrice: number;         // Customer total price
  profitMargin: number;       // Overall profit margin

  // Status & Tracking
  status: BreakdownStatus;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt: string;
  updatedBy: string;

  // Locking
  lockedBy?: string;          // userId who locked it
  lockedByName?: string;
  lockedAt?: string;          // ISO timestamp

  // Change log
  changeLog: BreakdownChange[];

  // Approval gate
  requiresApproval: boolean;
  approvalStatus: ApprovalStatus;
  approvalSubmittedBy?: string;
  approvalSubmittedByName?: string;
  approvalSubmittedAt?: string;
  approvalDecidedBy?: string;
  approvalDecidedByName?: string;
  approvalDecidedAt?: string;
  approvalRejectionReason?: string;

  // Links
  googleSheetId?: string;     // Link to Google Sheet
  googleSheetUrl?: string;
  invoiceId?: string;         // Generated invoice ID
  portalLink?: string;        // Customer portal link

  notes: string[];
}

export interface Invoice {
  invoiceId: string;
  invoiceNumber: string;      // Human-readable number (INV-2024-001)

  // Link to breakdown
  breakdownId: string;

  // Customer Info (copied from breakdown)
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingZip: string;

  // Job Info
  jobId: string;
  jobNimbusId?: string;
  jobName: string;
  jobAddress: string;

  // Line Items
  lineItems: InvoiceLineItem[];

  // Totals
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  discountReason?: string;
  total: number;

  // Payment Info
  status: InvoiceStatus;
  dueDate: string;
  paidDate?: string;
  paidAmount?: number;
  paymentMethod?: string;
  paymentReference?: string;

  // Tracking
  createdAt: string;
  createdBy: string;
  createdByName: string;
  sentAt?: string;
  sentTo?: string;
  viewedAt?: string;

  // Links
  pdfUrl?: string;
  portalUrl?: string;

  notes: string[];
  terms?: string;
}

export interface InvoiceLineItem {
  lineId: string;
  type: 'material' | 'labor' | 'fee' | 'discount';
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  // Internal tracking (not shown to customer)
  costPrice?: number;
  productId?: string;
}

export interface BreakdownSummary {
  breakdownId: string;
  customerId: string;
  customerName: string;
  jobName: string;
  jobAddress: string;
  status: BreakdownStatus;
  materialsPrice: number;
  laborCost: number;
  totalPrice: number;
  profitMargin: number;
  invoiceId?: string;
  invoiceStatus?: InvoiceStatus;
  lockedBy?: string;
  lockedByName?: string;
  lockedAt?: string;
  approvalStatus: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
}

// ============ SERVICE IMPLEMENTATION ============

class BreakdownService {
  private doc: GoogleSpreadsheet | null = null;
  private initialized = false;

  private async getDoc(): Promise<GoogleSpreadsheet> {
    if (this.doc && this.initialized) {
      return this.doc;
    }

    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const sheetId = process.env.GOOGLE_SHEETS_ID || process.env.GOOGLE_SHEET_ID;

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
      sheet = await doc.addSheet({ title: sheetName, headerValues: headers, gridProperties: { columnCount: Math.max(headers.length + 5, 26) } });
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
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  private generateInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const sequence = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
    return `INV-${year}${month}-${sequence}`;
  }

  // ============ BREAKDOWN MANAGEMENT ============

  async createBreakdown(data: {
    customerId: string;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    customerAddress: string;
    customerCity: string;
    customerState: string;
    customerZip: string;
    jobId: string;
    jobNimbusId?: string;
    jobName: string;
    jobAddress: string;
    jobDescription?: string;
    projectManager: string;
    projectManagerName: string;
    createdBy: string;
    createdByName: string;
    taxRate?: number;
  }): Promise<CustomerBreakdown> {
    const sheet = await this.getOrCreateSheet('Customer_Breakdowns', [
      'breakdownId', 'customerId', 'customerName', 'customerEmail', 'customerPhone',
      'customerAddress', 'customerCity', 'customerState', 'customerZip',
      'jobId', 'jobNimbusId', 'jobName', 'jobAddress', 'jobDescription',
      'projectManager', 'projectManagerName', 'materials', 'materialsCost',
      'materialsPrice', 'materialMargin', 'laborEntries', 'laborCost',
      'subtotal', 'taxRate', 'taxAmount', 'discountAmount', 'discountReason',
      'totalCost', 'totalPrice', 'profitMargin', 'status', 'createdAt',
      'createdBy', 'createdByName', 'updatedAt', 'updatedBy',
      'lockedBy', 'lockedByName', 'lockedAt',
      'changeLog',
      'requiresApproval', 'approvalStatus',
      'approvalSubmittedBy', 'approvalSubmittedByName', 'approvalSubmittedAt',
      'approvalDecidedBy', 'approvalDecidedByName', 'approvalDecidedAt',
      'approvalRejectionReason',
      'googleSheetId', 'googleSheetUrl', 'invoiceId', 'portalLink', 'notes'
    ]);

    const breakdownId = this.generateId('BRK');
    const now = new Date().toISOString();

    const breakdown: CustomerBreakdown = {
      breakdownId,
      customerId: data.customerId,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      customerAddress: data.customerAddress,
      customerCity: data.customerCity,
      customerState: data.customerState,
      customerZip: data.customerZip,
      jobId: data.jobId,
      jobNimbusId: data.jobNimbusId,
      jobName: data.jobName,
      jobAddress: data.jobAddress,
      jobDescription: data.jobDescription,
      projectManager: data.projectManager,
      projectManagerName: data.projectManagerName,
      materials: [],
      materialsCost: 0,
      materialsPrice: 0,
      materialMargin: 0,
      laborEntries: [],
      laborCost: 0,
      subtotal: 0,
      taxRate: data.taxRate ?? 9.0,
      taxAmount: 0,
      discountAmount: 0,
      totalCost: 0,
      totalPrice: 0,
      profitMargin: 0,
      changeLog: [],
      requiresApproval: false,
      approvalStatus: null,
      status: 'active',
      createdAt: now,
      createdBy: data.createdBy,
      createdByName: data.createdByName,
      updatedAt: now,
      updatedBy: data.createdBy,
      notes: [`Breakdown created by ${data.createdByName}`]
    };

    await sheet.addRow({
      ...breakdown,
      materials: JSON.stringify(breakdown.materials),
      laborEntries: JSON.stringify(breakdown.laborEntries),
      changeLog: JSON.stringify(breakdown.changeLog),
      approvalStatus: breakdown.approvalStatus ?? '',
      notes: JSON.stringify(breakdown.notes)
    });

    return breakdown;
  }

  async getBreakdown(breakdownId: string): Promise<CustomerBreakdown | null> {
    const sheet = await this.getOrCreateSheet('Customer_Breakdowns', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('breakdownId') === breakdownId);

    if (!row) return null;

    return this.rowToBreakdown(row);
  }

  async getBreakdownByCustomer(customerId: string): Promise<CustomerBreakdown[]> {
    const sheet = await this.getOrCreateSheet('Customer_Breakdowns', []);
    const rows = await sheet.getRows();

    return rows
      .filter(r => r.get('customerId') === customerId)
      .map(r => this.rowToBreakdown(r))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getBreakdownByJob(jobId: string): Promise<CustomerBreakdown | null> {
    const sheet = await this.getOrCreateSheet('Customer_Breakdowns', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('jobId') === jobId);

    if (!row) return null;

    return this.rowToBreakdown(row);
  }

  async getAllBreakdowns(filters?: {
    status?: BreakdownStatus;
    customerId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<BreakdownSummary[]> {
    const sheet = await this.getOrCreateSheet('Customer_Breakdowns', []);
    const rows = await sheet.getRows();

    let breakdowns = rows.map(r => this.rowToBreakdown(r));

    if (filters) {
      if (filters.status) {
        breakdowns = breakdowns.filter(b => b.status === filters.status);
      }
      if (filters.customerId) {
        breakdowns = breakdowns.filter(b => b.customerId === filters.customerId);
      }
      if (filters.dateFrom) {
        breakdowns = breakdowns.filter(b => b.createdAt >= filters.dateFrom!);
      }
      if (filters.dateTo) {
        breakdowns = breakdowns.filter(b => b.createdAt <= filters.dateTo!);
      }
    }

    // Return summaries
    return breakdowns.map(b => ({
      breakdownId: b.breakdownId,
      customerId: b.customerId,
      customerName: b.customerName,
      jobName: b.jobName,
      jobAddress: b.jobAddress,
      status: b.status,
      materialsPrice: b.materialsPrice,
      laborCost: b.laborCost,
      totalPrice: b.totalPrice,
      profitMargin: b.profitMargin,
      invoiceId: b.invoiceId,
      lockedBy: b.lockedBy,
      lockedByName: b.lockedByName,
      lockedAt: b.lockedAt,
      approvalStatus: b.approvalStatus,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt
    }));
  }

  private rowToBreakdown(row: any): CustomerBreakdown {
    const rawApprovalStatus = row.get('approvalStatus');
    const approvalStatus: ApprovalStatus = rawApprovalStatus === 'pending' || rawApprovalStatus === 'approved' || rawApprovalStatus === 'rejected'
      ? rawApprovalStatus
      : null;

    return {
      breakdownId: row.get('breakdownId'),
      customerId: row.get('customerId'),
      customerName: row.get('customerName'),
      customerEmail: row.get('customerEmail'),
      customerPhone: row.get('customerPhone'),
      customerAddress: row.get('customerAddress'),
      customerCity: row.get('customerCity'),
      customerState: row.get('customerState'),
      customerZip: row.get('customerZip'),
      jobId: row.get('jobId'),
      jobNimbusId: row.get('jobNimbusId'),
      jobName: row.get('jobName'),
      jobAddress: row.get('jobAddress'),
      jobDescription: row.get('jobDescription'),
      projectManager: row.get('projectManager'),
      projectManagerName: row.get('projectManagerName'),
      materials: JSON.parse(row.get('materials') || '[]'),
      materialsCost: parseFloat(row.get('materialsCost')) || 0,
      materialsPrice: parseFloat(row.get('materialsPrice')) || 0,
      materialMargin: parseFloat(row.get('materialMargin')) || 0,
      laborEntries: JSON.parse(row.get('laborEntries') || '[]'),
      laborCost: parseFloat(row.get('laborCost')) || 0,
      subtotal: parseFloat(row.get('subtotal')) || 0,
      taxRate: parseFloat(row.get('taxRate')) || 9.0,
      taxAmount: parseFloat(row.get('taxAmount')) || 0,
      discountAmount: parseFloat(row.get('discountAmount')) || 0,
      discountReason: row.get('discountReason'),
      totalCost: parseFloat(row.get('totalCost')) || 0,
      totalPrice: parseFloat(row.get('totalPrice')) || 0,
      profitMargin: parseFloat(row.get('profitMargin')) || 0,
      lockedBy: row.get('lockedBy') || undefined,
      lockedByName: row.get('lockedByName') || undefined,
      lockedAt: row.get('lockedAt') || undefined,
      changeLog: JSON.parse(row.get('changeLog') || '[]'),
      requiresApproval: row.get('requiresApproval') === 'true' || row.get('requiresApproval') === true,
      approvalStatus,
      approvalSubmittedBy: row.get('approvalSubmittedBy') || undefined,
      approvalSubmittedByName: row.get('approvalSubmittedByName') || undefined,
      approvalSubmittedAt: row.get('approvalSubmittedAt') || undefined,
      approvalDecidedBy: row.get('approvalDecidedBy') || undefined,
      approvalDecidedByName: row.get('approvalDecidedByName') || undefined,
      approvalDecidedAt: row.get('approvalDecidedAt') || undefined,
      approvalRejectionReason: row.get('approvalRejectionReason') || undefined,
      status: row.get('status') as BreakdownStatus || 'active',
      createdAt: row.get('createdAt'),
      createdBy: row.get('createdBy'),
      createdByName: row.get('createdByName'),
      updatedAt: row.get('updatedAt'),
      updatedBy: row.get('updatedBy'),
      googleSheetId: row.get('googleSheetId'),
      googleSheetUrl: row.get('googleSheetUrl'),
      invoiceId: row.get('invoiceId'),
      portalLink: row.get('portalLink'),
      notes: JSON.parse(row.get('notes') || '[]')
    };
  }

  // ============ LOCK MANAGEMENT ============

  /**
   * Checks if a breakdown is locked by someone else.
   * Lock expires after 15 minutes.
   */
  private isLockedByOther(breakdown: CustomerBreakdown, userId: string): boolean {
    if (!breakdown.lockedBy) return false;
    if (breakdown.lockedBy === userId) return false;

    // Check if lock is expired (15 minutes)
    if (breakdown.lockedAt) {
      const lockTime = new Date(breakdown.lockedAt).getTime();
      const fifteenMinutes = 15 * 60 * 1000;
      if (Date.now() - lockTime > fifteenMinutes) {
        return false; // Lock expired
      }
    }

    return true;
  }

  /**
   * Creates a changelog entry.
   */
  private createChangeEntry(
    action: string,
    description: string,
    changedBy: string,
    changedByName: string,
    previousValue?: string,
    newValue?: string
  ): BreakdownChange {
    return {
      changeId: this.generateId('CHG'),
      action,
      description,
      changedBy,
      changedByName,
      changedAt: new Date().toISOString(),
      previousValue,
      newValue
    };
  }

  /**
   * Persists lock, changelog, and approval fields to the sheet row.
   */
  private saveExtendedFields(row: any, breakdown: CustomerBreakdown): void {
    row.set('lockedBy', breakdown.lockedBy || '');
    row.set('lockedByName', breakdown.lockedByName || '');
    row.set('lockedAt', breakdown.lockedAt || '');
    row.set('changeLog', JSON.stringify(breakdown.changeLog));
    row.set('requiresApproval', breakdown.requiresApproval ? 'true' : 'false');
    row.set('approvalStatus', breakdown.approvalStatus || '');
    row.set('approvalSubmittedBy', breakdown.approvalSubmittedBy || '');
    row.set('approvalSubmittedByName', breakdown.approvalSubmittedByName || '');
    row.set('approvalSubmittedAt', breakdown.approvalSubmittedAt || '');
    row.set('approvalDecidedBy', breakdown.approvalDecidedBy || '');
    row.set('approvalDecidedByName', breakdown.approvalDecidedByName || '');
    row.set('approvalDecidedAt', breakdown.approvalDecidedAt || '');
    row.set('approvalRejectionReason', breakdown.approvalRejectionReason || '');
  }

  async lockBreakdown(
    breakdownId: string,
    userId: string,
    userName: string
  ): Promise<CustomerBreakdown | null> {
    const sheet = await this.getOrCreateSheet('Customer_Breakdowns', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('breakdownId') === breakdownId);

    if (!row) return null;

    const breakdown = this.rowToBreakdown(row);

    // If already locked by someone else and lock is less than 15 min old, reject
    if (this.isLockedByOther(breakdown, userId)) {
      throw new Error(`Breakdown is currently locked by ${breakdown.lockedByName}. Lock expires at ${new Date(new Date(breakdown.lockedAt!).getTime() + 15 * 60 * 1000).toLocaleTimeString()}.`);
    }

    const now = new Date().toISOString();
    breakdown.lockedBy = userId;
    breakdown.lockedByName = userName;
    breakdown.lockedAt = now;
    breakdown.updatedAt = now;
    breakdown.updatedBy = userId;

    breakdown.changeLog.push(this.createChangeEntry(
      'lock',
      `Breakdown locked for editing by ${userName}`,
      userId,
      userName
    ));

    this.saveExtendedFields(row, breakdown);
    row.set('updatedAt', breakdown.updatedAt);
    row.set('updatedBy', breakdown.updatedBy);
    await row.save();

    return breakdown;
  }

  async unlockBreakdown(
    breakdownId: string,
    userId: string
  ): Promise<CustomerBreakdown | null> {
    const sheet = await this.getOrCreateSheet('Customer_Breakdowns', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('breakdownId') === breakdownId);

    if (!row) return null;

    const breakdown = this.rowToBreakdown(row);
    const now = new Date().toISOString();

    const previousLockedByName = breakdown.lockedByName || 'Unknown';

    // Only the person who locked it (or expired lock) can unlock
    // Allow unlock if: no lock, same user locked it, or lock is expired
    if (breakdown.lockedBy && breakdown.lockedBy !== userId) {
      if (breakdown.lockedAt) {
        const lockTime = new Date(breakdown.lockedAt).getTime();
        const fifteenMinutes = 15 * 60 * 1000;
        if (Date.now() - lockTime <= fifteenMinutes) {
          throw new Error(`Breakdown is locked by ${breakdown.lockedByName}. Only they can unlock it before expiry.`);
        }
      }
    }

    breakdown.lockedBy = undefined;
    breakdown.lockedByName = undefined;
    breakdown.lockedAt = undefined;
    breakdown.updatedAt = now;
    breakdown.updatedBy = userId;

    breakdown.changeLog.push(this.createChangeEntry(
      'unlock',
      `Breakdown unlocked (was locked by ${previousLockedByName})`,
      userId,
      userId
    ));

    this.saveExtendedFields(row, breakdown);
    row.set('updatedAt', breakdown.updatedAt);
    row.set('updatedBy', breakdown.updatedBy);
    await row.save();

    return breakdown;
  }

  // ============ APPROVAL MANAGEMENT ============

  async submitForApproval(
    breakdownId: string,
    submittedBy: string,
    submittedByName: string
  ): Promise<CustomerBreakdown | null> {
    const sheet = await this.getOrCreateSheet('Customer_Breakdowns', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('breakdownId') === breakdownId);

    if (!row) return null;

    const breakdown = this.rowToBreakdown(row);
    const now = new Date().toISOString();

    if (breakdown.approvalStatus === 'pending') {
      throw new Error('Breakdown is already pending approval.');
    }

    breakdown.requiresApproval = true;
    breakdown.approvalStatus = 'pending';
    breakdown.approvalSubmittedBy = submittedBy;
    breakdown.approvalSubmittedByName = submittedByName;
    breakdown.approvalSubmittedAt = now;
    breakdown.approvalDecidedBy = undefined;
    breakdown.approvalDecidedByName = undefined;
    breakdown.approvalDecidedAt = undefined;
    breakdown.approvalRejectionReason = undefined;
    breakdown.updatedAt = now;
    breakdown.updatedBy = submittedBy;

    breakdown.changeLog.push(this.createChangeEntry(
      'submitForApproval',
      `Breakdown submitted for approval by ${submittedByName}`,
      submittedBy,
      submittedByName
    ));

    breakdown.notes.push(`Submitted for approval by ${submittedByName}`);

    this.saveExtendedFields(row, breakdown);
    row.set('updatedAt', breakdown.updatedAt);
    row.set('updatedBy', breakdown.updatedBy);
    row.set('notes', JSON.stringify(breakdown.notes));
    await row.save();

    return breakdown;
  }

  async approveBreakdown(
    breakdownId: string,
    approvedBy: string,
    approvedByName: string
  ): Promise<CustomerBreakdown | null> {
    const sheet = await this.getOrCreateSheet('Customer_Breakdowns', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('breakdownId') === breakdownId);

    if (!row) return null;

    const breakdown = this.rowToBreakdown(row);
    const now = new Date().toISOString();

    if (breakdown.approvalStatus !== 'pending') {
      throw new Error('Breakdown is not pending approval.');
    }

    // Prevent self-approval
    if (breakdown.approvalSubmittedBy === approvedBy) {
      throw new Error('You cannot approve a breakdown you submitted. Another Owner or Admin must approve it.');
    }

    breakdown.approvalStatus = 'approved';
    breakdown.approvalDecidedBy = approvedBy;
    breakdown.approvalDecidedByName = approvedByName;
    breakdown.approvalDecidedAt = now;
    breakdown.updatedAt = now;
    breakdown.updatedBy = approvedBy;

    breakdown.changeLog.push(this.createChangeEntry(
      'approve',
      `Breakdown approved by ${approvedByName}`,
      approvedBy,
      approvedByName
    ));

    breakdown.notes.push(`Approved by ${approvedByName}`);

    this.saveExtendedFields(row, breakdown);
    row.set('updatedAt', breakdown.updatedAt);
    row.set('updatedBy', breakdown.updatedBy);
    row.set('notes', JSON.stringify(breakdown.notes));
    await row.save();

    return breakdown;
  }

  async rejectBreakdown(
    breakdownId: string,
    rejectedBy: string,
    rejectedByName: string,
    reason: string
  ): Promise<CustomerBreakdown | null> {
    const sheet = await this.getOrCreateSheet('Customer_Breakdowns', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('breakdownId') === breakdownId);

    if (!row) return null;

    const breakdown = this.rowToBreakdown(row);
    const now = new Date().toISOString();

    if (breakdown.approvalStatus !== 'pending') {
      throw new Error('Breakdown is not pending approval.');
    }

    breakdown.approvalStatus = 'rejected';
    breakdown.approvalDecidedBy = rejectedBy;
    breakdown.approvalDecidedByName = rejectedByName;
    breakdown.approvalDecidedAt = now;
    breakdown.approvalRejectionReason = reason;
    breakdown.updatedAt = now;
    breakdown.updatedBy = rejectedBy;

    breakdown.changeLog.push(this.createChangeEntry(
      'reject',
      `Breakdown rejected by ${rejectedByName}: ${reason}`,
      rejectedBy,
      rejectedByName
    ));

    breakdown.notes.push(`Rejected by ${rejectedByName}: ${reason}`);

    this.saveExtendedFields(row, breakdown);
    row.set('updatedAt', breakdown.updatedAt);
    row.set('updatedBy', breakdown.updatedBy);
    row.set('notes', JSON.stringify(breakdown.notes));
    await row.save();

    return breakdown;
  }

  // ============ MATERIAL MANAGEMENT ============

  async addMaterial(
    breakdownId: string,
    material: {
      productId: string;
      quantity: number;
      sellPriceOverride?: number;
      notes?: string;
      addedBy: string;
      addedByName: string;
    }
  ): Promise<CustomerBreakdown | null> {
    const sheet = await this.getOrCreateSheet('Customer_Breakdowns', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('breakdownId') === breakdownId);

    if (!row) return null;

    const breakdown = this.rowToBreakdown(row);

    // Check lock
    if (this.isLockedByOther(breakdown, material.addedBy)) {
      throw new Error(`Breakdown is locked by ${breakdown.lockedByName}. Cannot edit.`);
    }

    const now = new Date().toISOString();

    // Get product info from inventory
    const product = getProductById(material.productId);

    if (!product) {
      throw new Error(`Product not found: ${material.productId}`);
    }

    const entry: MaterialEntry = {
      productId: material.productId,
      productName: product.productName,
      description: product.description,
      quantity: material.quantity,
      unit: product.unit,
      costPrice: product.cost,
      sellPrice: material.sellPriceOverride ?? product.price,
      totalCost: material.quantity * product.cost,
      totalPrice: material.quantity * (material.sellPriceOverride ?? product.price),
      addedAt: now,
      addedBy: material.addedBy,
      addedByName: material.addedByName,
      notes: material.notes,
      fromInventory: true,
      inventoryDeducted: false
    };

    breakdown.materials.push(entry);

    // Recalculate totals
    this.recalculateBreakdown(breakdown);

    breakdown.updatedAt = now;
    breakdown.updatedBy = material.addedBy;
    breakdown.notes.push(`Material added: ${material.quantity} ${product.unit} of ${product.productName} by ${material.addedByName}`);

    breakdown.changeLog.push(this.createChangeEntry(
      'addMaterial',
      `Added ${material.quantity} ${product.unit} of ${product.productName}`,
      material.addedBy,
      material.addedByName,
      undefined,
      `${material.quantity} ${product.unit} @ ${entry.sellPrice}/ea = $${entry.totalPrice.toFixed(2)}`
    ));

    // Update sheet
    row.set('materials', JSON.stringify(breakdown.materials));
    row.set('materialsCost', breakdown.materialsCost);
    row.set('materialsPrice', breakdown.materialsPrice);
    row.set('materialMargin', breakdown.materialMargin);
    row.set('subtotal', breakdown.subtotal);
    row.set('taxAmount', breakdown.taxAmount);
    row.set('totalCost', breakdown.totalCost);
    row.set('totalPrice', breakdown.totalPrice);
    row.set('profitMargin', breakdown.profitMargin);
    row.set('updatedAt', breakdown.updatedAt);
    row.set('updatedBy', breakdown.updatedBy);
    row.set('notes', JSON.stringify(breakdown.notes));
    this.saveExtendedFields(row, breakdown);
    await row.save();

    return breakdown;
  }

  async addCustomMaterial(
    breakdownId: string,
    material: {
      productName: string;
      description?: string;
      quantity: number;
      unit: string;
      costPrice: number;
      sellPrice: number;
      notes?: string;
      addedBy: string;
      addedByName: string;
    }
  ): Promise<CustomerBreakdown | null> {
    const sheet = await this.getOrCreateSheet('Customer_Breakdowns', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('breakdownId') === breakdownId);

    if (!row) return null;

    const breakdown = this.rowToBreakdown(row);

    // Check lock
    if (this.isLockedByOther(breakdown, material.addedBy)) {
      throw new Error(`Breakdown is locked by ${breakdown.lockedByName}. Cannot edit.`);
    }

    const now = new Date().toISOString();

    const entry: MaterialEntry = {
      productId: `custom-${Date.now()}`,
      productName: material.productName,
      description: material.description,
      quantity: material.quantity,
      unit: material.unit,
      costPrice: material.costPrice,
      sellPrice: material.sellPrice,
      totalCost: material.quantity * material.costPrice,
      totalPrice: material.quantity * material.sellPrice,
      addedAt: now,
      addedBy: material.addedBy,
      addedByName: material.addedByName,
      notes: material.notes,
      fromInventory: false,
      inventoryDeducted: false
    };

    breakdown.materials.push(entry);
    this.recalculateBreakdown(breakdown);

    breakdown.updatedAt = now;
    breakdown.updatedBy = material.addedBy;
    breakdown.notes.push(`Custom material added: ${material.quantity} ${material.unit} of ${material.productName} by ${material.addedByName}`);

    breakdown.changeLog.push(this.createChangeEntry(
      'addCustomMaterial',
      `Added custom material: ${material.quantity} ${material.unit} of ${material.productName}`,
      material.addedBy,
      material.addedByName,
      undefined,
      `${material.quantity} ${material.unit} @ $${material.sellPrice}/ea = $${entry.totalPrice.toFixed(2)}`
    ));

    row.set('materials', JSON.stringify(breakdown.materials));
    row.set('materialsCost', breakdown.materialsCost);
    row.set('materialsPrice', breakdown.materialsPrice);
    row.set('materialMargin', breakdown.materialMargin);
    row.set('subtotal', breakdown.subtotal);
    row.set('taxAmount', breakdown.taxAmount);
    row.set('totalCost', breakdown.totalCost);
    row.set('totalPrice', breakdown.totalPrice);
    row.set('profitMargin', breakdown.profitMargin);
    row.set('updatedAt', breakdown.updatedAt);
    row.set('updatedBy', breakdown.updatedBy);
    row.set('notes', JSON.stringify(breakdown.notes));
    this.saveExtendedFields(row, breakdown);
    await row.save();

    return breakdown;
  }

  async removeMaterial(
    breakdownId: string,
    productId: string,
    removedBy: string,
    removedByName: string
  ): Promise<CustomerBreakdown | null> {
    const sheet = await this.getOrCreateSheet('Customer_Breakdowns', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('breakdownId') === breakdownId);

    if (!row) return null;

    const breakdown = this.rowToBreakdown(row);

    // Check lock
    if (this.isLockedByOther(breakdown, removedBy)) {
      throw new Error(`Breakdown is locked by ${breakdown.lockedByName}. Cannot edit.`);
    }

    const now = new Date().toISOString();

    const materialIndex = breakdown.materials.findIndex(m => m.productId === productId);
    if (materialIndex === -1) return breakdown;

    const removed = breakdown.materials.splice(materialIndex, 1)[0];
    this.recalculateBreakdown(breakdown);

    breakdown.updatedAt = now;
    breakdown.updatedBy = removedBy;
    breakdown.notes.push(`Material removed: ${removed.productName} by ${removedByName}`);

    breakdown.changeLog.push(this.createChangeEntry(
      'removeMaterial',
      `Removed ${removed.productName} (${removed.quantity} ${removed.unit})`,
      removedBy,
      removedByName,
      `${removed.quantity} ${removed.unit} @ $${removed.sellPrice}/ea = $${removed.totalPrice.toFixed(2)}`,
      undefined
    ));

    row.set('materials', JSON.stringify(breakdown.materials));
    row.set('materialsCost', breakdown.materialsCost);
    row.set('materialsPrice', breakdown.materialsPrice);
    row.set('materialMargin', breakdown.materialMargin);
    row.set('subtotal', breakdown.subtotal);
    row.set('taxAmount', breakdown.taxAmount);
    row.set('totalCost', breakdown.totalCost);
    row.set('totalPrice', breakdown.totalPrice);
    row.set('profitMargin', breakdown.profitMargin);
    row.set('updatedAt', breakdown.updatedAt);
    row.set('updatedBy', breakdown.updatedBy);
    row.set('notes', JSON.stringify(breakdown.notes));
    this.saveExtendedFields(row, breakdown);
    await row.save();

    return breakdown;
  }

  // ============ LABOR MANAGEMENT ============

  async addLabor(
    breakdownId: string,
    labor: {
      laborType: LaborType;
      description: string;
      hours: number;
      rate: number;
      workerId: string;
      workerName: string;
      workDate: string;
      notes?: string;
      addedBy: string;
      addedByName: string;
    }
  ): Promise<CustomerBreakdown | null> {
    const sheet = await this.getOrCreateSheet('Customer_Breakdowns', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('breakdownId') === breakdownId);

    if (!row) return null;

    const breakdown = this.rowToBreakdown(row);

    // Check lock
    if (this.isLockedByOther(breakdown, labor.addedBy)) {
      throw new Error(`Breakdown is locked by ${breakdown.lockedByName}. Cannot edit.`);
    }

    const now = new Date().toISOString();

    const entry: LaborEntry = {
      laborId: this.generateId('LAB'),
      laborType: labor.laborType,
      description: labor.description,
      hours: labor.hours,
      rate: labor.rate,
      total: labor.hours * labor.rate,
      workerId: labor.workerId,
      workerName: labor.workerName,
      workDate: labor.workDate,
      addedAt: now,
      addedBy: labor.addedBy,
      notes: labor.notes
    };

    breakdown.laborEntries.push(entry);
    this.recalculateBreakdown(breakdown);

    breakdown.updatedAt = now;
    breakdown.updatedBy = labor.addedBy;
    breakdown.notes.push(`Labor added: ${labor.hours}hrs ${labor.laborType} by ${labor.workerName} - ${labor.addedByName}`);

    breakdown.changeLog.push(this.createChangeEntry(
      'addLabor',
      `Added ${labor.hours}hrs ${labor.laborType} by ${labor.workerName}: ${labor.description}`,
      labor.addedBy,
      labor.addedByName || labor.addedBy,
      undefined,
      `${labor.hours}hrs @ $${labor.rate}/hr = $${entry.total.toFixed(2)}`
    ));

    row.set('laborEntries', JSON.stringify(breakdown.laborEntries));
    row.set('laborCost', breakdown.laborCost);
    row.set('subtotal', breakdown.subtotal);
    row.set('taxAmount', breakdown.taxAmount);
    row.set('totalCost', breakdown.totalCost);
    row.set('totalPrice', breakdown.totalPrice);
    row.set('profitMargin', breakdown.profitMargin);
    row.set('updatedAt', breakdown.updatedAt);
    row.set('updatedBy', breakdown.updatedBy);
    row.set('notes', JSON.stringify(breakdown.notes));
    this.saveExtendedFields(row, breakdown);
    await row.save();

    return breakdown;
  }

  async removeLabor(
    breakdownId: string,
    laborId: string,
    removedBy: string,
    removedByName: string
  ): Promise<CustomerBreakdown | null> {
    const sheet = await this.getOrCreateSheet('Customer_Breakdowns', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('breakdownId') === breakdownId);

    if (!row) return null;

    const breakdown = this.rowToBreakdown(row);

    // Check lock
    if (this.isLockedByOther(breakdown, removedBy)) {
      throw new Error(`Breakdown is locked by ${breakdown.lockedByName}. Cannot edit.`);
    }

    const now = new Date().toISOString();

    const laborIndex = breakdown.laborEntries.findIndex(l => l.laborId === laborId);
    if (laborIndex === -1) return breakdown;

    const removed = breakdown.laborEntries.splice(laborIndex, 1)[0];
    this.recalculateBreakdown(breakdown);

    breakdown.updatedAt = now;
    breakdown.updatedBy = removedBy;
    breakdown.notes.push(`Labor removed: ${removed.description} by ${removedByName}`);

    breakdown.changeLog.push(this.createChangeEntry(
      'removeLabor',
      `Removed labor: ${removed.description} (${removed.hours}hrs by ${removed.workerName})`,
      removedBy,
      removedByName,
      `${removed.hours}hrs @ $${removed.rate}/hr = $${removed.total.toFixed(2)}`,
      undefined
    ));

    row.set('laborEntries', JSON.stringify(breakdown.laborEntries));
    row.set('laborCost', breakdown.laborCost);
    row.set('subtotal', breakdown.subtotal);
    row.set('taxAmount', breakdown.taxAmount);
    row.set('totalCost', breakdown.totalCost);
    row.set('totalPrice', breakdown.totalPrice);
    row.set('profitMargin', breakdown.profitMargin);
    row.set('updatedAt', breakdown.updatedAt);
    row.set('updatedBy', breakdown.updatedBy);
    row.set('notes', JSON.stringify(breakdown.notes));
    this.saveExtendedFields(row, breakdown);
    await row.save();

    return breakdown;
  }

  // ============ DISCOUNT MANAGEMENT ============

  async applyDiscount(
    breakdownId: string,
    discountAmount: number,
    reason: string,
    appliedBy: string,
    appliedByName: string
  ): Promise<CustomerBreakdown | null> {
    const sheet = await this.getOrCreateSheet('Customer_Breakdowns', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('breakdownId') === breakdownId);

    if (!row) return null;

    const breakdown = this.rowToBreakdown(row);

    // Check lock
    if (this.isLockedByOther(breakdown, appliedBy)) {
      throw new Error(`Breakdown is locked by ${breakdown.lockedByName}. Cannot edit.`);
    }

    const now = new Date().toISOString();
    const previousDiscount = breakdown.discountAmount;

    breakdown.discountAmount = discountAmount;
    breakdown.discountReason = reason;
    this.recalculateBreakdown(breakdown);

    breakdown.updatedAt = now;
    breakdown.updatedBy = appliedBy;
    breakdown.notes.push(`Discount applied: $${discountAmount.toFixed(2)} - ${reason} by ${appliedByName}`);

    breakdown.changeLog.push(this.createChangeEntry(
      'applyDiscount',
      `Applied discount: $${discountAmount.toFixed(2)} - ${reason}`,
      appliedBy,
      appliedByName,
      previousDiscount > 0 ? `$${previousDiscount.toFixed(2)}` : undefined,
      `$${discountAmount.toFixed(2)}`
    ));

    row.set('discountAmount', breakdown.discountAmount);
    row.set('discountReason', breakdown.discountReason);
    row.set('taxAmount', breakdown.taxAmount);
    row.set('totalPrice', breakdown.totalPrice);
    row.set('profitMargin', breakdown.profitMargin);
    row.set('updatedAt', breakdown.updatedAt);
    row.set('updatedBy', breakdown.updatedBy);
    row.set('notes', JSON.stringify(breakdown.notes));
    this.saveExtendedFields(row, breakdown);
    await row.save();

    return breakdown;
  }

  // ============ CALCULATION HELPERS ============

  private recalculateBreakdown(breakdown: CustomerBreakdown): void {
    // Materials
    breakdown.materialsCost = breakdown.materials.reduce((sum, m) => sum + m.totalCost, 0);
    breakdown.materialsPrice = breakdown.materials.reduce((sum, m) => sum + m.totalPrice, 0);
    breakdown.materialMargin = breakdown.materialsCost > 0
      ? ((breakdown.materialsPrice - breakdown.materialsCost) / breakdown.materialsPrice) * 100
      : 0;

    // Labor
    breakdown.laborCost = breakdown.laborEntries.reduce((sum, l) => sum + l.total, 0);

    // Subtotal (before tax and discount)
    breakdown.subtotal = breakdown.materialsPrice + breakdown.laborCost;

    // Tax is paid at material purchase, not charged to customer
    // const taxableAmount = breakdown.subtotal - breakdown.discountAmount;
    // breakdown.taxAmount = (taxableAmount * breakdown.taxRate) / 100;
    breakdown.taxAmount = 0;

    // Total cost (our cost)
    breakdown.totalCost = breakdown.materialsCost + breakdown.laborCost;

    // Total price (customer pays)
    breakdown.totalPrice = breakdown.subtotal - breakdown.discountAmount; // taxAmount is 0 - tax paid at purchase

    // Profit margin
    breakdown.profitMargin = breakdown.totalPrice > 0
      ? ((breakdown.totalPrice - breakdown.totalCost) / breakdown.totalPrice) * 100
      : 0;
  }

  // ============ INVOICE GENERATION ============

  async generateInvoice(
    breakdownId: string,
    options: {
      dueInDays?: number;
      terms?: string;
      notes?: string[];
      createdBy: string;
      createdByName: string;
    }
  ): Promise<Invoice | null> {
    const breakdown = await this.getBreakdown(breakdownId);
    if (!breakdown) return null;

    if (breakdown.invoiceId) {
      throw new Error('Invoice already exists for this breakdown');
    }

    const invoiceSheet = await this.getOrCreateSheet('Invoices', [
      'invoiceId', 'invoiceNumber', 'breakdownId', 'customerId', 'customerName',
      'customerEmail', 'customerPhone', 'billingAddress', 'billingCity',
      'billingState', 'billingZip', 'jobId', 'jobNimbusId', 'jobName', 'jobAddress',
      'lineItems', 'subtotal', 'taxRate', 'taxAmount', 'discountAmount',
      'discountReason', 'total', 'status', 'dueDate', 'paidDate', 'paidAmount',
      'paymentMethod', 'paymentReference', 'createdAt', 'createdBy', 'createdByName',
      'sentAt', 'sentTo', 'viewedAt', 'pdfUrl', 'portalUrl', 'notes', 'terms'
    ]);

    const invoiceId = this.generateId('INV');
    const invoiceNumber = this.generateInvoiceNumber();
    const now = new Date().toISOString();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (options.dueInDays ?? 30));

    // Build line items
    const lineItems: InvoiceLineItem[] = [];

    // Add materials
    for (const material of breakdown.materials) {
      lineItems.push({
        lineId: `LI-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: 'material',
        description: material.productName,
        quantity: material.quantity,
        unit: material.unit,
        unitPrice: material.sellPrice,
        total: material.totalPrice,
        costPrice: material.costPrice,
        productId: material.productId
      });
    }

    // Add labor
    for (const labor of breakdown.laborEntries) {
      lineItems.push({
        lineId: `LI-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: 'labor',
        description: `${labor.laborType.charAt(0).toUpperCase() + labor.laborType.slice(1)}: ${labor.description}`,
        quantity: labor.hours,
        unit: 'hrs',
        unitPrice: labor.rate,
        total: labor.total
      });
    }

    // Add discount as negative line item if exists
    if (breakdown.discountAmount > 0) {
      lineItems.push({
        lineId: `LI-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: 'discount',
        description: breakdown.discountReason || 'Discount',
        quantity: 1,
        unit: '',
        unitPrice: -breakdown.discountAmount,
        total: -breakdown.discountAmount
      });
    }

    const invoice: Invoice = {
      invoiceId,
      invoiceNumber,
      breakdownId,
      customerId: breakdown.customerId,
      customerName: breakdown.customerName,
      customerEmail: breakdown.customerEmail,
      customerPhone: breakdown.customerPhone,
      billingAddress: breakdown.customerAddress,
      billingCity: breakdown.customerCity,
      billingState: breakdown.customerState,
      billingZip: breakdown.customerZip,
      jobId: breakdown.jobId,
      jobNimbusId: breakdown.jobNimbusId,
      jobName: breakdown.jobName,
      jobAddress: breakdown.jobAddress,
      lineItems,
      subtotal: breakdown.subtotal,
      taxRate: breakdown.taxRate,
      taxAmount: breakdown.taxAmount,
      discountAmount: breakdown.discountAmount,
      discountReason: breakdown.discountReason,
      total: breakdown.totalPrice,
      status: 'draft',
      dueDate: dueDate.toISOString(),
      createdAt: now,
      createdBy: options.createdBy,
      createdByName: options.createdByName,
      notes: options.notes || [],
      terms: options.terms || 'Payment is due upon receipt. Please make checks payable to River City Roofing Solutions. Thank you for your business!'
    };

    // Save invoice
    await invoiceSheet.addRow({
      ...invoice,
      lineItems: JSON.stringify(invoice.lineItems),
      notes: JSON.stringify(invoice.notes)
    });

    // Update breakdown with invoice link
    const breakdownSheet = await this.getOrCreateSheet('Customer_Breakdowns', []);
    const breakdownRows = await breakdownSheet.getRows();
    const breakdownRow = breakdownRows.find(r => r.get('breakdownId') === breakdownId);

    if (breakdownRow) {
      breakdownRow.set('invoiceId', invoiceId);
      breakdownRow.set('status', 'invoiced');
      breakdownRow.set('updatedAt', now);
      breakdownRow.set('updatedBy', options.createdBy);
      const notes = JSON.parse(breakdownRow.get('notes') || '[]');
      notes.push(`Invoice ${invoiceNumber} generated by ${options.createdByName}`);
      breakdownRow.set('notes', JSON.stringify(notes));
      await breakdownRow.save();
    }

    return invoice;
  }

  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    const sheet = await this.getOrCreateSheet('Invoices', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('invoiceId') === invoiceId);

    if (!row) return null;

    return this.rowToInvoice(row);
  }

  async getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | null> {
    const sheet = await this.getOrCreateSheet('Invoices', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('invoiceNumber') === invoiceNumber);

    if (!row) return null;

    return this.rowToInvoice(row);
  }

  async getInvoicesByCustomer(customerId: string): Promise<Invoice[]> {
    const sheet = await this.getOrCreateSheet('Invoices', []);
    const rows = await sheet.getRows();

    return rows
      .filter(r => r.get('customerId') === customerId)
      .map(r => this.rowToInvoice(r))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getAllInvoices(filters?: {
    status?: InvoiceStatus;
    customerId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Invoice[]> {
    const sheet = await this.getOrCreateSheet('Invoices', []);
    const rows = await sheet.getRows();

    let invoices = rows.map(r => this.rowToInvoice(r));

    if (filters) {
      if (filters.status) {
        invoices = invoices.filter(i => i.status === filters.status);
      }
      if (filters.customerId) {
        invoices = invoices.filter(i => i.customerId === filters.customerId);
      }
      if (filters.dateFrom) {
        invoices = invoices.filter(i => i.createdAt >= filters.dateFrom!);
      }
      if (filters.dateTo) {
        invoices = invoices.filter(i => i.createdAt <= filters.dateTo!);
      }
    }

    return invoices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private rowToInvoice(row: any): Invoice {
    return {
      invoiceId: row.get('invoiceId'),
      invoiceNumber: row.get('invoiceNumber'),
      breakdownId: row.get('breakdownId'),
      customerId: row.get('customerId'),
      customerName: row.get('customerName'),
      customerEmail: row.get('customerEmail'),
      customerPhone: row.get('customerPhone'),
      billingAddress: row.get('billingAddress'),
      billingCity: row.get('billingCity'),
      billingState: row.get('billingState'),
      billingZip: row.get('billingZip'),
      jobId: row.get('jobId'),
      jobNimbusId: row.get('jobNimbusId'),
      jobName: row.get('jobName'),
      jobAddress: row.get('jobAddress'),
      lineItems: JSON.parse(row.get('lineItems') || '[]'),
      subtotal: parseFloat(row.get('subtotal')) || 0,
      taxRate: parseFloat(row.get('taxRate')) || 0,
      taxAmount: parseFloat(row.get('taxAmount')) || 0,
      discountAmount: parseFloat(row.get('discountAmount')) || 0,
      discountReason: row.get('discountReason'),
      total: parseFloat(row.get('total')) || 0,
      status: row.get('status') as InvoiceStatus || 'draft',
      dueDate: row.get('dueDate'),
      paidDate: row.get('paidDate'),
      paidAmount: parseFloat(row.get('paidAmount')) || undefined,
      paymentMethod: row.get('paymentMethod'),
      paymentReference: row.get('paymentReference'),
      createdAt: row.get('createdAt'),
      createdBy: row.get('createdBy'),
      createdByName: row.get('createdByName'),
      sentAt: row.get('sentAt'),
      sentTo: row.get('sentTo'),
      viewedAt: row.get('viewedAt'),
      pdfUrl: row.get('pdfUrl'),
      portalUrl: row.get('portalUrl'),
      notes: JSON.parse(row.get('notes') || '[]'),
      terms: row.get('terms')
    };
  }

  // ============ INVOICE STATUS UPDATES ============

  async updateInvoiceStatus(
    invoiceId: string,
    status: InvoiceStatus,
    updatedBy: string,
    updatedByName: string,
    paymentDetails?: {
      paidAmount?: number;
      paymentMethod?: string;
      paymentReference?: string;
    }
  ): Promise<Invoice | null> {
    const sheet = await this.getOrCreateSheet('Invoices', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('invoiceId') === invoiceId);

    if (!row) return null;

    const now = new Date().toISOString();
    const notes = JSON.parse(row.get('notes') || '[]');

    row.set('status', status);
    notes.push(`Status changed to ${status} by ${updatedByName} at ${now}`);

    if (status === 'sent') {
      row.set('sentAt', now);
    } else if (status === 'viewed') {
      row.set('viewedAt', now);
    } else if (status === 'paid' && paymentDetails) {
      row.set('paidDate', now);
      if (paymentDetails.paidAmount !== undefined) {
        row.set('paidAmount', paymentDetails.paidAmount);
      }
      if (paymentDetails.paymentMethod) {
        row.set('paymentMethod', paymentDetails.paymentMethod);
      }
      if (paymentDetails.paymentReference) {
        row.set('paymentReference', paymentDetails.paymentReference);
      }
      notes.push(`Payment received: $${paymentDetails.paidAmount?.toFixed(2)} via ${paymentDetails.paymentMethod}`);
    }

    row.set('notes', JSON.stringify(notes));
    await row.save();

    return this.rowToInvoice(row);
  }

  async sendInvoice(
    invoiceId: string,
    sentTo: string,
    sentBy: string,
    sentByName: string
  ): Promise<Invoice | null> {
    const sheet = await this.getOrCreateSheet('Invoices', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('invoiceId') === invoiceId);

    if (!row) return null;

    const now = new Date().toISOString();
    const notes = JSON.parse(row.get('notes') || '[]');

    row.set('status', 'sent');
    row.set('sentAt', now);
    row.set('sentTo', sentTo);
    notes.push(`Invoice sent to ${sentTo} by ${sentByName}`);
    row.set('notes', JSON.stringify(notes));
    await row.save();

    return this.rowToInvoice(row);
  }

  // ============ INVENTORY SYNC ============

  async deductInventoryForBreakdown(
    breakdownId: string,
    deductedBy: string,
    deductedByName: string
  ): Promise<{ success: boolean; deducted: string[]; errors: string[] }> {
    const breakdown = await this.getBreakdown(breakdownId);
    if (!breakdown) {
      return { success: false, deducted: [], errors: ['Breakdown not found'] };
    }

    const deducted: string[] = [];
    const errors: string[] = [];

    for (const material of breakdown.materials) {
      if (!material.fromInventory || material.inventoryDeducted) {
        continue;
      }

      try {
        // Note: In production, this would call the inventory service
        // For now, we just mark it as deducted
        // await inventoryService.deductStock(material.productId, material.quantity);
        material.inventoryDeducted = true;
        material.inventoryDeductedAt = new Date().toISOString();
        deducted.push(`${material.quantity} ${material.unit} of ${material.productName}`);
      } catch (err: any) {
        errors.push(`Failed to deduct ${material.productName}: ${err.message}`);
      }
    }

    // Update breakdown
    const sheet = await this.getOrCreateSheet('Customer_Breakdowns', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('breakdownId') === breakdownId);

    if (row) {
      const notes = JSON.parse(row.get('notes') || '[]');
      if (deducted.length > 0) {
        notes.push(`Inventory deducted: ${deducted.join(', ')} by ${deductedByName}`);
      }
      row.set('materials', JSON.stringify(breakdown.materials));
      row.set('notes', JSON.stringify(notes));
      row.set('updatedAt', new Date().toISOString());
      row.set('updatedBy', deductedBy);
      await row.save();
    }

    return { success: errors.length === 0, deducted, errors };
  }

  // ============ DASHBOARD STATS ============

  async getDashboardStats(): Promise<{
    totalBreakdowns: number;
    activeBreakdowns: number;
    pendingInvoice: number;
    invoiced: number;
    totalInvoices: number;
    draftInvoices: number;
    sentInvoices: number;
    overdueInvoices: number;
    paidInvoices: number;
    totalRevenue: number;
    totalOutstanding: number;
    averageMargin: number;
  }> {
    const breakdowns = await this.getAllBreakdowns();
    const invoices = await this.getAllInvoices();

    const now = new Date();
    const overdueInvoices = invoices.filter(i =>
      i.status === 'sent' && new Date(i.dueDate) < now
    );

    const paidInvoices = invoices.filter(i => i.status === 'paid');
    const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.total, 0);

    const outstandingInvoices = invoices.filter(i =>
      ['sent', 'viewed', 'overdue'].includes(i.status)
    );
    const totalOutstanding = outstandingInvoices.reduce((sum, i) => sum + i.total, 0);

    const margins = breakdowns.filter(b => b.profitMargin > 0).map(b => b.profitMargin);
    const averageMargin = margins.length > 0
      ? margins.reduce((sum, m) => sum + m, 0) / margins.length
      : 0;

    return {
      totalBreakdowns: breakdowns.length,
      activeBreakdowns: breakdowns.filter(b => b.status === 'active').length,
      pendingInvoice: breakdowns.filter(b => b.status === 'pending_invoice').length,
      invoiced: breakdowns.filter(b => b.status === 'invoiced').length,
      totalInvoices: invoices.length,
      draftInvoices: invoices.filter(i => i.status === 'draft').length,
      sentInvoices: invoices.filter(i => i.status === 'sent').length,
      overdueInvoices: overdueInvoices.length,
      paidInvoices: paidInvoices.length,
      totalRevenue,
      totalOutstanding,
      averageMargin
    };
  }
}

export const breakdownService = new BreakdownService();
