'use client';

import { useState, useEffect } from 'react';
import { HardHat, ArrowLeft, Loader2 } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';

interface Sub {
  entity: string; total: number; checks: number; avgCheck: number;
  firstPaid: string; lastPaid: string; jobsCount: number;
  recentChecks: number; recentTotal: number;
}

interface Data {
  generatedAt: string;
  totalSubs: number;
  totalSpend: number;
  totalChecks: number;
  subs: Sub[];
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

export default function SubsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/chrisview-subs');
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
          <h1 className="text-lg font-semibold flex items-center gap-2"><HardHat className="w-5 h-5 text-[#39FF14]" />Subcontractor Performance</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{err}</div>}
        {loading && <div className="text-center py-12 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>}
        {data && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Active subs" value={data.totalSubs.toString()} highlight />
              <Kpi label="Lifetime sub spend" value={fmtMoney(data.totalSpend)} sub={fmtMoneyExact(data.totalSpend)} />
              <Kpi label="Total sub checks" value={data.totalChecks.toLocaleString()} />
              <Kpi label="Avg check size" value={data.totalChecks > 0 ? fmtMoneyExact(data.totalSpend / data.totalChecks) : '—'} />
            </section>

            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Top Subs by Lifetime Spend</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.subs.slice(0, 10)} layout="vertical" margin={{ top: 8, right: 8, bottom: 8, left: 130 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis type="number" stroke="#71717a" fontSize={10} tickFormatter={v => `$${(v / 1_000_000).toFixed(1)}M`} />
                    <YAxis type="category" dataKey="entity" stroke="#71717a" fontSize={10} width={130} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} formatter={(v: number | undefined) => v != null ? fmtMoneyExact(v) : '—'} />
                    <Bar dataKey="total" fill="#39FF14" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Subcontractor</th>
                      <th className="text-right py-2 px-3 font-medium">Lifetime spend</th>
                      <th className="text-right py-2 px-3 font-medium">Checks</th>
                      <th className="text-right py-2 px-3 font-medium">Avg check</th>
                      <th className="text-left py-2 px-3 font-medium">First paid</th>
                      <th className="text-left py-2 px-3 font-medium">Last paid</th>
                      <th className="text-right py-2 px-3 font-medium">Last 90d spend</th>
                      <th className="text-right py-2 px-3 font-medium">Last 90d checks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.subs.map(s => {
                      const inactive = s.recentChecks === 0;
                      return (
                        <tr key={s.entity} className={`hover:bg-zinc-800/30 ${inactive ? 'opacity-60' : ''}`}>
                          <td className="py-2 px-3 font-medium">{s.entity}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{fmtMoneyExact(s.total)}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{s.checks}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-zinc-300">{fmtMoneyExact(s.avgCheck)}</td>
                          <td className="py-2 px-3 text-xs text-zinc-400">{s.firstPaid}</td>
                          <td className="py-2 px-3 text-xs text-zinc-400">{s.lastPaid}</td>
                          <td className={`py-2 px-3 text-right tabular-nums ${inactive ? 'text-zinc-600' : 'text-amber-300'}`}>{s.recentTotal > 0 ? fmtMoneyExact(s.recentTotal) : 'inactive'}</td>
                          <td className={`py-2 px-3 text-right tabular-nums text-xs ${inactive ? 'text-zinc-600' : ''}`}>{s.recentChecks || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
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
