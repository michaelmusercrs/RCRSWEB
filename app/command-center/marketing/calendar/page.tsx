'use client';

/**
 * RCRS Command Center - Marketing Content Calendar
 *
 * Monthly calendar view for Q1 2026 marketing events.
 * Shows events color-coded by type with detail modals.
 *
 * Role-based: Requires marketing.view permission
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  Hash,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import {
  CALENDAR_EVENTS,
  CalendarEvent,
  CalendarEventType,
  getCalendarEventsByMonth,
  getEventTypeBgColor,
  getEventTypeColor,
} from '@/lib/marketing-data';

// Q1 2026 months
const Q1_MONTHS = [
  { year: 2026, month: 1, name: 'January', short: 'Jan' },
  { year: 2026, month: 2, name: 'February', short: 'Feb' },
  { year: 2026, month: 3, name: 'March', short: 'Mar' },
];

// Days of week
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Event type legend data
const EVENT_TYPES: { type: CalendarEventType; label: string }[] = [
  { type: 'Social', label: 'Social Media' },
  { type: 'Email', label: 'Email Campaign' },
  { type: 'Blog', label: 'Blog Post' },
  { type: 'Ad', label: 'Ad Launch' },
];

// Get calendar days for a month
function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const days: (number | null)[] = [];

  // Add empty slots for days before the 1st
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }

  // Add days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  // Pad to complete final week
  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

// Event badge component
function EventBadge({ event, compact }: { event: CalendarEvent; compact?: boolean }) {
  return (
    <div
      className={cn(
        'rounded px-1.5 py-0.5 text-xs font-medium truncate',
        getEventTypeBgColor(event.type),
        compact ? 'text-[10px]' : 'text-xs'
      )}
      title={event.title}
    >
      {compact ? event.type.charAt(0) : event.title}
    </div>
  );
}

// Calendar day cell component
interface DayCellProps {
  day: number | null;
  year: number;
  month: number;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  isToday: boolean;
}

function DayCell({ day, year, month, events, onEventClick, isToday }: DayCellProps) {
  if (day === null) {
    return <div className="min-h-[100px] bg-zinc-900/30" />;
  }

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const dayEvents = events.filter(e => e.date === dateStr);

  return (
    <div
      className={cn(
        'min-h-[100px] border-t border-zinc-800 p-1',
        isToday && 'bg-lime-500/5'
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-full text-sm',
            isToday ? 'bg-lime-500 font-bold text-zinc-900' : 'text-zinc-400'
          )}
        >
          {day}
        </span>
        {dayEvents.length > 2 && (
          <span className="text-xs text-zinc-500">+{dayEvents.length - 2}</span>
        )}
      </div>
      <div className="mt-1 space-y-1">
        {dayEvents.slice(0, 2).map((event) => (
          <button
            key={event.id}
            onClick={() => onEventClick(event)}
            className="w-full text-left transition-transform hover:scale-[1.02]"
          >
            <EventBadge event={event} />
          </button>
        ))}
        {dayEvents.length > 2 && (
          <button
            onClick={() => onEventClick(dayEvents[2])}
            className="w-full text-left text-xs text-zinc-500 hover:text-zinc-300"
          >
            +{dayEvents.length - 2} more
          </button>
        )}
      </div>
    </div>
  );
}

// Event detail modal component
interface EventModalProps {
  event: CalendarEvent | null;
  onClose: () => void;
}

function EventModal({ event, onClose }: EventModalProps) {
  React.useEffect(() => {
    if (event) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [event]);

  if (!event) return null;

  const eventDate = new Date(event.date);
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-800 p-5">
          <div>
            <span className={cn('mb-2 inline-block rounded-full px-2.5 py-1 text-xs font-medium', getEventTypeBgColor(event.type))}>
              {event.type}
            </span>
            <h2 className="text-xl font-bold text-white">{event.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800">
                <Calendar className="h-5 w-5 text-lime-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Date</p>
                <p className="text-sm text-white">{formattedDate}</p>
              </div>
            </div>

            {event.channel && (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800">
                  <Hash className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Channel</p>
                  <p className="text-sm text-white">{event.channel}</p>
                </div>
              </div>
            )}

            <div className="border-t border-zinc-800 pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                Description
              </p>
              <p className="text-sm text-zinc-300">{event.description}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 p-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-zinc-800 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MarketingCalendarPage() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = React.useState(0); // Index in Q1_MONTHS
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEvent | null>(null);

  // Check permission
  const userRole = (user?.role === 'owner' || user?.role === 'admin') ? 'Owner' :
                   user?.role === 'office' ? 'Office' :
                   user?.role === 'driver' ? 'Driver' : 'Sales';
  const canView = hasPermission(userRole as 'Owner' | 'Admin' | 'Manager' | 'Sales' | 'Driver' | 'Office', 'marketing.view');

  const currentMonth = Q1_MONTHS[selectedMonth];
  const calendarDays = getCalendarDays(currentMonth.year, currentMonth.month);
  const monthEvents = getCalendarEventsByMonth(currentMonth.year, currentMonth.month);

  // Check if a day is today
  const today = new Date();
  const isToday = (day: number) => {
    return (
      today.getFullYear() === currentMonth.year &&
      today.getMonth() + 1 === currentMonth.month &&
      today.getDate() === day
    );
  };

  // Event counts by type
  const eventCounts = EVENT_TYPES.map(({ type, label }) => ({
    type,
    label,
    count: monthEvents.filter(e => e.type === type).length,
  }));

  if (!canView) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Calendar className="mx-auto h-12 w-12 text-zinc-600" />
          <h2 className="mt-4 text-xl font-semibold text-white">Access Restricted</h2>
          <p className="mt-2 text-zinc-400">
            You do not have permission to view the Content Calendar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/command-center/marketing"
          className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Marketing Hub
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Content Calendar</h1>
            <p className="mt-1 text-zinc-400">
              Q1 2026 Marketing Schedule - {CALENDAR_EVENTS.length} total events
            </p>
          </div>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedMonth(Math.max(0, selectedMonth - 1))}
            disabled={selectedMonth === 0}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="min-w-[200px] text-center text-xl font-bold text-white">
            {currentMonth.name} {currentMonth.year}
          </h2>
          <button
            onClick={() => setSelectedMonth(Math.min(Q1_MONTHS.length - 1, selectedMonth + 1))}
            disabled={selectedMonth === Q1_MONTHS.length - 1}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Quick month buttons */}
        <div className="flex gap-2">
          {Q1_MONTHS.map((month, index) => (
            <button
              key={month.month}
              onClick={() => setSelectedMonth(index)}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                selectedMonth === index
                  ? 'bg-lime-500 text-zinc-900'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
              )}
            >
              {month.short}
            </button>
          ))}
        </div>
      </div>

      {/* Legend and Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          {EVENT_TYPES.map(({ type, label }) => (
            <div key={type} className="flex items-center gap-2">
              <div className={cn('h-3 w-3 rounded', getEventTypeColor(type))} />
              <span className="text-sm text-zinc-400">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Clock className="h-4 w-4" />
          <span>{monthEvents.length} events this month</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-800/50">
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day}
              className="border-r border-zinc-800 p-2 text-center text-sm font-medium text-zinc-400 last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => (
            <div key={index} className="border-r border-zinc-800 last:border-r-0">
              <DayCell
                day={day}
                year={currentMonth.year}
                month={currentMonth.month}
                events={monthEvents}
                onEventClick={setSelectedEvent}
                isToday={day !== null && isToday(day)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {eventCounts.map(({ type, label, count }) => (
          <div
            key={type}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-white">{count}</p>
              </div>
              <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', getEventTypeBgColor(type))}>
                <span className="text-lg font-bold">{count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming Events List */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="mb-4 text-lg font-semibold text-white">
          {currentMonth.name} Events
        </h3>
        {monthEvents.length > 0 ? (
          <div className="space-y-2">
            {monthEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className="flex w-full items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 text-left transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
              >
                <div className="text-center">
                  <p className="text-xs text-zinc-500">
                    {new Date(event.date).toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <p className="text-lg font-bold text-white">
                    {new Date(event.date).getDate()}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', getEventTypeBgColor(event.type))}>
                      {event.type}
                    </span>
                    <h4 className="truncate font-medium text-white">{event.title}</h4>
                  </div>
                  <p className="mt-1 truncate text-sm text-zinc-500">{event.description}</p>
                </div>
                {event.channel && (
                  <span className="hidden shrink-0 text-sm text-zinc-500 sm:block">
                    {event.channel}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-center text-zinc-500">No events scheduled for this month.</p>
        )}
      </div>

      {/* Event Modal */}
      <EventModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
