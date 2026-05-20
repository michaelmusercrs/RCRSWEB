/**
 * Email Send Log
 *
 * Append-only audit log of every email send attempt (sent + every dropped
 * status) to the "Email Log" tab on the master Google Sheet (same
 * GOOGLE_SHEETS_ID env var that form-service.ts uses).
 *
 * Purpose: console.warn / console.error lines in email-service.ts are
 * buried in Vercel logs with retention limits. A sheet-backed log gives
 * the owner a real-time, sortable, filterable, shareable view of what
 * fired vs. what dropped, when, and to whom — and it survives past
 * Vercel log retention.
 *
 * Best-effort by design: callers should fire-and-forget (no await).
 * If the sheet write fails (API down, quota hit), we log to console
 * and continue — a logging failure must NEVER break the email path.
 *
 * Metadata only — do not pass payload body, attachment content, or
 * honeypot fields. The recipient list is already metadata
 * (to/cc/bcc are required to know who got blocked / who got served).
 */

import type { EmailTemplate } from './email-service';

export type EmailLogStatus =
  | 'sent'
  | 'dropped_template_not_allowed'
  | 'dropped_kill_switch'
  | 'dropped_transport_not_configured'
  | 'dropped_rate_limit'
  | 'send_failed';

export interface EmailLogEntry {
  template?: EmailTemplate | string;
  to?: string;
  cc?: string;
  bcc?: string;
  from?: string;
  subject?: string;
  status: EmailLogStatus;
  error?: string;
  /** Optional caller hint (e.g. 'load-verified-aftermath' or 'contact-form'). */
  source?: string;
}

const SHEET_TAB = 'Email Log';
const HEADERS = [
  'timestamp',
  'template',
  'to',
  'cc',
  'bcc',
  'from',
  'subject',
  'status',
  'error',
  'source',
];

/**
 * Append a single email-send-attempt row to the "Email Log" tab.
 *
 * Best-effort: never throws. On failure, logs to console.error with the
 * `[EMAIL LOG FAILED]` tag and returns. Callers should NOT await this —
 * fire it as `logEmailAttempt(entry).catch(() => {})` and continue.
 */
export async function logEmailAttempt(entry: EmailLogEntry): Promise<void> {
  try {
    const { GoogleSpreadsheet } = await import('google-spreadsheet');
    const { JWT } = await import('google-auth-library');

    const sheetsId = process.env.GOOGLE_SHEETS_ID;
    const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const svcKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!sheetsId || !svcEmail || !svcKey) {
      // Sheet logging not configured — silent skip (don't spam logs on
      // every send when the operator hasn't set up sheet credentials).
      return;
    }

    const auth = new JWT({
      email: svcEmail,
      key: svcKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(sheetsId, auth);
    await doc.loadInfo();

    let sheet = doc.sheetsByTitle[SHEET_TAB];
    if (!sheet) {
      sheet = await doc.addSheet({
        title: SHEET_TAB,
        headerValues: HEADERS,
      });
    }

    await sheet.addRow({
      timestamp: new Date().toISOString(),
      template: entry.template ?? '',
      to: entry.to ?? '',
      cc: entry.cc ?? '',
      bcc: entry.bcc ?? '',
      from: entry.from ?? '',
      subject: entry.subject ?? '',
      status: entry.status,
      error: entry.error ?? '',
      source: entry.source ?? '',
    });
  } catch (err) {
    // Logging failure must never break the email path. Surface to
    // console so operators can diagnose, but do not throw.
    console.error('[EMAIL LOG FAILED]', {
      status: entry.status,
      template: entry.template,
      subject: entry.subject,
      err: err instanceof Error ? err.message : err,
    });
  }
}
