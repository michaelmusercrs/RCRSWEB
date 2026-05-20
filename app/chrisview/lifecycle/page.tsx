'use client';

/**
 * Chris View — Job Lifecycle (Phase 5).
 *
 * Time-to-contract / time-to-install / time-to-paid distributions,
 * trips per job, rework rate, 90-day unpaid AR. Per Michael's
 * 2026-05-20 spec.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Clock, ArrowLeft, Loader2, RefreshCw, AlertTriangle, Users, Phone, Shield, Wrench,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend,
} from 'recharts';

interface RollupRow {
  key: string;
  jobs: number;
  signed: number;
  installed: number;
  paid: number;
  medianResponseMin: number | null;
  medianDaysToContract: number | null;
  medianDaysToInstall: number | null;
  medianDaysToPaid: number | null;
  avgTrips: number;
  reworkPct: number;
  unpaidOver90: number;
}

interface Job {
  jnid: string; number: string; customer: string; rep: string; carrier: string;
  status: string; isInsurance: boolean;
  daysToContract: number | null; daysToInstall: number | null; daysToPaid: number | null;
  responseMinutes: number | null; firstContactMethod: string | null;
  tripCount: number; reworkCount: number;
  unpaidOver90Days: boolean; outstandingBalance: number;
}

interface Data {
  generatedAt: string;
  daysQueried: number;
  jobsAnalyzed: number;
  jobs: Job[];
  byRep: RollupRow[];
  byMethod: RollupRow[];
  byInsurance: RollupRow[];
  histograms: { daysToContract: Array<{ bucket: string; count: number }>; daysToInstall: Array<{ bucket: string; count: number }>; daysToPaid: Array<{ bucket: string; count: number }> };
  overall: {
    medianDaysToContract: number | null;
    medianDaysToInstall: number | null;
    medianDaysToPaid: number | null;
    avgTrips: number;
    pctWithRework: number;
    unpaidOver90Count: number;
    unpaidOver90Total: number;
  };
  meta: { queryTimeMs: number; jobsFetched: number; activitiesFetched: number; invoicesFetched: number };
}

function fmtMoney(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}
function fmtMin(m: number | null) {
  if (m == null) return '—';
  if (m < 60) return `${Math.round(m)}m`;
  if (m < 1440) return `${(m / 60).toFixed(1)}h`;
  return `${(m / 1440).toFixed(1)}d`;
}
function fmtDays(d: number | null) {
  if (d == null) return '—';
  if (d < 1) return `${(d * 24).toFixed(1)}h`;
  return `${d.toFixed(1)}d`;
}

export default function LifecyclePage() {
  const [days, setDays] = useState(180);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [repFilter, setRepFilter] = useState('');
  const [insuranceOnly, setInsuranceOnly] = useState<'all' | 'insurance' | 'retail'>('all');
  const [problemsOnly, setProblemsOnly] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/chrisview-lifecycle?days=${days}`);
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

  const filteredJobs = data?.jobs.filter(j => {
    if (repFilter && j.rep !== repFilter) return false;
    if (insuranceOnly === 'insurance' && !j.isInsurance) return false;
    if (insuranceOnly === 'retail' && j.isInsurance) return false;
    if (problemsOnly && !(j.unpaidOver90Days || j.reworkCount > 0 || j.tripCount > 4)) return false;
    return true;
  }) || [];

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#39FF14]" />
            Job Lifecycle
          </h1>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {[30, 90, 180, 365, 730].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  days === d ? 'bg-[#39FF14]/10 border-[#39FF14]/40 text-[#39FF14]' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
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
            Crunching JN — jobs + activities + invoices… (60-120s first load, cached 10 min)
          </div>
        )}
        {data && (
          <>
            {/* KPIs */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Jobs in window" value={data.jobsAnalyzed.toString()} sub={`last ${data.daysQueried}d`} highlight />
              <Kpi label="Median lead → contract" value={fmtDays(data.overall.medianDaysToContract)} />
              <Kpi label="Median contract → install" value={fmtDays(data.overall.medianDaysToInstall)} />
              <Kpi label="Median contract → paid" value={fmtDays(data.overall.medianDaysToPaid)} />
              <Kpi label="Avg trips per job" value={data.overall.avgTrips.toString()} />
              <Kpi label="Jobs with rework" value={`${data.overall.pctWithRework}%`} negative={data.overall.pctWithRework > 10} />
              <Kpi label="90-day unpaid jobs" value={data.overall.unpaidOver90Count.toString()} negative={data.overall.unpaidOver90Count > 0} />
              <Kpi label="90-day unpaid $" value={fmtMoney(data.overall.unpaidOver90Total)} negative={data.overall.unpaidOver90Total > 0} />
            </section>

            {/* Histograms */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Histogram title="Days: Lead → Contract" data={data.histograms.daysToContract} color="#39FF14" />
              <Histogram title="Days: Contract → Install" data={data.histograms.daysToInstall} color="#60a5fa" />
              <Histogram title="Days: Contract → Paid" data={data.histograms.daysToPaid} color="#fbbf24" />
            </section>

            {/* By Rep */}
            <RollupTable title="By Sales Rep" icon={Users} description="Per-rep medians + rework + 90-day-unpaid count." rows={data.byRep} />
            <RollupTable title="By First-Contact Method" icon={Phone} description="Does calling-first close faster than texting / emailing?" rows={data.byMethod} />
            <RollupTable title="Insurance vs Retail" icon={Shield} description="Insurance jobs tend to have longer lead→contract because of inspection + claim cycle." rows={data.byInsurance} />

            {/* Filters + job list */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Wrench className="w-4 h-4 text-[#39FF14]" />Job Detail</h3>
                <select value={repFilter} onChange={e => setRepFilter(e.target.value)} className="px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm">
                  <option value="">All reps</option>
                  {data.byRep.map(r => <option key={r.key} value={r.key}>{r.key} ({r.jobs})</option>)}
                </select>
                <div className="inline-flex rounded-lg border border-zinc-800 overflow-hidden">
                  {(['all', 'insurance', 'retail'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setInsuranceOnly(v)}
                      className={`px-3 py-1.5 text-xs ${insuranceOnly === v ? 'bg-[#39FF14]/10 text-[#39FF14]' : 'text-zinc-400 hover:text-white'}`}
                    >
                      {v === 'all' ? 'All' : v === 'insurance' ? 'Insurance' : 'Retail'}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input type="checkbox" checked={problemsOnly} onChange={e => setProblemsOnly(e.target.checked)} className="rounded" />
                  Problems only (90+ unpaid / rework / 5+ trips)
                </label>
                <span className="ml-auto text-xs text-zinc-500">{filteredJobs.length} of {data.jobsAnalyzed}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Job</th>
                      <th className="text-left py-2 px-3 font-medium">Customer</th>
                      <th className="text-left py-2 px-3 font-medium">Rep</th>
                      <th className="text-left py-2 px-3 font-medium">Status</th>
                      <th className="text-left py-2 px-3 font-medium">Carrier</th>
                      <th className="text-right py-2 px-3 font-medium">Resp</th>
                      <th className="text-right py-2 px-3 font-medium">d→ctr</th>
                      <th className="text-right py-2 px-3 font-medium">d→inst</th>
                      <th className="text-right py-2 px-3 font-medium">d→paid</th>
                      <th className="text-right py-2 px-3 font-medium">Trips</th>
                      <th className="text-right py-2 px-3 font-medium">RW</th>
                      <th className="text-right py-2 px-3 font-medium">90+</th>
                      <th className="text-right py-2 px-3 font-medium">Bal $</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filteredJobs.slice(0, 200).map(j => (
                      <tr key={j.jnid} className={`hover:bg-zinc-800/30 ${j.unpaidOver90Days ? 'bg-red-500/5' : ''}`}>
                        <td className="py-2 px-3 font-mono text-xs text-[#39FF14]">{j.number || j.jnid.slice(-6)}</td>
                        <td className="py-2 px-3">{j.customer}</td>
                        <td className="py-2 px-3 text-xs">{j.rep || '—'}</td>
                        <td className="py-2 px-3 text-xs">{j.status}</td>
                        <td className="py-2 px-3 text-xs">{j.carrier || (j.isInsurance ? 'Insurance' : 'Retail')}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-xs">{fmtMin(j.responseMinutes)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-xs">{fmtDays(j.daysToContract)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-xs">{fmtDays(j.daysToInstall)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-xs">{fmtDays(j.daysToPaid)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-xs">{j.tripCount}</td>
                        <td className={`py-2 px-3 text-right tabular-nums text-xs ${j.reworkCount > 0 ? 'text-red-400 font-bold' : 'text-zinc-500'}`}>{j.reworkCount > 0 ? j.reworkCount : '—'}</td>
                        <td className={`py-2 px-3 text-right text-xs ${j.unpaidOver90Days ? 'text-red-400 font-bold' : 'text-zinc-500'}`}>{j.unpaidOver90Days ? '⚠' : '—'}</td>
                        <td className={`py-2 px-3 text-right tabular-nums text-xs ${j.outstandingBalance > 0 ? 'text-amber-300' : 'text-zinc-500'}`}>
                          {j.outstandingBalance > 0 ? fmtMoney(j.outstandingBalance) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredJobs.length > 200 && (
                  <div className="px-3 py-2 text-[10px] text-zinc-500 border-t border-zinc-800">
                    Showing first 200 of {filteredJobs.length}.
                  </div>
                )}
              </div>
            </section>

            {/* Recommendations */}
            <section className="bg-gradient-to-br from-[#39FF14]/10 via-zinc-900 to-zinc-900 border border-[#39FF14]/30 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[#39FF14] uppercase tracking-wide mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Recommendations
              </h3>
              <ul className="text-sm text-zinc-200 space-y-2 list-disc list-inside">
                {data.overall.unpaidOver90Count > 0 && (
                  <li>
                    <strong className="text-red-300">{data.overall.unpaidOver90Count} jobs</strong> are 90+ days from deposit with{' '}
                    <strong className="text-amber-300">{fmtMoney(data.overall.unpaidOver90Total)}</strong> outstanding. Office should chase collections immediately.
                  </li>
                )}
                {data.overall.pctWithRework > 10 && (
                  <li>Rework rate is <strong className="text-amber-300">{data.overall.pctWithRework}%</strong> — above the 10% acceptable threshold. Drill the rep table for repeat offenders.</li>
                )}
                {data.overall.avgTrips > 4 && (
                  <li>Avg trips per job is <strong>{data.overall.avgTrips}</strong>. Above 4 typically signals coordination overhead — investigate whether reps are over-promising site visits.</li>
                )}
                {data.byRep.length > 0 && data.byRep[0].reworkPct > 20 && (
                  <li><strong>{data.byRep[0].key}</strong> has the most volume but a {data.byRep[0].reworkPct}% rework rate — coach or pair.</li>
                )}
                {data.byMethod.length > 0 && (() => {
                  const phone = data.byMethod.find(m => m.key.toLowerCase().includes('phone'));
                  const email = data.byMethod.find(m => m.key.toLowerCase().includes('email'));
                  if (phone && email && phone.medianDaysToContract != null && email.medianDaysToContract != null && phone.medianDaysToContract < email.medianDaysToContract * 0.7) {
                    return <li>Phone-first contact closes in <strong>{phone.medianDaysToContract}d</strong> median vs <strong>{email.medianDaysToContract}d</strong> for email-first — reinforce calling SLA.</li>;
                  }
                  return null;
                })()}
                <li className="text-zinc-400">Cached for 10 min. Hit refresh to re-pull JN.</li>
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Kpi({ label, value, sub, highlight, negative }: { label: string; value: string; sub?: string; highlight?: boolean; negative?: boolean }) {
  return (
    <div className={`rounded-xl p-3 border ${highlight ? 'bg-gradient-to-br from-[#39FF14]/10 to-zinc-900 border-[#39FF14]/30' : 'bg-zinc-900 border-zinc-800'}`}>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`text-xl font-bold mt-1 ${negative ? 'text-red-400' : 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Histogram({ title, data, color }: { title: string; data: Array<{ bucket: string; count: number }>; color: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="bucket" stroke="#71717a" fontSize={10} />
            <YAxis stroke="#71717a" fontSize={11} />
            <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} />
            <Bar dataKey="count" fill={color} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RollupTable({ title, icon: Icon, description, rows }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  rows: RollupRow[];
}) {
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Icon className="w-4 h-4 text-[#39FF14]" />{title}</h3>
        <p className="text-xs text-zinc-500 mt-1">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
            <tr>
              <th className="text-left py-2 px-3 font-medium">Bucket</th>
              <th className="text-right py-2 px-3 font-medium">Jobs</th>
              <th className="text-right py-2 px-3 font-medium">Signed</th>
              <th className="text-right py-2 px-3 font-medium">Installed</th>
              <th className="text-right py-2 px-3 font-medium">Paid</th>
              <th className="text-right py-2 px-3 font-medium">Resp (median)</th>
              <th className="text-right py-2 px-3 font-medium">d→ctr</th>
              <th className="text-right py-2 px-3 font-medium">d→inst</th>
              <th className="text-right py-2 px-3 font-medium">d→paid</th>
              <th className="text-right py-2 px-3 font-medium">Avg trips</th>
              <th className="text-right py-2 px-3 font-medium">Rework %</th>
              <th className="text-right py-2 px-3 font-medium">90+ unpaid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {rows.length === 0 && <tr><td colSpan={12} className="py-6 text-center text-zinc-500">No data.</td></tr>}
            {rows.map(r => (
              <tr key={r.key} className="hover:bg-zinc-800/30">
                <td className="py-2 px-3 font-medium">{r.key}</td>
                <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{r.jobs}</td>
                <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{r.signed}</td>
                <td className="py-2 px-3 text-right tabular-nums text-zinc-300">{r.installed}</td>
                <td className="py-2 px-3 text-right tabular-nums text-amber-300">{r.paid}</td>
                <td className="py-2 px-3 text-right tabular-nums text-xs">{r.medianResponseMin != null ? `${r.medianResponseMin}m` : '—'}</td>
                <td className="py-2 px-3 text-right tabular-nums text-xs">{r.medianDaysToContract != null ? `${r.medianDaysToContract}d` : '—'}</td>
                <td className="py-2 px-3 text-right tabular-nums text-xs">{r.medianDaysToInstall != null ? `${r.medianDaysToInstall}d` : '—'}</td>
                <td className="py-2 px-3 text-right tabular-nums text-xs">{r.medianDaysToPaid != null ? `${r.medianDaysToPaid}d` : '—'}</td>
                <td className="py-2 px-3 text-right tabular-nums">{r.avgTrips}</td>
                <td className={`py-2 px-3 text-right tabular-nums ${r.reworkPct > 10 ? 'text-red-400' : ''}`}>{r.reworkPct}%</td>
                <td className={`py-2 px-3 text-right tabular-nums ${r.unpaidOver90 > 0 ? 'text-red-400 font-bold' : 'text-zinc-500'}`}>{r.unpaidOver90}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
