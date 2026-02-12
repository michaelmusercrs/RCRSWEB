'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, Users, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { canManageLeadDistro } from '@/lib/team-roles';
import RepAvailabilityToggle from './RepAvailabilityToggle';
import LeadTimerBadge from './LeadTimerBadge';
import LeadCard from './LeadCard';

// ------------------------------------------------------------------
// Type definitions
// ------------------------------------------------------------------

interface RepMetrics {
  repSlug: string;
  repName: string;
  totalLeads: number;
  totalLeads30d: number;
  respondedLeads: number;
  missedLeads: number;
  closeRate: number;
  avgResponseMinutes: number;
  isReceivingLeads: boolean;
  adminPaused: boolean;
  autoResumeAt: string | null;
}

interface TimerState {
  leadId: string;
  repSlug: string;
  customerName: string;
  assignedAt: string;
  reminderSent: boolean;
  warningSent: boolean;
  firstContactAt?: string;
  responseMinutes?: number;
}

interface DistributionHistoryEntry {
  logId: string;
  customerName: string;
  address: string;
  assignedRep: string;
  assignedRepName: string;
  method: string;
  timestamp: string;
  scores?: Record<string, number>;
}

interface MetricsResponse {
  kpi: {
    totalLeads: number;
    totalLeads30d: number;
    conversionRate: number;
    avgResponseMinutes: number;
    activeTimers: number;
    leadsToday: number;
  };
  repMetrics: RepMetrics[];
  activeTimers: TimerState[];
  recentDistributions: DistributionHistoryEntry[];
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

interface ManagerLeadDashboardProps {
  className?: string;
}

export default function ManagerLeadDashboard({ className }: ManagerLeadDashboardProps) {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canManage = user ? canManageLeadDistro(user.role) : false;

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/leads/metrics');
      if (!res.ok) throw new Error('Failed to fetch metrics');
      const data = await res.json();
      setMetrics(data.data || data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ------------------------------------------------------------------
  // Rep availability toggle handler
  // ------------------------------------------------------------------

  const handleRepToggle = useCallback(
    async (repSlug: string, newState: boolean, reason?: string, autoResumeHours?: number) => {
      try {
        const res = await fetch('/api/leads/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repAvailability: {
              repSlug,
              isReceivingLeads: newState,
              reason,
              autoResumeHours,
            },
          }),
        });
        if (!res.ok) throw new Error('Failed to update availability');
        await fetchData();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update');
      }
    },
    [fetchData]
  );

  // ------------------------------------------------------------------
  // Loading state
  // ------------------------------------------------------------------

  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse h-48" />
        <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse h-32" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse h-24" />
          ))}
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Error state
  // ------------------------------------------------------------------

  if (error && !metrics) {
    return (
      <div className={cn('bg-red-50 border border-red-200 rounded-lg p-6', className)}>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={20} className="text-red-500" />
          <h3 className="font-semibold text-red-700">Failed to Load Dashboard</h3>
        </div>
        <p className="text-sm text-red-600 mb-4">{error}</p>
        <button
          onClick={() => { setLoading(true); setError(null); fetchData(); }}
          className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const repMetrics = metrics?.repMetrics || [];
  const activeTimers = metrics?.activeTimers || [];
  const recentDistributions = metrics?.recentDistributions || [];

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className={cn('space-y-6', className)}>
      {/* Error banner (non-fatal) */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-sm text-red-600">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-xs text-red-400 hover:text-red-600">
            Dismiss
          </button>
        </div>
      )}

      {/* Rep Availability Toggles */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Rep Availability</h3>
        <div className="space-y-2">
          {repMetrics.map((rep) => (
            <RepAvailabilityToggle
              key={rep.repSlug}
              repSlug={rep.repSlug}
              repName={rep.repName}
              isReceivingLeads={rep.isReceivingLeads}
              adminPaused={rep.adminPaused}
              autoResumeAt={rep.autoResumeAt}
              onToggle={handleRepToggle}
              canManage={canManage}
            />
          ))}
          {repMetrics.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No reps found</p>
          )}
        </div>
      </div>

      {/* Active Response Timers */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Active Response Timers</h3>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
        {activeTimers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {activeTimers.map((timer) => (
              <div
                key={timer.leadId}
                className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {timer.customerName}
                  </span>
                  <LeadTimerBadge
                    assignedAt={timer.assignedAt}
                    reminderSent={timer.reminderSent}
                    warningSent={timer.warningSent}
                    contacted={!!timer.firstContactAt}
                    responseMinutes={timer.responseMinutes}
                  />
                </div>
                <div className="text-xs text-gray-400">
                  Rep: {timer.repSlug}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <Timer size={24} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No active timers</p>
          </div>
        )}
      </div>

      {/* Recent Leads */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Leads</h3>
        {recentDistributions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentDistributions.slice(0, 20).map((entry) => (
              <LeadCard
                key={entry.logId}
                logId={entry.logId}
                customerName={entry.customerName}
                address={entry.address}
                assignedRep={entry.assignedRep}
                assignedRepName={entry.assignedRepName}
                method={entry.method}
                timestamp={entry.timestamp}
                // No scores for manager view
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <Users size={24} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No recent leads</p>
          </div>
        )}
      </div>
    </div>
  );
}
