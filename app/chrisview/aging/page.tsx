'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, ArrowLeft, Loader2, RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';

type Bucket = '0-7d' | '8-14d' | '15-30d' | '30+d';

interface TopAged {
  estimateJnid: string;
  estimateNumber: string;
  customer: string;
  rep: string;
  amount: number;
  daysIdle: number;
  lastActivity: string | null;
  lastActivityType: string | null;
  status: string;
  jobUrl: string;
}

interface ByRep {
  rep: string;
  openCount: number;
  p50DaysIdle: number | null;
  p90DaysIdle: number | null;
  oldest: number;
}

interface AgingData {
  generatedAt: string;
  windowDays: number;
  totalOpen: number;
  byBucket: Array<{ bucket: Bucket; count: number; percent: number }>;
  topAged: TopAged[];
  byRep: ByRep[];
  meta: {
    queryTimeMs: number;
    estimatesFetched: number;
    estimatesOpen: number;
    activitiesFetched: number;
    contactsFetched: number;
    jobsFetched: number;
  };
}

const BUCKET_COLOR: Record<Bucket, string> = {
  '0-7d': '#39FF14',
  '8-14d': '#fbbf24',
  '15-30d': '#fb923c',
  '30+d': '#ef4444',
};

function fmtMoney(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function urgencyColor(daysIdle: number): string {
  if (daysIdle > 30) return 'text-red-300 font-bold';
  if (daysIdle > 14) return 'text-orange-300 font-semibold';
  if (daysIdle > 7) return 'text-amber-300';
  return 'text-zinc-300';
}

export default function EstimateAgingPage() {
  const [days, setDays] = useState(180);
  const [data, setData] = useState<AgingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/chrisview-aging?days=${days}`);
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

  // KPIs derived from data
  const kpiP50 = (() => {
    if (!data || !data.topAged.length) return null;
    // Aggregate p50 across ALL open estimates — compute from byRep weighted
    // approximation: use the median of all topAged (capped at 50 anyway).
    const all = data.topAged.map(t => t.daysIdle);
    if (!all.length) return null;
    const sorted = [...all].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  })();
  const kpiOldest = data?.topAged[0]?.daysIdle ?? null;
  const kpiOver30 = data?.byBucket.find(b => b.bucket === '30+d')?.count ?? 0;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#39FF14]" />Estimate Aging Queue
          </h1>
          <div className="ml-auto flex items-center gap-2">
            {[30, 90, 180, 365].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs rounded-lg border ${days === d ? 'bg-[#39FF14]/10 border-[#39FF14]/40 text-[#39FF14]' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'}`}
              >
                {d}d
              </button>
            ))}
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 text-zinc-400 hover:text-white rounded disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <p className="text-xs text-zinc-400">
          Every OPEN estimate created in the last {days} days, ranked by days idle since the
          last <strong>manual</strong> rep activity. Status changes, contact creates, and other
          auto-events do not reset the clock. Anything &gt; 14 days needs a nudge; &gt; 30 days
          is rotting.
        </p>

        {err && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">
            {err}
          </div>
        )}

        {!data && loading && (
          <div className="text-center py-16 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin inline mr-2" />
            Walking every open estimate&apos;s activity history… 30-120s on cold cache.
          </div>
        )}

        {data && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Open estimates" value={data.totalOpen.toString()} sub={`last ${data.windowDays}d`} highlight />
              <Kpi label="Median days idle" value={kpiP50 != null ? `${kpiP50}d` : '—'} sub="of top-aged sample" />
              <Kpi label="Oldest estimate" value={kpiOldest != null ? `${kpiOldest}d` : '—'} sub="days idle, worst case" />
              <Kpi label="Rotting (>30d)" value={kpiOver30.toString()} sub="needs intervention" />
            </section>

            {/* Bucket distribution chart */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Idle-Time Bucket Distribution</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byBucket} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="bucket" stroke="#71717a" fontSize={11} />
                    <YAxis stroke="#71717a" fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                      formatter={(v: number | undefined) => v != null ? `${v} estimates` : '—'}
                    />
                    <Bar dataKey="count" name="count">
                      {data.byBucket.map((b, i) => (
                        <Cell key={i} fill={BUCKET_COLOR[b.bucket]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
                {data.byBucket.map(b => (
                  <div key={b.bucket} className="bg-zinc-950 border border-zinc-800 rounded p-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: BUCKET_COLOR[b.bucket] }} />
                      <span className="font-medium">{b.bucket}</span>
                    </div>
                    <div className="text-zinc-400 mt-1">{b.count} · {b.percent}%</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Top aged estimates table */}
            <section className="bg-red-500/5 border border-red-500/30 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-red-500/30 flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-semibold text-red-300">
                  Top Aged Estimates — {data.topAged.length} oldest open estimate{data.topAged.length === 1 ? '' : 's'}
                </h3>
                <span className="ml-auto text-[10px] text-red-300/70">
                  Sorted by days idle, capped at 50. Last activity excludes status changes &amp; auto-events.
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-red-200/70 uppercase tracking-wide bg-red-500/10 border-b border-red-500/20">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Est #</th>
                      <th className="text-left py-2 px-3 font-medium">Customer</th>
                      <th className="text-left py-2 px-3 font-medium">Rep</th>
                      <th className="text-right py-2 px-3 font-medium">Amount</th>
                      <th className="text-right py-2 px-3 font-medium">Days Idle</th>
                      <th className="text-left py-2 px-3 font-medium">Last Activity</th>
                      <th className="text-left py-2 px-3 font-medium">Status</th>
                      <th className="text-left py-2 px-3 font-medium">JN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-500/10">
                    {data.topAged.length === 0 && (
                      <tr><td colSpan={8} className="py-6 text-center text-zinc-500">No open estimates in this window. Pipeline is clean.</td></tr>
                    )}
                    {data.topAged.map(t => (
                      <tr key={t.estimateJnid} className="hover:bg-red-500/10">
                        <td className="py-2 px-3 font-mono text-xs text-zinc-300">{t.estimateNumber || '—'}</td>
                        <td className="py-2 px-3 font-medium">{t.customer}</td>
                        <td className="py-2 px-3 text-xs">{t.rep}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-xs text-zinc-300">{fmtMoney(t.amount)}</td>
                        <td className={`py-2 px-3 text-right tabular-nums ${urgencyColor(t.daysIdle)}`}>{t.daysIdle}d</td>
                        <td className="py-2 px-3 text-xs text-zinc-400">
                          {t.lastActivity
                            ? <>{t.lastActivityType || 'activity'} · {t.lastActivity.slice(0, 10)}</>
                            : <span className="text-red-400">never (since estimate)</span>}
                        </td>
                        <td className="py-2 px-3 text-xs text-zinc-400">{t.status || '—'}</td>
                        <td className="py-2 px-3 text-xs">
                          <a
                            href={t.jobUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#39FF14] hover:text-[#39FF14]/80"
                          >
                            open <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Per-rep summary */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold">Per-Rep Aging Summary</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  p50 = median days idle across this rep&apos;s open estimates · p90 = the top 10% worst · oldest = single worst.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Rep</th>
                      <th className="text-right py-2 px-3 font-medium">Open</th>
                      <th className="text-right py-2 px-3 font-medium">p50 idle</th>
                      <th className="text-right py-2 px-3 font-medium">p90 idle</th>
                      <th className="text-right py-2 px-3 font-medium">Oldest</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.byRep.length === 0 && (
                      <tr><td colSpan={5} className="py-6 text-center text-zinc-500">No reps have open estimates.</td></tr>
                    )}
                    {data.byRep.map(r => (
                      <tr key={r.rep} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-medium">{r.rep}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-300">{r.openCount}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-xs">{r.p50DaysIdle != null ? `${r.p50DaysIdle}d` : '—'}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-xs">{r.p90DaysIdle != null ? `${r.p90DaysIdle}d` : '—'}</td>
                        <td className={`py-2 px-3 text-right tabular-nums ${urgencyColor(r.oldest)}`}>{r.oldest}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="text-[10px] text-zinc-500 text-center">
              Generated {data.generatedAt.slice(0, 16).replace('T', ' ')} · pulled {data.meta.estimatesFetched} estimates ·{' '}
              {data.meta.activitiesFetched} activities · {data.meta.queryTimeMs}ms
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
