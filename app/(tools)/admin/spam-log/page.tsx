'use client';

/**
 * Spam Log Viewer
 *
 * Browsable view of every request rejected by the public-form defense
 * layers — honeypot, spam-filter, Cloudflare Turnstile, rate-limit —
 * written to the "Spam Log" tab by lib/spam-log.ts.
 *
 * Auth: parent app/(tools)/admin/layout.tsx already gates /admin behind
 * admin login. API route does its own requireAdmin() as defense-in-depth.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldAlert,
  RefreshCw,
  Search,
  Filter,
  Clock,
} from 'lucide-react';

interface SpamLogRow {
  timestamp: string;
  gate: string;
  route: string;
  ip: string;
  submitterEmail: string;
  submitterName: string;
  reason: string;
  details: string;
}

interface SpamLogResponse {
  success: boolean;
  data: {
    rows: SpamLogRow[];
    total: number;
    limit: number;
    counts: Record<string, number>;
    gates: string[];
    routes: string[];
    configured: boolean;
  };
  error?: string;
}

const SINCE_PRESETS: Array<{ key: string; label: string; ms: number | null }> = [
  { key: '24h', label: 'Last 24h', ms: 24 * 60 * 60 * 1000 },
  { key: '7d', label: 'Last 7d', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: '30d', label: 'Last 30d', ms: 30 * 24 * 60 * 60 * 1000 },
  { key: 'all', label: 'All', ms: null },
];

const GATE_BADGE: Record<string, string> = {
  honeypot: 'bg-purple-100 text-purple-800 border-purple-200',
  'spam-filter': 'bg-amber-100 text-amber-800 border-amber-200',
  turnstile: 'bg-blue-100 text-blue-800 border-blue-200',
  'rate-limit': 'bg-rose-100 text-rose-800 border-rose-200',
};

function gateBadgeClass(gate: string) {
  return GATE_BADGE[gate] || 'bg-gray-100 text-gray-700 border-gray-200';
}

function formatTimestamp(iso: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { timeZone: 'America/Chicago' });
  } catch {
    return iso;
  }
}

export default function SpamLogPage() {
  const [data, setData] = useState<SpamLogResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [gateFilter, setGateFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [submitterFilter, setSubmitterFilter] = useState('');
  const [sinceKey, setSinceKey] = useState('7d');
  const [limit, setLimit] = useState(200);

  const sinceIso = useMemo(() => {
    const preset = SINCE_PRESETS.find((p) => p.key === sinceKey);
    if (!preset?.ms) return '';
    return new Date(Date.now() - preset.ms).toISOString();
  }, [sinceKey]);

  const fetchLog = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (gateFilter) params.set('gate', gateFilter);
        if (routeFilter) params.set('route', routeFilter);
        if (submitterFilter.trim()) params.set('submitter', submitterFilter.trim());
        if (sinceIso) params.set('since', sinceIso);
        params.set('limit', String(limit));
        const res = await fetch(`/api/admin/spam-log?${params.toString()}`, {
          cache: 'no-store',
        });
        const json = (await res.json()) as SpamLogResponse;
        if (!json.success) throw new Error(json.error || 'fetch failed');
        setData(json.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load spam log');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [gateFilter, routeFilter, submitterFilter, sinceIso, limit],
  );

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  useEffect(() => {
    const id = setInterval(() => fetchLog(true), 30000);
    return () => clearInterval(id);
  }, [fetchLog]);

  const tiles = useMemo(() => {
    if (!data) return [];
    const c = data.counts;
    return [
      { key: 'honeypot', label: 'Honeypot', n: c['honeypot'] || 0 },
      { key: 'spam-filter', label: 'Spam-filter', n: c['spam-filter'] || 0 },
      { key: 'turnstile', label: 'Turnstile', n: c['turnstile'] || 0 },
      { key: 'rate-limit', label: 'Rate-limit', n: c['rate-limit'] || 0 },
    ];
  }, [data]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-600" />
            Spam Log
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Every request blocked by honeypot, spam-filter, Turnstile, or rate-limit.
            Sorted newest first. Auto-refreshes every 30s.
          </p>
        </div>
        <button
          onClick={() => fetchLog()}
          disabled={loading || refreshing}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {data && !data.configured && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-900 rounded text-sm">
          Sheets credentials are not configured (GOOGLE_SHEETS_ID /
          GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY). The page will be
          empty until those are set on Vercel.
        </div>
      )}

      <div className="grid grid-cols-4 gap-3 mb-6">
        {tiles.map((t) => (
          <div
            key={t.key}
            className={`p-3 border rounded ${gateBadgeClass(t.key)}`}
          >
            <div className="text-xs uppercase tracking-wide">{t.label}</div>
            <div className="text-2xl font-bold">{t.n}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Filter className="w-4 h-4 text-gray-500" />

          <div className="flex items-center gap-1">
            <span className="text-gray-500">Gate:</span>
            <select
              value={gateFilter}
              onChange={(e) => setGateFilter(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1"
            >
              <option value="">All</option>
              {data?.gates.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-gray-500">Route:</span>
            <select
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 max-w-xs"
            >
              <option value="">All</option>
              {data?.routes.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-gray-500" />
            <select
              value={sinceKey}
              onChange={(e) => setSinceKey(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1"
            >
              {SINCE_PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={submitterFilter}
              onChange={(e) => setSubmitterFilter(e.target.value)}
              placeholder="email, name, or IP"
              className="border border-gray-300 rounded px-2 py-1 flex-1"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-gray-500">Limit:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10))}
              className="border border-gray-300 rounded px-2 py-1"
            >
              <option value={50}>50</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-900 rounded text-sm">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2 font-semibold">Time</th>
              <th className="px-3 py-2 font-semibold">Gate</th>
              <th className="px-3 py-2 font-semibold">Route</th>
              <th className="px-3 py-2 font-semibold">Submitter</th>
              <th className="px-3 py-2 font-semibold">IP</th>
              <th className="px-3 py-2 font-semibold">Reason</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && data?.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  No blocks match the current filter.
                </td>
              </tr>
            )}
            {!loading &&
              data?.rows.map((r, i) => (
                <tr key={`${r.timestamp}-${i}`} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                    {formatTimestamp(r.timestamp)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded border ${gateBadgeClass(r.gate)}`}
                    >
                      {r.gate || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.route}</td>
                  <td className="px-3 py-2">
                    <div className="truncate max-w-[220px]" title={`${r.submitterName} <${r.submitterEmail}>`}>
                      {r.submitterEmail || r.submitterName || '—'}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600">
                    {r.ip || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="truncate max-w-[300px]" title={r.details || r.reason}>
                      {r.reason}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="mt-3 text-xs text-gray-500 text-right">
          Showing {data.rows.length} of {data.total} rows
        </div>
      )}
    </div>
  );
}
