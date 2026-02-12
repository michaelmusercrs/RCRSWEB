'use client';

/**
 * RCRS Command Center - Call Logs Dashboard
 *
 * Comprehensive call management page showing:
 * - All calls with filtering
 * - Call analytics and stats
 * - Search by customer/rep
 * - Recording playback (with permissions)
 *
 * Permissions:
 * - phone.viewAll: See all calls
 * - phone.viewRecordings: Access call recordings
 * - phone.manage: Edit call notes/tags
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  Search,
  Filter,
  Download,
  RefreshCw,
  Calendar,
  TrendingUp,
  Users,
  ArrowLeft,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { StatCard } from '@/components/command-center/StatCard';
import { PermissionGate } from '@/components/command-center/PermissionGate';
import { CallHistory, CallRecord } from '@/components/CallHistory';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface CallStats {
  totalCalls: number;
  totalDuration: number;
  inboundCalls: number;
  outboundCalls: number;
  missedCalls: number;
  completedCalls: number;
  averageDuration: number;
  lastUpdated: string;
}

interface CallAnalytics {
  dailyVolume: { date: string; count: number; duration: number }[];
  byRep: { repId: string; repName: string; count: number; avgDuration: number }[];
  byStatus: { status: string; count: number }[];
  peakHours: { hour: number; count: number }[];
}

interface ApiResponse {
  calls: CallRecord[];
  pagination: { total: number; limit: number; offset: number; hasMore: boolean };
  stats: CallStats;
  analytics?: CallAnalytics;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatDuration(seconds: number): string {
  if (seconds === 0) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${secs}s`;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function CallLogsPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();

  // State
  const [calls, setCalls] = React.useState<CallRecord[]>([]);
  const [stats, setStats] = React.useState<CallStats | null>(null);
  const [analytics, setAnalytics] = React.useState<CallAnalytics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [directionFilter, setDirectionFilter] = React.useState('all');
  const [dateRange, setDateRange] = React.useState('7'); // days
  const [repFilter, setRepFilter] = React.useState('all');

  // Pagination
  const [page, setPage] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(true);
  const limit = 50;

  // Permissions
  const canViewAll = hasPermission('phone.viewAll');
  const canViewRecordings = hasPermission('phone.viewRecordings');
  const canManage = hasPermission('phone.manage');

  // Fetch calls
  const fetchCalls = React.useCallback(async (resetPage = false) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(resetPage ? 0 : page * limit));
      params.set('analytics', 'true');
      params.set('analyticsDays', dateRange);

      if (searchQuery) params.set('search', searchQuery);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (directionFilter !== 'all') params.set('direction', directionFilter);
      if (repFilter !== 'all') params.set('repId', repFilter);

      // Date range filter
      if (dateRange !== 'all') {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(dateRange));
        params.set('startDate', startDate.toISOString());
      }

      const response = await fetch(`/api/calls?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch calls');
      }

      const data: ApiResponse = await response.json();

      if (resetPage) {
        setCalls(data.calls);
        setPage(0);
      } else {
        setCalls(prev => [...prev, ...data.calls]);
      }

      setStats(data.stats);
      setAnalytics(data.analytics || null);
      setHasMore(data.pagination.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, statusFilter, directionFilter, dateRange, repFilter]);

  // Initial fetch
  React.useEffect(() => {
    fetchCalls(true);
  }, [searchQuery, statusFilter, directionFilter, dateRange, repFilter]);

  // Refresh handler
  const handleRefresh = () => {
    fetchCalls(true);
  };

  // Load more handler
  const handleLoadMore = () => {
    setPage(prev => prev + 1);
    fetchCalls(false);
  };

  // Get unique reps for filter
  const uniqueReps = React.useMemo(() => {
    const reps = new Map<string, string>();
    calls.forEach(call => {
      if (call.repId && call.repName) {
        reps.set(call.repId, call.repName);
      }
    });
    return Array.from(reps.entries()).map(([id, name]) => ({ id, name }));
  }, [calls]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/command-center/phone"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-white"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Call Logs</h1>
              <p className="text-sm text-zinc-400">
                View and manage all call records
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <PermissionGate permission="phone.manage">
            <button className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white hover:bg-zinc-700">
              <Download size={16} />
              Export
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Total Calls"
            value={stats.totalCalls}
            icon={Phone}
            description="all time"
          />
          <StatCard
            title="Inbound"
            value={stats.inboundCalls}
            icon={PhoneIncoming}
            description="received"
            variant="success"
          />
          <StatCard
            title="Outbound"
            value={stats.outboundCalls}
            icon={PhoneOutgoing}
            description="made"
          />
          <StatCard
            title="Missed"
            value={stats.missedCalls}
            icon={PhoneMissed}
            description="unanswered"
            variant={stats.missedCalls > 10 ? 'warning' : 'default'}
          />
          <StatCard
            title="Avg Duration"
            value={formatDuration(stats.averageDuration)}
            icon={Clock}
            description="per call"
          />
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="text"
              placeholder="Search by name, phone, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-4 text-sm text-white placeholder-zinc-500 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="missed">Missed</option>
            <option value="voicemail">Voicemail</option>
            <option value="in_progress">In Progress</option>
          </select>

          {/* Direction filter */}
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none"
          >
            <option value="all">All Directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>

          {/* Date range filter */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none"
          >
            <option value="1">Today</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>

          {/* Rep filter */}
          {canViewAll && uniqueReps.length > 0 && (
            <select
              value={repFilter}
              onChange={(e) => setRepFilter(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none"
            >
              <option value="all">All Reps</option>
              {uniqueReps.map(rep => (
                <option key={rep.id} value={rep.id}>{rep.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Call List */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Call History
              </h2>
              <span className="text-sm text-zinc-400">
                {calls.length} calls
              </span>
            </div>

            {error ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-400">
                {error}
              </div>
            ) : (
              <>
                <CallHistory
                  calls={calls}
                  showRecordings={canViewRecordings}
                  showRepInfo={canViewAll}
                  showCustomerInfo={true}
                  allowExpand={true}
                  loading={loading && calls.length === 0}
                  emptyMessage="No calls found matching your filters"
                />

                {hasMore && calls.length > 0 && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={handleLoadMore}
                      disabled={loading}
                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
                    >
                      {loading ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : null}
                      Load More
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Analytics Sidebar */}
        <div className="space-y-6">
          {/* Top Reps */}
          {analytics && analytics.byRep.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-4 flex items-center gap-2">
                <Users size={18} className="text-lime-400" />
                <h3 className="font-semibold text-white">Top Reps</h3>
              </div>
              <div className="space-y-3">
                {analytics.byRep.slice(0, 5).map((rep, idx) => (
                  <div
                    key={rep.repId}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-400">
                        {idx + 1}
                      </span>
                      <span className="text-sm text-white">{rep.repName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-lime-400">
                        {rep.count}
                      </span>
                      <span className="ml-1 text-xs text-zinc-500">calls</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Peak Hours */}
          {analytics && analytics.peakHours.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-400" />
                <h3 className="font-semibold text-white">Peak Hours</h3>
              </div>
              <div className="space-y-2">
                {analytics.peakHours.slice(0, 5).map((hour) => {
                  const hourLabel = hour.hour === 0 ? '12 AM' :
                    hour.hour < 12 ? `${hour.hour} AM` :
                    hour.hour === 12 ? '12 PM' :
                    `${hour.hour - 12} PM`;

                  return (
                    <div
                      key={hour.hour}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm text-zinc-400">{hourLabel}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full bg-brand-green"
                            style={{
                              width: `${(hour.count / analytics.peakHours[0].count) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="w-8 text-right text-xs text-zinc-500">
                          {hour.count}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status Breakdown */}
          {analytics && analytics.byStatus.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 size={18} className="text-purple-400" />
                <h3 className="font-semibold text-white">Status Breakdown</h3>
              </div>
              <div className="space-y-2">
                {analytics.byStatus.map((item) => {
                  const colors: Record<string, string> = {
                    completed: 'bg-lime-500',
                    missed: 'bg-red-500',
                    voicemail: 'bg-purple-500',
                    in_progress: 'bg-yellow-500',
                  };

                  const total = analytics.byStatus.reduce((sum, s) => sum + s.count, 0);
                  const percentage = Math.round((item.count / total) * 100);

                  return (
                    <div key={item.status} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize text-zinc-400">
                          {item.status.replace('_', ' ')}
                        </span>
                        <span className="text-zinc-300">
                          {item.count} ({percentage}%)
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className={cn('h-full', colors[item.status] || 'bg-zinc-500')}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
