'use client';

/**
 * RCRS March Madness 2026 - Momentum Bracket
 *
 * Carry-forward single-elimination bracket where winners carry 50% of their
 * previous round's sales into the next round as "carryForward".
 *
 * effectiveTotal = weekSales + carryForward
 * carryForward = 0 for Round 1, 0 for BYE wins
 *
 * "Best Eliminated" award goes to the eliminated player with highest total
 * sales across all their rounds.
 *
 * Data source: /api/data/march-madness/momentum
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Flame,
  Timer,
  RefreshCw,
  Crown,
  Swords,
  ArrowLeft,
  ChevronRight,
  Star,
  Zap,
  Target,
  Medal,
  TrendingUp,
  Calendar,
  ArrowUpRight,
  Shield,
  Activity,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface MomentumSeed {
  seed: number;
  name: string;
  weekSales: number;
  carryForward: number;
  effectiveTotal: number;
  winner: boolean;
}

interface MomentumMatch {
  matchId: string;
  topSeed: MomentumSeed;
  bottomSeed: MomentumSeed | null; // null = BYE
}

interface Round {
  round: number;
  name: string;
  weekStart: string;
  weekEnd: string;
  status: 'upcoming' | 'active' | 'completed';
}

interface Participant {
  seed: number;
  name: string;
  ytdSales: number;
  nickname: string;
}

interface TournamentInfo {
  id: string;
  name: string;
  carryForwardRate: number;
  currentRound: number;
  [key: string]: unknown;
}

interface EliminatedStat {
  name: string;
  seed: number;
  eliminatedRound: number;
  totalSales: number;
  roundsPlayed: number;
}

interface BestEliminated {
  name: string;
  totalSales: number;
  prize: string;
}

interface Prizes {
  champion: string;
  runnerUp: string;
  bestEliminated: string;
  mvpWeek: string;
}

interface MomentumData {
  tournament: TournamentInfo;
  participants: Participant[];
  rounds: Round[];
  bracket: {
    round1: MomentumMatch[];
    round2: MomentumMatch[];
    round3: MomentumMatch[];
  };
  eliminatedStats: EliminatedStat[];
  bestEliminated: BestEliminated | null;
  prizes: Prizes;
  champion?: string | null;
}

// =============================================================================
// Helpers
// =============================================================================

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getCountdown(targetDate: string): { days: number; hours: number; minutes: number } {
  const now = new Date();
  const target = new Date(targetDate + 'T00:00:00');
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0 };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { days, hours, minutes };
}

function getSeedColor(seed: number): string {
  const colors: Record<number, string> = {
    1: 'from-amber-500 to-yellow-400',
    2: 'from-zinc-400 to-zinc-300',
    3: 'from-orange-600 to-amber-500',
    4: 'from-emerald-500 to-green-400',
    5: 'from-blue-500 to-cyan-400',
    6: 'from-purple-500 to-violet-400',
    7: 'from-red-500 to-rose-400',
  };
  return colors[seed] || 'from-zinc-600 to-zinc-500';
}

// =============================================================================
// Sub-Components
// =============================================================================

/** Pulsing basketball icon */
function BasketballIcon({ className }: { className?: string }) {
  return (
    <span className={cn('inline-block', className)} role="img" aria-label="basketball">
      <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
        <circle cx="18" cy="18" r="16" fill="#F97316" stroke="#EA580C" strokeWidth="1.5" />
        <path d="M2 18 H34" stroke="#7C2D12" strokeWidth="1" strokeLinecap="round" />
        <path d="M18 2 V34" stroke="#7C2D12" strokeWidth="1" strokeLinecap="round" />
        <path d="M6 4 C14 10, 14 26, 6 32" stroke="#7C2D12" strokeWidth="1" fill="none" strokeLinecap="round" />
        <path d="M30 4 C22 10, 22 26, 30 32" stroke="#7C2D12" strokeWidth="1" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Momentum energy particles */
function MomentumParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full animate-ping"
          style={{
            background: i % 3 === 0 ? '#39FF14' : i % 3 === 1 ? '#F97316' : '#22D3EE',
            left: `${10 + Math.random() * 80}%`,
            top: `${10 + Math.random() * 80}%`,
            animationDelay: `${i * 0.25}s`,
            animationDuration: `${1.2 + Math.random() * 1.8}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Energy trail effect for carry-forward visualization */
function EnergyTrail() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.15), transparent)',
          animation: 'pulse 2s ease-in-out infinite',
        }}
      />
    </div>
  );
}

/** Momentum matchup card - enhanced to show carryForward */
function MatchupCard({
  match,
  roundStatus,
  isChampionship,
  roundNumber,
}: {
  match: MomentumMatch;
  roundStatus: Round['status'];
  isChampionship?: boolean;
  roundNumber: number;
}) {
  const isBye = match.bottomSeed === null;
  const isActive = roundStatus === 'active';
  const isCompleted = roundStatus === 'completed';

  return (
    <div
      className={cn(
        'relative rounded-xl border transition-all duration-300',
        isChampionship && 'ring-2',
        isActive && 'border-[#39FF14]/50 bg-neutral-900/90 shadow-lg shadow-[#39FF14]/10 ring-[#39FF14]/20',
        isCompleted && 'border-neutral-700 bg-neutral-900/60',
        !isActive && !isCompleted && 'border-neutral-800 bg-neutral-900/40 opacity-60',
        isChampionship && isActive && 'ring-[#39FF14]/40 border-[#39FF14]/60',
      )}
    >
      {/* Active round glow */}
      {isActive && (
        <div className="absolute -inset-px rounded-xl bg-gradient-to-r from-[#39FF14]/10 via-transparent to-[#39FF14]/10 animate-pulse" />
      )}

      {/* LIVE badge */}
      {isActive && !isBye && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
          <span className="px-3 py-0.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1 shadow-lg shadow-red-600/40">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </span>
        </div>
      )}

      <div className="relative z-[1] p-3 space-y-1">
        {/* Top Seed */}
        <MomentumSeedRow
          seed={match.topSeed}
          isWinner={match.topSeed.winner}
          roundStatus={roundStatus}
          showSales={!isBye}
          roundNumber={roundNumber}
        />

        {/* VS divider */}
        {!isBye && (
          <div className="flex items-center gap-2 px-2">
            <div className="flex-1 h-px bg-neutral-700" />
            <span className={cn(
              'text-[10px] font-black tracking-wider',
              isActive ? 'text-[#39FF14]' : 'text-neutral-600',
            )}>
              VS
            </span>
            <div className="flex-1 h-px bg-neutral-700" />
          </div>
        )}

        {/* Bottom Seed or BYE */}
        {isBye ? (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-neutral-800/50">
            <div className="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center">
              <span className="text-[10px] text-neutral-500 font-bold">--</span>
            </div>
            <span className="text-xs text-neutral-500 italic font-medium">BYE</span>
            <span className="ml-auto text-[10px] text-neutral-600 font-medium">Auto-advance (no carry)</span>
          </div>
        ) : (
          <MomentumSeedRow
            seed={match.bottomSeed!}
            isWinner={match.bottomSeed!.winner}
            roundStatus={roundStatus}
            showSales
            roundNumber={roundNumber}
          />
        )}
      </div>
    </div>
  );
}

/** Individual seed/player row enhanced with carry-forward display */
function MomentumSeedRow({
  seed,
  isWinner,
  roundStatus,
  showSales,
  roundNumber,
}: {
  seed: MomentumSeed;
  isWinner: boolean;
  roundStatus: Round['status'];
  showSales: boolean;
  roundNumber: number;
}) {
  const isCompleted = roundStatus === 'completed';
  const isActive = roundStatus === 'active';
  const eliminated = isCompleted && !isWinner;
  const hasCarry = seed.carryForward > 0;

  return (
    <div
      className={cn(
        'relative flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all',
        isWinner && isCompleted && 'bg-[#39FF14]/10 border border-[#39FF14]/20',
        eliminated && 'opacity-40',
        isActive && 'bg-neutral-800/70',
        !isActive && !isCompleted && 'bg-neutral-800/30',
      )}
    >
      {/* Winner energy effect */}
      {isWinner && isCompleted && <MomentumParticles />}

      {/* Carry-forward energy trail */}
      {hasCarry && (isActive || isCompleted) && <EnergyTrail />}

      {/* Seed number */}
      <div
        className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 bg-gradient-to-br',
          getSeedColor(seed.seed),
          eliminated && 'grayscale',
        )}
      >
        <span className="text-white drop-shadow">{seed.seed}</span>
      </div>

      {/* Name */}
      <span
        className={cn(
          'font-bold text-sm truncate',
          isWinner && isCompleted ? 'text-[#39FF14]' : eliminated ? 'text-neutral-500 line-through' : 'text-white',
        )}
        style={{ minWidth: 0, flex: '1 1 0' }}
      >
        {seed.name}
      </span>

      {/* Sales breakdown (carry + fresh = effective) */}
      {showSales && (isCompleted || isActive) && (
        <div className="flex items-center gap-1 shrink-0">
          {/* Carry-forward badge */}
          {hasCarry && (
            <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-700/30 text-[10px] font-mono font-bold text-cyan-400 flex items-center gap-0.5">
              <ArrowUpRight className="w-2.5 h-2.5" />
              +{formatCurrency(seed.carryForward)}
            </span>
          )}

          {/* Week sales */}
          {seed.weekSales > 0 && (
            <span
              className={cn(
                'text-[10px] font-mono font-bold',
                eliminated ? 'text-neutral-600' : 'text-neutral-500',
              )}
            >
              {hasCarry ? `+${formatCurrency(seed.weekSales)}` : ''}
            </span>
          )}

          {/* Effective total (the main number) */}
          <span
            className={cn(
              'text-xs font-mono font-black shrink-0 ml-0.5',
              isWinner && isCompleted
                ? 'text-[#39FF14]'
                : eliminated
                  ? 'text-neutral-600'
                  : 'text-white',
            )}
          >
            {seed.effectiveTotal > 0
              ? (hasCarry ? '= ' : '') + formatCurrency(seed.effectiveTotal)
              : seed.weekSales > 0
                ? formatCurrency(seed.weekSales)
                : '--'}
          </span>
        </div>
      )}

      {/* Winner crown */}
      {isWinner && isCompleted && (
        <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-bounce" style={{ animationDuration: '2s' }} />
      )}
    </div>
  );
}

/** Bracket connector lines (SVG) */
function BracketConnectors({
  fromCount,
  toCount,
  isActive,
}: {
  fromCount: number;
  toCount: number;
  roundIndex: number;
  isActive: boolean;
}) {
  const cardHeight = 140; // Taller cards due to carry display
  const gap = 16;
  const totalFromHeight = fromCount * cardHeight + (fromCount - 1) * gap;
  const totalToHeight = toCount * cardHeight + (toCount - 1) * gap;
  const svgHeight = Math.max(totalFromHeight, totalToHeight);
  const toOffset = (totalFromHeight - totalToHeight) / 2;

  return (
    <svg
      className="shrink-0 hidden lg:block"
      width="48"
      height={svgHeight}
      viewBox={`0 0 48 ${svgHeight}`}
    >
      {/* Carry-forward flow indicator */}
      <defs>
        <linearGradient id="carryGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={isActive ? '#22D3EE' : '#404040'} stopOpacity="0.6" />
          <stop offset="50%" stopColor={isActive ? '#39FF14' : '#505050'} stopOpacity="0.8" />
          <stop offset="100%" stopColor={isActive ? '#22D3EE' : '#404040'} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {Array.from({ length: toCount }).map((_, i) => {
        const fromIdx1 = i * 2;
        const fromIdx2 = i * 2 + 1;
        const fromY1 = fromIdx1 * (cardHeight + gap) + cardHeight / 2;
        const fromY2 = fromIdx2 < fromCount ? fromIdx2 * (cardHeight + gap) + cardHeight / 2 : fromY1;
        const toY = toOffset + i * (cardHeight + gap) + cardHeight / 2;

        return (
          <g key={i}>
            <path
              d={`M 0 ${fromY1} C 20 ${fromY1}, 20 ${toY}, 48 ${toY}`}
              stroke="url(#carryGrad)"
              strokeWidth="2.5"
              fill="none"
              strokeDasharray={isActive ? undefined : '4 4'}
              className={isActive ? 'animate-pulse' : ''}
            />
            {fromIdx2 < fromCount && (
              <path
                d={`M 0 ${fromY2} C 20 ${fromY2}, 20 ${toY}, 48 ${toY}`}
                stroke="url(#carryGrad)"
                strokeWidth="2.5"
                fill="none"
                strokeDasharray={isActive ? undefined : '4 4'}
                className={isActive ? 'animate-pulse' : ''}
              />
            )}
            {/* Small momentum arrow at destination */}
            <polygon
              points={`44,${toY - 4} 48,${toY} 44,${toY + 4}`}
              fill={isActive ? '#22D3EE' : '#505050'}
              opacity={0.7}
            />
          </g>
        );
      })}
    </svg>
  );
}

/** Prize card */
function PrizeCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors',
      highlight
        ? 'bg-gradient-to-r from-orange-950/40 to-amber-950/30 border-orange-700/30 hover:border-orange-500/40'
        : 'bg-neutral-900/80 border-neutral-800 hover:border-[#39FF14]/30',
    )}>
      <div className="shrink-0">{icon}</div>
      <div>
        <p className={cn(
          'text-[11px] uppercase tracking-wider font-semibold',
          highlight ? 'text-orange-400' : 'text-neutral-500',
        )}>{label}</p>
        <p className="text-sm font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

/** Round status indicator */
function RoundBadge({ round }: { round: Round }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide',
        round.status === 'active' && 'bg-[#39FF14]/15 text-[#39FF14] border border-[#39FF14]/30',
        round.status === 'completed' && 'bg-neutral-800 text-neutral-400 border border-neutral-700',
        round.status === 'upcoming' && 'bg-neutral-900 text-neutral-600 border border-neutral-800',
      )}
    >
      {round.status === 'active' && <span className="w-2 h-2 rounded-full bg-[#39FF14] animate-pulse" />}
      {round.status === 'completed' && <Medal className="w-3 h-3" />}
      {round.status === 'upcoming' && <Timer className="w-3 h-3" />}
      <span>{round.name}</span>
      <span className="text-[10px] opacity-70">
        {formatDate(round.weekStart)} - {formatDate(round.weekEnd)}
      </span>
    </div>
  );
}

// =============================================================================
// Carry-Forward Info Banner
// =============================================================================

function CarryForwardBanner({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  return (
    <div className="relative overflow-hidden rounded-xl border border-cyan-700/30 bg-gradient-to-r from-cyan-950/40 via-neutral-900 to-cyan-950/40 p-4 sm:p-5">
      {/* Animated energy background */}
      <div className="absolute inset-0 opacity-[0.06]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, #22D3EE 0, #22D3EE 2px, transparent 0, transparent 20px)',
            backgroundSize: '20px 100%',
            animation: 'scroll 3s linear infinite',
          }}
        />
      </div>
      <style jsx>{`
        @keyframes scroll {
          0% { transform: translateX(-20px); }
          100% { transform: translateX(0); }
        }
      `}</style>

      <div className="relative z-[1] flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-900/50 border border-cyan-700/30 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-cyan-300 uppercase tracking-wider">
              Momentum Mechanic: {pct}% Carry-Forward
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5 max-w-xl">
              Winners carry <span className="text-cyan-400 font-bold">{pct}%</span> of their round sales into the next round.
              Your <span className="text-cyan-400 font-bold">effective total</span> = fresh week sales + carried momentum.
              Build your lead -- snowball your way to the championship.
            </p>
          </div>
        </div>

        {/* Visual example */}
        <div className="sm:ml-auto flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-950/60 border border-neutral-800 shrink-0">
          <div className="text-center">
            <p className="text-[10px] text-neutral-600 font-semibold uppercase">R1 Sales</p>
            <p className="text-sm font-mono font-bold text-white">$28.6K</p>
          </div>
          <ChevronRight className="w-4 h-4 text-cyan-500" />
          <div className="text-center">
            <p className="text-[10px] text-cyan-500 font-semibold uppercase">Carry</p>
            <p className="text-sm font-mono font-bold text-cyan-400">+$14.3K</p>
          </div>
          <span className="text-neutral-600 font-bold">+</span>
          <div className="text-center">
            <p className="text-[10px] text-neutral-600 font-semibold uppercase">R2 Sales</p>
            <p className="text-sm font-mono font-bold text-white">$22.0K</p>
          </div>
          <span className="text-neutral-600 font-bold">=</span>
          <div className="text-center">
            <p className="text-[10px] text-[#39FF14] font-semibold uppercase">Effective</p>
            <p className="text-sm font-mono font-black text-[#39FF14]">$36.3K</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Best Eliminated Section
// =============================================================================

function BestEliminatedCard({
  bestEliminated,
  eliminatedStats,
}: {
  bestEliminated: BestEliminated;
  eliminatedStats: EliminatedStat[];
}) {
  const stat = eliminatedStats.find((s) => s.name === bestEliminated.name);

  return (
    <div className="relative overflow-hidden rounded-xl border border-orange-600/30 bg-gradient-to-br from-orange-950/50 via-amber-950/30 to-neutral-900 p-5 sm:p-6">
      {/* Phoenix rising background effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-64 opacity-[0.08]"
          style={{
            background: 'radial-gradient(ellipse at center bottom, #F97316 0%, #F59E0B 30%, transparent 70%)',
          }}
        />
        {/* Rising embers */}
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              background: i % 2 === 0 ? '#F97316' : '#FBBF24',
              left: `${20 + Math.random() * 60}%`,
              bottom: `${Math.random() * 30}%`,
              opacity: 0.3 + Math.random() * 0.4,
              animation: `float-up ${2 + Math.random() * 3}s ease-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>
      <style jsx>{`
        @keyframes float-up {
          0% { transform: translateY(0) scale(1); opacity: 0.4; }
          100% { transform: translateY(-120px) scale(0.3); opacity: 0; }
        }
      `}</style>

      <div className="relative z-[1]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300 uppercase tracking-wider">
              Best Eliminated -- Phoenix Award
            </h3>
            <p className="text-[11px] text-neutral-500">Highest total sales among eliminated players</p>
          </div>
        </div>

        {/* Player card */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-neutral-950/50 rounded-xl border border-orange-800/20 p-4">
          {/* Player info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {stat && (
              <div
                className={cn(
                  'w-9 h-9 rounded-full bg-gradient-to-br flex items-center justify-center text-sm font-black text-white shrink-0',
                  getSeedColor(stat.seed),
                )}
              >
                {stat.seed}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-300 to-amber-200 truncate">
                {bestEliminated.name}
              </p>
              <p className="text-xs text-neutral-500">
                {stat ? `Eliminated in Round ${stat.eliminatedRound} -- Played ${stat.roundsPlayed} round${stat.roundsPlayed > 1 ? 's' : ''}` : 'Eliminated'}
              </p>
            </div>
          </div>

          {/* Journey stats */}
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-[10px] text-neutral-600 font-semibold uppercase">Total Sales</p>
              <p className="text-xl font-mono font-black text-orange-400">{formatCurrency(bestEliminated.totalSales)}</p>
            </div>
            <div className="w-px h-8 bg-neutral-800" />
            <div className="text-center">
              <p className="text-[10px] text-orange-500 font-semibold uppercase">Prize</p>
              <p className="text-sm font-bold text-amber-300">{bestEliminated.prize}</p>
            </div>
          </div>
        </div>

        {/* All eliminated runners */}
        {eliminatedStats.length > 1 && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {eliminatedStats
              .filter((s) => s.name !== bestEliminated.name)
              .map((s) => (
                <div key={s.name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-900/50 border border-neutral-800/50">
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full bg-gradient-to-br flex items-center justify-center text-[9px] font-black text-white shrink-0 grayscale opacity-60',
                      getSeedColor(s.seed),
                    )}
                  >
                    {s.seed}
                  </div>
                  <span className="text-xs text-neutral-500 line-through truncate flex-1">{s.name}</span>
                  <span className="text-[10px] font-mono text-neutral-600">{formatCurrency(s.totalSales)}</span>
                  <span className="text-[9px] text-neutral-700">R{s.eliminatedRound}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Seeding Table
// =============================================================================

function SeedingTable({ participants }: { participants: Participant[] }) {
  return (
    <div className="bg-neutral-900/80 rounded-xl border border-neutral-800 p-5">
      <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Target className="w-4 h-4" />
        Tournament Seeding (YTD Sales)
      </h3>
      <div className="space-y-1.5">
        {participants.map((p) => (
          <div
            key={p.seed}
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-neutral-800/50 hover:bg-neutral-800 transition-colors"
          >
            <div
              className={cn(
                'w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-black text-white shrink-0',
                getSeedColor(p.seed),
              )}
            >
              {p.seed}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-white text-sm truncate block">{p.name}</span>
              <span className="text-[11px] text-neutral-500 italic">&quot;{p.nickname}&quot;</span>
            </div>
            <span className="text-sm font-mono font-bold text-[#39FF14] shrink-0">
              {formatCurrency(p.ytdSales)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Tournament Stats Bar
// =============================================================================

function TournamentStats({
  bracket,
  rounds,
  participants,
  eliminatedStats,
}: {
  bracket: MomentumData['bracket'];
  rounds: Round[];
  participants: Participant[];
  eliminatedStats: EliminatedStat[];
}) {
  const eliminatedNames = new Set(eliminatedStats.map((e) => e.name));
  const remaining = participants.length - eliminatedNames.size;

  // Highest single-week fresh sales (ignoring carry)
  let mvpWeek = { name: '', sales: 0, round: '' };
  for (const round of rounds) {
    const roundKey = `round${round.round}` as keyof typeof bracket;
    const matches = bracket[roundKey] || [];
    for (const match of matches) {
      if (match.topSeed.weekSales > mvpWeek.sales) {
        mvpWeek = { name: match.topSeed.name, sales: match.topSeed.weekSales, round: round.name };
      }
      if (match.bottomSeed && match.bottomSeed.weekSales > mvpWeek.sales) {
        mvpWeek = { name: match.bottomSeed.name, sales: match.bottomSeed.weekSales, round: round.name };
      }
    }
  }

  // Highest effective total ever
  let bestEffective = { name: '', total: 0, round: '' };
  for (const round of rounds) {
    const roundKey = `round${round.round}` as keyof typeof bracket;
    const matches = bracket[roundKey] || [];
    for (const match of matches) {
      if (match.topSeed.effectiveTotal > bestEffective.total) {
        bestEffective = { name: match.topSeed.name, total: match.topSeed.effectiveTotal, round: round.name };
      }
      if (match.bottomSeed && match.bottomSeed.effectiveTotal > bestEffective.total) {
        bestEffective = { name: match.bottomSeed.name, total: match.bottomSeed.effectiveTotal, round: round.name };
      }
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Remaining */}
      <div className="bg-neutral-900/80 rounded-xl border border-neutral-800 p-4 text-center">
        <p className="text-4xl font-black text-white">{remaining}</p>
        <p className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mt-1">
          Competitors Remaining
        </p>
      </div>

      {/* Eliminated */}
      <div className="bg-neutral-900/80 rounded-xl border border-neutral-800 p-4">
        <p className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mb-2">Eliminated</p>
        {eliminatedNames.size === 0 ? (
          <p className="text-neutral-600 text-sm italic">None yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Array.from(eliminatedNames).map((name) => (
              <span
                key={name}
                className="px-2 py-1 bg-red-950/50 border border-red-900/30 rounded text-xs text-red-400 font-medium line-through"
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Hottest Fresh Week */}
      <div className="bg-neutral-900/80 rounded-xl border border-amber-800/30 p-4">
        <p className="text-[11px] uppercase tracking-wider text-amber-500 font-semibold mb-1 flex items-center gap-1">
          <Flame className="w-3 h-3" />
          Hottest Fresh Week
        </p>
        {mvpWeek.sales > 0 ? (
          <>
            <p className="text-lg font-black text-amber-400">{mvpWeek.name}</p>
            <p className="text-sm font-mono text-[#39FF14]">
              {formatCurrency(mvpWeek.sales)}{' '}
              <span className="text-neutral-500 text-xs">({mvpWeek.round})</span>
            </p>
          </>
        ) : (
          <p className="text-neutral-600 text-sm italic">No data yet</p>
        )}
      </div>

      {/* Best Effective Total */}
      <div className="bg-neutral-900/80 rounded-xl border border-cyan-800/30 p-4">
        <p className="text-[11px] uppercase tracking-wider text-cyan-500 font-semibold mb-1 flex items-center gap-1">
          <Activity className="w-3 h-3" />
          Best Momentum Total
        </p>
        {bestEffective.total > 0 ? (
          <>
            <p className="text-lg font-black text-cyan-400">{bestEffective.name}</p>
            <p className="text-sm font-mono text-[#39FF14]">
              {formatCurrency(bestEffective.total)}{' '}
              <span className="text-neutral-500 text-xs">({bestEffective.round})</span>
            </p>
          </>
        ) : (
          <p className="text-neutral-600 text-sm italic">No data yet</p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function MomentumBracketPage() {
  const [data, setData] = useState<MomentumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0 });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/data/march-madness/momentum');
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load momentum bracket data`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Countdown timer
  useEffect(() => {
    if (!data) return;
    const activeRound = data.rounds.find((r) => r.status === 'active');
    const nextRound = data.rounds.find((r) => r.status === 'upcoming');
    const targetDate = nextRound?.weekStart || activeRound?.weekEnd;
    if (!targetDate) return;

    const interval = setInterval(() => {
      setCountdown(getCountdown(targetDate));
    }, 60000);
    setCountdown(getCountdown(targetDate));

    return () => clearInterval(interval);
  }, [data]);

  // ---- Loading State ----
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <BasketballIcon className="w-12 h-12 animate-bounce" />
            <div className="absolute -inset-4 rounded-full border-2 border-cyan-500/30 animate-ping" />
          </div>
          <p className="text-neutral-400 text-sm font-medium animate-pulse">Building momentum...</p>
        </div>
      </div>
    );
  }

  // ---- Error State ----
  if (error || !data) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <BasketballIcon className="w-10 h-10 mx-auto opacity-40" />
          <p className="text-red-400 font-semibold">Failed to load momentum bracket</p>
          <p className="text-neutral-500 text-sm">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-700 transition-colors text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { tournament, rounds, participants, bracket, eliminatedStats, bestEliminated, prizes, champion } = data;
  const activeRound = rounds.find((r) => r.status === 'active');

  return (
    <div className="min-h-screen bg-neutral-950 text-white selection:bg-cyan-500/30 selection:text-white">
      {/* ====== HERO HEADER ====== */}
      <div className="relative overflow-hidden">
        {/* Background pattern - energy lines */}
        <div className="absolute inset-0 opacity-[0.04]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, #22D3EE 0, #22D3EE 1px, transparent 0, transparent 60px), repeating-linear-gradient(0deg, #F97316 0, #F97316 1px, transparent 0, transparent 60px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        {/* Gradient overlay - orange/amber momentum theme */}
        <div className="absolute inset-0 bg-gradient-to-b from-orange-950/40 via-amber-950/10 to-neutral-950" />

        {/* Animated momentum wave at top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-40 animate-pulse" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-8">
          {/* Back nav */}
          <Link
            href="/command-center/competition/march-madness"
            className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-[#39FF14] transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to March Madness Hub
          </Link>

          {/* Title block */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-cyan-600 flex items-center justify-center shadow-xl shadow-orange-500/20">
                <BasketballIcon className="w-10 h-10" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-neutral-950 flex items-center justify-center">
                <Zap className="w-4 h-4 text-cyan-400" />
              </div>
              {/* Momentum ring */}
              <div className="absolute -inset-1 rounded-2xl border border-cyan-500/20 animate-pulse" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-cyan-400">
                  MOMENTUM BRACKET
                </span>
                <span className="text-neutral-400 text-lg sm:text-xl ml-3 font-bold">2026</span>
              </h1>
              <p className="text-neutral-500 text-sm mt-0.5 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                <span>March Madness</span>
                <span className="text-neutral-700">|</span>
                <span className="text-cyan-400 font-semibold flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  {Math.round(tournament.carryForwardRate * 100)}% Carry-Forward
                </span>
              </p>
            </div>

            <div className="sm:ml-auto flex items-center gap-3">
              <button
                onClick={fetchData}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-600 text-neutral-400 hover:text-white text-xs transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
            </div>
          </div>

          {/* Countdown + Round Status bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex flex-wrap gap-2">
              {rounds.map((r) => (
                <RoundBadge key={r.round} round={r} />
              ))}
            </div>

            {activeRound && (
              <div className="sm:ml-auto flex items-center gap-3 px-4 py-2 rounded-xl bg-neutral-900/80 border border-neutral-800">
                <Timer className="w-4 h-4 text-orange-400" />
                <div className="text-xs">
                  <span className="text-neutral-500 font-medium">Round ends in</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl font-black text-white tabular-nums">{countdown.days}</span>
                    <span className="text-neutral-600 text-[10px]">d</span>
                    <span className="text-xl font-black text-white tabular-nums">{countdown.hours}</span>
                    <span className="text-neutral-600 text-[10px]">h</span>
                    <span className="text-xl font-black text-white tabular-nums">{countdown.minutes}</span>
                    <span className="text-neutral-600 text-[10px]">m</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ====== MAIN CONTENT ====== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 space-y-8">
        {/* ---- Carry-Forward Explanation Banner ---- */}
        <CarryForwardBanner rate={tournament.carryForwardRate} />

        {/* ---- Stats Bar ---- */}
        <TournamentStats
          bracket={bracket}
          rounds={rounds}
          participants={participants}
          eliminatedStats={eliminatedStats}
        />

        {/* ---- THE BRACKET ---- */}
        <div className="bg-neutral-900/40 rounded-2xl border border-neutral-800 p-6 overflow-x-auto">
          <div className="flex items-center gap-3 mb-6">
            <Swords className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-black uppercase tracking-wider text-neutral-300">
              Momentum Bracket
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-cyan-950/50 border border-cyan-700/30 text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
              50% carry
            </span>
          </div>

          {/* Bracket Grid - Horizontal flow */}
          <div className="flex items-start gap-0 min-w-[900px]">
            {/* ============ ROUND 1 ============ */}
            <div className="flex flex-col gap-4 shrink-0" style={{ width: '280px' }}>
              <div className="text-center mb-2">
                <span className={cn(
                  'text-xs font-bold uppercase tracking-widest',
                  rounds[0]?.status === 'active' ? 'text-[#39FF14]' : rounds[0]?.status === 'completed' ? 'text-neutral-500' : 'text-neutral-700',
                )}>
                  First Round
                </span>
                <p className="text-[10px] text-neutral-600 mt-0.5">
                  {formatDate(rounds[0]?.weekStart || '')} - {formatDate(rounds[0]?.weekEnd || '')}
                </p>
                <p className="text-[9px] text-cyan-700 mt-0.5 font-medium">No carry-forward</p>
              </div>
              {bracket.round1.map((match) => (
                <MatchupCard
                  key={match.matchId}
                  match={match}
                  roundStatus={rounds[0]?.status || 'upcoming'}
                  roundNumber={1}
                />
              ))}
            </div>

            {/* Connector Lines R1 -> R2 */}
            <div className="flex items-center shrink-0 pt-12">
              <BracketConnectors
                fromCount={bracket.round1.length}
                toCount={bracket.round2.length}
                roundIndex={0}
                isActive={rounds[1]?.status === 'active'}
              />
            </div>

            {/* ============ ROUND 2 (Semifinals) ============ */}
            <div className="flex flex-col gap-4 shrink-0" style={{ width: '280px' }}>
              <div className="text-center mb-2">
                <span className={cn(
                  'text-xs font-bold uppercase tracking-widest',
                  rounds[1]?.status === 'active' ? 'text-[#39FF14]' : rounds[1]?.status === 'completed' ? 'text-neutral-500' : 'text-neutral-700',
                )}>
                  Semifinals
                </span>
                <p className="text-[10px] text-neutral-600 mt-0.5">
                  {formatDate(rounds[1]?.weekStart || '')} - {formatDate(rounds[1]?.weekEnd || '')}
                </p>
                <p className="text-[9px] text-cyan-600 mt-0.5 font-medium flex items-center justify-center gap-1">
                  <ArrowUpRight className="w-2.5 h-2.5" />
                  +50% R1 carry
                </p>
              </div>
              <div className="flex flex-col justify-center gap-4" style={{ marginTop: '68px' }}>
                {bracket.round2.map((match) => (
                  <MatchupCard
                    key={match.matchId}
                    match={match}
                    roundStatus={rounds[1]?.status || 'upcoming'}
                    roundNumber={2}
                  />
                ))}
              </div>
            </div>

            {/* Connector Lines R2 -> R3 */}
            <div className="flex items-center shrink-0" style={{ paddingTop: '140px' }}>
              <BracketConnectors
                fromCount={bracket.round2.length}
                toCount={bracket.round3.length}
                roundIndex={1}
                isActive={rounds[2]?.status === 'active'}
              />
            </div>

            {/* ============ ROUND 3 (Championship) ============ */}
            <div className="flex flex-col gap-4 shrink-0" style={{ width: '300px' }}>
              <div className="text-center mb-2">
                <span className={cn(
                  'text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5',
                  rounds[2]?.status === 'active' ? 'text-[#39FF14]' : rounds[2]?.status === 'completed' ? 'text-amber-400' : 'text-neutral-700',
                )}>
                  <Trophy className="w-3.5 h-3.5" />
                  Championship
                  <Trophy className="w-3.5 h-3.5" />
                </span>
                <p className="text-[10px] text-neutral-600 mt-0.5">
                  {formatDate(rounds[2]?.weekStart || '')} - {formatDate(rounds[2]?.weekEnd || '')}
                </p>
                <p className="text-[9px] text-cyan-600 mt-0.5 font-medium flex items-center justify-center gap-1">
                  <ArrowUpRight className="w-2.5 h-2.5" />
                  +50% R2 carry (compounded!)
                </p>
              </div>
              <div style={{ marginTop: '135px' }}>
                {bracket.round3.map((match) => (
                  <MatchupCard
                    key={match.matchId}
                    match={match}
                    roundStatus={rounds[2]?.status || 'upcoming'}
                    isChampionship
                    roundNumber={3}
                  />
                ))}
              </div>

              {/* Champion display */}
              {champion && (
                <div className="mt-4 text-center p-4 rounded-xl bg-gradient-to-b from-amber-900/30 to-neutral-900 border border-amber-500/30 relative overflow-hidden">
                  <MomentumParticles />
                  <div className="relative z-[1]">
                    <Crown className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                    <p className="text-xs uppercase tracking-widest text-amber-500 font-bold">Momentum Champion</p>
                    <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-cyan-300 to-amber-300 mt-1">
                      {champion}
                    </p>
                    <p className="text-[10px] text-cyan-500 mt-1 font-medium">Carried the momentum all the way</p>
                  </div>
                </div>
              )}

              {/* Active championship teaser */}
              {!champion && rounds[2]?.status === 'active' && (
                <div className="mt-4 text-center p-4 rounded-xl border border-dashed border-[#39FF14]/30 bg-[#39FF14]/5 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-cyan-950/10 to-transparent" />
                  <div className="relative z-[1]">
                    <Flame className="w-6 h-6 text-orange-400 mx-auto mb-1 animate-pulse" />
                    <p className="text-xs text-[#39FF14] font-bold uppercase tracking-widest">
                      Championship Week
                    </p>
                    <p className="text-neutral-500 text-[11px] mt-1">
                      Maximum momentum -- who carries it home?
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ---- Best Eliminated Section ---- */}
        {bestEliminated && (
          <BestEliminatedCard
            bestEliminated={bestEliminated}
            eliminatedStats={eliminatedStats}
          />
        )}

        {/* ---- Bottom Row: Seeding + Prizes + Rules ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Seeding Table */}
          <SeedingTable participants={participants} />

          {/* Prizes + Rules */}
          <div className="space-y-4">
            <div className="bg-neutral-900/80 rounded-xl border border-neutral-800 p-5">
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" />
                Prizes at Stake
              </h3>
              <div className="space-y-3">
                <PrizeCard
                  icon={<Trophy className="w-6 h-6 text-amber-400" />}
                  label="Champion"
                  value={prizes.champion}
                />
                <PrizeCard
                  icon={<Medal className="w-6 h-6 text-zinc-400" />}
                  label="Runner-Up"
                  value={prizes.runnerUp}
                />
                <PrizeCard
                  icon={<Flame className="w-6 h-6 text-orange-400" />}
                  label="Best Eliminated (Phoenix Award)"
                  value={prizes.bestEliminated}
                  highlight
                />
                <PrizeCard
                  icon={<Zap className="w-6 h-6 text-cyan-400" />}
                  label="MVP Week (Highest Fresh Sales)"
                  value={prizes.mvpWeek}
                />
              </div>
            </div>

            {/* Rules */}
            <div className="bg-neutral-900/80 rounded-xl border border-neutral-800 p-5">
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-400" />
                Momentum Rules
              </h3>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-[#39FF14] shrink-0 mt-0.5" />
                  <span>7 reps seeded by YTD sales totals. <span className="text-amber-400 font-semibold">#1 seed gets a first-round BYE</span> (no carry from BYE).</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    <span className="text-cyan-300 font-bold">50% Carry-Forward:</span> When you win a round,
                    you carry 50% of your week&apos;s sales into the next round.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    <span className="text-white font-bold">Effective Total</span> = fresh week sales + carry-forward amount.
                    Highest effective total wins the matchup.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-[#39FF14] shrink-0 mt-0.5" />
                  <span>3 rounds across March. Momentum compounds -- big early wins pay off in later rounds.</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  <span>
                    <span className="text-orange-300 font-bold">Phoenix Award:</span> The eliminated player
                    with the highest <span className="text-orange-300">total sales across all rounds played</span> wins
                    the Best Eliminated prize.
                  </span>
                </li>
              </ul>
            </div>

            {/* Matchup Structure */}
            <div className="bg-gradient-to-br from-orange-950/30 to-cyan-950/20 rounded-xl border border-orange-900/30 p-5">
              <h3 className="text-sm font-bold text-orange-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Bracket Structure
              </h3>
              <div className="text-xs text-neutral-400 space-y-1.5">
                <p>
                  <span className="text-orange-300 font-bold">R1 (Fresh):</span> #4 vs #5 &bull; #3 vs #6 &bull; #2 vs #7 &bull; #1 BYE
                  <span className="text-neutral-600 ml-1">-- no carry</span>
                </p>
                <p>
                  <span className="text-orange-300 font-bold">R2 (Semi):</span> Winners advance with
                  <span className="text-cyan-400 font-bold"> +50% carry</span> from R1
                </p>
                <p>
                  <span className="text-orange-300 font-bold">R3 (Final):</span> Championship with
                  <span className="text-cyan-400 font-bold"> +50% carry</span> from R2
                  <span className="text-neutral-600 ml-1">-- momentum compounds!</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
