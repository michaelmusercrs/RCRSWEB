'use client';

/**
 * RCRS March Madness 2026 - Single Elimination Bracket
 *
 * Shooting theme (NOT basketball). Crosshairs, targets, scope reticles.
 * 50% carry-forward between rounds. 7 reps, 3 rounds, 3 weeks.
 * Grand Prize: 10/22 with Suppressor (FFL paperwork required).
 * $100K March sales bonus: automatic prize winner.
 *
 * Data source: /api/data/march-madness/bracket?mode=live|demo
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Target,
  Crosshair,
  Trophy,
  Medal,
  Flame,
  Timer,
  RefreshCw,
  Crown,
  ChevronRight,
  Star,
  Zap,
  TrendingUp,
  Calendar,
  ArrowLeft,
  Shield,
  Award,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface Participant {
  seed: number;
  name: string;
  nickname: string;
  ytdSales: number;
}

interface MatchSeed {
  seed: number;
  name: string;
  weekSales: number;
  carryForward: number;
  effectiveTotal: number;
  winner: boolean;
}

interface Match {
  matchId: string;
  topSeed: MatchSeed | null;
  bottomSeed: MatchSeed | null;
}

interface Round {
  round: number;
  name: string;
  weekStart: string;
  weekEnd: string;
  status: 'upcoming' | 'active' | 'completed';
}

interface Tournament {
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  theme: string;
}

interface Rules {
  carryoverRate: number;
  rounds: number;
  weeks: number;
  hundredKRule: string;
}

interface Prizes {
  champion: string;
  hundredK: string;
  note: string;
  runnerUp: string;
  mvp: string;
}

interface BracketData {
  tournament: Tournament;
  rules: Rules;
  rounds: Round[];
  participants: Participant[];
  bracket: {
    round1: Match[];
    round2: Match[];
    round3: Match[];
  };
  isDemo: boolean;
  prizes: Prizes;
}

// =============================================================================
// Helpers
// =============================================================================

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getParticipantByName(participants: Participant[], name: string): Participant | undefined {
  return participants.find((p) => p.name === name);
}

// =============================================================================
// Crosshair SVG Icon (shooting theme)
// =============================================================================

function CrosshairIcon({ className }: { className?: string }) {
  return (
    <span className={cn('inline-block', className)}>
      <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
        <circle cx="18" cy="18" r="14" stroke="#F97316" strokeWidth="1.5" fill="none" />
        <circle
          cx="18"
          cy="18"
          r="8"
          stroke="#F97316"
          strokeWidth="1"
          fill="none"
          strokeDasharray="3 2"
        />
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

/** Demo/Live mode toggle */
function ModeToggle({
  mode,
  onModeChange,
}: {
  mode: 'live' | 'demo';
  onModeChange: (m: 'live' | 'demo') => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="inline-flex rounded-lg border border-neutral-700 bg-neutral-900 p-1">
        <button
          onClick={() => onModeChange('live')}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-semibold transition-all',
            mode === 'live'
              ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/40'
              : 'text-neutral-400 hover:text-white'
          )}
        >
          <span className="flex items-center gap-2">
            <Crosshair className="w-4 h-4" />
            LIVE TOURNAMENT (starts 3/30)
          </span>
        </button>
        <button
          onClick={() => onModeChange('demo')}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-semibold transition-all',
            mode === 'demo'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-neutral-400 hover:text-white'
          )}
        >
          <span className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            DEMO (Past 3 Weeks)
          </span>
        </button>
      </div>

      {mode === 'demo' ? (
        <div className="w-full max-w-2xl text-center px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
          <span className="font-bold">DEMO MODE</span> &mdash; Real sales data from Mar 2&ndash;22
          showing how the bracket works. The live tournament starts Mon 3/30.
        </div>
      ) : (
        <div className="w-full max-w-2xl text-center px-4 py-2 rounded-lg bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14] text-sm">
          <span className="font-bold">LIVE</span> &mdash; Round 1 started Monday March 16.
          Results advance Monday 10 AM. Sell to survive.
        </div>
      )}
    </div>
  );
}

/** Stats row: 4 cards */
function StatsRow({ data }: { data: BracketData }) {
  const activeRound = data.rounds.find((r) => r.status === 'active');
  const currentRound = activeRound || data.rounds[0];

  // Count remaining competitors across all rounds
  const allMatches = [
    ...data.bracket.round1,
    ...data.bracket.round2,
    ...data.bracket.round3,
  ];
  const eliminated = new Set<string>();
  for (const m of allMatches) {
    if (m.topSeed && m.bottomSeed) {
      if (m.topSeed.winner && !m.bottomSeed.winner) eliminated.add(m.bottomSeed.name);
      if (m.bottomSeed.winner && !m.topSeed.winner) eliminated.add(m.topSeed.name);
    }
  }
  const remaining = data.participants.length - eliminated.size;

  // $100K watch: sum each rep's weekSales across completed matches
  const marchTotals: Record<string, number> = {};
  for (const p of data.participants) {
    marchTotals[p.name] = 0;
  }
  for (const m of allMatches) {
    if (m.topSeed) marchTotals[m.topSeed.name] = (marchTotals[m.topSeed.name] || 0) + m.topSeed.weekSales;
    if (m.bottomSeed) marchTotals[m.bottomSeed.name] = (marchTotals[m.bottomSeed.name] || 0) + m.bottomSeed.weekSales;
  }
  const approaching100K = Object.entries(marchTotals)
    .filter(([, total]) => total >= 50000)
    .sort((a, b) => b[1] - a[1]);

  const cards = [
    {
      label: 'Competitors Remaining',
      value: `${remaining} / ${data.participants.length}`,
      icon: <Target className="w-5 h-5 text-orange-400" />,
      accent: 'text-white',
    },
    {
      label: 'Current Round',
      value: currentRound.name,
      sub: `${formatDate(currentRound.weekStart)} - ${formatDate(currentRound.weekEnd)}`,
      icon: <Crosshair className="w-5 h-5 text-orange-400" />,
      accent: 'text-white',
    },
    {
      label: '$100K Bonus Watch',
      value:
        approaching100K.length > 0
          ? approaching100K.map(([name, total]) => `${name.split(' ')[0]}: ${formatCurrency(total)}`).join(', ')
          : 'No reps above $50K yet',
      icon: <Flame className="w-5 h-5 text-amber-400" />,
      accent: approaching100K.length > 0 ? 'text-amber-300' : 'text-neutral-400',
    },
    {
      label: 'Grand Prize',
      value: '10/22 + Suppressor',
      icon: <CrosshairIcon className="w-5 h-5" />,
      accent: 'text-[#39FF14]',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card, i) => (
        <div
          key={i}
          className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-2"
        >
          <div className="flex items-center gap-2 text-neutral-400 text-xs font-medium uppercase tracking-wider">
            {card.icon}
            {card.label}
          </div>
          <div className={cn('text-sm font-bold leading-tight', card.accent)}>{card.value}</div>
          {card.sub && <div className="text-xs text-neutral-500">{card.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/** Single match card inside the bracket */
function MatchCard({
  match,
  roundStatus,
  participants,
}: {
  match: Match;
  roundStatus: string;
  participants: Participant[];
}) {
  const isBye = !match.bottomSeed;
  const isActive = roundStatus === 'active';
  const isCompleted = roundStatus === 'completed';
  const isUpcoming = roundStatus === 'upcoming';

  function SeedBadge({ seed, winner, eliminated }: { seed: number; winner: boolean; eliminated: boolean }) {
    return (
      <span
        className={cn(
          'w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold shrink-0',
          winner
            ? 'bg-[#39FF14]/20 text-[#39FF14] ring-1 ring-[#39FF14]/40'
            : eliminated
              ? 'bg-neutral-800 text-neutral-600'
              : 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/30'
        )}
      >
        #{seed}
      </span>
    );
  }

  function SeedRow({ seed, isTop }: { seed: MatchSeed | null; isTop: boolean }) {
    if (!seed) return null;

    const opponent = isTop ? match.bottomSeed : match.topSeed;
    const isEliminated = isCompleted && opponent && opponent.winner && !seed.winner;
    const isWinner = seed.winner;
    const participant = getParticipantByName(participants, seed.name);

    return (
      <div
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg transition-all',
          isWinner && 'bg-[#39FF14]/5',
          isEliminated && 'opacity-40'
        )}
      >
        <SeedBadge seed={seed.seed} winner={isWinner} eliminated={!!isEliminated} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'font-semibold text-sm truncate',
                isEliminated ? 'line-through text-neutral-500' : 'text-white'
              )}
            >
              {seed.name}
            </span>
            {participant?.nickname && (
              <span className="text-xs text-neutral-500 truncate hidden sm:inline">
                &quot;{participant.nickname}&quot;
              </span>
            )}
            {isWinner && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-[#39FF14] uppercase tracking-wider">
                <Target className="w-3 h-3" />
                TARGET HIT
              </span>
            )}
            {isEliminated && (
              <span className="text-[10px] font-bold text-red-500/60 uppercase tracking-wider">
                DOWN
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {isUpcoming ? (
              <span className="text-xs text-neutral-600">$--</span>
            ) : (
              <>
                <span className="text-xs text-neutral-400">
                  Week: {formatCurrency(seed.weekSales)}
                </span>
                {seed.carryForward > 0 && (
                  <span className="text-xs text-cyan-400">+{formatCurrency(seed.carryForward)}</span>
                )}
              </>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          {isUpcoming ? (
            <span className="text-lg font-bold text-neutral-700">$--</span>
          ) : (
            <span
              className={cn(
                'text-lg font-bold',
                isWinner ? 'text-[#39FF14]' : isEliminated ? 'text-neutral-600' : 'text-white'
              )}
            >
              {formatCurrency(seed.effectiveTotal)}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative bg-neutral-900 rounded-xl border overflow-hidden',
        isActive && 'border-[#39FF14]/50 shadow-[0_0_20px_rgba(57,255,20,0.1)]',
        isCompleted && 'border-neutral-700',
        isUpcoming && 'border-neutral-800 border-dashed',
        isBye && 'border-neutral-800'
      )}
    >
      {/* Active round badge */}
      {isActive && (
        <div className="absolute -top-px -right-px">
          <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded-bl-lg rounded-tr-xl">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            LIVE
          </span>
        </div>
      )}

      {/* Match ID */}
      <div className="px-3 pt-2 pb-1 flex items-center gap-2">
        <span className="text-[10px] font-mono text-neutral-600 uppercase">{match.matchId}</span>
        {isActive && (
          <span className="text-[10px] text-orange-400 font-semibold uppercase tracking-wider">
            IN YOUR SIGHTS
          </span>
        )}
      </div>

      {isBye ? (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-neutral-800/50">
            <SeedBadge seed={match.topSeed!.seed} winner={false} eliminated={false} />
            <div>
              <span className="font-semibold text-sm text-white">{match.topSeed!.name}</span>
              <span className="text-xs text-neutral-500 ml-2">BYE (auto-advance)</span>
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-600 ml-auto" />
          </div>
        </div>
      ) : (
        <div className="px-2 pb-2 space-y-0.5">
          <SeedRow seed={match.topSeed} isTop={true} />
          <div className="flex items-center gap-2 px-3">
            <div className="flex-1 border-t border-neutral-800" />
            <span className="text-[10px] text-neutral-600 font-medium">VS</span>
            <div className="flex-1 border-t border-neutral-800" />
          </div>
          <SeedRow seed={match.bottomSeed} isTop={false} />
        </div>
      )}
    </div>
  );
}

/** SVG connector lines between bracket columns */
function BracketConnectors({ fromCount, toCount }: { fromCount: number; toCount: number }) {
  // Simple right-pointing connector lines
  const lines: JSX.Element[] = [];
  const svgHeight = Math.max(fromCount, toCount) * 140;

  for (let i = 0; i < toCount; i++) {
    const fromTop = (i * 2) * (svgHeight / fromCount) + svgHeight / fromCount / 2;
    const fromBottom = (i * 2 + 1) * (svgHeight / fromCount) + svgHeight / fromCount / 2;
    const toY = i * (svgHeight / toCount) + svgHeight / toCount / 2;

    lines.push(
      <g key={i}>
        {/* Top source line */}
        <line x1="0" y1={fromTop} x2="16" y2={fromTop} stroke="#525252" strokeWidth="1.5" />
        <line x1="16" y1={fromTop} x2="16" y2={toY} stroke="#525252" strokeWidth="1.5" />
        {/* Bottom source line */}
        <line x1="0" y1={fromBottom} x2="16" y2={fromBottom} stroke="#525252" strokeWidth="1.5" />
        <line x1="16" y1={fromBottom} x2="16" y2={toY} stroke="#525252" strokeWidth="1.5" />
        {/* Center to next round */}
        <line x1="16" y1={toY} x2="32" y2={toY} stroke="#525252" strokeWidth="1.5" />
        {/* Arrow head */}
        <polygon
          points={`${28},${toY - 3} ${32},${toY} ${28},${toY + 3}`}
          fill="#525252"
        />
      </g>
    );
  }

  return (
    <div className="hidden lg:flex items-center shrink-0" style={{ width: 32 }}>
      <svg width="32" height={svgHeight} viewBox={`0 0 32 ${svgHeight}`}>
        {lines}
      </svg>
    </div>
  );
}

/** Full bracket visualization */
function BracketView({ data }: { data: BracketData }) {
  const { bracket, rounds, participants } = data;
  const round1Status = rounds[0]?.status || 'upcoming';
  const round2Status = rounds[1]?.status || 'upcoming';
  const round3Status = rounds[2]?.status || 'upcoming';

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[900px] flex items-start gap-0">
        {/* Round 1 */}
        <div className="flex-1">
          <div className="text-center mb-3">
            <h3 className="text-sm font-bold text-orange-400 uppercase tracking-wider">
              {rounds[0]?.name || 'Round 1'}
            </h3>
            <p className="text-[11px] text-neutral-500">
              {rounds[0] ? `${formatDate(rounds[0].weekStart)} - ${formatDate(rounds[0].weekEnd)}` : ''}
            </p>
          </div>
          <div className="space-y-3">
            {bracket.round1.map((match) => (
              <MatchCard
                key={match.matchId}
                match={match}
                roundStatus={round1Status}
                participants={participants}
              />
            ))}
          </div>
        </div>

        {/* Connector R1 -> R2 */}
        <BracketConnectors fromCount={4} toCount={2} />

        {/* Round 2 */}
        <div className="flex-1">
          <div className="text-center mb-3">
            <h3 className="text-sm font-bold text-orange-400 uppercase tracking-wider">
              {rounds[1]?.name || 'Semifinals'}
            </h3>
            <p className="text-[11px] text-neutral-500">
              {rounds[1] ? `${formatDate(rounds[1].weekStart)} - ${formatDate(rounds[1].weekEnd)}` : ''}
            </p>
          </div>
          <div className="space-y-3 flex flex-col justify-around h-full">
            {bracket.round2.length > 0 ? (
              bracket.round2.map((match) => (
                <MatchCard
                  key={match.matchId}
                  match={match}
                  roundStatus={round2Status}
                  participants={participants}
                />
              ))
            ) : (
              <>
                <PlaceholderMatch label="Winner R1-M1 vs Winner R1-M2" />
                <PlaceholderMatch label="Winner R1-M3 vs Winner R1-M4" />
              </>
            )}
          </div>
        </div>

        {/* Connector R2 -> R3 */}
        <BracketConnectors fromCount={2} toCount={1} />

        {/* Round 3 - Championship */}
        <div className="flex-1">
          <div className="text-center mb-3">
            <h3 className="text-sm font-bold text-[#39FF14] uppercase tracking-wider flex items-center justify-center gap-2">
              <Crown className="w-4 h-4" />
              {rounds[2]?.name || 'Championship'}
            </h3>
            <p className="text-[11px] text-neutral-500">
              {rounds[2] ? `${formatDate(rounds[2].weekStart)} - ${formatDate(rounds[2].weekEnd)}` : ''}
            </p>
          </div>
          <div className="flex flex-col justify-center h-full">
            {bracket.round3.length > 0 ? (
              bracket.round3.map((match) => (
                <MatchCard
                  key={match.matchId}
                  match={match}
                  roundStatus={round3Status}
                  participants={participants}
                />
              ))
            ) : (
              <PlaceholderMatch label="Championship Match" isChampionship />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Placeholder match for future rounds */
function PlaceholderMatch({ label, isChampionship }: { label: string; isChampionship?: boolean }) {
  return (
    <div
      className={cn(
        'bg-neutral-900/50 rounded-xl border border-dashed border-neutral-800 p-4 text-center',
        isChampionship && 'border-[#39FF14]/20'
      )}
    >
      <Crosshair className={cn('w-5 h-5 mx-auto mb-2', isChampionship ? 'text-[#39FF14]/30' : 'text-neutral-700')} />
      <p className="text-xs text-neutral-600">{label}</p>
      <p className="text-lg font-bold text-neutral-700 mt-1">TBD</p>
    </div>
  );
}

/** Matchup details section */
function MatchupDetails({ data }: { data: BracketData }) {
  const { bracket, participants } = data;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <Crosshair className="w-5 h-5 text-orange-400" />
        First Round Matchups
      </h3>
      <div className="grid sm:grid-cols-2 gap-4">
        {bracket.round1.map((match) => {
          const isBye = !match.bottomSeed;
          const topParticipant = match.topSeed
            ? getParticipantByName(participants, match.topSeed.name)
            : null;
          const bottomParticipant = match.bottomSeed
            ? getParticipantByName(participants, match.bottomSeed.name)
            : null;

          return (
            <div
              key={match.matchId}
              className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700/50"
            >
              <div className="text-[10px] font-mono text-neutral-500 mb-2">{match.matchId}</div>
              {isBye ? (
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">
                    #{match.topSeed!.seed}
                  </span>
                  <span className="font-semibold text-white">{match.topSeed!.name}</span>
                  {topParticipant?.nickname && (
                    <span className="text-xs text-neutral-500">
                      &quot;{topParticipant.nickname}&quot;
                    </span>
                  )}
                  <span className="ml-auto text-xs text-neutral-500 italic">BYE</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">
                      #{match.topSeed!.seed}
                    </span>
                    <span className="font-semibold text-white text-sm">{match.topSeed!.name}</span>
                    {topParticipant?.nickname && (
                      <span className="text-xs text-neutral-500">
                        &quot;{topParticipant.nickname}&quot;
                      </span>
                    )}
                  </div>
                  <div className="text-center text-[10px] text-neutral-600 font-medium">VS</div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">
                      #{match.bottomSeed!.seed}
                    </span>
                    <span className="font-semibold text-white text-sm">{match.bottomSeed!.name}</span>
                    {bottomParticipant?.nickname && (
                      <span className="text-xs text-neutral-500">
                        &quot;{bottomParticipant.nickname}&quot;
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** $100K bonus zone */
function BonusZone({ data }: { data: BracketData }) {
  const { participants, bracket } = data;

  // Sum each rep's weekSales across all matches to approximate March total
  const marchTotals: Record<string, number> = {};
  for (const p of participants) {
    marchTotals[p.name] = 0;
  }
  const allMatches = [...bracket.round1, ...bracket.round2, ...bracket.round3];
  for (const m of allMatches) {
    if (m.topSeed) marchTotals[m.topSeed.name] = (marchTotals[m.topSeed.name] || 0) + m.topSeed.weekSales;
    if (m.bottomSeed) marchTotals[m.bottomSeed.name] = (marchTotals[m.bottomSeed.name] || 0) + m.bottomSeed.weekSales;
  }

  const sorted = participants
    .map((p) => ({ ...p, marchTotal: marchTotals[p.name] || 0 }))
    .sort((a, b) => b.marchTotal - a.marchTotal);

  const TARGET = 100000;

  return (
    <div className="bg-neutral-900 border border-amber-500/20 rounded-xl p-6">
      <h3 className="text-lg font-bold text-amber-400 mb-1 flex items-center gap-2">
        <Flame className="w-5 h-5" />
        $100K BONUS ZONE
      </h3>
      <p className="text-xs text-neutral-400 mb-4">
        Hit $100K in approved March sales = automatically win a .22LR Wrangler Revolver
      </p>
      <div className="space-y-3">
        {sorted.map((rep) => {
          const pct = Math.min((rep.marchTotal / TARGET) * 100, 100);
          const hit = rep.marchTotal >= TARGET;
          return (
            <div key={rep.name} className="flex items-center gap-3">
              <div className="w-32 sm:w-40 truncate">
                <span className={cn('text-sm font-medium', hit ? 'text-[#39FF14]' : 'text-white')}>
                  {rep.name}
                </span>
              </div>
              <div className="flex-1 h-3 bg-neutral-800 rounded-full overflow-hidden relative">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    hit
                      ? 'bg-[#39FF14]'
                      : pct >= 75
                        ? 'bg-amber-500'
                        : pct >= 50
                          ? 'bg-orange-500'
                          : 'bg-neutral-600'
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="w-20 text-right">
                <span
                  className={cn(
                    'text-sm font-bold',
                    hit ? 'text-[#39FF14]' : 'text-neutral-300'
                  )}
                >
                  {formatCurrency(rep.marchTotal)}
                </span>
              </div>
              {hit && (
                <Target className="w-4 h-4 text-[#39FF14] shrink-0" />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-neutral-800 text-xs text-neutral-500 text-right">
        Target: {formatCurrency(TARGET)}
      </div>
    </div>
  );
}

/** Prizes section */
function PrizesSection({ prizes }: { prizes: Prizes }) {
  return (
    <div className="grid sm:grid-cols-3 gap-4">
      {/* Champion Prize */}
      <div className="sm:col-span-2 bg-gradient-to-br from-neutral-900 via-neutral-900 to-orange-950/20 border border-orange-500/30 rounded-xl p-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="w-full h-full" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 36 36' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='18' cy='18' r='14' stroke='%23F97316' stroke-width='1' fill='none'/%3E%3Cline x1='18' y1='2' x2='18' y2='34' stroke='%23F97316' stroke-width='0.5'/%3E%3Cline x1='2' y1='18' x2='34' y2='18' stroke='%23F97316' stroke-width='0.5'/%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px',
          }} />
        </div>
        <div className="relative z-10">
          <CrosshairIcon className="w-14 h-14 mx-auto mb-3" />
          <h3 className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-1">
            Champion Prize
          </h3>
          <p className="text-2xl font-black text-white mb-1">{prizes.champion}</p>
          <p className="text-xs text-neutral-400">{prizes.note}</p>
        </div>
      </div>

      {/* Wrangler Prize */}
      <div className="bg-gradient-to-br from-neutral-900 to-emerald-950/20 border border-[#39FF14]/20 rounded-xl p-6 text-center">
        <Target className="w-10 h-10 text-[#39FF14] mx-auto mb-2" />
        <h4 className="text-xs font-bold text-[#39FF14] uppercase tracking-wider mb-1">Top Non-Champion</h4>
        <p className="text-lg font-bold text-white">.22LR Wrangler Revolver</p>
        <p className="text-[10px] text-neutral-400 mt-1">Best performer who doesn&apos;t win the bracket</p>
      </div>

      {/* $100K Bonus */}
      <div className="bg-neutral-900 border border-amber-500/20 rounded-xl p-5 text-center">
        <Flame className="w-8 h-8 text-amber-400 mx-auto mb-2" />
        <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">$100K March Bonus</h4>
        <p className="text-sm font-semibold text-white">Sell $100K in March = auto-win the Wrangler</p>
      </div>

      {/* Runner Up */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 text-center">
        <Medal className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
        <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Runner-Up</h4>
        <p className="text-lg font-bold text-white">{prizes.runnerUp}</p>
      </div>

      {/* MVP */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 text-center">
        <Star className="w-8 h-8 text-amber-400 mx-auto mb-2" />
        <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">MVP Award</h4>
        <p className="text-lg font-bold text-white">{prizes.mvp}</p>
      </div>
    </div>
  );
}

/** Rules section */
function RulesSection({ rules, rounds }: { rules: Rules; rounds: Round[] }) {
  const ruleItems = [
    'Single elimination, 3 rounds, 3 weeks.',
    `50% of your week's approved sales carry into the next round.`,
    'Effective Total = Week Sales + Carry-Forward. Highest total wins.',
    '#1 seed gets a BYE and auto-advances to Round 2.',
    '$100K in approved March sales = automatic .22LR Wrangler Revolver winner.',
    'Top non-champion rep also wins the Wrangler.',
    'Results finalized every Monday at 10 AM.',
    'Sales = approved job total. Deposit received = full contract credited.',
  ];

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <Shield className="w-5 h-5 text-orange-400" />
        How It Works
      </h3>
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2">
        {ruleItems.map((rule, i) => (
          <div key={i} className="flex items-start gap-2 py-1">
            <Crosshair className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
            <span className="text-sm text-neutral-300">{rule}</span>
          </div>
        ))}
      </div>

      {/* Schedule */}
      <div className="mt-5 pt-4 border-t border-neutral-800">
        <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Schedule
        </h4>
        <div className="grid sm:grid-cols-3 gap-3">
          {rounds.map((round) => (
            <div
              key={round.round}
              className={cn(
                'rounded-lg border p-3',
                round.status === 'active'
                  ? 'border-[#39FF14]/40 bg-[#39FF14]/5'
                  : round.status === 'completed'
                    ? 'border-neutral-700 bg-neutral-800/30'
                    : 'border-neutral-800 bg-neutral-900/50'
              )}
            >
              <div className="text-xs font-bold text-orange-400 uppercase">{round.name}</div>
              <div className="text-xs text-neutral-400 mt-0.5">
                {formatDate(round.weekStart)} &ndash; {formatDate(round.weekEnd)}
              </div>
              <div
                className={cn(
                  'text-[10px] font-bold uppercase mt-1',
                  round.status === 'active'
                    ? 'text-[#39FF14]'
                    : round.status === 'completed'
                      ? 'text-neutral-500'
                      : 'text-neutral-600'
                )}
              >
                {round.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Seeding table */
function SeedingTable({ participants }: { participants: Participant[] }) {
  const sorted = [...participants].sort((a, b) => a.seed - b.seed);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <Award className="w-5 h-5 text-orange-400" />
        Tournament Seeding
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800">
              <th className="text-left py-2 px-3 text-neutral-400 font-medium text-xs uppercase tracking-wider">
                Seed
              </th>
              <th className="text-left py-2 px-3 text-neutral-400 font-medium text-xs uppercase tracking-wider">
                Name
              </th>
              <th className="text-left py-2 px-3 text-neutral-400 font-medium text-xs uppercase tracking-wider">
                Nickname
              </th>
              <th className="text-right py-2 px-3 text-neutral-400 font-medium text-xs uppercase tracking-wider">
                YTD Sales
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.seed} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                <td className="py-2.5 px-3">
                  <span className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">
                    #{p.seed}
                  </span>
                </td>
                <td className="py-2.5 px-3 font-semibold text-white">{p.name}</td>
                <td className="py-2.5 px-3 text-neutral-400">&quot;{p.nickname}&quot;</td>
                <td className="py-2.5 px-3 text-right font-bold text-white">
                  {formatCurrency(p.ytdSales)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =============================================================================
// Champion Banner (only in demo mode when completed)
// =============================================================================

function ChampionBanner({ data }: { data: BracketData }) {
  const finals = data.bracket.round3;
  if (!finals || finals.length === 0) return null;

  const final = finals[0];
  const champion = final.topSeed?.winner
    ? final.topSeed
    : final.bottomSeed?.winner
      ? final.bottomSeed
      : null;

  if (!champion) return null;

  const participant = getParticipantByName(data.participants, champion.name);

  return (
    <div className="relative bg-gradient-to-r from-orange-950/30 via-neutral-900 to-orange-950/30 border border-[#39FF14]/30 rounded-2xl p-8 text-center overflow-hidden">
      {/* Crosshair background pattern */}
      <div className="absolute inset-0 opacity-[0.04]">
        <div className="w-full h-full" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 36 36' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='18' cy='18' r='14' stroke='%2339FF14' stroke-width='1' fill='none'/%3E%3Cline x1='18' y1='2' x2='18' y2='34' stroke='%2339FF14' stroke-width='0.5'/%3E%3Cline x1='2' y1='18' x2='34' y2='18' stroke='%2339FF14' stroke-width='0.5'/%3E%3C/svg%3E")`,
          backgroundSize: '50px 50px',
        }} />
      </div>
      <div className="relative z-10">
        <CrosshairIcon className="w-20 h-20 mx-auto mb-3" />
        <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-1">
          Champion
        </p>
        <h2 className="text-3xl font-black text-[#39FF14] mb-1">{champion.name}</h2>
        {participant?.nickname && (
          <p className="text-sm text-neutral-400 mb-2">
            &quot;{participant.nickname}&quot;
          </p>
        )}
        <p className="text-lg font-bold text-white">
          Final Total: {formatCurrency(champion.effectiveTotal)}
        </p>
        <div className="mt-3 inline-flex items-center gap-2 text-xs text-amber-400">
          <Trophy className="w-4 h-4" />
          Wins 10/22 with Suppressor
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <div className="h-10 w-80 mx-auto bg-neutral-800 rounded-lg animate-pulse" />
          <div className="h-5 w-60 mx-auto bg-neutral-800 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-neutral-900 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-neutral-900 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

// =============================================================================
// Main Page
// =============================================================================

export default function MarchMadnessPage() {
  const [mode, setMode] = useState<'live' | 'demo'>('live');
  const [data, setData] = useState<BracketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (fetchMode: 'live' | 'demo') => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/data/march-madness/bracket?mode=${fetchMode}`);
      if (!res.ok) throw new Error(`Failed to load bracket data (${res.status})`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(mode);
  }, [mode, fetchData]);

  const handleModeChange = (newMode: 'live' | 'demo') => {
    setMode(newMode);
  };

  if (loading) return <LoadingSkeleton />;

  if (error || !data) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <CrosshairIcon className="w-16 h-16 mx-auto opacity-30" />
          <h2 className="text-xl font-bold text-red-400">Failed to Load Bracket</h2>
          <p className="text-neutral-400 text-sm">{error || 'Unknown error'}</p>
          <button
            onClick={() => fetchData(mode)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const hasChampion =
    data.bracket.round3.length > 0 &&
    (data.bracket.round3[0].topSeed?.winner || data.bracket.round3[0].bottomSeed?.winner);

  return (
    <div className="min-h-screen bg-neutral-950 text-white relative">
      {/* Subtle crosshair pattern background */}
      <div className="fixed inset-0 opacity-[0.015] pointer-events-none">
        <div className="w-full h-full" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 36 36' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='18' cy='18' r='14' stroke='%23F97316' stroke-width='0.5' fill='none'/%3E%3Cline x1='18' y1='4' x2='18' y2='32' stroke='%23F97316' stroke-width='0.3'/%3E%3Cline x1='4' y1='18' x2='32' y2='18' stroke='%23F97316' stroke-width='0.3'/%3E%3C/svg%3E")`,
          backgroundSize: '80px 80px',
        }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* Back link */}
        <Link
          href="/command-center/competition"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Competition
        </Link>

        {/* Hero Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-4">
            <CrosshairIcon className="w-12 h-12 sm:w-16 sm:h-16" />
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight">
              <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                MARCH MADNESS
              </span>
              <span className="block text-2xl sm:text-3xl text-white mt-1">2026</span>
            </h1>
            <CrosshairIcon className="w-12 h-12 sm:w-16 sm:h-16" />
          </div>
          <p className="text-neutral-400 text-sm sm:text-base">
            RCRS Sales Bracket &bull; Shoot Your Shot
          </p>
        </div>

        {/* Demo / Live Toggle */}
        <ModeToggle mode={mode} onModeChange={handleModeChange} />

        {/* Champion Banner (demo mode, completed) */}
        {hasChampion && <ChampionBanner data={data} />}

        {/* Stats Row */}
        <StatsRow data={data} />

        {/* Bracket */}
        <div className="bg-neutral-900/30 border border-neutral-800 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-orange-400" />
              Tournament Bracket
            </h2>
            <button
              onClick={() => fetchData(mode)}
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
          <BracketView data={data} />
        </div>

        {/* Matchup Details */}
        <MatchupDetails data={data} />

        {/* $100K Bonus Zone */}
        <BonusZone data={data} />

        {/* Prizes */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            Prizes
          </h2>
          <PrizesSection prizes={data.prizes} />
        </div>

        {/* Rules */}
        <RulesSection rules={data.rules} rounds={data.rounds} />

        {/* Seeding Table */}
        <SeedingTable participants={data.participants} />

        {/* Footer */}
        <div className="text-center py-6 border-t border-neutral-800">
          <p className="text-xs text-neutral-600">
            RCRS March Madness 2026 &bull; Sales data updated in real time &bull; Results finalized Monday 9 AM
          </p>
        </div>
      </div>
    </div>
  );
}
