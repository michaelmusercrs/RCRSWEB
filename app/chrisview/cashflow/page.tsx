'use client';

/**
 * Chris View — Cash Flow Forecast.
 *
 * Reads transactions ledger + balance sheet, projects 6 months ahead
 * using last-6 baseline × seasonal multipliers. Flags runway risks.
 */

import { useState, useEffect } from 'react';
import {
  TrendingDown, TrendingUp, ArrowLeft, Loader2, AlertTriangle, Wallet, Calendar,
} from 'lucide-react';
import AboutThisData from '@/components/AboutThisData';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Cell,
} from 'recharts';

interface ForecastMonth {
  month: string;
  projectedRevenue: number;
  projectedExpense: number;
  projectedNet: number;
  projectedCashEnd: number;
  seasonalRevMult: number;
  seasonalExpMult: number;
}

interface Data {
  generatedAt: string;
  cashOnHand: number;
  accountsReceivable: number;
  last12Months: Array<{ month: string; revenue: number; expense: number; net: number }>;
  last12Inflow: number;
  last12Outflow: number;
  last12Net: number;
  avgMonthlyNet: number;
  burnRate: number;
  monthsRunway: number | null;
  baselineRev: number;
  baselineExp: number;
  seasonal: Array<{ month: string; monthNum: number; revMult: number; expMult: number }>;
  forecast: ForecastMonth[];
  alerts: Array<{ severity: 'critical' | 'warning' | 'info'; msg: string }>;
}

function fmtMoney(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}
function fmtMoneyExact(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function CashflowPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/chrisview-cashflow');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Combine last 12 months + forecast for one chart
  const combined = data ? [
    ...data.last12Months.map(m => ({ month: m.month, actual: m.net, revenue: m.revenue, expense: m.expense, kind: 'actual' as const })),
    ...data.forecast.map(f => ({ month: f.month, projected: f.projectedNet, projRev: f.projectedRevenue, projExp: f.projectedExpense, kind: 'forecast' as const })),
  ] : [];

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#39FF14]" />
            Cash Flow Forecast
          </h1>
          {data && <span className="ml-auto text-xs text-zinc-500">Refreshed {data.generatedAt}</span>}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{err}</div>}
        {loading && <div className="text-center py-12 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>}
        {data && (
          <>
            {data.alerts.length > 0 && (
              <section className="space-y-2">
                {data.alerts.map((a, i) => (
                  <div key={i} className={`rounded-xl p-4 border ${
                    a.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                    a.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/30' :
                    'bg-blue-500/10 border-blue-500/30'
                  }`}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                        a.severity === 'critical' ? 'text-red-400' :
                        a.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'
                      }`} />
                      <p className="text-sm text-zinc-100">{a.msg}</p>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* KPI */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Cash on Hand" value={fmtMoney(data.cashOnHand)} sub={fmtMoneyExact(data.cashOnHand)} highlight />
              <Kpi label="A/R Outstanding" value={fmtMoney(data.accountsReceivable)} sub={fmtMoneyExact(data.accountsReceivable)} negative={data.accountsReceivable > data.cashOnHand * 3} />
              <Kpi label="12-mo Net" value={fmtMoney(data.last12Net)} sub={`avg ${fmtMoney(data.avgMonthlyNet)}/mo`} negative={data.last12Net < 0} />
              <Kpi label="Months Runway" value={data.monthsRunway != null ? `${data.monthsRunway.toFixed(1)}` : '∞'} sub={data.monthsRunway != null ? 'at current burn' : 'cash accumulating'} negative={data.monthsRunway != null && data.monthsRunway < 12} />
            </section>

            {/* Actual vs forecast chart */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#39FF14]" />
                Cash Flow Trail — Last 12 Months + 6-Month Forecast
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={combined} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="month" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" fontSize={11} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                    <Tooltip
                      contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                      formatter={(v: number | undefined) => v != null ? fmtMoneyExact(v) : '—'}
                    />
                    <Legend />
                    <Bar dataKey="revenue" fill="#39FF14" name="Actual Revenue" opacity={0.85} />
                    <Bar dataKey="expense" fill="#ef4444" name="Actual Expense" opacity={0.7} />
                    <Line type="monotone" dataKey="actual" stroke="#60a5fa" strokeWidth={2} name="Actual Net" dot />
                    <Bar dataKey="projRev" fill="#39FF14" name="Projected Revenue" opacity={0.4} />
                    <Bar dataKey="projExp" fill="#ef4444" name="Projected Expense" opacity={0.35} />
                    <Line type="monotone" dataKey="projected" stroke="#fbbf24" strokeWidth={3} strokeDasharray="5 5" name="Projected Net" dot />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Forecast table */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#39FF14]" />6-Month Forecast</h3>
                <p className="text-xs text-zinc-500 mt-1">Last-6-month baseline (${data.baselineRev.toFixed(0)} rev / ${data.baselineExp.toFixed(0)} exp avg) × per-calendar-month seasonal multiplier. Cash balance carries forward.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Month</th>
                      <th className="text-right py-2 px-3 font-medium">Projected Revenue</th>
                      <th className="text-right py-2 px-3 font-medium">Projected Expense</th>
                      <th className="text-right py-2 px-3 font-medium">Net</th>
                      <th className="text-right py-2 px-3 font-medium">Projected Cash End</th>
                      <th className="text-right py-2 px-3 font-medium">Seasonal Rev</th>
                      <th className="text-right py-2 px-3 font-medium">Seasonal Exp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.forecast.map(f => (
                      <tr key={f.month} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-mono text-xs text-zinc-300">{f.month}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{fmtMoneyExact(f.projectedRevenue)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-red-300">{fmtMoneyExact(f.projectedExpense)}</td>
                        <td className={`py-2 px-3 text-right tabular-nums ${f.projectedNet >= 0 ? 'text-white' : 'text-red-400'}`}>{fmtMoneyExact(f.projectedNet)}</td>
                        <td className={`py-2 px-3 text-right tabular-nums font-bold ${f.projectedCashEnd >= 50000 ? 'text-[#39FF14]' : f.projectedCashEnd >= 0 ? 'text-amber-300' : 'text-red-400'}`}>{fmtMoneyExact(f.projectedCashEnd)}</td>
                        <td className="py-2 px-3 text-right text-xs text-zinc-500">{f.seasonalRevMult.toFixed(2)}×</td>
                        <td className="py-2 px-3 text-right text-xs text-zinc-500">{f.seasonalExpMult.toFixed(2)}×</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Seasonal multipliers chart */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Seasonal Strength (Revenue Multiplier vs Annual Avg)</h3>
              <p className="text-xs text-zinc-500 mb-3">1.0× = matches annual average. &gt;1.0 = stronger than average month historically. &lt;1.0 = slower.</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.seasonal} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="month" stroke="#71717a" fontSize={11} />
                    <YAxis stroke="#71717a" fontSize={11} tickFormatter={v => `${v}×`} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} formatter={(v: number | undefined) => v != null ? `${v.toFixed(2)}×` : '—'} />
                    <Bar dataKey="revMult" name="Revenue Strength">
                      {data.seasonal.map((s, i) => (
                        <Cell key={i} fill={s.revMult >= 1.1 ? '#39FF14' : s.revMult >= 0.9 ? '#fbbf24' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <AboutThisData
              source="data/cashflow-forecast.json — precomputed snapshot generated by scripts/compute-cashflow-forecast.mjs from data/transactions-monthly.json + data/company-overview.json. Not live — re-run the script to refresh."
              method="Baseline = average of last 6 months of revenue + expense. Each forecast month = baseline × per-calendar-month seasonal multiplier (e.g. May's multiplier comes from how May has historically compared to the annual average). Cash carries forward month to month: cash_end = cash_start + projected_revenue − projected_expense. Runway = (cash_on_hand + A/R) ÷ avg monthly burn."
              uses="Spot collections risk early (A/R vs cash ratio). Plan large purchases around seasonal cash dips. Validate whether a sales surge is enough to cover seasonal expense spikes."
              gaps="Baseline does NOT filter outlier months — a single abnormally high or low month in the last 6 will skew the forecast. Seasonal multipliers come from the full historical record; a 'new normal' (e.g., post-2022 growth) takes time to dominate the average."
              generatedAt={data?.generatedAt}
            />
          </>
        )}
      </main>
    </div>
  );
}

function Kpi({ label, value, sub, highlight, negative }: { label: string; value: string; sub?: string; highlight?: boolean; negative?: boolean }) {
  return (
    <div className={`rounded-xl p-3 border ${highlight ? 'bg-gradient-to-br from-[#39FF14]/10 to-zinc-900 border-[#39FF14]/30' : 'bg-zinc-900 border-zinc-800'}`}>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`text-xl font-bold mt-1 ${negative ? 'text-red-400' : 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}
