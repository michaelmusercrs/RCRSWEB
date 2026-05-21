'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, ArrowLeft, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';

type Certainty = 'in_person_high' | 'in_person_probable' | 'online_high' | 'online_probable' | 'unknown';

interface Lead {
  contactJnid: string; contactName: string; rep: string; createdAt: string;
  createdBy: string; source: string; jobNumber: string; jobStatus: string;
  isInsurance: boolean; carrier: string;
  firstRepActionAt: string | null; firstRepActionType: string | null;
  responseMinutes: number | null;
  statusChangeFollowups: Array<{ statusChangeAt: string; followupType: string | null; followupAt: string | null; followupMins: number | null }>;
  estimateSentAt: string | null; daysToEstimate: number | null;
  estimateCertainty: Certainty; estimateEvidence: string[];
  signedAt: string | null; daysToSigned: number | null;
  paidAt: string | null; daysToPaid: number | null;
  trips: number; signed: boolean; paid: boolean;
}

interface Data {
  generatedAt: string;
  windowDays: number;
  totalLeads: number;
  responded: number;
  responseRate: number;
  byRep: Array<{ rep: string; leads: number; responded: number; medianResponseMin: number | null; medianDaysToEstimate: number | null; medianDaysToSigned: number | null; medianDaysToPaid: number | null; avgTrips: number; closeRate: number }>;
  byMethod: Array<{ method: string; leads: number; signed: number; closeRate: number; medianDaysToSigned: number | null }>;
  closeByCertainty: Array<{ certainty: Certainty; leads: number; signed: number; closeRate: number; medianDaysSignedAfterEstimate: number | null }>;
  closeByTrips: Array<{ tripBucket: string; leads: number; signed: number; closeRate: number }>;
  leads: Lead[];
}

const CERTAINTY_LABEL: Record<Certainty, string> = {
  in_person_high: 'In-person (confirmed)',
  in_person_probable: 'In-person (probable)',
  online_high: 'Online / email (confirmed)',
  online_probable: 'Online / email (probable)',
  unknown: 'Unknown',
};
const CERTAINTY_COLOR: Record<Certainty, string> = {
  in_person_high: '#39FF14',
  in_person_probable: '#a3e635',
  online_high: '#60a5fa',
  online_probable: '#94a3b8',
  unknown: '#52525b',
};

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

export default function FunnelPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/chrisview-funnel?days=${days}`);
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || `HTTP ${res.status}`); }
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
            <ArrowLeft className="w-4 h-4" />Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2"><Activity className="w-5 h-5 text-[#39FF14]" />Deep Funnel — Lead to Paid</h1>
          <div className="ml-auto flex items-center gap-2">
            {[30, 90, 180, 365].map(d => (
              <button key={d} onClick={() => setDays(d)} className={`px-3 py-1.5 text-xs rounded-lg border ${days === d ? 'bg-[#39FF14]/10 border-[#39FF14]/40 text-[#39FF14]' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'}`}>{d}d</button>
            ))}
            <button onClick={fetchData} disabled={loading} className="p-1.5 text-zinc-400 hover:text-white rounded disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{err}</div>}
        {!data && loading && (
          <div className="text-center py-16 text-zinc-500"><Loader2 className="w-6 h-6 animate-spin inline mr-2" />Pulling every activity for every office lead… this is slow on purpose, 60-120s.</div>
        )}
        {data && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Office leads" value={data.totalLeads.toString()} sub={`last ${data.windowDays}d`} highlight />
              <Kpi label="Responded" value={data.responded.toString()} sub={`${data.responseRate}% response rate`} />
              <Kpi label="Signed" value={data.leads.filter(l => l.signed).length.toString()} />
              <Kpi label="Paid in full" value={data.leads.filter(l => l.paid).length.toString()} />
            </section>

            {/* NO-RESPONSE WATCHLIST — top of page, can't miss it */}
            {(() => {
              const noResp = data.leads
                .filter(l => !l.firstRepActionAt)
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
              if (noResp.length === 0) {
                return (
                  <section className="bg-[#39FF14]/5 border border-[#39FF14]/30 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-[#39FF14] flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> No-Response Watchlist
                    </h3>
                    <p className="text-xs text-zinc-300 mt-1">
                      ✓ Every office lead in the last {data.windowDays} days has at least one manual touch from a sales rep. No idle leads.
                    </p>
                  </section>
                );
              }
              const todayMs = Date.now();
              return (
                <section className="bg-red-500/5 border border-red-500/30 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-red-500/30 flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <h3 className="text-sm font-semibold text-red-300">
                      No-Response Watchlist — {noResp.length} office lead{noResp.length === 1 ? '' : 's'} with ZERO rep activity
                    </h3>
                    <span className="ml-auto text-[10px] text-red-300/70">
                      Triple-verified: pulls every activity on the contact + every related job, filters out auto-events.
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-red-200/70 uppercase tracking-wide bg-red-500/10 border-b border-red-500/20">
                        <tr>
                          <th className="text-left py-2 px-3 font-medium">Lead</th>
                          <th className="text-left py-2 px-3 font-medium">Job#</th>
                          <th className="text-left py-2 px-3 font-medium">Assigned Rep</th>
                          <th className="text-left py-2 px-3 font-medium">Source</th>
                          <th className="text-left py-2 px-3 font-medium">Created By</th>
                          <th className="text-left py-2 px-3 font-medium">Created</th>
                          <th className="text-right py-2 px-3 font-medium">Days Idle</th>
                          <th className="text-left py-2 px-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-500/10">
                        {noResp.map(l => {
                          const daysIdle = Math.floor((todayMs - new Date(l.createdAt).getTime()) / 86400000);
                          const urgency = daysIdle >= 14 ? 'text-red-300 font-bold' : daysIdle >= 7 ? 'text-amber-300 font-semibold' : 'text-zinc-300';
                          return (
                            <tr key={l.contactJnid} className="hover:bg-red-500/10">
                              <td className="py-2 px-3 font-medium">{l.contactName}</td>
                              <td className="py-2 px-3 font-mono text-xs text-zinc-400">{l.jobNumber || '—'}</td>
                              <td className="py-2 px-3 text-xs">{l.rep || '—'}</td>
                              <td className="py-2 px-3 text-xs text-zinc-400">{l.source || <span className="text-zinc-600">(none)</span>}</td>
                              <td className="py-2 px-3 text-xs text-zinc-400">{l.createdBy}</td>
                              <td className="py-2 px-3 text-xs text-zinc-400">{l.createdAt.slice(0, 10)}</td>
                              <td className={`py-2 px-3 text-right tabular-nums ${urgency}`}>{daysIdle}d</td>
                              <td className="py-2 px-3 text-xs">{l.jobStatus || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })()}

            {/* Estimate certainty close rates */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-1">Close Rate by Estimate Delivery — Labeled by Certainty</h3>
              <p className="text-xs text-zinc-400 mb-3">
                <strong className="text-[#39FF14]">In-person (confirmed)</strong>: a completed appointment was logged within 7 days BEFORE the estimate was sent.{' '}
                <strong className="text-lime-300">In-person (probable)</strong>: a note mentioning meeting/visit/inspection/on-site was logged before the estimate.{' '}
                <strong className="text-blue-300">Online (confirmed)</strong>: an email activity within ±24h of the estimate sent.{' '}
                <strong className="text-zinc-400">Online (probable)</strong>: no meeting note or appt before estimate — assumed online.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Delivery</th>
                      <th className="text-right py-2 px-3 font-medium">Leads</th>
                      <th className="text-right py-2 px-3 font-medium">Signed</th>
                      <th className="text-right py-2 px-3 font-medium">Close %</th>
                      <th className="text-right py-2 px-3 font-medium">Median days estimate→signed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.closeByCertainty.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-zinc-500">No estimates with detectable evidence yet in this window.</td></tr>}
                    {data.closeByCertainty.map(c => (
                      <tr key={c.certainty} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-medium" style={{ color: CERTAINTY_COLOR[c.certainty] }}>{CERTAINTY_LABEL[c.certainty]}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{c.leads}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{c.signed}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-bold">{c.closeRate}%</td>
                        <td className="py-2 px-3 text-right tabular-nums">{c.medianDaysSignedAfterEstimate != null ? `${c.medianDaysSignedAfterEstimate}d` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Close by trips */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Close Rate by Trips to Home (completed appts)</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.closeByTrips} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="tripBucket" stroke="#71717a" fontSize={11} />
                    <YAxis stroke="#71717a" fontSize={11} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} formatter={(v: number | undefined) => v != null ? `${v}%` : '—'} />
                    <Bar dataKey="closeRate" name="Close %">
                      {data.closeByTrips.map((b, i) => (
                        <Cell key={i} fill={b.closeRate >= 50 ? '#39FF14' : b.closeRate >= 30 ? '#fbbf24' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Per-rep funnel */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold">Per-Rep Funnel</h3>
                <p className="text-xs text-zinc-500 mt-1">Median timings: lead created → first response → estimate sent → signed → paid.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Rep</th>
                      <th className="text-right py-2 px-3 font-medium">Leads</th>
                      <th className="text-right py-2 px-3 font-medium">Responded</th>
                      <th className="text-right py-2 px-3 font-medium">Median resp</th>
                      <th className="text-right py-2 px-3 font-medium">d→ est sent</th>
                      <th className="text-right py-2 px-3 font-medium">d→ signed</th>
                      <th className="text-right py-2 px-3 font-medium">d→ paid</th>
                      <th className="text-right py-2 px-3 font-medium">Avg trips</th>
                      <th className="text-right py-2 px-3 font-medium">Close %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.byRep.map(r => (
                      <tr key={r.rep} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-medium">{r.rep}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{r.leads}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{r.responded}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{fmtMin(r.medianResponseMin)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-xs">{fmtDays(r.medianDaysToEstimate)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-xs">{fmtDays(r.medianDaysToSigned)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-xs">{fmtDays(r.medianDaysToPaid)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{r.avgTrips}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-bold">{r.closeRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Close by first-contact method */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold">Close Rate by First-Contact Method</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Method</th>
                      <th className="text-right py-2 px-3 font-medium">Leads</th>
                      <th className="text-right py-2 px-3 font-medium">Signed</th>
                      <th className="text-right py-2 px-3 font-medium">Close %</th>
                      <th className="text-right py-2 px-3 font-medium">Median d→signed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.byMethod.map(m => (
                      <tr key={m.method} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-medium">{m.method}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{m.leads}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{m.signed}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-bold">{m.closeRate}%</td>
                        <td className="py-2 px-3 text-right tabular-nums text-xs">{fmtDays(m.medianDaysToSigned)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Lead detail with status-change followups */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold">Per-Lead Detail</h3>
                <p className="text-xs text-zinc-500 mt-1">Click a row to expand status-change followups + evidence.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Lead</th>
                      <th className="text-left py-2 px-3 font-medium">Rep</th>
                      <th className="text-left py-2 px-3 font-medium">Source</th>
                      <th className="text-right py-2 px-3 font-medium">Resp</th>
                      <th className="text-right py-2 px-3 font-medium">d→est</th>
                      <th className="text-right py-2 px-3 font-medium">d→sign</th>
                      <th className="text-right py-2 px-3 font-medium">d→paid</th>
                      <th className="text-right py-2 px-3 font-medium">Trips</th>
                      <th className="text-left py-2 px-3 font-medium">Estimate delivery</th>
                      <th className="text-left py-2 px-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.leads.map(l => {
                      const expanded = expandedLead === l.contactJnid;
                      return (
                        <>
                          <tr key={l.contactJnid} onClick={() => setExpandedLead(expanded ? null : l.contactJnid)} className={`hover:bg-zinc-800/30 cursor-pointer ${!l.firstRepActionAt ? 'bg-red-500/5' : ''}`}>
                            <td className="py-2 px-3">
                              <div className="font-medium">{l.contactName}</div>
                              <div className="text-[10px] text-zinc-500 font-mono">{l.jobNumber || '—'} · {l.createdAt.slice(0, 10)}</div>
                            </td>
                            <td className="py-2 px-3 text-xs">{l.rep || '—'}</td>
                            <td className="py-2 px-3 text-xs text-zinc-400">{l.source || '—'}</td>
                            <td className={`py-2 px-3 text-right tabular-nums text-xs ${!l.firstRepActionAt ? 'text-red-400 font-bold' : ''}`}>{l.firstRepActionAt ? fmtMin(l.responseMinutes) : 'NONE'}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-xs">{fmtDays(l.daysToEstimate)}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-xs">{fmtDays(l.daysToSigned)}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-xs">{fmtDays(l.daysToPaid)}</td>
                            <td className="py-2 px-3 text-right tabular-nums">{l.trips}</td>
                            <td className="py-2 px-3 text-xs" style={{ color: CERTAINTY_COLOR[l.estimateCertainty] }}>{l.estimateSentAt ? CERTAINTY_LABEL[l.estimateCertainty] : '—'}</td>
                            <td className="py-2 px-3 text-xs">
                              {l.signed && <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#39FF14]/20 text-[#39FF14] mr-1">SIGNED</span>}
                              {l.paid && <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300">PAID</span>}
                              {!l.firstRepActionAt && <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400"><AlertTriangle className="w-3 h-3 inline" /> NO RESPONSE</span>}
                            </td>
                          </tr>
                          {expanded && (
                            <tr key={l.contactJnid + '-x'} className="bg-zinc-950">
                              <td colSpan={10} className="py-3 px-6 text-xs space-y-2">
                                {l.estimateEvidence.length > 0 && (
                                  <div>
                                    <strong className="text-zinc-300">Estimate evidence:</strong> {l.estimateEvidence.join(' · ')}
                                  </div>
                                )}
                                {l.statusChangeFollowups.length > 0 ? (
                                  <div>
                                    <strong className="text-zinc-300">Status-change follow-ups:</strong>
                                    <ul className="ml-4 mt-1 space-y-1">
                                      {l.statusChangeFollowups.map((s, i) => (
                                        <li key={i} className="text-zinc-400">
                                          [{s.statusChangeAt.slice(0, 16).replace('T', ' ')}] status changed →{' '}
                                          {s.followupType
                                            ? <>followed by <strong className="text-zinc-200">{s.followupType}</strong> {s.followupMins}m later</>
                                            : <span className="text-amber-300">no rep follow-up logged</span>}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : (
                                  <div className="text-zinc-500">No status changes during the window.</div>
                                )}
                                <div>
                                  <strong className="text-zinc-300">First rep action:</strong>{' '}
                                  {l.firstRepActionAt
                                    ? <>{l.firstRepActionType} at {l.firstRepActionAt.slice(0, 16).replace('T', ' ')} ({fmtMin(l.responseMinutes)} after lead created)</>
                                    : <span className="text-red-400">NONE</span>}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="text-[10px] text-zinc-500 text-center">
              All timestamps from JN. &ldquo;In-person&rdquo; classification uses appt/note evidence — read the row-expand for the exact reason behind each label.
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
