'use client';

/**
 * Chris View — Lead Response Times (Phase 2).
 *
 * For each lead created in JN by office staff (Sara, Destin, Tia):
 *   - when was the lead created?
 *   - when did the assigned rep first manually contact them?
 *     (phone, text, email, set-appt — NOT system notes/automations)
 *
 * Plus per-rep first-contact method breakdown — does Hunter prefer
 * to call vs text vs email?
 *
 * Live API call to JN — takes 5-15 sec on first load (cached 5 min).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Clock, Phone, MessageSquare, Mail, Calendar, ArrowLeft,
  Loader2, RefreshCw, ChevronLeft, ChevronRight, MessageCircle,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, PieChart, Pie, Legend,
} from 'recharts';

interface RepAverage {
  repName: string;
  avgMinutes: number;
  medianMinutes: number;
  fastestMinutes: number;
  slowestMinutes: number;
  totalLeads: number;
  respondedLeads: number;
  noResponseLeads: number;
  under5Min: number;
  under15Min: number;
  under30Min: number;
  over60Min: number;
  grade: string;
}

interface MethodBreakdownEntry {
  rep: string;
  total: number;
  methods: Array<{ method: string; count: number; pct: number }>;
}

interface Lead {
  contactJnid: string;
  contactName: string;
  repName: string;
  createdBy: string;
  leadSource: string;
  contactCreatedAt: number;
  firstActionAt: number | null;
  firstActionType: string | null;
  firstActionBy: string | null;
  responseMinutes: number | null;
}

interface Response {
  days: number;
  repAverages: RepAverage[];
  leads: Lead[];
  summary: { totalLeads: number; totalResponded: number; overallAvgMinutes: number; overallMedianMinutes: number };
  meta: { daysQueried: number; queryTimeMs: number; contactsFetched: number; timestamp: string };
  methodBreakdown: MethodBreakdownEntry[];
  overallMethods: Array<{ method: string; count: number; pct: number }>;
}

const METHOD_COLORS: Record<string, string> = {
  'Phone Call': '#39FF14',
  'Text Message': '#60a5fa',
  'Email': '#fbbf24',
  email: '#fbbf24',
  'Note': '#a78bfa',
  'no-contact': '#ef4444',
};
const FALLBACK = ['#22d3ee', '#fb7185', '#f97316', '#10b981', '#ec4899', '#6366f1'];

function colorFor(method: string, idx: number) {
  return METHOD_COLORS[method] || FALLBACK[idx % FALLBACK.length];
}
function iconFor(method: string) {
  const m = method.toLowerCase();
  if (m.includes('phone')) return <Phone className="w-3.5 h-3.5" />;
  if (m.includes('text')) return <MessageSquare className="w-3.5 h-3.5" />;
  if (m.includes('email')) return <Mail className="w-3.5 h-3.5" />;
  if (m.includes('appt') || m.includes('appointment')) return <Calendar className="w-3.5 h-3.5" />;
  return <MessageCircle className="w-3.5 h-3.5" />;
}
function gradeColor(g: string) {
  return g === 'A' ? 'text-[#39FF14]'
    : g === 'B' ? 'text-emerald-400'
    : g === 'C' ? 'text-amber-400'
    : g === 'D' ? 'text-orange-400'
    : 'text-red-400';
}

function fmtMin(m: number): string {
  if (!m || m <= 0) return '—';
  if (m < 60) return `${Math.round(m)}m`;
  if (m < 1440) return `${Math.round(m / 60 * 10) / 10}h`;
  return `${Math.round(m / 1440 * 10) / 10}d`;
}

export default function ResponseTimesPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchData = useCallback(async (forceDays = days) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/chrisview-response-times?days=${forceDays}`);
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

  useEffect(() => { fetchData(days); }, [days, fetchData]);

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
            Lead Response Times
          </h1>
          <div className="ml-auto flex items-center gap-2">
            {[7, 14, 30, 60, 90, 180].map(d => (
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
            <button
              onClick={() => fetchData()}
              disabled={loading}
              className="p-1.5 text-zinc-400 hover:text-white rounded disabled:opacity-50"
              title="Refresh"
            >
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
            Querying JobNimbus… (first load takes 5-15 seconds, then cached for 5 min)
          </div>
        )}
        {data && (
          <>
            {/* Summary cards */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Office-created leads" value={data.summary.totalLeads.toString()} sub={`last ${data.days} days`} />
              <Kpi label="Responded" value={data.summary.totalResponded.toString()} sub={`${data.summary.totalLeads > 0 ? Math.round(data.summary.totalResponded / data.summary.totalLeads * 100) : 0}% response rate`} highlight />
              <Kpi label="Overall avg response" value={fmtMin(data.summary.overallAvgMinutes)} sub={`median ${fmtMin(data.summary.overallMedianMinutes)}`} />
              <Kpi label="Query took" value={`${(data.meta.queryTimeMs / 1000).toFixed(1)}s`} sub={`${data.meta.contactsFetched} contacts scanned`} />
            </section>

            {/* Per-rep response times */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Clock className="w-4 h-4 text-[#39FF14]" />Per-Rep Response Times</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Rep</th>
                      <th className="text-center py-2 px-3 font-medium">Grade</th>
                      <th className="text-right py-2 px-3 font-medium">Avg</th>
                      <th className="text-right py-2 px-3 font-medium">Median</th>
                      <th className="text-right py-2 px-3 font-medium">Fastest</th>
                      <th className="text-right py-2 px-3 font-medium">Slowest</th>
                      <th className="text-right py-2 px-3 font-medium">&lt;5m</th>
                      <th className="text-right py-2 px-3 font-medium">&lt;15m</th>
                      <th className="text-right py-2 px-3 font-medium">&lt;30m</th>
                      <th className="text-right py-2 px-3 font-medium">&gt;60m</th>
                      <th className="text-right py-2 px-3 font-medium">No response</th>
                      <th className="text-right py-2 px-3 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.repAverages.length === 0 && (
                      <tr><td colSpan={12} className="py-6 text-center text-zinc-500">No office-created leads in this window.</td></tr>
                    )}
                    {data.repAverages.map(r => (
                      <tr key={r.repName} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-medium">{r.repName}</td>
                        <td className={`py-2 px-3 text-center font-bold text-lg ${gradeColor(r.grade)}`}>{r.grade}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{fmtMin(r.avgMinutes)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{fmtMin(r.medianMinutes)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{fmtMin(r.fastestMinutes)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-red-400">{fmtMin(r.slowestMinutes)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{r.under5Min}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{r.under15Min}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{r.under30Min}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-amber-400">{r.over60Min}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-red-400">{r.noResponseLeads}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-medium">{r.totalLeads}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Overall method breakdown pie */}
            {data.overallMethods.length > 0 && (
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-3">Overall First-Contact Method</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.overallMethods}
                          dataKey="count"
                          nameKey="method"
                          outerRadius={100}
                          label={({ method, percent }: { method?: string; percent?: number }) =>
                            `${method} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                          labelLine={false}
                          fontSize={11}
                        >
                          {data.overallMethods.map((m, i) => (
                            <Cell key={i} fill={colorFor(m.method, i)} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-3">Method by Count (all reps)</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.overallMethods} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="method" stroke="#71717a" fontSize={11} />
                        <YAxis stroke="#71717a" fontSize={11} />
                        <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} />
                        <Bar dataKey="count">
                          {data.overallMethods.map((m, i) => (
                            <Cell key={i} fill={colorFor(m.method, i)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>
            )}

            {/* Per-rep method breakdown table */}
            {data.methodBreakdown.length > 0 && (
              <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800">
                  <h3 className="text-sm font-semibold">Per-Rep First-Contact Method Breakdown</h3>
                  <p className="text-xs text-zinc-500 mt-1">Does each rep prefer to call, text, or email? Counts + percentages of first contact attempts.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium">Rep</th>
                        <th className="text-left py-2 px-3 font-medium">Methods (count · %)</th>
                        <th className="text-right py-2 px-3 font-medium">Leads</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {data.methodBreakdown.map(r => (
                        <tr key={r.rep} className="hover:bg-zinc-800/30">
                          <td className="py-2 px-3 font-medium">{r.rep}</td>
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap gap-2">
                              {r.methods.map(m => (
                                <span
                                  key={m.method}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                                  style={{ background: `${colorFor(m.method, 0)}20`, color: colorFor(m.method, 0) }}
                                >
                                  {iconFor(m.method)}
                                  {m.method}: {m.count} ({m.pct}%)
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-medium">{r.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <p className="text-[10px] text-zinc-500 text-center">
              Manual actions only — system notes, automation activities, and pure status changes are excluded.
            </p>
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
