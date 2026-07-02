/**
 * Next.js instrumentation — runs once per server instance at startup.
 *
 * CRITICAL fetch patch (2026-07-02): google-spreadsheet v5's HTTP client
 * (ky) passes `cache: 'default'` explicitly on every request. Inside GET
 * route handlers, Next.js's patched fetch treats that as opt-in to the
 * Data Cache, so Google Sheets reads were CACHED PER DEPLOYMENT — e.g.
 * /api/warehouse/today served the driver a frozen board from whenever the
 * deployment first answered, while POST routes (always no-store) read
 * fresh. This wrapper forces `cache: 'no-store'` for all googleapis.com
 * requests so sheet reads are always live.
 */
export async function register() {
  const originalFetch = globalThis.fetch;
  if ((globalThis as { __sheetsFetchPatched?: boolean }).__sheetsFetchPatched) return;
  (globalThis as { __sheetsFetchPatched?: boolean }).__sheetsFetchPatched = true;

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
      if (url && url.includes('googleapis.com')) {
        if (input instanceof Request) {
          // ky passes a Request object; rebuild with no-store so Next's
          // Data Cache never captures Sheets reads.
          return originalFetch(new Request(input, { cache: 'no-store' }), init);
        }
        return originalFetch(input, { ...init, cache: 'no-store' });
      }
    } catch {
      // Fall through to the untouched call on any parsing surprise.
    }
    return originalFetch(input as RequestInfo | URL, init);
  }) as typeof fetch;
}
