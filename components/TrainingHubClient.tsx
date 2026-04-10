'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  BookOpen,
  Monitor,
  Trophy,
  ArrowRight,
  ArrowLeft,
  Home,
  Users,
  UserCircle,
  Target,
  Zap,
  Command,
  Brain,
  Flame,
  TrendingUp,
  CheckCircle2,
  BarChart3,
  Award,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import SettingsMenu from '@/components/SettingsMenu';
import Leaderboard from '@/components/Leaderboard';
import { useAuth } from '@/lib/auth-context';
import type { TeamRole } from '@/lib/team-roles';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrainingPathDef {
  title: string;
  subtitle: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  color: string;
  borderColor: string;
  iconColor: string;
  modules: number;
  estimatedTime: string;
  audience: string;
  /** Which roles should see this training path. Empty array = visible to all roles. */
  visibleToRoles: TeamRole[];
  /** localStorage key that stores completion data for this path */
  storageKey: string;
  /** How to read the completed count from the stored value */
  parseCompleted: (raw: string | null) => number;
  progressBarColor: string;
}

interface PathProgress {
  completed: number;
  total: number;
  percentage: number;
}

// ---------------------------------------------------------------------------
// Training Path Definitions with localStorage tracking
// ---------------------------------------------------------------------------

const trainingPaths: TrainingPathDef[] = [
  {
    title: 'Training Library',
    subtitle: 'AI-Powered Deep Dives & Media',
    description:
      'AI-generated training content powered by NotebookLM. Includes RoofStack Radio audio deep dives, RoofStack TV videos, interactive quizzes, flashcards, System Maps, Visual Guides, and study guides for every role.',
    href: '/portal/training/library',
    icon: GraduationCap,
    color: 'from-purple-500/20 to-pink-500/20',
    borderColor: 'border-purple-500/30',
    iconColor: 'text-purple-400',
    modules: 7,
    estimatedTime: '10+ hours',
    audience: 'All Roles',
    visibleToRoles: [], // all roles
    storageKey: 'rcrs-training-completed',
    parseCompleted: (raw) => {
      if (!raw) return 0;
      try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr.length : 0; } catch { return 0; }
    },
    progressBarColor: 'bg-purple-400',
  },
  {
    title: 'NotebookLM Guide',
    subtitle: 'AI Research Tool Training',
    description:
      'Learn how to use Google NotebookLM to supercharge your productivity. Covers adding sources, AI chat, audio overviews, sharing, and using RoofStack sales data notebooks for territory prep and meeting analysis.',
    href: '/portal/training/notebooklm',
    icon: Brain,
    color: 'from-violet-500/20 to-purple-500/20',
    borderColor: 'border-violet-500/30',
    iconColor: 'text-violet-400',
    modules: 8,
    estimatedTime: '1-2 hours',
    audience: 'All Team Members',
    visibleToRoles: [], // all roles
    storageKey: 'rcrs-nlm-progress',
    parseCompleted: (raw) => {
      if (!raw) return 0;
      try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr.length : 0; } catch { return 0; }
    },
    progressBarColor: 'bg-violet-400',
  },
  {
    title: 'Sales Training',
    subtitle: 'New Hire Roofing Sales Program',
    description:
      'Complete training program for new sales hires. Learn about roofing products, the insurance claim process, the RoofStack sales methodology, CRM usage, measurement, and customer communication.',
    href: '/portal/training/sales',
    icon: Target,
    color: 'from-brand-green/20 to-emerald-500/20',
    borderColor: 'border-brand-green/30',
    iconColor: 'text-brand-green',
    modules: 7,
    estimatedTime: '4-6 hours',
    audience: 'New Sales Hires',
    visibleToRoles: ['owner', 'admin', 'manager', 'sales'], // sales-focused roles
    storageKey: 'rcrs-sales-training-progress',
    parseCompleted: (raw) => {
      if (!raw) return 0;
      try {
        const obj = JSON.parse(raw);
        // Record<moduleId, { passed: boolean }> -- count passed modules
        return Object.values(obj).filter((v: unknown) => (v as { passed?: boolean })?.passed).length;
      } catch { return 0; }
    },
    progressBarColor: 'bg-brand-green',
  },
  {
    title: 'Platform Onboarding',
    subtitle: 'Learn the RoofStack Interface',
    description:
      'Step-by-step walkthrough of the RoofStack platform. Learn how to navigate HQ, manage leads, handle deliveries, create invoices, schedule appointments, and more.',
    href: '/portal/training/onboarding',
    icon: Monitor,
    color: 'from-blue-500/20 to-cyan-500/20',
    borderColor: 'border-blue-500/30',
    iconColor: 'text-blue-400',
    modules: 8,
    estimatedTime: '2-3 hours',
    audience: 'All Team Members',
    visibleToRoles: [], // all roles
    storageKey: 'rcrs-onboarding-progress',
    parseCompleted: (raw) => {
      if (!raw) return 0;
      try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr.length : 0; } catch { return 0; }
    },
    progressBarColor: 'bg-blue-400',
  },
  {
    title: 'Role-Based Modules',
    subtitle: 'Training by Position',
    description:
      'Structured training modules organized by role: Sales Rep (10), Admin (11), Driver (8), Owner/Manager (8), Customer-Facing (5), and Production Crew (3). Each module includes lessons, quizzes, and flashcards.',
    href: '/portal/training/modules',
    icon: Trophy,
    color: 'from-amber-500/20 to-orange-500/20',
    borderColor: 'border-amber-500/30',
    iconColor: 'text-amber-400',
    modules: 45,
    estimatedTime: '20+ hours',
    audience: 'All Roles',
    visibleToRoles: [], // all roles
    storageKey: 'rcrs-training-progress',
    parseCompleted: (raw) => {
      if (!raw) return 0;
      try {
        const obj = JSON.parse(raw);
        // The training-context stores completedModules array
        return Array.isArray(obj?.completedModules) ? obj.completedModules.length : 0;
      } catch { return 0; }
    },
    progressBarColor: 'bg-amber-400',
  },
  {
    title: 'Personal Walkthroughs',
    subtitle: 'Tailored to Your Role',
    description:
      'Individualized walkthroughs for every team member. See only the features you use daily, with "Try It" links to jump straight into each tool.',
    href: '/portal/training/walkthrough',
    icon: UserCircle,
    color: 'from-brand-green/20 to-teal-500/20',
    borderColor: 'border-brand-green/30',
    iconColor: 'text-brand-green',
    modules: 8,
    estimatedTime: '30-60 min',
    audience: 'By Name',
    visibleToRoles: [], // all roles
    storageKey: '__walkthrough_aggregate__',
    parseCompleted: () => 0, // handled specially below
    progressBarColor: 'bg-teal-400',
  },
];

// Walkthrough slugs to aggregate progress across
const WALKTHROUGH_SLUGS = [
  'chris', 'sara', 'admin-ops', 'boston', 'drivers', 'sales', 'production', 'michael',
];

// ---------------------------------------------------------------------------
// Helper: load all progress from localStorage
// ---------------------------------------------------------------------------

function loadAllProgress(): Record<string, PathProgress> {
  const result: Record<string, PathProgress> = {};

  for (const path of trainingPaths) {
    if (path.storageKey === '__walkthrough_aggregate__') {
      // Aggregate walkthrough progress across all slugs
      let totalCompleted = 0;
      for (const slug of WALKTHROUGH_SLUGS) {
        try {
          const raw = localStorage.getItem(`rcrs-walkthrough-${slug}-progress`);
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr) && arr.length > 0) totalCompleted++;
          }
        } catch { /* ignore */ }
      }
      const total = path.modules;
      result[path.href] = {
        completed: totalCompleted,
        total,
        percentage: total > 0 ? Math.round((totalCompleted / total) * 100) : 0,
      };
    } else {
      const raw = localStorage.getItem(path.storageKey);
      const completed = path.parseCompleted(raw);
      const total = path.modules;
      result[path.href] = {
        completed,
        total,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helper: calculate unified points from all training activity
// ---------------------------------------------------------------------------

interface UnifiedStats {
  totalCompleted: number;
  totalModules: number;
  overallPercentage: number;
  points: number;
  streak: number;
  salesCertified: boolean;
}

function loadUnifiedStats(progressMap: Record<string, PathProgress>): UnifiedStats {
  let totalCompleted = 0;
  let totalModules = 0;

  for (const path of trainingPaths) {
    const p = progressMap[path.href];
    if (p) {
      totalCompleted += p.completed;
      totalModules += p.total;
    }
  }

  const overallPercentage = totalModules > 0 ? Math.round((totalCompleted / totalModules) * 100) : 0;

  // Calculate points
  // 10pts per module completed, 25pts per quiz passed (sales modules count as quiz),
  // 50pts bonus for sales certification (all 7 passed)
  let points = totalCompleted * 10;

  // Check sales training for quiz-passed bonuses
  let salesCertified = false;
  try {
    const salesRaw = localStorage.getItem('rcrs-sales-training-progress');
    if (salesRaw) {
      const salesObj = JSON.parse(salesRaw);
      const passedCount = Object.values(salesObj).filter(
        (v: unknown) => (v as { passed?: boolean })?.passed
      ).length;
      // 25pts per quiz passed (on top of the base 10pts already counted)
      points += passedCount * 15; // additional 15 per quiz (10 already counted above)
      if (passedCount >= 7) {
        salesCertified = true;
        points += 50; // certification bonus
      }
    }
  } catch { /* ignore */ }

  // Check streak from training context
  let streak = 0;
  try {
    const progressRaw = localStorage.getItem('rcrs-training-progress');
    if (progressRaw) {
      const obj = JSON.parse(progressRaw);
      streak = obj?.streak || 0;
      // Add streak points if present in the context
      points += (obj?.points || 0) > points ? 0 : 0; // Don't double count
    }
  } catch { /* ignore */ }

  // Add daily login points from training context
  try {
    const progressRaw = localStorage.getItem('rcrs-training-progress');
    if (progressRaw) {
      const obj = JSON.parse(progressRaw);
      const ctxStreak = obj?.streak || 0;
      if (ctxStreak > streak) streak = ctxStreak;
    }
  } catch { /* ignore */ }

  return { totalCompleted, totalModules, overallPercentage, points, streak, salesCertified };
}

// ---------------------------------------------------------------------------
// Progress Ring SVG component
// ---------------------------------------------------------------------------

function ProgressRing({ percentage, size = 80, strokeWidth = 6 }: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={strokeWidth}
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#39FF14"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main Client Component
// ---------------------------------------------------------------------------

/**
 * Filter training paths by user role.
 * Paths with an empty visibleToRoles array are visible to everyone.
 * Owners/admins always see all paths regardless of filter.
 */
function getVisiblePaths(role: TeamRole | undefined): TrainingPathDef[] {
  if (!role) return trainingPaths; // not logged in yet, show all
  if (role === 'owner' || role === 'admin') return trainingPaths; // owners/admins see everything
  return trainingPaths.filter(
    (path) => path.visibleToRoles.length === 0 || path.visibleToRoles.includes(role)
  );
}

export default function TrainingHubClient() {
  const { user } = useAuth();
  const [progressMap, setProgressMap] = useState<Record<string, PathProgress>>({});
  const [stats, setStats] = useState<UnifiedStats>({
    totalCompleted: 0,
    totalModules: 0,
    overallPercentage: 0,
    points: 0,
    streak: 0,
    salesCertified: false,
  });
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Filter training paths based on user role
  const visiblePaths = getVisiblePaths(user?.role as TeamRole | undefined);

  useEffect(() => {
    // Load from localStorage first (instant), then merge with server data
    const localMap = loadAllProgress();
    setProgressMap(localMap);
    setStats(loadUnifiedStats(localMap));
    setMounted(true);

    // Also fetch real progress from the API (persisted in Google Sheets).
    // This ensures progress syncs across devices and survives cache clears.
    if (user?.userId) {
      (async () => {
        try {
          const res = await fetch(
            `/api/portal/training/modules?userId=${encodeURIComponent(user.userId)}`,
            { credentials: 'include' }
          );
          if (!res.ok) return;
          const data = await res.json();
          const serverModules = data.modules || data.data || [];
          if (!Array.isArray(serverModules) || serverModules.length === 0) return;

          // Count server-side completions and merge into the progress map.
          // Server progress wins over localStorage when both exist.
          const serverCompleted = new Set<string>();
          for (const m of serverModules) {
            if (m.completed || m.status === 'completed') {
              serverCompleted.add(m.moduleId || m.id);
            }
          }

          if (serverCompleted.size > 0) {
            // Update the modules path progress from server data
            const updatedMap = { ...localMap };
            const modulesPath = trainingPaths.find(p => p.href === '/portal/training/modules');
            if (modulesPath) {
              const serverCount = serverCompleted.size;
              const localCount = updatedMap[modulesPath.href]?.completed || 0;
              // Use whichever is higher (server or local)
              const best = Math.max(serverCount, localCount);
              updatedMap[modulesPath.href] = {
                completed: best,
                total: modulesPath.modules,
                percentage: modulesPath.modules > 0 ? Math.round((best / modulesPath.modules) * 100) : 0,
              };
            }
            setProgressMap(updatedMap);
            setStats(loadUnifiedStats(updatedMap));
          }
        } catch {
          // API unavailable — localStorage data is the fallback
        }
      })();
    }
  }, [user?.userId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href="/portal/admin"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={18} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    Academy
                  </h1>
                  <p className="text-sm text-neutral-400">
                    Choose a training program to get started
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/command-center"
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-green/20 to-emerald-500/20 hover:from-brand-green/30 hover:to-emerald-500/30 border border-brand-green/30 text-brand-green text-sm font-medium transition-all"
                >
                  <Command size={16} />
                  RoofStack HQ
                </Link>
                <Link
                  href="/"
                  target="_blank"
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 text-sm transition-colors"
                >
                  <Home size={16} />
                  View Site
                </Link>
                <SettingsMenu />
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-8">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-brand-green/20 to-emerald-500/20 border border-brand-green/20 flex items-center justify-center">
              <GraduationCap size={32} className="text-brand-green" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">
              RoofStack Academy
            </h2>
            <p className="text-neutral-400 max-w-2xl mx-auto">
              {user?.role && visiblePaths.length < trainingPaths.length
                ? `Showing ${visiblePaths.length} training programs relevant to your role. `
                : ''}
              Whether you are a new sales hire learning the ropes, a team member getting
              familiar with the platform, or looking to level up with RoofStack Academy
              -- we have a program for you.
            </p>
          </div>

          {/* ================================================================ */}
          {/* UNIFIED PROGRESS DASHBOARD                                       */}
          {/* ================================================================ */}
          {mounted && (
            <div className="mb-10 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent p-6">
              <div className="flex flex-col lg:flex-row items-center gap-6">
                {/* Progress Ring */}
                <div className="relative flex-shrink-0">
                  <ProgressRing percentage={stats.overallPercentage} size={100} strokeWidth={8} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <span className="text-2xl font-bold text-white">{stats.overallPercentage}%</span>
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="flex-1 w-full">
                  <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                    <BarChart3 size={18} className="text-brand-green" />
                    Your Training Progress
                  </h3>
                  <p className="text-sm text-neutral-400 mb-4">
                    {stats.totalCompleted} of {stats.totalModules} modules completed across all programs
                  </p>

                  {/* Overall progress bar */}
                  <div className="w-full h-3 rounded-full bg-white/5 mb-4 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-green to-emerald-400 transition-all duration-1000 ease-out"
                      style={{ width: `${stats.overallPercentage}%` }}
                    />
                  </div>

                  {/* Stat cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-center">
                      <div className="text-xl font-bold text-brand-green">{stats.points}</div>
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mt-0.5">Points</div>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-center">
                      <div className="text-xl font-bold text-white">{stats.totalCompleted}</div>
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mt-0.5">Completed</div>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Flame size={16} className={stats.streak > 0 ? 'text-orange-400' : 'text-neutral-600'} />
                        <span className={`text-xl font-bold ${stats.streak > 0 ? 'text-orange-400' : 'text-neutral-600'}`}>
                          {stats.streak}
                        </span>
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mt-0.5">Day Streak</div>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-center">
                      {stats.salesCertified ? (
                        <>
                          <div className="flex items-center justify-center">
                            <Award size={20} className="text-yellow-400" />
                          </div>
                          <div className="text-[10px] uppercase tracking-wider text-yellow-400 mt-0.5">Sales Certified</div>
                        </>
                      ) : (
                        <>
                          <div className="text-xl font-bold text-neutral-500">--</div>
                          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mt-0.5">Not Yet Certified</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Per-path mini progress bars */}
              <div className="mt-6 pt-5 border-t border-white/5">
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
                  Progress by Program
                </h4>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {visiblePaths.map((path) => {
                    const p = progressMap[path.href] || { completed: 0, total: path.modules, percentage: 0 };
                    return (
                      <div key={path.href} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 bg-white/5">
                          <path.icon size={12} className={path.iconColor} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs text-neutral-300 truncate">{path.title}</span>
                            <span className="text-[10px] text-neutral-500 ml-2 flex-shrink-0">
                              {p.completed}/{p.total}
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${path.progressBarColor} transition-all duration-700 ease-out`}
                              style={{ width: `${p.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Points breakdown tooltip */}
              <div className="mt-4 pt-4 border-t border-white/5">
                <details className="group">
                  <summary className="cursor-pointer text-xs text-neutral-500 hover:text-neutral-300 transition-colors flex items-center gap-1">
                    <TrendingUp size={12} />
                    How points are calculated
                    <ChevronDown size={12} className="group-open:hidden" />
                    <ChevronUp size={12} className="hidden group-open:inline" />
                  </summary>
                  <div className="mt-2 grid gap-1.5 text-xs text-neutral-400">
                    <div className="flex justify-between">
                      <span>Module completed</span>
                      <span className="text-brand-green font-medium">+10 pts</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sales quiz passed</span>
                      <span className="text-brand-green font-medium">+25 pts</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sales certification (all 7 modules)</span>
                      <span className="text-brand-green font-medium">+50 pts</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Daily login</span>
                      <span className="text-brand-green font-medium">+5 pts</span>
                    </div>
                    <div className="flex justify-between">
                      <span>7-day streak bonus</span>
                      <span className="text-brand-green font-medium">+25 pts</span>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* LEADERBOARD TOGGLE                                               */}
          {/* ================================================================ */}
          <div className="mb-8">
            <button
              onClick={() => setShowLeaderboard(!showLeaderboard)}
              className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border border-yellow-500/20 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 hover:from-yellow-500/15 hover:to-amber-500/15 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                  <Trophy size={20} className="text-yellow-400" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-bold text-white">Training Leaderboard</h3>
                  <p className="text-xs text-neutral-400">See how you rank against the team</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {mounted && stats.points > 0 && (
                  <span className="text-sm font-bold text-brand-green">{stats.points} pts</span>
                )}
                {showLeaderboard ? (
                  <ChevronUp size={18} className="text-neutral-400 group-hover:text-white transition-colors" />
                ) : (
                  <ChevronDown size={18} className="text-neutral-400 group-hover:text-white transition-colors" />
                )}
              </div>
            </button>

            {showLeaderboard && (
              <div className="mt-4">
                <Leaderboard showUserComparison={true} />
              </div>
            )}
          </div>

          {/* ================================================================ */}
          {/* TRAINING PATH CARDS (with progress bars)                         */}
          {/* ================================================================ */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visiblePaths.map((path) => {
              const Icon = path.icon;
              const p = progressMap[path.href] || { completed: 0, total: path.modules, percentage: 0 };
              const isComplete = p.percentage >= 100;

              return (
                <Link
                  key={path.href}
                  href={path.href}
                  className={`group block rounded-2xl border ${path.borderColor} bg-gradient-to-br ${path.color} p-6 hover:scale-[1.02] transition-all duration-200 relative overflow-hidden`}
                >
                  {/* Completion badge */}
                  {isComplete && mounted && (
                    <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-brand-green flex items-center justify-center shadow-lg shadow-brand-green/25">
                      <CheckCircle2 size={16} className="text-black" />
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-black/30 flex items-center justify-center">
                      <Icon size={24} className={path.iconColor} />
                    </div>
                    {!isComplete && (
                      <ArrowRight
                        size={20}
                        className="text-neutral-500 group-hover:text-white group-hover:translate-x-1 transition-all"
                      />
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1">{path.title}</h3>
                  <p className="text-sm text-neutral-300 mb-3">{path.subtitle}</p>
                  <p className="text-sm text-neutral-400 mb-4 line-clamp-3">
                    {path.description}
                  </p>

                  {/* Progress bar */}
                  {mounted && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-neutral-400">
                          {p.completed}/{p.total} completed
                        </span>
                        <span className={`text-xs font-medium ${p.percentage >= 100 ? 'text-brand-green' : 'text-neutral-500'}`}>
                          {p.percentage}%
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-black/30 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${path.progressBarColor} transition-all duration-700 ease-out`}
                          style={{ width: `${p.percentage}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <BookOpen size={12} />
                      {path.modules} modules
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap size={12} />
                      {path.estimatedTime}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {path.audience}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Quick Info */}
          <div className="mt-12 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              How Training Works
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-green/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-brand-green font-bold text-sm">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Choose a Program</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Select the training path that matches your role and goals.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-green/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-brand-green font-bold text-sm">2</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Complete Modules</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Work through each module at your own pace. Pass quizzes to advance.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-green/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-brand-green font-bold text-sm">3</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Earn Points & Get Certified</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Earn points for every module, climb the leaderboard, and earn certifications.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
