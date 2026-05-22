'use client';

/**
 * Chris View — Estimate Delivery (emailed vs presented in person, close rate per mode).
 *
 * 5 certainty buckets, with two summary readings (certain-only and
 * including-probables) per Michael 2026-05-21.
 */

import { useState, useEffect, useCallback } from 'react';
import { Mail, ArrowLeft, Loader2, RefreshCw, Users, HelpCircle } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import AboutThisData from '@/components/AboutThisData';

type Category = 1 | 2 | 3 | 4 | 5;

interface CategoryRow {
  category: Category;
  label: string;
  count: number;
  won: number;
  lost: number;
  pending: number;
  trueCloseRate: number;
  rawCloseRate: number;
}

interface Summary {
  presented: { count: number; won: number; lost: number; pending: number; trueCloseRate: number; rawCloseRate: number };
  emailed:   { count: number; won: number; lost: number; pending: number; trueCloseRate: number; rawCloseRate: number };
  diffTrue: number;
  diffRaw: number;
}

interface Data {
  generatedAt: string;
  windowDays: number;
  totalEstimates: number;
  byCategory: CategoryRow[];
  certainOnly: Summary;
  includingProbables: Summary;
  sample: Array<{
    estimateNumber: string;
    rNumber: string;
    rep: string;
    category: Category;
    classifyReason: string;
    outcome: 'won' | 'lost' | 'pending';
    jobStatus: string;
  }>;
  meta: {
    queryTimeMs: number;
    estimatesFetched: number;
    contactsFetched: number;
    jobsFetched: number;
    activitiesFetched: number;
    staleDays: number;
  };
}

const CAT_COLOR: Record<Category, string> = {
  5: '#39FF14', // in-person
  4: '#a3e635',
  3: '#71717a', // uncertain
  2: '#fbbf24',
  1: '#fb7185', // email
};

const CAT_SHORT: Record<Category, string> = {
  5: 'Certain — in person',
  4: 'Probably in person',
  3: 'Uncertain',
  2: 'Probably emailed',
  1: 'Certain — emailed only',
};

export default function EstimateDeliveryPage() {
  const [days, setDays] = useState(180);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/chrisview-estimate-delivery?days=${days}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setData(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'fetch failed');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />Back
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2"><Mail className="w-5 h-5 text-[#39FF14]" />Estimate Delivery — Emailed vs Presented</h1>
          <div className="ml-auto flex items-center gap-2">
            <select value={days} onChange={e => setDays(parseInt(e.target.value))} className="text-xs bg-zinc-900 border border-zinc-800 rounded px-2 py-1">
              <option value="90">Last 90 days</option>
              <option value="180">Last 180 days</option>
              <option value="365">Last 365 days</option>
              <option value="730">Last 730 days (max)</option>
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
            Walking estimates + activities + scoring delivery signals… (60–120s first load, cached 30 min)
          </div>
        )}
        {data && (
          <>
            {/* ===== HEADLINE — two summary readings ===== */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Certain only */}
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-[#39FF14]/30 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-[#39FF14] uppercase tracking-wide mb-1">Certain only</h2>
                <p className="text-xs text-zinc-400 mb-4">Compares the &quot;definitely in-person&quot; bucket (category 5) to the &quot;definitely emailed only&quot; bucket (category 1). Smaller sample, but the cleanest read.</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <Kpi label="Presented (certain)" value={`${data.certainOnly.presented.trueCloseRate}%`} sub={`${data.certainOnly.presented.won}/${data.certainOnly.presented.count} won`} color="#39FF14" />
                  <Kpi label="Emailed (certain)" value={`${data.certainOnly.emailed.trueCloseRate}%`} sub={`${data.certainOnly.emailed.won}/${data.certainOnly.emailed.count} won`} color="#fb7185" />
                </div>
                <div className="text-xs text-zinc-300">
                  In-person advantage: <span className={`font-mono font-bold ${data.certainOnly.diffTrue >= 0 ? 'text-[#39FF14]' : 'text-rose-400'}`}>{data.certainOnly.diffTrue >= 0 ? '+' : ''}{data.certainOnly.diffTrue} pp</span>
                  <span className="text-zinc-500"> (true close-rate gap)</span>
                </div>
              </div>

              {/* Including probables */}
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-[#39FF14]/30 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-[#39FF14] uppercase tracking-wide mb-1">Including probables</h2>
                <p className="text-xs text-zinc-400 mb-4">Combines &quot;probably&quot; with &quot;certainly&quot; for each side. Bigger sample, slightly noisier classification. Excludes the uncertain bucket.</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <Kpi label="Presented (4 + 5)" value={`${data.includingProbables.presented.trueCloseRate}%`} sub={`${data.includingProbables.presented.won}/${data.includingProbables.presented.count} won`} color="#39FF14" />
                  <Kpi label="Emailed (1 + 2)" value={`${data.includingProbables.emailed.trueCloseRate}%`} sub={`${data.includingProbables.emailed.won}/${data.includingProbables.emailed.count} won`} color="#fb7185" />
                </div>
                <div className="text-xs text-zinc-300">
                  In-person advantage: <span className={`font-mono font-bold ${data.includingProbables.diffTrue >= 0 ? 'text-[#39FF14]' : 'text-rose-400'}`}>{data.includingProbables.diffTrue >= 0 ? '+' : ''}{data.includingProbables.diffTrue} pp</span>
                  <span className="text-zinc-500"> (true close-rate gap)</span>
                </div>
              </div>
            </section>

            {/* ===== Per category table + chart ===== */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold">Per-category breakdown</h3>
                <p className="text-xs text-zinc-400 mt-1">{data.totalEstimates} estimates over the last {data.windowDays} days, scored on a +/- point system. True close rate = won ÷ total (cohort-style); raw close rate = won ÷ (won + lost) for reference.</p>
              </div>
              <div className="px-4 py-3">
                <div className="h-64 mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byCategory} margin={{ top: 8, right: 8, bottom: 32, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="label" stroke="#71717a" fontSize={10} angle={-20} textAnchor="end" interval={0} height={64} />
                      <YAxis stroke="#71717a" fontSize={11} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                      <Tooltip
                        contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                        formatter={(value, _name, item) => {
                          const p = (item?.payload || {}) as CategoryRow;
                          return [`${value}% (${p.won}/${p.count} won, ${p.lost} lost, ${p.pending} pending)`, 'True close rate'];
                        }}
                      />
                      <Bar dataKey="trueCloseRate">
                        {data.byCategory.map((r, i) => (
                          <Cell key={i} fill={CAT_COLOR[r.category]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium">Category</th>
                    <th className="text-right py-2 px-3 font-medium">Estimates</th>
                    <th className="text-right py-2 px-3 font-medium">Won</th>
                    <th className="text-right py-2 px-3 font-medium">Lost</th>
                    <th className="text-right py-2 px-3 font-medium">Pending</th>
                    <th className="text-right py-2 px-3 font-medium" title="Won ÷ Total — the cohort-style 'true' close rate">True close%</th>
                    <th className="text-right py-2 px-3 font-medium" title="Won ÷ (Won + Lost) — window-style">Raw close%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {data.byCategory.map(r => (
                    <tr key={r.category} className="hover:bg-zinc-800/30">
                      <td className="py-2 px-3 font-medium">
                        <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: CAT_COLOR[r.category] }} />
                        {r.label}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">{r.count}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{r.won}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-red-400">{r.lost}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-amber-400">{r.pending}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-bold" style={{ color: CAT_COLOR[r.category] }}>{r.trueCloseRate}%</td>
                      <td className="py-2 px-3 text-right tabular-nums text-zinc-500">{r.rawCloseRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Sample estimates */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold">Sample estimates (most recent 100)</h3>
                <p className="text-xs text-zinc-400 mt-1">Inspection table — see how each estimate scored. Spot-check edge cases.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Est #</th>
                      <th className="text-left py-2 px-3 font-medium">R #</th>
                      <th className="text-left py-2 px-3 font-medium">Rep</th>
                      <th className="text-left py-2 px-3 font-medium">Bucket</th>
                      <th className="text-left py-2 px-3 font-medium">Why</th>
                      <th className="text-left py-2 px-3 font-medium">Job status</th>
                      <th className="text-left py-2 px-3 font-medium">Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.sample.slice(0, 50).map(s => (
                      <tr key={s.estimateNumber} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-mono text-xs">{s.estimateNumber}</td>
                        <td className="py-2 px-3 font-mono text-xs text-zinc-400">{s.rNumber}</td>
                        <td className="py-2 px-3 text-xs">{s.rep || '—'}</td>
                        <td className="py-2 px-3 text-xs">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: CAT_COLOR[s.category] + '20', color: CAT_COLOR[s.category] }}>
                            {CAT_SHORT[s.category]}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-xs text-zinc-400 max-w-md">{s.classifyReason}</td>
                        <td className="py-2 px-3 text-xs text-zinc-400">{s.jobStatus}</td>
                        <td className="py-2 px-3 text-xs">
                          <span className={s.outcome === 'won' ? 'text-[#39FF14]' : s.outcome === 'lost' ? 'text-red-400' : 'text-amber-400'}>
                            {s.outcome}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="text-[10px] text-zinc-500 text-center">
              Generated {data.generatedAt} · {data.totalEstimates} estimates scored from {data.meta.estimatesFetched} fetched · {data.meta.activitiesFetched} activities walked · {data.meta.contactsFetched} contacts, {data.meta.jobsFetched} jobs · query {data.meta.queryTimeMs}ms
            </p>
          </>
        )}

        <AboutThisData
          source="JN /estimates over the configured window, plus walks of /activities by contact + related job for each unique entity (cached per id to avoid N+1). Job status fetched via /jobs/{id} for outcome classification."
          method={`Decision tree, evaluated in order — first match wins.
            HARD EMAIL (→ 1 Certain emailed):
              · Signed > 24 hr after e-sign request (sigGap > 86400s)
              · "Estimate Sent" activity for this estimate AND no in-person evidence
            SOFT EMAIL (→ 2 Probably emailed):
              · "Estimate Sent" activity exists (mixed signals)
              · signature_status = Requested (e-sign sent, not signed)
              · signature_status = Partially Signed
              · Signed 2–24 hr after e-sign request
            HARD IN-PERSON (→ 5 Certain in-person):
              · Task Completed activity within ±3 days of estimate
              · Note within ±7 days mentions met/visited/inspected/on-site/in-person/stopped by/came out/presented/showed
              · Manual signature (signed without e-sign request — physical contract)
            SOFT IN-PERSON (→ 4 Probably presented):
              · Task Completed within ±14 days
              · Signed within 30 min of e-sign request (likely tablet at customer's home)
              · Estimate's own note mentions a meeting
              · signature_status = Not Requested (RCRS default is in-person — no email workflow used)
            UNCERTAIN (→ 3): none of the above matched.
            CRITICAL FIX 2026-05-21: "Estimate Sent" activities are now queried per-estimate via /activities?filter=primary.id=estimate.jnid — they don't appear in contact/job activity walks. Previously this signal was effectively invisible and 62% of estimates fell to "Uncertain". Now ~3-5% should be truly uncertain.
            Outcome per estimate's parent job: WON = status ≥ Approved Jobs; LOST = Lost or pre-Approved + stale (${data?.meta.staleDays ?? 60}d); else PENDING. True close rate = won ÷ total. Raw close rate = won ÷ (won + lost) for /win-loss comparability.`}
          uses="Settle the 'should reps go meet customers in person, or is email fine' question with data. The in-person advantage shown in the Headline boxes is the lift from showing up. Bucket 5 (certain in-person) close rate vs bucket 1 (certain emailed) close rate is the clean comparison; the including-probables view widens the sample if 5 vs 1 is too small."
          gaps="Probe-verified signals 2026-05-21 across 1000 estimates. The strongest signal (sig request-to-signed gap) only applies to the 26% of estimates that go through e-sign. For the other 74%, classification leans on Task Completed activities and note text — both depend on rep discipline in JN. If a rep met a customer in person but didn't log a task or note, it'll land in 'Uncertain'. Window also intentionally caps at 2000 estimates pulled — sufficient for 365-day RCRS volume but won't scale if the company doubles."
          generatedAt={data?.generatedAt}
        />
      </main>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color: color || '#fff' }}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}
