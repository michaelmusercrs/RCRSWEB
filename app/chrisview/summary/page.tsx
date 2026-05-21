'use client';

import { useState, useEffect } from 'react';
import { Briefcase, ArrowLeft, Loader2, DollarSign, TrendingUp, Star, Users, Calendar, Award } from 'lucide-react';
import AboutThisData from '@/components/AboutThisData';

interface Data {
  generatedAt: string;
  asOf: string;
  lifetime: { revenue: number; expense: number; netCash: number; margin: number; invoices: number; avgInvoice: number; customers: number };
  ytd: { revenue: number; expense: number; netCash: number; margin: number; invoices: number; vsPriorYearPct: number | null; monthsCompleted: number };
  last12mo: { revenue: number; expense: number; netCash: number; commissionsPaid: number; reviews: number; fiveStarReviews: number; avgRating: number | null };
  records: {
    bestMonth: { month: string; revenue: number };
    bestYear: { year: string; revenue: number };
    worstLossMonth: { month: string; net: number };
    biggestCommission: { date: string; amount: number; rep: string; customer: string };
    longestTenureRep: { rep: string; years: number };
    topCustomerLifetime: { customer: string; total: number };
  };
  reps: { activeCount: number; top5Last12mo: Array<{ rep: string; commissions: number }> };
  reviews: { total: number; fiveStarPct: number; avgRating: number; bestSingleMonth: { month: string; count: number } };
}

function fmtMoney(n: number) {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(1)}K`;
  return `${sign}$${a.toFixed(0)}`;
}

export default function SummaryPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/chrisview-summary');
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
          <h1 className="text-lg font-semibold flex items-center gap-2"><Briefcase className="w-5 h-5 text-[#39FF14]" />Executive Summary — One Screen</h1>
          {data && <span className="ml-auto text-[10px] text-zinc-500">As of {data.asOf}</span>}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{err}</div>}
        {loading && <div className="text-center py-12 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>}
        {data && (
          <>
            {/* Lifetime panel */}
            <section className="bg-gradient-to-br from-[#39FF14]/10 to-zinc-900 border border-[#39FF14]/30 rounded-xl p-6">
              <div className="text-xs uppercase tracking-wide text-zinc-400 mb-2 flex items-center gap-2"><DollarSign className="w-3 h-3" /> Lifetime</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Big label="Revenue" value={fmtMoney(data.lifetime.revenue)} />
                <Big label="Net cash" value={fmtMoney(data.lifetime.netCash)} sub={`${data.lifetime.margin}% margin`} />
                <Big label="Invoices" value={data.lifetime.invoices.toLocaleString()} sub={`${fmtMoney(data.lifetime.avgInvoice)} avg`} />
                <Big label="Customers" value={data.lifetime.customers.toLocaleString()} />
              </div>
            </section>

            {/* YTD + Last 12mo two-up */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <div className="text-xs uppercase tracking-wide text-zinc-400 mb-2 flex items-center gap-2"><Calendar className="w-3 h-3" /> YTD ({data.ytd.monthsCompleted} months)</div>
                <div className="grid grid-cols-2 gap-3">
                  <Mid label="Revenue" value={fmtMoney(data.ytd.revenue)} />
                  <Mid label="Net cash" value={fmtMoney(data.ytd.netCash)} sub={`${data.ytd.margin}% margin`} highlight={data.ytd.netCash >= 0} />
                  <Mid label="Invoices" value={data.ytd.invoices.toString()} />
                  <Mid label="vs same period last yr" value={data.ytd.vsPriorYearPct == null ? '—' : `${data.ytd.vsPriorYearPct >= 0 ? '+' : ''}${data.ytd.vsPriorYearPct}%`} highlight={(data.ytd.vsPriorYearPct ?? 0) >= 0} />
                </div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <div className="text-xs uppercase tracking-wide text-zinc-400 mb-2 flex items-center gap-2"><TrendingUp className="w-3 h-3" /> Last 12 Months</div>
                <div className="grid grid-cols-2 gap-3">
                  <Mid label="Revenue" value={fmtMoney(data.last12mo.revenue)} />
                  <Mid label="Net cash" value={fmtMoney(data.last12mo.netCash)} highlight={data.last12mo.netCash >= 0} />
                  <Mid label="1099 paid out" value={fmtMoney(data.last12mo.commissionsPaid)} />
                  <Mid label="Reviews / avg ★" value={`${data.last12mo.reviews} / ${data.last12mo.avgRating ?? '—'}`} />
                </div>
              </div>
            </section>

            {/* Active reps + reviews */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#39FF14]" />
                  <h3 className="text-sm font-semibold">Top 5 Active Reps — Last 12mo Commission</h3>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-zinc-800">
                    {data.reps.top5Last12mo.map((r, i) => (
                      <tr key={r.rep} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 text-zinc-500 font-mono text-xs w-8">{i + 1}</td>
                        <td className="py-2 px-3 font-medium">{r.rep}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14] font-bold">{fmtMoney(r.commissions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <div className="text-xs uppercase tracking-wide text-zinc-400 mb-2 flex items-center gap-2"><Star className="w-3 h-3 text-amber-300" /> Reviews</div>
                <div className="grid grid-cols-2 gap-3">
                  <Mid label="Total" value={data.reviews.total.toLocaleString()} />
                  <Mid label="Avg rating" value={data.reviews.avgRating.toFixed(2)} sub={`${data.reviews.fiveStarPct}% are 5★`} />
                  <Mid label="Best single month" value={data.reviews.bestSingleMonth.count.toString()} sub={data.reviews.bestSingleMonth.month} />
                  <Mid label="Active reps" value={data.reps.activeCount.toString()} sub="on 1099" />
                </div>
              </div>
            </section>

            {/* Records strip */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="text-xs uppercase tracking-wide text-zinc-400 mb-3 flex items-center gap-2"><Award className="w-3 h-3 text-amber-300" /> All-Time Records</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Record label="Biggest commission ever" value={fmtMoney(data.records.biggestCommission.amount)} sub={`${data.records.biggestCommission.rep} · ${data.records.biggestCommission.date}`} detail={data.records.biggestCommission.customer} />
                <Record label="Best revenue month" value={fmtMoney(data.records.bestMonth.revenue)} sub={data.records.bestMonth.month} />
                <Record label="Best year" value={fmtMoney(data.records.bestYear.revenue)} sub={data.records.bestYear.year} />
                <Record label="Worst loss month" value={fmtMoney(data.records.worstLossMonth.net)} sub={data.records.worstLossMonth.month} amber />
                <Record label="Longest-tenure rep" value={data.records.longestTenureRep.rep} sub={`${data.records.longestTenureRep.years} years`} />
                <Record label="Top customer lifetime" value={fmtMoney(data.records.topCustomerLifetime.total)} sub={data.records.topCustomerLifetime.customer.slice(0, 40)} />
              </div>
            </section>
          </>
        )}

        <AboutThisData
          source="data/transactions-monthly.json (QB, 2018-08 → present, with chrisview_corrections overlay applied), data/commissions.json (1099 payments), data/reviews-master.json (317 reviews), data/customer-ltv.json (3,194 customers)."
          method="Lifetime totals = sum across all months. YTD = completed months only (current in-progress month excluded). Last-12mo = rolling. Records use the same extraction as /stats. Top-5 active reps filtered to a hardcoded active-rep list (hunter rivers, aaron lussi, greg muse, brendon muse, adam rudell, joseph dowd, rick, alijah coleman, travis wages)."
          uses="One-screen exec snapshot — designed to fit on a laptop without scrolling. Best landing page for a quick health check before drilling into individual analytics."
          gaps="Active-rep list is hardcoded in lib/exec-summary.ts. Update there if the roster changes — list as of 2026-05-21."
          generatedAt={data?.generatedAt}
        />
      </main>
    </div>
  );
}

function Big({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-3xl font-bold text-white mt-1">{value}</div>
      {sub && <div className="text-xs text-zinc-400 mt-1">{sub}</div>}
    </div>
  );
}
function Mid({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`text-xl font-bold mt-1 ${highlight ? 'text-[#39FF14]' : 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-400 mt-0.5">{sub}</div>}
    </div>
  );
}
function Record({ label, value, sub, detail, amber }: { label: string; value: string; sub?: string; detail?: string; amber?: boolean }) {
  return (
    <div className={`rounded-lg p-3 border ${amber ? 'bg-amber-500/5 border-amber-500/30' : 'bg-zinc-950 border-zinc-800'}`}>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`text-lg font-bold mt-1 ${amber ? 'text-amber-300' : 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-400 mt-0.5">{sub}</div>}
      {detail && <div className="text-[10px] text-zinc-500 mt-0.5 truncate">{detail}</div>}
    </div>
  );
}
