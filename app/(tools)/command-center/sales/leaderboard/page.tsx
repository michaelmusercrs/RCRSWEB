'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Crown,
  Medal,
  Star,
  Flame,
  Zap,
  Target,
  TrendingUp,
  TrendingDown,
  Award,
  Gift,
  Calendar,
  Clock,
  Users,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
  Lock,
  ChevronRight,
  Plus,
  Filter,
  RefreshCw,
  ArrowLeft,
  ClipboardList,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/command-center';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

// =============================================================================
// Types
// =============================================================================

interface LeaderboardEntry {
  rank: number;
  repSlug: string;
  repName: string;
  avatar?: string;
  points: number;
  sales: number;
  revenue: number;
  responseTime: number;
  closeRate: number;
  streak: number;
  achievements: string[];
  trend: 'up' | 'down' | 'steady';
  previousRank: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  category: 'sales' | 'speed' | 'consistency' | 'volume' | 'customer' | 'team';
  criteria: string;
  threshold: number;
  points: number;
}

interface Contest {
  id: string;
  name: string;
  description: string;
  type: 'individual' | 'team';
  metric: string;
  startDate: string;
  endDate: string;
  prize: string;
  status: 'upcoming' | 'active' | 'completed';
  participants: { repSlug: string; score: number }[];
  winnerId?: string;
}

interface DailyChallenge {
  id: string;
  date: string;
  title: string;
  description: string;
  metric: string;
  target: number;
  bonusPoints: number;
  completedBy: string[];
}

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'biannual' | 'yearly' | 'all_time';

// Weekly numbers leaderboard types
interface WeeklyMetric {
  key: string;
  label: string;
}

interface WeeklyLeaderboardEntry {
  rank: number;
  repName: string;
  repEmail: string;
  metricValue: number;
  weeksReported: number;
  allMetrics: Record<string, number>;
}

type WeeklyPeriod = 'thisWeek' | 'lastWeek' | 'thisMonth' | 'thisQuarter' | 'biannual' | 'thisYear' | 'allTime';

// =============================================================================
// Constants
// =============================================================================

const TIER_COLORS: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  bronze: {
    border: 'border-[#CD7F32]',
    bg: 'bg-[#CD7F32]/10',
    text: 'text-[#CD7F32]',
    glow: '',
  },
  silver: {
    border: 'border-[#C0C0C0]',
    bg: 'bg-[#C0C0C0]/10',
    text: 'text-[#C0C0C0]',
    glow: '',
  },
  gold: {
    border: 'border-[#FFD700]',
    bg: 'bg-[#FFD700]/10',
    text: 'text-[#FFD700]',
    glow: 'shadow-[0_0_15px_rgba(255,215,0,0.2)]',
  },
  platinum: {
    border: 'border-[#E5E4E2]',
    bg: 'bg-[#E5E4E2]/10',
    text: 'text-[#E5E4E2]',
    glow: 'shadow-[0_0_18px_rgba(229,228,226,0.2)]',
  },
  diamond: {
    border: 'border-[#B9F2FF]',
    bg: 'bg-[#B9F2FF]/10',
    text: 'text-[#B9F2FF]',
    glow: 'shadow-[0_0_20px_rgba(185,242,255,0.3)]',
  },
};

const RANK_COLORS = {
  1: { bg: 'from-yellow-500/20 to-amber-600/20', text: 'text-yellow-400', accent: '#FFD700' },
  2: { bg: 'from-gray-400/20 to-gray-500/20', text: 'text-gray-300', accent: '#C0C0C0' },
  3: { bg: 'from-orange-600/20 to-amber-700/20', text: 'text-orange-400', accent: '#CD7F32' },
};

// =============================================================================
// Utility Functions
// =============================================================================

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

function getTimeRemaining(endDate: string): string {
  const end = new Date(endDate).getTime();
  const now = Date.now();
  const diff = end - now;

  if (diff <= 0) return 'Ended';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getRepNameForSlug(slug: string, leaderboard: LeaderboardEntry[]): string {
  const entry = leaderboard.find(e => e.repSlug === slug);
  return entry?.repName || slug;
}

// =============================================================================
// Sub-Components
// =============================================================================

function PeriodTabs({ selected, onChange }: { selected: PeriodType; onChange: (p: PeriodType) => void }) {
  const periods: { value: PeriodType; label: string }[] = [
    { value: 'daily', label: 'Day' },
    { value: 'weekly', label: 'Week' },
    { value: 'monthly', label: 'Month' },
    { value: 'quarterly', label: 'Quarter' },
    { value: 'biannual', label: 'H1/H2' },
    { value: 'yearly', label: 'Year' },
    { value: 'all_time', label: 'All' },
  ];

  return (
    <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      {periods.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={cn(
            'px-3 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap flex-shrink-0',
            selected === value
              ? 'bg-[#39FF14] text-black'
              : 'text-neutral-500 hover:text-white hover:bg-zinc-800'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function TopBanner({ leader }: { leader: LeaderboardEntry }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 via-amber-500/5 to-yellow-500/10 p-6">
      <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative flex items-center gap-6">
        <div className="flex-shrink-0 relative">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center text-3xl font-bold text-black">
            {leader.repName.charAt(0)}
          </div>
          <Crown className="absolute -top-3 -right-1 h-8 w-8 text-yellow-400 drop-shadow-lg" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-yellow-500/80">
              Current Leader
            </span>
            {leader.streak >= 3 && (
              <span className="flex items-center gap-1 text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
                <Flame className="h-3 w-3" /> {leader.streak}-day streak
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold text-white truncate">{leader.repName}</h2>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <span className="text-yellow-400 font-bold text-lg">{formatNumber(leader.points)} pts</span>
            <span className="text-neutral-400 text-sm">{leader.sales} sales</span>
            <span className="text-neutral-400 text-sm">{formatCurrency(leader.revenue)} revenue</span>
            <span className="text-neutral-400 text-sm">{leader.closeRate}% close rate</span>
          </div>
        </div>

        <div className="hidden md:flex flex-col items-center">
          <Trophy className="h-16 w-16 text-yellow-400/40" />
          <span className="text-yellow-500/60 text-xs mt-1 font-medium">#1</span>
        </div>
      </div>
    </div>
  );
}

function LeaderboardTable({
  entries,
  currentUserSlug,
  achievements,
}: {
  entries: LeaderboardEntry[];
  currentUserSlug: string | null;
  achievements: Achievement[];
}) {
  const getAchievementIcon = (achId: string): string => {
    const ach = achievements.find(a => a.id === achId);
    return ach?.icon || '?';
  };

  return (
    <div className="bg-zinc-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#39FF14]" />
            Full Rankings
          </h2>
          <p className="text-sm text-neutral-500">Click a rep for detailed profile</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-xs uppercase text-neutral-500">
              <th className="px-4 py-3 text-center w-16">Rank</th>
              <th className="px-4 py-3 text-left">Rep</th>
              <th className="px-4 py-3 text-right">Points</th>
              <th className="px-4 py-3 text-right hidden sm:table-cell">Sales</th>
              <th className="px-4 py-3 text-right hidden md:table-cell">Revenue</th>
              <th className="px-4 py-3 text-right hidden lg:table-cell">Avg Response</th>
              <th className="px-4 py-3 text-right hidden lg:table-cell">Close Rate</th>
              <th className="px-4 py-3 text-center hidden md:table-cell">Streak</th>
              <th className="px-4 py-3 text-center w-12">Trend</th>
              <th className="px-4 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const isCurrentUser = currentUserSlug === entry.repSlug;
              const isTop3 = entry.rank <= 3;
              const rankStyle = RANK_COLORS[entry.rank as keyof typeof RANK_COLORS];

              return (
                <tr
                  key={entry.repSlug}
                  className={cn(
                    'border-b border-gray-800/50 hover:bg-zinc-800/50 transition cursor-pointer',
                    isCurrentUser && 'bg-[#39FF14]/5 border-l-2 border-l-[#39FF14]',
                    isTop3 && `bg-gradient-to-r ${rankStyle?.bg || ''}`
                  )}
                >
                  {/* Rank */}
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {entry.rank === 1 && <Crown className="h-5 w-5 text-yellow-400" />}
                      {entry.rank === 2 && <Medal className="h-5 w-5 text-gray-300" />}
                      {entry.rank === 3 && <Award className="h-5 w-5 text-orange-400" />}
                      {entry.rank > 3 && (
                        <span className="font-bold text-neutral-400">{entry.rank}</span>
                      )}
                    </div>
                  </td>

                  {/* Rep */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/command-center/sales/${encodeURIComponent(entry.repSlug)}`}
                      className="flex items-center gap-3 group"
                    >
                      <div
                        className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
                          isTop3
                            ? `bg-gradient-to-br ${rankStyle?.bg || 'bg-zinc-700'} ${rankStyle?.text || ''}`
                            : 'bg-zinc-700 text-neutral-400'
                        )}
                      >
                        {entry.repName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <span className={cn(
                          'font-medium block group-hover:text-[#39FF14] transition truncate',
                          isCurrentUser ? 'text-[#39FF14]' : 'text-white'
                        )}>
                          {entry.repName}
                          {isCurrentUser && <span className="text-xs ml-1 text-neutral-500">(you)</span>}
                        </span>
                        {entry.achievements.length > 0 && (
                          <div className="flex gap-0.5 mt-0.5">
                            {entry.achievements.slice(0, 4).map((achId, i) => (
                              <span key={i} className="text-xs" title={achId}>
                                {getAchievementIcon(achId)}
                              </span>
                            ))}
                            {entry.achievements.length > 4 && (
                              <span className="text-xs text-neutral-500">
                                +{entry.achievements.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </Link>
                  </td>

                  {/* Points */}
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold text-[#39FF14]">{formatNumber(entry.points)}</span>
                  </td>

                  {/* Sales */}
                  <td className="px-4 py-3 text-right hidden sm:table-cell">
                    <span className="text-white">{formatNumber(entry.sales)}</span>
                  </td>

                  {/* Revenue */}
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <span className="text-white">{formatCurrency(entry.revenue)}</span>
                  </td>

                  {/* Response Time */}
                  <td className="px-4 py-3 text-right hidden lg:table-cell">
                    <span className={cn(
                      entry.responseTime < 10 ? 'text-green-400' :
                      entry.responseTime < 20 ? 'text-yellow-400' :
                      'text-red-400'
                    )}>
                      {entry.responseTime} min
                    </span>
                  </td>

                  {/* Close Rate */}
                  <td className="px-4 py-3 text-right hidden lg:table-cell">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-12 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#39FF14] rounded-full"
                          style={{ width: `${Math.min(entry.closeRate, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-white">{entry.closeRate}%</span>
                    </div>
                  </td>

                  {/* Streak */}
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    {entry.streak > 0 ? (
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                        entry.streak >= 7 ? 'bg-orange-500/20 text-orange-400' :
                        entry.streak >= 3 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-zinc-700 text-neutral-400'
                      )}>
                        <Flame className="h-3 w-3" />
                        {entry.streak}
                      </span>
                    ) : (
                      <span className="text-neutral-600">-</span>
                    )}
                  </td>

                  {/* Trend */}
                  <td className="px-4 py-3 text-center">
                    {entry.trend === 'up' && <ArrowUp className="h-4 w-4 text-green-400 mx-auto" />}
                    {entry.trend === 'down' && <ArrowDown className="h-4 w-4 text-red-400 mx-auto" />}
                    {entry.trend === 'steady' && <Minus className="h-4 w-4 text-neutral-500 mx-auto" />}
                  </td>

                  {/* Arrow */}
                  <td className="px-4 py-3">
                    <ChevronRight className="h-4 w-4 text-neutral-600" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AchievementsGrid({ achievements, earnedIds }: { achievements: Achievement[]; earnedIds: string[] }) {
  const [selectedAch, setSelectedAch] = useState<Achievement | null>(null);
  const tiers = ['diamond', 'platinum', 'gold', 'silver', 'bronze'] as const;

  return (
    <div className="bg-zinc-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-400" />
          Achievements
        </h2>
        <p className="text-sm text-neutral-500">
          {earnedIds.length} of {achievements.length} unlocked
        </p>
      </div>

      <div className="p-4 space-y-6">
        {tiers.map(tier => {
          const tierAchs = achievements.filter(a => a.tier === tier);
          if (tierAchs.length === 0) return null;
          const colors = TIER_COLORS[tier];

          return (
            <div key={tier}>
              <h3 className={cn('text-sm font-semibold uppercase tracking-wider mb-3', colors.text)}>
                {tier} ({tierAchs.filter(a => earnedIds.includes(a.id)).length}/{tierAchs.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {tierAchs.map(ach => {
                  const isEarned = earnedIds.includes(ach.id);
                  return (
                    <button
                      key={ach.id}
                      onClick={() => setSelectedAch(selectedAch?.id === ach.id ? null : ach)}
                      className={cn(
                        'relative p-3 rounded-xl border-2 transition-all text-center group',
                        isEarned
                          ? cn(colors.border, colors.bg, colors.glow, 'hover:scale-105')
                          : 'border-zinc-700/50 bg-zinc-800/30 opacity-40 hover:opacity-60'
                      )}
                    >
                      {!isEarned && (
                        <Lock className="absolute top-2 right-2 h-3 w-3 text-neutral-600" />
                      )}
                      <div className={cn('text-2xl mb-1', !isEarned && 'grayscale')}>
                        {ach.icon}
                      </div>
                      <p className={cn(
                        'text-xs font-medium truncate',
                        isEarned ? 'text-white' : 'text-neutral-600'
                      )}>
                        {ach.name}
                      </p>
                      <p className={cn(
                        'text-xs mt-0.5',
                        isEarned ? colors.text : 'text-neutral-700'
                      )}>
                        {ach.points} pts
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Achievement Detail Popup */}
      {selectedAch && (
        <div className="p-4 border-t border-gray-800 bg-zinc-800/50">
          <div className="flex items-start gap-3">
            <span className="text-3xl">{selectedAch.icon}</span>
            <div>
              <h3 className={cn('font-bold', TIER_COLORS[selectedAch.tier].text)}>
                {selectedAch.name}
              </h3>
              <p className="text-sm text-neutral-400 mt-0.5">{selectedAch.description}</p>
              <p className="text-xs text-neutral-500 mt-1">{selectedAch.criteria}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full uppercase font-semibold',
                  TIER_COLORS[selectedAch.tier].bg,
                  TIER_COLORS[selectedAch.tier].text
                )}>
                  {selectedAch.tier}
                </span>
                <span className="text-xs text-neutral-500">{selectedAch.points} points</span>
                <span className="text-xs text-neutral-500 capitalize">{selectedAch.category}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContestCard({ contest, leaderboard }: { contest: Contest; leaderboard: LeaderboardEntry[] }) {
  const isActive = contest.status === 'active';
  const timeLeft = getTimeRemaining(contest.endDate);
  const topParticipants = contest.participants
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const metricLabels: Record<string, string> = {
    revenue: 'Revenue',
    deals: 'Deals Closed',
    leads_contacted: 'Leads Contacted',
    response_time: 'Response Score',
    reviews: 'Reviews',
  };

  return (
    <div className={cn(
      'rounded-xl border p-5 transition-all',
      isActive
        ? 'border-[#39FF14]/30 bg-[#39FF14]/5'
        : 'border-gray-800 bg-zinc-900'
    )}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className={cn('h-5 w-5', isActive ? 'text-[#39FF14]' : 'text-neutral-500')} />
            <h3 className="font-bold text-white">{contest.name}</h3>
          </div>
          <p className="text-sm text-neutral-400 mt-1">{contest.description}</p>
        </div>
        <span className={cn(
          'text-xs px-2 py-1 rounded-full font-medium',
          isActive ? 'bg-[#39FF14]/20 text-[#39FF14]' : 'bg-zinc-800 text-neutral-500'
        )}>
          {contest.status}
        </span>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <Target className="h-3 w-3" />
          {metricLabels[contest.metric] || contest.metric}
        </span>
        <span className="flex items-center gap-1">
          <Gift className="h-3 w-3" />
          {contest.prize}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {timeLeft}
        </span>
      </div>

      {/* Mini Leaderboard */}
      <div className="space-y-2">
        {topParticipants.map((p, index) => (
          <div key={p.repSlug} className="flex items-center gap-2 text-sm">
            <span className={cn(
              'w-5 text-center font-bold',
              index === 0 ? 'text-yellow-400' :
              index === 1 ? 'text-gray-300' :
              index === 2 ? 'text-orange-400' :
              'text-neutral-500'
            )}>
              {index + 1}
            </span>
            <span className="text-white flex-1 truncate">
              {getRepNameForSlug(p.repSlug, leaderboard)}
            </span>
            <span className="text-[#39FF14] font-medium">
              {contest.metric === 'revenue' ? formatCurrency(p.score) : formatNumber(p.score)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DailyChallengeCard({
  challenge,
  leaderboard,
}: {
  challenge: DailyChallenge;
  leaderboard: LeaderboardEntry[];
}) {
  return (
    <div className="rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-violet-600/5 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-purple-400" />
          <h3 className="font-bold text-white">Daily Challenge</h3>
        </div>
        <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full font-medium">
          +{challenge.bonusPoints} bonus pts
        </span>
      </div>

      <h4 className="text-lg font-semibold text-purple-300 mb-1">{challenge.title}</h4>
      <p className="text-sm text-neutral-400 mb-4">{challenge.description}</p>

      <div className="flex items-center justify-between text-sm mb-3">
        <span className="text-neutral-500">Target: {challenge.target}</span>
        <span className="text-neutral-500">
          {challenge.completedBy.length} completed
        </span>
      </div>

      {/* Progress for participants */}
      <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-violet-400 rounded-full transition-all"
          style={{
            width: `${Math.min((challenge.completedBy.length / Math.max(leaderboard.length, 1)) * 100, 100)}%`,
          }}
        />
      </div>

      {challenge.completedBy.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {challenge.completedBy.map(slug => (
            <span key={slug} className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
              {getRepNameForSlug(slug, leaderboard)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonalStatsPanel({
  entry,
  achievements,
  allAchievements,
}: {
  entry: LeaderboardEntry | null;
  achievements: Achievement[];
  allAchievements: Achievement[];
}) {
  if (!entry) return null;

  const earnedAchs = allAchievements.filter(a => entry.achievements.includes(a.id));
  const totalPossiblePoints = allAchievements.reduce((sum, a) => sum + a.points, 0);
  const earnedPoints = earnedAchs.reduce((sum, a) => sum + a.points, 0);

  // Find next achievement to earn
  const unearnedAchs = allAchievements
    .filter(a => !entry.achievements.includes(a.id))
    .sort((a, b) => a.points - b.points);
  const nextAch = unearnedAchs[0];

  // Points by category
  const categoryPoints: Record<string, number> = {};
  for (const ach of earnedAchs) {
    categoryPoints[ach.category] = (categoryPoints[ach.category] || 0) + ach.points;
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-gray-800 p-5 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#39FF14]/30 to-green-600/30 flex items-center justify-center text-xl font-bold text-[#39FF14]">
          {entry.repName.charAt(0)}
        </div>
        <div>
          <h3 className="font-bold text-white">{entry.repName}</h3>
          <p className="text-sm text-neutral-500">Your Stats</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-800 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-[#39FF14]">#{entry.rank}</p>
          <p className="text-xs text-neutral-500">Rank</p>
        </div>
        <div className="bg-zinc-800 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-white">{formatNumber(entry.points)}</p>
          <p className="text-xs text-neutral-500">Points</p>
        </div>
        <div className="bg-zinc-800 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-white">{entry.achievements.length}</p>
          <p className="text-xs text-neutral-500">Achievements</p>
        </div>
        <div className="bg-zinc-800 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1">
            <Flame className={cn('h-5 w-5', entry.streak > 0 ? 'text-orange-400' : 'text-neutral-600')} />
            <p className="text-2xl font-bold text-white">{entry.streak}</p>
          </div>
          <p className="text-xs text-neutral-500">Streak</p>
        </div>
      </div>

      {/* Achievement progress */}
      <div>
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-neutral-400">Achievement Points</span>
          <span className="text-neutral-500">{earnedPoints}/{totalPossiblePoints}</span>
        </div>
        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#39FF14] to-green-400 rounded-full"
            style={{ width: `${(earnedPoints / totalPossiblePoints) * 100}%` }}
          />
        </div>
      </div>

      {/* Next achievement */}
      {nextAch && (
        <div className={cn(
          'rounded-lg border p-3',
          TIER_COLORS[nextAch.tier].border,
          TIER_COLORS[nextAch.tier].bg
        )}>
          <p className="text-xs text-neutral-500 mb-1">Next Achievement</p>
          <div className="flex items-center gap-2">
            <span className="text-xl">{nextAch.icon}</span>
            <div>
              <p className={cn('text-sm font-medium', TIER_COLORS[nextAch.tier].text)}>
                {nextAch.name}
              </p>
              <p className="text-xs text-neutral-500">{nextAch.criteria}</p>
            </div>
          </div>
        </div>
      )}

      {/* Points breakdown */}
      {Object.keys(categoryPoints).length > 0 && (
        <div>
          <p className="text-sm text-neutral-400 mb-2">Points by Category</p>
          <div className="space-y-2">
            {Object.entries(categoryPoints)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, pts]) => (
                <div key={cat} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-400 capitalize">{cat}</span>
                  <span className="text-white font-medium">{pts} pts</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Weekly Numbers Leaderboard (Google Sheets powered)
// =============================================================================

function WeeklyNumbersLeaderboard() {
  const [metric, setMetric] = useState<string>('points');
  const [weeklyPeriod, setWeeklyPeriod] = useState<WeeklyPeriod>('thisWeek');
  const [entries, setEntries] = useState<WeeklyLeaderboardEntry[]>([]);
  const [availableMetrics, setAvailableMetrics] = useState<WeeklyMetric[]>([]);
  const [metricLabel, setMetricLabel] = useState('Total Points');
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState('');

  const fetchWeeklyData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/command-center/weekly-leaderboard?metric=${metric}&period=${weeklyPeriod}`
      );
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      if (data.success) {
        setEntries(data.leaderboard || []);
        setAvailableMetrics(data.availableMetrics || []);
        setMetricLabel(data.metricLabel || metric);
        setCurrentWeek(data.currentWeek || '');
      }
    } catch (err) {
      console.error('Weekly leaderboard error:', err);
    } finally {
      setLoading(false);
    }
  }, [metric, weeklyPeriod]);

  useEffect(() => {
    fetchWeeklyData();
  }, [fetchWeeklyData]);

  const isCurrency = ['estimatedRevenue', 'revenueClosed'].includes(metric);

  const periodOptions: { value: WeeklyPeriod; label: string }[] = [
    { value: 'thisWeek', label: 'This Week' },
    { value: 'lastWeek', label: 'Last Week' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'thisQuarter', label: 'This Quarter' },
    { value: 'thisYear', label: 'YTD' },
    { value: 'allTime', label: 'All Time' },
  ];

  return (
    <div className="bg-zinc-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-[#39FF14]" />
              Monday Meeting Numbers
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                Self-Reported
              </span>
            </h2>
            <p className="text-sm text-neutral-500">
              From Monday meeting sheets &middot; {currentWeek && `Week ${currentWeek}`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Period Selector */}
            <select
              value={weeklyPeriod}
              onChange={(e) => setWeeklyPeriod(e.target.value as WeeklyPeriod)}
              className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#39FF14]/50"
            >
              {periodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Metric Filter */}
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#39FF14]/50"
            >
              {availableMetrics.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>

            <button
              onClick={fetchWeeklyData}
              className="p-1.5 bg-zinc-800 text-neutral-400 rounded-lg hover:bg-zinc-700 hover:text-white transition"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center">
          <LoadingSpinner size="md" />
        </div>
      ) : entries.length === 0 ? (
        <div className="p-8 text-center">
          <BarChart3 className="h-10 w-10 text-neutral-600 mx-auto mb-2" />
          <p className="text-neutral-500 text-sm">No weekly numbers submitted yet for this period.</p>
          <p className="text-neutral-600 text-xs mt-1">Sales reps can enter numbers from their portal.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase text-neutral-500">
                <th className="px-4 py-3 text-center w-16">Rank</th>
                <th className="px-4 py-3 text-left">Rep</th>
                <th className="px-4 py-3 text-right font-bold text-[#39FF14]">{metricLabel}</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell">Doors</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">Appts</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">Inspections</th>
                <th className="px-4 py-3 text-right hidden lg:table-cell">Contracts</th>
                <th className="px-4 py-3 text-right hidden lg:table-cell">Revenue</th>
                <th className="px-4 py-3 text-right hidden xl:table-cell">Weeks</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isTop3 = entry.rank <= 3;
                const rankStyle = RANK_COLORS[entry.rank as keyof typeof RANK_COLORS];

                return (
                  <tr
                    key={entry.repEmail}
                    className={cn(
                      'border-b border-gray-800/50 hover:bg-zinc-800/50 transition',
                      isTop3 && `bg-gradient-to-r ${rankStyle?.bg || ''}`
                    )}
                  >
                    <td className="px-4 py-3 text-center">
                      {entry.rank === 1 && <Crown className="h-5 w-5 text-yellow-400 mx-auto" />}
                      {entry.rank === 2 && <Medal className="h-5 w-5 text-gray-300 mx-auto" />}
                      {entry.rank === 3 && <Award className="h-5 w-5 text-orange-400 mx-auto" />}
                      {entry.rank > 3 && (
                        <span className="font-bold text-neutral-400">{entry.rank}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
                          isTop3
                            ? `bg-gradient-to-br ${rankStyle?.bg || 'bg-zinc-700'} ${rankStyle?.text || ''}`
                            : 'bg-zinc-700 text-neutral-400'
                        )}>
                          {entry.repName.charAt(0)}
                        </div>
                        <span className="font-medium text-white truncate">{entry.repName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-[#39FF14] text-lg">
                        {isCurrency ? `$${entry.metricValue.toLocaleString()}` : entry.metricValue.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell text-neutral-300">
                      {(entry.allMetrics.doorsKnocked || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell text-neutral-300">
                      {(entry.allMetrics.appointmentsSet || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell text-neutral-300">
                      {(entry.allMetrics.inspectionsCompleted || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell text-neutral-300">
                      {(entry.allMetrics.contractsSigned || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell text-emerald-400 font-medium">
                      ${(entry.allMetrics.revenueClosed || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right hidden xl:table-cell text-neutral-500">
                      {entry.weeksReported}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function GamificationLeaderboardPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<PeriodType>('all_time');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentUserSlug = useMemo(() => {
    if (!user?.name) return null;
    const member = ([] as Array<{ name: string; slug: string }>).find(() => false);
    // Match by user name from auth context
    return user.name.toLowerCase().replace(/\s+/g, '-') || null;
  }, [user]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [lbRes, achRes] = await Promise.all([
        fetch(`/api/gamification/leaderboard?period=${period}`),
        fetch('/api/gamification/achievements?checkAll=true'),
      ]);

      if (!lbRes.ok) throw new Error(`Leaderboard API error: ${lbRes.status}`);
      if (!achRes.ok) throw new Error(`Achievements API error: ${achRes.status}`);

      const lbData = await lbRes.json();
      const achData = await achRes.json();

      if (lbData.success) {
        setLeaderboard(lbData.data.leaderboard || []);
        setContests(lbData.data.activeContests || []);
        setDailyChallenge(lbData.data.dailyChallenge || null);
      }

      if (achData.success) {
        setAchievements(achData.data.achievements || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derive current user's entry
  const currentUserEntry = useMemo(() => {
    if (!user?.name) return null;
    const slug = user.name.toLowerCase().replace(/\s+/g, '-');
    return leaderboard.find(e => e.repSlug === slug) || null;
  }, [user, leaderboard]);

  // Derive earned achievement IDs from all leaderboard entries
  const allEarnedIds = useMemo(() => {
    const ids = new Set<string>();
    leaderboard.forEach(e => e.achievements.forEach(a => ids.add(a)));
    return Array.from(ids);
  }, [leaderboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Data</h2>
          <p className="text-neutral-500 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const leader = leaderboard[0];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Link
            href="/command-center/sales"
            className="inline-flex items-center gap-1 text-neutral-500 hover:text-white mb-2 transition text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sales
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3 flex-wrap">
            <Trophy className="h-7 w-7 sm:h-8 sm:w-8 text-[#39FF14]" />
            Sales Leaderboard
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              Actual Commissions
            </span>
          </h1>
          <p className="text-neutral-500 mt-1 text-sm">
            Compete, earn achievements, and climb the ranks &mdash; based on actual commission records
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <PeriodTabs selected={period} onChange={setPeriod} />
          <div className="flex gap-2">
            <Link
              href="/command-center/sales/achievements"
              className="px-3 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition flex items-center gap-2 text-sm whitespace-nowrap"
            >
              <Award className="h-4 w-4" />
              Achievements
            </Link>
            <button
              onClick={fetchData}
              className="p-2 bg-zinc-800 text-neutral-400 rounded-lg hover:bg-zinc-700 hover:text-white transition"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Monday Meeting Numbers Leaderboard - Self-reported via RepWeeklyNumbers sheet */}
      <WeeklyNumbersLeaderboard />

      {/* Top Banner - Current Leader (Commission-based) */}
      {leader && <TopBanner leader={leader} />}

      {/* Main Content Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Main Content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Leaderboard Table */}
          <LeaderboardTable
            entries={leaderboard}
            currentUserSlug={currentUserEntry?.repSlug || null}
            achievements={achievements}
          />

          {/* Achievements Grid */}
          <AchievementsGrid
            achievements={achievements}
            earnedIds={allEarnedIds}
          />
        </div>

        {/* Right: Sidebar */}
        <div className="w-full lg:w-80 space-y-6 flex-shrink-0">
          {/* Personal Stats */}
          {currentUserEntry && (
            <PersonalStatsPanel
              entry={currentUserEntry}
              achievements={achievements.filter(a => currentUserEntry.achievements.includes(a.id))}
              allAchievements={achievements}
            />
          )}

          {/* Daily Challenge */}
          {dailyChallenge && (
            <DailyChallengeCard
              challenge={dailyChallenge}
              leaderboard={leaderboard}
            />
          )}

          {/* Active Contests */}
          {contests.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Target className="h-5 w-5 text-[#39FF14]" />
                Active Contests
              </h2>
              {contests.map(contest => (
                <ContestCard
                  key={contest.id}
                  contest={contest}
                  leaderboard={leaderboard}
                />
              ))}
            </div>
          )}

          {/* No contests message */}
          {contests.length === 0 && (
            <div className="bg-zinc-900 rounded-xl border border-gray-800 p-5 text-center">
              <Gift className="h-10 w-10 text-neutral-600 mx-auto mb-2" />
              <p className="text-sm text-neutral-500">No active contests right now.</p>
              <p className="text-xs text-neutral-600 mt-1">Check back soon for new competitions.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
