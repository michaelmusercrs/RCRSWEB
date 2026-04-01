/**
 * Inventory Reconciliation Service
 *
 * Cross-references job breakdowns, delivery tickets, invoices, and inventory
 * to ensure nothing falls through the cracks. Identifies discrepancies between
 * what was ordered, pulled, delivered, and invoiced for each job.
 *
 * Uses Google Sheets "Reconciliation" tab for persistence.
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// ============================================
// CONFIGURATION
// ============================================

const SHEETS_ID = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const RECONCILIATION_SHEET = 'Reconciliation';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type FlagSeverity = 'green' | 'yellow' | 'red';

export interface MaterialReconciliationItem {
  productName: string;
  category: string;

  // Breakdown
  breakdownQty: number;
  breakdownUnitCost: number;
  breakdownTotal: number;
  inBreakdown: boolean;

  // Inventory
  inventoryProductId: string;
  inventoryCurrentQty: number;
  inventoryUnitCost: number;
  trackedInInventory: boolean;

  // Delivery
  deliveryTicketId: string;
  deliveryTicketStatus: string;
  deliveredQty: number;
  assignedToDelivery: boolean;
  deliveryCompleted: boolean;

  // Invoice
  invoiceId: string;
  invoicedQty: number;
  invoicedUnitPrice: number;
  invoicedTotal: number;
  invoiced: boolean;

  // Reconciliation result
  flag: FlagSeverity;
  warnings: string[];
}

export interface JobReconciliation {
  jobId: string;
  jobName: string;
  customerName: string;
  breakdownId: string;
  breakdownStatus: string;

  materials: MaterialReconciliationItem[];

  // Summary
  totalBreakdownCost: number;
  totalInvoicedAmount: number;
  totalDeliveredValue: number;

  // Flags
  overallFlag: FlagSeverity;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  warningCount: number;
  warnings: string[];

  reconciledAt: string;
}

export interface ReconciliationReport {
  generatedAt: string;
  jobs: JobReconciliation[];

  // Aggregate issues
  materialsNotOnDelivery: { jobId: string; jobName: string; productName: string; qty: number }[];
  deliveredNotInvoiced: { jobId: string; jobName: string; productName: string; ticketId: string }[];
  priceMismatches: { jobId: string; jobName: string; productName: string; inventoryPrice: number; invoicedPrice: number; difference: number }[];
  pulledNotDelivered: { jobId: string; jobName: string; productName: string; ticketId: string; ticketStatus: string }[];

  // Summary
  totalJobs: number;
  jobsFullyReconciled: number;
  jobsWithWarnings: number;
  jobsWithErrors: number;
  totalDiscrepancies: number;
}

// ============================================
// IMPORTS FROM EXISTING SERVICES
// ============================================

// We import the singletons and their types
import { jobBreakdownService, type JobBreakdown, type MaterialItem as BreakdownMaterial } from './job-breakdown-service';
import { deliveryWorkflowService, type DeliveryTicket, type MaterialItem as DeliveryMaterial } from './delivery-workflow-service';
import { invoiceService, type Invoice, type LineItem } from './invoice-service';
import { inventoryManagementService, type InventoryItem } from './inventory-management-service';

// ============================================
// SERVICE CLASS
// ============================================

class InventoryReconciliationService {
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
      sheet = await doc.addSheet({
        title: name,
        headerValues: headers,
        gridProperties: { columnCount: Math.max(headers.length + 5, 26) },
      });
    } else {
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
  // MATERIAL MATCHING HELPERS
  // ============================================

  /**
   * Normalize a product name for fuzzy matching.
   * Strips extra whitespace, lowercases, removes punctuation.
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Check if two product names match (fuzzy).
   * Tries exact match first, then checks if one contains the other.
   */
  private namesMatch(a: string, b: string): boolean {
    const na = this.normalizeName(a);
    const nb = this.normalizeName(b);
    if (na === nb) return true;
    // Check containment both ways (for abbreviated vs full names)
    if (na.includes(nb) || nb.includes(na)) return true;
    // Check if at least 80% of words match
    const wordsA = na.split(' ').filter(w => w.length > 2);
    const wordsB = nb.split(' ').filter(w => w.length > 2);
    if (wordsA.length === 0 || wordsB.length === 0) return false;
    const matched = wordsA.filter(w => wordsB.some(wb => wb.includes(w) || w.includes(wb)));
    return matched.length / Math.max(wordsA.length, wordsB.length) >= 0.7;
  }

  /**
   * Find an inventory item by productName match.
   */
  private findInventoryItem(productName: string, inventory: InventoryItem[]): InventoryItem | null {
    // Try exact match first
    const exact = inventory.find(i => this.normalizeName(i.productName) === this.normalizeName(productName));
    if (exact) return exact;
    // Try fuzzy match
    const fuzzy = inventory.find(i => this.namesMatch(i.productName, productName));
    return fuzzy || null;
  }

  /**
   * Find delivery tickets for a given jobId that contain a specific material.
   */
  private findDeliveryForMaterial(
    productName: string,
    jobTickets: DeliveryTicket[]
  ): { ticket: DeliveryTicket; material: DeliveryMaterial } | null {
    for (const ticket of jobTickets) {
      const mat = ticket.materials.find(m => this.namesMatch(m.productName, productName));
      if (mat) return { ticket, material: mat };
    }
    return null;
  }

  /**
   * Find invoice line items matching a product name for a set of invoices.
   */
  private findInvoiceLineItem(
    productName: string,
    invoices: Invoice[]
  ): { invoice: Invoice; lineItem: LineItem } | null {
    for (const inv of invoices) {
      const li = inv.lineItems.find(
        item => item.category === 'materials' && this.namesMatch(item.description, productName)
      );
      if (li) return { invoice: inv, lineItem: li };
    }
    return null;
  }

  // ============================================
  // RECONCILE A SINGLE JOB
  // ============================================

  async reconcileJob(jobId: string): Promise<JobReconciliation | null> {
    // 1. Get all breakdowns for this job
    const breakdowns = await jobBreakdownService.getBreakdownsByJob(jobId);
    if (breakdowns.length === 0) {
      // Also try by breakdown.jobId matching
      const allBreakdowns = await jobBreakdownService.getAllBreakdowns();
      const match = allBreakdowns.find(b => b.jobId === jobId);
      if (match) breakdowns.push(match);
    }

    if (breakdowns.length === 0) return null;

    // Use the most recent or active breakdown
    const breakdown = breakdowns.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];

    // 2. Get all delivery tickets for this job
    const allTickets = await deliveryWorkflowService.getTickets();
    const jobTickets = allTickets.filter(t => t.jobId === jobId);

    // 3. Get all invoices for this job
    const allInvoices = await invoiceService.getAllInvoices();
    const jobInvoices = allInvoices.filter(inv => inv.jobId === jobId);

    // Also check delivery workflow invoices (different invoice model)
    const deliveryInvoices = await deliveryWorkflowService.getInvoices();
    const jobDeliveryInvoices = deliveryInvoices.filter(inv => inv.jobId === jobId);

    // 4. Get inventory items
    const inventory = await inventoryManagementService.getInventory();

    // 5. Reconcile each material in the breakdown
    const materialResults: MaterialReconciliationItem[] = [];
    const warnings: string[] = [];

    for (const material of breakdown.materials) {
      const result = this.reconcileMaterial(
        material,
        jobTickets,
        jobInvoices,
        jobDeliveryInvoices,
        inventory
      );
      materialResults.push(result);
      warnings.push(...result.warnings);
    }

    // 6. Check for materials on delivery tickets that are NOT in the breakdown
    for (const ticket of jobTickets) {
      for (const mat of ticket.materials) {
        const inBreakdown = breakdown.materials.some(m => this.namesMatch(m.productName, mat.productName));
        if (!inBreakdown) {
          warnings.push(`Material "${mat.productName}" on ticket ${ticket.ticketId} is NOT in the job breakdown`);
        }
      }
    }

    // 7. Compute summary
    const greenCount = materialResults.filter(m => m.flag === 'green').length;
    const yellowCount = materialResults.filter(m => m.flag === 'yellow').length;
    const redCount = materialResults.filter(m => m.flag === 'red').length;

    let overallFlag: FlagSeverity = 'green';
    if (redCount > 0) overallFlag = 'red';
    else if (yellowCount > 0) overallFlag = 'yellow';

    const totalBreakdownCost = breakdown.materialTotal;
    const totalInvoicedAmount = materialResults.reduce((sum, m) => sum + m.invoicedTotal, 0);
    const totalDeliveredValue = materialResults
      .filter(m => m.deliveryCompleted)
      .reduce((sum, m) => sum + m.breakdownTotal, 0);

    return {
      jobId: breakdown.jobId,
      jobName: breakdown.jobName,
      customerName: breakdown.customerName,
      breakdownId: breakdown.breakdownId,
      breakdownStatus: breakdown.status,
      materials: materialResults,
      totalBreakdownCost,
      totalInvoicedAmount,
      totalDeliveredValue,
      overallFlag,
      greenCount,
      yellowCount,
      redCount,
      warningCount: warnings.length,
      warnings,
      reconciledAt: new Date().toISOString(),
    };
  }

  /**
   * Reconcile a single material item across all systems.
   */
  private reconcileMaterial(
    material: BreakdownMaterial,
    jobTickets: DeliveryTicket[],
    jobInvoices: Invoice[],
    jobDeliveryInvoices: { invoiceId: string; ticketId: string; jobId: string; jobName: string; total: number; status: string }[],
    inventory: InventoryItem[]
  ): MaterialReconciliationItem {
    const warnings: string[] = [];

    // a. Check inventory tracking
    const invItem = this.findInventoryItem(material.productName, inventory);
    const trackedInInventory = !!invItem;
    if (!trackedInInventory) {
      warnings.push(`"${material.productName}" not found in inventory system`);
    }

    // b. Check delivery assignment
    const deliveryMatch = this.findDeliveryForMaterial(material.productName, jobTickets);
    const assignedToDelivery = !!deliveryMatch;
    const deliveryCompleted = deliveryMatch
      ? deliveryMatch.ticket.status === 'completed' || deliveryMatch.ticket.status === 'delivered'
      : false;

    if (!assignedToDelivery) {
      warnings.push(`"${material.productName}" not assigned to any delivery ticket`);
    } else if (!deliveryCompleted) {
      warnings.push(`"${material.productName}" delivery not completed (status: ${deliveryMatch!.ticket.status})`);
    }

    // c. Check invoice
    const invoiceMatch = this.findInvoiceLineItem(material.productName, jobInvoices);
    const invoiced = !!invoiceMatch;

    if (!invoiced && deliveryCompleted) {
      warnings.push(`"${material.productName}" delivered but NOT invoiced`);
    }

    // d. Check price mismatch between inventory and invoice
    if (invoiced && trackedInInventory) {
      const invUnitPrice = invItem!.unitPrice;
      const invoicedUnitPrice = invoiceMatch!.lineItem.unitPrice;
      const priceDiff = Math.abs(invUnitPrice - invoicedUnitPrice);
      const threshold = invUnitPrice * 0.05; // 5% tolerance
      if (priceDiff > threshold && priceDiff > 1) {
        warnings.push(
          `"${material.productName}" price mismatch: inventory $${invUnitPrice.toFixed(2)} vs invoice $${invoicedUnitPrice.toFixed(2)}`
        );
      }
    }

    // e. Determine flag severity
    let flag: FlagSeverity = 'green';
    if (!assignedToDelivery || !invoiced) {
      flag = 'red';
    } else if (!deliveryCompleted || warnings.length > 0) {
      flag = 'yellow';
    }

    // If there's 0 warnings and everything checks out, keep green
    if (warnings.length === 0) {
      flag = 'green';
    }

    return {
      productName: material.productName,
      category: material.category,

      breakdownQty: material.quantity,
      breakdownUnitCost: material.unitCost,
      breakdownTotal: material.totalCost,
      inBreakdown: true,

      inventoryProductId: invItem?.productId || '',
      inventoryCurrentQty: invItem?.currentQty || 0,
      inventoryUnitCost: invItem?.unitCost || 0,
      trackedInInventory,

      deliveryTicketId: deliveryMatch?.ticket.ticketId || '',
      deliveryTicketStatus: deliveryMatch?.ticket.status || '',
      deliveredQty: deliveryMatch?.material.quantity || 0,
      assignedToDelivery,
      deliveryCompleted,

      invoiceId: invoiceMatch?.invoice.invoiceId || '',
      invoicedQty: invoiceMatch?.lineItem.quantity || 0,
      invoicedUnitPrice: invoiceMatch?.lineItem.unitPrice || 0,
      invoicedTotal: invoiceMatch?.lineItem.total || 0,
      invoiced,

      flag,
      warnings,
    };
  }

  // ============================================
  // FULL RECONCILIATION REPORT
  // ============================================

  async getReconciliationReport(): Promise<ReconciliationReport> {
    // Get all active breakdowns (not completed, or recently completed)
    const allBreakdowns = await jobBreakdownService.getAllBreakdowns();
    const activeStatuses = ['draft', 'pending_approval', 'approved', 'in_progress', 'revised', 'completed'];
    const activeBreakdowns = allBreakdowns.filter(b => activeStatuses.includes(b.status));

    const jobs: JobReconciliation[] = [];

    // Aggregate issue lists
    const materialsNotOnDelivery: ReconciliationReport['materialsNotOnDelivery'] = [];
    const deliveredNotInvoiced: ReconciliationReport['deliveredNotInvoiced'] = [];
    const priceMismatches: ReconciliationReport['priceMismatches'] = [];
    const pulledNotDelivered: ReconciliationReport['pulledNotDelivered'] = [];

    for (const breakdown of activeBreakdowns) {
      const result = await this.reconcileJob(breakdown.jobId);
      if (!result) continue;
      jobs.push(result);

      // Collect aggregate issues
      for (const mat of result.materials) {
        if (mat.inBreakdown && !mat.assignedToDelivery) {
          materialsNotOnDelivery.push({
            jobId: result.jobId,
            jobName: result.jobName,
            productName: mat.productName,
            qty: mat.breakdownQty,
          });
        }

        if (mat.deliveryCompleted && !mat.invoiced) {
          deliveredNotInvoiced.push({
            jobId: result.jobId,
            jobName: result.jobName,
            productName: mat.productName,
            ticketId: mat.deliveryTicketId,
          });
        }

        if (mat.invoiced && mat.trackedInInventory) {
          const diff = Math.abs(mat.inventoryUnitCost - mat.invoicedUnitPrice);
          const threshold = mat.inventoryUnitCost * 0.05;
          if (diff > threshold && diff > 1) {
            priceMismatches.push({
              jobId: result.jobId,
              jobName: result.jobName,
              productName: mat.productName,
              inventoryPrice: mat.inventoryUnitCost,
              invoicedPrice: mat.invoicedUnitPrice,
              difference: mat.invoicedUnitPrice - mat.inventoryUnitCost,
            });
          }
        }

        if (mat.assignedToDelivery && !mat.deliveryCompleted && mat.deliveryTicketStatus !== 'cancelled') {
          pulledNotDelivered.push({
            jobId: result.jobId,
            jobName: result.jobName,
            productName: mat.productName,
            ticketId: mat.deliveryTicketId,
            ticketStatus: mat.deliveryTicketStatus,
          });
        }
      }
    }

    const totalDiscrepancies =
      materialsNotOnDelivery.length +
      deliveredNotInvoiced.length +
      priceMismatches.length +
      pulledNotDelivered.length;

    return {
      generatedAt: new Date().toISOString(),
      jobs,
      materialsNotOnDelivery,
      deliveredNotInvoiced,
      priceMismatches,
      pulledNotDelivered,
      totalJobs: jobs.length,
      jobsFullyReconciled: jobs.filter(j => j.overallFlag === 'green').length,
      jobsWithWarnings: jobs.filter(j => j.overallFlag === 'yellow').length,
      jobsWithErrors: jobs.filter(j => j.overallFlag === 'red').length,
      totalDiscrepancies,
    };
  }

  // ============================================
  // GOOGLE SHEETS SYNC
  // ============================================

  private getReconciliationHeaders(): string[] {
    return [
      'reconciliationId',
      'generatedAt',
      'jobId',
      'jobName',
      'customerName',
      'breakdownId',
      'overallFlag',
      'greenCount',
      'yellowCount',
      'redCount',
      'warningCount',
      'totalBreakdownCost',
      'totalInvoicedAmount',
      'totalDeliveredValue',
      'materialsJson',
      'warningsJson',
    ];
  }

  async syncToGoogleSheets(): Promise<{ success: boolean; rowsWritten: number; error?: string }> {
    try {
      const report = await this.getReconciliationReport();
      const sheet = await this.getOrCreateSheet(RECONCILIATION_SHEET, this.getReconciliationHeaders());

      // Clear existing rows and write fresh reconciliation data
      const existingRows = await sheet.getRows();
      for (const row of existingRows) {
        await row.delete();
      }

      let rowsWritten = 0;

      for (const job of report.jobs) {
        await sheet.addRow({
          reconciliationId: this.generateId('REC'),
          generatedAt: report.generatedAt,
          jobId: job.jobId,
          jobName: job.jobName,
          customerName: job.customerName,
          breakdownId: job.breakdownId,
          overallFlag: job.overallFlag,
          greenCount: job.greenCount.toString(),
          yellowCount: job.yellowCount.toString(),
          redCount: job.redCount.toString(),
          warningCount: job.warningCount.toString(),
          totalBreakdownCost: job.totalBreakdownCost.toFixed(2),
          totalInvoicedAmount: job.totalInvoicedAmount.toFixed(2),
          totalDeliveredValue: job.totalDeliveredValue.toFixed(2),
          materialsJson: JSON.stringify(job.materials),
          warningsJson: JSON.stringify(job.warnings),
        });
        rowsWritten++;
      }

      return { success: true, rowsWritten };
    } catch (error) {
      console.error('Failed to sync reconciliation to Google Sheets:', error);
      return { success: false, rowsWritten: 0, error: String(error) };
    }
  }

  /**
   * Read the most recent reconciliation data from Google Sheets.
   */
  async getStoredReconciliation(): Promise<JobReconciliation[]> {
    try {
      const sheet = await this.getOrCreateSheet(RECONCILIATION_SHEET, this.getReconciliationHeaders());
      const rows = await sheet.getRows();

      return rows.map(row => {
        let materials: MaterialReconciliationItem[] = [];
        let warnings: string[] = [];
        try {
          materials = JSON.parse(row.get('materialsJson') || '[]');
        } catch {}
        try {
          warnings = JSON.parse(row.get('warningsJson') || '[]');
        } catch {}

        const greenCount = parseInt(row.get('greenCount')) || 0;
        const yellowCount = parseInt(row.get('yellowCount')) || 0;
        const redCount = parseInt(row.get('redCount')) || 0;

        let overallFlag: FlagSeverity = (row.get('overallFlag') as FlagSeverity) || 'green';
        if (!['green', 'yellow', 'red'].includes(overallFlag)) overallFlag = 'green';

        return {
          jobId: row.get('jobId') || '',
          jobName: row.get('jobName') || '',
          customerName: row.get('customerName') || '',
          breakdownId: row.get('breakdownId') || '',
          breakdownStatus: '',
          materials,
          totalBreakdownCost: parseFloat(row.get('totalBreakdownCost')) || 0,
          totalInvoicedAmount: parseFloat(row.get('totalInvoicedAmount')) || 0,
          totalDeliveredValue: parseFloat(row.get('totalDeliveredValue')) || 0,
          overallFlag,
          greenCount,
          yellowCount,
          redCount,
          warningCount: parseInt(row.get('warningCount')) || 0,
          warnings,
          reconciledAt: row.get('generatedAt') || '',
        };
      });
    } catch (error) {
      console.error('Failed to read stored reconciliation:', error);
      return [];
    }
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const inventoryReconciliationService = new InventoryReconciliationService();
