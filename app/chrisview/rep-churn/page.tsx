'use client';

/**
 * Chris View — Rep Activity Decline Early Warning.
 *
 * For each rep with >= 12 wk of meeting-sheet history we compare their
 * last 4 non-excused weeks (recent4) to the 12 non-excused weeks before
 * that (baseline12). Reps with declining signed/inspected counts, lower
 * attendance, or long gaps since their last commission payment surface
 * as medium or high risk.
 *
 * Visual rules (project memory):
 *   - black + #39FF14 accents
 *   - recharts for any graphs, lucide-react for icons
 *   - DON'T compare still-ramping rookies to a baseline they don't have
 *   - low signal (3+ excused weeks in recent4) is flagged separately
 *   - 1099 commission lag is normal (0-30 days) — don't alarm on it
 */

import { useState, useEffect } from 'react';
import {
  ArrowLeft, Loader2, AlertTriangle, TrendingDown, Activity, Users,
  ShieldAlert, Clock, Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';

interface Rep {
  rep: string;
  meetingAlias: string;
  firstWeek: string;
  lastWeek: string;
  weeksOfHistory: number;
  daysSinceLastAppearance: number;
  recent4: { inspected: number; signed: number; present: number; weeks: number; excusedWeeks: number };
  baseline12: { inspected: number; signed: number; present: number; weeks: number; excusedWeeks: number };
  recent4InspectedAvg: number;
  recent4SignedAvg: number;
  baseline12InspectedAvg: number;
  baseline12SignedAvg: number;
  inspectedTrendPct: number | null;
  signedTrendPct: number | null;
  recent4Attendance: number;
  baseline12Attendance: number;
  attendanceDeltaPct: number;
  daysSinceLastCommission: number | null;
  lastCommissionDate: string | null;
  churnScore: number;
  riskLevel: 'high' | 'medium' | 'low' | 'still-ramping' | 'departed';
  note: string;
  lowSignal: boolean;
}

interface Data {
  generatedAt: string;
  datasetLatestDate: string;
  weights: { signedTrend: number; inspectedTrend: number; attendanceDelta: number; daysSincePay: number };
  thresholds: {
    minWeeksForBaseline: number;
    highRiskScore: number;
    mediumRiskScore: number;
    lowSignalExcusedThreshold: number;
    departedAfterDays: number;
  };
  reps: Rep[];
  highRiskCount: number;
  mediumRiskCount: number;
  stillRampingCount: number;
  departedCount: number;
  totalMonitored: number;
  meta: { meetingRows: number; commissionRows: number; repsAnalyzed: number };
}

const RISK_STYLE: Record<Rep['riskLevel'], { badge: string; label: string; row: string }> = {
  'high':          { badge: 'bg-red-500/10 text-red-300 border-red-500/30', label: 'HIGH RISK', row: 'bg-red-500/5' },
  'medium':        { badge: 'bg-amber-500/10 text-amber-300 border-amber-500/30', label: 'MEDIUM', row: '' },
  'low':           { badge: 'bg-lime-500/10 text-lime-300 border-lime-500/30', label: 'LOW', row: '' },
  'still-ramping': { badge: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30', label: 'STILL RAMPING', row: '' },
  'departed':      { badge: 'bg-zinc-700/30 text-zinc-500 border-zinc-700/40', label: 'DEPARTED', row: 'opacity-60' },
};

function trendPctText(pct: number | null): { text: string; cls: string } {
  if (pct === null) return { text: 'no baseline', cls: 'text-zinc-500' };
  const cls =
    pct <= -30 ? 'text-red-400' :
    pct <= -10 ? 'text-amber-400' :
    pct >= 20  ? 'text-[#39FF14]' :
    'text-zinc-300';
  const sign = pct > 0 ? '+' : '';
  return { text: `${sign}${pct}%`, cls };
}

function daysSinceText(days: number | null): { text: string; cls: string } {
  if (days === null) return { text: 'never paid', cls: 'text-zinc-500' };
  const cls =
    days >= 90 ? 'text-red-400' :
    days >= 60 ? 'text-amber-400' :
    days >= 30 ? 'text-zinc-300' :
    'text-[#39FF14]';
  return { text: `${days}d`, cls };
}

export default function RepChurnPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showRamping, setShowRamping] = useState(false);
  const [showDeparted, setShowDeparted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/chrisview-rep-churn');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const highRiskReps = data?.reps.filter(r => r.riskLevel === 'high') ?? [];
  const visibleReps = (data?.reps ?? []).filter(r => {
    if (r.riskLevel === 'still-ramping' && !showRamping) return false;
    if (r.riskLevel === 'departed' && !showDeparted) return false;
    return true;
  });

  // Score chart for top 15 currently-active monitored reps
  const scoreChart = (data?.reps ?? [])
    .filter(r => r.riskLevel === 'high' || r.riskLevel === 'medium' || r.riskLevel === 'low')
    .slice(0, 15)
    .map(r => ({
      rep: r.rep.length > 14 ? r.rep.slice(0, 14) + '…' : r.rep,
      fullRep: r.rep,
      score: Math.round(r.churnScore * 100),
      risk: r.riskLevel,
    }));

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#39FF14]" />
            Rep Activity Decline — Early Warning
          </h1>
          {data && (
            <span className="text-xs text-zinc-500 ml-auto">
              {data.meta.repsAnalyzed} reps analyzed · {data.totalMonitored} monitored · refreshed {data.generatedAt.slice(0, 10)}
            </span>
          )}
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
            {/* Methodology blurb */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-300">
              <p className="mb-1">
                <strong className="text-white">What this is.</strong>{' '}
                Each currently-active rep with at least {data.thresholds.minWeeksForBaseline} weeks of meeting-sheet
                history is compared against <em>their own</em> 12-week baseline. The recent window is the last 4 calendar
                weeks of the sheet (anchored on {data.datasetLatestDate}); baseline is the 12 calendar weeks before that.
                Misses count as zero-activity; excused weeks shrink the denominator. Reps with less than
                {' '}{data.thresholds.minWeeksForBaseline} weeks of history are flagged &quot;still ramping&quot;; reps
                gone &gt;= {Math.round(data.thresholds.departedAfterDays / 7)} weeks are marked &quot;departed&quot; and
                excluded from the active risk list.
              </p>
              <p className="text-xs text-zinc-400">
                Churn score weights: signed-trend {Math.round(data.weights.signedTrend * 100)}%,
                inspected-trend {Math.round(data.weights.inspectedTrend * 100)}%,
                attendance-delta {Math.round(data.weights.attendanceDelta * 100)}%,
                days-since-pay {Math.round(data.weights.daysSincePay * 100)}%. 1099 payment lag of 0-30 days is normal
                and contributes nothing to the score. Reps with 3+ excused weeks in their last 4 are marked
                &quot;low signal&quot; and demoted from HIGH — too few real datapoints to be confident.
              </p>
            </section>

            {/* KPI row */}
            <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Kpi
                icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
                label="High risk"
                value={data.highRiskCount.toString()}
                sub="winding down"
                tone="danger"
              />
              <Kpi
                icon={<TrendingDown className="w-4 h-4 text-amber-400" />}
                label="Medium risk"
                value={data.mediumRiskCount.toString()}
                sub="watch list"
                tone="warning"
              />
              <Kpi
                icon={<Users className="w-4 h-4 text-[#39FF14]" />}
                label="Monitored"
                value={data.totalMonitored.toString()}
                sub={`active, >=${data.thresholds.minWeeksForBaseline} wk`}
              />
              <Kpi
                icon={<Clock className="w-4 h-4 text-zinc-400" />}
                label="Still ramping"
                value={data.stillRampingCount.toString()}
                sub="not scoreable"
              />
              <Kpi
                icon={<Clock className="w-4 h-4 text-zinc-500" />}
                label="Departed"
                value={data.departedCount.toString()}
                sub={`gone >=${Math.round(data.thresholds.departedAfterDays / 7)} wk`}
              />
            </section>

            {/* High-risk callout */}
            {highRiskReps.length > 0 && (
              <section className="rounded-xl p-5 border bg-red-500/10 border-red-500/30">
                <h2 className="text-sm font-semibold uppercase tracking-wide mb-3 flex items-center gap-2 text-red-300">
                  <AlertTriangle className="w-4 h-4" />
                  {highRiskReps.length} rep{highRiskReps.length === 1 ? '' : 's'} look{highRiskReps.length === 1 ? 's' : ''} like {highRiskReps.length === 1 ? "they're" : "they're"} winding down
                </h2>
                <ul className="space-y-2">
                  {highRiskReps.map(r => (
                    <li key={r.rep} className="bg-black/30 rounded p-3 border border-red-500/20">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-semibold text-white">{r.rep}</span>
                        <span className="text-xs text-zinc-400">
                          (score {Math.round(r.churnScore * 100)}, {r.weeksOfHistory} wk on team)
                        </span>
                      </div>
                      <div className="text-sm text-red-200 mt-1">{r.note}</div>
                      <div className="text-xs text-zinc-400 mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                        <span>
                          Signed: {r.recent4SignedAvg}/wk recent vs {r.baseline12SignedAvg}/wk baseline
                          {r.signedTrendPct !== null && (
                            <span className={trendPctText(r.signedTrendPct).cls}> ({trendPctText(r.signedTrendPct).text})</span>
                          )}
                        </span>
                        <span>
                          Inspected: {r.recent4InspectedAvg}/wk vs {r.baseline12InspectedAvg}/wk
                          {r.inspectedTrendPct !== null && (
                            <span className={trendPctText(r.inspectedTrendPct).cls}> ({trendPctText(r.inspectedTrendPct).text})</span>
                          )}
                        </span>
                        <span>
                          Attendance: {r.recent4Attendance}% vs {r.baseline12Attendance}%
                          {r.attendanceDeltaPct !== 0 && (
                            <span className={r.attendanceDeltaPct < 0 ? 'text-amber-400' : 'text-[#39FF14]'}>
                              {' '}({r.attendanceDeltaPct > 0 ? '+' : ''}{r.attendanceDeltaPct}pt)
                            </span>
                          )}
                        </span>
                        <span>
                          Last commission:{' '}
                          <span className={daysSinceText(r.daysSinceLastCommission).cls}>
                            {daysSinceText(r.daysSinceLastCommission).text}
                          </span>
                          {r.lastCommissionDate && <span className="text-zinc-500"> ({r.lastCommissionDate})</span>}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Score chart */}
            {scoreChart.length > 0 && (
              <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#39FF14]" />
                  Top {scoreChart.length} Monitored Reps by Churn Score
                </h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scoreChart} margin={{ top: 8, right: 8, bottom: 36, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="rep" stroke="#71717a" fontSize={10} angle={-35} textAnchor="end" interval={0} />
                      <YAxis stroke="#71717a" fontSize={11} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                        formatter={(v: number | undefined) => [`${v ?? 0}`, 'score (0-100)'] as [string, string]}
                        labelFormatter={(_l, payload) => {
                          const p = Array.isArray(payload) && payload.length > 0
                            ? (payload[0]?.payload as { fullRep?: string } | undefined)
                            : undefined;
                          return p?.fullRep ?? '';
                        }}
                      />
                      <Bar dataKey="score" name="Churn score (0-100)">
                        {scoreChart.map((d, i) => (
                          <Cell
                            key={i}
                            fill={
                              d.risk === 'high'   ? '#ef4444' :
                              d.risk === 'medium' ? '#fbbf24' :
                                                    '#39FF14'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] text-zinc-500 mt-2">
                  Score 0-100, higher = more concerning. Red &gt;= {Math.round(data.thresholds.highRiskScore * 100)},
                  amber &gt;= {Math.round(data.thresholds.mediumRiskScore * 100)}, green below.
                </p>
              </section>
            )}

            {/* Detail table */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3 flex-wrap">
                <Calendar className="w-4 h-4 text-[#39FF14]" />
                <h3 className="text-sm font-semibold">Per-Rep Detail — Sorted by Risk</h3>
                <label className="ml-auto flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRamping}
                    onChange={e => setShowRamping(e.target.checked)}
                    className="accent-[#39FF14]"
                  />
                  Show still-ramping
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showDeparted}
                    onChange={e => setShowDeparted(e.target.checked)}
                    className="accent-[#39FF14]"
                  />
                  Show departed
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Rep</th>
                      <th className="text-right py-2 px-3 font-medium">Risk</th>
                      <th className="text-right py-2 px-3 font-medium">Score</th>
                      <th className="text-right py-2 px-3 font-medium">Wk history</th>
                      <th className="text-right py-2 px-3 font-medium">Signed (recent / base)</th>
                      <th className="text-right py-2 px-3 font-medium">Δ signed</th>
                      <th className="text-right py-2 px-3 font-medium">Inspected (recent / base)</th>
                      <th className="text-right py-2 px-3 font-medium">Δ insp</th>
                      <th className="text-right py-2 px-3 font-medium">Attend Δ</th>
                      <th className="text-right py-2 px-3 font-medium">Last paid</th>
                      <th className="text-left py-2 px-3 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {visibleReps.map(r => {
                      const sTr = trendPctText(r.signedTrendPct);
                      const iTr = trendPctText(r.inspectedTrendPct);
                      const dPay = daysSinceText(r.daysSinceLastCommission);
                      const attCls =
                        r.attendanceDeltaPct <= -20 ? 'text-red-400' :
                        r.attendanceDeltaPct <= -10 ? 'text-amber-400' :
                        r.attendanceDeltaPct >= 10  ? 'text-[#39FF14]' :
                        'text-zinc-300';
                      const score100 = Math.round(r.churnScore * 100);
                      const scoreCls =
                        r.riskLevel === 'high'   ? 'text-red-400' :
                        r.riskLevel === 'medium' ? 'text-amber-400' :
                        r.riskLevel === 'low'    ? 'text-[#39FF14]' :
                                                   'text-zinc-400';
                      return (
                        <tr key={r.rep} className={`hover:bg-zinc-800/30 ${RISK_STYLE[r.riskLevel].row}`}>
                          <td className="py-2 px-3 font-medium">
                            {r.rep}
                            {r.lowSignal && (
                              <span className="ml-2 text-[10px] text-amber-300 border border-amber-500/30 rounded px-1.5 py-0.5">
                                low signal
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border ${RISK_STYLE[r.riskLevel].badge}`}>
                              {RISK_STYLE[r.riskLevel].label}
                            </span>
                          </td>
                          <td className={`py-2 px-3 text-right tabular-nums font-mono ${scoreCls}`}>{score100}</td>
                          <td className="py-2 px-3 text-right text-zinc-400 tabular-nums">{r.weeksOfHistory}</td>
                          <td className="py-2 px-3 text-right text-zinc-300 tabular-nums">
                            {r.recent4SignedAvg} / {r.baseline12SignedAvg}
                          </td>
                          <td className={`py-2 px-3 text-right tabular-nums ${sTr.cls}`}>{sTr.text}</td>
                          <td className="py-2 px-3 text-right text-zinc-300 tabular-nums">
                            {r.recent4InspectedAvg} / {r.baseline12InspectedAvg}
                          </td>
                          <td className={`py-2 px-3 text-right tabular-nums ${iTr.cls}`}>{iTr.text}</td>
                          <td className={`py-2 px-3 text-right tabular-nums ${attCls}`}>
                            {r.attendanceDeltaPct > 0 ? '+' : ''}{r.attendanceDeltaPct}pt
                          </td>
                          <td className={`py-2 px-3 text-right tabular-nums ${dPay.cls}`}>{dPay.text}</td>
                          <td className="py-2 px-3 text-xs text-zinc-400 max-w-xs">{r.note}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-zinc-500 px-4 py-2 border-t border-zinc-800">
                &quot;Recent&quot; = last 4 non-excused weeks. &quot;Base&quot; = the 12 non-excused weeks before that. Per-week averages.
                Δ pct is null when baseline avg is zero (no activity to compare against). Δ attend in percentage points.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Kpi({
  icon, label, value, sub, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: 'danger' | 'warning' | 'default';
}) {
  const border =
    tone === 'danger'  ? 'border-red-500/30 bg-red-500/5' :
    tone === 'warning' ? 'border-amber-500/30 bg-amber-500/5' :
                         'border-zinc-800 bg-zinc-900';
  return (
    <div className={`rounded-lg p-3 border ${border}`}>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500 flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold mt-1 text-white tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}
