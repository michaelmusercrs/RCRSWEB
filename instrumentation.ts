/**
 * Next.js instrumentation — runs once per server instance at startup.
 *
 * This wraps globalThis.fetch to do two things for every Google API request:
 *
 * 1. CACHE PATCH (2026-07-02): google-spreadsheet v5's HTTP client (ky) passes
 *    `cache: 'default'` explicitly on every request. Inside GET route handlers,
 *    Next.js's patched fetch treats that as opt-in to the Data Cache, so Google
 *    Sheets reads were CACHED PER DEPLOYMENT — e.g. /api/warehouse/today served
 *    the driver a frozen board. We force `cache: 'no-store'` so reads are live.
 *
 * 2. RATE-LIMIT RETRY (2026-08-05): the entire portal reads/writes one Google
 *    Sheet through a single service account, which Google caps at 60 read
 *    requests/minute/user. Under normal load (14 crons + the warehouse kiosk
 *    refreshing every 30s + every portal page) that ceiling gets hit, and the
 *    Sheets client surfaced the 429 straight up to callers — where board reads
 *    did `.catch(() => [])` (blank board), status writes were swallowed (stuck
 *    tickets), and ticket creates failed. This was THE reason the warehouse app
 *    felt randomly broken: jobs not appearing, not clearing, not creating.
 *
 *    Fix: retry retryable failures here, once, centrally, so every Sheets call
 *    in the app inherits it. Backoff spans a per-minute quota window so the
 *    retry lands in the next bucket.
 *
 *    Safety: 429 means Google rejected the request BEFORE applying it, so it is
 *    always safe to retry (reads and writes alike). 5xx is ambiguous for a
 *    write (it may have applied), so we retry 5xx ONLY for idempotent GETs —
 *    never for POST/PUT/PATCH, to avoid double-appending a row.
 */

const RETRY_MAX_ATTEMPTS = 4;            // total tries = 1 + up to 4 retries
const RETRY_BASE_MS = 500;               // 0.5s, 1s, 2s, 4s (+ jitter)
const RETRY_MAX_SLEEP_MS = 8000;         // cap any single wait
const RETRYABLE_5XX = new Set([500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Parse a Retry-After header (delta-seconds or HTTP-date) into ms, or null. */
function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const when = Date.parse(header);
  if (Number.isFinite(when)) return Math.max(0, when - Date.now());
  return null;
}

function backoffMs(attempt: number): number {
  const base = Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_SLEEP_MS);
  return base + Math.floor(Math.random() * 250); // jitter to de-sync callers
}

export async function register() {
  const originalFetch = globalThis.fetch;
  if ((globalThis as { __sheetsFetchPatched?: boolean }).__sheetsFetchPatched) return;
  (globalThis as { __sheetsFetchPatched?: boolean }).__sheetsFetchPatched = true;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    let url = '';
    let method = 'GET';
    try {
      url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
      method = (
        (input instanceof Request ? input.method : init?.method) || 'GET'
      ).toUpperCase();
    } catch {
      // Fall through to the untouched call on any parsing surprise.
      return originalFetch(input as RequestInfo | URL, init);
    }

    if (!url || !url.includes('googleapis.com')) {
      return originalFetch(input as RequestInfo | URL, init);
    }

    const isGet = method === 'GET' || method === 'HEAD';

    // Force no-store (cache patch) and add rate-limit retry. ky passes a
    // Request object; clone it each attempt so a retried write still has an
    // unconsumed body.
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        if (input instanceof Request) {
          res = await originalFetch(new Request(input.clone(), { cache: 'no-store' }), init);
        } else {
          res = await originalFetch(input, { ...init, cache: 'no-store' });
        }
      } catch (err) {
        // Network/transport error. Retry idempotent GETs; surface writes.
        if (isGet && attempt < RETRY_MAX_ATTEMPTS) {
          await sleep(backoffMs(attempt));
          continue;
        }
        throw err;
      }

      const retryable =
        res.status === 429 || (isGet && RETRYABLE_5XX.has(res.status));
      if (retryable && attempt < RETRY_MAX_ATTEMPTS) {
        const wait = parseRetryAfterMs(res.headers.get('retry-after')) ?? backoffMs(attempt);
        // Drain the body so the connection can be reused before we retry.
        try { await res.arrayBuffer(); } catch { /* ignore */ }
        await sleep(Math.min(wait, RETRY_MAX_SLEEP_MS));
        continue;
      }

      return res;
    }
  }) as typeof fetch;
}
