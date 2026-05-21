/**
 * Cron in-flight lock — prevents concurrent execution of the same cron
 * handler when a manual run + scheduled run collide, or when a long-
 * running handler is still working past the next scheduled slot.
 *
 * Sheet-backed (uses existing SystemHealth tab or lazy-creates one).
 * NOT a strong lock — best-effort coordination only; do not rely on
 * for financial / mutating ops that REQUIRE single execution.
 *
 * Usage:
 *   import { withCronLock } from '@/lib/cron-lock';
 *   return withCronLock('marketing-intel', { staleMinutes: 30 }, async () => {
 *     // ... cron work ...
 *     return NextResponse.json({ success: true });
 *   });
 *
 * Behavior:
 * - Reads SystemHealth tab for a row named `cron-lock:{cronName}`.
 * - If row exists AND status='running' AND updated within `staleMinutes`,
 *   return early with 423 Locked + the existing lock's start time.
 * - Otherwise writes the row with status='running' + now() and runs the
 *   handler.
 * - On handler completion (success or error), updates the row to
 *   status='done' (or 'errored' with error string) and lastRunDurationMs.
 *
 * Best-effort caveats:
 * - Sheet eventual consistency: a race between two read+write attempts
 *   can still slip through (rare but possible).
 * - If the handler crashes hard (Lambda killed), the row stays at
 *   'running' until staleMinutes elapses; subsequent runs auto-recover.
 */

import { NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

interface LockOptions {
  /** How many minutes a 'running' row must be older than before treated as stale. */
  staleMinutes?: number;
  /** Sheet tab name. Defaults to 'SystemHealth'. */
  sheetTab?: string;
}

interface LockState {
  cronName: string;
  status: 'running' | 'done' | 'errored';
  lastRunAt: string;
  lastRunDurationMs: number;
  lastStatus: string;
  lastError: string;
}

async function getSheet(opts?: LockOptions) {
  const id = process.env.GOOGLE_SHEETS_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!id || !email || !key) return null;

  const auth = new JWT({
    email,
    key: key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(id, auth);
  await doc.loadInfo();

  const tabName = opts?.sheetTab || 'SystemHealth';
  let sheet = doc.sheetsByTitle[tabName];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: tabName,
      headerValues: ['key', 'status', 'lastRunAt', 'lastRunDurationMs', 'lastStatus', 'lastError'],
    });
  } else {
    await sheet.loadHeaderRow();
  }
  return sheet;
}

export async function withCronLock<T>(
  cronName: string,
  options: LockOptions,
  handler: () => Promise<T>,
): Promise<T | NextResponse> {
  const sheet = await getSheet(options);

  // If sheets unavailable, fall through (best-effort means we run anyway).
  if (!sheet) {
    console.warn('[CRON LOCK] sheet unavailable; running without lock for', cronName);
    return handler();
  }

  const key = `cron-lock:${cronName}`;
  const staleMs = (options.staleMinutes || 15) * 60 * 1000;
  const now = Date.now();
  const startedAt = new Date(now).toISOString();

  const rows = await sheet.getRows();
  const existing = rows.find((r) => r.get('key') === key);

  if (existing) {
    const existingStatus = existing.get('status');
    const lastRunAt = existing.get('lastRunAt');
    const ageMs = lastRunAt ? now - Date.parse(lastRunAt) : Infinity;

    if (existingStatus === 'running' && ageMs < staleMs) {
      console.warn('[CRON LOCK] already running, skipping', { cronName, ageMs, lastRunAt });
      return NextResponse.json(
        {
          success: false,
          skipped: true,
          reason: 'cron already running',
          lockedSince: lastRunAt,
        },
        { status: 423 },
      );
    }
  }

  // Claim the lock
  if (existing) {
    existing.set('status', 'running');
    existing.set('lastRunAt', startedAt);
    existing.set('lastRunDurationMs', '');
    existing.set('lastStatus', '');
    existing.set('lastError', '');
    try { await existing.save(); } catch (e) { console.error('[CRON LOCK] lock claim failed:', e); }
  } else {
    try {
      await sheet.addRow({
        key,
        status: 'running',
        lastRunAt: startedAt,
        lastRunDurationMs: '',
        lastStatus: '',
        lastError: '',
      });
    } catch (e) { console.error('[CRON LOCK] lock claim failed:', e); }
  }

  // Run + record outcome
  let result: T;
  let errorMsg = '';
  try {
    result = await handler();
    const duration = Date.now() - now;
    await updateLockRow(sheet, key, 'done', startedAt, duration, 'success', '');
    return result;
  } catch (err) {
    const duration = Date.now() - now;
    errorMsg = err instanceof Error ? err.message : String(err);
    await updateLockRow(sheet, key, 'errored', startedAt, duration, 'error', errorMsg.slice(0, 250));
    throw err;
  }
}

async function updateLockRow(
  sheet: Awaited<ReturnType<typeof getSheet>>,
  key: string,
  status: string,
  lastRunAt: string,
  durationMs: number,
  lastStatus: string,
  lastError: string,
): Promise<void> {
  if (!sheet) return;
  try {
    const rows = await sheet.getRows();
    const row = rows.find((r) => r.get('key') === key);
    if (!row) return;
    row.set('status', status);
    row.set('lastRunAt', lastRunAt);
    row.set('lastRunDurationMs', String(durationMs));
    row.set('lastStatus', lastStatus);
    row.set('lastError', lastError);
    await row.save();
  } catch (err) {
    console.error('[CRON LOCK] release failed:', err);
  }
}

/** Read-only helper for the /admin/system/health dashboard. */
export async function getCronLockStates(): Promise<LockState[]> {
  const sheet = await getSheet();
  if (!sheet) return [];
  const rows = await sheet.getRows();
  return rows
    .filter((r) => (r.get('key') || '').startsWith('cron-lock:'))
    .map((r) => ({
      cronName: (r.get('key') || '').replace(/^cron-lock:/, ''),
      status: (r.get('status') as LockState['status']) || 'done',
      lastRunAt: r.get('lastRunAt') || '',
      lastRunDurationMs: parseInt(r.get('lastRunDurationMs') || '0', 10),
      lastStatus: r.get('lastStatus') || '',
      lastError: r.get('lastError') || '',
    }));
}
