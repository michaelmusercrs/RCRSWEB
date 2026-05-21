'use client';

/**
 * Per-Rep Notification Preferences
 *
 * NOTE ON LOCATION: Lives at `/portal/notifications/preferences`. The bare
 * `/portal/notifications` URL is now a small hub that fans out to this
 * preferences page and to the inbox (`/portal/notifications/inbox`). The
 * 808-line inbox previously sat at the bare URL; it was moved into
 * `/inbox` so that `/notifications` reads as "settings" to a first-time
 * visitor.
 *
 * Per-rep toggles for the alert types and channels the rep wants. Defaults
 * are every alert ON, every channel ON — reps opt OUT of what they don't
 * want. Reads/writes through `/api/portal/notifications-prefs` to the
 * `Rep_Notification_Prefs` sheet tab.
 *
 * IMPORTANT: This page does NOT fire any notifications. It only records
 * the rep's choices. The master GroupMe kill switch
 * (`GROUPME_FORCE_SEND=true`) is still required before any GroupMe send
 * actually happens. The banner at the top of the page surfaces this
 * status so reps know whether their choices are live yet.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Info,
  Loader2,
  Mail,
  MessageCircle,
  Save,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

// ---------------------------------------------------------------------------
// Types — kept in sync with lib/rep-notification-prefs.ts
// ---------------------------------------------------------------------------

interface RepNotificationPrefs {
  repSlug: string;
  repName: string;
  channelGroupMe: boolean;
  channelEmail: boolean;
  alertNewLead: boolean;
  alertCustomerMessage: boolean;
  alertDigest: boolean;
  alertSystem: boolean;
  alertMention: boolean;
  updatedAt: string;
}

// Default — every channel/alert ON. Mirrors the server.
const DEFAULTS: RepNotificationPrefs = {
  repSlug: '',
  repName: '',
  channelGroupMe: true,
  channelEmail: true,
  alertNewLead: true,
  alertCustomerMessage: true,
  alertDigest: true,
  alertSystem: true,
  alertMention: true,
  updatedAt: '',
};

// ---------------------------------------------------------------------------
// Field metadata for the rendered list. Order matters — most important first.
// ---------------------------------------------------------------------------

const ALERTS: Array<{
  key: keyof Pick<
    RepNotificationPrefs,
    'alertNewLead' | 'alertCustomerMessage' | 'alertDigest' | 'alertSystem' | 'alertMention'
  >;
  label: string;
  description: string;
}> = [
  {
    key: 'alertNewLead',
    label: 'New lead assigned',
    description: 'Ping me when a new lead is routed to me from any source.',
  },
  {
    key: 'alertCustomerMessage',
    label: 'Customer message received',
    description: 'Ping me when one of my customers sends a portal message.',
  },
  {
    key: 'alertDigest',
    label: 'Daily / weekly digest',
    description: 'Send me the rollup summary of my pipeline + numbers.',
  },
  {
    key: 'alertSystem',
    label: 'System alerts',
    description: 'Outages, deploys, scheduled maintenance, password reset, etc.',
  },
  {
    key: 'alertMention',
    label: 'Mentions',
    description: '@-mentions in portal messages, comments, and breakdown notes.',
  },
];

const CHANNELS: Array<{
  key: keyof Pick<RepNotificationPrefs, 'channelGroupMe' | 'channelEmail'>;
  label: string;
  description: string;
  icon: typeof MessageCircle;
}> = [
  {
    key: 'channelGroupMe',
    label: 'GroupMe',
    description: 'Push messages via the team GroupMe bot.',
    icon: MessageCircle,
  },
  {
    key: 'channelEmail',
    label: 'Email',
    description: 'Send to my work email on file.',
    icon: Mail,
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NotificationPreferencesPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [prefs, setPrefs] = useState<RepNotificationPrefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // Redirect unauthenticated users to the portal login.
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/portal');
    }
  }, [user, authLoading, router]);

  // Load this rep's prefs on mount.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/portal/notifications-prefs', {
          credentials: 'include',
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success) {
          setError(data.error || 'Failed to load preferences');
          return;
        }
        setPrefs(data.data as RepNotificationPrefs);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Network error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Toggle one key on/off. Optimistic UI — server PUT happens on Save.
  function toggle(key: keyof RepNotificationPrefs) {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
    setSavedMessage(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const res = await fetch('/api/portal/notifications-prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          channelGroupMe: prefs.channelGroupMe,
          channelEmail: prefs.channelEmail,
          alertNewLead: prefs.alertNewLead,
          alertCustomerMessage: prefs.alertCustomerMessage,
          alertDigest: prefs.alertDigest,
          alertSystem: prefs.alertSystem,
          alertMention: prefs.alertMention,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Save failed');
        return;
      }
      setPrefs(data.data as RepNotificationPrefs);
      setSavedMessage('Preferences saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-lime-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
        <Link
          href="/portal"
          className="p-2 hover:bg-zinc-900 rounded-md text-zinc-400 hover:text-zinc-200"
          aria-label="Back to portal"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Bell className="w-5 h-5 text-lime-500" />
        <h1 className="text-base sm:text-lg font-semibold">Notification preferences</h1>
        <span className="text-xs text-zinc-500 ml-2 hidden sm:inline">
          {prefs.repName || user.name}
        </span>
      </header>

      {/* Master kill-switch notice. This page never fires anything — choices
          take effect once owner activates GROUPME_FORCE_SEND. */}
      <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/30 text-amber-200 text-xs flex gap-2 items-start">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">Recording your choices only</p>
          <p className="text-amber-200/80">
            GroupMe sends are paused company-wide until the owner activates
            them. Your settings here will be honored automatically the moment
            sends turn back on — no action needed from you.
          </p>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {loading ? (
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading your preferences…</span>
          </div>
        ) : (
          <>
            {error && (
              <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {savedMessage && (
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{savedMessage}</span>
              </div>
            )}

            {/* Channels */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-3">
                Channels
              </h2>
              <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/40">
                {CHANNELS.map(c => {
                  const Icon = c.icon;
                  const on = prefs[c.key];
                  return (
                    <li key={c.key} className="flex items-center gap-3 px-4 py-3">
                      <Icon className="w-5 h-5 text-lime-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{c.label}</p>
                        <p className="text-xs text-zinc-500">{c.description}</p>
                      </div>
                      <ToggleSwitch
                        checked={on}
                        onChange={() => toggle(c.key)}
                        ariaLabel={`${c.label} channel`}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Alerts */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-3">
                Alerts
              </h2>
              <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/40">
                {ALERTS.map(a => {
                  const on = prefs[a.key];
                  return (
                    <li key={a.key} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{a.label}</p>
                        <p className="text-xs text-zinc-500">{a.description}</p>
                      </div>
                      <ToggleSwitch
                        checked={on}
                        onChange={() => toggle(a.key)}
                        ariaLabel={a.label}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Save bar */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-lime-500 hover:bg-lime-400 text-zinc-950 font-medium px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{saving ? 'Saving…' : 'Save preferences'}</span>
              </button>
              {prefs.updatedAt && (
                <p className="text-xs text-zinc-500">
                  Last saved: {new Date(prefs.updatedAt).toLocaleString()}
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local ToggleSwitch — keeps this page self-contained (no new shared dep).
// ---------------------------------------------------------------------------

function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-lime-500 focus:ring-offset-2 focus:ring-offset-zinc-950 ${
        checked ? 'bg-lime-500' : 'bg-zinc-700'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        } mt-0.5`}
      />
    </button>
  );
}
