'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, ChevronDown, ChevronUp, ClipboardList,
  Search, FileSignature, DollarSign, Users,
  Loader2, CheckCircle, AlertCircle, X, TrendingUp,
  ChevronLeft, ChevronRight, Wrench, Columns3,
  Target, Briefcase, UserCheck, Home,
  Clock, Trash2,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface WeeklyNumbers {
  week: string; // meeting date YYYY-MM-DD
  repName: string;
  inspected: number;
  damage: number;
  signed: number;
  repair: number;
  gutter: number;
  revenue: number; // $$$$$ column - currency
  approved: number;
  goal: number;
  referrals: number;
  agents: number;
  present: string; // '1', '0', 'E', 'EX', etc.
  homeShow: number;
  submittedAt: string;
}

interface MetricField {
  key: keyof WeeklyNumbers;
  label: string;
  icon: React.ElementType;
  type: 'number' | 'currency' | 'text';
  color: string;
}

interface NumberSession {
  id: string;
  week: string;
  repName: string;
  repEmail: string;
  sessionTimestamp: string;
  inspected: string;
  damage: string;
  signed: string;
  repair: string;
  gutter: string;
  revenue: string;
  approved: string;
  goal: string;
  referrals: string;
  agents: string;
  present: string;
  homeShow: string;
  action: string;
  previousValues: string;
}

// =============================================================================
// Helpers
// =============================================================================

function getISOWeekString(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getWeekDateRange(weekStr: string): string {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekStr;
  const year = parseInt(match[1]);
  const weekNum = parseInt(match[2]);

  // Find Jan 4 of the year (always in week 1)
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  // Monday of week 1
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

  // Monday of the target week
  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (weekNum - 1) * 7);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmt(monday)} - ${fmt(sunday)}`;
}

function getPreviousWeek(weekStr: string): string {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekStr;
  let year = parseInt(match[1]);
  let weekNum = parseInt(match[2]);
  weekNum--;
  if (weekNum < 1) {
    year--;
    weekNum = 52;
  }
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

function getNextWeek(weekStr: string): string {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekStr;
  let year = parseInt(match[1]);
  let weekNum = parseInt(match[2]);
  weekNum++;
  if (weekNum > 52) {
    year++;
    weekNum = 1;
  }
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString()}`;
}

// =============================================================================
// Metric definitions - matches Monday Meeting sheet columns exactly
// =============================================================================

const metricFields: MetricField[] = [
  { key: 'inspected', label: 'Inspected', icon: Search, type: 'number', color: 'text-blue-400' },
  { key: 'damage', label: 'Damage', icon: AlertCircle, type: 'number', color: 'text-red-400' },
  { key: 'signed', label: 'Signed', icon: FileSignature, type: 'number', color: 'text-green-400' },
  { key: 'repair', label: 'Repair', icon: Wrench, type: 'number', color: 'text-orange-400' },
  { key: 'gutter', label: 'Gutter', icon: Columns3, type: 'number', color: 'text-cyan-400' },
  { key: 'revenue', label: '$$$$$ (Est.)', icon: DollarSign, type: 'currency', color: 'text-emerald-400' },
  { key: 'approved', label: 'Approved', icon: CheckCircle, type: 'number', color: 'text-purple-400' },
  { key: 'goal', label: 'Goal', icon: Target, type: 'number', color: 'text-amber-400' },
  { key: 'referrals', label: 'Referrals', icon: Users, type: 'number', color: 'text-yellow-400' },
  { key: 'agents', label: 'Agents', icon: Briefcase, type: 'number', color: 'text-indigo-400' },
  { key: 'present', label: 'Present', icon: UserCheck, type: 'text', color: 'text-teal-400' },
  { key: 'homeShow', label: 'Home Show', icon: Home, type: 'number', color: 'text-pink-400' },
];

// Compact mode shows only the 4 most important metrics
const compactFields: MetricField[] = metricFields.filter(f =>
  ['inspected', 'signed', 'revenue', 'present'].includes(f.key)
);

// Present field dropdown options
const presentOptions = [
  { value: '1', label: 'Present' },
  { value: '0', label: 'Absent' },
  { value: 'E', label: 'Excused' },
];

// =============================================================================
// Component
// =============================================================================

interface WeeklyNumbersWidgetProps {
  compact?: boolean; // Compact mode for dashboard embedding
  isAdmin?: boolean; // Admin can delete sessions and see all reps
  userEmail?: string; // Current user's email for session filtering
}

export default function WeeklyNumbersWidget({ compact = false, isAdmin = false, userEmail }: WeeklyNumbersWidgetProps) {
  const [currentWeek, setCurrentWeek] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [currentEntry, setCurrentEntry] = useState<WeeklyNumbers | null>(null);
  const [history, setHistory] = useState<WeeklyNumbers[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<NumberSession[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    inspected: 0,
    damage: 0,
    signed: 0,
    repair: 0,
    gutter: 0,
    revenue: 0,
    approved: 0,
    goal: 0,
    referrals: 0,
    agents: 0,
    present: '1',
    homeShow: 0,
  });

  // On Monday mornings, default to LAST week so reps enter last week's numbers
  const getSmartDefaultWeek = (currentWeek: string): string => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon
    const hour = now.getHours();
    // Monday before noon: default to last week (reps entering last week's numbers)
    if (dayOfWeek === 1 && hour < 12) {
      return getPreviousWeek(currentWeek);
    }
    return currentWeek;
  };

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/portal/weekly-numbers');
      if (!res.ok) throw new Error('Failed to fetch');

      const data = await res.json();
      if (data.success) {
        setCurrentWeek(data.currentWeek);
        if (!selectedWeek) setSelectedWeek(getSmartDefaultWeek(data.currentWeek));

        setHistory(data.records || []);

        // Find current week entry
        const thisWeek = data.records?.find(
          (r: WeeklyNumbers) => r.week === data.currentWeek
        );
        setCurrentEntry(thisWeek || null);

        if (thisWeek) {
          setFormData({
            inspected: thisWeek.inspected,
            damage: thisWeek.damage,
            signed: thisWeek.signed,
            repair: thisWeek.repair,
            gutter: thisWeek.gutter,
            revenue: thisWeek.revenue,
            approved: thisWeek.approved,
            goal: thisWeek.goal,
            referrals: thisWeek.referrals,
            agents: thisWeek.agents,
            present: thisWeek.present || '1',
            homeShow: thisWeek.homeShow,
          });
        }
      }
    } catch (error) {
      console.error('Error loading weekly numbers:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedWeek]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Clear save message after 3 seconds
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  // Submit / update form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const method = currentEntry ? 'PATCH' : 'POST';
      const res = await fetch('/api/portal/weekly-numbers', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week: selectedWeek || currentWeek,
          ...formData,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSaveMessage({ type: 'success', text: currentEntry ? 'Numbers updated!' : 'Numbers submitted!' });
        setShowForm(false);
        await loadData();
      } else {
        // If there's a conflict (409), try PATCH instead
        if (res.status === 409) {
          const patchRes = await fetch('/api/portal/weekly-numbers', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              week: selectedWeek || currentWeek,
              ...formData,
            }),
          });
          const patchData = await patchRes.json();
          if (patchData.success) {
            setSaveMessage({ type: 'success', text: 'Numbers updated!' });
            setShowForm(false);
            await loadData();
          } else {
            setSaveMessage({ type: 'error', text: patchData.error || 'Failed to save' });
          }
        } else {
          setSaveMessage({ type: 'error', text: data.error || 'Failed to save' });
        }
      }
    } catch (error) {
      setSaveMessage({ type: 'error', text: 'Network error - please try again' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'present'
        ? value
        : (field === 'revenue' ? parseFloat(value) || 0 : parseInt(value) || 0),
    }));
  };

  // Load session history for the selected week
  const loadSessions = useCallback(async () => {
    if (!showSessions) return;
    setSessionsLoading(true);
    try {
      const weekParam = selectedWeek || currentWeek;
      const params = new URLSearchParams({ week: weekParam });
      if (userEmail) params.set('repEmail', userEmail);
      const res = await fetch(`/api/portal/weekly-numbers/sessions?${params}`);
      if (!res.ok) throw new Error('Failed to fetch sessions');
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setSessionsLoading(false);
    }
  }, [showSessions, selectedWeek, currentWeek, userEmail]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Delete this session entry? This cannot be undone.')) return;
    setDeletingSessionId(sessionId);
    try {
      const res = await fetch('/api/portal/weekly-numbers/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sessionId }),
      });
      const data = await res.json();
      if (data.success) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    } finally {
      setDeletingSessionId(null);
    }
  };

  // Compute delta between session values and previous values
  const getSessionDeltas = (session: NumberSession): Record<string, { from: number; to: number; delta: number }> => {
    const deltas: Record<string, { from: number; to: number; delta: number }> = {};
    let prev: Record<string, unknown> = {};
    try {
      prev = JSON.parse(session.previousValues || '{}');
    } catch { /* ignore */ }

    const numericFields = ['inspected', 'damage', 'signed', 'repair', 'gutter', 'revenue', 'approved', 'goal', 'referrals', 'agents', 'homeShow'];
    for (const field of numericFields) {
      const to = parseFloat(session[field as keyof NumberSession] as string) || 0;
      const from = parseFloat(String(prev[field] ?? 0)) || 0;
      if (to !== from || session.action === 'create') {
        deltas[field] = { from, to, delta: to - from };
      }
    }
    return deltas;
  };

  // Get previous week data for comparison
  const prevWeekStr = getPreviousWeek(selectedWeek || currentWeek);
  const prevWeekData = history.find(r => r.week === prevWeekStr);

  const getChangeIndicator = (field: keyof WeeklyNumbers, currentVal: number) => {
    if (!prevWeekData) return null;
    const prevVal = prevWeekData[field] as number;
    if (typeof prevVal !== 'number' || typeof currentVal !== 'number') return null;
    if (prevVal === 0 && currentVal === 0) return null;
    if (prevVal === 0) return { direction: 'up' as const, pct: 100 };
    const pct = Math.round(((currentVal - prevVal) / prevVal) * 100);
    if (pct === 0) return null;
    return { direction: pct > 0 ? 'up' as const : 'down' as const, pct: Math.abs(pct) };
  };

  // Format a metric value for display
  const formatMetricValue = (field: MetricField, value: number | string) => {
    if (field.type === 'currency') return formatCurrency(value as number);
    if (field.type === 'text') {
      // Map present codes to readable labels
      const option = presentOptions.find(o => o.value === String(value));
      return option ? option.label : String(value);
    }
    return String(value);
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-white/5 rounded-xl animate-pulse" />
          <div className="flex-1">
            <div className="h-4 w-32 bg-white/5 rounded animate-pulse mb-1" />
            <div className="h-3 w-48 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // =========================================================================
  // Compact card mode (for dashboard embedding)
  // =========================================================================
  if (compact) {
    return (
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 hover:bg-white/[0.04] transition-colors">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center">
              <ClipboardList size={16} className="text-brand-green" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Monday Meeting Numbers</h4>
              <p className="text-xs text-neutral-500">{getWeekDateRange(currentWeek)}</p>
            </div>
          </div>
          {currentEntry ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 ring-1 ring-green-500/30">
              Submitted
            </span>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="text-xs px-2.5 py-1 rounded-full bg-brand-green/20 text-brand-green hover:bg-brand-green/30 transition-colors font-medium"
            >
              Enter Numbers
            </button>
          )}
        </div>

        {currentEntry ? (
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center">
              <p className="text-lg font-bold text-white">{currentEntry.inspected}</p>
              <p className="text-[10px] text-neutral-500">Inspected</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">{currentEntry.signed}</p>
              <p className="text-[10px] text-neutral-500">Signed</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-emerald-400">{formatCurrency(currentEntry.revenue)}</p>
              <p className="text-[10px] text-neutral-500">$$$$$ (Est.)</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">
                {formatMetricValue(metricFields.find(f => f.key === 'present')!, currentEntry.present)}
              </p>
              <p className="text-[10px] text-neutral-500">Present</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-neutral-500">No numbers submitted this week</p>
          </div>
        )}

        {/* Inline form modal for compact mode */}
        {showForm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-white/5 sticky top-0 bg-neutral-900 z-10">
                <div>
                  <h3 className="text-lg font-semibold text-white">Monday Meeting Numbers</h3>
                  <p className="text-xs text-neutral-400">{getWeekDateRange(currentWeek)}</p>
                </div>
                <button
                  onClick={() => setShowForm(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center"
                >
                  <X size={18} className="text-neutral-400" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-4 space-y-3">
                {metricFields.map(field => (
                  <div key={field.key} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0`}>
                      <field.icon size={16} className={field.color} />
                    </div>
                    <label className="flex-1 text-sm text-neutral-300">{field.label}</label>
                    {field.key === 'present' ? (
                      <select
                        value={formData.present}
                        onChange={e => handleFieldChange('present', e.target.value)}
                        className="w-28 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm text-right focus:outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/20 appearance-none cursor-pointer"
                      >
                        {presentOptions.map(opt => (
                          <option key={opt.value} value={opt.value} className="bg-neutral-900">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        step={field.type === 'currency' ? '0.01' : '1'}
                        min="0"
                        value={formData[field.key as keyof typeof formData]}
                        onChange={e => handleFieldChange(field.key, e.target.value)}
                        className="w-24 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm text-right focus:outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/20"
                      />
                    )}
                  </div>
                ))}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-neutral-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 px-4 py-2.5 bg-brand-green hover:bg-brand-green/90 rounded-xl text-sm text-black font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Submit'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // Full widget mode (for sales portal)
  // =========================================================================
  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-green/20 rounded-xl flex items-center justify-center">
              <ClipboardList size={20} className="text-brand-green" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Monday Meeting Numbers</h3>
              <p className="text-xs text-neutral-400">{getWeekDateRange(selectedWeek || currentWeek)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Week navigation */}
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
              <button
                onClick={() => setSelectedWeek(getPreviousWeek(selectedWeek || currentWeek))}
                className="w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <ChevronLeft size={14} className="text-neutral-400" />
              </button>
              <button
                onClick={() => setSelectedWeek(currentWeek)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  (selectedWeek || currentWeek) === currentWeek
                    ? 'bg-brand-green/20 text-brand-green'
                    : 'hover:bg-white/10 text-neutral-400'
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setSelectedWeek(getNextWeek(selectedWeek || currentWeek))}
                disabled={(selectedWeek || currentWeek) >= currentWeek}
                className="w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-30"
              >
                <ChevronRight size={14} className="text-neutral-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Save message */}
        {saveMessage && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-3 text-sm ${
            saveMessage.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {saveMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {saveMessage.text}
          </div>
        )}

        {/* Current week metrics grid */}
        {(() => {
          const weekData = history.find(r => r.week === (selectedWeek || currentWeek));

          if (!weekData && !showForm) {
            return (
              <div className="text-center py-6">
                <BarChart3 size={32} className="text-neutral-600 mx-auto mb-2" />
                <p className="text-neutral-500 text-sm mb-3">
                  {(() => {
                    const sw = selectedWeek || currentWeek;
                    if (sw === currentWeek) return "You haven't entered numbers for this week yet";
                    if (sw === getPreviousWeek(currentWeek)) return "Enter last week's numbers for Monday meeting";
                    return "No numbers recorded for this week";
                  })()}
                </p>
                {(selectedWeek || currentWeek) <= currentWeek && (
                  <button
                    onClick={() => {
                      setFormData({
                        inspected: 0, damage: 0, signed: 0, repair: 0,
                        gutter: 0, revenue: 0, approved: 0, goal: 0,
                        referrals: 0, agents: 0, present: '1', homeShow: 0,
                      });
                      setShowForm(true);
                    }}
                    className="px-4 py-2 bg-brand-green/20 hover:bg-brand-green/30 text-brand-green rounded-xl text-sm font-medium transition-colors"
                  >
                    Enter Numbers
                  </button>
                )}
              </div>
            );
          }

          if (weekData && !showForm) {
            return (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  {metricFields.map(field => {
                    const value = weekData[field.key];
                    const change = field.type !== 'text' ? getChangeIndicator(field.key, value as number) : null;
                    return (
                      <div key={field.key} className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <field.icon size={14} className={field.color} />
                          <span className="text-[10px] text-neutral-500 truncate">{field.label}</span>
                        </div>
                        <div className="flex items-end gap-1.5">
                          <span className="text-lg font-bold text-white">
                            {formatMetricValue(field, value as number | string)}
                          </span>
                          {change && (
                            <span className={`text-[10px] font-medium flex items-center gap-0.5 mb-0.5 ${
                              change.direction === 'up' ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {change.direction === 'up' ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                              {change.pct}%
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-600">
                    Submitted {new Date(weekData.submittedAt).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </span>
                  <button
                    onClick={() => {
                      setFormData({
                        inspected: weekData.inspected,
                        damage: weekData.damage,
                        signed: weekData.signed,
                        repair: weekData.repair,
                        gutter: weekData.gutter,
                        revenue: weekData.revenue,
                        approved: weekData.approved,
                        goal: weekData.goal,
                        referrals: weekData.referrals,
                        agents: weekData.agents,
                        present: weekData.present || '1',
                        homeShow: weekData.homeShow,
                      });
                      setShowForm(true);
                    }}
                    className="text-xs text-brand-green hover:text-brand-green/80 font-medium"
                  >
                    Edit Numbers
                  </button>
                </div>
              </>
            );
          }

          return null;
        })()}

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {metricFields.map(field => (
                <div key={field.key} className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    <field.icon size={16} className={field.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="text-xs text-neutral-400 block truncate">{field.label}</label>
                    {field.key === 'present' ? (
                      <select
                        value={formData.present}
                        onChange={e => handleFieldChange('present', e.target.value)}
                        className="w-full bg-transparent text-white text-lg font-bold focus:outline-none appearance-none cursor-pointer"
                      >
                        {presentOptions.map(opt => (
                          <option key={opt.value} value={opt.value} className="bg-neutral-900">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        step={field.type === 'currency' ? '0.01' : '1'}
                        min="0"
                        value={formData[field.key as keyof typeof formData]}
                        onChange={e => handleFieldChange(field.key, e.target.value)}
                        className="w-full bg-transparent text-white text-lg font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="0"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-neutral-400 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 px-4 py-2.5 bg-brand-green hover:bg-brand-green/90 rounded-xl text-sm text-black font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : currentEntry ? (
                  'Update Numbers'
                ) : (
                  'Submit Numbers'
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* History Table */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-neutral-400" />
            <span className="text-sm font-medium text-neutral-300">Previous Weeks</span>
            {history.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/5 text-neutral-500">
                {history.length}
              </span>
            )}
          </div>
          {showHistory ? <ChevronUp size={16} className="text-neutral-400" /> : <ChevronDown size={16} className="text-neutral-400" />}
        </button>

        {showHistory && (
          <div className="border-t border-white/5">
            {history.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left py-2 px-3 text-xs text-neutral-500 font-medium">Week</th>
                      <th className="text-right py-2 px-3 text-xs text-neutral-500 font-medium">Inspected</th>
                      <th className="text-right py-2 px-3 text-xs text-neutral-500 font-medium">Damage</th>
                      <th className="text-right py-2 px-3 text-xs text-neutral-500 font-medium">Signed</th>
                      <th className="text-right py-2 px-3 text-xs text-neutral-500 font-medium">Repair</th>
                      <th className="text-right py-2 px-3 text-xs text-neutral-500 font-medium">Gutter</th>
                      <th className="text-right py-2 px-3 text-xs text-neutral-500 font-medium">$$$$$ (Est.)</th>
                      <th className="text-right py-2 px-3 text-xs text-neutral-500 font-medium">Approved</th>
                      <th className="text-right py-2 px-3 text-xs text-neutral-500 font-medium">Goal</th>
                      <th className="text-right py-2 px-3 text-xs text-neutral-500 font-medium">Referrals</th>
                      <th className="text-right py-2 px-3 text-xs text-neutral-500 font-medium">Agents</th>
                      <th className="text-center py-2 px-3 text-xs text-neutral-500 font-medium">Present</th>
                      <th className="text-right py-2 px-3 text-xs text-neutral-500 font-medium">Home Show</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 12).map(entry => (
                      <tr
                        key={entry.week}
                        className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer"
                        onClick={() => {
                          setSelectedWeek(entry.week);
                        }}
                      >
                        <td className="py-2 px-3">
                          <div>
                            <span className="text-white font-medium">{entry.week}</span>
                            <p className="text-[10px] text-neutral-600">{getWeekDateRange(entry.week)}</p>
                          </div>
                        </td>
                        <td className="text-right py-2 px-3 text-neutral-300">{entry.inspected}</td>
                        <td className="text-right py-2 px-3 text-neutral-300">{entry.damage}</td>
                        <td className="text-right py-2 px-3 text-neutral-300">{entry.signed}</td>
                        <td className="text-right py-2 px-3 text-neutral-300">{entry.repair}</td>
                        <td className="text-right py-2 px-3 text-neutral-300">{entry.gutter}</td>
                        <td className="text-right py-2 px-3 text-emerald-400 font-medium">{formatCurrency(entry.revenue)}</td>
                        <td className="text-right py-2 px-3 text-neutral-300">{entry.approved}</td>
                        <td className="text-right py-2 px-3 text-neutral-300">{entry.goal}</td>
                        <td className="text-right py-2 px-3 text-neutral-300">{entry.referrals}</td>
                        <td className="text-right py-2 px-3 text-neutral-300">{entry.agents}</td>
                        <td className="text-center py-2 px-3 text-neutral-300">
                          {formatMetricValue(metricFields.find(f => f.key === 'present')!, entry.present)}
                        </td>
                        <td className="text-right py-2 px-3 text-neutral-300">{entry.homeShow}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center">
                <BarChart3 size={24} className="text-neutral-600 mx-auto mb-2" />
                <p className="text-sm text-neutral-500">No history yet. Submit your first week!</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Session History */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowSessions(!showSessions)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-neutral-400" />
            <span className="text-sm font-medium text-neutral-300">Session History</span>
            {sessions.length > 0 && showSessions && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/5 text-neutral-500">
                {sessions.length}
              </span>
            )}
          </div>
          {showSessions ? <ChevronUp size={16} className="text-neutral-400" /> : <ChevronDown size={16} className="text-neutral-400" />}
        </button>

        {showSessions && (
          <div className="border-t border-white/5">
            {sessionsLoading ? (
              <div className="p-6 text-center">
                <Loader2 size={20} className="text-neutral-500 mx-auto animate-spin mb-2" />
                <p className="text-sm text-neutral-500">Loading sessions...</p>
              </div>
            ) : sessions.length > 0 ? (
              <div className="divide-y divide-white/5">
                {sessions.map(session => {
                  const deltas = getSessionDeltas(session);
                  const deltaKeys = Object.keys(deltas);
                  const actionLabel = session.action === 'create' ? 'Created' : session.action === 'increment' ? 'Incremented' : 'Updated';
                  const actionColor = session.action === 'create' ? 'text-green-400 bg-green-500/10 border-green-500/20' : session.action === 'increment' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20';
                  const isDeleting = deletingSessionId === session.id;

                  return (
                    <div key={session.id} className="p-3 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${actionColor}`}>
                            {actionLabel}
                          </span>
                          <span className="text-xs text-neutral-500">
                            {new Date(session.sessionTimestamp).toLocaleString('en-US', {
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit',
                            })}
                          </span>
                          <span className="text-[10px] text-neutral-600">{session.repName}</span>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteSession(session.id)}
                            disabled={isDeleting}
                            className="p-1 rounded hover:bg-red-500/10 text-neutral-600 hover:text-red-400 transition-colors disabled:opacity-50"
                            title="Delete session"
                          >
                            {isDeleting ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        )}
                      </div>
                      {deltaKeys.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {deltaKeys.map(field => {
                            const d = deltas[field];
                            const label = metricFields.find(f => f.key === field)?.label || field;
                            const isCurrency = field === 'revenue';
                            const fmtVal = (v: number) => isCurrency ? `$${v.toLocaleString()}` : String(v);

                            if (session.action === 'create') {
                              return d.to !== 0 ? (
                                <span key={field} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-400">
                                  {label}: {fmtVal(d.to)}
                                </span>
                              ) : null;
                            }

                            return (
                              <span key={field} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-400">
                                {label}: {fmtVal(d.from)} {'→'} {fmtVal(d.to)}
                                <span className={`ml-1 font-medium ${d.delta > 0 ? 'text-green-400' : d.delta < 0 ? 'text-red-400' : 'text-neutral-500'}`}>
                                  ({d.delta > 0 ? '+' : ''}{isCurrency ? `$${d.delta.toLocaleString()}` : d.delta})
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[10px] text-neutral-600">No field changes recorded</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center">
                <Clock size={24} className="text-neutral-600 mx-auto mb-2" />
                <p className="text-sm text-neutral-500">No save sessions recorded for this week</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
