'use client';

/**
 * RCRS Sales Competition - Bi-Annual Bonus Tracker
 *
 * Displays:
 * - Current competition period (Jan-Jun / Jul-Dec)
 * - Bonus tiers with progress per rep
 * - Vacation trip qualifier ($400K)
 * - Monthly gas card winner ($500, min $75K)
 */

import * as React from 'react';
import { Trophy, Flame, Plane, Fuel, Gift, ChevronRight, Crown, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// Competition Constants
// =============================================================================

export const BONUS_TIERS = [
  { threshold: 50000, bonus: 100, label: '$50K' },
  { threshold: 75000, bonus: 250, label: '$75K' },
  { threshold: 100000, bonus: 400, label: '$100K' },
  { threshold: 125000, bonus: 550, label: '$125K' },
  { threshold: 150000, bonus: 750, label: '$150K' },
  { threshold: 200000, bonus: 1200, label: '$200K' },
  { threshold: 300000, bonus: 2000, label: '$300K' },
  { threshold: 400000, bonus: 3000, label: '$400K' },
  { threshold: 500000, bonus: 4000, label: '$500K' },
] as const;

export const VACATION_THRESHOLD = 400000;
export const GAS_CARD_AMOUNT = 500;
export const GAS_CARD_MIN_MONTHLY = 75000;

export function getCurrentPeriod(): { label: string; half: 1 | 2; start: Date; end: Date; year: number } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  if (month < 6) {
    return {
      label: `Jan – Jun ${year}`,
      half: 1,
      start: new Date(year, 0, 1),
      end: new Date(year, 5, 30, 23, 59, 59),
      year,
    };
  }
  return {
    label: `Jul – Dec ${year}`,
    half: 2,
    start: new Date(year, 6, 1),
    end: new Date(year, 11, 31, 23, 59, 59),
    year,
  };
}

export function getCurrentBonusTier(amount: number) {
  let tier = null;
  for (const t of BONUS_TIERS) {
    if (amount >= t.threshold) tier = t;
  }
  return tier;
}

export function getNextBonusTier(amount: number) {
  for (const t of BONUS_TIERS) {
    if (amount < t.threshold) return t;
  }
  return null;
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toLocaleString()}`;
}

// =============================================================================
// Compact Card (for dashboard sidebar / sales page)
// =============================================================================

interface RepCompetitionData {
  name: string;
  periodTotal: number;
  monthlyTotal: number;
}

interface SalesCompetitionCardProps {
  reps?: RepCompetitionData[];
  className?: string;
}

export function SalesCompetitionCard({ reps, className }: SalesCompetitionCardProps) {
  const period = getCurrentPeriod();

  return (
    <div className={cn('rounded-xl border border-zinc-800 bg-zinc-900 p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20">
            <Trophy className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Sales Competition</h2>
            <p className="text-sm text-zinc-500">{period.label} — Bi-Annual Bonus</p>
          </div>
        </div>
      </div>

      {/* Tier Ladder */}
      <div className="space-y-1.5 mb-4">
        {BONUS_TIERS.map((tier, i) => (
          <div key={tier.threshold} className="flex items-center gap-2 text-sm">
            <span className="w-14 text-right text-zinc-500 font-mono">{tier.label}</span>
            <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
              {reps && reps.length > 0 && (
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    tier.threshold <= 100000 ? 'bg-lime-500' :
                    tier.threshold <= 200000 ? 'bg-amber-500' :
                    tier.threshold <= 400000 ? 'bg-orange-500' :
                    'bg-red-500'
                  )}
                  style={{
                    width: `${Math.min((Math.max(...reps.map(r => r.periodTotal)) / tier.threshold) * 100, 100)}%`,
                  }}
                />
              )}
            </div>
            <span className={cn(
              'w-16 text-right font-semibold',
              i >= 7 ? 'text-amber-400' : 'text-zinc-400'
            )}>
              ${tier.bonus.toLocaleString()}
            </span>
            {tier.threshold === VACATION_THRESHOLD && (
              <span title="Vacation Trip Qualifier"><Plane className="h-4 w-4 text-cyan-400 shrink-0" /></span>
            )}
          </div>
        ))}
      </div>

      {/* Special Awards */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-800">
        <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Plane className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">Vacation Trip</span>
          </div>
          <p className="text-xs text-zinc-400">$400K in period qualifies</p>
        </div>
        <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Fuel className="h-4 w-4 text-orange-400" />
            <span className="text-xs font-semibold text-orange-400 uppercase tracking-wide">$500 Gas Card</span>
          </div>
          <p className="text-xs text-zinc-400">Top inspector/mo (min $75K)</p>
        </div>
      </div>

      {/* Top Reps Progress */}
      {reps && reps.length > 0 && (
        <div className="mt-4 pt-3 border-t border-zinc-800 space-y-2">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Period Leaders</p>
          {reps.slice(0, 5).map((rep, i) => {
            const currentTier = getCurrentBonusTier(rep.periodTotal);
            const nextTier = getNextBonusTier(rep.periodTotal);
            const progressToNext = nextTier
              ? ((rep.periodTotal - (currentTier?.threshold || 0)) / (nextTier.threshold - (currentTier?.threshold || 0))) * 100
              : 100;

            return (
              <div key={rep.name} className="flex items-center gap-2">
                <span className={cn(
                  'w-5 text-center text-xs font-bold',
                  i === 0 ? 'text-amber-400' : i === 1 ? 'text-zinc-400' : i === 2 ? 'text-orange-400' : 'text-zinc-600'
                )}>
                  {i + 1}
                </span>
                <span className="text-sm text-white truncate flex-1 min-w-0">{rep.name}</span>
                <span className="text-sm font-semibold text-lime-400 shrink-0">
                  {formatCurrency(rep.periodTotal)}
                </span>
                {currentTier && (
                  <span className="text-xs text-amber-400 shrink-0">
                    +${currentTier.bonus}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Full Presentation View (for Monday meeting)
// =============================================================================

interface SalesCompetitionPresentationProps {
  reps: RepCompetitionData[];
}

export function SalesCompetitionPresentation({ reps }: SalesCompetitionPresentationProps) {
  const period = getCurrentPeriod();
  const sortedReps = [...reps].sort((a, b) => b.periodTotal - a.periodTotal);

  // Find gas card winner (highest monthly, min $75K)
  const gasCardEligible = [...reps]
    .filter(r => r.monthlyTotal >= GAS_CARD_MIN_MONTHLY)
    .sort((a, b) => b.monthlyTotal - a.monthlyTotal);
  const gasCardWinner = gasCardEligible[0] || null;

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-5xl font-bold text-white flex items-center justify-center gap-4">
          <Trophy className="h-12 w-12 text-amber-400" />
          Sales Competition
        </h2>
        <p className="text-2xl text-zinc-400 mt-2">{period.label} — Bi-Annual Bonus</p>
      </div>

      {/* Tier Ladder - Large */}
      <div className="bg-zinc-800/80 rounded-2xl border border-zinc-700 p-8">
        <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Gift className="h-7 w-7 text-lime-400" />
          Bonus Tiers
        </h3>
        <div className="space-y-3">
          {BONUS_TIERS.map((tier) => {
            const qualifiedReps = sortedReps.filter(r => r.periodTotal >= tier.threshold);
            return (
              <div key={tier.threshold} className="flex items-center gap-4">
                <span className="w-20 text-right text-xl text-zinc-400 font-mono font-bold">{tier.label}</span>
                <ChevronRight className="h-5 w-5 text-zinc-600" />
                <div className="flex-1 flex items-center gap-3">
                  <span className={cn(
                    'text-2xl font-bold px-4 py-1 rounded-lg',
                    tier.threshold >= 400000 ? 'bg-amber-500/20 text-amber-400' :
                    tier.threshold >= 200000 ? 'bg-orange-500/20 text-orange-400' :
                    'bg-lime-500/20 text-lime-400'
                  )}>
                    ${tier.bonus.toLocaleString()} bonus
                  </span>
                  {tier.threshold === VACATION_THRESHOLD && (
                    <span className="inline-flex items-center gap-1 text-lg text-cyan-400 bg-cyan-500/20 px-3 py-1 rounded-lg">
                      <Plane className="h-5 w-5" /> + Vacation Trip!
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {qualifiedReps.length > 0 ? (
                    <span className="text-lg text-lime-400 font-semibold">
                      {qualifiedReps.length} qualified
                    </span>
                  ) : (
                    <span className="text-lg text-zinc-600">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rep Standings */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left: Top reps with tier progress */}
        <div className="bg-zinc-800/80 rounded-2xl border border-zinc-700 p-8">
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Crown className="h-7 w-7 text-amber-400" />
            Period Standings
          </h3>
          <div className="space-y-4">
            {sortedReps.slice(0, 8).map((rep, i) => {
              const currentTier = getCurrentBonusTier(rep.periodTotal);
              const nextTier = getNextBonusTier(rep.periodTotal);
              const vacationQualified = rep.periodTotal >= VACATION_THRESHOLD;

              return (
                <div key={rep.name} className={cn(
                  'flex items-center gap-4 p-3 rounded-xl',
                  i < 3 ? 'bg-zinc-700/50' : 'bg-zinc-800/50'
                )}>
                  <span className={cn(
                    'text-2xl font-bold w-8 text-center',
                    i === 0 ? 'text-amber-400' : i === 1 ? 'text-zinc-400' : i === 2 ? 'text-orange-400' : 'text-zinc-600'
                  )}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-semibold text-white truncate">{rep.name}</span>
                      {vacationQualified && <Plane className="h-5 w-5 text-cyan-400" />}
                      {i === 0 && <Flame className="h-5 w-5 text-orange-400 animate-pulse" />}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-lg font-bold text-lime-400">{formatCurrency(rep.periodTotal)}</span>
                      {currentTier && (
                        <span className="text-sm bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
                          +${currentTier.bonus} earned
                        </span>
                      )}
                      {nextTier && (
                        <span className="text-sm text-zinc-500">
                          {formatCurrency(nextTier.threshold - rep.periodTotal)} to next
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Special Awards */}
        <div className="space-y-6">
          {/* Vacation Qualifiers */}
          <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-2xl border border-cyan-500/30 p-8">
            <h3 className="text-2xl font-bold text-cyan-400 mb-4 flex items-center gap-3">
              <Plane className="h-7 w-7" />
              Vacation Trip Qualifiers
            </h3>
            <p className="text-zinc-400 mb-4">Reach $400K in this period to qualify</p>
            {sortedReps.filter(r => r.periodTotal >= VACATION_THRESHOLD).length > 0 ? (
              <div className="space-y-2">
                {sortedReps.filter(r => r.periodTotal >= VACATION_THRESHOLD).map(rep => (
                  <div key={rep.name} className="flex items-center gap-3 text-white text-xl">
                    <Star className="h-5 w-5 text-cyan-400" />
                    <span className="font-semibold">{rep.name}</span>
                    <span className="text-cyan-400">{formatCurrency(rep.periodTotal)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-zinc-500 text-lg">
                No qualifiers yet — keep pushing!
                {sortedReps.length > 0 && (
                  <p className="mt-2 text-sm">
                    Closest: {sortedReps[0].name} ({formatCurrency(VACATION_THRESHOLD - sortedReps[0].periodTotal)} away)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Gas Card */}
          <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-2xl border border-orange-500/30 p-8">
            <h3 className="text-2xl font-bold text-orange-400 mb-4 flex items-center gap-3">
              <Fuel className="h-7 w-7" />
              $500 Gas Card — This Month
            </h3>
            <p className="text-zinc-400 mb-4">Top sales inspector (minimum $75K monthly)</p>
            {gasCardWinner ? (
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-2xl font-bold text-white">
                  {gasCardWinner.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{gasCardWinner.name}</p>
                  <p className="text-xl text-orange-400">{formatCurrency(gasCardWinner.monthlyTotal)} this month</p>
                </div>
              </div>
            ) : (
              <p className="text-zinc-500 text-lg">No one has hit $75K this month yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
