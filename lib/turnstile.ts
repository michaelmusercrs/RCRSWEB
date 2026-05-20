/**
 * Cloudflare Turnstile — server-side token verification.
 *
 * Pairs with components/forms/TurnstileWidget.tsx. The widget renders the
 * Turnstile challenge on the client and returns a token; this module hands
 * that token to Cloudflare's /siteverify endpoint and returns a structured
 * result the route handler can act on.
 *
 * INERT-WHEN-UNCONFIGURED PATTERN
 * -------------------------------
 * Turnstile is opt-in: it activates only when both env vars are present.
 *
 *   - If TURNSTILE_SECRET_KEY is missing/empty            → return valid=true
 *   - If the client sent the literal token 'disabled'    → return valid=true
 *     (the widget emits this when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset)
 *
 * This means the integration ships dark. Until the owner pastes Cloudflare
 * keys into Vercel env vars and redeploys, every form keeps working exactly
 * as it does today. The moment both keys land in env and a redeploy happens,
 * the gate activates automatically — no code change required.
 *
 * Order of operations inside each route handler:
 *
 *   1. honeypot   (silent 200 if filled — bots get fooled)
 *   2. spam-filter (silent 200 if matched — bots get fooled)
 *   3. turnstile  ← THIS — explicit 400 on failure (legit users can retry)
 *   4. business logic (sheet write, lead create, email send, etc.)
 *
 * Why Turnstile uses explicit failure (not silent success):
 *   Honeypot and spam-filter are 100% bot-targeted — legit users never trip
 *   them, so we hide the rejection. Turnstile, however, can occasionally
 *   fail for legit users on flaky networks or odd browser configs. Those
 *   users need to know to retry. Hence: distinct grep-able log tag
 *   `[TURNSTILE FAILED route=<name>]` and a 400 with a user-readable message.
 *
 * --- OWNER-FACING SETUP ----------------------------------------------------
 * To activate Turnstile:
 * 1. Go to https://dash.cloudflare.com → Turnstile (left nav)
 * 2. Add a Site → Widget Mode: Managed; domain: rivercityroofingsolutions.com
 * 3. Copy the Site Key + Secret Key
 * 4. Set on each of the 4 public-site Vercel projects:
 *      NEXT_PUBLIC_TURNSTILE_SITE_KEY=<site-key>
 *      TURNSTILE_SECRET_KEY=<secret-key>
 * 5. Redeploy
 * ---------------------------------------------------------------------------
 */

const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerifyResult {
  valid: boolean;
  /** Human-readable reason; useful for log lines. Never shown to the user. */
  reason?: string;
  /** Raw Cloudflare error codes when the verify call returned them. */
  errorCodes?: string[];
}

/**
 * Verify a Turnstile token against Cloudflare.
 *
 * @param token      Token emitted by the client widget. Pass through whatever
 *                   the request body had — the function handles undefined,
 *                   empty string, and the special 'disabled' sentinel.
 * @param remoteIp   Optional. Forward `x-forwarded-for`/`x-real-ip` here so
 *                   Cloudflare can incorporate the visitor IP into its score.
 *                   Skipping it is fine; verification still works.
 */
export async function verifyTurnstileToken(
  token: string | undefined,
  remoteIp?: string,
): Promise<TurnstileVerifyResult> {
  // ── INERT MODE ──────────────────────────────────────────────────────────
  // No secret configured = system isn't activated yet. Fail OPEN so the
  // owner can ship the code today without paste-and-redeploy gating
  // legitimate leads.
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || secret.trim() === '') {
    return { valid: true, reason: 'turnstile not configured' };
  }

  // The widget emits 'disabled' when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset.
  // Honor that signal so a half-configured deploy (secret set, site key not,
  // or vice-versa) doesn't break forms — fail-open until BOTH are present.
  if (token === 'disabled') {
    return { valid: true, reason: 'turnstile widget disabled client-side' };
  }

  // ── GATE ACTIVE ─────────────────────────────────────────────────────────
  if (!token || token.trim() === '') {
    return { valid: false, reason: 'missing turnstile token' };
  }

  // Cloudflare expects application/x-www-form-urlencoded.
  const params = new URLSearchParams();
  params.set('secret', secret);
  params.set('response', token);
  if (remoteIp && remoteIp !== 'unknown') {
    params.set('remoteip', remoteIp);
  }

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      return {
        valid: false,
        reason: `siteverify http ${res.status}`,
      };
    }

    const data = (await res.json()) as {
      success?: boolean;
      'error-codes'?: string[];
    };

    if (data.success === true) {
      return { valid: true };
    }

    return {
      valid: false,
      reason: 'cloudflare rejected token',
      errorCodes: data['error-codes'] ?? [],
    };
  } catch (err) {
    // Network blip / DNS hiccup talking to Cloudflare. Don't fail-open here —
    // the gate is supposed to be active. Surface the reason in logs and let
    // the route return 400 so the user can retry; transient errors usually
    // clear on the next submit.
    return {
      valid: false,
      reason: `verify request failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Convenience: extract the visitor IP a Next.js NextRequest in the same way
 * the rest of the codebase does it. Callers can pass this into
 * verifyTurnstileToken's second argument.
 */
export function getRequestIp(request: { headers: Headers }): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
