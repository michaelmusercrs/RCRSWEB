'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarDays, Search, AlertCircle, FileSignature, DollarSign,
  Users, Loader2, CheckCircle, Wrench, Columns3,
  Target, Briefcase, TrendingUp, Send,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

// =============================================================================
// Types
// =============================================================================

interface DailyEntry {
  date: string; // YYYY-MM-DD
  inspected: number;
  damage: number;
  signed: number;
  repair: number;
  gutter: number;
  revenue: number;
  approved: number;
  goal: number;
  referrals: number;
  agents: number;
}

interface DailyMetricField {
  key: keyof Omit<DailyEntry, 'date'>;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  type: 'number' | 'currency';
  color: string;
}

interface DailyActivityTrackerProps {
  compact?: boolean;
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

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (weekNum - 1) * 7);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmt(monday)} - ${fmt(sunday)}`;
}

/** Get Monday..Sunday dates for a given ISO week string */
function getWeekDates(weekStr: string): Date[] {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return [];
  const year = parseInt(match[1]);
  const weekNum = parseInt(match[2]);

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (weekNum - 1) * 7);

  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString()}`;
}

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EMPTY_ENTRY: Omit<DailyEntry, 'date'> = {
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
};

// =============================================================================
// Metric definitions - matches WeeklyNumbersWidget (excludes present & homeShow)
// =============================================================================

const dailyMetricFields: DailyMetricField[] = [
  { key: 'inspected', label: 'Inspected', shortLabel: 'Insp', icon: Search, type: 'number', color: 'text-blue-400' },
  { key: 'damage', label: 'Damage', shortLabel: 'Dmg', icon: AlertCircle, type: 'number', color: 'text-red-400' },
  { key: 'signed', label: 'Signed', shortLabel: 'Sign', icon: FileSignature, type: 'number', color: 'text-green-400' },
  { key: 'repair', label: 'Repair', shortLabel: 'Rep', icon: Wrench, type: 'number', color: 'text-orange-400' },
  { key: 'gutter', label: 'Gutter', shortLabel: 'Gut', icon: Columns3, type: 'number', color: 'text-cyan-400' },
  { key: 'revenue', label: '$$$$$', shortLabel: '$$$', icon: DollarSign, type: 'currency', color: 'text-emerald-400' },
  { key: 'approved', label: 'Approved', shortLabel: 'Appr', icon: CheckCircle, type: 'number', color: 'text-purple-400' },
  { key: 'goal', label: 'Goal', shortLabel: 'Goal', icon: Target, type: 'number', color: 'text-amber-400' },
  { key: 'referrals', label: 'Referrals', shortLabel: 'Ref', icon: Users, type: 'number', color: 'text-yellow-400' },
  { key: 'agents', label: 'Agents', shortLabel: 'Agt', icon: Briefcase, type: 'number', color: 'text-indigo-400' },
];

// Quick-entry fields shown in compact row per day
const quickFields: DailyMetricField[] = dailyMetricFields.filter(f =>
  ['inspected', 'damage', 'signed', 'repair', 'gutter', 'revenue', 'approved'].includes(f.key)
);

// =============================================================================
// Component
// =============================================================================

export default function DailyActivityTracker({ compact = false }: DailyActivityTrackerProps) {
  const { user } = useAuth();
  const [currentWeek] = useState<string>(() => getISOWeekString());
  const [dailyEntries, setDailyEntries] = useState<Record<string, DailyEntry>>({});
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    // Default to today's day-of-week index (0=Mon..6=Sun), or 0 if not in range
    const now = new Date();
    const dayIdx = (now.getDay() + 6) % 7; // Convert Sun=0..Sat=6 to Mon=0..Sun=6
    return dayIdx;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAllFields, setShowAllFields] = useState(false);

  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek]);
  const todayKey = useMemo(() => getTodayKey(), []);

  // Clear save message after 3 seconds
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  // Load existing daily entries for the current week
  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/portal/daily-activity?week=${currentWeek}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      if (data.success && data.entries) {
        const entriesMap: Record<string, DailyEntry> = {};
        for (const entry of data.entries) {
          entriesMap[entry.date] = entry;
        }
        setDailyEntries(entriesMap);
      }
    } catch {
      // If the API doesn't exist yet, start with empty entries
      setDailyEntries({});
    } finally {
      setIsLoading(false);
    }
  }, [currentWeek]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Calculate running weekly totals
  const weeklyTotals = useMemo(() => {
    const totals: Omit<DailyEntry, 'date'> = { ...EMPTY_ENTRY };
    for (const entry of Object.values(dailyEntries)) {
      for (const field of dailyMetricFields) {
        (totals[field.key] as number) += (entry[field.key] as number) || 0;
      }
    }
    return totals;
  }, [dailyEntries]);

  // Count how many days have data
  const daysWithData = useMemo(() => {
    return Object.values(dailyEntries).filter(entry =>
      dailyMetricFields.some(f => (entry[f.key] as number) > 0)
    ).length;
  }, [dailyEntries]);

  // Get the entry for the currently selected day
  const selectedDateKey = weekDates[selectedDay] ? formatDateKey(weekDates[selectedDay]) : '';
  const selectedEntry = dailyEntries[selectedDateKey] || { date: selectedDateKey, ...EMPTY_ENTRY };

  // Handle field change for the selected day
  const handleFieldChange = (field: string, value: string) => {
    const numValue = field === 'revenue' ? parseFloat(value) || 0 : parseInt(value) || 0;
    const updatedEntry: DailyEntry = {
      ...selectedEntry,
      date: selectedDateKey,
      [field]: numValue,
    };
    setDailyEntries(prev => ({
      ...prev,
      [selectedDateKey]: updatedEntry,
    }));
  };

  // Save the current day's entry (auto-save on blur or explicit save)
  const saveDayEntry = useCallback(async (entry: DailyEntry) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/portal/daily-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week: currentWeek,
          entry,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMessage({ type: 'success', text: 'Saved' });
      } else {
        setSaveMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Network error' });
    } finally {
      setIsSaving(false);
    }
  }, [currentWeek]);

  // Auto-save when switching days or on blur
  const handleDaySwitch = (dayIdx: number) => {
    // Save current day first if it has data
    const currentDateKey = weekDates[selectedDay] ? formatDateKey(weekDates[selectedDay]) : '';
    const currentDayEntry = dailyEntries[currentDateKey];
    if (currentDayEntry && dailyMetricFields.some(f => (currentDayEntry[f.key] as number) > 0)) {
      saveDayEntry(currentDayEntry);
    }
    setSelectedDay(dayIdx);
  };

  // Save the current day explicitly
  const handleSaveDay = () => {
    saveDayEntry(selectedEntry);
  };

  // Submit accumulated totals to Meeting Sheet
  const handleSubmitToMeeting = async () => {
    setIsSubmitting(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/portal/weekly-numbers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week: currentWeek,
          ...weeklyTotals,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMessage({ type: 'success', text: 'Weekly totals submitted to Meeting Sheet!' });
      } else {
        setSaveMessage({ type: 'error', text: data.error || 'Failed to submit' });
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Network error - please try again' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine which fields to show
  const visibleFields = showAllFields ? dailyMetricFields : quickFields;

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
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={i} className="h-8 flex-1 bg-white/5 rounded-lg animate-pulse" />
          ))}
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
              <CalendarDays size={16} className="text-brand-green" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Daily Activity</h4>
              <p className="text-xs text-neutral-500">{getWeekDateRange(currentWeek)}</p>
            </div>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-neutral-400">
            {daysWithData}/7 days
          </span>
        </div>

        {/* Running totals - compact */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <p className="text-lg font-bold text-white">{weeklyTotals.inspected}</p>
            <p className="text-[10px] text-neutral-500">Inspected</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">{weeklyTotals.signed}</p>
            <p className="text-[10px] text-neutral-500">Signed</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-emerald-400">{formatCurrency(weeklyTotals.revenue)}</p>
            <p className="text-[10px] text-neutral-500">$$$$$</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">{weeklyTotals.approved}</p>
            <p className="text-[10px] text-neutral-500">Approved</p>
          </div>
        </div>

        {/* Day indicator dots */}
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {weekDates.map((date, idx) => {
            const dateKey = formatDateKey(date);
            const hasData = dailyEntries[dateKey] && dailyMetricFields.some(f => (dailyEntries[dateKey][f.key] as number) > 0);
            const isToday = dateKey === todayKey;
            return (
              <div key={idx} className="flex flex-col items-center gap-0.5">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isToday
                      ? 'bg-brand-green ring-2 ring-brand-green/30'
                      : hasData
                        ? 'bg-green-500'
                        : 'bg-white/10'
                  }`}
                />
                <span className="text-[8px] text-neutral-600">{DAY_LABELS[idx][0]}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // =========================================================================
  // Full widget mode
  // =========================================================================
  return (
    <div className="space-y-4">
      {/* Header + Running Totals Card */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-green/20 rounded-xl flex items-center justify-center">
              <CalendarDays size={20} className="text-brand-green" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Track Daily Activity</h3>
              <p className="text-xs text-neutral-400">{getWeekDateRange(currentWeek)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-neutral-400">
              {daysWithData}/7 days logged
            </span>
            {isSaving && (
              <Loader2 size={14} className="text-brand-green animate-spin" />
            )}
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

        {/* Running Weekly Total */}
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-brand-green" />
            <span className="text-xs font-medium text-brand-green">Running Weekly Total</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {dailyMetricFields.slice(0, 5).map(field => (
              <div key={field.key} className="flex items-center gap-1.5">
                <field.icon size={12} className={field.color} />
                <span className="text-[10px] text-neutral-500">{field.shortLabel}</span>
                <span className="text-sm font-bold text-white ml-auto">
                  {field.type === 'currency' ? formatCurrency(weeklyTotals[field.key] as number) : weeklyTotals[field.key]}
                </span>
              </div>
            ))}
            {dailyMetricFields.slice(5).map(field => (
              <div key={field.key} className="flex items-center gap-1.5">
                <field.icon size={12} className={field.color} />
                <span className="text-[10px] text-neutral-500">{field.shortLabel}</span>
                <span className="text-sm font-bold text-white ml-auto">
                  {field.type === 'currency' ? formatCurrency(weeklyTotals[field.key] as number) : weeklyTotals[field.key]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Day Tabs */}
        <div className="flex gap-1 mb-4">
          {weekDates.map((date, idx) => {
            const dateKey = formatDateKey(date);
            const hasData = dailyEntries[dateKey] && dailyMetricFields.some(f => (dailyEntries[dateKey][f.key] as number) > 0);
            const isToday = dateKey === todayKey;
            const isSelected = idx === selectedDay;
            return (
              <button
                key={idx}
                onClick={() => handleDaySwitch(idx)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-brand-green/20 text-brand-green border border-brand-green/30'
                    : isToday
                      ? 'bg-white/[0.04] text-white border border-white/10 hover:bg-white/[0.06]'
                      : hasData
                        ? 'bg-white/[0.02] text-green-400 border border-green-500/20 hover:bg-white/[0.04]'
                        : 'bg-white/[0.02] text-neutral-500 border border-white/5 hover:bg-white/[0.04]'
                }`}
              >
                <span>{DAY_LABELS[idx]}</span>
                <span className="text-[9px] text-neutral-500">
                  {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                </span>
                {hasData && !isSelected && (
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-0.5" />
                )}
                {isToday && !isSelected && (
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-green mt-0.5" />
                )}
              </button>
            );
          })}
        </div>

        {/* Day Entry Form */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-neutral-400">
              {weekDates[selectedDay]?.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC',
              })}
            </span>
            <button
              onClick={() => setShowAllFields(!showAllFields)}
              className="text-[10px] text-brand-green hover:text-brand-green/80 font-medium transition-colors"
            >
              {showAllFields ? 'Show Less' : 'Show All Fields'}
            </button>
          </div>

          {/* Metric input fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {visibleFields.map(field => (
              <div key={field.key} className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <field.icon size={16} className={field.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="text-xs text-neutral-400 block truncate">{field.label}</label>
                  <input
                    type="number"
                    step={field.type === 'currency' ? '0.01' : '1'}
                    min="0"
                    value={selectedEntry[field.key] || 0}
                    onChange={e => handleFieldChange(field.key, e.target.value)}
                    onBlur={handleSaveDay}
                    className="w-full bg-transparent text-white text-lg font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Save + Submit buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSaveDay}
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-neutral-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  Save Day
                </>
              )}
            </button>
            <button
              onClick={handleSubmitToMeeting}
              disabled={isSubmitting || daysWithData === 0}
              className="flex-1 px-4 py-2.5 bg-brand-green hover:bg-brand-green/90 rounded-xl text-sm text-black font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin text-black" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Submit to Meeting Sheet
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Weekly Breakdown Table */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-neutral-400" />
            <span className="text-sm font-medium text-neutral-300">Weekly Breakdown</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-2 px-2 text-xs text-neutral-500 font-medium">Day</th>
                  {quickFields.map(f => (
                    <th key={f.key} className="text-right py-2 px-2 text-xs text-neutral-500 font-medium">
                      {f.shortLabel}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekDates.map((date, idx) => {
                  const dateKey = formatDateKey(date);
                  const entry = dailyEntries[dateKey];
                  const isToday = dateKey === todayKey;
                  const isSelected = idx === selectedDay;
                  return (
                    <tr
                      key={idx}
                      onClick={() => setSelectedDay(idx)}
                      className={`border-b border-white/5 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-brand-green/5'
                          : isToday
                            ? 'bg-white/[0.02]'
                            : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-medium ${
                            isToday ? 'text-brand-green' : isSelected ? 'text-white' : 'text-neutral-400'
                          }`}>
                            {DAY_LABELS[idx]}
                          </span>
                          <span className="text-[10px] text-neutral-600">
                            {date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', timeZone: 'UTC' })}
                          </span>
                          {isToday && (
                            <span className="text-[8px] px-1 py-0.5 rounded bg-brand-green/20 text-brand-green font-medium">
                              TODAY
                            </span>
                          )}
                        </div>
                      </td>
                      {quickFields.map(f => {
                        const val = entry ? (entry[f.key] as number) : 0;
                        return (
                          <td key={f.key} className={`text-right py-2 px-2 ${
                            val > 0
                              ? f.type === 'currency' ? 'text-emerald-400 font-medium' : 'text-neutral-300'
                              : 'text-neutral-600'
                          }`}>
                            {f.type === 'currency' && val > 0 ? formatCurrency(val) : val}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr className="bg-white/[0.03] font-medium">
                  <td className="py-2 px-2">
                    <span className="text-xs font-semibold text-brand-green">TOTAL</span>
                  </td>
                  {quickFields.map(f => {
                    const val = weeklyTotals[f.key] as number;
                    return (
                      <td key={f.key} className={`text-right py-2 px-2 text-sm font-bold ${
                        f.type === 'currency' ? 'text-emerald-400' : 'text-white'
                      }`}>
                        {f.type === 'currency' ? formatCurrency(val) : val}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
