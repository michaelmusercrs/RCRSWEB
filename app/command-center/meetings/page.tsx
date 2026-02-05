'use client';

/**
 * RCRS Command Center - Monday Meeting System Hub
 *
 * Central hub for managing Monday meetings. Displays:
 * - Next meeting countdown
 * - Quick action buttons
 * - Meeting agenda preview (18 slides)
 * - Statistics cards
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
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
    opener: 'bg-blue-500/20 text-blue-400',
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
// Main Page Component
// =============================================================================

export default function MeetingsPage() {
  const [config, setConfig] = useState<MeetingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="grid gap-4 md:grid-cols-3">
        <QuickActionButton
          icon={Play}
          label="Launch Presentation"
          description="Open meeting system in new tab"
          href="https://rcrs-meeting-system.vercel.app"
          variant="primary"
          external
        />
        <QuickActionButton
          icon={FileText}
          label="Prep Meeting"
          description="Prepare content for next meeting"
          href="/command-center/meetings/prep"
          variant="secondary"
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

      {/* Meeting Agenda Preview */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Meeting Agenda</h2>
            <p className="text-sm text-zinc-500">18 slides - {totalDuration} estimated</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-400">Opener</span>
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
