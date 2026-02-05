'use client';

/**
 * RCRS Command Center - Marketing Hub Overview
 *
 * Main marketing dashboard showing campaign summary, quick stats,
 * and Q1 2026 goals with progress tracking.
 *
 * Role-based: Requires marketing.view permission
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Megaphone,
  Mail,
  Image,
  Calendar,
  Target,
  TrendingUp,
  Users,
  DollarSign,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import {
  CAMPAIGN_STATS,
  Q1_GOALS,
  ADS,
  EMAILS,
  CALENDAR_EVENTS,
  getCalendarEventsByMonth,
} from '@/lib/marketing-data';

// Tab configuration
const TABS: Array<{
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
}> = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'ads', label: 'Ads', icon: Image, href: '/command-center/marketing/ads' },
  { id: 'emails', label: 'Emails', icon: Mail, href: '/command-center/marketing/emails' },
  { id: 'calendar', label: 'Calendar', icon: Calendar, href: '/command-center/marketing/calendar' },
];

// Stat card component
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  color: 'lime' | 'blue' | 'purple' | 'orange';
  href?: string;
}

function StatCard({ title, value, icon: Icon, description, color, href }: StatCardProps) {
  const colorClasses = {
    lime: 'bg-lime-500/10 text-lime-400',
    blue: 'bg-blue-500/10 text-blue-400',
    purple: 'bg-purple-500/10 text-purple-400',
    orange: 'bg-orange-500/10 text-orange-400',
  };

  const content = (
    <div className={cn(
      'rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition-all',
      href && 'cursor-pointer hover:border-zinc-700 hover:bg-zinc-800/50'
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          {description && (
            <p className="mt-1 text-sm text-zinc-500">{description}</p>
          )}
        </div>
        <div className={cn('rounded-lg p-3', colorClasses[color])}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// Goal progress component
interface GoalProgressProps {
  label: string;
  target: number;
  current: number;
  unit?: string;
  suffix?: string;
}

function GoalProgress({ label, target, current, unit = '', suffix = '' }: GoalProgressProps) {
  const percentage = Math.min((current / target) * 100, 100);
  const isComplete = percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-300">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">
            {unit}{current}{suffix} / {unit}{target}{suffix}
          </span>
          {isComplete && <CheckCircle2 size={16} className="text-lime-400" />}
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isComplete ? 'bg-lime-500' : 'bg-lime-500/70'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Campaign card component
interface CampaignCardProps {
  title: string;
  status: 'active' | 'scheduled' | 'completed';
  platform: string;
  startDate: string;
  endDate: string;
  progress: number;
}

function CampaignCard({ title, status, platform, startDate, endDate, progress }: CampaignCardProps) {
  const statusColors = {
    active: 'bg-lime-500/20 text-lime-400',
    scheduled: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-zinc-500/20 text-zinc-400',
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium text-white">{title}</h4>
          <p className="mt-1 text-sm text-zinc-500">{platform}</p>
        </div>
        <span className={cn('rounded-full px-2 py-1 text-xs font-medium', statusColors[status])}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
        <Clock size={12} />
        <span>{startDate} - {endDate}</span>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500">Progress</span>
          <span className="text-zinc-400">{progress}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-700">
          <div
            className="h-full rounded-full bg-lime-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function MarketingHubPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = React.useState<'overview'>('overview');

  // Check permission
  const userRole = (user?.role === 'owner' || user?.role === 'admin') ? 'Owner' :
                   user?.role === 'office' ? 'Office' :
                   user?.role === 'driver' ? 'Driver' : 'Sales';
  const canView = hasPermission(userRole as 'Owner' | 'Admin' | 'Manager' | 'Sales' | 'Driver' | 'Office', 'marketing.view');
  const canEdit = hasPermission(userRole as 'Owner' | 'Admin' | 'Manager' | 'Sales' | 'Driver' | 'Office', 'marketing.edit');

  // Get upcoming events
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const upcomingEvents = getCalendarEventsByMonth(currentYear, currentMonth).slice(0, 5);

  // Mock current progress values (in production, these would come from analytics)
  const currentProgress = {
    leadsPerMonth: 127,
    websiteTrafficIncrease: 18,
    socialEngagementIncrease: 12,
    emailOpenRate: 23,
    conversionRate: 10,
    financingApplicationRate: 28,
  };

  if (!canView) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Megaphone className="mx-auto h-12 w-12 text-zinc-600" />
          <h2 className="mt-4 text-xl font-semibold text-white">Access Restricted</h2>
          <p className="mt-2 text-zinc-400">
            You do not have permission to view the Marketing Hub.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Marketing Hub - Q1 2026</h1>
          <p className="mt-1 text-zinc-400">
            Manage campaigns, ads, emails, and content calendar
          </p>
        </div>
        {canEdit && (
          <button className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 font-medium text-zinc-900 transition-colors hover:bg-lime-400">
            <Megaphone size={18} />
            New Campaign
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;

            if (tab.href) {
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={cn(
                    'flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                    'border-transparent text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                  )}
                >
                  <Icon size={18} />
                  {tab.label}
                </Link>
              );
            }

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'overview')}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-lime-500 text-lime-400'
                    : 'border-transparent text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                )}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Campaigns"
          value={CAMPAIGN_STATS.activeCampaigns}
          icon={Megaphone}
          description="Running this quarter"
          color="lime"
        />
        <StatCard
          title="Email Templates"
          value={CAMPAIGN_STATS.emailTemplates}
          icon={Mail}
          description="Ready to send"
          color="purple"
          href="/command-center/marketing/emails"
        />
        <StatCard
          title="Ad Variations"
          value={CAMPAIGN_STATS.adVariations}
          icon={Image}
          description="Across all platforms"
          color="blue"
          href="/command-center/marketing/ads"
        />
        <StatCard
          title="Scheduled Posts"
          value={CAMPAIGN_STATS.scheduledPosts}
          icon={Calendar}
          description="Q1 content calendar"
          color="orange"
          href="/command-center/marketing/calendar"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Q1 Goals */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Q1 2026 Goals</h2>
              <Target size={20} className="text-lime-400" />
            </div>
            <div className="space-y-5">
              <GoalProgress
                label="Leads per Month"
                target={Q1_GOALS.leadsPerMonth}
                current={currentProgress.leadsPerMonth}
              />
              <GoalProgress
                label="Website Traffic Increase"
                target={Q1_GOALS.websiteTrafficIncrease}
                current={currentProgress.websiteTrafficIncrease}
                suffix="%"
              />
              <GoalProgress
                label="Social Engagement Increase"
                target={Q1_GOALS.socialEngagementIncrease}
                current={currentProgress.socialEngagementIncrease}
                suffix="%"
              />
              <GoalProgress
                label="Email Open Rate"
                target={Q1_GOALS.emailOpenRate}
                current={currentProgress.emailOpenRate}
                suffix="%"
              />
              <GoalProgress
                label="Conversion Rate"
                target={Q1_GOALS.conversionRate}
                current={currentProgress.conversionRate}
                suffix="%"
              />
              <GoalProgress
                label="Financing Application Rate"
                target={Q1_GOALS.financingApplicationRate}
                current={currentProgress.financingApplicationRate}
                suffix="%"
              />
            </div>
          </div>
        </div>

        {/* Upcoming Content */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Upcoming Content</h2>
            <Link
              href="/command-center/marketing/calendar"
              className="text-sm font-medium text-lime-400 hover:text-lime-300"
            >
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-800/30 p-3"
                >
                  <div className="mt-0.5 text-xs font-medium text-zinc-500">
                    {new Date(event.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {event.title}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">{event.channel}</p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                      event.type === 'Social' && 'bg-blue-500/20 text-blue-400',
                      event.type === 'Email' && 'bg-purple-500/20 text-purple-400',
                      event.type === 'Blog' && 'bg-amber-500/20 text-amber-400',
                      event.type === 'Ad' && 'bg-lime-500/20 text-lime-400'
                    )}
                  >
                    {event.type}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-center text-sm text-zinc-500">No upcoming events</p>
            )}
          </div>
        </div>
      </div>

      {/* Active Campaigns */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Active Campaigns</h2>
          <TrendingUp size={20} className="text-zinc-500" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CampaignCard
            title="New Year Kickoff"
            status="active"
            platform="Facebook, Instagram, Google"
            startDate="Jan 1"
            endDate="Jan 31"
            progress={75}
          />
          <CampaignCard
            title="3-Minute Financing"
            status="active"
            platform="All Platforms"
            startDate="Jan 9"
            endDate="Mar 31"
            progress={40}
          />
          <CampaignCard
            title="Storm Season Prep"
            status="scheduled"
            platform="Facebook, Google"
            startDate="Mar 1"
            endDate="Mar 31"
            progress={0}
          />
          <CampaignCard
            title="Love Your Home"
            status="scheduled"
            platform="Facebook, Instagram"
            startDate="Feb 1"
            endDate="Feb 28"
            progress={0}
          />
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/command-center/marketing/ads"
          className="group flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2.5 text-blue-400">
              <Image size={20} />
            </div>
            <div>
              <p className="font-medium text-white">Ad Library</p>
              <p className="text-sm text-zinc-500">{ADS.length} variations</p>
            </div>
          </div>
          <ArrowRight
            size={18}
            className="text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-zinc-400"
          />
        </Link>
        <Link
          href="/command-center/marketing/emails"
          className="group flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-500/10 p-2.5 text-purple-400">
              <Mail size={20} />
            </div>
            <div>
              <p className="font-medium text-white">Email Templates</p>
              <p className="text-sm text-zinc-500">{EMAILS.length} templates</p>
            </div>
          </div>
          <ArrowRight
            size={18}
            className="text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-zinc-400"
          />
        </Link>
        <Link
          href="/command-center/marketing/calendar"
          className="group flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-500/10 p-2.5 text-orange-400">
              <Calendar size={20} />
            </div>
            <div>
              <p className="font-medium text-white">Content Calendar</p>
              <p className="text-sm text-zinc-500">{CALENDAR_EVENTS.length} scheduled</p>
            </div>
          </div>
          <ArrowRight
            size={18}
            className="text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-zinc-400"
          />
        </Link>
      </div>

      {/* Key Messaging Pillars */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Q1 Key Messaging Pillars</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-4">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-lime-500/10">
              <Users size={20} className="text-lime-400" />
            </div>
            <h3 className="font-medium text-white">Family-Owned Business</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Personal attention, community values, local decision-making. Not a corporate call center.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-4">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <DollarSign size={20} className="text-blue-400" />
            </div>
            <h3 className="font-medium text-white">3-Minute Financing</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Fast approval, accessible to more homeowners, monthly payments that fit your budget.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-4">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
              <Target size={20} className="text-purple-400" />
            </div>
            <h3 className="font-medium text-white">Storm Damage Specialists</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Rapid response, insurance claim assistance, free inspections, comprehensive repairs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
