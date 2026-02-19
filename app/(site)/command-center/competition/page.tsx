'use client';

/**
 * RCRS Command Center - Sales Competition Page
 *
 * Visual tier progress, leaderboard, and gas card eligibility.
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Trophy,
  Fuel,
  Crown,
  ChevronRight,
  RefreshCw,
  Flame,
  Diamond,
  Award,
  Medal,
  Star,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface TierInfo {
  label: string;
  bonus: number;
  threshold: number;
}

interface RepStanding {
  name: string;
  periodTotal: number;
  monthlyTotal: number;
  periodDeals: number;
  monthlyDeals: number;
  currentTier: TierInfo | null;
  nextTier: TierInfo | null;
  amountToNext: number;
  gasCardEligible: boolean;
}

interface CompetitionData {
  success: boolean;
  period: { start: string; end: string; name: string };
  tiers: TierInfo[];
  gasCard: { amount: number; minDeals: number };
  leaderboard: RepStanding[];
  generatedAt: string;
}

// =============================================================================
// Helpers
// =============================================================================

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const TIER_COLORS: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  Bronze:   { bg: 'bg-amber-700/20',   text: 'text-amber-600',   border: 'border-amber-700/30',   glow: 'shadow-amber-700/10' },
  Silver:   { bg: 'bg-zinc-400/20',    text: 'text-zinc-300',    border: 'border-zinc-400/30',    glow: 'shadow-zinc-400/10' },
  Gold:     { bg: 'bg-yellow-500/20',  text: 'text-yellow-400',  border: 'border-yellow-500/30',  glow: 'shadow-yellow-500/10' },
  Platinum: { bg: 'bg-cyan-500/20',    text: 'text-cyan-400',    border: 'border-cyan-500/30',    glow: 'shadow-cyan-500/10' },
  Diamond:  { bg: 'bg-violet-500/20',  text: 'text-violet-400',  border: 'border-violet-500/30',  glow: 'shadow-violet-500/10' },
};

const TIER_ICONS: Record<string, React.ReactNode> = {
  Bronze:   <Medal className="h-5 w-5" />,
  Silver:   <Medal className="h-5 w-5" />,
  Gold:     <Award className="h-5 w-5" />,
  Platinum: <Star className="h-5 w-5" />,
  Diamond:  <Diamond className="h-5 w-5" />,
};

function getTierStyle(label: string) {
  return TIER_COLORS[label] || TIER_COLORS.Bronze;
}

// =============================================================================
// Component
// =============================================================================

export default function CompetitionPage() {
  const [data, setData] = useState<CompetitionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/command-center/competition');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load');
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <RefreshCw className="h-5 w-5 animate-spin" />
          Loading competition data...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-red-400 text-center">
          <p className="text-xl font-semibold">Error loading competition</p>
          <p className="text-sm mt-2">{error}</p>
          <button onClick={fetchData} className="mt-4 px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 text-zinc-300">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { period, tiers, gasCard, leaderboard } = data;
  const maxTotal = leaderboard.length > 0 ? leaderboard[0].periodTotal : 1;
  const topTierThreshold = tiers[tiers.length - 1]?.threshold || 500000;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 border border-amber-500/30">
              <Trophy className="h-8 w-8 text-amber-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Sales Competition</h1>
              <p className="text-zinc-400 text-lg">{period.name} &middot; {period.start} to {period.end}</p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Tier Legend */}
        <div className="grid grid-cols-5 gap-3">
          {tiers.map((tier) => {
            const style = getTierStyle(tier.label);
            const qualifiedCount = leaderboard.filter(r => r.periodTotal >= tier.threshold).length;
            return (
              <div
                key={tier.label}
                className={cn('rounded-xl border p-4 text-center', style.bg, style.border)}
              >
                <div className={cn('flex items-center justify-center gap-2 mb-1', style.text)}>
                  {TIER_ICONS[tier.label]}
                  <span className="font-bold text-lg">{tier.label}</span>
                </div>
                <p className={cn('text-2xl font-bold', style.text)}>${tier.bonus.toLocaleString()}</p>
                <p className="text-xs text-zinc-500 mt-1">{formatCurrency(tier.threshold)} required</p>
                <p className={cn('text-sm font-semibold mt-2', qualifiedCount > 0 ? 'text-lime-400' : 'text-zinc-600')}>
                  {qualifiedCount} qualified
                </p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Leaderboard - 2 cols */}
          <div className="col-span-2 bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-3">
              <Crown className="h-6 w-6 text-amber-400" />
              Leaderboard
            </h2>
            <div className="space-y-3">
              {leaderboard.map((rep, i) => {
                const tierStyle = rep.currentTier ? getTierStyle(rep.currentTier.label) : null;
                const progressPct = Math.min((rep.periodTotal / topTierThreshold) * 100, 100);

                return (
                  <div
                    key={rep.name}
                    className={cn(
                      'flex items-center gap-4 p-3 rounded-xl transition-colors',
                      i < 3 ? 'bg-zinc-800/70' : 'bg-zinc-800/30'
                    )}
                  >
                    {/* Rank */}
                    <span className={cn(
                      'text-xl font-bold w-8 text-center shrink-0',
                      i === 0 ? 'text-amber-400' : i === 1 ? 'text-zinc-400' : i === 2 ? 'text-orange-400' : 'text-zinc-600'
                    )}>
                      {i + 1}
                    </span>

                    {/* Name + Progress */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white truncate">{rep.name}</span>
                        {i === 0 && <Flame className="h-4 w-4 text-orange-400 animate-pulse shrink-0" />}
                        {rep.gasCardEligible && (
                          <Fuel className="h-4 w-4 text-green-400 shrink-0" title="Gas card eligible" />
                        )}
                      </div>
                      {/* Tier progress bar */}
                      <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            tierStyle ? tierStyle.text.replace('text-', 'bg-') : 'bg-zinc-500'
                          )}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right shrink-0">
                      <span className="text-lg font-bold text-lime-400">{formatCurrency(rep.periodTotal)}</span>
                      {rep.currentTier && (
                        <div className={cn('text-xs font-semibold', tierStyle?.text)}>
                          {rep.currentTier.label} · +${rep.currentTier.bonus.toLocaleString()}
                        </div>
                      )}
                      {rep.nextTier && (
                        <div className="text-xs text-zinc-500">
                          {formatCurrency(rep.amountToNext)} to {rep.nextTier.label}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Gas Card Eligibility */}
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-3">
                <Fuel className="h-6 w-6 text-green-400" />
                Gas Card — ${gasCard.amount}/mo
              </h2>
              <p className="text-sm text-zinc-400 mb-4">
                Minimum {gasCard.minDeals} deals this month
              </p>
              <div className="space-y-2">
                {leaderboard
                  .filter(r => r.monthlyDeals > 0)
                  .sort((a, b) => b.monthlyDeals - a.monthlyDeals)
                  .slice(0, 10)
                  .map((rep) => (
                    <div key={rep.name} className="flex items-center gap-2 text-sm">
                      {rep.gasCardEligible ? (
                        <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-zinc-600 shrink-0" />
                      )}
                      <span className={cn('truncate flex-1', rep.gasCardEligible ? 'text-white' : 'text-zinc-500')}>
                        {rep.name}
                      </span>
                      <span className={cn('font-mono shrink-0', rep.gasCardEligible ? 'text-green-400' : 'text-zinc-600')}>
                        {rep.monthlyDeals} deals
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Period Stats */}
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
              <h2 className="text-lg font-bold mb-3 text-zinc-300">Period Stats</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Total Reps</span>
                  <span className="text-white font-semibold">{leaderboard.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Combined Revenue</span>
                  <span className="text-lime-400 font-semibold">
                    {formatCurrency(leaderboard.reduce((s, r) => s + r.periodTotal, 0))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Gas Card Eligible</span>
                  <span className="text-green-400 font-semibold">
                    {leaderboard.filter(r => r.gasCardEligible).length}
                  </span>
                </div>
                {tiers.map(t => (
                  <div key={t.label} className="flex justify-between">
                    <span className={cn('text-zinc-500', getTierStyle(t.label).text)}>{t.label}+</span>
                    <span className="text-white font-semibold">
                      {leaderboard.filter(r => r.periodTotal >= t.threshold).length}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
