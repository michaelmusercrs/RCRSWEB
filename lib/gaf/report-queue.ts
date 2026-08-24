/**
 * Sheet-backed state for the GAF ingest pipeline. Every QuickMeasure report we
 * see becomes one row in the `GAF_Report_Queue` tab, keyed by GAF order number
 * (the natural dedupe key). Every action is appended to `GAF_Ingest_Log`.
 *
 * IMPORTANT: this module uses its OWN fresh google-spreadsheet connection per
 * operation rather than the shared googleSheetsService singleton. The singleton
 * caches `loadInfo`/rowCount on the warm Lambda instance, so a tab created +
 * written mid-invocation reads back as 0 rows on the next read — the classic
 * v5 getRows() stale-read bug (see reference_google_spreadsheet_stale_reads).
 * A fresh doc + loadInfo per call always sees current data. The cron is a
 * background job, so the extra loadInfo latency is fine.
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import type { GoogleSpreadsheetWorksheet } from 'google-spreadsheet';

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
  | 'new' | 'matched' | 'attached' | 'done'
  | 'unmatched' | 'escalated' | 'skipped' | 'error';

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

// ── Fresh connection per call (bypasses the singleton's stale loadInfo) ───────
async function freshDoc(): Promise<GoogleSpreadsheet | null> {
  const id = process.env.GOOGLE_SHEETS_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!id || !email || !key) return null;
  const jwt = new JWT({
    email,
    key: key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(id, jwt);
  await doc.loadInfo();
  return doc;
}

async function tab(doc: GoogleSpreadsheet, name: string, headers: string[]): Promise<GoogleSpreadsheetWorksheet> {
  let sheet = doc.sheetsByTitle[name];
  if (!sheet) {
    sheet = await doc.addSheet({ title: name, headerValues: headers });
  } else {
    try { await sheet.loadHeaderRow(); } catch { await sheet.setHeaderRow(headers); }
  }
  return sheet;
}

function toRecord(get: (k: string) => string): QueueRecord {
  return {
    orderNumber: get('orderNumber'), messageId: get('messageId'), threadId: get('threadId'),
    address: get('address'), repEmail: get('repEmail'), repName: get('repName'),
    repLocalPart: get('repLocalPart'), receivedAt: get('receivedAt'), firstSeenAt: get('firstSeenAt'),
    lastAttemptAt: get('lastAttemptAt'), nextAttemptAt: get('nextAttemptAt'),
    attempts: parseInt(get('attempts') || '0', 10) || 0,
    status: (get('status') as ReportStatus) || 'new',
    jobNumber: get('jobNumber'), jobJnid: get('jobJnid'), contactJnid: get('contactJnid'),
    manualJobNumber: get('manualJobNumber'),
    repNotifiedNoMatch: get('repNotifiedNoMatch') === '1',
    officeEscalated: get('officeEscalated') === '1',
    attachedAt: get('attachedAt'), verifiedAt: get('verifiedAt'), squares: get('squares'),
    lastError: get('lastError'), xmlKeysLogged: get('xmlKeysLogged') === '1',
  };
}

/** Serialize a partial record into sheet cell values (only provided keys). */
function toCells(rec: Partial<QueueRecord> & { orderNumber: string }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (v === undefined) continue;
    if (typeof v === 'boolean') out[k] = v ? '1' : '';
    else out[k] = String(v);
  }
  return out;
}

export async function getAllReports(): Promise<QueueRecord[]> {
  const doc = await freshDoc();
  if (!doc) return [];
  const sheet = await tab(doc, QUEUE_TAB, QUEUE_HEADERS);
  const rows = await sheet.getRows({ limit: 100000 });
  return rows
    .map(r => toRecord((k) => (r.get(k) ?? '') as string))
    .filter(r => r.orderNumber);
}

export async function getReport(orderNumber: string): Promise<QueueRecord | null> {
  return (await getAllReports()).find(r => r.orderNumber === orderNumber) || null;
}

/** Create-or-update a report row by orderNumber (merges provided fields). */
export async function upsertReport(rec: Partial<QueueRecord> & { orderNumber: string }): Promise<void> {
  const doc = await freshDoc();
  if (!doc) return;
  const sheet = await tab(doc, QUEUE_TAB, QUEUE_HEADERS);
  const rows = await sheet.getRows({ limit: 100000 });
  const cells = toCells(rec);
  const existing = rows.find(r => (r.get('orderNumber') ?? '') === rec.orderNumber);
  if (existing) {
    for (const [k, v] of Object.entries(cells)) existing.set(k, v);
    await existing.save();
  } else {
    await sheet.addRow(cells);
  }
}

export async function logIngest(entry: {
  orderNumber: string; address: string; status: string;
  jobNumber?: string; mechanism?: string; detail?: string;
}): Promise<void> {
  try {
    const doc = await freshDoc();
    if (!doc) return;
    const sheet = await tab(doc, LOG_TAB, LOG_HEADERS);
    await sheet.addRow({
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
