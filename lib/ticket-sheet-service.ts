/**
 * Ticket Sheet Service
 *
 * Owns the `Tickets` tab in the master Google Sheet. This is the durable home
 * for every delivery / restock / return / adjustment ticket — historical
 * backfill AND every ticket created from the portal going forward.
 *
 * One row = one ticket = one job (grouped by referenceNumber). The materials
 * line items are stored as a JSON-encoded string in the `materialsJson` cell
 * so we don't need a child table.
 *
 * Why a separate file: keeps `lib/google-sheets-service.ts` from growing past
 * 4k lines and gives every ticket caller (UI, backfill, email integration) a
 * single import.
 */

import { googleSheetsService, SHEET_NAMES } from './google-sheets-service';

export type TicketType = 'delivery' | 'pickup' | 'return' | 'restock' | 'adjustment';

export type TicketStatus =
  | 'created'
  | 'assigned'
  | 'materials_pulled'
  | 'load_verified'
  | 'en_route'
  | 'arrived'
  | 'delivered'
  | 'picked_up'
  | 'proof_captured'
  | 'qc_photos'
  | 'completed'
  | 'cancelled';

export interface TicketMaterial {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  totalCost: number;
  totalPrice: number;
}

export interface SheetTicket {
  ticketId: string;
  ticketType: TicketType;
  status: TicketStatus;
  referenceNumber: string;
  createdAt: string;
  completedAt?: string;
  createdBy?: string;
  createdByName?: string;
  assignedTo?: string;
  assignedToName?: string;

  // Job
  jobId?: string;
  jobName?: string;
  jobAddress?: string;
  city?: string;
  state?: string;

  // Customer
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;

  // Materials (JSON string in the sheet, parsed on read)
  materials: TicketMaterial[];
  totalCost: number;
  totalPrice: number;

  notes?: string;
  sourceTransactionId?: string;

  /**
   * Where the materials come from:
   *   - 'stock' (default) = pulled from our warehouse catalog
   *   - 'other_vendor' = bought from outside supplier for this job; does NOT
   *     touch our inventory
   * Optional on read so legacy tickets without the column default to 'stock'.
   */
  orderSource?: 'stock' | 'other_vendor';
  /** Outside vendor name (required when orderSource === 'other_vendor'). */
  supplierName?: string;
}

const TICKET_HEADERS = [
  'ticketId',
  'ticketType',
  'status',
  'referenceNumber',
  'createdAt',
  'completedAt',
  'createdBy',
  'createdByName',
  'assignedTo',
  'assignedToName',
  'jobId',
  'jobName',
  'jobAddress',
  'city',
  'state',
  'customerName',
  'customerPhone',
  'customerEmail',
  'materialsJson',
  'totalCost',
  'totalPrice',
  'notes',
  'sourceTransactionId',
  'orderSource',
  'supplierName',
];

function ticketToRow(ticket: SheetTicket): Record<string, unknown> {
  return {
    ticketId: ticket.ticketId,
    ticketType: ticket.ticketType,
    status: ticket.status,
    referenceNumber: ticket.referenceNumber,
    createdAt: ticket.createdAt,
    completedAt: ticket.completedAt || '',
    createdBy: ticket.createdBy || '',
    createdByName: ticket.createdByName || '',
    assignedTo: ticket.assignedTo || '',
    assignedToName: ticket.assignedToName || '',
    jobId: ticket.jobId || '',
    jobName: ticket.jobName || '',
    jobAddress: ticket.jobAddress || '',
    city: ticket.city || '',
    state: ticket.state || '',
    customerName: ticket.customerName || '',
    customerPhone: ticket.customerPhone || '',
    customerEmail: ticket.customerEmail || '',
    materialsJson: JSON.stringify(ticket.materials || []),
    totalCost: ticket.totalCost,
    totalPrice: ticket.totalPrice,
    notes: ticket.notes || '',
    sourceTransactionId: ticket.sourceTransactionId || '',
    // Only write orderSource when explicitly set so legacy rows re-read as
    // 'stock' via the rowToTicket default.
    orderSource: ticket.orderSource || '',
    supplierName: ticket.supplierName || '',
  };
}

function rowToTicket(row: Record<string, string>): SheetTicket {
  let materials: TicketMaterial[] = [];
  try {
    if (row.materialsJson) {
      const parsed = JSON.parse(row.materialsJson);
      if (Array.isArray(parsed)) materials = parsed;
    }
  } catch {
    materials = [];
  }
  return {
    ticketId: row.ticketId,
    ticketType: (row.ticketType || 'delivery') as TicketType,
    status: (row.status || 'completed') as TicketStatus,
    referenceNumber: row.referenceNumber || '',
    createdAt: row.createdAt || '',
    completedAt: row.completedAt || undefined,
    createdBy: row.createdBy || undefined,
    createdByName: row.createdByName || undefined,
    assignedTo: row.assignedTo || undefined,
    assignedToName: row.assignedToName || undefined,
    jobId: row.jobId || undefined,
    jobName: row.jobName || undefined,
    jobAddress: row.jobAddress || undefined,
    city: row.city || undefined,
    state: row.state || undefined,
    customerName: row.customerName || undefined,
    customerPhone: row.customerPhone || undefined,
    customerEmail: row.customerEmail || undefined,
    materials,
    totalCost: parseFloat(row.totalCost) || 0,
    totalPrice: parseFloat(row.totalPrice) || 0,
    notes: row.notes || undefined,
    sourceTransactionId: row.sourceTransactionId || undefined,
    // Default legacy rows (no column) to 'stock' so they still decrement
    // inventory via the existing pipeline. The field is only non-stock
    // when the portal explicitly wrote 'other_vendor'.
    orderSource: (row.orderSource === 'other_vendor' ? 'other_vendor' : 'stock') as
      | 'stock'
      | 'other_vendor',
    supplierName: row.supplierName || undefined,
  };
}

class TicketSheetService {
  /** Insert or update a ticket by ticketId. Idempotent. */
  async upsert(ticket: SheetTicket): Promise<boolean> {
    return googleSheetsService.upsertGenericRow(
      SHEET_NAMES.TICKETS,
      TICKET_HEADERS,
      'ticketId',
      ticketToRow(ticket),
    );
  }

  /**
   * Bulk upsert. Walks the input list serially because the underlying
   * google-spreadsheet client serializes writes anyway and chunked parallel
   * calls hit the per-minute write quota faster than serial does.
   */
  async upsertMany(tickets: SheetTicket[]): Promise<{ written: number; failed: number }> {
    let written = 0;
    let failed = 0;
    for (const ticket of tickets) {
      const ok = await this.upsert(ticket);
      if (ok) written++;
      else failed++;
    }
    return { written, failed };
  }

  /** Read every ticket from the sheet. */
  async getAll(): Promise<SheetTicket[]> {
    const rows = await googleSheetsService.getGenericRows(SHEET_NAMES.TICKETS, TICKET_HEADERS);
    return rows
      .filter(r => r.ticketId)
      .map(rowToTicket)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  async getById(ticketId: string): Promise<SheetTicket | null> {
    const rows = await googleSheetsService.getGenericRows(SHEET_NAMES.TICKETS, TICKET_HEADERS);
    const row = rows.find(r => r.ticketId === ticketId);
    return row ? rowToTicket(row) : null;
  }

  async getByReferenceNumber(referenceNumber: string): Promise<SheetTicket | null> {
    const rows = await googleSheetsService.getGenericRows(SHEET_NAMES.TICKETS, TICKET_HEADERS);
    const row = rows.find(r => r.referenceNumber === referenceNumber);
    return row ? rowToTicket(row) : null;
  }

  /**
   * Update only the status (and optionally completedAt) of a ticket.
   * Used by the lifecycle handlers (assigned -> en_route -> delivered etc.).
   */
  async updateStatus(
    ticketId: string,
    status: TicketStatus,
    completedAt?: string,
  ): Promise<boolean> {
    return googleSheetsService.updateGenericRow(
      SHEET_NAMES.TICKETS,
      TICKET_HEADERS,
      'ticketId',
      ticketId,
      {
        status,
        ...(completedAt ? { completedAt } : {}),
      },
    );
  }

  /** Patch arbitrary columns on a ticket row. */
  async patch(
    ticketId: string,
    patch: Partial<Record<(typeof TICKET_HEADERS)[number], string>>,
  ): Promise<boolean> {
    return googleSheetsService.updateGenericRow(
      SHEET_NAMES.TICKETS,
      TICKET_HEADERS,
      'ticketId',
      ticketId,
      patch as Record<string, string>,
    );
  }
}

export const ticketSheetService = new TicketSheetService();
export { TICKET_HEADERS };
