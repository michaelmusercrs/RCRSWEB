'use client';

import { useState, useEffect } from 'react';
import { Calendar, ArrowLeft, Loader2, Users, Filter, Award } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ComposedChart, Line, Cell,
} from 'recharts';

interface YearRow {
  year: string; inspected: number; damage: number; signed: number;
  accrualRevenue: number; approved: number; referrals: number; agents: number;
  repWeeks: number; distinctReps: number;
  damageRate: number; closeRate: number; avgRevPerSigned: number;
}
interface MonthRow { month: string; inspected: number; damage: number; signed: number; accrualRevenue: number }
interface RepRow {
  rep: string; weeks: number; inspected: number; damage: number; signed: number;
  accrualRevenue: number; avgRevPerWeek: number; avgInspectedPerWeek: number;
  closeRate: number; firstWeek: string; lastWeek: string; daysActive: number;
}
interface WeekRow { meetingDate: string; rep: string; inspected: number; signed: number; accrualRevenue: number; referrals: number }
interface AttRow { rep: string; sessions: number; present: number; presentPct: number }
interface YearAttRow { year: string; sessions: number; present: number; presentPct: number }
interface Data {
  generatedAt: string;
  dateRange: { first: string; last: string; weeks: number };
  byYear: YearRow[];
  byMonth: MonthRow[];
  topRepsLifetime: RepRow[];
  bestWeeks: WeekRow[];
  attendance: { yearly: YearAttRow[]; perRep: AttRow[] };
  funnel: { lifetimeInspected: number; lifetimeDamage: number; lifetimeSigned: number; lifetimeAccrual: number; damageRate: number; closeRate: number; avgRevPerSigned: number };
}

function fmtMoney(n: number) {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(1)}K`;
  return `${sign}$${a.toFixed(0)}`;
}
function fmtMoneyExact(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default function MeetingsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/chrisview-meetings');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2"><Calendar className="w-5 h-5 text-[#39FF14]" />Monday Meetings — All-Time</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{err}</div>}
        {loading && <div className="text-center py-12 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>}
        {data && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Lifetime accrual" value={fmtMoney(data.funnel.lifetimeAccrual)} sub={`${data.dateRange.first} → ${data.dateRange.last}`} highlight />
              <Kpi label="Inspected → Signed" value={`${data.funnel.lifetimeInspected.toLocaleString()} → ${data.funnel.lifetimeSigned.toLocaleString()}`} sub={`${data.funnel.closeRate}% close rate`} />
              <Kpi label="Damage found" value={data.funnel.lifetimeDamage.toLocaleString()} sub={`${data.funnel.damageRate}% of inspected`} />
              <Kpi label="Avg $ per signed" value={fmtMoney(data.funnel.avgRevPerSigned)} sub={`${data.dateRange.weeks.toLocaleString()} rep-weeks logged`} />
            </section>

            {/* Annual funnel */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Filter className="w-4 h-4 text-[#39FF14]" />Annual Funnel — Inspected → Damage → Signed → Accrual $</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.byYear} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="year" stroke="#71717a" fontSize={11} />
                    <YAxis yAxisId="left" stroke="#71717a" fontSize={11} />
                    <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={11} tickFormatter={v => `${(v / 1_000_000).toFixed(1)}M`} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} formatter={(v: number | undefined, n: string | undefined) => v == null ? '—' : n === 'accrualRevenue' ? fmtMoneyExact(v) : v.toLocaleString()} />
                    <Bar yAxisId="left" dataKey="inspected" fill="#60a5fa" name="Inspected" />
                    <Bar yAxisId="left" dataKey="damage" fill="#fbbf24" name="Damage" />
                    <Bar yAxisId="left" dataKey="signed" fill="#39FF14" name="Signed" />
                    <Line yAxisId="right" type="monotone" dataKey="accrualRevenue" stroke="#a3e635" strokeWidth={2} name="accrualRevenue" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Year</th>
                      <th className="text-right py-2 px-3 font-medium">Inspected</th>
                      <th className="text-right py-2 px-3 font-medium">Damage</th>
                      <th className="text-right py-2 px-3 font-medium">Dmg %</th>
                      <th className="text-right py-2 px-3 font-medium">Signed</th>
                      <th className="text-right py-2 px-3 font-medium">Close %</th>
                      <th className="text-right py-2 px-3 font-medium">Accrual $</th>
                      <th className="text-right py-2 px-3 font-medium">Avg $/signed</th>
                      <th className="text-right py-2 px-3 font-medium">Reps</th>
                      <th className="text-right py-2 px-3 font-medium">Rep-weeks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.byYear.map(y => (
                      <tr key={y.year} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-mono text-xs">{y.year}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{y.inspected.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-amber-300">{y.damage}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{y.damageRate}%</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{y.signed}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{y.closeRate}%</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14] font-bold">{fmtMoney(y.accrualRevenue)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-300">{fmtMoney(y.avgRevPerSigned)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{y.distinctReps}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-500">{y.repWeeks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Top reps lifetime */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#39FF14]" />
                <h3 className="text-sm font-semibold">Lifetime Career — by Meeting Accrual</h3>
                <p className="ml-auto text-[10px] text-zinc-500">Self-reported Monday numbers; differs from QB-booked revenue.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Rep</th>
                      <th className="text-right py-2 px-3 font-medium">Weeks</th>
                      <th className="text-left py-2 px-3 font-medium">First → Last</th>
                      <th className="text-right py-2 px-3 font-medium">Inspected</th>
                      <th className="text-right py-2 px-3 font-medium">Avg insp/wk</th>
                      <th className="text-right py-2 px-3 font-medium">Signed</th>
                      <th className="text-right py-2 px-3 font-medium">Close %</th>
                      <th className="text-right py-2 px-3 font-medium">Lifetime $</th>
                      <th className="text-right py-2 px-3 font-medium">Avg $/wk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.topRepsLifetime.map(r => (
                      <tr key={r.rep} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-medium">{r.rep}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{r.weeks}</td>
                        <td className="py-2 px-3 text-xs text-zinc-400">{r.firstWeek} → {r.lastWeek}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{r.inspected}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{r.avgInspectedPerWeek}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{r.signed}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{r.closeRate}%</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14] font-bold">{fmtMoney(r.accrualRevenue)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-amber-300">{fmtMoney(r.avgRevPerWeek)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Best rep-weeks ever */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-300" />
                <h3 className="text-sm font-semibold">Best 20 Rep-Weeks (Single-Week Accrual)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">#</th>
                      <th className="text-left py-2 px-3 font-medium">Week</th>
                      <th className="text-left py-2 px-3 font-medium">Rep</th>
                      <th className="text-right py-2 px-3 font-medium">Inspected</th>
                      <th className="text-right py-2 px-3 font-medium">Signed</th>
                      <th className="text-right py-2 px-3 font-medium">Accrual $</th>
                      <th className="text-right py-2 px-3 font-medium">Referrals</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.bestWeeks.map((w, i) => (
                      <tr key={`${w.meetingDate}-${w.rep}`} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 text-zinc-500 font-mono text-xs">{i + 1}</td>
                        <td className="py-2 px-3 text-xs font-mono">{w.meetingDate}</td>
                        <td className="py-2 px-3 font-medium">{w.rep}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{w.inspected}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{w.signed}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-amber-300 font-bold">{fmtMoney(w.accrualRevenue)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{w.referrals || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Attendance */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Attendance by Year</h3>
              <p className="text-[10px] text-zinc-500 mb-2">Per attendance rules: present=1, blank/0=absent, E/EX/EXCUSED skipped from denominator.</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.attendance.yearly} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="year" stroke="#71717a" fontSize={11} />
                    <YAxis stroke="#71717a" fontSize={11} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} formatter={(v: number | undefined) => v == null ? '—' : `${v}%`} />
                    <Bar dataKey="presentPct" name="Present %">
                      {data.attendance.yearly.map((y, i) => (
                        <Cell key={i} fill={y.presentPct >= 90 ? '#39FF14' : y.presentPct >= 75 ? '#a3e635' : y.presentPct >= 60 ? '#fbbf24' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Per-rep attendance */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold">Per-Rep Attendance (≥10 sessions logged)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Rep</th>
                      <th className="text-right py-2 px-3 font-medium">Sessions</th>
                      <th className="text-right py-2 px-3 font-medium">Present</th>
                      <th className="text-right py-2 px-3 font-medium">Present %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.attendance.perRep.map(r => (
                      <tr key={r.rep} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-medium">{r.rep}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{r.sessions}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{r.present}</td>
                        <td className={`py-2 px-3 text-right tabular-nums font-bold ${r.presentPct >= 90 ? 'text-[#39FF14]' : r.presentPct >= 75 ? 'text-lime-300' : r.presentPct >= 60 ? 'text-amber-300' : 'text-red-400'}`}>{r.presentPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="text-[10px] text-zinc-500 text-center">
              Sourced from data/meeting-numbers-all.json + data/meeting-numbers-2026.json — {data.dateRange.weeks.toLocaleString()} rep-weeks from the Monday meeting sheet ({data.dateRange.first} → {data.dateRange.last}). Per [[project-rcrs-leaderboards]] these are self-reported accrual numbers, NOT QB-booked revenue. Do not combine with the Commission leaderboard.
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
