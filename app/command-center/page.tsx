'use client';

/**
 * RCRS Command Center - Dashboard Page
 *
 * The main landing page for the Command Center. Shows role-appropriate
 * widgets and quick stats for the logged-in user.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Package,
  Phone,
  Calendar,
  Users,
  DollarSign,
  ArrowRight,
  BarChart3,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { StatCard } from '@/components/command-center/StatCard';
import { RoleBadge } from '@/components/command-center/RoleBadge';
import { cn } from '@/lib/utils';

// Quick action card component
interface QuickActionCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  color: 'lime' | 'blue' | 'purple' | 'orange' | 'red' | 'cyan';
}

function QuickActionCard({
  title,
  description,
  href,
  icon,
  color,
}: QuickActionCardProps) {
  const colorClasses = {
    lime: 'bg-lime-500/10 text-lime-400 group-hover:bg-lime-500/20',
    blue: 'bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20',
    orange: 'bg-orange-500/10 text-orange-400 group-hover:bg-orange-500/20',
    red: 'bg-red-500/10 text-red-400 group-hover:bg-red-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20',
  };

  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
    >
      <div
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-colors',
          colorClasses[color]
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-white">{title}</h3>
        <p className="mt-0.5 text-sm text-zinc-400">{description}</p>
      </div>
      <ArrowRight
        size={20}
        className="shrink-0 text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-zinc-400"
      />
    </Link>
  );
}

export default function CommandCenterDashboard() {
  const { user } = useAuth();

  // Current time greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-900/50 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {getGreeting()}, {user?.name.split(' ')[0]}!
            </h1>
            <p className="mt-1 text-zinc-400">
              Welcome to your Command Center. Here&apos;s what&apos;s happening today.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <RoleBadge role={user?.role || 'viewer'} size="lg" showDot />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Sales"
          value="$12,450"
          change={8.2}
          icon={DollarSign}
          description="vs yesterday"
        />
        <StatCard
          title="Active Jobs"
          value="24"
          change={3}
          icon={Calendar}
          description="this week"
        />
        <StatCard
          title="Inventory Items"
          value="1,847"
          change={-12}
          icon={Package}
          description="low stock alerts"
          variant="warning"
        />
        <StatCard
          title="Team Members"
          value="18"
          change={2}
          icon={Users}
          description="active today"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">
              Quick Actions
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <QuickActionCard
                title="Sales Leaderboard"
                description="View team rankings and performance"
                href="/command-center/sales"
                icon={<TrendingUp size={24} />}
                color="lime"
              />
              <QuickActionCard
                title="Check Inventory"
                description="View stock levels and alerts"
                href="/command-center/inventory"
                icon={<Package size={24} />}
                color="blue"
              />
              <QuickActionCard
                title="Phone System"
                description="View call logs and voicemails"
                href="/command-center/phone"
                icon={<Phone size={24} />}
                color="purple"
              />
              <QuickActionCard
                title="View Schedule"
                description="Today's jobs and appointments"
                href="/command-center/schedule"
                icon={<Calendar size={24} />}
                color="orange"
              />
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Recent Activity
          </h2>
          <div className="space-y-4">
            {[
              {
                icon: <DollarSign size={16} />,
                color: 'text-lime-400',
                bg: 'bg-lime-500/10',
                text: 'New sale closed',
                detail: '$3,200 - Johnson Residence',
                time: '2 min ago',
              },
              {
                icon: <Package size={16} />,
                color: 'text-orange-400',
                bg: 'bg-orange-500/10',
                text: 'Low stock alert',
                detail: 'Architectural Shingles',
                time: '15 min ago',
              },
              {
                icon: <Phone size={16} />,
                color: 'text-blue-400',
                bg: 'bg-blue-500/10',
                text: 'Missed call',
                detail: '(555) 123-4567',
                time: '32 min ago',
              },
              {
                icon: <Calendar size={16} />,
                color: 'text-purple-400',
                bg: 'bg-purple-500/10',
                text: 'Job completed',
                detail: '1234 Oak Street',
                time: '1 hour ago',
              },
            ].map((activity, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    activity.bg
                  )}
                >
                  <span className={activity.color}>{activity.icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">
                    {activity.text}
                  </p>
                  <p className="text-xs text-zinc-500">{activity.detail}</p>
                </div>
                <span className="shrink-0 text-xs text-zinc-600">
                  {activity.time}
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/command-center/reports"
            className="mt-4 flex items-center gap-1 text-sm font-medium text-lime-400 hover:text-lime-300"
          >
            View all activity
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* Alerts Section */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 shrink-0 text-amber-400" size={20} />
          <div>
            <h3 className="font-medium text-amber-400">Attention Required</h3>
            <p className="mt-1 text-sm text-zinc-400">
              You have <span className="font-semibold text-white">3 pending tasks</span> and{' '}
              <span className="font-semibold text-white">2 follow-up calls</span> scheduled
              for today. Don&apos;t forget to update job statuses before end of day.
            </p>
          </div>
        </div>
      </div>

      {/* Today's Schedule Preview */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Today&apos;s Schedule</h2>
          <Link
            href="/command-center/schedule"
            className="flex items-center gap-1 text-sm font-medium text-lime-400 hover:text-lime-300"
          >
            View full schedule
            <ArrowRight size={16} />
          </Link>
        </div>
        <div className="space-y-3">
          {[
            {
              time: '9:00 AM',
              title: 'Morning Team Standup',
              type: 'Meeting',
              typeColor: 'bg-blue-500/20 text-blue-400',
            },
            {
              time: '10:30 AM',
              title: 'Roof Inspection - 456 Elm St',
              type: 'Job',
              typeColor: 'bg-lime-500/20 text-lime-400',
            },
            {
              time: '1:00 PM',
              title: 'Client Call - Smith Family',
              type: 'Call',
              typeColor: 'bg-purple-500/20 text-purple-400',
            },
            {
              time: '3:30 PM',
              title: 'Material Delivery - Oak Avenue',
              type: 'Delivery',
              typeColor: 'bg-orange-500/20 text-orange-400',
            },
          ].map((event, idx) => (
            <div
              key={idx}
              className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-800/30 p-3"
            >
              <div className="flex items-center gap-2 text-zinc-500">
                <Clock size={14} />
                <span className="text-sm font-medium">{event.time}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {event.title}
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                  event.typeColor
                )}
              >
                {event.type}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Overview */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Weekly Sales Chart Placeholder */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Weekly Sales</h2>
            <BarChart3 size={20} className="text-zinc-500" />
          </div>
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-800/30">
            <p className="text-sm text-zinc-500">
              Chart visualization coming soon
            </p>
          </div>
        </div>

        {/* Top Performers */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Top Performers</h2>
            <Link
              href="/command-center/sales"
              className="text-sm font-medium text-lime-400 hover:text-lime-300"
            >
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {[
              { rank: 1, name: 'Hunter', sales: '$45,200', avatar: 'H' },
              { rank: 2, name: 'Aaron', sales: '$38,750', avatar: 'A' },
              { rank: 3, name: 'Greg', sales: '$32,400', avatar: 'G' },
            ].map((performer) => (
              <div
                key={performer.rank}
                className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-800/30 p-3"
              >
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                    performer.rank === 1
                      ? 'bg-amber-500/20 text-amber-400'
                      : performer.rank === 2
                      ? 'bg-zinc-400/20 text-zinc-300'
                      : 'bg-orange-700/20 text-orange-400'
                  )}
                >
                  {performer.rank}
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-700 text-sm font-semibold text-white">
                  {performer.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{performer.name}</p>
                  <p className="text-xs text-zinc-500">This month</p>
                </div>
                <span className="font-semibold text-lime-400">
                  {performer.sales}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
