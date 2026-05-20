'use client';

/**
 * Chris View — Estimate Close Rates (Phase 3).
 *
 * Buckets recent JN estimates by:
 *   - delivery channel: in-person (had appt/meeting before) vs online (just emailed)
 *   - insurance vs retail
 *   - first-contact method (Phone / Text / Email / Note)
 *   - rep
 *
 * Computes close rate (signed / total) per bucket. First load takes
 * 30-60 sec (lots of JN calls), then cached 10 min.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, ArrowLeft, Loader2, RefreshCw, Calendar, Briefcase, Shield, Phone,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend,
} from 'recharts';

interface Row { key: string; total: number; signed: number; rate: number; avgAmount: number }

interface Data {
  generatedAt: string;
  daysQueried: number;
  totalEstimates: number;
  byDelivery: Row[];
  byInsurance: Row[];
  byCombo: Row[];
  byRep: Row[];
  byContactMethod: Row[];
  meta: { queryTimeMs: number; estimatesFetched: number; jobsFetched: number; activitiesFetched: number };
}

function color(rate: number) {
  if (rate >= 50) return '#39FF14';
  if (rate >= 30) return '#fbbf24';
  if (rate >= 15) return '#fb7185';
  return '#ef4444';
}

export default function CloseRatesPage() {
  const [days, setDays] = useState(90);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/chrisview-close-rates?days=${days}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#39FF14]" />
            Estimate Close Rates
          </h1>
          <div className="ml-auto flex items-center gap-2">
            {[30, 60, 90, 180, 365].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  days === d
                    ? 'bg-[#39FF14]/10 border-[#39FF14]/40 text-[#39FF14]'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {d}d
              </button>
            ))}
            <button onClick={fetchData} disabled={loading} className="p-1.5 text-zinc-400 hover:text-white rounded disabled:opacity-50" title="Refresh">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{err}</div>}
        {!data && loading && (
          <div className="text-center py-16 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin inline mr-2" />
            Querying JobNimbus and crunching estimates… (first load 30-60s, cached 10 min)
          </div>
        )}
        {data && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Estimates analyzed" value={data.totalEstimates.toString()} sub={`last ${data.daysQueried} days`} />
              <Kpi label="Overall close rate" value={`${data.byDelivery.length ? ((data.byDelivery.reduce((s, r) => s + r.signed, 0) / Math.max(1, data.byDelivery.reduce((s, r) => s + r.total, 0)) * 100).toFixed(1)) : 0}%`} highlight />
              <Kpi label="Query took" value={`${(data.meta.queryTimeMs / 1000).toFixed(1)}s`} sub={`${data.meta.estimatesFetched} estimates · ${data.meta.activitiesFetched} activities`} />
              <Kpi label="Refresh source" value={data.generatedAt} sub="live JN" />
            </section>

            <RollupCard title="By Delivery Channel" icon={Briefcase} description="In-person (a completed appointment OR a note mentioning a meeting/visit/inspection BEFORE the estimate was sent) vs Online (just emailed)." rows={data.byDelivery} />
            <RollupCard title="By Insurance vs Retail" icon={Shield} description="Insurance = the job has an insurance summary block, carrier, or claim number. Retail = none of the above." rows={data.byInsurance} />
            <RollupCard title="By Delivery × Insurance" icon={Briefcase} description="Cross-tab of the two above. Watch for in-person × insurance — usually the highest close." rows={data.byCombo} />
            <RollupCard title="By Rep" icon={Briefcase} description="Per-rep close rate on estimates they own." rows={data.byRep} />
            <RollupCard title="By First-Contact Method" icon={Phone} description="What the first manual touchpoint was (Phone Call / Text / Email / Note) before the estimate." rows={data.byContactMethod} />

            <p className="text-[10px] text-zinc-500 text-center">
              Heuristic: in-person delivery = completed appointment OR note mentioning meeting/visit/inspection logged BEFORE estimate date_created. Signed = JN status includes &ldquo;signed&rdquo;, &ldquo;approved&rdquo;, &ldquo;accepted&rdquo;, &ldquo;sold&rdquo;, &ldquo;won&rdquo;.
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

function RollupCard({ title, icon: Icon, description, rows }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  rows: Row[];
}) {
  if (!rows.length) {
    return (
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-1"><Icon className="w-4 h-4 text-[#39FF14]" />{title}</h3>
        <p className="text-xs text-zinc-500">{description}</p>
        <p className="text-xs text-zinc-500 mt-3">No data.</p>
      </section>
    );
  }
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-1"><Icon className="w-4 h-4 text-[#39FF14]" />{title}</h3>
      <p className="text-xs text-zinc-400 mb-3">{description}</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
              <tr>
                <th className="text-left py-2 px-3 font-medium">Bucket</th>
                <th className="text-right py-2 px-3 font-medium">Total</th>
                <th className="text-right py-2 px-3 font-medium">Signed</th>
                <th className="text-right py-2 px-3 font-medium">Close %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.map(r => (
                <tr key={r.key} className="hover:bg-zinc-800/30">
                  <td className="py-2 px-3 font-medium">{r.key || 'Unknown'}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{r.total}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{r.signed}</td>
                  <td className="py-2 px-3 text-right tabular-nums font-bold" style={{ color: color(r.rate) }}>{r.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 8, bottom: 8, left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis type="number" stroke="#71717a" fontSize={11} domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="key" stroke="#71717a" fontSize={11} width={100} />
              <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} />
              <Bar dataKey="rate" name="Close %">
                {rows.map((r, i) => (
                  <Cell key={i} fill={color(r.rate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
