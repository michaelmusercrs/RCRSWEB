'use client';

import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Loader2, AlertTriangle, MessageSquare, TrendingUp, Megaphone } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

interface RepRow {
  rep: string;
  isActive: boolean;
  lifetimeJobs: number;
  lifetimeReviews: number;
  lifetimeRate: number;
  last12moJobs: number;
  last12moReviews: number;
  last12moRate: number;
  last90dJobs: number;
  last90dReviews: number;
  last90dRate: number;
  lastReviewDate: string | null;
  daysSinceLastReview: number | null;
  lastJobDate: string | null;
  gap: 'flag' | 'ok' | 'great';
}
interface YearRow { year: string; jobs: number; reviews: number; rate: number }
interface Data {
  generatedAt: string;
  source: string;
  totals: {
    jobs: number;
    reviews: number;
    reviewRate: number;
    last12moJobs: number;
    last12moReviews: number;
    last12moRate: number;
    last90dJobs: number;
    last90dReviews: number;
    last90dRate: number;
    gapFlagCount: number;
    distinctReps: number;
  };
  byRep: RepRow[];
  byYear: YearRow[];
  askThemToAsk: RepRow[];
}

type SortKey =
  | 'rep' | 'lifetimeJobs' | 'lifetimeReviews' | 'lifetimeRate'
  | 'last12moJobs' | 'last12moReviews' | 'last12moRate'
  | 'last90dJobs' | 'daysSinceLastReview';

const GAP_BADGE: Record<RepRow['gap'], { label: string; cls: string }> = {
  flag:  { label: 'ASK MORE', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  ok:    { label: 'ok',       cls: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
  great: { label: 'great',    cls: 'bg-[#39FF14]/15 text-[#39FF14] border-[#39FF14]/40' },
};

export default function ReviewVelocityPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('last12moJobs');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/chrisview-review-velocity');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sortedRows = useMemo(() => {
    if (!data) return [];
    const base = data.byRep.filter(r => showInactive || r.isActive);
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => {
      if (sortKey === 'rep') return a.rep.localeCompare(b.rep) * dir;
      if (sortKey === 'daysSinceLastReview') {
        const av = a.daysSinceLastReview ?? 99999;
        const bv = b.daysSinceLastReview ?? 99999;
        return (av - bv) * dir;
      }
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return (av - bv) * dir;
    });
  }, [data, showInactive, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'rep' ? 'asc' : 'desc'); }
  }
  const arrow = (k: SortKey) => sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#39FF14]" />
            Review Velocity — Asked Rate per Job
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">
            {err}
          </div>
        )}
        {loading && (
          <div className="text-center py-12 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…
          </div>
        )}
        {data && (
          <>
            {/* The headline message */}
            <section className="bg-gradient-to-br from-[#39FF14]/5 to-zinc-900 border border-[#39FF14]/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-[#39FF14] mt-0.5 flex-shrink-0" />
                <div className="text-sm text-zinc-300 leading-relaxed">
                  <strong className="text-white">
                    {data.totals.reviews.toLocaleString()} reviews across {data.totals.jobs.toLocaleString()} completed jobs ({data.totals.reviewRate}% ask-and-receive rate).
                  </strong>{' '}
                  Reviews are RCRS&apos;s single biggest SEO weakness — top competitors have 800+
                  while we sit at this number. Every closed job is a missed chance if we don&apos;t
                  ask. The table below sorts by who&apos;s closing the most work right now so the
                  highest-leverage nudges are at the top.
                </div>
              </div>
            </section>

            {/* KPI strip */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi
                label="Lifetime rate"
                value={`${data.totals.reviewRate}%`}
                sub={`${data.totals.reviews} reviews / ${data.totals.jobs.toLocaleString()} jobs`}
                highlight
              />
              <Kpi
                label="Last 12 mo rate"
                value={`${data.totals.last12moRate}%`}
                sub={`${data.totals.last12moReviews} reviews / ${data.totals.last12moJobs} jobs`}
              />
              <Kpi
                label="Last 90 days rate"
                value={`${data.totals.last90dRate}%`}
                sub={`${data.totals.last90dReviews} reviews / ${data.totals.last90dJobs} jobs`}
                warn={data.totals.last90dRate < 5}
              />
              <Kpi
                label="Reps flagged"
                value={data.totals.gapFlagCount.toString()}
                sub={`of ${data.totals.distinctReps} reps with jobs`}
                warn={data.totals.gapFlagCount > 0}
              />
            </section>

            {/* Year trend */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Jobs vs Reviews by Year (+ ask rate)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.byYear} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="year" stroke="#71717a" fontSize={11} />
                    <YAxis yAxisId="left" stroke="#71717a" fontSize={11} />
                    <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={11} domain={[0, 'auto']} unit="%" />
                    <Tooltip
                      contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                      formatter={(val: number | string | undefined, name: string | undefined) => {
                        if (name === 'Ask rate %') return [`${val ?? 0}%`, name];
                        return [val ?? 0, name ?? ''];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="left" dataKey="jobs" fill="#3f3f46" name="Jobs" />
                    <Bar yAxisId="left" dataKey="reviews" fill="#60a5fa" name="Reviews" />
                    <Line yAxisId="right" type="monotone" dataKey="rate" stroke="#39FF14" strokeWidth={2} name="Ask rate %" dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Ask-them-to-ask callout */}
            {data.askThemToAsk.length > 0 && (
              <section className="bg-amber-500/5 border border-amber-500/30 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-amber-500/30 flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-amber-300">
                    Ask-them-to-ask — Top {data.askThemToAsk.length}: most jobs closed, fewest reviews requested
                  </h3>
                </div>
                <div className="divide-y divide-amber-500/10">
                  {data.askThemToAsk.map(r => (
                    <div key={r.rep} className="px-4 py-3 flex items-center gap-4 flex-wrap">
                      <div className="font-bold text-white min-w-[140px]">{r.rep}</div>
                      <div className="text-xs text-zinc-400">
                        <span className="text-amber-300 font-bold">{r.last12moJobs}</span> jobs in last 12 mo
                      </div>
                      <div className="text-xs text-zinc-400">
                        only <span className="text-amber-300 font-bold">{r.last12moReviews}</span> review{r.last12moReviews === 1 ? '' : 's'} = <span className="text-amber-300 font-bold">{r.last12moRate}%</span>
                      </div>
                      <div className="text-xs text-zinc-500">
                        last review: {r.lastReviewDate || 'never'}
                        {r.daysSinceLastReview != null && ` (${r.daysSinceLastReview}d ago)`}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-500 px-4 py-2">
                  Filter: active reps with 5+ jobs in last 12 months and &lt;10% ask rate. The
                  ROI of one text message asking for a review is enormous; these reps are the
                  highest-leverage nudges this quarter.
                </p>
              </section>
            )}

            {/* Per-rep table */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3">
                <h3 className="text-sm font-semibold">Per-Rep Review Velocity</h3>
                <button
                  onClick={() => setShowInactive(s => !s)}
                  className={`ml-auto px-3 py-1 text-xs rounded border ${showInactive ? 'bg-[#39FF14]/10 border-[#39FF14]/30 text-[#39FF14]' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}
                >
                  {showInactive ? 'Show active only' : 'Show all (incl. historical)'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <Th onClick={() => toggleSort('rep')}>Rep{arrow('rep')}</Th>
                      <Th right onClick={() => toggleSort('lifetimeJobs')}>Lifetime jobs{arrow('lifetimeJobs')}</Th>
                      <Th right onClick={() => toggleSort('lifetimeReviews')}>Lifetime ★{arrow('lifetimeReviews')}</Th>
                      <Th right onClick={() => toggleSort('lifetimeRate')}>Lifetime %{arrow('lifetimeRate')}</Th>
                      <Th right onClick={() => toggleSort('last12moJobs')}>12mo jobs{arrow('last12moJobs')}</Th>
                      <Th right onClick={() => toggleSort('last12moReviews')}>12mo ★{arrow('last12moReviews')}</Th>
                      <Th right onClick={() => toggleSort('last12moRate')}>12mo %{arrow('last12moRate')}</Th>
                      <Th right onClick={() => toggleSort('last90dJobs')}>90d jobs{arrow('last90dJobs')}</Th>
                      <Th right onClick={() => toggleSort('daysSinceLastReview')}>Days since ★{arrow('daysSinceLastReview')}</Th>
                      <th className="text-center py-2 px-3 font-medium">Gap</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {sortedRows.map(r => {
                      const badge = GAP_BADGE[r.gap];
                      return (
                        <tr key={r.rep} className={`hover:bg-zinc-800/30 ${r.gap === 'flag' ? 'bg-amber-500/5' : ''}`}>
                          <td className="py-2 px-3 font-medium">
                            {r.rep}
                            {!r.isActive && <span className="ml-2 text-[10px] text-zinc-500">(historical)</span>}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-zinc-300">{r.lifetimeJobs}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-amber-300">{r.lifetimeReviews || <span className="text-zinc-600">0</span>}</td>
                          <td className={`py-2 px-3 text-right tabular-nums ${rateColor(r.lifetimeRate)}`}>{r.lifetimeRate}%</td>
                          <td className="py-2 px-3 text-right tabular-nums text-[#39FF14] font-bold">{r.last12moJobs || <span className="text-zinc-600 font-normal">0</span>}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-amber-300">{r.last12moReviews || <span className="text-zinc-600">0</span>}</td>
                          <td className={`py-2 px-3 text-right tabular-nums font-bold ${rateColor(r.last12moRate, true)}`}>{r.last12moRate}%</td>
                          <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{r.last90dJobs}</td>
                          <td className={`py-2 px-3 text-right tabular-nums text-xs ${daysColor(r.daysSinceLastReview)}`}>
                            {r.daysSinceLastReview != null ? `${r.daysSinceLastReview}d` : '—'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wide border ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-zinc-500 px-4 py-2 leading-relaxed">
                &ldquo;Job&rdquo; = a posted invoice in QuickBooks (deduped per project/customer).
                &ldquo;Gap&rdquo; flags any active rep with 8+ closed jobs in the last 12 months and a &lt;5% review rate.
                Click any column header to sort.
              </p>
            </section>

            <p className="text-[10px] text-zinc-500 text-center">
              Data: {data.source} (refresh {data.generatedAt}). SEO context: reviews are RCRS&apos;s
              biggest competitive gap per the SEO monitor — every ask matters.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function Kpi({ label, value, sub, highlight, warn }: { label: string; value: string; sub?: string; highlight?: boolean; warn?: boolean }) {
  const cls = warn
    ? 'bg-gradient-to-br from-amber-500/10 to-zinc-900 border-amber-500/30'
    : highlight
      ? 'bg-gradient-to-br from-[#39FF14]/10 to-zinc-900 border-[#39FF14]/30'
      : 'bg-zinc-900 border-zinc-800';
  return (
    <div className={`rounded-xl p-3 border ${cls}`}>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`text-xl font-bold mt-1 ${warn ? 'text-amber-300' : 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Th({ children, onClick, right }: { children: React.ReactNode; onClick?: () => void; right?: boolean }) {
  return (
    <th
      onClick={onClick}
      className={`${right ? 'text-right' : 'text-left'} py-2 px-3 font-medium cursor-pointer select-none hover:text-white`}
    >
      {children}
    </th>
  );
}

function rateColor(rate: number, recent = false): string {
  if (rate >= (recent ? 15 : 10)) return 'text-[#39FF14]';
  if (rate >= (recent ? 5 : 3)) return 'text-zinc-300';
  if (rate > 0) return 'text-amber-300';
  return 'text-zinc-600';
}

function daysColor(d: number | null): string {
  if (d == null) return 'text-zinc-600';
  if (d > 365) return 'text-amber-400';
  if (d > 180) return 'text-amber-300';
  return 'text-[#39FF14]';
}
