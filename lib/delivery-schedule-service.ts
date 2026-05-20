/**
 * Delivery Schedule Service
 *
 * Lazy-creates and writes to the "Delivery Schedule" sheet tab — the single
 * canonical schedule grid the owner asked for ("delivery scheduling becomes
 * automatic when submitting a material order to stock@rcrsal.com").
 *
 * Shape (one row per material order / ticket):
 *   ticketId       — Delivery Tickets / pipeline order ID
 *   jobNumber      — R-XXXXX
 *   customerName
 *   address        — single-line full address
 *   scheduledDate  — ISO date string (YYYY-MM-DD). Blank until office schedules.
 *   status         — pending | loaded | delivered | returned | cancelled
 *   driverSlug     — assigned driver slug (e.g. "tae", "rick"). Blank until assigned.
 *   createdAt      — ISO timestamp
 *   updatedAt      — ISO timestamp
 *   notes          — free-text
 *
 * Reads/writes are best-effort. If Sheets is not configured, every call is a
 * no-op that resolves cleanly. The schedule is *informational* — the source
 * of truth for stock movement is still the Tickets / PipelineOrders sheets.
 */

import { GoogleSpreadsheet, GoogleSpreadsheetRow, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const SHEETS_ID = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')?.replace(/\r\n/g, '\n');
const serviceAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const SHEETS_CONFIGURED = !!(SHEETS_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && privateKey);

const TAB_NAME = 'Delivery Schedule';

const HEADERS = [
  'ticketId',
  'jobNumber',
  'customerName',
  'address',
  'scheduledDate',
  'status',
  'driverSlug',
  'createdAt',
  'updatedAt',
  'notes',
] as const;

export type DeliveryScheduleStatus =
  | 'pending'
  | 'loaded'
  | 'delivered'
  | 'returned'
  | 'cancelled';

export interface DeliveryScheduleEntry {
  ticketId: string;
  jobNumber: string;
  customerName: string;
  address: string;
  scheduledDate?: string;
  status: DeliveryScheduleStatus;
  driverSlug?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

async function getOrCreateScheduleSheet(): Promise<GoogleSpreadsheetWorksheet | null> {
  if (!SHEETS_CONFIGURED) return null;
  try {
    const doc = new GoogleSpreadsheet(SHEETS_ID!, serviceAuth);
    await doc.loadInfo();
    let sheet = doc.sheetsByTitle[TAB_NAME];
    if (!sheet) {
      sheet = await doc.addSheet({ title: TAB_NAME, headerValues: [...HEADERS] });
    } else {
      // Make sure column count is big enough then ensure headers
      if (sheet.columnCount < HEADERS.length) {
        await sheet.resize({ rowCount: sheet.rowCount, columnCount: HEADERS.length });
      }
      await sheet.loadHeaderRow().catch(() => undefined);
      if (!sheet.headerValues || sheet.headerValues.length === 0) {
        await sheet.setHeaderRow([...HEADERS]);
      }
    }
    return sheet;
  } catch (err) {
    console.warn('[delivery-schedule] getOrCreateScheduleSheet failed:', err);
    return null;
  }
}

/**
 * Upsert a delivery schedule entry keyed by ticketId. Best-effort. Returns
 * true on success, false if sheets weren't configured or the write failed.
 */
export async function upsertDeliveryScheduleEntry(
  entry: Omit<DeliveryScheduleEntry, 'createdAt' | 'updatedAt'> & {
    createdAt?: string;
    updatedAt?: string;
  },
): Promise<boolean> {
  const sheet = await getOrCreateScheduleSheet();
  if (!sheet) return false;
  const now = new Date().toISOString();
  try {
    const rows = await sheet.getRows();
    const existing = rows.find(
      (r: GoogleSpreadsheetRow) => String(r.get('ticketId') || '') === entry.ticketId,
    );
    const data: Record<string, string> = {
      ticketId: entry.ticketId,
      jobNumber: entry.jobNumber || '',
      customerName: entry.customerName || '',
      address: entry.address || '',
      scheduledDate: entry.scheduledDate || '',
      status: entry.status || 'pending',
      driverSlug: entry.driverSlug || '',
      createdAt: entry.createdAt || existing?.get('createdAt') || now,
      updatedAt: entry.updatedAt || now,
      notes: entry.notes || '',
    };
    if (existing) {
      for (const [k, v] of Object.entries(data)) existing.set(k, v);
      await existing.save();
    } else {
      await sheet.addRow(data);
    }
    return true;
  } catch (err) {
    console.warn('[delivery-schedule] upsert failed:', err);
    return false;
  }
}

/**
 * Update just the status (and optionally driverSlug / scheduledDate) for an
 * existing schedule entry. Best-effort.
 */
export async function updateDeliveryScheduleStatus(
  ticketId: string,
  status: DeliveryScheduleStatus,
  extras?: { driverSlug?: string; scheduledDate?: string; notes?: string },
): Promise<boolean> {
  const sheet = await getOrCreateScheduleSheet();
  if (!sheet) return false;
  try {
    const rows = await sheet.getRows();
    const existing = rows.find(
      (r: GoogleSpreadsheetRow) => String(r.get('ticketId') || '') === ticketId,
    );
    if (!existing) return false;
    existing.set('status', status);
    if (extras?.driverSlug !== undefined) existing.set('driverSlug', extras.driverSlug);
    if (extras?.scheduledDate !== undefined) existing.set('scheduledDate', extras.scheduledDate);
    if (extras?.notes !== undefined) existing.set('notes', extras.notes);
    existing.set('updatedAt', new Date().toISOString());
    await existing.save();
    return true;
  } catch (err) {
    console.warn('[delivery-schedule] updateStatus failed:', err);
    return false;
  }
}

/**
 * Read the schedule for a given filter. Best-effort.
 */
export async function listDeliverySchedule(filter?: {
  status?: DeliveryScheduleStatus | DeliveryScheduleStatus[];
  driverSlug?: string;
  scheduledDate?: string;
  limit?: number;
}): Promise<DeliveryScheduleEntry[]> {
  const sheet = await getOrCreateScheduleSheet();
  if (!sheet) return [];
  try {
    const rows = await sheet.getRows();
    let entries: DeliveryScheduleEntry[] = rows.map((r: GoogleSpreadsheetRow) => ({
      ticketId: String(r.get('ticketId') || ''),
      jobNumber: String(r.get('jobNumber') || ''),
      customerName: String(r.get('customerName') || ''),
      address: String(r.get('address') || ''),
      scheduledDate: String(r.get('scheduledDate') || '') || undefined,
      status: (String(r.get('status') || 'pending') as DeliveryScheduleStatus),
      driverSlug: String(r.get('driverSlug') || '') || undefined,
      createdAt: String(r.get('createdAt') || ''),
      updatedAt: String(r.get('updatedAt') || ''),
      notes: String(r.get('notes') || '') || undefined,
    }));
    if (filter?.status) {
      const arr = Array.isArray(filter.status) ? filter.status : [filter.status];
      entries = entries.filter((e) => arr.includes(e.status));
    }
    if (filter?.driverSlug) {
      entries = entries.filter((e) => e.driverSlug === filter.driverSlug);
    }
    if (filter?.scheduledDate) {
      entries = entries.filter((e) => e.scheduledDate === filter.scheduledDate);
    }
    entries.sort((a, b) => {
      // Pending / undated first, then by scheduledDate ascending
      const da = a.scheduledDate || '9999-99-99';
      const db = b.scheduledDate || '9999-99-99';
      return da.localeCompare(db);
    });
    if (filter?.limit) entries = entries.slice(0, filter.limit);
    return entries;
  } catch (err) {
    console.warn('[delivery-schedule] list failed:', err);
    return [];
  }
}
