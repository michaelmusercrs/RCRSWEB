/**
 * Storm Report Share — Magic-Link Tokens
 *
 * Issues and verifies tokenized share links for storm-damage reports so a
 * customer (and the assigned sales rep) can revisit the rendered report
 * at a public URL without logging in. Pattern mirrors the CompanyCam-style
 * "share with customer" link — the token IS the credential.
 *
 * Design choices:
 *   - 24-char base62 tokens generated via `crypto.randomBytes(18)` then
 *     mapped into the base62 alphabet. 18 random bytes = 144 bits of
 *     entropy, well over the ~80 bits needed to defeat brute-force at
 *     web scale. We truncate to 24 chars so the URL stays compact.
 *   - Sheet-backed storage in the master Google Sheet on a new
 *     `Storm Report Shares` tab. Same lazy-create-tab pattern as
 *     `lib/email-log.ts`, `lib/spam-log.ts`, `lib/review-request-queue.ts`.
 *   - 90-day default expiry. Old shares stay readable until they hit
 *     `expiresAt`; we never delete rows so the access log survives.
 *   - Public reads should bump `accessCount` + `lastAccessedAt` (best-
 *     effort). A logging failure must NEVER block rendering.
 *   - No new env vars — reuses GOOGLE_SHEETS_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL
 *     / GOOGLE_PRIVATE_KEY that the rest of the sheet-backed services use.
 */

import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Token format
// ---------------------------------------------------------------------------

/**
 * Base62 alphabet (URL-safe, no ambiguous characters need stripping at the
 * page boundary). 62 symbols means each character carries log2(62) ≈ 5.95
 * bits, so 24 chars ≈ 143 bits of entropy.
 */
const BASE62_ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Public regex callers can use to gate token-shaped inputs before any
 * sheet lookup — prevents arbitrary input from triggering Google Sheets
 * API calls. */
export const STORM_SHARE_TOKEN_REGEX = /^[A-Za-z0-9]{24}$/;

const TOKEN_LENGTH = 24;
const DEFAULT_TTL_DAYS = 90;
const SHEET_TAB = 'Storm Report Shares';

const HEADERS = [
  'token',
  'reportId',
  'customerEmail',
  'customerName',
  'address',
  'assignedRepSlug',
  'createdAt',
  'expiresAt',
  'accessCount',
  'lastAccessedAt',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StormShareRecord {
  token: string;
  reportId: string;
  customerEmail: string;
  customerName: string;
  address: string;
  assignedRepSlug: string;
  createdAt: string;
  expiresAt: string;
  accessCount: number;
  lastAccessedAt: string;
}

export interface CreateShareInput {
  reportId: string;
  customerEmail: string;
  customerName: string;
  address: string;
  assignedRepSlug?: string;
  /** Optional override of the default 90-day expiry. */
  ttlDays?: number;
}

export type VerifyResult =
  | { ok: true; record: StormShareRecord }
  | { ok: false; reason: 'invalid_format' | 'not_found' | 'expired' };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Cryptographically random base62 token of `length` characters.
 *
 * Implementation: pull random bytes from `crypto.randomBytes` and rejection-
 * sample into the base62 alphabet. Rejection sampling is the textbook way
 * to avoid the bias you'd otherwise get from `byte % 62` (the high three
 * indices would be drawn ~25% less often).
 *
 * Throws if Node's CSPRNG is unavailable (i.e. never, in practice).
 */
function generateBase62Token(length: number): string {
  const out: string[] = [];
  // Bytes above this threshold get rejected to keep the distribution flat.
  // 256 % 62 = 8, so values 0..247 (248 of 256) are usable; reject 248..255.
  const REJECT_AT = 248;
  while (out.length < length) {
    // Pull a generous batch so we usually don't need a second round.
    const batch = crypto.randomBytes(length * 2);
    for (let i = 0; i < batch.length && out.length < length; i++) {
      const b = batch[i];
      if (b >= REJECT_AT) continue;
      out.push(BASE62_ALPHABET[b % 62]);
    }
  }
  return out.join('');
}

async function getSheet() {
  const { GoogleSpreadsheet } = await import('google-spreadsheet');
  const { JWT } = await import('google-auth-library');

  const sheetsId = process.env.GOOGLE_SHEETS_ID;
  const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const svcKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!sheetsId || !svcEmail || !svcKey) {
    throw new Error('Google Sheets credentials not configured');
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
    sheet = await doc.addSheet({ title: SHEET_TAB, headerValues: HEADERS });
  } else {
    // Defensive: if a partially-initialized tab exists with no header row,
    // restore it. Same defense as `lead-portal-service.ts`.
    try {
      await sheet.loadHeaderRow();
    } catch {
      await sheet.setHeaderRow(HEADERS);
    }
  }
  return sheet;
}

function rowToRecord(row: { get(key: string): string }): StormShareRecord {
  return {
    token: row.get('token') || '',
    reportId: row.get('reportId') || '',
    customerEmail: row.get('customerEmail') || '',
    customerName: row.get('customerName') || '',
    address: row.get('address') || '',
    assignedRepSlug: row.get('assignedRepSlug') || '',
    createdAt: row.get('createdAt') || '',
    expiresAt: row.get('expiresAt') || '',
    accessCount: parseInt(row.get('accessCount') || '0', 10) || 0,
    lastAccessedAt: row.get('lastAccessedAt') || '',
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Mint a new share token for the given storm report. Persists the
 * customer-identifying metadata alongside so the share page can render
 * without re-fetching the full report row when convenient. The full
 * report data still lives in `storm-report-service` and is looked up by
 * `reportId` at render time — this row is the access-control record.
 *
 * Returns the persisted record (token + expiresAt + zeroed counters).
 *
 * NOTE: This call writes to the master sheet, so callers should treat it
 * as the slow path (handful of hundred ms). Fire-and-await; do NOT use
 * it on hot user paths without consideration.
 */
export async function createShareToken(
  input: CreateShareInput
): Promise<StormShareRecord> {
  if (!input.reportId) {
    throw new Error('createShareToken: reportId is required');
  }

  const sheet = await getSheet();

  const now = new Date();
  const ttlDays = input.ttlDays ?? DEFAULT_TTL_DAYS;
  const expires = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

  // Vanishingly small collision odds at 143 bits, but be paranoid: retry
  // up to a few times if the generated token happens to collide.
  let token = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    token = generateBase62Token(TOKEN_LENGTH);
    const existing = await sheet
      .getRows()
      .then(rows => rows.find(r => r.get('token') === token));
    if (!existing) break;
    token = '';
  }
  if (!token) {
    throw new Error('createShareToken: failed to mint a unique token');
  }

  const record: StormShareRecord = {
    token,
    reportId: input.reportId,
    customerEmail: input.customerEmail || '',
    customerName: input.customerName || '',
    address: input.address || '',
    assignedRepSlug: input.assignedRepSlug || '',
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    accessCount: 0,
    lastAccessedAt: '',
  };

  await sheet.addRow({
    token: record.token,
    reportId: record.reportId,
    customerEmail: record.customerEmail,
    customerName: record.customerName,
    address: record.address,
    assignedRepSlug: record.assignedRepSlug,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    accessCount: '0',
    lastAccessedAt: '',
  });

  return record;
}

/**
 * Verify a share token and return the associated record. Token format
 * is validated BEFORE any sheet lookup so malformed input can never
 * trigger an API call.
 *
 * Outcomes (discriminated by `ok`):
 *   - { ok: true, record }                     — token is live, render away
 *   - { ok: false, reason: 'invalid_format' }  — didn't match the regex
 *   - { ok: false, reason: 'not_found' }       — no row for that token
 *   - { ok: false, reason: 'expired' }         — row exists but past expiresAt
 *
 * Does NOT bump access counters — callers that want to track usage
 * should call `recordShareAccess` separately (best-effort, fire-and-forget).
 */
export async function verifyShareToken(
  token: string
): Promise<VerifyResult> {
  if (!token || !STORM_SHARE_TOKEN_REGEX.test(token)) {
    return { ok: false, reason: 'invalid_format' };
  }

  const sheet = await getSheet();
  const rows = await sheet.getRows();
  const row = rows.find(r => r.get('token') === token);
  if (!row) return { ok: false, reason: 'not_found' };

  const record = rowToRecord(row);

  // Expiry check: tolerate a missing/malformed expiresAt rather than
  // crashing (treat as not-expired in that case — the row was written by
  // our own code so a missing date is recoverable).
  if (record.expiresAt) {
    const expiresMs = Date.parse(record.expiresAt);
    if (!Number.isNaN(expiresMs) && expiresMs < Date.now()) {
      return { ok: false, reason: 'expired' };
    }
  }

  return { ok: true, record };
}

/**
 * Bump `accessCount` and `lastAccessedAt` for the given token. Best-
 * effort: any error is swallowed so a sheet hiccup never breaks the
 * customer-facing page. Callers should fire-and-forget.
 */
export async function recordShareAccess(token: string): Promise<void> {
  try {
    if (!STORM_SHARE_TOKEN_REGEX.test(token)) return;
    const sheet = await getSheet();
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('token') === token);
    if (!row) return;
    const current = parseInt(row.get('accessCount') || '0', 10) || 0;
    row.set('accessCount', String(current + 1));
    row.set('lastAccessedAt', new Date().toISOString());
    await row.save();
  } catch (err) {
    console.error('[storm-report-share] recordShareAccess failed', {
      err: err instanceof Error ? err.message : err,
    });
  }
}

/**
 * Build the canonical absolute share URL for a token. Centralized so the
 * emailer, the rep regenerate endpoint, and any future SMS path all
 * agree on the format. Relies on `NEXT_PUBLIC_SITE_URL` and falls back
 * to the production public site.
 */
export function buildShareUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://www.rivercityroofingsolutions.com';
  return `${base.replace(/\/$/, '')}/share/storm-report/${token}`;
}
