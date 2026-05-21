'use client';

/**
 * Multi-Rep Commission Split Visibility.
 *
 * Surfaces every commission job where two or more reps were paid for
 * the same R-number / jobNumber. Today this is buried in QB; here it's
 * one click. Shows:
 *   - KPI row (total split jobs, $ split, # unique pairings)
 *   - Bar chart of split-job count per rep
 *   - Table of split jobs with the per-rep payment breakdown
 *   - Table of rep pairs (who works with whom most)
 *   - "Memo-flagged" rows where the customer string itself mentions
 *     split/shared/override/% (rare but worth surfacing)
 *
 * Public read-only. Mirrors style of /chrisview/leaders.
 */

import { useState, useEffect, useMemo } from 'react';
import { Users, Loader2, Search, ArrowLeft, Share2 } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell,
} from 'recharts';

interface SplitPayment {
  rep: string;
  amount: number;
  date: string;
  customer: string;
  memoFlagged?: boolean;
}

interface SplitJob {
  jobNumber: string;
  customer: string;
  totalPaid: number;
  payments: SplitPayment[];
  partners: string[];
  firstPaidDate: string;
  lastPaidDate: string;
}

interface RepSplitStats {
  rep: string;
  splitJobCount: number;
  splitAmount: number;
  soloJobCount: number;
  soloAmount: number;
  splitShare: number;
  topPartners: Array<{ partner: string; jobCount: number; totalAmount: number }>;
}

interface RepPair {
  rep1: string;
  rep2: string;
  jobCount: number;
  totalAmount: number;
}

interface MemoFlaggedRow {
  rep: string;
  date: string;
  amount: number;
  customer: string;
  jobNumber: string;
  matchedTerm: string;
}

interface Data {
  generatedAt: string;
  totalCommissionRows: number;
  totalNonZeroRows: number;
  totalSplitJobs: number;
  totalSplitPayments: number;
  totalSplitAmount: number;
  uniquePairings: number;
  splitJobs: SplitJob[];
  byRep: RepSplitStats[];
  pairs: RepPair[];
  memoFlagged: MemoFlaggedRow[];
}

const COLORS = ['#39FF14', '#60a5fa', '#fbbf24', '#fb7185', '#a78bfa', '#22d3ee', '#f97316', '#10b981'];

function fmtMoney(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtMoneyCents(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function MultiRepSplitsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [repFilter, setRepFilter] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/chrisview-multi-rep-splits');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredJobs = useMemo(() => {
    if (!data) return [];
    return data.splitJobs.filter(j => {
      if (repFilter && !j.partners.includes(repFilter)) return false;
      if (q) {
        const hay = `${j.jobNumber} ${j.customer} ${j.partners.join(' ')}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [data, q, repFilter]);

  const filteredPairs = useMemo(() => {
    if (!data) return [];
    return data.pairs.filter(p => {
      if (repFilter && p.rep1 !== repFilter && p.rep2 !== repFilter) return false;
      return true;
    });
  }, [data, repFilter]);

  // Chart data — top 12 reps by split job count
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.byRep
      .filter(r => r.splitJobCount > 0)
      .slice(0, 12)
      .map(r => ({ rep: r.rep, splits: r.splitJobCount, amount: r.splitAmount }));
  }, [data]);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Chris View
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Share2 className="w-5 h-5 text-[#39FF14]" />
            Multi-Rep Commission Splits
          </h1>
          {data && (
            <span className="text-xs text-zinc-500 ml-auto">
              {data.totalSplitJobs} split jobs · {fmtMoney(data.totalSplitAmount)} · refreshed{' '}
              {new Date(data.generatedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{err}</div>
        )}
        {loading && (
          <div className="text-center py-12 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading split detection…
          </div>
        )}
        {data && (
          <>
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-sm text-zinc-300 leading-relaxed">
                Every commission job that was paid to <strong className="text-white">two or more reps</strong>.
                Detection groups the 1099 commission ledger by job number — if multiple distinct reps were
                paid on the same job, it&rsquo;s flagged here. These usually reflect handoffs,
                mentorship/training splits, or override payments routed through BCM / Roof Angel / Rudys.
                <span className="block mt-2 text-zinc-500 text-xs">
                  Note: a job with multiple payments to the same rep (initial + supplement) is NOT a split.
                  We can&rsquo;t always distinguish a true handoff from a billing oddity without the QB memo
                  line, so use the per-payment table on each row to inspect.
                </span>
              </p>
            </section>

            {/* KPI row */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500">Split Jobs</div>
                <div className="text-2xl font-bold text-[#39FF14] mt-1">{data.totalSplitJobs}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">of {data.totalNonZeroRows.toLocaleString()} commission rows</div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500">Split Payments</div>
                <div className="text-2xl font-bold text-[#60a5fa] mt-1">{data.totalSplitPayments}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">commission rows on split jobs</div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500">$ on Split Jobs</div>
                <div className="text-2xl font-bold text-[#fbbf24] mt-1">{fmtMoney(data.totalSplitAmount)}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">combined paid to all parties</div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500">Unique Pairings</div>
                <div className="text-2xl font-bold text-[#a78bfa] mt-1">{data.uniquePairings}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">distinct rep-pair combos</div>
              </div>
            </section>

            {/* Bar chart: splits per rep */}
            {chartData.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-[#39FF14] uppercase tracking-wide mb-2">
                  Split Job Count by Rep (Top 12)
                </h2>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 8, right: 12, bottom: 8, left: 120 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis type="number" stroke="#71717a" fontSize={11} allowDecimals={false} />
                        <YAxis type="category" dataKey="rep" stroke="#71717a" fontSize={11} width={120} />
                        <Tooltip
                          contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                          formatter={(v: number | undefined, name) => {
                            if (name === 'amount') return v != null ? fmtMoneyCents(v) : '—';
                            return v;
                          }}
                        />
                        <Bar dataKey="splits" name="Split jobs">
                          {chartData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>
            )}

            {/* Per-rep cards — click to filter */}
            <section>
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Per-Rep Split Stats</h2>
                {repFilter && (
                  <button
                    onClick={() => setRepFilter('')}
                    className="text-xs text-zinc-400 hover:text-white"
                  >
                    Clear filter ({repFilter})
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.byRep.filter(r => r.splitJobCount > 0).map(r => (
                  <button
                    key={r.rep}
                    onClick={() => setRepFilter(repFilter === r.rep ? '' : r.rep)}
                    className={`text-left rounded-lg p-3 border transition-colors ${
                      repFilter === r.rep
                        ? 'bg-[#39FF14]/10 border-[#39FF14]/40'
                        : 'bg-zinc-900 border-zinc-800 hover:border-[#39FF14]/30'
                    }`}
                  >
                    <div className="flex items-baseline justify-between">
                      <div className="font-semibold text-sm">{r.rep}</div>
                      <div className="text-xs text-zinc-500">{Math.round(r.splitShare * 100)}% split</div>
                    </div>
                    <div className="mt-1 flex items-baseline gap-3">
                      <div>
                        <span className="text-lg font-bold text-[#39FF14]">{r.splitJobCount}</span>
                        <span className="text-[10px] text-zinc-500 ml-1">jobs</span>
                      </div>
                      <div className="text-xs text-zinc-300">{fmtMoney(r.splitAmount)}</div>
                    </div>
                    {r.topPartners.length > 0 && (
                      <div className="mt-2 text-[11px] text-zinc-400 leading-snug">
                        <span className="text-zinc-500">Top partner: </span>
                        {r.topPartners[0].partner}{' '}
                        <span className="text-zinc-500">({r.topPartners[0].jobCount})</span>
                      </div>
                    )}
                    <div className="mt-1 text-[10px] text-zinc-500">
                      Solo: {r.soloJobCount} jobs · {fmtMoney(r.soloAmount)}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Rep-pair table */}
            <section>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                Top Rep Pairs (Who Works With Whom)
              </h2>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Rep 1</th>
                      <th className="text-left py-2 px-3 font-medium">Rep 2</th>
                      <th className="text-right py-2 px-3 font-medium">Shared Jobs</th>
                      <th className="text-right py-2 px-3 font-medium">Combined $</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filteredPairs.length === 0 ? (
                      <tr><td colSpan={4} className="py-6 text-center text-zinc-500">No matching pairs.</td></tr>
                    ) : (
                      filteredPairs.slice(0, 50).map((p) => (
                        <tr key={`${p.rep1}|${p.rep2}`} className="hover:bg-zinc-800/30">
                          <td className="py-2 px-3 font-medium">{p.rep1}</td>
                          <td className="py-2 px-3 font-medium">{p.rep2}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{p.jobCount}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-zinc-300">{fmtMoneyCents(p.totalAmount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <div className="px-3 py-2 text-[11px] text-zinc-500 border-t border-zinc-800">
                  Showing {Math.min(filteredPairs.length, 50)} of {filteredPairs.length} pairs
                  {repFilter && <span> · filtered to {repFilter}</span>}
                </div>
              </div>
            </section>

            {/* Split jobs table */}
            <section>
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
                  Split Jobs ({filteredJobs.length})
                </h2>
              </div>
              <div className="relative max-w-md mb-3">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text" value={q} onChange={e => setQ(e.target.value)}
                  placeholder="Search by job#, customer, rep…"
                  className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
                />
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Job #</th>
                      <th className="text-left py-2 px-3 font-medium">Customer</th>
                      <th className="text-left py-2 px-3 font-medium">Partners</th>
                      <th className="text-right py-2 px-3 font-medium">Total Paid</th>
                      <th className="text-left py-2 px-3 font-medium">First</th>
                      <th className="text-left py-2 px-3 font-medium">Last</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filteredJobs.length === 0 ? (
                      <tr><td colSpan={6} className="py-6 text-center text-zinc-500">No matching jobs.</td></tr>
                    ) : (
                      filteredJobs.slice(0, 200).map((j) => (
                        <SplitJobRow
                          key={j.jobNumber}
                          job={j}
                          onRepClick={(rep) => setRepFilter(repFilter === rep ? '' : rep)}
                          activeRep={repFilter}
                        />
                      ))
                    )}
                  </tbody>
                </table>
                <div className="px-3 py-2 text-[11px] text-zinc-500 border-t border-zinc-800">
                  Showing {Math.min(filteredJobs.length, 200)} of {filteredJobs.length} split jobs
                  {repFilter && <span> · filtered to {repFilter}</span>}
                </div>
              </div>
            </section>

            {/* Memo-flagged rows */}
            {data.memoFlagged.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                  Memo-Flagged Rows ({data.memoFlagged.length})
                </h2>
                <p className="text-[11px] text-zinc-500 mb-2">
                  Commission rows whose customer/memo text mentions split / shared / override / % / 50&#8260;50.
                  Most hits are just addresses with words like &ldquo;Trail&rdquo; — scan but don&rsquo;t over-read.
                </p>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium">Date</th>
                        <th className="text-left py-2 px-3 font-medium">Rep</th>
                        <th className="text-right py-2 px-3 font-medium">Amount</th>
                        <th className="text-left py-2 px-3 font-medium">Job #</th>
                        <th className="text-left py-2 px-3 font-medium">Customer / Memo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {data.memoFlagged.slice(0, 100).map((m, i) => (
                        <tr key={`${m.date}-${m.jobNumber}-${i}`} className="hover:bg-zinc-800/30">
                          <td className="py-2 px-3 font-mono text-xs text-zinc-300">{m.date}</td>
                          <td className="py-2 px-3 font-medium">{m.rep}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{fmtMoneyCents(m.amount)}</td>
                          <td className="py-2 px-3 font-mono text-xs text-zinc-400">{m.jobNumber || '—'}</td>
                          <td className="py-2 px-3 text-xs text-zinc-300">{m.customer}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function SplitJobRow({
  job,
  onRepClick,
  activeRep,
}: {
  job: SplitJob;
  onRepClick: (rep: string) => void;
  activeRep: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="hover:bg-zinc-800/30 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <td className="py-2 px-3 font-mono text-xs text-zinc-300">{job.jobNumber}</td>
        <td className="py-2 px-3 text-xs">{job.customer}</td>
        <td className="py-2 px-3 text-xs">
          <div className="flex flex-wrap gap-1">
            {job.partners.map(p => (
              <button
                key={p}
                onClick={(e) => { e.stopPropagation(); onRepClick(p); }}
                className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors flex items-center gap-1 ${
                  activeRep === p
                    ? 'bg-[#39FF14]/20 border-[#39FF14]/50 text-[#39FF14]'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-[#39FF14]/40'
                }`}
              >
                <Users className="w-3 h-3" />
                {p}
              </button>
            ))}
          </div>
        </td>
        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{fmtMoneyCents(job.totalPaid)}</td>
        <td className="py-2 px-3 font-mono text-xs text-zinc-400">{job.firstPaidDate}</td>
        <td className="py-2 px-3 font-mono text-xs text-zinc-400">{job.lastPaidDate}</td>
      </tr>
      {open && (
        <tr className="bg-zinc-950/50">
          <td colSpan={6} className="py-2 px-3">
            <div className="text-[11px] text-zinc-500 mb-1">Per-payment detail ({job.payments.length}):</div>
            <table className="w-full text-xs">
              <thead className="text-[10px] text-zinc-500 uppercase">
                <tr>
                  <th className="text-left py-1 px-2 font-medium">Date</th>
                  <th className="text-left py-1 px-2 font-medium">Rep</th>
                  <th className="text-right py-1 px-2 font-medium">Amount</th>
                  <th className="text-left py-1 px-2 font-medium">Customer/Memo</th>
                </tr>
              </thead>
              <tbody>
                {job.payments.map((p, i) => (
                  <tr key={i}>
                    <td className="py-1 px-2 font-mono text-zinc-400">{p.date}</td>
                    <td className="py-1 px-2">{p.rep}</td>
                    <td className="py-1 px-2 text-right tabular-nums text-zinc-300">{fmtMoneyCents(p.amount)}</td>
                    <td className={`py-1 px-2 ${p.memoFlagged ? 'text-amber-300' : 'text-zinc-400'}`}>{p.customer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
