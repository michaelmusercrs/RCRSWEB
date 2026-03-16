'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, ChevronDown, ChevronUp, ClipboardList,
  DoorOpen, Calendar, Search, FileText, FileSignature,
  DollarSign, Users, PhoneForwarded, StickyNote,
  Loader2, CheckCircle, AlertCircle, X, TrendingUp,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface WeeklyNumbers {
  week: string;
  repName: string;
  repEmail: string;
  doorsKnocked: number;
  appointmentsSet: number;
  inspectionsCompleted: number;
  estimatesGiven: number;
  contractsSigned: number;
  revenueClosed: number;
  leadsGenerated: number;
  followUpsMade: number;
  notes: string;
  submittedAt: string;
}

interface MetricField {
  key: keyof WeeklyNumbers;
  label: string;
  icon: React.ElementType;
  type: 'number' | 'currency';
  color: string;
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

// =============================================================================
// Metric definitions
// =============================================================================

// Matches Monday Meeting sheet columns exactly (same wording, same order)
const metricFields: MetricField[] = [
  { key: 'doorsKnocked', label: 'Doors Knocked', icon: DoorOpen, type: 'number', color: 'text-blue-400' },
  { key: 'appointmentsSet', label: 'Appointments Set', icon: Calendar, type: 'number', color: 'text-purple-400' },
  { key: 'inspectionsCompleted', label: 'Inspections Completed', icon: Search, type: 'number', color: 'text-cyan-400' },
  { key: 'estimatesGiven', label: 'Estimates Given', icon: FileText, type: 'number', color: 'text-orange-400' },
  { key: 'contractsSigned', label: 'Contracts Signed', icon: FileSignature, type: 'number', color: 'text-green-400' },
  { key: 'revenueClosed', label: 'Revenue Closed', icon: DollarSign, type: 'currency', color: 'text-emerald-400' },
  { key: 'leadsGenerated', label: 'Leads Generated', icon: Users, type: 'number', color: 'text-yellow-400' },
  { key: 'followUpsMade', label: 'Follow-ups Made', icon: PhoneForwarded, type: 'number', color: 'text-pink-400' },
];

// =============================================================================
// Component
// =============================================================================

interface WeeklyNumbersWidgetProps {
  compact?: boolean; // Compact mode for dashboard embedding
}

export default function WeeklyNumbersWidget({ compact = false }: WeeklyNumbersWidgetProps) {
  const [currentWeek, setCurrentWeek] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [currentEntry, setCurrentEntry] = useState<WeeklyNumbers | null>(null);
  const [history, setHistory] = useState<WeeklyNumbers[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    doorsKnocked: 0,
    appointmentsSet: 0,
    inspectionsCompleted: 0,
    estimatesGiven: 0,
    contractsSigned: 0,
    revenueClosed: 0,
    leadsGenerated: 0,
    followUpsMade: 0,
    notes: '',
  });

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/portal/weekly-numbers');
      if (!res.ok) throw new Error('Failed to fetch');

      const data = await res.json();
      if (data.success) {
        setCurrentWeek(data.currentWeek);
        if (!selectedWeek) setSelectedWeek(data.currentWeek);

        setHistory(data.records || []);

        // Find current week entry
        const thisWeek = data.records?.find(
          (r: WeeklyNumbers) => r.week === data.currentWeek
        );
        setCurrentEntry(thisWeek || null);

        if (thisWeek) {
          setFormData({
            doorsKnocked: thisWeek.doorsKnocked,
            appointmentsSet: thisWeek.appointmentsSet,
            inspectionsCompleted: thisWeek.inspectionsCompleted,
            estimatesGiven: thisWeek.estimatesGiven,
            contractsSigned: thisWeek.contractsSigned,
            revenueClosed: thisWeek.revenueClosed,
            leadsGenerated: thisWeek.leadsGenerated,
            followUpsMade: thisWeek.followUpsMade,
            notes: thisWeek.notes,
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
      [field]: field === 'notes' ? value : (field === 'revenueClosed' ? parseFloat(value) || 0 : parseInt(value) || 0),
    }));
  };

  // Get previous week data for comparison
  const prevWeekStr = getPreviousWeek(selectedWeek || currentWeek);
  const prevWeekData = history.find(r => r.week === prevWeekStr);

  const getChangeIndicator = (field: keyof WeeklyNumbers, currentVal: number) => {
    if (!prevWeekData) return null;
    const prevVal = prevWeekData[field] as number;
    if (prevVal === 0 && currentVal === 0) return null;
    if (prevVal === 0) return { direction: 'up' as const, pct: 100 };
    const pct = Math.round(((currentVal - prevVal) / prevVal) * 100);
    if (pct === 0) return null;
    return { direction: pct > 0 ? 'up' as const : 'down' as const, pct: Math.abs(pct) };
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
              <p className="text-lg font-bold text-white">{currentEntry.doorsKnocked}</p>
              <p className="text-[10px] text-neutral-500">Doors Knocked</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">{currentEntry.inspectionsCompleted}</p>
              <p className="text-[10px] text-neutral-500">Inspections</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">{currentEntry.contractsSigned}</p>
              <p className="text-[10px] text-neutral-500">Contracts Signed</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-emerald-400">${currentEntry.revenueClosed.toLocaleString()}</p>
              <p className="text-[10px] text-neutral-500">Revenue Closed</p>
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
                    <input
                      type="number"
                      step={field.type === 'currency' ? '0.01' : '1'}
                      min="0"
                      value={formData[field.key as keyof typeof formData]}
                      onChange={e => handleFieldChange(field.key, e.target.value)}
                      className="w-24 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm text-right focus:outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/20"
                    />
                  </div>
                ))}
                <div>
                  <label className="flex items-center gap-2 text-sm text-neutral-300 mb-1">
                    <StickyNote size={16} className="text-neutral-400" />
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={e => handleFieldChange('notes', e.target.value)}
                    placeholder="Any notes about this week..."
                    rows={2}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/20 placeholder-neutral-600 resize-none"
                  />
                </div>
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
                  {(selectedWeek || currentWeek) === currentWeek
                    ? "You haven't entered numbers for this week yet"
                    : "No numbers recorded for this week"}
                </p>
                {(selectedWeek || currentWeek) <= currentWeek && (
                  <button
                    onClick={() => {
                      setFormData({
                        doorsKnocked: 0, appointmentsSet: 0, inspectionsCompleted: 0,
                        estimatesGiven: 0, contractsSigned: 0, revenueClosed: 0,
                        leadsGenerated: 0, followUpsMade: 0, notes: ''
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
                    const value = weekData[field.key] as number;
                    const change = getChangeIndicator(field.key, value);
                    return (
                      <div key={field.key} className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <field.icon size={14} className={field.color} />
                          <span className="text-[10px] text-neutral-500 truncate">{field.label}</span>
                        </div>
                        <div className="flex items-end gap-1.5">
                          <span className="text-lg font-bold text-white">
                            {field.type === 'currency'
                              ? `$${value.toLocaleString()}`
                              : value}
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
                {weekData.notes && (
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 mb-3">
                    <p className="text-xs text-neutral-400 mb-1">Notes</p>
                    <p className="text-sm text-neutral-300">{weekData.notes}</p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-600">
                    Submitted {new Date(weekData.submittedAt).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </span>
                  <button
                    onClick={() => {
                      setFormData({
                        doorsKnocked: weekData.doorsKnocked,
                        appointmentsSet: weekData.appointmentsSet,
                        inspectionsCompleted: weekData.inspectionsCompleted,
                        estimatesGiven: weekData.estimatesGiven,
                        contractsSigned: weekData.contractsSigned,
                        revenueClosed: weekData.revenueClosed,
                        leadsGenerated: weekData.leadsGenerated,
                        followUpsMade: weekData.followUpsMade,
                        notes: weekData.notes
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
                    <input
                      type="number"
                      step={field.type === 'currency' ? '0.01' : '1'}
                      min="0"
                      value={formData[field.key as keyof typeof formData]}
                      onChange={e => handleFieldChange(field.key, e.target.value)}
                      className="w-full bg-transparent text-white text-lg font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
              <label className="flex items-center gap-2 text-xs text-neutral-400 mb-1.5">
                <StickyNote size={14} />
                Notes (optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={e => handleFieldChange('notes', e.target.value)}
                placeholder="Highlights, challenges, goals for next week..."
                rows={2}
                className="w-full bg-transparent text-white text-sm focus:outline-none placeholder-neutral-600 resize-none"
              />
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
                      <th className="text-right py-2 px-3 text-xs text-neutral-500 font-medium">Doors Knocked</th>
                      <th className="text-right py-2 px-3 text-xs text-neutral-500 font-medium">Appts Set</th>
                      <th className="text-right py-2 px-3 text-xs text-neutral-500 font-medium">Inspections</th>
                      <th className="text-right py-2 px-3 text-xs text-neutral-500 font-medium">Estimates Given</th>
                      <th className="text-right py-2 px-3 text-xs text-neutral-500 font-medium">Contracts Signed</th>
                      <th className="text-right py-2 px-3 text-xs text-neutral-500 font-medium">Revenue Closed</th>
                      <th className="text-right py-2 px-3 text-xs text-neutral-500 font-medium">Leads Generated</th>
                      <th className="text-right py-2 px-3 text-xs text-neutral-500 font-medium">Follow-ups Made</th>
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
                        <td className="text-right py-2 px-3 text-neutral-300">{entry.doorsKnocked}</td>
                        <td className="text-right py-2 px-3 text-neutral-300">{entry.appointmentsSet}</td>
                        <td className="text-right py-2 px-3 text-neutral-300">{entry.inspectionsCompleted}</td>
                        <td className="text-right py-2 px-3 text-neutral-300">{entry.estimatesGiven}</td>
                        <td className="text-right py-2 px-3 text-neutral-300">{entry.contractsSigned}</td>
                        <td className="text-right py-2 px-3 text-emerald-400 font-medium">${entry.revenueClosed.toLocaleString()}</td>
                        <td className="text-right py-2 px-3 text-neutral-300">{entry.leadsGenerated}</td>
                        <td className="text-right py-2 px-3 text-neutral-300">{entry.followUpsMade}</td>
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
    </div>
  );
}
