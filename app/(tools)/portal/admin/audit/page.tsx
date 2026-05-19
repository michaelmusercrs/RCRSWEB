'use client';

/**
 * /portal/admin/audit — AuditLog viewer.
 *
 * Admin/owner only. Reads from the AuditLog Sheets tab via
 * /api/portal/admin/audit. Filters: date range, actor (UserEmail), action
 * type, target/details search. Paginated.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Search, Filter, RefreshCw, Loader2, Shield, Calendar,
  ChevronLeft, ChevronRight, X, AlertCircle, FileText,
} from 'lucide-react';

interface AuditRow {
  Timestamp: string;
  Action: string;
  UserEmail: string;
  Details: string;
  IP: string;
  UserAgent: string;
}

interface AuditResponse {
  rows: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  distinctActions: string[];
  distinctUsers: string[];
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function AuditLogPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [target, setTarget] = useState('');
  const [startDate, setStartDate] = useState(daysAgoIso(7));
  const [endDate, setEndDate] = useState(todayIso());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (actionFilter) params.set('action', actionFilter);
      if (userFilter) params.set('userEmail', userFilter);
      if (target) params.set('target', target);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const res = await fetch(`/api/portal/admin/audit?${params.toString()}`);
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        setError(`Failed to load audit log (HTTP ${res.status})`);
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [search, actionFilter, userFilter, target, startDate, endDate, page, pageSize]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const reset = () => {
    setSearch('');
    setActionFilter('');
    setUserFilter('');
    setTarget('');
    setStartDate(daysAgoIso(7));
    setEndDate(todayIso());
    setPage(1);
  };

  const fmtTime = (t: string) => {
    try {
      return new Date(t).toLocaleString();
    } catch {
      return t;
    }
  };

  const rows = data?.rows ?? [];
  const distinctActions = data?.distinctActions ?? [];
  const distinctUsers = data?.distinctUsers ?? [];

  if (forbidden) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
          <Shield className="w-6 h-6 text-red-600 shrink-0" />
          <div>
            <h2 className="font-semibold text-red-900">Access restricted</h2>
            <p className="text-sm text-red-700 mt-1">
              The audit log is admin/owner only. If you need access, ask an admin
              to grant the appropriate role.
            </p>
            <Link href="/portal" className="inline-flex items-center gap-2 mt-3 text-sm text-red-800 underline">
              <ArrowLeft className="w-4 h-4" /> Back to portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/portal/admin" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6" /> Audit Log
            </h1>
            <p className="text-sm text-gray-500">
              {data ? `${data.total.toLocaleString()} entries · page ${data.page} of ${data.pages || 1}` : 'Loading…'}
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Filter className="w-4 h-4" /> Filters
          <button
            onClick={reset}
            className="ml-auto text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Reset
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-2.5 text-gray-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="action, email, or details"
                className="w-full pl-8 pr-3 py-2 border rounded text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
            <select
              value={actionFilter}
              onChange={e => { setActionFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border rounded text-sm bg-white"
            >
              <option value="">All actions</option>
              {distinctActions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Actor</label>
            <select
              value={userFilter}
              onChange={e => { setUserFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border rounded text-sm bg-white"
            >
              <option value="">All users</option>
              {distinctUsers.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Target / Details</label>
            <input
              value={target}
              onChange={e => { setTarget(e.target.value); setPage(1); }}
              placeholder="e.g. INV-0007 or order-id"
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Start date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> End date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Page size</label>
            <select
              value={pageSize}
              onChange={e => { setPageSize(parseInt(e.target.value)); setPage(1); }}
              className="w-full px-3 py-2 border rounded text-sm bg-white"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-3 py-2.5">Time</th>
                <th className="px-3 py-2.5">Action</th>
                <th className="px-3 py-2.5">Actor</th>
                <th className="px-3 py-2.5">Details</th>
                <th className="px-3 py-2.5 hidden md:table-cell">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && rows.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-500">
                  No audit entries match your filters.
                </td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={`${r.Timestamp}-${i}`} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">{fmtTime(r.Timestamp)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-mono bg-blue-50 text-blue-700">
                      {r.Action}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{r.UserEmail}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{r.Details}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 hidden md:table-cell">{r.IP}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="px-3 py-2 border-t bg-gray-50 flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {((data.page - 1) * data.pageSize + 1).toLocaleString()}–
              {Math.min(data.page * data.pageSize, data.total).toLocaleString()} of {data.total.toLocaleString()}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={data.page <= 1}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2">{data.page} / {data.pages}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={data.page >= data.pages}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
