'use client';

/**
 * Chris View — Crew / Production Capacity.
 *
 * How booked-out are the install crews? Shows weekly event counts by
 * subcalendar (installations / deliveries / meetings — inspections live in Monday meeting Estimates, not TeamUp), gap
 * days (business days last 30 with zero installs), busiest crew, and
 * upcoming installation queue. Pulls from TeamUp.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, ArrowLeft, Loader2, RefreshCw, AlertTriangle, Hammer, Eye, Users, MapPin, Clock,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import AboutThisData from '@/components/AboutThisData';

interface WeekBucket {
  week: string;
  installations: number;
  deliveries: number;
  meetings: number;
  general: number;
  total: number;
}
interface RepBucket {
  rep: string;
  installations: number;
  deliveries: number;
  meetings: number;
  total: number;
}
interface UpcomingInstallation {
  id: string;
  title: string;
  start: string;
  end: string;
  who: string;
  location: string;
  daysFromNow: number;
}
interface Data {
  generatedAt: string;
  window: { startDate: string; endDate: string; pastDays: number; futureDays: number };
  teamupConfigured: boolean;
  teamupConfigMessage: string;
  configuredSubcalendars: {
    installations: boolean;
    deliveries: boolean;
    meetings: boolean;
    general: boolean;
  };
  totalEvents: number;
  eventsPerWeek: WeekBucket[];
  byRep: RepBucket[];
  gapDays: number;
  businessDaysLast30: number;
  installsLast30: number;
  installsThisWeek: number;
  installsNext30: number;
  avgInstallsPerBusinessDay: number;
  busiestRep: { rep: string; total: number } | null;
  upcomingInstallations: UpcomingInstallation[];
  meta: { pastDays: number; futureDays: number; queryTimeMs: number };
}

function fmtDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
function fmtWeekLabel(iso: string): string {
  try {
    const d = new Date(`${iso}T00:00:00Z`);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  } catch {
    return iso;
  }
}

export default function CapacityPage() {
  const [pastDays, setPastDays] = useState(60);
  const [futureDays, setFutureDays] = useState(30);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/chrisview-capacity?pastDays=${pastDays}&futureDays=${futureDays}`);
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
  }, [pastDays, futureDays]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const chartData = data?.eventsPerWeek.map(w => ({
    ...w,
    weekLabel: fmtWeekLabel(w.week),
  })) || [];

  const missingSubcals: string[] = [];
  if (data) {
    if (!data.configuredSubcalendars.installations) missingSubcals.push('TEAMUP_SUBCAL_INSTALLATIONS');
    if (!data.configuredSubcalendars.deliveries) missingSubcals.push('TEAMUP_SUBCAL_DELIVERIES');
    if (!data.configuredSubcalendars.meetings) missingSubcals.push('TEAMUP_SUBCAL_MEETINGS');
    if (!data.configuredSubcalendars.general) missingSubcals.push('TEAMUP_SUBCAL_GENERAL');
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#39FF14]" />
            Crew / Production Capacity
          </h1>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide text-zinc-500 font-mono">past</span>
            {[30, 60, 90, 180].map(d => (
              <button
                key={`past-${d}`}
                onClick={() => setPastDays(d)}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                  pastDays === d
                    ? 'bg-[#39FF14]/10 border-[#39FF14]/40 text-[#39FF14]'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {d}d
              </button>
            ))}
            <span className="text-[10px] uppercase tracking-wide text-zinc-500 font-mono ml-2">future</span>
            {[14, 30, 60, 90].map(d => (
              <button
                key={`future-${d}`}
                onClick={() => setFutureDays(d)}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                  futureDays === d
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
        {err && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">
            {err}
          </div>
        )}

        {!data && loading && (
          <div className="text-center py-16 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin inline mr-2" />
            Pulling TeamUp events…
          </div>
        )}

        {data && !data.teamupConfigured && (
          <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded text-amber-200 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <strong>TeamUp not configured.</strong> {data.teamupConfigMessage}. No events can be pulled until TEAMUP_API_KEY and TEAMUP_CALENDAR_KEY are set.
            </div>
          </div>
        )}

        {data && data.teamupConfigured && missingSubcals.length > 0 && (
          <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded text-amber-200 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Partial subcalendar config.</strong> Missing env var(s): {missingSubcals.join(', ')}. Events from those subcalendars fall back to title-keyword classification (best effort).
            </div>
          </div>
        )}

        {data && (
          <>
            {/* KPI strip */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi
                label="Installs this week"
                value={data.installsThisWeek.toString()}
                sub={`Mon-anchored ISO week`}
                highlight
              />
              <Kpi
                label="Installs scheduled next 30d"
                value={data.installsNext30.toString()}
                sub={`from today`}
              />
              <Kpi
                label="Gap days last 30d"
                value={data.gapDays.toString()}
                sub={`of ${data.businessDaysLast30} business days`}
                negative={data.gapDays > Math.floor(data.businessDaysLast30 / 2)}
              />
              <Kpi
                label="Busiest crew (last 30d)"
                value={data.busiestRep?.rep || '—'}
                sub={data.busiestRep ? `${data.busiestRep.total} events` : 'no data'}
              />
              <Kpi
                label="Avg installs / business day"
                value={data.avgInstallsPerBusinessDay.toString()}
                sub={`${data.installsLast30} installs / ${data.businessDaysLast30}d`}
              />
              <Kpi
                label="Total events in window"
                value={data.totalEvents.toString()}
                sub={`${data.window.pastDays}d back / ${data.window.futureDays}d forward`}
              />
              <Kpi
                label="Deliveries (last 30d byRep)"
                value={data.byRep.reduce((s, r) => s + r.deliveries, 0).toString()}
              />
              <Kpi
                label="Meetings (last 30d byRep)"
                value={data.byRep.reduce((s, r) => s + r.meetings, 0).toString()}
              />
            </section>

            {/* Events per week line chart */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#39FF14]" />
                Events per week
              </h3>
              <p className="text-xs text-zinc-500 mb-3">
                Weekly counts (Mon-anchored) across the {data.window.pastDays}d-back / {data.window.futureDays}d-forward window.
                Dashed vertical separator is "today" — values to the right are scheduled, values to the left are historical.
              </p>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="weekLabel" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" fontSize={11} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="installations" stroke="#39FF14" strokeWidth={2} name="Installations / Jobs" dot={false} />
                    <Line type="monotone" dataKey="deliveries" stroke="#8B5CF6" strokeWidth={2} name="Deliveries / Driver schedules" dot={false} />
                    <Line type="monotone" dataKey="meetings" stroke="#6366F1" strokeWidth={1.5} name="Meetings" dot={false} strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="general" stroke="#6B7280" strokeWidth={1} name="Other" dot={false} strokeDasharray="2 4" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* By rep — last 30 days */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#39FF14]" />
                  Events per crew / rep — last 30 days
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Pulled from each event's <code className="text-[#39FF14]">who</code> field. Unassigned events bucket under "(unassigned)".
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Crew / Rep</th>
                      <th className="text-right py-2 px-3 font-medium">Installs</th>
                      <th className="text-right py-2 px-3 font-medium">Deliveries</th>
                      <th className="text-right py-2 px-3 font-medium">Meetings</th>
                      <th className="text-right py-2 px-3 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.byRep.length === 0 && (
                      <tr><td colSpan={5} className="py-6 text-center text-zinc-500">No events in the last 30 days.</td></tr>
                    )}
                    {data.byRep.slice(0, 30).map(r => (
                      <tr key={r.rep} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-medium">{r.rep}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{r.installations || '—'}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-300">{r.deliveries || '—'}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-500">{r.meetings || '—'}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-bold">{r.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.byRep.length > 30 && (
                  <div className="px-3 py-2 text-[10px] text-zinc-500 border-t border-zinc-800">
                    Showing first 30 of {data.byRep.length}.
                  </div>
                )}
              </div>
            </section>

            {/* Upcoming installations */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Hammer className="w-4 h-4 text-[#39FF14]" />
                  Upcoming installations (next 20)
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Next scheduled installs from today forward across the future window.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">When</th>
                      <th className="text-right py-2 px-3 font-medium">In</th>
                      <th className="text-left py-2 px-3 font-medium">Title</th>
                      <th className="text-left py-2 px-3 font-medium">Crew</th>
                      <th className="text-left py-2 px-3 font-medium">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.upcomingInstallations.length === 0 && (
                      <tr><td colSpan={5} className="py-6 text-center text-zinc-500">No upcoming installations scheduled.</td></tr>
                    )}
                    {data.upcomingInstallations.map(u => (
                      <tr key={u.id} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 text-xs tabular-nums">
                          <Clock className="w-3 h-3 inline mr-1 text-zinc-500" />
                          {fmtDateTime(u.start)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-xs">
                          {u.daysFromNow === 0 ? <span className="text-[#39FF14] font-bold">today</span>
                            : u.daysFromNow === 1 ? <span className="text-[#39FF14]">tmrw</span>
                            : <span className="text-zinc-400">{u.daysFromNow}d</span>}
                        </td>
                        <td className="py-2 px-3">{u.title}</td>
                        <td className="py-2 px-3 text-xs text-zinc-300">{u.who || '—'}</td>
                        <td className="py-2 px-3 text-xs text-zinc-400">
                          {u.location ? (
                            <span><MapPin className="w-3 h-3 inline mr-1 text-zinc-500" />{u.location}</span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Subcalendar configuration check */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#39FF14]" />
                TeamUp subcalendar config
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                {(['installations', 'deliveries', 'meetings', 'general'] as const).map(k => (
                  <div key={k} className={`rounded-lg p-2.5 border ${
                    data.configuredSubcalendars[k]
                      ? 'bg-[#39FF14]/5 border-[#39FF14]/30 text-[#39FF14]'
                      : 'bg-amber-500/5 border-amber-500/30 text-amber-300'
                  }`}>
                    <div className="font-mono text-[10px] uppercase">{k}</div>
                    <div className="text-sm font-bold mt-1">
                      {data.configuredSubcalendars[k] ? 'set' : 'missing'}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <AboutThisData
          source="TeamUp Calendar API (lib/teamup-service.ts → teamupService.getEvents). Events filtered by subcalendar IDs from env vars TEAMUP_SUBCAL_INSTALLATIONS / _DELIVERIES / _MEETINGS / _GENERAL. Inspections are NOT tracked in TeamUp (Monday meeting Estimates instead)."
          method="Window = pastDays before today + futureDays after. Events grouped into Mon-anchored ISO weeks via UTC. byRep rollup uses event.who (last 30 days only). Gap days = business days (Mon-Fri UTC) in the last 30 with zero installation events. avgInstallsPerBusinessDay = installs in last 30d / business days in last 30d. busiestRep is the rep with the highest total event count over the last 30 days. upcomingInstallations are sorted ascending by start_dt, capped at 20."
          uses="Spot crew over- or under-utilization before scheduling new jobs. The line chart shows whether installations are clustered ahead or trailing off. Use gap days last-30 to flag a slow stretch worth investigating (rain delay / material shortage / sales slump)."
          gaps={`Inspections are NOT in TeamUp — those are reported to the Monday meeting in the Estimates column, see /chrisview/insights. Future: Rick's insurance-agent visits during free time will land here when set up. Subcalendar IDs missing from env => events fall back to title-keyword classification (best-effort, lower confidence). 'Other' bucket catches anything we can't classify. byRep relies on the 'who' field being populated — events with blank 'who' bucket under '(unassigned)'. Today: ${[
            !data?.configuredSubcalendars.installations ? 'TEAMUP_SUBCAL_INSTALLATIONS' : null,
            !data?.configuredSubcalendars.deliveries ? 'TEAMUP_SUBCAL_DELIVERIES' : null,
            !data?.configuredSubcalendars.meetings ? 'TEAMUP_SUBCAL_MEETINGS' : null,
            !data?.configuredSubcalendars.general ? 'TEAMUP_SUBCAL_GENERAL' : null,
          ].filter(Boolean).join(', ') || 'all subcalendar env vars are set'}.`}
          generatedAt={data?.generatedAt}
        />
      </main>
    </div>
  );
}

function Kpi({ label, value, sub, highlight, negative }: {
  label: string; value: string; sub?: string; highlight?: boolean; negative?: boolean;
}) {
  return (
    <div className={`rounded-xl p-3 border ${
      highlight ? 'bg-gradient-to-br from-[#39FF14]/10 to-zinc-900 border-[#39FF14]/30' : 'bg-zinc-900 border-zinc-800'
    }`}>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`text-xl font-bold mt-1 ${negative ? 'text-red-400' : 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}
