/**
 * Vendor Return Service
 *
 * Tracks materials picked up from a job site that came from an OUTSIDE
 * supplier (SRS, ABC Supply, GAF direct, etc.) — materials we did NOT
 * pull from our own inventory and therefore do NOT live in our catalog.
 *
 * Workflow:
 *   1. Rick picks up unused materials from a job
 *   2. He scans / enters the items into the warehouse app's "vendor return"
 *      flow with: which job they came from, which vendor they belong to,
 *      what the items are, qty, original receipt # if known
 *   3. This service writes a row to `Vendor_Returns` and emails Sara so
 *      she can chase the vendor credit and post it to the job breakdown
 *
 * IMPORTANT: vendor returns are NOT in our inventory catalog. They never
 * touch unifiedInventoryService, never increment our currentQty, and never
 * appear on the inventory pricing report. They live in their own world.
 */

import { googleSheetsService, SHEET_NAMES } from './google-sheets-service';
import crypto from 'crypto';

export type VendorReturnStatus = 'submitted' | 'credit_requested' | 'credited' | 'rejected';

export interface VendorReturnLine {
  description: string;
  quantity: number;
  unit?: string;
  estimatedValue?: number;  // Rick's best guess of what the vendor will credit
  notes?: string;
}

export interface VendorReturnRecord {
  vendorReturnId: string;
  status: VendorReturnStatus;

  // Source job (where the materials were picked up)
  jobNumber: string;          // R-XXXXX
  jobName: string;
  customerName: string;
  pickupAddress: string;

  // Vendor (who originally sold them)
  vendorName: string;          // SRS, ABC Supply, GAF Direct, etc.
  vendorReceiptNumber?: string; // original PO/receipt # if Rick knows it
  vendorCreditMemoNumber?: string; // filled in by Sara when she gets the credit

  // What was picked up
  lines: VendorReturnLine[];
  estimatedTotalValue: number; // sum of estimatedValue across lines

  // Audit
  pickedUpBy: string;          // userId
  pickedUpByName: string;
  pickedUpAt: string;          // ISO
  photoUrl?: string;           // proof photo of the picked-up materials

  // Sara's followup
  notes?: string;
  saraNotifiedAt: string;
  creditedAt?: string;
  actualCreditAmount?: number;
}

const HEADERS = [
  'vendorReturnId',
  'status',
  'jobNumber',
  'jobName',
  'customerName',
  'pickupAddress',
  'vendorName',
  'vendorReceiptNumber',
  'vendorCreditMemoNumber',
  'linesJson',
  'estimatedTotalValue',
  'pickedUpBy',
  'pickedUpByName',
  'pickedUpAt',
  'photoUrl',
  'notes',
  'saraNotifiedAt',
  'creditedAt',
  'actualCreditAmount',
];

function generateId(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `VR-${stamp}-${rand}`;
}

function recordToRow(rec: VendorReturnRecord): Record<string, unknown> {
  return {
    vendorReturnId: rec.vendorReturnId,
    status: rec.status,
    jobNumber: rec.jobNumber,
    jobName: rec.jobName,
    customerName: rec.customerName,
    pickupAddress: rec.pickupAddress,
    vendorName: rec.vendorName,
    vendorReceiptNumber: rec.vendorReceiptNumber || '',
    vendorCreditMemoNumber: rec.vendorCreditMemoNumber || '',
    linesJson: JSON.stringify(rec.lines || []),
    estimatedTotalValue: rec.estimatedTotalValue,
    pickedUpBy: rec.pickedUpBy,
    pickedUpByName: rec.pickedUpByName,
    pickedUpAt: rec.pickedUpAt,
    photoUrl: rec.photoUrl || '',
    notes: rec.notes || '',
    saraNotifiedAt: rec.saraNotifiedAt,
    creditedAt: rec.creditedAt || '',
    actualCreditAmount: rec.actualCreditAmount ?? '',
  };
}

function rowToRecord(row: Record<string, string>): VendorReturnRecord {
  let lines: VendorReturnLine[] = [];
  try {
    if (row.linesJson) {
      const parsed = JSON.parse(row.linesJson);
      if (Array.isArray(parsed)) lines = parsed;
    }
  } catch {
    lines = [];
  }
  return {
    vendorReturnId: row.vendorReturnId,
    status: (row.status || 'submitted') as VendorReturnStatus,
    jobNumber: row.jobNumber || '',
    jobName: row.jobName || '',
    customerName: row.customerName || '',
    pickupAddress: row.pickupAddress || '',
    vendorName: row.vendorName || '',
    vendorReceiptNumber: row.vendorReceiptNumber || undefined,
    vendorCreditMemoNumber: row.vendorCreditMemoNumber || undefined,
    lines,
    estimatedTotalValue: parseFloat(row.estimatedTotalValue) || 0,
    pickedUpBy: row.pickedUpBy || '',
    pickedUpByName: row.pickedUpByName || '',
    pickedUpAt: row.pickedUpAt || '',
    photoUrl: row.photoUrl || undefined,
    notes: row.notes || undefined,
    saraNotifiedAt: row.saraNotifiedAt || '',
    creditedAt: row.creditedAt || undefined,
    actualCreditAmount: row.actualCreditAmount ? parseFloat(row.actualCreditAmount) : undefined,
  };
}

class VendorReturnService {
  /**
   * Create a vendor return record. Always idempotent — caller can pass an
   * existing vendorReturnId to update; otherwise a new one is generated.
   */
  async create(input: {
    jobNumber: string;
    jobName?: string;
    customerName?: string;
    pickupAddress?: string;
    vendorName: string;
    vendorReceiptNumber?: string;
    lines: VendorReturnLine[];
    pickedUpBy: string;
    pickedUpByName: string;
    photoUrl?: string;
    notes?: string;
  }): Promise<VendorReturnRecord> {
    const now = new Date().toISOString();
    const estimatedTotalValue = input.lines.reduce(
      (sum, l) => sum + (l.estimatedValue || 0),
      0,
    );

    // Normalize the job number to R-XXXXX
    const digits = input.jobNumber.replace(/^[A-Za-z]-?/, '').replace(/\D/g, '');
    const normalizedJobNumber = digits ? `R-${digits}` : input.jobNumber;

    const record: VendorReturnRecord = {
      vendorReturnId: generateId(),
      status: 'submitted',
      jobNumber: normalizedJobNumber,
      jobName: input.jobName || '',
      customerName: input.customerName || '',
      pickupAddress: input.pickupAddress || '',
      vendorName: input.vendorName,
      vendorReceiptNumber: input.vendorReceiptNumber,
      lines: input.lines,
      estimatedTotalValue: Math.round(estimatedTotalValue * 100) / 100,
      pickedUpBy: input.pickedUpBy,
      pickedUpByName: input.pickedUpByName,
      pickedUpAt: now,
      photoUrl: input.photoUrl,
      notes: input.notes,
      saraNotifiedAt: now,
    };

    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.VENDOR_RETURNS,
      HEADERS,
      'vendorReturnId',
      recordToRow(record),
    );

    return record;
  }

  async getById(vendorReturnId: string): Promise<VendorReturnRecord | null> {
    const rows = await googleSheetsService.getGenericRows(SHEET_NAMES.VENDOR_RETURNS, HEADERS);
    const row = rows.find(r => r.vendorReturnId === vendorReturnId);
    return row ? rowToRecord(row) : null;
  }

  async getByJob(jobNumber: string): Promise<VendorReturnRecord[]> {
    const digits = jobNumber.replace(/^[A-Za-z]-?/, '').replace(/\D/g, '');
    const normalized = digits ? `R-${digits}` : jobNumber;
    const rows = await googleSheetsService.getGenericRows(SHEET_NAMES.VENDOR_RETURNS, HEADERS);
    return rows
      .filter(r => r.jobNumber === normalized)
      .map(rowToRecord)
      .sort((a, b) => (b.pickedUpAt || '').localeCompare(a.pickedUpAt || ''));
  }

  async getRecent(limit: number = 50): Promise<VendorReturnRecord[]> {
    const rows = await googleSheetsService.getGenericRows(SHEET_NAMES.VENDOR_RETURNS, HEADERS);
    return rows
      .map(rowToRecord)
      .sort((a, b) => (b.pickedUpAt || '').localeCompare(a.pickedUpAt || ''))
      .slice(0, limit);
  }

  /**
   * Sara updates a vendor return after she's chased the vendor credit.
   * Sets status, credit memo number, actual credit amount.
   */
  async markCredited(input: {
    vendorReturnId: string;
    vendorCreditMemoNumber: string;
    actualCreditAmount: number;
  }): Promise<boolean> {
    return googleSheetsService.updateGenericRow(
      SHEET_NAMES.VENDOR_RETURNS,
      HEADERS,
      'vendorReturnId',
      input.vendorReturnId,
      {
        status: 'credited',
        vendorCreditMemoNumber: input.vendorCreditMemoNumber,
        actualCreditAmount: input.actualCreditAmount,
        creditedAt: new Date().toISOString(),
      },
    );
  }
}

export const vendorReturnService = new VendorReturnService();
export { HEADERS as VENDOR_RETURN_HEADERS };
