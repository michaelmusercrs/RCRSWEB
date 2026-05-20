'use client';

/**
 * Chris View — Meeting Insights (Phase 1 of the analytics roadmap).
 *
 * Patterns + predictions from the Monday Meeting Numbers vs actuals.
 * Built as a sibling to /chrisview/leaders so it ships without
 * touching the main /chrisview/page.tsx file.
 */

import { useState, useEffect } from 'react';
import {
  Brain, TrendingUp, TrendingDown, Loader2, ArrowLeft, Calendar,
  Target, Users, Activity, AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';

interface RepStat {
  rep: string;
  weeksOnTeam: number;
  firstWeek: string;
  lastWeek: string;
  present: number; absent: number; excused: number;
  attendanceRate: number;
  totals: {
    inspected: number; damage: number; signed: number; approved: number;
    gutter: number; goal: number; revenue: number; referrals: number; homeShow: number;
  };
  damageRate: number;
  closeRate: number;
  approveRate: number;
  revenuePerSigned: number;
}

interface CorrelationRow { lag: number; weeks: number; r: number }

interface Insights {
  generatedAt: string;
  meetingWeeks: number;
  weekly: Array<{ date: string; inspected: number; damage: number; signed: number; approved: number; revenue: number }>;
  repStats: RepStat[];
  correlation: {
    signedToApproved: CorrelationRow[];
    inspectedToSigned: CorrelationRow[];
    signedToRevenue: CorrelationRow[];
    damageToSigned: CorrelationRow[];
    goalToInspected: CorrelationRow[];
  };
  prediction: {
    baselineAdjuster: number; recentAdjuster: number; adjusterDeltaPct: number;
    baselineSigned: number; recentSigned: number; signedDeltaPct: number;
    bestSignedToRevLag: { lag: number; r: number };
    monthlyAvg: number; projectedNextMonth: number;
    interpretation: string;
  };
  goalStudy: Array<{ bin: string; weeks: number; avgGoal: number; avgInspectedNextWeek: number; hitRate: number }>;
}

function fmtMoney(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}
function fmtMoneyExact(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
function rColor(r: number) {
  const a = Math.abs(r);
  if (a >= 0.7) return r > 0 ? 'text-[#39FF14]' : 'text-red-400';
  if (a >= 0.4) return r > 0 ? 'text-emerald-400' : 'text-orange-400';
  if (a >= 0.2) return 'text-amber-300';
  return 'text-zinc-500';
}
function rLabel(r: number) {
  const a = Math.abs(r);
  if (a >= 0.7) return 'strong';
  if (a >= 0.4) return 'moderate';
  if (a >= 0.2) return 'weak';
  return 'noise';
}

export default function InsightsPage() {
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/chrisview-insights');
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
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#39FF14]" />
            Meeting Insights — Patterns & Predictions
          </h1>
          {data && (
            <span className="text-xs text-zinc-500 ml-auto">
              {data.meetingWeeks} weeks of Monday data · refreshed {data.generatedAt}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{err}</div>}
        {loading && <div className="text-center py-12 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>}
        {data && (
          <>
            {/* Prediction banner */}
            <section className={`rounded-xl p-5 border ${
              data.prediction.signedDeltaPct < -15
                ? 'bg-red-500/10 border-red-500/30'
                : data.prediction.signedDeltaPct > 15
                ? 'bg-[#39FF14]/10 border-[#39FF14]/30'
                : 'bg-zinc-900 border-zinc-800'
            }`}>
              <h2 className="text-sm font-semibold uppercase tracking-wide mb-2 flex items-center gap-2">
                {data.prediction.signedDeltaPct < -15 ? (
                  <><AlertTriangle className="w-4 h-4 text-red-400" /><span className="text-red-400">Forward Signal</span></>
                ) : data.prediction.signedDeltaPct > 15 ? (
                  <><TrendingUp className="w-4 h-4 text-[#39FF14]" /><span className="text-[#39FF14]">Forward Signal</span></>
                ) : (
                  <><Activity className="w-4 h-4 text-zinc-300" /><span className="text-zinc-300">Forward Signal</span></>
                )}
              </h2>
              <p className="text-base leading-relaxed text-zinc-200">
                {data.prediction.interpretation}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <Kpi label="Recent Signed (4 wk avg)" value={data.prediction.recentSigned.toString()} sub={`baseline ${data.prediction.baselineSigned}`} />
                <Kpi label="Δ vs baseline" value={`${data.prediction.signedDeltaPct >= 0 ? '+' : ''}${data.prediction.signedDeltaPct}%`} negative={data.prediction.signedDeltaPct < 0} />
                <Kpi label="6 mo avg monthly revenue" value={fmtMoney(data.prediction.monthlyAvg)} sub="from QB ledger" />
                <Kpi label="Projected next month" value={fmtMoney(data.prediction.projectedNextMonth)} sub="signed×0.5 dampened" />
              </div>
            </section>

            {/* Weekly trend chart */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#39FF14]" />
                Last 52 Weeks — Inspected · Signed · Adjuster Approved
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.weekly} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" stroke="#71717a" fontSize={10} interval={3} />
                    <YAxis yAxisId="left" stroke="#71717a" fontSize={11} />
                    <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={11} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="inspected" stroke="#60a5fa" strokeWidth={2} name="Inspected" dot={false} />
                    <Line yAxisId="left" type="monotone" dataKey="signed" stroke="#39FF14" strokeWidth={2} name="Signed" dot={false} />
                    <Line yAxisId="left" type="monotone" dataKey="approved" stroke="#fbbf24" strokeWidth={2} name="Adjuster Approved" dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#fb7185" strokeWidth={1} strokeDasharray="3 3" name="Revenue $" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Correlation analysis */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CorrelationCard
                title="Signed → Adjuster Approved"
                description="How well does a high 'signed' week predict adjuster approvals N weeks later? Best correlation tells you the typical lag from signing a contingency to the carrier green-lighting the claim."
                data={data.correlation.signedToApproved}
              />
              <CorrelationCard
                title="Inspected → Signed"
                description="Lag between roofs inspected and contracts signed. Lower lag = reps closing on-site or same week."
                data={data.correlation.inspectedToSigned}
              />
              <CorrelationCard
                title="Signed → Revenue (accrual)"
                description="Same-week r ~1.0 because revenue is reported when signed. Useful as a sanity check that data lines up."
                data={data.correlation.signedToRevenue}
              />
              <CorrelationCard
                title="Damage → Signed"
                description="Damage = inspections with enough to file. Signed = contingencies. Lower lag is faster close on damaged inspections."
                data={data.correlation.damageToSigned}
              />
            </section>

            {/* Goal study */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Target className="w-4 h-4 text-[#39FF14]" />
                Goal Column Study — Does setting a higher goal lead to more inspections next week?
              </h3>
              <p className="text-xs text-zinc-400 mb-3">
                Goal is the inspection target set on Monday for the FOLLOWING week. This compares average goal vs average actual inspected the next week.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Goal Bin</th>
                      <th className="text-right py-2 px-3 font-medium">Weeks</th>
                      <th className="text-right py-2 px-3 font-medium">Avg Goal (sum across reps)</th>
                      <th className="text-right py-2 px-3 font-medium">Avg Next-Week Inspected</th>
                      <th className="text-right py-2 px-3 font-medium">Hit Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.goalStudy.map(g => (
                      <tr key={g.bin} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-medium">{g.bin}</td>
                        <td className="py-2 px-3 text-right text-zinc-400">{g.weeks}</td>
                        <td className="py-2 px-3 text-right text-zinc-300">{g.avgGoal}</td>
                        <td className="py-2 px-3 text-right text-[#39FF14]">{g.avgInspectedNextWeek}</td>
                        <td className={`py-2 px-3 text-right tabular-nums ${g.hitRate >= 100 ? 'text-[#39FF14]' : g.hitRate >= 70 ? 'text-amber-400' : 'text-red-400'}`}>{g.hitRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Goal → next-week inspected correlation at lag 1: {' '}
                <span className={rColor(data.correlation.goalToInspected[0]?.r || 0)}>
                  r = {data.correlation.goalToInspected[0]?.r ?? 0} ({rLabel(data.correlation.goalToInspected[0]?.r || 0)})
                </span>
              </p>
            </section>

            {/* Rep performance (attendance + numbers) */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#39FF14]" />
                <h3 className="text-sm font-semibold">Per-Rep Performance — Lifetime</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Rep</th>
                      <th className="text-right py-2 px-3 font-medium">Weeks on team</th>
                      <th className="text-right py-2 px-3 font-medium">Attendance</th>
                      <th className="text-right py-2 px-3 font-medium">Inspected</th>
                      <th className="text-right py-2 px-3 font-medium">Damage</th>
                      <th className="text-right py-2 px-3 font-medium">Signed</th>
                      <th className="text-right py-2 px-3 font-medium">Close %</th>
                      <th className="text-right py-2 px-3 font-medium">Approved</th>
                      <th className="text-right py-2 px-3 font-medium">Revenue $</th>
                      <th className="text-right py-2 px-3 font-medium">$/Signed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.repStats.map(r => (
                      <tr key={r.rep} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-medium">{r.rep}</td>
                        <td className="py-2 px-3 text-right text-zinc-400">{r.weeksOnTeam}</td>
                        <td className={`py-2 px-3 text-right tabular-nums ${r.attendanceRate >= 90 ? 'text-[#39FF14]' : r.attendanceRate >= 75 ? 'text-amber-400' : 'text-red-400'}`}>
                          {r.attendanceRate}%
                          <div className="text-[10px] text-zinc-500">{r.present}p / {r.absent}a / {r.excused}e</div>
                        </td>
                        <td className="py-2 px-3 text-right text-zinc-300">{r.totals.inspected}</td>
                        <td className="py-2 px-3 text-right text-zinc-300">{r.totals.damage}</td>
                        <td className="py-2 px-3 text-right text-[#39FF14]">{r.totals.signed}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-300">{r.closeRate}%</td>
                        <td className="py-2 px-3 text-right text-zinc-300">{r.totals.approved}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{fmtMoney(r.totals.revenue)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{fmtMoneyExact(r.revenuePerSigned)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-zinc-500 px-4 py-2 border-t border-zinc-800">
                Attendance = present / (present + absent). Excused weeks don&apos;t count toward the denominator per spec. Reps only appear once they show up on the sheet.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Kpi({ label, value, sub, negative }: { label: string; value: string; sub?: string; negative?: boolean }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`text-xl font-bold mt-1 ${negative ? 'text-red-400' : 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function CorrelationCard({ title, description, data }: { title: string; description: string; data: CorrelationRow[] }) {
  const best = data.reduce((b, x) => Math.abs(x.r) > Math.abs(b.r) ? x : b, { r: 0, lag: 0, weeks: 0 } as CorrelationRow);
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <h4 className="text-sm font-semibold mb-1">{title}</h4>
      <p className="text-xs text-zinc-400 mb-3">{description}</p>
      <div className="text-sm text-zinc-300 mb-3">
        Best lag: <span className="font-mono font-bold text-white">{best.lag} week{best.lag === 1 ? '' : 's'}</span>
        {' '}<span className={rColor(best.r)}>(r = {best.r}, {rLabel(best.r)})</span>
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="lag" stroke="#71717a" fontSize={11} tickFormatter={v => `${v}wk`} />
            <YAxis stroke="#71717a" fontSize={11} domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]} />
            <Tooltip
              contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
              formatter={(v: number | undefined) => v != null ? v.toFixed(2) : '—'}
              labelFormatter={(l: unknown) => `${l} week${l === 1 ? '' : 's'} after`}
            />
            <Bar dataKey="r" name="Correlation">
              {data.map((d, i) => (
                <Cell key={i} fill={Math.abs(d.r) >= 0.4 ? (d.r > 0 ? '#39FF14' : '#ef4444') : Math.abs(d.r) >= 0.2 ? '#fbbf24' : '#52525b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
