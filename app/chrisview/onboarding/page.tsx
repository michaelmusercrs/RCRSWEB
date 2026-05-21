'use client';

/**
 * Chris View — Rookie Ramp Curve.
 *
 * Per-rep onboarding analysis: how long to first signed contract, first
 * commission payment, year-1 signed total. Each rep's cumulative signed
 * curve is normalized to "weeks since first appearance" and overlaid
 * so slow rampers are visible at a glance.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Loader2, TrendingUp, Award, AlertTriangle, Hourglass, Users,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine,
} from 'recharts';

interface OnboardingRep {
  rep: string;
  meetingAlias: string;
  firstWeek: string;
  lastWeek: string;
  weeksOnTeam: number;
  weeksOfHistory: number;
  weeksToFirstSigned: number | null;
  weeksToFirstCommission: number | null;
  totalSignedYr1: number;
  totalCommissionYr1: number;
  signedCountByWeek: Array<{ weekIndex: number; cumSigned: number; signedThisWeek: number }>;
  status: 'ahead' | 'on-track' | 'behind' | 'still-ramping';
  note: string;
}

interface Data {
  generatedAt: string;
  baseline: {
    medianWeeksToFirstSigned: number;
    medianWeeksToFirstCommission: number;
    totalSignedYr1Median: number;
    repsInBaseline: number;
    minWeeksForBaseline: number;
  };
  reps: OnboardingRep[];
  meta: {
    meetingRows: number;
    commissionRows: number;
    repsAnalyzed: number;
    repsStillRamping: number;
  };
}

function fmtMoney(n: number) {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(1)}K`;
  return `${sign}$${a.toFixed(0)}`;
}

const STATUS_STYLE: Record<OnboardingRep['status'], { badge: string; label: string; }> = {
  'ahead': { badge: 'bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]/30', label: 'AHEAD' },
  'on-track': { badge: 'bg-lime-500/10 text-lime-300 border-lime-500/30', label: 'ON TRACK' },
  'behind': { badge: 'bg-red-500/10 text-red-300 border-red-500/30', label: 'BEHIND' },
  'still-ramping': { badge: 'bg-amber-500/10 text-amber-300 border-amber-500/30', label: 'STILL RAMPING' },
};

// Stable color per rep — recharts needs distinct strokes for overlaid lines.
const CHART_COLORS = [
  '#39FF14', '#60a5fa', '#fbbf24', '#f472b6', '#a78bfa',
  '#34d399', '#fb923c', '#22d3ee', '#facc15', '#e879f9',
  '#4ade80', '#f87171', '#94a3b8', '#c084fc', '#fcd34d',
];

export default function OnboardingPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showRamping, setShowRamping] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/chrisview-onboarding');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Build chart data: pivot per-rep signedCountByWeek into a single matrix
  // of { weekIndex, [rep1]: cum, [rep2]: cum, ... }. Only include reps with
  // first-signed reached (curve has meaningful shape).
  const chartData = useMemo(() => {
    if (!data) return { rows: [], chartReps: [] as OnboardingRep[] };
    const chartReps = data.reps
      .filter(r => r.weeksToFirstSigned !== null && (showRamping || r.status !== 'still-ramping'))
      .slice(0, 15); // cap for readability
    const maxIdx = chartReps.reduce(
      (m, r) => Math.max(m, r.signedCountByWeek.length ? r.signedCountByWeek[r.signedCountByWeek.length - 1].weekIndex : 0),
      0,
    );
    const rows: Array<Record<string, number>> = [];
    for (let wi = 0; wi <= maxIdx; wi++) {
      const row: Record<string, number> = { weekIndex: wi };
      for (const rep of chartReps) {
        const point = rep.signedCountByWeek.find(p => p.weekIndex === wi);
        if (point) row[rep.rep] = point.cumSigned;
      }
      rows.push(row);
    }
    return { rows, chartReps };
  }, [data, showRamping]);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#39FF14]" />Rookie Ramp Curve
          </h1>
          <p className="ml-auto text-[10px] text-zinc-500">How long new reps take to ramp vs the baseline.</p>
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
            {/* KPI cards — baseline medians */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi
                label="Baseline: wks to first signed"
                value={`${data.baseline.medianWeeksToFirstSigned} wk`}
                sub={`Median of ${data.baseline.repsInBaseline} reps (≥${data.baseline.minWeeksForBaseline}wk + signed)`}
                highlight
              />
              <Kpi
                label="Baseline: wks to first $ paid"
                value={`${data.baseline.medianWeeksToFirstCommission} wk`}
                sub="Median weeks → first QB commission"
              />
              <Kpi
                label="Baseline: signed in year 1"
                value={`${data.baseline.totalSignedYr1Median}`}
                sub="Median signed count, first 52 wks"
              />
              <Kpi
                label="Reps analyzed"
                value={`${data.meta.repsAnalyzed}`}
                sub={`${data.meta.repsStillRamping} still ramping (< ${data.baseline.minWeeksForBaseline}wk)`}
              />
            </section>

            {/* Ramp curve chart */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Hourglass className="w-4 h-4 text-[#39FF14]" />Cumulative Signed — Normalized to Week-Since-Start
                </h3>
                <label className="ml-auto text-[11px] text-zinc-400 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRamping}
                    onChange={e => setShowRamping(e.target.checked)}
                    className="accent-[#39FF14]"
                  />
                  Include still-ramping reps
                </label>
              </div>
              <p className="text-[10px] text-zinc-500 mb-2">
                Each line = one rep; x-axis = weeks since their first Monday meeting. Vertical line at week {data.baseline.medianWeeksToFirstSigned} = baseline first-signed median.
              </p>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.rows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis
                      dataKey="weekIndex"
                      stroke="#71717a"
                      fontSize={11}
                      label={{ value: 'Weeks since first meeting', position: 'insideBottom', offset: -2, fill: '#71717a', fontSize: 10 }}
                    />
                    <YAxis stroke="#71717a" fontSize={11} label={{ value: 'Cumulative signed', angle: -90, position: 'insideLeft', fill: '#71717a', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 11 }}
                      labelFormatter={(v) => `Week ${v}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {data.baseline.medianWeeksToFirstSigned > 0 && (
                      <ReferenceLine
                        x={data.baseline.medianWeeksToFirstSigned}
                        stroke="#fbbf24"
                        strokeDasharray="4 4"
                        label={{ value: 'Baseline', fill: '#fbbf24', fontSize: 10, position: 'top' }}
                      />
                    )}
                    {chartData.chartReps.map((rep, i) => (
                      <Line
                        key={rep.rep}
                        type="monotone"
                        dataKey={rep.rep}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls
                        name={rep.rep}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {chartData.chartReps.length === 0 && (
                <div className="text-center py-8 text-zinc-500 text-xs">
                  No reps with a first-signed event to plot.
                </div>
              )}
            </section>

            {/* Per-rep ramp table */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#39FF14]" />
                <h3 className="text-sm font-semibold">Per-Rep Ramp Metrics</h3>
                <p className="ml-auto text-[10px] text-zinc-500">
                  Sorted: still-ramping → fastest first-signed.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Status</th>
                      <th className="text-left py-2 px-3 font-medium">Rep</th>
                      <th className="text-left py-2 px-3 font-medium">First meeting</th>
                      <th className="text-right py-2 px-3 font-medium">Wks of history</th>
                      <th className="text-right py-2 px-3 font-medium">Wks → first signed</th>
                      <th className="text-right py-2 px-3 font-medium">Wks → first $</th>
                      <th className="text-right py-2 px-3 font-medium">Yr1 signed</th>
                      <th className="text-right py-2 px-3 font-medium">Yr1 commission $</th>
                      <th className="text-left py-2 px-3 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.reps.map(r => {
                      const stat = STATUS_STYLE[r.status];
                      const baseline = data.baseline.medianWeeksToFirstSigned;
                      return (
                        <tr key={`${r.meetingAlias}-${r.firstWeek}`} className="hover:bg-zinc-800/30">
                          <td className="py-2 px-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded border ${stat.badge} font-mono whitespace-nowrap`}>
                              {stat.label}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-medium">
                            {r.rep}
                            {r.meetingAlias !== r.rep && (
                              <span className="text-[10px] text-zinc-500 ml-1">({r.meetingAlias})</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-xs font-mono text-zinc-400">{r.firstWeek}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-zinc-300">{r.weeksOfHistory}</td>
                          <td className={`py-2 px-3 text-right tabular-nums font-bold ${
                            r.weeksToFirstSigned === null ? 'text-red-400'
                              : baseline > 0 && r.weeksToFirstSigned <= baseline * 0.75 ? 'text-[#39FF14]'
                              : baseline > 0 && r.weeksToFirstSigned > baseline * 1.5 ? 'text-red-400'
                              : 'text-zinc-200'
                          }`}>
                            {r.weeksToFirstSigned === null ? '—' : `${r.weeksToFirstSigned} wk`}
                          </td>
                          <td className={`py-2 px-3 text-right tabular-nums ${
                            r.weeksToFirstCommission === null ? 'text-zinc-500' : 'text-zinc-200'
                          }`}>
                            {r.weeksToFirstCommission === null ? '—' : `${r.weeksToFirstCommission} wk`}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{r.totalSignedYr1}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-amber-300">
                            {r.totalCommissionYr1 > 0 ? fmtMoney(r.totalCommissionYr1) : '—'}
                          </td>
                          <td className="py-2 px-3 text-[11px] text-zinc-400">{r.note}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Slow ramper callout */}
            {(() => {
              const slowReps = data.reps.filter(r => r.status === 'behind');
              if (slowReps.length === 0) return null;
              return (
                <section className="bg-red-500/5 border border-red-500/30 rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-red-300">
                    <AlertTriangle className="w-4 h-4" />Slow Rampers — Worth a Closer Look
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {slowReps.map(r => (
                      <li key={r.meetingAlias} className="text-zinc-300">
                        <span className="font-medium text-red-300">{r.rep}</span>
                        <span className="text-zinc-500"> · </span>
                        {r.note}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })()}

            {/* Fast rampers */}
            {(() => {
              const fast = data.reps.filter(r => r.status === 'ahead').slice(0, 5);
              if (fast.length === 0) return null;
              return (
                <section className="bg-[#39FF14]/5 border border-[#39FF14]/30 rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-[#39FF14]">
                    <Award className="w-4 h-4" />Fastest Rampers — Hiring Profile Match
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {fast.map(r => (
                      <li key={r.meetingAlias} className="text-zinc-300">
                        <span className="font-medium text-[#39FF14]">{r.rep}</span>
                        <span className="text-zinc-500"> · </span>
                        first signed wk {r.weeksToFirstSigned}, yr1 signed {r.totalSignedYr1}, yr1 paid {fmtMoney(r.totalCommissionYr1)}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })()}

            <p className="text-[10px] text-zinc-500 text-center">
              Baselines computed from reps with ≥ {data.baseline.minWeeksForBaseline} weeks of meeting history AND a first-signed event ({data.baseline.repsInBaseline} reps).
              Sources: data/meeting-numbers-all.json ({data.meta.meetingRows.toLocaleString()} rep-weeks) +
              data/commissions.json ({data.meta.commissionRows.toLocaleString()} payments).
              Generated {data.generatedAt.slice(0, 10)}.
              Per [[project-rcrs-leaderboards]] — signed = self-reported Monday number; commission $ = QB-booked.
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
