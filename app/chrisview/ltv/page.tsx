'use client';

import { useState, useEffect } from 'react';
import { Heart, ArrowLeft, Loader2, Repeat, Calendar } from 'lucide-react';
import AboutThisData from '@/components/AboutThisData';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ComposedChart, Line } from 'recharts';

interface Cust {
  customer: string;
  total: number;
  invoiceCount: number;
  firstDate: string;
  lastDate: string;
  daysAsCustomer: number;
  avgInvoice: number;
  recentInvoices: number;
  isRepeat: boolean;
  reps: string[];
}

interface Cohort {
  year: string;
  customers: number;
  totalRevenue: number;
  repeatCount: number;
  repeatRate: number;
  avgPerCustomer: number;
}

interface Data {
  generatedAt: string;
  totalCustomers: number;
  totalRevenue: number;
  repeatCount: number;
  repeatRevenue: number;
  repeatRate: number;
  top10PctRevenueShare: number;
  topCustomers: Cust[];
  repeatCustomers: Cust[];
  cohorts: Cohort[];
}

function fmtMoney(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(1)}K`;
  return `$${abs.toFixed(0)}`;
}
function fmtMoneyExact(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function LTVPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'top' | 'repeat'>('top');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/chrisview-ltv');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2"><Heart className="w-5 h-5 text-[#39FF14]" />Customer Lifetime Value</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{err}</div>}
        {loading && <div className="text-center py-12 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>}
        {data && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Total customers" value={data.totalCustomers.toLocaleString()} highlight />
              <Kpi label="Repeat customers" value={data.repeatCount.toLocaleString()} sub={`${data.repeatRate}% repeat rate`} />
              <Kpi label="Repeat revenue share" value={`${((data.repeatRevenue / data.totalRevenue) * 100).toFixed(1)}%`} sub={`${fmtMoney(data.repeatRevenue)} of ${fmtMoney(data.totalRevenue)}`} />
              <Kpi label="Top 10% of customers" value={`${data.top10PctRevenueShare}%`} sub="of total revenue" />
            </section>

            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-[#39FF14]" />Cohorts — Customers by First-Invoice Year</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.cohorts} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="year" stroke="#71717a" fontSize={11} />
                    <YAxis yAxisId="left" stroke="#71717a" fontSize={11} />
                    <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={11} tickFormatter={v => `${v}%`} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} />
                    <Bar yAxisId="left" dataKey="customers" fill="#60a5fa" name="New customers" />
                    <Bar yAxisId="left" dataKey="repeatCount" fill="#39FF14" name="Repeat (became)" />
                    <Line yAxisId="right" type="monotone" dataKey="repeatRate" stroke="#fbbf24" strokeWidth={2} name="Repeat %" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Year</th>
                      <th className="text-right py-2 px-3 font-medium">New customers</th>
                      <th className="text-right py-2 px-3 font-medium">Became repeat</th>
                      <th className="text-right py-2 px-3 font-medium">Repeat %</th>
                      <th className="text-right py-2 px-3 font-medium">Cohort revenue</th>
                      <th className="text-right py-2 px-3 font-medium">Avg per customer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.cohorts.map(c => (
                      <tr key={c.year} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-mono text-xs text-zinc-300">{c.year}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-300">{c.customers}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{c.repeatCount}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-amber-300">{c.repeatRate}%</td>
                        <td className="py-2 px-3 text-right tabular-nums">{fmtMoney(c.totalRevenue)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{fmtMoneyExact(c.avgPerCustomer)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3">
                <button onClick={() => setTab('top')} className={`px-3 py-1 text-xs rounded ${tab === 'top' ? 'bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30' : 'text-zinc-400 hover:text-white'}`}>
                  Top 100 by lifetime
                </button>
                <button onClick={() => setTab('repeat')} className={`px-3 py-1 text-xs rounded ${tab === 'repeat' ? 'bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30' : 'text-zinc-400 hover:text-white'}`}>
                  <Repeat className="w-3 h-3 inline mr-1" />Top 100 repeats
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Customer</th>
                      <th className="text-right py-2 px-3 font-medium">Lifetime $</th>
                      <th className="text-right py-2 px-3 font-medium">Invoices</th>
                      <th className="text-right py-2 px-3 font-medium">Avg invoice</th>
                      <th className="text-left py-2 px-3 font-medium">First</th>
                      <th className="text-left py-2 px-3 font-medium">Last</th>
                      <th className="text-right py-2 px-3 font-medium">Days as cust</th>
                      <th className="text-right py-2 px-3 font-medium">Last 90d</th>
                      <th className="text-left py-2 px-3 font-medium">Reps</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {(tab === 'top' ? data.topCustomers : data.repeatCustomers).map(c => (
                      <tr key={c.customer} className={`hover:bg-zinc-800/30 ${c.recentInvoices > 0 ? 'bg-[#39FF14]/5' : ''}`}>
                        <td className="py-2 px-3">
                          <div className="font-medium">{c.customer}</div>
                          {c.isRepeat && <span className="text-[10px] text-[#39FF14]"><Repeat className="w-3 h-3 inline" /> repeat</span>}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{fmtMoneyExact(c.total)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{c.invoiceCount}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-300">{fmtMoneyExact(c.avgInvoice)}</td>
                        <td className="py-2 px-3 text-xs text-zinc-400">{c.firstDate}</td>
                        <td className="py-2 px-3 text-xs text-zinc-400">{c.lastDate}</td>
                        <td className="py-2 px-3 text-right text-xs">{c.daysAsCustomer}</td>
                        <td className={`py-2 px-3 text-right tabular-nums text-xs ${c.recentInvoices > 0 ? 'text-[#39FF14] font-bold' : 'text-zinc-600'}`}>{c.recentInvoices || '—'}</td>
                        <td className="py-2 px-3 text-xs text-zinc-400">{c.reps.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <AboutThisData
              source="data/customer-ltv.json — computed daily from data/transactions.json by scripts/compute-customer-ltv.mjs. 3,194 distinct QB customers."
              method="Repeat customer = 2+ invoices in the QB ledger. Top 10% = top 10% of customers BY COUNT (319 of 3,194), not the top-100. Repeat-revenue share = sum of revenue from repeat customers ÷ total revenue. Cohort year = year of customer's first invoice."
              uses="Identify customer concentration risk. Spot which cohort years have generated the most repeat revenue. Use top-customer tables to recognize the accounts worth nurturing."
              generatedAt={data?.generatedAt}
            />
          </>
        )}
      </main>
    </div>
  );
}

function Kpi({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 border ${highlight ? 'bg-gradient-to-br from-[#39FF14]/10 to-zinc-900 border-[#39FF14]/30' : 'bg-zinc-900 border-zinc-800'}`}>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-xl font-bold text-white mt-1">{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}
