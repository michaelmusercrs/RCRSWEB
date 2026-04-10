'use client';

/**
 * RCRS Command Center - Commission Reconciliation Report
 *
 * Owner/admin-only. Shows a date-filterable report of all commission payouts
 * grouped by sales rep. Designed for Chris & Michael to reconcile payroll.
 *
 * Data source: /api/portal/reports/commissions (reads data/commissions.json)
 *
 * Features:
 *  - Date range picker (defaults to current month)
 *  - Summary cards: total paid, reps counted, avg per rep, total transactions
 *  - Table by rep with expandable rows showing individual transactions
 *  - CSV export
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  DollarSign,
  Users,
  BarChart3,
  Calendar,
  Download,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

// =============================================================================
// Types
// =============================================================================

interface RowOut {
  date: string;
  parsedDate: string;
  salesRep: string;
  amount: number;
  balance: number;
  jobNumber: string;
  customer: string;
}

interface ByRepEntry {
  repName: string;
  jobCount: number;
  earned: number;
  paid: number;
  outstanding: number;
  rows: RowOut[];
}

interface ReportSummary {
  totalPaid: number;
  repCount: number;
  avgPerRep: number;
  totalTransactions: number;
}

interface ReportData {
  summary: ReportSummary;
  byRep: ByRepEntry[];
  rawRows: RowOut[];
  dateRange: { from: string; to: string };
}

// =============================================================================
// Helpers
// =============================================================================

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCompact(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function prettyIsoDate(iso: string): string {
  if (!iso) return '--';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function defaultDateRange() {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const to = now.toISOString().slice(0, 10);
  return { from, to };
}

// =============================================================================
// Page
// =============================================================================

export default function CommissionReconciliationPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [dateFrom, setDateFrom] = useState(defaultDateRange().from);
  const [dateTo, setDateTo] = useState(defaultDateRange().to);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRep, setExpandedRep] = useState<string | null>(null);

  // Auth gate — owner/admin only
  useEffect(() => {
    if (!authLoading && user && user.role !== 'owner' && user.role !== 'admin') {
      router.replace('/portal/dashboard');
    }
    if (!authLoading && !user) router.replace('/portal/login');
  }, [authLoading, user, router]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo });
      const res = await fetch(`/api/portal/reports/commissions?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Admin access required');
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Report failed');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (user) loadReport();
  }, [user, loadReport]);

  // CSV export
  const exportCSV = () => {
    if (!data) return;
    const header = 'Date,Sales Rep,Job #,Customer,Amount,Balance\n';
    const csvRows = data.rawRows.map(r =>
      [
        r.parsedDate,
        `"${r.salesRep.replace(/"/g, '""')}"`,
        `"${r.jobNumber.replace(/"/g, '""')}"`,
        `"${r.customer.replace(/"/g, '""')}"`,
        r.amount.toFixed(2),
        r.balance.toFixed(2),
      ].join(','),
    );
    const blob = new Blob([header + csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `commission-reconciliation-${dateFrom}-to-${dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
          backgroundSize: '50px 50px',
        }} />
      </div>

      <div className="relative z-10 pb-24">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link
                  href="/command-center/reports"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={20} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    Commission Reconciliation
                  </h1>
                  <p className="text-xs text-neutral-400">Payroll reconciliation by rep and period</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadReport}
                  disabled={loading}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                  title="Refresh"
                >
                  <RefreshCw size={16} className={`text-neutral-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={exportCSV}
                  disabled={!data || data.rawRows.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-green/10 hover:bg-brand-green/20 text-brand-green text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Download size={14} /> CSV
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          {/* Date range picker */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 sm:p-5 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 sm:gap-4">
              <div>
                <label className="text-xs font-medium text-neutral-400 flex items-center gap-1 mb-1">
                  <Calendar size={12} /> From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 flex items-center gap-1 mb-1">
                  <Calendar size={12} /> To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green transition-colors"
                />
              </div>
              <button
                onClick={loadReport}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-brand-green text-black text-sm font-semibold hover:bg-brand-green/90 transition-colors disabled:opacity-50"
              >
                Apply
              </button>
              <div className="flex gap-2 ml-auto">
                {(['This Month', 'Last Month', 'This Quarter', 'YTD'] as const).map(preset => (
                  <button
                    key={preset}
                    onClick={() => {
                      const now = new Date();
                      const y = now.getFullYear();
                      const m = now.getMonth();
                      if (preset === 'This Month') {
                        setDateFrom(`${y}-${String(m + 1).padStart(2, '0')}-01`);
                        setDateTo(now.toISOString().slice(0, 10));
                      } else if (preset === 'Last Month') {
                        const lm = m === 0 ? 11 : m - 1;
                        const ly = m === 0 ? y - 1 : y;
                        const lastDay = new Date(ly, lm + 1, 0).getDate();
                        setDateFrom(`${ly}-${String(lm + 1).padStart(2, '0')}-01`);
                        setDateTo(`${ly}-${String(lm + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
                      } else if (preset === 'This Quarter') {
                        const qStart = Math.floor(m / 3) * 3;
                        setDateFrom(`${y}-${String(qStart + 1).padStart(2, '0')}-01`);
                        setDateTo(now.toISOString().slice(0, 10));
                      } else {
                        setDateFrom(`${y}-01-01`);
                        setDateTo(now.toISOString().slice(0, 10));
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-medium text-neutral-400 hover:text-white transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl px-4 py-3 border bg-red-500/10 border-red-500/30 text-red-400 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Summary cards */}
          {data && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <SummaryCard
                icon={<DollarSign size={18} className="text-brand-green" />}
                label="Total Commissions Paid"
                value={formatCompact(data.summary.totalPaid)}
              />
              <SummaryCard
                icon={<Users size={18} className="text-blue-400" />}
                label="Reps Counted"
                value={String(data.summary.repCount)}
              />
              <SummaryCard
                icon={<BarChart3 size={18} className="text-purple-400" />}
                label="Avg per Rep"
                value={formatCompact(data.summary.avgPerRep)}
              />
              <SummaryCard
                icon={<FileText size={18} className="text-yellow-400" />}
                label="Total Transactions"
                value={String(data.summary.totalTransactions)}
              />
            </div>
          )}

          {/* By-rep table */}
          {data && data.byRep.length > 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
              <div className="px-4 sm:px-5 py-3 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">By Sales Rep</h2>
                <span className="text-xs text-neutral-500">
                  {prettyIsoDate(data.dateRange.from)} - {prettyIsoDate(data.dateRange.to)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-neutral-500 text-xs border-b border-white/5">
                      <th className="px-4 py-2 w-8"></th>
                      <th className="px-4 py-2 font-medium">Rep Name</th>
                      <th className="px-4 py-2 font-medium text-right">Jobs</th>
                      <th className="px-4 py-2 font-medium text-right">Earned</th>
                      <th className="px-4 py-2 font-medium text-right">Paid</th>
                      <th className="px-4 py-2 font-medium text-right">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byRep.map(rep => (
                      <RepRow
                        key={rep.repName}
                        rep={rep}
                        expanded={expandedRep === rep.repName}
                        onToggle={() =>
                          setExpandedRep(prev => (prev === rep.repName ? null : rep.repName))
                        }
                      />
                    ))}
                    {/* Totals row */}
                    <tr className="bg-white/[0.02] border-t border-white/10">
                      <td className="px-4 py-2.5"></td>
                      <td className="px-4 py-2.5 text-white font-semibold">TOTAL</td>
                      <td className="px-4 py-2.5 text-right text-white font-semibold">
                        {data.summary.totalTransactions}
                      </td>
                      <td className="px-4 py-2.5 text-right text-white font-semibold">--</td>
                      <td className="px-4 py-2.5 text-right text-brand-green font-semibold">
                        {formatCurrency(data.summary.totalPaid)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-yellow-400 font-semibold">
                        {formatCurrency(
                          data.byRep.reduce((sum, r) => sum + r.outstanding, 0),
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data && data.byRep.length === 0 && !loading && (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 text-center text-neutral-500 text-sm">
              No commission records in this date range.
            </div>
          )}

          {loading && !data && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-brand-green" size={32} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">{icon}</div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}

function RepRow({
  rep,
  expanded,
  onToggle,
}: {
  rep: ByRepEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer transition-colors"
      >
        <td className="px-4 py-2.5 text-neutral-400">
          {expanded ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </td>
        <td className="px-4 py-2.5 text-white font-medium">{rep.repName}</td>
        <td className="px-4 py-2.5 text-right text-neutral-300">{rep.jobCount}</td>
        <td className="px-4 py-2.5 text-right text-neutral-200">
          {formatCurrency(rep.earned)}
        </td>
        <td className="px-4 py-2.5 text-right text-brand-green font-medium">
          {formatCurrency(rep.paid)}
        </td>
        <td className="px-4 py-2.5 text-right text-yellow-400">
          {rep.outstanding > 0 ? formatCurrency(rep.outstanding) : '--'}
        </td>
      </tr>
      {expanded &&
        rep.rows.map((row, idx) => (
          <tr
            key={`${row.parsedDate}-${idx}`}
            className="bg-white/[0.01] border-b border-white/5 text-xs"
          >
            <td className="px-4 py-1.5"></td>
            <td className="px-4 py-1.5 text-neutral-500 pl-8">
              {prettyIsoDate(row.parsedDate)}
            </td>
            <td className="px-4 py-1.5 text-neutral-500 text-right font-mono">
              {row.jobNumber || '--'}
            </td>
            <td className="px-4 py-1.5 text-neutral-400 text-right max-w-[200px] truncate">
              {row.customer || '--'}
            </td>
            <td className="px-4 py-1.5 text-right text-neutral-200">
              {formatCurrency(row.amount)}
            </td>
            <td className="px-4 py-1.5 text-right text-neutral-400">
              {row.balance > 0 ? formatCurrency(row.balance) : '--'}
            </td>
          </tr>
        ))}
    </>
  );
}
