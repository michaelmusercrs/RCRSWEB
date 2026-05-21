'use client';

import { useState, useEffect } from 'react';
import { Star, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ComposedChart, Line, Cell,
} from 'recharts';

interface RepRow {
  rep: string;
  reviewCount: number;
  avgRating: number;
  fiveStarCount: number;
  fiveStarPct: number;
  fourPlus: number;
  threeOrLower: number;
  earliestReview: string;
  latestReview: string;
  daysSinceLatest: number;
  isActive: boolean;
  recent12mo: number;
  recent24mo: number;
}
interface YearRow { year: string; count: number; avgRating: number; fiveStarPct: number }
interface SourceRow { source: string; count: number; avgRating: number }
interface LowReview { id: string; rep: string; name: string; date: string; rating: number; text: string }
interface Data {
  generatedAt: string;
  source: string;
  totals: {
    reviews: number; averageRating: number;
    fiveStarCount: number; fiveStarPct: number;
    attributedCount: number; unattributedCount: number;
    distinctReps: number;
    recent12mo: number; recent24mo: number;
    earliest: string; latest: string;
  };
  byRep: RepRow[];
  byYear: YearRow[];
  bySource: SourceRow[];
  lowReviews: LowReview[];
}

export default function ReviewsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/chrisview-reviews');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredReps = data?.byRep.filter(r =>
    r.rep !== '(unattributed)' && (showInactive || (r.isActive && r.daysSinceLatest <= 365 * 2))
  ) || [];
  const unattributed = data?.byRep.find(r => r.rep === '(unattributed)');

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2"><Star className="w-5 h-5 text-[#39FF14]" />Reviews — Quality by Rep</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{err}</div>}
        {loading && <div className="text-center py-12 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>}
        {data && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Total reviews" value={data.totals.reviews.toString()} sub={`${data.totals.earliest} → ${data.totals.latest}`} highlight />
              <Kpi label="Avg rating" value={data.totals.averageRating.toFixed(2)} sub={`${data.totals.fiveStarPct}% are 5-star`} />
              <Kpi label="Last 12 mo" value={data.totals.recent12mo.toString()} sub={`${data.totals.recent24mo} in last 24 mo`} />
              <Kpi label="Attributed to rep" value={`${data.totals.attributedCount}`} sub={`${data.totals.unattributedCount} unattributed · ${data.totals.distinctReps} reps`} />
            </section>

            {/* Year trend */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Review Volume + Avg Rating by Year</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.byYear} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="year" stroke="#71717a" fontSize={11} />
                    <YAxis yAxisId="left" stroke="#71717a" fontSize={11} />
                    <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={11} domain={[3, 5]} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} />
                    <Bar yAxisId="left" dataKey="count" fill="#60a5fa" name="Reviews" />
                    <Line yAxisId="right" type="monotone" dataKey="avgRating" stroke="#39FF14" strokeWidth={2} name="Avg rating" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Per-rep table */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3">
                <h3 className="text-sm font-semibold">Reviews by Sales Rep</h3>
                <button
                  onClick={() => setShowInactive(!showInactive)}
                  className={`ml-auto px-3 py-1 text-xs rounded border ${showInactive ? 'bg-[#39FF14]/10 border-[#39FF14]/30 text-[#39FF14]' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}
                >
                  {showInactive ? 'Show active only' : 'Show all (incl. former)'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Rep</th>
                      <th className="text-right py-2 px-3 font-medium">Reviews</th>
                      <th className="text-right py-2 px-3 font-medium">Last 12mo</th>
                      <th className="text-right py-2 px-3 font-medium">Avg ★</th>
                      <th className="text-right py-2 px-3 font-medium">5★ count</th>
                      <th className="text-right py-2 px-3 font-medium">5★ %</th>
                      <th className="text-right py-2 px-3 font-medium">≤3★</th>
                      <th className="text-left py-2 px-3 font-medium">First → last</th>
                      <th className="text-right py-2 px-3 font-medium">Days since last</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filteredReps.map(r => (
                      <tr key={r.rep} className={`hover:bg-zinc-800/30 ${r.threeOrLower > 0 ? 'bg-amber-500/5' : ''}`}>
                        <td className="py-2 px-3 font-medium">
                          {r.rep}
                          {!r.isActive && <span className="ml-2 text-[10px] text-zinc-500">(historical)</span>}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14] font-bold">{r.reviewCount}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{r.recent12mo || <span className="text-zinc-600">0</span>}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{r.avgRating}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-amber-300">{r.fiveStarCount}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{r.fiveStarPct}%</td>
                        <td className={`py-2 px-3 text-right tabular-nums ${r.threeOrLower > 0 ? 'text-amber-400 font-bold' : 'text-zinc-600'}`}>{r.threeOrLower || '—'}</td>
                        <td className="py-2 px-3 text-xs text-zinc-400">{r.earliestReview} → {r.latestReview}</td>
                        <td className={`py-2 px-3 text-right tabular-nums text-xs ${r.daysSinceLatest > 365 ? 'text-zinc-500' : r.daysSinceLatest > 180 ? 'text-amber-300' : 'text-[#39FF14]'}`}>{r.daysSinceLatest}d</td>
                      </tr>
                    ))}
                    {unattributed && (
                      <tr className="bg-zinc-950 border-t-2 border-zinc-700">
                        <td className="py-2 px-3 text-zinc-500 italic">(unattributed)</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{unattributed.reviewCount}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-500">{unattributed.recent12mo}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{unattributed.avgRating}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-500">{unattributed.fiveStarCount}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-500">{unattributed.fiveStarPct}%</td>
                        <td className="py-2 px-3 text-right tabular-nums text-amber-400">{unattributed.threeOrLower || '—'}</td>
                        <td className="py-2 px-3 text-xs text-zinc-500">{unattributed.earliestReview} → {unattributed.latestReview}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-xs text-zinc-500">{unattributed.daysSinceLatest}d</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-zinc-500 px-4 py-2">
                {data.totals.unattributedCount} reviews ({Math.round((data.totals.unattributedCount / data.totals.reviews) * 100)}%) don&apos;t mention a specific rep by name — they could come from anyone.
              </p>
            </section>

            {/* Sources */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Reviews by Source</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {data.bySource.map(s => (
                  <div key={s.source} className="rounded-lg p-3 border border-zinc-800 bg-zinc-950">
                    <div className="text-[10px] uppercase tracking-wide text-zinc-500">{s.source}</div>
                    <div className="text-lg font-bold mt-1">{s.count}</div>
                    <div className="text-xs text-zinc-400">{s.avgRating} avg ★</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Low-rating reviews */}
            {data.lowReviews.length > 0 && (
              <section className="bg-amber-500/5 border border-amber-500/30 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-amber-500/30 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-amber-300">≤ 3-Star Reviews ({data.lowReviews.length}) — every one is worth reading</h3>
                </div>
                <div className="divide-y divide-amber-500/10">
                  {data.lowReviews.map(r => (
                    <div key={r.id} className="px-4 py-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-amber-300">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                        <span className="text-white font-medium">{r.name}</span>
                        <span className="text-zinc-500">·</span>
                        <span className="text-zinc-400">{r.date}</span>
                        <span className="text-zinc-500">·</span>
                        <span className="text-zinc-400">rep: {r.rep}</span>
                      </div>
                      <p className="text-sm text-zinc-300 mt-1 leading-relaxed">{r.text}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <p className="text-[10px] text-zinc-500 text-center">
              Data: {data.source} (last refresh {data.generatedAt}). Method-correlation (estimate-delivery → review) requires linking 187 reviewers to JN contacts — that&apos;s a one-shot build job; ask Michael if you want it.
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
