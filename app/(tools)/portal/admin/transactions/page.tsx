'use client';

/**
 * Transaction Browser — owner/admin/office view of every QuickBooks
 * transaction since 2018. Search by anything (R-number, customer, vendor,
 * rep, check #), filter by date range / type / amount range. 50 hits per
 * page, server-side filtered.
 *
 * Built for Chris so he can find any transaction without opening QuickBooks.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Loader2,
  Filter,
  ChevronLeft,
  ChevronRight,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  X,
} from 'lucide-react';

interface Tx {
  date: string;
  type: string;
  num: string;
  amount: number;
  accountType: string;
  customer: string;
  vendor: string;
  salesRep: string;
  posting: boolean;
  employee?: string;
  project?: string;
}

interface Response {
  hits: Tx[];
  total: number;
  page: number;
  pageSize: number;
  totals: { netAmount: number; absTotal: number };
  facets: {
    types: Array<[string, number]>;
    reps: Array<[string, number]>;
  };
  meta: {
    generatedAt: string;
    source: string;
    totalTransactions: number;
    dateRange: { earliest: string; latest: string };
  };
}

function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function fmtMoneyExact(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n);
}

export default function TransactionsPage() {
  // Filters
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [rep, setRep] = useState('');
  const [customer, setCustomer] = useState('');
  const [vendor, setVendor] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Data
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (type) params.set('type', type);
      if (rep) params.set('rep', rep);
      if (customer) params.set('customer', customer);
      if (vendor) params.set('vendor', vendor);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (minAmount) params.set('minAmount', minAmount);
      if (maxAmount) params.set('maxAmount', maxAmount);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const res = await fetch(`/api/portal/admin/transactions?${params}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [q, type, rep, customer, vendor, from, to, minAmount, maxAmount, page]);

  // Debounced search on filter change
  useEffect(() => {
    const id = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(id);
  }, [fetchData]);

  const clearAll = () => {
    setQ(''); setType(''); setRep(''); setCustomer(''); setVendor('');
    setFrom(''); setTo(''); setMinAmount(''); setMaxAmount(''); setPage(1);
  };

  const totalPages = useMemo(
    () => (data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1),
    [data],
  );

  const activeFilters =
    [q, type, rep, customer, vendor, from, to, minAmount, maxAmount].filter(Boolean).length;

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
            <DollarSign className="w-5 h-5 text-[#39FF14]" />
            Transaction Browser
          </h1>
          {data?.meta && (
            <span className="text-xs text-zinc-500 ml-auto">
              {data.meta.totalTransactions.toLocaleString()} transactions ·{' '}
              {data.meta.dateRange.earliest} → {data.meta.dateRange.latest} ·{' '}
              pulled {data.meta.generatedAt}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Filter bar */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#39FF14]" />
              Filters {activeFilters > 0 && <span className="text-xs text-zinc-400">({activeFilters} active)</span>}
            </h2>
            {activeFilters > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>

          {/* Universal search */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1); }}
              placeholder="Search across check #, customer, vendor, rep, project, account…"
              className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            <select
              value={type}
              onChange={e => { setType(e.target.value); setPage(1); }}
              className="px-2 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
            >
              <option value="">All types</option>
              {data?.facets.types.map(([t, n]) => (
                <option key={t} value={t}>{t} ({n})</option>
              ))}
            </select>
            <input
              type="text"
              value={rep}
              onChange={e => { setRep(e.target.value); setPage(1); }}
              placeholder="Sales rep"
              className="px-2 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
            />
            <input
              type="text"
              value={customer}
              onChange={e => { setCustomer(e.target.value); setPage(1); }}
              placeholder="Customer"
              className="px-2 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
            />
            <input
              type="text"
              value={vendor}
              onChange={e => { setVendor(e.target.value); setPage(1); }}
              placeholder="Vendor"
              className="px-2 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
            />
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-zinc-500 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={from}
                onChange={e => { setFrom(e.target.value); setPage(1); }}
                className="w-full pl-7 pr-2 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
              />
            </div>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-zinc-500 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={to}
                onChange={e => { setTo(e.target.value); setPage(1); }}
                className="w-full pl-7 pr-2 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <input
              type="number"
              value={minAmount}
              onChange={e => { setMinAmount(e.target.value); setPage(1); }}
              placeholder="Min amount"
              className="px-2 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
            />
            <input
              type="number"
              value={maxAmount}
              onChange={e => { setMaxAmount(e.target.value); setPage(1); }}
              placeholder="Max amount"
              className="px-2 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
            />
          </div>
        </section>

        {/* Result totals */}
        {data && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">Matching txns</div>
              <div className="text-xl font-bold mt-1">{data.total.toLocaleString()}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">Net (signed)</div>
              <div className={`text-xl font-bold mt-1 ${data.totals.netAmount >= 0 ? 'text-[#39FF14]' : 'text-red-400'}`}>
                {fmtMoney(data.totals.netAmount)}
              </div>
              <div className="text-[10px] text-zinc-500">{fmtMoneyExact(data.totals.netAmount)}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">Absolute total</div>
              <div className="text-xl font-bold mt-1">{fmtMoney(data.totals.absTotal)}</div>
              <div className="text-[10px] text-zinc-500">{fmtMoneyExact(data.totals.absTotal)}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">Page</div>
              <div className="text-xl font-bold mt-1">{data.page} / {totalPages}</div>
            </div>
          </section>
        )}

        {/* Results table */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {error && (
            <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/30 text-red-300 text-sm">
              {error}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                <tr>
                  <th className="text-left py-2 px-3 font-medium">Date</th>
                  <th className="text-left py-2 px-3 font-medium">Type</th>
                  <th className="text-left py-2 px-3 font-medium">#</th>
                  <th className="text-right py-2 px-3 font-medium">Amount</th>
                  <th className="text-left py-2 px-3 font-medium">Customer / Vendor</th>
                  <th className="text-left py-2 px-3 font-medium">Rep</th>
                  <th className="text-left py-2 px-3 font-medium">Account</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {loading && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-zinc-500">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      Searching {(data?.meta.totalTransactions || 56000).toLocaleString()} transactions…
                    </td>
                  </tr>
                )}
                {!loading && data && data.hits.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-zinc-500">
                      No matches. Try widening the filters.
                    </td>
                  </tr>
                )}
                {!loading && data?.hits.map((t, i) => (
                  <tr key={`${t.date}-${t.type}-${t.num}-${i}`} className="hover:bg-zinc-800/40">
                    <td className="py-2 px-3 font-mono text-xs text-zinc-300">{t.date}</td>
                    <td className="py-2 px-3 text-xs">{t.type}</td>
                    <td className="py-2 px-3 font-mono text-xs text-zinc-400">{t.num || '—'}</td>
                    <td className={`py-2 px-3 text-right tabular-nums ${t.amount >= 0 ? 'text-[#39FF14]' : 'text-red-400'}`}>
                      {fmtMoneyExact(t.amount)}
                    </td>
                    <td className="py-2 px-3">
                      {t.customer && <div className="text-zinc-200">{t.customer}</div>}
                      {t.vendor && <div className="text-zinc-400 text-xs">{t.vendor}</div>}
                      {t.employee && <div className="text-zinc-500 text-xs">emp: {t.employee}</div>}
                      {!t.customer && !t.vendor && !t.employee && <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="py-2 px-3 text-xs">{t.salesRep || <span className="text-zinc-600">—</span>}</td>
                    <td className="py-2 px-3 text-xs text-zinc-400">{t.accountType || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 text-sm">
              <div className="text-zinc-400">
                Showing {(data.page - 1) * data.pageSize + 1}-
                {Math.min(data.page * data.pageSize, data.total)} of {data.total.toLocaleString()}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <span className="text-zinc-400">{data.page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
