'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Award,
  Trophy,
  Star,
  Filter,
  ArrowLeft,
  Crown,
  Zap,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { LoadingSpinner, SearchInput } from '@/components/command-center';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface LeaderboardEntry {
  rank: number;
  name: string;
  totalCommissions: number;
  transactionCount: number;
  avgTransaction: number;
  percentOfTotal: number;
}

interface SalesApiResponse {
  success: boolean;
  data: {
    summary: {
      totalCommissions: number;
      transactionCount: number;
      avgTransactionValue: number;
      uniqueReps: number;
    };
    leaderboard: LeaderboardEntry[];
  };
}

type AchievementTier = 'legendary' | 'epic' | 'rare' | 'common';

interface Achievement {
  id: string;
  name: string;
  icon: string;
  tier: AchievementTier;
  description: string;
  requirement: string;
}

interface RepAchievement {
  repName: string;
  achievement: Achievement;
  value: number;
  earnedAt?: string;
}

// =============================================================================
// Achievement Definitions
// =============================================================================

const ACHIEVEMENT_DEFINITIONS: Achievement[] = [
  // Legendary Tier
  {
    id: 'millionaire',
    name: 'Millionaire',
    icon: '💰',
    tier: 'legendary',
    description: 'The ultimate sales achievement - one million in commissions',
    requirement: '$1M+ in total commissions',
  },
  {
    id: 'legend',
    name: 'Sales Legend',
    icon: '👑',
    tier: 'legendary',
    description: 'Achieved legendary status in all metrics',
    requirement: '30%+ of team total',
  },
  // Epic Tier
  {
    id: 'half-millionaire',
    name: 'Half-Millionaire',
    icon: '💵',
    tier: 'epic',
    description: 'Halfway to a million - exceptional performance',
    requirement: '$500K+ in total commissions',
  },
  {
    id: 'century-club',
    name: 'Century Club',
    icon: '💯',
    tier: 'epic',
    description: 'Closed over 100 deals',
    requirement: '100+ transactions',
  },
  {
    id: 'elite-closer',
    name: 'Elite Closer',
    icon: '🎯',
    tier: 'epic',
    description: 'Consistently high-value transactions',
    requirement: '$800+ average transaction',
  },
  // Rare Tier
  {
    id: 'big-ticket',
    name: 'Big Ticket Closer',
    icon: '🎫',
    tier: 'rare',
    description: 'Specializes in high-value deals',
    requirement: '$1K+ average transaction',
  },
  {
    id: 'team-mvp',
    name: 'Team MVP',
    icon: '🌟',
    tier: 'rare',
    description: 'Critical contributor to team success',
    requirement: '20%+ of team total',
  },
  {
    id: 'volume-king',
    name: 'Volume King',
    icon: '📈',
    tier: 'rare',
    description: 'High transaction volume achiever',
    requirement: '500+ transactions',
  },
  {
    id: 'quarter-million',
    name: 'Quarter Million',
    icon: '💎',
    tier: 'rare',
    description: 'Reached the $250K milestone',
    requirement: '$250K+ in total commissions',
  },
  // Common Tier
  {
    id: 'half-century',
    name: 'Half Century',
    icon: '5️⃣0️⃣',
    tier: 'common',
    description: 'Closed 50 deals',
    requirement: '50+ transactions',
  },
  {
    id: 'rising-star',
    name: 'Rising Star',
    icon: '⭐',
    tier: 'common',
    description: 'Making an impact on the team',
    requirement: '10%+ of team total',
  },
  {
    id: 'consistent-performer',
    name: 'Consistent Performer',
    icon: '📊',
    tier: 'common',
    description: 'Reliable transaction volume',
    requirement: '25+ transactions',
  },
  {
    id: 'first-hundred-k',
    name: 'First $100K',
    icon: '🏆',
    tier: 'common',
    description: 'Reached the six-figure milestone',
    requirement: '$100K+ in total commissions',
  },
];

// =============================================================================
// Achievement Calculation
// =============================================================================

function calculateRepAchievements(rep: LeaderboardEntry): RepAchievement[] {
  const achievements: RepAchievement[] = [];

  // Commission-based achievements
  if (rep.totalCommissions >= 1000000) {
    const def = ACHIEVEMENT_DEFINITIONS.find(a => a.id === 'millionaire')!;
    achievements.push({ repName: rep.name, achievement: def, value: rep.totalCommissions });
  }
  if (rep.totalCommissions >= 500000 && rep.totalCommissions < 1000000) {
    const def = ACHIEVEMENT_DEFINITIONS.find(a => a.id === 'half-millionaire')!;
    achievements.push({ repName: rep.name, achievement: def, value: rep.totalCommissions });
  }
  if (rep.totalCommissions >= 250000 && rep.totalCommissions < 500000) {
    const def = ACHIEVEMENT_DEFINITIONS.find(a => a.id === 'quarter-million')!;
    achievements.push({ repName: rep.name, achievement: def, value: rep.totalCommissions });
  }
  if (rep.totalCommissions >= 100000 && rep.totalCommissions < 250000) {
    const def = ACHIEVEMENT_DEFINITIONS.find(a => a.id === 'first-hundred-k')!;
    achievements.push({ repName: rep.name, achievement: def, value: rep.totalCommissions });
  }

  // Transaction-based achievements
  if (rep.transactionCount >= 500) {
    const def = ACHIEVEMENT_DEFINITIONS.find(a => a.id === 'volume-king')!;
    achievements.push({ repName: rep.name, achievement: def, value: rep.transactionCount });
  }
  if (rep.transactionCount >= 100) {
    const def = ACHIEVEMENT_DEFINITIONS.find(a => a.id === 'century-club')!;
    achievements.push({ repName: rep.name, achievement: def, value: rep.transactionCount });
  }
  if (rep.transactionCount >= 50 && rep.transactionCount < 100) {
    const def = ACHIEVEMENT_DEFINITIONS.find(a => a.id === 'half-century')!;
    achievements.push({ repName: rep.name, achievement: def, value: rep.transactionCount });
  }
  if (rep.transactionCount >= 25 && rep.transactionCount < 50) {
    const def = ACHIEVEMENT_DEFINITIONS.find(a => a.id === 'consistent-performer')!;
    achievements.push({ repName: rep.name, achievement: def, value: rep.transactionCount });
  }

  // Average transaction achievements
  if (rep.avgTransaction >= 1000) {
    const def = ACHIEVEMENT_DEFINITIONS.find(a => a.id === 'big-ticket')!;
    achievements.push({ repName: rep.name, achievement: def, value: rep.avgTransaction });
  }
  if (rep.avgTransaction >= 800 && rep.avgTransaction < 1000) {
    const def = ACHIEVEMENT_DEFINITIONS.find(a => a.id === 'elite-closer')!;
    achievements.push({ repName: rep.name, achievement: def, value: rep.avgTransaction });
  }

  // Percentage-based achievements
  if (rep.percentOfTotal >= 30) {
    const def = ACHIEVEMENT_DEFINITIONS.find(a => a.id === 'legend')!;
    achievements.push({ repName: rep.name, achievement: def, value: rep.percentOfTotal });
  }
  if (rep.percentOfTotal >= 20 && rep.percentOfTotal < 30) {
    const def = ACHIEVEMENT_DEFINITIONS.find(a => a.id === 'team-mvp')!;
    achievements.push({ repName: rep.name, achievement: def, value: rep.percentOfTotal });
  }
  if (rep.percentOfTotal >= 10 && rep.percentOfTotal < 20) {
    const def = ACHIEVEMENT_DEFINITIONS.find(a => a.id === 'rising-star')!;
    achievements.push({ repName: rep.name, achievement: def, value: rep.percentOfTotal });
  }

  return achievements;
}

// =============================================================================
// Tier Styling
// =============================================================================

const TIER_STYLES: Record<AchievementTier, { bg: string; border: string; text: string; glow: string }> = {
  legendary: {
    bg: 'bg-gradient-to-br from-yellow-500/20 to-amber-600/20',
    border: 'border-yellow-500/50',
    text: 'text-yellow-400',
    glow: 'shadow-[0_0_20px_rgba(234,179,8,0.3)]',
  },
  epic: {
    bg: 'bg-gradient-to-br from-purple-500/20 to-violet-600/20',
    border: 'border-purple-500/50',
    text: 'text-purple-400',
    glow: 'shadow-[0_0_15px_rgba(168,85,247,0.25)]',
  },
  rare: {
    bg: 'bg-gradient-to-br from-blue-500/20 to-cyan-600/20',
    border: 'border-blue-500/50',
    text: 'text-blue-400',
    glow: '',
  },
  common: {
    bg: 'bg-zinc-800/50',
    border: 'border-zinc-700',
    text: 'text-gray-400',
    glow: '',
  },
};

const TIER_ORDER: AchievementTier[] = ['legendary', 'epic', 'rare', 'common'];

// =============================================================================
// Components
// =============================================================================

interface AchievementCardProps {
  achievement: RepAchievement;
  showRep?: boolean;
}

function AchievementCard({ achievement, showRep = true }: AchievementCardProps) {
  const style = TIER_STYLES[achievement.achievement.tier];

  return (
    <div
      className={cn(
        'rounded-xl p-4 border transition-all hover:scale-[1.02]',
        style.bg,
        style.border,
        style.glow
      )}
    >
      <div className="flex items-start gap-3">
        <div className="text-4xl">{achievement.achievement.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={cn('font-bold', style.text)}>
              {achievement.achievement.name}
            </h3>
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full uppercase font-semibold',
                style.bg,
                style.text
              )}
            >
              {achievement.achievement.tier}
            </span>
          </div>
          <p className="text-sm text-gray-400 mb-2">
            {achievement.achievement.description}
          </p>
          <p className="text-xs text-gray-500">
            {achievement.achievement.requirement}
          </p>
          {showRep && (
            <Link
              href={`/command-center/sales/${encodeURIComponent(achievement.repName.toLowerCase().replace(/\s+/g, '-'))}`}
              className="inline-flex items-center gap-1 mt-2 text-sm text-brand-green hover:underline"
            >
              <Users className="h-3 w-3" />
              {achievement.repName}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

interface TierFilterProps {
  selected: AchievementTier | 'all';
  onChange: (tier: AchievementTier | 'all') => void;
  counts: Record<AchievementTier | 'all', number>;
}

function TierFilter({ selected, onChange, counts }: TierFilterProps) {
  const options: { value: AchievementTier | 'all'; label: string; icon: React.ReactNode }[] = [
    { value: 'all', label: 'All', icon: <Star className="h-4 w-4" /> },
    { value: 'legendary', label: 'Legendary', icon: <Crown className="h-4 w-4" /> },
    { value: 'epic', label: 'Epic', icon: <Zap className="h-4 w-4" /> },
    { value: 'rare', label: 'Rare', icon: <Target className="h-4 w-4" /> },
    { value: 'common', label: 'Common', icon: <TrendingUp className="h-4 w-4" /> },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(({ value, label, icon }) => {
        const style = value === 'all' ? null : TIER_STYLES[value];
        const isSelected = selected === value;

        return (
          <button
            key={value}
            onClick={() => onChange(value)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg border transition-all',
              isSelected
                ? style
                  ? cn(style.bg, style.border, style.text)
                  : 'bg-brand-green text-black border-brand-green'
                : 'bg-zinc-900 border-zinc-700 text-gray-400 hover:border-zinc-600'
            )}
          >
            {icon}
            <span className="font-medium">{label}</span>
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded-full',
                isSelected ? 'bg-black/20' : 'bg-zinc-800'
              )}
            >
              {counts[value]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface RepSummaryProps {
  repName: string;
  achievements: RepAchievement[];
}

function RepSummary({ repName, achievements }: RepSummaryProps) {
  const tierCounts = useMemo(() => {
    const counts: Record<AchievementTier, number> = {
      legendary: 0,
      epic: 0,
      rare: 0,
      common: 0,
    };
    achievements.forEach(a => {
      counts[a.achievement.tier]++;
    });
    return counts;
  }, [achievements]);

  return (
    <Link
      href={`/command-center/sales/${encodeURIComponent(repName.toLowerCase().replace(/\s+/g, '-'))}`}
      className="block bg-[#1a1a1a] rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-all hover:scale-[1.01]"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-green/30 to-green-600/30 flex items-center justify-center text-lg font-bold text-brand-green">
            {repName.charAt(0)}
          </div>
          <div>
            <h3 className="font-semibold text-white">{repName}</h3>
            <p className="text-sm text-gray-400">
              {achievements.length} achievement{achievements.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {TIER_ORDER.map(tier => {
            if (tierCounts[tier] === 0) return null;
            const style = TIER_STYLES[tier];
            return (
              <div
                key={tier}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-lg',
                  style.bg,
                  style.border,
                  'border'
                )}
              >
                <span className={cn('text-sm font-bold', style.text)}>
                  {tierCounts[tier]}
                </span>
                <span className="text-xs text-gray-500 uppercase">{tier.charAt(0)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Achievement icons row */}
      <div className="flex flex-wrap gap-1 mt-3">
        {achievements.map((a, i) => (
          <span
            key={i}
            title={a.achievement.name}
            className="text-xl hover:scale-125 transition-transform cursor-default"
          >
            {a.achievement.icon}
          </span>
        ))}
      </div>
    </Link>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function AchievementsPage() {
  const [data, setData] = useState<SalesApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<AchievementTier | 'all'>('all');
  const [repFilter, setRepFilter] = useState('');
  const [viewMode, setViewMode] = useState<'achievements' | 'reps'>('achievements');

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/command-center/sales?period=all');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || 'Unknown API error');
        }
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Calculate all achievements
  const allAchievements = useMemo(() => {
    if (!data?.data.leaderboard) return [];

    const achievements: RepAchievement[] = [];
    data.data.leaderboard.forEach(rep => {
      const repAchievements = calculateRepAchievements(rep);
      achievements.push(...repAchievements);
    });

    // Sort by tier (legendary first)
    return achievements.sort((a, b) => {
      return TIER_ORDER.indexOf(a.achievement.tier) - TIER_ORDER.indexOf(b.achievement.tier);
    });
  }, [data]);

  // Filter achievements
  const filteredAchievements = useMemo(() => {
    let filtered = allAchievements;

    if (tierFilter !== 'all') {
      filtered = filtered.filter(a => a.achievement.tier === tierFilter);
    }

    if (repFilter) {
      filtered = filtered.filter(a =>
        a.repName.toLowerCase().includes(repFilter.toLowerCase())
      );
    }

    return filtered;
  }, [allAchievements, tierFilter, repFilter]);

  // Group achievements by rep
  const achievementsByRep = useMemo(() => {
    const byRep: Record<string, RepAchievement[]> = {};
    filteredAchievements.forEach(a => {
      if (!byRep[a.repName]) {
        byRep[a.repName] = [];
      }
      byRep[a.repName].push(a);
    });

    // Sort by number of achievements (descending)
    return Object.entries(byRep)
      .sort((a, b) => {
        // Sort by legendary count first, then total
        const aLegendary = a[1].filter(x => x.achievement.tier === 'legendary').length;
        const bLegendary = b[1].filter(x => x.achievement.tier === 'legendary').length;
        if (aLegendary !== bLegendary) return bLegendary - aLegendary;
        return b[1].length - a[1].length;
      });
  }, [filteredAchievements]);

  // Calculate tier counts
  const tierCounts = useMemo(() => {
    const counts: Record<AchievementTier | 'all', number> = {
      all: allAchievements.length,
      legendary: 0,
      epic: 0,
      rare: 0,
      common: 0,
    };

    allAchievements.forEach(a => {
      counts[a.achievement.tier]++;
    });

    return counts;
  }, [allAchievements]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Data</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Link
            href="/command-center/sales"
            className="inline-flex items-center gap-1 text-gray-400 hover:text-white mb-2 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Leaderboard
          </Link>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Award className="h-8 w-8 text-amber-400" />
            Achievement Wall
          </h1>
          <p className="text-gray-400 mt-1">
            {tierCounts.all} achievements earned across {data?.data.summary.uniqueReps || 0} reps
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('achievements')}
            className={cn(
              'px-4 py-2 rounded-lg transition',
              viewMode === 'achievements'
                ? 'bg-brand-green text-black'
                : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'
            )}
          >
            By Achievement
          </button>
          <button
            onClick={() => setViewMode('reps')}
            className={cn(
              'px-4 py-2 rounded-lg transition',
              viewMode === 'reps'
                ? 'bg-brand-green text-black'
                : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'
            )}
          >
            By Rep
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#1a1a1a] rounded-xl p-4 border border-gray-800">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-2 text-gray-400">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Filter:</span>
          </div>

          <TierFilter
            selected={tierFilter}
            onChange={setTierFilter}
            counts={tierCounts}
          />

          <div className="lg:ml-auto w-full lg:w-64">
            <SearchInput
              placeholder="Search by rep name..."
              value={repFilter}
              onChange={setRepFilter}
            />
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {TIER_ORDER.map(tier => {
          const style = TIER_STYLES[tier];
          return (
            <div
              key={tier}
              className={cn(
                'rounded-xl p-4 border text-center',
                style.bg,
                style.border,
                style.glow
              )}
            >
              <p className={cn('text-3xl font-bold', style.text)}>
                {tierCounts[tier]}
              </p>
              <p className="text-sm text-gray-400 capitalize">{tier}</p>
            </div>
          );
        })}
      </div>

      {/* Content */}
      {viewMode === 'achievements' ? (
        /* Achievement Cards View */
        <div className="space-y-6">
          {TIER_ORDER.map(tier => {
            const tierAchievements = filteredAchievements.filter(
              a => a.achievement.tier === tier
            );

            if (tierAchievements.length === 0) return null;
            if (tierFilter !== 'all' && tierFilter !== tier) return null;

            const style = TIER_STYLES[tier];

            return (
              <div key={tier}>
                <h2
                  className={cn(
                    'text-xl font-bold mb-4 flex items-center gap-2 capitalize',
                    style.text
                  )}
                >
                  {tier === 'legendary' && <Crown className="h-5 w-5" />}
                  {tier === 'epic' && <Zap className="h-5 w-5" />}
                  {tier === 'rare' && <Target className="h-5 w-5" />}
                  {tier === 'common' && <TrendingUp className="h-5 w-5" />}
                  {tier} Achievements
                  <span className="text-sm font-normal text-gray-500">
                    ({tierAchievements.length})
                  </span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tierAchievements.map((achievement, index) => (
                    <AchievementCard
                      key={`${achievement.repName}-${achievement.achievement.id}-${index}`}
                      achievement={achievement}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {filteredAchievements.length === 0 && (
            <div className="text-center py-12">
              <Trophy className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">
                No achievements found
              </h3>
              <p className="text-gray-500">
                Try adjusting your filters to see more results.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* By Rep View */
        <div className="space-y-4">
          {achievementsByRep.map(([repName, achievements]) => (
            <RepSummary
              key={repName}
              repName={repName}
              achievements={achievements}
            />
          ))}

          {achievementsByRep.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">
                No reps found
              </h3>
              <p className="text-gray-500">
                Try adjusting your filters to see more results.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
