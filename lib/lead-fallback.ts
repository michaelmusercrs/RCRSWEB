/**
 * Lead Fallback — last-mile safety net for public lead-capture endpoints.
 *
 * Owner directive (2026-05-21): "set it up where it has a fallback and a
 * system that checks to make sure no leads fall through." When the primary
 * Google Sheets write fails for any reason (auth, quota, network, missing
 * env), the original form payload MUST be persisted somewhere recoverable
 * so the lead doesn't silently disappear. We write it to Vercel Blob
 * storage under `leads-fallback/{date}/...` and a companion reconciliation
 * cron (`/api/cron/reconcile-leads`) sweeps those blobs hourly, replays
 * the sheet write, and moves recovered entries to `leads-recovered/...`.
 *
 * Critical constraints (CALLERS MUST NOT BREAK):
 *  - This helper NEVER throws. The caller is already in an error path —
 *    a second exception here would mask the original failure AND surface a
 *    500 to the customer. On any failure (missing token, blob put threw,
 *    JSON serialize threw) we log to console with the `[LEAD FALLBACK
 *    FAILED]` prefix and return `{success: false}`.
 *  - Caller must invoke this AFTER the primary sheet write fails — the
 *    happy path never touches blob storage. If the primary succeeds, the
 *    customer gets the normal success response and no fallback row exists.
 *  - Payload is the ORIGINAL validated form body. We do not redact PII
 *    here; the blob is admin-gated (admin viewer page + cron-only replay)
 *    and lead capture inherently contains contact info.
 *
 * Blob path layout:
 *   leads-fallback/{YYYY-MM-DD}/{source}-{timestamp}-{rand}.json
 *
 * Blob contents (FallbackBlobShape below):
 *   { source, payload, reason, originalError, capturedAt, recoveredAt: null }
 *
 * The reconciliation cron flips `recoveredAt` to ISO timestamp on success
 * (or moves the blob to `leads-recovered/{date}/...` — either is idempotent
 * because the cron filters by `recoveredAt === null`).
 */

export interface PersistLeadFallbackOpts {
  /** Short slug identifying the originating route. Used to build the blob key + dispatch the replay. */
  source: string;
  /** The original (already-validated) form body. */
  payload: Record<string, unknown>;
  /** Why we're falling back — e.g. 'sheets-write-failed', 'sheets-not-configured'. */
  reason: string;
  /** Stringified original error (if any). Optional, for forensics. */
  originalError?: string;
}

export interface PersistLeadFallbackResult {
  blobKey: string;
  success: boolean;
}

/**
 * Shape persisted to blob storage. Mirrors PersistLeadFallbackOpts but adds
 * timestamps. The reconcile cron reads this shape and flips `recoveredAt`
 * (or moves the blob to `leads-recovered/...`).
 */
export interface FallbackBlobShape {
  source: string;
  payload: Record<string, unknown>;
  reason: string;
  originalError?: string;
  /** ISO timestamp the fallback was captured. */
  capturedAt: string;
  /** ISO timestamp the reconcile cron successfully replayed the write — null until recovered. */
  recoveredAt: string | null;
}

/**
 * Format YYYY-MM-DD in UTC. Using UTC avoids ambiguity around midnight
 * deploys / timezone shifts when the cron lists blobs by date prefix.
 */
function todayPathUtc(d: Date = new Date()): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Persist a lead-capture payload to Vercel Blob storage as a recovery
 * fallback when the primary sheet write fails. Never throws.
 *
 * @returns `{success: true, blobKey}` if the blob was written;
 *          `{success: false, blobKey}` if anything went wrong (token
 *          missing, put threw, serialize threw). The blobKey is returned
 *          either way so logs/heartbeats can reference the intended path.
 */
export async function persistLeadFallback(
  opts: PersistLeadFallbackOpts,
): Promise<PersistLeadFallbackResult> {
  // Build the intended blob key first so we can return it even on failure.
  // Random suffix uses base36 of a 48-bit random — enough entropy to avoid
  // collisions across concurrent submissions on the same source/timestamp
  // without pulling in `crypto.randomUUID` (which adds an `import` cost
  // for what is hot-path error handling).
  const datePath = todayPathUtc();
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 0xffffffffffff).toString(36);
  const sanitizedSource = String(opts.source || 'unknown').replace(/[^a-z0-9-]+/gi, '-');
  const blobKey = `leads-fallback/${datePath}/${sanitizedSource}-${ts}-${rand}.json`;

  // Fail-safe: if the token is missing we can't do anything useful. Log
  // and return rather than throw — caller is already in a degraded path
  // and a second exception would 500 the customer.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error(
      '[LEAD FALLBACK FAILED] BLOB_READ_WRITE_TOKEN not set; cannot persist',
      { source: opts.source, reason: opts.reason },
    );
    return { blobKey, success: false };
  }

  const body: FallbackBlobShape = {
    source: opts.source,
    payload: opts.payload,
    reason: opts.reason,
    originalError: opts.originalError,
    capturedAt: new Date(ts).toISOString(),
    recoveredAt: null,
  };

  try {
    const { put } = await import('@vercel/blob');
    // `access: 'public'` matches the rest of the codebase's blob writes
    // (lib/trip/store.ts, monday-notes upload, etc). The URL is
    // unguessable (random suffix + timestamp) and the *viewer* surface is
    // admin-gated; no need for the private-access flow here.
    // addRandomSuffix=false because the key already encodes a random
    // suffix — let it serve as the canonical recovery path.
    await put(blobKey, JSON.stringify(body, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    console.warn('[LEAD FALLBACK SAVED]', {
      source: opts.source,
      reason: opts.reason,
      blobKey,
    });
    return { blobKey, success: true };
  } catch (err) {
    console.error('[LEAD FALLBACK FAILED]', {
      source: opts.source,
      reason: opts.reason,
      blobKey,
      error: err instanceof Error ? err.message : String(err),
    });
    return { blobKey, success: false };
  }
}
