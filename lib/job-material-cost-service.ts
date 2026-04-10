/**
 * Job Material Cost Service (Interoffice Invoice)
 *
 * Owns the `Job_Material_Costs` sheet tab. Every time a delivery ticket is
 * created, this service auto-generates an INTEROFFICE invoice that records
 * how much material cost the job consumed at our purchase price.
 *
 * IMPORTANT — what this is and isn't:
 *   - This is an INTERNAL accounting record. Customer NEVER sees it.
 *   - It is NOT a customer-facing invoice. It is NOT pushed to JobNimbus
 *     as a customer invoice. It is NOT emailed to anyone outside the office.
 *   - It feeds the job_material_cost line in the job breakdown / P&L.
 *   - When materials are returned (credit memo on the ticket side), a
 *     matching credit row is written here so the job's net material cost
 *     reflects what was actually used.
 *
 * Auto-creation flow:
 *   1. PM submits a Material Order via the portal
 *   2. Ticket gets created in the `Tickets` tab
 *   3. THIS service auto-creates a corresponding `Job_Material_Costs` row
 *   4. Sara is notified separately by the live ticket route
 *   5. The breakdown service reads from this tab to populate job material cost
 *
 * Cost visibility: rows in this tab contain unit cost. Read-side filtering
 * via lib/cost-visibility.ts must strip cost fields for any non-office role
 * that calls a route returning this data.
 */

import { googleSheetsService, SHEET_NAMES } from './google-sheets-service';
import crypto from 'crypto';

export type JobMaterialCostType = 'invoice' | 'credit_memo';
export type JobMaterialCostStatus = 'draft' | 'posted' | 'voided';

export interface JobMaterialCostLine {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  lineCost: number;
}

export interface JobMaterialCostRecord {
  invoiceId: string;
  type: JobMaterialCostType;
  status: JobMaterialCostStatus;

  // Back-references — every interoffice invoice ties to exactly one ticket
  // and (when known) one JobNimbus job
  ticketId: string;
  referenceNumber: string;
  jobId: string;
  jobNumber: string;
  jobName: string;

  // Customer info — INTERNAL ONLY, never sent to customer
  customerName: string;
  customerAddress: string;

  // Sales rep responsible for the job (for accounting attribution)
  salesRepName: string;

  // Lines as JSON in the sheet
  lines: JobMaterialCostLine[];
  totalCost: number;

  // Audit
  createdAt: string;
  createdBy: string;
  createdByName: string;
  postedAt: string;
  notes: string;
}

const HEADERS = [
  'invoiceId',
  'type',
  'status',
  'ticketId',
  'referenceNumber',
  'jobId',
  'jobNumber',
  'jobName',
  'customerName',
  'customerAddress',
  'salesRepName',
  'linesJson',
  'totalCost',
  'createdAt',
  'createdBy',
  'createdByName',
  'postedAt',
  'notes',
];

function generateInvoiceId(type: JobMaterialCostType): string {
  const prefix = type === 'credit_memo' ? 'JMC-CM' : 'JMC';
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

function recordToRow(rec: JobMaterialCostRecord): Record<string, unknown> {
  return {
    invoiceId: rec.invoiceId,
    type: rec.type,
    status: rec.status,
    ticketId: rec.ticketId,
    referenceNumber: rec.referenceNumber,
    jobId: rec.jobId,
    jobNumber: rec.jobNumber,
    jobName: rec.jobName,
    customerName: rec.customerName,
    customerAddress: rec.customerAddress,
    salesRepName: rec.salesRepName,
    linesJson: JSON.stringify(rec.lines || []),
    totalCost: rec.totalCost,
    createdAt: rec.createdAt,
    createdBy: rec.createdBy,
    createdByName: rec.createdByName,
    postedAt: rec.postedAt,
    notes: rec.notes,
  };
}

function rowToRecord(row: Record<string, string>): JobMaterialCostRecord {
  let lines: JobMaterialCostLine[] = [];
  try {
    if (row.linesJson) {
      const parsed = JSON.parse(row.linesJson);
      if (Array.isArray(parsed)) lines = parsed;
    }
  } catch {
    lines = [];
  }
  return {
    invoiceId: row.invoiceId,
    type: (row.type || 'invoice') as JobMaterialCostType,
    status: (row.status || 'posted') as JobMaterialCostStatus,
    ticketId: row.ticketId || '',
    referenceNumber: row.referenceNumber || '',
    jobId: row.jobId || '',
    jobNumber: row.jobNumber || '',
    jobName: row.jobName || '',
    customerName: row.customerName || '',
    customerAddress: row.customerAddress || '',
    salesRepName: row.salesRepName || '',
    lines,
    totalCost: parseFloat(row.totalCost) || 0,
    createdAt: row.createdAt || '',
    createdBy: row.createdBy || '',
    createdByName: row.createdByName || '',
    postedAt: row.postedAt || '',
    notes: row.notes || '',
  };
}

class JobMaterialCostService {
  /**
   * Create an interoffice invoice from a delivery ticket. Materials should
   * be the line items as they were sent (cost side). Returns the persisted
   * record. Idempotent — re-running with the same ticketId upserts.
   */
  async createFromDelivery(input: {
    ticketId: string;
    referenceNumber: string;
    jobId?: string;
    jobNumber?: string;
    jobName?: string;
    customerName?: string;
    customerAddress?: string;
    salesRepName?: string;
    lines: JobMaterialCostLine[];
    createdBy?: string;
    createdByName?: string;
    notes?: string;
  }): Promise<JobMaterialCostRecord> {
    const totalCost = input.lines.reduce((sum, l) => sum + (l.lineCost || 0), 0);
    const now = new Date().toISOString();
    const record: JobMaterialCostRecord = {
      invoiceId: generateInvoiceId('invoice'),
      type: 'invoice',
      status: 'posted',
      ticketId: input.ticketId,
      referenceNumber: input.referenceNumber,
      jobId: input.jobId || '',
      jobNumber: input.jobNumber || '',
      jobName: input.jobName || '',
      customerName: input.customerName || '',
      customerAddress: input.customerAddress || '',
      salesRepName: input.salesRepName || '',
      lines: input.lines,
      totalCost: Math.round(totalCost * 100) / 100,
      createdAt: now,
      createdBy: input.createdBy || '',
      createdByName: input.createdByName || '',
      postedAt: now,
      notes: input.notes || `Auto-created interoffice invoice for ticket ${input.ticketId}. Materials issued from warehouse to job.`,
    };

    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.JOB_MATERIAL_COSTS,
      HEADERS,
      'invoiceId',
      recordToRow(record),
    );

    return record;
  }

  /**
   * Create a credit memo from a return ticket. Reduces the job's material
   * cost to reflect materials that came back to the warehouse.
   */
  async createCreditMemoFromReturn(input: {
    ticketId: string;
    referenceNumber: string;
    jobId?: string;
    jobNumber?: string;
    jobName?: string;
    customerName?: string;
    customerAddress?: string;
    salesRepName?: string;
    lines: JobMaterialCostLine[];
    createdBy?: string;
    createdByName?: string;
    notes?: string;
  }): Promise<JobMaterialCostRecord> {
    // Credit memo lines store positive cost values; the `type === 'credit_memo'`
    // discriminator tells the breakdown reader to subtract them when computing
    // net material cost. Storing negatives would conflate display values.
    const totalCost = input.lines.reduce((sum, l) => sum + (l.lineCost || 0), 0);
    const now = new Date().toISOString();
    const record: JobMaterialCostRecord = {
      invoiceId: generateInvoiceId('credit_memo'),
      type: 'credit_memo',
      status: 'posted',
      ticketId: input.ticketId,
      referenceNumber: input.referenceNumber,
      jobId: input.jobId || '',
      jobNumber: input.jobNumber || '',
      jobName: input.jobName || '',
      customerName: input.customerName || '',
      customerAddress: input.customerAddress || '',
      salesRepName: input.salesRepName || '',
      lines: input.lines,
      totalCost: Math.round(totalCost * 100) / 100,
      createdAt: now,
      createdBy: input.createdBy || '',
      createdByName: input.createdByName || '',
      postedAt: now,
      notes: input.notes || `Auto-created credit memo for return ticket ${input.ticketId}. Materials returned to warehouse from job.`,
    };

    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.JOB_MATERIAL_COSTS,
      HEADERS,
      'invoiceId',
      recordToRow(record),
    );

    return record;
  }

  /**
   * Read all interoffice invoices for a given job. Returns invoices and
   * credit memos in chronological order.
   */
  async getByJob(jobId: string): Promise<JobMaterialCostRecord[]> {
    const rows = await googleSheetsService.getGenericRows(SHEET_NAMES.JOB_MATERIAL_COSTS, HEADERS);
    return rows
      .filter(r => r.jobId === jobId)
      .map(rowToRecord)
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  }

  async getByTicket(ticketId: string): Promise<JobMaterialCostRecord[]> {
    const rows = await googleSheetsService.getGenericRows(SHEET_NAMES.JOB_MATERIAL_COSTS, HEADERS);
    return rows
      .filter(r => r.ticketId === ticketId)
      .map(rowToRecord);
  }

  /**
   * Compute net material cost for a job: invoices - credit memos.
   * Used by the breakdown service.
   */
  async getNetMaterialCostForJob(jobId: string): Promise<number> {
    const records = await this.getByJob(jobId);
    let net = 0;
    for (const r of records) {
      if (r.status === 'voided') continue;
      if (r.type === 'invoice') net += r.totalCost;
      else if (r.type === 'credit_memo') net -= r.totalCost;
    }
    return Math.round(net * 100) / 100;
  }
}

export const jobMaterialCostService = new JobMaterialCostService();
export { HEADERS as JOB_MATERIAL_COST_HEADERS };
