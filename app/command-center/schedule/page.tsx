'use client';

/**
 * RCRS Command Center - Schedule Management (Admin View)
 *
 * Team-wide calendar with:
 * - Who's doing what today/this week
 * - Scheduling conflict detection
 * - Quick schedule creation
 * - Google Calendar integration
 * - Weather-aware scheduling
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar, Clock, MapPin, User, Truck, CheckCircle2,
  AlertCircle, Plus, ChevronLeft, ChevronRight,
  type LucideIcon, Loader2, RefreshCw, X, Phone, Mail,
  Cloud, CloudRain, Sun, Wind, AlertTriangle, ExternalLink,
  Users, Filter, Briefcase, Navigation, Eye, Search,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { TEAM_MEMBERS } from '@/lib/team-roles';
import CreateAppointmentForm from '@/components/calendar/CreateAppointmentForm';
import type { WeatherData, DayForecast, StormRisk } from '@/lib/weather-service';

// Calendar event from unified API
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
  source: string;
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

interface ScheduleStats {
  todayJobs: number;
  thisWeek: number;
  unassigned: number;
  completedToday: number;
  conflicts: number;
}

// Color coding for event types (same as portal)
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

function getEventConfig(type: string) {
  return EVENT_TYPE_CONFIG[type] || EVENT_TYPE_CONFIG.other;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Stat card
function StatCard({ title, value, icon: Icon, color, isLoading }: {
  title: string; value: string | number; icon: LucideIcon;
  color: 'lime' | 'blue' | 'orange' | 'purple' | 'red'; isLoading?: boolean;
}) {
  const colorClasses: Record<string, string> = {
    lime: 'bg-lime-500/10 text-lime-400',
    blue: 'bg-brand-green/10 text-blue-400',
    orange: 'bg-orange-500/10 text-orange-400',
    purple: 'bg-purple-500/10 text-purple-400',
    red: 'bg-red-500/10 text-red-400',
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-400">{title}</p>
          {isLoading ? (
            <div className="mt-2 h-9 w-16 animate-pulse rounded bg-zinc-700" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          )}
        </div>
        <div className={cn('rounded-lg p-3', colorClasses[color])}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

// Detect scheduling conflicts (overlapping events for same person)
function detectConflicts(events: CalendarEvent[]): { event1: CalendarEvent; event2: CalendarEvent }[] {
  const conflicts: { event1: CalendarEvent; event2: CalendarEvent }[] = [];
  const assignedEvents = events.filter(e =>
    (e.assignedTo || e.assignedToName) && e.status !== 'cancelled' && e.status !== 'completed'
  );

  for (let i = 0; i < assignedEvents.length; i++) {
    for (let j = i + 1; j < assignedEvents.length; j++) {
      const a = assignedEvents[i];
      const b = assignedEvents[j];

      // Check if same person
      const sameAssignee = (
        (a.assignedTo && b.assignedTo && a.assignedTo === b.assignedTo) ||
        (a.assignedToName && b.assignedToName && a.assignedToName === b.assignedToName)
      );

      if (!sameAssignee) continue;

      // Check if overlapping times
      const aStart = new Date(a.start).getTime();
      const aEnd = new Date(a.end).getTime();
      const bStart = new Date(b.start).getTime();
      const bEnd = new Date(b.end).getTime();

      if (aStart < bEnd && bStart < aEnd) {
        conflicts.push({ event1: a, event2: b });
      }
    }
  }

  return conflicts;
}

// Weather icons
const WEATHER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sun: Sun, 'cloud-sun': Cloud, cloud: Cloud, 'cloud-rain': CloudRain,
  'cloud-snow': CloudRain, 'cloud-lightning': CloudRain, 'cloud-drizzle': CloudRain, 'cloud-fog': Cloud,
};

const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  moderate: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  severe: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
};

export default function SchedulePage() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [weekEvents, setWeekEvents] = useState<CalendarEvent[]>([]);
  const [stats, setStats] = useState<ScheduleStats>({ todayJobs: 0, thisWeek: 0, unassigned: 0, completedToday: 0, conflicts: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [viewMode, setViewMode] = useState<'team' | 'timeline' | 'calendar'>('team');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [filterMember, setFilterMember] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showNewAppointment, setShowNewAppointment] = useState(false);

  // Permission check
  const userRole = (user?.role === 'owner' || user?.role === 'admin') ? 'Owner' :
                   user?.role === 'office' ? 'Office' :
                   user?.role === 'project_manager' ? 'Manager' :
                   user?.role === 'driver' ? 'Driver' : 'Sales';
  const canView = hasPermission(userRole as 'Owner' | 'Admin' | 'Manager' | 'Sales' | 'Driver' | 'Office', 'schedule.view');
  const canEdit = hasPermission(userRole as 'Owner' | 'Admin' | 'Manager' | 'Sales' | 'Driver' | 'Office', 'schedule.edit');

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const activeMembers = useMemo(() => TEAM_MEMBERS.filter(m => m.isActive), []);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const dateStr = formatDateKey(selectedDate);

      // Fetch today's events
      const todayRes = await fetch(`/api/calendar/events?startDate=${dateStr}&endDate=${dateStr}`);
      const todayData = await todayRes.json();

      if (todayData.success) {
        setAllEvents(todayData.events || []);

        // Detect conflicts
        const conflicts = detectConflicts(todayData.events || []);

        // Calc stats
        const completed = (todayData.events || []).filter((e: CalendarEvent) => e.status === 'completed').length;
        const unassigned = (todayData.events || []).filter((e: CalendarEvent) => !e.assignedTo && !e.assignedToName).length;

        // Fetch week events
        const weekStart = new Date(selectedDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const weekRes = await fetch(
          `/api/calendar/events?startDate=${formatDateKey(weekStart)}&endDate=${formatDateKey(weekEnd)}`
        );
        const weekData = await weekRes.json();
        setWeekEvents(weekData.success ? weekData.events || [] : []);

        setStats({
          todayJobs: (todayData.events || []).length,
          thisWeek: weekData.success ? (weekData.events || []).length : 0,
          unassigned,
          completedToday: completed,
          conflicts: conflicts.length,
        });
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  const fetchWeather = useCallback(async () => {
    setWeatherLoading(true);
    try {
      const response = await fetch('/api/weather/forecast/35640');
      const data = await response.json();
      if (data.success && data.data) {
        setWeather(data.data);
      }
    } catch (error) {
      console.error('Error fetching weather:', error);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) {
      fetchEvents();
      fetchWeather();
    }
  }, [selectedDate, canView, fetchEvents, fetchWeather]);

  if (!canView) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Calendar className="mx-auto h-12 w-12 text-zinc-600" />
          <h2 className="mt-4 text-xl font-semibold text-white">Access Restricted</h2>
          <p className="mt-2 text-zinc-400">You do not have permission to view the Schedule.</p>
        </div>
      </div>
    );
  }

  const formattedDate = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  // Group events by team member for team view
  const eventsByMember = useMemo(() => {
    const grouped: Record<string, { member: typeof TEAM_MEMBERS[0] | null; events: CalendarEvent[] }> = {};

    // Initialize with active team members
    for (const member of activeMembers) {
      grouped[member.slug] = { member, events: [] };
    }
    grouped['unassigned'] = { member: null, events: [] };

    for (const event of allEvents) {
      const assigneeSlug = event.assignedTo || event.assignedToName?.toLowerCase().replace(/\s+/g, '-') || '';
      const matched = activeMembers.find(m =>
        m.slug === assigneeSlug ||
        m.name.toLowerCase() === (event.assignedToName || '').toLowerCase() ||
        m.id === event.assignedTo
      );

      if (matched) {
        if (!grouped[matched.slug]) {
          grouped[matched.slug] = { member: matched, events: [] };
        }
        grouped[matched.slug].events.push(event);
      } else if (event.assignedToName) {
        // External assignee
        const key = `ext-${event.assignedToName}`;
        if (!grouped[key]) {
          grouped[key] = { member: null, events: [] };
        }
        grouped[key].events.push(event);
      } else {
        grouped['unassigned'].events.push(event);
      }
    }

    // Filter by selected member
    if (filterMember) {
      const filtered: typeof grouped = {};
      if (grouped[filterMember]) {
        filtered[filterMember] = grouped[filterMember];
      }
      return filtered;
    }

    // Only return members with events (or unassigned if it has events)
    const result: typeof grouped = {};
    for (const [key, value] of Object.entries(grouped)) {
      if (value.events.length > 0) {
        result[key] = value;
      }
    }
    return result;
  }, [allEvents, activeMembers, filterMember]);

  // Conflicts
  const conflicts = useMemo(() => detectConflicts(allEvents), [allEvents]);

  // Week day columns for timeline view
  const weekDays = useMemo(() => {
    const start = new Date(selectedDate);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Schedule Management</h1>
          <p className="mt-1 text-zinc-400">Team-wide calendar, assignments & scheduling</p>
        </div>
        <div className="flex items-center gap-3">
          {canEdit && (
            <button
              onClick={() => setShowNewAppointment(true)}
              className="flex items-center gap-2 px-4 py-2 bg-lime-500 text-zinc-900 font-medium rounded-lg hover:bg-lime-400 transition-colors text-sm"
            >
              <Plus size={16} />
              New Appointment
            </button>
          )}

          {/* View toggle */}
          <div className="flex items-center border border-zinc-700 rounded-lg overflow-hidden">
            {[
              { id: 'team', label: 'Team', icon: Users },
              { id: 'timeline', label: 'Week', icon: Calendar },
              { id: 'calendar', label: 'Month', icon: Eye },
            ].map(v => (
              <button
                key={v.id}
                onClick={() => setViewMode(v.id as typeof viewMode)}
                className={cn(
                  'px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1.5',
                  viewMode === v.id ? 'bg-lime-500 text-zinc-900' : 'text-zinc-400 hover:bg-zinc-800'
                )}
              >
                <v.icon size={16} />
                {v.label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchEvents}
            className="p-2 rounded-lg border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Today's Events" value={stats.todayJobs} icon={Calendar} color="lime" isLoading={isLoading} />
        <StatCard title="This Week" value={stats.thisWeek} icon={Clock} color="blue" isLoading={isLoading} />
        <StatCard title="Unassigned" value={stats.unassigned} icon={AlertCircle} color="orange" isLoading={isLoading} />
        <StatCard title="Completed Today" value={stats.completedToday} icon={CheckCircle2} color="purple" isLoading={isLoading} />
        <StatCard title="Conflicts" value={stats.conflicts} icon={AlertTriangle} color={stats.conflicts > 0 ? 'red' : 'lime'} isLoading={isLoading} />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-4">
        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d);
            }}
            className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-center min-w-[200px]">
            <h2 className="text-lg font-semibold text-white">{formattedDate}</h2>
          </div>
          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(d);
            }}
            className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
          <button
            onClick={() => setSelectedDate(new Date())}
            className="px-3 py-1.5 text-sm border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-800"
          >
            Today
          </button>
        </div>

        <div className="flex-1" />

        {/* Team member filter */}
        <select
          value={filterMember}
          onChange={(e) => setFilterMember(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-lime-500"
        >
          <option value="">All Team Members</option>
          {activeMembers.map(m => (
            <option key={m.id} value={m.slug}>{m.name}</option>
          ))}
        </select>
      </div>

      {/* Conflict warnings */}
      {conflicts.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <h3 className="font-semibold text-red-400">Scheduling Conflicts Detected</h3>
          </div>
          <div className="space-y-2">
            {conflicts.slice(0, 5).map((conflict, i) => (
              <div key={i} className="text-sm text-red-300">
                <span className="font-medium">{conflict.event1.assignedToName || 'Unknown'}</span>
                {' has overlapping events: '}
                <span className="text-red-200">"{conflict.event1.title}"</span>
                {' and '}
                <span className="text-red-200">"{conflict.event2.title}"</span>
                {' at '}
                {formatTime(conflict.event1.start)}
              </div>
            ))}
            {conflicts.length > 5 && (
              <p className="text-xs text-red-400">+{conflicts.length - 5} more conflicts</p>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-lime-500" />
            </div>
          ) : (
            <>
              {/* ============ TEAM VIEW ============ */}
              {viewMode === 'team' && (
                <div className="space-y-4">
                  {Object.entries(eventsByMember).length === 0 ? (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900 py-12 text-center">
                      <Calendar className="mx-auto h-12 w-12 text-zinc-600" />
                      <p className="mt-4 text-zinc-400">No events scheduled for this day</p>
                    </div>
                  ) : (
                    Object.entries(eventsByMember).map(([key, { member, events: memberEvents }]) => (
                      <div key={key} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                        {/* Member header */}
                        <div className="flex items-center gap-3 p-4 border-b border-zinc-800 bg-zinc-800/50">
                          <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                            {member ? (
                              <span className="text-sm font-bold text-white">
                                {member.name.split(' ').map(n => n[0]).join('')}
                              </span>
                            ) : (
                              <AlertCircle className="text-orange-400" size={20} />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold text-white">
                              {member?.name || (key === 'unassigned' ? 'Unassigned' : key.replace('ext-', ''))}
                            </h3>
                            {member && (
                              <p className="text-xs text-zinc-400 capitalize">{member.role.replace('_', ' ')}</p>
                            )}
                          </div>
                          <div className="ml-auto flex items-center gap-2">
                            <span className="text-sm text-zinc-400">{memberEvents.length} event{memberEvents.length !== 1 ? 's' : ''}</span>
                            {memberEvents.some(e => e.status === 'completed') && (
                              <span className="text-xs bg-lime-500/20 text-lime-400 px-2 py-0.5 rounded">
                                {memberEvents.filter(e => e.status === 'completed').length} done
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Events list */}
                        <div className="divide-y divide-zinc-800">
                          {memberEvents
                            .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
                            .map(event => {
                              const cfg = getEventConfig(event.eventType);
                              return (
                                <div
                                  key={event.id}
                                  onClick={() => setSelectedEvent(event)}
                                  className="p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                                >
                                  <div className="flex items-start gap-4">
                                    {/* Time */}
                                    <div className="w-16 text-center shrink-0">
                                      <p className="text-sm font-bold text-white">
                                        {event.allDay ? 'ALL' : formatTime(event.start).split(' ')[0]}
                                      </p>
                                      <p className="text-xs text-zinc-500">
                                        {event.allDay ? 'DAY' : formatTime(event.start).split(' ')[1]}
                                      </p>
                                    </div>

                                    {/* Details */}
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${cfg.bg} ${cfg.text}`}>
                                          {cfg.label}
                                        </span>
                                        <span className={cn(
                                          'text-xs font-medium px-2 py-0.5 rounded',
                                          event.status === 'completed' ? 'bg-lime-500/20 text-lime-400' :
                                          event.status === 'in_progress' ? 'bg-brand-green/20 text-blue-400' :
                                          event.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                                          'bg-zinc-700 text-zinc-300'
                                        )}>
                                          {event.status.replace('_', ' ')}
                                        </span>
                                        {event.priority !== 'normal' && (
                                          <span className={cn(
                                            'text-xs font-medium px-2 py-0.5 rounded',
                                            event.priority === 'urgent' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                                          )}>
                                            {event.priority}
                                          </span>
                                        )}
                                      </div>
                                      <h4 className="text-white font-medium mt-1 truncate">{event.title}</h4>
                                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-zinc-400">
                                        {event.location && (
                                          <span className="flex items-center gap-1">
                                            <MapPin size={12} /> {event.location}
                                          </span>
                                        )}
                                        {event.customer?.name && (
                                          <span className="flex items-center gap-1">
                                            <Briefcase size={12} /> {event.customer.name}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Google Calendar */}
                                    {event.googleCalendarLink && (
                                      <a
                                        href={event.googleCalendarLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors shrink-0"
                                        title="Add to Google Calendar"
                                      >
                                        <ExternalLink size={14} className="text-zinc-400" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ============ TIMELINE (WEEK) VIEW ============ */}
              {viewMode === 'timeline' && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                  {/* Week day headers */}
                  <div className="grid grid-cols-7 border-b border-zinc-800">
                    {weekDays.map((day, i) => {
                      const isToday = formatDateKey(day) === formatDateKey(today);
                      const dayEventCount = weekEvents.filter(e => e.start.split('T')[0] === formatDateKey(day)).length;
                      return (
                        <div
                          key={i}
                          onClick={() => {
                            setSelectedDate(new Date(day));
                            setViewMode('team');
                          }}
                          className={cn(
                            'p-3 text-center cursor-pointer hover:bg-zinc-800/50 transition-colors',
                            isToday && 'bg-lime-500/5'
                          )}
                        >
                          <p className="text-xs text-zinc-500">{day.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                          <p className={cn('text-xl font-bold', isToday ? 'text-lime-500' : 'text-white')}>
                            {day.getDate()}
                          </p>
                          <p className="text-xs text-zinc-500 mt-1">{dayEventCount} events</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Day columns with events */}
                  <div className="grid grid-cols-7 divide-x divide-zinc-800 min-h-[400px]">
                    {weekDays.map((day, i) => {
                      const dayEvents = weekEvents
                        .filter(e => e.start.split('T')[0] === formatDateKey(day))
                        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

                      return (
                        <div key={i} className="p-2 space-y-1.5">
                          {dayEvents.map(event => {
                            const cfg = getEventConfig(event.eventType);
                            return (
                              <div
                                key={event.id}
                                onClick={() => setSelectedEvent(event)}
                                className={cn(
                                  'p-2 rounded-lg cursor-pointer hover:opacity-80 transition-opacity',
                                  cfg.bg
                                )}
                              >
                                <p className={cn('text-[11px] font-medium', cfg.text)}>
                                  {event.allDay ? 'All Day' : formatTime(event.start)}
                                </p>
                                <p className="text-xs text-white font-medium truncate mt-0.5">{event.title}</p>
                                {event.assignedToName && (
                                  <p className="text-[10px] text-zinc-400 truncate mt-0.5">{event.assignedToName}</p>
                                )}
                              </div>
                            );
                          })}
                          {dayEvents.length === 0 && (
                            <p className="text-xs text-zinc-600 text-center py-4">No events</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ============ CALENDAR (MONTH) VIEW ============ */}
              {viewMode === 'calendar' && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                  {/* Month navigation */}
                  <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <button
                      onClick={() => {
                        const d = new Date(selectedDate);
                        d.setMonth(d.getMonth() - 1);
                        setSelectedDate(d);
                      }}
                      className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <h2 className="text-lg font-semibold text-white">
                      {selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h2>
                    <button
                      onClick={() => {
                        const d = new Date(selectedDate);
                        d.setMonth(d.getMonth() + 1);
                        setSelectedDate(d);
                      }}
                      className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>

                  {/* Day of week headers */}
                  <div className="grid grid-cols-7 border-b border-zinc-800">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                      <div key={d} className="p-2 text-center text-xs font-medium text-zinc-500">{d}</div>
                    ))}
                  </div>

                  {/* Month grid */}
                  <div className="grid grid-cols-7">
                    {(() => {
                      const year = selectedDate.getFullYear();
                      const month = selectedDate.getMonth();
                      const firstDay = new Date(year, month, 1);
                      const lastDay = new Date(year, month + 1, 0);
                      const days: Date[] = [];

                      for (let i = firstDay.getDay() - 1; i >= 0; i--) {
                        days.push(new Date(year, month, -i));
                      }
                      for (let i = 1; i <= lastDay.getDate(); i++) {
                        days.push(new Date(year, month, i));
                      }
                      const remaining = 42 - days.length;
                      for (let i = 1; i <= remaining; i++) {
                        days.push(new Date(year, month + 1, i));
                      }

                      return days.map((day, idx) => {
                        const isCurrentMonth = day.getMonth() === month;
                        const isToday = formatDateKey(day) === formatDateKey(today);
                        const dayEvts = weekEvents.filter(e => e.start.split('T')[0] === formatDateKey(day));

                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              setSelectedDate(new Date(day));
                              setViewMode('team');
                            }}
                            className={cn(
                              'min-h-[90px] p-1.5 border-b border-r border-zinc-800 cursor-pointer hover:bg-zinc-800/50 transition-colors',
                              !isCurrentMonth && 'bg-zinc-950/50',
                              isToday && 'bg-lime-500/5'
                            )}
                          >
                            <div className={cn(
                              'text-sm font-medium flex items-center justify-center w-7 h-7 rounded-full mb-1',
                              isToday ? 'bg-lime-500 text-zinc-900' : isCurrentMonth ? 'text-zinc-300' : 'text-zinc-600'
                            )}>
                              {day.getDate()}
                            </div>
                            <div className="space-y-0.5">
                              {dayEvts.slice(0, 2).map(event => {
                                const cfg = getEventConfig(event.eventType);
                                return (
                                  <div
                                    key={event.id}
                                    className={cn('text-[10px] px-1 py-0.5 rounded truncate', cfg.bg, cfg.text)}
                                  >
                                    {event.title}
                                  </div>
                                );
                              })}
                              {dayEvts.length > 2 && (
                                <p className="text-[10px] text-zinc-500 px-1">+{dayEvts.length - 2} more</p>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ============ SIDEBAR ============ */}
        <div className="space-y-6">
          {/* Weather Widget */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className="p-4 border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Weather</h3>
                {weather && <span className="text-xs text-zinc-500">{weather.location}</span>}
              </div>
            </div>

            {weatherLoading ? (
              <div className="p-4 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-lime-400" />
              </div>
            ) : weather ? (
              <div className="p-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="rounded-lg bg-zinc-800 p-3">
                    {(() => {
                      const WeatherIcon = WEATHER_ICONS[weather.current.icon] || Cloud;
                      return <WeatherIcon className="h-8 w-8 text-lime-400" />;
                    })()}
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-white">{weather.current.temp}&deg;F</p>
                    <p className="text-sm text-zinc-400">{weather.current.condition}</p>
                  </div>
                </div>

                <div className={cn(
                  'rounded-lg px-3 py-2 flex items-center gap-2',
                  weather.current.isWorkable ? 'bg-green-500/10' : 'bg-red-500/10'
                )}>
                  {weather.current.isWorkable ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                      <span className="text-sm text-green-400 font-medium">Good for Roofing</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                      <span className="text-sm text-red-400 font-medium">
                        {weather.current.workabilityReason || 'Weather Hold'}
                      </span>
                    </>
                  )}
                </div>

                {weather.stormRisk && weather.stormRisk.level !== 'low' && (
                  <div className={cn(
                    'mt-3 rounded-lg px-3 py-2 border',
                    RISK_COLORS[weather.stormRisk.level]?.bg,
                    RISK_COLORS[weather.stormRisk.level]?.border
                  )}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={cn('h-4 w-4', RISK_COLORS[weather.stormRisk.level]?.text)} />
                      <span className={cn('text-sm font-medium', RISK_COLORS[weather.stormRisk.level]?.text)}>
                        {weather.stormRisk.level.charAt(0).toUpperCase() + weather.stormRisk.level.slice(1)} Storm Risk
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">{weather.stormRisk.message}</p>
                  </div>
                )}

                {/* 5-Day Forecast */}
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <h4 className="text-xs font-medium text-zinc-400 mb-3">5-Day Outlook</h4>
                  <div className="space-y-2">
                    {weather.forecast.slice(0, 5).map((day: DayForecast) => {
                      const DayIcon = WEATHER_ICONS[day.icon] || Cloud;
                      return (
                        <div key={day.date} className={cn(
                          'flex items-center gap-3 text-sm py-1',
                          !day.isWorkable && 'bg-red-500/5 -mx-2 px-2 rounded'
                        )}>
                          <span className="w-14 text-zinc-400 truncate text-xs">{day.dayOfWeek}</span>
                          <DayIcon className={cn('h-4 w-4', day.isWorkable ? 'text-lime-400' : 'text-red-400')} />
                          <span className="flex-1 text-zinc-500 truncate text-xs">{day.condition}</span>
                          <span className="text-white font-medium text-xs">{day.high}&deg;</span>
                          {!day.isWorkable && <span className="text-[10px] text-red-400">Hold</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-zinc-500 text-sm">Unable to load weather</div>
            )}
          </div>

          {/* Event Type Legend */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-3 font-semibold text-white">Event Types</h3>
            <div className="space-y-2">
              {[
                { label: 'Jobs / Inspections', dot: 'bg-brand-green' },
                { label: 'Deliveries / Pickups', dot: 'bg-green-500' },
                { label: 'Appointments / Estimates', dot: 'bg-orange-500' },
                { label: 'Meetings', dot: 'bg-purple-500' },
                { label: 'Repairs', dot: 'bg-amber-500' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={cn('h-2.5 w-2.5 rounded-full', item.dot)} />
                  <span className="text-sm text-zinc-400">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-3 font-semibold text-white">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                href="/portal/schedule"
                className="flex w-full items-center gap-3 rounded-lg bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
              >
                <Calendar size={18} className="text-lime-400" />
                Full Calendar View
              </Link>
              <button
                onClick={() => setViewMode('timeline')}
                className="flex w-full items-center gap-3 rounded-lg bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
              >
                <Clock size={18} className="text-blue-400" />
                Week Timeline
              </button>
              <button
                onClick={fetchEvents}
                className="flex w-full items-center gap-3 rounded-lg bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
              >
                <RefreshCw size={18} className={cn('text-zinc-400', isLoading && 'animate-spin')} />
                Refresh Schedule
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============ CREATE APPOINTMENT FORM ============ */}
      {showNewAppointment && (
        <CreateAppointmentForm
          teamMembers={activeMembers.map(m => ({ id: m.id, name: m.name, slug: m.slug, role: m.role }))}
          onClose={() => setShowNewAppointment(false)}
          onCreated={() => {
            setShowNewAppointment(false);
            fetchEvents();
          }}
          defaultDate={selectedDate}
        />
      )}

      {/* ============ EVENT DETAIL MODAL ============ */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedEvent(null)}>
          <div
            className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 p-4">
              <div className="flex items-center gap-2">
                {(() => {
                  const cfg = getEventConfig(selectedEvent.eventType);
                  return (
                    <span className={cn('text-xs font-medium px-2.5 py-1 rounded', cfg.bg, cfg.text)}>
                      {cfg.label}
                    </span>
                  );
                })()}
                <span className={cn(
                  'text-xs font-medium px-2.5 py-1 rounded',
                  selectedEvent.status === 'completed' ? 'bg-lime-500/20 text-lime-400' :
                  selectedEvent.status === 'in_progress' ? 'bg-brand-green/20 text-blue-400' :
                  selectedEvent.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                  'bg-zinc-700 text-zinc-300'
                )}>
                  {selectedEvent.status.replace('_', ' ')}
                </span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <h2 className="text-xl font-bold text-white">{selectedEvent.title}</h2>

              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3 text-zinc-300">
                  <Calendar className="h-5 w-5 text-lime-400" />
                  <span>{new Date(selectedEvent.start).toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                  })}</span>
                </div>

                {!selectedEvent.allDay && (
                  <div className="flex items-center gap-3 text-zinc-300">
                    <Clock className="h-5 w-5 text-lime-400" />
                    <span>{formatTime(selectedEvent.start)} - {formatTime(selectedEvent.end)}</span>
                  </div>
                )}

                {selectedEvent.location && (
                  <div className="flex items-center gap-3 text-zinc-300">
                    <MapPin className="h-5 w-5 text-lime-400" />
                    <span>{selectedEvent.location}</span>
                  </div>
                )}

                {selectedEvent.assignedToName && (
                  <div className="flex items-center gap-3 text-zinc-300">
                    <User className="h-5 w-5 text-lime-400" />
                    <span>{selectedEvent.assignedToName}</span>
                  </div>
                )}
              </div>

              {selectedEvent.customer && (
                <div className="mt-6 rounded-lg bg-zinc-800/50 p-4">
                  <h3 className="text-sm font-medium text-zinc-400">Customer</h3>
                  <p className="mt-1 font-semibold text-white">{selectedEvent.customer.name}</p>
                  {selectedEvent.customer.phone && (
                    <a href={`tel:${selectedEvent.customer.phone}`} className="mt-2 flex items-center gap-2 text-sm text-lime-400 hover:underline">
                      <Phone className="h-4 w-4" /> {selectedEvent.customer.phone}
                    </a>
                  )}
                  {selectedEvent.customer.email && (
                    <a href={`mailto:${selectedEvent.customer.email}`} className="mt-1 flex items-center gap-2 text-sm text-lime-400 hover:underline">
                      <Mail className="h-4 w-4" /> {selectedEvent.customer.email}
                    </a>
                  )}
                </div>
              )}

              {selectedEvent.notes && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-zinc-400">Notes</h3>
                  <p className="mt-1 whitespace-pre-wrap text-zinc-300 text-sm">{selectedEvent.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 flex flex-col gap-3">
                {selectedEvent.googleCalendarLink && (
                  <a
                    href={selectedEvent.googleCalendarLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-lg bg-lime-500 py-2.5 font-medium text-zinc-900 transition-colors hover:bg-lime-400"
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
                    className="flex items-center justify-center gap-2 rounded-lg bg-zinc-800 py-2.5 font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
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

