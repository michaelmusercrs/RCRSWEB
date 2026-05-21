'use client';

/**
 * Marketing Intelligence Viewer
 *
 * Browsable view of every reading the marketing-intel cron has captured,
 * plus the suggestion engine's actionable items. Filter by source, date,
 * and flag. Auto-refreshes every 30s.
 *
 * Auth: parent app/(tools)/admin/layout.tsx already gates /admin behind
 * admin login. API route does its own requireAdmin() as defense-in-depth.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  RefreshCw,
  Filter,
  Clock,
  AlertTriangle,
  AlertOctagon,
  Info,
} from 'lucide-react';

interface MarketingIntelRow {
  timestamp: string;
  source: string;
  metric: string;
  value: string;
  previousValue: string;
  delta: string;
  flag: string;
  notes: string;
}

interface Suggestion {
  id: string;
  severity: 'info' | 'warn' | 'critical';
  title: string;
  action: string;
  evidence: MarketingIntelRow[];
}

interface ViewerResponse {
  success: boolean;
  data: {
    rows: MarketingIntelRow[];
    total: number;
    limit: number;
    sources: string[];
    suggestions: Suggestion[];
    trends: Record<string, Array<{ timestamp: string; value: string }>>;
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

const FLAG_BADGE: Record<string, string> = {
  '': 'bg-gray-100 text-gray-600 border-gray-200',
  changed: 'bg-blue-100 text-blue-800 border-blue-200',
  fail: 'bg-rose-100 text-rose-800 border-rose-200',
  'needs-owner': 'bg-amber-100 text-amber-800 border-amber-200',
};

const SEV_STYLE: Record<
  Suggestion['severity'],
  { icon: typeof AlertOctagon; box: string }
> = {
  critical: {
    icon: AlertOctagon,
    box: 'bg-red-50 border-red-300 text-red-900',
  },
  warn: {
    icon: AlertTriangle,
    box: 'bg-amber-50 border-amber-300 text-amber-900',
  },
  info: { icon: Info, box: 'bg-blue-50 border-blue-300 text-blue-900' },
};

function formatTimestamp(iso: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { timeZone: 'America/Chicago' });
  } catch {
    return iso;
  }
}

function flagBadgeClass(flag: string) {
  return FLAG_BADGE[flag] || FLAG_BADGE[''];
}

/**
 * Render a tiny ascii-style sparkline for trend visualization.
 * Pure SVG — no chart library needed. Maps the numeric values into
 * a 0–100 vertical scale and draws a polyline.
 */
function Sparkline({
  points,
}: {
  points: Array<{ timestamp: string; value: string }>;
}) {
  const numeric = points
    .map((p) => parseFloat(p.value))
    .filter((n) => Number.isFinite(n));
  if (numeric.length < 2) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  const range = max - min || 1;
  const w = 120;
  const h = 28;
  const step = w / (numeric.length - 1);
  const path = numeric
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const last = numeric[numeric.length - 1];
  const prev = numeric[numeric.length - 2];
  const trendColor = last > prev ? '#16a34a' : last < prev ? '#dc2626' : '#6b7280';
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={path} fill="none" stroke={trendColor} strokeWidth={1.5} />
      <circle
        cx={(numeric.length - 1) * step}
        cy={h - ((last - min) / range) * h}
        r={2}
        fill={trendColor}
      />
    </svg>
  );
}

export default function MarketingIntelPage() {
  const [data, setData] = useState<ViewerResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [sourceFilter, setSourceFilter] = useState('');
  const [flagFilter, setFlagFilter] = useState('');
  const [sinceKey, setSinceKey] = useState('30d');
  const [limit, setLimit] = useState(500);

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
        if (sourceFilter) params.set('source', sourceFilter);
        if (flagFilter) params.set('flag', flagFilter);
        if (sinceIso) params.set('since', sinceIso);
        params.set('limit', String(limit));
        const res = await fetch(`/api/admin/marketing-intel?${params.toString()}`, {
          cache: 'no-store',
        });
        const json = (await res.json()) as ViewerResponse;
        if (!json.success) throw new Error(json.error || 'fetch failed');
        setData(json.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load marketing intel');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [sourceFilter, flagFilter, sinceIso, limit],
  );

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  useEffect(() => {
    const id = setInterval(() => fetchLog(true), 30000);
    return () => clearInterval(id);
  }, [fetchLog]);

  const trendKeys = useMemo(() => {
    if (!data) return [];
    return Object.keys(data.trends).sort();
  }, [data]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <TrendingUp className="w-6 h-6 text-brand-green" />
            Marketing Intelligence
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Daily reading of every public-facing surface that affects RCRS
            marketing — reviews, BBB, competitors, search rank, DNS, deploys.
            Auto-refreshes every 30s.
          </p>
        </div>
        <button
          onClick={() => fetchLog()}
          disabled={loading || refreshing}
          className="flex items-center gap-2 px-3 py-2 border border-neutral-700 rounded text-sm hover:bg-neutral-800 disabled:opacity-50 text-neutral-200"
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

      {/* Suggestion panel */}
      {data && data.suggestions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">
            Suggestions ({data.suggestions.length})
          </h2>
          <div className="space-y-2">
            {data.suggestions.map((s) => {
              const style = SEV_STYLE[s.severity];
              const Icon = style.icon;
              return (
                <div
                  key={s.id}
                  className={`p-3 border rounded ${style.box}`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-semibold">{s.title}</div>
                      <div className="text-sm mt-1 opacity-90">{s.action}</div>
                      {s.evidence.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs cursor-pointer opacity-75">
                            Evidence ({s.evidence.length} row
                            {s.evidence.length === 1 ? '' : 's'})
                          </summary>
                          <div className="text-xs font-mono mt-1 space-y-1">
                            {s.evidence.map((e, i) => (
                              <div key={i} className="opacity-80">
                                {formatTimestamp(e.timestamp)} ·{' '}
                                {e.source}/{e.metric} = {e.value || '(empty)'}{' '}
                                {e.notes && `· ${e.notes}`}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trend lines */}
      {data && trendKeys.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">
            Trends ({trendKeys.length} metrics)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {trendKeys.map((key) => {
              const points = data.trends[key];
              const last = points[points.length - 1];
              return (
                <div
                  key={key}
                  className="p-3 bg-neutral-900 border border-neutral-800 rounded"
                >
                  <div className="text-xs text-neutral-400 truncate" title={key}>
                    {key}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-lg font-mono text-white">
                      {last?.value || '—'}
                    </div>
                    <Sparkline points={points} />
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {points.length} reading{points.length === 1 ? '' : 's'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-neutral-900 border border-neutral-800 rounded p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-200">
          <Filter className="w-4 h-4 text-neutral-500" />

          <div className="flex items-center gap-1">
            <span className="text-neutral-500">Source:</span>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-100"
            >
              <option value="">All</option>
              {data?.sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-neutral-500">Flag:</span>
            <select
              value={flagFilter}
              onChange={(e) => setFlagFilter(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-100"
            >
              <option value="">All</option>
              <option value="changed">changed</option>
              <option value="fail">fail</option>
              <option value="needs-owner">needs-owner</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-neutral-500" />
            <select
              value={sinceKey}
              onChange={(e) => setSinceKey(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-100"
            >
              {SINCE_PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-neutral-500">Limit:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10))}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-100"
            >
              <option value={100}>100</option>
              <option value={500}>500</option>
              <option value={2000}>2000</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-900 rounded text-sm">
          {error}
        </div>
      )}

      <div className="bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
        <table className="w-full text-sm text-neutral-200">
          <thead className="bg-neutral-950 text-left text-neutral-400 border-b border-neutral-800">
            <tr>
              <th className="px-3 py-2 font-semibold">Time</th>
              <th className="px-3 py-2 font-semibold">Source</th>
              <th className="px-3 py-2 font-semibold">Metric</th>
              <th className="px-3 py-2 font-semibold">Value</th>
              <th className="px-3 py-2 font-semibold">Prev</th>
              <th className="px-3 py-2 font-semibold">Δ</th>
              <th className="px-3 py-2 font-semibold">Flag</th>
              <th className="px-3 py-2 font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-neutral-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && data?.rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-neutral-500">
                  No rows match the current filter. (If the cron hasn't run
                  yet, the Marketing_Intel tab is empty.)
                </td>
              </tr>
            )}
            {!loading &&
              data?.rows.map((r, i) => (
                <tr
                  key={`${r.timestamp}-${r.source}-${r.metric}-${i}`}
                  className="border-t border-neutral-800"
                >
                  <td className="px-3 py-2 text-neutral-300 whitespace-nowrap">
                    {formatTimestamp(r.timestamp)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-300">
                    {r.source}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-300">
                    {r.metric}
                  </td>
                  <td className="px-3 py-2 font-mono text-white">
                    {r.value || '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-neutral-500">
                    {r.previousValue || '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-neutral-400">
                    {r.delta || '—'}
                  </td>
                  <td className="px-3 py-2">
                    {r.flag && (
                      <span
                        className={`inline-block px-2 py-0.5 text-xs rounded border ${flagBadgeClass(r.flag)}`}
                      >
                        {r.flag}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-400 max-w-xs truncate" title={r.notes}>
                    {r.notes}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="text-xs text-neutral-500 mt-3">
          Showing {data.rows.length} of {data.total} rows. Cron path:{' '}
          <code>/api/cron/marketing-intel</code> (parked — see vercel.json
          _disabledCrons).
        </div>
      )}
    </div>
  );
}
