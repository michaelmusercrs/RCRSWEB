'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Calendar, Clock, MapPin, Truck, Package, User,
  ChevronLeft, ChevronRight, RefreshCw, Loader2, Navigation,
  Route, Play, CheckCircle2, AlertCircle, Phone, Plus, Filter
} from 'lucide-react';
import { TEAM_MEMBERS, getDrivers, getProjectManagers, TeamMember } from '@/lib/team-roles';
import type { ScheduledEvent, DailyRoute } from '@/lib/scheduling-service';

type ViewMode = 'calendar' | 'day' | 'route';

const eventTypeColors: Record<string, string> = {
  delivery: 'bg-blue-500',
  pickup: 'bg-orange-500',
  return: 'bg-purple-500',
  inspection: 'bg-green-500',
  meeting: 'bg-cyan-500',
  other: 'bg-gray-500'
};

const priorityColors: Record<string, string> = {
  normal: 'border-l-gray-400',
  rush: 'border-l-yellow-500',
  urgent: 'border-l-red-500'
};

export default function SchedulePage() {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const [calendarEvents, setCalendarEvents] = useState<Record<string, ScheduledEvent[]>>({});
  const [dayEvents, setDayEvents] = useState<ScheduledEvent[]>([]);
  const [dailyRoute, setDailyRoute] = useState<DailyRoute | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    eventType: 'delivery' as const,
    jobName: '',
    jobAddress: '',
    city: '',
    state: 'AL',
    zip: '',
    scheduledDate: selectedDate,
    scheduledTime: '09:00',
    estimatedDuration: 30,
    assignedTo: '',
    customerName: '',
    customerPhone: '',
    projectManager: '',
    priority: 'normal' as const,
    notes: ''
  });

  const drivers = getDrivers();
  const projectManagers = getProjectManagers();

  useEffect(() => {
    loadData();
  }, [currentDate, selectedDate, selectedDriver, viewMode]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (viewMode === 'calendar') {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const response = await fetch(`/api/portal/schedule?action=calendar-month&year=${year}&month=${month}`);
        const data = await response.json();
        setCalendarEvents(data.calendar || {});
      } else if (viewMode === 'day') {
        const driverId = selectedDriver || undefined;
        let url = `/api/portal/schedule?action=events-for-date&date=${selectedDate}`;
        if (driverId) url += `&driverId=${driverId}`;
        const response = await fetch(url);
        const data = await response.json();
        setDayEvents(data.events || []);
      } else if (viewMode === 'route' && selectedDriver) {
        const response = await fetch(`/api/portal/schedule?action=daily-route&driverId=${selectedDriver}&date=${selectedDate}`);
        const data = await response.json();
        setDailyRoute(data.route);
      }
    } catch (error) {
      console.error('Error loading schedule data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptimizeRoute = async () => {
    if (!selectedDriver) {
      alert('Please select a driver first');
      return;
    }

    try {
      const response = await fetch('/api/portal/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'optimize-route',
          driverId: selectedDriver,
          date: selectedDate
        })
      });

      const data = await response.json();
      if (data.success) {
        setDailyRoute(data.route);
        alert(`Route optimized! Total distance: ${data.route.totalDistance} miles`);
      }
    } catch (error) {
      console.error('Error optimizing route:', error);
      alert('Failed to optimize route');
    }
  };

  const handleCreateEvent = async () => {
    try {
      const driver = drivers.find(d => d.id === newEvent.assignedTo);

      const response = await fetch('/api/portal/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-event',
          ...newEvent,
          assignedToName: driver?.name || 'Unassigned',
          assignedByName: 'Portal User',
          createdBy: 'portal'
        })
      });

      if (response.ok) {
        setShowCreateModal(false);
        setNewEvent({
          eventType: 'delivery',
          jobName: '',
          jobAddress: '',
          city: '',
          state: 'AL',
          zip: '',
          scheduledDate: selectedDate,
          scheduledTime: '09:00',
          estimatedDuration: 30,
          assignedTo: '',
          customerName: '',
          customerPhone: '',
          projectManager: '',
          priority: 'normal',
          notes: ''
        });
        loadData();
      }
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Failed to create event');
    }
  };

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];

    // Add padding days from previous month
    const startPadding = firstDay.getDay();
    for (let i = startPadding - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push(d);
    }

    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    // Add padding days for next month
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  };

  const formatDateKey = (date: Date) => {
    return date.toISOString().slice(0, 10);
  };

  if (isLoading && viewMode === 'calendar') {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto text-brand-green" size={48} />
          <p className="text-neutral-400 mt-4">Loading schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900">
      {/* Header */}
      <div className="bg-neutral-800 border-b border-neutral-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal" className="text-neutral-400 hover:text-white">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Schedule & Routes</h1>
              <p className="text-sm text-neutral-400">Deliveries, Pickups & Route Planning</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-brand-green text-black font-medium rounded-lg hover:bg-lime-400 flex items-center gap-2"
            >
              <Plus size={18} />
              New Event
            </button>
            <button
              onClick={loadData}
              className="p-2 bg-neutral-700 rounded-lg hover:bg-neutral-600"
            >
              <RefreshCw size={20} className="text-neutral-400" />
            </button>
          </div>
        </div>
      </div>

      {/* View Toggle & Filters */}
      <div className="bg-neutral-800 border-b border-neutral-700">
        <div className="max-w-7xl mx-auto p-4 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-2">
            {[
              { id: 'calendar', label: 'Calendar', icon: Calendar },
              { id: 'day', label: 'Day View', icon: Clock },
              { id: 'route', label: 'Route', icon: Route },
            ].map(view => (
              <button
                key={view.id}
                onClick={() => setViewMode(view.id as ViewMode)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                  viewMode === view.id
                    ? 'bg-brand-green text-black font-medium'
                    : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                }`}
              >
                <view.icon size={18} />
                {view.label}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              className="bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
            >
              <option value="">All Drivers</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            {viewMode !== 'calendar' && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
              />
            )}

            {viewMode === 'route' && selectedDriver && (
              <button
                onClick={handleOptimizeRoute}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
              >
                <Navigation size={18} />
                Optimize Route
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        {/* Calendar View */}
        {viewMode === 'calendar' && (
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden">
            {/* Month Navigation */}
            <div className="p-4 border-b border-neutral-700 flex items-center justify-between">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-2 hover:bg-neutral-700 rounded-lg"
              >
                <ChevronLeft className="text-neutral-400" size={20} />
              </button>
              <h2 className="text-xl font-bold text-white">
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={() => navigateMonth(1)}
                className="p-2 hover:bg-neutral-700 rounded-lg"
              >
                <ChevronRight className="text-neutral-400" size={20} />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-neutral-500 border-b border-neutral-700">
                  {day}
                </div>
              ))}

              {getDaysInMonth(currentDate).map((day, i) => {
                const dateKey = formatDateKey(day);
                const events = calendarEvents[dateKey] || [];
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const isToday = dateKey === new Date().toISOString().slice(0, 10);

                return (
                  <div
                    key={i}
                    onClick={() => {
                      setSelectedDate(dateKey);
                      setViewMode('day');
                    }}
                    className={`min-h-[100px] p-2 border-b border-r border-neutral-700 cursor-pointer hover:bg-neutral-700/50 ${
                      !isCurrentMonth ? 'bg-neutral-900/50' : ''
                    } ${isToday ? 'bg-brand-green/10' : ''}`}
                  >
                    <div className={`text-sm mb-1 ${
                      isToday ? 'text-brand-green font-bold' :
                      isCurrentMonth ? 'text-white' : 'text-neutral-600'
                    }`}>
                      {day.getDate()}
                    </div>
                    <div className="space-y-1">
                      {events.slice(0, 3).map((event, j) => (
                        <div
                          key={j}
                          className={`text-xs p-1 rounded truncate text-white ${eventTypeColors[event.eventType]}`}
                        >
                          {event.scheduledTime} {event.jobName}
                        </div>
                      ))}
                      {events.length > 3 && (
                        <div className="text-xs text-neutral-400">
                          +{events.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Day View */}
        {viewMode === 'day' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">
              {new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
              })}
            </h2>

            {dayEvents.length === 0 ? (
              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-8 text-center">
                <Calendar className="mx-auto text-neutral-500 mb-4" size={48} />
                <p className="text-neutral-400">No events scheduled for this day</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dayEvents.map(event => (
                  <div
                    key={event.eventId}
                    className={`bg-neutral-800 border border-neutral-700 rounded-xl p-4 border-l-4 ${priorityColors[event.priority]}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${eventTypeColors[event.eventType]}`}>
                          {event.eventType === 'delivery' ? <Truck className="text-white" size={24} /> :
                           event.eventType === 'pickup' ? <Package className="text-white" size={24} /> :
                           <MapPin className="text-white" size={24} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold text-white">{event.scheduledTime}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${eventTypeColors[event.eventType]}`}>
                              {event.eventType}
                            </span>
                            {event.priority !== 'normal' && (
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                event.priority === 'urgent' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {event.priority}
                              </span>
                            )}
                          </div>
                          <h3 className="text-white font-medium mt-1">{event.jobName}</h3>
                          <div className="flex items-center gap-4 mt-2 text-sm text-neutral-400">
                            <span className="flex items-center gap-1">
                              <MapPin size={14} />
                              {event.jobAddress}, {event.city}
                            </span>
                            <span className="flex items-center gap-1">
                              <User size={14} />
                              {event.customerName}
                            </span>
                            {event.customerPhone && (
                              <span className="flex items-center gap-1">
                                <Phone size={14} />
                                {event.customerPhone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          event.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          event.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-neutral-700 text-neutral-300'
                        }`}>
                          {event.status}
                        </span>
                        <div className="mt-2 text-sm text-neutral-500">
                          Assigned: {event.assignedToName}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Route View */}
        {viewMode === 'route' && (
          <div className="space-y-4">
            {!selectedDriver ? (
              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-8 text-center">
                <Truck className="mx-auto text-neutral-500 mb-4" size={48} />
                <p className="text-neutral-400">Select a driver to view their route</p>
              </div>
            ) : dailyRoute ? (
              <>
                {/* Route Summary */}
                <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-white">
                      {dailyRoute.driverName}'s Route - {new Date(dailyRoute.date).toLocaleDateString()}
                    </h2>
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        dailyRoute.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        dailyRoute.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-neutral-700 text-neutral-300'
                      }`}>
                        {dailyRoute.status}
                      </span>
                      {dailyRoute.isOptimized && (
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-brand-green/20 text-brand-green">
                          Optimized
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-neutral-700/50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-white">{dailyRoute.totalStops}</p>
                      <p className="text-sm text-neutral-400">Total Stops</p>
                    </div>
                    <div className="bg-neutral-700/50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-white">{dailyRoute.totalDistance}</p>
                      <p className="text-sm text-neutral-400">Miles</p>
                    </div>
                    <div className="bg-neutral-700/50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-white">{Math.round(dailyRoute.estimatedTotalTime / 60)}h {dailyRoute.estimatedTotalTime % 60}m</p>
                      <p className="text-sm text-neutral-400">Est. Time</p>
                    </div>
                    <div className="bg-neutral-700/50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-brand-green">
                        {dailyRoute.events.filter(e => e.status === 'completed').length}/{dailyRoute.totalStops}
                      </p>
                      <p className="text-sm text-neutral-400">Completed</p>
                    </div>
                  </div>
                </div>

                {/* Route Stops */}
                <div className="space-y-2">
                  {/* Start Point */}
                  <div className="flex items-center gap-4 p-4 bg-neutral-800 border border-neutral-700 rounded-xl">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                      S
                    </div>
                    <div>
                      <p className="text-white font-medium">Start: Warehouse</p>
                      <p className="text-sm text-neutral-400">{dailyRoute.startLocation}</p>
                    </div>
                  </div>

                  {/* Stops */}
                  {dailyRoute.events.map((event, i) => (
                    <div key={event.eventId} className="flex gap-4">
                      {/* Connector Line */}
                      <div className="w-10 flex justify-center">
                        <div className="w-0.5 h-full bg-neutral-600" />
                      </div>

                      <div className={`flex-1 p-4 bg-neutral-800 border border-neutral-700 rounded-xl border-l-4 ${
                        event.status === 'completed' ? 'border-l-green-500' :
                        event.status === 'in_progress' ? 'border-l-blue-500' :
                        'border-l-neutral-500'
                      }`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                              event.status === 'completed' ? 'bg-green-500 text-white' :
                              event.status === 'in_progress' ? 'bg-blue-500 text-white' :
                              'bg-neutral-700 text-neutral-300'
                            }`}>
                              {event.routeOrder || i + 1}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${eventTypeColors[event.eventType]}`}>
                                  {event.eventType}
                                </span>
                                <span className="text-sm text-neutral-400">
                                  ETA: {event.estimatedArrival || event.scheduledTime}
                                </span>
                              </div>
                              <h3 className="text-white font-medium mt-1">{event.jobName}</h3>
                              <p className="text-sm text-neutral-400">{event.jobAddress}, {event.city}</p>
                              <p className="text-sm text-neutral-500 mt-1">
                                {event.customerName} • {event.customerPhone}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {event.distanceFromPrevious && (
                              <p className="text-sm text-neutral-400">
                                {event.distanceFromPrevious} mi from prev
                              </p>
                            )}
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              event.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                              event.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-neutral-700 text-neutral-300'
                            }`}>
                              {event.status === 'completed' ? <CheckCircle2 className="inline mr-1" size={12} /> : null}
                              {event.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* End Point */}
                  <div className="flex items-center gap-4 p-4 bg-neutral-800 border border-neutral-700 rounded-xl">
                    <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white font-bold">
                      E
                    </div>
                    <div>
                      <p className="text-white font-medium">End: Warehouse</p>
                      <p className="text-sm text-neutral-400">{dailyRoute.endLocation}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-8 text-center">
                <Route className="mx-auto text-neutral-500 mb-4" size={48} />
                <p className="text-neutral-400 mb-4">No route planned for this day</p>
                <button
                  onClick={handleOptimizeRoute}
                  className="px-4 py-2 bg-brand-green text-black rounded-lg hover:bg-lime-400"
                >
                  Create & Optimize Route
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-neutral-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Schedule New Event</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Event Type</label>
                  <select
                    value={newEvent.eventType}
                    onChange={(e) => setNewEvent({ ...newEvent, eventType: e.target.value as any })}
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="delivery">Delivery</option>
                    <option value="pickup">Pickup</option>
                    <option value="return">Return</option>
                    <option value="inspection">Inspection</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Priority</label>
                  <select
                    value={newEvent.priority}
                    onChange={(e) => setNewEvent({ ...newEvent, priority: e.target.value as any })}
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="normal">Normal</option>
                    <option value="rush">Rush</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-1">Job Name</label>
                <input
                  type="text"
                  value={newEvent.jobName}
                  onChange={(e) => setNewEvent({ ...newEvent, jobName: e.target.value })}
                  className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Smith Residence"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-1">Address</label>
                <input
                  type="text"
                  value={newEvent.jobAddress}
                  onChange={(e) => setNewEvent({ ...newEvent, jobAddress: e.target.value })}
                  className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  placeholder="123 Main St"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">City</label>
                  <input
                    type="text"
                    value={newEvent.city}
                    onChange={(e) => setNewEvent({ ...newEvent, city: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">State</label>
                  <input
                    type="text"
                    value={newEvent.state}
                    onChange={(e) => setNewEvent({ ...newEvent, state: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">ZIP</label>
                  <input
                    type="text"
                    value={newEvent.zip}
                    onChange={(e) => setNewEvent({ ...newEvent, zip: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={newEvent.scheduledDate}
                    onChange={(e) => setNewEvent({ ...newEvent, scheduledDate: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Time</label>
                  <input
                    type="time"
                    value={newEvent.scheduledTime}
                    onChange={(e) => setNewEvent({ ...newEvent, scheduledTime: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-1">Assign Driver</label>
                <select
                  value={newEvent.assignedTo}
                  onChange={(e) => setNewEvent({ ...newEvent, assignedTo: e.target.value })}
                  className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">Select Driver</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={newEvent.customerName}
                    onChange={(e) => setNewEvent({ ...newEvent, customerName: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Customer Phone</label>
                  <input
                    type="tel"
                    value={newEvent.customerPhone}
                    onChange={(e) => setNewEvent({ ...newEvent, customerPhone: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-1">Notes</label>
                <textarea
                  value={newEvent.notes}
                  onChange={(e) => setNewEvent({ ...newEvent, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-neutral-700 flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 bg-neutral-700 text-white rounded-lg hover:bg-neutral-600"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEvent}
                disabled={!newEvent.jobName || !newEvent.jobAddress || !newEvent.assignedTo}
                className="flex-1 px-4 py-2 bg-brand-green text-black font-medium rounded-lg hover:bg-lime-400 disabled:opacity-50"
              >
                Create Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
