/**
 * Spam Block Audit Log
 *
 * Append-only audit log of every request rejected by the public-form
 * defense layers (honeypot, spam-filter, Cloudflare Turnstile, and
 * KV-backed rate-limiter) to the "Spam Log" tab on the master Google
 * Sheet (same GOOGLE_SHEETS_ID env var that form-service.ts uses).
 *
 * Purpose: today every block path calls `console.warn` with tags like
 * `[HONEYPOT TRIGGERED ...]`, `[CONTACT FORM SPAM BLOCKED ...]`, and
 * `[TURNSTILE FAILED ...]` — those lines are buried in Vercel logs
 * with retention limits and have no UI. A sheet-backed log gives the
 * owner a real-time, sortable, filterable view of what got blocked,
 * by which gate, from where — and it survives past Vercel log
 * retention.
 *
 * Same operational visibility argument as `lib/email-log.ts` — and
 * intentionally mirrors that module's lazy-create-tab, fire-and-forget,
 * silent-skip-if-unconfigured pattern.
 *
 * Best-effort by design: callers should fire-and-forget (no await).
 * If the sheet write fails (API down, quota hit), we log to console
 * and continue — a logging failure must NEVER break the gate path
 * (a request that should have been rejected must still be rejected
 * even if we couldn't audit-log it).
 *
 * Metadata only — never pass the full request body. Honeypot value,
 * spam-reason strings, and Turnstile error codes are useful evidence
 * and go in `details` as JSON. Recipient hints (email/name) are
 * captured when the upstream route had a clear submitter so the owner
 * can spot patterns ("same email tried 4 different forms").
 */

export type SpamGate = 'honeypot' | 'spam-filter' | 'turnstile' | 'rate-limit';

export interface SpamLogEntry {
  /**
   * ISO timestamp of the block. Auto-fills `new Date().toISOString()`
   * when absent — most callers should let this default.
   */
  timestamp?: string;
  /** Which defense layer rejected the request. */
  gate: SpamGate;
  /** Route path the request hit, e.g. `/api/forms/contact`. */
  route: string;
  /** Client IP (best-effort). Pull via `getRequestIp(req)`. */
  ip?: string;
  /** Short human description, e.g. `score 87` or `invalid token`. */
  reason: string;
  /**
   * JSON-stringified evidence (honeypot value, spam reasons array,
   * Turnstile error codes, rate-limit window). Optional.
   */
  details?: string;
  /** Submitter hint if the request had a clear `email` field. */
  submitterEmail?: string;
  /** Submitter hint if the request had a clear `name` field. */
  submitterName?: string;
}

const SHEET_TAB = 'Spam Log';
const HEADERS = [
  'timestamp',
  'gate',
  'route',
  'ip',
  'submitterEmail',
  'submitterName',
  'reason',
  'details',
];

/**
 * Extract the client IP from a request. Mirrors `getRequestIp` in
 * `lib/turnstile.ts` but accepts both `Request` and `NextRequest` (any
 * object with a `headers` getter) so call sites can pass whatever they
 * have without an import cycle.
 *
 * Returns `'unknown'` rather than `undefined` so a missing header
 * doesn't collapse into the IP column being blank in the sheet —
 * `'unknown'` is unambiguous when filtering.
 */
export function getRequestIp(req: { headers: Headers }): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Append a single spam-block row to the "Spam Log" tab.
 *
 * Best-effort: never throws. On failure, logs to console.error with the
 * `[SPAM LOG FAILED]` tag and returns. Callers should NOT await this —
 * fire it as `logSpamBlock(entry).catch(() => {})` and continue. The
 * caller's gate logic must run to completion regardless of whether the
 * audit row landed in the sheet.
 */
export async function logSpamBlock(entry: SpamLogEntry): Promise<void> {
  try {
    const { GoogleSpreadsheet } = await import('google-spreadsheet');
    const { JWT } = await import('google-auth-library');

    const sheetsId = process.env.GOOGLE_SHEETS_ID;
    const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const svcKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!sheetsId || !svcEmail || !svcKey) {
      // Sheet logging not configured — silent skip (don't spam logs on
      // every blocked request when the operator hasn't set up sheet
      // credentials).
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
      timestamp: entry.timestamp ?? new Date().toISOString(),
      gate: entry.gate,
      route: entry.route,
      ip: entry.ip ?? '',
      submitterEmail: entry.submitterEmail ?? '',
      submitterName: entry.submitterName ?? '',
      reason: entry.reason,
      details: entry.details ?? '',
    });
  } catch (err) {
    // Logging failure must never break the gate path. Surface to
    // console so operators can diagnose, but do not throw.
    console.error('[SPAM LOG FAILED]', {
      gate: entry.gate,
      route: entry.route,
      reason: entry.reason,
      err: err instanceof Error ? err.message : err,
    });
  }
}
