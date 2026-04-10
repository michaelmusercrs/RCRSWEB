'use client';

/**
 * RCRS Command Center - Job Profitability Report
 *
 * Owner/admin-only dashboard that pulls from /api/portal/reports/profitability
 * (which is itself backed by CustomerBreakdown totals) and shows:
 *
 *   - Top-line KPIs: revenue, profit, avg margin, job count
 *   - Per-rep table (sorted by total profit)
 *   - Monthly revenue-vs-profit bar chart (no chart lib — custom divs)
 *   - Sortable job detail table with margin-colored rows
 *   - CSV export of the job detail table
 *
 * The API enforces admin-only via requireAdmin(). This page also does a
 * client-side role check so non-owners see an "Access Restricted" screen
 * instead of a spinner followed by a 403. The API is the real gate.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  BarChart3,
  Briefcase,
  Percent,
  RefreshCw,
  Download,
  Loader2,
  AlertTriangle,
  Lock,
  ChevronUp,
  ChevronDown,
  Calendar,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

// ─── Types (mirror API contract) ─────────────────────────────────────────

interface JobRow {
  rNumber: string;
  customerName: string;
  salesRep: string;
  dateInstalled: string;
  status: string;
  jobTotal: number;
  materialCost: number;
  laborCost: number;
  overhead: number;
  permit: number;
  jobProfit: number;
  profitMargin: number;
  salesRepCommission: number;
  presCommission: number;
  vpCommission: number;
  companyRetained: number;
}

interface RepRow {
  salesRep: string;
  jobCount: number;
  totalRevenue: number;
  totalProfit: number;
  totalCommission: number;
  avgProfitPercent: number;
}

interface MonthRow {
  month: string;
  jobCount: number;
  revenue: number;
  profit: number;
  margin: number;
}

interface Summary {
  totalJobs: number;
  totalRevenue: number;
  totalMaterialCost: number;
  totalLaborCost: number;
  totalOverhead: number;
  totalProfit: number;
  totalRepCommission: number;
  totalPresCommission: number;
  totalVpCommission: number;
  totalCompanyRetained: number;
  avgProfitMargin: number;
  avgProfitPercentDisplay: number;
}

interface ApiResponse {
  success: boolean;
  range?: { from: string; to: string };
  summary: Summary;
  jobs: JobRow[];
  byRep: RepRow[];
  byMonth: MonthRow[];
  error?: string;
}

type JobSortField =
  | 'rNumber'
  | 'customerName'
  | 'salesRep'
  | 'dateInstalled'
  | 'jobTotal'
  | 'materialCost'
  | 'laborCost'
  | 'overhead'
  | 'jobProfit'
  | 'profitMargin'
  | 'status';
type SortDir = 'asc' | 'desc';

// ─── Helpers ─────────────────────────────────────────────────────────────

const moneyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const moneyFmtFull = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmtMoney(n: number): string {
  return moneyFmt.format(n);
}

function fmtMoneyFull(n: number): string {
  return moneyFmtFull.format(n);
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtPctRaw(n: number): string {
  return `${n.toFixed(1)}%`;
}

/** Default window: last 90 days ending today, as YYYY-MM-DD */
function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 90);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/** Row background based on margin — green >20%, yellow 10-20%, red <10% */
function marginRowClass(margin: number): string {
  if (margin >= 0.2) return 'bg-green-900/20 hover:bg-green-900/30';
  if (margin >= 0.1) return 'bg-yellow-900/20 hover:bg-yellow-900/30';
  return 'bg-red-900/20 hover:bg-red-900/30';
}

function marginTextClass(margin: number): string {
  if (margin >= 0.2) return 'text-green-400';
  if (margin >= 0.1) return 'text-yellow-400';
  return 'text-red-400';
}

/** Build a CSV string from the job rows */
function buildJobsCsv(jobs: JobRow[]): string {
  const headers = [
    'R#',
    'Customer',
    'Rep',
    'Date Installed',
    'Status',
    'Job Total',
    'Material',
    'Labor',
    'Overhead',
    'Permit',
    'Profit',
    'Margin %',
    'Rep Commission',
    'Pres Commission',
    'VP Commission',
    'Company Retained',
  ];
  const escape = (v: string | number): string => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines: string[] = [headers.map(escape).join(',')];
  for (const j of jobs) {
    lines.push(
      [
        j.rNumber,
        j.customerName,
        j.salesRep,
        j.dateInstalled,
        j.status,
        j.jobTotal.toFixed(2),
        j.materialCost.toFixed(2),
        j.laborCost.toFixed(2),
        j.overhead.toFixed(2),
        j.permit.toFixed(2),
        j.jobProfit.toFixed(2),
        (j.profitMargin * 100).toFixed(2),
        j.salesRepCommission.toFixed(2),
        j.presCommission.toFixed(2),
        j.vpCommission.toFixed(2),
        j.companyRetained.toFixed(2),
      ]
        .map(escape)
        .join(',')
    );
  }
  return lines.join('\n');
}

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Component ───────────────────────────────────────────────────────────

export default function JobProfitabilityReportPage() {
  const { user, isLoading: authLoading } = useAuth();

  const [range, setRange] = useState<{ from: string; to: string }>(defaultRange);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Job table sort state
  const [sortField, setSortField] = useState<JobSortField>('profitMargin');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const isOwnerOrAdmin =
    !!user && (user.role === 'owner' || user.role === 'admin');

  const fetchData = useCallback(async () => {
    if (!isOwnerOrAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (range.from) params.set('from', range.from);
      if (range.to) params.set('to', range.to);
      const res = await fetch(`/api/portal/reports/profitability?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const json = (await res.json()) as ApiResponse;
      if (!json.success) throw new Error(json.error || 'Request failed');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isOwnerOrAdmin, range.from, range.to]);

  useEffect(() => {
    if (!authLoading && isOwnerOrAdmin) {
      fetchData();
    }
  }, [authLoading, isOwnerOrAdmin, fetchData]);

  // Sorted job list (memoized)
  const sortedJobs = useMemo<JobRow[]>(() => {
    if (!data?.jobs) return [];
    const copy = [...data.jobs];
    copy.sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const as = String(av ?? '');
      const bs = String(bv ?? '');
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return copy;
  }, [data, sortField, sortDir]);

  const handleSort = (field: JobSortField): void => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const handleExport = (): void => {
    if (!data?.jobs || data.jobs.length === 0) return;
    const csv = buildJobsCsv(sortedJobs);
    downloadCsv(`rcrs-profitability-${range.from}-${range.to}.csv`, csv);
  };

  // ─── Access gate ───────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#39FF14] animate-spin" />
      </div>
    );
  }

  if (!isOwnerOrAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <Lock className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Restricted</h1>
          <p className="text-zinc-400 mb-6">
            The Job Profitability report is limited to owners and administrators.
            If you believe you should have access, contact Michael or Chris.
          </p>
          <Link
            href="/command-center"
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Command Center
          </Link>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────
  const summary = data?.summary;
  const byRep = data?.byRep || [];
  const byMonth = data?.byMonth || [];
  const maxMonthVal = byMonth.reduce(
    (m, row) => Math.max(m, row.revenue, row.profit),
    1
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/command-center"
              className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors"
              aria-label="Back to Command Center"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-[#39FF14]" />
                Job Profitability Report
              </h1>
              <p className="text-zinc-400 text-sm mt-1">
                Per-job profit breakdown. Owner-only view sourced from
                CustomerBreakdowns.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Date range */}
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5">
              <Calendar className="w-4 h-4 text-zinc-400" />
              <input
                type="date"
                value={range.from}
                onChange={e => setRange(prev => ({ ...prev, from: e.target.value }))}
                className="bg-transparent text-white text-sm border-none outline-none w-36"
                aria-label="From date"
              />
              <span className="text-zinc-500">to</span>
              <input
                type="date"
                value={range.to}
                onChange={e => setRange(prev => ({ ...prev, to: e.target.value }))}
                className="bg-transparent text-white text-sm border-none outline-none w-36"
                aria-label="To date"
              />
            </div>

            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              onClick={handleExport}
              disabled={!data || data.jobs.length === 0}
              className="flex items-center gap-1.5 bg-[#39FF14]/10 hover:bg-[#39FF14]/20 border border-[#39FF14]/30 text-[#39FF14] px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Loading / error / empty */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-[#39FF14] animate-spin" />
            <span className="ml-3 text-zinc-400">Loading profitability data…</span>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium text-red-300">Failed to load report</div>
              <div className="text-sm text-red-400/80 mt-1 break-all">{error}</div>
            </div>
          </div>
        )}

        {data && !loading && !error && (
          <>
            {/* ============================================================ */}
            {/* Row 1 — KPI cards                                             */}
            {/* ============================================================ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                label="Total Revenue"
                value={summary ? fmtMoney(summary.totalRevenue) : '—'}
                icon={<DollarSign className="w-5 h-5" />}
                tone="green"
              />
              <KpiCard
                label="Total Profit"
                value={summary ? fmtMoney(summary.totalProfit) : '—'}
                icon={<TrendingUp className="w-5 h-5" />}
                tone={summary && summary.totalProfit >= 0 ? 'green' : 'red'}
              />
              <KpiCard
                label="Avg Margin"
                value={summary ? fmtPct(summary.avgProfitMargin) : '—'}
                icon={<Percent className="w-5 h-5" />}
                tone="blue"
              />
              <KpiCard
                label="Jobs Counted"
                value={summary ? String(summary.totalJobs) : '—'}
                icon={<Briefcase className="w-5 h-5" />}
                tone="white"
              />
            </div>

            {/* Secondary cost/payout summary */}
            {summary && summary.totalJobs > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                <MiniStat label="Material Cost" value={fmtMoney(summary.totalMaterialCost)} />
                <MiniStat label="Labor Cost" value={fmtMoney(summary.totalLaborCost)} />
                <MiniStat label="Overhead" value={fmtMoney(summary.totalOverhead)} />
                <MiniStat
                  label="Rep Commissions"
                  value={fmtMoney(summary.totalRepCommission)}
                />
                <MiniStat
                  label="Company Retained"
                  value={fmtMoney(summary.totalCompanyRetained)}
                />
              </div>
            )}

            {/* Empty state */}
            {summary && summary.totalJobs === 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
                <BarChart3 className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                <div className="text-white font-medium mb-1">
                  No breakdowns in range
                </div>
                <div className="text-zinc-400 text-sm">
                  No CustomerBreakdowns with an install date between {range.from} and{' '}
                  {range.to}. Try expanding the date range, or create a breakdown from
                  the Customer Breakdowns tool.
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* Row 2 — By Sales Rep                                          */}
            {/* ============================================================ */}
            {byRep.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#39FF14]" />
                  Performance by Sales Rep
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-zinc-400 border-b border-zinc-800">
                        <th className="text-left py-2 px-3 font-medium">Rep</th>
                        <th className="text-right py-2 px-3 font-medium">Jobs</th>
                        <th className="text-right py-2 px-3 font-medium">Revenue</th>
                        <th className="text-right py-2 px-3 font-medium">Profit</th>
                        <th className="text-right py-2 px-3 font-medium">Commission</th>
                        <th className="text-right py-2 px-3 font-medium">
                          Avg Profit %
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {byRep.map(r => (
                        <tr
                          key={r.salesRep}
                          className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                        >
                          <td className="py-2 px-3 text-white font-medium">
                            {r.salesRep}
                          </td>
                          <td className="py-2 px-3 text-right text-zinc-300">
                            {r.jobCount}
                          </td>
                          <td className="py-2 px-3 text-right text-zinc-300">
                            {fmtMoney(r.totalRevenue)}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-medium ${
                              r.totalProfit >= 0 ? 'text-[#39FF14]' : 'text-red-400'
                            }`}
                          >
                            {fmtMoney(r.totalProfit)}
                          </td>
                          <td className="py-2 px-3 text-right text-zinc-300">
                            {fmtMoney(r.totalCommission)}
                          </td>
                          <td className="py-2 px-3 text-right text-zinc-300">
                            {fmtPctRaw(r.avgProfitPercent)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* Row 3 — Monthly trend (custom bars)                           */}
            {/* ============================================================ */}
            {byMonth.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-[#39FF14]" />
                    Monthly Revenue vs Profit
                  </h2>
                  <div className="flex items-center gap-4 text-xs text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-blue-500" />
                      Revenue
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-[#39FF14]" />
                      Profit
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {byMonth.map(m => {
                    const revPct = maxMonthVal > 0 ? (m.revenue / maxMonthVal) * 100 : 0;
                    const profPct =
                      maxMonthVal > 0 ? (Math.max(m.profit, 0) / maxMonthVal) * 100 : 0;
                    return (
                      <div key={m.month}>
                        <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                          <span className="font-medium text-zinc-300">{m.month}</span>
                          <span>
                            {m.jobCount} jobs · {fmtMoney(m.revenue)} rev ·{' '}
                            <span
                              className={
                                m.profit >= 0 ? 'text-[#39FF14]' : 'text-red-400'
                              }
                            >
                              {fmtMoney(m.profit)} profit
                            </span>{' '}
                            · {fmtPct(m.margin)} margin
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="h-3 bg-zinc-800 rounded overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all"
                              style={{ width: `${Math.min(revPct, 100)}%` }}
                            />
                          </div>
                          <div className="h-3 bg-zinc-800 rounded overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                m.profit >= 0 ? 'bg-[#39FF14]' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(profPct, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* Row 4 — Job detail table                                      */}
            {/* ============================================================ */}
            {sortedJobs.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-[#39FF14]" />
                    Job Detail ({sortedJobs.length})
                  </h2>
                  <div className="flex items-center gap-3 text-xs text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-green-500/60" />
                      <span>&gt;20%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-yellow-500/60" />
                      <span>10–20%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-red-500/60" />
                      <span>&lt;10%</span>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-zinc-400 border-b border-zinc-800">
                        <SortHeader
                          label="R#"
                          field="rNumber"
                          sortField={sortField}
                          sortDir={sortDir}
                          onSort={handleSort}
                          align="left"
                        />
                        <SortHeader
                          label="Customer"
                          field="customerName"
                          sortField={sortField}
                          sortDir={sortDir}
                          onSort={handleSort}
                          align="left"
                        />
                        <SortHeader
                          label="Rep"
                          field="salesRep"
                          sortField={sortField}
                          sortDir={sortDir}
                          onSort={handleSort}
                          align="left"
                        />
                        <SortHeader
                          label="Date"
                          field="dateInstalled"
                          sortField={sortField}
                          sortDir={sortDir}
                          onSort={handleSort}
                          align="left"
                        />
                        <SortHeader
                          label="Job Total"
                          field="jobTotal"
                          sortField={sortField}
                          sortDir={sortDir}
                          onSort={handleSort}
                          align="right"
                        />
                        <SortHeader
                          label="Material"
                          field="materialCost"
                          sortField={sortField}
                          sortDir={sortDir}
                          onSort={handleSort}
                          align="right"
                        />
                        <SortHeader
                          label="Labor"
                          field="laborCost"
                          sortField={sortField}
                          sortDir={sortDir}
                          onSort={handleSort}
                          align="right"
                        />
                        <SortHeader
                          label="Overhead"
                          field="overhead"
                          sortField={sortField}
                          sortDir={sortDir}
                          onSort={handleSort}
                          align="right"
                        />
                        <SortHeader
                          label="Profit"
                          field="jobProfit"
                          sortField={sortField}
                          sortDir={sortDir}
                          onSort={handleSort}
                          align="right"
                        />
                        <SortHeader
                          label="Margin %"
                          field="profitMargin"
                          sortField={sortField}
                          sortDir={sortDir}
                          onSort={handleSort}
                          align="right"
                        />
                        <SortHeader
                          label="Status"
                          field="status"
                          sortField={sortField}
                          sortDir={sortDir}
                          onSort={handleSort}
                          align="left"
                        />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedJobs.map(j => (
                        <tr
                          key={`${j.rNumber}-${j.customerName}`}
                          className={`border-b border-zinc-800/40 transition-colors ${marginRowClass(
                            j.profitMargin
                          )}`}
                          title={`Commissions — Rep: ${fmtMoneyFull(
                            j.salesRepCommission
                          )}, Pres: ${fmtMoneyFull(
                            j.presCommission
                          )}, VP: ${fmtMoneyFull(
                            j.vpCommission
                          )}, Company: ${fmtMoneyFull(j.companyRetained)}`}
                        >
                          <td className="py-2 px-2 text-white font-mono">{j.rNumber}</td>
                          <td className="py-2 px-2 text-white">{j.customerName}</td>
                          <td className="py-2 px-2 text-zinc-300">{j.salesRep}</td>
                          <td className="py-2 px-2 text-zinc-400">{j.dateInstalled}</td>
                          <td className="py-2 px-2 text-right text-white">
                            {fmtMoney(j.jobTotal)}
                          </td>
                          <td className="py-2 px-2 text-right text-zinc-300">
                            {fmtMoney(j.materialCost)}
                          </td>
                          <td className="py-2 px-2 text-right text-zinc-300">
                            {fmtMoney(j.laborCost)}
                          </td>
                          <td className="py-2 px-2 text-right text-zinc-300">
                            {fmtMoney(j.overhead)}
                          </td>
                          <td
                            className={`py-2 px-2 text-right font-medium ${marginTextClass(
                              j.profitMargin
                            )}`}
                          >
                            {fmtMoney(j.jobProfit)}
                          </td>
                          <td
                            className={`py-2 px-2 text-right font-medium ${marginTextClass(
                              j.profitMargin
                            )}`}
                          >
                            {fmtPct(j.profitMargin)}
                          </td>
                          <td className="py-2 px-2 text-zinc-400 capitalize">
                            {j.status.replace(/_/g, ' ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: 'green' | 'red' | 'blue' | 'white';
}

function KpiCard({ label, value, icon, tone }: KpiCardProps) {
  const toneClass =
    tone === 'green'
      ? 'text-[#39FF14]'
      : tone === 'red'
        ? 'text-red-400'
        : tone === 'blue'
          ? 'text-blue-400'
          : 'text-white';
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-zinc-400 text-xs uppercase tracking-wide">
          {label}
        </span>
        <span className={toneClass}>{icon}</span>
      </div>
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
      <div className="text-zinc-500 uppercase tracking-wide">{label}</div>
      <div className="text-white font-semibold mt-0.5">{value}</div>
    </div>
  );
}

interface SortHeaderProps {
  label: string;
  field: JobSortField;
  sortField: JobSortField;
  sortDir: SortDir;
  onSort: (field: JobSortField) => void;
  align: 'left' | 'right';
}

function SortHeader({
  label,
  field,
  sortField,
  sortDir,
  onSort,
  align,
}: SortHeaderProps) {
  const isActive = sortField === field;
  return (
    <th className={`py-2 px-2 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 hover:text-white transition-colors ${
          isActive ? 'text-[#39FF14]' : 'text-zinc-400'
        } ${align === 'right' ? 'flex-row-reverse' : ''}`}
      >
        <span>{label}</span>
        {isActive ? (
          sortDir === 'asc' ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )
        ) : (
          <ChevronDown className="w-3 h-3 opacity-30" />
        )}
      </button>
    </th>
  );
}

// Also export a layout-friendly metadata-less wrapper — this file is a
// page.tsx so Next.js handles metadata via adjacent layout.tsx if needed.
