'use client';

import { useState, useEffect } from 'react';
import { Trophy, ArrowLeft, Loader2, DollarSign, Star } from 'lucide-react';

interface Rep {
  rep: string;
  isActive: boolean;
  lifetimeCommission: number;
  last12moCommission: number;
  ytdCommission: number;
  paymentCount: number;
  lastPaymentDate: string | null;
  daysSinceLastPayment: number | null;
  reviewCount: number;
  avgRating: number;
  fiveStarPct: number;
  lowRatings: number;
  last12moReviews: number;
  lastReviewDate: string | null;
  reviewToPaymentRatio: number;
  recentEarnings: 'top' | 'high' | 'mid' | 'low' | 'inactive';
  recentReviews: 'top' | 'high' | 'mid' | 'low' | 'none';
}
interface Data {
  generatedAt: string;
  totalActiveReps: number;
  reps: Rep[];
  totals: { lifetimeCommission: number; last12moCommission: number; ytdCommission: number; reviews: number };
}

function fmtMoney(n: number) {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `$${(a / 1_000).toFixed(1)}K`;
  return `$${a.toFixed(0)}`;
}
const EARN_COLOR: Record<Rep['recentEarnings'], string> = {
  top: 'text-[#39FF14] font-bold',
  high: 'text-lime-300',
  mid: 'text-zinc-200',
  low: 'text-amber-300',
  inactive: 'text-zinc-500',
};
const REV_COLOR: Record<Rep['recentReviews'], string> = {
  top: 'text-[#39FF14] font-bold',
  high: 'text-lime-300',
  mid: 'text-zinc-200',
  low: 'text-amber-300',
  none: 'text-zinc-600',
};

export default function ScorecardPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/chrisview-scorecard');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rows = data?.reps.filter(r => showAll || r.isActive) || [];

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2"><Trophy className="w-5 h-5 text-[#39FF14]" />Rep Scorecard</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{err}</div>}
        {loading && <div className="text-center py-12 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>}
        {data && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Active reps" value={data.totalActiveReps.toString()} highlight icon={<Trophy className="w-3 h-3" />} />
              <Kpi label="YTD commissions" value={fmtMoney(data.totals.ytdCommission)} icon={<DollarSign className="w-3 h-3" />} />
              <Kpi label="Last 12mo commissions" value={fmtMoney(data.totals.last12moCommission)} icon={<DollarSign className="w-3 h-3" />} />
              <Kpi label="Lifetime reviews" value={data.totals.reviews.toString()} icon={<Star className="w-3 h-3" />} />
            </section>

            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3">
                <h3 className="text-sm font-semibold">Per-Rep Scorecard</h3>
                <button
                  onClick={() => setShowAll(!showAll)}
                  className={`ml-auto px-3 py-1 text-xs rounded border ${showAll ? 'bg-[#39FF14]/10 border-[#39FF14]/30 text-[#39FF14]' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}
                >
                  {showAll ? 'Active only' : 'Show all (incl. historical)'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Rep</th>
                      <th className="text-right py-2 px-3 font-medium">Lifetime $</th>
                      <th className="text-right py-2 px-3 font-medium">Last 12mo $</th>
                      <th className="text-right py-2 px-3 font-medium">YTD $</th>
                      <th className="text-right py-2 px-3 font-medium">Payments</th>
                      <th className="text-right py-2 px-3 font-medium">Days since pay</th>
                      <th className="text-right py-2 px-3 font-medium">Reviews</th>
                      <th className="text-right py-2 px-3 font-medium">Last 12mo</th>
                      <th className="text-right py-2 px-3 font-medium">Avg ★</th>
                      <th className="text-right py-2 px-3 font-medium">≤3★</th>
                      <th className="text-right py-2 px-3 font-medium">Rev/Pay ratio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {rows.map(r => (
                      <tr key={r.rep} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-medium">
                          {r.rep}
                          {!r.isActive && <span className="ml-2 text-[10px] text-zinc-500">(historical)</span>}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-300">{fmtMoney(r.lifetimeCommission)}</td>
                        <td className={`py-2 px-3 text-right tabular-nums ${EARN_COLOR[r.recentEarnings]}`}>{fmtMoney(r.last12moCommission)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{fmtMoney(r.ytdCommission)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{r.paymentCount}</td>
                        <td className={`py-2 px-3 text-right tabular-nums text-xs ${(r.daysSinceLastPayment ?? 9999) > 180 ? 'text-amber-400' : 'text-zinc-400'}`}>
                          {r.daysSinceLastPayment != null ? `${r.daysSinceLastPayment}d` : '—'}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-amber-300">{r.reviewCount || '—'}</td>
                        <td className={`py-2 px-3 text-right tabular-nums ${REV_COLOR[r.recentReviews]}`}>{r.last12moReviews || '—'}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{r.avgRating || '—'}</td>
                        <td className={`py-2 px-3 text-right tabular-nums ${r.lowRatings > 0 ? 'text-amber-400 font-bold' : 'text-zinc-600'}`}>{r.lowRatings || '—'}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{r.reviewToPaymentRatio || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-zinc-500 px-4 py-2">
                Active reps colored by tier vs other active reps (top/high/mid/low). &ldquo;Rev/Pay ratio&rdquo; = reviews per 100 commission payments — higher means more customers leaving reviews.
              </p>
            </section>

            <p className="text-[10px] text-zinc-500 text-center">
              Composed from data/commissions.json (1099 reports, 15.5K rows) + data/reviews-master.json (317 Google reviews). Active-rep list per global memory.
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
