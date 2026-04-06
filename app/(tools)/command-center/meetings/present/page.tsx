'use client';

/**
 * RCRS Command Center - Monday Meeting Presentation Mode
 *
 * Full-screen presentation view for Monday meetings featuring:
 * - Auto-rotating stats display
 * - Live leaderboard with animations
 * - Celebratory effects for achievements
 * - Period toggle (Weekly/Monthly/YTD)
 * - Real-time data updates
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SalesChartsSlide, CommissionChartsSlide } from '@/components/command-center/MeetingCharts';
import type { ChartData } from '@/components/command-center/MeetingCharts';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Target,
  Flame,
  Snowflake,
  Crown,
  Medal,
  Award,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Maximize,
  Minimize,
  RefreshCw,
  X,
  Star,
  Zap,
  Megaphone,
  DownloadCloud,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SalesCompetitionPresentation,
  getCurrentPeriod,
} from '@/components/command-center/SalesCompetition';

// =============================================================================
// Types
// =============================================================================

interface WeeklyNumbersRecord {
  week: string;
  repName: string;
  doorsKnocked: number;
  appointmentsSet: number;
  inspectionsCompleted: number;
  estimatesGiven: number;
  contractsSigned: number;
  revenueClosed: number;
  leadsGenerated: number;
  followUpsMade: number;
}

interface RepStats {
  rank: number;
  name: string;
  initials: string;
  avatarColor: string;
  totalCommissions: number;
  weeklyCommissions: number;
  monthlyCommissions: number;
  ytdCommissions: number;
  totalTransactions: number;
  avgTransaction: number;
  percentOfTeamTotal: number;
  streak: 'hot' | 'cold' | 'neutral';
  isTopPerformer: boolean;
  achievements: Array<{
    id: string;
    icon: string;
    name: string;
    tier: 'legendary' | 'epic' | 'rare' | 'common';
  }>;
  meetingMetrics?: {
    inspected: number;
    damage: number;
    signed: number;
    repair: number;
    gutter: number;
    revenue: number;
    approved: number;
    goal: number;
    referrals: number;
    agents: number;
    homeShow: number;
    weeksPresent: number;
    totalWeeks: number;
    attendanceRate: number;
  };
}

interface LeaderboardData {
  leaderboard: RepStats[];
  summary: {
    totalTeamCommissions: number;
    totalTransactions: number;
    weeklyTotal: number;
    monthlyTotal: number;
    ytdTotal: number;
    avgTeamTransaction: number;
  };
  celebrationTriggers: Array<{
    type: string;
    message: string;
    rep?: string;
    value?: number;
    animation: string;
  }>;
}

interface MeetingStats {
  period: 'week' | 'month' | 'ytd';
  periodLabel: string;
  totalCommissions: number;
  totalTransactions: number;
  avgTransaction: number;
  change: {
    commissions: number;
    commissionsPercent: number;
    transactions: number;
    transactionsPercent: number;
  };
  topPerformer: {
    name: string;
    amount: number;
    percentOfTotal: number;
  };
  goals: {
    weeklyTarget: number;
    monthlyTarget: number;
    yearlyTarget: number;
    weeklyProgress: number;
    monthlyProgress: number;
    yearlyProgress: number;
  };
  milestones: Array<{
    type: string;
    title: string;
    description: string;
    rep?: string;
    value?: number;
  }>;
}

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  userName: string;
  category: string;
  highlights?: string[];
  displayDuration?: string;
}

interface AnnouncementsData {
  early: AnnouncementItem[];
  late: AnnouncementItem[];
}

interface WeeklyNumbersRep {
  repName: string;
  repEmail: string;
  week: string;
  doorsKnocked: number;
  appointmentsSet: number;
  inspectionsCompleted: number;
  estimatesGiven: number;
  contractsSigned: number;
  revenueClosed: number;
  leadsGenerated: number;
  followUpsMade: number;
}

type ViewMode = 'date-header' | 'bible-verse' | 'training' | 'weather' | 'attendance' | 'early-announcements' | 'enter-numbers' | 'weekly-numbers' | 'projections' | 'podium' | 'leaderboard' | 'competition' | 'stats' | 'sales-charts' | 'commission-charts' | 'goals' | 'milestones' | 'office-bonus' | 'late-announcements';

// =============================================================================
// Utility Functions
// =============================================================================

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function formatLargeCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

// =============================================================================
// Confetti Component
// =============================================================================

function Confetti({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; color: string; delay: number }>>([]);

  useEffect(() => {
    if (active) {
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: ['#84cc16', '#facc15', '#f97316', '#3b82f6', '#a855f7'][Math.floor(Math.random() * 5)],
        delay: Math.random() * 2,
      }));
      setParticles(newParticles);

      const timer = setTimeout(() => setParticles([]), 4000);
      return () => clearTimeout(timer);
    }
  }, [active]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-3 h-3 animate-confetti"
          style={{
            left: `${p.x}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            borderRadius: Math.random() > 0.5 ? '50%' : '0',
          }}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Podium Display Component
// =============================================================================

function PodiumDisplay({ leaderboard, period }: { leaderboard: RepStats[]; period: 'week' | 'month' | 'ytd' }) {
  const top3 = leaderboard.slice(0, 3);
  if (top3.length < 3) return null;

  const podiumOrder = [top3[1], top3[0], top3[2]]; // 2nd, 1st, 3rd
  const heights = ['h-48', 'h-64', 'h-40'];
  const colors = [
    'from-gray-400 to-gray-500',
    'from-yellow-400 to-amber-500',
    'from-orange-600 to-amber-700',
  ];
  const positions = ['2nd', '1st', '3rd'];
  const icons = [
    <Medal key="silver" className="h-12 w-12 text-neutral-400" />,
    <Crown key="gold" className="h-16 w-16 text-yellow-300 animate-pulse" />,
    <Award key="bronze" className="h-10 w-10 text-orange-400" />,
  ];

  // Show the period-specific revenue (meetingMetrics.revenue is the period-filtered value)
  const getPeriodRevenue = (rep: RepStats) => {
    if (rep.meetingMetrics) return rep.meetingMetrics.revenue;
    // Fallback to backward-compat fields
    switch (period) {
      case 'week': return rep.weeklyCommissions;
      case 'month': return rep.monthlyCommissions;
      case 'ytd': return rep.ytdCommissions;
      default: return rep.totalCommissions;
    }
  };

  const periodLabel = period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'YTD';

  return (
    <div className="flex items-end justify-center gap-8 pt-16">
      {podiumOrder.map((rep, index) => (
        <div key={rep.name} className="flex flex-col items-center animate-slideUp" style={{ animationDelay: `${index * 0.2}s` }}>
          {/* Rep Info */}
          <div className="text-center mb-4">
            {icons[index]}
            <div
              className={cn(
                'w-24 h-24 rounded-full bg-gradient-to-br flex items-center justify-center text-4xl font-bold text-white mt-4 shadow-2xl',
                colors[index]
              )}
            >
              {rep.initials}
            </div>
            <h3 className="text-2xl font-bold text-white mt-4">{rep.name}</h3>
            <p className="text-4xl font-bold text-lime-400 mt-2">{formatCurrency(getPeriodRevenue(rep))}</p>
            <p className="text-lg text-neutral-500">{periodLabel} Revenue</p>
            {rep.streak === 'hot' && (
              <span className="inline-flex items-center gap-1 text-orange-400 mt-2">
                <Flame className="h-5 w-5 animate-pulse" />
                On Fire!
              </span>
            )}
          </div>

          {/* Podium Base */}
          <div
            className={cn(
              'w-40 rounded-t-lg bg-gradient-to-b flex items-center justify-center text-3xl font-bold text-white shadow-xl',
              heights[index],
              colors[index]
            )}
          >
            {positions[index]}
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Stats Display Component
// =============================================================================

function StatsDisplay({ stats, leaderboard }: { stats: MeetingStats | null; leaderboard: LeaderboardData | null }) {
  if (!stats || !leaderboard) return null;

  const statCards = [
    {
      label: 'YTD Team Sales Revenue',
      value: formatLargeCurrency(leaderboard.summary.ytdTotal),
      subValue: `${leaderboard.summary.totalTransactions.toLocaleString()} meeting weeks tracked`,
      icon: DollarSign,
      color: 'text-lime-400',
      bgColor: 'bg-lime-500/20',
    },
    {
      label: `${stats.periodLabel} Revenue`,
      value: formatCurrency(stats.totalCommissions),
      subValue: `${stats.change.commissionsPercent >= 0 ? '+' : ''}${stats.change.commissionsPercent}% vs last period`,
      icon: stats.change.commissionsPercent >= 0 ? TrendingUp : TrendingDown,
      color: stats.change.commissionsPercent >= 0 ? 'text-green-400' : 'text-red-400',
      bgColor: stats.change.commissionsPercent >= 0 ? 'bg-green-500/20' : 'bg-red-500/20',
    },
    {
      label: 'Avg Weekly Revenue',
      value: formatCurrency(stats.avgTransaction),
      subValue: `Team avg: ${formatCurrency(leaderboard.summary.avgTeamTransaction)}`,
      icon: Target,
      color: 'text-blue-400',
      bgColor: 'bg-brand-green/20',
    },
    {
      label: 'Top Performer',
      value: stats.topPerformer.name,
      subValue: `${formatCurrency(stats.topPerformer.amount)} (${stats.topPerformer.percentOfTotal}% of total)`,
      icon: Trophy,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-8 p-8">
      {statCards.map((card, index) => (
        <div
          key={card.label}
          className="bg-zinc-800/80 rounded-2xl p-8 border border-zinc-700 animate-slideUp"
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg text-neutral-500 font-medium">{card.label}</p>
              <p className={cn('text-5xl font-bold mt-2', card.color)}>{card.value}</p>
              <p className="text-lg text-neutral-500 mt-2">{card.subValue}</p>
            </div>
            <div className={cn('p-4 rounded-xl', card.bgColor)}>
              <card.icon className={cn('h-10 w-10', card.color)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Goals Display Component
// =============================================================================

function GoalsDisplay({ stats }: { stats: MeetingStats | null }) {
  if (!stats) return null;

  const goals = [
    {
      label: 'Weekly Goal',
      target: stats.goals.weeklyTarget,
      progress: stats.goals.weeklyProgress,
      color: 'bg-lime-500',
    },
    {
      label: 'Monthly Goal',
      target: stats.goals.monthlyTarget,
      progress: stats.goals.monthlyProgress,
      color: 'bg-brand-green',
    },
    {
      label: 'Yearly Goal',
      target: stats.goals.yearlyTarget,
      progress: stats.goals.yearlyProgress,
      color: 'bg-purple-500',
    },
  ];

  return (
    <div className="space-y-12 p-8">
      <h2 className="text-4xl font-bold text-center text-white flex items-center justify-center gap-4">
        <Target className="h-10 w-10 text-lime-400" />
        Goal Progress
      </h2>
      {goals.map((goal, index) => (
        <div
          key={goal.label}
          className="bg-zinc-800/80 rounded-2xl p-8 border border-zinc-700 animate-slideUp"
          style={{ animationDelay: `${index * 0.15}s` }}
        >
          <div className="flex justify-between items-center mb-4">
            <span className="text-2xl font-semibold text-white">{goal.label}</span>
            <span className="text-2xl font-bold text-neutral-500">
              Target: {formatCurrency(goal.target)}
            </span>
          </div>
          <div className="relative h-12 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-1000', goal.color)}
              style={{ width: `${Math.min(goal.progress, 100)}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-white drop-shadow-lg">
                {goal.progress.toFixed(1)}%
              </span>
            </div>
          </div>
          {goal.progress >= 100 && (
            <div className="mt-4 text-center">
              <span className="inline-flex items-center gap-2 text-lime-400 text-xl">
                <Star className="h-6 w-6 animate-pulse" />
                Goal Achieved!
                <Star className="h-6 w-6 animate-pulse" />
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Milestones Display Component
// =============================================================================

function MilestonesDisplay({ stats }: { stats: MeetingStats | null }) {
  if (!stats || stats.milestones.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Zap className="h-24 w-24 text-neutral-400 mx-auto mb-4" />
          <p className="text-2xl text-neutral-500">No new milestones this period</p>
          <p className="text-lg text-neutral-400 mt-2">Keep pushing for those achievements!</p>
        </div>
      </div>
    );
  }

  const typeIcons: Record<string, React.ReactNode> = {
    achievement: <Award className="h-12 w-12 text-yellow-400" />,
    record: <Trophy className="h-12 w-12 text-lime-400" />,
    streak: <Flame className="h-12 w-12 text-orange-400" />,
  };

  return (
    <div className="space-y-8 p-8">
      <h2 className="text-4xl font-bold text-center text-white flex items-center justify-center gap-4">
        <Zap className="h-10 w-10 text-yellow-400" />
        Recent Milestones
      </h2>
      <div className="grid gap-6">
        {stats.milestones.map((milestone, index) => (
          <div
            key={index}
            className="bg-zinc-800/80 rounded-2xl p-8 border border-zinc-700 flex items-center gap-8 animate-slideUp"
            style={{ animationDelay: `${index * 0.15}s` }}
          >
            <div className="p-4 bg-zinc-700/50 rounded-xl">
              {typeIcons[milestone.type] || <Star className="h-12 w-12 text-neutral-500" />}
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">{milestone.title}</h3>
              <p className="text-xl text-neutral-500 mt-1">{milestone.description}</p>
              {milestone.rep && (
                <p className="text-lg text-lime-400 mt-2">{milestone.rep}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Announcements Display Component
// =============================================================================

function AnnouncementsDisplay({ announcements, type }: { announcements: AnnouncementItem[]; type: 'early' | 'late' }) {
  const isEarly = type === 'early';

  if (announcements.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Megaphone className="h-24 w-24 text-neutral-400 mx-auto mb-4" />
          <p className="text-2xl text-neutral-500">No {isEarly ? 'early' : 'late'} announcements</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8">
      <h2 className="text-4xl font-bold text-center text-white flex items-center justify-center gap-4">
        <Megaphone className={cn('h-10 w-10', isEarly ? 'text-amber-400' : 'text-purple-400')} />
        {isEarly ? 'Announcements' : 'Additional Announcements'}
      </h2>
      <div className="grid gap-6 max-w-4xl mx-auto">
        {announcements.map((item, index) => (
          <div
            key={item.id}
            className="bg-zinc-800/80 rounded-2xl p-8 border border-zinc-700 animate-slideUp"
            style={{ animationDelay: `${index * 0.12}s` }}
          >
            <div className="flex items-start gap-6">
              <div className={cn(
                'p-4 rounded-xl flex-shrink-0',
                isEarly ? 'bg-amber-500/20' : 'bg-purple-500/20'
              )}>
                <Megaphone className={cn('h-8 w-8', isEarly ? 'text-amber-400' : 'text-purple-400')} />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-white mb-2">{item.title}</h3>
                <p className="text-lg text-neutral-400 mb-3">{item.content}</p>
                {item.highlights && item.highlights.length > 0 && (
                  <ul className="space-y-2 mb-3">
                    {item.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-lime-400">
                        <Star className="h-5 w-5 mt-0.5 flex-shrink-0" />
                        <span className="text-lg">{h}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center gap-4 text-neutral-500">
                  <span className="text-base">— {item.userName}</span>
                  {item.displayDuration && item.displayDuration !== 'one-time' && (
                    <span className="px-3 py-1 rounded-full bg-zinc-700 text-xs text-neutral-400">
                      {item.displayDuration}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Weekly Numbers Display Component
// =============================================================================

function WeeklyNumbersDisplay({ numbers }: { numbers: WeeklyNumbersRep[] }) {
  if (numbers.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Users className="h-24 w-24 text-neutral-400 mx-auto mb-4" />
          <p className="text-2xl text-neutral-500">No weekly numbers submitted yet</p>
        </div>
      </div>
    );
  }

  // Sort by revenue closed descending
  const sorted = [...numbers].sort((a, b) => b.revenueClosed - a.revenueClosed);

  return (
    <div className="space-y-6 p-8">
      <h2 className="text-4xl font-bold text-center text-white flex items-center justify-center gap-4">
        <TrendingUp className="h-10 w-10 text-lime-400" />
        Weekly Sales Numbers
      </h2>
      <div className="bg-zinc-800/80 rounded-2xl border border-zinc-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-900/50">
            <tr>
              <th className="px-6 py-4 text-left text-lg font-semibold text-neutral-500">Rep</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-neutral-500">Doors</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-neutral-500">Appts</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-neutral-500">Inspections</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-neutral-500">Estimates</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-neutral-500">Contracts</th>
              <th className="px-6 py-4 text-right text-lg font-semibold text-neutral-500">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((rep, index) => (
              <tr
                key={rep.repEmail}
                className="border-t border-zinc-700/50 animate-slideUp"
                style={{ animationDelay: `${index * 0.06}s` }}
              >
                <td className="px-6 py-4">
                  <span className="text-xl font-semibold text-white">{rep.repName}</span>
                </td>
                <td className="px-4 py-4 text-center text-xl text-neutral-400">{rep.doorsKnocked}</td>
                <td className="px-4 py-4 text-center text-xl text-neutral-400">{rep.appointmentsSet}</td>
                <td className="px-4 py-4 text-center text-xl text-neutral-400">{rep.inspectionsCompleted}</td>
                <td className="px-4 py-4 text-center text-xl text-neutral-400">{rep.estimatesGiven}</td>
                <td className="px-4 py-4 text-center">
                  <span className={cn(
                    'text-xl font-bold',
                    rep.contractsSigned > 0 ? 'text-lime-400' : 'text-neutral-500'
                  )}>
                    {rep.contractsSigned}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-2xl font-bold text-lime-400">
                    {rep.revenueClosed > 0 ? formatCurrency(rep.revenueClosed) : '$0'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-zinc-900/50 border-t border-zinc-700">
            <tr>
              <td className="px-6 py-4 text-lg font-bold text-white">Team Total</td>
              <td className="px-4 py-4 text-center text-lg font-bold text-white">
                {sorted.reduce((s, r) => s + r.doorsKnocked, 0)}
              </td>
              <td className="px-4 py-4 text-center text-lg font-bold text-white">
                {sorted.reduce((s, r) => s + r.appointmentsSet, 0)}
              </td>
              <td className="px-4 py-4 text-center text-lg font-bold text-white">
                {sorted.reduce((s, r) => s + r.inspectionsCompleted, 0)}
              </td>
              <td className="px-4 py-4 text-center text-lg font-bold text-white">
                {sorted.reduce((s, r) => s + r.estimatesGiven, 0)}
              </td>
              <td className="px-4 py-4 text-center text-lg font-bold text-lime-400">
                {sorted.reduce((s, r) => s + r.contractsSigned, 0)}
              </td>
              <td className="px-6 py-4 text-right text-2xl font-bold text-lime-400">
                {formatCurrency(sorted.reduce((s, r) => s + r.revenueClosed, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// =============================================================================
// Leaderboard Table Component
// =============================================================================

function LeaderboardTable({ leaderboard, period }: { leaderboard: RepStats[]; period: 'week' | 'month' | 'ytd' }) {
  const getValue = (rep: RepStats) => {
    switch (period) {
      case 'week':
        return rep.weeklyCommissions;
      case 'month':
        return rep.monthlyCommissions;
      case 'ytd':
        return rep.ytdCommissions;
      default:
        return rep.totalCommissions;
    }
  };

  return (
    <div className="bg-zinc-800/80 rounded-2xl border border-zinc-700 overflow-hidden">
      <table className="w-full">
        <thead className="bg-zinc-900/50">
          <tr>
            <th className="px-6 py-4 text-left text-lg font-semibold text-neutral-500">Rank</th>
            <th className="px-6 py-4 text-left text-lg font-semibold text-neutral-500">Rep</th>
            <th className="px-6 py-4 text-right text-lg font-semibold text-neutral-500">
              {period === 'week' ? 'Weekly' : period === 'month' ? 'Monthly' : 'YTD'}
            </th>
            <th className="px-6 py-4 text-right text-lg font-semibold text-neutral-500">All Time</th>
            <th className="px-6 py-4 text-right text-lg font-semibold text-neutral-500">Deals</th>
            <th className="px-6 py-4 text-center text-lg font-semibold text-neutral-500">Status</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((rep, index) => (
            <tr
              key={rep.name}
              className={cn(
                'border-t border-zinc-700/50 animate-slideUp',
                rep.isTopPerformer && 'bg-zinc-800/50'
              )}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  {rep.rank === 1 && <Crown className="h-6 w-6 text-yellow-400" />}
                  {rep.rank === 2 && <Medal className="h-6 w-6 text-neutral-500" />}
                  {rep.rank === 3 && <Award className="h-6 w-6 text-orange-500" />}
                  <span
                    className={cn(
                      'text-2xl font-bold',
                      rep.rank === 1 && 'text-yellow-400',
                      rep.rank === 2 && 'text-neutral-500',
                      rep.rank === 3 && 'text-orange-500',
                      rep.rank > 3 && 'text-neutral-500'
                    )}
                  >
                    #{rep.rank}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center text-lg font-bold text-white',
                      rep.avatarColor
                    )}
                  >
                    {rep.initials}
                  </div>
                  <div>
                    <span className="text-xl font-semibold text-white">{rep.name}</span>
                    <div className="flex gap-1 mt-1">
                      {rep.achievements.slice(0, 3).map((a) => (
                        <span key={a.id} title={a.name} className="text-lg">
                          {a.icon}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-right">
                <span className="text-2xl font-bold text-lime-400">{formatCurrency(getValue(rep))}</span>
              </td>
              <td className="px-6 py-4 text-right">
                <span className="text-xl text-neutral-400">{formatCurrency(rep.totalCommissions)}</span>
              </td>
              <td className="px-6 py-4 text-right">
                <span className="text-xl text-neutral-500">{rep.totalTransactions.toLocaleString()}</span>
              </td>
              <td className="px-6 py-4 text-center">
                {rep.streak === 'hot' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full">
                    <Flame className="h-5 w-5 animate-pulse" />
                    Hot
                  </span>
                )}
                {rep.streak === 'cold' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-brand-green/20 text-blue-400 rounded-full">
                    <Snowflake className="h-5 w-5" />
                    Cold
                  </span>
                )}
                {rep.streak === 'neutral' && (
                  <span className="inline-flex items-center px-3 py-1 bg-gray-400/20 text-neutral-400 rounded-full">
                    Steady
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// Main Presentation Page Component
// =============================================================================

export default function MeetingPresentationPage() {
  const router = useRouter();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [statsData, setStatsData] = useState<MeetingStats | null>(null);
  const [announcementsData, setAnnouncementsData] = useState<AnnouncementsData | null>(null);
  const [weeklyNumbers, setWeeklyNumbers] = useState<WeeklyNumbersRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [trainingTopic, setTrainingTopic] = useState<{ title: string; presenter: string; content: string; videoUrl?: string }>({ title: '', presenter: '', content: '' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [weatherData, setWeatherData] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [prepData, setPrepData] = useState<any>(null);
  const [period, setPeriod] = useState<'week' | 'month' | 'ytd'>('week');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [projectionsData, setProjectionsData] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('date-header');
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('year');

  const containerRef = useRef<HTMLDivElement>(null);
  const autoRotateRef = useRef<NodeJS.Timeout | null>(null);

  const views: ViewMode[] = ['date-header', 'bible-verse', 'training', 'weather', 'attendance', 'early-announcements', 'enter-numbers', 'weekly-numbers', 'projections', 'podium', 'leaderboard', 'competition', 'stats', 'sales-charts', 'commission-charts', 'goals', 'milestones', 'office-bonus', 'late-announcements'];

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      // Map presentation period names to leaderboard API period names
      const leaderboardPeriod = period === 'week' ? 'thisWeek' : period === 'month' ? 'thisMonth' : 'thisYear';
      const [leaderboardRes, statsRes, announcementsRes, weeklyRes] = await Promise.all([
        fetch(`/api/command-center/meetings/leaderboard?animate=true&period=${leaderboardPeriod}`),
        fetch(`/api/command-center/meetings/stats?period=${period}`),
        fetch('/api/portal/monday-notes/announcements').catch(() => null),
        fetch('/api/portal/weekly-numbers?allReps=true').catch(() => null),
      ]);

      if (!leaderboardRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [leaderboardJson, statsJson] = await Promise.all([
        leaderboardRes.json(),
        statsRes.json(),
      ]);

      if (leaderboardJson.success) {
        setLeaderboardData(leaderboardJson.data);

        // Trigger confetti for celebrations
        if (leaderboardJson.data.celebrationTriggers?.length > 0) {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 4000);
        }
      }

      if (statsJson.success) {
        setStatsData(statsJson.data);
      }

      // Fetch announcements
      if (announcementsRes?.ok) {
        const announcementsJson = await announcementsRes.json();
        if (announcementsJson.success) {
          setAnnouncementsData(announcementsJson.announcements);
        }
      }

      // Fetch weekly numbers
      if (weeklyRes?.ok) {
        const weeklyJson = await weeklyRes.json();
        if (weeklyJson.success) {
          setWeeklyNumbers(weeklyJson.records || []);
        }
      }

      // Fetch meeting prep data for training topic and bible verse
      try {
        const prepRes = await fetch('/api/command-center/meetings/prep');
        if (prepRes.ok) {
          const prepJson = await prepRes.json();
          if (prepJson.data) {
            setPrepData(prepJson.data);
            if (prepJson.data.trainingTopic) {
              setTrainingTopic({
                title: prepJson.data.trainingTopic || '',
                presenter: prepJson.data.preparedBy || '',
                content: prepJson.data.specialNotes || '',
              });
            }
          }
        }
      } catch { /* optional */ }

      // Fetch weather data for weather slide
      try {
        const weatherRes = await fetch('/api/command-center/meetings/weather');
        if (weatherRes.ok) {
          const weatherJson = await weatherRes.json();
          if (weatherJson.success && weatherJson.data) {
            setWeatherData(weatherJson.data);
          }
        }
      } catch { /* optional */ }

      // Fetch chart data for sales/commission chart slides
      try {
        const chartRes = await fetch(`/api/command-center/meetings/charts?period=${chartPeriod}`);
        if (chartRes.ok) {
          const chartJson = await chartRes.json();
          if (chartJson.success && chartJson.data) {
            setChartData(chartJson.data);
          }
        }
      } catch { /* optional */ }

      // Fetch projections for each active sales rep
      try {
        const activeReps = ['Aaron', 'Brendon', 'Greg', 'Hunter', 'Adam', 'Joseph', 'Alijah', 'Travis', 'Rick'];
        const projResults = await Promise.allSettled(
          activeReps.map(rep =>
            fetch(`/api/command-center/meetings/predictions?rep=${rep}&goal=5`)
              .then(r => r.json())
              .then(j => j.success ? { rep, ...j.data } : null)
          )
        );
        const projections = projResults
          .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value !== null)
          .map(r => r.value)
          .filter(Boolean);
        setProjectionsData(projections);
      } catch { /* optional */ }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [period, chartPeriod]);

  // Sync meeting numbers from Google Sheet, then refresh data
  const syncFromSheet = useCallback(async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/command-center/meetings/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: new Date().getFullYear() }),
      });
      const json = await res.json();
      if (json.success) {
        setSyncMessage(`Synced ${json.data?.recordCount || 0} records from Google Sheet`);
        // Refresh display data after successful sync
        fetchData();
      } else {
        setSyncMessage(`Sync failed: ${json.error || 'Unknown error'}`);
      }
    } catch (err) {
      setSyncMessage(`Sync error: ${err instanceof Error ? err.message : 'Network error'}`);
    } finally {
      setIsSyncing(false);
      // Clear message after 5 seconds
      setTimeout(() => setSyncMessage(null), 5000);
    }
  }, [fetchData]);

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchData();
    const refreshInterval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(refreshInterval);
  }, [fetchData]);

  // Auto-rotate views
  useEffect(() => {
    if (isAutoRotating) {
      autoRotateRef.current = setInterval(() => {
        setViewMode((current) => {
          const currentIndex = views.indexOf(current);
          return views[(currentIndex + 1) % views.length];
        });
      }, 15000); // Change view every 15 seconds
    }

    return () => {
      if (autoRotateRef.current) {
        clearInterval(autoRotateRef.current);
      }
    };
  }, [isAutoRotating]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Navigate views
  const goToPrevView = () => {
    const currentIndex = views.indexOf(viewMode);
    setViewMode(views[(currentIndex - 1 + views.length) % views.length]);
  };

  const goToNextView = () => {
    const currentIndex = views.indexOf(viewMode);
    setViewMode(views[(currentIndex + 1) % views.length]);
  };

  // Render view content
  const renderViewContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <RefreshCw className="h-16 w-16 text-lime-400 animate-spin" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-2xl text-red-400">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-6 py-3 bg-lime-500 text-black rounded-lg hover:bg-lime-400"
          >
            Retry
          </button>
        </div>
      );
    }

    // HARD RULE: Filter Michael, Chris, Sara from all leaderboard/competition data
    const NON_SALES = ['michael', 'chris', 'sara', 'michael muse', 'chris muse', 'sara hill'];
    const filterNonSales = (reps: RepStats[]) => reps.filter(r => !NON_SALES.some(n => r.name.toLowerCase().includes(n)));
    const filteredLeaderboard = leaderboardData ? { ...leaderboardData, leaderboard: filterNonSales(leaderboardData.leaderboard) } : null;

    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    switch (viewMode) {
      case 'date-header':
        return (
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <h1 className="text-7xl font-bold text-white mb-4 animate-slideUp">Monday Meeting</h1>
            <p className="text-4xl text-lime-400 animate-slideUp" style={{ animationDelay: '0.2s' }}>{dateStr}</p>
            <p className="text-2xl text-neutral-500 mt-4 animate-slideUp" style={{ animationDelay: '0.4s' }}>River City Roofing & Solar</p>
          </div>
        );
      case 'bible-verse':
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] space-y-8 p-8">
            <BookOpen className="h-16 w-16 text-lime-400" />
            <blockquote className="text-4xl text-white italic text-center max-w-4xl leading-relaxed">
              &ldquo;{prepData?.bibleVerse?.text || 'Loading...'}&rdquo;
            </blockquote>
            <p className="text-2xl text-lime-400">{prepData?.bibleVerse?.reference}</p>
            {prepData?.bibleVerse?.theme && (
              <span className="px-4 py-2 rounded-full bg-zinc-800 text-zinc-400">{prepData.bibleVerse.theme}</span>
            )}
            {!prepData?.bibleVerse && (
              <p className="text-lg text-zinc-500">Set the Bible verse in Meeting Prep</p>
            )}
          </div>
        );
      case 'training':
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] space-y-8 p-8">
            <div className="w-20 h-20 bg-blue-500/20 rounded-2xl flex items-center justify-center">
              <Zap className="h-12 w-12 text-blue-400" />
            </div>
            <h2 className="text-5xl font-bold text-white text-center">{trainingTopic.title || 'Training Topic'}</h2>
            {trainingTopic.presenter && <p className="text-2xl text-neutral-400">Presented by: {trainingTopic.presenter}</p>}
            {trainingTopic.content && <p className="text-xl text-neutral-500 max-w-3xl text-center">{trainingTopic.content}</p>}
            {trainingTopic.videoUrl && (
              <div className="w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden">
                <iframe src={trainingTopic.videoUrl} className="w-full h-full" allowFullScreen />
              </div>
            )}
            {!trainingTopic.title && (
              <div className="text-center">
                <p className="text-xl text-neutral-500">Configure training topic in Meeting Prep</p>
                <p className="text-sm text-neutral-600 mt-2">Go to /command-center/meetings/prep to set the training topic</p>
              </div>
            )}
          </div>
        );
      case 'weather':
        return (
          <div className="space-y-6 p-8">
            <h2 className="text-4xl font-bold text-center text-white">This Week&apos;s Weather</h2>
            <p className="text-xl text-center text-zinc-400">{weatherData?.location || 'Decatur, AL'}</p>

            {/* Current conditions */}
            {weatherData?.current && (
              <div className="flex items-center justify-center gap-8 bg-zinc-800/80 rounded-2xl p-6 border border-zinc-700 max-w-2xl mx-auto">
                <div className="text-6xl font-bold text-white">{weatherData.current.temperature}°F</div>
                <div>
                  <p className="text-2xl text-zinc-300">{weatherData.current.condition}</p>
                  <p className="text-zinc-500">Feels like {weatherData.current.feelsLike}°F</p>
                  <p className="text-zinc-500">Humidity: {weatherData.current.humidity}% | Wind: {weatherData.current.windSpeed} mph</p>
                </div>
              </div>
            )}

            {/* 7-day forecast grid */}
            {weatherData?.weekForecast && weatherData.weekForecast.length > 0 && (
              <div className="grid grid-cols-7 gap-3 max-w-5xl mx-auto">
                {weatherData.weekForecast.map((day: { date: string; dayName: string; high: number; low: number; description: string; precipChance: number; isWorkDay: boolean }) => (
                  <div key={day.date} className={cn(
                    'rounded-xl p-4 text-center border',
                    day.isWorkDay ? 'bg-lime-500/10 border-lime-500/30' : 'bg-red-500/10 border-red-500/30'
                  )}>
                    <p className="text-sm font-bold text-zinc-300">{day.dayName}</p>
                    <p className="text-2xl font-bold text-white mt-1">{day.high}°</p>
                    <p className="text-sm text-zinc-500">{day.low}°</p>
                    <p className="text-xs text-zinc-400 mt-1">{day.description}</p>
                    {day.precipChance > 0 && (
                      <p className="text-xs text-blue-400 mt-1">{day.precipChance}% rain</p>
                    )}
                    <p className={cn('text-xs font-bold mt-2', day.isWorkDay ? 'text-lime-400' : 'text-red-400')}>
                      {day.isWorkDay ? '\u2713 Work' : '\u2717 No-Go'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Workable days summary */}
            <div className="text-center">
              <span className="text-xl text-lime-400 font-bold">{weatherData?.workableDays || 0} workable days</span>
              <span className="text-zinc-500 text-xl"> this week for installations</span>
            </div>

            {/* Alerts if any */}
            {weatherData?.alerts && weatherData.alerts.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 max-w-3xl mx-auto">
                {weatherData.alerts.map((alert: { event?: string; headline?: string; description?: string }, i: number) => (
                  <p key={i} className="text-red-400 font-medium">{alert.event || alert.headline}: {alert.description}</p>
                ))}
              </div>
            )}

            {!weatherData && (
              <div className="text-center text-zinc-500 text-xl">Loading weather data...</div>
            )}
          </div>
        );
      case 'attendance':
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] space-y-8 p-8">
            <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center animate-pulse">
              <Users className="h-14 w-14 text-red-400" />
            </div>
            <h2 className="text-5xl font-bold text-white text-center">Attendance is MANDATORY!</h2>
            <p className="text-3xl text-neutral-300">Meetings are Mondays at 10:00 AM</p>
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-3xl">
              <p className="text-2xl text-red-400 text-center font-semibold">
                If you are late or have an unexcused absence, you will NOT be on lead rotation for that week.
              </p>
            </div>
          </div>
        );
      case 'early-announcements':
        return <AnnouncementsDisplay announcements={announcementsData?.early || []} type="early" />;
      case 'enter-numbers':
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] space-y-8 p-8">
            <div className="w-24 h-24 bg-lime-500/20 rounded-full flex items-center justify-center animate-pulse">
              <Target className="h-14 w-14 text-lime-400" />
            </div>
            <h2 className="text-5xl font-bold text-white text-center">Enter Your Numbers NOW</h2>
            <p className="text-3xl text-neutral-300">Open <span className="text-lime-400 font-bold">rcrsal.com</span> on your phone</p>
            <div className="bg-zinc-800/80 rounded-2xl p-8 border border-zinc-700 max-w-3xl">
              <div className="space-y-4 text-xl text-neutral-300">
                <p className="flex items-center gap-3"><span className="w-10 h-10 bg-lime-500 text-black rounded-full flex items-center justify-center font-bold text-lg">1</span> Log in with your @rcrsal.com email</p>
                <p className="flex items-center gap-3"><span className="w-10 h-10 bg-lime-500 text-black rounded-full flex items-center justify-center font-bold text-lg">2</span> Tap <span className="text-lime-400 font-semibold">&quot;Enter Weekly Numbers&quot;</span> on your dashboard</p>
                <p className="flex items-center gap-3"><span className="w-10 h-10 bg-lime-500 text-black rounded-full flex items-center justify-center font-bold text-lg">3</span> Fill in: Inspected, Damage, Signed, Repair, Gutter, $$$$$</p>
                <p className="flex items-center gap-3"><span className="w-10 h-10 bg-lime-500 text-black rounded-full flex items-center justify-center font-bold text-lg">4</span> Hit <span className="text-lime-400 font-semibold">Save</span> — leaderboard updates instantly</p>
              </div>
            </div>
            <p className="text-2xl text-yellow-400 font-semibold animate-pulse">Numbers reset at 11 AM — enter them NOW!</p>
          </div>
        );
      case 'projections':
        return (
          <div className="space-y-6 p-8">
            <h2 className="text-4xl font-bold text-center text-white flex items-center justify-center gap-4">
              <TrendingUp className="h-10 w-10 text-lime-400" />
              Estimated Weekly Projections
            </h2>
            <p className="text-center text-neutral-400 text-lg">Based on your actual historical inspection-to-commission ratio</p>
            {projectionsData.length > 0 ? (
              <div className="bg-zinc-800/80 rounded-2xl border border-zinc-700 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-zinc-900/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-lg font-semibold text-neutral-500">Rep</th>
                      <th className="px-4 py-4 text-center text-sm font-semibold text-neutral-500">Avg Inspected</th>
                      <th className="px-4 py-4 text-center text-sm font-semibold text-neutral-500">Goal</th>
                      <th className="px-4 py-4 text-center text-sm font-semibold text-neutral-500">Est. Signed</th>
                      <th className="px-6 py-4 text-right text-lg font-semibold text-neutral-500">Est. Revenue</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-neutral-500">Monthly Proj.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectionsData
                      .sort((a, b) => (b.prediction?.predicted?.revenue || 0) - (a.prediction?.predicted?.revenue || 0))
                      .map((proj, index) => {
                        const stats = proj.repStats;
                        const pred = proj.prediction;
                        const actualAvgInspected = stats?.averages?.inspected || 0;
                        const goalAvg = stats?.averages?.goal || 5;
                        const useRealistic = Math.min(actualAvgInspected, goalAvg);
                        return (
                          <tr key={proj.rep} className="border-t border-zinc-700/50 animate-slideUp" style={{ animationDelay: `${index * 0.06}s` }}>
                            <td className="px-6 py-4"><span className="text-xl font-semibold text-white">{proj.rep}</span></td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-xl text-neutral-400">{actualAvgInspected.toFixed(1)}</span>
                              {actualAvgInspected < goalAvg && <span className="text-xs text-yellow-400 block">vs {goalAvg.toFixed(0)} goal</span>}
                            </td>
                            <td className="px-4 py-4 text-center text-xl text-neutral-400">{goalAvg.toFixed(0)}</td>
                            <td className="px-4 py-4 text-center text-xl text-lime-400 font-bold">{pred?.predicted?.signed?.toFixed(1) || '—'}</td>
                            <td className="px-6 py-4 text-right"><span className="text-2xl font-bold text-lime-400">{pred?.predicted?.revenue ? formatCurrency(pred.predicted.revenue) : '—'}</span></td>
                            <td className="px-6 py-4 text-right"><span className="text-lg text-neutral-400">{pred?.monthlyProjection?.revenue ? formatCurrency(pred.monthlyProjection.revenue) : '—'}</span></td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-neutral-500">
                <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-2xl">Loading projections from historical data...</p>
              </div>
            )}
          </div>
        );
      case 'podium':
        return filteredLeaderboard && <PodiumDisplay leaderboard={filteredLeaderboard.leaderboard} period={period} />;
      case 'leaderboard':
        return filteredLeaderboard && <LeaderboardTable leaderboard={filteredLeaderboard.leaderboard} period={period} />;
      case 'competition':
        return filteredLeaderboard ? (
          <SalesCompetitionPresentation
            reps={filteredLeaderboard.leaderboard.map(rep => {
              const competitionPeriod = getCurrentPeriod();
              const periodTotal = competitionPeriod.half === 1
                ? rep.ytdCommissions
                : rep.totalCommissions - (rep.ytdCommissions - rep.monthlyCommissions);
              return {
                name: rep.name,
                periodTotal: competitionPeriod.half === 1 ? rep.ytdCommissions : rep.monthlyCommissions * 6,
                monthlyTotal: rep.monthlyCommissions,
              };
            })}
          />
        ) : null;
      case 'weekly-numbers':
        return <WeeklyNumbersDisplay numbers={weeklyNumbers} />;
      case 'stats':
        return <StatsDisplay stats={statsData} leaderboard={filteredLeaderboard} />;
      case 'sales-charts':
        return (
          <div>
            <div className="flex justify-center gap-2 mb-4">
              {(['week', 'month', 'quarter', 'year'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setChartPeriod(p)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                    chartPeriod === p ? 'bg-lime-500 text-black' : 'bg-zinc-800 text-neutral-500 hover:text-white'
                  }`}
                >
                  {p === 'week' ? 'Weekly' : p === 'month' ? 'Monthly' : p === 'quarter' ? 'Quarterly' : 'Yearly'}
                </button>
              ))}
            </div>
            <SalesChartsSlide data={chartData} />
          </div>
        );
      case 'commission-charts':
        return (
          <div>
            <div className="flex justify-center gap-2 mb-4">
              {(['week', 'month', 'quarter', 'year'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setChartPeriod(p)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                    chartPeriod === p ? 'bg-lime-500 text-black' : 'bg-zinc-800 text-neutral-500 hover:text-white'
                  }`}
                >
                  {p === 'week' ? 'Weekly' : p === 'month' ? 'Monthly' : p === 'quarter' ? 'Quarterly' : 'Yearly'}
                </button>
              ))}
            </div>
            <CommissionChartsSlide data={chartData} />
          </div>
        );
      case 'goals':
        return <GoalsDisplay stats={statsData} />;
      case 'milestones':
        return <MilestonesDisplay stats={statsData} />;
      case 'office-bonus':
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] space-y-8 p-8">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
              <DollarSign className="h-12 w-12 text-emerald-400" />
            </div>
            <h2 className="text-4xl font-bold text-white text-center">Office Bonus Structure</h2>
            <div className="bg-zinc-800/80 rounded-2xl p-8 border border-zinc-700 max-w-3xl">
              <p className="text-2xl text-lime-400 text-center font-semibold mb-6">
                IF INSPECTORS SELL OVER $1,000,000 IN A QUARTER:
              </p>
              <p className="text-xl text-neutral-300 text-center mb-4">
                Per every $100,000 over $1,000,000:
              </p>
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                <div className="text-right text-lg text-neutral-400">Sara &amp; Destin:</div>
                <div className="text-left text-lg text-lime-400 font-bold">$200 bonus each</div>
                <div className="text-right text-lg text-neutral-400">Tia:</div>
                <div className="text-left text-lg text-lime-400 font-bold">$100 bonus</div>
              </div>
            </div>
          </div>
        );
      case 'late-announcements':
        return <AnnouncementsDisplay announcements={announcementsData?.late || []} type="late" />;
      default:
        return null;
    }
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 text-white"
    >
      <Confetti active={showConfetti} />

      {/* Header Controls */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-800">
        <div className="flex items-center justify-between px-6 py-4">
          {/* Left: Back and Title */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/command-center/meetings')}
              className="p-2 hover:bg-zinc-800 rounded-lg transition"
            >
              <X className="h-6 w-6" />
            </button>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Trophy className="h-8 w-8 text-lime-400" />
              Monday Meeting Dashboard
            </h1>
          </div>

          {/* Center: Period Toggle */}
          <div className="flex gap-2 bg-zinc-800 p-1 rounded-lg">
            {(['week', 'month', 'ytd'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md transition',
                  period === p ? 'bg-lime-500 text-black' : 'text-neutral-500 hover:text-white'
                )}
              >
                {p === 'week' ? 'Weekly' : p === 'month' ? 'Monthly' : 'YTD'}
              </button>
            ))}
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAutoRotating(!isAutoRotating)}
              className={cn(
                'p-2 rounded-lg transition',
                isAutoRotating ? 'bg-lime-500/20 text-lime-400' : 'bg-zinc-800 text-neutral-500'
              )}
              title={isAutoRotating ? 'Pause auto-rotate' : 'Resume auto-rotate'}
            >
              {isAutoRotating ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button
              onClick={syncFromSheet}
              disabled={isSyncing}
              className={cn(
                'p-2 rounded-lg transition',
                isSyncing ? 'bg-lime-500/20 text-lime-400' : 'bg-zinc-800 hover:bg-zinc-700'
              )}
              title="Sync from Google Sheet"
            >
              <DownloadCloud className={cn('h-5 w-5', isSyncing && 'animate-pulse')} />
            </button>
            <button
              onClick={fetchData}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition"
              title="Refresh data"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Sync Status Toast */}
        {syncMessage && (
          <div className={cn(
            'text-center text-sm py-1 px-4 rounded-lg mx-auto max-w-lg transition-opacity',
            syncMessage.includes('failed') || syncMessage.includes('error')
              ? 'bg-red-500/20 text-red-400'
              : 'bg-lime-500/20 text-lime-400'
          )}>
            {syncMessage}
          </div>
        )}

        {/* View Selector */}
        <div className="flex items-center justify-center gap-4 pb-4">
          <button
            onClick={goToPrevView}
            className="p-2 hover:bg-zinc-800 rounded-full transition"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="flex gap-2 flex-wrap justify-center">
            {views.map((v) => {
              const viewLabels: Record<ViewMode, string> = {
                'date-header': '📅 Date',
                'bible-verse': '📖 Verse',
                'training': '🎓 Training',
                'weather': '🌤️ Weather',
                'attendance': '⚠️ Attendance',
                'early-announcements': '📢 Announcements',
                'podium': '🏆 Podium',
                'leaderboard': '📊 Leaderboard',
                'competition': '🏅 Competition',
                'weekly-numbers': '📈 Weekly Numbers',
                'stats': '💰 Stats',
                'sales-charts': '📊 Sales Charts',
                'commission-charts': '💵 Commission Charts',
                'goals': '🎯 Goals',
                'milestones': '⚡ Milestones',
                'office-bonus': '💵 Office Bonus',
                'enter-numbers': '✏️ Enter Numbers',
                'projections': '🔮 Projections',
                'late-announcements': '📣 Late Announcements',
              };
              return (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-lg transition',
                    viewMode === v ? 'bg-lime-500 text-black' : 'bg-zinc-800 text-neutral-500 hover:text-white'
                  )}
                >
                  {viewLabels[v]}
                </button>
              );
            })}
          </div>
          <button
            onClick={goToNextView}
            className="p-2 hover:bg-zinc-800 rounded-full transition"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="pt-36 pb-8 px-8 min-h-screen">
        {renderViewContent()}
      </main>

      {/* Footer Stats Bar */}
      {leaderboardData && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/90 backdrop-blur-sm border-t border-zinc-800 py-3 px-6">
          <div className="flex items-center justify-around text-center">
            <div>
              <p className="text-sm text-neutral-500">Weekly Revenue</p>
              <p className="text-xl font-bold text-blue-400">
                {formatCurrency(leaderboardData.summary.weeklyTotal)}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">Monthly Revenue</p>
              <p className="text-xl font-bold text-purple-400">
                {formatCurrency(leaderboardData.summary.monthlyTotal)}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">YTD Revenue</p>
              <p className="text-xl font-bold text-yellow-400">
                {formatCurrency(leaderboardData.summary.ytdTotal)}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">All-Time Revenue</p>
              <p className="text-xl font-bold text-lime-400">
                {formatLargeCurrency(leaderboardData.summary.totalTeamCommissions)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CSS for animations */}
      <style jsx global>{`
        @keyframes confetti {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti 4s ease-out forwards;
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideUp {
          animation: slideUp 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
