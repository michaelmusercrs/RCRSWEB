'use client';

/**
 * Chris View — Insurance Deep Dive (Phase 4).
 *
 * Per-carrier and per-adjuster breakdown for jobs flagged as insurance
 * claims in JN: RCV / ACV / deductible averages, close rate, approval
 * rate, average days from signed to adjuster approval.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Shield, ArrowLeft, Loader2, RefreshCw, User, Briefcase, Clock,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';

interface Carrier {
  carrier: string;
  count: number;
  signedCount: number;
  approvedCount: number;
  closeRate: number;
  approvalRate: number;
  avgRCV: number;
  avgACV: number;
  avgDeductible: number;
  avgDaysToApprove: number | null;
}

interface Adjuster {
  adjuster: string;
  count: number;
  approvedCount: number;
  approvalRate: number;
  avgDaysToApprove: number | null;
  carriers: string[];
}

interface Job {
  jnid: string;
  number: string;
  carrier: string;
  claim: string;
  adjuster: string;
  rep: string;
  rcv: number | null;
  acv: number | null;
  deductible: number | null;
  status: string;
  daysToApprove: number | null;
  signed: boolean;
  approved: boolean;
  supplementCount: number;
}

interface Data {
  generatedAt: string;
  daysQueried: number;
  totalInsuranceJobs: number;
  jobs: Job[];
  byCarrier: Carrier[];
  byAdjuster: Adjuster[];
  totals: { rcv: number; acv: number; deductible: number };
  meta: { queryTimeMs: number; jobsFetched: number; activitiesFetched: number };
}

function fmtMoney(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}
function fmtMoneyExact(n: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function InsurancePage() {
  const [days, setDays] = useState(180);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [carrierFilter, setCarrierFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/chrisview-insurance?days=${days}`);
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

  const filteredJobs = data?.jobs.filter(j => !carrierFilter || j.carrier === carrierFilter) || [];

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#39FF14]" />
            Insurance Job Deep Dive
          </h1>
          <div className="ml-auto flex items-center gap-2">
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
            Querying JobNimbus jobs… (first load 30-90s, cached 10 min)
          </div>
        )}
        {data && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Insurance jobs" value={data.totalInsuranceJobs.toString()} sub={`last ${data.daysQueried} days`} highlight />
              <Kpi label="Total RCV" value={fmtMoney(data.totals.rcv)} sub={fmtMoneyExact(data.totals.rcv)} />
              <Kpi label="Total ACV" value={fmtMoney(data.totals.acv)} sub={fmtMoneyExact(data.totals.acv)} />
              <Kpi label="Total deductibles" value={fmtMoney(data.totals.deductible)} />
            </section>

            {/* By carrier */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Briefcase className="w-4 h-4 text-[#39FF14]" />By Carrier</h3>
                <p className="text-xs text-zinc-500 mt-1">Click a row to filter the job list below.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Carrier</th>
                      <th className="text-right py-2 px-3 font-medium">Jobs</th>
                      <th className="text-right py-2 px-3 font-medium">Signed</th>
                      <th className="text-right py-2 px-3 font-medium">Close %</th>
                      <th className="text-right py-2 px-3 font-medium">Approved</th>
                      <th className="text-right py-2 px-3 font-medium">Approval %</th>
                      <th className="text-right py-2 px-3 font-medium">Avg RCV</th>
                      <th className="text-right py-2 px-3 font-medium">Avg ACV</th>
                      <th className="text-right py-2 px-3 font-medium">Avg Deductible</th>
                      <th className="text-right py-2 px-3 font-medium">Avg Days to Approve</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.byCarrier.map(c => (
                      <tr
                        key={c.carrier}
                        onClick={() => setCarrierFilter(carrierFilter === c.carrier ? '' : c.carrier)}
                        className={`hover:bg-zinc-800/30 cursor-pointer ${carrierFilter === c.carrier ? 'bg-[#39FF14]/5' : ''}`}
                      >
                        <td className="py-2 px-3 font-medium">{c.carrier}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{c.count}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{c.signedCount}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{c.closeRate}%</td>
                        <td className="py-2 px-3 text-right tabular-nums text-amber-300">{c.approvedCount}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{c.approvalRate}%</td>
                        <td className="py-2 px-3 text-right tabular-nums">{fmtMoneyExact(c.avgRCV)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{fmtMoneyExact(c.avgACV)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{fmtMoneyExact(c.avgDeductible)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{c.avgDaysToApprove != null ? `${c.avgDaysToApprove}d` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* By adjuster */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold flex items-center gap-2"><User className="w-4 h-4 text-[#39FF14]" />By Adjuster</h3>
                <p className="text-xs text-zinc-500 mt-1">Which adjusters approve fastest / most.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Adjuster</th>
                      <th className="text-right py-2 px-3 font-medium">Jobs</th>
                      <th className="text-right py-2 px-3 font-medium">Approved</th>
                      <th className="text-right py-2 px-3 font-medium">Approval %</th>
                      <th className="text-right py-2 px-3 font-medium">Avg Days</th>
                      <th className="text-left py-2 px-3 font-medium">Carriers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.byAdjuster.slice(0, 30).map(a => (
                      <tr key={a.adjuster} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-medium">{a.adjuster}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{a.count}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{a.approvedCount}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{a.approvalRate}%</td>
                        <td className="py-2 px-3 text-right tabular-nums">{a.avgDaysToApprove != null ? `${a.avgDaysToApprove}d` : '—'}</td>
                        <td className="py-2 px-3 text-xs text-zinc-400">{a.carriers.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Jobs list */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-[#39FF14]" />
                  Jobs {carrierFilter && <span className="text-zinc-400">— filtered to {carrierFilter}</span>}
                </h3>
                {carrierFilter && (
                  <button onClick={() => setCarrierFilter('')} className="text-xs text-zinc-400 hover:text-white">Clear filter</button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Job</th>
                      <th className="text-left py-2 px-3 font-medium">Carrier</th>
                      <th className="text-left py-2 px-3 font-medium">Claim #</th>
                      <th className="text-left py-2 px-3 font-medium">Adjuster</th>
                      <th className="text-left py-2 px-3 font-medium">Rep</th>
                      <th className="text-left py-2 px-3 font-medium">Status</th>
                      <th className="text-right py-2 px-3 font-medium">RCV</th>
                      <th className="text-right py-2 px-3 font-medium">ACV</th>
                      <th className="text-right py-2 px-3 font-medium">Deductible</th>
                      <th className="text-right py-2 px-3 font-medium">Days→Approve</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filteredJobs.length === 0 ? (
                      <tr><td colSpan={10} className="py-6 text-center text-zinc-500">No insurance jobs in this window.</td></tr>
                    ) : filteredJobs.slice(0, 100).map(j => (
                      <tr key={j.jnid} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-mono text-xs text-[#39FF14]">{j.number}</td>
                        <td className="py-2 px-3">{j.carrier}</td>
                        <td className="py-2 px-3 font-mono text-xs text-zinc-400">{j.claim || '—'}</td>
                        <td className="py-2 px-3 text-xs">{j.adjuster}</td>
                        <td className="py-2 px-3 text-xs text-zinc-400">{j.rep || '—'}</td>
                        <td className="py-2 px-3 text-xs">
                          <span className={j.approved ? 'text-[#39FF14]' : j.signed ? 'text-amber-300' : 'text-zinc-400'}>{j.status}</span>
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">{fmtMoneyExact(j.rcv)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{fmtMoneyExact(j.acv)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{fmtMoneyExact(j.deductible)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{j.daysToApprove != null ? `${j.daysToApprove}d` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredJobs.length > 100 && (
                  <div className="px-3 py-2 text-[10px] text-zinc-500 border-t border-zinc-800">
                    Showing first 100 of {filteredJobs.length} matching jobs.
                  </div>
                )}
              </div>
            </section>
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
