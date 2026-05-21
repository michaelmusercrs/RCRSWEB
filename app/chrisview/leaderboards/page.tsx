'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, ArrowLeft, Loader2, Info } from 'lucide-react';

interface CommRow { rep: string; total: number; paymentCount: number }
interface AccrualRow { rep: string; total: number; weeks: number; signed: number }
interface WeekRow { rep: string; avgAccrualPerWeek: number; avgSignedPerWeek: number; weeks: number }
interface JoinedRow { rep: string; commissionCash: number | null; meetingAccrual: number | null; avgWeekly: number | null; signedThisWindow: number | null }
interface Data {
  generatedAt: string;
  windowMonths: number;
  windowLabel: string;
  commission: CommRow[];
  salesAccrual: AccrualRow[];
  perWeekAvg: WeekRow[];
  joined: JoinedRow[];
}

function fmtMoney(n: number | null) {
  if (n == null) return '—';
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(1)}K`;
  return `${sign}$${a.toFixed(0)}`;
}

export default function LeaderboardsPage() {
  const [months, setMonths] = useState(12);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/chrisview-leaderboards?months=${months}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [months]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2"><Trophy className="w-5 h-5 text-[#39FF14]" />Three Leaderboards — Side-by-Side</h1>
          <div className="ml-auto flex items-center gap-2">
            {[3, 6, 12, 24, 36, 96].map(m => (
              <button key={m} onClick={() => setMonths(m)} className={`px-3 py-1.5 text-xs rounded-lg border ${months === m ? 'bg-[#39FF14]/10 border-[#39FF14]/40 text-[#39FF14]' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'}`}>
                {m === 96 ? 'all' : `${m}mo`}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{err}</div>}
        {loading && !data && <div className="text-center py-12 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>}

        <section className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" />
            <div className="text-xs leading-relaxed text-amber-100">
              <strong>Why these numbers don&apos;t match.</strong> Each leaderboard measures a different point in the deal lifecycle. The
              <strong className="text-[#39FF14]"> Commission</strong> board is what the rep was actually paid (QB 1099 cash, often months after the sale). The
              <strong className="text-blue-300"> Sales Accrual</strong> board is what they claimed on Monday morning ($$$$$, recognized at signing). The
              <strong className="text-purple-300"> Per-Week Average</strong> normalizes accrual by tenure. Don&apos;t add them together — they&apos;re three views of the same revenue.
            </div>
          </div>
        </section>

        {data && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Board title="Commission ($)" subtitle="QB 1099 cash paid out" color="text-[#39FF14]">
                <table className="w-full text-xs">
                  <thead className="text-[10px] text-zinc-500 uppercase tracking-wide bg-zinc-950">
                    <tr><th className="text-left py-1 px-2">#</th><th className="text-left py-1 px-2">Rep</th><th className="text-right py-1 px-2">Total</th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.commission.slice(0, 15).map((r, i) => (
                      <tr key={r.rep} className="hover:bg-zinc-800/30">
                        <td className="py-1 px-2 text-zinc-500 font-mono">{i + 1}</td>
                        <td className="py-1 px-2">{r.rep}</td>
                        <td className="py-1 px-2 text-right tabular-nums text-[#39FF14] font-bold">{fmtMoney(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Board>

              <Board title="Sales Accrual ($)" subtitle="Monday $$$$$ self-report" color="text-blue-300">
                <table className="w-full text-xs">
                  <thead className="text-[10px] text-zinc-500 uppercase tracking-wide bg-zinc-950">
                    <tr><th className="text-left py-1 px-2">#</th><th className="text-left py-1 px-2">Rep</th><th className="text-right py-1 px-2">Total</th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.salesAccrual.slice(0, 15).map((r, i) => (
                      <tr key={r.rep} className="hover:bg-zinc-800/30">
                        <td className="py-1 px-2 text-zinc-500 font-mono">{i + 1}</td>
                        <td className="py-1 px-2">{r.rep}</td>
                        <td className="py-1 px-2 text-right tabular-nums text-blue-300 font-bold">{fmtMoney(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Board>

              <Board title="Per-Week Avg ($)" subtitle="Normalized by tenure" color="text-purple-300">
                <table className="w-full text-xs">
                  <thead className="text-[10px] text-zinc-500 uppercase tracking-wide bg-zinc-950">
                    <tr><th className="text-left py-1 px-2">#</th><th className="text-left py-1 px-2">Rep</th><th className="text-right py-1 px-2">$/wk</th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.perWeekAvg.slice(0, 15).map((r, i) => (
                      <tr key={r.rep} className="hover:bg-zinc-800/30">
                        <td className="py-1 px-2 text-zinc-500 font-mono">{i + 1}</td>
                        <td className="py-1 px-2">{r.rep} <span className="text-zinc-500">({r.weeks}w)</span></td>
                        <td className="py-1 px-2 text-right tabular-nums text-purple-300 font-bold">{fmtMoney(r.avgAccrualPerWeek)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Board>
            </section>

            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold">Side-by-Side Join — {data.windowLabel}</h3>
                <p className="text-[10px] text-zinc-500 mt-1">QB names mapped to meeting names where possible. Cells in parentheses are meeting-only reps with no QB match in window.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Rep (QB name)</th>
                      <th className="text-right py-2 px-3 font-medium text-[#39FF14]">Commission $</th>
                      <th className="text-right py-2 px-3 font-medium text-blue-300">Meeting Accrual $</th>
                      <th className="text-right py-2 px-3 font-medium text-purple-300">Avg $/week</th>
                      <th className="text-right py-2 px-3 font-medium">Signed (window)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.joined.map(r => (
                      <tr key={r.rep} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-medium">{r.rep}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{fmtMoney(r.commissionCash)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-blue-300">{fmtMoney(r.meetingAccrual)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-purple-300">{fmtMoney(r.avgWeekly)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{r.signedThisWindow ?? '—'}</td>
                      </tr>
                    ))}
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

function Board({ title, subtitle, color, children }: { title: string; subtitle: string; color: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-800">
        <div className={`text-xs font-semibold ${color}`}>{title}</div>
        <div className="text-[10px] text-zinc-500">{subtitle}</div>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
