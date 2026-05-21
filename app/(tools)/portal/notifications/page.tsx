/**
 * Notifications Hub
 *
 * Lightweight landing page for `/portal/notifications` that fans out to the
 * two real destinations:
 *   - `/portal/notifications/inbox` — full inbox / message center
 *   - `/portal/notifications/preferences` — per-rep channel + alert toggles
 *
 * Previously, the inbox lived at this URL and the preferences page sat at a
 * nested `/preferences` route. That was unintuitive — visiting the bare
 * `/portal/notifications` URL should feel like settings, not a giant inbox.
 * The inbox was moved to `/portal/notifications/inbox` and this hub took its
 * place. Existing internal links (none target this path directly — verified
 * via grep) keep working.
 */

import Link from 'next/link';
import { Bell, Settings, Inbox, ChevronRight } from 'lucide-react';

export default function NotificationsHubPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <div className="mb-6 sm:mb-8">
        <div className="mb-2 flex items-center gap-2">
          <Bell size={20} className="text-blue-400" />
          <h1 className="text-xl font-bold text-white sm:text-2xl">Notifications</h1>
        </div>
        <p className="text-sm text-neutral-400">
          View your inbox or change how and when you get notified.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <Link
          href="/portal/notifications/inbox"
          className="group flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:border-white/10 hover:bg-white/[0.04] sm:p-5"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
            <Inbox size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white sm:text-base">Inbox</h2>
              <ChevronRight
                size={16}
                className="flex-shrink-0 text-neutral-600 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-400"
              />
            </div>
            <p className="text-xs text-neutral-500 sm:text-sm">
              Read, archive, or delete notifications. Filter by type and bulk-manage.
            </p>
          </div>
        </Link>

        <Link
          href="/portal/notifications/preferences"
          className="group flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:border-white/10 hover:bg-white/[0.04] sm:p-5"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <Settings size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white sm:text-base">Preferences</h2>
              <ChevronRight
                size={16}
                className="flex-shrink-0 text-neutral-600 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-400"
              />
            </div>
            <p className="text-xs text-neutral-500 sm:text-sm">
              Choose which alerts you receive and which channels (GroupMe, email) deliver them.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
