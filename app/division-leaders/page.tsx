'use client';

/**
 * Division Leader Checks — standalone read-only view.
 *
 * Shows every QB check whose memo line indicates a division-leader /
 * recruiter override payment (e.g. "MARCH DIVISION LEADER",
 * "DIVISION LEADER FOR BRANDON", "BONUS RECRUIT MAY 2023").
 *
 * Built as a standalone /division-leaders page so it's shareable like
 * /chrisview and not gated by the portal. Future: fold into chrisview
 * as a tab when the page is free to edit.
 */

import { useState, useEffect } from 'react';
import { Crown, Loader2, Search, ArrowLeft, Calendar } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell,
} from 'recharts';

interface Check {
  date: string;
  entity: string;
  recipient: string;
  type: string;
  num: string;
  amount: number;
  memo: string;
}

interface Data {
  generatedAt: string;
  source: string;
  totalChecks: number;
  totalAmount: number;
  byRecipient: Array<{ recipient: string; total: number; count: number; entities: string[] }>;
  byYear: Array<{ year: string; total: number }>;
  checks: Check[];
}

const COLORS = ['#39FF14', '#60a5fa', '#fbbf24', '#fb7185', '#a78bfa', '#22d3ee', '#f97316'];

function fmtMoney(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function DivisionLeadersPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [recipientFilter, setRecipientFilter] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/division-leaders');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = data?.checks.filter(c => {
    if (recipientFilter && c.recipient !== recipientFilter) return false;
    if (q) {
      const hay = `${c.date} ${c.entity} ${c.recipient} ${c.memo} ${c.num}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }) || [];

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Chris View
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Crown className="w-5 h-5 text-[#39FF14]" />
            Division Leader Checks
          </h1>
          {data && (
            <span className="text-xs text-zinc-500 ml-auto">
              {data.totalChecks} checks · {fmtMoney(data.totalAmount)} total · refreshed {data.generatedAt}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {err && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{err}</div>
        )}
        {loading && (
          <div className="text-center py-12 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>
        )}
        {data && (
          <>
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-sm text-zinc-300 leading-relaxed">
                Override checks paid to recruiters / division leaders. Detected from QB 1099 memo lines
                containing terms like &ldquo;division leader&rdquo;, &ldquo;recruit&rdquo;, &ldquo;override&rdquo;, or &ldquo;mentor&rdquo;.
                Money flows <strong className="text-white">from the company</strong> to the recipient as a percentage of the
                recruited rep&rsquo;s commission, paid monthly. Aaron Lussi&rsquo;s total includes payments to both
                his own name and Roof Angel, LLC; Brendon&rsquo;s shows under BCM Contracting LLC.
              </p>
            </section>

            {/* Top recipients */}
            <section>
              <h2 className="text-sm font-semibold text-[#39FF14] uppercase tracking-wide mb-2">Lifetime by Recipient</h2>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byRecipient} layout="vertical" margin={{ top: 8, right: 8, bottom: 8, left: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis type="number" stroke="#71717a" fontSize={11} tickFormatter={v => `$${(v / 1000).toFixed(1)}K`} />
                      <YAxis type="category" dataKey="recipient" stroke="#71717a" fontSize={11} width={100} />
                      <Tooltip
                        contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                        formatter={(v: number | undefined) => v != null ? fmtMoney(v) : '—'}
                      />
                      <Bar dataKey="total" name="Lifetime override paid">
                        {data.byRecipient.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
                {data.byRecipient.map(r => (
                  <button
                    key={r.recipient}
                    onClick={() => setRecipientFilter(recipientFilter === r.recipient ? '' : r.recipient)}
                    className={`text-left rounded-lg p-3 border transition-colors ${
                      recipientFilter === r.recipient
                        ? 'bg-[#39FF14]/10 border-[#39FF14]/40'
                        : 'bg-zinc-900 border-zinc-800 hover:border-[#39FF14]/30'
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-wide text-zinc-500">{r.recipient}</div>
                    <div className="text-xl font-bold text-[#39FF14] mt-1">{fmtMoney(r.total)}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{r.count} checks</div>
                  </button>
                ))}
              </div>
            </section>

            {/* By year */}
            <section>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">By Year</h2>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byYear} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="year" stroke="#71717a" fontSize={11} />
                      <YAxis stroke="#71717a" fontSize={11} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                      <Tooltip
                        contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                        formatter={(v: number | undefined) => v != null ? fmtMoney(v) : '—'}
                      />
                      <Bar dataKey="total" fill="#fbbf24" name="Override paid" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            {/* Searchable check list */}
            <section>
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">All Checks</h2>
                {recipientFilter && (
                  <button onClick={() => setRecipientFilter('')} className="text-xs text-zinc-400 hover:text-white">
                    Clear filter ({recipientFilter})
                  </button>
                )}
              </div>
              <div className="relative max-w-md mb-3">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text" value={q} onChange={e => setQ(e.target.value)}
                  placeholder="Search by recipient, memo, check #, date…"
                  className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
                />
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Date</th>
                      <th className="text-left py-2 px-3 font-medium">Recipient</th>
                      <th className="text-left py-2 px-3 font-medium">Entity Paid</th>
                      <th className="text-left py-2 px-3 font-medium">Check #</th>
                      <th className="text-right py-2 px-3 font-medium">Amount</th>
                      <th className="text-left py-2 px-3 font-medium">Memo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filtered.length === 0 ? (
                      <tr><td colSpan={6} className="py-6 text-center text-zinc-500">No matches.</td></tr>
                    ) : (
                      filtered.map((c, i) => (
                        <tr key={`${c.date}-${c.num}-${i}`} className="hover:bg-zinc-800/30">
                          <td className="py-2 px-3 font-mono text-xs text-zinc-300">{c.date}</td>
                          <td className="py-2 px-3 font-medium">{c.recipient}</td>
                          <td className="py-2 px-3 text-xs text-zinc-400">{c.entity}</td>
                          <td className="py-2 px-3 font-mono text-xs text-zinc-400">{c.num || '—'}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{fmtMoney(c.amount)}</td>
                          <td className="py-2 px-3 text-xs text-zinc-300">{c.memo}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <div className="px-3 py-2 text-[11px] text-zinc-500 border-t border-zinc-800 flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  Showing {filtered.length} of {data.checks.length} checks
                  {recipientFilter && <span>· filtered to {recipientFilter}</span>}
                  {q && <span>· matching &ldquo;{q}&rdquo;</span>}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
