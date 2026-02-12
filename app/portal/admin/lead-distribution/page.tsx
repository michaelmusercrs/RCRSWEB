'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Save, Loader2, RotateCcw, Sliders, Target,
  MapPin, Clock, CheckCircle, AlertTriangle, BarChart3,
  ChevronDown, ChevronUp, Info
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

// ── Types ────────────────────────────────────────────────────────────────────

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
  reassignMinutes: number;
}

interface FullConfig {
  weights: WeightConfig;
  thresholds: ThresholdConfig;
  responseTimers: TimerConfig;
  counties: string[];
  updatedAt: string;
  updatedBy: string;
}

// ── Metadata ─────────────────────────────────────────────────────────────────

const WEIGHT_META: Record<keyof WeightConfig, { label: string; description: string; color: string; barColor: string }> = {
  installProximity:  { label: 'Install Proximity',   description: 'Distance from rep\'s past install locations', color: 'bg-brand-green', barColor: '#3b82f6' },
  contactProximity:  { label: 'Contact Proximity',   description: 'Distance from rep\'s contact address',       color: 'bg-cyan-500', barColor: '#06b6d4' },
  doorKnockRecency:  { label: 'Door Knock Recency',  description: 'How recently rep knocked in the area',       color: 'bg-violet-500', barColor: '#8b5cf6' },
  referralBonus:     { label: 'Referral Bonus',       description: 'Extra weight when lead is a referral',       color: 'bg-amber-500', barColor: '#f59e0b' },
  meetingAttendance: { label: 'Meeting Attendance',   description: 'Monday meeting attendance rate',             color: 'bg-emerald-500', barColor: '#10b981' },
  closeRate:         { label: 'Close Rate',           description: 'Historical close percentage',                color: 'bg-rose-500', barColor: '#f43f5e' },
  responseTime:      { label: 'Response Time',        description: 'Average lead response speed',                color: 'bg-orange-500', barColor: '#f97316' },
};

const THRESHOLD_META: { key: keyof ThresholdConfig; label: string; unit: string; description: string; min: number; max: number; step: number }[] = [
  { key: 'proximityRadiusMiles',   label: 'Proximity Radius',     unit: 'miles', description: 'Max distance for proximity scoring',     min: 1,  max: 100, step: 0.5 },
  { key: 'recentInteractionDays',  label: 'Recent Interaction',   unit: 'days',  description: 'Days to consider interactions recent',   min: 1,  max: 365, step: 1 },
  { key: 'staleInteractionDays',   label: 'Stale Interaction',    unit: 'days',  description: 'Days before interactions go stale',      min: 30, max: 1095, step: 1 },
  { key: 'minRepsForDistribution', label: 'Min Reps Required',    unit: 'reps',  description: 'Minimum available reps to run algorithm', min: 1,  max: 10, step: 1 },
];

const TIMER_META: { key: keyof TimerConfig; label: string; description: string; step: number }[] = [
  { key: 'reminderMinutes',  label: 'Reminder',  description: 'Send reminder after N minutes',          step: 1 },
  { key: 'warningMinutes',   label: 'Warning',   description: 'Escalate to manager after N minutes',    step: 1 },
  { key: 'reassignMinutes',  label: 'Reassign',  description: 'Auto-reassign lead after N minutes',     step: 1 },
];

// All Alabama counties that could be covered
const ALL_COUNTIES = [
  'Madison', 'Limestone', 'Morgan', 'Marshall', 'Jackson',
  'DeKalb', 'Lawrence', 'Cullman', 'Blount', 'Etowah',
  'Cherokee', 'Colbert', 'Franklin', 'Marion', 'Winston',
  'Lauderdale', 'Calhoun', 'St. Clair', 'Shelby', 'Jefferson',
  'Walker', 'Fayette', 'Lamar', 'Pickens', 'Tuscaloosa',
];

const DEFAULT_CONFIG: FullConfig = {
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
  responseTimers: {
    reminderMinutes: 10,
    warningMinutes: 30,
    reassignMinutes: 60,
  },
  counties: [
    'Madison', 'Limestone', 'Morgan', 'Marshall', 'Jackson',
    'DeKalb', 'Lawrence', 'Cullman', 'Blount', 'Etowah',
    'Cherokee', 'Colbert', 'Franklin', 'Marion', 'Winston',
  ],
  updatedAt: '',
  updatedBy: '',
};

// ── Component ────────────────────────────────────────────────────────────────

export default function LeadDistributionConfigPage() {
  const { user, isLoading: authLoading } = useAuth();

  const [config, setConfig] = useState<FullConfig>(DEFAULT_CONFIG);
  const [savedConfig, setSavedConfig] = useState<FullConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCounties, setShowCounties] = useState(false);

  // ── Computed ─────────────────────────────────────────────────────────────

  const weightSum = Object.values(config.weights).reduce((a, b) => a + b, 0);
  const weightsValid = weightSum === 100;
  const hasChanges = JSON.stringify(config) !== JSON.stringify(savedConfig);

  // ── Data Loading ─────────────────────────────────────────────────────────

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/lead-distro/config');
      if (res.ok) {
        const data = await res.json();
        const cfg = data.config || data.data || data;
        const loaded: FullConfig = {
          weights: cfg.weights || DEFAULT_CONFIG.weights,
          thresholds: cfg.thresholds || DEFAULT_CONFIG.thresholds,
          responseTimers: cfg.responseTimers || cfg.timers || DEFAULT_CONFIG.responseTimers,
          counties: cfg.counties || DEFAULT_CONFIG.counties,
          updatedAt: cfg.updatedAt || '',
          updatedBy: cfg.updatedBy || '',
        };
        setConfig(loaded);
        setSavedConfig(loaded);
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // ── Actions ──────────────────────────────────────────────────────────────

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
            responseTimers: config.responseTimers,
            counties: config.counties,
          },
          updatedBy: user?.name || 'admin',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const saved = data.config || config;
        setSavedConfig({ ...config, updatedAt: saved.updatedAt || new Date().toISOString(), updatedBy: saved.updatedBy || user?.name || 'admin' });
        setConfig(prev => ({ ...prev, updatedAt: saved.updatedAt || new Date().toISOString(), updatedBy: saved.updatedBy || user?.name || 'admin' }));
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

  const handleReset = () => {
    setConfig({
      ...DEFAULT_CONFIG,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy,
    });
  };

  const handleRevert = () => {
    setConfig(savedConfig);
  };

  const handleWeightChange = (key: keyof WeightConfig, value: number) => {
    setConfig(prev => ({
      ...prev,
      weights: { ...prev.weights, [key]: Math.max(0, Math.min(100, value)) },
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
      responseTimers: { ...prev.responseTimers, [key]: Math.max(1, value) },
    }));
  };

  const toggleCounty = (county: string) => {
    setConfig(prev => {
      const counties = prev.counties.includes(county)
        ? prev.counties.filter(c => c !== county)
        : [...prev.counties, county].sort();
      return { ...prev, counties };
    });
  };

  const toggleAllCounties = (enabled: boolean) => {
    setConfig(prev => ({
      ...prev,
      counties: enabled ? [...ALL_COUNTIES].sort() : [],
    }));
  };

  // ── Auth gate ────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={32} />
      </div>
    );
  }

  if (!user || !['owner', 'admin', 'manager'].includes(user.role)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-4 text-red-400" size={48} />
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-neutral-400 mb-6">Only owners, admins, and managers can access lead distribution settings.</p>
          <Link href="/portal/dashboard" className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 transition-colors">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

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
            <p className="text-neutral-400">Loading configuration...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const weightKeys = Object.keys(WEIGHT_META) as (keyof WeightConfig)[];
  const maxWeight = Math.max(...Object.values(config.weights), 1);

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
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href="/portal/admin"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={18} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Lead Distribution Config</h1>
                  <p className="text-sm text-neutral-400">
                    Scoring weights, thresholds, timers, and service area
                    {config.updatedAt && (
                      <span className="ml-2 text-neutral-500">
                        -- Last saved {new Date(config.updatedAt).toLocaleDateString()} by {config.updatedBy || 'unknown'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRevert}
                  disabled={!hasChanges}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all bg-white/5 hover:bg-white/10 text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Revert to last saved"
                >
                  <RotateCcw size={15} />
                  <span className="hidden sm:inline">Revert</span>
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20"
                  title="Reset to factory defaults"
                >
                  <RotateCcw size={15} />
                  <span className="hidden sm:inline">Defaults</span>
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !weightsValid || !hasChanges}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg ${
                    weightsValid && hasChanges
                      ? 'bg-gradient-to-r from-brand-green to-emerald-500 hover:from-brand-green/90 hover:to-emerald-500/90 text-black shadow-brand-green/25'
                      : 'bg-neutral-700 text-neutral-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Save
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* ── Save message toast ──────────────────────────────────────────── */}
        {saveMessage && (
          <div className="max-w-5xl mx-auto px-6 pt-4">
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

        {/* Unsaved changes bar */}
        {hasChanges && (
          <div className="max-w-5xl mx-auto px-6 pt-4">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Info size={16} />
              You have unsaved changes.
            </div>
          </div>
        )}

        <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">

          {/* ── Section 1: Weight Bar Chart ─────────────────────────────── */}
          <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-green/10 rounded-xl flex items-center justify-center">
                  <BarChart3 size={20} className="text-brand-green" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Weight Distribution</h2>
                  <p className="text-sm text-neutral-400">Visual breakdown of how each factor influences lead scoring</p>
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

            {/* Horizontal bar chart */}
            <div className="space-y-3">
              {weightKeys.map((key) => {
                const meta = WEIGHT_META[key];
                const value = config.weights[key];
                const pct = maxWeight > 0 ? (value / maxWeight) * 100 : 0;
                return (
                  <div key={key} className="flex items-center gap-4">
                    <div className="w-36 sm:w-44 flex-shrink-0 text-right">
                      <span className="text-sm text-neutral-300">{meta.label}</span>
                    </div>
                    <div className="flex-1 relative">
                      <div className="h-7 bg-white/5 rounded-lg overflow-hidden">
                        <div
                          className={`h-full rounded-lg transition-all duration-300 ${meta.color}`}
                          style={{ width: `${pct}%`, opacity: 0.85 }}
                        />
                      </div>
                    </div>
                    <div className="w-12 text-right">
                      <span className="text-sm font-bold text-white tabular-nums">{value}</span>
                      <span className="text-xs text-neutral-500">%</span>
                    </div>
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

          {/* ── Section 2: Weight Sliders ─────────────────────────────────── */}
          <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center">
                <Sliders size={20} className="text-violet-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Adjust Weights</h2>
                <p className="text-sm text-neutral-400">Drag sliders or type values. Must total 100.</p>
              </div>
            </div>

            <div className="space-y-5">
              {weightKeys.map((key) => {
                const meta = WEIGHT_META[key];
                const value = config.weights[key];
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <span className="text-sm font-medium text-white">{meta.label}</span>
                        <span className="text-xs text-neutral-500 ml-2 hidden sm:inline">{meta.description}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={value}
                          onChange={(e) => handleWeightChange(key, parseInt(e.target.value) || 0)}
                          className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-brand-green/50 transition-all"
                        />
                        <span className="text-xs text-neutral-500 w-3">%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={value}
                      onChange={(e) => handleWeightChange(key, parseInt(e.target.value))}
                      className="w-full h-2 appearance-none bg-white/5 rounded-full cursor-pointer accent-brand-green"
                      style={{
                        background: `linear-gradient(to right, ${meta.barColor} 0%, ${meta.barColor} ${value}%, rgba(255,255,255,0.05) ${value}%, rgba(255,255,255,0.05) 100%)`,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Section 3 & 4: Thresholds + Response Timers (side by side) ── */}
          <div className="grid md:grid-cols-2 gap-8">

            {/* Thresholds */}
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
                {THRESHOLD_META.map(({ key, label, unit, description, min, max, step }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-neutral-300 mb-1">{label}</label>
                    <p className="text-xs text-neutral-500 mb-2">{description}</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={min}
                        max={max}
                        step={step}
                        value={config.thresholds[key]}
                        onChange={(e) => handleThresholdChange(key, Math.max(min, Math.min(max, parseFloat(e.target.value) || min)))}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-green/50 transition-all"
                      />
                      <span className="text-xs text-neutral-500 w-12">{unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Response Timers */}
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
                {TIMER_META.map(({ key, label, description, step }, idx) => (
                  <div key={key} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 text-xs font-bold flex-shrink-0 mt-1">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-neutral-300 mb-1">{label}</label>
                      <p className="text-xs text-neutral-500 mb-2">{description}</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          step={step}
                          value={config.responseTimers[key]}
                          onChange={(e) => handleTimerChange(key, parseInt(e.target.value) || 1)}
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
                  Timeline: Lead arrives &rarr; <strong>{config.responseTimers.reminderMinutes}m</strong> reminder &rarr;{' '}
                  <strong>{config.responseTimers.warningMinutes}m</strong> warning &rarr;{' '}
                  <strong>{config.responseTimers.reassignMinutes}m</strong> reassign
                </p>
              </div>
            </section>
          </div>

          {/* ── Section 5: Covered Counties ──────────────────────────────── */}
          <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <button
              onClick={() => setShowCounties(!showCounties)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                  <MapPin size={20} className="text-emerald-400" />
                </div>
                <div className="text-left">
                  <h2 className="text-lg font-semibold text-white">Covered Counties</h2>
                  <p className="text-sm text-neutral-400">
                    {config.counties.length} of {ALL_COUNTIES.length} counties selected
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-neutral-400 tabular-nums hidden sm:inline">
                  {config.counties.length} active
                </span>
                {showCounties ? (
                  <ChevronUp size={20} className="text-neutral-400" />
                ) : (
                  <ChevronDown size={20} className="text-neutral-400" />
                )}
              </div>
            </button>

            {showCounties && (
              <div className="mt-6">
                {/* Bulk actions */}
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => toggleAllCounties(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => toggleAllCounties(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                  >
                    Clear All
                  </button>
                </div>

                {/* County grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {ALL_COUNTIES.map((county) => {
                    const isActive = config.counties.includes(county);
                    return (
                      <button
                        key={county}
                        onClick={() => toggleCounty(county)}
                        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                          isActive
                            ? 'bg-brand-green/10 border-brand-green/30 text-brand-green'
                            : 'bg-white/[0.02] border-white/5 text-neutral-500 hover:border-white/10 hover:text-neutral-300'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                          isActive
                            ? 'bg-brand-green border-brand-green'
                            : 'border-neutral-600 bg-transparent'
                        }`}>
                          {isActive && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M1 4L3.5 6.5L9 1" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        {county}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* ── Quick Links ──────────────────────────────────────────────── */}
          <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Related Pages</h3>
                <p className="text-xs text-neutral-500">Manage live distribution, rep status, and history</p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/portal/admin/lead-distro"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-neutral-300 transition-colors border border-white/5"
                >
                  <Sliders size={14} />
                  Live Distribution Panel
                </Link>
              </div>
            </div>
          </section>

        </main>

        {/* Footer */}
        <footer className="border-t border-white/5 mt-8">
          <div className="max-w-5xl mx-auto px-6 py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-neutral-500">
              <p>Lead Distribution Config v1.0</p>
              <p>Changes take effect immediately after saving</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
