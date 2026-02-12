'use client';

/**
 * RCRS Portal - Schedule & Calendar Page
 *
 * Full calendar with month/week/day views, color-coded events,
 * Google Calendar integration, and event filtering.
 * Pulls data from unified /api/calendar/events endpoint.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Calendar, Clock, MapPin, Truck, Package, User,
  ChevronLeft, ChevronRight, RefreshCw, Plus, Filter,
  ExternalLink, X, Phone, Briefcase, Users, Eye,
  Navigation, Route, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { TEAM_MEMBERS, getDrivers, getProjectManagers } from '@/lib/team-roles';
import CreateAppointmentForm from '@/components/calendar/CreateAppointmentForm';

// Unified calendar event type from /api/calendar/events
interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  who?: string;
  notes?: string;
  color?: string;
  eventType: string;
  status: string;
  source: 'teamup' | 'jobnimbus' | 'sheets' | 'portal';
  customer?: {
    id?: string;
    name: string;
    phone?: string;
    email?: string;
  } | null;
  jobId?: string;
  assignedTo?: string;
  assignedToName?: string;
  priority: string;
  googleCalendarLink?: string;
}

type ViewMode = 'month' | 'week' | 'day';

// Color coding for event types
const EVENT_TYPE_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  job: { bg: 'bg-brand-green/20', text: 'text-blue-400', dot: 'bg-brand-green', label: 'Job' },
  inspection: { bg: 'bg-brand-green/20', text: 'text-blue-400', dot: 'bg-brand-green', label: 'Inspection' },
  installation: { bg: 'bg-brand-green/20', text: 'text-blue-400', dot: 'bg-brand-green', label: 'Installation' },
  delivery: { bg: 'bg-green-500/20', text: 'text-green-400', dot: 'bg-green-500', label: 'Delivery' },
  pickup: { bg: 'bg-green-500/20', text: 'text-green-400', dot: 'bg-green-500', label: 'Pickup' },
  return: { bg: 'bg-green-500/20', text: 'text-green-400', dot: 'bg-green-500', label: 'Return' },
  appointment: { bg: 'bg-orange-500/20', text: 'text-orange-400', dot: 'bg-orange-500', label: 'Appointment' },
  estimate: { bg: 'bg-orange-500/20', text: 'text-orange-400', dot: 'bg-orange-500', label: 'Estimate' },
  followup: { bg: 'bg-orange-500/20', text: 'text-orange-400', dot: 'bg-orange-500', label: 'Follow-up' },
  meeting: { bg: 'bg-purple-500/20', text: 'text-purple-400', dot: 'bg-purple-500', label: 'Meeting' },
  repair: { bg: 'bg-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-500', label: 'Repair' },
  other: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', dot: 'bg-zinc-500', label: 'Other' },
};

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-lime-500/20 text-lime-400',
  in_progress: 'bg-brand-green/20 text-blue-400',
  scheduled: 'bg-zinc-700 text-zinc-300',
  confirmed: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-red-500/20 text-red-400',
  rescheduled: 'bg-orange-500/20 text-orange-400',
};

const PRIORITY_INDICATOR: Record<string, string> = {
  urgent: 'border-l-4 border-l-red-500',
  rush: 'border-l-4 border-l-yellow-500',
  normal: '',
};

function getEventConfig(type: string) {
  return EVENT_TYPE_CONFIG[type] || EVENT_TYPE_CONFIG.other;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

export default function SchedulePage() {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState<string>('');
  const [filterMember, setFilterMember] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Calculate the date range for the current view
  const dateRange = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    switch (viewMode) {
      case 'month':
        start.setDate(1);
        // Go to start of the week containing the 1st
        start.setDate(start.getDate() - start.getDay());
        end.setMonth(end.getMonth() + 1, 0); // last day of month
        // Go to end of the week containing the last day
        end.setDate(end.getDate() + (6 - end.getDay()));
        break;
      case 'week':
        start.setDate(start.getDate() - start.getDay());
        end.setDate(start.getDate() + 6);
        break;
      case 'day':
        // just the current day
        break;
    }

    return {
      startDate: formatDateKey(start),
      endDate: formatDateKey(end),
    };
  }, [currentDate, viewMode]);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      if (filterType) params.set('eventType', filterType);
      if (filterMember) params.set('assignedTo', filterMember);
      if (filterStatus) params.set('status', filterStatus);

      const response = await fetch(`/api/calendar/events?${params}`);
      const data = await response.json();

      if (data.success) {
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, filterType, filterMember, filterStatus]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Navigation
  const navigate = (direction: number) => {
    const newDate = new Date(currentDate);
    switch (viewMode) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + direction);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + direction * 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() + direction);
        break;
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());

  // Get events for a specific date
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateStr = formatDateKey(date);
    return events.filter(e => e.start.split('T')[0] === dateStr);
  };

  // Generate calendar grid days for month view
  const getMonthDays = (): Date[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];

    // Padding from previous month
    const startPadding = firstDay.getDay();
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i));
    }

    // Days in current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    // Padding for next month (fill to 42 = 6 rows)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  };

  // Generate week days
  const getWeekDays = (): Date[] => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(start));
      start.setDate(start.getDate() + 1);
    }
    return days;
  };

  // Hour slots for week/day view (6 AM to 9 PM)
  const hourSlots = Array.from({ length: 16 }, (_, i) => i + 6);

  // Get events for a specific hour on a date
  const getEventsForHour = (date: Date, hour: number): CalendarEvent[] => {
    const dateStr = formatDateKey(date);
    return events.filter(e => {
      if (e.start.split('T')[0] !== dateStr) return false;
      const eventHour = new Date(e.start).getHours();
      return eventHour === hour;
    });
  };

  // Format header based on view
  const headerText = useMemo(() => {
    switch (viewMode) {
      case 'month':
        return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
      case 'week': {
        const start = new Date(currentDate);
        start.setDate(start.getDate() - start.getDay());
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
      case 'day':
        return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  }, [currentDate, viewMode]);

  // All team members for filter
  const allMembers = TEAM_MEMBERS.filter(m => m.isActive);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal" className="text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Calendar</h1>
              <p className="text-sm text-zinc-400">All jobs, deliveries, appointments & meetings</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-lime-500 text-zinc-900 font-medium rounded-lg hover:bg-lime-400 transition-colors text-sm"
            >
              <Plus size={16} />
              New Appointment
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${showFilters ? 'bg-lime-500/20 text-lime-400' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
            >
              <Filter size={18} />
            </button>
            <button
              onClick={fetchEvents}
              className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
            >
              <RefreshCw size={18} className={`text-zinc-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* View Controls & Filters */}
      <div className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-[1600px] mx-auto p-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            {/* View Toggle */}
            <div className="flex items-center gap-2">
              <div className="flex items-center border border-zinc-700 rounded-lg overflow-hidden">
                {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                      viewMode === mode
                        ? 'bg-lime-500 text-zinc-900'
                        : 'text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <button
                onClick={goToToday}
                className="px-3 py-2 text-sm border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                Today
              </button>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(-1)} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                <ChevronLeft className="text-zinc-400" size={20} />
              </button>
              <h2 className="text-lg font-bold text-white min-w-[220px] text-center">{headerText}</h2>
              <button onClick={() => navigate(1)} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                <ChevronRight className="text-zinc-400" size={20} />
              </button>
            </div>

            {/* Event count */}
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span>{events.length} events</span>
            </div>
          </div>

          {/* Filters Row */}
          {showFilters && (
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-zinc-800">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
              >
                <option value="">All Types</option>
                <option value="job">Jobs</option>
                <option value="inspection">Inspections</option>
                <option value="installation">Installations</option>
                <option value="delivery">Deliveries</option>
                <option value="pickup">Pickups</option>
                <option value="appointment">Appointments</option>
                <option value="meeting">Meetings</option>
                <option value="estimate">Estimates</option>
                <option value="repair">Repairs</option>
              </select>

              <select
                value={filterMember}
                onChange={(e) => setFilterMember(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
              >
                <option value="">All Team Members</option>
                {allMembers.map(m => (
                  <option key={m.id} value={m.slug}>{m.name} ({m.role})</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
              >
                <option value="">All Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              {(filterType || filterMember || filterStatus) && (
                <button
                  onClick={() => { setFilterType(''); setFilterMember(''); setFilterStatus(''); }}
                  className="px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-4">
        {/* Loading */}
        {isLoading && events.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="mx-auto text-lime-500 animate-spin mb-4" size={32} />
              <p className="text-zinc-400">Loading calendar...</p>
            </div>
          </div>
        )}

        {/* ============ MONTH VIEW ============ */}
        {viewMode === 'month' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-zinc-800">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {getMonthDays().map((day, i) => {
                const dateEvents = getEventsForDate(day);
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const isToday = isSameDay(day, today);

                return (
                  <div
                    key={i}
                    onClick={() => {
                      setCurrentDate(new Date(day));
                      setViewMode('day');
                    }}
                    className={`min-h-[110px] p-1.5 border-b border-r border-zinc-800 cursor-pointer transition-colors hover:bg-zinc-800/50 ${
                      !isCurrentMonth ? 'bg-zinc-950/50' : ''
                    } ${isToday ? 'bg-lime-500/5' : ''}`}
                  >
                    <div className={`text-sm font-medium mb-1 flex items-center justify-center w-7 h-7 rounded-full ${
                      isToday ? 'bg-lime-500 text-zinc-900' :
                      isCurrentMonth ? 'text-zinc-300' : 'text-zinc-600'
                    }`}>
                      {day.getDate()}
                    </div>
                    <div className="space-y-0.5">
                      {dateEvents.slice(0, 3).map((event) => {
                        const cfg = getEventConfig(event.eventType);
                        return (
                          <div
                            key={event.id}
                            onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); }}
                            className={`text-[11px] px-1.5 py-0.5 rounded truncate cursor-pointer ${cfg.bg} ${cfg.text} hover:opacity-80`}
                          >
                            {!event.allDay && (
                              <span className="font-medium">
                                {new Date(event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                              </span>
                            )}{' '}
                            {event.title}
                          </div>
                        );
                      })}
                      {dateEvents.length > 3 && (
                        <div className="text-[10px] text-zinc-500 px-1">
                          +{dateEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============ WEEK VIEW ============ */}
        {viewMode === 'week' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-zinc-800">
              <div className="p-2" /> {/* Time column spacer */}
              {getWeekDays().map((day, i) => {
                const isToday = isSameDay(day, today);
                return (
                  <div
                    key={i}
                    className={`p-2 text-center border-l border-zinc-800 ${isToday ? 'bg-lime-500/5' : ''}`}
                  >
                    <p className="text-xs text-zinc-500">{day.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                    <p className={`text-lg font-semibold ${isToday ? 'text-lime-500' : 'text-white'}`}>
                      {day.getDate()}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Time grid */}
            <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
              {hourSlots.map(hour => (
                <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] min-h-[60px] border-b border-zinc-800/50">
                  {/* Time label */}
                  <div className="p-1 text-right pr-2">
                    <span className="text-xs text-zinc-500">
                      {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                    </span>
                  </div>

                  {/* Day columns */}
                  {getWeekDays().map((day, dayIndex) => {
                    const hourEvents = getEventsForHour(day, hour);
                    const isToday = isSameDay(day, today);
                    return (
                      <div
                        key={dayIndex}
                        className={`border-l border-zinc-800/50 p-0.5 ${isToday ? 'bg-lime-500/[0.02]' : ''}`}
                      >
                        {hourEvents.map(event => {
                          const cfg = getEventConfig(event.eventType);
                          const startMin = new Date(event.start).getMinutes();
                          return (
                            <div
                              key={event.id}
                              onClick={() => setSelectedEvent(event)}
                              className={`text-[11px] px-1 py-0.5 rounded cursor-pointer truncate mb-0.5 ${cfg.bg} ${cfg.text} hover:opacity-80`}
                              style={{ marginTop: `${(startMin / 60) * 100}%` }}
                            >
                              {event.title}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============ DAY VIEW ============ */}
        {viewMode === 'day' && (
          <div className="space-y-4">
            {/* Day events list */}
            {(() => {
              const dayEvents = getEventsForDate(currentDate);
              if (dayEvents.length === 0 && !isLoading) {
                return (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
                    <Calendar className="mx-auto text-zinc-600 mb-4" size={48} />
                    <p className="text-zinc-400 text-lg">No events scheduled</p>
                    <p className="text-zinc-500 text-sm mt-1">
                      {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {/* All-day events */}
                  {dayEvents.filter(e => e.allDay).map(event => {
                    const cfg = getEventConfig(event.eventType);
                    return (
                      <div
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className={`bg-zinc-900 border border-zinc-800 rounded-xl p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors ${PRIORITY_INDICATOR[event.priority] || ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${cfg.dot}`} />
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${cfg.bg} ${cfg.text}`}>ALL DAY</span>
                          <span className="text-white font-medium">{event.title}</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Timed events */}
                  {dayEvents.filter(e => !e.allDay).map(event => {
                    const cfg = getEventConfig(event.eventType);
                    return (
                      <div
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className={`bg-zinc-900 border border-zinc-800 rounded-xl p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors ${PRIORITY_INDICATOR[event.priority] || ''}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 min-w-0">
                            {/* Time block */}
                            <div className="text-center shrink-0 w-20">
                              <p className="text-lg font-bold text-white">{formatTime(event.start).split(' ')[0]}</p>
                              <p className="text-xs text-zinc-500">{formatTime(event.start).split(' ')[1]}</p>
                              <p className="text-xs text-zinc-600 mt-0.5">to {formatTime(event.end)}</p>
                            </div>

                            {/* Event details */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${cfg.bg} ${cfg.text}`}>
                                  {cfg.label}
                                </span>
                                {event.priority !== 'normal' && (
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                    event.priority === 'urgent' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                                  }`}>
                                    {event.priority}
                                  </span>
                                )}
                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_STYLES[event.status] || STATUS_STYLES.scheduled}`}>
                                  {event.status.replace('_', ' ')}
                                </span>
                              </div>
                              <h3 className="text-white font-semibold mt-1.5 truncate">{event.title}</h3>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-zinc-400">
                                {event.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin size={13} />
                                    <span className="truncate max-w-[200px]">{event.location}</span>
                                  </span>
                                )}
                                {event.assignedToName && (
                                  <span className="flex items-center gap-1">
                                    <User size={13} />
                                    {event.assignedToName}
                                  </span>
                                )}
                                {event.customer?.name && (
                                  <span className="flex items-center gap-1">
                                    <Briefcase size={13} />
                                    {event.customer.name}
                                  </span>
                                )}
                                {event.customer?.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone size={13} />
                                    {event.customer.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Google Calendar button */}
                          {event.googleCalendarLink && (
                            <a
                              href={event.googleCalendarLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="shrink-0 p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                              title="Add to Google Calendar"
                            >
                              <ExternalLink size={16} className="text-zinc-400" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ============ LEGEND ============ */}
        <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Event Types</h3>
          <div className="flex flex-wrap gap-4">
            {[
              { label: 'Jobs / Inspections', dot: 'bg-brand-green' },
              { label: 'Deliveries / Pickups', dot: 'bg-green-500' },
              { label: 'Appointments / Estimates', dot: 'bg-orange-500' },
              { label: 'Meetings', dot: 'bg-purple-500' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${item.dot}`} />
                <span className="text-xs text-zinc-400">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============ CREATE APPOINTMENT FORM ============ */}
      {showCreateForm && (
        <CreateAppointmentForm
          teamMembers={allMembers.map(m => ({ id: m.id, name: m.name, slug: m.slug, role: m.role }))}
          onClose={() => setShowCreateForm(false)}
          onCreated={() => {
            setShowCreateForm(false);
            fetchEvents();
          }}
          defaultDate={currentDate}
        />
      )}

      {/* ============ EVENT DETAIL MODAL ============ */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEvent(null)}>
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                {(() => {
                  const cfg = getEventConfig(selectedEvent.eventType);
                  return (
                    <span className={`text-xs font-medium px-2.5 py-1 rounded ${cfg.bg} ${cfg.text}`}>
                      {cfg.label}
                    </span>
                  );
                })()}
                <span className={`text-xs font-medium px-2.5 py-1 rounded ${STATUS_STYLES[selectedEvent.status] || STATUS_STYLES.scheduled}`}>
                  {selectedEvent.status.replace('_', ' ')}
                </span>
                {selectedEvent.source && (
                  <span className="text-xs text-zinc-500 capitalize">
                    via {selectedEvent.source}
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6">
              <h2 className="text-xl font-bold text-white">{selectedEvent.title}</h2>

              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3 text-zinc-300">
                  <Calendar className="h-5 w-5 text-lime-400 shrink-0" />
                  <span>
                    {new Date(selectedEvent.start).toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                    })}
                  </span>
                </div>

                {!selectedEvent.allDay && (
                  <div className="flex items-center gap-3 text-zinc-300">
                    <Clock className="h-5 w-5 text-lime-400 shrink-0" />
                    <span>
                      {formatTime(selectedEvent.start)} - {formatTime(selectedEvent.end)}
                    </span>
                  </div>
                )}

                {selectedEvent.location && (
                  <div className="flex items-center gap-3 text-zinc-300">
                    <MapPin className="h-5 w-5 text-lime-400 shrink-0" />
                    <span>{selectedEvent.location}</span>
                  </div>
                )}

                {selectedEvent.assignedToName && (
                  <div className="flex items-center gap-3 text-zinc-300">
                    <User className="h-5 w-5 text-lime-400 shrink-0" />
                    <span>{selectedEvent.assignedToName}</span>
                  </div>
                )}

                {selectedEvent.priority !== 'normal' && (
                  <div className="flex items-center gap-3 text-zinc-300">
                    <AlertCircle className="h-5 w-5 text-lime-400 shrink-0" />
                    <span className="capitalize">{selectedEvent.priority} Priority</span>
                  </div>
                )}
              </div>

              {/* Customer info */}
              {selectedEvent.customer && (
                <div className="mt-6 bg-zinc-800/50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">Customer</h3>
                  <p className="font-semibold text-white">{selectedEvent.customer.name}</p>
                  {selectedEvent.customer.phone && (
                    <a
                      href={`tel:${selectedEvent.customer.phone}`}
                      className="mt-1 flex items-center gap-2 text-sm text-lime-400 hover:underline"
                    >
                      <Phone className="h-4 w-4" />
                      {selectedEvent.customer.phone}
                    </a>
                  )}
                  {selectedEvent.customer.email && (
                    <a
                      href={`mailto:${selectedEvent.customer.email}`}
                      className="mt-1 flex items-center gap-2 text-sm text-lime-400 hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {selectedEvent.customer.email}
                    </a>
                  )}
                </div>
              )}

              {/* Notes */}
              {selectedEvent.notes && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-zinc-400 mb-1">Notes</h3>
                  <p className="text-zinc-300 text-sm whitespace-pre-wrap">{selectedEvent.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 flex flex-col gap-3">
                {selectedEvent.googleCalendarLink && (
                  <a
                    href={selectedEvent.googleCalendarLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-lime-500 text-zinc-900 font-medium rounded-lg hover:bg-lime-400 transition-colors"
                  >
                    <ExternalLink size={18} />
                    Add to Google Calendar
                  </a>
                )}

                {selectedEvent.location && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedEvent.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800 text-zinc-300 font-medium rounded-lg hover:bg-zinc-700 transition-colors"
                  >
                    <Navigation size={18} />
                    Open in Google Maps
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
