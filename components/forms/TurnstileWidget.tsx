'use client';

/**
 * TurnstileWidget — Cloudflare Turnstile bot-protection widget.
 *
 * Pairs with lib/turnstile.ts (server verify). Drop this above each form's
 * submit button. The widget fetches a token from Cloudflare in the background
 * and hands it to the parent via `onVerify(token)`. The parent stores the
 * token in state and POSTs it as `turnstileToken` in the form body. The route
 * handler then calls verifyTurnstileToken() to confirm Cloudflare actually
 * issued it.
 *
 * INERT-WHEN-UNCONFIGURED PATTERN
 * -------------------------------
 * If NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset/empty, this component:
 *   1. Renders NOTHING (no widget, no challenge, no UI).
 *   2. Immediately calls onVerify('disabled') so the parent thinks
 *      verification "passed" and the form submits as normal.
 *
 * The server-side verifier also recognizes the 'disabled' sentinel and
 * fails-open. Net effect: shipping this code with no Cloudflare keys is a
 * no-op. The owner can configure keys later and redeploy to activate the
 * gate without any further code changes.
 *
 * Usage:
 *   const [turnstileToken, setTurnstileToken] = useState('');
 *   ...
 *   <TurnstileWidget onVerify={setTurnstileToken} />
 *   <button type="submit">Send</button>
 *
 *   // In the fetch body:
 *   body: JSON.stringify({ ...fields, turnstileToken })
 */

import { useEffect } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';

interface TurnstileWidgetProps {
  /** Called with a verification token on success. Receives 'disabled' when
   *  Turnstile isn't configured — treat that as a free pass. */
  onVerify: (token: string) => void;
  /** Optional error callback. Called if Cloudflare returns an error or the
   *  widget fails to load. Parent can show a retry message. */
  onError?: () => void;
  /** Widget theme. Defaults to 'light'. */
  theme?: 'light' | 'dark';
}

export default function TurnstileWidget({
  onVerify,
  onError,
  theme = 'light',
}: TurnstileWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const enabled = !!siteKey && siteKey.trim() !== '';

  // When Turnstile isn't configured, immediately tell the parent we're "good"
  // so its form continues to work. Doing this in an effect (not inline during
  // render) keeps React's render pure and avoids spurious state-updates from
  // an ancestor's render cycle.
  useEffect(() => {
    if (!enabled) {
      onVerify('disabled');
    }
    // We intentionally do NOT include onVerify in the deps array — many
    // parents pass an inline lambda, which would loop. Re-running this only
    // when the site key changes (effectively, never, since it's an env var)
    // is the correct behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <div className="turnstile-widget">
      <Turnstile
        siteKey={siteKey!}
        onSuccess={onVerify}
        onError={onError}
        // Token expires after ~5 min. Auto-refresh keeps it valid for users
        // who fill out a long form slowly.
        options={{
          theme,
          size: 'flexible',
          refreshExpired: 'auto',
        }}
      />
    </div>
  );
}
