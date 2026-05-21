'use client';

/**
 * Lead Fallback Viewer
 *
 * Owner-facing dashboard for the blob-backed lead recovery queue.
 * Lists every entry under leads-fallback/ and leads-recovered/ (latest
 * 100 by uploadedAt, merged), shows status, and exposes a "Replay now"
 * button that triggers a one-shot replay via POST /api/admin/lead-fallback.
 *
 * Auth: parent app/(tools)/admin/layout.tsx already gates this behind
 * the admin login + session cookie. The /api/admin/lead-fallback route
 * does its own requireAdmin check as defense-in-depth.
 *
 * Reconciliation cron (/api/cron/reconcile-leads) runs every hour at :45
 * once activated — this page exists so the owner can spot-check that the
 * fallback queue is draining, and replay manually if needed.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  RefreshCw,
  Inbox,
  Play,
  Database,
} from 'lucide-react';

interface FallbackListEntry {
  blobKey: string;
  url: string;
  source: string;
  reason: string;
  capturedAt: string;
  recoveredAt: string | null;
  recovered: boolean;
  originalError?: string;
  size: number;
}

interface ListResponse {
  success: boolean;
  configured: boolean;
  message?: string;
  entries: FallbackListEntry[];
  counts?: { pending: number; recovered: number; total: number };
  error?: string;
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diffMs = Date.now() - t;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  return `${days}d ago`;
}

export default function LeadFallbackPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replayingKey, setReplayingKey] = useState<string | null>(null);
  const [lastReplayResult, setLastReplayResult] = useState<{ key: string; ok: boolean; message: string } | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/lead-fallback', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ListResponse;
      if (!json.success) throw new Error(json.error ?? 'unknown error');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const replay = useCallback(async (blobKey: string) => {
    setReplayingKey(blobKey);
    setLastReplayResult(null);
    try {
      const res = await fetch('/api/admin/lead-fallback', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blobKey }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setLastReplayResult({ key: blobKey, ok: false, message: json.error ?? `HTTP ${res.status}` });
      } else {
        setLastReplayResult({ key: blobKey, ok: true, message: 'Recovered successfully.' });
      }
      // Reload list so the entry moves to "Recovered".
      await load();
    } catch (err) {
      setLastReplayResult({
        key: blobKey,
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setReplayingKey(null);
    }
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-green" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
        <h2 className="text-lg font-bold text-red-300">Failed to load lead-fallback queue</h2>
        <p className="text-sm text-red-200 mt-2">{error ?? 'Unknown error'}</p>
        <button
          onClick={() => void load()}
          className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data.configured) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Inbox className="w-8 h-8" />
            Lead capture fallback
          </h1>
          <Link
            href="/admin/system/health"
            className="px-3 py-2 text-sm text-neutral-300 hover:text-white border border-white/10 rounded-lg inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" /> Back to System Health
          </Link>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
          <h2 className="text-lg font-bold text-yellow-300 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> BLOB_READ_WRITE_TOKEN not set
          </h2>
          <p className="text-sm text-yellow-200 mt-2">
            The fallback storage is disabled until <code className="text-yellow-100">BLOB_READ_WRITE_TOKEN</code> is added to the project env.
            Public lead-capture endpoints will still attempt their sheet writes — but if a write fails, the lead has nowhere to go.
          </p>
        </div>
      </div>
    );
  }

  const pending = data.entries.filter(e => !e.recovered);
  const recovered = data.entries.filter(e => e.recovered);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Inbox className="w-8 h-8" />
            Lead capture fallback
          </h1>
          <p className="text-neutral-400 mt-1">
            Lead-capture payloads that bypassed the primary sheet write. The
            <code className="text-neutral-300 mx-1">reconcile-leads</code>
            cron sweeps these hourly (when active). Use <em>Replay now</em> to recover one manually.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/system/health"
            className="px-3 py-2 text-sm text-neutral-300 hover:text-white border border-white/10 rounded-lg inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </Link>
          <button
            onClick={() => void load()}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-brand-green hover:bg-lime-400 disabled:bg-neutral-700 disabled:text-neutral-400 text-black font-medium rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-neutral-900 border border-white/10 rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">Pending</div>
          <div className="text-3xl font-bold text-yellow-300 mt-1">{pending.length}</div>
          <div className="text-xs text-neutral-400 mt-1">Awaiting replay</div>
        </div>
        <div className="bg-neutral-900 border border-white/10 rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">Recovered</div>
          <div className="text-3xl font-bold text-green-300 mt-1">{recovered.length}</div>
          <div className="text-xs text-neutral-400 mt-1">Replayed to sheets</div>
        </div>
        <div className="bg-neutral-900 border border-white/10 rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">Total (latest 100)</div>
          <div className="text-3xl font-bold text-white mt-1">{data.entries.length}</div>
          <div className="text-xs text-neutral-400 mt-1">Across both buckets</div>
        </div>
      </div>

      {/* Last replay result */}
      {lastReplayResult && (
        <div
          className={
            lastReplayResult.ok
              ? 'bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-sm text-green-200'
              : 'bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-200'
          }
        >
          <div className="flex items-center gap-2">
            {lastReplayResult.ok ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            <code className="text-xs">{lastReplayResult.key}</code>
            <span>— {lastReplayResult.message}</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-neutral-900 border border-white/10 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-neutral-300" />
          <h3 className="text-base font-semibold text-white">Fallback queue</h3>
        </div>
        {data.entries.length === 0 ? (
          <div className="py-12 text-center text-neutral-500 text-sm">
            <CheckCircle2 className="w-8 h-8 mx-auto text-green-400 mb-2" />
            No fallback entries — all lead writes have succeeded.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-neutral-500 border-b border-white/10">
                  <th className="px-2 py-2 font-semibold">Source</th>
                  <th className="px-2 py-2 font-semibold">Captured</th>
                  <th className="px-2 py-2 font-semibold">Reason</th>
                  <th className="px-2 py-2 font-semibold">Status</th>
                  <th className="px-2 py-2 font-semibold">Recovered</th>
                  <th className="px-2 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => {
                  const replaying = replayingKey === e.blobKey;
                  return (
                    <tr key={e.blobKey} className="border-b border-white/5 last:border-b-0">
                      <td className="px-2 py-2 font-mono text-xs text-neutral-300">{e.source}</td>
                      <td className="px-2 py-2 text-xs text-neutral-300">
                        <div>{relativeTime(e.capturedAt)}</div>
                        <div className="text-[10px] text-neutral-500">{e.capturedAt}</div>
                      </td>
                      <td className="px-2 py-2 text-xs text-neutral-400" title={e.originalError}>
                        {e.reason}
                      </td>
                      <td className="px-2 py-2">
                        {e.recovered ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-green-500/20 text-green-300 border border-green-500/30">
                            <CheckCircle2 className="w-3 h-3" /> Recovered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs text-neutral-400">
                        {e.recoveredAt ? relativeTime(e.recoveredAt) : '—'}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {e.recovered ? (
                          <span className="text-xs text-neutral-500">done</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void replay(e.blobKey)}
                            disabled={replaying}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-brand-green hover:bg-lime-400 disabled:bg-neutral-700 disabled:text-neutral-400 text-black font-medium rounded transition-colors"
                          >
                            {replaying ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" /> Replaying
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3" /> Replay now
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
