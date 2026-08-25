'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Search,
  RefreshCw,
  LogOut,
  Lock,
  Play,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types (match the API contract exactly)                              */
/* ------------------------------------------------------------------ */

type CallDirection = 'inbound' | 'outbound' | string;
type CallStatus = 'completed' | 'missed' | 'voicemail' | string;

interface CallRecord {
  callId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  repId: string;
  repName: string;
  repExtension: string;
  direction: CallDirection;
  status: CallStatus;
  startTime: string;
  endTime: string;
  duration: number;
  recordingUrl: string;
  recordingAvailable: boolean;
  notes: string;
  tags: string[];
  jobNimbusContactId: string;
  createdAt: string;
  updatedAt: string;
}

interface CallStats {
  totalCalls: number;
  totalDuration: number;
  inboundCalls: number;
  outboundCalls: number;
  missedCalls: number;
  completedCalls: number;
  averageDuration: number;
  lastUpdated: string;
}

interface PortalResponse {
  ok: boolean;
  total: number;
  offset: number;
  limit: number;
  calls: CallRecord[];
  stats: CallStats;
  error?: string;
}

const PAGE_SIZE = 100;

const EMPTY_STATS: CallStats = {
  totalCalls: 0,
  totalDuration: 0,
  inboundCalls: 0,
  outboundCalls: 0,
  missedCalls: 0,
  completedCalls: 0,
  averageDuration: 0,
  lastUpdated: '',
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  try {
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return d.toISOString();
  }
}

function formatDuration(seconds: number): string {
  const s = Number(seconds) || 0;
  if (s <= 0) return '—';
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

function isMissed(status: CallStatus): boolean {
  return status === 'missed';
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

type View = 'loading' | 'login' | 'log';

export default function CallPortalPage() {
  const [view, setView] = useState<View>('loading');

  // login state
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // log state
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [stats, setStats] = useState<CallStats>(EMPTY_STATS);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // keep the latest search string for pagination fetches
  const searchRef = useRef('');
  searchRef.current = search;

  /* --------------------------- data fetching --------------------------- */

  // Fetch the first page for a given query. Returns 'ok' | 'unauth' | 'error'.
  const fetchCalls = useCallback(
    async (q: string): Promise<'ok' | 'unauth' | 'error'> => {
      setLoading(true);
      setFetchError('');
      try {
        const params = new URLSearchParams({
          q,
          limit: String(PAGE_SIZE),
          offset: '0',
        });
        const res = await fetch(`/api/calls/portal?${params.toString()}`, {
          credentials: 'same-origin',
        });
        if (res.status === 401) {
          setLoading(false);
          return 'unauth';
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: PortalResponse = await res.json();
        setCalls(Array.isArray(data.calls) ? data.calls : []);
        setStats(data.stats || EMPTY_STATS);
        setTotal(Number(data.total) || 0);
        setLoading(false);
        return 'ok';
      } catch {
        setFetchError('Could not load calls. Please try again.');
        setLoading(false);
        return 'error';
      }
    },
    [],
  );

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    setFetchError('');
    try {
      const params = new URLSearchParams({
        q: searchRef.current,
        limit: String(PAGE_SIZE),
        offset: String(calls.length),
      });
      const res = await fetch(`/api/calls/portal?${params.toString()}`, {
        credentials: 'same-origin',
      });
      if (res.status === 401) {
        setView('login');
        setLoadingMore(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: PortalResponse = await res.json();
      setCalls((prev) => [...prev, ...(Array.isArray(data.calls) ? data.calls : [])]);
      if (data.stats) setStats(data.stats);
      setTotal(Number(data.total) || 0);
    } catch {
      setFetchError('Could not load more calls. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  }, [calls.length]);

  /* ------------------------------ mount -------------------------------- */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchCalls('');
      if (cancelled) return;
      if (result === 'ok') setView('log');
      else if (result === 'unauth') setView('login');
      else setView('login'); // network error before auth known → let them try to unlock
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------------- debounced search ------------------------ */

  useEffect(() => {
    if (view !== 'log') return;
    const handle = setTimeout(() => {
      void fetchCalls(searchRef.current);
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, view]);

  /* ------------------------------- auth -------------------------------- */

  const handleLogin = useCallback(async () => {
    if (loggingIn) return;
    setLoggingIn(true);
    setLoginError('');
    try {
      const res = await fetch('/api/calls/portal', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', password }),
      });
      const data: { ok: boolean; error?: string } = await res
        .json()
        .catch(() => ({ ok: false }));
      if (res.ok && data.ok) {
        setPassword('');
        setLoginError('');
        const result = await fetchCalls('');
        setView('log');
        if (result === 'unauth') setView('login');
      } else {
        setLoginError(data.error || 'Incorrect password');
      }
    } catch {
      setLoginError('Something went wrong. Please try again.');
    } finally {
      setLoggingIn(false);
    }
  }, [password, loggingIn, fetchCalls]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/calls/portal', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
    } catch {
      /* ignore — reset UI regardless */
    }
    setCalls([]);
    setStats(EMPTY_STATS);
    setTotal(0);
    setSearch('');
    setView('login');
  }, []);

  /* ------------------------------ render ------------------------------- */

  if (view === 'loading') {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-neutral-400">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading…</span>
        </div>
      </main>
    );
  }

  if (view === 'login') {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white/[0.03] border border-white/10 rounded-xl p-8">
          <div className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-emerald-600/15 flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-emerald-400" />
            </div>
            <h1 className="text-xl font-semibold tracking-wide text-emerald-400">
              RCRS
            </h1>
            <h2 className="text-lg font-medium text-neutral-100">Call Portal</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Enter the portal password to continue.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleLogin();
              }}
              placeholder="Password"
              className="w-full rounded-lg bg-neutral-900 border border-white/10 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={() => void handleLogin()}
              disabled={loggingIn}
              className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed px-3 py-2 text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
            >
              {loggingIn ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Unlock
            </button>
            {loginError && (
              <p className="text-sm text-red-400 text-center">{loginError}</p>
            )}
          </div>
        </div>
      </main>
    );
  }

  /* view === 'log' */
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-100">
              <span className="text-emerald-400">RCRS</span> Call Portal
            </h1>
            <StatsStrip stats={stats} />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchCalls(searchRef.current)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] px-3 py-1.5 text-sm text-neutral-200 transition-colors disabled:opacity-60"
              aria-label="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] px-3 py-1.5 text-sm text-neutral-200 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-5 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, number, rep, notes…"
            className="w-full rounded-lg bg-neutral-900 border border-white/10 pl-9 pr-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Error banner */}
        {fetchError && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <span>{fetchError}</span>
            <button
              type="button"
              onClick={() => void fetchCalls(searchRef.current)}
              className="rounded-md bg-red-500/20 hover:bg-red-500/30 px-2.5 py-1 text-red-100 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* List */}
        <div className="mt-5">
          {loading && calls.length === 0 ? (
            <div className="flex items-center justify-center gap-3 py-16 text-neutral-500">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>Loading calls…</span>
            </div>
          ) : total === 0 && !fetchError ? (
            <EmptyState />
          ) : (
            <ul className="space-y-3">
              {calls.map((call, idx) => (
                <CallRow key={call.callId || `${call.startTime}-${idx}`} call={call} />
              ))}
            </ul>
          )}

          {/* Load more */}
          {calls.length > 0 && calls.length < total && (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] px-4 py-2 text-sm text-neutral-200 transition-colors disabled:opacity-60"
              >
                {loadingMore && <RefreshCw className="h-4 w-4 animate-spin" />}
                Load more ({calls.length} of {total})
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */

function StatsStrip({ stats }: { stats: CallStats }) {
  const items: { label: string; value: number }[] = [
    { label: 'Total', value: stats.totalCalls || 0 },
    { label: 'Inbound', value: stats.inboundCalls || 0 },
    { label: 'Outbound', value: stats.outboundCalls || 0 },
    { label: 'Missed', value: stats.missedCalls || 0 },
  ];
  return (
    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-neutral-400">
      {items.map((it) => (
        <span key={it.label}>
          <span className="font-semibold text-neutral-100">{it.value}</span>{' '}
          {it.label}
        </span>
      ))}
    </div>
  );
}

function DirectionIcon({ call }: { call: CallRecord }) {
  if (isMissed(call.status)) {
    return <PhoneMissed className="h-5 w-5 text-red-400" aria-label="Missed call" />;
  }
  if (call.direction === 'inbound') {
    return (
      <PhoneIncoming className="h-5 w-5 text-emerald-400" aria-label="Inbound call" />
    );
  }
  if (call.direction === 'outbound') {
    return (
      <PhoneOutgoing className="h-5 w-5 text-sky-400" aria-label="Outbound call" />
    );
  }
  return <PhoneIncoming className="h-5 w-5 text-neutral-400" aria-label="Call" />;
}

function StatusBadge({ status }: { status: CallStatus }) {
  const map: Record<string, string> = {
    completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    missed: 'bg-red-500/15 text-red-300 border-red-500/30',
    voicemail: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  };
  const cls = map[status] || 'bg-white/5 text-neutral-300 border-white/10';
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

function CallRow({ call }: { call: CallRecord }) {
  const name = call.customerName || 'Unknown Caller';
  const hasRecording = call.recordingAvailable && !!call.recordingUrl;

  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: direction + who */}
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 shrink-0">
            <DirectionIcon call={call} />
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium text-neutral-100">{name}</div>
            {call.customerPhone && (
              <div className="truncate text-sm text-neutral-400">
                {call.customerPhone}
              </div>
            )}
            <div className="mt-0.5 truncate text-xs text-neutral-500">
              {formatDateTime(call.startTime)}
              {call.repName && (
                <>
                  {' · '}
                  {call.repName}
                  {call.repExtension && ` ext ${call.repExtension}`}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: meta */}
        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
          <StatusBadge status={call.status} />
          <span className="text-sm tabular-nums text-neutral-300">
            {formatDuration(call.duration)}
          </span>
        </div>
      </div>

      {/* Recording */}
      <div className="mt-3">
        {hasRecording ? (
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
            <audio
              controls
              preload="none"
              src={call.recordingUrl}
              className="h-8 w-full max-w-md"
            >
              Your browser does not support audio playback.
            </audio>
          </div>
        ) : (
          <span className="text-xs text-neutral-500">No recording</span>
        )}
      </div>

      {/* Notes */}
      {call.notes && (
        <p className="mt-2 rounded-lg bg-white/[0.02] px-3 py-2 text-sm text-neutral-300">
          {call.notes}
        </p>
      )}

      {/* JobNimbus link */}
      {call.jobNimbusContactId && (
        <div className="mt-2">
          <a
            href={`https://app.jobnimbus.com/contact/${call.jobNimbusContactId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300"
          >
            JobNimbus ↗
          </a>
        </div>
      )}
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600/15">
        <PhoneIncoming className="h-6 w-6 text-emerald-400" />
      </div>
      <p className="text-neutral-300">No calls yet.</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">
        Once the office phone system is sending calls to the live site, they&rsquo;ll
        appear here.
      </p>
    </div>
  );
}
