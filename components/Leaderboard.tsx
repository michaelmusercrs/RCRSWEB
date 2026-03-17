'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Trophy,
  Medal,
  Award,
  Flame,
  TrendingUp,
  User,
  Crown,
  Filter,
  BookOpen,
  Target,
  GraduationCap,
} from 'lucide-react';
import { useTraining, USER_ROLES, type UserRole } from '@/lib/training-context';

// ---------------------------------------------------------------------------
// Role filter options
// ---------------------------------------------------------------------------

type FilterMode = 'all' | 'sales' | 'operations' | 'admin';

const FILTER_OPTIONS: { key: FilterMode; label: string; description: string; excludeRoles: UserRole[] }[] = [
  { key: 'all', label: 'All Team', description: 'Everyone on the team', excludeRoles: [] },
  { key: 'sales', label: 'Sales', description: 'Sales reps & managers', excludeRoles: ['driver', 'warehouse'] },
  { key: 'operations', label: 'Operations', description: 'Drivers & warehouse', excludeRoles: ['sales'] },
  { key: 'admin', label: 'Admin', description: 'Admin & office staff', excludeRoles: ['driver', 'warehouse', 'sales'] },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface LeaderboardProps {
  compact?: boolean;
  showUserComparison?: boolean;
}

export default function Leaderboard({ compact = false, showUserComparison = true }: LeaderboardProps) {
  const { leaderboard, settings, progress, userRank } = useTraining();
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  // Apply role filter
  const activeFilter = FILTER_OPTIONS.find((f) => f.key === filterMode) || FILTER_OPTIONS[0];
  const filteredLeaderboard = leaderboard.filter(
    (entry) => !activeFilter.excludeRoles.includes(entry.role)
  );

  // Recalculate user rank in filtered view
  const filteredUserRank =
    filteredLeaderboard.findIndex((e) => e.name === settings.displayName) + 1 ||
    filteredLeaderboard.length + 1;

  if (compact) {
    const topFive = filteredLeaderboard.slice(0, 5);

    return (
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Trophy className="text-yellow-400" size={18} />
            Leaderboard
          </h3>
          <span className="text-xs text-neutral-500">Your rank: #{filteredUserRank}</span>
        </div>

        <div className="space-y-2">
          {topFive.map((entry, idx) => (
            <div
              key={entry.name}
              className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${
                entry.name === settings.displayName
                  ? 'bg-brand-green/10 border border-brand-green/30'
                  : 'hover:bg-white/5'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  idx === 0
                    ? 'bg-yellow-500 text-black'
                    : idx === 1
                    ? 'bg-gray-400 text-black'
                    : idx === 2
                    ? 'bg-orange-600 text-white'
                    : 'bg-white/10 text-neutral-400'
                }`}
              >
                {idx < 3 ? <Crown size={14} /> : idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{entry.name}</div>
                <div className="text-xs text-neutral-500">{USER_ROLES[entry.role]}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-brand-green">{entry.points}</div>
                {entry.streak > 0 && (
                  <div className="flex items-center gap-0.5 text-xs text-orange-400 justify-end">
                    <Flame size={10} />
                    {entry.streak}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Full leaderboard view
  const aboveUser =
    filteredUserRank > 1 ? filteredLeaderboard[filteredUserRank - 2] : null;
  const belowUser =
    filteredUserRank < filteredLeaderboard.length
      ? filteredLeaderboard[filteredUserRank]
      : null;

  return (
    <div className="space-y-6">
      {/* Role Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setFilterMode(opt.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              filterMode === opt.key
                ? 'bg-brand-green/20 border-brand-green/30 text-brand-green'
                : 'bg-white/[0.02] border-white/5 text-neutral-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Filter size={10} />
            {opt.label}
          </button>
        ))}
      </div>

      {/* Scoring Legend */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
        <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Target size={12} className="text-brand-green" />
          How Points Are Earned
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="text-center p-2 rounded-xl bg-white/[0.02]">
            <BookOpen size={14} className="mx-auto text-blue-400 mb-1" />
            <div className="text-sm font-bold text-white">+10</div>
            <div className="text-[10px] text-neutral-500">Per Module</div>
          </div>
          <div className="text-center p-2 rounded-xl bg-white/[0.02]">
            <GraduationCap size={14} className="mx-auto text-brand-green mb-1" />
            <div className="text-sm font-bold text-white">+25</div>
            <div className="text-[10px] text-neutral-500">Quiz Passed</div>
          </div>
          <div className="text-center p-2 rounded-xl bg-white/[0.02]">
            <Award size={14} className="mx-auto text-yellow-400 mb-1" />
            <div className="text-sm font-bold text-white">+50</div>
            <div className="text-[10px] text-neutral-500">Sales Cert</div>
          </div>
          <div className="text-center p-2 rounded-xl bg-white/[0.02]">
            <Flame size={14} className="mx-auto text-orange-400 mb-1" />
            <div className="text-sm font-bold text-white">+25</div>
            <div className="text-[10px] text-neutral-500">7-Day Streak</div>
          </div>
          <div className="text-center p-2 rounded-xl bg-white/[0.02]">
            <TrendingUp size={14} className="mx-auto text-emerald-400 mb-1" />
            <div className="text-sm font-bold text-white">+5</div>
            <div className="text-[10px] text-neutral-500">Daily Login</div>
          </div>
        </div>
      </div>

      {/* Top 3 Podium */}
      <div className="bg-gradient-to-b from-white/[0.03] to-transparent border border-white/5 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white text-center mb-6 flex items-center justify-center gap-2">
          <Trophy className="text-yellow-400" size={24} />
          Top Performers
          {filterMode !== 'all' && (
            <span className="text-xs font-normal text-neutral-400 ml-1">
              ({activeFilter.label})
            </span>
          )}
        </h3>

        <div className="flex items-end justify-center gap-4">
          {/* 2nd Place */}
          {filteredLeaderboard[1] && (
            <div className="text-center flex-1 max-w-32">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center mb-2 ring-4 ring-gray-400/30">
                {filteredLeaderboard[1].avatar ? (
                  <Image
                    src={filteredLeaderboard[1].avatar}
                    alt={`${filteredLeaderboard[1].name} avatar`}
                    width={64}
                    height={64}
                    className="w-full h-full rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <User className="text-gray-700" size={28} />
                )}
              </div>
              <div className="bg-gray-500/20 rounded-t-xl pt-3 pb-6 -mt-3">
                <Medal className="mx-auto text-gray-400 mb-1" size={20} />
                <div className="text-sm font-bold text-white truncate px-2">
                  {filteredLeaderboard[1].name}
                </div>
                <div className="text-xs text-neutral-400">
                  {filteredLeaderboard[1].points} pts
                </div>
                {filteredLeaderboard[1].streak > 0 && (
                  <div className="flex items-center justify-center gap-0.5 text-[10px] text-orange-400 mt-0.5">
                    <Flame size={8} />
                    {filteredLeaderboard[1].streak}d
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 1st Place */}
          {filteredLeaderboard[0] && (
            <div className="text-center flex-1 max-w-36 -mb-4">
              <Crown className="mx-auto text-yellow-400 mb-1" size={24} />
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center mb-2 ring-4 ring-yellow-400/50 shadow-lg shadow-yellow-500/25">
                {filteredLeaderboard[0].avatar ? (
                  <Image
                    src={filteredLeaderboard[0].avatar}
                    alt={`${filteredLeaderboard[0].name} avatar`}
                    width={80}
                    height={80}
                    className="w-full h-full rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <User className="text-yellow-900" size={32} />
                )}
              </div>
              <div className="bg-yellow-500/20 rounded-t-xl pt-3 pb-8 -mt-3">
                <Trophy className="mx-auto text-yellow-400 mb-1" size={24} />
                <div className="font-bold text-white truncate px-2">
                  {filteredLeaderboard[0].name}
                </div>
                <div className="text-sm text-yellow-400 font-bold">
                  {filteredLeaderboard[0].points} pts
                </div>
                {filteredLeaderboard[0].streak > 0 && (
                  <div className="flex items-center justify-center gap-1 text-xs text-orange-400 mt-1">
                    <Flame size={12} />
                    {filteredLeaderboard[0].streak} day streak
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {filteredLeaderboard[2] && (
            <div className="text-center flex-1 max-w-32">
              <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center mb-2 ring-4 ring-orange-500/30">
                {filteredLeaderboard[2].avatar ? (
                  <Image
                    src={filteredLeaderboard[2].avatar}
                    alt={`${filteredLeaderboard[2].name} avatar`}
                    width={56}
                    height={56}
                    className="w-full h-full rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <User className="text-orange-200" size={24} />
                )}
              </div>
              <div className="bg-orange-600/20 rounded-t-xl pt-3 pb-4 -mt-3">
                <Award className="mx-auto text-orange-500 mb-1" size={18} />
                <div className="text-sm font-bold text-white truncate px-2">
                  {filteredLeaderboard[2].name}
                </div>
                <div className="text-xs text-neutral-400">
                  {filteredLeaderboard[2].points} pts
                </div>
                {filteredLeaderboard[2].streak > 0 && (
                  <div className="flex items-center justify-center gap-0.5 text-[10px] text-orange-400 mt-0.5">
                    <Flame size={8} />
                    {filteredLeaderboard[2].streak}d
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Comparison */}
      {showUserComparison && (
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="text-brand-green" size={18} />
            Your Position
          </h3>

          <div className="space-y-2">
            {/* Person above */}
            {aboveUser && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-neutral-400">
                  {filteredUserRank - 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-neutral-300">
                    {aboveUser.name}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {USER_ROLES[aboveUser.role]}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-neutral-300">
                    {aboveUser.points} pts
                  </div>
                  <div className="text-xs text-emerald-400">
                    +{aboveUser.points - progress.points} ahead
                  </div>
                </div>
              </div>
            )}

            {/* Current user */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-brand-green/10 border-2 border-brand-green/50">
              <div className="w-10 h-10 rounded-full bg-brand-green flex items-center justify-center text-sm font-bold text-black">
                {filteredUserRank}
              </div>
              <div className="flex-1">
                <div className="font-medium text-white">
                  You ({settings.displayName})
                </div>
                <div className="text-xs text-neutral-400">
                  {USER_ROLES[settings.role]}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-brand-green">
                  {progress.points} pts
                </div>
                {progress.streak > 0 && (
                  <div className="flex items-center gap-1 text-xs text-orange-400 justify-end">
                    <Flame size={10} />
                    {progress.streak} day streak
                  </div>
                )}
              </div>
            </div>

            {/* Person below */}
            {belowUser && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-neutral-400">
                  {filteredUserRank + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-neutral-300">
                    {belowUser.name}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {USER_ROLES[belowUser.role]}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-neutral-300">
                    {belowUser.points} pts
                  </div>
                  <div className="text-xs text-red-400">
                    {progress.points - belowUser.points} behind you
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tips to rank up */}
          {aboveUser && (
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <div className="text-xs text-blue-400 font-medium mb-1">
                Tip to rank up
              </div>
              <div className="text-sm text-blue-300">
                Complete{' '}
                {Math.ceil((aboveUser.points - progress.points) / 10)} more
                lessons to pass {aboveUser.name.split(' ')[0]}!
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full Rankings */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-bold text-white">Full Rankings</h3>
          <span className="text-xs text-neutral-500">
            {filteredLeaderboard.length} team members
          </span>
        </div>
        <div className="divide-y divide-white/5">
          {filteredLeaderboard.map((entry, idx) => {
            return (
              <div
                key={entry.name}
                className={`flex items-center gap-3 p-4 transition-colors ${
                  entry.name === settings.displayName
                    ? 'bg-brand-green/10'
                    : 'hover:bg-white/[0.02]'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    idx === 0
                      ? 'bg-yellow-500 text-black'
                      : idx === 1
                      ? 'bg-gray-400 text-black'
                      : idx === 2
                      ? 'bg-orange-600 text-white'
                      : 'bg-white/10 text-neutral-400'
                  }`}
                >
                  {idx + 1}
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neutral-600 to-neutral-800 flex items-center justify-center overflow-hidden">
                  {entry.avatar ? (
                    <Image
                      src={entry.avatar}
                      alt={`${entry.name} avatar`}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <User className="text-neutral-400" size={20} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">
                    {entry.name}
                    {entry.name === settings.displayName && (
                      <span className="ml-2 text-xs text-brand-green">(You)</span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {USER_ROLES[entry.role]}
                  </div>
                </div>
                <div className="text-center px-2">
                  <div className="text-xs text-neutral-500">Modules</div>
                  <div className="text-sm font-bold text-white">
                    {entry.completedModules}
                  </div>
                </div>
                <div className="text-center px-2">
                  {entry.streak > 0 ? (
                    <>
                      <div className="text-xs text-orange-400">Streak</div>
                      <div className="text-sm font-bold text-orange-400 flex items-center gap-1 justify-center">
                        <Flame size={12} />
                        {entry.streak}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs text-neutral-500">Streak</div>
                      <div className="text-sm text-neutral-600">-</div>
                    </>
                  )}
                </div>
                <div className="text-right min-w-[60px]">
                  <div className="text-lg font-bold text-brand-green">
                    {entry.points}
                  </div>
                  <div className="text-xs text-neutral-500">points</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
