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
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

/**
 * Open the master spreadsheet directly (same pattern as
 * lib/load-verified-aftermath.ts). Used for the Job_Breakdowns credit-memo
 * adjustment — direct row access is safest against the tab's mixed header
 * history (getOrCreateSheet header-fixing is avoided on purpose).
 */
async function openMasterDocForBreakdowns(): Promise<GoogleSpreadsheet | null> {
  const sheetsId =
    process.env.GOOGLE_SHEETS_ID ||
    process.env.DELIVERY_SHEETS_ID ||
    process.env.GOOGLE_SHEET_ID;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  if (!sheetsId || !email || !privateKey) return null;
  const auth = new JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(sheetsId, auth);
  await doc.loadInfo();
  return doc;
}

function moneyNum(v: unknown): number {
  return parseFloat(String(v ?? '').replace(/[$,]/g, '')) || 0;
}

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

function extractJobDigits(jobNumber: string): string {
  const digits = (jobNumber || '').replace(/\D/g, '');
  return digits || '';
}

function legacyInvoiceId(type: JobMaterialCostType): string {
  const prefix = type === 'credit_memo' ? 'JMC-CM' : 'JMC';
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

/**
 * Build a job-scoped invoice ID:
 *   - `CM<digits>-<n>` for credit memos (e.g. CM11071-1, CM11071-2)
 *   - `IN<digits>-<n>` for delivery invoices
 *
 * Sequence `n` is the next available integer across both posted and voided
 * rows for that job. Falls back to the legacy `JMC[-CM]-YYYYMMDD-RAND` format
 * when no job number is provided so historical write paths keep working.
 */
async function generateInvoiceId(
  type: JobMaterialCostType,
  jobNumber?: string,
): Promise<string> {
  const digits = extractJobDigits(jobNumber || '');
  if (!digits) return legacyInvoiceId(type);

  const prefix = type === 'credit_memo' ? `CM${digits}` : `IN${digits}`;
  const re = new RegExp(`^${prefix}-(\\d+)$`);

  let nextN = 1;
  try {
    const rows = await googleSheetsService.getGenericRows(SHEET_NAMES.JOB_MATERIAL_COSTS, HEADERS);
    let maxN = 0;
    for (const r of rows) {
      const m = re.exec(r.invoiceId || '');
      if (m) {
        const n = parseInt(m[1], 10);
        if (Number.isFinite(n) && n > maxN) maxN = n;
      }
    }
    nextN = maxN + 1;
  } catch {
    // If the sheet read fails, fall back to legacy format rather than risk a
    // duplicate. Caller still gets a unique ID.
    return legacyInvoiceId(type);
  }
  return `${prefix}-${nextN}`;
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
    // Idempotency by ticketId: exactly one non-voided interoffice invoice per
    // ticket. A re-delivered material-order email (Apps Script retry / label
    // reset) or a webhook timeout-retry must NOT double-book job material cost.
    // The upsert key is invoiceId (freshly minted), so without this guard every
    // re-run added a second IN…-N row and doubled the job's cost.
    const existingInvoice = (await this.getByTicket(input.ticketId))
      .find(r => r.type === 'invoice' && r.status !== 'voided');
    if (existingInvoice) return existingInvoice;

    const totalCost = input.lines.reduce((sum, l) => sum + (l.lineCost || 0), 0);
    const now = new Date().toISOString();
    const record: JobMaterialCostRecord = {
      invoiceId: await generateInvoiceId('invoice', input.jobNumber),
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
      invoiceId: await generateInvoiceId('credit_memo', input.jobNumber),
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

    // JN sync — post a note on the job summarizing the credit memo so the
    // office can see the credit history without leaving JobNimbus. Never
    // block the credit-memo create if the JN side fails.
    try {
      await postCreditMemoNoteToJN(record);
    } catch (jnErr) {
      console.warn('[job-material-cost] JN credit-memo note sync failed:', jnErr);
    }

    return record;
  }

  /**
   * Apply a credit memo to the job's Job_Breakdowns row: reduce the
   * breakdown's material total (PRICE side — never cost) by the returned
   * amount. Matches the row the same way the load-verified aftermath /
   * auto-finalize cron create them: jobId first, then jobName, then
   * customerName as a last resort.
   *
   * Idempotent per credit-memo id — a `[CM-APPLIED <id>]` marker is stamped
   * into the row's notes and checked before applying, so retries or a
   * double-submitted return can't subtract twice.
   *
   * Best-effort by contract: throws on hard failures; callers wrap in
   * try/catch so the return-ticket response is never blocked.
   */
  async applyCreditMemoToBreakdown(input: {
    creditMemoId: string;
    jobId?: string;
    jobName?: string;
    customerName?: string;
    /** Total PRICE (selling) of the returned lines. NEVER pass cost. */
    creditPrice: number;
  }): Promise<{ applied: boolean; reason?: string; breakdownId?: string }> {
    const creditPrice = Math.round((input.creditPrice || 0) * 100) / 100;
    if (!input.creditMemoId || creditPrice <= 0) {
      return { applied: false, reason: 'nothing to apply (no credit-memo id or zero price)' };
    }

    const doc = await openMasterDocForBreakdowns();
    if (!doc) return { applied: false, reason: 'Google Sheets credentials not configured' };
    const sheet = doc.sheetsByTitle[SHEET_NAMES.JOB_BREAKDOWNS];
    if (!sheet) return { applied: false, reason: 'Job_Breakdowns tab not found' };

    const rows = await sheet.getRows({ limit: 100000 });
    let row = null;
    if (input.jobId) {
      row = rows.find(r => (r.get('jobId') || '') === input.jobId) || null;
    }
    if (!row && input.jobName) {
      row = rows.find(r => (r.get('jobName') || '') === input.jobName) || null;
    }
    if (!row && input.customerName) {
      const want = input.customerName.toLowerCase().trim();
      row = rows.find(r => (r.get('customerName') || '').toLowerCase().trim() === want) || null;
    }
    if (!row) return { applied: false, reason: 'no breakdown row found for job' };

    // Idempotency marker — one application per credit-memo id.
    const marker = `[CM-APPLIED ${input.creditMemoId}]`;
    const notes = row.get('notes') || '';
    if (notes.includes(marker)) {
      return { applied: false, reason: 'already applied (idempotent)', breakdownId: row.get('breakdownId') || '' };
    }

    const materialTotal = moneyNum(row.get('materialTotal'));
    const newMaterialTotal = Math.max(0, Math.round((materialTotal - creditPrice) * 100) / 100);
    // Amount actually subtracted (floored at 0 so a bad qty can't go negative).
    const delta = Math.round((materialTotal - newMaterialTotal) * 100) / 100;

    row.set('materialTotal', newMaterialTotal.toFixed(2));
    const totalEstimate = moneyNum(row.get('totalEstimate'));
    if (totalEstimate > 0) {
      row.set('totalEstimate', Math.max(0, Math.round((totalEstimate - delta) * 100) / 100).toFixed(2));
    }
    row.set('updatedAt', new Date().toISOString());
    row.set(
      'notes',
      `${notes}${notes ? '\n' : ''}${marker} Credit memo reduced material total by $${delta.toFixed(2)} (price side).`,
    );
    await row.save();

    return { applied: true, breakdownId: row.get('breakdownId') || '' };
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

  async getByJobNumber(jobNumber: string): Promise<JobMaterialCostRecord[]> {
    const rows = await googleSheetsService.getGenericRows(SHEET_NAMES.JOB_MATERIAL_COSTS, HEADERS);
    return rows
      .filter(r => r.jobNumber === jobNumber)
      .map(rowToRecord)
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
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

/**
 * Post a JobNimbus note summarizing a credit memo. Looks up the job by its
 * display number (e.g. R-11071) and writes a note tagged `[Credit Memo …]`
 * on it. Stays internal — JN notes aren't customer-visible.
 *
 * Throws on any failure; the caller wraps this in try/catch so the credit
 * memo itself is never blocked by a JN outage.
 */
async function postCreditMemoNoteToJN(record: JobMaterialCostRecord): Promise<void> {
  if (!record.jobNumber) return; // can't look up the JN job without a number
  const { jobNimbusService } = await import('./jobnimbus-service');
  // Internal cost-system path — only the jnid is consumed downstream. Owner-tier viewer.
  const job = await jobNimbusService.getJobByNumber(record.jobNumber, { canSeeCost: true });
  if (!job?.jnid) return;

  // JN's primary contact lives on `job.primary.id`; fall back to the job's
  // own jnid if the relationship isn't populated. createNoteOnJob requires
  // both ids — using jobJnid for both is the safe fallback when there's no
  // primary contact.
  const primaryId =
    (job as { primary?: { id?: string } }).primary?.id || job.jnid;

  // COST RULE: no dollar amounts in the JN note. The Job_Material_Costs
  // ledger rows carry purchase COST, which must never reach JobNimbus —
  // the note lists items + qty + the credit-memo id only.
  const lineCount = record.lines.length;
  const linesPreview = record.lines
    .slice(0, 5)
    .map(l => `  • ${l.quantity}× ${l.productName}`)
    .join('\n');
  const moreLines = lineCount > 5 ? `\n  • …and ${lineCount - 5} more` : '';

  const content =
    `[Credit Memo ${record.invoiceId}]\n` +
    `Materials returned to warehouse from this job.\n` +
    `Ticket: ${record.referenceNumber || record.ticketId}\n` +
    `Items (${lineCount}):\n${linesPreview}${moreLines}\n` +
    (record.createdByName ? `Posted by: ${record.createdByName}\n` : '') +
    (record.notes ? `Notes: ${record.notes}` : '');

  await jobNimbusService.createNoteOnJob(job.jnid, primaryId, content);
}
