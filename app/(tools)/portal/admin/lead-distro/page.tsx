'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Save, Loader2, Search, MapPin, Clock, Users,
  Sliders, Settings, History, Eye, AlertTriangle, CheckCircle,
  ToggleLeft, ToggleRight, RefreshCw, Target, Zap, TrendingUp
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import AddressAutocomplete, { AddressResult } from '@/components/AddressAutocomplete';

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
}

interface TimerConfig {
  reminderMinutes: number;
  warningMinutes: number;
  urgentWarningMinutes: number;
  reassignMinutes: number;
}

interface LeadDistroConfig {
  weights: WeightConfig;
  thresholds: ThresholdConfig;
  timers: TimerConfig;
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

const WEIGHT_META: Record<keyof WeightConfig, { label: string; description: string; color: string; detail?: string }> = {
  installProximity:  { label: 'Proximity (Nearby Roofs)',    description: 'Completed roofs near the lead address',    color: 'bg-brand-green', detail: 'Scores reps who have done jobs nearby — recency matters (this year > 2yr > 5yr)' },
  contactProximity:  { label: 'Contact Proximity',    description: 'Rep contacts/customers in area',  color: 'bg-cyan-500', detail: 'Existing customer relationships near the lead' },
  doorKnockRecency:  { label: 'Door Knocks in Area',   description: 'Recent door knocking activity nearby',    color: 'bg-violet-500', detail: 'Reps who have been actively knocking in the neighborhood' },
  referralBonus:     { label: 'Lead Type Bonus',        description: 'Office lead vs referral vs door knock',      color: 'bg-amber-500', detail: 'Office leads (created by Sara/Destin) distributed by algorithm. Referrals/self-gen credited to the rep who brought them in.' },
  meetingAttendance: { label: 'Meeting Attendance',    description: 'Monday meeting attendance — miss = off rotation',      color: 'bg-emerald-500', detail: 'Mandatory Monday 10 AM meetings. Missing = removed from lead rotation that week.' },
  closeRate:         { label: 'Office Lead Close Rate',            description: 'Closing % on OFFICE LEADS ONLY',         color: 'bg-rose-500', detail: 'Only counts jobs created by office staff (Sara, Destin). Self-gen/referral jobs excluded from this metric.' },
  responseTime:      { label: 'Response Time',         description: 'Speed of first contact with leads',         color: 'bg-orange-500', detail: 'How quickly the rep makes first human contact (call/text) — not automations' },
};

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
  thresholds: {
    proximityRadiusMiles: 2.0,
    recentInteractionDays: 90,
    staleInteractionDays: 730,
    minRepsForDistribution: 2,
  },
  timers: {
    reminderMinutes: 5,
    warningMinutes: 20,
    urgentWarningMinutes: 45,
    reassignMinutes: 60,
  },
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

  const weightSum = Object.values(config.weights).reduce((a, b) => a + b, 0);
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
          thresholds: cfg.thresholds || DEFAULT_CONFIG.thresholds,
          timers: cfg.responseTimers || cfg.timers || DEFAULT_CONFIG.timers,
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
            thresholds: config.thresholds,
            responseTimers: config.timers,
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

  const handleThresholdChange = (key: keyof ThresholdConfig, value: number) => {
    setConfig(prev => ({
      ...prev,
      thresholds: { ...prev.thresholds, [key]: value },
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
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-white">{meta.label}</span>
                        <span className="text-xs text-neutral-500 ml-2">{meta.description}</span>
                        {meta.detail && (
                          <p className="text-xs text-neutral-600 mt-0.5">{meta.detail}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={value}
                          onChange={(e) => handleWeightChange(key, Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                          className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-brand-green/50 transition-all"
                        />
                        <span className="text-xs text-neutral-500 w-4">%</span>
                      </div>
                    </div>
                    <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-200 ${meta.color}`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={value}
                      onChange={(e) => handleWeightChange(key, parseInt(e.target.value))}
                      className="w-full mt-1 accent-brand-green cursor-pointer opacity-0 hover:opacity-100 focus:opacity-100 h-2 -mt-2 relative z-10"
                    />
                  </div>
                );
              })}
            </div>

            {!weightsValid && (
              <div className="mt-4 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertTriangle size={16} />
                Weights must total exactly 100. Currently {weightSum} ({weightSum > 100 ? `${weightSum - 100} over` : `${100 - weightSum} under`}).
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
                  { key: 'proximityRadiusMiles' as const, label: 'Proximity Radius', unit: 'miles', desc: 'Max distance for proximity scoring' },
                  { key: 'recentInteractionDays' as const, label: 'Recent Interaction', unit: 'days', desc: 'Days to consider interactions recent' },
                  { key: 'staleInteractionDays' as const, label: 'Stale Interaction', unit: 'days', desc: 'Days before interactions are stale' },
                  { key: 'minRepsForDistribution' as const, label: 'Min Reps Required', unit: 'reps', desc: 'Minimum available reps to distribute' },
                ]).map(({ key, label, unit, desc }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-neutral-300 mb-1">{label}</label>
                    <p className="text-xs text-neutral-500 mb-2">{desc}</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={config.thresholds[key]}
                        onChange={(e) => handleThresholdChange(key, Math.max(1, parseInt(e.target.value) || 1))}
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
                  { key: 'reminderMinutes' as const, label: 'Reminder', desc: 'Send reminder notification after this many minutes', icon: '1' },
                  { key: 'warningMinutes' as const, label: 'Warning', desc: 'Escalate warning to manager after this many minutes', icon: '2' },
                  { key: 'urgentWarningMinutes' as const, label: 'Urgent Warning', desc: 'Final "about to be reassigned" warning after this many minutes', icon: '3' },
                  { key: 'reassignMinutes' as const, label: 'Reassign', desc: 'Automatically reassign lead after this many minutes', icon: '4' },
                ]).map(({ key, label, desc, icon }) => (
                  <div key={key} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 text-xs font-bold flex-shrink-0 mt-1">
                      {icon}
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-neutral-300 mb-1">{label}</label>
                      <p className="text-xs text-neutral-500 mb-2">{desc}</p>
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
