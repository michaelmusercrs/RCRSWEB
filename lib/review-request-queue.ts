/**
 * Review-Request Queue
 *
 * Sheet-backed queue of pending customer review-request emails. The
 * load-verified-aftermath path enqueues a row when materials leave the
 * warehouse; a daily cron (/api/cron/review-request-queue) drains rows
 * whose `sendAfter` timestamp has passed and fires the email via
 * emailService.sendReviewRequest().
 *
 * Why a queue (vs. firing immediately from load-verified):
 *   load_verified is "materials loaded onto Rick's truck", NOT "job
 *   complete". Asking for a Google review while the truck is still
 *   pulling out of the warehouse is a terrible look. The owner gets the
 *   final word on timing — for this pass we record the intent and the
 *   cron handles the actual ask once status flips to 'completed' OR a
 *   waiting period elapses.
 *
 * Storage: a new tab named `Review Request Queue` on the master sheet
 * (same GOOGLE_SHEETS_ID env that email-log.ts uses). The tab is created
 * on first write if it doesn't already exist.
 *
 * Idempotency: enqueueReviewRequest() refuses to add a row if one
 * already exists for the same ticketId. The cron sets status='sent' on
 * success / 'failed' on transport error so a re-run picks up only
 * 'pending' rows whose sendAfter has passed.
 *
 * Gated: nothing in this file fires email by itself — emailService
 * gates 'review-request' behind ENABLE_REVIEW_REQUESTS=true. With the
 * env off, this is just an enqueue log. With the env on, the cron
 * actually sends.
 */

import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

const SHEET_TAB = 'Review Request Queue';
const HEADERS = [
  'queuedAt',
  'ticketId',
  'jobNumber',
  'customerName',
  'customerEmail',
  'projectAddress',
  'projectType',
  'sendAfter',
  'status',
  'lastAttemptAt',
  'lastError',
  'sentAt',
];

export type ReviewRequestQueueStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface ReviewRequestQueueEntry {
  /** ISO timestamp of when the row was enqueued. */
  queuedAt: string;
  ticketId: string;
  jobNumber: string;
  customerName: string;
  customerEmail: string;
  projectAddress: string;
  projectType: string;
  /** ISO timestamp — cron will not fire before this time. */
  sendAfter: string;
  status: ReviewRequestQueueStatus;
  lastAttemptAt?: string;
  lastError?: string;
  sentAt?: string;
}

export interface EnqueueInput {
  ticketId: string;
  jobNumber: string;
  customerName: string;
  customerEmail: string;
  projectAddress: string;
  projectType: string;
  /**
   * ISO timestamp — when the cron should consider this row eligible. Pass
   * a future date to delay (e.g. "fire 3 days after delivery"). Defaults
   * to "now + REVIEW_REQUEST_DELAY_DAYS env (default 3)" if omitted.
   */
  sendAfter?: string;
}

function getSheetsClient(): { doc: GoogleSpreadsheet; ok: boolean; reason?: string } {
  const sheetsId = process.env.GOOGLE_SHEETS_ID;
  const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const svcKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!sheetsId || !svcEmail || !svcKey) {
    return {
      doc: null as unknown as GoogleSpreadsheet,
      ok: false,
      reason: 'Google Sheets credentials not configured',
    };
  }
  const auth = new JWT({
    email: svcEmail,
    key: svcKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(sheetsId, auth);
  return { doc, ok: true };
}

async function getOrCreateTab(doc: GoogleSpreadsheet) {
  await doc.loadInfo();
  let tab = doc.sheetsByTitle[SHEET_TAB];
  if (!tab) {
    tab = await doc.addSheet({
      title: SHEET_TAB,
      headerValues: HEADERS,
    });
  }
  return tab;
}

function defaultSendAfter(): string {
  const days = parseInt(process.env.REVIEW_REQUEST_DELAY_DAYS || '3', 10);
  const ms = Math.max(0, days) * 86_400_000;
  return new Date(Date.now() + ms).toISOString();
}

/**
 * Enqueue a review-request for a customer. Idempotent on ticketId — a
 * second call for the same ticket is a no-op (returns `{ enqueued: false,
 * reason: 'already-queued' }`).
 *
 * Best-effort: never throws. If sheets credentials are missing or the
 * sheet write fails, returns `{ enqueued: false, reason: '...' }` and
 * logs to console. Callers (e.g. load-verified-aftermath) should NOT
 * await-block on this.
 */
export async function enqueueReviewRequest(
  input: EnqueueInput,
): Promise<{ enqueued: boolean; reason?: string }> {
  try {
    // Basic sanity: don't queue without an email or ticketId.
    if (!input.ticketId) return { enqueued: false, reason: 'missing-ticketId' };
    if (!input.customerEmail || !input.customerEmail.includes('@')) {
      return { enqueued: false, reason: 'missing-or-invalid-customerEmail' };
    }

    const client = getSheetsClient();
    if (!client.ok) {
      return { enqueued: false, reason: client.reason };
    }

    const tab = await getOrCreateTab(client.doc);
    const rows = await tab.getRows();

    // Idempotency check — don't double-queue the same ticket.
    const existing = rows.find(r => r.get('ticketId') === input.ticketId);
    if (existing) {
      return { enqueued: false, reason: 'already-queued' };
    }

    const entry: ReviewRequestQueueEntry = {
      queuedAt: new Date().toISOString(),
      ticketId: input.ticketId,
      jobNumber: input.jobNumber,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      projectAddress: input.projectAddress,
      projectType: input.projectType,
      sendAfter: input.sendAfter || defaultSendAfter(),
      status: 'pending',
    };

    await tab.addRow(entry as unknown as Record<string, string>);
    return { enqueued: true };
  } catch (err) {
    // Best-effort — log + return, never throw.
    console.error('[REVIEW QUEUE ENQUEUE FAILED]', {
      ticketId: input.ticketId,
      err: err instanceof Error ? err.message : err,
    });
    return {
      enqueued: false,
      reason: err instanceof Error ? err.message : 'unknown error',
    };
  }
}

/**
 * Read all rows currently 'pending' AND with sendAfter <= now. Used by
 * the cron drain.
 */
export async function getEligibleQueueEntries(
  nowIso: string = new Date().toISOString(),
): Promise<Array<ReviewRequestQueueEntry & { _rowNumber: number }>> {
  const client = getSheetsClient();
  if (!client.ok) return [];

  const tab = await getOrCreateTab(client.doc);
  const rows = await tab.getRows();

  const eligible: Array<ReviewRequestQueueEntry & { _rowNumber: number }> = [];
  for (const row of rows) {
    const status = row.get('status') as ReviewRequestQueueStatus;
    if (status !== 'pending') continue;
    const sendAfter = row.get('sendAfter');
    if (sendAfter && sendAfter > nowIso) continue;
    eligible.push({
      _rowNumber: row.rowNumber,
      queuedAt: row.get('queuedAt') || '',
      ticketId: row.get('ticketId') || '',
      jobNumber: row.get('jobNumber') || '',
      customerName: row.get('customerName') || '',
      customerEmail: row.get('customerEmail') || '',
      projectAddress: row.get('projectAddress') || '',
      projectType: row.get('projectType') || '',
      sendAfter: row.get('sendAfter') || '',
      status,
      lastAttemptAt: row.get('lastAttemptAt') || undefined,
      lastError: row.get('lastError') || undefined,
      sentAt: row.get('sentAt') || undefined,
    });
  }
  return eligible;
}

/**
 * Update the status of a single row by ticketId. Used by the cron drain
 * after attempting a send. Best-effort: returns true on success, false
 * on any failure.
 */
export async function updateQueueEntry(
  ticketId: string,
  patch: {
    status: ReviewRequestQueueStatus;
    lastAttemptAt?: string;
    lastError?: string;
    sentAt?: string;
  },
): Promise<boolean> {
  try {
    const client = getSheetsClient();
    if (!client.ok) return false;

    const tab = await getOrCreateTab(client.doc);
    const rows = await tab.getRows();
    const row = rows.find(r => r.get('ticketId') === ticketId);
    if (!row) return false;

    row.set('status', patch.status);
    if (patch.lastAttemptAt) row.set('lastAttemptAt', patch.lastAttemptAt);
    if (patch.lastError !== undefined) row.set('lastError', patch.lastError);
    if (patch.sentAt) row.set('sentAt', patch.sentAt);
    await row.save();
    return true;
  } catch (err) {
    console.error('[REVIEW QUEUE UPDATE FAILED]', {
      ticketId,
      err: err instanceof Error ? err.message : err,
    });
    return false;
  }
}
