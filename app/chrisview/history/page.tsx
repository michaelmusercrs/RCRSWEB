'use client';

import { useState, useEffect } from 'react';
import { History, ArrowLeft, Loader2, TrendingUp, Calendar, Users } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, AreaChart, Area, Cell,
} from 'recharts';

interface YearRow { year: string; revenue: number; expense: number; netCash: number; margin: number; invoices: number; avgInvoice: number; commissions: number; commissionPayments: number; reviews: number; reviews5star: number }
interface MonthRow { month: string; revenue: number; expense: number; netCash: number; invoices: number; cumulativeRev: number }
interface QuarterRow { quarter: string; revenue: number; expense: number; netCash: number; invoices: number }
interface SeasonRow { monthNum: number; monthName: string; avgRevenue: number; samples: number }
interface RepHistoryRow { rep: string; firstPayment: string; lastPayment: string; daysOnPayroll: number; yearsActive: number; totalCommissions: number; paymentCount: number; peakYear: string; peakYearTotal: number; isActive: boolean }

interface Data {
  generatedAt: string;
  byYear: YearRow[];
  byMonth: MonthRow[];
  byQuarter: QuarterRow[];
  seasonality: { months: SeasonRow[]; bestMonth: { name: string; avg: number }; worstMonth: { name: string; avg: number } };
  repHistory: RepHistoryRow[];
  lifetime: { revenue: number; expense: number; netCash: number; margin: number; invoices: number; avgInvoice: number; commissionPayments: number; totalCommissions: number; firstMonth: string; lastMonth: string; monthsActive: number };
}

function fmtMoney(n: number) {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(1)}K`;
  return `${sign}$${a.toFixed(0)}`;
}
function fmtMoneyExact(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default function HistoryPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [repTab, setRepTab] = useState<'all' | 'active' | 'historical'>('all');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/chrisview-history');
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
          <h1 className="text-lg font-semibold flex items-center gap-2"><History className="w-5 h-5 text-[#39FF14]" />History — All-Time</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{err}</div>}
        {loading && <div className="text-center py-12 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>}
        {data && (
          <>
            {/* Lifetime KPIs */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Lifetime revenue" value={fmtMoney(data.lifetime.revenue)} sub={`${data.lifetime.firstMonth} → ${data.lifetime.lastMonth}`} highlight />
              <Kpi label="Lifetime expense" value={fmtMoney(data.lifetime.expense)} sub={`${data.lifetime.monthsActive} months`} />
              <Kpi label="Lifetime margin" value={`${data.lifetime.margin}%`} sub={fmtMoney(data.lifetime.netCash) + ' net'} />
              <Kpi label="Invoices" value={data.lifetime.invoices.toLocaleString()} sub={`avg ${fmtMoney(data.lifetime.avgInvoice)}`} />
            </section>

            {/* Annual table + chart */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-[#39FF14]" />Annual — Revenue × Expense × Margin</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.byYear} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="year" stroke="#71717a" fontSize={11} />
                    <YAxis yAxisId="left" stroke="#71717a" fontSize={11} tickFormatter={v => `${(v / 1_000_000).toFixed(1)}M`} />
                    <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={11} tickFormatter={v => `${v}%`} domain={[-20, 20]} />
                    <Tooltip
                      contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                      formatter={(v: number | undefined, n: string | undefined) => v == null ? '—' : n === 'margin' ? `${v}%` : fmtMoneyExact(v)}
                    />
                    <Bar yAxisId="left" dataKey="revenue" fill="#39FF14" name="Revenue" />
                    <Bar yAxisId="left" dataKey="expense" fill="#ef4444" name="Expense" />
                    <Line yAxisId="right" type="monotone" dataKey="margin" stroke="#fbbf24" strokeWidth={2} name="margin" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Year</th>
                      <th className="text-right py-2 px-3 font-medium">Revenue</th>
                      <th className="text-right py-2 px-3 font-medium">Expense</th>
                      <th className="text-right py-2 px-3 font-medium">Net</th>
                      <th className="text-right py-2 px-3 font-medium">Margin</th>
                      <th className="text-right py-2 px-3 font-medium">Invoices</th>
                      <th className="text-right py-2 px-3 font-medium">Avg Invoice</th>
                      <th className="text-right py-2 px-3 font-medium">Commissions Paid</th>
                      <th className="text-right py-2 px-3 font-medium">Reviews</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.byYear.map(y => (
                      <tr key={y.year} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-mono text-xs">{y.year}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{fmtMoney(y.revenue)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-red-400">{fmtMoney(y.expense)}</td>
                        <td className={`py-2 px-3 text-right tabular-nums font-bold ${y.netCash >= 0 ? 'text-[#39FF14]' : 'text-red-400'}`}>{fmtMoney(y.netCash)}</td>
                        <td className={`py-2 px-3 text-right tabular-nums ${y.margin >= 0 ? 'text-amber-300' : 'text-red-400'}`}>{y.margin}%</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{y.invoices}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{fmtMoney(y.avgInvoice)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-amber-300">{fmtMoney(y.commissions)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-yellow-300">{y.reviews}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Monthly + cumulative */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#39FF14]" />Monthly Revenue + Cumulative Lifetime</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.byMonth} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="month" stroke="#71717a" fontSize={9} interval={11} />
                    <YAxis yAxisId="left" stroke="#71717a" fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                    <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={11} tickFormatter={v => `${(v / 1_000_000).toFixed(1)}M`} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} formatter={(v: number | undefined) => v != null ? fmtMoneyExact(v) : '—'} />
                    <Bar yAxisId="left" dataKey="revenue" fill="#39FF14" name="Monthly rev" />
                    <Line yAxisId="right" type="monotone" dataKey="cumulativeRev" stroke="#fbbf24" strokeWidth={2} dot={false} name="Cumulative" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Seasonality */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-1">Seasonality — Average Revenue by Month of Year</h3>
              <p className="text-xs text-zinc-400 mb-3">
                Best month: <strong className="text-[#39FF14]">{data.seasonality.bestMonth.name}</strong> ({fmtMoney(data.seasonality.bestMonth.avg)} avg).
                {' '}Worst: <strong className="text-amber-400">{data.seasonality.worstMonth.name}</strong> ({fmtMoney(data.seasonality.worstMonth.avg)}).
              </p>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.seasonality.months} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="monthName" stroke="#71717a" fontSize={11} />
                    <YAxis stroke="#71717a" fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} formatter={(v: number | undefined) => v != null ? fmtMoneyExact(v) : '—'} />
                    <Bar dataKey="avgRevenue">
                      {data.seasonality.months.map((m, i) => {
                        const max = Math.max(...data.seasonality.months.map(x => x.avgRevenue));
                        const ratio = m.avgRevenue / max;
                        const color = ratio > 0.85 ? '#39FF14' : ratio > 0.65 ? '#a3e635' : ratio > 0.45 ? '#fbbf24' : '#f97316';
                        return <Cell key={i} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Quarterly summary */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Quarterly Net Cash</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.byQuarter} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="quarter" stroke="#71717a" fontSize={9} interval={3} />
                    <YAxis stroke="#71717a" fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} formatter={(v: number | undefined) => v != null ? fmtMoneyExact(v) : '—'} />
                    <Area type="monotone" dataKey="netCash" stroke="#39FF14" fill="#39FF14" fillOpacity={0.2} name="Net cash" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Rep history */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3">
                <Users className="w-4 h-4 text-[#39FF14]" />
                <h3 className="text-sm font-semibold">Rep Tenure + Lifetime Commissions</h3>
                <div className="ml-auto flex items-center gap-1">
                  {[
                    { k: 'all', label: 'All' },
                    { k: 'active', label: 'Active' },
                    { k: 'historical', label: 'Former' },
                  ].map(t => (
                    <button
                      key={t.k}
                      onClick={() => setRepTab(t.k as 'all' | 'active' | 'historical')}
                      className={`px-3 py-1 text-xs rounded border ${repTab === t.k ? 'bg-[#39FF14]/10 border-[#39FF14]/30 text-[#39FF14]' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Rep</th>
                      <th className="text-left py-2 px-3 font-medium">First → Last</th>
                      <th className="text-right py-2 px-3 font-medium">Years</th>
                      <th className="text-right py-2 px-3 font-medium">Payments</th>
                      <th className="text-right py-2 px-3 font-medium">Lifetime $</th>
                      <th className="text-left py-2 px-3 font-medium">Peak Year</th>
                      <th className="text-right py-2 px-3 font-medium">Peak $</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.repHistory
                      .filter(r => repTab === 'all' || (repTab === 'active' ? r.isActive : !r.isActive))
                      .map(r => (
                        <tr key={r.rep} className="hover:bg-zinc-800/30">
                          <td className="py-2 px-3 font-medium">
                            {r.rep}
                            {r.isActive && <span className="ml-2 text-[10px] text-[#39FF14]">●</span>}
                          </td>
                          <td className="py-2 px-3 text-xs text-zinc-400">{r.firstPayment} → {r.lastPayment}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{r.yearsActive}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{r.paymentCount}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-[#39FF14] font-bold">{fmtMoney(r.totalCommissions)}</td>
                          <td className="py-2 px-3 text-xs text-amber-300">{r.peakYear || '—'}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-amber-300">{fmtMoney(r.peakYearTotal)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="text-[10px] text-zinc-500 text-center">
              Sourced from data/transactions-monthly.json (QB exports 2018-08 → present), data/commissions.json (15.5K 1099 payments), data/reviews-master.json (317 Google reviews).
            </p>
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
