'use client';

/**
 * Chris View — Referral Network Graph.
 *
 * Surfaces who's sending leads. KPI strip up top, source-bucket bar chart,
 * per-rep referral haul, and the top-referrer person table. Honest about
 * the slice of referrals where no name could be extracted from the data.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Network, ArrowLeft, Loader2, RefreshCw, Users, UserCheck, AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';

interface RepReferralRow {
  rep: string;
  totalLeads: number;
  referralLeads: number;
  referralPct: number;
  signedReferrals: number;
  referralRevenue: number;
}

interface TopReferrerRow {
  name: string;
  leadsReferred: number;
  signed: number;
  totalRevenue: number;
  mostRecentLeadDate: string | null;
}

interface SourceBreakdownRow {
  source: string;
  leads: number;
  signed: number;
  closeRate: number;
}

interface Data {
  generatedAt: string;
  daysQueried: number;
  totalLeads: number;
  referralLeads: number;
  referralPct: number;
  unmatchedReferrerCount: number;
  byRep: RepReferralRow[];
  topReferrers: TopReferrerRow[];
  sourceBreakdown: SourceBreakdownRow[];
  meta: { queryTimeMs: number; contactsFetched: number; jobsFetched: number };
}

function fmtMoney(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function rateColor(r: number) {
  if (r >= 50) return '#39FF14';
  if (r >= 30) return '#fbbf24';
  if (r >= 15) return '#fb7185';
  return '#ef4444';
}

function bucketColor(source: string) {
  switch (source) {
    case 'Explicit Referral':  return '#39FF14';
    case 'Customer Referral':  return '#22d3ee';
    case 'Person Name':        return '#a78bfa';
    case 'BNI / Networking':   return '#fbbf24';
    case 'Referred-by Note':   return '#fb7185';
    default:                   return '#71717a';
  }
}

export default function ReferralNetworkPage() {
  const [days, setDays] = useState(365);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/chrisview-referral-network?days=${days}`);
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

  const topReferrerName = data && data.topReferrers.length > 0 ? data.topReferrers[0].name : '—';

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Network className="w-5 h-5 text-[#39FF14]" />Referral Network
          </h1>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {[90, 180, 365, 730].map(d => (
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
            Walking JN contacts + jobs to find referral relationships…
          </div>
        )}
        {data && (
          <>
            {/* KPI strip */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Total leads" value={data.totalLeads.toString()} sub={`last ${data.daysQueried}d`} />
              <Kpi label="Referral leads" value={data.referralLeads.toString()} highlight />
              <Kpi
                label="Referral %"
                value={`${data.referralPct}%`}
                sub={data.referralPct >= 20 ? 'healthy network' : data.referralPct >= 10 ? 'modest' : 'thin'}
              />
              <Kpi label="Top referrer" value={topReferrerName} sub={topReferrerName !== '—' ? `${data.topReferrers[0].leadsReferred} leads sent` : undefined} />
            </section>

            {/* Honesty banner */}
            {data.unmatchedReferrerCount > 0 && (
              <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded text-amber-200 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>{data.unmatchedReferrerCount}</strong> referral-tagged leads couldn&apos;t be attributed to a specific person — the
                  source said &quot;Referral&quot; / &quot;Customer Referral&quot; but no <em>referred by NAME</em> note was attached. Ask reps
                  to capture the referrer in the customer description so they can be credited.
                </div>
              </div>
            )}

            {/* Source bucket chart */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Referral Sources — Leads &amp; Signed</h3>
              <p className="text-xs text-zinc-500 mb-3">
                Buckets ranked from most-explicit (a source literally tagged &quot;Referral&quot;) to softest (a name dug out of the
                &quot;referred by&quot; note). Bar color matches the source type; opacity reflects close rate.
              </p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.sourceBreakdown} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="source" stroke="#71717a" fontSize={10} interval={0} angle={-15} textAnchor="end" height={60} />
                    <YAxis stroke="#71717a" fontSize={10} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} />
                    <Bar dataKey="leads" name="Leads">
                      {data.sourceBreakdown.map((r, i) => (
                        <Cell key={`l-${i}`} fill={bucketColor(r.source)} fillOpacity={0.5} />
                      ))}
                    </Bar>
                    <Bar dataKey="signed" name="Signed">
                      {data.sourceBreakdown.map((r, i) => (
                        <Cell key={`s-${i}`} fill={bucketColor(r.source)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Source bucket</th>
                      <th className="text-right py-2 px-3 font-medium">Leads</th>
                      <th className="text-right py-2 px-3 font-medium">Signed</th>
                      <th className="text-right py-2 px-3 font-medium">Close %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.sourceBreakdown.length === 0 && (
                      <tr><td colSpan={4} className="py-4 text-center text-zinc-500">No referral-tagged leads in this window.</td></tr>
                    )}
                    {data.sourceBreakdown.map(r => (
                      <tr key={r.source} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-medium flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: bucketColor(r.source) }} />
                          {r.source}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{r.leads}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{r.signed}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-bold" style={{ color: rateColor(r.closeRate) }}>{r.closeRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Per-rep referral haul */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#39FF14]" />Per-Rep Referral Haul
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  How many of each rep&apos;s leads came through a referral channel, what closed, and the revenue that
                  came back. Reps with high referral % typically have a tight book of past customers.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Rep</th>
                      <th className="text-right py-2 px-3 font-medium">Total leads</th>
                      <th className="text-right py-2 px-3 font-medium">Referral leads</th>
                      <th className="text-right py-2 px-3 font-medium">Referral %</th>
                      <th className="text-right py-2 px-3 font-medium">Signed referrals</th>
                      <th className="text-right py-2 px-3 font-medium">Referral revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.byRep.length === 0 && (
                      <tr><td colSpan={6} className="py-6 text-center text-zinc-500">No reps with leads in this window.</td></tr>
                    )}
                    {data.byRep.map(r => (
                      <tr key={r.rep} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-medium">{r.rep}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{r.totalLeads}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-300">{r.referralLeads}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-bold" style={{ color: rateColor(r.referralPct) }}>{r.referralPct}%</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{r.signedReferrals}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-amber-300">
                          {r.referralRevenue > 0 ? fmtMoney(r.referralRevenue) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Top referrer people */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#39FF14]" />Top Referrer People
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Network nodes — past customers and acquaintances who keep sending business our way. Ranked by revenue
                  produced, then signed count. These are the people to call when you want a thank-you gift to pay off again.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Referrer</th>
                      <th className="text-right py-2 px-3 font-medium">Leads sent</th>
                      <th className="text-right py-2 px-3 font-medium">Signed</th>
                      <th className="text-right py-2 px-3 font-medium">Close %</th>
                      <th className="text-right py-2 px-3 font-medium">Revenue</th>
                      <th className="text-right py-2 px-3 font-medium">Most recent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.topReferrers.length === 0 && (
                      <tr><td colSpan={6} className="py-6 text-center text-zinc-500">No referrer names extractable in this window.</td></tr>
                    )}
                    {data.topReferrers.slice(0, 50).map(r => {
                      const close = r.leadsReferred > 0 ? Math.round((r.signed / r.leadsReferred) * 1000) / 10 : 0;
                      return (
                        <tr key={r.name} className="hover:bg-zinc-800/30">
                          <td className="py-2 px-3 font-medium">{r.name}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{r.leadsReferred}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{r.signed}</td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold" style={{ color: rateColor(close) }}>{close}%</td>
                          <td className="py-2 px-3 text-right tabular-nums text-amber-300">
                            {r.totalRevenue > 0 ? fmtMoney(r.totalRevenue) : '—'}
                          </td>
                          <td className="py-2 px-3 text-right text-xs text-zinc-500">{r.mostRecentLeadDate || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {data.topReferrers.length > 50 && (
                  <div className="px-3 py-2 text-[10px] text-zinc-500 border-t border-zinc-800">
                    Showing top 50 of {data.topReferrers.length} extractable referrer names.
                  </div>
                )}
              </div>
            </section>

            <div className="text-xs text-zinc-500">
              Generated {data.generatedAt} · {data.meta.contactsFetched} contacts + {data.meta.jobsFetched} jobs scanned in {(data.meta.queryTimeMs / 1000).toFixed(1)}s.
              Cached 10 min in memory; sheet cache refreshed hourly.
            </div>
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
      <div className="text-xl font-bold text-white mt-1 truncate" title={value}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}
