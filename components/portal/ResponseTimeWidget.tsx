'use client';

import { useState, useEffect } from 'react';
import { Clock, AlertTriangle, Loader2, Award } from 'lucide-react';

interface MyResponseTime {
  success: boolean;
  rep?: { slug: string; name: string };
  window?: string;
  assignments?: number;
  responded?: number;
  avgMinutes?: number;
  medianMinutes?: number;
  p95Minutes?: number;
  slaBreaches?: number;
  reassignedOut?: number;
}

interface LeaderboardBar {
  rank: number;
  barWidth: number;
  isYou: boolean;
  label: string;
}

interface LeaderboardResp {
  success: boolean;
  hasData: boolean;
  message?: string;
  bars?: LeaderboardBar[];
}

/**
 * Response Time widget for the rep dashboard. Shows the rep's own numbers
 * (avg / median / p95 / SLA breaches) over the last 30 days, plus an
 * anonymized bar leaderboard where only the viewer's own row is named.
 *
 * Privacy notes (mandated by config):
 *   - The leaderboard API never returns absolute minute values for other reps
 *   - No time-range filter
 *   - No individual filter
 *   - Customers are denied at the API layer
 */
export default function ResponseTimeWidget() {
  const [me, setMe] = useState<MyResponseTime | null>(null);
  const [board, setBoard] = useState<LeaderboardResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [meRes, boardRes] = await Promise.all([
          fetch('/api/portal/sales/my-response-time'),
          fetch('/api/portal/sales/response-time-leaderboard'),
        ]);
        const meJson = meRes.ok ? await meRes.json() : { success: false };
        const boardJson = boardRes.ok ? await boardRes.json() : { success: false, hasData: false };
        if (!cancelled) {
          setMe(meJson);
          setBoard(boardJson);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-2 text-neutral-500">
          <Loader2 className="animate-spin" size={16} /> Loading response-time data…
        </div>
      </div>
    );
  }

  const hasMine = me?.success && (me.assignments ?? 0) > 0;
  const breachPct = hasMine && (me.assignments ?? 0) > 0
    ? Math.round(((me.slaBreaches ?? 0) / (me.assignments ?? 1)) * 100)
    : 0;

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-6">
      {/* ── Your numbers ───────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
            <Clock size={20} className="text-orange-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Your Response Time</h3>
            <p className="text-xs text-neutral-500">last 30 days — how quickly you reach assigned leads</p>
          </div>
        </div>

        {!hasMine ? (
          <p className="text-sm text-neutral-500 italic">No assigned leads in the last 30 days. Numbers will appear here once you've worked a few leads through the response timer.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-white tabular-nums">{me?.avgMinutes ?? 0}<span className="text-sm text-neutral-500">min</span></div>
                <div className="text-xs text-neutral-500 mt-0.5">Avg first contact</div>
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-white tabular-nums">{me?.medianMinutes ?? 0}<span className="text-sm text-neutral-500">min</span></div>
                <div className="text-xs text-neutral-500 mt-0.5">Median</div>
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-white tabular-nums">{me?.p95Minutes ?? 0}<span className="text-sm text-neutral-500">min</span></div>
                <div className="text-xs text-neutral-500 mt-0.5">p95 (slowest 5%)</div>
              </div>
              <div className={`rounded-xl p-3 text-center border ${
                (me?.slaBreaches ?? 0) > 0
                  ? 'bg-red-500/[0.05] border-red-500/20'
                  : 'bg-emerald-500/[0.05] border-emerald-500/20'
              }`}>
                <div className={`text-2xl font-bold tabular-nums ${(me?.slaBreaches ?? 0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {me?.slaBreaches ?? 0}
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">SLA breaches ({breachPct}%)</div>
              </div>
            </div>
            <p className="text-xs text-neutral-500 mt-3">
              {(me?.responded ?? 0)} responded · {(me?.assignments ?? 0)} assigned
              {(me?.reassignedOut ?? 0) > 0 ? ` · ${me?.reassignedOut} reassigned out` : ''}
            </p>
          </>
        )}
      </div>

      {/* ── Anonymized leaderboard ─────────────────────────────────── */}
      <div className="border-t border-white/5 pt-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
            <Award size={20} className="text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Team Response Leaderboard</h3>
            <p className="text-xs text-neutral-500">relative ranking — actual response times not shown</p>
          </div>
        </div>

        {!board?.hasData ? (
          <p className="text-sm text-neutral-500 italic">{board?.message || 'Not enough data yet.'}</p>
        ) : (
          <div className="space-y-2">
            {board.bars?.map((b) => (
              <div key={b.rank} className="flex items-center gap-3">
                <div className={`w-8 text-xs font-bold tabular-nums ${b.isYou ? 'text-amber-300' : 'text-neutral-500'}`}>
                  #{b.rank}
                </div>
                <div className="flex-1 relative h-7 bg-white/[0.03] rounded-lg overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-lg transition-all duration-500 ${
                      b.isYou
                        ? 'bg-gradient-to-r from-amber-500/40 to-amber-500/60'
                        : 'bg-white/10'
                    }`}
                    style={{ width: `${b.barWidth}%` }}
                  />
                  <span className={`absolute inset-y-0 left-3 flex items-center text-xs font-medium ${
                    b.isYou ? 'text-amber-100' : 'text-neutral-400'
                  }`}>
                    {b.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-neutral-600 mt-3">Bars show relative ranking only. Other reps' actual times are not shown to anyone.</p>
      </div>
    </div>
  );
}
