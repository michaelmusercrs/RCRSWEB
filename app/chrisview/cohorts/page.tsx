'use client';

/**
 * Chris View — Monthly Estimate Cohorts (most-accurate close rate).
 *
 * Each row is one calendar month. For projects whose FIRST estimate was
 * created in that month, the row shows current outcome status broken
 * down won/lost/pending. The TRUE close rate becomes visible at maturity
 * (~6 months out) because by then almost every project that was going
 * to win has done so — anything still pending is effectively lost.
 *
 * trueCloseRate = won ÷ total  (for matured cohorts only).
 * rawCloseRate  = won ÷ (won + lost)  (same calculation as /win-loss;
 *                  looks optimistic because "pending forever" excluded).
 *
 * The matured-cohort headline KPI at the top is the closest thing
 * to RCRS's real historical close rate. Trend chart shows monthly
 * trueCloseRate to spot improvement/decline over time.
 */

import { useState, useEffect, useCallback } from 'react';
import { Trophy, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';
import AboutThisData from '@/components/AboutThisData';

type Maturity = 'mature' | 'maturing' | 'early' | 'fresh';
interface CohortRow {
  cohortMonth: string;
  ageMonths: number;
  maturity: Maturity;
  totalProjects: number;
  wonProjects: number;
  lostProjects: number;
  pendingProjects: number;
  rawCloseRate: number;
  trueCloseRate: number;
}
interface Data {
  generatedAt: string;
  windowMonths: number;
  cohorts: CohortRow[];
  matured: {
    cohortCount: number;
    totalProjects: number;
    wonProjects: number;
    lostProjects: number;
    pendingProjects: number;
    trueCloseRate: number;
    rawCloseRate: number;
  };
  meta: {
    queryTimeMs: number;
    estimatesFetched: number;
    distinctJobIds: number;
    jobsFetched: number;
    matureThresholdMonths: number;
  };
}

const MATURITY_COLOR: Record<Maturity, string> = {
  mature: '#39FF14',
  maturing: '#a3e635',
  early: '#fbbf24',
  fresh: '#71717a',
};
const MATURITY_LABEL: Record<Maturity, string> = {
  mature: 'MATURE (≥6mo)',
  maturing: 'MATURING (3–6mo)',
  early: 'EARLY (1–3mo)',
  fresh: 'FRESH (<1mo)',
};

export default function CohortsPage() {
  const [months, setMonths] = useState(18);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/chrisview-cohorts?months=${months}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setData(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'fetch failed');
    } finally {
      setLoading(false);
    }
  }, [months]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />Back
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2"><Trophy className="w-5 h-5 text-[#39FF14]" />Monthly Cohort Close Rate</h1>
          <div className="ml-auto flex items-center gap-2">
            <select value={months} onChange={e => setMonths(parseInt(e.target.value))} className="text-xs bg-zinc-900 border border-zinc-800 rounded px-2 py-1">
              <option value="12">Last 12 months</option>
              <option value="18">Last 18 months</option>
              <option value="24">Last 24 months</option>
              <option value="36">Last 36 months (max)</option>
            </select>
            <button onClick={fetchData} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14] hover:bg-[#39FF14]/20 rounded-lg text-xs font-medium disabled:opacity-50">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{err}</div>}
        {!data && loading && (
          <div className="text-center py-16 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin inline mr-2" />
            Pulling estimates + jobs and bucketing cohorts… (first load 30–90s, cached 30 min)
          </div>
        )}
        {data && (
          <>
            {/* The headline — true close rate from matured cohorts */}
            <section className="bg-gradient-to-br from-[#39FF14]/10 to-zinc-950 border border-[#39FF14]/30 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-[#39FF14] uppercase tracking-wide mb-2">Headline — RCRS Historical Close Rate</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Kpi label="True close rate (matured)" value={`${data.matured.trueCloseRate}%`} sub={`${data.matured.wonProjects} won ÷ ${data.matured.totalProjects} total`} highlight />
                <Kpi label="Window-style close rate" value={`${data.matured.rawCloseRate}%`} sub="won ÷ (won + lost), excludes pending" />
                <Kpi label="Matured cohorts" value={data.matured.cohortCount.toString()} sub="≥6 months old" />
                <Kpi label="Total resolved" value={(data.matured.wonProjects + data.matured.lostProjects).toString()} sub={`${data.matured.pendingProjects} effectively-lost`} />
                <Kpi label="Total projects" value={data.matured.totalProjects.toString()} sub={`across ${data.matured.cohortCount} mo`} />
              </div>
              <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
                The TRUE close rate (won ÷ total) is reliable for cohorts at least 6 months old. At that age, almost every winnable deal has already won — anything still &quot;pending&quot; is a dead deal a rep is keeping warm to dodge the auto-stale rule. That&apos;s why the cohort close rate (<span className="text-[#39FF14] font-mono">{data.matured.trueCloseRate}%</span>) is dramatically lower than the window-based rate (<span className="text-zinc-300 font-mono">{data.matured.rawCloseRate}%</span>) on /chrisview/win-loss.
              </p>
            </section>

            {/* Trend chart */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-2">Close rate trend by cohort month</h3>
              <p className="text-xs text-zinc-400 mb-3">Bars = total projects per cohort. Line = true close rate (won ÷ total). Color-coded by maturity. Right end of the chart is unreliable until cohorts age into mature.</p>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.cohorts} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="cohortMonth" stroke="#71717a" fontSize={11} />
                    <YAxis yAxisId="left" stroke="#71717a" fontSize={11} />
                    <YAxis yAxisId="right" orientation="right" stroke="#39FF14" fontSize={11} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <Tooltip
                      contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                      formatter={(value, name, item) => {
                        if (name === 'Total projects') return [`${value} projects`, name];
                        if (name === 'True close rate') return [`${value}%`, name];
                        return [value, name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="left" dataKey="totalProjects" name="Total projects" fill="#3f3f46">
                      {data.cohorts.map((c, i) => <Cell key={i} fill={MATURITY_COLOR[c.maturity] + '60'} />)}
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="trueCloseRate" name="True close rate" stroke="#39FF14" strokeWidth={2.5} dot={(props) => {
                      const c = data.cohorts[props.index ?? 0];
                      const fill = c ? MATURITY_COLOR[c.maturity] : '#39FF14';
                      return <circle cx={props.cx} cy={props.cy} r={4} fill={fill} stroke="#39FF14" strokeWidth={1.5} />;
                    }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                {(['mature', 'maturing', 'early', 'fresh'] as Maturity[]).map(m => (
                  <div key={m} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded" style={{ background: MATURITY_COLOR[m] }} />
                    <span className="text-zinc-400">{MATURITY_LABEL[m]}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Cohort detail table */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold">Cohort detail</h3>
                <p className="text-xs text-zinc-400 mt-1">One row per month the first-estimate landed in. Read mature rows for trustworthy numbers — flag early/fresh as preliminary.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Cohort</th>
                      <th className="text-right py-2 px-3 font-medium">Age</th>
                      <th className="text-center py-2 px-3 font-medium">Maturity</th>
                      <th className="text-right py-2 px-3 font-medium">Total</th>
                      <th className="text-right py-2 px-3 font-medium">Won</th>
                      <th className="text-right py-2 px-3 font-medium">Lost</th>
                      <th className="text-right py-2 px-3 font-medium">Pending</th>
                      <th className="text-right py-2 px-3 font-medium" title="Won ÷ Total. Reliable for matured cohorts.">True close%</th>
                      <th className="text-right py-2 px-3 font-medium" title="Won ÷ (Won + Lost). What /win-loss shows.">Raw close%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {[...data.cohorts].reverse().map(c => (
                      <tr key={c.cohortMonth} className={`hover:bg-zinc-800/30 ${c.maturity === 'fresh' || c.maturity === 'early' ? 'opacity-70' : ''}`}>
                        <td className="py-2 px-3 font-medium font-mono text-xs">{c.cohortMonth}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{c.ageMonths} mo</td>
                        <td className="py-2 px-3 text-center">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: MATURITY_COLOR[c.maturity] + '20', color: MATURITY_COLOR[c.maturity] }}>
                            {c.maturity}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">{c.totalProjects}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{c.wonProjects}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-red-400">{c.lostProjects}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-amber-400">{c.pendingProjects}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-bold" style={{ color: c.maturity === 'mature' ? '#39FF14' : '#a1a1aa' }}>{c.trueCloseRate}%</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-500">{c.rawCloseRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="text-[10px] text-zinc-500 text-center">
              Generated {data.generatedAt} · {data.meta.distinctJobIds} projects across {data.cohorts.length} monthly cohorts · query {data.meta.queryTimeMs}ms
            </p>
          </>
        )}

        <AboutThisData
          source="JN /estimates over the configured window (default 18 months). For each unique job R-number, only the FIRST estimate counts. Each job is then fetched via /jobs/{id} for its current status_name."
          method={`Bucket projects by the calendar month of their first estimate. For each cohort: count won (status ≥ Approved Jobs), lost (status = Lost), pending (everything else — Lead / Aerial Measurements / Inspection / Estimate / Contingency Signed / etc.). TRUE close rate = won ÷ total (treats pending as effectively-lost, which is accurate once a cohort is mature ≥ 6 months). RAW close rate = won ÷ (won + lost) — the same math /chrisview/win-loss uses. The matured-cohort headline aggregates all cohorts ≥ 6 months old.`}
          uses="The True close rate on matured cohorts is the closest thing to RCRS's real historical conversion. Use the trend chart to spot whether close rate is improving or sliding month-over-month. Use the cohort table to compare specific months (e.g., 'did our Aug 2025 hail event cohort close higher than Aug 2024?')."
          gaps="Cohorts younger than 3 months show preliminary numbers — most slow-winning deals haven't resolved yet. The 'pending' bucket in old cohorts is treated as effectively-lost, which is intentional but imperfect: a small fraction of those pendings ARE genuinely still active. For an authoritative reading, use cohorts at least 9 months old. Also: JN's /estimates pagination caps at ~635 recent estimates — windows beyond ~18 months may bottom out on data."
          generatedAt={data?.generatedAt}
        />
      </main>
    </div>
  );
}

function Kpi({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-lg ${highlight ? 'bg-[#39FF14]/10 border border-[#39FF14]/30' : 'bg-zinc-900 border border-zinc-800'}`}>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${highlight ? 'text-[#39FF14]' : 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}
