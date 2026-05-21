'use client';

import { useState, useEffect } from 'react';
import { Shield, ShoppingBag, ArrowLeft, Loader2, AlertTriangle, Repeat } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';

interface SegmentTotals {
  customers: number;
  revenue: number;
  repeatCustomers: number;
  repeatRate: number;
  avgLTV: number;
}

interface CohortRow {
  year: string;
  segment: 'insurance' | 'retail' | 'unknown';
  newCustomers: number;
  repeatCount: number;
  repeatPct: number;
  revenue: number;
}

interface SegCust {
  customer: string;
  total: number;
  invoiceCount: number;
  firstDate: string;
  lastDate: string;
  daysAsCustomer: number;
  avgInvoice: number;
  recentInvoices: number;
  isRepeat: boolean;
  reps: string[];
  segment: 'insurance' | 'retail' | 'unknown';
  matchedJnid: string | null;
}

interface Data {
  generatedAt: string;
  totals: { insurance: SegmentTotals; retail: SegmentTotals; unknown: SegmentTotals };
  cohortsBySegment: CohortRow[];
  topByInsurance: SegCust[];
  topByRetail: SegCust[];
  meta: {
    workingPoolSize: number;
    totalCustomersInQB: number;
    coverageOfQB: number;
    jnContactsFetched: number;
    jnJobsFetched: number;
    matchedCount: number;
    matchRatePct: number;
    queryTimeMs: number;
  };
}

function fmtMoney(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(1)}K`;
  return `$${abs.toFixed(0)}`;
}
function fmtMoneyExact(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function SegmentedLTVPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/chrisview-segmented-ltv');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Coverage flags - the JSON only ships top-100s, so workingPool vs full
  // QB count is the upstream-data ceiling. matchRate is the JN-side ceiling.
  const lowCoverage = data ? data.meta.coverageOfQB < 70 : false;
  const lowMatchRate = data ? data.meta.matchRatePct < 70 : false;

  const segmentChartData = data ? [
    {
      segment: 'Insurance',
      customers: data.totals.insurance.customers,
      avgLTV: data.totals.insurance.avgLTV,
      repeatRate: data.totals.insurance.repeatRate,
      revenue: data.totals.insurance.revenue,
      color: '#60a5fa',
    },
    {
      segment: 'Retail',
      customers: data.totals.retail.customers,
      avgLTV: data.totals.retail.avgLTV,
      repeatRate: data.totals.retail.repeatRate,
      revenue: data.totals.retail.revenue,
      color: '#39FF14',
    },
    {
      segment: 'Unknown',
      customers: data.totals.unknown.customers,
      avgLTV: data.totals.unknown.avgLTV,
      repeatRate: data.totals.unknown.repeatRate,
      revenue: data.totals.unknown.revenue,
      color: '#71717a',
    },
  ] : [];

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#39FF14]" />Segmented LTV - Insurance vs Retail
          </h1>
          {data && (
            <span className="ml-auto text-xs text-zinc-500">
              Generated {data.generatedAt} - {data.meta.queryTimeMs}ms
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
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading - JN job/contact walk can take 30-60s on cold cache...
          </div>
        )}

        {data && (
          <>
            {/* Data-coverage callout */}
            {(lowCoverage || lowMatchRate) && (
              <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded text-amber-200 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold mb-1">Read with caution - data coverage is partial</div>
                  <ul className="list-disc list-inside text-xs text-amber-100/80 space-y-0.5">
                    {lowCoverage && (
                      <li>
                        customer-ltv.json only ships {data.meta.workingPoolSize} customers (top-100 by lifetime + top repeats + recent).
                        That is {data.meta.coverageOfQB}% of all {data.meta.totalCustomersInQB.toLocaleString()} QB customers - smaller customers are NOT in this view.
                      </li>
                    )}
                    {lowMatchRate && (
                      <li>
                        Only {data.meta.matchedCount} of {data.meta.workingPoolSize} ({data.meta.matchRatePct}%) customer names could be matched
                        to a JN contact. The rest land in &quot;Unknown segment&quot; - they have QB invoices but no JN contact with a normalized-name match.
                      </li>
                    )}
                    <li>
                      Segment totals reflect the working pool, not the full book. Use the cohort comparison and top-customer tables for direction,
                      not absolute counts.
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* KPI grid */}
            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Kpi
                label="Insurance customers"
                value={data.totals.insurance.customers.toLocaleString()}
                sub={`${fmtMoney(data.totals.insurance.revenue)} lifetime`}
                color="#60a5fa"
                icon={<Shield className="w-3.5 h-3.5" />}
              />
              <Kpi
                label="Insurance avg LTV"
                value={fmtMoney(data.totals.insurance.avgLTV)}
                sub={`${data.totals.insurance.repeatRate}% repeat rate`}
                color="#60a5fa"
              />
              <Kpi
                label="Insurance revenue"
                value={fmtMoney(data.totals.insurance.revenue)}
                sub={`${data.totals.insurance.repeatCustomers} repeats`}
                color="#60a5fa"
              />
              <Kpi
                label="Retail customers"
                value={data.totals.retail.customers.toLocaleString()}
                sub={`${fmtMoney(data.totals.retail.revenue)} lifetime`}
                color="#39FF14"
                icon={<ShoppingBag className="w-3.5 h-3.5" />}
                highlight
              />
              <Kpi
                label="Retail avg LTV"
                value={fmtMoney(data.totals.retail.avgLTV)}
                sub={`${data.totals.retail.repeatRate}% repeat rate`}
                color="#39FF14"
              />
              <Kpi
                label="Retail revenue"
                value={fmtMoney(data.totals.retail.revenue)}
                sub={`${data.totals.retail.repeatCustomers} repeats`}
                color="#39FF14"
              />
            </section>

            {/* Segment comparison bar chart */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Segment Comparison</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <SegmentChart title="Customer count" data={segmentChartData} dataKey="customers" fmt={n => n.toLocaleString()} />
                <SegmentChart title="Avg LTV ($)" data={segmentChartData} dataKey="avgLTV" fmt={n => fmtMoney(Number(n))} />
                <SegmentChart title="Repeat rate (%)" data={segmentChartData} dataKey="repeatRate" fmt={n => `${n}%`} />
              </div>
            </section>

            {/* Cohorts by segment */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Cohorts by First-Invoice Year & Segment</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Year</th>
                      <th className="text-left py-2 px-3 font-medium">Segment</th>
                      <th className="text-right py-2 px-3 font-medium">New customers</th>
                      <th className="text-right py-2 px-3 font-medium">Became repeat</th>
                      <th className="text-right py-2 px-3 font-medium">Repeat %</th>
                      <th className="text-right py-2 px-3 font-medium">Cohort revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.cohortsBySegment.map((c, i) => (
                      <tr key={`${c.year}-${c.segment}-${i}`} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-mono text-xs text-zinc-300">{c.year}</td>
                        <td className="py-2 px-3">
                          <SegmentBadge segment={c.segment} />
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-300">{c.newCustomers}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{c.repeatCount}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-amber-300">{c.repeatPct}%</td>
                        <td className="py-2 px-3 text-right tabular-nums">{fmtMoney(c.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Top tables side-by-side */}
            <section className="grid lg:grid-cols-2 gap-4">
              <TopTable
                title="Top 20 Insurance Customers"
                icon={<Shield className="w-4 h-4 text-[#60a5fa]" />}
                rows={data.topByInsurance}
                accent="#60a5fa"
              />
              <TopTable
                title="Top 20 Retail Customers"
                icon={<ShoppingBag className="w-4 h-4 text-[#39FF14]" />}
                rows={data.topByRetail}
                accent="#39FF14"
              />
            </section>

            {/* Meta footer */}
            <section className="text-xs text-zinc-600 px-2">
              Working pool {data.meta.workingPoolSize.toLocaleString()} customers from customer-ltv.json
              ({data.meta.coverageOfQB}% of {data.meta.totalCustomersInQB.toLocaleString()} QB customers).
              Pulled {data.meta.jnContactsFetched.toLocaleString()} JN contacts + {data.meta.jnJobsFetched.toLocaleString()} JN jobs.
              Name-match rate {data.meta.matchRatePct}% ({data.meta.matchedCount}/{data.meta.workingPoolSize}).
              Unmatched customers land in &quot;Unknown segment&quot; rather than guessed.
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Kpi({
  label, value, sub, color, icon, highlight,
}: {
  label: string; value: string; sub?: string; color?: string;
  icon?: React.ReactNode; highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 border ${highlight
        ? 'bg-gradient-to-br from-[#39FF14]/10 to-zinc-900 border-[#39FF14]/30'
        : 'bg-zinc-900 border-zinc-800'}`}
    >
      <div className="text-[10px] uppercase tracking-wide text-zinc-500 flex items-center gap-1">
        {icon}{label}
      </div>
      <div className="text-xl font-bold mt-1" style={{ color: color || '#fff' }}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function SegmentChart({
  title, data, dataKey, fmt,
}: {
  title: string;
  data: Array<{ segment: string; color: string; [k: string]: string | number }>;
  dataKey: string;
  fmt: (n: number | string) => string;
}) {
  return (
    <div>
      <div className="text-xs text-zinc-500 mb-2">{title}</div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="segment" stroke="#71717a" fontSize={11} />
            <YAxis stroke="#71717a" fontSize={11} tickFormatter={v => fmt(v)} />
            <Tooltip
              contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
              formatter={(value) => fmt((value ?? 0) as number | string)}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey={dataKey} name={title}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SegmentBadge({ segment }: { segment: 'insurance' | 'retail' | 'unknown' }) {
  if (segment === 'insurance') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#60a5fa]/10 text-[#60a5fa] border border-[#60a5fa]/30">
        <Shield className="w-3 h-3" />insurance
      </span>
    );
  }
  if (segment === 'retail') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30">
        <ShoppingBag className="w-3 h-3" />retail
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-zinc-700/30 text-zinc-400 border border-zinc-700">
      unknown
    </span>
  );
}

function TopTable({
  title, icon, rows, accent,
}: {
  title: string; icon: React.ReactNode; rows: SegCust[]; accent: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="ml-auto text-xs text-zinc-500">{rows.length} shown</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
            <tr>
              <th className="text-left py-2 px-3 font-medium">Customer</th>
              <th className="text-right py-2 px-3 font-medium">Lifetime $</th>
              <th className="text-right py-2 px-3 font-medium">Inv</th>
              <th className="text-left py-2 px-3 font-medium">First</th>
              <th className="text-left py-2 px-3 font-medium">Last</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {rows.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-zinc-500 text-xs">No customers in this segment</td></tr>
            )}
            {rows.map(c => (
              <tr key={c.customer} className={`hover:bg-zinc-800/30 ${c.recentInvoices > 0 ? 'bg-[#39FF14]/5' : ''}`}>
                <td className="py-2 px-3">
                  <div className="font-medium text-xs">{c.customer}</div>
                  {c.isRepeat && <span className="text-[10px] text-[#39FF14]"><Repeat className="w-3 h-3 inline" /> repeat</span>}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-xs" style={{ color: accent }}>
                  {fmtMoneyExact(c.total)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-zinc-400 text-xs">{c.invoiceCount}</td>
                <td className="py-2 px-3 text-xs text-zinc-500">{c.firstDate}</td>
                <td className="py-2 px-3 text-xs text-zinc-500">{c.lastDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
