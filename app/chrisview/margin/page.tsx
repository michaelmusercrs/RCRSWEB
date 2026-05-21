'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp, ArrowLeft, Loader2, DollarSign, Percent, AlertTriangle, Users,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';

interface JobMargin {
  jobNumber: string;
  customer: string;
  rep: string;
  invoiceCount: number;
  firstInvoiceDate: string;
  lastInvoiceDate: string;
  revenue: number;
  estimatedCommission: number;
  knownMaterialCost: number;
  knownSubLaborCost: number;
  estimatedMargin: number;
  estimatedMarginPct: number;
  costsKnown: boolean;
}

interface RepMargin {
  rep: string;
  jobCount: number;
  totalRev: number;
  totalCost: number;
  totalCommission: number;
  totalKnownMaterial: number;
  totalKnownSubLabor: number;
  totalMargin: number;
  avgMarginPct: number;
  commissionRate: number;
}

interface Data {
  generatedAt: string;
  totalJobs: number;
  totalRevenue: number;
  totalEstimatedCommission: number;
  totalKnownMaterialCost: number;
  totalKnownSubLaborCost: number;
  totalEstimatedMargin: number;
  avgMarginPct: number;
  medianMarginPct: number;
  weightedMarginPct: number;
  jobsWithKnownCosts: number;
  dataNotes: string[];
  byRep: RepMargin[];
  topHighMargin: JobMargin[];
  topHighMarginPct: JobMargin[];
  topLowMargin: JobMargin[];
  topLowMarginPct: JobMargin[];
}

function fmtMoney(n: number) {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(1)}K`;
  return `${sign}$${a.toFixed(0)}`;
}
function fmtMoneyExact(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function MarginPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'high' | 'low' | 'highPct' | 'lowPct'>('high');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/chrisview-margin');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const repsForChart = (data?.byRep || [])
    .filter(r => r.jobCount >= 3 && r.totalRev >= 50_000)
    .slice(0, 15);

  const tableRows =
    tab === 'high' ? data?.topHighMargin :
    tab === 'low' ? data?.topLowMargin :
    tab === 'highPct' ? data?.topHighMarginPct :
    data?.topLowMarginPct;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#39FF14]" />True Margin Per Job
          </h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{err}</div>}
        {loading && <div className="text-center py-12 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>}
        {data && (
          <>
            {/* KPI cards */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Total jobs analyzed" value={data.totalJobs.toLocaleString()} highlight icon={<TrendingUp className="w-3 h-3" />} />
              <Kpi label="Total invoiced revenue" value={fmtMoney(data.totalRevenue)} icon={<DollarSign className="w-3 h-3" />} sub={`Across ${data.totalJobs.toLocaleString()} jobs`} />
              <Kpi label="Avg margin %" value={`${data.avgMarginPct}%`} icon={<Percent className="w-3 h-3" />} sub={`Median ${data.medianMarginPct}% · Weighted ${data.weightedMarginPct}%`} />
              <Kpi label="Total est. profit" value={fmtMoney(data.totalEstimatedMargin)} icon={<DollarSign className="w-3 h-3" />} sub={`After ${fmtMoney(data.totalEstimatedCommission)} commission`} />
            </section>

            {/* Data quality / disclosure */}
            <section className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-200">Data Coverage</h3>
                <span className="ml-auto text-[10px] text-amber-300/70">
                  Material cost: {data.jobsWithKnownCosts.toLocaleString()} / {data.totalJobs.toLocaleString()} jobs
                </span>
              </div>
              <ul className="space-y-1.5 text-xs text-amber-100/80">
                {data.dataNotes.map((note, i) => (
                  <li key={i} className="flex gap-2"><span className="text-amber-400">•</span><span>{note}</span></li>
                ))}
              </ul>
            </section>

            {/* Per-rep margin chart */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#39FF14]" />Margin by Rep (≥3 jobs, ≥$50K revenue)
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={repsForChart} margin={{ top: 8, right: 8, bottom: 40, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="rep" stroke="#71717a" fontSize={10} angle={-30} textAnchor="end" interval={0} height={70} />
                    <YAxis stroke="#71717a" fontSize={11} tickFormatter={v => `${v}%`} />
                    <Tooltip
                      contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
                      formatter={(value, key) => {
                        const n = typeof value === 'number' ? value : Number(value);
                        if (key === 'avgMarginPct') return [`${n}%`, 'Margin %'];
                        return [String(value), String(key)];
                      }}
                    />
                    <Bar dataKey="avgMarginPct" name="Margin %">
                      {repsForChart.map((r, i) => (
                        <Cell
                          key={i}
                          fill={r.avgMarginPct >= 70 ? '#39FF14' : r.avgMarginPct >= 50 ? '#84cc16' : r.avgMarginPct >= 30 ? '#fbbf24' : '#ef4444'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Rep</th>
                      <th className="text-right py-2 px-3 font-medium">Jobs</th>
                      <th className="text-right py-2 px-3 font-medium">Revenue</th>
                      <th className="text-right py-2 px-3 font-medium">Comm $ (real)</th>
                      <th className="text-right py-2 px-3 font-medium">Comm rate</th>
                      <th className="text-right py-2 px-3 font-medium">Material/Sub $</th>
                      <th className="text-right py-2 px-3 font-medium">Est. margin $</th>
                      <th className="text-right py-2 px-3 font-medium">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.byRep.map(r => (
                      <tr key={r.rep} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-medium">{r.rep}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{r.jobCount}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{fmtMoney(r.totalRev)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-300">{fmtMoney(r.totalCommission)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400 text-xs">{r.commissionRate}%</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-500 text-xs">
                          {r.totalKnownMaterial + r.totalKnownSubLabor > 0 ? fmtMoney(r.totalKnownMaterial + r.totalKnownSubLabor) : '—'}
                        </td>
                        <td className={`py-2 px-3 text-right tabular-nums ${r.totalMargin >= 0 ? 'text-[#39FF14]' : 'text-red-400'}`}>{fmtMoney(r.totalMargin)}</td>
                        <td className={`py-2 px-3 text-right tabular-nums font-bold ${r.avgMarginPct >= 70 ? 'text-[#39FF14]' : r.avgMarginPct >= 50 ? 'text-lime-300' : r.avgMarginPct >= 30 ? 'text-amber-300' : 'text-red-400'}`}>
                          {r.avgMarginPct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* High / low margin job tables */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2 flex-wrap">
                <button onClick={() => setTab('high')} className={`px-3 py-1 text-xs rounded ${tab === 'high' ? 'bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30' : 'text-zinc-400 hover:text-white border border-transparent'}`}>
                  Top 20 by $ margin
                </button>
                <button onClick={() => setTab('low')} className={`px-3 py-1 text-xs rounded ${tab === 'low' ? 'bg-red-500/10 text-red-300 border border-red-500/30' : 'text-zinc-400 hover:text-white border border-transparent'}`}>
                  Bottom 20 by $ margin
                </button>
                <button onClick={() => setTab('highPct')} className={`px-3 py-1 text-xs rounded ${tab === 'highPct' ? 'bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30' : 'text-zinc-400 hover:text-white border border-transparent'}`}>
                  Top 20 by margin %
                </button>
                <button onClick={() => setTab('lowPct')} className={`px-3 py-1 text-xs rounded ${tab === 'lowPct' ? 'bg-red-500/10 text-red-300 border border-red-500/30' : 'text-zinc-400 hover:text-white border border-transparent'}`}>
                  Bottom 20 by margin %
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Job</th>
                      <th className="text-left py-2 px-3 font-medium">Customer</th>
                      <th className="text-left py-2 px-3 font-medium">Rep</th>
                      <th className="text-right py-2 px-3 font-medium">Invoices</th>
                      <th className="text-left py-2 px-3 font-medium">Last invoice</th>
                      <th className="text-right py-2 px-3 font-medium">Revenue</th>
                      <th className="text-right py-2 px-3 font-medium">Est. comm</th>
                      <th className="text-right py-2 px-3 font-medium">Mat/Sub</th>
                      <th className="text-right py-2 px-3 font-medium">Est. margin</th>
                      <th className="text-right py-2 px-3 font-medium">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {(tableRows || []).map(j => (
                      <tr key={j.jobNumber} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-mono text-xs text-zinc-300">{j.jobNumber}</td>
                        <td className="py-2 px-3 text-xs">{j.customer}</td>
                        <td className="py-2 px-3 text-xs text-zinc-400">{j.rep}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400 text-xs">{j.invoiceCount}</td>
                        <td className="py-2 px-3 text-xs text-zinc-500">{j.lastInvoiceDate}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{fmtMoneyExact(j.revenue)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400 text-xs">{fmtMoney(j.estimatedCommission)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-500 text-xs">
                          {j.knownMaterialCost + j.knownSubLaborCost > 0
                            ? fmtMoney(j.knownMaterialCost + j.knownSubLaborCost)
                            : <span className="text-zinc-700">n/a</span>}
                        </td>
                        <td className={`py-2 px-3 text-right tabular-nums ${j.estimatedMargin >= 0 ? 'text-[#39FF14]' : 'text-red-400'}`}>{fmtMoney(j.estimatedMargin)}</td>
                        <td className={`py-2 px-3 text-right tabular-nums font-bold ${j.estimatedMarginPct >= 70 ? 'text-[#39FF14]' : j.estimatedMarginPct >= 50 ? 'text-lime-300' : j.estimatedMarginPct >= 30 ? 'text-amber-300' : 'text-red-400'}`}>
                          {j.estimatedMarginPct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="text-[10px] text-zinc-500 text-center">
              Composed from data/transactions.json (4,490 invoices, R-number tagged) + data/commissions.json (15.5K 1099 rows).
              Generated {new Date(data.generatedAt).toLocaleString()}.
              Per-job margin = revenue − (rep&apos;s avg commission rate × revenue) − any known material/sub-labor cost.
              Per-rep aggregate uses REAL commission totals from QB 1099 reports.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function Kpi({ label, value, sub, highlight, icon }: { label: string; value: string; sub?: string; highlight?: boolean; icon?: React.ReactNode }) {
  return (
    <div className={`rounded-xl p-3 border ${highlight ? 'bg-gradient-to-br from-[#39FF14]/10 to-zinc-900 border-[#39FF14]/30' : 'bg-zinc-900 border-zinc-800'}`}>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500 flex items-center gap-1">{icon}{label}</div>
      <div className="text-xl font-bold text-white mt-1">{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}
