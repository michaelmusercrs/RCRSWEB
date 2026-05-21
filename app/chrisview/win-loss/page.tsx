'use client';

/**
 * Chris View — Estimate Win/Loss per Project.
 *
 * Each PROJECT (R-number) with at least one estimate counts as 1. If the
 * project has any invoice it's WON; otherwise PENDING. Multiple estimates
 * on the same project do NOT inflate the count (Michael's explicit rule).
 *
 * Win rate = won projects ÷ total projects with estimates.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Trophy, ArrowLeft, Loader2, RefreshCw, Briefcase, Shield, AlertCircle, Users,
} from 'lucide-react';
import AboutThisData from '@/components/AboutThisData';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';

interface Rollup {
  key: string;
  totalProjects: number;
  wonProjects: number;
  lostProjects: number;
  pendingProjects: number;
  conversionRate: number;
  closeRate: number;
}
interface Project {
  rNumber: string;
  jobJnid: string;
  firstEstimateAt: string;
  totalEstimates: number;
  outcome: 'won' | 'lost' | 'pending';
  lostReason: 'explicit' | 'stale' | null;
  daysSinceActivity: number | null;
  ageDays: number | null;
  isMature: boolean;
  won: boolean;
  firstInvoiceAt: string | null;
  daysToInvoice: number | null;
  daysPending: number | null;
  rep: string;
  source: string;
  isInsurance: boolean;
  jobStatus: string;
}
interface PendingAgeBucket {
  bucket: string;
  count: number;
}
interface Data {
  generatedAt: string;
  windowDays: number;
  totalProjects: number;
  wonProjects: number;
  lostProjects: number;
  pendingProjects: number;
  overallConversionRate: number;
  overallCloseRate: number;
  matureProjects: number;
  matureWon: number;
  matureLost: number;
  maturePending: number;
  matureCloseRate: number;
  matureConversionRate: number;
  freshProjects: number;
  pendingByAge: PendingAgeBucket[];
  byRep: Rollup[];
  bySource: Rollup[];
  byInsurance: Rollup[];
  recentLosses: Project[];
  projects: Project[];
  meta: {
    queryTimeMs: number;
    estimatesFetched: number;
    invoicesFetched: number;
    jobsFetched: number;
    distinctJobIds: number;
    wonRePattern: string;
    lostRePattern: string;
    preApprovedRePattern: string;
    staleDays: number;
    maturityDays: number;
    explicitLostCount: number;
    staleLostCount: number;
  };
}

function rateColor(r: number) {
  if (r >= 50) return '#39FF14';
  if (r >= 30) return '#fbbf24';
  if (r >= 15) return '#fb7185';
  return '#ef4444';
}

export default function WinLossPage() {
  const [days, setDays] = useState(180);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/chrisview-win-loss?days=${days}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
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
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#39FF14]" />
            Estimate Win/Loss per Project
          </h1>
          <div className="ml-auto flex items-center gap-2">
            {[30, 60, 90, 180, 365, 730].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  days === d
                    ? 'bg-[#39FF14]/10 border-[#39FF14]/40 text-[#39FF14]'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {d}d
              </button>
            ))}
            <button onClick={fetchData} disabled={loading} className="p-1.5 text-zinc-400 hover:text-white rounded disabled:opacity-50" title="Refresh">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{err}</div>}
        {!data && loading && (
          <div className="text-center py-16 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin inline mr-2" />
            Querying JobNimbus and crunching estimates… (first load 30-90s, cached 10 min)
          </div>
        )}
        {data && (
          <>
            {/* KPI strip — RAW */}
            <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Kpi label="Projects with estimates" value={data.totalProjects.toString()} sub={`last ${data.windowDays} days`} />
              <Kpi label="Won (Approved+)" value={data.wonProjects.toString()} sub="status ≥ Approved Jobs" />
              <Kpi
                label="Lost"
                value={data.lostProjects.toString()}
                sub={`${data.meta.explicitLostCount} explicit · ${data.meta.staleLostCount} stale (>${data.meta.staleDays}d)`}
              />
              <Kpi label="Pending" value={data.pendingProjects.toString()} sub={`active within ${data.meta.staleDays}d`} />
              <Kpi label="Close rate (raw)" value={`${data.overallCloseRate}%`} sub={`conversion ${data.overallConversionRate}% incl. pending`} />
            </section>

            {/* Mature-subset row — fairer for short windows */}
            <section className="bg-zinc-900 border border-[#39FF14]/20 rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#39FF14]">Mature subset (age-adjusted)</h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Excludes the {data.freshProjects} projects younger than {data.meta.maturityDays} days (too fresh to have had time to close).
                    Wins are slow — p50 is ~54 days from creation to Approved+, p75 is ~116 days. Counting brand-new estimates in the close rate
                    biases it optimistically. This subset is the fairer read.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Kpi label="Mature projects" value={data.matureProjects.toString()} sub={`age ≥ ${data.meta.maturityDays}d`} />
                <Kpi label="Mature won" value={data.matureWon.toString()} />
                <Kpi label="Mature lost" value={data.matureLost.toString()} />
                <Kpi label="Mature pending" value={data.maturePending.toString()} />
                <Kpi label="Close rate (mature)" value={`${data.matureCloseRate}%`} sub={`conversion ${data.matureConversionRate}% incl. pending`} highlight />
              </div>
            </section>

            {/* Pending by age — shows where the active deals are */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-1">Pending by age</h3>
              <p className="text-xs text-zinc-400 mb-3">
                Distribution of the {data.pendingProjects} pending projects by how old their first estimate is.
                Anything past {data.meta.staleDays}d should already be auto-classified as lost — the 60+d bucket here is
                the edge case (recent activity within staleDays kept them alive).
              </p>
              <div className="grid grid-cols-4 gap-3">
                {data.pendingByAge.map(b => (
                  <div key={b.bucket} className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
                    <div className="text-2xl font-bold text-white">{b.count}</div>
                    <div className="text-[10px] uppercase tracking-wide text-zinc-500 mt-1">{b.bucket}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Close rate by rep — bar chart */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-[#39FF14]" />Close Rate by Rep</h3>
              <p className="text-xs text-zinc-400 mb-3">Per-rep close rate among RESOLVED projects (won + lost). Conversion rate (incl. still-pending in denominator) shown on hover.</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byRep} margin={{ top: 8, right: 16, bottom: 32, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="key" stroke="#71717a" fontSize={11} angle={-30} textAnchor="end" interval={0} height={64} />
                    <YAxis stroke="#71717a" fontSize={11} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <Tooltip
                      contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                      formatter={(value, _name, item) => {
                        const p = (item?.payload || {}) as Rollup;
                        return [`${value}% close (${p.wonProjects} won / ${p.lostProjects} lost / ${p.pendingProjects} pending)`, 'Close rate'];
                      }}
                    />
                    <Bar dataKey="closeRate" name="Close rate">
                      {data.byRep.map((r, i) => (
                        <Cell key={i} fill={rateColor(r.closeRate)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <RollupCard title="By Rep" icon={Users} description="Win rate per rep — projects where that rep was on the first estimate. Multiple estimates on the same project still count as 1." rows={data.byRep} />
            <RollupCard title="By Source" icon={Briefcase} description="Win rate per JN contact source (carried through from the job)." rows={data.bySource} />
            <RollupCard title="By Insurance vs Retail" icon={Shield} description="Insurance = the job has a Claim Number (or Date of Loss / carrier) populated. Retail = none of the above." rows={data.byInsurance} />

            {/* Follow-up table */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                Stalled Pipeline — Estimate &gt; 60 days, No Invoice
              </h3>
              <p className="text-xs text-zinc-400 mb-3">
                Top 30 projects with an estimate older than 60 days that haven&apos;t been invoiced. These are either lost,
                slow to close, or installed-but-not-invoiced. Call list — sort by days pending.
              </p>
              {data.recentLosses.length === 0 ? (
                <p className="text-xs text-zinc-500">No stalled projects — every estimate older than 60 days has an invoice. Nice.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium">R#</th>
                        <th className="text-left py-2 px-3 font-medium">Rep</th>
                        <th className="text-left py-2 px-3 font-medium">Source</th>
                        <th className="text-left py-2 px-3 font-medium">Type</th>
                        <th className="text-left py-2 px-3 font-medium">JN Status</th>
                        <th className="text-right py-2 px-3 font-medium">First Est</th>
                        <th className="text-right py-2 px-3 font-medium">Days Pending</th>
                        <th className="text-right py-2 px-3 font-medium"># Ests</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {data.recentLosses.map(p => (
                        <tr key={p.jobJnid} className="hover:bg-zinc-800/30">
                          <td className="py-2 px-3 font-mono text-xs text-[#39FF14]">{p.rNumber}</td>
                          <td className="py-2 px-3">{p.rep || <span className="text-zinc-600">—</span>}</td>
                          <td className="py-2 px-3 text-zinc-400">{p.source || <span className="text-zinc-600">—</span>}</td>
                          <td className="py-2 px-3">
                            {p.isInsurance ? (
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-300">Insurance</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">Retail</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-xs text-zinc-400">{p.jobStatus || <span className="text-zinc-600">—</span>}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-xs text-zinc-400">{p.firstEstimateAt.slice(0, 10)}</td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold text-amber-400">{p.daysPending}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{p.totalEstimates}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        <AboutThisData
          source="JN /estimates and /invoices created in the last 180 days (default window, 1-730 max). Estimates link to a job via related[] (type='job'). Each job's R-number, status_name, date_status_change, date_updated, and date_created are fetched via /jobs/{id}."
          method={`Dedupe by R-number — each project counts as 1 regardless of estimate count (per Michael; multiple estimates often = multiple options on the same job). Outcome from job status: WON = "Approved Jobs" or any status PAST Approved (Materials Ordered, Pending Final Payment, Pending Supplement, Roofer Pay Needed, Job Completion Form, Payouts, Paid & Closed). LOST = explicit "Lost" status OR pre-Approved status (Lead / Aerial Measurements / Inspection / Estimate / Pending Approval / Contingency Signed / Signed Contract) with no activity for ${data?.meta.staleDays ?? 60} days. PENDING = pre-Approved with recent activity. "Activity" = max(date_status_change, date_updated, date_created). Close rate = won ÷ (won + lost), resolved-only. Conversion rate = won ÷ total, includes pending in denominator. Insurance = job has Claim Number, Date of Loss, or carrier populated.`}
          uses="See which reps actually push projects to Approved+ (vs generating paper that ages out). Compare insurance vs retail conversion — insurance jobs go through Contingency Signed before Approved, so a high insurance pending count is normal; high stale-lost in insurance means claims aren't getting approved. The Stalled Pipeline table is the follow-up list: pre-Approved projects with no activity for 60+ days that haven't yet been auto-classified as lost."
          gaps={`Stale threshold is set to ${data?.meta.staleDays ?? 60} days based on historical analysis (Approved Jobs typically clears within 6 weeks, p75 = 114 d). Configurable via CHRISVIEW_STALE_DAYS env var. The threshold trades aggression for accuracy — too low and active leads get mis-counted as lost; too high and dead deals stay in 'pending' forever. Also: estimates with no related job (template / orphan) are excluded — they have no R-number to dedupe on. JN 'date_updated' may not capture every kind of activity (e.g. an attachment may not bump it).`}
          generatedAt={data?.generatedAt}
        />
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

function RollupCard({ title, icon: Icon, description, rows }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  rows: Rollup[];
}) {
  if (!rows.length) {
    return (
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-1"><Icon className="w-4 h-4 text-[#39FF14]" />{title}</h3>
        <p className="text-xs text-zinc-500">{description}</p>
        <p className="text-xs text-zinc-500 mt-3">No data.</p>
      </section>
    );
  }
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-1"><Icon className="w-4 h-4 text-[#39FF14]" />{title}</h3>
      <p className="text-xs text-zinc-400 mb-3">{description}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
            <tr>
              <th className="text-left py-2 px-3 font-medium">Bucket</th>
              <th className="text-right py-2 px-3 font-medium">Projects</th>
              <th className="text-right py-2 px-3 font-medium">Won</th>
              <th className="text-right py-2 px-3 font-medium">Lost</th>
              <th className="text-right py-2 px-3 font-medium">Pending</th>
              <th className="text-right py-2 px-3 font-medium" title="Won ÷ (Won + Lost) — resolved only">Close %</th>
              <th className="text-right py-2 px-3 font-medium" title="Won ÷ Total — includes pending in denominator">Conv %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {rows.map(r => (
              <tr key={r.key} className="hover:bg-zinc-800/30">
                <td className="py-2 px-3 font-medium">{r.key || 'Unknown'}</td>
                <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{r.totalProjects}</td>
                <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{r.wonProjects}</td>
                <td className="py-2 px-3 text-right tabular-nums text-red-400">{r.lostProjects}</td>
                <td className="py-2 px-3 text-right tabular-nums text-amber-400">{r.pendingProjects}</td>
                <td className="py-2 px-3 text-right tabular-nums font-bold" style={{ color: rateColor(r.closeRate) }}>{r.closeRate}%</td>
                <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{r.conversionRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
