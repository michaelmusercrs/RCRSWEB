/**
 * Sheet-backed state for the GAF ingest pipeline. Every QuickMeasure report we
 * see becomes one row in the `GAF_Report_Queue` tab, keyed by GAF order number
 * (the natural dedupe key — GAF re-sends the same order # on reopen/resend).
 * Every action (attach, no-match, escalate, verify, error) is appended to
 * `GAF_Ingest_Log`.
 *
 * All values are stored as strings (Sheets); helpers (de)serialize.
 */

import { googleSheetsService } from '../google-sheets-service';

export const QUEUE_TAB = 'GAF_Report_Queue';
export const LOG_TAB = 'GAF_Ingest_Log';

export const QUEUE_HEADERS = [
  'orderNumber', 'messageId', 'threadId', 'address',
  'repEmail', 'repName', 'repLocalPart',
  'receivedAt', 'firstSeenAt', 'lastAttemptAt', 'nextAttemptAt', 'attempts',
  'status', 'jobNumber', 'jobJnid', 'contactJnid', 'manualJobNumber',
  'repNotifiedNoMatch', 'officeEscalated', 'attachedAt', 'verifiedAt',
  'squares', 'lastError', 'xmlKeysLogged',
];

export const LOG_HEADERS = [
  'timestamp', 'orderNumber', 'address', 'status', 'jobNumber', 'mechanism', 'detail',
];

export type ReportStatus =
  | 'new'        // just discovered, not yet processed
  | 'matched'    // job found, attach pending
  | 'attached'   // PDF + summary on job; verify pending
  | 'done'       // verified present on job — terminal success
  | 'unmatched'  // no job yet, still retrying (rep notified)
  | 'escalated'  // retries exhausted, office notified, still open
  | 'skipped'    // not a real report / no reps / no attachment
  | 'error';     // hard error (kept for retry)

export interface QueueRecord {
  orderNumber: string;
  messageId: string;
  threadId: string;
  address: string;
  repEmail: string;
  repName: string;
  repLocalPart: string;
  receivedAt: string;
  firstSeenAt: string;
  lastAttemptAt: string;
  nextAttemptAt: string;
  attempts: number;
  status: ReportStatus;
  jobNumber: string;
  jobJnid: string;
  contactJnid: string;
  manualJobNumber: string;
  repNotifiedNoMatch: boolean;
  officeEscalated: boolean;
  attachedAt: string;
  verifiedAt: string;
  squares: string;
  lastError: string;
  xmlKeysLogged: boolean;
}

function toRecord(row: Record<string, string>): QueueRecord {
  return {
    orderNumber: row.orderNumber || '',
    messageId: row.messageId || '',
    threadId: row.threadId || '',
    address: row.address || '',
    repEmail: row.repEmail || '',
    repName: row.repName || '',
    repLocalPart: row.repLocalPart || '',
    receivedAt: row.receivedAt || '',
    firstSeenAt: row.firstSeenAt || '',
    lastAttemptAt: row.lastAttemptAt || '',
    nextAttemptAt: row.nextAttemptAt || '',
    attempts: parseInt(row.attempts || '0', 10) || 0,
    status: (row.status as ReportStatus) || 'new',
    jobNumber: row.jobNumber || '',
    jobJnid: row.jobJnid || '',
    contactJnid: row.contactJnid || '',
    manualJobNumber: row.manualJobNumber || '',
    repNotifiedNoMatch: row.repNotifiedNoMatch === '1',
    officeEscalated: row.officeEscalated === '1',
    attachedAt: row.attachedAt || '',
    verifiedAt: row.verifiedAt || '',
    squares: row.squares || '',
    lastError: row.lastError || '',
    xmlKeysLogged: row.xmlKeysLogged === '1',
  };
}

function toRow(rec: Partial<QueueRecord> & { orderNumber: string }): Record<string, unknown> {
  const r: Record<string, unknown> = { ...rec };
  if (typeof rec.attempts === 'number') r.attempts = String(rec.attempts);
  if (typeof rec.repNotifiedNoMatch === 'boolean') r.repNotifiedNoMatch = rec.repNotifiedNoMatch ? '1' : '';
  if (typeof rec.officeEscalated === 'boolean') r.officeEscalated = rec.officeEscalated ? '1' : '';
  if (typeof rec.xmlKeysLogged === 'boolean') r.xmlKeysLogged = rec.xmlKeysLogged ? '1' : '';
  return r;
}

export async function getAllReports(): Promise<QueueRecord[]> {
  const rows = await googleSheetsService.getGenericRows(QUEUE_TAB, QUEUE_HEADERS);
  return rows.filter(r => r.orderNumber).map(toRecord);
}

export async function getReport(orderNumber: string): Promise<QueueRecord | null> {
  const all = await getAllReports();
  return all.find(r => r.orderNumber === orderNumber) || null;
}

/** Create-or-update a report row by orderNumber. Merges into existing row. */
export async function upsertReport(rec: Partial<QueueRecord> & { orderNumber: string }): Promise<void> {
  await googleSheetsService.upsertGenericRow(QUEUE_TAB, QUEUE_HEADERS, 'orderNumber', toRow(rec));
}

export async function logIngest(entry: {
  orderNumber: string;
  address: string;
  status: string;
  jobNumber?: string;
  mechanism?: string;
  detail?: string;
}): Promise<void> {
  try {
    await googleSheetsService.appendGenericRow(LOG_TAB, LOG_HEADERS, {
      timestamp: new Date().toISOString(),
      orderNumber: entry.orderNumber,
      address: entry.address,
      status: entry.status,
      jobNumber: entry.jobNumber || '',
      mechanism: entry.mechanism || '',
      detail: (entry.detail || '').slice(0, 480),
    });
  } catch (err) {
    console.error('[gaf] logIngest failed:', err);
  }
}
