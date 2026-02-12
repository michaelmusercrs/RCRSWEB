'use client';

/**
 * Calendar View Component
 *
 * Displays calendar events in daily, weekly, or monthly view.
 * Used in Command Center and Admin Dashboard.
 */

import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  List,
  Grid3x3,
  Filter,
} from 'lucide-react';

// Event types from API
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
  customer?: {
    id?: string;
    name: string;
    phone?: string;
    email?: string;
  };
  jobId?: string;
  assignedTo?: string;
  assignedToName?: string;
  priority: string;
}

interface CalendarViewProps {
  className?: string;
  onEventClick?: (event: CalendarEvent) => void;
  showFilters?: boolean;
  defaultView?: 'day' | 'week' | 'month' | 'list';
}

// Event type colors
const EVENT_COLORS: Record<string, string> = {
  inspection: 'bg-blue-500',
  installation: 'bg-lime-500',
  repair: 'bg-amber-500',
  delivery: 'bg-purple-500',
  pickup: 'bg-pink-500',
  meeting: 'bg-indigo-500',
  followup: 'bg-teal-500',
  estimate: 'bg-orange-500',
  other: 'bg-gray-500',
};

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'border-l-4 border-l-blue-400',
  confirmed: 'border-l-4 border-l-green-400',
  in_progress: 'border-l-4 border-l-yellow-400',
  completed: 'border-l-4 border-l-lime-400 opacity-70',
  cancelled: 'border-l-4 border-l-red-400 opacity-50 line-through',
  rescheduled: 'border-l-4 border-l-orange-400',
};

export default function CalendarView({
  className = '',
  onEventClick,
  showFilters = true,
  defaultView = 'week',
}: CalendarViewProps) {
  const [view, setView] = useState<'day' | 'week' | 'month' | 'list'>(defaultView);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEventType, setSelectedEventType] = useState<string>('all');

  // Fetch events on mount and date change
  useEffect(() => {
    fetchEvents();
  }, [currentDate, view]);

  const getDateRange = () => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    switch (view) {
      case 'day':
        break;
      case 'week':
        start.setDate(start.getDate() - start.getDay());
        end.setDate(end.getDate() + (6 - end.getDay()));
        break;
      case 'month':
      case 'list':
        start.setDate(1);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
        break;
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  };

  const fetchEvents = async () => {
    setIsLoading(true);
    setError('');

    try {
      const { startDate, endDate } = getDateRange();
      const params = new URLSearchParams({ startDate, endDate });

      if (selectedEventType !== 'all') {
        params.append('eventType', selectedEventType);
      }

      const response = await fetch(`/api/calendar/events?${params}`);
      const data = await response.json();

      if (data.success) {
        setEvents(data.events);
      } else {
        setError(data.error || 'Failed to load events');
      }
    } catch {
      setError('Failed to load calendar events');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);

    switch (view) {
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'month':
      case 'list':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
    }

    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatDateHeader = () => {
    switch (view) {
      case 'day':
        return currentDate.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      case 'week':
        const weekStart = new Date(currentDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case 'month':
      case 'list':
        return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => event.start.split('T')[0] === dateStr);
  };

  const formatEventTime = (event: CalendarEvent) => {
    if (event.allDay) return 'All Day';
    const start = new Date(event.start);
    return start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  // Render event card
  const EventCard = ({ event, compact = false }: { event: CalendarEvent; compact?: boolean }) => (
    <div
      onClick={() => onEventClick?.(event)}
      className={`
        ${compact ? 'p-2' : 'p-3'}
        bg-zinc-800 rounded-lg cursor-pointer transition-all hover:bg-zinc-700
        ${STATUS_STYLES[event.status] || STATUS_STYLES.scheduled}
      `}
    >
      <div className="flex items-start gap-2">
        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${EVENT_COLORS[event.eventType] || EVENT_COLORS.other}`} />
        <div className="min-w-0 flex-1">
          <p className={`font-medium text-white ${compact ? 'text-xs' : 'text-sm'} truncate`}>
            {event.title}
          </p>
          {!compact && (
            <>
              <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
                <Clock className="w-3 h-3" />
                {formatEventTime(event)}
              </div>
              {event.location && (
                <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{event.location}</span>
                </div>
              )}
              {event.assignedToName && (
                <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
                  <User className="w-3 h-3" />
                  {event.assignedToName}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  // Generate week days
  const getWeekDays = () => {
    const days: Date[] = [];
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());

    for (let i = 0; i < 7; i++) {
      days.push(new Date(start));
      start.setDate(start.getDate() + 1);
    }

    return days;
  };

  // Generate month days
  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: Date[] = [];
    const current = new Date(startDate);

    while (current <= lastDay || days.length % 7 !== 0 || days.length < 35) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
      if (days.length > 42) break;
    }

    return days;
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className={`bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateDate('prev')}
              className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-white min-w-[200px] text-center">
              {formatDateHeader()}
            </h2>
            <button
              onClick={() => navigateDate('next')}
              className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={goToToday}
              className="ml-2 px-3 py-1 text-sm rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Today
            </button>
          </div>

          {/* View Toggles & Filters */}
          <div className="flex items-center gap-2">
            {showFilters && (
              <select
                value={selectedEventType}
                onChange={(e) => {
                  setSelectedEventType(e.target.value);
                  fetchEvents();
                }}
                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
              >
                <option value="all">All Types</option>
                <option value="inspection">Inspections</option>
                <option value="installation">Installations</option>
                <option value="delivery">Deliveries</option>
                <option value="meeting">Meetings</option>
              </select>
            )}

            <div className="flex items-center border border-zinc-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setView('list')}
                className={`p-2 ${view === 'list' ? 'bg-lime-500 text-black' : 'text-zinc-400 hover:bg-zinc-800'}`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('week')}
                className={`p-2 ${view === 'week' ? 'bg-lime-500 text-black' : 'text-zinc-400 hover:bg-zinc-800'}`}
                title="Week View"
              >
                <Calendar className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('month')}
                className={`p-2 ${view === 'month' ? 'bg-lime-500 text-black' : 'text-zinc-400 hover:bg-zinc-800'}`}
                title="Month View"
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={fetchEvents}
              className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-lime-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Filter className="w-12 h-12 text-zinc-600 mb-4" />
            <p className="text-zinc-400">{error}</p>
            <button
              onClick={fetchEvents}
              className="mt-4 text-lime-500 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* List View */}
            {view === 'list' && (
              <div className="divide-y divide-zinc-800">
                {events.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500">
                    No events scheduled for this period
                  </div>
                ) : (
                  events.map(event => (
                    <div key={event.id} className="p-4 hover:bg-zinc-800/50 transition-colors">
                      <EventCard event={event} />
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Week View */}
            {view === 'week' && (
              <div className="grid grid-cols-7 divide-x divide-zinc-800">
                {getWeekDays().map((day, index) => {
                  const dayEvents = getEventsForDate(day);
                  const isToday = day.toDateString() === today.toDateString();

                  return (
                    <div key={index} className="min-h-[300px]">
                      <div className={`p-2 text-center border-b border-zinc-800 ${isToday ? 'bg-lime-500/10' : ''}`}>
                        <p className="text-xs text-zinc-500">
                          {day.toLocaleDateString('en-US', { weekday: 'short' })}
                        </p>
                        <p className={`text-lg font-semibold ${isToday ? 'text-lime-500' : 'text-white'}`}>
                          {day.getDate()}
                        </p>
                      </div>
                      <div className="p-2 space-y-2">
                        {dayEvents.map(event => (
                          <EventCard key={event.id} event={event} compact />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Month View */}
            {view === 'month' && (
              <div>
                <div className="grid grid-cols-7 border-b border-zinc-800">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="p-2 text-center text-xs font-medium text-zinc-500">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 divide-x divide-y divide-zinc-800">
                  {getMonthDays().map((day, index) => {
                    const dayEvents = getEventsForDate(day);
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                    const isToday = day.toDateString() === today.toDateString();

                    return (
                      <div
                        key={index}
                        className={`min-h-[100px] p-1 ${!isCurrentMonth ? 'bg-zinc-900/50' : ''} ${isToday ? 'bg-lime-500/5' : ''}`}
                      >
                        <p className={`text-xs font-medium p-1 ${
                          isToday ? 'text-lime-500' :
                          isCurrentMonth ? 'text-zinc-300' : 'text-zinc-600'
                        }`}>
                          {day.getDate()}
                        </p>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 3).map(event => (
                            <div
                              key={event.id}
                              onClick={() => onEventClick?.(event)}
                              className={`px-1 py-0.5 text-xs rounded truncate cursor-pointer ${EVENT_COLORS[event.eventType] || EVENT_COLORS.other} text-white`}
                            >
                              {event.title}
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <p className="text-xs text-zinc-500 px-1">
                              +{dayEvents.length - 3} more
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Day View */}
            {view === 'day' && (
              <div className="p-4">
                {getEventsForDate(currentDate).length === 0 ? (
                  <div className="py-12 text-center text-zinc-500">
                    No events scheduled for this day
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getEventsForDate(currentDate).map(event => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
        <div className="flex flex-wrap gap-4 text-xs">
          {Object.entries(EVENT_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${color}`} />
              <span className="text-zinc-400 capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
