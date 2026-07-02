/**
 * Chris View — Master Sheet Cache
 *
 * Each heavy chrisview page (funnel / response-times / close-rates /
 * insurance / lifecycle / lead-sources) runs a JN query that takes
 * 30-120 s on first load. This module persists the computed payload to
 * a `chrisview_cache` tab in the master sheet, written hourly by the
 * precompute cron. Pages then read instantly from the sheet.
 *
 * Tab schema (single tab, one row per page):
 *   page              — slug, e.g. "funnel"
 *   generatedAt       — ISO timestamp of last successful compute
 *   durationMs        — how long the compute took (for monitoring)
 *   payloadJson       — full JSON-stringified payload the page consumes
 *
 * Reads gracefully degrade: if Sheets isn't configured or the row is
 * missing, callers fall through to live computation.
 */

const TAB = 'chrisview_cache';
const HEADERS = ['page', 'generatedAt', 'durationMs', 'payloadJson'] as const;

interface CacheRow<T> {
  generatedAt: string;
  durationMs: number;
  payload: T;
}

async function getSheet() {
  const sheetsId = process.env.GOOGLE_SHEETS_ID;
  const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const svcKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!sheetsId || !svcEmail || !svcKey) return null;

  const { GoogleSpreadsheet } = await import('google-spreadsheet');
  const { JWT } = await import('google-auth-library');

  const auth = new JWT({
    email: svcEmail,
    key: svcKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(sheetsId, auth);
  await doc.loadInfo();

  let sheet = doc.sheetsByTitle[TAB];
  if (!sheet) {
    sheet = await doc.addSheet({ title: TAB, headerValues: [...HEADERS] });
  }
  return sheet;
}

/**
 * Read a cached page payload from the sheet. Returns null on miss or
 * when Sheets isn't configured — caller falls back to live compute.
 */
export async function readChrisviewCache<T>(page: string): Promise<CacheRow<T> | null> {
  try {
    const sheet = await getSheet();
    if (!sheet) return null;
    const rows = await sheet.getRows({ limit: 100000 });
    const match = rows.find(r => String(r.get('page') || '').trim() === page);
    if (!match) return null;
    const payloadJson = String(match.get('payloadJson') || '');
    if (!payloadJson) return null;
    return {
      generatedAt: String(match.get('generatedAt') || ''),
      durationMs: Number(match.get('durationMs') || 0),
      payload: JSON.parse(payloadJson) as T,
    };
  } catch (err) {
    console.warn('[chrisview-sheet-cache] read failed:', err);
    return null;
  }
}

/**
 * Write or update the cache row for a page. Called by the hourly
 * precompute cron after each lib finishes its live compute.
 */
export async function writeChrisviewCache<T>(
  page: string,
  payload: T,
  durationMs: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const sheet = await getSheet();
    if (!sheet) return { success: false, error: 'sheets not configured' };
    const rows = await sheet.getRows({ limit: 100000 });
    const generatedAt = new Date().toISOString();
    const payloadJson = JSON.stringify(payload);
    const existing = rows.find(r => String(r.get('page') || '').trim() === page);
    if (existing) {
      existing.set('generatedAt', generatedAt);
      existing.set('durationMs', durationMs);
      existing.set('payloadJson', payloadJson);
      await existing.save();
    } else {
      await sheet.addRow({ page, generatedAt, durationMs, payloadJson });
    }
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[chrisview-sheet-cache] write failed:', error);
    return { success: false, error };
  }
}

/**
 * Convenience wrapper: try cache first, fall back to compute, then
 * write the freshly-computed payload back to the cache opportunistically.
 * Use the `maxAgeMs` to reject stale rows; pass Infinity to accept any
 * row the cron has written.
 */
export async function withChrisviewCache<T>(
  page: string,
  compute: () => Promise<T>,
  maxAgeMs: number = 90 * 60 * 1000, // 90 min — survives one missed cron tick
): Promise<{ payload: T; fromCache: boolean; generatedAt: string }> {
  const cached = await readChrisviewCache<T>(page);
  if (cached) {
    const age = Date.now() - new Date(cached.generatedAt).getTime();
    if (Number.isFinite(age) && age < maxAgeMs) {
      return { payload: cached.payload, fromCache: true, generatedAt: cached.generatedAt };
    }
  }
  const start = Date.now();
  const payload = await compute();
  const durationMs = Date.now() - start;
  // Fire-and-forget the cache write so callers don't pay for it.
  writeChrisviewCache(page, payload, durationMs).catch(err =>
    console.warn('[chrisview-sheet-cache] background write failed:', err),
  );
  return { payload, fromCache: false, generatedAt: new Date().toISOString() };
}
