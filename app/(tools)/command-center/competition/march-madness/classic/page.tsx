'use client';

/**
 * RCRS March Madness 2026 - Classic Bracket
 *
 * Single elimination, 3 weeks, 50% carryover from previous week.
 * Seeded by 2026 YTD sales (accrual).
 * Each rep name links to their /command-center/sales/[slug] page.
 *
 * Data source: /api/data/march-madness-2026
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
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface MatchSeed {
  seed: number;
  name: string;
  slug: string;
  weekSales: number;
  carryForward: number;
  effectiveTotal: number;
  winner: boolean;
}

interface Match {
  matchId: string;
  topSeed: MatchSeed;
  bottomSeed: MatchSeed | null;
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
  slug: string;
  ytdSales: number;
  nickname: string;
}

interface TournamentRules {
  carryoverRate: number;
  rounds: number;
  weeks: number;
  seeding: string;
  salesDefinition: string;
  advancement: string;
  byeRule: string;
}

interface BracketData {
  tournament: {
    name: string;
    year: number;
    startDate: string;
    endDate: string;
    status: string;
    currentRound: number;
    currentWeek: string;
    format: string;
    salesType: string;
    salesDescription: string;
  };
  rules: TournamentRules;
  rounds: Round[];
  participants: Participant[];
  bracket: {
    round1: Match[];
    round2: Match[];
    round3: Match[];
  };
  champion: string | null;
  prizes: {
    champion: string;
    runnerUp: string;
    mvp: string;
  };
}

// =============================================================================
// Helpers
// =============================================================================

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatCurrencyExact(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
  };
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

/** Build the URL for a rep's detail page */
function repHref(slug: string): string {
  return `/command-center/sales/${slug}`;
}

// =============================================================================
// Sub-Components
// =============================================================================

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

/** Individual seed/player row within a matchup — name links to rep page */
function SeedRow({
  seed,
  isWinner,
  roundStatus,
  showSales,
}: {
  seed: MatchSeed;
  isWinner: boolean;
  roundStatus: Round['status'];
  showSales: boolean;
}) {
  const isCompleted = roundStatus === 'completed';
  const isActive = roundStatus === 'active';
  const eliminated = isCompleted && !isWinner;
  const hasCarry = seed.carryForward > 0;

  return (
    <div
      className={cn(
        'relative flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all',
        isWinner && isCompleted && 'bg-[#39FF14]/10 border border-[#39FF14]/20',
        eliminated && 'opacity-40',
        isActive && 'bg-neutral-800/70',
        !isActive && !isCompleted && 'bg-neutral-800/30',
      )}
    >
      {/* Seed badge */}
      <div
        className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 bg-gradient-to-br',
          getSeedColor(seed.seed),
          eliminated && 'grayscale',
        )}
      >
        <span className="text-white drop-shadow">{seed.seed}</span>
      </div>

      {/* Name — links to rep detail page */}
      <Link
        href={repHref(seed.slug)}
        className={cn(
          'font-bold text-sm truncate flex-1 hover:underline decoration-1 underline-offset-2 transition-colors',
          isWinner && isCompleted ? 'text-[#39FF14] hover:text-[#39FF14]/80' : eliminated ? 'text-neutral-500 line-through pointer-events-none' : 'text-white hover:text-[#39FF14]',
        )}
      >
        {seed.name}
      </Link>

      {/* Sales breakdown */}
      {showSales && (isCompleted || isActive) && (
        <div className="flex flex-col items-end shrink-0">
          {/* Effective total */}
          <span
            className={cn(
              'text-xs font-mono font-bold',
              isWinner && isCompleted ? 'text-[#39FF14]' : eliminated ? 'text-neutral-600' : 'text-neutral-300',
            )}
          >
            {seed.effectiveTotal > 0 ? formatCurrencyExact(seed.effectiveTotal) : '--'}
          </span>
          {/* Carryover breakdown */}
          {hasCarry && !eliminated && (
            <span className="text-[9px] text-orange-400/70 font-mono">
              +{formatCurrencyExact(seed.carryForward)} carry
            </span>
          )}
        </div>
      )}

      {/* Winner crown */}
      {isWinner && isCompleted && (
        <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      )}
    </div>
  );
}

/** Single matchup card */
function MatchupCard({
  match,
  roundStatus,
  isChampionship,
}: {
  match: Match;
  roundStatus: Round['status'];
  isChampionship?: boolean;
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
      {isActive && (
        <div className="absolute -inset-px rounded-xl bg-gradient-to-r from-[#39FF14]/10 via-transparent to-[#39FF14]/10 animate-pulse pointer-events-none" />
      )}

      {isActive && !isBye && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
          <span className="px-3 py-0.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1 shadow-lg shadow-red-600/40">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </span>
        </div>
      )}

      <div className="relative z-[1] p-3 space-y-1">
        <SeedRow seed={match.topSeed} isWinner={match.topSeed.winner} roundStatus={roundStatus} showSales={!isBye} />

        {!isBye ? (
          <>
            <div className="flex items-center gap-2 px-2">
              <div className="flex-1 h-px bg-neutral-700" />
              <span className={cn('text-[10px] font-black tracking-wider', isActive ? 'text-[#39FF14]' : 'text-neutral-600')}>VS</span>
              <div className="flex-1 h-px bg-neutral-700" />
            </div>
            <SeedRow seed={match.bottomSeed!} isWinner={match.bottomSeed!.winner} roundStatus={roundStatus} showSales />
          </>
        ) : (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-neutral-800/50">
            <div className="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center">
              <span className="text-[10px] text-neutral-500 font-bold">--</span>
            </div>
            <span className="text-xs text-neutral-500 italic font-medium">BYE</span>
            <span className="ml-auto text-[10px] text-neutral-600 font-medium">Auto-advance</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Bracket connector SVG lines */
function BracketConnectors({
  fromCount,
  toCount,
  isActive,
}: {
  fromCount: number;
  toCount: number;
  isActive: boolean;
}) {
  const cardHeight = 120;
  const gap = 16;
  const totalFromHeight = fromCount * cardHeight + (fromCount - 1) * gap;
  const totalToHeight = toCount * cardHeight + (toCount - 1) * gap;
  const svgHeight = Math.max(totalFromHeight, totalToHeight);
  const toOffset = (totalFromHeight - totalToHeight) / 2;

  return (
    <svg className="shrink-0 hidden lg:block" width="48" height={svgHeight} viewBox={`0 0 48 ${svgHeight}`}>
      {Array.from({ length: toCount }).map((_, i) => {
        const fromIdx1 = i * 2;
        const fromIdx2 = i * 2 + 1;
        const fromY1 = fromIdx1 * (cardHeight + gap) + cardHeight / 2;
        const fromY2 = fromIdx2 < fromCount ? fromIdx2 * (cardHeight + gap) + cardHeight / 2 : fromY1;
        const toY = toOffset + i * (cardHeight + gap) + cardHeight / 2;
        return (
          <g key={i}>
            <path d={`M 0 ${fromY1} C 20 ${fromY1}, 20 ${toY}, 48 ${toY}`} stroke={isActive ? '#39FF14' : '#404040'} strokeWidth="2" fill="none" strokeDasharray={isActive ? undefined : '4 4'} />
            {fromIdx2 < fromCount && (
              <path d={`M 0 ${fromY2} C 20 ${fromY2}, 20 ${toY}, 48 ${toY}`} stroke={isActive ? '#39FF14' : '#404040'} strokeWidth="2" fill="none" strokeDasharray={isActive ? undefined : '4 4'} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Round status badge */
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
      <span className="text-[10px] opacity-70">{formatDate(round.weekStart)} – {formatDate(round.weekEnd)}</span>
    </div>
  );
}

/** Seeding table with links */
function SeedingTable({ participants }: { participants: Participant[] }) {
  return (
    <div className="bg-neutral-900/80 rounded-xl border border-neutral-800 p-5">
      <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Target className="w-4 h-4" />
        Seeding — 2026 YTD Sales
      </h3>
      <div className="space-y-1.5">
        {participants.map((p) => (
          <Link
            key={p.seed}
            href={repHref(p.slug)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-neutral-800/50 hover:bg-neutral-800 hover:border-[#39FF14]/20 border border-transparent transition-all group"
          >
            <div className={cn('w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-black text-white shrink-0', getSeedColor(p.seed))}>
              {p.seed}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-white text-sm truncate block group-hover:text-[#39FF14] transition-colors">{p.name}</span>
              <span className="text-[11px] text-neutral-500 italic">&quot;{p.nickname}&quot;</span>
            </div>
            <span className="text-sm font-mono font-bold text-[#39FF14] shrink-0">{formatCurrency(p.ytdSales)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Stats bar: remaining, eliminated, MVP */
function TournamentStats({
  bracket,
  rounds,
  participants,
}: {
  bracket: BracketData['bracket'];
  rounds: Round[];
  participants: Participant[];
}) {
  const eliminatedNames = new Set<string>();
  for (const round of rounds.filter((r) => r.status === 'completed')) {
    const matches = bracket[`round${round.round}` as keyof typeof bracket] || [];
    for (const match of matches) {
      if (!match.bottomSeed) continue;
      if (!match.topSeed.winner && !match.bottomSeed.winner) continue;
      if (!match.topSeed.winner) eliminatedNames.add(match.topSeed.name);
      if (match.bottomSeed && !match.bottomSeed.winner) eliminatedNames.add(match.bottomSeed.name);
    }
  }

  let mvpWeek = { name: '', effectiveTotal: 0, round: '' };
  for (const round of rounds) {
    const matches = bracket[`round${round.round}` as keyof typeof bracket] || [];
    for (const match of matches) {
      if (match.topSeed.effectiveTotal > mvpWeek.effectiveTotal) {
        mvpWeek = { name: match.topSeed.name, effectiveTotal: match.topSeed.effectiveTotal, round: round.name };
      }
      if (match.bottomSeed && match.bottomSeed.effectiveTotal > mvpWeek.effectiveTotal) {
        mvpWeek = { name: match.bottomSeed.name, effectiveTotal: match.bottomSeed.effectiveTotal, round: round.name };
      }
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-neutral-900/80 rounded-xl border border-neutral-800 p-4 text-center">
        <p className="text-4xl font-black text-white">{participants.length - eliminatedNames.size}</p>
        <p className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mt-1">Competitors Remaining</p>
      </div>
      <div className="bg-neutral-900/80 rounded-xl border border-neutral-800 p-4">
        <p className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mb-2">Eliminated</p>
        {eliminatedNames.size === 0 ? (
          <p className="text-neutral-600 text-sm italic">None yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Array.from(eliminatedNames).map((name) => (
              <span key={name} className="px-2 py-1 bg-red-950/50 border border-red-900/30 rounded text-xs text-red-400 font-medium line-through">{name}</span>
            ))}
          </div>
        )}
      </div>
      <div className="bg-neutral-900/80 rounded-xl border border-amber-800/30 p-4">
        <p className="text-[11px] uppercase tracking-wider text-amber-500 font-semibold mb-1 flex items-center gap-1">
          <Flame className="w-3 h-3" /> Best Single-Week Effective Total
        </p>
        {mvpWeek.effectiveTotal > 0 ? (
          <>
            <p className="text-lg font-black text-amber-400">{mvpWeek.name}</p>
            <p className="text-sm font-mono text-[#39FF14]">
              {formatCurrencyExact(mvpWeek.effectiveTotal)} <span className="text-neutral-500 text-xs">({mvpWeek.round})</span>
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

export default function MarchMadnessClassicPage() {
  const [data, setData] = useState<BracketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0 });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/data/march-madness-2026');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!data) return;
    const activeRound = data.rounds.find((r) => r.status === 'active');
    const targetDate = activeRound?.weekEnd;
    if (!targetDate) return;
    const interval = setInterval(() => setCountdown(getCountdown(targetDate)), 60000);
    setCountdown(getCountdown(targetDate));
    return () => clearInterval(interval);
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <BasketballIcon className="w-12 h-12 animate-bounce" />
          <p className="text-neutral-400 text-sm font-medium animate-pulse">Loading bracket...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <BasketballIcon className="w-10 h-10 mx-auto opacity-40" />
          <p className="text-red-400 font-semibold">Failed to load bracket</p>
          <p className="text-neutral-500 text-sm">{error}</p>
          <button onClick={fetchData} className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-700 transition-colors text-sm">Retry</button>
        </div>
      </div>
    );
  }

  const { tournament, rules, rounds, participants, bracket, champion, prizes } = data;
  const activeRound = rounds.find((r) => r.status === 'active');

  return (
    <div className="min-h-screen bg-neutral-950 text-white selection:bg-[#39FF14]/30 selection:text-white">
      {/* ====== HERO HEADER ====== */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #39FF14 0, #39FF14 1px, transparent 0, transparent 50%)', backgroundSize: '24px 24px' }} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-orange-950/30 via-neutral-950 to-neutral-950" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-8">
          <Link href="/command-center/competition/march-madness" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-[#39FF14] transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Tournaments
          </Link>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-xl shadow-orange-500/20">
                <BasketballIcon className="w-10 h-10" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-neutral-950 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-[#39FF14]" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-orange-400">MARCH MADNESS</span>
                <span className="text-neutral-400 text-lg sm:text-xl ml-3 font-bold">2026</span>
              </h1>
              <p className="text-neutral-500 text-sm mt-0.5 flex items-center gap-2 flex-wrap">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(tournament.startDate)} – {formatDate(tournament.endDate)}
                <span className="text-neutral-700">|</span>
                <span className="text-orange-400 font-semibold">Classic Bracket + 50% Carryover</span>
              </p>
            </div>
            <div className="sm:ml-auto">
              <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-600 text-neutral-400 hover:text-white text-xs transition-colors">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
          </div>

          {/* Round badges + countdown */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex flex-wrap gap-2">
              {rounds.map((r) => <RoundBadge key={r.round} round={r} />)}
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
        <TournamentStats bracket={bracket} rounds={rounds} participants={participants} />

        {/* ---- ACCRUAL RULE CALLOUT ---- */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#39FF14]/5 border border-[#39FF14]/20">
          <Info className="w-4 h-4 text-[#39FF14] shrink-0 mt-0.5" />
          <div className="text-sm text-neutral-300">
            <span className="font-bold text-[#39FF14]">Accrual Sales:</span> {tournament.salesDescription}
            {' '}<span className="text-neutral-500">50% of your week&apos;s sales carry into the next round.</span>
          </div>
        </div>

        {/* ---- THE BRACKET ---- */}
        <div className="bg-neutral-900/40 rounded-2xl border border-neutral-800 p-6 overflow-x-auto">
          <div className="flex items-center gap-3 mb-6">
            <Swords className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-black uppercase tracking-wider text-neutral-300">Tournament Bracket</h2>
          </div>

          <div className="flex items-start gap-0 min-w-[820px]">
            {/* ROUND 1 */}
            <div className="flex flex-col gap-4 shrink-0" style={{ width: '260px' }}>
              <div className="text-center mb-2">
                <span className={cn('text-xs font-bold uppercase tracking-widest', rounds[0]?.status === 'active' ? 'text-[#39FF14]' : rounds[0]?.status === 'completed' ? 'text-neutral-500' : 'text-neutral-700')}>First Round</span>
                <p className="text-[10px] text-neutral-600 mt-0.5">{formatDate(rounds[0]?.weekStart || '')} – {formatDate(rounds[0]?.weekEnd || '')}</p>
              </div>
              {bracket.round1.map((match) => (
                <MatchupCard key={match.matchId} match={match} roundStatus={rounds[0]?.status || 'upcoming'} />
              ))}
            </div>

            {/* Connectors R1→R2 */}
            <div className="flex items-center shrink-0 pt-12">
              <BracketConnectors fromCount={bracket.round1.length} toCount={bracket.round2.length} isActive={rounds[1]?.status === 'active'} />
            </div>

            {/* ROUND 2 – Semifinals */}
            <div className="flex flex-col gap-4 shrink-0" style={{ width: '260px' }}>
              <div className="text-center mb-2">
                <span className={cn('text-xs font-bold uppercase tracking-widest', rounds[1]?.status === 'active' ? 'text-[#39FF14]' : rounds[1]?.status === 'completed' ? 'text-neutral-500' : 'text-neutral-700')}>Semifinals</span>
                <p className="text-[10px] text-neutral-600 mt-0.5">{formatDate(rounds[1]?.weekStart || '')} – {formatDate(rounds[1]?.weekEnd || '')}</p>
              </div>
              <div className="flex flex-col justify-center gap-4" style={{ marginTop: '60px' }}>
                {bracket.round2.map((match) => (
                  <MatchupCard key={match.matchId} match={match} roundStatus={rounds[1]?.status || 'upcoming'} />
                ))}
              </div>
            </div>

            {/* Connectors R2→R3 */}
            <div className="flex items-center shrink-0" style={{ paddingTop: '130px' }}>
              <BracketConnectors fromCount={bracket.round2.length} toCount={bracket.round3.length} isActive={rounds[2]?.status === 'active'} />
            </div>

            {/* ROUND 3 – Championship */}
            <div className="flex flex-col gap-4 shrink-0" style={{ width: '280px' }}>
              <div className="text-center mb-2">
                <span className={cn('text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5', rounds[2]?.status === 'active' ? 'text-[#39FF14]' : rounds[2]?.status === 'completed' ? 'text-amber-400' : 'text-neutral-700')}>
                  <Trophy className="w-3.5 h-3.5" /> Championship <Trophy className="w-3.5 h-3.5" />
                </span>
                <p className="text-[10px] text-neutral-600 mt-0.5">{formatDate(rounds[2]?.weekStart || '')} – {formatDate(rounds[2]?.weekEnd || '')}</p>
              </div>
              <div style={{ marginTop: '130px' }}>
                {bracket.round3.map((match) => (
                  <MatchupCard key={match.matchId} match={match} roundStatus={rounds[2]?.status || 'upcoming'} isChampionship />
                ))}
              </div>

              {champion ? (
                <div className="mt-4 text-center p-4 rounded-xl bg-gradient-to-b from-amber-900/30 to-neutral-900 border border-amber-500/30">
                  <Crown className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <p className="text-xs uppercase tracking-widest text-amber-500 font-bold">Champion</p>
                  <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-200 mt-1">{champion}</p>
                </div>
              ) : rounds[2]?.status === 'active' && (
                <div className="mt-4 text-center p-4 rounded-xl border border-dashed border-[#39FF14]/30 bg-[#39FF14]/5">
                  <Flame className="w-6 h-6 text-orange-400 mx-auto mb-1 animate-pulse" />
                  <p className="text-xs text-[#39FF14] font-bold uppercase tracking-widest">Championship Week</p>
                  <p className="text-neutral-500 text-[11px] mt-1">Who will be crowned?</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ---- Bottom: Seeding + Rules + Prizes ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SeedingTable participants={participants} />

          <div className="space-y-4">
            {/* Prizes */}
            <div className="bg-neutral-900/80 rounded-xl border border-neutral-800 p-5">
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" /> Prizes
              </h3>
              <div className="space-y-3">
                {[
                  { icon: <Trophy className="w-6 h-6 text-amber-400" />, label: 'Champion', value: prizes.champion },
                  { icon: <Medal className="w-6 h-6 text-zinc-400" />, label: 'Runner-Up', value: prizes.runnerUp },
                  { icon: <Flame className="w-6 h-6 text-orange-400" />, label: 'MVP (Best Effective Week)', value: prizes.mvp },
                ].map((p) => (
                  <div key={p.label} className="flex items-center gap-3 px-4 py-3 bg-neutral-900/80 rounded-xl border border-neutral-800 hover:border-[#39FF14]/30 transition-colors">
                    <div className="shrink-0">{p.icon}</div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">{p.label}</p>
                      <p className="text-sm font-bold text-white">{p.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rules */}
            <div className="bg-neutral-900/80 rounded-xl border border-neutral-800 p-5">
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#39FF14]" /> How It Works
              </h3>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-[#39FF14] shrink-0 mt-0.5" />
                  <span>7 reps seeded by <strong className="text-white">2026 YTD sales</strong>. #1 seed gets a first-round BYE.</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-[#39FF14] shrink-0 mt-0.5" />
                  <span>Head-to-head each week. Higher <strong className="text-white">effective total</strong> (week sales + 50% carryover) advances.</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-[#39FF14] shrink-0 mt-0.5" />
                  <span><strong className="text-orange-400">50% carryover:</strong> Half of your previous week&apos;s sales carry into the next round.</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-[#39FF14] shrink-0 mt-0.5" />
                  <span><strong className="text-[#39FF14]">Accrual:</strong> Deposit received = full job total credited. $10K deposit on $10K job = $10K.</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-[#39FF14] shrink-0 mt-0.5" />
                  <span>3 rounds across March. Last rep standing wins the championship.</span>
                </li>
              </ul>
            </div>

            {/* Matchup Recap */}
            <div className="bg-gradient-to-br from-orange-950/30 to-neutral-900 rounded-xl border border-orange-900/30 p-5">
              <h3 className="text-sm font-bold text-orange-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Bracket Matchups
              </h3>
              <div className="text-xs text-neutral-400 space-y-1">
                <p><span className="text-orange-300 font-bold">R1:</span> #5 vs #4 &bull; #2 vs #7 &bull; #3 vs #6 &bull; #1 gets BYE</p>
                <p><span className="text-orange-300 font-bold">R2:</span> R1 winners face off (+50% carryover)</p>
                <p><span className="text-orange-300 font-bold">R3:</span> Championship — winner takes all (+50% carryover)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
