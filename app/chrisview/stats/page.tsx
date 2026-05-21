'use client';

import { useState, useEffect } from 'react';
import { Zap, ArrowLeft, Loader2, Trophy, Star, DollarSign, TrendingDown, Calendar, Users } from 'lucide-react';
import AboutThisData from '@/components/AboutThisData';

interface Top { date?: string; month?: string; year?: string; rep?: string; customer?: string; amount?: number; revenue?: number; expense?: number; net?: number; invoices?: number; avgInvoice?: number; margin?: number; total?: number; paymentCount?: number; firstDate?: string; lastDate?: string; jobNumber?: string }
interface Data {
  generatedAt: string;
  topMonthsByRevenue: Top[];
  topMonthsByProfit: Top[];
  worstMonthsByLoss: Top[];
  topYearsByRevenue: Top[];
  topCommissionPayments: Top[];
  topLifetimeReps: Top[];
  topCustomersLifetime: Top[];
  reviewMomentum: {
    bestSingleMonth: { month: string; count: number };
    last12moTotal: number; last24moTotal: number; fiveStarShare: number; avgRatingLifetime: number;
  };
  records: {
    biggestCommissionEver: { date: string; amount: number; rep: string; customer: string };
    biggestRevenueMonth: { month: string; revenue: number };
    biggestProfitMonth: { month: string; net: number };
    worstLossMonth: { month: string; net: number };
    longestTenureRep: { rep: string; years: number; firstDate: string; lastDate: string };
    highestPayingYear: { year: string; commissions: number };
  };
}

function fmtMoney(n: number) {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(1)}K`;
  return `${sign}$${a.toFixed(0)}`;
}

export default function StatsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/chrisview-stats');
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
          <h1 className="text-lg font-semibold flex items-center gap-2"><Zap className="w-5 h-5 text-[#39FF14]" />Stats &amp; Records</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{err}</div>}
        {loading && <div className="text-center py-12 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>}
        {data && (
          <>
            {/* Records */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <RecordCard icon={<DollarSign className="w-4 h-4" />} label="Biggest commission ever" value={fmtMoney(data.records.biggestCommissionEver.amount)} sub={`${data.records.biggestCommissionEver.rep} · ${data.records.biggestCommissionEver.date}`} detail={data.records.biggestCommissionEver.customer} highlight />
              <RecordCard icon={<Trophy className="w-4 h-4" />} label="Best revenue month" value={fmtMoney(data.records.biggestRevenueMonth.revenue)} sub={data.records.biggestRevenueMonth.month} />
              <RecordCard icon={<TrendingDown className="w-4 h-4" />} label="Worst loss month" value={fmtMoney(data.records.worstLossMonth.net)} sub={data.records.worstLossMonth.month} />
              <RecordCard icon={<Trophy className="w-4 h-4" />} label="Best profit month" value={fmtMoney(data.records.biggestProfitMonth.net)} sub={data.records.biggestProfitMonth.month} />
              <RecordCard icon={<Users className="w-4 h-4" />} label="Longest-tenure rep" value={data.records.longestTenureRep.rep} sub={`${data.records.longestTenureRep.years} years (${data.records.longestTenureRep.firstDate} → ${data.records.longestTenureRep.lastDate})`} />
              <RecordCard icon={<DollarSign className="w-4 h-4" />} label="Highest-payout year" value={fmtMoney(data.records.highestPayingYear.commissions)} sub={`${data.records.highestPayingYear.year} — total 1099 paid`} />
            </section>

            {/* Review momentum */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Star className="w-4 h-4 text-[#39FF14]" />Review Momentum</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi label="Best single month" value={`${data.reviewMomentum.bestSingleMonth.count}`} sub={data.reviewMomentum.bestSingleMonth.month} />
                <Kpi label="Last 12 mo" value={data.reviewMomentum.last12moTotal.toString()} sub={`${data.reviewMomentum.last24moTotal} in 24mo`} />
                <Kpi label="5★ share" value={`${data.reviewMomentum.fiveStarShare}%`} />
                <Kpi label="Avg rating lifetime" value={data.reviewMomentum.avgRatingLifetime.toFixed(2)} />
              </div>
            </section>

            {/* Top months by revenue */}
            <Section title="Top 12 Months by Revenue" icon={<Calendar className="w-4 h-4 text-[#39FF14]" />}>
              <Table head={['#', 'Month', 'Revenue', 'Invoices', 'Avg invoice']}>
                {data.topMonthsByRevenue.map((m, i) => (
                  <tr key={m.month} className="hover:bg-zinc-800/30">
                    <td className="py-2 px-3 text-zinc-500 font-mono text-xs">{i + 1}</td>
                    <td className="py-2 px-3 font-mono text-xs">{m.month}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-[#39FF14] font-bold">{fmtMoney(m.revenue || 0)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{m.invoices}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{fmtMoney(m.avgInvoice || 0)}</td>
                  </tr>
                ))}
              </Table>
            </Section>

            {/* Top years */}
            <Section title="Years Ranked by Revenue" icon={<Calendar className="w-4 h-4 text-[#39FF14]" />}>
              <Table head={['Year', 'Revenue', 'Expense', 'Net', 'Margin']}>
                {data.topYearsByRevenue.map(y => (
                  <tr key={y.year} className="hover:bg-zinc-800/30">
                    <td className="py-2 px-3 font-mono text-xs">{y.year}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{fmtMoney(y.revenue || 0)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-red-400">{fmtMoney(y.expense || 0)}</td>
                    <td className={`py-2 px-3 text-right tabular-nums font-bold ${(y.net || 0) >= 0 ? 'text-[#39FF14]' : 'text-red-400'}`}>{fmtMoney(y.net || 0)}</td>
                    <td className={`py-2 px-3 text-right tabular-nums ${(y.margin || 0) >= 0 ? 'text-amber-300' : 'text-red-400'}`}>{y.margin}%</td>
                  </tr>
                ))}
              </Table>
            </Section>

            {/* Best profit months */}
            <Section title="Best 10 Profit Months (Net Cash)" icon={<Trophy className="w-4 h-4 text-[#39FF14]" />}>
              <Table head={['#', 'Month', 'Revenue', 'Expense', 'Net']}>
                {data.topMonthsByProfit.map((m, i) => (
                  <tr key={m.month} className="hover:bg-zinc-800/30">
                    <td className="py-2 px-3 text-zinc-500 font-mono text-xs">{i + 1}</td>
                    <td className="py-2 px-3 font-mono text-xs">{m.month}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{fmtMoney(m.revenue || 0)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{fmtMoney(m.expense || 0)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-[#39FF14] font-bold">{fmtMoney(m.net || 0)}</td>
                  </tr>
                ))}
              </Table>
            </Section>

            {/* Worst loss months */}
            <Section title="Worst 10 Loss Months" icon={<TrendingDown className="w-4 h-4 text-amber-400" />}>
              <Table head={['#', 'Month', 'Revenue', 'Expense', 'Net Loss']}>
                {data.worstMonthsByLoss.map((m, i) => (
                  <tr key={m.month} className="hover:bg-zinc-800/30">
                    <td className="py-2 px-3 text-zinc-500 font-mono text-xs">{i + 1}</td>
                    <td className="py-2 px-3 font-mono text-xs">{m.month}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{fmtMoney(m.revenue || 0)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{fmtMoney(m.expense || 0)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-red-400 font-bold">{fmtMoney(m.net || 0)}</td>
                  </tr>
                ))}
              </Table>
            </Section>

            {/* Top commission payments */}
            <Section title="Top 15 Single Commission Payments" icon={<DollarSign className="w-4 h-4 text-amber-300" />}>
              <Table head={['#', 'Date', 'Amount', 'Rep', 'Customer']}>
                {data.topCommissionPayments.map((c, i) => (
                  <tr key={i} className="hover:bg-zinc-800/30">
                    <td className="py-2 px-3 text-zinc-500 font-mono text-xs">{i + 1}</td>
                    <td className="py-2 px-3 text-xs font-mono">{c.date}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-amber-300 font-bold">{fmtMoney(c.amount || 0)}</td>
                    <td className="py-2 px-3 text-xs">{c.rep}</td>
                    <td className="py-2 px-3 text-xs text-zinc-400">{c.customer}</td>
                  </tr>
                ))}
              </Table>
            </Section>

            {/* Top lifetime reps */}
            <Section title="Top 15 Lifetime Earners (1099 commission)" icon={<Trophy className="w-4 h-4 text-[#39FF14]" />}>
              <Table head={['#', 'Rep', 'Lifetime $', 'Payments', 'First → Last']}>
                {data.topLifetimeReps.map((r, i) => (
                  <tr key={r.rep} className="hover:bg-zinc-800/30">
                    <td className="py-2 px-3 text-zinc-500 font-mono text-xs">{i + 1}</td>
                    <td className="py-2 px-3 font-medium">{r.rep}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-[#39FF14] font-bold">{fmtMoney(r.total || 0)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{r.paymentCount}</td>
                    <td className="py-2 px-3 text-xs text-zinc-400">{r.firstDate} → {r.lastDate}</td>
                  </tr>
                ))}
              </Table>
            </Section>

            {/* Top customers */}
            {data.topCustomersLifetime.length > 0 && (
              <Section title="Top 15 Lifetime Customers" icon={<Users className="w-4 h-4 text-[#39FF14]" />}>
                <Table head={['#', 'Customer', 'Lifetime $', 'Invoices', 'First → Last']}>
                  {data.topCustomersLifetime.map((c, i) => (
                    <tr key={i} className="hover:bg-zinc-800/30">
                      <td className="py-2 px-3 text-zinc-500 font-mono text-xs">{i + 1}</td>
                      <td className="py-2 px-3 font-medium">{c.customer}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-[#39FF14] font-bold">{fmtMoney(c.total || 0)}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{c.invoices}</td>
                      <td className="py-2 px-3 text-xs text-zinc-400">{c.firstDate} → {c.lastDate}</td>
                    </tr>
                  ))}
                </Table>
              </Section>
            )}

          </>
        )}

        <AboutThisData
          source="data/transactions-monthly.json (QB monthly, 2018-08 → present, with chrisview_corrections overlay applied), data/commissions.json (15.5K 1099 payments), data/reviews-master.json (317 Google reviews), data/customer-ltv.json."
          method="Records are extracted by sorting each source then taking the top/bottom row. Best month / year by gross revenue. Best/worst profit by net cash (revenue - expense). Biggest commission = single highest 1099 payment. Longest-tenure rep = days from first to last commission payment (stops at last payment if rep left). Top customers from the precomputed LTV snapshot."
          uses="All-time superlatives for context when reviewing current performance. 'Biggest commission ever' is a useful benchmark when negotiating new payouts. 'Worst loss month' helps explain why a particular year shows red on history."
          generatedAt={data?.generatedAt}
        />
      </main>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        {icon}<h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
        <tr>
          {head.map((h, i) => (
            <th key={i} className={`py-2 px-3 font-medium ${i === 0 ? 'text-left' : i >= 2 && i !== head.length - 1 && head.length > 4 ? 'text-right' : i === 1 ? 'text-left' : 'text-right'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-800">{children}</tbody>
    </table>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl p-3 border bg-zinc-950 border-zinc-800">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-xl font-bold text-white mt-1">{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function RecordCard({ icon, label, value, sub, detail, highlight }: { icon: React.ReactNode; label: string; value: string; sub?: string; detail?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${highlight ? 'bg-gradient-to-br from-[#39FF14]/10 to-zinc-900 border-[#39FF14]/30' : 'bg-zinc-900 border-zinc-800'}`}>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500 flex items-center gap-1">{icon}{label}</div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
      {sub && <div className="text-[11px] text-zinc-400 mt-1">{sub}</div>}
      {detail && <div className="text-[10px] text-zinc-500 mt-0.5 truncate">{detail}</div>}
    </div>
  );
}
