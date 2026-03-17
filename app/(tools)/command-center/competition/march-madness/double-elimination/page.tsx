'use client';

/**
 * RCRS March Madness 2026 - Double Elimination / Redemption Bracket
 *
 * Players must lose TWICE to be eliminated. Features a Winners Bracket
 * and a Losers Bracket with Grand Finals at the end.
 * WB champion gets a 15% sales bonus advantage in Grand Finals.
 *
 * 5 weeks total. 7 players seeded by YTD sales.
 *
 * Data source: /api/data/march-madness/double-elim
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
  Shield,
  ShieldAlert,
  ShieldCheck,
  Heart,
  Skull,
  ArrowDownRight,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface MatchSeed {
  seed: number;
  name: string;
  weekSales: number;
  winner: boolean;
}

interface Match {
  matchId: string;
  topSeed: MatchSeed;
  bottomSeed: MatchSeed | null; // null = BYE
  note?: string; // e.g. "BYE"
}

interface BracketRound {
  round: string;
  name: string;
  week: number;
  status: 'upcoming' | 'active' | 'completed';
  matches: Match[];
}

interface Week {
  week: number;
  start: string;
  end: string;
  status: 'upcoming' | 'active' | 'completed';
  label: string;
}

interface Participant {
  seed: number;
  name: string;
  lives: number; // 2 = winners, 1 = losers, 0 = eliminated
  status: 'winners' | 'losers' | 'eliminated' | 'grandFinals';
}

interface GrandFinals {
  week: number;
  status: 'upcoming' | 'active' | 'completed';
  advantageRule: string;
  match: Match | null;
  wbChampion?: string;
  lbSurvivor?: string;
}

interface EliminatedPlayer {
  name: string;
  seed: number;
  eliminatedWeek: number;
  losses: number;
  totalSales: number;
  winsBeforeElim: number;
}

interface Prizes {
  champion: string;
  runnerUp: string;
  ironMan: string;
  comebackKing: string;
}

interface TournamentInfo {
  id: string;
  name: string;
  currentWeek: number;
  startDate?: string;
  endDate?: string;
  status?: string;
}

interface DoubleElimData {
  tournament: TournamentInfo;
  participants: Participant[];
  weeks: Week[];
  winnersBracket: BracketRound[];
  losersBracket: BracketRound[];
  grandFinals: GrandFinals;
  eliminated: EliminatedPlayer[];
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

/** Get participant by name for lives lookup */
function getParticipant(participants: Participant[], name: string): Participant | undefined {
  return participants.find((p) => p.name === name);
}

// =============================================================================
// Sub-Components
// =============================================================================

/** Shield icon for the hero */
function RedemptionShield({ className }: { className?: string }) {
  return (
    <span className={cn('inline-block', className)} role="img" aria-label="shield">
      <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
        <path
          d="M18 2 L32 8 V18 C32 26 26 32 18 34 C10 32 4 26 4 18 V8 Z"
          fill="url(#shieldGrad)"
          stroke="#B91C1C"
          strokeWidth="1.5"
        />
        <path
          d="M18 10 L22 16 H14 Z"
          fill="#39FF14"
          opacity="0.8"
        />
        <path
          d="M14 16 H22 V22 C22 24 20 26 18 27 C16 26 14 24 14 22 Z"
          fill="#39FF14"
          opacity="0.6"
        />
        <defs>
          <linearGradient id="shieldGrad" x1="4" y1="2" x2="32" y2="34">
            <stop offset="0%" stopColor="#991B1B" />
            <stop offset="50%" stopColor="#7F1D1D" />
            <stop offset="100%" stopColor="#450A0A" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}

/** Animated ember particles for dramatic effect */
function EmberEffect() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full animate-ping"
          style={{
            background: i % 3 === 0 ? '#39FF14' : i % 3 === 1 ? '#F59E0B' : '#EF4444',
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

/** Lives indicator: hearts for alive, skull for eliminated */
function LivesIndicator({ lives, size = 'sm' }: { lives: number; size?: 'sm' | 'md' }) {
  const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3 h-3';

  if (lives === 0) {
    return (
      <div className="flex items-center gap-0.5" title="ELIMINATED - 0 lives">
        <Skull className={cn(iconSize, 'text-red-500')} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5" title={`${lives} ${lives === 1 ? 'life' : 'lives'} remaining`}>
      {Array.from({ length: lives }).map((_, i) => (
        <Heart key={i} className={cn(iconSize, 'fill-red-500 text-red-500')} />
      ))}
      {/* Show empty hearts for lost lives */}
      {Array.from({ length: 2 - lives }).map((_, i) => (
        <Heart key={`empty-${i}`} className={cn(iconSize, 'text-neutral-700')} />
      ))}
    </div>
  );
}

/** Status badge for bracket position */
function StatusBadge({ status }: { status: Participant['status'] }) {
  if (status === 'winners') {
    return (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
        Winners
      </span>
    );
  }
  if (status === 'losers') {
    return (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-950/60 text-amber-400 border border-amber-800/40">
        Losers
      </span>
    );
  }
  if (status === 'eliminated') {
    return (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-red-950/60 text-red-400 border border-red-800/40">
        Eliminated
      </span>
    );
  }
  if (status === 'grandFinals') {
    return (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-900/60 text-amber-300 border border-amber-600/40">
        Grand Finals
      </span>
    );
  }
  return null;
}

/** Individual seed/player row within a matchup */
function DEPlayerRow({
  seed,
  isWinner,
  roundStatus,
  showSales,
  lives,
  droppedToLosers,
  eliminated,
  bracketType,
}: {
  seed: MatchSeed;
  isWinner: boolean;
  roundStatus: 'upcoming' | 'active' | 'completed';
  showSales: boolean;
  lives?: number;
  droppedToLosers?: boolean;
  eliminated?: boolean;
  bracketType: 'winners' | 'losers' | 'grand';
}) {
  const isCompleted = roundStatus === 'completed';
  const isActive = roundStatus === 'active';
  const isLoser = isCompleted && !isWinner;

  const accentColor = bracketType === 'winners'
    ? '#39FF14'
    : bracketType === 'losers'
      ? '#F59E0B'
      : '#FFD700';

  return (
    <div
      className={cn(
        'relative flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all',
        isWinner && isCompleted && bracketType === 'winners' && 'bg-emerald-500/10 border border-emerald-500/20',
        isWinner && isCompleted && bracketType === 'losers' && 'bg-amber-500/10 border border-amber-500/20',
        isWinner && isCompleted && bracketType === 'grand' && 'bg-amber-400/10 border border-amber-400/20',
        isLoser && 'opacity-50',
        isActive && 'bg-neutral-800/70',
        !isActive && !isCompleted && 'bg-neutral-800/30',
      )}
    >
      {/* Winner glow */}
      {isWinner && isCompleted && <EmberEffect />}

      {/* Seed number */}
      <div
        className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 bg-gradient-to-br',
          getSeedColor(seed.seed),
          isLoser && 'grayscale',
        )}
      >
        <span className="text-white drop-shadow">{seed.seed}</span>
      </div>

      {/* Name */}
      <span
        className={cn(
          'font-bold text-sm truncate flex-1',
          isWinner && isCompleted ? `text-[${accentColor}]` : isLoser ? 'text-neutral-500 line-through' : 'text-white',
        )}
        style={isWinner && isCompleted ? { color: accentColor } : undefined}
      >
        {seed.name}
      </span>

      {/* Lives */}
      {lives !== undefined && (
        <LivesIndicator lives={lives} />
      )}

      {/* Sales amount */}
      {showSales && (isCompleted || isActive) && (
        <span
          className={cn(
            'text-xs font-mono font-bold shrink-0',
            isWinner && isCompleted
              ? 'text-[#39FF14]'
              : isLoser
                ? 'text-neutral-600'
                : 'text-neutral-400',
          )}
        >
          {seed.weekSales > 0 ? formatCurrency(seed.weekSales) : '--'}
        </span>
      )}

      {/* Winner crown */}
      {isWinner && isCompleted && (
        <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-bounce" style={{ animationDuration: '2s' }} />
      )}

      {/* Dropped / Eliminated badges */}
      {droppedToLosers && isCompleted && isLoser && (
        <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 bg-amber-900/90 text-amber-300 text-[8px] font-black uppercase tracking-widest rounded-full border border-amber-700/50 whitespace-nowrap">
          Dropped to Losers
        </span>
      )}
      {eliminated && isCompleted && isLoser && (
        <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 bg-red-900/90 text-red-300 text-[8px] font-black uppercase tracking-widest rounded-full border border-red-700/50 whitespace-nowrap flex items-center gap-1">
          <Skull className="w-2.5 h-2.5" />
          Eliminated
        </span>
      )}
    </div>
  );
}

/** Single matchup card adapted for double elimination */
function DEMatchCard({
  match,
  roundStatus,
  bracketType,
  participants,
  isGrandFinals,
}: {
  match: Match;
  roundStatus: 'upcoming' | 'active' | 'completed';
  bracketType: 'winners' | 'losers' | 'grand';
  participants: Participant[];
  isGrandFinals?: boolean;
}) {
  const isBye = match.bottomSeed === null || match.note === 'BYE';
  const isActive = roundStatus === 'active';
  const isCompleted = roundStatus === 'completed';

  // Get lives for each player
  const topLives = match.topSeed ? getParticipant(participants, match.topSeed.name)?.lives : undefined;
  const bottomLives = match.bottomSeed ? getParticipant(participants, match.bottomSeed.name)?.lives : undefined;

  // Determine if loser gets "dropped to losers" or "eliminated"
  const loserDropped = bracketType === 'winners'; // losers in winners bracket drop to losers bracket
  const loserEliminated = bracketType === 'losers'; // losers in losers bracket are eliminated

  const borderColor = bracketType === 'winners'
    ? 'border-emerald-500'
    : bracketType === 'losers'
      ? 'border-amber-500'
      : 'border-amber-400';

  const glowColor = bracketType === 'winners'
    ? 'shadow-emerald-500/10'
    : bracketType === 'losers'
      ? 'shadow-amber-500/10'
      : 'shadow-amber-400/20';

  return (
    <div
      className={cn(
        'relative rounded-xl border transition-all duration-300',
        isGrandFinals && 'ring-2 ring-amber-400/30',
        isActive && `${borderColor}/50 bg-neutral-900/90 shadow-lg ${glowColor}`,
        isCompleted && 'border-neutral-700 bg-neutral-900/60',
        !isActive && !isCompleted && 'border-neutral-800 bg-neutral-900/40 opacity-60',
      )}
    >
      {/* Active glow */}
      {isActive && (
        <div
          className={cn(
            'absolute -inset-px rounded-xl animate-pulse',
            bracketType === 'winners' && 'bg-gradient-to-r from-emerald-500/10 via-transparent to-emerald-500/10',
            bracketType === 'losers' && 'bg-gradient-to-r from-amber-500/10 via-transparent to-amber-500/10',
            bracketType === 'grand' && 'bg-gradient-to-r from-amber-400/15 via-transparent to-amber-400/15',
          )}
        />
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
        {match.topSeed && (
          <DEPlayerRow
            seed={match.topSeed}
            isWinner={match.topSeed.winner}
            roundStatus={roundStatus}
            showSales={!isBye}
            lives={topLives}
            droppedToLosers={loserDropped}
            eliminated={loserEliminated || (bracketType === 'grand')}
            bracketType={bracketType}
          />
        )}

        {/* VS divider */}
        {!isBye && match.bottomSeed && (
          <div className="flex items-center gap-2 px-2">
            <div className="flex-1 h-px bg-neutral-700" />
            <span
              className={cn(
                'text-[10px] font-black tracking-wider',
                isActive
                  ? bracketType === 'winners' ? 'text-emerald-400' : bracketType === 'losers' ? 'text-amber-400' : 'text-amber-300'
                  : 'text-neutral-600',
              )}
            >
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
            <span className="ml-auto text-[10px] text-neutral-600 font-medium">Auto-advance</span>
          </div>
        ) : match.bottomSeed ? (
          <DEPlayerRow
            seed={match.bottomSeed}
            isWinner={match.bottomSeed.winner}
            roundStatus={roundStatus}
            showSales
            lives={bottomLives}
            droppedToLosers={loserDropped}
            eliminated={loserEliminated || (bracketType === 'grand')}
            bracketType={bracketType}
          />
        ) : null}
      </div>
    </div>
  );
}

/** Prize card */
function PrizeCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-neutral-900/80 rounded-xl border border-neutral-800 hover:border-[#39FF14]/30 transition-colors">
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">{label}</p>
        <p className="text-sm font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

/** Week timeline bar */
function WeekTimeline({ weeks, currentWeek }: { weeks: Week[]; currentWeek: number }) {
  return (
    <div className="flex items-center gap-1 w-full">
      {weeks.map((week, i) => {
        const isCurrent = week.week === currentWeek;
        const isCompleted = week.status === 'completed';
        const isActive = week.status === 'active';

        return (
          <div key={week.week} className="flex items-center flex-1">
            <div
              className={cn(
                'flex-1 relative rounded-lg px-3 py-2 text-center transition-all',
                isActive && 'bg-[#39FF14]/10 border-2 border-[#39FF14]/50 shadow-lg shadow-[#39FF14]/10',
                isCompleted && 'bg-neutral-800/60 border border-neutral-700',
                !isActive && !isCompleted && 'bg-neutral-900/40 border border-neutral-800 opacity-50',
              )}
            >
              {isActive && (
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2">
                  <span className="px-2 py-0.5 bg-[#39FF14] text-black text-[8px] font-black uppercase tracking-widest rounded-full">
                    Now
                  </span>
                </div>
              )}
              <p className={cn(
                'text-[10px] font-black uppercase tracking-wider',
                isActive ? 'text-[#39FF14]' : isCompleted ? 'text-neutral-400' : 'text-neutral-600',
              )}>
                Wk {week.week}
              </p>
              <p className="text-[9px] text-neutral-500 mt-0.5 truncate">{week.label?.replace(`Week ${week.week} - `, '') || ''}</p>
              <p className="text-[9px] text-neutral-600">{formatDate(week.start)} - {formatDate(week.end)}</p>
            </div>
            {i < weeks.length - 1 && (
              <ChevronRight className={cn(
                'w-3 h-3 shrink-0 mx-0.5',
                weeks[i + 1]?.status === 'active' ? 'text-[#39FF14]' : 'text-neutral-700',
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Bracket connector lines between rounds */
function BracketConnectors({
  fromCount,
  toCount,
  color,
  isActive,
}: {
  fromCount: number;
  toCount: number;
  color: string;
  isActive: boolean;
}) {
  const cardHeight = 120;
  const gap = 16;
  const totalFromHeight = fromCount * cardHeight + (fromCount - 1) * gap;
  const totalToHeight = toCount * cardHeight + (toCount - 1) * gap;
  const svgHeight = Math.max(totalFromHeight, totalToHeight, 100);
  const toOffset = (totalFromHeight - totalToHeight) / 2;

  return (
    <svg
      className="shrink-0 hidden lg:block"
      width="40"
      height={svgHeight}
      viewBox={`0 0 40 ${svgHeight}`}
    >
      {Array.from({ length: toCount }).map((_, i) => {
        const fromIdx1 = i * 2;
        const fromIdx2 = i * 2 + 1;
        const fromY1 = fromIdx1 * (cardHeight + gap) + cardHeight / 2;
        const fromY2 = fromIdx2 < fromCount ? fromIdx2 * (cardHeight + gap) + cardHeight / 2 : fromY1;
        const toY = Math.max(0, toOffset) + i * (cardHeight + gap) + cardHeight / 2;

        return (
          <g key={i}>
            <path
              d={`M 0 ${fromY1} C 16 ${fromY1}, 16 ${toY}, 40 ${toY}`}
              stroke={isActive ? color : '#404040'}
              strokeWidth="2"
              fill="none"
              strokeDasharray={isActive ? undefined : '4 4'}
              className={isActive ? 'animate-pulse' : ''}
            />
            {fromIdx2 < fromCount && (
              <path
                d={`M 0 ${fromY2} C 16 ${fromY2}, 16 ${toY}, 40 ${toY}`}
                stroke={isActive ? color : '#404040'}
                strokeWidth="2"
                fill="none"
                strokeDasharray={isActive ? undefined : '4 4'}
                className={isActive ? 'animate-pulse' : ''}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function DoubleEliminationPage() {
  const [data, setData] = useState<DoubleElimData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0 });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/data/march-madness/double-elim');
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load bracket data`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message);
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
    const activeWeek = data.weeks.find((w) => w.status === 'active');
    const nextWeek = data.weeks.find((w) => w.status === 'upcoming');
    const targetDate = nextWeek?.start || activeWeek?.end;
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
          <RedemptionShield className="w-14 h-14 animate-pulse" />
          <p className="text-neutral-400 text-sm font-medium animate-pulse">Loading Redemption Bracket...</p>
        </div>
      </div>
    );
  }

  // ---- Error State ----
  if (error || !data) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <RedemptionShield className="w-10 h-10 mx-auto opacity-40" />
          <p className="text-red-400 font-semibold">Failed to load bracket</p>
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

  const {
    tournament,
    participants,
    weeks,
    winnersBracket,
    losersBracket,
    grandFinals,
    eliminated,
    prizes,
    champion,
  } = data;

  const activeWeek = weeks.find((w) => w.status === 'active');
  const inWinners = participants.filter((p) => p.status === 'winners' || p.status === 'grandFinals').length;
  const inLosers = participants.filter((p) => p.status === 'losers').length;
  const eliminatedCount = participants.filter((p) => p.status === 'eliminated').length;

  // Find the Grand Finals week for display
  const grandFinalsWeek = weeks.find((w) => w.week === grandFinals.week);

  return (
    <div className="min-h-screen bg-neutral-950 text-white selection:bg-[#39FF14]/30 selection:text-white">
      {/* ====== HERO HEADER ====== */}
      <div className="relative overflow-hidden">
        {/* Background: dark red criss-cross pattern */}
        <div className="absolute inset-0 opacity-[0.04]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, #DC2626 0, #DC2626 1px, transparent 0, transparent 50%), repeating-linear-gradient(-45deg, #39FF14 0, #39FF14 1px, transparent 0, transparent 50%)',
              backgroundSize: '28px 28px',
            }}
          />
        </div>

        {/* Gradient overlay: deep red-amber into black */}
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/40 via-amber-950/15 to-neutral-950" />

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
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-700 to-amber-800 flex items-center justify-center shadow-xl shadow-red-800/30">
                <RedemptionShield className="w-10 h-10" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-neutral-950 flex items-center justify-center">
                <Shield className="w-4 h-4 text-[#39FF14]" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-amber-400 to-red-500">
                  REDEMPTION BRACKET
                </span>
                <span className="text-neutral-400 text-lg sm:text-xl ml-3 font-bold">2026</span>
              </h1>
              <p className="text-neutral-500 text-sm mt-0.5 flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                <span className="text-red-400 font-semibold">Double Elimination</span>
                <span className="text-neutral-700">|</span>
                <span>Lose twice and you&apos;re out</span>
                <span className="text-neutral-700">|</span>
                <span>5 Weeks</span>
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

          {/* Week Timeline */}
          <WeekTimeline weeks={weeks} currentWeek={tournament.currentWeek} />

          {/* Countdown */}
          {activeWeek && (
            <div className="mt-4 flex items-center gap-3 px-4 py-2 rounded-xl bg-neutral-900/80 border border-neutral-800 w-fit">
              <Timer className="w-4 h-4 text-red-400" />
              <div className="text-xs">
                <span className="text-neutral-500 font-medium">Week ends in</span>
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

      {/* ====== MAIN CONTENT ====== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 space-y-8">

        {/* ---- Stats Grid ---- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-neutral-900/80 rounded-xl border border-emerald-900/40 p-4 text-center">
            <ShieldCheck className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-3xl font-black text-emerald-400">{inWinners}</p>
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mt-0.5">
              In Winners Bracket
            </p>
          </div>
          <div className="bg-neutral-900/80 rounded-xl border border-amber-900/40 p-4 text-center">
            <ShieldAlert className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <p className="text-3xl font-black text-amber-400">{inLosers}</p>
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mt-0.5">
              In Losers Bracket
            </p>
          </div>
          <div className="bg-neutral-900/80 rounded-xl border border-red-900/40 p-4 text-center">
            <Skull className="w-5 h-5 text-red-400 mx-auto mb-1" />
            <p className="text-3xl font-black text-red-400">{eliminatedCount}</p>
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mt-0.5">
              Eliminated
            </p>
          </div>
          <div className="bg-neutral-900/80 rounded-xl border border-amber-600/30 p-4 text-center">
            <Trophy className="w-5 h-5 text-amber-300 mx-auto mb-1" />
            <p className="text-lg font-black text-amber-300">
              {grandFinalsWeek ? `Wk ${grandFinals.week}` : 'TBD'}
            </p>
            <p className="text-[9px] text-neutral-500">
              {grandFinalsWeek ? `${formatDate(grandFinalsWeek.start)} - ${formatDate(grandFinalsWeek.end)}` : ''}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mt-0.5">
              Grand Finals
            </p>
          </div>
        </div>

        {/* ---- Participant Status Overview ---- */}
        <div className="bg-neutral-900/40 rounded-2xl border border-neutral-800 p-5">
          <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Competitor Status
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {participants
              .sort((a, b) => a.seed - b.seed)
              .map((p) => (
                <div
                  key={p.seed}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                    p.status === 'winners' && 'bg-emerald-950/30 border border-emerald-900/30',
                    p.status === 'losers' && 'bg-amber-950/30 border border-amber-900/30',
                    p.status === 'eliminated' && 'bg-red-950/20 border border-red-900/20 opacity-50',
                    p.status === 'grandFinals' && 'bg-amber-900/20 border border-amber-600/30',
                  )}
                >
                  <div
                    className={cn(
                      'w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-black text-white shrink-0',
                      getSeedColor(p.seed),
                      p.status === 'eliminated' && 'grayscale',
                    )}
                  >
                    {p.seed}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={cn(
                      'font-semibold text-sm truncate block',
                      p.status === 'eliminated' ? 'text-neutral-500 line-through' : 'text-white',
                    )}>
                      {p.name}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <LivesIndicator lives={p.lives} />
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* ==================================================================
            WINNERS BRACKET
        ================================================================== */}
        <div className="bg-neutral-900/40 rounded-2xl border-2 border-emerald-900/40 p-6 overflow-x-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-wider text-emerald-400">
                Winners Bracket
              </h2>
              <p className="text-[11px] text-neutral-500">Lose here and you drop to the Losers Bracket (1 life remaining)</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
              <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
              <span className="text-[10px] text-neutral-500 ml-1">2 Lives</span>
            </div>
          </div>

          {/* Bracket flow: horizontal rounds */}
          <div className="flex items-start gap-0 min-w-[700px]">
            {winnersBracket.map((round, roundIdx) => {
              const nextRound = winnersBracket[roundIdx + 1];
              const isLastRound = roundIdx === winnersBracket.length - 1;

              return (
                <div key={round.round} className="flex items-start">
                  {/* Round column */}
                  <div className="flex flex-col gap-4 shrink-0" style={{ width: '240px' }}>
                    <div className="text-center mb-2">
                      <span
                        className={cn(
                          'text-xs font-bold uppercase tracking-widest',
                          round.status === 'active' ? 'text-emerald-400' : round.status === 'completed' ? 'text-neutral-500' : 'text-neutral-700',
                        )}
                      >
                        {round.name}
                      </span>
                      <p className="text-[10px] text-neutral-600 mt-0.5">Week {round.week}</p>
                    </div>

                    {/* Center later rounds vertically */}
                    <div
                      className="flex flex-col gap-5"
                      style={{
                        marginTop: roundIdx === 1 ? '40px' : roundIdx === 2 ? '70px' : '0',
                      }}
                    >
                      {round.matches.map((match) => (
                        <DEMatchCard
                          key={match.matchId}
                          match={match}
                          roundStatus={round.status}
                          bracketType="winners"
                          participants={participants}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Connector lines */}
                  {!isLastRound && nextRound && (
                    <div className="flex items-center shrink-0" style={{ paddingTop: roundIdx === 0 ? '48px' : '80px' }}>
                      <BracketConnectors
                        fromCount={round.matches.length}
                        toCount={nextRound.matches.length}
                        color="#10B981"
                        isActive={nextRound.status === 'active'}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Drop-down arrow showing losers flowing to losers bracket */}
        <div className="flex items-center justify-center gap-3 -my-4 py-2">
          <div className="flex items-center gap-2 text-amber-500">
            <ArrowDownRight className="w-5 h-5 animate-bounce" style={{ animationDuration: '2s' }} />
            <span className="text-xs font-black uppercase tracking-widest">
              Losers drop down
            </span>
            <ArrowDownRight className="w-5 h-5 animate-bounce" style={{ animationDuration: '2s', animationDelay: '0.3s' }} />
          </div>
        </div>

        {/* ==================================================================
            LOSERS BRACKET
        ================================================================== */}
        <div className="bg-neutral-900/40 rounded-2xl border-2 border-amber-900/40 p-6 overflow-x-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-amber-600/20 flex items-center justify-center">
              <Flame className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-wider text-amber-400">
                Losers Bracket
              </h2>
              <p className="text-[11px] text-neutral-500">Last chance. Lose here and it&apos;s over. Win and fight for redemption.</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
              <Heart className="w-3.5 h-3.5 text-neutral-700" />
              <span className="text-[10px] text-neutral-500 ml-1">1 Life</span>
            </div>
          </div>

          {/* Bracket flow: horizontal rounds */}
          <div className="flex items-start gap-0 min-w-[900px]">
            {losersBracket.map((round, roundIdx) => {
              const nextRound = losersBracket[roundIdx + 1];
              const isLastRound = roundIdx === losersBracket.length - 1;

              return (
                <div key={round.round} className="flex items-start">
                  {/* Round column */}
                  <div className="flex flex-col gap-4 shrink-0" style={{ width: '230px' }}>
                    <div className="text-center mb-2">
                      <span
                        className={cn(
                          'text-xs font-bold uppercase tracking-widest',
                          round.status === 'active' ? 'text-amber-400' : round.status === 'completed' ? 'text-neutral-500' : 'text-neutral-700',
                        )}
                      >
                        {round.name}
                      </span>
                      <p className="text-[10px] text-neutral-600 mt-0.5">Week {round.week}</p>
                    </div>

                    <div
                      className="flex flex-col gap-5"
                      style={{
                        marginTop: roundIdx >= 2 ? `${roundIdx * 20}px` : '0',
                      }}
                    >
                      {round.matches.map((match) => (
                        <DEMatchCard
                          key={match.matchId}
                          match={match}
                          roundStatus={round.status}
                          bracketType="losers"
                          participants={participants}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Connector lines */}
                  {!isLastRound && nextRound && (
                    <div className="flex items-center shrink-0" style={{ paddingTop: '36px' }}>
                      <BracketConnectors
                        fromCount={round.matches.length}
                        toCount={nextRound.matches.length}
                        color="#F59E0B"
                        isActive={nextRound.status === 'active'}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ==================================================================
            GRAND FINALS
        ================================================================== */}
        <div
          className={cn(
            'relative rounded-2xl border-2 p-6 overflow-hidden',
            grandFinals.status === 'active'
              ? 'border-amber-400/60 bg-gradient-to-br from-amber-950/40 via-neutral-900/90 to-amber-950/30 shadow-2xl shadow-amber-500/10'
              : grandFinals.status === 'completed'
                ? 'border-amber-500/40 bg-gradient-to-br from-amber-950/30 to-neutral-900'
                : 'border-amber-900/30 bg-gradient-to-br from-amber-950/20 via-neutral-900/60 to-neutral-900 opacity-80',
          )}
        >
          {/* Background shimmer for active */}
          {grandFinals.status === 'active' && (
            <div className="absolute inset-0 opacity-[0.06]">
              <div
                className="absolute inset-0 animate-pulse"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(45deg, #FFD700 0, #FFD700 1px, transparent 0, transparent 50%)',
                  backgroundSize: '20px 20px',
                }}
              />
            </div>
          )}

          <div className="relative z-10">
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="flex items-center gap-3 mb-2">
                <Trophy className="w-6 h-6 text-amber-400" />
                <h2 className="text-2xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300">
                  Grand Finals
                </h2>
                <Trophy className="w-6 h-6 text-amber-400" />
              </div>
              <p className="text-neutral-400 text-sm max-w-lg">
                Winners Bracket Champion vs. Losers Bracket Survivor.
                {grandFinalsWeek && (
                  <span className="text-amber-400 font-semibold ml-1">
                    Week {grandFinals.week} ({formatDate(grandFinalsWeek.start)} - {formatDate(grandFinalsWeek.end)})
                  </span>
                )}
              </p>
            </div>

            {/* Advantage rule callout */}
            <div className="mx-auto max-w-md mb-6 px-4 py-3 rounded-xl bg-amber-900/30 border border-amber-700/30 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Star className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black uppercase tracking-widest text-amber-400">Advantage Rule</span>
                <Star className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-sm text-amber-200/80">{grandFinals.advantageRule}</p>
            </div>

            {/* Grand Finals match */}
            {grandFinals.match ? (
              <div className="max-w-sm mx-auto">
                <DEMatchCard
                  match={grandFinals.match}
                  roundStatus={grandFinals.status}
                  bracketType="grand"
                  participants={participants}
                  isGrandFinals
                />
              </div>
            ) : (
              <div className="max-w-sm mx-auto text-center py-8">
                <div className="flex items-center justify-center gap-6">
                  {/* WB Champ slot */}
                  <div className="flex-1 p-4 rounded-xl border border-dashed border-emerald-700/40 bg-emerald-950/20">
                    <ShieldCheck className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                    <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">WB Champion</p>
                    <p className="text-sm font-bold text-neutral-500 mt-1">
                      {grandFinals.wbChampion || 'TBD'}
                    </p>
                  </div>

                  <div className="flex flex-col items-center">
                    <Swords className="w-5 h-5 text-amber-400" />
                    <span className="text-[10px] text-neutral-600 font-bold mt-1">VS</span>
                  </div>

                  {/* LB Survivor slot */}
                  <div className="flex-1 p-4 rounded-xl border border-dashed border-amber-700/40 bg-amber-950/20">
                    <Flame className="w-6 h-6 text-amber-400 mx-auto mb-1" />
                    <p className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">LB Survivor</p>
                    <p className="text-sm font-bold text-neutral-500 mt-1">
                      {grandFinals.lbSurvivor || 'TBD'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Champion display */}
            {champion && (
              <div className="mt-6 text-center p-6 rounded-xl bg-gradient-to-b from-amber-900/40 to-neutral-900 border border-amber-500/30">
                <EmberEffect />
                <Crown className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                <p className="text-xs uppercase tracking-widest text-amber-500 font-bold">Redemption Champion</p>
                <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-200 mt-1">
                  {champion}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ---- Eliminated Players ---- */}
        {eliminated.length > 0 && (
          <div className="bg-neutral-900/40 rounded-2xl border border-red-900/30 p-5">
            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Skull className="w-4 h-4" />
              Fallen Competitors
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {eliminated.map((elim) => (
                <div
                  key={elim.name}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-950/20 border border-red-900/20"
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-black text-white shrink-0 grayscale',
                      getSeedColor(elim.seed),
                    )}
                  >
                    {elim.seed}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm text-neutral-500 line-through block truncate">
                      {elim.name}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-red-400/70">
                        Eliminated Wk {elim.eliminatedWeek}
                      </span>
                      <span className="text-[10px] text-neutral-600">|</span>
                      <span className="text-[10px] text-neutral-500">
                        {elim.winsBeforeElim}W-{elim.losses}L
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono text-neutral-500">
                      {formatCurrency(elim.totalSales)}
                    </p>
                    <Skull className="w-3.5 h-3.5 text-red-500/50 ml-auto mt-0.5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---- Bottom Row: Prizes + Rules ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Prizes */}
          <div className="bg-neutral-900/80 rounded-xl border border-neutral-800 p-5">
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400" />
              Prizes at Stake
            </h3>
            <div className="space-y-3">
              <PrizeCard
                icon={<Crown className="w-6 h-6 text-amber-400" />}
                label="Redemption Champion"
                value={prizes.champion}
              />
              <PrizeCard
                icon={<Medal className="w-6 h-6 text-zinc-400" />}
                label="Runner-Up"
                value={prizes.runnerUp}
              />
              <PrizeCard
                icon={<Shield className="w-6 h-6 text-emerald-400" />}
                label="Iron Man (Most Total Matches)"
                value={prizes.ironMan}
              />
              <PrizeCard
                icon={<Flame className="w-6 h-6 text-red-400" />}
                label="Comeback King (Best LB Run)"
                value={prizes.comebackKing}
              />
            </div>
          </div>

          {/* Rules */}
          <div className="space-y-4">
            <div className="bg-neutral-900/80 rounded-xl border border-neutral-800 p-5">
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#39FF14]" />
                How Double Elimination Works
              </h3>
              <ul className="space-y-2.5 text-sm text-neutral-400">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-emerald-400">Everyone starts in the Winners Bracket</strong> with 2 lives.
                    Lose once and you drop to the Losers Bracket.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-amber-400">Losers Bracket is your second chance.</strong> You have 1 life left.
                    Lose again and you&apos;re eliminated for good.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-red-400">Two losses = elimination.</strong> No exceptions. The Losers Bracket
                    is brutal but it&apos;s not the end until you lose there too.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-amber-300">Grand Finals:</strong> Winners Bracket champion faces the Losers Bracket
                    survivor. WB champ gets a 15% sales bonus advantage for never losing.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-[#39FF14] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-[#39FF14]">Sales = weekly commission earned</strong> (from JobNimbus data).
                    Higher seller wins each matchup.
                  </span>
                </li>
              </ul>
            </div>

            {/* Bracket flow explanation */}
            <div className="bg-gradient-to-br from-red-950/30 via-neutral-900 to-amber-950/20 rounded-xl border border-red-900/30 p-5">
              <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Bracket Flow
              </h3>
              <div className="text-xs text-neutral-400 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-16 text-emerald-400 font-bold">WINNERS:</span>
                  <span>W-R1 (Wk 1) &rarr; W-Semis (Wk 2) &rarr; W-Final (Wk 3) &rarr; Grand Finals (Wk 5)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-16 text-amber-400 font-bold">LOSERS:</span>
                  <span>L-R1 (Wk 2) &rarr; L-R2 (Wk 3) &rarr; L-Semi (Wk 4) &rarr; L-Final (Wk 4) &rarr; Grand Finals (Wk 5)</span>
                </div>
                <div className="flex items-start gap-2 mt-2 pt-2 border-t border-neutral-800">
                  <span className="shrink-0 w-16 text-amber-300 font-bold">FINALS:</span>
                  <span>WB Champ (undefeated, +15% bonus) vs LB Survivor (fought through losers bracket)</span>
                </div>
              </div>
            </div>

            {/* Motivational callout */}
            <div className="bg-gradient-to-br from-emerald-950/20 to-neutral-900 rounded-xl border border-emerald-900/30 p-5 text-center">
              <Shield className="w-8 h-8 text-[#39FF14] mx-auto mb-2 opacity-80" />
              <p className="text-sm font-bold text-[#39FF14]">
                &ldquo;You&apos;re not out until you lose twice.&rdquo;
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                The Losers Bracket is a second chance, not a death sentence.
                Every comeback story starts with a loss.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
