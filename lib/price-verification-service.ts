import { GoogleSpreadsheet, GoogleSpreadsheetRow } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const SHEETS_ID = process.env.GOOGLE_SHEETS_ID;

// Handle private key - works with both escaped \n and actual newlines
const privateKey = process.env.GOOGLE_PRIVATE_KEY
  ?.replace(/\\n/g, '\n')  // Handle escaped \n from env files
  ?.replace(/\r\n/g, '\n'); // Normalize Windows line endings

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Sheet names for price verification
const SHEETS = {
  SUPPLIER_PRICING: 'Supplier Pricing',
  PRICE_ALERTS: 'Price Alerts',
  INVOICE_RECORDS: 'Invoice Records',
  PRICE_AUDIT_LOG: 'Price Audit Log',
};

// Types
export interface SupplierPricing {
  productId: string;
  productName: string;
  supplier: string;
  sku: string;
  category: string;
  unit: string;
  agreedPrice: number;
  effectiveDate: string;
  expirationDate: string;
  contractNumber: string;
  discountPercent: number;
  listPrice: number;
  notes: string;
  lastVerified: string;
  verifiedBy: string;
}

export interface PriceAlert {
  alertId: string;
  alertDate: string;
  productId: string;
  productName: string;
  supplier: string;
  invoiceNumber: string;
  invoiceDate: string;
  agreedPrice: number;
  invoicedPrice: number;
  quantity: number;
  discrepancy: number;
  discrepancyPercent: number;
  totalOvercharge: number;
  status: 'New' | 'Under Review' | 'Disputed' | 'Resolved' | 'Credit Received';
  assignedTo: string;
  resolvedDate: string;
  creditAmount: number;
  notes: string;
}

export interface InvoiceRecord {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  supplier: string;
  poNumber: string;
  jobName: string;
  subtotal: number;
  tax: number;
  total: number;
  status: 'Pending Review' | 'Verified' | 'Discrepancy Found' | 'Paid' | 'Disputed';
  verifiedBy: string;
  verifiedDate: string;
  discrepancyCount: number;
  totalDiscrepancy: number;
  pdfUrl: string;
  notes: string;
}

export interface InvoiceLineItem {
  invoiceId: string;
  lineNumber: number;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  agreedPrice: number;
  priceDiff: number;
  lineSavings: number;
  status: 'OK' | 'Overcharge' | 'Undercharge' | 'Unknown Product';
}

export interface PriceAuditSummary {
  period: string;
  totalInvoices: number;
  totalSpend: number;
  discrepanciesFound: number;
  totalOvercharges: number;
  creditsReceived: number;
  pendingCredits: number;
  topOverchargedProducts: Array<{
    productName: string;
    supplier: string;
    totalOvercharge: number;
    occurrences: number;
  }>;
  supplierSummary: Array<{
    supplier: string;
    invoiceCount: number;
    totalSpend: number;
    discrepancies: number;
    overchargeAmount: number;
  }>;
}

class PriceVerificationService {
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
  // SUPPLIER PRICING (Agreed Prices)
  // ============================================

  async getSupplierPricing(supplier?: string): Promise<SupplierPricing[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.SUPPLIER_PRICING, [
      'productId', 'productName', 'supplier', 'sku', 'category', 'unit',
      'agreedPrice', 'effectiveDate', 'expirationDate', 'contractNumber',
      'discountPercent', 'listPrice', 'notes', 'lastVerified', 'verifiedBy'
    ]);

    const rows = await sheet.getRows();
    let items = rows.map(row => ({
      productId: row.get('productId'),
      productName: row.get('productName'),
      supplier: row.get('supplier'),
      sku: row.get('sku'),
      category: row.get('category'),
      unit: row.get('unit'),
      agreedPrice: parseFloat(row.get('agreedPrice')) || 0,
      effectiveDate: row.get('effectiveDate'),
      expirationDate: row.get('expirationDate'),
      contractNumber: row.get('contractNumber'),
      discountPercent: parseFloat(row.get('discountPercent')) || 0,
      listPrice: parseFloat(row.get('listPrice')) || 0,
      notes: row.get('notes'),
      lastVerified: row.get('lastVerified'),
      verifiedBy: row.get('verifiedBy'),
    }));

    if (supplier) {
      items = items.filter(i => i.supplier.toLowerCase() === supplier.toLowerCase());
    }

    return items;
  }

  async addSupplierPricing(data: Omit<SupplierPricing, 'productId'>): Promise<SupplierPricing> {
    const sheet = await this.getOrCreateSheet(SHEETS.SUPPLIER_PRICING, []);

    const pricing: SupplierPricing = {
      ...data,
      productId: this.generateId('PRD'),
    };

    await sheet.addRow(pricing as unknown as Record<string, string | number | boolean>);
    return pricing;
  }

  async updateSupplierPricing(productId: string, updates: Partial<SupplierPricing>): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.SUPPLIER_PRICING, []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('productId') === productId);

    if (row) {
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          row.set(key, String(value));
        }
      });
      await row.save();
    }
  }

  async getAgreedPrice(supplier: string, sku: string): Promise<SupplierPricing | null> {
    const pricing = await this.getSupplierPricing(supplier);
    return pricing.find(p => p.sku === sku) || null;
  }

  // ============================================
  // PRICE VERIFICATION
  // ============================================

  async verifyInvoicePrice(
    supplier: string,
    sku: string,
    invoicedPrice: number,
    quantity: number
  ): Promise<{
    isCorrect: boolean;
    agreedPrice: number;
    discrepancy: number;
    discrepancyPercent: number;
    totalOvercharge: number;
    productName: string;
  }> {
    const agreedPricing = await this.getAgreedPrice(supplier, sku);

    if (!agreedPricing) {
      return {
        isCorrect: false,
        agreedPrice: 0,
        discrepancy: 0,
        discrepancyPercent: 0,
        totalOvercharge: 0,
        productName: 'UNKNOWN - NOT IN PRICING DATABASE',
      };
    }

    const discrepancy = invoicedPrice - agreedPricing.agreedPrice;
    const discrepancyPercent = agreedPricing.agreedPrice > 0
      ? (discrepancy / agreedPricing.agreedPrice) * 100
      : 0;
    const totalOvercharge = discrepancy * quantity;

    return {
      isCorrect: Math.abs(discrepancy) < 0.01, // Allow for rounding
      agreedPrice: agreedPricing.agreedPrice,
      discrepancy,
      discrepancyPercent,
      totalOvercharge,
      productName: agreedPricing.productName,
    };
  }

  async verifyInvoiceLineItems(
    supplier: string,
    lineItems: Array<{ sku: string; unitPrice: number; quantity: number; productName?: string }>
  ): Promise<{
    results: InvoiceLineItem[];
    totalDiscrepancy: number;
    discrepancyCount: number;
    hasOvercharges: boolean;
  }> {
    const results: InvoiceLineItem[] = [];
    let totalDiscrepancy = 0;
    let discrepancyCount = 0;

    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      const verification = await this.verifyInvoicePrice(
        supplier,
        item.sku,
        item.unitPrice,
        item.quantity
      );

      const lineResult: InvoiceLineItem = {
        invoiceId: '',
        lineNumber: i + 1,
        productId: '',
        productName: item.productName || verification.productName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.unitPrice * item.quantity,
        agreedPrice: verification.agreedPrice,
        priceDiff: verification.discrepancy,
        lineSavings: verification.totalOvercharge * -1,
        status: verification.agreedPrice === 0
          ? 'Unknown Product'
          : verification.isCorrect
            ? 'OK'
            : verification.discrepancy > 0
              ? 'Overcharge'
              : 'Undercharge',
      };

      results.push(lineResult);

      if (verification.discrepancy > 0) {
        totalDiscrepancy += verification.totalOvercharge;
        discrepancyCount++;
      }
    }

    return {
      results,
      totalDiscrepancy,
      discrepancyCount,
      hasOvercharges: discrepancyCount > 0,
    };
  }

  // ============================================
  // PRICE ALERTS
  // ============================================

  async createPriceAlert(data: Omit<PriceAlert, 'alertId' | 'alertDate' | 'status'>): Promise<PriceAlert> {
    const sheet = await this.getOrCreateSheet(SHEETS.PRICE_ALERTS, [
      'alertId', 'alertDate', 'productId', 'productName', 'supplier',
      'invoiceNumber', 'invoiceDate', 'agreedPrice', 'invoicedPrice',
      'quantity', 'discrepancy', 'discrepancyPercent', 'totalOvercharge',
      'status', 'assignedTo', 'resolvedDate', 'creditAmount', 'notes'
    ]);

    const alert: PriceAlert = {
      ...data,
      alertId: this.generateId('ALT'),
      alertDate: new Date().toISOString(),
      status: 'New',
    };

    await sheet.addRow(alert as unknown as Record<string, string | number | boolean>);
    return alert;
  }

  async getPriceAlerts(status?: PriceAlert['status']): Promise<PriceAlert[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.PRICE_ALERTS, []);
    const rows = await sheet.getRows();

    let alerts = rows.map(row => ({
      alertId: row.get('alertId'),
      alertDate: row.get('alertDate'),
      productId: row.get('productId'),
      productName: row.get('productName'),
      supplier: row.get('supplier'),
      invoiceNumber: row.get('invoiceNumber'),
      invoiceDate: row.get('invoiceDate'),
      agreedPrice: parseFloat(row.get('agreedPrice')) || 0,
      invoicedPrice: parseFloat(row.get('invoicedPrice')) || 0,
      quantity: parseFloat(row.get('quantity')) || 0,
      discrepancy: parseFloat(row.get('discrepancy')) || 0,
      discrepancyPercent: parseFloat(row.get('discrepancyPercent')) || 0,
      totalOvercharge: parseFloat(row.get('totalOvercharge')) || 0,
      status: row.get('status') as PriceAlert['status'],
      assignedTo: row.get('assignedTo'),
      resolvedDate: row.get('resolvedDate'),
      creditAmount: parseFloat(row.get('creditAmount')) || 0,
      notes: row.get('notes'),
    }));

    if (status) {
      alerts = alerts.filter(a => a.status === status);
    }

    return alerts.sort((a, b) => new Date(b.alertDate).getTime() - new Date(a.alertDate).getTime());
  }

  async updatePriceAlert(alertId: string, updates: Partial<PriceAlert>): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.PRICE_ALERTS, []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('alertId') === alertId);

    if (row) {
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          row.set(key, String(value));
        }
      });
      await row.save();
    }
  }

  // ============================================
  // INVOICE RECORDS
  // ============================================

  async recordInvoice(data: Omit<InvoiceRecord, 'invoiceId' | 'status' | 'verifiedDate'>): Promise<InvoiceRecord> {
    const sheet = await this.getOrCreateSheet(SHEETS.INVOICE_RECORDS, [
      'invoiceId', 'invoiceNumber', 'invoiceDate', 'supplier', 'poNumber',
      'jobName', 'subtotal', 'tax', 'total', 'status', 'verifiedBy',
      'verifiedDate', 'discrepancyCount', 'totalDiscrepancy', 'pdfUrl', 'notes'
    ]);

    const invoice: InvoiceRecord = {
      ...data,
      invoiceId: this.generateId('INV'),
      status: 'Pending Review',
      verifiedDate: '',
    };

    await sheet.addRow(invoice as unknown as Record<string, string | number | boolean>);
    return invoice;
  }

  async getInvoiceRecords(supplier?: string, status?: InvoiceRecord['status']): Promise<InvoiceRecord[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.INVOICE_RECORDS, []);
    const rows = await sheet.getRows();

    let invoices = rows.map(row => ({
      invoiceId: row.get('invoiceId'),
      invoiceNumber: row.get('invoiceNumber'),
      invoiceDate: row.get('invoiceDate'),
      supplier: row.get('supplier'),
      poNumber: row.get('poNumber'),
      jobName: row.get('jobName'),
      subtotal: parseFloat(row.get('subtotal')) || 0,
      tax: parseFloat(row.get('tax')) || 0,
      total: parseFloat(row.get('total')) || 0,
      status: row.get('status') as InvoiceRecord['status'],
      verifiedBy: row.get('verifiedBy'),
      verifiedDate: row.get('verifiedDate'),
      discrepancyCount: parseInt(row.get('discrepancyCount')) || 0,
      totalDiscrepancy: parseFloat(row.get('totalDiscrepancy')) || 0,
      pdfUrl: row.get('pdfUrl'),
      notes: row.get('notes'),
    }));

    if (supplier) {
      invoices = invoices.filter(i => i.supplier.toLowerCase() === supplier.toLowerCase());
    }
    if (status) {
      invoices = invoices.filter(i => i.status === status);
    }

    return invoices.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
  }

  async updateInvoiceRecord(invoiceId: string, updates: Partial<InvoiceRecord>): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.INVOICE_RECORDS, []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('invoiceId') === invoiceId);

    if (row) {
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          row.set(key, String(value));
        }
      });
      await row.save();
    }
  }

  // ============================================
  // AUDIT & REPORTING
  // ============================================

  async logAuditAction(
    action: string,
    details: string,
    user: string,
    relatedId?: string
  ): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.PRICE_AUDIT_LOG, [
      'logId', 'timestamp', 'action', 'details', 'user', 'relatedId'
    ]);

    await sheet.addRow({
      logId: this.generateId('LOG'),
      timestamp: new Date().toISOString(),
      action,
      details,
      user,
      relatedId: relatedId || '',
    });
  }

  async getAuditSummary(startDate: string, endDate: string): Promise<PriceAuditSummary> {
    const invoices = await this.getInvoiceRecords();
    const alerts = await this.getPriceAlerts();

    // Filter by date range
    const filteredInvoices = invoices.filter(i =>
      i.invoiceDate >= startDate && i.invoiceDate <= endDate
    );
    const filteredAlerts = alerts.filter(a =>
      a.invoiceDate >= startDate && a.invoiceDate <= endDate
    );

    // Calculate totals
    const totalSpend = filteredInvoices.reduce((sum, i) => sum + i.total, 0);
    const totalOvercharges = filteredAlerts.reduce((sum, a) => sum + a.totalOvercharge, 0);
    const creditsReceived = filteredAlerts
      .filter(a => a.status === 'Credit Received')
      .reduce((sum, a) => sum + a.creditAmount, 0);
    const pendingCredits = filteredAlerts
      .filter(a => ['New', 'Under Review', 'Disputed'].includes(a.status))
      .reduce((sum, a) => sum + a.totalOvercharge, 0);

    // Top overcharged products
    const productOvercharges = new Map<string, { productName: string; supplier: string; total: number; count: number }>();
    filteredAlerts.forEach(alert => {
      const key = `${alert.productName}-${alert.supplier}`;
      const existing = productOvercharges.get(key) || {
        productName: alert.productName,
        supplier: alert.supplier,
        total: 0,
        count: 0
      };
      existing.total += alert.totalOvercharge;
      existing.count++;
      productOvercharges.set(key, existing);
    });

    const topOverchargedProducts = Array.from(productOvercharges.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map(p => ({
        productName: p.productName,
        supplier: p.supplier,
        totalOvercharge: p.total,
        occurrences: p.count,
      }));

    // Supplier summary
    const supplierStats = new Map<string, { invoiceCount: number; totalSpend: number; discrepancies: number; overchargeAmount: number }>();
    filteredInvoices.forEach(invoice => {
      const existing = supplierStats.get(invoice.supplier) || {
        invoiceCount: 0,
        totalSpend: 0,
        discrepancies: 0,
        overchargeAmount: 0
      };
      existing.invoiceCount++;
      existing.totalSpend += invoice.total;
      existing.discrepancies += invoice.discrepancyCount;
      existing.overchargeAmount += invoice.totalDiscrepancy;
      supplierStats.set(invoice.supplier, existing);
    });

    const supplierSummary = Array.from(supplierStats.entries())
      .map(([supplier, stats]) => ({
        supplier,
        ...stats,
      }))
      .sort((a, b) => b.overchargeAmount - a.overchargeAmount);

    return {
      period: `${startDate} to ${endDate}`,
      totalInvoices: filteredInvoices.length,
      totalSpend,
      discrepanciesFound: filteredAlerts.length,
      totalOvercharges,
      creditsReceived,
      pendingCredits,
      topOverchargedProducts,
      supplierSummary,
    };
  }

  // ============================================
  // SETUP & IMPORT
  // ============================================

  async setupPricingSheets(): Promise<void> {
    // Create all necessary sheets with headers
    await this.getOrCreateSheet(SHEETS.SUPPLIER_PRICING, [
      'productId', 'productName', 'supplier', 'sku', 'category', 'unit',
      'agreedPrice', 'effectiveDate', 'expirationDate', 'contractNumber',
      'discountPercent', 'listPrice', 'notes', 'lastVerified', 'verifiedBy'
    ]);

    await this.getOrCreateSheet(SHEETS.PRICE_ALERTS, [
      'alertId', 'alertDate', 'productId', 'productName', 'supplier',
      'invoiceNumber', 'invoiceDate', 'agreedPrice', 'invoicedPrice',
      'quantity', 'discrepancy', 'discrepancyPercent', 'totalOvercharge',
      'status', 'assignedTo', 'resolvedDate', 'creditAmount', 'notes'
    ]);

    await this.getOrCreateSheet(SHEETS.INVOICE_RECORDS, [
      'invoiceId', 'invoiceNumber', 'invoiceDate', 'supplier', 'poNumber',
      'jobName', 'subtotal', 'tax', 'total', 'status', 'verifiedBy',
      'verifiedDate', 'discrepancyCount', 'totalDiscrepancy', 'pdfUrl', 'notes'
    ]);

    await this.getOrCreateSheet(SHEETS.PRICE_AUDIT_LOG, [
      'logId', 'timestamp', 'action', 'details', 'user', 'relatedId'
    ]);
  }

  async importSupplierPricing(
    pricingData: Array<Omit<SupplierPricing, 'productId'>>
  ): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    for (const item of pricingData) {
      try {
        await this.addSupplierPricing(item);
        imported++;
      } catch (error) {
        errors.push(`Failed to import ${item.productName}: ${error}`);
      }
    }

    await this.logAuditAction(
      'BULK_IMPORT',
      `Imported ${imported} pricing records`,
      'System',
    );

    return { imported, errors };
  }
}

export const priceVerificationService = new PriceVerificationService();
