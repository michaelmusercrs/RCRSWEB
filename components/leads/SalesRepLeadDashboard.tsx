'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, RefreshCw, Timer, Users,
  Save, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { TEAM_MEMBERS } from '@/lib/team-roles';
import LeadTimerBadge from './LeadTimerBadge';
import LeadCard from './LeadCard';

// ------------------------------------------------------------------
// Type definitions
// ------------------------------------------------------------------

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

interface RepMetricsData {
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

interface MetricsResponse {
  kpi: {
    totalLeads: number;
    totalLeads30d: number;
    conversionRate: number;
    avgResponseMinutes: number;
    activeTimers: number;
    leadsToday: number;
  };
  repMetrics: RepMetricsData[];
  activeTimers: TimerState[];
  recentDistributions: DistributionHistoryEntry[];
}

interface ConfigResponse {
  counties: string[];
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

interface SalesRepLeadDashboardProps {
  className?: string;
}

export default function SalesRepLeadDashboard({ className }: SalesRepLeadDashboardProps) {
  const { user } = useAuth();

  // Determine rep slug from logged-in user
  const member = TEAM_MEMBERS.find(m => m.email === user?.email);
  const repSlug = member?.slug || '';

  // State
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [configCounties, setConfigCounties] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rep-specific state
  const [myMetrics, setMyMetrics] = useState<RepMetricsData | null>(null);
  const [myTimers, setMyTimers] = useState<TimerState[]>([]);
  const [myLeads, setMyLeads] = useState<DistributionHistoryEntry[]>([]);

  // Editable preferences
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]);
  const [maxLeadsPerDay, setMaxLeadsPerDay] = useState<number>(10);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsDirty, setPrefsDirty] = useState(false);

  // Self-toggle state
  const [toggling, setToggling] = useState(false);

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    if (!repSlug) {
      setLoading(false);
      setError('Could not identify your sales rep profile. Please contact an admin.');
      return;
    }

    try {
      const [metricsRes, configRes] = await Promise.all([
        fetch(`/api/leads/metrics?repSlug=${encodeURIComponent(repSlug)}`),
        fetch('/api/leads/config'),
      ]);

      if (!metricsRes.ok) throw new Error('Failed to fetch metrics');
      if (!configRes.ok) throw new Error('Failed to fetch config');

      const metricsData: MetricsResponse = await metricsRes.json().then(d => d.data || d);
      const configData = await configRes.json().then(d => d.data || d);

      setMetrics(metricsData);
      setConfigCounties(configData.counties || []);

      // Extract my metrics
      const mine = metricsData.repMetrics?.find(r => r.repSlug === repSlug) || null;
      setMyMetrics(mine);

      // Filter timers for this rep
      const timers = (metricsData.activeTimers || []).filter(t => t.repSlug === repSlug);
      setMyTimers(timers);

      // Filter leads for this rep
      const leads = (metricsData.recentDistributions || []).filter(
        d => d.assignedRep === repSlug
      );
      setMyLeads(leads);

      // Initialize county preferences from the metrics data if available
      // (the API might return county preferences in the repMetrics or separately)
      if (configData.counties && !prefsDirty) {
        // Default: all counties selected (can be refined by API data)
        setSelectedCounties(configData.counties);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [repSlug, prefsDirty]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ------------------------------------------------------------------
  // Self-toggle availability
  // ------------------------------------------------------------------

  const handleSelfToggle = async () => {
    if (!myMetrics || myMetrics.adminPaused) return;

    setToggling(true);
    try {
      const res = await fetch('/api/leads/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repAvailability: {
            repSlug,
            isReceivingLeads: !myMetrics.isReceivingLeads,
          },
        }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setToggling(false);
    }
  };

  // ------------------------------------------------------------------
  // County toggle
  // ------------------------------------------------------------------

  const handleCountyToggle = (county: string) => {
    setSelectedCounties(prev => {
      if (prev.includes(county)) {
        return prev.filter(c => c !== county);
      }
      return [...prev, county];
    });
    setPrefsDirty(true);
  };

  // ------------------------------------------------------------------
  // Save preferences
  // ------------------------------------------------------------------

  const handleSavePrefs = async () => {
    setPrefsSaving(true);
    try {
      const res = await fetch('/api/leads/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repPreferences: {
            repSlug,
            counties: selectedCounties,
            maxLeadsPerDay,
          },
        }),
      });
      if (!res.ok) throw new Error('Failed to save preferences');
      setPrefsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setPrefsSaving(false);
    }
  };

  // ------------------------------------------------------------------
  // Loading state
  // ------------------------------------------------------------------

  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse h-24" />
        <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse h-48" />
        <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse h-32" />
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Error state (no data)
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

  const isReceiving = myMetrics?.isReceivingLeads ?? false;
  const isAdminPaused = myMetrics?.adminPaused ?? false;

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

      {/* Availability status */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Lead Receiving Status</h3>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold',
                  isReceiving
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                )}
              >
                You are {isReceiving ? 'ON' : 'OFF'} for receiving leads
              </span>
            </div>
          </div>

          {/* Self-toggle button */}
          {!isAdminPaused && (
            <button
              onClick={handleSelfToggle}
              disabled={toggling}
              className={cn(
                'relative w-14 h-7 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
                isReceiving ? 'bg-green-500' : 'bg-red-400',
                toggling && 'opacity-50'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transform transition-transform duration-200',
                  isReceiving ? 'translate-x-7' : 'translate-x-0'
                )}
              />
            </button>
          )}
        </div>

        {/* Admin paused alert */}
        {isAdminPaused && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
            <span className="text-sm text-amber-700">
              Lead receiving <strong>PAUSED by admin</strong>. Contact Chris or Michael.
            </span>
          </div>
        )}
      </div>

      {/* Active timers for this rep (prominent display) */}
      {myTimers.length > 0 && (
        <div className="bg-white rounded-lg border-2 border-amber-300 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-amber-800">
              Your Active Leads - Respond Now
            </h3>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {myTimers.map((timer) => (
              <div
                key={timer.leadId}
                className="bg-amber-50 rounded-lg border border-amber-200 p-3"
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
                <div className="text-xs text-gray-500 mt-1">
                  Lead ID: {timer.leadId}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Active Leads */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">My Leads</h3>
        {myLeads.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myLeads.map((entry) => (
              <LeadCard
                key={entry.logId}
                logId={entry.logId}
                customerName={entry.customerName}
                address={entry.address}
                assignedRep={entry.assignedRep}
                assignedRepName={entry.assignedRepName}
                method={entry.method}
                timestamp={entry.timestamp}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <Users size={24} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No leads assigned to you yet</p>
          </div>
        )}
      </div>

      {/* County Preferences */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">County Preferences</h3>
          <button
            onClick={handleSavePrefs}
            disabled={prefsSaving || !prefsDirty}
            className={cn(
              'inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              prefsSaving || !prefsDirty
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            )}
          >
            <Save size={12} />
            {prefsSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Select which counties you want to receive leads from.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {configCounties.map((county) => (
            <label
              key={county}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors text-sm',
                selectedCounties.includes(county)
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              <input
                type="checkbox"
                checked={selectedCounties.includes(county)}
                onChange={() => handleCountyToggle(county)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="truncate">{county}</span>
            </label>
          ))}
        </div>
        {configCounties.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No counties configured</p>
        )}
      </div>

      {/* Max Leads Per Day */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Max Leads Per Day</h3>
        <div className="flex items-center gap-4">
          <input
            type="number"
            value={maxLeadsPerDay}
            onChange={(e) => {
              setMaxLeadsPerDay(Math.max(1, Number(e.target.value)));
              setPrefsDirty(true);
            }}
            min="1"
            max="50"
            className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-500">leads per day</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          You will stop receiving new leads once this daily limit is reached.
        </p>
      </div>
    </div>
  );
}
