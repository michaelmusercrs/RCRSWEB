'use client';

/**
 * RCRS Command Center — Finance Dashboard
 *
 * Owner / admin consolidated P&L view: Revenue - COGS - OpEx = Net at a glance.
 * Backed by GET /api/portal/reports/finance-summary.
 *
 * Styling mirrors the existing profitability report: dark zinc background,
 * #39FF14 brand accent, KPI cards, horizontal bar chart (no chart library).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Percent,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Lock,
  Calendar,
  Package,
  BarChart3,
  Briefcase,
  CreditCard,
  Building2,
  ArrowRight,
  Receipt,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

// ─── Types (mirror API contract) ────────────────────────────────────────

interface MonthBucket {
  month: string;
  revenue: number;
  profit: number;
  cogs: number;
  commissions: number;
  jobCount: number;
}

interface ApiResponse {
  success: boolean;
  range?: { from: string; to: string };
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  commissions: number;
  overhead: number;
  netProfit: number;
  inventoryValue: number;
  jobCount: number;
  monthly: MonthBucket[];
  error?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

const moneyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function fmtMoney(n: number): string {
  return moneyFmt.format(n);
}

function fmtPct(n: number): string {
  // n is 0–1 from the API
  return `${(n * 100).toFixed(1)}%`;
}

function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function monthLabel(ym: string): string {
  const [year, month] = ym.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = parseInt(month, 10);
  return `${names[m - 1] || ym} ${year}`;
}

// ─── Quick-link definitions ─────────────────────────────────────────────

interface QuickLink {
  label: string;
  href: string;
  desc: string;
  icon: React.ReactNode;
}

const QUICK_LINKS: QuickLink[] = [
  {
    label: 'Profitability by Job',
    href: '/command-center/reports/profitability',
    desc: 'Per-job profit breakdown with rep commissions',
    icon: <Briefcase className="w-5 h-5 text-[#39FF14]" />,
  },
  {
    label: 'Commission Reconciliation',
    href: '/command-center/reports/financial',
    desc: '1099 payout summary from QuickBooks',
    icon: <CreditCard className="w-5 h-5 text-blue-400" />,
  },
  {
    label: 'Inventory Cost',
    href: '/command-center/inventory',
    desc: 'Current stock levels and cost exposure',
    icon: <Package className="w-5 h-5 text-amber-400" />,
  },
  {
    label: 'Monthly Reports',
    href: '/command-center/reports',
    desc: 'All reports and trend dashboards',
    icon: <BarChart3 className="w-5 h-5 text-purple-400" />,
  },
];

// ─── Component ──────────────────────────────────────────────────────────

export default function FinanceDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();

  const [range, setRange] = useState(defaultRange);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwnerOrAdmin = !!user && (user.role === 'owner' || user.role === 'admin');

  const fetchData = useCallback(async () => {
    if (!isOwnerOrAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (range.from) params.set('from', range.from);
      if (range.to) params.set('to', range.to);
      const res = await fetch(`/api/portal/reports/finance-summary?${params.toString()}`, {
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

  // Monthly trend: take the most recent 12 months from the data
  const monthly = useMemo<MonthBucket[]>(() => {
    if (!data?.monthly) return [];
    return data.monthly.slice(-12);
  }, [data]);

  const maxMonthVal = useMemo(() => {
    return monthly.reduce((m, row) => Math.max(m, row.revenue, Math.abs(row.profit)), 1);
  }, [monthly]);

  // ─── Access gate ──────────────────────────────────────────────────────

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
            The Finance Dashboard is limited to owners and administrators.
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

  // ─── Render ───────────────────────────────────────────────────────────

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
                Finance Dashboard
              </h1>
              <p className="text-zinc-400 text-sm mt-1">
                Consolidated P&L — Revenue, COGS, overhead, and net profit at a glance.
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
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-[#39FF14] animate-spin" />
            <span className="ml-3 text-zinc-400">Loading finance data...</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium text-red-300">Failed to load finance data</div>
              <div className="text-sm text-red-400/80 mt-1 break-all">{error}</div>
            </div>
          </div>
        )}

        {data && !loading && !error && (
          <>
            {/* ============================================================ */}
            {/* Row 1 — Big KPIs (Revenue, COGS, Gross Profit, Gross Margin) */}
            {/* ============================================================ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                label="Revenue"
                value={fmtMoney(data.revenue)}
                sub={`${data.jobCount} jobs`}
                icon={<DollarSign className="w-5 h-5" />}
                tone="green"
              />
              <KpiCard
                label="COGS"
                value={fmtMoney(data.cogs)}
                sub="Material + Labor"
                icon={<Building2 className="w-5 h-5" />}
                tone="red"
              />
              <KpiCard
                label="Gross Profit"
                value={fmtMoney(data.grossProfit)}
                sub={`Rev - COGS`}
                icon={<TrendingUp className="w-5 h-5" />}
                tone={data.grossProfit >= 0 ? 'green' : 'red'}
              />
              <KpiCard
                label="Gross Margin"
                value={fmtPct(data.grossMargin)}
                sub={`GP / Revenue`}
                icon={<Percent className="w-5 h-5" />}
                tone="blue"
              />
            </div>

            {/* ============================================================ */}
            {/* Row 2 — Secondary KPIs (Commissions, Overhead, Net, Inventory) */}
            {/* ============================================================ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                label="Commissions Paid"
                value={fmtMoney(data.commissions)}
                sub="1099 payouts"
                icon={<CreditCard className="w-5 h-5" />}
                tone="white"
              />
              <KpiCard
                label="Overhead"
                value={fmtMoney(data.overhead)}
                sub="Breakdown overhead"
                icon={<Receipt className="w-5 h-5" />}
                tone="white"
              />
              <KpiCard
                label="Net Profit"
                value={fmtMoney(data.netProfit)}
                sub="Rev - COGS - Comm - OH"
                icon={<TrendingUp className="w-5 h-5" />}
                tone={data.netProfit >= 0 ? 'green' : 'red'}
              />
              <KpiCard
                label="Inventory Value"
                value={fmtMoney(data.inventoryValue)}
                sub="Current stock at cost"
                icon={<Package className="w-5 h-5" />}
                tone="blue"
              />
            </div>

            {/* ============================================================ */}
            {/* Row 3 — Quick links                                          */}
            {/* ============================================================ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {QUICK_LINKS.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:bg-zinc-800/60 hover:border-zinc-700 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    {link.icon}
                    <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-[#39FF14] transition-colors" />
                  </div>
                  <div className="font-medium text-white text-sm">{link.label}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{link.desc}</div>
                </Link>
              ))}
            </div>

            {/* ============================================================ */}
            {/* Row 4 — Monthly trend (custom bars, no lib)                   */}
            {/* ============================================================ */}
            {monthly.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-[#39FF14]" />
                    Monthly Revenue vs Net Profit
                  </h2>
                  <div className="flex items-center gap-4 text-xs text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-blue-500" />
                      Revenue
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-[#39FF14]" />
                      Net Profit
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {monthly.map(m => {
                    const profit = m.revenue - m.cogs - m.commissions;
                    const revPct = maxMonthVal > 0 ? (m.revenue / maxMonthVal) * 100 : 0;
                    const profPct = maxMonthVal > 0 ? (Math.max(profit, 0) / maxMonthVal) * 100 : 0;
                    return (
                      <div key={m.month}>
                        <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                          <span className="font-medium text-zinc-300">
                            {monthLabel(m.month)}
                          </span>
                          <span>
                            {m.jobCount} jobs · {fmtMoney(m.revenue)} rev ·{' '}
                            <span className={profit >= 0 ? 'text-[#39FF14]' : 'text-red-400'}>
                              {fmtMoney(profit)} profit
                            </span>
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
                                profit >= 0 ? 'bg-[#39FF14]' : 'bg-red-500'
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

            {monthly.length === 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
                <BarChart3 className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                <div className="text-white font-medium mb-1">No monthly data</div>
                <div className="text-zinc-400 text-sm">
                  No job breakdowns with install dates in the selected range. Try a wider window.
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone: 'green' | 'red' | 'blue' | 'white';
}

function KpiCard({ label, value, sub, icon, tone }: KpiCardProps) {
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
        <span className="text-zinc-400 text-xs uppercase tracking-wide">{label}</span>
        <span className={toneClass}>{icon}</span>
      </div>
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}
