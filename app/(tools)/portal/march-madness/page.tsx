'use client';

/**
 * RCRS March Madness 2026 - Sales Rep Landing Page
 *
 * Shooting theme: crosshairs, targets, scope reticles (NOT basketball).
 * 50% carry-forward between rounds. 7 reps, 3 rounds, 3 weeks.
 * Grand Prize: 10/22 with Suppressor (FFL paperwork required).
 * $100K March sales bonus: automatic prize winner.
 *
 * Visibility gated: hidden from reps until showToReps is enabled by admin.
 * Personalized matchup section for the logged-in user.
 *
 * Data source: /api/data/march-madness/bracket?mode=live
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Crosshair,
  Crown,
  Flame,
  Timer,
  RefreshCw,
  ChevronRight,
  Star,
  Zap,
  Target,
  Medal,
  Calendar,
  Shield,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

// =============================================================================
// Types
// =============================================================================

interface Participant {
  seed: number;
  name: string;
  slug: string;
  nickname: string;
  ytdSales: number;
}

interface MatchSeed {
  seed: number;
  name: string;
  slug?: string;
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

interface Prizes {
  champion: string;
  hundredK: string;
  note: string;
  runnerUp: string;
  mvp: string;
}

interface BracketData {
  tournament: {
    name: string;
    startDate: string;
    endDate: string;
    status: string;
    theme: string;
  };
  rules: {
    carryoverRate: number;
    hundredKRule: string;
  };
  rounds: Round[];
  participants: Participant[];
  bracket: {
    round1: Match[];
    round2: Match[];
    round3: Match[];
  };
  salesByRep: Record<string, { week1: number; week2: number; week3: number }>;
  prizes: Prizes;
  showToReps: boolean;
  announcementEnabled: boolean;
  announcementMessage: string;
}

// =============================================================================
// Helpers
// =============================================================================

function formatCurrency(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

function formatDate(s: string): string {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getCountdown(targetDate: string): { days: number; hours: number; minutes: number; seconds: number } {
  const now = new Date();
  const target = new Date(targetDate + 'T00:00:00');
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
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

/** Calculate each rep's total March sales for the $100K tracker */
function getMarchTotal(salesByRep: BracketData['salesByRep'], name: string): number {
  const s = salesByRep[name];
  if (!s) return 0;
  return (s.week1 || 0) + (s.week2 || 0) + (s.week3 || 0);
}

/** Find the current user's active/upcoming matchup across rounds */
function findUserMatchup(
  bracket: BracketData['bracket'],
  rounds: Round[],
  userName: string
): { match: Match; round: Round; isTopSeed: boolean } | null {
  // Check rounds in reverse priority: active first, then upcoming, then completed
  const orderedRounds = [...rounds].sort((a, b) => {
    const priority: Record<string, number> = { active: 0, upcoming: 1, completed: 2 };
    return (priority[a.status] ?? 9) - (priority[b.status] ?? 9);
  });

  for (const round of orderedRounds) {
    const matches = bracket[`round${round.round}` as keyof typeof bracket] || [];
    for (const match of matches) {
      if (match.topSeed?.name === userName) return { match, round, isTopSeed: true };
      if (match.bottomSeed?.name === userName) return { match, round, isTopSeed: false };
    }
  }
  return null;
}

// =============================================================================
// Crosshair SVG Icon (shooting theme)
// =============================================================================

function CrosshairIcon({ className }: { className?: string }) {
  return (
    <span className={cn('inline-block', className)}>
      <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
        <circle cx="18" cy="18" r="14" stroke="#F97316" strokeWidth="1.5" fill="none" />
        <circle cx="18" cy="18" r="8" stroke="#F97316" strokeWidth="1" fill="none" strokeDasharray="3 2" />
        <circle cx="18" cy="18" r="2" fill="#39FF14" />
        <line x1="18" y1="0" x2="18" y2="10" stroke="#F97316" strokeWidth="1.5" />
        <line x1="18" y1="26" x2="18" y2="36" stroke="#F97316" strokeWidth="1.5" />
        <line x1="0" y1="18" x2="10" y2="18" stroke="#F97316" strokeWidth="1.5" />
        <line x1="26" y1="18" x2="36" y2="18" stroke="#F97316" strokeWidth="1.5" />
      </svg>
    </span>
  );
}

// =============================================================================
// Sub-Components
// =============================================================================

/** Crosshair background pattern (very low opacity) */
function CrosshairBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Grid of faint crosshairs */}
      <div className="absolute inset-0 opacity-[0.025]">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${(i % 4) * 30 + 5}%`,
              top: `${Math.floor(i / 4) * 35 + 5}%`,
              width: '40px',
              height: '40px',
            }}
          >
            <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
              <circle cx="18" cy="18" r="14" stroke="#F97316" strokeWidth="1.5" fill="none" />
              <line x1="18" y1="0" x2="18" y2="10" stroke="#F97316" strokeWidth="1.5" />
              <line x1="18" y1="26" x2="18" y2="36" stroke="#F97316" strokeWidth="1.5" />
              <line x1="0" y1="18" x2="10" y2="18" stroke="#F97316" strokeWidth="1.5" />
              <line x1="26" y1="18" x2="36" y2="18" stroke="#F97316" strokeWidth="1.5" />
            </svg>
          </div>
        ))}
      </div>
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-orange-950/20 via-neutral-950 to-neutral-950" />
    </div>
  );
}

/** Individual seed/player row within a matchup */
function SeedRow({
  seed,
  isWinner,
  roundStatus,
  showSales,
  isCurrentUser,
}: {
  seed: MatchSeed;
  isWinner: boolean;
  roundStatus: Round['status'];
  showSales: boolean;
  isCurrentUser: boolean;
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
        isCurrentUser && !eliminated && 'ring-1 ring-[#39FF14]/50',
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

      {/* Name */}
      <span
        className={cn(
          'font-bold text-sm truncate flex-1',
          isCurrentUser && !eliminated && 'text-[#39FF14]',
          isWinner && isCompleted && !isCurrentUser && 'text-[#39FF14]',
          eliminated && 'text-neutral-500 line-through',
          !isWinner && !eliminated && !isCurrentUser && 'text-white',
        )}
      >
        {seed.name}
        {isCurrentUser && <span className="text-[10px] ml-1 text-[#39FF14]/70 font-normal">(YOU)</span>}
      </span>

      {/* Sales breakdown */}
      {showSales && (isCompleted || isActive) && (
        <div className="flex flex-col items-end shrink-0">
          <span
            className={cn(
              'text-xs font-mono font-bold',
              isWinner && isCompleted ? 'text-[#39FF14]' : eliminated ? 'text-neutral-600' : 'text-neutral-300',
            )}
          >
            {seed.effectiveTotal > 0 ? formatCurrency(seed.effectiveTotal) : '$--'}
          </span>
          {hasCarry && !eliminated && (
            <span className="text-[9px] text-cyan-400/70 font-mono">
              +{formatCurrency(seed.carryForward)} carry
            </span>
          )}
        </div>
      )}

      {/* Upcoming shows dashes */}
      {showSales && roundStatus === 'upcoming' && (
        <span className="text-xs font-mono text-neutral-600 shrink-0">$--</span>
      )}

      {/* Winner / Loser badges */}
      {isWinner && isCompleted && (
        <span className="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30">
          TARGET HIT
        </span>
      )}
      {eliminated && (
        <span className="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-neutral-800 text-neutral-600 border border-neutral-700">
          DOWN
        </span>
      )}
    </div>
  );
}

/** Single matchup card */
function MatchupCard({
  match,
  roundStatus,
  isChampionship,
  currentUserName,
}: {
  match: Match;
  roundStatus: Round['status'];
  isChampionship?: boolean;
  currentUserName: string;
}) {
  const isBye = match.bottomSeed === null;
  const isActive = roundStatus === 'active';
  const isCompleted = roundStatus === 'completed';
  const userInMatch =
    match.topSeed?.name === currentUserName ||
    match.bottomSeed?.name === currentUserName;

  return (
    <div
      className={cn(
        'relative rounded-xl border transition-all duration-300',
        isChampionship && 'ring-2',
        isActive && 'border-[#39FF14]/50 bg-neutral-900/90 shadow-lg shadow-[#39FF14]/10',
        isActive && isChampionship && 'ring-[#39FF14]/40 border-[#39FF14]/60',
        isCompleted && 'border-neutral-700 bg-neutral-900/60',
        !isActive && !isCompleted && 'border-neutral-800 bg-neutral-900/40 border-dashed',
        userInMatch && isActive && 'ring-2 ring-[#39FF14]/60 shadow-xl shadow-[#39FF14]/20',
      )}
    >
      {/* Pulsing border for active matchups */}
      {isActive && (
        <div className="absolute -inset-px rounded-xl bg-gradient-to-r from-[#39FF14]/10 via-transparent to-[#39FF14]/10 animate-pulse pointer-events-none" />
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
        <SeedRow
          seed={match.topSeed}
          isWinner={match.topSeed.winner}
          roundStatus={roundStatus}
          showSales={!isBye}
          isCurrentUser={match.topSeed.name === currentUserName}
        />

        {!isBye ? (
          <>
            <div className="flex items-center gap-2 px-2">
              <div className="flex-1 h-px bg-neutral-700" />
              <span className={cn('text-[10px] font-black tracking-wider', isActive ? 'text-[#39FF14]' : 'text-neutral-600')}>VS</span>
              <div className="flex-1 h-px bg-neutral-700" />
            </div>
            <SeedRow
              seed={match.bottomSeed!}
              isWinner={match.bottomSeed!.winner}
              roundStatus={roundStatus}
              showSales
              isCurrentUser={match.bottomSeed!.name === currentUserName}
            />
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

/** Countdown unit display */
function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-neutral-900 border border-orange-500/30 flex items-center justify-center shadow-lg shadow-orange-500/10">
        <span className="text-2xl sm:text-3xl font-black text-white tabular-nums">{String(value).padStart(2, '0')}</span>
      </div>
      <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mt-1.5">{label}</span>
    </div>
  );
}

// =============================================================================
// Coming Soon Page (when hidden from reps)
// =============================================================================

function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center relative overflow-hidden">
      {/* Animated crosshair background */}
      <div className="absolute inset-0">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="absolute opacity-[0.04] animate-pulse"
            style={{
              left: `${(i % 4) * 25 + 5}%`,
              top: `${Math.floor(i / 4) * 50 + 15}%`,
              width: '60px',
              height: '60px',
              animationDelay: `${i * 0.4}s`,
              animationDuration: `${3 + (i % 3)}s`,
            }}
          >
            <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
              <circle cx="18" cy="18" r="14" stroke="#F97316" strokeWidth="1.5" fill="none" />
              <circle cx="18" cy="18" r="8" stroke="#F97316" strokeWidth="1" fill="none" strokeDasharray="3 2" />
              <circle cx="18" cy="18" r="2" fill="#F97316" />
              <line x1="18" y1="0" x2="18" y2="10" stroke="#F97316" strokeWidth="1.5" />
              <line x1="18" y1="26" x2="18" y2="36" stroke="#F97316" strokeWidth="1.5" />
              <line x1="0" y1="18" x2="10" y2="18" stroke="#F97316" strokeWidth="1.5" />
              <line x1="26" y1="18" x2="36" y2="18" stroke="#F97316" strokeWidth="1.5" />
            </svg>
          </div>
        ))}
      </div>

      <div className="relative z-10 text-center px-6 max-w-md">
        <div className="w-24 h-24 mx-auto mb-8 relative">
          <div className="absolute inset-0 rounded-full bg-orange-500/10 animate-ping" style={{ animationDuration: '3s' }} />
          <div className="relative w-24 h-24 rounded-full bg-neutral-900 border-2 border-orange-500/30 flex items-center justify-center">
            <Crosshair className="w-12 h-12 text-orange-500/70" />
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">
            SOMETHING BIG
          </span>
          <br />
          <span className="text-neutral-400">IS COMING...</span>
        </h1>

        <p className="text-neutral-500 text-sm mb-6">
          Lock and load. Details dropping soon.
        </p>

        <div className="flex items-center justify-center gap-2 text-neutral-600 text-xs">
          <Lock className="w-3.5 h-3.5" />
          <span>Stay tuned for the announcement</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function MarchMadnessRepPage() {
  const { user } = useAuth();
  const [data, setData] = useState<BracketData | null>(null);
  const [settings, setSettings] = useState<{ showToReps: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  // Fetch settings first (for visibility gate)
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/data/march-madness/settings');
        if (res.ok) {
          const json = await res.json();
          setSettings(json.settings || json);
        } else {
          setSettings({ showToReps: false });
        }
      } catch {
        setSettings({ showToReps: false });
      }
    }
    fetchSettings();
  }, []);

  // Fetch bracket data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/data/march-madness/bracket?mode=live');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (settings !== null) fetchData();
  }, [settings, fetchData]);

  // Countdown timer (updates every second for excitement)
  useEffect(() => {
    if (!data) return;
    const activeRound = data.rounds.find((r) => r.status === 'active');
    const upcomingRound = data.rounds.find((r) => r.status === 'upcoming');
    const targetDate = activeRound?.weekEnd || upcomingRound?.weekStart || data.tournament.startDate;
    if (!targetDate) return;

    const tick = () => setCountdown(getCountdown(targetDate));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [data]);

  // ---- VISIBILITY GATE ----
  if (settings !== null && !settings.showToReps && !isAdmin) {
    return <ComingSoonPage />;
  }

  // ---- LOADING STATE ----
  if (loading || settings === null) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin">
            <CrosshairIcon className="w-12 h-12" />
          </div>
          <p className="text-neutral-400 text-sm font-medium animate-pulse">Acquiring target...</p>
        </div>
      </div>
    );
  }

  // ---- ERROR STATE ----
  if (error || !data) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <CrosshairIcon className="w-10 h-10 mx-auto opacity-40" />
          <p className="text-red-400 font-semibold">Failed to load tournament</p>
          <p className="text-neutral-500 text-sm">{error}</p>
          <button onClick={fetchData} className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-700 transition-colors text-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { tournament, rounds, participants, bracket, salesByRep, prizes, announcementEnabled, announcementMessage } = data;
  const activeRound = rounds.find((r) => r.status === 'active');
  const completedRounds = rounds.filter((r) => r.status === 'completed');
  const allCompleted = completedRounds.length === rounds.length;

  // Find the champion from completed bracket
  const champion = allCompleted && bracket.round3.length > 0
    ? (bracket.round3[0].topSeed.winner ? bracket.round3[0].topSeed.name : bracket.round3[0].bottomSeed?.winner ? bracket.round3[0].bottomSeed.name : null)
    : null;

  // User personalization
  const currentUserName = user?.name || '';
  const userParticipant = participants.find(
    (p) => p.name.toLowerCase() === currentUserName.toLowerCase()
  );
  const userMatchup = findUserMatchup(bracket, rounds, currentUserName);

  return (
    <div className="min-h-screen bg-neutral-950 text-white selection:bg-[#39FF14]/30 selection:text-white">

      {/* ====== ADMIN PREVIEW BANNER ====== */}
      {isAdmin && settings && !settings.showToReps && (
        <div className="bg-yellow-600/90 text-yellow-50 px-4 py-2.5 text-center text-sm font-bold flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          ADMIN PREVIEW — Hidden from reps until you flip the switch
          <Link href="/command-center/competition/march-madness" className="underline underline-offset-2 ml-2 hover:text-white transition-colors">
            Go to Settings
          </Link>
        </div>
      )}

      {/* ====== 1. HERO HEADER ====== */}
      <div className="relative overflow-hidden">
        <CrosshairBackground />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-8 text-center">
          {/* Crosshair icon */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 relative">
            <div className="absolute inset-0 rounded-full bg-orange-500/10 animate-pulse" style={{ animationDuration: '2.5s' }} />
            <div className="relative w-full h-full flex items-center justify-center">
              <CrosshairIcon className="w-20 h-20 sm:w-24 sm:h-24" />
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight mb-3">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-orange-400">
              MARCH MADNESS
            </span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 text-3xl sm:text-4xl md:text-5xl">
              2026
            </span>
          </h1>

          <p className="text-neutral-400 text-base sm:text-lg font-semibold tracking-wide">
            Shoot Your Shot <span className="text-orange-500 mx-2">&bull;</span> 3 Weeks <span className="text-orange-500 mx-2">&bull;</span> Winner Takes the 10/22
          </p>
        </div>
      </div>

      {/* ====== 2. ANNOUNCEMENT BANNER ====== */}
      {announcementEnabled && announcementMessage && (
        <div className="relative overflow-hidden mx-4 sm:mx-6 lg:mx-auto max-w-5xl rounded-xl mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600 animate-pulse" style={{ animationDuration: '3s' }} />
          <div className="relative bg-gradient-to-r from-orange-600/95 via-amber-500/95 to-orange-600/95 px-6 py-4 text-center">
            <div className="flex items-center justify-center gap-3">
              <Crosshair className="w-5 h-5 text-white/90 shrink-0" />
              <p className="text-white font-bold text-sm sm:text-base">{announcementMessage}</p>
              <Crosshair className="w-5 h-5 text-white/90 shrink-0" />
            </div>
          </div>
        </div>
      )}

      {/* ====== MAIN CONTENT ====== */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 space-y-8">

        {/* ====== 3. COUNTDOWN / STATUS ====== */}
        {champion ? (
          /* Tournament complete - show champion */
          <div className="text-center py-8 px-6 rounded-2xl bg-gradient-to-b from-amber-900/40 via-neutral-900/80 to-neutral-900 border border-amber-500/30 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0iI0Y5NzMxNiIgb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] pointer-events-none" />
            <Crown className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <p className="text-xs uppercase tracking-[0.3em] text-amber-500 font-black mb-2">CHAMPION</p>
            <p className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-200">{champion}</p>
            <p className="text-neutral-500 text-sm mt-2">Winner of the 10/22 with Suppressor</p>
          </div>
        ) : activeRound ? (
          /* Active round - show LIVE countdown */
          <div className="text-center py-6 px-6 rounded-2xl bg-neutral-900/80 border border-[#39FF14]/30 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[#39FF14]/5 via-transparent to-[#39FF14]/5 animate-pulse pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-black uppercase tracking-widest text-[#39FF14]">
                  {activeRound.name} — LIVE
                </span>
              </div>
              <div className="flex items-center justify-center gap-3 sm:gap-4">
                <CountdownUnit value={countdown.days} label="Days" />
                <span className="text-2xl font-bold text-neutral-600 mt-[-20px]">:</span>
                <CountdownUnit value={countdown.hours} label="Hours" />
                <span className="text-2xl font-bold text-neutral-600 mt-[-20px]">:</span>
                <CountdownUnit value={countdown.minutes} label="Min" />
                <span className="text-2xl font-bold text-neutral-600 mt-[-20px]">:</span>
                <CountdownUnit value={countdown.seconds} label="Sec" />
              </div>
              <p className="text-neutral-500 text-xs mt-3 font-medium">
                Round ends {formatDate(activeRound.weekEnd)} — Results posted Monday 10 AM
              </p>
            </div>
          </div>
        ) : (
          /* Upcoming - countdown to start */
          <div className="text-center py-6 px-6 rounded-2xl bg-neutral-900/80 border border-orange-500/30">
            <p className="text-xs uppercase tracking-[0.2em] text-orange-400 font-black mb-4">Tournament Starts In</p>
            <div className="flex items-center justify-center gap-3 sm:gap-4">
              <CountdownUnit value={countdown.days} label="Days" />
              <span className="text-2xl font-bold text-neutral-600 mt-[-20px]">:</span>
              <CountdownUnit value={countdown.hours} label="Hours" />
              <span className="text-2xl font-bold text-neutral-600 mt-[-20px]">:</span>
              <CountdownUnit value={countdown.minutes} label="Min" />
              <span className="text-2xl font-bold text-neutral-600 mt-[-20px]">:</span>
              <CountdownUnit value={countdown.seconds} label="Sec" />
            </div>
            <p className="text-neutral-500 text-xs mt-3">
              {formatDate(tournament.startDate)} — Week 1 begins
            </p>
          </div>
        )}

        {/* ====== 4. GRAND PRIZE SHOWCASE ====== */}
        <div className="relative rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-950/60 via-neutral-900 to-amber-950/40" />
          <div className="absolute inset-0 opacity-[0.03]">
            <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #F97316 0, #F97316 1px, transparent 0, transparent 50%)', backgroundSize: '20px 20px' }} />
          </div>
          <div className="relative z-10 px-6 sm:px-8 py-8 border border-orange-500/30 rounded-2xl">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="shrink-0">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-xl shadow-orange-500/30">
                  <CrosshairIcon className="w-14 h-14" />
                </div>
              </div>
              <div className="text-center sm:text-left flex-1">
                <p className="text-[10px] uppercase tracking-[0.3em] text-orange-400 font-black mb-1">Grand Prize</p>
                <h2 className="text-2xl sm:text-3xl font-black text-white mb-1">
                  {prizes?.champion || '10/22 with Suppressor'}
                </h2>
                <p className="text-neutral-500 text-sm">
                  {prizes?.note || 'Winner completes legal paperwork at FFL dealer'}
                </p>
              </div>
              <div className="shrink-0">
                <Trophy className="w-10 h-10 text-amber-400" />
              </div>
            </div>

            {/* $100K Bonus call-out */}
            <div className="mt-6 px-5 py-4 rounded-xl bg-[#39FF14]/10 border border-[#39FF14]/30">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-[#39FF14] shrink-0 mt-0.5" />
                <div>
                  <p className="font-black text-[#39FF14] text-sm">$100K BONUS</p>
                  <p className="text-neutral-300 text-sm mt-0.5">
                    {prizes?.hundredK || 'Hit $100K in approved March sales and you win one too!'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ====== 5. YOUR MATCHUP (personalized) ====== */}
        {userParticipant && userMatchup && (
          <div className="rounded-2xl border-2 border-[#39FF14]/40 bg-neutral-900/80 p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[#39FF14]/5 via-transparent to-[#39FF14]/5 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-[#39FF14]" />
                <h2 className="text-lg font-black uppercase tracking-wider text-[#39FF14]">Your Matchup</h2>
                <span className={cn(
                  'ml-auto px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest',
                  userMatchup.round.status === 'active' && 'bg-red-600 text-white',
                  userMatchup.round.status === 'upcoming' && 'bg-neutral-800 text-neutral-400 border border-neutral-700',
                  userMatchup.round.status === 'completed' && 'bg-neutral-800 text-neutral-500',
                )}>
                  {userMatchup.round.name} — {userMatchup.round.status === 'active' ? 'LIVE NOW' : userMatchup.round.status.toUpperCase()}
                </span>
              </div>

              {userMatchup.match.bottomSeed === null ? (
                /* BYE matchup */
                <div className="text-center py-6 rounded-xl bg-[#39FF14]/5 border border-[#39FF14]/20">
                  <Shield className="w-8 h-8 text-[#39FF14] mx-auto mb-2" />
                  <p className="text-lg font-black text-[#39FF14]">You got the BYE</p>
                  <p className="text-neutral-400 text-sm mt-1">Automatic advance to the next round!</p>
                  <p className="text-neutral-600 text-xs mt-2">Use this week to stack sales for carry-forward</p>
                </div>
              ) : (
                /* Head-to-head matchup */
                <div className="space-y-3">
                  {/* Your side */}
                  <div className={cn(
                    'flex items-center gap-4 px-4 py-3 rounded-xl border',
                    userMatchup.round.status === 'completed' && (userMatchup.isTopSeed ? userMatchup.match.topSeed.winner : userMatchup.match.bottomSeed!.winner)
                      ? 'bg-[#39FF14]/10 border-[#39FF14]/30'
                      : 'bg-neutral-800/60 border-neutral-700',
                  )}>
                    <div className={cn(
                      'w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-sm font-black text-white shrink-0',
                      getSeedColor(userMatchup.isTopSeed ? userMatchup.match.topSeed.seed : userMatchup.match.bottomSeed!.seed)
                    )}>
                      #{userMatchup.isTopSeed ? userMatchup.match.topSeed.seed : userMatchup.match.bottomSeed!.seed}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-[#39FF14] text-lg">YOU</p>
                      <p className="text-neutral-500 text-xs">{currentUserName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-black text-white font-mono">
                        {(userMatchup.isTopSeed ? userMatchup.match.topSeed.effectiveTotal : userMatchup.match.bottomSeed!.effectiveTotal) > 0
                          ? formatCurrency(userMatchup.isTopSeed ? userMatchup.match.topSeed.effectiveTotal : userMatchup.match.bottomSeed!.effectiveTotal)
                          : '$--'}
                      </p>
                      {(userMatchup.isTopSeed ? userMatchup.match.topSeed.carryForward : userMatchup.match.bottomSeed!.carryForward) > 0 && (
                        <p className="text-[10px] text-cyan-400 font-mono">
                          +{formatCurrency(userMatchup.isTopSeed ? userMatchup.match.topSeed.carryForward : userMatchup.match.bottomSeed!.carryForward)} carry
                        </p>
                      )}
                    </div>
                  </div>

                  {/* VS divider */}
                  <div className="flex items-center gap-3 px-4">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
                    <span className="text-orange-400 font-black text-sm tracking-widest">VS</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
                  </div>

                  {/* Opponent side */}
                  <div className={cn(
                    'flex items-center gap-4 px-4 py-3 rounded-xl border',
                    userMatchup.round.status === 'completed' && (!userMatchup.isTopSeed ? userMatchup.match.topSeed.winner : userMatchup.match.bottomSeed!.winner)
                      ? 'bg-[#39FF14]/10 border-[#39FF14]/30'
                      : 'bg-neutral-800/60 border-neutral-700',
                  )}>
                    <div className={cn(
                      'w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-sm font-black text-white shrink-0',
                      getSeedColor(!userMatchup.isTopSeed ? userMatchup.match.topSeed.seed : userMatchup.match.bottomSeed!.seed)
                    )}>
                      #{!userMatchup.isTopSeed ? userMatchup.match.topSeed.seed : userMatchup.match.bottomSeed!.seed}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white text-lg">
                        {!userMatchup.isTopSeed ? userMatchup.match.topSeed.name : userMatchup.match.bottomSeed!.name}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-black text-neutral-300 font-mono">
                        {(!userMatchup.isTopSeed ? userMatchup.match.topSeed.effectiveTotal : userMatchup.match.bottomSeed!.effectiveTotal) > 0
                          ? formatCurrency(!userMatchup.isTopSeed ? userMatchup.match.topSeed.effectiveTotal : userMatchup.match.bottomSeed!.effectiveTotal)
                          : '$--'}
                      </p>
                      {(!userMatchup.isTopSeed ? userMatchup.match.topSeed.carryForward : userMatchup.match.bottomSeed!.carryForward) > 0 && (
                        <p className="text-[10px] text-cyan-400 font-mono">
                          +{formatCurrency(!userMatchup.isTopSeed ? userMatchup.match.topSeed.carryForward : userMatchup.match.bottomSeed!.carryForward)} carry
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ====== 6. FULL BRACKET ====== */}
        <div className="bg-neutral-900/40 rounded-2xl border border-neutral-800 p-4 sm:p-6 overflow-x-auto">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <CrosshairIcon className="w-6 h-6" />
              <h2 className="text-lg font-black uppercase tracking-wider text-neutral-300">Tournament Bracket</h2>
            </div>
            <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-600 text-neutral-400 hover:text-white text-xs transition-colors">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>

          <div className="flex items-start gap-0 min-w-[820px]">
            {/* ROUND 1 */}
            <div className="flex flex-col gap-4 shrink-0" style={{ width: '260px' }}>
              <div className="text-center mb-2">
                <span className={cn(
                  'text-xs font-bold uppercase tracking-widest',
                  rounds[0]?.status === 'active' ? 'text-[#39FF14]' : rounds[0]?.status === 'completed' ? 'text-neutral-500' : 'text-neutral-700',
                )}>
                  First Round
                </span>
                <p className="text-[10px] text-neutral-600 mt-0.5">
                  {formatDate(rounds[0]?.weekStart || '')} – {formatDate(rounds[0]?.weekEnd || '')}
                </p>
              </div>
              {bracket.round1.map((match) => (
                <MatchupCard key={match.matchId} match={match} roundStatus={rounds[0]?.status || 'upcoming'} currentUserName={currentUserName} />
              ))}
            </div>

            {/* Connectors R1 -> R2 */}
            <div className="flex items-center shrink-0 pt-12">
              <BracketConnectors fromCount={bracket.round1.length} toCount={bracket.round2.length} isActive={rounds[1]?.status === 'active'} />
            </div>

            {/* ROUND 2 - Semifinals */}
            <div className="flex flex-col gap-4 shrink-0" style={{ width: '260px' }}>
              <div className="text-center mb-2">
                <span className={cn(
                  'text-xs font-bold uppercase tracking-widest',
                  rounds[1]?.status === 'active' ? 'text-[#39FF14]' : rounds[1]?.status === 'completed' ? 'text-neutral-500' : 'text-neutral-700',
                )}>
                  Semifinals
                </span>
                <p className="text-[10px] text-neutral-600 mt-0.5">
                  {formatDate(rounds[1]?.weekStart || '')} – {formatDate(rounds[1]?.weekEnd || '')}
                </p>
              </div>
              <div className="flex flex-col justify-center gap-4" style={{ marginTop: '60px' }}>
                {bracket.round2.map((match) => (
                  <MatchupCard key={match.matchId} match={match} roundStatus={rounds[1]?.status || 'upcoming'} currentUserName={currentUserName} />
                ))}
              </div>
            </div>

            {/* Connectors R2 -> R3 */}
            <div className="flex items-center shrink-0" style={{ paddingTop: '130px' }}>
              <BracketConnectors fromCount={bracket.round2.length} toCount={bracket.round3.length} isActive={rounds[2]?.status === 'active'} />
            </div>

            {/* ROUND 3 - Championship */}
            <div className="flex flex-col gap-4 shrink-0" style={{ width: '280px' }}>
              <div className="text-center mb-2">
                <span className={cn(
                  'text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5',
                  rounds[2]?.status === 'active' ? 'text-[#39FF14]' : rounds[2]?.status === 'completed' ? 'text-amber-400' : 'text-neutral-700',
                )}>
                  <Trophy className="w-3.5 h-3.5" /> Championship <Trophy className="w-3.5 h-3.5" />
                </span>
                <p className="text-[10px] text-neutral-600 mt-0.5">
                  {formatDate(rounds[2]?.weekStart || '')} – {formatDate(rounds[2]?.weekEnd || '')}
                </p>
              </div>
              <div style={{ marginTop: '130px' }}>
                {bracket.round3.map((match) => (
                  <MatchupCard key={match.matchId} match={match} roundStatus={rounds[2]?.status || 'upcoming'} isChampionship currentUserName={currentUserName} />
                ))}
              </div>

              {/* Champion / Championship Week callout */}
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

        {/* ====== 7. $100K PROGRESS BARS ====== */}
        <div className="bg-neutral-900/80 rounded-2xl border border-neutral-800 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-5">
            <Zap className="w-5 h-5 text-[#39FF14]" />
            <h2 className="text-sm font-black uppercase tracking-wider text-neutral-300">$100K Bonus Tracker</h2>
          </div>
          <p className="text-neutral-500 text-xs mb-5">
            Hit $100K in total March sales = you win the prize regardless of bracket outcome
          </p>
          <div className="space-y-3">
            {participants
              .map((p) => ({
                ...p,
                marchTotal: getMarchTotal(salesByRep, p.name),
              }))
              .sort((a, b) => b.marchTotal - a.marchTotal)
              .map((p) => {
                const pct = Math.min((p.marchTotal / 100000) * 100, 100);
                const isUser = p.name === currentUserName;
                const over100 = p.marchTotal >= 100000;
                const over50 = p.marchTotal >= 50000;

                return (
                  <div
                    key={p.seed}
                    className={cn(
                      'px-4 py-3 rounded-xl border transition-all',
                      isUser ? 'bg-[#39FF14]/5 border-[#39FF14]/30' : 'bg-neutral-900/60 border-neutral-800',
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'w-6 h-6 rounded-full bg-gradient-to-br flex items-center justify-center text-[10px] font-black text-white shrink-0',
                          getSeedColor(p.seed),
                        )}>
                          {p.seed}
                        </div>
                        <span className={cn(
                          'font-bold text-sm',
                          isUser ? 'text-[#39FF14]' : 'text-white',
                        )}>
                          {p.name}
                          {isUser && <span className="text-[10px] ml-1 text-[#39FF14]/70 font-normal">(YOU)</span>}
                        </span>
                      </div>
                      <span className={cn(
                        'text-sm font-mono font-bold',
                        over100 ? 'text-[#39FF14]' : over50 ? 'text-amber-400' : 'text-neutral-400',
                      )}>
                        {formatCurrency(p.marchTotal)}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-700',
                          over100 ? 'bg-gradient-to-r from-[#39FF14] to-emerald-400' : over50 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : 'bg-gradient-to-r from-neutral-600 to-neutral-500',
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {over100 && (
                      <p className="text-[10px] text-[#39FF14] font-bold mt-1 flex items-center gap-1">
                        <Star className="w-3 h-3" /> $100K ACHIEVED — PRIZE WINNER!
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        {/* ====== 8. HOW IT WORKS + 9. SEEDING + 10. SCHEDULE ====== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* HOW IT WORKS */}
          <div className="bg-neutral-900/80 rounded-2xl border border-neutral-800 p-5 sm:p-6">
            <h3 className="text-sm font-black uppercase tracking-wider text-neutral-300 mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-orange-400" />
              How It Works
            </h3>
            <ol className="space-y-3 text-sm text-neutral-400">
              {[
                { text: 'Single elimination, 3 rounds over 3 weeks. Win or go home.' },
                { text: <>Win your matchup, carry <strong className="text-cyan-400">50% of your sales</strong> into the next round.</> },
                { text: <>Effective Total = This Week&apos;s Sales + <span className="text-cyan-400">50% Carry</span> from Last Round</> },
                { text: <><strong className="text-amber-400">#1 seed</strong> gets a first-round BYE.</> },
                { text: <>Hit <strong className="text-[#39FF14]">$100K in March</strong> = automatic prize winner regardless of bracket.</> },
                { text: 'Results posted Monday at 10 AM. No exceptions.' },
                { text: <>Sales = <strong className="text-white">approved job total</strong> (deposit received = full contract value).</> },
              ].map((rule, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-xs font-black text-orange-400">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{rule.text}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="space-y-6">

            {/* SEEDING TABLE */}
            <div className="bg-neutral-900/80 rounded-2xl border border-neutral-800 p-5 sm:p-6">
              <h3 className="text-sm font-black uppercase tracking-wider text-neutral-300 mb-4 flex items-center gap-2">
                <Medal className="w-4 h-4 text-amber-400" />
                Seeding — 2026 YTD Sales
              </h3>
              <div className="space-y-1.5">
                {participants.map((p) => {
                  const isUser = p.name === currentUserName;
                  return (
                    <div
                      key={p.seed}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all',
                        isUser ? 'bg-[#39FF14]/10 border-[#39FF14]/30' : 'bg-neutral-800/50 border-transparent hover:bg-neutral-800',
                      )}
                    >
                      <div className={cn(
                        'w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-black text-white shrink-0',
                        getSeedColor(p.seed),
                      )}>
                        {p.seed}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={cn(
                          'font-semibold text-sm truncate block',
                          isUser ? 'text-[#39FF14]' : 'text-white',
                        )}>
                          {p.name}
                          {isUser && <span className="text-[10px] ml-1 text-[#39FF14]/60 font-normal">(YOU)</span>}
                        </span>
                        <span className="text-[11px] text-neutral-500 italic">&quot;{p.nickname}&quot;</span>
                      </div>
                      <span className="text-sm font-mono font-bold text-[#39FF14] shrink-0">{formatCurrency(p.ytdSales)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SCHEDULE */}
            <div className="bg-neutral-900/80 rounded-2xl border border-neutral-800 p-5 sm:p-6">
              <h3 className="text-sm font-black uppercase tracking-wider text-neutral-300 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-400" />
                Schedule
              </h3>
              <div className="space-y-3">
                {rounds.map((r) => (
                  <div
                    key={r.round}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all',
                      r.status === 'active' && 'bg-[#39FF14]/10 border-[#39FF14]/30',
                      r.status === 'completed' && 'bg-neutral-800/40 border-neutral-700',
                      r.status === 'upcoming' && 'bg-neutral-900/60 border-neutral-800 border-dashed',
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                      r.status === 'active' && 'bg-[#39FF14]/20',
                      r.status === 'completed' && 'bg-neutral-700',
                      r.status === 'upcoming' && 'bg-neutral-800',
                    )}>
                      {r.status === 'active' && <span className="w-2 h-2 rounded-full bg-[#39FF14] animate-pulse" />}
                      {r.status === 'completed' && <Medal className="w-3.5 h-3.5 text-neutral-500" />}
                      {r.status === 'upcoming' && <Timer className="w-3.5 h-3.5 text-neutral-600" />}
                    </div>
                    <div className="flex-1">
                      <p className={cn(
                        'text-sm font-bold',
                        r.status === 'active' ? 'text-[#39FF14]' : r.status === 'completed' ? 'text-neutral-400' : 'text-neutral-600',
                      )}>
                        {r.name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {formatDate(r.weekStart)} – {formatDate(r.weekEnd)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={cn(
                        'text-[10px] font-bold uppercase tracking-wider',
                        r.status === 'active' ? 'text-red-400' : r.status === 'completed' ? 'text-neutral-600' : 'text-neutral-700',
                      )}>
                        {r.status === 'active' ? 'LIVE' : r.status === 'completed' ? 'COMPLETE' : 'UPCOMING'}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Advancement note */}
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-950/30 border border-orange-900/20">
                  <ChevronRight className="w-4 h-4 text-orange-400 shrink-0" />
                  <p className="text-xs text-neutral-500">
                    <span className="text-orange-400 font-bold">Advancement:</span> Results posted Monday at 10 AM sharp
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ====== FOOTER CTA ====== */}
        <div className="text-center pt-4 pb-8">
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-600/20 to-amber-600/20 border border-orange-500/30">
            <Flame className="w-5 h-5 text-orange-400" />
            <p className="text-sm font-bold text-orange-300">
              Every deal counts. Shoot your shot.
            </p>
            <Flame className="w-5 h-5 text-orange-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
