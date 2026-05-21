'use client';

import { useState, useEffect, useCallback } from 'react';
import { CloudHail, ArrowLeft, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import AboutThisData from '@/components/AboutThisData';

interface StormRecord {
  date: string;
  hailSize: number;
  hailSizeLabel: string;
  latitude: number;
  longitude: number;
  county: string;
  state: string;
  location: string;
  source: string;
  affectedLeads: number;
  affectedJobs: number;
  firstLeadAt: string | null;
  firstLeadHoursAfter: number | null;
}

interface CountyAggregate {
  county: string;
  state: string;
  storms: number;
  affectedLeads: number;
  affectedJobs: number;
  maxHailSize: number;
  maxHailSizeLabel: string;
  leadsPerStorm: number;
}

interface Data {
  generatedAt: string;
  windowDays: number;
  matchWindowDays: number;
  matchRadiusMiles: number;
  hailReconConfigured: boolean;
  hailDataAvailable: boolean;
  totalStorms: number;
  totalAffectedLeads: number;
  totalAffectedJobs: number;
  leadsPerStorm: number;
  biggestHailSize: number;
  biggestHailSizeLabel: string;
  byStorm: StormRecord[];
  byCounty: CountyAggregate[];
  topRecentStorms: StormRecord[];
  meta: {
    queryTimeMs: number;
    hailEventsFetched: number;
    contactsFetched: number;
    contactsWithGeo: number;
    contactsWithoutGeo: number;
    jobsFetched: number;
    jobsWithGeo: number;
    jobsWithoutGeo: number;
    note: string;
  };
}

function fmtHrs(h: number | null) {
  if (h == null) return '—';
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export default function StormResponsePage() {
  const [days, setDays] = useState(90);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/chrisview-storm-response?days=${days}`);
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Top storms by affected leads, for the bar chart
  const topByLeads = data
    ? [...data.byStorm]
        .filter(s => s.affectedLeads > 0)
        .sort((a, b) => b.affectedLeads - a.affectedLeads)
        .slice(0, 12)
        .map(s => ({
          label: `${s.date.slice(5, 10)} · ${s.hailSize}"`,
          leads: s.affectedLeads,
          jobs: s.affectedJobs,
          county: s.county || s.location || '?',
        }))
    : [];

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <CloudHail className="w-5 h-5 text-[#39FF14]" />
            Storm-to-Job Response
          </h1>
          <div className="ml-auto flex items-center gap-2">
            {[30, 90, 180, 365].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs rounded-lg border ${
                  days === d
                    ? 'bg-[#39FF14]/10 border-[#39FF14]/40 text-[#39FF14]'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {d}d
              </button>
            ))}
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 text-zinc-400 hover:text-white rounded disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">
            {err}
          </div>
        )}
        {!data && loading && (
          <div className="text-center py-16 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin inline mr-2" />
            Pulling Hail Recon events + JN contacts/jobs and matching by distance…
          </div>
        )}

        {data && (
          <>
            {/* Coverage banner */}
            {!data.hailReconConfigured && (
              <section className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-200">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                Hail Recon API is not configured — no storm overlay is being computed. Set{' '}
                <code className="font-mono">HAILRECON_API_KEY</code> +{' '}
                <code className="font-mono">HAILRECON_API_SECRET</code> in env.
              </section>
            )}
            {data.hailReconConfigured && !data.hailDataAvailable && (
              <section className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-200">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                Hail Recon configured but returned no storm events for the service area in the
                last {data.windowDays} days. Either there was no significant hail or the API
                has a coverage gap for this window.
              </section>
            )}

            {/* KPI strip */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi
                label="Total storms"
                value={data.totalStorms.toString()}
                sub={`last ${data.windowDays}d, within ${80}mi of HSV`}
                highlight
              />
              <Kpi
                label="Affected leads"
                value={data.totalAffectedLeads.toString()}
                sub={`within ${data.matchRadiusMiles}mi + ${data.matchWindowDays}d of a storm`}
              />
              <Kpi
                label="Leads / storm"
                value={data.leadsPerStorm.toString()}
                sub={`${data.totalAffectedJobs} jobs total`}
              />
              <Kpi
                label="Biggest hail"
                value={data.biggestHailSize > 0 ? `${data.biggestHailSize}"` : '—'}
                sub={data.biggestHailSizeLabel}
              />
            </section>

            {/* Diagnostics strip */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-400 flex flex-wrap gap-x-6 gap-y-1">
              <span>
                Hail events fetched: <strong className="text-zinc-200">{data.meta.hailEventsFetched}</strong>
              </span>
              <span>
                Contacts: <strong className="text-zinc-200">{data.meta.contactsFetched}</strong>{' '}
                ({data.meta.contactsWithGeo} with geo,{' '}
                <span className={data.meta.contactsWithoutGeo > 0 ? 'text-amber-300' : ''}>
                  {data.meta.contactsWithoutGeo} unmatchable
                </span>)
              </span>
              <span>
                Jobs: <strong className="text-zinc-200">{data.meta.jobsFetched}</strong>{' '}
                ({data.meta.jobsWithGeo} with geo,{' '}
                <span className={data.meta.jobsWithoutGeo > 0 ? 'text-amber-300' : ''}>
                  {data.meta.jobsWithoutGeo} unmatchable
                </span>)
              </span>
              <span>
                Query: <strong className="text-zinc-200">{(data.meta.queryTimeMs / 1000).toFixed(1)}s</strong>
              </span>
              {data.meta.note && data.meta.note !== 'OK' && (
                <span className="text-amber-300">Note: {data.meta.note}</span>
              )}
            </section>

            {/* Bar chart — leads per storm */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-1">Leads per Storm (top 12 by lead volume)</h3>
              <p className="text-xs text-zinc-500 mb-3">
                Each bar = one storm event. Bar height = leads created within{' '}
                {data.matchRadiusMiles} miles + {data.matchWindowDays} days after the storm.
              </p>
              <div className="h-64">
                {topByLeads.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                    No storms with matched leads in this window.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topByLeads} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="label" stroke="#71717a" fontSize={10} angle={-20} textAnchor="end" height={50} />
                      <YAxis stroke="#71717a" fontSize={11} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                        formatter={(v: number | undefined) => (v != null ? `${v} leads` : '—')}
                      />
                      <Bar dataKey="leads" name="leads">
                        {topByLeads.map((b, i) => (
                          <Cell
                            key={i}
                            fill={b.leads >= 10 ? '#39FF14' : b.leads >= 5 ? '#a3e635' : '#60a5fa'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            {/* Top recent storms table */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold">Top 20 Most Recent Storms</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Each row is one Hail Recon event. Leads/jobs = anything in JN created within{' '}
                  {data.matchRadiusMiles} mi + {data.matchWindowDays} d of the storm.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Date</th>
                      <th className="text-right py-2 px-3 font-medium">Hail size</th>
                      <th className="text-left py-2 px-3 font-medium">Location</th>
                      <th className="text-left py-2 px-3 font-medium">County</th>
                      <th className="text-right py-2 px-3 font-medium">Leads</th>
                      <th className="text-right py-2 px-3 font-medium">Jobs</th>
                      <th className="text-right py-2 px-3 font-medium">Time to 1st lead</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.topRecentStorms.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-zinc-500">
                          No storms detected in this window.
                        </td>
                      </tr>
                    )}
                    {data.topRecentStorms.map((s, i) => (
                      <tr key={`${s.date}-${i}`} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 text-xs font-mono">{s.date.slice(0, 10)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          <span className={s.hailSize >= 1.75 ? 'text-[#39FF14] font-semibold' : ''}>
                            {s.hailSizeLabel}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-xs text-zinc-300">{s.location || '—'}</td>
                        <td className="py-2 px-3 text-xs">
                          {s.county || '—'}
                          {s.state ? `, ${s.state}` : ''}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14] font-semibold">
                          {s.affectedLeads}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-amber-300">
                          {s.affectedJobs}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-xs">
                          {fmtHrs(s.firstLeadHoursAfter)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* County rollup */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold">By County</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Storm-hit counties — under-served zones are counties with storms but few/no
                  matched leads.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">County</th>
                      <th className="text-right py-2 px-3 font-medium">Storms</th>
                      <th className="text-right py-2 px-3 font-medium">Leads</th>
                      <th className="text-right py-2 px-3 font-medium">Jobs</th>
                      <th className="text-right py-2 px-3 font-medium">Leads / storm</th>
                      <th className="text-right py-2 px-3 font-medium">Max hail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.byCounty.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-zinc-500">
                          No county-tagged storms in this window.
                        </td>
                      </tr>
                    )}
                    {data.byCounty.map((c, i) => {
                      const underServed = c.storms >= 2 && c.affectedLeads === 0;
                      return (
                        <tr
                          key={`${c.county}-${c.state}-${i}`}
                          className={`hover:bg-zinc-800/30 ${underServed ? 'bg-red-500/5' : ''}`}
                        >
                          <td className="py-2 px-3">
                            <div className="font-medium">{c.county || 'Unknown'}</div>
                            {c.state && <div className="text-[10px] text-zinc-500">{c.state}</div>}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">{c.storms}</td>
                          <td
                            className={`py-2 px-3 text-right tabular-nums font-semibold ${
                              c.affectedLeads === 0 ? 'text-zinc-500' : 'text-[#39FF14]'
                            }`}
                          >
                            {c.affectedLeads}
                            {underServed && (
                              <AlertTriangle className="w-3 h-3 inline ml-1 text-red-400" />
                            )}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-amber-300">
                            {c.affectedJobs}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">{c.leadsPerStorm}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-xs">
                            {c.maxHailSizeLabel}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {data.byCounty.some(c => c.storms >= 2 && c.affectedLeads === 0) && (
                <div className="px-4 py-2 text-[11px] text-red-300 border-t border-zinc-800 bg-red-500/5">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  Counties shaded red have 2+ storms and zero matched leads — likely
                  under-served storm zones worth a canvas trip.
                </div>
              )}
            </section>

            <p className="text-[10px] text-zinc-500 text-center">
              Storm timestamps from Hail Recon · Lead/job timestamps from JN · Distance is
              great-circle (haversine) between storm centroid and contact/job geo.
            </p>
          </>
        )}

        {/* Render UNCONDITIONALLY so AboutThisData SSRs in the initial HTML. */}
        <AboutThisData
          title="About this page"
          source={
            'Hail Recon API (`lib/hailrecon-service.ts` → `getAreaHailHistory` centered on ' +
            'lat 34.7, lon -86.6, ~80 mi radius) overlaid on JobNimbus `/contacts` and `/jobs` ' +
            'pulled live for the chosen window. Heavy queries are cached via the `chrisview_cache` ' +
            'sheet tab (slug `storm-response`) by the hourly precompute cron.'
          }
          method={
            'For every Hail Recon event in the window, count JN contacts and jobs whose ' +
            '`date_created` falls within 14 days AFTER the storm AND whose `geo.lat/lng` is within ' +
            '25 miles of the storm centroid (great-circle distance). Totals de-duplicate contacts ' +
            'that match multiple storms. Time-to-first-lead is the gap between the storm and the ' +
            'earliest matched contact creation.'
          }
          uses={
            'Validate the "go after storms" sales strategy by tying real lead volume to specific ' +
            'storm events. Spot under-served storm zones (counties with multiple storms but few/no ' +
            'matched leads) to direct canvassing. Compare response speed — how fast do reps get ' +
            'leads in after a confirmed hail event?'
          }
          gaps={
            'Hail Recon coverage can miss small or unreported storms, and historic event timestamps ' +
            'are date-only (no hour-of-day). Contacts without a JN `geo` field cannot be ' +
            'distance-matched and are reported as "unmatchable" in the diagnostics strip. The 14-day / ' +
            '25-mile window is a heuristic — a true cause-effect link still requires sales-rep notes. ' +
            'Service-area centroid is a single point (Huntsville-ish); storms far on the edge of the ' +
            '80-mi search radius may be under-represented.'
          }
          generatedAt={data?.generatedAt}
        />
      </main>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 border ${
        highlight
          ? 'bg-gradient-to-br from-[#39FF14]/10 to-zinc-900 border-[#39FF14]/30'
          : 'bg-zinc-900 border-zinc-800'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-xl font-bold text-white mt-1">{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}
