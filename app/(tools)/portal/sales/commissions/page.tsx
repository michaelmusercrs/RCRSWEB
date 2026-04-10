'use client';

/**
 * RCRS Sales Portal - My Commissions
 *
 * Shows the logged-in sales rep's commission history from data/commissions.json
 * (via /api/portal/sales/my-commissions). Summary cards for YTD, this month,
 * and this quarter, plus a full transaction table.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  DollarSign,
  Calendar,
  TrendingUp,
  Clock,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

// =============================================================================
// Types
// =============================================================================

interface CommissionRow {
  date: string;
  parsedDate: string;
  amount: number;
  balance: number;
  jobNumber: string;
  customer: string;
  status: 'paid' | 'pending' | 'zero';
}

interface Summary {
  ytd: number;
  month: number;
  quarter: number;
  lastPayoutDate: string;
  totalCount: number;
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

// =============================================================================
// Page
// =============================================================================

export default function MyCommissionsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [summary, setSummary] = useState<Summary>({
    ytd: 0, month: 0, quarter: 0, lastPayoutDate: '', totalCount: 0,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/portal/login');
  }, [isLoading, user, router]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/sales/my-commissions', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load commissions');
      setRows(data.rows || []);
      setSummary(data.summary || { ytd: 0, month: 0, quarter: 0, lastPayoutDate: '', totalCount: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load commissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (isLoading || !user) {
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
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link
                  href="/portal/sales"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={20} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    My Commissions
                  </h1>
                  <p className="text-xs text-neutral-400">
                    {summary.totalCount > 0
                      ? `${summary.totalCount} total transactions`
                      : 'Your commission history'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadData}
                  disabled={loading}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                  title="Refresh"
                >
                  <RefreshCw
                    size={16}
                    className={`text-neutral-400 ${loading ? 'animate-spin' : ''}`}
                  />
                </button>
                <Link
                  href="/command-center/sales/leaderboard"
                  className="hidden sm:flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-neutral-300 transition-colors"
                >
                  Full history <ExternalLink size={12} />
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          {error && (
            <div className="mb-4 rounded-xl px-4 py-3 border bg-red-500/10 border-red-500/30 text-red-400 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <SummaryCard
              icon={<DollarSign size={18} className="text-brand-green" />}
              label="YTD"
              value={formatCompact(summary.ytd)}
            />
            <SummaryCard
              icon={<TrendingUp size={18} className="text-blue-400" />}
              label="This Month"
              value={formatCompact(summary.month)}
            />
            <SummaryCard
              icon={<Calendar size={18} className="text-purple-400" />}
              label="This Quarter"
              value={formatCompact(summary.quarter)}
            />
            <SummaryCard
              icon={<Clock size={18} className="text-yellow-400" />}
              label="Last Payout"
              value={prettyIsoDate(summary.lastPayoutDate)}
              small
            />
          </div>

          {/* Table */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Commission History</h2>
              <span className="text-xs text-neutral-500">{rows.length} rows</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-500 text-xs border-b border-white/5">
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Job #</th>
                    <th className="px-4 py-2 font-medium">Customer</th>
                    <th className="px-4 py-2 font-medium text-right">Amount</th>
                    <th className="px-4 py-2 font-medium text-right">Balance</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                        <Loader2 size={18} className="animate-spin inline mr-2" />
                        Loading...
                      </td>
                    </tr>
                  )}
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-neutral-500 text-xs">
                        No commission records found for {user.name}.
                      </td>
                    </tr>
                  )}
                  {!loading && rows.map((row, idx) => (
                    <tr
                      key={`${row.parsedDate}-${idx}`}
                      className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-2.5 text-neutral-200 whitespace-nowrap">
                        {prettyIsoDate(row.parsedDate)}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-400 font-mono text-xs">
                        {row.jobNumber || '--'}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-300 max-w-xs truncate">
                        {row.customer || '--'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-white font-medium whitespace-nowrap">
                        {formatCurrency(row.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-neutral-400 whitespace-nowrap">
                        {row.balance !== 0 ? formatCurrency(row.balance) : '--'}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Full history link (mobile) */}
          <div className="sm:hidden mt-4">
            <Link
              href="/command-center/sales/leaderboard"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-neutral-300 transition-colors"
            >
              View full history <ExternalLink size={14} />
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}

// =============================================================================
// Small subcomponents
// =============================================================================

function SummaryCard({
  icon,
  label,
  value,
  small,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">{icon}</div>
      <p className={`${small ? 'text-lg' : 'text-2xl'} font-bold text-white`}>{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: 'paid' | 'pending' | 'zero' }) {
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-green/10 text-brand-green text-[10px] font-medium">
        <CheckCircle2 size={10} /> Paid
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 text-[10px] font-medium">
        <Clock size={10} /> Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-500/10 text-neutral-400 text-[10px] font-medium">
      —
    </span>
  );
}
