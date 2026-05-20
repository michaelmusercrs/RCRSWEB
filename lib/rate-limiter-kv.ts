/**
 * KV-Backed Rate Limiter for API Endpoints
 * =========================================
 *
 * Drop-in replacement for `lib/rate-limiter.ts` that uses Vercel KV
 * (Upstash Redis under the hood) for SHARED state across serverless
 * function instances. Solves the "cold-start bypass" gap in the
 * in-memory limiter where each new Lambda instance starts with an
 * empty counter — that's how the bot-spam flood ever got through.
 *
 * This is part of Phase 2.6 in AGENDA.md / Phase 2 of
 * docs/form-hardening-plan.md.
 *
 * REQUIRED ENV VARS (set automatically by `vercel link` once Vercel
 * KV is provisioned on the project):
 *   - KV_REST_API_URL                — REST endpoint for the KV store
 *   - KV_REST_API_TOKEN              — read/write token
 *   - KV_REST_API_READ_ONLY_TOKEN    — read-only token (not used here,
 *                                      but Vercel sets it automatically)
 *
 * FALLBACK BEHAVIOR:
 * If KV_REST_API_URL is unset (e.g. local dev with no KV provisioned),
 * this module silently delegates to the in-memory limiter from
 * `./rate-limiter`. This keeps `npm run dev` working without any extra
 * setup. The fallback is logged once at module-init time so it's
 * visible in Vercel logs if it kicks in unexpectedly in production.
 *
 * PUBLIC INTERFACE (matches `lib/rate-limiter.ts` so callers can swap
 * the import path with no other code changes):
 *   - RATE_LIMIT_CONFIGS               (re-exported)
 *   - RateLimiter (class)              (re-implemented, KV-backed)
 *   - createAuthRateLimiter()
 *   - createApiRateLimiter()
 *   - createAdminRateLimiter()
 *   - createPublicRateLimiter()
 *   - createFormRateLimiter()
 *   - createCustomerTokenRateLimiter()
 *   - withRateLimit(request, limiter, handler)
 *
 * NEW EXPORTS specific to this module:
 *   - createContactFormRateLimiter()      — 3/hr, contact form
 *   - createReferralFormRateLimiter()     — 3/hr, referral form
 *   - createCareersFormRateLimiter()      — 3/hr, careers form
 *   - createBniPartnerFormRateLimiter()   — 3/hr, BNI partner form
 *   - createStormReportRateLimiter()      — 10/hr, storm report
 *   - createGlobalFormRateLimiter()       — 15/hr global per-IP cap
 *
 * TODO npm install @vercel/kv
 * (The owner will install. Until then, the `import type` line below
 * will fail typecheck — that failure is expected and documented in
 * the phase 2.6 ticket.)
 */

// TODO npm install @vercel/kv — uses type-only import so the runtime
// `import { kv } from '@vercel/kv'` is gated behind the env-var check.
import type { kv as KvClient } from '@vercel/kv';

import { NextResponse } from 'next/server';
import {
  RateLimiter as InMemoryRateLimiter,
  RATE_LIMIT_CONFIGS as IN_MEMORY_CONFIGS,
  type RateLimitConfig,
  type RateLimitResult,
} from './rate-limiter';

// Re-export types so consumers can import from one place.
export type { RateLimitConfig, RateLimitResult };

// ============================================
// DEFAULT CONFIGURATIONS
// ============================================
// Merges the existing in-memory configs with the per-form thresholds
// from docs/form-hardening-plan.md §4 (the table that drove this work).

export const RATE_LIMIT_CONFIGS = {
  ...IN_MEMORY_CONFIGS,

  // Per-form thresholds from form-hardening-plan.md §4.
  // Window is 1 hour for all of these — real customers fill a form
  // once. 3/hr covers re-tries and typos without bothering anyone.
  contactForm: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
    message:
      'Too many contact form submissions from your network. Please wait an hour before trying again.',
  },
  referralForm: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
    message:
      'Too many referral submissions from your network. Please wait an hour before trying again.',
  },
  careersForm: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
    message:
      'Too many application submissions from your network. Please wait an hour before trying again.',
  },
  bniPartnerForm: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
    message:
      'Too many BNI partner submissions from your network. Please wait an hour before trying again.',
  },
  stormReport: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 10,
    message: 'Too many storm-report lookups. Please wait before trying again.',
  },

  // Public storm-report SHARE view (magic-link landing page). Customers
  // re-open the link a handful of times after the storm visit; reps may
  // share the same URL across multiple roof appointments in a day. 60/hr
  // covers normal usage with headroom. Higher than the per-form caps
  // because this is a READ surface, not a write surface — but still
  // bounded so a token-guessing attacker can't grind through the
  // ~143-bit token space (would still take ~2^137 hours).
  stormReportShareView: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 60,
    message: 'Too many requests. Please wait a minute and try again.',
  },

  // Cross-form per-IP global cap. A single IP hitting 15 form
  // submissions of ANY kind in an hour is almost certainly a bot
  // operator probing — trip the alarm.
  globalForm: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 15,
    message: 'Too many submissions from your network. Please try again later.',
  },
} as const;

// ============================================
// KV CLIENT LOADING (lazy + fail-safe)
// ============================================

type KvLike = typeof KvClient;

let kvClient: KvLike | null = null;
let kvProbed = false;
let kvAvailable = false;

function isKvConfigured(): boolean {
  // Vercel sets KV_REST_API_URL automatically when the KV integration
  // is attached to the project. Its absence is the canonical signal
  // that we should fall back to in-memory.
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

/**
 * Lazily resolve the `@vercel/kv` client. Returns null if either:
 *   - the package isn't installed, or
 *   - the KV env vars aren't set.
 *
 * Probe state is cached for the lifetime of the warm instance, so the
 * dynamic import only runs once.
 */
async function getKvClient(): Promise<KvLike | null> {
  if (kvProbed) return kvAvailable ? kvClient : null;
  kvProbed = true;

  if (!isKvConfigured()) {
    // Expected in local dev; only log once.
    console.info(
      '[rate-limiter-kv] KV env vars missing; falling back to in-memory limiter.'
    );
    kvAvailable = false;
    return null;
  }

  try {
    // Dynamic import so a missing `@vercel/kv` package doesn't crash
    // the module at load time. The `import type` at the top of the
    // file is erased at compile time and never touches node_modules.
    const mod = (await import('@vercel/kv')) as { kv: KvLike };
    kvClient = mod.kv;
    kvAvailable = true;
    return kvClient;
  } catch (err) {
    console.warn(
      '[rate-limiter-kv] @vercel/kv import failed; falling back to in-memory limiter.',
      err
    );
    kvAvailable = false;
    return null;
  }
}

// ============================================
// KEY GENERATION
// ============================================

function defaultIpFromRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  // Last resort: weakly fingerprint by UA + accept-language so we
  // don't lump every "unknown" client into a single bucket.
  const ua = request.headers.get('user-agent') ?? '';
  const lang = request.headers.get('accept-language') ?? '';
  if (ua || lang) return `ua:${hashShort(ua + '|' + lang)}`;
  return 'unknown-ip';
}

function hashShort(input: string): string {
  // Tiny non-cryptographic hash (FNV-1a 32-bit). Good enough for a
  // bucketing fallback; we don't need collision resistance.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

// ============================================
// KV-BACKED RATE LIMITER
// ============================================

/**
 * Extra options accepted by the KV-backed RateLimiter that aren't on
 * the legacy `RateLimitConfig`. Optional so the constructor remains
 * source-compatible with `lib/rate-limiter.ts`.
 */
export interface KvRateLimiterOptions {
  /**
   * If true, the URL pathname is OMITTED from the KV key so the same
   * counter spans every endpoint. Used by the cross-form global cap
   * that needs to aggregate hits across /api/forms/contact,
   * /api/forms/referral, /api/storm-report, etc. into a single
   * per-IP bucket.
   */
  collapsePath?: boolean;
}

export class RateLimiter {
  private config: Required<RateLimitConfig>;
  private prefix: string;
  private collapsePath: boolean;
  // Lazily-constructed in-memory fallback. We share a single instance
  // per RateLimiter so the fallback path behaves identically to the
  // old code (per-warm-instance counters with the same config).
  private fallback: InMemoryRateLimiter;

  constructor(
    config: RateLimitConfig,
    prefix: string = 'rl',
    options: KvRateLimiterOptions = {}
  ) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      message: config.message ?? 'Too many requests',
      skipFailedRequests: config.skipFailedRequests ?? false,
      keyGenerator: config.keyGenerator ?? defaultIpFromRequest,
    };
    this.prefix = prefix;
    this.collapsePath = options.collapsePath ?? false;
    this.fallback = new InMemoryRateLimiter(config, prefix);
  }

  /**
   * Compute the KV key for this request.
   * Format: `rl:<prefix>:<path>:<ip>:<windowStart>`
   *   (or `rl:<prefix>:*:<ip>:<windowStart>` when collapsePath=true)
   * The windowStart segment makes this a sliding-window-in-buckets
   * counter — bucket per (windowMs) interval, auto-expires at the
   * end of the bucket. Simpler and cheaper than a true sliding
   * window (one INCR + one EXPIRE per request).
   */
  private getKvKey(request: Request): { key: string; windowStartMs: number } {
    const identifier = this.config.keyGenerator(request);
    // SECURITY: include path, NOT method — prevents method-switching
    // bypass attacks (matches the in-memory limiter's behavior).
    // collapsePath disables the path segment so cross-endpoint
    // global caps work correctly.
    const pathSegment = this.collapsePath
      ? '*'
      : new URL(request.url).pathname;
    const windowMs = this.config.windowMs;
    const windowStartMs = Math.floor(Date.now() / windowMs) * windowMs;
    const key = `rl:${this.prefix}:${pathSegment}:${identifier}:${windowStartMs}`;
    return { key, windowStartMs };
  }

  /**
   * Check + record atomically against KV. Returns the result of
   * checking BEFORE this request — i.e. allowed=true means this
   * request is within budget; allowed=false means it would exceed
   * the limit. The increment is performed unconditionally because
   * we want over-budget attempts to keep the counter ratcheted up
   * (mirrors the in-memory behavior).
   *
   * Throws if the KV call fails; caller catches and falls back.
   */
  private async checkAndRecordKv(
    kvc: KvLike,
    request: Request
  ): Promise<RateLimitResult> {
    const { key, windowStartMs } = this.getKvKey(request);
    const windowMs = this.config.windowMs;
    const windowSec = Math.ceil(windowMs / 1000);
    const resetAt = windowStartMs + windowMs;

    // INCR is atomic; first hit returns 1.
    const count = (await kvc.incr(key)) as number;
    if (count === 1) {
      // Only set TTL on the first hit of this window so we don't keep
      // pushing expiry out. expire() returns 1 if it was set.
      await kvc.expire(key, windowSec);
    }

    const remaining = Math.max(0, this.config.maxRequests - count);
    const allowed = count <= this.config.maxRequests;

    if (!allowed) {
      const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
      return { allowed: false, remaining: 0, resetAt, retryAfter };
    }
    return { allowed: true, remaining, resetAt };
  }

  /**
   * Check whether the request is allowed.
   *
   * NOTE: Unlike the in-memory `RateLimiter.check()`, the KV-backed
   * check ALSO records the request (atomic INCR). This matches the
   * Upstash/Redis idiom — there's no cheap "peek" against a counter.
   * The companion `record()` method becomes a no-op for the KV path
   * to preserve the public interface.
   */
  async check(request: Request): Promise<RateLimitResult> {
    const kvc = await getKvClient();
    if (!kvc) {
      // Fallback: in-memory check + record (matches old call order
      // inside withRateLimit).
      const result = this.fallback.check(request);
      if (result.allowed) this.fallback.record(request);
      return result;
    }
    try {
      return await this.checkAndRecordKv(kvc, request);
    } catch (err) {
      console.warn(
        '[rate-limiter-kv] KV check failed; degrading to in-memory for this request.',
        err
      );
      const result = this.fallback.check(request);
      if (result.allowed) this.fallback.record(request);
      return result;
    }
  }

  /**
   * Record a request. No-op for the KV path (already recorded by
   * `check()`); delegates to the in-memory limiter on the fallback
   * path so the fallback semantics match the legacy module.
   *
   * Kept for interface compatibility with `lib/rate-limiter.ts` —
   * existing call sites in `withRateLimit` go check() then record(),
   * and we don't want to require those call sites to change.
   */
  async record(request: Request): Promise<void> {
    const kvc = await getKvClient();
    if (!kvc) {
      // Already recorded inside check() for the fallback path. Calling
      // record() again would double-count, so we intentionally skip.
      return;
    }
    // KV path: already recorded inside check(). No-op.
    void request;
  }

  /**
   * Reset the counter for the given request. Best-effort — KV errors
   * are swallowed because reset is usually called from
   * administrative paths where a stale counter is acceptable.
   */
  async reset(request: Request): Promise<void> {
    const kvc = await getKvClient();
    if (!kvc) {
      this.fallback.reset(request);
      return;
    }
    try {
      const { key } = this.getKvKey(request);
      await kvc.del(key);
    } catch (err) {
      console.warn('[rate-limiter-kv] KV reset failed; ignoring.', err);
    }
  }

  /** Build standard X-RateLimit-* response headers. */
  getHeaders(result: RateLimitResult): Record<string, string> {
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': this.config.maxRequests.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
    };
    if (result.retryAfter) {
      headers['Retry-After'] = result.retryAfter.toString();
    }
    return headers;
  }

  getMessage(): string {
    return this.config.message;
  }
}

// ============================================
// FACTORY FUNCTIONS
// ============================================
// Mirror the names from `lib/rate-limiter.ts` so a caller can switch
// imports with a single line edit.

export function createAuthRateLimiter(): RateLimiter {
  return new RateLimiter(RATE_LIMIT_CONFIGS.auth, 'auth');
}

export function createApiRateLimiter(): RateLimiter {
  return new RateLimiter(RATE_LIMIT_CONFIGS.api, 'api');
}

export function createAdminRateLimiter(): RateLimiter {
  return new RateLimiter(RATE_LIMIT_CONFIGS.admin, 'admin');
}

export function createPublicRateLimiter(): RateLimiter {
  return new RateLimiter(RATE_LIMIT_CONFIGS.public, 'public');
}

/**
 * Generic form rate limiter — kept for backward compatibility with
 * the existing in-memory module. Uses the legacy `form` config
 * (5/5min). Prefer the per-form factories below for new code.
 */
export function createFormRateLimiter(): RateLimiter {
  return new RateLimiter(RATE_LIMIT_CONFIGS.form, 'form');
}

export function createCustomerTokenRateLimiter(): RateLimiter {
  return new RateLimiter(RATE_LIMIT_CONFIGS.customerToken, 'customer-token');
}

// Per-form factories implementing the docs/form-hardening-plan.md §4
// thresholds. Owner will swap individual routes onto these as part of
// Phase 2.6 rollout.
export function createContactFormRateLimiter(): RateLimiter {
  return new RateLimiter(RATE_LIMIT_CONFIGS.contactForm, 'form-contact');
}
export function createReferralFormRateLimiter(): RateLimiter {
  return new RateLimiter(RATE_LIMIT_CONFIGS.referralForm, 'form-referral');
}
export function createCareersFormRateLimiter(): RateLimiter {
  return new RateLimiter(RATE_LIMIT_CONFIGS.careersForm, 'form-careers');
}
export function createBniPartnerFormRateLimiter(): RateLimiter {
  return new RateLimiter(RATE_LIMIT_CONFIGS.bniPartnerForm, 'form-bni-partner');
}
export function createStormReportRateLimiter(): RateLimiter {
  return new RateLimiter(RATE_LIMIT_CONFIGS.stormReport, 'form-storm-report');
}

/**
 * Public per-IP limiter for the storm-report magic-link share view.
 * 60/hr — see RATE_LIMIT_CONFIGS.stormReportShareView for rationale.
 * Even though the tokens are ~143 bits of entropy, this is a cheap
 * belt-and-suspenders so a misconfigured scanner or a compromised
 * downstream cache can't pull the report repeatedly.
 */
export function createStormReportShareViewRateLimiter(): RateLimiter {
  return new RateLimiter(
    RATE_LIMIT_CONFIGS.stormReportShareView,
    'storm-share-view'
  );
}

/**
 * Cross-form global per-IP cap. Apply this in addition to a per-form
 * limiter when you want to catch attackers who rotate between forms.
 * The `collapsePath: true` option omits the URL pathname from the KV
 * key so a single counter aggregates hits across every form endpoint
 * (per IP, per window).
 *
 * Usage pattern in a route:
 *   const formLimiter   = createContactFormRateLimiter();
 *   const globalLimiter = createGlobalFormRateLimiter();
 *   // Check global first so a hot IP can't burn its per-form budget
 *   // before tripping the cross-form cap.
 *   return withRateLimit(req, globalLimiter, () =>
 *     withRateLimit(req, formLimiter, handler)
 *   );
 */
export function createGlobalFormRateLimiter(): RateLimiter {
  return new RateLimiter(
    RATE_LIMIT_CONFIGS.globalForm,
    'form-global',
    { collapsePath: true }
  );
}

// ============================================
// MIDDLEWARE HELPER
// ============================================

/**
 * Same signature as `withRateLimit` in `lib/rate-limiter.ts`. Existing
 * callers can swap imports with a one-line edit:
 *
 *   - import { withRateLimit } from '@/lib/rate-limiter';
 *   + import { withRateLimit } from '@/lib/rate-limiter-kv';
 *
 * Behavior change vs. legacy:
 *   - check() is now async (KV roundtrip). The wrapper awaits it.
 *   - record() is a no-op on the KV path because check() already
 *     INCR'd the counter. On the fallback path, check() also calls
 *     record() internally, so we don't call record() here.
 */
export async function withRateLimit(
  request: Request,
  rateLimiter: RateLimiter,
  handler: () => Promise<Response>
): Promise<Response> {
  const result = await rateLimiter.check(request);

  if (!result.allowed) {
    const headers = rateLimiter.getHeaders(result);
    console.warn('[ratelimit:blocked]', {
      endpoint: new URL(request.url).pathname,
      retryAfter: result.retryAfter,
    });
    return NextResponse.json(
      {
        success: false,
        error: rateLimiter.getMessage(),
        retryAfter: result.retryAfter,
      },
      { status: 429, headers }
    );
  }

  const response = await handler();
  const headers = rateLimiter.getHeaders(result);
  for (const [k, v] of Object.entries(headers)) {
    response.headers.set(k, v);
  }
  return response;
}
