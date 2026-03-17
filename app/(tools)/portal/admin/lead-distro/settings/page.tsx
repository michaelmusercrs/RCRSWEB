'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Settings, Clock, AlertTriangle, AlertCircle, Bell, BellOff,
  Mail, MessageSquare, Users, UserCheck, UserX, RotateCcw,
  Save, Undo, ChevronDown, ChevronRight, Sliders, MapPin,
  Timer, Zap, Shield, ArrowRight, ArrowLeft, ToggleLeft,
  ToggleRight, Loader2, CheckCircle, Volume2, VolumeX,
  Eye, Trash2, Plus
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

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

interface ReassignmentConfig {
  enabled: boolean;
  strategy: string;
  maxReassignments: number;
  cooldownMinutes: number;
  excludeRepSlugs: string[];
  notifyOriginalRep: boolean;
  notifyNewRep: boolean;
  notifyManager: boolean;
  afterMaxReassignments: string;
}

interface WarningChannels {
  groupme: boolean;
  sms: boolean;
  email: boolean;
  inPortal: boolean;
}

interface WarningMessages {
  reminder: string;
  warning: string;
  urgentWarning: string;
  reassigned: string;
}

interface TimerStepsEnabled {
  reminder: boolean;
  warning: boolean;
  urgentWarning: boolean;
  reassign: boolean;
}

interface SalesRep {
  slug: string;
  name: string;
  isActive: boolean;
}

interface FullConfig {
  weights: WeightConfig;
  thresholds: ThresholdConfig;
  responseTimers: TimerConfig;
  counties: string[];
  reassignment: ReassignmentConfig;
  warningChannels: WarningChannels;
  warningRecipients: string;
  warningMessages: WarningMessages;
  soundAlerts: boolean;
  visualAlerts: boolean;
  timerStepsEnabled: TimerStepsEnabled;
  salesReps: SalesRep[];
  updatedAt: string;
  updatedBy: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_WEIGHTS: WeightConfig = {
  installProximity: 30,
  contactProximity: 15,
  doorKnockRecency: 10,
  referralBonus: 25,
  meetingAttendance: 10,
  closeRate: 5,
  responseTime: 5,
};

const WEIGHT_META: Record<keyof WeightConfig, { label: string; description: string; color: string }> = {
  installProximity: { label: 'Install Proximity', description: 'Completed roofs near the lead', color: '#39FF14' },
  contactProximity: { label: 'Contact Proximity', description: 'Existing contacts in area', color: '#06b6d4' },
  doorKnockRecency: { label: 'Door Knock Recency', description: 'Recent door knocks nearby', color: '#8b5cf6' },
  referralBonus: { label: 'Referral Bonus', description: 'Rep referred the lead', color: '#f59e0b' },
  meetingAttendance: { label: 'Meeting Attendance', description: 'Rep engagement rate', color: '#ec4899' },
  closeRate: { label: 'Close Rate', description: 'Historical close percentage', color: '#14b8a6' },
  responseTime: { label: 'Response Time', description: 'Average lead response speed', color: '#f97316' },
};

const ALABAMA_COUNTIES = [
  'Autauga', 'Baldwin', 'Barbour', 'Bibb', 'Blount', 'Bullock', 'Butler',
  'Calhoun', 'Chambers', 'Cherokee', 'Chilton', 'Choctaw', 'Clarke', 'Clay',
  'Cleburne', 'Coffee', 'Colbert', 'Conecuh', 'Coosa', 'Covington', 'Crenshaw',
  'Cullman', 'Dale', 'Dallas', 'DeKalb', 'Elmore', 'Escambia', 'Etowah',
  'Fayette', 'Franklin', 'Geneva', 'Greene', 'Hale', 'Henry', 'Houston',
  'Jackson', 'Jefferson', 'Lamar', 'Lauderdale', 'Lawrence', 'Lee', 'Limestone',
  'Lowndes', 'Macon', 'Madison', 'Marengo', 'Marion', 'Marshall', 'Mobile',
  'Monroe', 'Montgomery', 'Morgan', 'Perry', 'Pickens', 'Pike', 'Randolph',
  'Russell', 'Shelby', 'St. Clair', 'Sumter', 'Talladega', 'Tallapoosa',
  'Tuscaloosa', 'Walker', 'Washington', 'Wilcox', 'Winston',
];

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function Toggle({ enabled, onChange, label, disabled }: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${enabled ? 'bg-[#39FF14]' : 'bg-gray-600'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
      {label && <span className="ml-14 text-sm text-gray-300 whitespace-nowrap">{label}</span>}
    </button>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, isOpen, onToggle }: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 bg-gray-800/50 rounded-t-lg border border-gray-700 hover:bg-gray-800 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gray-700">
          <Icon className="w-5 h-5 text-[#39FF14]" />
        </div>
        <div className="text-left">
          <h3 className="text-white font-semibold">{title}</h3>
          <p className="text-gray-400 text-sm">{subtitle}</p>
        </div>
      </div>
      {isOpen ? (
        <ChevronDown className="w-5 h-5 text-gray-400" />
      ) : (
        <ChevronRight className="w-5 h-5 text-gray-400" />
      )}
    </button>
  );
}

function Toast({ message, type, onClose }: {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-lg shadow-lg border transition-all ${
      type === 'success'
        ? 'bg-green-900/90 border-green-600 text-green-200'
        : 'bg-red-900/90 border-red-600 text-red-200'
    }`}>
      {type === 'success' ? (
        <CheckCircle className="w-5 h-5 text-[#39FF14]" />
      ) : (
        <AlertCircle className="w-5 h-5 text-red-400" />
      )}
      <span className="font-medium">{message}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function LeadDistroSettingsPage() {
  // ── Loading state ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Section collapse state ─────────────────────────────────────────────────
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    timers: true,
    warnings: false,
    reassignment: false,
    weights: false,
    thresholds: false,
    counties: false,
    reps: false,
  });

  // ── Config state ───────────────────────────────────────────────────────────
  const [weights, setWeights] = useState<WeightConfig>(DEFAULT_WEIGHTS);
  const [thresholds, setThresholds] = useState<ThresholdConfig>({
    proximityRadiusMiles: 2.0,
    recentInteractionDays: 90,
    staleInteractionDays: 730,
    minRepsForDistribution: 2,
  });
  const [responseTimers, setResponseTimers] = useState<TimerConfig>({
    reminderMinutes: 5,
    warningMinutes: 20,
    urgentWarningMinutes: 45,
    reassignMinutes: 60,
  });
  const [timerStepsEnabled, setTimerStepsEnabled] = useState<TimerStepsEnabled>({
    reminder: true,
    warning: true,
    urgentWarning: true,
    reassign: true,
  });
  const [reassignment, setReassignment] = useState<ReassignmentConfig>({
    enabled: true,
    strategy: 'next_best_score',
    maxReassignments: 3,
    cooldownMinutes: 15,
    excludeRepSlugs: [],
    notifyOriginalRep: true,
    notifyNewRep: true,
    notifyManager: true,
    afterMaxReassignments: 'escalate_manager',
  });
  const [warningChannels, setWarningChannels] = useState<WarningChannels>({
    groupme: true,
    sms: false,
    email: true,
    inPortal: true,
  });
  const [warningRecipients, setWarningRecipients] = useState('rep_and_manager');
  const [warningMessages, setWarningMessages] = useState<WarningMessages>({
    reminder: 'Hey {repName}, you have a new lead from {customerName} at {address}. Please reach out ASAP!',
    warning: 'Reminder: Lead from {customerName} has been waiting {minutes} minutes for contact. Please respond soon.',
    urgentWarning: 'URGENT: Lead from {customerName} has been waiting {minutes} minutes. This lead will be reassigned in {remainingMinutes} minutes if not contacted.',
    reassigned: 'Lead from {customerName} has been reassigned from {originalRep} to {newRep} due to no response after {minutes} minutes.',
  });
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [visualAlerts, setVisualAlerts] = useState(true);
  const [counties, setCounties] = useState<string[]>([]);
  const [customCounty, setCustomCounty] = useState('');
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [repSort, setRepSort] = useState<'name' | 'active'>('name');

  // ── Snapshot for undo ──────────────────────────────────────────────────────
  const snapshotRef = useRef<string>('');

  // ── Load config ────────────────────────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/lead-distro/settings');
      const data = await res.json();
      if (data.success && data.config) {
        const c = data.config as FullConfig;
        setWeights(c.weights);
        setThresholds(c.thresholds);
        setResponseTimers(c.responseTimers);
        setTimerStepsEnabled(c.timerStepsEnabled);
        setReassignment(c.reassignment);
        setWarningChannels(c.warningChannels);
        setWarningRecipients(c.warningRecipients);
        setWarningMessages(c.warningMessages);
        setSoundAlerts(c.soundAlerts);
        setVisualAlerts(c.visualAlerts);
        setCounties(c.counties);
        setSalesReps(c.salesReps);
        // Store snapshot for undo
        snapshotRef.current = JSON.stringify(c);
      }
    } catch (err) {
      console.error('Failed to load config:', err);
      setToast({ message: 'Failed to load settings', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // ── Undo ───────────────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (!snapshotRef.current) return;
    try {
      const c = JSON.parse(snapshotRef.current) as FullConfig;
      setWeights(c.weights);
      setThresholds(c.thresholds);
      setResponseTimers(c.responseTimers);
      setTimerStepsEnabled(c.timerStepsEnabled);
      setReassignment(c.reassignment);
      setWarningChannels(c.warningChannels);
      setWarningRecipients(c.warningRecipients);
      setWarningMessages(c.warningMessages);
      setSoundAlerts(c.soundAlerts);
      setVisualAlerts(c.visualAlerts);
      setCounties(c.counties);
      setSalesReps(c.salesReps);
      setToast({ message: 'Changes reverted', type: 'success' });
    } catch {
      setToast({ message: 'Failed to revert changes', type: 'error' });
    }
  }, []);

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        config: {
          weights,
          thresholds,
          responseTimers,
          timerStepsEnabled,
          counties,
          reassignment,
          warningChannels,
          warningRecipients,
          warningMessages,
          soundAlerts,
          visualAlerts,
        },
        updatedBy: 'admin',
      };

      const res = await fetch('/api/admin/lead-distro/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        snapshotRef.current = JSON.stringify({
          weights,
          thresholds,
          responseTimers,
          timerStepsEnabled,
          counties,
          reassignment,
          warningChannels,
          warningRecipients,
          warningMessages,
          soundAlerts,
          visualAlerts,
          salesReps,
        });
        setToast({ message: 'Settings saved successfully', type: 'success' });
      } else {
        setToast({ message: data.error || 'Failed to save', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Network error saving settings', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ── Weight helpers ─────────────────────────────────────────────────────────
  const weightSum = Object.values(weights).reduce((s, v) => s + v, 0);

  const handleWeightChange = (key: keyof WeightConfig, value: number) => {
    setWeights(prev => ({ ...prev, [key]: value }));
  };

  const resetWeights = () => {
    setWeights(DEFAULT_WEIGHTS);
  };

  // ── Section toggle ─────────────────────────────────────────────────────────
  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── County helpers ─────────────────────────────────────────────────────────
  const toggleCounty = (county: string) => {
    setCounties(prev =>
      prev.includes(county) ? prev.filter(c => c !== county) : [...prev, county]
    );
  };

  const addCustomCounty = () => {
    const trimmed = customCounty.trim();
    if (trimmed && !counties.includes(trimmed)) {
      setCounties(prev => [...prev, trimmed]);
      setCustomCounty('');
    }
  };

  // ── Sorted reps ────────────────────────────────────────────────────────────
  const sortedReps = [...salesReps].sort((a, b) => {
    if (repSort === 'name') return a.name.localeCompare(b.name);
    if (repSort === 'active') return (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0);
    return 0;
  });

  // ── Exclude rep toggle ─────────────────────────────────────────────────────
  const toggleExcludeRep = (slug: string) => {
    setReassignment(prev => ({
      ...prev,
      excludeRepSlugs: prev.excludeRepSlugs.includes(slug)
        ? prev.excludeRepSlugs.filter(s => s !== slug)
        : [...prev.excludeRepSlugs, slug],
    }));
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#39FF14]" />
          <p className="text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-gray-800 border-b border-gray-700 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/portal/admin/lead-distro"
              className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#39FF14]" />
                Lead Distribution Settings
              </h1>
              <p className="text-gray-400 text-sm">Configure timers, weights, reassignment rules, and notifications</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleUndo}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            >
              <Undo className="w-4 h-4" />
              Undo Changes
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#39FF14] hover:bg-[#32e612] text-black font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving...' : 'Save All'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">

        {/* ════════════════════════════════════════════════════════════════════
            SECTION A: Timer to Contact Settings
            ════════════════════════════════════════════════════════════════════ */}
        <div>
          <SectionHeader
            icon={Timer}
            title="Timer to Contact Settings"
            subtitle="Configure escalation timing from lead assignment to auto-reassignment"
            isOpen={openSections.timers}
            onToggle={() => toggleSection('timers')}
          />
          {openSections.timers && (
            <div className="border border-t-0 border-gray-700 rounded-b-lg bg-gray-800/30 p-6 space-y-6">
              {/* Visual Timeline */}
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-4">Escalation Timeline</h4>
                <div className="relative">
                  {/* Timeline bar */}
                  <div className="flex items-center gap-0 mb-2">
                    <div className="flex-1 h-2 bg-green-500 rounded-l-full" />
                    <div className="flex-1 h-2 bg-yellow-500" />
                    <div className="flex-1 h-2 bg-orange-500" />
                    <div className="flex-1 h-2 bg-red-500 rounded-r-full" />
                  </div>
                  {/* Timeline labels */}
                  <div className="flex items-stretch gap-0">
                    <div className="flex-1 text-center">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full mb-1 ${timerStepsEnabled.reminder ? 'bg-green-400' : 'bg-gray-600'}`} />
                        <span className="text-xs text-green-400 font-medium">Reminder</span>
                        <span className="text-xs text-gray-500">{responseTimers.reminderMinutes}min</span>
                      </div>
                    </div>
                    <div className="flex-1 text-center">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full mb-1 ${timerStepsEnabled.warning ? 'bg-yellow-400' : 'bg-gray-600'}`} />
                        <span className="text-xs text-yellow-400 font-medium">Warning</span>
                        <span className="text-xs text-gray-500">{responseTimers.warningMinutes}min</span>
                      </div>
                    </div>
                    <div className="flex-1 text-center">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full mb-1 ${timerStepsEnabled.urgentWarning ? 'bg-orange-400' : 'bg-gray-600'}`} />
                        <span className="text-xs text-orange-400 font-medium">Urgent</span>
                        <span className="text-xs text-gray-500">{responseTimers.urgentWarningMinutes}min</span>
                      </div>
                    </div>
                    <div className="flex-1 text-center">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full mb-1 ${timerStepsEnabled.reassign ? 'bg-red-400' : 'bg-gray-600'}`} />
                        <span className="text-xs text-red-400 font-medium">Reassign</span>
                        <span className="text-xs text-gray-500">{responseTimers.reassignMinutes}min</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview text */}
                <div className="mt-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                  <p className="text-sm text-gray-400 flex items-center flex-wrap gap-1">
                    <span className="text-white font-medium">Rep gets lead</span>
                    <ArrowRight className="w-3 h-3 text-gray-600" />
                    <span className={timerStepsEnabled.reminder ? 'text-green-400' : 'text-gray-600 line-through'}>{responseTimers.reminderMinutes}min reminder</span>
                    <ArrowRight className="w-3 h-3 text-gray-600" />
                    <span className={timerStepsEnabled.warning ? 'text-yellow-400' : 'text-gray-600 line-through'}>{responseTimers.warningMinutes}min warning</span>
                    <ArrowRight className="w-3 h-3 text-gray-600" />
                    <span className={timerStepsEnabled.urgentWarning ? 'text-orange-400' : 'text-gray-600 line-through'}>{responseTimers.urgentWarningMinutes}min urgent</span>
                    <ArrowRight className="w-3 h-3 text-gray-600" />
                    <span className={timerStepsEnabled.reassign ? 'text-red-400' : 'text-gray-600 line-through'}>{responseTimers.reassignMinutes}min reassigned</span>
                  </p>
                </div>
              </div>

              {/* Timer inputs with toggles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Reminder */}
                <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <label className="text-sm font-medium text-green-400">Reminder Delay</label>
                    </div>
                    <Toggle
                      enabled={timerStepsEnabled.reminder}
                      onChange={(v) => setTimerStepsEnabled(prev => ({ ...prev, reminder: v }))}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={30}
                      value={responseTimers.reminderMinutes}
                      onChange={e => setResponseTimers(prev => ({ ...prev, reminderMinutes: Number(e.target.value) }))}
                      className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-400"
                      disabled={!timerStepsEnabled.reminder}
                    />
                    <div className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1 min-w-[60px] justify-center">
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={responseTimers.reminderMinutes}
                        onChange={e => setResponseTimers(prev => ({ ...prev, reminderMinutes: Number(e.target.value) }))}
                        className="w-10 bg-transparent text-center text-white text-sm focus:outline-none"
                        disabled={!timerStepsEnabled.reminder}
                      />
                      <span className="text-xs text-gray-500">min</span>
                    </div>
                  </div>
                </div>

                {/* Warning */}
                <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-400" />
                      <label className="text-sm font-medium text-yellow-400">Warning Delay</label>
                    </div>
                    <Toggle
                      enabled={timerStepsEnabled.warning}
                      onChange={(v) => setTimerStepsEnabled(prev => ({ ...prev, warning: v }))}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={5}
                      max={60}
                      value={responseTimers.warningMinutes}
                      onChange={e => setResponseTimers(prev => ({ ...prev, warningMinutes: Number(e.target.value) }))}
                      className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                      disabled={!timerStepsEnabled.warning}
                    />
                    <div className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1 min-w-[60px] justify-center">
                      <input
                        type="number"
                        min={5}
                        max={60}
                        value={responseTimers.warningMinutes}
                        onChange={e => setResponseTimers(prev => ({ ...prev, warningMinutes: Number(e.target.value) }))}
                        className="w-10 bg-transparent text-center text-white text-sm focus:outline-none"
                        disabled={!timerStepsEnabled.warning}
                      />
                      <span className="text-xs text-gray-500">min</span>
                    </div>
                  </div>
                </div>

                {/* Urgent Warning */}
                <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-400" />
                      <label className="text-sm font-medium text-orange-400">Urgent Warning Delay</label>
                    </div>
                    <Toggle
                      enabled={timerStepsEnabled.urgentWarning}
                      onChange={(v) => setTimerStepsEnabled(prev => ({ ...prev, urgentWarning: v }))}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={15}
                      max={120}
                      value={responseTimers.urgentWarningMinutes}
                      onChange={e => setResponseTimers(prev => ({ ...prev, urgentWarningMinutes: Number(e.target.value) }))}
                      className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-400"
                      disabled={!timerStepsEnabled.urgentWarning}
                    />
                    <div className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1 min-w-[60px] justify-center">
                      <input
                        type="number"
                        min={15}
                        max={120}
                        value={responseTimers.urgentWarningMinutes}
                        onChange={e => setResponseTimers(prev => ({ ...prev, urgentWarningMinutes: Number(e.target.value) }))}
                        className="w-10 bg-transparent text-center text-white text-sm focus:outline-none"
                        disabled={!timerStepsEnabled.urgentWarning}
                      />
                      <span className="text-xs text-gray-500">min</span>
                    </div>
                  </div>
                </div>

                {/* Reassignment */}
                <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-400" />
                      <label className="text-sm font-medium text-red-400">Auto-Reassignment Delay</label>
                    </div>
                    <Toggle
                      enabled={timerStepsEnabled.reassign}
                      onChange={(v) => setTimerStepsEnabled(prev => ({ ...prev, reassign: v }))}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={30}
                      max={180}
                      value={responseTimers.reassignMinutes}
                      onChange={e => setResponseTimers(prev => ({ ...prev, reassignMinutes: Number(e.target.value) }))}
                      className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-400"
                      disabled={!timerStepsEnabled.reassign}
                    />
                    <div className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1 min-w-[60px] justify-center">
                      <input
                        type="number"
                        min={30}
                        max={180}
                        value={responseTimers.reassignMinutes}
                        onChange={e => setResponseTimers(prev => ({ ...prev, reassignMinutes: Number(e.target.value) }))}
                        className="w-10 bg-transparent text-center text-white text-sm focus:outline-none"
                        disabled={!timerStepsEnabled.reassign}
                      />
                      <span className="text-xs text-gray-500">min</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION B: Warning Configuration
            ════════════════════════════════════════════════════════════════════ */}
        <div>
          <SectionHeader
            icon={Bell}
            title="Warning Configuration"
            subtitle="Notification channels, message templates, and alert recipients"
            isOpen={openSections.warnings}
            onToggle={() => toggleSection('warnings')}
          />
          {openSections.warnings && (
            <div className="border border-t-0 border-gray-700 rounded-b-lg bg-gray-800/30 p-6 space-y-6">
              {/* Notification Channels */}
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-3">Notification Channels</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-900/50 border border-gray-700">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-gray-300">GroupMe</span>
                    </div>
                    <Toggle
                      enabled={warningChannels.groupme}
                      onChange={v => setWarningChannels(prev => ({ ...prev, groupme: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-900/50 border border-gray-700">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-gray-300">SMS</span>
                    </div>
                    <Toggle
                      enabled={warningChannels.sms}
                      onChange={v => setWarningChannels(prev => ({ ...prev, sms: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-900/50 border border-gray-700">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-purple-400" />
                      <span className="text-sm text-gray-300">Email</span>
                    </div>
                    <Toggle
                      enabled={warningChannels.email}
                      onChange={v => setWarningChannels(prev => ({ ...prev, email: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-900/50 border border-gray-700">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-cyan-400" />
                      <span className="text-sm text-gray-300">In-Portal</span>
                    </div>
                    <Toggle
                      enabled={warningChannels.inPortal}
                      onChange={v => setWarningChannels(prev => ({ ...prev, inPortal: v }))}
                    />
                  </div>
                </div>
              </div>

              {/* Who Gets Notified */}
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-3">Who Gets Notified</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { value: 'rep_only', label: 'Assigned Rep Only', icon: UserCheck },
                    { value: 'rep_and_manager', label: 'Rep + Manager', icon: Users },
                    { value: 'rep_manager_owner', label: 'Rep + Manager + Owner', icon: Shield },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setWarningRecipients(opt.value)}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        warningRecipients === opt.value
                          ? 'border-[#39FF14] bg-[#39FF14]/10 text-white'
                          : 'border-gray-700 bg-gray-900/50 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      <opt.icon className={`w-4 h-4 ${warningRecipients === opt.value ? 'text-[#39FF14]' : 'text-gray-500'}`} />
                      <span className="text-sm font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound / Visual Alerts */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  {soundAlerts ? <Volume2 className="w-4 h-4 text-[#39FF14]" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
                  <span className="text-sm text-gray-300">Sound Alerts</span>
                  <Toggle enabled={soundAlerts} onChange={setSoundAlerts} />
                </div>
                <div className="flex items-center gap-3">
                  <Eye className={`w-4 h-4 ${visualAlerts ? 'text-[#39FF14]' : 'text-gray-500'}`} />
                  <span className="text-sm text-gray-300">Visual Alerts</span>
                  <Toggle enabled={visualAlerts} onChange={setVisualAlerts} />
                </div>
              </div>

              {/* Message Templates */}
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-3">Warning Message Templates</h4>
                <p className="text-xs text-gray-500 mb-3">
                  Available variables: {'{repName}'}, {'{customerName}'}, {'{address}'}, {'{minutes}'}, {'{remainingMinutes}'}, {'{originalRep}'}, {'{newRep}'}
                </p>
                <div className="space-y-3">
                  {([
                    { key: 'reminder' as const, label: 'Reminder Message', color: 'text-green-400' },
                    { key: 'warning' as const, label: 'Warning Message', color: 'text-yellow-400' },
                    { key: 'urgentWarning' as const, label: 'Urgent Warning Message', color: 'text-orange-400' },
                    { key: 'reassigned' as const, label: 'Reassignment Message', color: 'text-red-400' },
                  ] as const).map(msg => (
                    <div key={msg.key}>
                      <label className={`text-xs font-medium ${msg.color} mb-1 block`}>{msg.label}</label>
                      <textarea
                        value={warningMessages[msg.key]}
                        onChange={e => setWarningMessages(prev => ({ ...prev, [msg.key]: e.target.value }))}
                        rows={2}
                        className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-[#39FF14]/50 resize-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION C: Auto-Reassignment Rules
            ════════════════════════════════════════════════════════════════════ */}
        <div>
          <SectionHeader
            icon={RotateCcw}
            title="Auto-Reassignment Rules"
            subtitle="Configure what happens when a rep doesn't respond in time"
            isOpen={openSections.reassignment}
            onToggle={() => toggleSection('reassignment')}
          />
          {openSections.reassignment && (
            <div className="border border-t-0 border-gray-700 rounded-b-lg bg-gray-800/30 p-6 space-y-6">
              {/* Master switch */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-900/50 border border-gray-700">
                <div>
                  <h4 className="text-sm font-semibold text-white">Enable Auto-Reassignment</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Master switch for automatic lead reassignment</p>
                </div>
                <Toggle enabled={reassignment.enabled} onChange={v => setReassignment(prev => ({ ...prev, enabled: v }))} />
              </div>

              <div className={`space-y-5 ${!reassignment.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
                {/* Strategy */}
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">Reassignment Strategy</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { value: 'next_best_score', label: 'Next Best Score', desc: 'Use algorithm to find next best rep' },
                      { value: 'round_robin', label: 'Round Robin', desc: 'Rotate among available reps' },
                      { value: 'specific_rep', label: 'Specific Rep', desc: 'Always reassign to a chosen rep' },
                    ].map(s => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setReassignment(prev => ({ ...prev, strategy: s.value }))}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          reassignment.strategy === s.value
                            ? 'border-[#39FF14] bg-[#39FF14]/10'
                            : 'border-gray-700 bg-gray-900/50 hover:border-gray-500'
                        }`}
                      >
                        <span className={`text-sm font-semibold ${reassignment.strategy === s.value ? 'text-white' : 'text-gray-300'}`}>
                          {s.label}
                        </span>
                        <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Max reassignments & Cooldown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-700">
                    <label className="text-sm font-medium text-gray-300 block mb-2">Max Reassignments Per Lead</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={reassignment.maxReassignments}
                        onChange={e => setReassignment(prev => ({ ...prev, maxReassignments: Number(e.target.value) }))}
                        className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#39FF14]"
                      />
                      <span className="text-white font-mono min-w-[30px] text-center">{reassignment.maxReassignments}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">After this, lead escalates to manager</p>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-700">
                    <label className="text-sm font-medium text-gray-300 block mb-2">Reassignment Cooldown</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={5}
                        max={60}
                        value={reassignment.cooldownMinutes}
                        onChange={e => setReassignment(prev => ({ ...prev, cooldownMinutes: Number(e.target.value) }))}
                        className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#39FF14]"
                      />
                      <div className="flex items-center gap-1 min-w-[60px] justify-center">
                        <span className="text-white font-mono">{reassignment.cooldownMinutes}</span>
                        <span className="text-xs text-gray-500">min</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Minimum time between reassignments</p>
                  </div>
                </div>

                {/* Exclude reps */}
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">Exclude Reps from Receiving Reassigned Leads</label>
                  <div className="flex flex-wrap gap-2">
                    {salesReps.map(rep => (
                      <button
                        key={rep.slug}
                        type="button"
                        onClick={() => toggleExcludeRep(rep.slug)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          reassignment.excludeRepSlugs.includes(rep.slug)
                            ? 'border-red-500 bg-red-500/20 text-red-300'
                            : 'border-gray-600 bg-gray-900/50 text-gray-400 hover:border-gray-400'
                        }`}
                      >
                        {reassignment.excludeRepSlugs.includes(rep.slug) ? (
                          <span className="flex items-center gap-1"><UserX className="w-3 h-3" /> {rep.name}</span>
                        ) : (
                          rep.name
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notification toggles */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-900/50 border border-gray-700">
                    <span className="text-sm text-gray-300">Notify original rep</span>
                    <Toggle
                      enabled={reassignment.notifyOriginalRep}
                      onChange={v => setReassignment(prev => ({ ...prev, notifyOriginalRep: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-900/50 border border-gray-700">
                    <span className="text-sm text-gray-300">Notify new rep</span>
                    <Toggle
                      enabled={reassignment.notifyNewRep}
                      onChange={v => setReassignment(prev => ({ ...prev, notifyNewRep: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-900/50 border border-gray-700">
                    <span className="text-sm text-gray-300">Notify manager</span>
                    <Toggle
                      enabled={reassignment.notifyManager}
                      onChange={v => setReassignment(prev => ({ ...prev, notifyManager: v }))}
                    />
                  </div>
                </div>

                {/* After max reassignments */}
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">After Max Reassignments</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { value: 'escalate_manager', label: 'Escalate to Manager' },
                      { value: 'create_urgent_ticket', label: 'Create Urgent Ticket' },
                      { value: 'both', label: 'Both' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setReassignment(prev => ({ ...prev, afterMaxReassignments: opt.value }))}
                        className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                          reassignment.afterMaxReassignments === opt.value
                            ? 'border-[#39FF14] bg-[#39FF14]/10 text-white'
                            : 'border-gray-700 bg-gray-900/50 text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION D: Distribution Weights
            ════════════════════════════════════════════════════════════════════ */}
        <div>
          <SectionHeader
            icon={Sliders}
            title="Distribution Weights"
            subtitle="Adjust how each factor influences lead assignment scoring"
            isOpen={openSections.weights}
            onToggle={() => toggleSection('weights')}
          />
          {openSections.weights && (
            <div className="border border-t-0 border-gray-700 rounded-b-lg bg-gray-800/30 p-6 space-y-4">
              {/* Running total */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Total Weight:</span>
                  <span className={`font-mono font-bold text-lg ${
                    Math.abs(weightSum - 100) < 0.5 ? 'text-[#39FF14]' : 'text-red-400'
                  }`}>
                    {weightSum}
                  </span>
                  <span className="text-sm text-gray-500">/ 100</span>
                  {Math.abs(weightSum - 100) < 0.5 ? (
                    <CheckCircle className="w-4 h-4 text-[#39FF14]" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={resetWeights}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset to Defaults
                </button>
              </div>

              {/* Weight sliders */}
              <div className="space-y-3">
                {(Object.keys(WEIGHT_META) as (keyof WeightConfig)[]).map(key => {
                  const meta = WEIGHT_META[key];
                  return (
                    <div key={key} className="p-3 rounded-lg bg-gray-900/50 border border-gray-700">
                      <div className="flex items-center justify-between mb-1.5">
                        <div>
                          <span className="text-sm font-medium text-white">{meta.label}</span>
                          <span className="text-xs text-gray-500 ml-2">{meta.description}</span>
                        </div>
                        <span className="font-mono text-sm text-white font-bold min-w-[36px] text-right">{weights[key]}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={weights[key]}
                          onChange={e => handleWeightChange(key, Number(e.target.value))}
                          className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                          style={{ accentColor: meta.color }}
                        />
                      </div>
                      {/* Visual bar */}
                      <div className="mt-1.5 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-200"
                          style={{ width: `${weights[key]}%`, backgroundColor: meta.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Weight distribution pie-chart-like visual */}
              <div className="flex items-center gap-2 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                <div className="flex-1 h-4 rounded-full overflow-hidden flex">
                  {(Object.keys(WEIGHT_META) as (keyof WeightConfig)[]).map(key => {
                    const meta = WEIGHT_META[key];
                    const pct = weightSum > 0 ? (weights[key] / weightSum) * 100 : 0;
                    return pct > 0 ? (
                      <div
                        key={key}
                        className="h-full transition-all duration-300"
                        style={{ width: `${pct}%`, backgroundColor: meta.color }}
                        title={`${meta.label}: ${weights[key]}`}
                      />
                    ) : null;
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION E: Thresholds
            ════════════════════════════════════════════════════════════════════ */}
        <div>
          <SectionHeader
            icon={Zap}
            title="Thresholds"
            subtitle="Proximity radius, interaction windows, and minimum requirements"
            isOpen={openSections.thresholds}
            onToggle={() => toggleSection('thresholds')}
          />
          {openSections.thresholds && (
            <div className="border border-t-0 border-gray-700 rounded-b-lg bg-gray-800/30 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Proximity Radius */}
                <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-[#39FF14]" />
                    <label className="text-sm font-medium text-gray-300">Proximity Radius</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0.5}
                      max={25}
                      step={0.5}
                      value={thresholds.proximityRadiusMiles}
                      onChange={e => setThresholds(prev => ({ ...prev, proximityRadiusMiles: Number(e.target.value) }))}
                      className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#39FF14]"
                    />
                    <div className="flex items-center gap-1 min-w-[70px] justify-center">
                      <span className="text-white font-mono">{thresholds.proximityRadiusMiles}</span>
                      <span className="text-xs text-gray-500">miles</span>
                    </div>
                  </div>
                </div>

                {/* Recent Interaction Window */}
                <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <label className="text-sm font-medium text-gray-300">Recent Interaction Window</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={7}
                      max={365}
                      value={thresholds.recentInteractionDays}
                      onChange={e => setThresholds(prev => ({ ...prev, recentInteractionDays: Number(e.target.value) }))}
                      className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                    <div className="flex items-center gap-1 min-w-[70px] justify-center">
                      <span className="text-white font-mono">{thresholds.recentInteractionDays}</span>
                      <span className="text-xs text-gray-500">days</span>
                    </div>
                  </div>
                </div>

                {/* Stale Interaction Window */}
                <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    <label className="text-sm font-medium text-gray-300">Stale Interaction Window</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={90}
                      max={1825}
                      step={30}
                      value={thresholds.staleInteractionDays}
                      onChange={e => setThresholds(prev => ({ ...prev, staleInteractionDays: Number(e.target.value) }))}
                      className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                    />
                    <div className="flex items-center gap-1 min-w-[70px] justify-center">
                      <span className="text-white font-mono">{thresholds.staleInteractionDays}</span>
                      <span className="text-xs text-gray-500">days</span>
                    </div>
                  </div>
                </div>

                {/* Min Reps for Distribution */}
                <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-purple-400" />
                    <label className="text-sm font-medium text-gray-300">Min Reps for Distribution</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={thresholds.minRepsForDistribution}
                      onChange={e => setThresholds(prev => ({ ...prev, minRepsForDistribution: Number(e.target.value) }))}
                      className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-400"
                    />
                    <span className="text-white font-mono min-w-[30px] text-center">{thresholds.minRepsForDistribution}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION F: Service Area Counties
            ════════════════════════════════════════════════════════════════════ */}
        <div>
          <SectionHeader
            icon={MapPin}
            title="Service Area Counties"
            subtitle={`${counties.length} counties selected for lead distribution`}
            isOpen={openSections.counties}
            onToggle={() => toggleSection('counties')}
          />
          {openSections.counties && (
            <div className="border border-t-0 border-gray-700 rounded-b-lg bg-gray-800/30 p-6 space-y-4">
              {/* Quick actions */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCounties([...ALABAMA_COUNTIES])}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setCounties([])}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                >
                  Clear All
                </button>
                <span className="text-xs text-gray-500">{counties.length} selected</span>
              </div>

              {/* County grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-80 overflow-y-auto pr-2">
                {ALABAMA_COUNTIES.map(county => (
                  <button
                    key={county}
                    type="button"
                    onClick={() => toggleCounty(county)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors text-left ${
                      counties.includes(county)
                        ? 'border-[#39FF14] bg-[#39FF14]/10 text-[#39FF14]'
                        : 'border-gray-700 bg-gray-900/50 text-gray-500 hover:border-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {county}
                  </button>
                ))}
                {/* Show custom counties not in the standard list */}
                {counties.filter(c => !ALABAMA_COUNTIES.includes(c)).map(county => (
                  <div
                    key={county}
                    className="px-3 py-2 rounded-lg text-xs font-medium border border-[#39FF14] bg-[#39FF14]/10 text-[#39FF14] flex items-center justify-between"
                  >
                    <span>{county}</span>
                    <button
                      type="button"
                      onClick={() => setCounties(prev => prev.filter(c => c !== county))}
                      className="ml-1 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add custom county */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customCounty}
                  onChange={e => setCustomCounty(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomCounty()}
                  placeholder="Add custom county..."
                  className="flex-1 bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#39FF14]/50"
                />
                <button
                  type="button"
                  onClick={addCustomCounty}
                  disabled={!customCounty.trim()}
                  className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition-colors disabled:opacity-40 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION G: Active Reps
            ════════════════════════════════════════════════════════════════════ */}
        <div>
          <SectionHeader
            icon={Users}
            title="Active Sales Reps"
            subtitle={`${salesReps.filter(r => r.isActive).length} of ${salesReps.length} reps active for lead distribution`}
            isOpen={openSections.reps}
            onToggle={() => toggleSection('reps')}
          />
          {openSections.reps && (
            <div className="border border-t-0 border-gray-700 rounded-b-lg bg-gray-800/30 p-6 space-y-4">
              {/* Sort controls */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Sort by:</span>
                {(['name', 'active'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRepSort(s)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      repSort === s
                        ? 'border-[#39FF14] bg-[#39FF14]/10 text-[#39FF14]'
                        : 'border-gray-700 bg-gray-900/50 text-gray-500 hover:border-gray-500'
                    }`}
                  >
                    {s === 'name' ? 'Name' : 'Active Status'}
                  </button>
                ))}
              </div>

              {/* Rep list */}
              <div className="space-y-2">
                {sortedReps.map(rep => (
                  <div
                    key={rep.slug}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                      rep.isActive
                        ? 'bg-gray-900/50 border-gray-700'
                        : 'bg-gray-900/30 border-gray-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${rep.isActive ? 'bg-[#39FF14]' : 'bg-gray-600'}`} />
                      <div>
                        <span className="text-sm font-medium text-white">{rep.name}</span>
                        <span className="text-xs text-gray-500 ml-2">@{rep.slug}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {rep.isActive && reassignment.excludeRepSlugs.includes(rep.slug) && (
                        <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                          Excluded from reassignment
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${rep.isActive ? 'text-[#39FF14]' : 'text-gray-600'}`}>
                          {rep.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <div className={`w-2 h-2 rounded-full ${rep.isActive ? 'bg-[#39FF14] animate-pulse' : 'bg-gray-600'}`} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {salesReps.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No sales reps found</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Bottom save bar (mobile-friendly) ──────────────────────────── */}
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4 md:hidden z-40">
          <div className="flex items-center gap-3">
            <button
              onClick={handleUndo}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gray-700 text-gray-300"
            >
              <Undo className="w-4 h-4" />
              Undo
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#39FF14] text-black font-semibold disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save All'}
            </button>
          </div>
        </div>

        {/* Bottom spacer for mobile save bar */}
        <div className="h-20 md:h-0" />
      </div>
    </div>
  );
}
