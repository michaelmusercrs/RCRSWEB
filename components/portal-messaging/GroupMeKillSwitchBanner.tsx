'use client';

/**
 * GroupMe Master Kill-Switch Banner
 *
 * Persistent top-of-page banner that warns users their typed GroupMe messages
 * will be queued/dropped because the owner's master kill switch is active.
 *
 * Gating: renders ONLY when `NEXT_PUBLIC_GROUPME_FORCE_SEND !== 'true'`.
 *
 * Why a NEXT_PUBLIC_* var?
 *   This component runs in the browser. `process.env.GROUPME_FORCE_SEND`
 *   is a server-only secret and would always be `undefined` on the client,
 *   so the banner would never hide. Next.js inlines any env var prefixed
 *   with NEXT_PUBLIC_ into the client bundle at build time. The owner /
 *   deploy pipeline is responsible for mirroring the server-side
 *   `GROUPME_FORCE_SEND` value into `NEXT_PUBLIC_GROUPME_FORCE_SEND` so
 *   that the UI accurately reflects the actual sender behavior.
 *
 * Drop-in usage:
 *   import GroupMeKillSwitchBanner from '@/components/portal-messaging/GroupMeKillSwitchBanner';
 *   ...
 *   <GroupMeKillSwitchBanner />
 *
 * Intended sites of adoption:
 *   - sweep/portal-messaging compose page (on rebase)
 *   - Admin notify-rep modal in command-center/sales/leaderboard
 *   - Any customer-portal page that grows messaging in the future
 *
 * Built on `main` so the component is stable / reusable; `sweep/portal-messaging`
 * should `import` it rather than re-implement the persistent banner inline.
 */

import { AlertTriangle } from 'lucide-react';

export default function GroupMeKillSwitchBanner() {
  // Client-side env read. Inlined at build time by Next.js because of the
  // NEXT_PUBLIC_ prefix. Strict equality with the literal string 'true' so
  // any other value (undefined, '', 'false', '1') keeps the banner visible
  // — fail-safe defaults to "looks disabled".
  if (process.env.NEXT_PUBLIC_GROUPME_FORCE_SEND === 'true') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-yellow-500/15 border-b border-yellow-500/40 text-yellow-100"
    >
      <div className="mx-auto flex max-w-5xl items-start gap-2 px-3 py-2 sm:items-center sm:px-4 sm:py-2.5">
        <AlertTriangle
          size={18}
          className="mt-0.5 flex-shrink-0 text-yellow-400 sm:mt-0"
          aria-hidden="true"
        />
        <p className="text-xs leading-snug sm:text-sm">
          <span className="font-semibold">GroupMe sends are currently disabled by owner.</span>{' '}
          Messages typed here will be queued/dropped until activated. Set{' '}
          <code className="rounded bg-yellow-500/20 px-1 py-0.5 font-mono text-[11px] text-yellow-200 sm:text-xs">
            GROUPME_FORCE_SEND=true
          </code>{' '}
          to enable.
        </p>
      </div>
    </div>
  );
}
