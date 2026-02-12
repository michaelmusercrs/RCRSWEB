'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, TrendingUp, Clock, Timer,
  Save, RotateCcw, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { canAdminLeadDistro, canManageLeadDistro } from '@/lib/team-roles';
import DistributionCalculator from './DistributionCalculator';
import RepPerformanceTable from './RepPerformanceTable';
import RepAvailabilityToggle from './RepAvailabilityToggle';
import LeadTimerBadge from './LeadTimerBadge';
import LeadCard from './LeadCard';

// ------------------------------------------------------------------
// Type definitions (matching API response shapes)
// ------------------------------------------------------------------

interface KPIMetrics {
  totalLeads: number;
  totalLeads30d: number;
  conversionRate: number;
  avgResponseMinutes: number;
  activeTimers: number;
  leadsToday: number;
}

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

interface LeadDistroConfig {
  weights: {
    installProximity: number;
    contactProximity: number;
    doorKnockRecency: number;
    referralBonus: number;
    meetingAttendance: number;
    closeRate: number;
    responseTime: number;
  };
  thresholds: {
    proximityRadiusMiles: number;
    recentInteractionDays: number;
    staleInteractionDays: number;
    minRepsForDistribution: number;
  };
  responseTimers: {
    reminderMinutes: number;
    warningMinutes: number;
    reassignMinutes: number;
  };
  counties: string[];
  updatedAt: string;
  updatedBy: string;
}

interface MetricsResponse {
  kpi: KPIMetrics;
  repMetrics: RepMetrics[];
  activeTimers: TimerState[];
  recentDistributions: DistributionHistoryEntry[];
}

// ------------------------------------------------------------------
// Default weight keys for iteration
// ------------------------------------------------------------------

const WEIGHT_KEYS: { key: keyof LeadDistroConfig['weights']; label: string }[] = [
  { key: 'installProximity', label: 'Install Proximity' },
  { key: 'referralBonus', label: 'Referral Bonus' },
  { key: 'contactProximity', label: 'Contact Proximity' },
  { key: 'doorKnockRecency', label: 'Door Knock Recency' },
  { key: 'meetingAttendance', label: 'Meeting Attendance' },
  { key: 'closeRate', label: 'Close Rate' },
  { key: 'responseTime', label: 'Response Time' },
];

const DEFAULT_WEIGHTS: LeadDistroConfig['weights'] = {
  installProximity: 25,
  referralBonus: 20,
  contactProximity: 15,
  doorKnockRecency: 10,
  meetingAttendance: 10,
  closeRate: 10,
  responseTime: 10,
};

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

interface OwnerLeadDashboardProps {
  className?: string;
}

export default function OwnerLeadDashboard({ className }: OwnerLeadDashboardProps) {
  const { user } = useAuth();

  // Data state
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [config, setConfig] = useState<LeadDistroConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable config state
  const [editWeights, setEditWeights] = useState<LeadDistroConfig['weights']>(DEFAULT_WEIGHTS);
  const [editThresholds, setEditThresholds] = useState<LeadDistroConfig['thresholds']>({
    proximityRadiusMiles: 15,
    recentInteractionDays: 90,
    staleInteractionDays: 365,
    minRepsForDistribution: 1,
  });
  const [editTimers, setEditTimers] = useState<LeadDistroConfig['responseTimers']>({
    reminderMinutes: 10,
    warningMinutes: 30,
    reassignMinutes: 60,
  });
  const [configSaving, setConfigSaving] = useState(false);
  const [configDirty, setConfigDirty] = useState(false);

  const canAdmin = user ? canAdminLeadDistro(user.role) : false;
  const canManage = user ? canManageLeadDistro(user.role) : false;

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    try {
      const [metricsRes, configRes] = await Promise.all([
        fetch('/api/leads/metrics'),
        fetch('/api/leads/config'),
      ]);

      if (!metricsRes.ok) throw new Error('Failed to fetch metrics');
      if (!configRes.ok) throw new Error('Failed to fetch config');

      const metricsData = await metricsRes.json();
      const configData = await configRes.json();

      setMetrics(metricsData.data || metricsData);
      const cfg = configData.data || configData;
      setConfig(cfg);

      // Sync editable fields with fetched config
      if (cfg.weights) {
        setEditWeights(cfg.weights);
      }
      if (cfg.thresholds) {
        setEditThresholds(cfg.thresholds);
      }
      if (cfg.responseTimers) {
        setEditTimers(cfg.responseTimers);
      }

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
  // Weight editing
  // ------------------------------------------------------------------

  const totalWeight = Object.values(editWeights).reduce((sum, v) => sum + v, 0);
  const weightError = totalWeight !== 100;

  const handleWeightChange = (key: keyof LeadDistroConfig['weights'], value: number) => {
    setEditWeights(prev => ({ ...prev, [key]: value }));
    setConfigDirty(true);
  };

  const handleResetWeights = () => {
    setEditWeights(DEFAULT_WEIGHTS);
    setConfigDirty(true);
  };

  // ------------------------------------------------------------------
  // Save config
  // ------------------------------------------------------------------

  const handleSaveConfig = async () => {
    if (weightError) return;
    setConfigSaving(true);
    try {
      const res = await fetch('/api/leads/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weights: editWeights,
          thresholds: editThresholds,
          responseTimers: editTimers,
        }),
      });
      if (!res.ok) throw new Error('Failed to save config');
      setConfigDirty(false);
      // Refresh data
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setConfigSaving(false);
    }
  };

  // ------------------------------------------------------------------
  // Rep availability toggle
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
        {/* KPI skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-16 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-24" />
            </div>
          ))}
        </div>
        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse h-64" />
          <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse h-64" />
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

  const kpi = metrics?.kpi;
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
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-400 hover:text-red-600"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Leads */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <Users size={20} className="text-blue-600" />
            <span className="text-xs text-gray-400">30d: {kpi?.totalLeads30d ?? 0}</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{kpi?.totalLeads ?? 0}</div>
          <div className="text-sm text-gray-500 mt-1">Total Leads</div>
        </div>

        {/* Conversion Rate */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <TrendingUp size={20} className="text-green-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {(kpi?.conversionRate ?? 0).toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500 mt-1">Conversion Rate</div>
        </div>

        {/* Avg Response Time */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <Clock size={20} className="text-amber-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {(kpi?.avgResponseMinutes ?? 0).toFixed(0)}m
          </div>
          <div className="text-sm text-gray-500 mt-1">Avg Response Time</div>
        </div>

        {/* Active Timers */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <Timer size={20} className="text-red-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{kpi?.activeTimers ?? 0}</div>
          <div className="text-sm text-gray-500 mt-1">Active Timers</div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Distribution Calculator */}
          <DistributionCalculator />

          {/* Algorithm Weights */}
          {canAdmin && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Algorithm Weights</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetWeights}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    <RotateCcw size={12} />
                    Reset
                  </button>
                  <button
                    onClick={handleSaveConfig}
                    disabled={weightError || configSaving || !configDirty}
                    className={cn(
                      'inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                      weightError || configSaving || !configDirty
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    )}
                  >
                    <Save size={12} />
                    {configSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Weight total indicator */}
              <div
                className={cn(
                  'text-xs font-medium mb-3 px-2 py-1 rounded',
                  weightError
                    ? 'bg-red-50 text-red-600'
                    : 'bg-green-50 text-green-600'
                )}
              >
                Total: {totalWeight}/100 {weightError && '(must equal 100)'}
              </div>

              {/* Sliders */}
              <div className="space-y-4">
                {WEIGHT_KEYS.map(({ key, label }) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm text-gray-600">{label}</label>
                      <span className="text-sm font-mono font-medium text-gray-900">
                        {editWeights[key]}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      step="5"
                      value={editWeights[key]}
                      onChange={(e) => handleWeightChange(key, Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Thresholds */}
          {canAdmin && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Thresholds</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Proximity Radius (miles)
                  </label>
                  <input
                    type="number"
                    value={editThresholds.proximityRadiusMiles}
                    onChange={(e) => {
                      setEditThresholds(prev => ({ ...prev, proximityRadiusMiles: Number(e.target.value) }));
                      setConfigDirty(true);
                    }}
                    min="1"
                    max="100"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Recent Days
                  </label>
                  <input
                    type="number"
                    value={editThresholds.recentInteractionDays}
                    onChange={(e) => {
                      setEditThresholds(prev => ({ ...prev, recentInteractionDays: Number(e.target.value) }));
                      setConfigDirty(true);
                    }}
                    min="1"
                    max="365"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Stale Days
                  </label>
                  <input
                    type="number"
                    value={editThresholds.staleInteractionDays}
                    onChange={(e) => {
                      setEditThresholds(prev => ({ ...prev, staleInteractionDays: Number(e.target.value) }));
                      setConfigDirty(true);
                    }}
                    min="1"
                    max="730"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Timer Config */}
          {canAdmin && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Timer Config</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Reminder (min)
                  </label>
                  <input
                    type="number"
                    value={editTimers.reminderMinutes}
                    onChange={(e) => {
                      setEditTimers(prev => ({ ...prev, reminderMinutes: Number(e.target.value) }));
                      setConfigDirty(true);
                    }}
                    min="1"
                    max="120"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Warning (min)
                  </label>
                  <input
                    type="number"
                    value={editTimers.warningMinutes}
                    onChange={(e) => {
                      setEditTimers(prev => ({ ...prev, warningMinutes: Number(e.target.value) }));
                      setConfigDirty(true);
                    }}
                    min="1"
                    max="240"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Reassign (min)
                  </label>
                  <input
                    type="number"
                    value={editTimers.reassignMinutes}
                    onChange={(e) => {
                      setEditTimers(prev => ({ ...prev, reassignMinutes: Number(e.target.value) }));
                      setConfigDirty(true);
                    }}
                    min="1"
                    max="480"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Rep Performance Table */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rep Performance</h3>
            <RepPerformanceTable metrics={repMetrics} />
          </div>

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
        </div>
      </div>

      {/* Full-width: Active Response Timers */}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
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

      {/* Full-width: Recent Distribution History */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Distribution History</h3>
        {recentDistributions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                scores={entry.scores}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <Users size={24} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No recent distributions</p>
          </div>
        )}
      </div>
    </div>
  );
}
