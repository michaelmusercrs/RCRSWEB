'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Save, Loader2, Search, MapPin, Clock, Users,
  Sliders, Settings, History, Eye, AlertTriangle, CheckCircle,
  ToggleLeft, ToggleRight, RefreshCw, Target, Zap, TrendingUp, Info
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import AddressAutocomplete, { AddressResult } from '@/components/AddressAutocomplete';

// Hover-tooltip explainer — used throughout the admin panel to surface
// "what this metric is / how it's calculated / recommended range / what
// changes if you adjust it." Pattern is system-wide per the design memo.
function InfoTooltip({ children, content }: { children: ReactNode; content: ReactNode }) {
  return (
    <span className="relative inline-flex items-center group">
      {children}
      <span className="ml-1.5 inline-flex items-center text-neutral-500 hover:text-neutral-300 transition-colors cursor-help" aria-hidden="false" tabIndex={0}>
        <Info size={13} />
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute z-50 hidden group-hover:block group-focus-within:block bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 px-3 py-2.5 text-xs text-neutral-200 bg-neutral-950 border border-white/10 rounded-lg shadow-2xl text-left whitespace-normal leading-relaxed"
      >
        {content}
      </span>
    </span>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface WeightConfig {
  installProximity: number;
  contactProximity: number;
  doorKnockRecency: number;
  referralBonus: number;
  meetingAttendance: number;
  closeRate: number;
  responseTime: number;
}

interface ThresholdConfig {
  proximityRadiusMiles: number;
  recentInteractionDays: number;
  staleInteractionDays: number;
  minRepsForDistribution: number;
  clearWinnerGapPercent?: number;
  newRepTenureDays?: number;
  newRepDefaultBoost?: number;
}

interface TimerConfig {
  reminderMinutes: number;
  warningMinutes: number;
  urgentWarningMinutes: number;
  reassignMinutes: number;
}

interface LeadDistroConfig {
  weights: WeightConfig;
  weightsEnabled?: Partial<Record<keyof WeightConfig, boolean>>;
  thresholds: ThresholdConfig;
  timers: TimerConfig;
  routingMode?: 'auto' | 'suggest';
  suggestionCount?: number;
}

interface PreviewResult {
  repName: string;
  score: number;
  breakdown: Record<string, number>;
  reason: string;
}

interface PreviewResponse {
  address: string;
  results: PreviewResult[];
  assignedTo: string;
}

interface RepStatus {
  id: string;
  name: string;
  role: string;
  available: boolean;
  activeLeads: number;
  lastActive: string;
}

interface DistributionLog {
  id: string;
  timestamp: string;
  address: string;
  assignedTo: string;
  score: number;
  scores: Record<string, number>;
  method: string;
}

// ── Weight metadata ────────────────────────────────────────────────────────────

interface WeightMeta {
  label: string;
  description: string;
  color: string;
  detail: string;
  recommended: string; // e.g., "20–40%"
  effectUp: string;    // what happens if weight goes up
  effectDown: string;  // what happens if weight goes down
  howCalculated: string;
}

const WEIGHT_META: Record<keyof WeightConfig, WeightMeta> = {
  installProximity: {
    label: 'Install Proximity',
    description: 'Closeness to a completed roof this rep has done',
    color: 'bg-brand-green',
    detail: 'The "we just did your neighbor\'s roof" pitch is the highest-closing line in roofing.',
    recommended: '20–40%',
    howCalculated: 'For each completed install within the proximity radius (default 2mi), score = (1 - distance/radius) × recency_multiplier. The rep\'s install score is the best single value. Recency decays smoothly: 1.0 today → 0.55 at 90d → 0.18 at 1yr → 0.10 floor at 2yr+.',
    effectUp: 'More leads go to reps with recent local installs. Rewards proven local proof.',
    effectDown: 'Reps with strong relationships but no recent installs (referrals, contacts) start winning more.',
  },
  contactProximity: {
    label: 'Contact Proximity',
    description: 'Closeness to this rep\'s existing customer/lead conversations',
    color: 'bg-cyan-500',
    detail: 'Lower weight than installs because contacts didn\'t close — but still signals territory knowledge.',
    recommended: '10–20%',
    howCalculated: 'Same math as install proximity, but counts non-completed records (contact / lead / referral types) within the radius. Best single value wins.',
    effectUp: 'Reps with deep books in an area get more leads, even without recent installs.',
    effectDown: 'Newer or transferring reps with thin contact lists have less of a structural disadvantage.',
  },
  doorKnockRecency: {
    label: 'Door Knock Recency',
    description: 'How recently this rep canvassed the neighborhood',
    color: 'bg-violet-500',
    detail: 'Boots-on-the-ground activity gets credit. Drops to 0 if the rep stops knocking.',
    recommended: '5–15%',
    howCalculated: 'For each door-knock log entry within radius, scored by distance × recency over 90 days. Decays to 0 after 90d.',
    effectUp: 'Active canvassers win more nearby leads — incentivizes physical presence.',
    effectDown: 'Phone-and-referral reps aren\'t penalized for not knocking.',
  },
  referralBonus: {
    label: 'Referral Bonus',
    description: 'Lead came in via this rep\'s referral source',
    color: 'bg-amber-500',
    detail: 'Binary — the bonus applies to the originating rep, or not at all. Honors network-building.',
    recommended: '15–30%',
    howCalculated: 'If the lead\'s source matches this rep as the referrer, full weight is awarded. Otherwise 0.',
    effectUp: 'Strongly rewards reps for bringing in their network. Best for relationship-driven teams.',
    effectDown: 'Algorithm leans more on objective measures (proximity, response) over relationships.',
  },
  meetingAttendance: {
    label: 'Engagement / Attendance',
    description: '% of past assigned leads this rep actually engaged with',
    color: 'bg-emerald-500',
    detail: 'Reps who consistently respond to assigned leads score higher. Monday meeting check-in coming v2.1.',
    recommended: '5–15%',
    howCalculated: '(Responded leads / total assigned leads) over the response log. <3 logs falls to default 0.5 (insufficient data). >90% engagement = 1.0; <25% = 0.1.',
    effectUp: 'Punishes ghosting. Disengaged reps lose ground.',
    effectDown: 'Newer reps without history aren\'t penalized; defaults dominate.',
  },
  closeRate: {
    label: 'Close Rate (Lead Response %)',
    description: 'Lead engagement ratio (proxy for closing skill)',
    color: 'bg-rose-500',
    detail: 'Today uses all assigned leads. Office-source-only filtering ships in v2.1 for a fairer comparison.',
    recommended: '0–10%',
    howCalculated: 'Responded / total ratio mapped linearly to 0–1. <3 logs falls to default 0.5.',
    effectUp: 'Top closers win more — rich-get-richer risk; combine with capacity caps when those ship.',
    effectDown: 'Flatter distribution; outcomes feed back through quarterly recalibration instead.',
  },
  responseTime: {
    label: 'Response Time',
    description: 'Speed of first contact (call/SMS) to new leads',
    color: 'bg-orange-500',
    detail: 'Speed-to-lead under 5min = ~9× more likely to qualify. JN-mined data preferred over portal-logged.',
    recommended: '0–10%',
    howCalculated: 'Avg response in minutes mapped to a curve: ≤15min=1.0, ≤30min=0.8, ≤60min=0.6, ≤2hr=0.4, ≤4hr=0.2, >4hr=0.1. Source priority: JN mined > response log > default 0.5.',
    effectUp: 'Fast reps win more — but easy to game without phone-log verification (planned).',
    effectDown: 'Slower reps don\'t get penalized at the gate; outcome metrics matter more.',
  },
};

function renderWeightTooltip(meta: WeightMeta): ReactNode {
  return (
    <>
      <div className="font-semibold text-white mb-1">{meta.label}</div>
      <div className="text-neutral-300 mb-2">{meta.description}</div>
      <div className="space-y-1.5">
        <div><span className="text-neutral-500">Recommended:</span> <span className="text-emerald-400">{meta.recommended}</span></div>
        <div><span className="text-neutral-500">How calculated:</span> {meta.howCalculated}</div>
        <div><span className="text-neutral-500">If you raise it:</span> {meta.effectUp}</div>
        <div><span className="text-neutral-500">If you lower it:</span> {meta.effectDown}</div>
      </div>
    </>
  );
}

const DEFAULT_CONFIG: LeadDistroConfig = {
  weights: {
    installProximity: 30,
    contactProximity: 15,
    doorKnockRecency: 10,
    referralBonus: 25,
    meetingAttendance: 10,
    closeRate: 5,
    responseTime: 5,
  },
  weightsEnabled: {
    installProximity: true,
    contactProximity: true,
    doorKnockRecency: true,
    referralBonus: true,
    meetingAttendance: true,
    closeRate: true,
    responseTime: true,
  },
  thresholds: {
    proximityRadiusMiles: 2.0,
    recentInteractionDays: 90,
    staleInteractionDays: 730,
    minRepsForDistribution: 2,
    clearWinnerGapPercent: 10,
    newRepTenureDays: 30,
    newRepDefaultBoost: 0.7,
  },
  timers: {
    reminderMinutes: 5,
    warningMinutes: 20,
    urgentWarningMinutes: 45,
    reassignMinutes: 60,
  },
  routingMode: 'auto',
  suggestionCount: 3,
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function LeadDistroAdmin() {
  const { user, isLoading: authLoading, hasPermission } = useAuth();

  // State
  const [config, setConfig] = useState<LeadDistroConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewAddress, setPreviewAddress] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResults, setPreviewResults] = useState<PreviewResponse | null>(null);
  const [history, setHistory] = useState<DistributionLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [repStatus, setRepStatus] = useState<RepStatus[]>([]);
  const [repStatusLoading, setRepStatusLoading] = useState(false);

  // Geocode sync state
  const [geocodeSyncing, setGeocodeSyncing] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState<{
    status: string;
    totalContacts: number;
    geocoded: number;
    skipped: number;
    saved: number;
    errors: number;
    completedAt?: string;
    errorMessage?: string;
  } | null>(null);
  const [geocodeStats, setGeocodeStats] = useState<{
    totalGeocoded: number;
    byType: Record<string, number>;
    byRep: Record<string, number>;
  } | null>(null);

  // ── Computed ───────────────────────────────────────────────────────────────

  // Only ENABLED factors count toward the 100% sum. Dismissed (disabled)
  // factors are excluded from scoring and from the constraint.
  const isFactorEnabled = (k: keyof WeightConfig) =>
    config.weightsEnabled?.[k] !== false;

  const weightSum = (Object.keys(config.weights) as (keyof WeightConfig)[])
    .filter(isFactorEnabled)
    .reduce((a, k) => a + config.weights[k], 0);
  const weightsValid = weightSum === 100;

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/lead-distro/config');
      if (res.ok) {
        const data = await res.json();
        const cfg = data.config || data.data || data;
        // Map config fields to local LeadDistroConfig shape
        setConfig({
          weights: cfg.weights || DEFAULT_CONFIG.weights,
          weightsEnabled: cfg.weightsEnabled || DEFAULT_CONFIG.weightsEnabled,
          thresholds: cfg.thresholds || DEFAULT_CONFIG.thresholds,
          timers: cfg.responseTimers || cfg.timers || DEFAULT_CONFIG.timers,
          routingMode: cfg.routingMode || 'auto',
          suggestionCount: cfg.suggestionCount ?? 3,
        });
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/admin/lead-distro/history?limit=20');
      if (res.ok) {
        const data = await res.json();
        const logs = data.data || data.logs || (Array.isArray(data) ? data : []);
        // Map API log records to DistributionLog interface
        const mapped: DistributionLog[] = logs.map((log: any) => {
          let parsedScores: Record<string, number> = {};
          try {
            parsedScores = typeof log.algorithmScores === 'string'
              ? JSON.parse(log.algorithmScores)
              : log.algorithmScores || log.scores || {};
          } catch { /* ignore */ }

          return {
            id: log.logId || log.id || '',
            timestamp: log.timestamp || '',
            address: log.address || '',
            assignedTo: log.assignedRep || log.assignedTo || '',
            score: typeof parsedScores === 'object'
              ? Object.values(parsedScores).reduce((a: number, b: any) => a + Number(b || 0), 0)
              : 0,
            scores: parsedScores,
            method: log.overrideReason
              ? (log.overrideReason.includes('Manual') ? 'manual' : log.overrideReason.includes('Round') ? 'round_robin' : 'auto')
              : 'auto',
          };
        });
        setHistory(mapped);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadRepStatus = useCallback(async () => {
    setRepStatusLoading(true);
    try {
      const res = await fetch('/api/portal/rep-availability');
      if (res.ok) {
        const data = await res.json();
        const repsData = data.data || data.reps || (Array.isArray(data) ? data : []);
        // Map API response to RepStatus interface
        const mapped: RepStatus[] = repsData.map((r: any) => ({
          id: r.repSlug || r.id,
          name: r.repName || r.name || r.repSlug,
          role: r.role || 'sales',
          available: r.isReceivingLeads === true || r.isReceivingLeads === 'true',
          activeLeads: r.activeLeads || 0,
          lastActive: r.updatedAt || '',
        }));
        setRepStatus(mapped);
      }
    } catch (err) {
      console.error('Failed to load rep status:', err);
    } finally {
      setRepStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadHistory();
    loadRepStatus();
  }, [loadConfig, loadHistory, loadRepStatus]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!weightsValid) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/admin/lead-distro/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            weights: config.weights,
            weightsEnabled: config.weightsEnabled,
            thresholds: config.thresholds,
            responseTimers: config.timers,
            routingMode: config.routingMode,
            suggestionCount: config.suggestionCount,
          },
          updatedBy: user?.name || 'admin',
        }),
      });
      if (res.ok) {
        setSaveMessage({ type: 'success', text: 'Configuration saved successfully.' });
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveMessage({ type: 'error', text: err.error || 'Failed to save configuration.' });
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  const handlePreview = async () => {
    if (!previewAddress.trim()) return;
    setPreviewLoading(true);
    setPreviewResults(null);
    try {
      const res = await fetch('/api/admin/lead-distro/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: previewAddress }),
      });
      if (res.ok) {
        const data = await res.json();
        const scores = data.preview || data.data || [];
        // Map API scores to PreviewResponse
        const results: PreviewResult[] = scores.map((s: any) => ({
          repName: s.repName || s.name || s.repSlug || '',
          score: s.totalScore || s.score || 0,
          breakdown: s.factors ? Object.fromEntries(
            Object.entries(s.factors).map(([k, v]: [string, any]) => [k, v.score || 0])
          ) : {},
          reason: s.isEligible === false ? (s.disqualifyReason || 'Not eligible') : 'Eligible',
        }));
        setPreviewResults({
          address: previewAddress,
          results,
          assignedTo: results.length > 0 ? results[0].repName : 'None',
        });
      }
    } catch (err) {
      console.error('Preview failed:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleWeightChange = (key: keyof WeightConfig, value: number) => {
    setConfig(prev => ({
      ...prev,
      weights: { ...prev.weights, [key]: value },
    }));
  };

  const toggleFactorEnabled = (key: keyof WeightConfig) => {
    setConfig(prev => ({
      ...prev,
      weightsEnabled: {
        ...prev.weightsEnabled,
        [key]: prev.weightsEnabled?.[key] === false ? true : false,
      },
    }));
  };

  const handleThresholdChange = (key: keyof ThresholdConfig, value: number) => {
    setConfig(prev => ({
      ...prev,
      thresholds: { ...prev.thresholds, [key]: value } as ThresholdConfig,
    }));
  };

  const handleTimerChange = (key: keyof TimerConfig, value: number) => {
    setConfig(prev => ({
      ...prev,
      timers: { ...prev.timers, [key]: value },
    }));
  };

  const toggleRepAvailability = async (repId: string) => {
    const rep = repStatus.find(r => r.id === repId);
    if (!rep) return;

    const newAvailable = !rep.available;

    // Optimistic update
    setRepStatus(prev =>
      prev.map(r => r.id === repId ? { ...r, available: newAvailable } : r)
    );

    // Persist to API
    try {
      const res = await fetch('/api/portal/rep-availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repSlug: rep.id,
          isReceivingLeads: newAvailable,
          adminOverride: !newAvailable,
          adminOverrideBy: user?.name || 'admin',
          adminOverrideReason: newAvailable ? 'Re-enabled by admin' : 'Disabled by admin',
        }),
      });
      if (!res.ok) {
        // Revert on failure
        setRepStatus(prev =>
          prev.map(r => r.id === repId ? { ...r, available: !newAvailable } : r)
        );
      }
    } catch {
      // Revert on error
      setRepStatus(prev =>
        prev.map(r => r.id === repId ? { ...r, available: !newAvailable } : r)
      );
    }
  };

  // ── Geocode Sync ─────────────────────────────────────────────────────────

  const loadGeocodeStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/geocode-sync');
      if (res.ok) {
        const data = await res.json();
        if (data.progress) {
          setGeocodeProgress(data.progress);
        }
      }
      // Also load stats from the populate-geocoded endpoint
      const statsRes = await fetch('/api/admin/populate-geocoded');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.data) {
          setGeocodeStats(statsData.data);
        }
      }
    } catch (err) {
      console.error('Failed to load geocode stats:', err);
    }
  }, []);

  const triggerGeocodeSync = async () => {
    setGeocodeSyncing(true);
    setGeocodeProgress(null);
    try {
      const res = await fetch('/api/admin/geocode-sync', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.progress) {
        setGeocodeProgress(data.progress);
      }

      // Poll for progress every 3 seconds
      const pollInterval = setInterval(async () => {
        try {
          const pollRes = await fetch('/api/admin/geocode-sync');
          if (pollRes.ok) {
            const pollData = await pollRes.json();
            if (pollData.progress) {
              setGeocodeProgress(pollData.progress);
              if (pollData.progress.status === 'complete' || pollData.progress.status === 'error' || pollData.progress.status === 'idle') {
                clearInterval(pollInterval);
                setGeocodeSyncing(false);
                loadGeocodeStats();
              }
            }
          }
        } catch {
          clearInterval(pollInterval);
          setGeocodeSyncing(false);
        }
      }, 3000);

      // Safety timeout: stop polling after 10 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setGeocodeSyncing(false);
      }, 600000);
    } catch (err) {
      console.error('Failed to trigger geocode sync:', err);
      setGeocodeSyncing(false);
    }
  };

  useEffect(() => {
    loadGeocodeStats();
  }, [loadGeocodeStats]);

  // ── Auth gate ──────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={32} />
      </div>
    );
  }

  if (!user || !['owner', 'admin'].includes(user.role)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-4 text-red-400" size={48} />
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-neutral-400 mb-6">Only owners and admins can access lead distribution settings.</p>
          <Link
            href="/portal/admin"
            className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 transition-colors"
          >
            Back to Admin
          </Link>
        </div>
      </div>
    );
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
        <div className="fixed inset-0 opacity-30 pointer-events-none">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)',
            backgroundSize: '50px 50px',
          }} />
        </div>
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="animate-spin text-brand-green mx-auto mb-4" size={32} />
            <p className="text-neutral-400">Loading distribution config...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)',
          backgroundSize: '50px 50px',
        }} />
      </div>

      <div className="relative z-10">
        {/* ── Header ──────────────────────────────────────────────────────── */}
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
                  <h1 className="text-xl font-bold text-white tracking-tight">Lead Distribution Settings</h1>
                  <p className="text-sm text-neutral-400">Configure how incoming leads are scored and assigned to sales reps</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/portal/admin/lead-distro/dispatch"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-white/5 hover:bg-white/10 text-neutral-300 transition-colors"
                >
                  <Users size={16} />
                  Dispatch Queue
                </Link>
                <button
                  onClick={handleSave}
                  disabled={saving || !weightsValid}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg ${
                    weightsValid
                      ? 'bg-gradient-to-r from-brand-green to-emerald-500 hover:from-brand-green/90 hover:to-emerald-500/90 text-black shadow-brand-green/25'
                      : 'bg-neutral-700 text-neutral-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* ── Save message toast ──────────────────────────────────────────── */}
        {saveMessage && (
          <div className="max-w-6xl mx-auto px-6 pt-4">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
              saveMessage.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}>
              {saveMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              {saveMessage.text}
            </div>
          </div>
        )}

        <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

          {/* ── Section 0: Routing Mode ─────────────────────────────────── */}
          <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center shrink-0">
                  <Zap size={20} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <InfoTooltip content={
                    <>
                      <div className="font-semibold text-white mb-1">Routing Mode</div>
                      <div className="text-neutral-300 mb-2">Switches between immediate auto-assignment and dispatcher-confirmed suggestions.</div>
                      <div className="space-y-1.5">
                        <div><span className="text-emerald-400">Auto:</span> algorithm winner is assigned in milliseconds. SLA timer starts. Notifications fire. Best for high-volume, repeatable sources.</div>
                        <div><span className="text-violet-400">Suggest:</span> algorithm produces top-N candidates with reasons; held as <code className="text-neutral-400">pending-manager-pick</code> until someone confirms. Best for high-value insurance or complex leads.</div>
                        <div className="pt-1 text-neutral-400">Switchable anytime — existing pending picks keep their state regardless.</div>
                      </div>
                    </>
                  }>
                    <h2 className="text-lg font-semibold text-white">Routing Mode</h2>
                  </InfoTooltip>
                  <p className="text-sm text-neutral-400 mt-0.5">
                    {config.routingMode === 'suggest'
                      ? 'Suggest mode — algorithm surfaces top candidates; a dispatcher confirms each assignment manually.'
                      : 'Auto mode — leads are assigned immediately to the algorithm winner.'}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    <span className="text-neutral-400">Current behavior:</span>{' '}
                    {config.routingMode === 'suggest'
                      ? `Top ${config.suggestionCount ?? 3} candidates surfaced. No assignment until dispatcher confirms. Lead held in pending-pick queue.`
                      : 'Top-scoring rep assigned immediately. SLA timer + notifications fire instantly.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={config.routingMode || 'auto'}
                  onChange={(e) =>
                    setConfig(prev => ({ ...prev, routingMode: e.target.value as 'auto' | 'suggest' }))
                  }
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-all"
                  title="Auto = system assigns immediately. Suggest = top-N candidates surface in dispatch queue for manual confirmation."
                >
                  <option value="auto">Auto-assign</option>
                  <option value="suggest">Suggest (manager picks)</option>
                </select>
                {config.routingMode === 'suggest' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">Top</span>
                    <input
                      type="number"
                      min={2}
                      max={5}
                      value={config.suggestionCount ?? 3}
                      onChange={(e) =>
                        setConfig(prev => ({ ...prev, suggestionCount: Math.max(2, Math.min(5, parseInt(e.target.value) || 3)) }))
                      }
                      className="w-14 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none"
                    />
                    <span className="text-xs text-neutral-500">candidates</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Section 1: Weight Sliders ─────────────────────────────────── */}
          <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-green/10 rounded-xl flex items-center justify-center">
                  <Sliders size={20} className="text-brand-green" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Algorithm Weights</h2>
                  <p className="text-sm text-neutral-400">Adjust how each factor influences lead assignment. Must total 100.</p>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-xl text-sm font-bold tabular-nums ${
                weightsValid
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}>
                {weightSum} / 100
              </div>
            </div>

            <div className="space-y-5">
              {(Object.keys(WEIGHT_META) as (keyof WeightConfig)[]).map((key) => {
                const meta = WEIGHT_META[key];
                const value = config.weights[key];
                const enabled = isFactorEnabled(key);
                return (
                  <div key={key} className={enabled ? '' : 'opacity-40'}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1 min-w-0 flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => toggleFactorEnabled(key)}
                          aria-label={enabled ? `Disable ${meta.label}` : `Enable ${meta.label}`}
                          title={enabled ? 'Dismiss this metric (it will not count toward routing or the 100% sum)' : 'Re-enable this metric'}
                          className="mt-0.5 shrink-0 transition-colors"
                        >
                          {enabled ? (
                            <ToggleRight size={24} className="text-brand-green" />
                          ) : (
                            <ToggleLeft size={24} className="text-neutral-600" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <InfoTooltip content={renderWeightTooltip(meta)}>
                            <span className="text-sm font-medium text-white">{meta.label}</span>
                          </InfoTooltip>
                          {!enabled && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-neutral-700/50 text-neutral-400">DISABLED</span>
                          )}
                          <span className="text-xs text-neutral-500 ml-2">{meta.description}</span>
                          <p className="text-xs text-neutral-600 mt-0.5">
                            {meta.detail}
                            <span className="ml-2 text-neutral-700">· recommended {meta.recommended}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={value}
                          disabled={!enabled}
                          onChange={(e) => handleWeightChange(key, Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                          className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-brand-green/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                        <span className="text-xs text-neutral-500 w-4">%</span>
                      </div>
                    </div>
                    <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-200 ${meta.color}`}
                        style={{ width: enabled ? `${value}%` : '0%' }}
                      />
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={value}
                      disabled={!enabled}
                      onChange={(e) => handleWeightChange(key, parseInt(e.target.value))}
                      className="w-full mt-1 accent-brand-green cursor-pointer opacity-0 hover:opacity-100 focus:opacity-100 h-2 -mt-2 relative z-10 disabled:cursor-not-allowed"
                    />
                  </div>
                );
              })}
            </div>

            {!weightsValid && (
              <div className="mt-4 flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <div>
                  Enabled weights must total exactly 100. Currently {weightSum} ({weightSum > 100 ? `${weightSum - 100} over` : `${100 - weightSum} under`}).
                  <div className="text-xs text-red-400/70 mt-1">
                    Tip: if you just toggled a factor off, redistribute its weight across the remaining enabled factors so they sum to 100. Disabled factors don't count.
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ── Section 2 & 3: Thresholds + Timers (side by side) ─────────── */}
          <div className="grid md:grid-cols-2 gap-8">

            {/* Threshold Settings */}
            <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-brand-green/10 rounded-xl flex items-center justify-center">
                  <Target size={20} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Thresholds</h2>
                  <p className="text-sm text-neutral-400">Distance and interaction limits</p>
                </div>
              </div>

              <div className="space-y-4">
                {([
                  {
                    key: 'proximityRadiusMiles' as const,
                    label: 'Proximity Radius',
                    unit: 'miles',
                    desc: 'Max distance for proximity-based scoring',
                    recommended: '1.0 – 3.0 mi',
                    tooltip: 'Defines how far we look for nearby installs / contacts / door knocks. 2.0 mi is right for Tennessee Valley density. Increase to 3–5 mi for broader territory (Birmingham). Drop to 1.0 mi for dense urban work where literal neighbors matter most.',
                  },
                  {
                    key: 'recentInteractionDays' as const,
                    label: 'Recent Interaction Window',
                    unit: 'days',
                    desc: 'Window inside which contacts count as "fresh"',
                    recommended: '60 – 120 days',
                    tooltip: 'Defines the door-knock recency decay window. The exponential recency curve actually decays smoothly regardless of this value, but this threshold is used inside scoreDoorKnocks. Lower = stricter freshness requirement.',
                  },
                  {
                    key: 'staleInteractionDays' as const,
                    label: 'Stale Interaction Cutoff',
                    unit: 'days',
                    desc: 'Hard cutoff for "too old to count"',
                    recommended: '365 – 1095 days',
                    tooltip: 'Future hard-cutoff for distance gating (anti-gaming). Not currently enforced — the exponential recency curve smoothly floors at 0.10 instead. Reserved for v2.1.',
                  },
                  {
                    key: 'minRepsForDistribution' as const,
                    label: 'Min Eligible Reps',
                    unit: 'reps',
                    desc: 'Floor for the assignment pool',
                    recommended: '2 – 3',
                    tooltip: 'If fewer than this many reps are eligible (available + within county), the assignment errors out instead of force-assigning. Set higher if you want assignment failures to be loud (better than silently slamming one rep).',
                  },
                  {
                    key: 'clearWinnerGapPercent' as const,
                    label: 'Clear-Winner Gap',
                    unit: '%',
                    desc: 'Score gap required to skip the tiebreaker',
                    recommended: '5 – 20 %',
                    tooltip: 'If the top rep\'s score is within this % of the runner-up, treat it as a tie and apply the longest-since-last tiebreaker. Lower = more ties → more even distribution. Higher = top score wins more often → more concentrated.',
                  },
                  {
                    key: 'newRepTenureDays' as const,
                    label: 'New-Rep Window',
                    unit: 'days',
                    desc: 'Days a new rep gets the default-factor boost',
                    recommended: '14 – 60 days',
                    tooltip: 'Reps within this window from their createdAt get a higher default score (per below) on factors that need historical data — attendance, close rate, response time. Sunsets automatically. Keeps new hires from starving while they build a book.',
                  },
                  {
                    key: 'newRepDefaultBoost' as const,
                    label: 'New-Rep Boost Value',
                    unit: '×',
                    desc: 'Default factor score for new reps (vs 0.5)',
                    recommended: '0.6 – 0.8',
                    tooltip: 'The default value (range 0–1) used in place of 0.5 for attendance / close-rate / response-time when the rep is within the new-rep window. 0.7 means they\'re treated as "above-average" by default. Set lower if you want new reps to earn their position from day 1.',
                  },
                ]).map(({ key, label, unit, desc, recommended, tooltip }) => (
                  <div key={key}>
                    <div className="flex items-center mb-1">
                      <InfoTooltip content={
                        <>
                          <div className="font-semibold text-white mb-1">{label}</div>
                          <div className="text-neutral-300 mb-2">{desc}</div>
                          <div className="space-y-1.5">
                            <div><span className="text-neutral-500">Recommended:</span> <span className="text-emerald-400">{recommended}</span></div>
                            <div className="text-neutral-300">{tooltip}</div>
                          </div>
                        </>
                      }>
                        <label className="block text-sm font-medium text-neutral-300">{label}</label>
                      </InfoTooltip>
                    </div>
                    <p className="text-xs text-neutral-500 mb-2">{desc} · recommended {recommended}</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={key === 'newRepDefaultBoost' ? 0 : 1}
                        step={key === 'newRepDefaultBoost' ? 0.05 : 1}
                        max={key === 'newRepDefaultBoost' ? 1 : undefined}
                        value={(config.thresholds as any)[key] ?? ''}
                        onChange={(e) => {
                          const raw = parseFloat(e.target.value);
                          const val = isNaN(raw) ? 0 : raw;
                          handleThresholdChange(key as keyof ThresholdConfig, Math.max(key === 'newRepDefaultBoost' ? 0 : 1, val));
                        }}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-green/50 transition-all"
                      />
                      <span className="text-xs text-neutral-500 w-12">{unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Timer Settings */}
            <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                  <Clock size={20} className="text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Response Timers</h2>
                  <p className="text-sm text-neutral-400">Escalation timeline for unacknowledged leads</p>
                </div>
              </div>

              <div className="space-y-4">
                {([
                  {
                    key: 'reminderMinutes' as const,
                    label: 'Reminder',
                    desc: 'Gentle nudge to the assigned rep',
                    recommended: '3 – 10 min',
                    tooltip: 'Sent to the rep only. Low-pressure. If you make this too short, reps tune out the notifications.',
                    icon: '1',
                  },
                  {
                    key: 'warningMinutes' as const,
                    label: 'Warning',
                    desc: 'Manager cc\'d, rep is on watch',
                    recommended: '15 – 30 min',
                    tooltip: 'Manager gets cc\'d. This is the first sign the lead is at risk. Avoid setting this so close to the reassign timer that the rep has no chance to recover.',
                    icon: '2',
                  },
                  {
                    key: 'urgentWarningMinutes' as const,
                    label: 'Urgent Warning',
                    desc: 'Final "about to lose this lead" alert',
                    recommended: '30 – 60 min',
                    tooltip: 'Last chance for the rep before auto-reassign. Some teams use this stage to require a phone call (vs SMS-only).',
                    icon: '3',
                  },
                  {
                    key: 'reassignMinutes' as const,
                    label: 'Auto-Reassign',
                    desc: 'Lead transfers to next-best rep',
                    recommended: '45 – 90 min',
                    tooltip: 'When this fires, the lead leaves the original rep\'s queue. Don\'t go below 45 min during business hours unless reps have validated the policy. After hours, extend to 2–4 hr.',
                    icon: '4',
                  },
                ]).map(({ key, label, desc, recommended, tooltip, icon }) => (
                  <div key={key} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 text-xs font-bold flex-shrink-0 mt-1">
                      {icon}
                    </div>
                    <div className="flex-1">
                      <InfoTooltip content={
                        <>
                          <div className="font-semibold text-white mb-1">Stage {icon}: {label}</div>
                          <div className="text-neutral-300 mb-2">{desc}</div>
                          <div className="space-y-1.5">
                            <div><span className="text-neutral-500">Recommended:</span> <span className="text-emerald-400">{recommended}</span></div>
                            <div className="text-neutral-300">{tooltip}</div>
                          </div>
                        </>
                      }>
                        <label className="block text-sm font-medium text-neutral-300">{label}</label>
                      </InfoTooltip>
                      <p className="text-xs text-neutral-500 mb-2 mt-1">{desc} · recommended {recommended}</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={config.timers[key]}
                          onChange={(e) => handleTimerChange(key, Math.max(1, parseInt(e.target.value) || 1))}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-green/50 transition-all"
                        />
                        <span className="text-xs text-neutral-500 w-12">min</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <p className="text-xs text-amber-400/80">
                  Timeline: Lead received &rarr; <strong>{config.timers.reminderMinutes}m</strong> reminder &rarr;{' '}
                  <strong>{config.timers.warningMinutes}m</strong> warning &rarr;{' '}
                  <strong>{config.timers.urgentWarningMinutes}m</strong> urgent warning &rarr;{' '}
                  <strong>{config.timers.reassignMinutes}m</strong> reassign to next rep
                </p>
              </div>
            </section>
          </div>

          {/* ── Section 4: Live Preview Panel ─────────────────────────────── */}
          <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center">
                <Eye size={20} className="text-violet-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Live Preview</h2>
                <p className="text-sm text-neutral-400">Simulate lead distribution for any address using current settings</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="flex-1">
                <AddressAutocomplete
                  onAddressSelect={(result: AddressResult) => {
                    setPreviewAddress(result.formattedAddress);
                  }}
                  defaultValue={previewAddress}
                  placeholder="Start typing an address to simulate..."
                  className="!bg-white/5 !border-white/10 !rounded-xl !py-3 focus:!border-violet-500/50 focus:!ring-1 focus:!ring-violet-500/50 !text-sm"
                />
              </div>
              <button
                onClick={handlePreview}
                disabled={previewLoading || !previewAddress.trim()}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {previewLoading ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                Preview
              </button>
            </div>

            {previewResults && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <span className="text-sm text-emerald-400 font-medium">
                    Assigned to: {previewResults.assignedTo}
                  </span>
                  <span className="text-xs text-neutral-500 ml-2">for {previewResults.address}</span>
                </div>

                <div className="grid gap-3">
                  {previewResults.results.map((result, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                        idx === 0
                          ? 'bg-brand-green/5 border-brand-green/20'
                          : 'bg-white/[0.01] border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? 'bg-brand-green/20 text-brand-green' : 'bg-white/5 text-neutral-400'
                        }`}>
                          #{idx + 1}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-white">{result.repName}</span>
                          <p className="text-xs text-neutral-500">{result.reason}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold tabular-nums ${
                          idx === 0 ? 'text-brand-green' : 'text-neutral-400'
                        }`}>
                          {result.score.toFixed(1)}
                        </div>
                        <div className="text-xs text-neutral-500">score</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!previewResults && !previewLoading && (
              <div className="text-center py-8 text-neutral-500 text-sm">
                Enter an address above and click Preview to see simulated results
              </div>
            )}
          </section>

          {/* ── Section 5: Rep Status Table ───────────────────────────────── */}
          <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                  <Users size={20} className="text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Rep Availability</h2>
                  <p className="text-sm text-neutral-400">Toggle reps in or out of the distribution pool</p>
                </div>
              </div>
              <button
                onClick={loadRepStatus}
                disabled={repStatusLoading}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <RefreshCw size={16} className={`text-neutral-400 ${repStatusLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {repStatusLoading && repStatus.length === 0 ? (
              <div className="text-center py-8">
                <Loader2 className="animate-spin text-emerald-400 mx-auto mb-2" size={24} />
                <p className="text-sm text-neutral-500">Loading reps...</p>
              </div>
            ) : repStatus.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 text-sm">
                No sales reps found. Reps will appear here once availability data is available.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider pb-3 pr-4">Rep</th>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider pb-3 pr-4">Role</th>
                      <th className="text-center text-xs font-medium text-neutral-500 uppercase tracking-wider pb-3 pr-4">Active Leads</th>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider pb-3 pr-4">Last Active</th>
                      <th className="text-center text-xs font-medium text-neutral-500 uppercase tracking-wider pb-3">Available</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {repStatus.map((rep) => (
                      <tr key={rep.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 pr-4">
                          <span className="text-sm font-medium text-white">{rep.name}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-xs px-2 py-1 rounded-lg bg-white/5 text-neutral-400">{rep.role}</span>
                        </td>
                        <td className="py-3 pr-4 text-center">
                          <span className="text-sm text-neutral-300 tabular-nums">{rep.activeLeads}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-xs text-neutral-500">{rep.lastActive}</span>
                        </td>
                        <td className="py-3 text-center">
                          <button
                            onClick={() => toggleRepAvailability(rep.id)}
                            className="inline-flex items-center transition-colors"
                          >
                            {rep.available ? (
                              <ToggleRight size={28} className="text-brand-green" />
                            ) : (
                              <ToggleLeft size={28} className="text-neutral-600" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── Geocode Sync Section ─────────────────────────────────────── */}
          <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sky-500/10 rounded-xl flex items-center justify-center">
                  <MapPin size={20} className="text-sky-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Geocode Sync</h2>
                  <p className="text-sm text-neutral-400">Geocode all contacts from JobNimbus and Google Sheets via Nominatim (free)</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={loadGeocodeStats}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <RefreshCw size={16} className="text-neutral-400" />
                </button>
                <button
                  onClick={triggerGeocodeSync}
                  disabled={geocodeSyncing}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg ${
                    geocodeSyncing
                      ? 'bg-neutral-700 text-neutral-400 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-500/90 hover:to-blue-500/90 text-white shadow-sky-500/25'
                  }`}
                >
                  {geocodeSyncing ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <MapPin size={16} />
                      Geocode All
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Current Stats */}
            {geocodeStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-white tabular-nums">{geocodeStats.totalGeocoded}</div>
                  <div className="text-xs text-neutral-500">Total Geocoded</div>
                </div>
                {Object.entries(geocodeStats.byType).slice(0, 3).map(([type, count]) => (
                  <div key={type} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-white tabular-nums">{count}</div>
                    <div className="text-xs text-neutral-500 capitalize">{type}s</div>
                  </div>
                ))}
              </div>
            )}

            {/* Sync Progress */}
            {geocodeProgress && geocodeProgress.status !== 'idle' && (
              <div className={`p-4 rounded-xl border ${
                geocodeProgress.status === 'complete'
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : geocodeProgress.status === 'error'
                    ? 'bg-red-500/5 border-red-500/20'
                    : 'bg-sky-500/5 border-sky-500/20'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  {geocodeProgress.status === 'complete' ? (
                    <CheckCircle size={18} className="text-emerald-400" />
                  ) : geocodeProgress.status === 'error' ? (
                    <AlertTriangle size={18} className="text-red-400" />
                  ) : (
                    <Loader2 size={18} className="animate-spin text-sky-400" />
                  )}
                  <span className={`text-sm font-medium capitalize ${
                    geocodeProgress.status === 'complete' ? 'text-emerald-400'
                      : geocodeProgress.status === 'error' ? 'text-red-400'
                        : 'text-sky-400'
                  }`}>
                    {geocodeProgress.status === 'complete' ? 'Sync Complete' : geocodeProgress.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <div>
                    <span className="text-neutral-500">Total: </span>
                    <span className="text-white font-medium tabular-nums">{geocodeProgress.totalContacts}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Geocoded: </span>
                    <span className="text-emerald-400 font-medium tabular-nums">{geocodeProgress.geocoded}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Saved: </span>
                    <span className="text-sky-400 font-medium tabular-nums">{geocodeProgress.saved}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Skipped: </span>
                    <span className="text-neutral-400 font-medium tabular-nums">{geocodeProgress.skipped}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Errors: </span>
                    <span className={`font-medium tabular-nums ${geocodeProgress.errors > 0 ? 'text-red-400' : 'text-neutral-400'}`}>{geocodeProgress.errors}</span>
                  </div>
                </div>

                {geocodeProgress.errorMessage && (
                  <p className="mt-2 text-xs text-red-400">{geocodeProgress.errorMessage}</p>
                )}

                {geocodeProgress.status !== 'complete' && geocodeProgress.status !== 'error' && (
                  <div className="mt-3">
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full transition-all duration-500"
                        style={{
                          width: `${geocodeProgress.totalContacts > 0
                            ? Math.round(((geocodeProgress.geocoded + geocodeProgress.skipped) / geocodeProgress.totalContacts) * 100)
                            : 0}%`
                        }}
                      />
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      Rate limited to 1 request/sec (Nominatim policy). Estimated time: ~{Math.max(1, Math.ceil((geocodeProgress.totalContacts - geocodeProgress.geocoded - geocodeProgress.skipped) / 60))} min remaining.
                    </p>
                  </div>
                )}
              </div>
            )}

            {!geocodeProgress && !geocodeStats && (
              <div className="text-center py-6 text-neutral-500 text-sm">
                Click "Geocode All" to geocode all contacts without lat/lng coordinates.
                <br />
                <span className="text-xs text-neutral-600">Uses Nominatim (free, no API key). Rate limited to 1 req/sec.</span>
              </div>
            )}
          </section>

          {/* ── Section 6: Distribution History ───────────────────────────── */}
          <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
                  <History size={20} className="text-orange-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Distribution History</h2>
                  <p className="text-sm text-neutral-400">Most recent 20 lead assignments with scoring details</p>
                </div>
              </div>
              <button
                onClick={loadHistory}
                disabled={historyLoading}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <RefreshCw size={16} className={`text-neutral-400 ${historyLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {historyLoading && history.length === 0 ? (
              <div className="text-center py-8">
                <Loader2 className="animate-spin text-orange-400 mx-auto mb-2" size={24} />
                <p className="text-sm text-neutral-500">Loading history...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 text-sm">
                No distribution history yet. Logs will appear here as leads are assigned.
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-all gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white truncate">{log.address}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-lg ${
                          log.method === 'auto'
                            ? 'bg-brand-green/10 text-brand-green'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {log.method === 'auto' ? 'Auto' : 'Manual'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-neutral-500">
                        <span>{log.timestamp}</span>
                        <span className="text-neutral-600">|</span>
                        <span>Assigned to <strong className="text-neutral-300">{log.assignedTo}</strong></span>
                        <span className="text-neutral-600">|</span>
                        <span>Score: <strong className="text-neutral-300">{log.score.toFixed(1)}</strong></span>
                      </div>
                    </div>
                    {log.scores && Object.keys(log.scores).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(log.scores).slice(0, 4).map(([factor, score]) => (
                          <span
                            key={factor}
                            className="text-xs px-2 py-1 rounded-lg bg-white/5 text-neutral-400 tabular-nums"
                            title={factor}
                          >
                            {factor.replace(/([A-Z])/g, ' $1').trim().split(' ')[0]}: {(score as number).toFixed(0)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

        </main>

        {/* Footer */}
        <footer className="border-t border-white/5 mt-8">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-neutral-500">
              <p>Lead Distribution Algorithm v1.0</p>
              <p>Changes take effect immediately after saving</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
