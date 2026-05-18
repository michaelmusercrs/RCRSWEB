'use client';

/**
 * RCRS Command Center - Monday Meeting System Hub
 *
 * Central hub for managing Monday meetings. Displays:
 * - Next meeting countdown
 * - Quick action buttons
 * - Auto-updating sales leaderboard
 * - Meeting agenda preview (18 slides)
 * - Statistics cards with period toggles
 *
 * @author RCRS Development Team
 * @version 2.0.0
 */

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  Play,
  FileText,
  Archive,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  BookOpen,
  Cloud,
  Megaphone,
  User,
  BarChart3,
  DollarSign,
  Wallet,
  Trophy,
  Award,
  Target,
  Bell,
  GraduationCap,
  Quote,
  MessageCircle,
  Star,
  PlayCircle,
  Flame,
  Snowflake,
  Crown,
  Medal,
  TrendingUp,
  TrendingDown,
  Presentation,
  Monitor,
} from 'lucide-react';
import { StatCard, LoadingSpinner } from '@/components/command-center';
import { cn } from '@/lib/utils';
import { SLIDES, Slide } from '@/lib/meeting-data';

// =============================================================================
// Types
// =============================================================================

interface MeetingConfig {
  nextMeetingDate: string;
  daysUntilMeeting: number;
  weeksPresented: number;
  lastMeetingDate: string | null;
  currentPrepStatus: 'not-started' | 'in-progress' | 'ready';
  meetingTime: string;
  timezone: string;
  totalSlides: number;
  estimatedDuration: number;
}

interface LeaderboardRep {
  rank: number;
  name: string;
  initials: string;
  avatarColor: string;
  // Sales (accrual from Monday meeting $$$$$ column)
  estimatedSalesAllTime?: number;
  estimatedSalesWeekly?: number;
  estimatedSalesMonthly?: number;
  estimatedSalesYTD?: number;
  // Commission (real QB 1099 payouts)
  actualCommissionsYTD?: number;
  // Backward-compat (deprecated — these mirror estimatedSales*)
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
    tier: string;
  }>;
}

interface LeaderboardData {
  leaderboard: LeaderboardRep[];
  summary: {
    // Sales (accrual) totals
    estimatedSalesAllTime?: number;
    estimatedSalesWeekly?: number;
    estimatedSalesMonthly?: number;
    estimatedSalesYTD?: number;
    // Commission (QB cash) totals
    actualCommissionsYTD?: number;
    // Backward-compat
    totalTeamCommissions: number;
    totalTransactions: number;
    weeklyTotal: number;
    monthlyTotal: number;
    ytdTotal: number;
    avgTeamTransaction: number;
  };
}

type PeriodType = 'week' | 'month' | 'ytd';

// Three Separate Leaderboards (hard rule — never combine these):
//   - sales:      accrual from Monday meeting $$$$$ column (what was sold/approved)
//   - commission: 1099 cash from QuickBooks (what reps actually got paid)
//   - activity:   self-reported activity from RepWeeklyNumbers (doors, appts, etc.)
type LeaderboardView = 'sales' | 'commission' | 'activity';

// Shape returned by /api/command-center/meetings/activity-leaderboard
interface ActivityRep {
  rank: number;
  repName: string;
  initials: string;
  doorsKnocked: number;
  appointmentsSet: number;
  inspectionsCompleted: number;
  estimatesGiven: number;
  contractsSigned: number;
  revenueClosed: number;
  leadsGenerated: number;
  followUpsMade: number;
  weeksReporting: number;
}
interface ActivitySummary {
  totalReps: number;
  totalWeeksReporting: number;
  totalDoorsKnocked: number;
  totalAppointments: number;
  totalContractsSigned: number;
  totalRevenueClosed: number;
}
interface ActivityResponse {
  success: boolean;
  data: { leaderboard: ActivityRep[]; summary: ActivitySummary };
  period?: string;
  recordsInPeriod?: number;
}

// =============================================================================
// Icon Mapping
// =============================================================================

const iconMap: Record<string, React.ElementType> = {
  Play,
  BookOpen,
  Cloud,
  Calendar,
  Megaphone,
  User,
  BarChart3,
  DollarSign,
  Wallet,
  Trophy,
  Award,
  Target,
  Bell,
  GraduationCap,
  Quote,
  MessageCircle,
  Star,
  PlayCircle,
};

// =============================================================================
// Countdown Timer Component
// =============================================================================

interface CountdownTimerProps {
  targetDate: string;
  targetTime: string;
}

function CountdownTimer({ targetDate, targetTime }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const target = new Date(`${targetDate}T10:00:00`);
      const now = new Date();
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      };
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  const formatNumber = (num: number) => num.toString().padStart(2, '0');

  return (
    <div className="flex items-center justify-center gap-4">
      {[
        { value: timeLeft.days, label: 'Days' },
        { value: timeLeft.hours, label: 'Hours' },
        { value: timeLeft.minutes, label: 'Minutes' },
        { value: timeLeft.seconds, label: 'Seconds' },
      ].map(({ value, label }) => (
        <div key={label} className="text-center">
          <div className="bg-zinc-800 rounded-lg px-4 py-3 min-w-[70px]">
            <span className="text-3xl font-bold text-lime-400 font-mono">
              {formatNumber(value)}
            </span>
          </div>
          <span className="text-xs text-zinc-500 mt-1 block">{label}</span>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Quick Action Button Component
// =============================================================================

interface QuickActionButtonProps {
  icon: React.ElementType;
  label: string;
  description: string;
  href?: string;
  onClick?: () => void;
  variant: 'primary' | 'secondary' | 'outline';
  external?: boolean;
}

function QuickActionButton({
  icon: Icon,
  label,
  description,
  href,
  onClick,
  variant,
  external,
}: QuickActionButtonProps) {
  const baseClasses = cn(
    'flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 group',
    variant === 'primary' && 'bg-lime-500/10 border-lime-500/30 hover:bg-lime-500/20 hover:border-lime-500/50',
    variant === 'secondary' && 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600',
    variant === 'outline' && 'bg-transparent border-zinc-700 hover:bg-zinc-800/50 hover:border-zinc-600'
  );

  const iconClasses = cn(
    'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-colors',
    variant === 'primary' && 'bg-lime-500/20 text-lime-400 group-hover:bg-lime-500/30',
    variant === 'secondary' && 'bg-zinc-700 text-zinc-300 group-hover:bg-zinc-600',
    variant === 'outline' && 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700'
  );

  const content = (
    <>
      <div className={iconClasses}>
        <Icon size={24} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-white flex items-center gap-2">
          {label}
          {external && <ExternalLink size={14} className="text-zinc-500" />}
        </h3>
        <p className="text-sm text-zinc-400 mt-0.5">{description}</p>
      </div>
      <ChevronRight
        size={20}
        className="shrink-0 text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-zinc-400"
      />
    </>
  );

  if (href) {
    return external ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={baseClasses}
      >
        {content}
      </a>
    ) : (
      <Link href={href} className={baseClasses}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={baseClasses}>
      {content}
    </button>
  );
}

// =============================================================================
// Slide List Item Component
// =============================================================================

interface SlideListItemProps {
  slide: Slide;
  index: number;
}

function SlideListItem({ slide, index }: SlideListItemProps) {
  const Icon = iconMap[slide.icon] || FileText;
  const duration = slide.duration >= 60
    ? `${Math.floor(slide.duration / 60)}:${(slide.duration % 60).toString().padStart(2, '0')}`
    : `0:${slide.duration.toString().padStart(2, '0')}`;

  const categoryColors: Record<string, string> = {
    opener: 'bg-brand-green/20 text-blue-400',
    business: 'bg-lime-500/20 text-lime-400',
    team: 'bg-purple-500/20 text-purple-400',
    closer: 'bg-orange-500/20 text-orange-400',
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-sm font-bold text-zinc-300">
        {index + 1}
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-700">
        <Icon size={18} className="text-zinc-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate">{slide.name}</p>
        <p className="text-xs text-zinc-500 truncate">{slide.description}</p>
      </div>
      <span className={cn('shrink-0 px-2 py-1 rounded text-xs font-medium', categoryColors[slide.category])}>
        {slide.category}
      </span>
      <div className="shrink-0 text-sm text-zinc-500 font-mono w-12 text-right">
        {duration}
      </div>
    </div>
  );
}

// =============================================================================
// Status Badge Component
// =============================================================================

interface StatusBadgeProps {
  status: 'not-started' | 'in-progress' | 'ready';
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    'not-started': {
      icon: AlertCircle,
      label: 'Not Started',
      classes: 'bg-zinc-700 text-zinc-300',
    },
    'in-progress': {
      icon: RefreshCw,
      label: 'In Progress',
      classes: 'bg-yellow-500/20 text-yellow-400',
    },
    ready: {
      icon: CheckCircle2,
      label: 'Ready',
      classes: 'bg-lime-500/20 text-lime-400',
    },
  };

  const { icon: Icon, label, classes } = config[status];

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium', classes)}>
      <Icon size={14} />
      {label}
    </span>
  );
}

// =============================================================================
// Period Toggle Component
// =============================================================================

interface PeriodToggleProps {
  selected: PeriodType;
  onChange: (period: PeriodType) => void;
}

function PeriodToggle({ selected, onChange }: PeriodToggleProps) {
  const periods: { value: PeriodType; label: string }[] = [
    { value: 'week', label: 'Weekly' },
    { value: 'month', label: 'Monthly' },
    { value: 'ytd', label: 'YTD' },
  ];

  return (
    <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg">
      {periods.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
            selected === value
              ? 'bg-lime-500 text-black'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// Mini Leaderboard Component
// =============================================================================

interface MiniLeaderboardProps {
  leaderboard: LeaderboardRep[];
  period: PeriodType;
  view: LeaderboardView;
  onViewFull: () => void;
}

function MiniLeaderboard({ leaderboard, period, view, onViewFull }: MiniLeaderboardProps) {
  const top5 = leaderboard.slice(0, 5);

  // Pick the right value for each rep based on the active view + period.
  // - Sales: Monday meeting accrual (estimatedSales* with fallback to deprecated *Commissions)
  // - Commission: QB 1099 cash (only YTD has data today)
  // - Activity: not yet wired (handled at the section level — this won't be called)
  const getValue = (rep: LeaderboardRep): number => {
    if (view === 'commission') {
      // QB commission data only available YTD right now
      return rep.actualCommissionsYTD ?? 0;
    }
    // Sales (accrual) view
    switch (period) {
      case 'week':
        return rep.estimatedSalesWeekly ?? rep.weeklyCommissions;
      case 'month':
        return rep.estimatedSalesMonthly ?? rep.monthlyCommissions;
      case 'ytd':
        return rep.estimatedSalesYTD ?? rep.ytdCommissions;
      default:
        return rep.estimatedSalesAllTime ?? rep.totalCommissions;
    }
  };

  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-400" />;
      case 2:
        return <Medal className="h-5 w-5 text-neutral-500" />;
      case 3:
        return <Award className="h-5 w-5 text-orange-500" />;
      default:
        return <span className="text-zinc-500 font-bold">#{rank}</span>;
    }
  };

  return (
    <div className="space-y-3">
      {top5.map((rep) => (
        <div
          key={rep.name}
          className={cn(
            'flex items-center gap-3 p-3 rounded-lg transition-colors',
            rep.isTopPerformer ? 'bg-zinc-800' : 'bg-zinc-800/50 hover:bg-zinc-800'
          )}
        >
          <div className="w-8 flex justify-center">
            {getRankIcon(rep.rank)}
          </div>
          <div
            className={cn(
              'w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-sm font-bold text-white',
              rep.avatarColor
            )}
          >
            {rep.initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white truncate">{rep.name}</span>
              {rep.streak === 'hot' && <Flame className="h-4 w-4 text-orange-400 animate-pulse" />}
              {rep.streak === 'cold' && <Snowflake className="h-4 w-4 text-blue-400" />}
            </div>
            <div className="flex gap-1 mt-0.5">
              {rep.achievements.slice(0, 3).map((a) => (
                <span key={a.id} title={a.name} className="text-sm">
                  {a.icon}
                </span>
              ))}
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-lime-400">{formatCurrency(getValue(rep))}</p>
            <p className="text-xs text-zinc-500">{rep.totalTransactions} deals</p>
          </div>
        </div>
      ))}
      <button
        onClick={onViewFull}
        className="w-full py-2 text-sm font-medium text-lime-400 hover:text-lime-300 flex items-center justify-center gap-1"
      >
        View Full Leaderboard
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// =============================================================================
// Commission Summary Stats Component
// =============================================================================

interface LeaderboardSummaryProps {
  summary: LeaderboardData['summary'];
  period: PeriodType;
  view: LeaderboardView;
}

function LeaderboardSummary({ summary, period, view }: LeaderboardSummaryProps) {
  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  if (view === 'commission') {
    // QB commission: only YTD available today
    return (
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">YTD Paid (QB)</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {formatCurrency(summary.actualCommissionsYTD ?? 0)}
          </p>
        </div>
        <div className="text-center p-3 bg-zinc-800/50 rounded-lg col-span-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Source</p>
          <p className="text-sm font-medium text-zinc-300 mt-1">
            QuickBooks 1099 export · cash paid out, not accrual
          </p>
        </div>
      </div>
    );
  }

  // Sales view (accrual)
  const periodValueAccrual =
    period === 'week'
      ? summary.estimatedSalesWeekly ?? summary.weeklyTotal
      : period === 'month'
        ? summary.estimatedSalesMonthly ?? summary.monthlyTotal
        : summary.estimatedSalesYTD ?? summary.ytdTotal;
  const allTimeAccrual = summary.estimatedSalesAllTime ?? summary.totalTeamCommissions;
  const periodLabel = period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'Year to Date';

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">{periodLabel} (Sales)</p>
        <p className="text-2xl font-bold text-lime-400 mt-1">{formatCurrency(periodValueAccrual)}</p>
      </div>
      <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">All-Time Sales</p>
        <p className="text-2xl font-bold text-white mt-1">{formatCurrency(allTimeAccrual)}</p>
      </div>
      <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Total Transactions</p>
        <p className="text-2xl font-bold text-blue-400 mt-1">{summary.totalTransactions.toLocaleString()}</p>
      </div>
    </div>
  );
}

// =============================================================================
// View Toggle (Sales / Commission / Activity)
// =============================================================================

interface ViewToggleProps {
  selected: LeaderboardView;
  onChange: (view: LeaderboardView) => void;
}

function ViewToggle({ selected, onChange }: ViewToggleProps) {
  const views: Array<{ key: LeaderboardView; label: string; tooltip: string }> = [
    { key: 'sales', label: 'Sales', tooltip: 'Accrual revenue from Monday meeting numbers' },
    { key: 'commission', label: 'Commission', tooltip: 'Actual 1099 payouts from QuickBooks' },
    { key: 'activity', label: 'Activity', tooltip: 'Self-reported activity (doors, appts, etc.)' },
  ];
  return (
    <div className="inline-flex rounded-lg bg-zinc-800 p-1" role="tablist" aria-label="Leaderboard view">
      {views.map(v => (
        <button
          key={v.key}
          role="tab"
          aria-selected={selected === v.key}
          title={v.tooltip}
          onClick={() => onChange(v.key)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
            selected === v.key
              ? 'bg-lime-500/20 text-lime-300'
              : 'text-zinc-400 hover:text-zinc-200',
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function MeetingsPage() {
  const [config, setConfig] = useState<MeetingConfig | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodType>('week');
  const [view, setView] = useState<LeaderboardView>('sales');
  const [activityData, setActivityData] = useState<ActivityResponse | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

  // Fetch meeting configuration
  useEffect(() => {
    async function fetchConfig() {
      try {
        setLoading(true);
        const res = await fetch('/api/command-center/meetings');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || 'Failed to load meeting config');
        }
        setConfig(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, []);

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    try {
      setLeaderboardLoading(true);
      const res = await fetch('/api/command-center/meetings/leaderboard');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json = await res.json();
      if (json.success) {
        setLeaderboardData(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    // Auto-refresh leaderboard every 2 minutes
    const interval = setInterval(fetchLeaderboard, 120000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  // Activity leaderboard — separate endpoint, fetched on demand when the
  // 'activity' view is selected (or when period changes while it's selected)
  const fetchActivity = useCallback(async (selectedPeriod: PeriodType) => {
    try {
      setActivityLoading(true);
      const apiPeriod =
        selectedPeriod === 'week' ? 'thisWeek'
        : selectedPeriod === 'month' ? 'thisMonth'
        : 'thisYear';
      const res = await fetch(
        `/api/command-center/meetings/activity-leaderboard?period=${apiPeriod}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json: ActivityResponse = await res.json();
      if (json.success) setActivityData(json);
    } catch (err) {
      console.error('Failed to fetch activity leaderboard:', err);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'activity') fetchActivity(period);
  }, [view, period, fetchActivity]);

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Calculate agenda duration display
  const totalDuration = useMemo(() => {
    const totalSeconds = SLIDES.reduce((sum, s) => sum + s.duration, 0);
    const minutes = Math.floor(totalSeconds / 60);
    return `${minutes} minutes`;
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Error state
  if (error || !config) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 max-w-md">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Meeting Data</h2>
          <p className="text-zinc-400 mb-4">{error || 'Failed to load configuration'}</p>
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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Calendar className="h-8 w-8 text-lime-400" />
            Monday Meeting System
          </h1>
          <p className="text-zinc-400 mt-1">
            Prepare, present, and manage weekly team meetings
          </p>
        </div>
        <StatusBadge status={config.currentPrepStatus} />
      </div>

      {/* Countdown Section */}
      <div className="rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-900/50 p-6">
        <div className="text-center mb-6">
          <p className="text-zinc-400 text-sm uppercase tracking-wider mb-2">Next Meeting</p>
          <h2 className="text-2xl font-bold text-white">
            {formatDate(config.nextMeetingDate)}
          </h2>
          <p className="text-zinc-500 mt-1">
            {config.meetingTime} {config.timezone}
          </p>
        </div>
        <CountdownTimer
          targetDate={config.nextMeetingDate}
          targetTime={config.meetingTime}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <QuickActionButton
          icon={CheckCircle2}
          label="Finalize Meeting Data"
          description="Verse, weather, numbers - one click finalize"
          href="/command-center/meetings/finalize"
          variant="primary"
        />
        <QuickActionButton
          icon={Monitor}
          label="Presentation Mode"
          description="Full-screen meeting dashboard"
          href="/command-center/meetings/present"
          variant="primary"
        />
        <QuickActionButton
          icon={Play}
          label="View Trip Standings"
          description="Awards trip — live leaderboard"
          href="/trip"
          variant="secondary"
          external
        />
        <QuickActionButton
          icon={FileText}
          label="Prep Meeting"
          description="Prepare content for next meeting"
          href="/command-center/meetings/prep"
          variant="outline"
        />
        <QuickActionButton
          icon={CheckCircle2}
          label="Monday Checklist"
          description="Morning prep checklist for Michael & Sara"
          href="/command-center/meetings/checklist"
          variant="outline"
        />
        <QuickActionButton
          icon={Archive}
          label="View Archives"
          description="Browse past meeting records"
          href="/command-center/meetings/archives"
          variant="outline"
        />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Days Until Meeting"
          value={config.daysUntilMeeting}
          icon={Clock}
          description={config.daysUntilMeeting === 0 ? 'Today!' : config.daysUntilMeeting === 1 ? 'Tomorrow' : 'days away'}
          variant={config.daysUntilMeeting <= 1 ? 'warning' : 'default'}
        />
        <StatCard
          title="Weeks Presented"
          value={config.weeksPresented}
          icon={Calendar}
          description="this year"
        />
        <StatCard
          title="Total Slides"
          value={config.totalSlides}
          icon={FileText}
          description={totalDuration}
        />
        <StatCard
          title="Last Meeting"
          value={config.lastMeetingDate ? new Date(config.lastMeetingDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
          icon={CheckCircle2}
          description="successfully presented"
          variant="success"
        />
      </div>

      {/* Leaderboards — three separate views per hard rule */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Trophy className="h-6 w-6 text-lime-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">
                {view === 'sales' && 'Sales Leaderboard'}
                {view === 'commission' && 'Commission Leaderboard'}
                {view === 'activity' && 'Activity Leaderboard'}
              </h2>
              <p className="text-sm text-zinc-500">
                {view === 'sales' && 'Accrual revenue from Monday meeting $$$$$ column (not cash)'}
                {view === 'commission' && 'Actual 1099 cash paid out — from QuickBooks'}
                {view === 'activity' && 'Self-reported activity from RepWeeklyNumbers'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <ViewToggle selected={view} onChange={setView} />
            {(view === 'sales' || view === 'activity') && <PeriodToggle selected={period} onChange={setPeriod} />}
            <button
              onClick={fetchLeaderboard}
              className={cn(
                'p-2 rounded-lg hover:bg-zinc-800 transition',
                leaderboardLoading && 'animate-spin'
              )}
              title="Refresh data"
            >
              <RefreshCw className="h-5 w-5 text-zinc-400" />
            </button>
          </div>
        </div>
        <div className="p-4">
          {view === 'activity' ? (
            activityLoading && !activityData ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : activityData && activityData.data.leaderboard.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Doors</p>
                    <p className="text-xl font-bold text-lime-400 mt-1">{activityData.data.summary.totalDoorsKnocked.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Appts</p>
                    <p className="text-xl font-bold text-cyan-400 mt-1">{activityData.data.summary.totalAppointments.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Signed</p>
                    <p className="text-xl font-bold text-purple-400 mt-1">{activityData.data.summary.totalContractsSigned.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Closed Rev</p>
                    <p className="text-xl font-bold text-emerald-400 mt-1">${(activityData.data.summary.totalRevenueClosed / 1000).toFixed(1)}K</p>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase">
                    <tr>
                      <th className="text-left py-2">Rank</th>
                      <th className="text-left py-2">Rep</th>
                      <th className="text-right py-2">Doors</th>
                      <th className="text-right py-2">Appts</th>
                      <th className="text-right py-2">Inspect</th>
                      <th className="text-right py-2">Signed</th>
                      <th className="text-right py-2">Rev</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityData.data.leaderboard.slice(0, 10).map(rep => (
                      <tr key={rep.repName} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                        <td className="py-2 font-mono text-zinc-400">#{rep.rank}</td>
                        <td className="py-2 text-white font-medium">{rep.repName}</td>
                        <td className="py-2 text-right text-zinc-300">{rep.doorsKnocked}</td>
                        <td className="py-2 text-right text-zinc-300">{rep.appointmentsSet}</td>
                        <td className="py-2 text-right text-zinc-300">{rep.inspectionsCompleted}</td>
                        <td className="py-2 text-right text-purple-400 font-semibold">{rep.contractsSigned}</td>
                        <td className="py-2 text-right text-emerald-400">${(rep.revenueClosed / 1000).toFixed(0)}K</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-zinc-500 text-center pt-2 border-t border-zinc-800">
                  Self-reported via <code className="text-zinc-400">/portal/sales/weekly-numbers</code> form ·
                  {activityData.recordsInPeriod ?? 0} submissions in period ·
                  Top 10 of {activityData.data.summary.totalReps} reps
                </p>
              </div>
            ) : (
              <div className="text-center py-12 text-zinc-500">
                <Trophy className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No self-reported activity in this period yet.</p>
                <p className="text-xs mt-1">Reps submit via the Weekly Numbers form.</p>
              </div>
            )
          ) : leaderboardLoading && !leaderboardData ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : leaderboardData ? (
            <div className="space-y-6">
              <LeaderboardSummary
                summary={leaderboardData.summary}
                period={period}
                view={view}
              />
              <MiniLeaderboard
                leaderboard={leaderboardData.leaderboard}
                period={period}
                view={view}
                onViewFull={() => window.open('/command-center/meetings/present', '_blank')}
              />
              {view === 'commission' && (
                <p className="text-xs text-zinc-500 text-center pt-2 border-t border-zinc-800">
                  Weekly / monthly commission breakdowns not yet available — QuickBooks
                  exports are monthly. YTD only for now.
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-500">
              <Trophy className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Unable to load leaderboard data</p>
            </div>
          )}
        </div>
      </div>

      {/* Meeting Agenda Preview */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Meeting Agenda</h2>
            <p className="text-sm text-zinc-500">18 slides - {totalDuration} estimated</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded text-xs font-medium bg-brand-green/20 text-blue-400">Opener</span>
            <span className="px-2 py-1 rounded text-xs font-medium bg-lime-500/20 text-lime-400">Business</span>
            <span className="px-2 py-1 rounded text-xs font-medium bg-purple-500/20 text-purple-400">Team</span>
            <span className="px-2 py-1 rounded text-xs font-medium bg-orange-500/20 text-orange-400">Closer</span>
          </div>
        </div>
        <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
          {SLIDES.map((slide, index) => (
            <SlideListItem key={slide.id} slide={slide} index={index} />
          ))}
        </div>
      </div>

      {/* Recent Meeting Notes Placeholder */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Meeting Notes</h2>
          <Link
            href="/command-center/meetings/archives"
            className="text-sm font-medium text-lime-400 hover:text-lime-300 flex items-center gap-1"
          >
            View all
            <ChevronRight size={16} />
          </Link>
        </div>
        <div className="text-center py-8 text-zinc-500">
          <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No meeting notes recorded yet</p>
          <p className="text-xs mt-1">Notes will appear here after meetings are presented</p>
        </div>
      </div>
    </div>
  );
}
