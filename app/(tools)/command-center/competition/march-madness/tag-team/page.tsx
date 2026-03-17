'use client';

/**
 * RCRS March Madness 2026 - Tag Team Showdown
 *
 * 7 reps randomly paired each week (3 pairs + 1 solo w/ 1.5x multiplier).
 * Combined pair sales scored and ranked. Points accumulate over 4 weeks.
 * Individual with most total points wins.
 *
 * Data source: /api/data/march-madness/tag-team
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Users,
  Handshake,
  Timer,
  RefreshCw,
  Crown,
  ArrowLeft,
  ChevronRight,
  Star,
  Zap,
  Medal,
  TrendingUp,
  Calendar,
  Shield,
  Award,
  Flame,
  User,
  Gift,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface RepSales {
  name: string;
  individualSales: number;
}

interface Pairing {
  pairId: string;
  type: 'pair' | 'solo';
  rep1: RepSales;
  rep2: RepSales | null;
  combinedSales: number;
  soloNote?: string;
}

interface WeekRanking {
  rank: number;
  pairId: string;
  names: string;
  score: number;
}

interface Week {
  week: number;
  start: string;
  end: string;
  status: 'completed' | 'active' | 'upcoming';
  pairings: Pairing[];
  rankings: WeekRanking[];
}

interface Participant {
  name: string;
  slug: string;
  seed: number;
  nickname: string;
  totalPoints: number;
  totalSales: number;
  wins: number;
  losses: number;
  pairHistory: string[];
}

interface Standing {
  rank: number;
  name: string;
  points: number;
  totalSales: number;
  avgSales: number;
  wins: number;
  losses: number;
  bestPair: string;
}

interface BestPair {
  names: string;
  week: number;
  combinedSales: number;
}

interface Prizes {
  champion: string;
  runnerUp: string;
  bestPartner: string;
  ironMan: string;
}

interface Settings {
  soloMultiplier: number;
  winPoints: number;
  tiePoints: number;
  lossPoints: number;
  totalWeeks: number;
}

interface TournamentInfo {
  id: string;
  name: string;
  currentWeek: number;
  [key: string]: unknown;
}

interface TagTeamData {
  tournament: TournamentInfo;
  settings: Settings;
  participants: Participant[];
  weeks: Week[];
  standings: Standing[];
  bestPairAllTime: BestPair;
  prizes: Prizes;
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

function getRankBadge(rank: number): { bg: string; text: string; border: string; label: string } {
  switch (rank) {
    case 1:
      return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40', label: '1st' };
    case 2:
      return { bg: 'bg-zinc-400/15', text: 'text-zinc-300', border: 'border-zinc-400/30', label: '2nd' };
    case 3:
      return { bg: 'bg-orange-600/15', text: 'text-orange-400', border: 'border-orange-600/30', label: '3rd' };
    default:
      return { bg: 'bg-neutral-800/50', text: 'text-neutral-500', border: 'border-neutral-700', label: `${rank}th` };
  }
}

// =============================================================================
// Sub-Components
// =============================================================================

/** Animated confetti/glow particles for winning pairs */
function PairConfetti() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-xl">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full animate-ping"
          style={{
            background: i % 3 === 0 ? '#39FF14' : i % 3 === 1 ? '#A78BFA' : '#8B5CF6',
            left: `${10 + Math.random() * 80}%`,
            top: `${5 + Math.random() * 90}%`,
            animationDelay: `${i * 0.25}s`,
            animationDuration: `${1.5 + Math.random() * 1.5}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Pairing card showing two reps side by side (or solo) */
function PairingCard({
  pairing,
  weekStatus,
  weekRank,
}: {
  pairing: Pairing;
  weekStatus: Week['status'];
  weekRank?: number;
}) {
  const isSolo = pairing.type === 'solo';
  const isActive = weekStatus === 'active';
  const isCompleted = weekStatus === 'completed';
  const isWinner = weekRank === 1 && isCompleted;
  const rank = weekRank ? getRankBadge(weekRank) : null;

  return (
    <div
      className={cn(
        'relative rounded-xl border transition-all duration-300',
        isWinner && 'ring-2 ring-violet-400/40',
        isActive && 'border-violet-500/50 bg-neutral-900/90 shadow-lg shadow-violet-500/10',
        isCompleted && !isWinner && 'border-neutral-700 bg-neutral-900/60',
        isCompleted && isWinner && 'border-violet-400/50 bg-neutral-900/90',
        !isActive && !isCompleted && 'border-neutral-800 bg-neutral-900/40 opacity-60',
      )}
    >
      {/* Winner glow */}
      {isWinner && <PairConfetti />}
      {isActive && (
        <div className="absolute -inset-px rounded-xl bg-gradient-to-r from-violet-500/10 via-transparent to-[#39FF14]/10 animate-pulse" />
      )}

      {/* LIVE badge */}
      {isActive && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
          <span className="px-3 py-0.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1 shadow-lg shadow-red-600/40">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </span>
        </div>
      )}

      {/* Solo badge */}
      {isSolo && (
        <div className="absolute -top-2.5 right-3 z-10">
          <span className="px-2.5 py-0.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-amber-600/30">
            1.5x SOLO
          </span>
        </div>
      )}

      {/* Rank badge */}
      {rank && isCompleted && (
        <div className="absolute -top-2.5 left-3 z-10">
          <span className={cn(
            'px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full border',
            rank.bg, rank.text, rank.border,
          )}>
            {rank.label}
          </span>
        </div>
      )}

      <div className="relative z-[1] p-4">
        {/* Reps row */}
        <div className={cn('flex items-center gap-3', isSolo ? 'justify-center' : 'justify-between')}>
          {/* Rep 1 */}
          <div className={cn('flex-1 text-center', isSolo && 'max-w-[200px]')}>
            <div className={cn(
              'w-10 h-10 rounded-full mx-auto mb-1.5 flex items-center justify-center',
              'bg-gradient-to-br from-violet-500 to-purple-600',
            )}>
              <User className="w-5 h-5 text-white" />
            </div>
            <p className={cn(
              'font-bold text-sm truncate',
              isWinner ? 'text-[#39FF14]' : 'text-white',
            )}>
              {pairing.rep1.name.split(' ')[0]}
            </p>
            <p className="text-[11px] text-neutral-500 truncate">{pairing.rep1.name.split(' ').slice(1).join(' ')}</p>
            {(isActive || isCompleted) && (
              <p className={cn(
                'text-xs font-mono font-bold mt-1',
                isWinner ? 'text-[#39FF14]' : 'text-neutral-400',
              )}>
                {formatCurrency(pairing.rep1.individualSales)}
              </p>
            )}
          </div>

          {/* Handshake / Plus divider */}
          {!isSolo && (
            <div className="flex flex-col items-center shrink-0">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center',
                isWinner ? 'bg-violet-500/30' : isActive ? 'bg-violet-500/20' : 'bg-neutral-800',
              )}>
                <Handshake className={cn(
                  'w-5 h-5',
                  isWinner ? 'text-violet-300' : isActive ? 'text-violet-400' : 'text-neutral-600',
                )} />
              </div>
              {(isActive || isCompleted) && (
                <p className={cn(
                  'text-xs font-black mt-1.5',
                  isWinner ? 'text-[#39FF14]' : isActive ? 'text-violet-300' : 'text-neutral-500',
                )}>
                  {formatCurrency(pairing.combinedSales)}
                </p>
              )}
              {(!isActive && !isCompleted) && (
                <p className="text-[10px] text-neutral-600 mt-1 font-medium">Combined</p>
              )}
            </div>
          )}

          {/* Rep 2 (pair only) */}
          {!isSolo && pairing.rep2 && (
            <div className="flex-1 text-center">
              <div className={cn(
                'w-10 h-10 rounded-full mx-auto mb-1.5 flex items-center justify-center',
                'bg-gradient-to-br from-purple-500 to-indigo-600',
              )}>
                <User className="w-5 h-5 text-white" />
              </div>
              <p className={cn(
                'font-bold text-sm truncate',
                isWinner ? 'text-[#39FF14]' : 'text-white',
              )}>
                {pairing.rep2.name.split(' ')[0]}
              </p>
              <p className="text-[11px] text-neutral-500 truncate">{pairing.rep2.name.split(' ').slice(1).join(' ')}</p>
              {(isActive || isCompleted) && (
                <p className={cn(
                  'text-xs font-mono font-bold mt-1',
                  isWinner ? 'text-[#39FF14]' : 'text-neutral-400',
                )}>
                  {formatCurrency(pairing.rep2.individualSales)}
                </p>
              )}
            </div>
          )}

          {/* Solo combined display */}
          {isSolo && (isActive || isCompleted) && (
            <div className="flex-shrink-0 text-center ml-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-[10px] uppercase tracking-wider text-amber-500 font-bold">1.5x Score</p>
              <p className={cn(
                'text-lg font-black font-mono',
                isWinner ? 'text-[#39FF14]' : 'text-amber-300',
              )}>
                {formatCurrency(pairing.combinedSales)}
              </p>
            </div>
          )}
        </div>

        {/* Winner crown */}
        {isWinner && (
          <div className="flex items-center justify-center gap-1.5 mt-3 pt-2 border-t border-violet-400/20">
            <Crown className="w-3.5 h-3.5 text-amber-400 animate-bounce" style={{ animationDuration: '2s' }} />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Week Winner</span>
            <Crown className="w-3.5 h-3.5 text-amber-400 animate-bounce" style={{ animationDuration: '2s' }} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Prize card */
function PrizeCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-neutral-900/80 rounded-xl border border-neutral-800 hover:border-violet-500/30 transition-colors">
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">{label}</p>
        <p className="text-sm font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function TagTeamShowdownPage() {
  const [data, setData] = useState<TagTeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeWeek, setActiveWeek] = useState<number>(1);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0 });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/data/march-madness/tag-team');
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load tag team data`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      // Default to current week or latest completed
      const currentWk = json.tournament?.currentWeek || 1;
      setActiveWeek(currentWk);
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

  // Countdown timer for current week end
  useEffect(() => {
    if (!data) return;
    const currentWeekData = data.weeks.find((w) => w.status === 'active');
    if (!currentWeekData) return;

    const interval = setInterval(() => {
      setCountdown(getCountdown(currentWeekData.end));
    }, 60000);
    setCountdown(getCountdown(currentWeekData.end));

    return () => clearInterval(interval);
  }, [data]);

  // ---- Loading State ----
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center animate-bounce">
            <Handshake className="w-7 h-7 text-white" />
          </div>
          <p className="text-neutral-400 text-sm font-medium animate-pulse">Loading tag teams...</p>
        </div>
      </div>
    );
  }

  // ---- Error State ----
  if (error || !data) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Handshake className="w-10 h-10 mx-auto text-neutral-600" />
          <p className="text-red-400 font-semibold">Failed to load tag team data</p>
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

  const { tournament, settings, participants, weeks, standings, bestPairAllTime, prizes } = data;
  const selectedWeek = weeks.find((w) => w.week === activeWeek);
  const currentWeekData = weeks.find((w) => w.status === 'active');

  // Compute stats
  const totalCombinedSales = weeks
    .filter((w) => w.status !== 'upcoming')
    .reduce((sum, w) => sum + w.pairings.reduce((s, p) => s + p.combinedSales, 0), 0);

  // Most dominant pair (highest combined in a single week)
  let dominantPair = { names: '--', sales: 0, week: 0 };
  for (const w of weeks) {
    if (w.status === 'upcoming') continue;
    for (const p of w.pairings) {
      if (p.combinedSales > dominantPair.sales) {
        const names = p.type === 'solo'
          ? `${p.rep1.name.split(' ')[0]} (Solo)`
          : `${p.rep1.name.split(' ')[0]} + ${p.rep2?.name.split(' ')[0] || ''}`;
        dominantPair = { names, sales: p.combinedSales, week: w.week };
      }
    }
  }

  // Most improved: biggest week-over-week sales increase for any individual
  let mostImproved = { name: '--', improvement: 0 };
  if (weeks.filter((w) => w.status === 'completed').length >= 2) {
    const repWeeklySales: Record<string, number[]> = {};
    for (const w of weeks) {
      if (w.status === 'upcoming') continue;
      for (const p of w.pairings) {
        if (!repWeeklySales[p.rep1.name]) repWeeklySales[p.rep1.name] = [];
        repWeeklySales[p.rep1.name].push(p.rep1.individualSales);
        if (p.rep2) {
          if (!repWeeklySales[p.rep2.name]) repWeeklySales[p.rep2.name] = [];
          repWeeklySales[p.rep2.name].push(p.rep2.individualSales);
        }
      }
    }
    for (const [name, sales] of Object.entries(repWeeklySales)) {
      for (let i = 1; i < sales.length; i++) {
        const improvement = sales[i] - sales[i - 1];
        if (improvement > mostImproved.improvement) {
          mostImproved = { name, improvement };
        }
      }
    }
  }

  // Build partner history matrix
  const partnerMatrix: Record<string, Record<number, string>> = {};
  for (const p of participants) {
    partnerMatrix[p.name] = {};
  }
  for (const w of weeks) {
    for (const pairing of w.pairings) {
      if (pairing.type === 'solo') {
        partnerMatrix[pairing.rep1.name] = partnerMatrix[pairing.rep1.name] || {};
        partnerMatrix[pairing.rep1.name][w.week] = 'SOLO';
      } else if (pairing.rep2) {
        partnerMatrix[pairing.rep1.name] = partnerMatrix[pairing.rep1.name] || {};
        partnerMatrix[pairing.rep1.name][w.week] = pairing.rep2.name.split(' ')[0];
        partnerMatrix[pairing.rep2.name] = partnerMatrix[pairing.rep2.name] || {};
        partnerMatrix[pairing.rep2.name][w.week] = pairing.rep1.name.split(' ')[0];
      }
    }
  }

  // Get rank for a pairing in its week
  function getPairingRank(weekData: Week, pairId: string): number | undefined {
    const found = weekData.rankings?.find((r) => r.pairId === pairId);
    return found?.rank;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white selection:bg-violet-500/30 selection:text-white">
      {/* ====== HERO HEADER ====== */}
      <div className="relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, #8B5CF6 0, #8B5CF6 1px, transparent 0, transparent 50%)',
              backgroundSize: '24px 24px',
            }}
          />
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-violet-950/40 via-neutral-950 to-neutral-950" />

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
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-xl shadow-violet-500/20">
                <Handshake className="w-9 h-9 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-neutral-950 flex items-center justify-center">
                <Users className="w-4 h-4 text-[#39FF14]" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-300 to-violet-400">
                  TAG TEAM SHOWDOWN
                </span>
                <span className="text-neutral-400 text-lg sm:text-xl ml-3 font-bold">2026</span>
              </h1>
              <p className="text-neutral-500 text-sm mt-0.5 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                4 Weeks of Team Sales
                <span className="text-neutral-700">|</span>
                <span className="text-violet-400 font-semibold">Random Partners Every Week</span>
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

          {/* Week selector tabs + countdown */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex flex-wrap gap-2">
              {weeks.map((w) => (
                <button
                  key={w.week}
                  onClick={() => setActiveWeek(w.week)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all',
                    w.week === activeWeek && w.status === 'active' && 'bg-[#39FF14]/15 text-[#39FF14] border border-[#39FF14]/30 ring-1 ring-[#39FF14]/20',
                    w.week === activeWeek && w.status === 'completed' && 'bg-violet-500/15 text-violet-300 border border-violet-500/30 ring-1 ring-violet-500/20',
                    w.week === activeWeek && w.status === 'upcoming' && 'bg-neutral-800 text-neutral-300 border border-neutral-600 ring-1 ring-neutral-600/20',
                    w.week !== activeWeek && w.status === 'active' && 'bg-neutral-900 text-[#39FF14]/70 border border-neutral-800 hover:border-[#39FF14]/30',
                    w.week !== activeWeek && w.status === 'completed' && 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:border-neutral-600',
                    w.week !== activeWeek && w.status === 'upcoming' && 'bg-neutral-900 text-neutral-600 border border-neutral-800 hover:border-neutral-700',
                  )}
                >
                  {w.status === 'active' && <span className="w-2 h-2 rounded-full bg-[#39FF14] animate-pulse" />}
                  {w.status === 'completed' && <Medal className="w-3 h-3" />}
                  {w.status === 'upcoming' && <Timer className="w-3 h-3" />}
                  <span>Week {w.week}</span>
                  <span className="text-[10px] opacity-70">
                    {formatDate(w.start)} - {formatDate(w.end)}
                  </span>
                </button>
              ))}
            </div>

            {currentWeekData && (
              <div className="sm:ml-auto flex items-center gap-3 px-4 py-2 rounded-xl bg-neutral-900/80 border border-neutral-800">
                <Timer className="w-4 h-4 text-violet-400" />
                <div className="text-xs">
                  <span className="text-neutral-500 font-medium">Week {currentWeekData.week} ends in</span>
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
        {/* ---- Stats Bar ---- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-neutral-900/80 rounded-xl border border-neutral-800 p-4 text-center">
            <p className="text-3xl font-black text-[#39FF14] font-mono">{formatCurrency(totalCombinedSales)}</p>
            <p className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mt-1">
              Total Combined Sales
            </p>
          </div>
          <div className="bg-neutral-900/80 rounded-xl border border-violet-800/30 p-4">
            <p className="text-[11px] uppercase tracking-wider text-violet-400 font-semibold mb-1 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Most Dominant Pair
            </p>
            {dominantPair.sales > 0 ? (
              <>
                <p className="text-lg font-black text-violet-300">{dominantPair.names}</p>
                <p className="text-sm font-mono text-[#39FF14]">
                  {formatCurrency(dominantPair.sales)}{' '}
                  <span className="text-neutral-500 text-xs">(Week {dominantPair.week})</span>
                </p>
              </>
            ) : (
              <p className="text-neutral-600 text-sm italic">No data yet</p>
            )}
          </div>
          <div className="bg-neutral-900/80 rounded-xl border border-neutral-800 p-4">
            <p className="text-[11px] uppercase tracking-wider text-amber-500 font-semibold mb-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Most Improved
            </p>
            {mostImproved.improvement > 0 ? (
              <>
                <p className="text-lg font-black text-amber-400">{mostImproved.name.split(' ')[0]}</p>
                <p className="text-sm font-mono text-[#39FF14]">
                  +{formatCurrency(mostImproved.improvement)}{' '}
                  <span className="text-neutral-500 text-xs">week-over-week</span>
                </p>
              </>
            ) : (
              <p className="text-neutral-600 text-sm italic">Need 2+ weeks</p>
            )}
          </div>
        </div>

        {/* ---- OVERALL STANDINGS ---- */}
        <div className="bg-neutral-900/40 rounded-2xl border border-neutral-800 p-6">
          <div className="flex items-center gap-3 mb-5">
            <Trophy className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-black uppercase tracking-wider text-neutral-300">
              Overall Standings
            </h2>
          </div>

          {/* Desktop table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-neutral-600 font-bold w-12">#</th>
                  <th className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-neutral-600 font-bold">Name</th>
                  <th className="text-center py-2 px-3 text-[11px] uppercase tracking-wider text-neutral-600 font-bold">Points</th>
                  <th className="text-right py-2 px-3 text-[11px] uppercase tracking-wider text-neutral-600 font-bold">Total Sales</th>
                  <th className="text-center py-2 px-3 text-[11px] uppercase tracking-wider text-neutral-600 font-bold hidden sm:table-cell">Avg Sales</th>
                  <th className="text-center py-2 px-3 text-[11px] uppercase tracking-wider text-neutral-600 font-bold">W-L</th>
                  <th className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-neutral-600 font-bold hidden md:table-cell">Best Partner</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s) => {
                  const isLeader = s.rank === 1;
                  return (
                    <tr
                      key={s.name}
                      className={cn(
                        'border-b border-neutral-800/50 transition-colors hover:bg-neutral-800/30',
                        isLeader && 'bg-violet-500/5',
                      )}
                    >
                      {/* Rank */}
                      <td className="py-3 px-3">
                        {s.rank <= 3 ? (
                          <span className={cn(
                            'inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black',
                            s.rank === 1 && 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30',
                            s.rank === 2 && 'bg-zinc-400/15 text-zinc-300 ring-1 ring-zinc-400/20',
                            s.rank === 3 && 'bg-orange-600/15 text-orange-400 ring-1 ring-orange-600/20',
                          )}>
                            {s.rank}
                          </span>
                        ) : (
                          <span className="text-neutral-600 font-bold pl-2">{s.rank}</span>
                        )}
                      </td>
                      {/* Name */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {isLeader && <Crown className="w-4 h-4 text-amber-400 shrink-0" />}
                          <span className={cn('font-bold', isLeader ? 'text-[#39FF14]' : 'text-white')}>
                            {s.name}
                          </span>
                        </div>
                      </td>
                      {/* Points */}
                      <td className="py-3 px-3 text-center">
                        <span className={cn(
                          'inline-flex items-center justify-center min-w-[36px] px-2 py-1 rounded-lg font-black text-sm',
                          isLeader ? 'bg-[#39FF14]/15 text-[#39FF14]' : 'bg-violet-500/10 text-violet-300',
                        )}>
                          {s.points}
                        </span>
                      </td>
                      {/* Total Sales */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-neutral-300">
                        {formatCurrency(s.totalSales)}
                      </td>
                      {/* Avg Sales */}
                      <td className="py-3 px-3 text-center font-mono text-neutral-500 hidden sm:table-cell">
                        {formatCurrency(s.avgSales)}
                      </td>
                      {/* W-L */}
                      <td className="py-3 px-3 text-center">
                        <span className="text-[#39FF14] font-bold">{s.wins}</span>
                        <span className="text-neutral-600 mx-1">-</span>
                        <span className="text-red-400 font-bold">{s.losses}</span>
                      </td>
                      {/* Best Partner */}
                      <td className="py-3 px-3 hidden md:table-cell">
                        <span className="text-violet-300 text-xs font-medium bg-violet-500/10 px-2 py-0.5 rounded-full">
                          {s.bestPair}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- WEEK PAIRINGS ---- */}
        {selectedWeek && (
          <div className="bg-neutral-900/40 rounded-2xl border border-neutral-800 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-violet-400" />
              <h2 className="text-lg font-black uppercase tracking-wider text-neutral-300">
                Week {selectedWeek.week} Pairings
              </h2>
              {selectedWeek.status === 'active' && (
                <span className="px-2.5 py-0.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1 shadow-lg shadow-red-600/40 ml-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  LIVE
                </span>
              )}
              {selectedWeek.status === 'completed' && (
                <span className="px-2.5 py-0.5 bg-violet-500/15 text-violet-300 text-[10px] font-black uppercase tracking-widest rounded-full border border-violet-500/30 ml-2">
                  FINAL
                </span>
              )}
              {selectedWeek.status === 'upcoming' && (
                <span className="px-2.5 py-0.5 bg-neutral-800 text-neutral-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-neutral-700 ml-2">
                  UPCOMING
                </span>
              )}
            </div>
            <p className="text-neutral-500 text-xs mb-6">
              {formatDate(selectedWeek.start)} - {formatDate(selectedWeek.end)}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {selectedWeek.pairings.map((pairing) => (
                <PairingCard
                  key={pairing.pairId}
                  pairing={pairing}
                  weekStatus={selectedWeek.status}
                  weekRank={getPairingRank(selectedWeek, pairing.pairId)}
                />
              ))}
            </div>

            {/* Week rankings summary */}
            {selectedWeek.status !== 'upcoming' && selectedWeek.rankings && selectedWeek.rankings.length > 0 && (
              <div className="mt-6 pt-4 border-t border-neutral-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3 flex items-center gap-2">
                  <Award className="w-3.5 h-3.5" />
                  Week {selectedWeek.week} Rankings
                </h3>
                <div className="flex flex-wrap gap-3">
                  {selectedWeek.rankings.map((r) => {
                    const rb = getRankBadge(r.rank);
                    return (
                      <div
                        key={r.pairId}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg border',
                          rb.bg, rb.border,
                        )}
                      >
                        <span className={cn('font-black text-sm', rb.text)}>{rb.label}</span>
                        <span className="text-white font-semibold text-sm">{r.names}</span>
                        <span className="text-neutral-400 font-mono text-xs">{formatCurrency(r.score)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---- BEST PAIR ALL TIME ---- */}
        <div className="relative bg-gradient-to-br from-violet-950/40 via-neutral-900 to-purple-950/30 rounded-2xl border border-violet-500/30 p-6 overflow-hidden">
          {/* Background shimmer */}
          <div className="absolute inset-0 opacity-10">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: 'radial-gradient(circle at 30% 50%, #8B5CF6 0%, transparent 50%), radial-gradient(circle at 70% 50%, #39FF14 0%, transparent 50%)',
              }}
            />
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-[#39FF14] flex items-center justify-center shadow-xl shadow-violet-500/30 shrink-0">
              <Handshake className="w-9 h-9 text-white" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-[11px] uppercase tracking-widest text-violet-400 font-bold mb-1">
                Best Pair of All Time
              </p>
              <p className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-purple-200 to-[#39FF14]">
                {bestPairAllTime.names}
              </p>
              <p className="text-neutral-400 text-sm mt-1">
                Week {bestPairAllTime.week} &bull;{' '}
                <span className="text-[#39FF14] font-bold font-mono">
                  {formatCurrency(bestPairAllTime.combinedSales)}
                </span>{' '}
                combined
              </p>
            </div>
            <div className="sm:ml-auto shrink-0">
              <div className="text-center px-6 py-3 rounded-xl bg-neutral-900/60 border border-violet-500/20">
                <p className="text-3xl font-black text-[#39FF14] font-mono">{formatCurrency(bestPairAllTime.combinedSales)}</p>
                <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mt-1">Combined Record</p>
              </div>
            </div>
          </div>
        </div>

        {/* ---- PARTNER HISTORY MATRIX ---- */}
        <div className="bg-neutral-900/40 rounded-2xl border border-neutral-800 p-6">
          <div className="flex items-center gap-3 mb-5">
            <Users className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-black uppercase tracking-wider text-neutral-300">
              Partner History
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-neutral-600 font-bold">Rep</th>
                  {Array.from({ length: settings.totalWeeks }, (_, i) => (
                    <th key={i + 1} className="text-center py-2 px-3 text-[11px] uppercase tracking-wider text-neutral-600 font-bold">
                      Wk {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {participants
                  .sort((a, b) => b.totalPoints - a.totalPoints)
                  .map((p) => (
                    <tr key={p.name} className="border-b border-neutral-800/50 hover:bg-neutral-800/20 transition-colors">
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-white">{p.name.split(' ')[0]}</span>
                        <span className="text-neutral-600 ml-1 text-xs">{p.name.split(' ').slice(1).join(' ')}</span>
                      </td>
                      {Array.from({ length: settings.totalWeeks }, (_, i) => {
                        const weekNum = i + 1;
                        const partner = partnerMatrix[p.name]?.[weekNum];
                        const weekData = weeks.find((w) => w.week === weekNum);
                        const isUpcoming = weekData?.status === 'upcoming';
                        const isSolo = partner === 'SOLO';

                        return (
                          <td key={weekNum} className="py-2.5 px-3 text-center">
                            {!partner ? (
                              <span className="text-neutral-700 text-xs">
                                {isUpcoming ? '?' : '--'}
                              </span>
                            ) : isSolo ? (
                              <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-[10px] font-bold rounded-full border border-amber-500/20">
                                SOLO 1.5x
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-violet-500/10 text-violet-300 text-xs font-medium rounded-full border border-violet-500/15">
                                {partner}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

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
                icon={<Trophy className="w-6 h-6 text-amber-400" />}
                label="Champion (Most Points)"
                value={prizes.champion}
              />
              <PrizeCard
                icon={<Medal className="w-6 h-6 text-zinc-400" />}
                label="Runner-Up"
                value={prizes.runnerUp}
              />
              <PrizeCard
                icon={<Handshake className="w-6 h-6 text-violet-400" />}
                label="Best Partner (Top Pair Score)"
                value={prizes.bestPartner}
              />
              <PrizeCard
                icon={<Gift className="w-6 h-6 text-[#39FF14]" />}
                label="Iron Man (Most Consistent)"
                value={prizes.ironMan}
              />
            </div>
          </div>

          {/* Rules */}
          <div className="space-y-4">
            <div className="bg-neutral-900/80 rounded-xl border border-neutral-800 p-5">
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#39FF14]" />
                How It Works
              </h3>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-[#39FF14] shrink-0 mt-0.5" />
                  <span>7 reps compete over <strong className="text-white">{settings.totalWeeks} weeks</strong>. Each week, reps are randomly paired into teams of 2.</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-[#39FF14] shrink-0 mt-0.5" />
                  <span>3 pairs + 1 solo rep each week. Combined pair sales = team score.</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-amber-400">Solo rep gets {settings.soloMultiplier}x multiplier</strong> on their individual sales to keep it fair.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-[#39FF14] shrink-0 mt-0.5" />
                  <span>
                    Pairs ranked each week: <strong className="text-[#39FF14]">{settings.winPoints} pts</strong> for 1st,{' '}
                    <strong className="text-neutral-300">{settings.tiePoints} pt</strong> for tie,{' '}
                    <strong className="text-red-400">{settings.lossPoints} pts</strong> for last.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-[#39FF14] shrink-0 mt-0.5" />
                  <span>New random partners every week -- no repeat pairs if possible.</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-[#39FF14] shrink-0 mt-0.5" />
                  <span>After {settings.totalWeeks} weeks, the individual with the most total points wins.</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                  <span><strong className="text-white">Tiebreaker:</strong> total individual sales across all weeks.</span>
                </li>
              </ul>
            </div>

            {/* Points breakdown */}
            <div className="bg-gradient-to-br from-violet-950/30 to-neutral-900 rounded-xl border border-violet-900/30 p-5">
              <h3 className="text-sm font-bold text-violet-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Flame className="w-4 h-4" />
                Points Breakdown
              </h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="py-3 rounded-lg bg-[#39FF14]/10 border border-[#39FF14]/20">
                  <p className="text-2xl font-black text-[#39FF14]">{settings.winPoints}</p>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold mt-1">1st Place</p>
                </div>
                <div className="py-3 rounded-lg bg-neutral-800/50 border border-neutral-700">
                  <p className="text-2xl font-black text-neutral-300">{settings.tiePoints}</p>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold mt-1">Tie / Mid</p>
                </div>
                <div className="py-3 rounded-lg bg-red-950/30 border border-red-900/20">
                  <p className="text-2xl font-black text-red-400">{settings.lossPoints}</p>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold mt-1">Last Place</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/15">
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-xs text-amber-300">
                  <strong>{settings.soloMultiplier}x Solo Multiplier:</strong> The odd-one-out rep&apos;s individual sales are multiplied by {settings.soloMultiplier} to create their &quot;team&quot; score.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
