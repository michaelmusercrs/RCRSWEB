'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Megaphone, ArrowLeft, Loader2, RefreshCw, Users,
} from 'lucide-react';
import AboutThisData from '@/components/AboutThisData';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';

interface SourceRow {
  source: string;
  leads: number;
  converted: number;
  closeRate: number;
  medianDaysToClose: number | null;
  topReps: Array<{ rep: string; leads: number; converted: number }>;
}

interface Data {
  generatedAt: string;
  daysQueried: number;
  totalLeads: number;
  bySource: SourceRow[];
  byRep: Array<{ rep: string; leads: number; converted: number; closeRate: number; topSources: string[] }>;
  meta: { queryTimeMs: number; contactsFetched: number; jobsFetched: number };
}

function rateColor(r: number) {
  if (r >= 50) return '#39FF14';
  if (r >= 30) return '#fbbf24';
  if (r >= 15) return '#fb7185';
  return '#ef4444';
}

export default function LeadSourcesPage() {
  const [days, setDays] = useState(180);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/chrisview-lead-sources?days=${days}`);
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || `HTTP ${res.status}`); }
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
            <ArrowLeft className="w-4 h-4" />Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2"><Megaphone className="w-5 h-5 text-[#39FF14]" />Lead Source Effectiveness</h1>
          <div className="ml-auto flex items-center gap-2">
            {[30, 90, 180, 365, 730].map(d => (
              <button key={d} onClick={() => setDays(d)} className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${days === d ? 'bg-[#39FF14]/10 border-[#39FF14]/40 text-[#39FF14]' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'}`}>{d}d</button>
            ))}
            <button onClick={fetchData} disabled={loading} className="p-1.5 text-zinc-400 hover:text-white rounded disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{err}</div>}
        {!data && loading && <div className="text-center py-16 text-zinc-500"><Loader2 className="w-6 h-6 animate-spin inline mr-2" />Querying JobNimbus…</div>}
        {data && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Leads in window" value={data.totalLeads.toString()} sub={`last ${data.daysQueried}d`} highlight />
              <Kpi label="Distinct sources" value={data.bySource.length.toString()} />
              <Kpi label="Total converted" value={data.bySource.reduce((s, r) => s + r.converted, 0).toString()} />
              <Kpi label="Overall close" value={`${data.totalLeads > 0 ? ((data.bySource.reduce((s, r) => s + r.converted, 0) / data.totalLeads) * 100).toFixed(1) : 0}%`} />
            </section>

            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Sources Ranked by Volume — Close % Color-Coded</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.bySource.slice(0, 15)} layout="vertical" margin={{ top: 8, right: 8, bottom: 8, left: 130 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis type="number" stroke="#71717a" fontSize={10} />
                    <YAxis type="category" dataKey="source" stroke="#71717a" fontSize={10} width={130} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} />
                    <Bar dataKey="leads" name="Leads">
                      {data.bySource.slice(0, 15).map((r, i) => (
                        <Cell key={i} fill={rateColor(r.closeRate)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold">By Source</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Source</th>
                      <th className="text-right py-2 px-3 font-medium">Leads</th>
                      <th className="text-right py-2 px-3 font-medium">Converted</th>
                      <th className="text-right py-2 px-3 font-medium">Close %</th>
                      <th className="text-right py-2 px-3 font-medium">Median days→signed</th>
                      <th className="text-left py-2 px-3 font-medium">Top reps</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.bySource.map(r => (
                      <tr key={r.source} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-medium">{r.source}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{r.leads}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{r.converted}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-bold" style={{ color: rateColor(r.closeRate) }}>{r.closeRate}%</td>
                        <td className="py-2 px-3 text-right tabular-nums text-xs">{r.medianDaysToClose != null ? `${r.medianDaysToClose}d` : '—'}</td>
                        <td className="py-2 px-3 text-xs text-zinc-400">{r.topReps.map(t => `${t.rep} (${t.converted}/${t.leads})`).join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-[#39FF14]" />By Rep</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Rep</th>
                      <th className="text-right py-2 px-3 font-medium">Leads</th>
                      <th className="text-right py-2 px-3 font-medium">Converted</th>
                      <th className="text-right py-2 px-3 font-medium">Close %</th>
                      <th className="text-left py-2 px-3 font-medium">Top sources</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.byRep.map(r => (
                      <tr key={r.rep} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-medium">{r.rep}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{r.leads}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{r.converted}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-bold" style={{ color: rateColor(r.closeRate) }}>{r.closeRate}%</td>
                        <td className="py-2 px-3 text-xs text-zinc-400">{r.topSources.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <AboutThisData
          source="JN /contacts + /jobs over the last 180 days (default window). Hits JN live; cached 10 min in-memory + via the chrisview_cache master-sheet tab (hourly precompute)."
          method="Lead = JN contact created in the window. Converted = contact has a related job whose status matches signed/contract/contingency/approved/sold/won/paid/installed/complete. Close % = converted ÷ leads per source. Days-to-convert = median days from contact created to job's status-change date. Top reps per source = top 3 by converted count."
          uses="Spot which channels yield the highest close rate (not just volume). Surface reps who quietly dominate a specific source — useful for matching reps to the channels they convert best on."
          gaps="Source names are taken AS-IS from JN's source_name field. 'Google', 'google', and 'Google Ads' are separate buckets if JN stores them separately. Clean the JN dropdown upstream if you want a cleaner rollup."
          generatedAt={data?.generatedAt}
        />
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
