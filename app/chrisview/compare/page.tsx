'use client';

import { useState, useEffect } from 'react';
import { LineChart as LineChartIcon, ArrowLeft, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell,
} from 'recharts';

interface GridRow {
  monthNum: number;
  monthName: string;
  byYear: Record<string, { revenue: number; expense: number; net: number; invoices: number }>;
}
interface YtdRow { year: string; revenueThroughMonth: number; expenseThroughMonth: number; netThroughMonth: number; invoicesThroughMonth: number }
interface Data {
  generatedAt: string;
  yearsAvailable: string[];
  currentYear: string;
  monthsCompleted: number;
  monthlyGrid: GridRow[];
  ytdComparison: YtdRow[];
  paceVsLastYear: { revenue: number; expense: number; net: number; invoices: number };
  bestMonthByYear: Array<{ year: string; bestMonth: string; revenue: number }>;
  worstMonthByYear: Array<{ year: string; worstMonth: string; revenue: number }>;
  growthYoY: Array<{ year: string; annualRevenue: number; pctVsPrior: number | null }>;
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

const YEAR_COLOR: Record<string, string> = {
  '2018': '#71717a',
  '2019': '#a78bfa',
  '2020': '#38bdf8',
  '2021': '#22d3ee',
  '2022': '#60a5fa',
  '2023': '#a3e635',
  '2024': '#fbbf24',
  '2025': '#f97316',
  '2026': '#39FF14',
};

export default function ComparePage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/chrisview-compare');
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
          <h1 className="text-lg font-semibold flex items-center gap-2"><LineChartIcon className="w-5 h-5 text-[#39FF14]" />YoY Comparison</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{err}</div>}
        {loading && <div className="text-center py-12 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>}
        {data && (
          <>
            {/* Pace banner */}
            <section className={`rounded-xl p-5 border ${data.paceVsLastYear.revenue >= 0 ? 'bg-[#39FF14]/10 border-[#39FF14]/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
              <div className="flex items-center gap-3 mb-2">
                {data.paceVsLastYear.revenue >= 0 ? <TrendingUp className="w-5 h-5 text-[#39FF14]" /> : <TrendingDown className="w-5 h-5 text-amber-400" />}
                <div className="text-xs uppercase tracking-wide text-zinc-400">{data.currentYear} YTD through month {data.monthsCompleted}</div>
              </div>
              <div className="text-3xl font-bold mb-1">
                {data.paceVsLastYear.revenue >= 0 ? '+' : ''}{data.paceVsLastYear.revenue}% revenue vs same period last year
              </div>
              <div className="text-sm text-zinc-300">
                Net: {data.paceVsLastYear.net >= 0 ? '+' : ''}{data.paceVsLastYear.net}% &nbsp;·&nbsp;
                Expense: {data.paceVsLastYear.expense >= 0 ? '+' : ''}{data.paceVsLastYear.expense}% &nbsp;·&nbsp;
                Invoices: {data.paceVsLastYear.invoices >= 0 ? '+' : ''}{data.paceVsLastYear.invoices}%
              </div>
            </section>

            {/* YTD comparison */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">YTD Revenue Through Month {data.monthsCompleted} — Every Year</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.ytdComparison} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="year" stroke="#71717a" fontSize={11} />
                    <YAxis stroke="#71717a" fontSize={11} tickFormatter={v => `${(v / 1_000_000).toFixed(1)}M`} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} formatter={(v: number | undefined) => v == null ? '—' : fmtMoneyExact(v)} />
                    <Bar dataKey="revenueThroughMonth" name="YTD revenue">
                      {data.ytdComparison.map(d => (
                        <Cell key={d.year} fill={YEAR_COLOR[d.year] || '#52525b'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Year</th>
                      <th className="text-right py-2 px-3 font-medium">YTD Revenue</th>
                      <th className="text-right py-2 px-3 font-medium">YTD Expense</th>
                      <th className="text-right py-2 px-3 font-medium">YTD Net</th>
                      <th className="text-right py-2 px-3 font-medium">YTD Invoices</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.ytdComparison.map(y => (
                      <tr key={y.year} className={`hover:bg-zinc-800/30 ${y.year === data.currentYear ? 'bg-[#39FF14]/5' : ''}`}>
                        <td className="py-2 px-3 font-mono text-xs">{y.year}{y.year === data.currentYear && <span className="ml-2 text-[10px] text-[#39FF14]">(current)</span>}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{fmtMoney(y.revenueThroughMonth)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-red-400">{fmtMoney(y.expenseThroughMonth)}</td>
                        <td className={`py-2 px-3 text-right tabular-nums font-bold ${y.netThroughMonth >= 0 ? 'text-[#39FF14]' : 'text-red-400'}`}>{fmtMoney(y.netThroughMonth)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{y.invoicesThroughMonth}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Monthly grid all years */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Monthly Revenue — All Years Overlaid</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.monthlyGrid} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="monthName" stroke="#71717a" fontSize={11} />
                    <YAxis stroke="#71717a" fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} formatter={(v: number | undefined) => v == null ? '—' : fmtMoneyExact(v)} />
                    {data.yearsAvailable.map(y => (
                      <Line
                        key={y}
                        type="monotone"
                        dataKey={d => d.byYear[y]?.revenue ?? null}
                        name={y}
                        stroke={YEAR_COLOR[y] || '#52525b'}
                        strokeWidth={y === data.currentYear ? 3 : 1.5}
                        connectNulls={false}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Annual growth */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Annual Revenue + YoY Growth %</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Year</th>
                      <th className="text-right py-2 px-3 font-medium">Annual Revenue</th>
                      <th className="text-right py-2 px-3 font-medium">vs Prior</th>
                      <th className="text-left py-2 px-3 font-medium">Best Month</th>
                      <th className="text-left py-2 px-3 font-medium">Worst Month</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.growthYoY.map(y => {
                      const best = data.bestMonthByYear.find(b => b.year === y.year);
                      const worst = data.worstMonthByYear.find(b => b.year === y.year);
                      return (
                        <tr key={y.year} className={`hover:bg-zinc-800/30 ${y.year === data.currentYear ? 'bg-[#39FF14]/5' : ''}`}>
                          <td className="py-2 px-3 font-mono text-xs">{y.year}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-[#39FF14] font-bold">{fmtMoney(y.annualRevenue)}</td>
                          <td className={`py-2 px-3 text-right tabular-nums ${y.pctVsPrior == null ? 'text-zinc-500' : y.pctVsPrior >= 0 ? 'text-[#39FF14]' : 'text-red-400'}`}>
                            {y.pctVsPrior == null ? '—' : `${y.pctVsPrior >= 0 ? '+' : ''}${y.pctVsPrior}%`}
                          </td>
                          <td className="py-2 px-3 text-xs text-amber-300">{best ? `${best.bestMonth} (${fmtMoney(best.revenue)})` : '—'}</td>
                          <td className="py-2 px-3 text-xs text-zinc-500">{worst ? `${worst.worstMonth} (${fmtMoney(worst.revenue)})` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Monthly grid table */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold">Monthly Revenue Grid — Month × Year</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Month</th>
                      {data.yearsAvailable.map(y => (
                        <th key={y} className="text-right py-2 px-3 font-medium" style={{ color: YEAR_COLOR[y] }}>{y}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.monthlyGrid.map(row => (
                      <tr key={row.monthNum} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-medium">{row.monthName}</td>
                        {data.yearsAvailable.map(y => {
                          const v = row.byYear[y];
                          return (
                            <td key={y} className="py-2 px-3 text-right tabular-nums text-xs">
                              {v && v.revenue ? <span style={{ color: YEAR_COLOR[y] }}>{fmtMoney(v.revenue)}</span> : <span className="text-zinc-700">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="text-[10px] text-zinc-500 text-center">
              Sourced from data/transactions-monthly.json. YTD comparison uses completed months only (skips current in-progress month).
            </p>
          </>
        )}
      </main>
    </div>
  );
}
