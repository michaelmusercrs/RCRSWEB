'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, ArrowLeft, Loader2, RefreshCw, TrendingUp, AlertTriangle,
} from 'lucide-react';
import AboutThisData from '@/components/AboutThisData';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';

interface SourceRow {
  source: string;
  isOrganic: boolean;
  leads: number;
  customers: number;
  conversionRate: number;
  spend: number;
  cac: number | null;
  revenue: number;
  ltv: number | null;
  ltvToCacRatio: number | null;
  paybackMonths: number | null;
  isHealthy: boolean | null;
  spendKeys: string[];
}

interface Data {
  generatedAt: string;
  daysQueried: number;
  totals: {
    adSpend: number;
    adSpendAll: number;
    leads: number;
    customers: number;
    revenue: number;
    blendedCac: number | null;
    blendedLtv: number | null;
    blendedRatio: number | null;
  };
  bySource: SourceRow[];
  unmatchedLeads: { count: number; sampleSources: Array<{ source: string; count: number }> };
  unmatchedSpend: { total: number; keys: Array<{ key: string; amount: number }> };
  meta: {
    queryTimeMs: number;
    contactsFetched: number;
    contactsInWindow: number;
    ltvCustomersPool: number;
    matchedLtvCustomers: number;
    spendIsLifetime: boolean;
  };
}

function fmtMoney(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}
function fmtMoneyExact(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function ratioColor(r: number | null): string {
  if (r == null) return '#71717a';
  if (r >= 5) return '#39FF14';
  if (r >= 3) return '#a3e635';
  if (r >= 1) return '#fbbf24';
  return '#ef4444';
}

export default function CacPage() {
  const [days, setDays] = useState(365);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/chrisview-cac?days=${days}`);
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || `HTTP ${res.status}`); }
      setData(await res.json());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Only chart paid channels with actual spend, sorted by CAC asc (cheaper = better)
  const cacChartData = data
    ? data.bySource
        .filter(r => r.spend > 0 && r.cac != null)
        .sort((a, b) => (a.cac || 0) - (b.cac || 0))
    : [];

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#39FF14]" />Customer Acquisition Cost per Source
          </h1>
          <div className="ml-auto flex items-center gap-2">
            {[90, 180, 365, 730].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${days === d ? 'bg-[#39FF14]/10 border-[#39FF14]/40 text-[#39FF14]' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'}`}
              >
                {d}d
              </button>
            ))}
            <button onClick={fetchData} disabled={loading} className="p-1.5 text-zinc-400 hover:text-white rounded disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{err}</div>
        )}
        {!data && loading && (
          <div className="text-center py-16 text-zinc-500"><Loader2 className="w-6 h-6 animate-spin inline mr-2" />Pulling JN contacts &amp; crunching ad-spend…</div>
        )}

        {data && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi
                label="Lifetime ad spend"
                value={fmtMoney(data.totals.adSpend)}
                sub={`paid channels only (of ${fmtMoney(data.totals.adSpendAll)} total)`}
                highlight
              />
              <Kpi
                label="Customers from paid"
                value={data.totals.customers.toLocaleString()}
                sub={`${data.totals.leads.toLocaleString()} leads in last ${data.daysQueried}d`}
              />
              <Kpi
                label="Blended CAC"
                value={data.totals.blendedCac != null ? fmtMoneyExact(data.totals.blendedCac) : '—'}
                sub="paid spend ÷ paid customers"
              />
              <Kpi
                label="Blended LTV : CAC"
                value={data.totals.blendedRatio != null ? `${data.totals.blendedRatio.toFixed(2)}:1` : '—'}
                sub={data.totals.blendedRatio != null && data.totals.blendedRatio >= 3 ? 'healthy (>= 3:1)' : 'below 3:1 minimum'}
              />
            </section>

            {data.totals.blendedRatio != null && data.totals.blendedRatio < 3 && (
              <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded flex items-start gap-2 text-amber-300 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Blended LTV:CAC is below the 3:1 industry minimum.</strong> Each customer
                  acquired through paid channels is returning less than 3× what they cost to acquire.
                  Spot the worst offenders in the table below.
                </div>
              </div>
            )}

            {cacChartData.length > 0 && (
              <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#39FF14]" />
                  CAC per Paid Channel (lower is better)
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cacChartData} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 130 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis type="number" stroke="#71717a" fontSize={10} tickFormatter={(v: number) => fmtMoney(v)} />
                      <YAxis type="category" dataKey="source" stroke="#71717a" fontSize={11} width={130} />
                      <Tooltip
                        contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                        formatter={(v: number | undefined) => v != null ? fmtMoneyExact(v) : '—'}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Bar dataKey="cac" name="cac">
                        {cacChartData.map((r, i) => (
                          <Cell key={i} fill={ratioColor(r.ltvToCacRatio)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-[10px] text-zinc-500">
                  Bar color = LTV:CAC ratio. Green &gt;= 5:1, lime 3–5, amber 1–3, red &lt; 1:1.
                </p>
              </section>
            )}

            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold">By Source</h3>
                <span className="text-[10px] text-zinc-500">
                  Rows highlighted red = LTV:CAC below 3:1 (industry minimum).
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Source</th>
                      <th className="text-right py-2 px-3 font-medium">Spend (lifetime)</th>
                      <th className="text-right py-2 px-3 font-medium">Leads</th>
                      <th className="text-right py-2 px-3 font-medium">Customers</th>
                      <th className="text-right py-2 px-3 font-medium">Conv %</th>
                      <th className="text-right py-2 px-3 font-medium">CAC</th>
                      <th className="text-right py-2 px-3 font-medium">LTV</th>
                      <th className="text-right py-2 px-3 font-medium">LTV : CAC</th>
                      <th className="text-right py-2 px-3 font-medium">Payback (mo)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.bySource.map(r => {
                      const unhealthy = r.isHealthy === false;
                      return (
                        <tr key={r.source} className={`hover:bg-zinc-800/30 ${unhealthy ? 'bg-red-500/[0.04]' : ''}`}>
                          <td className="py-2 px-3 font-medium">
                            {r.source}
                            {r.isOrganic && <span className="ml-2 text-[10px] text-zinc-500 uppercase font-mono">organic</span>}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-zinc-400">
                            {r.spend > 0 ? fmtMoneyExact(r.spend) : <span className="text-zinc-700">$0</span>}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-zinc-300">{r.leads}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{r.customers}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{r.conversionRate}%</td>
                          <td className="py-2 px-3 text-right tabular-nums font-medium">
                            {r.cac != null ? (r.cac === 0 ? <span className="text-[#39FF14]">FREE</span> : fmtMoneyExact(r.cac)) : <span className="text-zinc-700">—</span>}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-zinc-300">
                            {r.ltv != null ? fmtMoneyExact(r.ltv) : <span className="text-zinc-700">—</span>}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold" style={{ color: ratioColor(r.ltvToCacRatio) }}>
                            {r.ltvToCacRatio != null ? `${r.ltvToCacRatio.toFixed(2)}:1` : (r.cac === 0 && r.ltv != null ? <span className="text-[#39FF14]">∞</span> : <span className="text-zinc-700">—</span>)}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-xs text-zinc-400">
                            {r.paybackMonths != null ? (r.paybackMonths === 0 ? '0' : `${r.paybackMonths}`) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {(data.unmatchedLeads.count > 0 || data.unmatchedSpend.total > 0) && (
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.unmatchedLeads.count > 0 && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      Unmatched Leads <span className="text-zinc-500 font-normal">({data.unmatchedLeads.count})</span>
                    </h3>
                    <p className="text-xs text-zinc-400 mb-3">
                      Source name from JN didn&apos;t map to a known channel bucket. Either the
                      source field was blank or the value is something we haven&apos;t added a rule
                      for. Top values:
                    </p>
                    <ul className="text-xs space-y-1">
                      {data.unmatchedLeads.sampleSources.map(s => (
                        <li key={s.source} className="flex items-center justify-between text-zinc-300">
                          <span className="truncate pr-2">{s.source}</span>
                          <span className="text-zinc-500 tabular-nums">{s.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {data.unmatchedSpend.total > 0 && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      Unmatched Spend <span className="text-zinc-500 font-normal">({fmtMoneyExact(data.unmatchedSpend.total)})</span>
                    </h3>
                    <p className="text-xs text-zinc-400 mb-3">
                      QB advertisingMarketing lines not attributed to any channel bucket
                      (e.g. general overhead, web hosting, business cards). These dilute
                      blended CAC if you fold them in.
                    </p>
                    <ul className="text-xs space-y-1">
                      {data.unmatchedSpend.keys.map(k => (
                        <li key={k.key} className="flex items-center justify-between text-zinc-300">
                          <span className="font-mono">{k.key}</span>
                          <span className="text-zinc-500 tabular-nums">{fmtMoneyExact(k.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}
          </>
        )}

        <AboutThisData
          source="Ad spend: data/company-overview.json → expenses.advertisingMarketing (lifetime QB totals through report date). Leads: JN /contacts pulled live for the selected day-window, bucketed by source_name. Customers/revenue: data/customer-ltv.json (allCustomers = full QB book of 3,194 customers). Sheet-cached under tab chrisview_cache row 'cac'."
          method="For each JN contact in the window, we route source_name through SOURCE_BUCKET_MAP (substring rules) to land on a canonical bucket (Google, Facebook/Meta, BNI, Home Shows, WAFF, WHNT, etc.). The contact's display_name is then normalized (strip 'R#####', drop parentheticals + business suffixes, lowercase) and looked up against the LTV book — a match means they became a paying customer. Per bucket: spend = sum of matching QB line items; CAC = spend ÷ customers; LTV = matched-customer revenue ÷ customers; ratio = LTV ÷ CAC. Payback months = CAC ÷ (LTV ÷ avg months-as-customer). Rows below 3:1 are flagged."
          uses="Spot the channels that earn back what they cost. Google + Home Shows are the biggest single line-item spends — confirm they're producing customers, not just leads. BNI ROI: is the $20K paying for itself? Organic channels (Referral, Repeat, Insurance/Agent) show $0 CAC by design — they are NOT free to support but they ARE free to acquire, which is the real lesson."
          gaps="Ad spend is LIFETIME (since QB opened), but the lead pull is windowed (default 365d). Cross-channel COMPARISON is honest; absolute payback math is biased — older spend keeps inflating CAC. To switch to a per-period number, route a QB transactions sweep tagged 'Advertising/Marketing' through this lib instead. Source name matching is substring-based — anything we haven't added a rule for falls into Unmatched Leads (visible below). Customer match relies on JN display_name matching the QB customer string; mismatched names will undercount conversions. BCM / Rudy's / Roof Angel are intentionally NOT bucketed — they're rep LLCs, not channels."
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
