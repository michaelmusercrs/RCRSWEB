'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Clock,
  Play,
  Pause,
  Square,
  Coffee,
  Car,
  Briefcase,
  GraduationCap,
  Users,
  Calendar,
  CheckCircle,
  XCircle,
  FileText,
  Download,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  Plus,
  MoreVertical,
  AlertCircle,
  ArrowRight,
  Timer,
  Edit3,
  Trash2,
  Save,
  X,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface TimeEntry {
  id: string;
  repSlug: string;
  repName: string;
  date: string;
  clockIn: string;
  clockOut?: string;
  breakStart?: string;
  breakEnd?: string;
  totalHours: number;
  breakHours: number;
  netHours: number;
  jobId?: string;
  customerName?: string;
  address?: string;
  category: 'office' | 'field' | 'travel' | 'training' | 'meeting' | 'admin';
  notes: string;
  status: 'active' | 'completed' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  location?: { lat: number; lng: number };
  createdAt: string;
  updatedAt: string;
}

interface TimesheetSummary {
  repSlug: string;
  repName: string;
  period: { start: string; end: string };
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  daysWorked: number;
  avgHoursPerDay: number;
  entries: TimeEntry[];
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
}

interface WeeklyHours {
  sun: number;
  mon: number;
  tue: number;
  wed: number;
  thu: number;
  fri: number;
  sat: number;
  total: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  office: { label: 'Office', icon: <Briefcase className="w-4 h-4" />, color: 'bg-blue-500/20 text-blue-400' },
  field: { label: 'Field', icon: <ArrowRight className="w-4 h-4" />, color: 'bg-green-500/20 text-green-400' },
  travel: { label: 'Travel', icon: <Car className="w-4 h-4" />, color: 'bg-yellow-500/20 text-yellow-400' },
  training: { label: 'Training', icon: <GraduationCap className="w-4 h-4" />, color: 'bg-purple-500/20 text-purple-400' },
  meeting: { label: 'Meeting', icon: <Users className="w-4 h-4" />, color: 'bg-cyan-500/20 text-cyan-400' },
  admin: { label: 'Admin', icon: <FileText className="w-4 h-4" />, color: 'bg-gray-500/20 text-gray-400' },
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

// =============================================================================
// HELPERS
// =============================================================================

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getElapsedTime(clockIn: string, breakHours: number): string {
  const ms = Date.now() - new Date(clockIn).getTime();
  const totalMinutes = Math.floor(ms / 60000);
  const breakMinutes = Math.round(breakHours * 60);
  const netMinutes = Math.max(0, totalMinutes - breakMinutes);
  const h = Math.floor(netMinutes / 60);
  const m = netMinutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekRange(): { start: string; end: string } {
  const today = new Date();
  const day = today.getDay();
  const start = new Date(today);
  start.setDate(today.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(start), end: fmt(end) };
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function TimeTrackingPage() {
  // Current user (in production, from auth context)
  const [currentRep] = useState({ slug: 'current-user', name: 'Current User' });

  // Active entry
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [elapsedTime, setElapsedTime] = useState('0h 00m');
  const [onBreak, setOnBreak] = useState(false);

  // Clock in form
  const [selectedCategory, setSelectedCategory] = useState<string>('office');
  const [clockInNotes, setClockInNotes] = useState('');
  const [clockInJobId, setClockInJobId] = useState('');

  // Today's entries
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]);
  const [todayTotal, setTodayTotal] = useState(0);

  // Weekly view
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHours | null>(null);
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([]);

  // Timesheet manager view
  const [activeTab, setActiveTab] = useState<'today' | 'weekly' | 'timesheet'>('today');
  const [teamTimesheets, setTeamTimesheets] = useState<TimesheetSummary[]>([]);
  const [selectedRep, setSelectedRep] = useState('');
  const [timesheetWeekStart, setTimesheetWeekStart] = useState('');
  const [timesheetWeekEnd, setTimesheetWeekEnd] = useState('');
  const [selectedTimesheet, setSelectedTimesheet] = useState<TimesheetSummary | null>(null);

  // Edit entry
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editCategory, setEditCategory] = useState('');

  // Loading
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ─── DATA FETCHING ──────────────────────────────────────────────────────────

  const fetchActiveEntry = useCallback(async () => {
    try {
      const res = await fetch(`/api/time-tracking?active=true&repSlug=${currentRep.slug}`);
      const data = await res.json();
      if (data.success && data.entry) {
        setActiveEntry(data.entry);
        setOnBreak(!!(data.entry.breakStart && !data.entry.breakEnd));
      } else {
        setActiveEntry(null);
        setOnBreak(false);
      }
    } catch (err) {
      console.error('Error fetching active entry:', err);
    }
  }, [currentRep.slug]);

  const fetchTodayEntries = useCallback(async () => {
    try {
      const today = getTodayString();
      const res = await fetch(`/api/time-tracking?repSlug=${currentRep.slug}&date=${today}`);
      const data = await res.json();
      if (data.success) {
        setTodayEntries(data.entries);
        const total = data.entries.reduce((sum: number, e: TimeEntry) => sum + e.netHours, 0);
        setTodayTotal(Math.round(total * 100) / 100);
      }
    } catch (err) {
      console.error('Error fetching today entries:', err);
    }
  }, [currentRep.slug]);

  const fetchWeeklyData = useCallback(async () => {
    try {
      const [hoursRes, entriesRes] = await Promise.all([
        fetch(`/api/time-tracking?weekly=true&repSlug=${currentRep.slug}`),
        fetch(`/api/time-tracking?repSlug=${currentRep.slug}&startDate=${getWeekRange().start}&endDate=${getWeekRange().end}`),
      ]);
      const hoursData = await hoursRes.json();
      const entriesData = await entriesRes.json();
      if (hoursData.success) setWeeklyHours(hoursData.hours);
      if (entriesData.success) setWeekEntries(entriesData.entries);
    } catch (err) {
      console.error('Error fetching weekly data:', err);
    }
  }, [currentRep.slug]);

  const fetchTeamTimesheets = useCallback(async () => {
    if (!timesheetWeekStart || !timesheetWeekEnd) return;
    try {
      let url = `/api/time-tracking/timesheet?startDate=${timesheetWeekStart}&endDate=${timesheetWeekEnd}`;
      if (selectedRep) url += `&repSlug=${selectedRep}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        if (data.timesheet) {
          setTeamTimesheets([data.timesheet]);
          setSelectedTimesheet(data.timesheet);
        } else if (data.timesheets) {
          setTeamTimesheets(data.timesheets);
          setSelectedTimesheet(null);
        }
      }
    } catch (err) {
      console.error('Error fetching timesheets:', err);
    }
  }, [timesheetWeekStart, timesheetWeekEnd, selectedRep]);

  // ─── INITIAL LOAD ──────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchActiveEntry(), fetchTodayEntries(), fetchWeeklyData()]);
      // Set default timesheet week
      const range = getWeekRange();
      setTimesheetWeekStart(range.start);
      setTimesheetWeekEnd(range.end);
      setLoading(false);
    };
    init();
  }, [fetchActiveEntry, fetchTodayEntries, fetchWeeklyData]);

  // Fetch timesheets when week changes
  useEffect(() => {
    if (timesheetWeekStart && timesheetWeekEnd) {
      fetchTeamTimesheets();
    }
  }, [timesheetWeekStart, timesheetWeekEnd, selectedRep, fetchTeamTimesheets]);

  // Timer for elapsed time
  useEffect(() => {
    if (activeEntry) {
      const tick = () => {
        setElapsedTime(getElapsedTime(activeEntry.clockIn, activeEntry.breakHours));
      };
      tick();
      timerRef.current = setInterval(tick, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else {
      setElapsedTime('0h 00m');
    }
  }, [activeEntry]);

  // ─── ACTIONS ──────────────────────────────────────────────────────────────

  const handleClockIn = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/time-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repSlug: currentRep.slug,
          repName: currentRep.name,
          category: selectedCategory,
          notes: clockInNotes,
          jobId: clockInJobId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveEntry(data.entry);
        setClockInNotes('');
        setClockInJobId('');
        await fetchTodayEntries();
      } else {
        alert(data.error || 'Failed to clock in');
      }
    } catch (err) {
      console.error('Clock in error:', err);
      alert('Failed to clock in');
    }
    setActionLoading(false);
  };

  const handleClockOut = async () => {
    if (!activeEntry) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/time-tracking/${activeEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clockOut' }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveEntry(null);
        setOnBreak(false);
        await Promise.all([fetchTodayEntries(), fetchWeeklyData()]);
      }
    } catch (err) {
      console.error('Clock out error:', err);
    }
    setActionLoading(false);
  };

  const handleBreakToggle = async () => {
    if (!activeEntry) return;
    setActionLoading(true);
    try {
      const action = onBreak ? 'endBreak' : 'startBreak';
      const res = await fetch(`/api/time-tracking/${activeEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveEntry(data.entry);
        setOnBreak(!onBreak);
      }
    } catch (err) {
      console.error('Break toggle error:', err);
    }
    setActionLoading(false);
  };

  const handleEditSave = async (entryId: string) => {
    try {
      const res = await fetch(`/api/time-tracking/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: editNotes, category: editCategory }),
      });
      if ((await res.json()).success) {
        setEditingEntry(null);
        await fetchTodayEntries();
      }
    } catch (err) {
      console.error('Edit error:', err);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm('Delete this time entry?')) return;
    try {
      const res = await fetch(`/api/time-tracking/${entryId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await Promise.all([fetchTodayEntries(), fetchWeeklyData()]);
      } else {
        alert(data.error || 'Failed to delete');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleApproveTimesheet = async (repSlug: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch('/api/time-tracking/timesheet', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repSlug,
          startDate: timesheetWeekStart,
          endDate: timesheetWeekEnd,
          action,
          approvedBy: currentRep.name,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchTeamTimesheets();
      }
    } catch (err) {
      console.error('Approve error:', err);
    }
  };

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <Clock className="w-6 h-6 animate-spin" />
          <span>Loading time tracking...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-[#39FF14]" />
              <h1 className="text-2xl font-bold">Time Tracking</h1>
            </div>
            <div className="flex items-center gap-2">
              {['today', 'weekly', 'timesheet'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30'
                      : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
                  }`}
                >
                  {tab === 'today' ? 'Today' : tab === 'weekly' ? 'Weekly' : 'Timesheets'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ═══════════════════════════════════════════════════════════════════════
            CLOCK IN/OUT PANEL (sticky)
            ═══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">

            {/* Clock Button & Status */}
            <div className="flex items-center gap-4 flex-shrink-0">
              {activeEntry ? (
                <>
                  <button
                    onClick={handleClockOut}
                    disabled={actionLoading}
                    className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 text-red-400 hover:bg-red-500/30 transition-all flex items-center justify-center disabled:opacity-50"
                  >
                    <Square className="w-8 h-8" />
                  </button>
                  <div>
                    <div className="text-3xl font-mono font-bold text-[#39FF14]">{elapsedTime}</div>
                    <div className="text-sm text-gray-400">
                      Clocked in at {formatTime(activeEntry.clockIn)}
                    </div>
                    {onBreak && (
                      <div className="text-sm text-yellow-400 flex items-center gap-1 mt-1">
                        <Coffee className="w-3 h-3" />
                        On break
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={handleClockIn}
                    disabled={actionLoading}
                    className="w-20 h-20 rounded-full bg-[#39FF14]/20 border-2 border-[#39FF14] text-[#39FF14] hover:bg-[#39FF14]/30 transition-all flex items-center justify-center disabled:opacity-50"
                  >
                    <Play className="w-8 h-8 ml-1" />
                  </button>
                  <div>
                    <div className="text-xl font-semibold text-gray-300">Not Clocked In</div>
                    <div className="text-sm text-gray-500">Click to start your shift</div>
                  </div>
                </>
              )}
            </div>

            {/* Category + Notes (when not clocked in) */}
            {!activeEntry && (
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    {Object.entries(CATEGORY_CONFIG).map(([key, { label }]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Job ID (optional)</label>
                  <input
                    type="text"
                    value={clockInJobId}
                    onChange={(e) => setClockInJobId(e.target.value)}
                    placeholder="JOB-12345"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Notes</label>
                  <input
                    type="text"
                    value={clockInNotes}
                    onChange={(e) => setClockInNotes(e.target.value)}
                    placeholder="What are you working on?"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                  />
                </div>
              </div>
            )}

            {/* Break Button (when clocked in) */}
            {activeEntry && (
              <div className="flex items-center gap-3 ml-auto">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${CATEGORY_CONFIG[activeEntry.category]?.color || ''}`}>
                  {CATEGORY_CONFIG[activeEntry.category]?.label}
                </span>
                <button
                  onClick={handleBreakToggle}
                  disabled={actionLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                    onBreak
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30'
                      : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                  }`}
                >
                  <Coffee className="w-4 h-4" />
                  {onBreak ? 'End Break' : 'Start Break'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            TODAY'S LOG
            ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'today' && (
          <div className="bg-gray-800 rounded-xl border border-gray-700">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#39FF14]" />
                Today&apos;s Log
              </h2>
              <div className="text-sm text-gray-400">
                Total: <span className="text-[#39FF14] font-bold">{formatHours(todayTotal)}</span>
              </div>
            </div>

            {todayEntries.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No entries today. Clock in to start tracking.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {todayEntries.map((entry) => (
                  <div key={entry.id} className="px-6 py-4">
                    {editingEntry === entry.id ? (
                      /* Edit mode */
                      <div className="flex items-start gap-4">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Category</label>
                            <select
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                            >
                              {Object.entries(CATEGORY_CONFIG).map(([key, { label }]) => (
                                <option key={key} value={key}>{label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs text-gray-500 mb-1">Notes</label>
                            <input
                              type="text"
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleEditSave(entry.id)} className="p-2 text-[#39FF14] hover:bg-gray-700 rounded-lg">
                            <Save className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingEntry(null)} className="p-2 text-gray-400 hover:bg-gray-700 rounded-lg">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* View mode */
                      <div className="flex items-center gap-4">
                        {/* Time range */}
                        <div className="w-36 flex-shrink-0">
                          <div className="text-sm font-medium">
                            {formatTime(entry.clockIn)}
                            {entry.clockOut ? ` - ${formatTime(entry.clockOut)}` : ''}
                          </div>
                          {entry.status === 'active' && (
                            <div className="text-xs text-[#39FF14]">In progress...</div>
                          )}
                        </div>

                        {/* Category badge */}
                        <span className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${CATEGORY_CONFIG[entry.category]?.color || ''}`}>
                          {CATEGORY_CONFIG[entry.category]?.label}
                        </span>

                        {/* Duration */}
                        <div className="w-20 text-sm font-mono text-gray-300 flex-shrink-0">
                          {entry.status === 'active' ? '...' : formatHours(entry.netHours)}
                        </div>

                        {/* Notes */}
                        <div className="flex-1 text-sm text-gray-400 truncate">
                          {entry.notes || (entry.jobId ? `Job: ${entry.jobId}` : '')}
                        </div>

                        {/* Status */}
                        <span className={`px-2 py-1 rounded text-xs border flex-shrink-0 ${STATUS_COLORS[entry.status]}`}>
                          {entry.status}
                        </span>

                        {/* Break info */}
                        {entry.breakHours > 0 && (
                          <span className="text-xs text-yellow-500 flex items-center gap-1 flex-shrink-0">
                            <Coffee className="w-3 h-3" />
                            {formatHours(entry.breakHours)}
                          </span>
                        )}

                        {/* Actions */}
                        {entry.status !== 'approved' && (
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => { setEditingEntry(entry.id); setEditNotes(entry.notes); setEditCategory(entry.category); }}
                              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(entry.id)}
                              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            WEEKLY VIEW
            ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'weekly' && (
          <div className="bg-gray-800 rounded-xl border border-gray-700">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#39FF14]" />
                This Week
              </h2>
              {weeklyHours && (
                <div className="text-sm">
                  Total: <span className={`font-bold ${weeklyHours.total > 40 ? 'text-red-400' : 'text-[#39FF14]'}`}>
                    {formatHours(weeklyHours.total)}
                  </span>
                  {weeklyHours.total > 40 && (
                    <span className="text-red-400 ml-2 text-xs">
                      ({formatHours(weeklyHours.total - 40)} OT)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Day columns */}
            {weeklyHours && (
              <div className="px-6 py-4">
                <div className="grid grid-cols-7 gap-2">
                  {DAY_KEYS.map((key, idx) => {
                    const hours = weeklyHours[key];
                    const isToday = new Date().getDay() === idx;
                    const isOvertime = hours > 8;
                    return (
                      <div
                        key={key}
                        className={`rounded-lg p-3 text-center border ${
                          isToday
                            ? 'border-[#39FF14]/30 bg-[#39FF14]/5'
                            : 'border-gray-700 bg-gray-900/50'
                        }`}
                      >
                        <div className={`text-xs font-medium mb-1 ${isToday ? 'text-[#39FF14]' : 'text-gray-500'}`}>
                          {DAY_LABELS[idx]}
                        </div>
                        <div className={`text-lg font-bold ${
                          hours === 0 ? 'text-gray-600' : isOvertime ? 'text-red-400' : 'text-white'
                        }`}>
                          {hours > 0 ? formatHours(hours) : '-'}
                        </div>
                        {isOvertime && (
                          <div className="text-xs text-red-400 mt-0.5">OT</div>
                        )}

                        {/* Category breakdown for day */}
                        {hours > 0 && (() => {
                          const dayDate = new Date();
                          dayDate.setDate(dayDate.getDate() - dayDate.getDay() + idx);
                          const dateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
                          const dayEntries = weekEntries.filter((e) => e.date === dateStr);
                          const cats = new Set(dayEntries.map((e) => e.category));
                          return (
                            <div className="flex justify-center gap-1 mt-2 flex-wrap">
                              {Array.from(cats).map((cat) => (
                                <span key={cat} className={`w-2 h-2 rounded-full ${
                                  cat === 'office' ? 'bg-blue-400' :
                                  cat === 'field' ? 'bg-green-400' :
                                  cat === 'travel' ? 'bg-yellow-400' :
                                  cat === 'training' ? 'bg-purple-400' :
                                  cat === 'meeting' ? 'bg-cyan-400' :
                                  'bg-gray-400'
                                }`} title={CATEGORY_CONFIG[cat]?.label} />
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>

                {/* Category legend */}
                <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-700">
                  {Object.entries(CATEGORY_CONFIG).map(([key, { label, color }]) => (
                    <div key={key} className="flex items-center gap-2 text-xs text-gray-400">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        key === 'office' ? 'bg-blue-400' :
                        key === 'field' ? 'bg-green-400' :
                        key === 'travel' ? 'bg-yellow-400' :
                        key === 'training' ? 'bg-purple-400' :
                        key === 'meeting' ? 'bg-cyan-400' :
                        'bg-gray-400'
                      }`} />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weekly entries list */}
            {weekEntries.length > 0 && (
              <div className="border-t border-gray-700">
                <div className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Week Details
                </div>
                <div className="divide-y divide-gray-700/50">
                  {weekEntries.map((entry) => (
                    <div key={entry.id} className="px-6 py-3 flex items-center gap-4 text-sm">
                      <span className="w-24 text-gray-400">{formatDate(entry.date)}</span>
                      <span className="w-28 text-gray-300">{formatTime(entry.clockIn)}{entry.clockOut ? ` - ${formatTime(entry.clockOut)}` : ''}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${CATEGORY_CONFIG[entry.category]?.color || ''}`}>
                        {CATEGORY_CONFIG[entry.category]?.label}
                      </span>
                      <span className="font-mono text-gray-300 w-16">{formatHours(entry.netHours)}</span>
                      <span className="flex-1 text-gray-500 truncate">{entry.notes}</span>
                      <span className={`px-2 py-0.5 rounded text-xs border ${STATUS_COLORS[entry.status]}`}>
                        {entry.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            TIMESHEET MANAGEMENT (Manager View)
            ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'timesheet' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-[#39FF14]" />
                Timesheet Management
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Team Member</label>
                  <input
                    type="text"
                    value={selectedRep}
                    onChange={(e) => setSelectedRep(e.target.value)}
                    placeholder="All team members (or enter rep slug)"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Week Start</label>
                  <input
                    type="date"
                    value={timesheetWeekStart}
                    onChange={(e) => {
                      setTimesheetWeekStart(e.target.value);
                      const end = new Date(e.target.value);
                      end.setDate(end.getDate() + 6);
                      setTimesheetWeekEnd(`${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`);
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Week End</label>
                  <input
                    type="date"
                    value={timesheetWeekEnd}
                    readOnly
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-400"
                  />
                </div>
              </div>
            </div>

            {/* Timesheets */}
            {teamTimesheets.length === 0 ? (
              <div className="bg-gray-800 rounded-xl border border-gray-700 px-6 py-12 text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No timesheets found for this period.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {teamTimesheets.map((ts) => (
                  <div key={ts.repSlug} className="bg-gray-800 rounded-xl border border-gray-700">
                    {/* Timesheet header */}
                    <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{ts.repName}</h3>
                        <span className="text-sm text-gray-400">
                          {formatDate(ts.period.start)} - {formatDate(ts.period.end)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm text-gray-400">Total Hours</div>
                          <div className={`text-xl font-bold ${ts.overtimeHours > 0 ? 'text-red-400' : 'text-[#39FF14]'}`}>
                            {formatHours(ts.totalHours)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-400">Regular / OT</div>
                          <div className="text-sm text-gray-300">
                            {formatHours(ts.regularHours)} / <span className="text-red-400">{formatHours(ts.overtimeHours)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-400">Days</div>
                          <div className="text-sm text-gray-300">{ts.daysWorked}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-400">Avg/Day</div>
                          <div className="text-sm text-gray-300">{formatHours(ts.avgHoursPerDay)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Entries grid */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-700/50">
                            <th className="px-4 py-3 text-left">Date</th>
                            <th className="px-4 py-3 text-left">Clock In</th>
                            <th className="px-4 py-3 text-left">Clock Out</th>
                            <th className="px-4 py-3 text-left">Break</th>
                            <th className="px-4 py-3 text-left">Net Hours</th>
                            <th className="px-4 py-3 text-left">Category</th>
                            <th className="px-4 py-3 text-left">Notes</th>
                            <th className="px-4 py-3 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                          {ts.entries.map((entry) => (
                            <tr key={entry.id} className="hover:bg-gray-700/30">
                              <td className="px-4 py-3 text-gray-300">{formatDate(entry.date)}</td>
                              <td className="px-4 py-3">{formatTime(entry.clockIn)}</td>
                              <td className="px-4 py-3">{entry.clockOut ? formatTime(entry.clockOut) : '-'}</td>
                              <td className="px-4 py-3 text-yellow-500">
                                {entry.breakHours > 0 ? formatHours(entry.breakHours) : '-'}
                              </td>
                              <td className="px-4 py-3 font-mono font-medium">{formatHours(entry.netHours)}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded text-xs ${CATEGORY_CONFIG[entry.category]?.color || ''}`}>
                                  {CATEGORY_CONFIG[entry.category]?.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{entry.notes}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded text-xs border ${STATUS_COLORS[entry.status]}`}>
                                  {entry.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Approve/Reject buttons */}
                    <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between">
                      <div className="text-sm text-gray-500">
                        Status: <span className="capitalize">{ts.status}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveTimesheet(ts.repSlug, 'reject')}
                          className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm hover:bg-red-500/30 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                        <button
                          onClick={() => handleApproveTimesheet(ts.repSlug, 'approve')}
                          className="flex items-center gap-2 px-4 py-2 bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30 rounded-lg text-sm hover:bg-[#39FF14]/30 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 border border-gray-600 rounded-lg text-sm hover:bg-gray-600 transition-colors"
                          onClick={() => {
                            const rows = ['Employee,Date,Clock In,Clock Out,Hours,Status'];
                            // Generate CSV from displayed timesheet data
                            const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `timesheet-export-${new Date().toISOString().slice(0,10)}.csv`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          <Download className="w-4 h-4" />
                          Export CSV
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
