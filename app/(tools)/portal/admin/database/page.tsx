'use client';

/**
 * Admin Database Dashboard
 *
 * One place for Chris (and any owner/admin/office/manager) to find ANY
 * data in the company: transactions, customers, vendors, sales reps,
 * commissions, and lifetime financials. Each tab is a server-filtered
 * paginated search over the aggregated data files.
 *
 * Sub-pages still exist for deeper drill-downs:
 *   /portal/admin/transactions      — full transaction ledger filters
 *   /portal/customer-breakdowns     — per-job P&L
 *   /command-center/finance/reports — multi-month finance dashboard
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Loader2,
  Database,
  Users,
  Truck,
  UserCheck,
  DollarSign,
  TrendingUp,
  Briefcase,
  Receipt,
  Building2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

type TabId = 'overview' | 'customers' | 'vendors' | 'reps' | 'commissions';

interface OverviewData {
  meta: {
    generatedAt: string;
    source: string;
    totalTransactions: number;
    dateRange: { earliest: string; latest: string };
  };
  lifetime: {
    totalIncome: number;
    grossProfit: number;
    grossMargin: number;
    netIncome: number;
    accountsReceivable: number;
    cashOnHand: number;
    assets: number;
    liabilities: number;
    equity: number;
  };
  counts: {
    transactions: number;
    customers: number;
    vendors: number;
    reps: number;
    commissionRows: number;
    months: number;
  };
  last12: Array<{ month: string; netRevenue: number; expense: number; invoiceCount: number }>;
  last12Revenue: number;
  last12Expense: number;
}

interface Customer { customer: string; total: number; invoiceCount: number; }
interface Vendor { vendor: string; total: number; txCount: number; }
interface Rep {
  rep: string; invoiceTotal: number; invoiceCount: number; avgInvoice: number;
  commissionTotal: number; commissionCount: number;
}
interface CommissionRow {
  salesRep: string; date: string; amount: number; balance?: number;
  jobNumber?: string; customer?: string;
}

function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}
function fmtMoneyExact(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
function fmtPercent(n: number, frac = false): string {
  const v = frac ? n * 100 : n;
  return `${v.toFixed(1)}%`;
}

export default function AdminDatabasePage() {
  const [tab, setTab] = useState<TabId>('overview');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Per-tab data caches
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [customers, setCustomers] = useState<{ rows: Customer[]; total: number } | null>(null);
  const [vendors, setVendors] = useState<{ rows: Vendor[]; total: number } | null>(null);
  const [reps, setReps] = useState<{ rows: Rep[]; total: number } | null>(null);
  const [commissionsData, setCommissionsData] = useState<{ rows: CommissionRow[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type: tab });
      if (q) params.set('q', q);
      if (tab !== 'overview') {
        params.set('page', String(page));
        params.set('pageSize', String(pageSize));
      }
      const res = await fetch(`/api/portal/admin/database?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      switch (tab) {
        case 'overview': setOverview(data); break;
        case 'customers': setCustomers(data); break;
        case 'vendors': setVendors(data); break;
        case 'reps': setReps(data); break;
        case 'commissions': setCommissionsData(data); break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [tab, q, page]);

  // Debounced refetch when query/tab/page changes
  useEffect(() => {
    const id = setTimeout(fetchData, 250);
    return () => clearTimeout(id);
  }, [fetchData]);

  // Reset page when tab or query changes
  useEffect(() => { setPage(1); }, [tab, q]);

  const currentData = useMemo(() => {
    switch (tab) {
      case 'customers': return customers;
      case 'vendors': return vendors;
      case 'reps': return reps;
      case 'commissions': return commissionsData;
      default: return null;
    }
  }, [tab, customers, vendors, reps, commissionsData]);

  const totalPages = currentData
    ? Math.max(1, Math.ceil(currentData.total / pageSize))
    : 1;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <Link
            href="/portal/admin"
            className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Database className="w-5 h-5 text-[#39FF14]" />
            Database Dashboard
          </h1>
          {overview?.meta && (
            <span className="text-xs text-zinc-500 ml-auto">
              {overview.meta.totalTransactions.toLocaleString()} txns ·{' '}
              {overview.meta.dateRange.earliest} → {overview.meta.dateRange.latest} ·{' '}
              refreshed {overview.meta.generatedAt}
            </span>
          )}
        </div>
      </header>

      {/* Tabs */}
      <nav className="border-b border-zinc-800 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap gap-1">
          {[
            { id: 'overview' as TabId, label: 'Overview', icon: TrendingUp },
            { id: 'customers' as TabId, label: 'Customers', icon: Users },
            { id: 'vendors' as TabId, label: 'Vendors', icon: Truck },
            { id: 'reps' as TabId, label: 'Sales Reps', icon: UserCheck },
            { id: 'commissions' as TabId, label: 'Commissions', icon: DollarSign },
          ].map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setQ(''); }}
                className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 -mb-px transition-colors ${
                  active
                    ? 'border-[#39FF14] text-[#39FF14]'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2 py-2">
            <Link
              href="/portal/admin/transactions"
              className="flex items-center gap-1 text-xs text-zinc-400 hover:text-[#39FF14]"
            >
              Transaction Browser <ExternalLink className="w-3 h-3" />
            </Link>
            <span className="text-zinc-700">·</span>
            <Link
              href="/command-center/finance/reports"
              className="flex items-center gap-1 text-xs text-zinc-400 hover:text-[#39FF14]"
            >
              Finance Reports <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {error && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* ─── OVERVIEW ─────────────────────────────────────────── */}
        {tab === 'overview' && (
          <>
            {!overview && loading && (
              <div className="text-center py-12 text-zinc-500">
                <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                Loading overview…
              </div>
            )}
            {overview && (
              <>
                {/* Lifetime KPIs */}
                <section>
                  <h2 className="text-sm font-semibold text-[#39FF14] uppercase tracking-wide mb-2">
                    Lifetime — All Time
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KpiCard label="Revenue" value={fmtMoney(overview.lifetime.totalIncome)} sub={fmtMoneyExact(overview.lifetime.totalIncome)} highlight />
                    <KpiCard label="Gross Profit" value={fmtMoney(overview.lifetime.grossProfit)} sub={`${fmtPercent(overview.lifetime.grossMargin, true)} margin`} />
                    <KpiCard label="Net Income" value={fmtMoney(overview.lifetime.netIncome)} sub={fmtMoneyExact(overview.lifetime.netIncome)} negative={overview.lifetime.netIncome < 0} />
                    <KpiCard label="A/R Outstanding" value={fmtMoney(overview.lifetime.accountsReceivable)} sub={fmtMoneyExact(overview.lifetime.accountsReceivable)} />
                  </div>
                </section>

                {/* Balance Sheet KPIs */}
                <section>
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                    Balance Sheet
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KpiCard label="Cash on Hand" value={fmtMoney(overview.lifetime.cashOnHand)} />
                    <KpiCard label="Total Assets" value={fmtMoney(overview.lifetime.assets)} />
                    <KpiCard label="Liabilities" value={fmtMoney(overview.lifetime.liabilities)} />
                    <KpiCard label="Equity" value={fmtMoney(overview.lifetime.equity)} />
                  </div>
                </section>

                {/* Last 12 months */}
                <section>
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                    Last 12 Months · Revenue {fmtMoney(overview.last12Revenue)} · Expense {fmtMoney(overview.last12Expense)}
                  </h2>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                        <tr>
                          <th className="text-left py-2 px-3 font-medium">Month</th>
                          <th className="text-right py-2 px-3 font-medium">Revenue</th>
                          <th className="text-right py-2 px-3 font-medium">Expense</th>
                          <th className="text-right py-2 px-3 font-medium">Net</th>
                          <th className="text-right py-2 px-3 font-medium">Invoices</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {overview.last12.map(m => {
                          const net = m.netRevenue - m.expense;
                          return (
                            <tr key={m.month} className="hover:bg-zinc-800/30">
                              <td className="py-2 px-3 font-mono text-xs text-zinc-300">{m.month}</td>
                              <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{fmtMoneyExact(m.netRevenue)}</td>
                              <td className="py-2 px-3 text-right tabular-nums text-red-400">{fmtMoneyExact(m.expense)}</td>
                              <td className={`py-2 px-3 text-right tabular-nums ${net >= 0 ? 'text-white' : 'text-red-400'}`}>{fmtMoneyExact(net)}</td>
                              <td className="py-2 px-3 text-right text-zinc-400">{m.invoiceCount}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Record counts */}
                <section>
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                    Data Catalog
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    <Catalog label="Transactions" count={overview.counts.transactions} icon={Receipt} onClick={() => setTab('overview')} extra="(see Browser)" />
                    <Catalog label="Customers" count={overview.counts.customers} icon={Users} onClick={() => setTab('customers')} extra="top 200" />
                    <Catalog label="Vendors" count={overview.counts.vendors} icon={Building2} onClick={() => setTab('vendors')} extra="top 200" />
                    <Catalog label="Sales Reps" count={overview.counts.reps} icon={UserCheck} onClick={() => setTab('reps')} />
                    <Catalog label="Commissions" count={overview.counts.commissionRows} icon={DollarSign} onClick={() => setTab('commissions')} />
                    <Catalog label="Months" count={overview.counts.months} icon={Briefcase} extra="of data" />
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {/* ─── SEARCH + TABLE TABS ──────────────────────────────── */}
        {tab !== 'overview' && (
          <>
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder={`Search ${tab}…`}
                className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
              />
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                {tab === 'customers' && (
                  <Table
                    columns={['Customer', 'Lifetime invoiced', 'Invoices']}
                    rows={(customers?.rows || []).map((c, i) => [
                      <span key={i} className="font-medium">{c.customer}</span>,
                      <span key={i + 'a'} className="tabular-nums text-[#39FF14]">{fmtMoneyExact(c.total)}</span>,
                      <span key={i + 'b'} className="text-zinc-400">{c.invoiceCount}</span>,
                    ])}
                    loading={loading}
                    total={customers?.total}
                  />
                )}
                {tab === 'vendors' && (
                  <Table
                    columns={['Vendor', 'Lifetime spend', 'Transactions']}
                    rows={(vendors?.rows || []).map((v, i) => [
                      <span key={i} className="font-medium">{v.vendor}</span>,
                      <span key={i + 'a'} className="tabular-nums text-red-300">{fmtMoneyExact(v.total)}</span>,
                      <span key={i + 'b'} className="text-zinc-400">{v.txCount}</span>,
                    ])}
                    loading={loading}
                    total={vendors?.total}
                  />
                )}
                {tab === 'reps' && (
                  <Table
                    columns={['Rep', 'Lifetime invoiced', 'Invoices', 'Avg invoice', 'Commission paid', 'Comm txns']}
                    rows={(reps?.rows || []).map((r, i) => [
                      <span key={i} className="font-medium">{r.rep}</span>,
                      <span key={i + 'a'} className="tabular-nums text-[#39FF14]">{fmtMoneyExact(r.invoiceTotal)}</span>,
                      <span key={i + 'b'} className="text-zinc-400">{r.invoiceCount}</span>,
                      <span key={i + 'c'} className="tabular-nums text-zinc-300">{fmtMoneyExact(r.avgInvoice)}</span>,
                      <span key={i + 'd'} className="tabular-nums text-amber-300">{fmtMoneyExact(r.commissionTotal)}</span>,
                      <span key={i + 'e'} className="text-zinc-400">{r.commissionCount}</span>,
                    ])}
                    loading={loading}
                    total={reps?.total}
                  />
                )}
                {tab === 'commissions' && (
                  <Table
                    columns={['Date', 'Rep', 'Amount', 'Check #', 'Customer / Entity']}
                    rows={(commissionsData?.rows || []).map((c, i) => [
                      <span key={i} className="font-mono text-xs text-zinc-300">{c.date}</span>,
                      <span key={i + 'a'} className="font-medium">{c.salesRep}</span>,
                      <span key={i + 'b'} className={`tabular-nums ${c.amount >= 0 ? 'text-[#39FF14]' : 'text-red-400'}`}>{fmtMoneyExact(c.amount)}</span>,
                      <span key={i + 'c'} className="font-mono text-xs text-zinc-400">{c.jobNumber || '—'}</span>,
                      <span key={i + 'd'} className="text-zinc-300 text-xs">{c.customer || '—'}</span>,
                    ])}
                    loading={loading}
                    total={commissionsData?.total}
                  />
                )}
              </div>
              {currentData && totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 text-sm">
                  <div className="text-zinc-400">
                    Showing {(page - 1) * pageSize + 1}-
                    {Math.min(page * pageSize, currentData.total)} of {currentData.total.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1 || loading}
                      className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" /> Prev
                    </button>
                    <span className="text-zinc-400">{page} / {totalPages}</span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages || loading}
                      className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 flex items-center gap-1"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function KpiCard({
  label, value, sub, highlight, negative,
}: { label: string; value: string; sub?: string; highlight?: boolean; negative?: boolean; }) {
  return (
    <div className={`rounded-xl p-4 border ${highlight ? 'bg-gradient-to-br from-[#39FF14]/10 to-zinc-900 border-[#39FF14]/30' : 'bg-zinc-900 border-zinc-800'}`}>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${negative ? 'text-red-400' : 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}

function Catalog({
  label, count, icon: Icon, onClick, extra,
}: { label: string; count: number; icon: React.ComponentType<{ className?: string }>; onClick?: () => void; extra?: string; }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-left transition-colors ${
        onClick ? 'hover:border-[#39FF14]/40 cursor-pointer' : 'opacity-70'
      }`}
    >
      <div className="flex items-center gap-2 text-zinc-400">
        <Icon className="w-4 h-4" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-xl font-bold text-white mt-1">{count.toLocaleString()}</div>
      {extra && <div className="text-[10px] text-zinc-500 mt-0.5">{extra}</div>}
    </button>
  );
}

function Table({
  columns, rows, loading, total,
}: {
  columns: string[];
  rows: React.ReactNode[][];
  loading: boolean;
  total?: number;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
        <tr>
          {columns.map(c => (
            <th key={c} className={`py-2 px-3 font-medium ${/total|invoice|spend|commission|avg|amount|count/i.test(c) ? 'text-right' : 'text-left'}`}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-800">
        {loading && (
          <tr>
            <td colSpan={columns.length} className="py-6 text-center text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
              Loading…
            </td>
          </tr>
        )}
        {!loading && rows.length === 0 && (
          <tr>
            <td colSpan={columns.length} className="py-6 text-center text-zinc-500">
              No matches{typeof total === 'number' && total > 0 ? ' on this page' : ''}.
            </td>
          </tr>
        )}
        {!loading && rows.map((row, idx) => (
          <tr key={idx} className="hover:bg-zinc-800/30">
            {row.map((cell, cidx) => (
              <td
                key={cidx}
                className={`py-2 px-3 ${cidx === 0 ? 'text-left' : 'text-right'}`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
