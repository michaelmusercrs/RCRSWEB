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
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

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

type ViewMode = 'leaderboard' | 'stats' | 'podium' | 'goals' | 'milestones';

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

function PodiumDisplay({ leaderboard }: { leaderboard: RepStats[] }) {
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
            <p className="text-4xl font-bold text-lime-400 mt-2">{formatCurrency(rep.totalCommissions)}</p>
            <p className="text-lg text-neutral-500">{rep.totalTransactions.toLocaleString()} transactions</p>
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
      label: 'Total Team Commissions',
      value: formatLargeCurrency(leaderboard.summary.totalTeamCommissions),
      subValue: `${leaderboard.summary.totalTransactions.toLocaleString()} transactions`,
      icon: DollarSign,
      color: 'text-lime-400',
      bgColor: 'bg-lime-500/20',
    },
    {
      label: `${stats.periodLabel} Total`,
      value: formatCurrency(stats.totalCommissions),
      subValue: `${stats.change.commissionsPercent >= 0 ? '+' : ''}${stats.change.commissionsPercent}% vs last period`,
      icon: stats.change.commissionsPercent >= 0 ? TrendingUp : TrendingDown,
      color: stats.change.commissionsPercent >= 0 ? 'text-green-400' : 'text-red-400',
      bgColor: stats.change.commissionsPercent >= 0 ? 'bg-green-500/20' : 'bg-red-500/20',
    },
    {
      label: 'Average Transaction',
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState<'week' | 'month' | 'ytd'>('week');
  const [viewMode, setViewMode] = useState<ViewMode>('podium');
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const autoRotateRef = useRef<NodeJS.Timeout | null>(null);

  const views: ViewMode[] = ['podium', 'leaderboard', 'stats', 'goals', 'milestones'];

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [leaderboardRes, statsRes] = await Promise.all([
        fetch('/api/command-center/meetings/leaderboard?animate=true'),
        fetch(`/api/command-center/meetings/stats?period=${period}`),
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

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [period]);

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

    switch (viewMode) {
      case 'podium':
        return leaderboardData && <PodiumDisplay leaderboard={leaderboardData.leaderboard} />;
      case 'leaderboard':
        return leaderboardData && <LeaderboardTable leaderboard={leaderboardData.leaderboard} period={period} />;
      case 'stats':
        return <StatsDisplay stats={statsData} leaderboard={leaderboardData} />;
      case 'goals':
        return <GoalsDisplay stats={statsData} />;
      case 'milestones':
        return <MilestonesDisplay stats={statsData} />;
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

        {/* View Selector */}
        <div className="flex items-center justify-center gap-4 pb-4">
          <button
            onClick={goToPrevView}
            className="p-2 hover:bg-zinc-800 rounded-full transition"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="flex gap-2">
            {views.map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg transition capitalize',
                  viewMode === v ? 'bg-lime-500 text-black' : 'bg-zinc-800 text-neutral-500 hover:text-white'
                )}
              >
                {v}
              </button>
            ))}
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
              <p className="text-sm text-neutral-500">Total Team Commissions</p>
              <p className="text-xl font-bold text-lime-400">
                {formatLargeCurrency(leaderboardData.summary.totalTeamCommissions)}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">Total Transactions</p>
              <p className="text-xl font-bold text-white">
                {leaderboardData.summary.totalTransactions.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">Weekly</p>
              <p className="text-xl font-bold text-blue-400">
                {formatCurrency(leaderboardData.summary.weeklyTotal)}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">Monthly</p>
              <p className="text-xl font-bold text-purple-400">
                {formatCurrency(leaderboardData.summary.monthlyTotal)}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">YTD</p>
              <p className="text-xl font-bold text-yellow-400">
                {formatCurrency(leaderboardData.summary.ytdTotal)}
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
