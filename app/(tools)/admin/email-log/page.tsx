'use client';

/**
 * Email Log Viewer
 *
 * Browsable view of every email send attempt — sent + every dropped
 * status — written to the "Email Log" tab by lib/email-log.ts.
 *
 * Auth: the parent app/(tools)/admin/layout.tsx already gates every
 * page under /admin behind the admin login form + session cookie. This
 * page does not need its own gate; the API route does its own
 * requireAdmin() check as defense-in-depth.
 *
 * Data: fetched from GET /api/admin/email-log with filters as query
 * params. Auto-refreshes every 30s. Pagination is server-side: bumping
 * the limit refetches instead of loading everything client-side.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Mail,
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Filter,
  Clock,
} from 'lucide-react';

interface EmailLogRow {
  timestamp: string;
  template: string;
  to: string;
  cc: string;
  bcc: string;
  from: string;
  subject: string;
  status: string;
  error: string;
  source: string;
}

interface EmailLogResponse {
  success: boolean;
  data: {
    rows: EmailLogRow[];
    total: number;
    limit: number;
    counts: Record<string, number>;
    templates: string[];
    statuses: string[];
    configured: boolean;
  };
  error?: string;
}

type DateRange = '24h' | '7d' | '30d' | 'all';

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: '24h', label: 'Last 24h' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All' },
];

const REFRESH_MS = 30_000;

function sinceForRange(range: DateRange): string | null {
  if (range === 'all') return null;
  const now = Date.now();
  const ms =
    range === '24h' ? 24 * 60 * 60 * 1000 :
    range === '7d' ? 7 * 24 * 60 * 60 * 1000 :
    30 * 24 * 60 * 60 * 1000;
  return new Date(now - ms).toISOString();
}

function truncate(s: string, n: number): string {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '...' : s;
}

function statusBadgeClasses(status: string): string {
  if (status === 'sent') {
    return 'bg-green-500/20 text-green-400 border border-green-500/30';
  }
  if (status === 'send_failed') {
    return 'bg-red-500/20 text-red-400 border border-red-500/30';
  }
  if (status.startsWith('dropped_')) {
    return 'bg-neutral-700/40 text-neutral-300 border border-white/10';
  }
  return 'bg-white/5 text-neutral-400 border border-white/10';
}

function formatTimestamp(iso: string): { utc: string; local: string } {
  if (!iso) return { utc: '', local: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { utc: iso, local: '' };
  const utc = d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
  const local = d.toLocaleString();
  return { utc, local };
}

export default function EmailLogPage() {
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [templatesList, setTemplatesList] = useState<string[]>([]);
  const [statusesList, setStatusesList] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [templateFilter, setTemplateFilter] = useState('');
  const [recipientFilter, setRecipientFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [limit, setLimit] = useState(200);

  // Build the query string from current filter state.
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (templateFilter) params.set('template', templateFilter);
    if (recipientFilter.trim()) params.set('recipient', recipientFilter.trim());
    const since = sinceForRange(dateRange);
    if (since) params.set('since', since);
    params.set('limit', String(limit));
    return params.toString();
  }, [statusFilter, templateFilter, recipientFilter, dateRange, limit]);

  const fetchLog = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await fetch(`/api/admin/email-log?${queryString}`, {
          credentials: 'include',
        });
        const data: EmailLogResponse = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        setRows(data.data.rows);
        setCounts(data.data.counts);
        setTemplatesList(data.data.templates);
        setStatusesList(data.data.statuses);
        setTotal(data.data.total);
        setConfigured(data.data.configured);
        setError(null);
        setLastFetched(new Date());
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load email log';
        setError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [queryString],
  );

  // Initial + filter-change fetch.
  useEffect(() => {
    fetchLog(false);
  }, [fetchLog]);

  // Auto-refresh every 30s. Silent so the table doesn't flash a loader.
  useEffect(() => {
    const id = setInterval(() => {
      fetchLog(true);
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchLog]);

  const sentCount = counts['sent'] || 0;
  const droppedAllowlist =
    (counts['dropped_template_not_allowed'] || 0) +
    (counts['dropped_kill_switch'] || 0) +
    (counts['dropped_transport_not_configured'] || 0);
  const droppedRate = counts['dropped_rate_limit'] || 0;
  const failedCount = counts['send_failed'] || 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Mail className="w-8 h-8" />
            Email Log
          </h1>
          <p className="text-neutral-400 mt-1">
            Every send attempt written by <code className="text-neutral-300">lib/email-log.ts</code> &mdash;
            sent, dropped, and failed.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastFetched && (
            <span className="text-xs text-neutral-500 hidden sm:inline">
              Updated {lastFetched.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchLog(false)}
            disabled={loading || refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-neutral-300 rounded-lg transition-colors text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing || loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Unconfigured banner */}
      {!configured && !loading && (
        <div className="bg-yellow-500/10 border-l-4 border-yellow-500/40 p-4 rounded-r-lg">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-yellow-400 mr-3" />
            <div>
              <p className="text-sm font-medium text-yellow-400">
                Google Sheets credentials not configured
              </p>
              <p className="text-sm text-yellow-400">
                Set GOOGLE_SHEETS_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and
                GOOGLE_PRIVATE_KEY to read the Email Log tab.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border-l-4 border-red-500/40 p-4 rounded-r-lg">
          <div className="flex items-center">
            <XCircle className="w-5 h-5 text-red-400 mr-3" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Summary counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-neutral-900 rounded-xl border border-white/10 p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/20">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-xs text-neutral-500">Sent</p>
            <p className="text-xl font-bold text-green-400">{sentCount}</p>
          </div>
        </div>
        <div className="bg-neutral-900 rounded-xl border border-white/10 p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-neutral-700/40">
            <Filter className="w-5 h-5 text-neutral-300" />
          </div>
          <div>
            <p className="text-xs text-neutral-500">Dropped (allowlist)</p>
            <p className="text-xl font-bold text-neutral-300">{droppedAllowlist}</p>
          </div>
        </div>
        <div className="bg-neutral-900 rounded-xl border border-white/10 p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-neutral-700/40">
            <Clock className="w-5 h-5 text-neutral-300" />
          </div>
          <div>
            <p className="text-xs text-neutral-500">Dropped (rate)</p>
            <p className="text-xl font-bold text-neutral-300">{droppedRate}</p>
          </div>
        </div>
        <div className="bg-neutral-900 rounded-xl border border-white/10 p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/20">
            <XCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-xs text-neutral-500">Failed</p>
            <p className="text-xl font-bold text-red-400">{failedCount}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-neutral-900 rounded-xl border border-white/10 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:ring-2 focus:ring-brand-green focus:border-transparent"
            >
              <option value="">All statuses</option>
              {statusesList.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">Template</label>
            <select
              value={templateFilter}
              onChange={(e) => setTemplateFilter(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:ring-2 focus:ring-brand-green focus:border-transparent"
            >
              <option value="">All templates</option>
              {templatesList.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">Recipient</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-neutral-500 pointer-events-none" />
              <input
                type="text"
                value={recipientFilter}
                onChange={(e) => setRecipientFilter(e.target.value)}
                placeholder="email or domain..."
                className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-neutral-500 focus:ring-2 focus:ring-brand-green focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">Date range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:ring-2 focus:ring-brand-green focus:border-transparent"
            >
              {DATE_RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">Show</label>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:ring-2 focus:ring-brand-green focus:border-transparent"
            >
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
              <option value={200}>200 rows</option>
              <option value={500}>500 rows</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
          <span>
            Showing {rows.length} of {total} matching row{total === 1 ? '' : 's'}
            {total >= limit && ` (capped at ${limit})`}
          </span>
          <span>Auto-refreshes every 30s</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-neutral-900 rounded-xl border border-white/10 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-6 h-6 animate-spin text-neutral-500 mx-auto mb-2" />
            <p className="text-neutral-500 text-sm">Loading email log...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <p className="text-neutral-500">No log rows match these filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase text-neutral-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Timestamp</th>
                  <th className="px-3 py-2 text-left font-medium">Template</th>
                  <th className="px-3 py-2 text-left font-medium">To</th>
                  <th className="px-3 py-2 text-left font-medium">CC</th>
                  <th className="px-3 py-2 text-left font-medium">BCC</th>
                  <th className="px-3 py-2 text-left font-medium">From</th>
                  <th className="px-3 py-2 text-left font-medium">Subject</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((r, i) => {
                  const ts = formatTimestamp(r.timestamp);
                  return (
                    <tr key={`${r.timestamp}-${i}`} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2 align-top whitespace-nowrap text-neutral-300">
                        <div className="font-mono text-xs" title={ts.local}>{ts.utc}</div>
                        {ts.local && (
                          <div className="text-[10px] text-neutral-500">{ts.local}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-neutral-300">
                        {r.template || <span className="text-neutral-600">&mdash;</span>}
                      </td>
                      <td
                        className="px-3 py-2 align-top text-neutral-300 max-w-[180px] truncate"
                        title={r.to}
                      >
                        {r.to || <span className="text-neutral-600">&mdash;</span>}
                      </td>
                      <td
                        className="px-3 py-2 align-top text-neutral-400 max-w-[140px] truncate"
                        title={r.cc}
                      >
                        {r.cc || <span className="text-neutral-600">&mdash;</span>}
                      </td>
                      <td
                        className="px-3 py-2 align-top text-neutral-400 max-w-[140px] truncate"
                        title={r.bcc}
                      >
                        {r.bcc || <span className="text-neutral-600">&mdash;</span>}
                      </td>
                      <td
                        className="px-3 py-2 align-top text-neutral-400 max-w-[180px] truncate"
                        title={r.from}
                      >
                        {r.from || <span className="text-neutral-600">&mdash;</span>}
                      </td>
                      <td
                        className="px-3 py-2 align-top text-neutral-300 max-w-[320px]"
                        title={r.subject}
                      >
                        {truncate(r.subject, 60)}
                      </td>
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${statusBadgeClasses(r.status)}`}
                        >
                          {r.status || 'unknown'}
                        </span>
                      </td>
                      <td
                        className="px-3 py-2 align-top text-red-300 max-w-[260px] truncate"
                        title={r.error}
                      >
                        {r.error || <span className="text-neutral-600">&mdash;</span>}
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
