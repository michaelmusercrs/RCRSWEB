// Invoice & Billing Service
// Manages invoices, payments, tax calculations, aging reports, and pricing verification
// Persists to Google Sheets + syncs with JobNimbus

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { inventoryProducts, InventoryProduct } from './inventoryData';
import { jobNimbusService, isJobNimbusConfigured, JobNimbusInvoice, JobNimbusContact, JobNimbusJob } from './jobnimbus-service';
import { googleSheetsService, isGoogleSheetsConfigured } from './google-sheets-service';

/** Row accessor supporting both GoogleSpreadsheetRow.get() and plain objects */
interface InvoiceRowLike {
  get?: (key: string) => string;
  [key: string]: unknown;
}

// ============ TYPE DEFINITIONS ============

export type InvoiceType = 'estimate' | 'progress' | 'final' | 'supplement' | 'credit';
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'approved' | 'paid' | 'overdue' | 'cancelled' | 'disputed';
export type PaymentMethod = 'check' | 'cash' | 'card' | 'insurance' | 'financing' | 'bitcoin';
export type DiscountType = 'percent' | 'fixed';
export type LineItemCategory = 'materials' | 'labor' | 'delivery' | 'disposal' | 'permit' | 'other';

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface LineItem {
  id: string;
  description: string;
  category: LineItemCategory;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  taxable: boolean;
}

export interface Payment {
  paymentId: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  notes: string;
}

export interface InsuranceClaim {
  claimNumber: string;
  carrier: string;
  adjusterName: string;
  adjusterPhone: string;
  deductible: number;
  approved: boolean;
  approvedAmount: number;
}

export interface Invoice {
  invoiceId: string;
  jobId: string;
  breakdownId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  billingAddress: Address;
  jobAddress: Address;

  type: InvoiceType;
  status: InvoiceStatus;

  lineItems: LineItem[];

  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  discountType: DiscountType;
  total: number;
  amountPaid: number;
  balanceDue: number;

  payments: Payment[];

  insuranceClaim?: InsuranceClaim;

  dueDate: string;
  terms: string;
  notes: string;
  internalNotes: string;

  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  paidAt?: string;
  createdBy: string;
}

export interface PricingDiscrepancy {
  lineItemId: string;
  description: string;
  invoicedPrice: number;
  currentPrice: number;
  difference: number;
  percentDiff: number;
  matchedProductId?: string;
}

export interface AgingBucket {
  label: string;
  invoices: Invoice[];
  totalAmount: number;
  count: number;
}

export interface AgingReport {
  current: AgingBucket;
  thirtyDay: AgingBucket;
  sixtyDay: AgingBucket;
  ninetyPlus: AgingBucket;
  totalOutstanding: number;
}

export interface RevenueReport {
  period: string;
  totalInvoiced: number;
  totalCollected: number;
  totalOutstanding: number;
  invoiceCount: number;
  averageInvoice: number;
  collectionRate: number;
  byMonth: { month: string; invoiced: number; collected: number }[];
  byType: { type: InvoiceType; count: number; total: number }[];
}

// ============ JOBNIMBUS INTEGRATION TYPES ============

export interface JNInvoiceSummary {
  jnid: string;
  invoiceNumber: string;
  status: string;
  amount: number;
  amountPaid: number;
  balance: number;
  total: number;
  dueDate: string;
  pdfUrl: string;
  createdAt: string;
  customerName: string;
}

export interface JNInvoiceDetail {
  invoice: JobNimbusInvoice;
  contact: JobNimbusContact | null;
  job: JobNimbusJob | null;
}

export interface InvoiceComparison {
  localInvoice: Invoice | null;
  jnInvoice: JNInvoiceSummary | null;
  matched: boolean;
  differences: { field: string; local: string | number; jn: string | number }[];
}

// ============ TAX RATES ============
// Tax is paid at time of material purchase, not charged to customer
const HUNTSVILLE_TAX_RATE = 0; // Tax absorbed at purchase, not billed to customer

// ============ GOOGLE SHEETS COLUMN HEADERS ============

const INVOICE_SHEET_NAME = 'Invoices';
const INVOICE_HEADERS = [
  'invoiceId', 'jobId', 'breakdownId', 'customerName', 'customerEmail', 'customerPhone',
  'billingAddressJson', 'jobAddressJson',
  'type', 'status',
  'lineItemsJson',
  'subtotal', 'taxRate', 'taxAmount', 'discount', 'discountType', 'total', 'amountPaid', 'balanceDue',
  'paymentsJson',
  'insuranceClaimJson',
  'dueDate', 'terms', 'notes', 'internalNotes',
  'createdAt', 'updatedAt', 'sentAt', 'paidAt', 'createdBy',
];

// ============ SHEETS HELPER FUNCTIONS ============

function invoiceToRow(inv: Invoice): Record<string, string> {
  return {
    invoiceId: inv.invoiceId,
    jobId: inv.jobId,
    breakdownId: inv.breakdownId || '',
    customerName: inv.customerName,
    customerEmail: inv.customerEmail,
    customerPhone: inv.customerPhone,
    billingAddressJson: JSON.stringify(inv.billingAddress),
    jobAddressJson: JSON.stringify(inv.jobAddress),
    type: inv.type,
    status: inv.status,
    lineItemsJson: JSON.stringify(inv.lineItems),
    subtotal: String(inv.subtotal),
    taxRate: String(inv.taxRate),
    taxAmount: String(inv.taxAmount),
    discount: String(inv.discount),
    discountType: inv.discountType,
    total: String(inv.total),
    amountPaid: String(inv.amountPaid),
    balanceDue: String(inv.balanceDue),
    paymentsJson: JSON.stringify(inv.payments),
    insuranceClaimJson: inv.insuranceClaim ? JSON.stringify(inv.insuranceClaim) : '',
    dueDate: inv.dueDate,
    terms: inv.terms,
    notes: inv.notes,
    internalNotes: inv.internalNotes,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
    sentAt: inv.sentAt || '',
    paidAt: inv.paidAt || '',
    createdBy: inv.createdBy,
  };
}

function rowToInvoice(row: InvoiceRowLike): Invoice {
  const get = (key: string): string => {
    // Support both GoogleSpreadsheetRow .get() and plain object
    if (typeof row.get === 'function') return row.get(key) || '';
    return String(row[key] || '');
  };

  const parseJsonSafe = <T>(val: string, fallback: T): T => {
    if (!val) return fallback;
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  };

  return {
    invoiceId: get('invoiceId'),
    jobId: get('jobId'),
    breakdownId: get('breakdownId') || undefined,
    customerName: get('customerName'),
    customerEmail: get('customerEmail'),
    customerPhone: get('customerPhone'),
    billingAddress: parseJsonSafe<Address>(get('billingAddressJson'), { street: '', city: '', state: 'AL', zip: '' }),
    jobAddress: parseJsonSafe<Address>(get('jobAddressJson'), { street: '', city: '', state: 'AL', zip: '' }),
    type: (get('type') || 'final') as InvoiceType,
    status: (get('status') || 'draft') as InvoiceStatus,
    lineItems: parseJsonSafe<LineItem[]>(get('lineItemsJson'), []),
    subtotal: parseFloat(get('subtotal')) || 0,
    taxRate: parseFloat(get('taxRate')) || 0,
    taxAmount: parseFloat(get('taxAmount')) || 0,
    discount: parseFloat(get('discount')) || 0,
    discountType: (get('discountType') || 'fixed') as DiscountType,
    total: parseFloat(get('total')) || 0,
    amountPaid: parseFloat(get('amountPaid')) || 0,
    balanceDue: parseFloat(get('balanceDue')) || 0,
    payments: parseJsonSafe<Payment[]>(get('paymentsJson'), []),
    insuranceClaim: parseJsonSafe<InsuranceClaim | undefined>(get('insuranceClaimJson'), undefined),
    dueDate: get('dueDate'),
    terms: get('terms'),
    notes: get('notes'),
    internalNotes: get('internalNotes'),
    createdAt: get('createdAt'),
    updatedAt: get('updatedAt'),
    sentAt: get('sentAt') || undefined,
    paidAt: get('paidAt') || undefined,
    createdBy: get('createdBy'),
  };
}

// ============ SERVICE IMPLEMENTATION ============

class InvoiceService {
  private sheetsReady = false;
  private doc: GoogleSpreadsheet | null = null;

  /**
   * Initialize Sheets connection and ensure the Invoices tab exists.
   * Returns true if Sheets is available, false if we should fall back gracefully.
   */
  private async initSheets(): Promise<boolean> {
    if (this.sheetsReady) return true;

    if (!isGoogleSheetsConfigured()) {
      console.warn('[InvoiceService] Google Sheets not configured - operating in read-only/JN-only mode');
      return false;
    }

    try {
      const ready = await googleSheetsService.init();
      if (!ready) return false;
      this.sheetsReady = true;
      return true;
    } catch (error) {
      console.error('[InvoiceService] Failed to initialize Sheets:', error);
      return false;
    }
  }

  /**
   * Get or create the Invoices sheet via the shared googleSheetsService doc.
   * This accesses the internal doc from googleSheetsService.
   */
  private async getSheet() {
    const ready = await this.initSheets();
    if (!ready) return null;

    // Access the service's internal doc via a status check + re-init pattern
    // We need to access the doc directly, so we use a helper approach:
    // The googleSheetsService has getOrCreateSheet as private, so we re-implement for Invoices
    try {
      const { GoogleSpreadsheet } = await import('google-spreadsheet');
      const { JWT } = await import('google-auth-library');

      if (!this.doc) {
        const privateKey = process.env.GOOGLE_PRIVATE_KEY
          ?.replace(/\\n/g, '\n')
          ?.replace(/\r\n/g, '\n');

        const auth = new JWT({
          email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          key: privateKey,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheetsId = process.env.GOOGLE_SHEETS_ID;
        if (!sheetsId) return null;

        this.doc = new GoogleSpreadsheet(sheetsId, auth);
        await this.doc.loadInfo();
      }

      let sheet = this.doc.sheetsByTitle[INVOICE_SHEET_NAME];
      if (!sheet) {
        sheet = await this.doc.addSheet({
          title: INVOICE_SHEET_NAME,
          headerValues: INVOICE_HEADERS,
          gridProperties: { columnCount: Math.max(INVOICE_HEADERS.length + 5, 35) },
        });
      } else {
        try {
          await sheet.loadHeaderRow();
        } catch {
          if (sheet.gridProperties.columnCount < INVOICE_HEADERS.length) {
            await sheet.resize({
              rowCount: sheet.gridProperties.rowCount,
              columnCount: INVOICE_HEADERS.length + 5,
            });
          }
          await sheet.setHeaderRow(INVOICE_HEADERS);
        }
      }

      return sheet;
    } catch (error) {
      console.error('[InvoiceService] Error getting sheet:', error);
      return null;
    }
  }

  // ---------- SHEETS READ/WRITE HELPERS ----------

  /**
   * Read all invoices from Google Sheets
   */
  private async readAllFromSheets(): Promise<Invoice[]> {
    const sheet = await this.getSheet();
    if (!sheet) return [];

    try {
      const rows = await sheet.getRows();
      return rows.map((row) => rowToInvoice(row as unknown as InvoiceRowLike)).filter((inv: Invoice) => inv.invoiceId);
    } catch (error) {
      console.error('[InvoiceService] Error reading invoices from Sheets:', error);
      return [];
    }
  }

  /**
   * Find a row by invoiceId and return the raw row for update operations
   */
  private async findRow(invoiceId: string) {
    const sheet = await this.getSheet();
    if (!sheet) return null;

    try {
      const rows = await sheet.getRows();
      return rows.find((row) => row.get('invoiceId') === invoiceId) || null;
    } catch (error) {
      console.error('[InvoiceService] Error finding row:', error);
      return null;
    }
  }

  /**
   * Write a new invoice row to Sheets
   */
  private async writeToSheets(invoice: Invoice): Promise<boolean> {
    const sheet = await this.getSheet();
    if (!sheet) return false;

    try {
      await sheet.addRow(invoiceToRow(invoice));
      return true;
    } catch (error) {
      console.error('[InvoiceService] Error writing to Sheets:', error);
      return false;
    }
  }

  /**
   * Update an existing row in Sheets
   */
  private async updateRowInSheets(invoiceId: string, invoice: Invoice): Promise<boolean> {
    const row = await this.findRow(invoiceId);
    if (!row) return false;

    try {
      const data = invoiceToRow(invoice);
      for (const [key, value] of Object.entries(data)) {
        row.set(key, value);
      }
      await row.save();
      return true;
    } catch (error) {
      console.error('[InvoiceService] Error updating row in Sheets:', error);
      return false;
    }
  }

  /**
   * Generate the next invoice number.
   * Reads existing invoices from Sheets to find the highest sequence number.
   */
  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    try {
      const existing = await this.readAllFromSheets();
      let maxSeq = 0;

      for (const inv of existing) {
        if (inv.invoiceId.startsWith(prefix)) {
          const seqStr = inv.invoiceId.replace(prefix, '');
          const seq = parseInt(seqStr, 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      }

      const nextSeq = maxSeq + 1;
      return `${prefix}${String(nextSeq).padStart(4, '0')}`;
    } catch {
      // Fallback: use timestamp-based ID
      return `${prefix}${String(Date.now()).slice(-4)}`;
    }
  }

  // ---------- CRUD ----------

  async createInvoice(data: Partial<Invoice>): Promise<Invoice> {
    const invoiceId = await this.generateInvoiceNumber();
    const now = new Date().toISOString();

    const lineItems = data.lineItems || [];
    const taxRate = data.taxRate ?? HUNTSVILLE_TAX_RATE;
    const discount = data.discount ?? 0;
    const discountType = data.discountType ?? 'fixed';
    const totals = this.calculateTotals(lineItems, taxRate, discount, discountType);

    const invoice: Invoice = {
      invoiceId,
      jobId: data.jobId || '',
      breakdownId: data.breakdownId,
      customerName: data.customerName || '',
      customerEmail: data.customerEmail || '',
      customerPhone: data.customerPhone || '',
      billingAddress: data.billingAddress || { street: '', city: '', state: 'AL', zip: '' },
      jobAddress: data.jobAddress || { street: '', city: '', state: 'AL', zip: '' },
      type: data.type || 'final',
      status: 'draft',
      lineItems,
      ...totals,
      taxRate,
      discount,
      discountType,
      amountPaid: 0,
      balanceDue: totals.total,
      payments: [],
      insuranceClaim: data.insuranceClaim,
      dueDate: data.dueDate || this.calculateDueDate(data.terms || 'Net 30'),
      terms: data.terms || 'Net 30',
      notes: data.notes || '',
      internalNotes: data.internalNotes || '',
      createdAt: now,
      updatedAt: now,
      createdBy: data.createdBy || 'System',
    };

    const written = await this.writeToSheets(invoice);
    if (!written) {
      console.warn('[InvoiceService] Failed to persist invoice to Sheets - invoice exists only in response');
    }

    return invoice;
  }

  async createFromBreakdown(breakdownId: string): Promise<Invoice> {
    // In production, this would fetch from breakdown-service
    // For now, create a sample invoice linked to the breakdown
    const invoice = await this.createInvoice({
      breakdownId,
      jobId: `JOB-${breakdownId.replace('BRK-', '')}`,
      customerName: 'From Breakdown',
      type: 'final',
      terms: 'Net 30',
      notes: `Auto-generated from breakdown ${breakdownId}`,
    });
    return invoice;
  }

  async updateInvoice(invoiceId: string, updates: Partial<Invoice>): Promise<Invoice | null> {
    // Read from Sheets
    const allInvoices = await this.readAllFromSheets();
    const existing = allInvoices.find(inv => inv.invoiceId === invoiceId);
    if (!existing) return null;

    // Recalculate totals if line items changed
    if (updates.lineItems) {
      const taxRate = updates.taxRate ?? existing.taxRate;
      const discount = updates.discount ?? existing.discount;
      const discountType = updates.discountType ?? existing.discountType;
      const totals = this.calculateTotals(updates.lineItems, taxRate, discount, discountType);
      Object.assign(updates, totals);
      updates.balanceDue = totals.total - existing.amountPaid;
    }

    const updated: Invoice = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.updateRowInSheets(invoiceId, updated);
    return updated;
  }

  async sendInvoice(invoiceId: string): Promise<Invoice | null> {
    const allInvoices = await this.readAllFromSheets();
    const invoice = allInvoices.find(inv => inv.invoiceId === invoiceId);
    if (!invoice) return null;

    const now = new Date().toISOString();
    const updated: Invoice = {
      ...invoice,
      status: 'sent',
      sentAt: now,
      updatedAt: now,
    };

    await this.updateRowInSheets(invoiceId, updated);
    return updated;
  }

  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    const allInvoices = await this.readAllFromSheets();
    return allInvoices.find(inv => inv.invoiceId === invoiceId) || null;
  }

  async getAllInvoices(): Promise<Invoice[]> {
    return this.readAllFromSheets();
  }

  async getInvoicesByJob(jobId: string): Promise<Invoice[]> {
    const all = await this.readAllFromSheets();
    return all.filter(inv => inv.jobId === jobId);
  }

  async getInvoicesByStatus(status: InvoiceStatus): Promise<Invoice[]> {
    const all = await this.readAllFromSheets();
    return all.filter(inv => inv.status === status);
  }

  async duplicateInvoice(invoiceId: string): Promise<Invoice | null> {
    const allInvoices = await this.readAllFromSheets();
    const original = allInvoices.find(inv => inv.invoiceId === invoiceId);
    if (!original) return null;

    const newInvoice = await this.createInvoice({
      ...original,
      type: 'supplement',
      notes: `Duplicated from ${original.invoiceId}. ${original.notes}`,
      internalNotes: `Cloned from ${original.invoiceId}`,
    });
    return newInvoice;
  }

  // ---------- PAYMENTS ----------

  async recordPayment(invoiceId: string, payment: Omit<Payment, 'paymentId'>): Promise<Invoice | null> {
    const allInvoices = await this.readAllFromSheets();
    const invoice = allInvoices.find(inv => inv.invoiceId === invoiceId);
    if (!invoice) return null;

    const paymentRecord: Payment = {
      ...payment,
      paymentId: `PAY-${String(Date.now()).slice(-6)}`,
    };

    const updatedPayments = [...invoice.payments, paymentRecord];
    const newAmountPaid = invoice.amountPaid + payment.amount;
    const newBalanceDue = invoice.total - newAmountPaid;
    const now = new Date().toISOString();

    const updated: Invoice = {
      ...invoice,
      payments: updatedPayments,
      amountPaid: newAmountPaid,
      balanceDue: newBalanceDue,
      updatedAt: now,
      status: newBalanceDue <= 0 ? 'paid' : invoice.status,
      paidAt: newBalanceDue <= 0 ? now : invoice.paidAt,
    };

    await this.updateRowInSheets(invoiceId, updated);
    return updated;
  }

  async getPaymentHistory(invoiceId: string): Promise<Payment[]> {
    const invoice = await this.getInvoice(invoiceId);
    return invoice?.payments || [];
  }

  // ---------- CALCULATIONS ----------

  calculateTotals(
    lineItems: LineItem[],
    taxRate: number,
    discount: number,
    discountType: DiscountType
  ): { subtotal: number; taxAmount: number; total: number } {
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    // Tax is paid at material purchase, not charged to customer
    const taxAmount = 0;

    let discountAmount = 0;
    if (discountType === 'percent') {
      discountAmount = Math.round(subtotal * (discount / 100) * 100) / 100;
    } else {
      discountAmount = discount;
    }

    const total = Math.round((subtotal + taxAmount - discountAmount) * 100) / 100;

    return { subtotal, taxAmount, total };
  }

  // ---------- REPORTS ----------

  async getOverdueInvoices(): Promise<Invoice[]> {
    const today = new Date().toISOString().slice(0, 10);
    const all = await this.readAllFromSheets();
    return all.filter(inv =>
      inv.status !== 'paid' &&
      inv.status !== 'cancelled' &&
      inv.status !== 'draft' &&
      inv.balanceDue > 0 &&
      inv.dueDate < today
    );
  }

  async getAgingReport(): Promise<AgingReport> {
    const today = new Date();
    const all = await this.readAllFromSheets();
    const outstanding = all.filter(inv =>
      inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'draft' && inv.balanceDue > 0
    );

    const current: Invoice[] = [];
    const thirtyDay: Invoice[] = [];
    const sixtyDay: Invoice[] = [];
    const ninetyPlus: Invoice[] = [];

    for (const inv of outstanding) {
      const dueDate = new Date(inv.dueDate);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue <= 0) {
        current.push(inv);
      } else if (daysOverdue <= 30) {
        thirtyDay.push(inv);
      } else if (daysOverdue <= 60) {
        sixtyDay.push(inv);
      } else {
        ninetyPlus.push(inv);
      }
    }

    const makeBucket = (label: string, invoices: Invoice[]): AgingBucket => ({
      label,
      invoices,
      totalAmount: invoices.reduce((sum, inv) => sum + inv.balanceDue, 0),
      count: invoices.length,
    });

    const report: AgingReport = {
      current: makeBucket('Current', current),
      thirtyDay: makeBucket('1-30 Days', thirtyDay),
      sixtyDay: makeBucket('31-60 Days', sixtyDay),
      ninetyPlus: makeBucket('90+ Days', ninetyPlus),
      totalOutstanding: outstanding.reduce((sum, inv) => sum + inv.balanceDue, 0),
    };

    return report;
  }

  async getRevenueReport(dateRange?: { start: string; end: string }): Promise<RevenueReport> {
    const start = dateRange?.start || '2026-01-01';
    const end = dateRange?.end || '2026-12-31';

    const all = await this.readAllFromSheets();
    const filtered = all.filter(inv => inv.createdAt >= start && inv.createdAt <= end);

    const totalInvoiced = filtered.reduce((sum, inv) => sum + Math.abs(inv.total), 0);
    const totalCollected = filtered.reduce((sum, inv) => sum + Math.abs(inv.amountPaid), 0);
    const totalOutstanding = filtered.reduce((sum, inv) => sum + Math.max(0, inv.balanceDue), 0);
    const invoiceCount = filtered.length;
    const averageInvoice = invoiceCount > 0 ? totalInvoiced / invoiceCount : 0;
    const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;

    // By month
    const monthMap = new Map<string, { invoiced: number; collected: number }>();
    for (const inv of filtered) {
      const month = inv.createdAt.slice(0, 7); // YYYY-MM
      const entry = monthMap.get(month) || { invoiced: 0, collected: 0 };
      entry.invoiced += Math.abs(inv.total);
      entry.collected += Math.abs(inv.amountPaid);
      monthMap.set(month, entry);
    }
    const byMonth = Array.from(monthMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // By type
    const typeMap = new Map<InvoiceType, { count: number; total: number }>();
    for (const inv of filtered) {
      const entry = typeMap.get(inv.type) || { count: 0, total: 0 };
      entry.count++;
      entry.total += Math.abs(inv.total);
      typeMap.set(inv.type, entry);
    }
    const byType = Array.from(typeMap.entries())
      .map(([type, data]) => ({ type, ...data }));

    return {
      period: `${start} to ${end}`,
      totalInvoiced,
      totalCollected,
      totalOutstanding,
      invoiceCount,
      averageInvoice,
      collectionRate,
      byMonth,
      byType,
    };
  }

  // ---------- PRICING VERIFICATION ----------

  async verifyPricing(invoiceId: string): Promise<PricingDiscrepancy[]> {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) return [];

    return this.flagPricingDiscrepancies(invoice);
  }

  flagPricingDiscrepancies(invoice: Invoice): PricingDiscrepancy[] {
    const discrepancies: PricingDiscrepancy[] = [];

    for (const item of invoice.lineItems) {
      if (item.category !== 'materials') continue;

      // Try to match against inventory by description keywords
      const matchedProduct = this.findMatchingProduct(item.description);
      if (!matchedProduct) continue;

      const currentPrice = matchedProduct.price;
      const invoicedPrice = item.unitPrice;
      const difference = invoicedPrice - currentPrice;
      const percentDiff = currentPrice > 0 ? (difference / currentPrice) * 100 : 0;

      // Flag if price differs by more than 5%
      if (Math.abs(percentDiff) > 5) {
        discrepancies.push({
          lineItemId: item.id,
          description: item.description,
          invoicedPrice,
          currentPrice,
          difference,
          percentDiff: Math.round(percentDiff * 10) / 10,
          matchedProductId: matchedProduct.productId,
        });
      }
    }

    return discrepancies;
  }

  private findMatchingProduct(description: string): InventoryProduct | undefined {
    const descLower = description.toLowerCase();
    return inventoryProducts.find(p => {
      const nameLower = p.productName.toLowerCase();
      // Match on product name keywords
      return descLower.includes(nameLower) || nameLower.includes(descLower.split(' ')[0]);
    });
  }

  // ---------- UTILITIES ----------

  private calculateDueDate(terms: string): string {
    const today = new Date();
    let daysToAdd = 30;

    if (terms === 'Net 15') daysToAdd = 15;
    else if (terms === 'Net 30') daysToAdd = 30;
    else if (terms === 'Net 45') daysToAdd = 45;
    else if (terms === 'Net 60') daysToAdd = 60;
    else if (terms === 'Due on Completion') daysToAdd = 0;
    else if (terms === 'Due on Approval') daysToAdd = 7;
    else if (terms === 'Immediate') daysToAdd = 0;

    today.setDate(today.getDate() + daysToAdd);
    return today.toISOString().slice(0, 10);
  }

  // ---------- SEARCH & FILTER ----------

  async searchInvoices(query: string): Promise<Invoice[]> {
    const q = query.toLowerCase();
    const all = await this.readAllFromSheets();
    return all.filter(inv =>
      inv.invoiceId.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q) ||
      inv.jobId.toLowerCase().includes(q) ||
      inv.customerEmail.toLowerCase().includes(q)
    );
  }

  async filterInvoices(filters: {
    status?: InvoiceStatus;
    type?: InvoiceType;
    dateFrom?: string;
    dateTo?: string;
    amountMin?: number;
    amountMax?: number;
  }): Promise<Invoice[]> {
    let results = await this.readAllFromSheets();

    if (filters.status) {
      results = results.filter(inv => inv.status === filters.status);
    }
    if (filters.type) {
      results = results.filter(inv => inv.type === filters.type);
    }
    if (filters.dateFrom) {
      results = results.filter(inv => inv.createdAt >= filters.dateFrom!);
    }
    if (filters.dateTo) {
      results = results.filter(inv => inv.createdAt <= filters.dateTo!);
    }
    if (filters.amountMin !== undefined) {
      results = results.filter(inv => inv.total >= filters.amountMin!);
    }
    if (filters.amountMax !== undefined) {
      results = results.filter(inv => inv.total <= filters.amountMax!);
    }

    return results;
  }

  // ============ JOBNIMBUS INTEGRATION (READ-ONLY) ============

  /**
   * Fetch JN invoices for reference/comparison.
   * If contactJnid provided, fetches invoices for that contact.
   * Falls back to empty array if JN not configured or on error.
   */
  async fetchJNInvoices(contactJnid?: string): Promise<JNInvoiceSummary[]> {
    if (!isJobNimbusConfigured()) {
      return [];
    }

    try {
      if (!contactJnid) {
        return [];
      }

      const jnInvoices = await jobNimbusService.getInvoicesForContact(contactJnid);

      // Also fetch the contact to get customer name
      let customerName = 'Unknown';
      try {
        const contact = await jobNimbusService.getContact(contactJnid);
        customerName = jobNimbusService.getContactName(contact);
      } catch {
        // Contact lookup failed - use default name
      }

      return jnInvoices.map((inv: JobNimbusInvoice) => ({
        jnid: inv.jnid,
        invoiceNumber: inv.number || '',
        status: inv.status || 'unknown',
        amount: inv.amount || 0,
        amountPaid: inv.amount_paid || 0,
        balance: inv.balance || 0,
        total: inv.total || 0,
        dueDate: inv.due_date ? new Date(inv.due_date * 1000).toISOString().slice(0, 10) : '',
        pdfUrl: inv.pdf_url || '',
        createdAt: inv.created_at ? new Date(inv.created_at * 1000).toISOString().slice(0, 10) : '',
        customerName,
      }));
    } catch (error) {
      console.error('Failed to fetch JN invoices:', error);
      return [];
    }
  }

  /**
   * Fetch a specific JN invoice with full context (contact + job).
   * Gets invoices for the contact, finds the matching one, and enriches with contact/job data.
   */
  async fetchJNInvoiceDetail(contactJnid: string, invoiceJnid: string): Promise<JNInvoiceDetail> {
    const jnInvoices = await jobNimbusService.getInvoicesForContact(contactJnid);
    const matchedInvoice = jnInvoices.find((inv: JobNimbusInvoice) => inv.jnid === invoiceJnid);

    if (!matchedInvoice) {
      throw new Error(`JN invoice ${invoiceJnid} not found for contact ${contactJnid}`);
    }

    // Fetch contact info
    let contact: JobNimbusContact | null = null;
    try {
      contact = await jobNimbusService.getContact(contactJnid);
    } catch {
      // Contact fetch failed
    }

    // Fetch job info if related job exists
    let job: JobNimbusJob | null = null;
    if (matchedInvoice.related?.jnid) {
      try {
        job = await jobNimbusService.getJob(matchedInvoice.related.jnid);
      } catch {
        // Job fetch failed
      }
    }

    return {
      invoice: matchedInvoice,
      contact,
      job,
    };
  }

  /**
   * Import/reference a JN invoice into the local system.
   * Maps JN invoice fields to local Invoice shape and persists to Sheets.
   * Sets source tracking fields for JN origin.
   */
  async importJNInvoice(jnInvoice: JNInvoiceDetail): Promise<Invoice> {
    const { invoice: jnInv, contact, job } = jnInvoice;
    const now = new Date().toISOString();

    // Map JN status to local status
    let localStatus: InvoiceStatus = 'sent';
    const jnStatus = (jnInv.status || '').toLowerCase();
    if (jnStatus === 'paid' || jnStatus === 'closed') {
      localStatus = 'paid';
    } else if (jnStatus === 'overdue' || jnStatus === 'past due') {
      localStatus = 'overdue';
    } else if (jnStatus === 'draft') {
      localStatus = 'draft';
    } else if (jnStatus === 'void' || jnStatus === 'cancelled') {
      localStatus = 'cancelled';
    }

    // Build customer name from contact
    const customerName = contact
      ? jobNimbusService.getContactName(contact)
      : 'JN Customer';

    // Build address from contact or job
    const buildAddress = (src: { address_line1?: string; city?: string; state_text?: string; zip?: string } | null): Address => ({
      street: src?.address_line1 || '',
      city: src?.city || '',
      state: src?.state_text || 'AL',
      zip: src?.zip || '',
    });

    const billingAddress = buildAddress(contact);
    const jobAddress = job ? buildAddress(job) : billingAddress;

    const total = jnInv.total || jnInv.amount || 0;
    const amountPaid = jnInv.amount_paid || 0;
    const balanceDue = jnInv.balance || (total - amountPaid);

    const invoiceId = await this.generateInvoiceNumber();
    const dueDate = jnInv.due_date
      ? new Date(jnInv.due_date * 1000).toISOString().slice(0, 10)
      : this.calculateDueDate('Net 30');
    const createdAt = jnInv.created_at
      ? new Date(jnInv.created_at * 1000).toISOString()
      : now;

    const invoice: Invoice = {
      invoiceId,
      jobId: job?.number || job?.jnid || '',
      customerName,
      customerEmail: contact?.email || '',
      customerPhone: contact ? jobNimbusService.getContactPhone(contact) : '',
      billingAddress,
      jobAddress,
      type: 'final',
      status: localStatus,
      lineItems: jnInv.description ? [{
        id: `jn-li-${Date.now()}`,
        description: jnInv.description,
        category: 'other' as const,
        quantity: 1,
        unit: 'job',
        unitPrice: total,
        total: total,
        taxable: false,
      }] : [],
      subtotal: total,
      taxRate: 0,
      taxAmount: 0,
      discount: 0,
      discountType: 'fixed',
      total,
      amountPaid,
      balanceDue,
      payments: amountPaid > 0 ? [{
        paymentId: `PAY-JN-${Date.now()}`,
        date: now.slice(0, 10),
        amount: amountPaid,
        method: 'check',
        reference: `JN Invoice ${jnInv.number || jnInv.jnid}`,
        notes: 'Imported from JobNimbus',
      }] : [],
      dueDate,
      terms: 'Net 30',
      notes: `Imported from JobNimbus invoice ${jnInv.number || jnInv.jnid}. ${jnInv.description || ''}`.trim(),
      internalNotes: `Source: jobnimbus | JN Invoice ID: ${jnInv.jnid}`,
      createdAt,
      updatedAt: now,
      createdBy: 'JN Import',
    };

    // Persist to Sheets
    await this.writeToSheets(invoice);

    return invoice;
  }

  /**
   * Compare a local invoice with JN invoice data.
   * Finds the local invoice, fetches JN invoices for the contact,
   * attempts to match by invoice number or amount, and returns differences.
   */
  async compareWithJN(localInvoiceId: string, contactJnid: string): Promise<InvoiceComparison> {
    const localInvoice = await this.getInvoice(localInvoiceId);

    if (!localInvoice) {
      return {
        localInvoice: null,
        jnInvoice: null,
        matched: false,
        differences: [{ field: 'error', local: 'Invoice not found', jn: '' }],
      };
    }

    // Fetch JN invoices for this contact
    const jnInvoices = await this.fetchJNInvoices(contactJnid);

    if (jnInvoices.length === 0) {
      return {
        localInvoice,
        jnInvoice: null,
        matched: false,
        differences: [{ field: 'error', local: 'No JN invoices found for this contact', jn: '' }],
      };
    }

    // Try to match: first by invoice number, then by amount
    let matchedJN: JNInvoiceSummary | null = null;

    // Match by invoice number substring
    for (const jnInv of jnInvoices) {
      if (jnInv.invoiceNumber && localInvoice.invoiceId.includes(jnInv.invoiceNumber)) {
        matchedJN = jnInv;
        break;
      }
    }

    // Fall back to matching by total amount (within 1% tolerance)
    if (!matchedJN) {
      for (const jnInv of jnInvoices) {
        const diff = Math.abs(localInvoice.total - jnInv.total);
        const tolerance = Math.abs(localInvoice.total) * 0.01;
        if (diff <= tolerance) {
          matchedJN = jnInv;
          break;
        }
      }
    }

    if (!matchedJN) {
      return {
        localInvoice,
        jnInvoice: null,
        matched: false,
        differences: [{ field: 'match', local: 'No matching JN invoice found', jn: '' }],
      };
    }

    // Compare fields
    const differences: { field: string; local: string | number; jn: string | number }[] = [];

    if (Math.abs(localInvoice.total - matchedJN.total) > 0.01) {
      differences.push({ field: 'Total', local: localInvoice.total, jn: matchedJN.total });
    }
    if (Math.abs(localInvoice.amountPaid - matchedJN.amountPaid) > 0.01) {
      differences.push({ field: 'Amount Paid', local: localInvoice.amountPaid, jn: matchedJN.amountPaid });
    }
    if (Math.abs(localInvoice.balanceDue - matchedJN.balance) > 0.01) {
      differences.push({ field: 'Balance Due', local: localInvoice.balanceDue, jn: matchedJN.balance });
    }
    if (localInvoice.status !== matchedJN.status.toLowerCase()) {
      differences.push({ field: 'Status', local: localInvoice.status, jn: matchedJN.status });
    }

    return {
      localInvoice,
      jnInvoice: matchedJN,
      matched: true,
      differences,
    };
  }
}

// Export singleton
export const invoiceService = new InvoiceService();