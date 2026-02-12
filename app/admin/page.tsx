/**
 * Admin Dashboard
 * Overview and quick actions for admin panel
 * Includes upcoming appointments from TeamUp calendar
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Upload,
  FileText,
  Users,
  Image,
  TrendingUp,
  Package,
  Calendar,
  Clock,
  MapPin,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { blogPosts } from '@/lib/blogData';
import { teamMembers } from '@/lib/teamData';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  eventType: string;
  status: string;
  assignedToName?: string;
  customer?: {
    name: string;
    phone?: string;
  };
}

export default function AdminDashboard() {
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  useEffect(() => {
    fetchUpcomingEvents();
  }, []);

  const fetchUpcomingEvents = async () => {
    setIsLoadingEvents(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const response = await fetch(`/api/calendar/events?startDate=${today}&endDate=${nextWeek}`);
      const data = await response.json();

      if (data.success) {
        // Get only upcoming 5 events
        setUpcomingEvents(data.events.slice(0, 5));
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const formatEventTime = (event: CalendarEvent) => {
    const start = new Date(event.start);
    return start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatEventDate = (event: CalendarEvent) => {
    const start = new Date(event.start);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (start.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (start.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  const getEventTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      inspection: 'bg-brand-green',
      installation: 'bg-lime-500',
      delivery: 'bg-purple-500',
      meeting: 'bg-brand-green',
      repair: 'bg-amber-500',
      estimate: 'bg-orange-500',
    };
    return colors[type] || 'bg-white/50';
  };

  // Quick stats - use actual data counts
  const stats = [
    {
      label: 'Blog Posts',
      value: blogPosts.length.toString(),
      icon: FileText,
      color: 'bg-brand-green',
    },
    {
      label: 'Team Members',
      value: teamMembers.length.toString(),
      icon: Users,
      color: 'bg-purple-500',
    },
    {
      label: 'Upcoming Events',
      value: isLoadingEvents ? '-' : upcomingEvents.length.toString(),
      icon: Calendar,
      color: 'bg-orange-500',
    },
  ];

  // Quick actions
  const quickActions = [
    {
      title: 'View Schedule',
      description: 'View and manage team schedule and appointments',
      href: '/command-center/schedule',
      icon: Calendar,
      color: 'bg-brand-green',
    },
    {
      title: 'Manage Inventory',
      description: 'View stock levels, low stock alerts, and manage items',
      href: '/admin/inventory',
      icon: Package,
      color: 'bg-brand-green',
    },
    {
      title: 'Upload Image',
      description: 'Upload photos for blog posts, projects, or team members',
      href: '/admin/upload',
      icon: Upload,
      color: 'bg-purple-600',
    },
    {
      title: 'Add Team Member',
      description: 'Add a new team member profile',
      href: '/admin/team',
      icon: Users,
      color: 'bg-brand-green',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-neutral-400 mt-2">
          Welcome to River City Roofing Solutions admin panel
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-neutral-900 rounded-lg border border-white/10 p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-400">{stat.label}</p>
                  <p className="text-3xl font-bold text-white mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upcoming Events Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Upcoming Appointments</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchUpcomingEvents}
              className="p-2 text-neutral-500 hover:text-neutral-400 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingEvents ? 'animate-spin' : ''}`} />
            </button>
            <Link
              href="/command-center/schedule"
              className="text-sm text-brand-green hover:underline flex items-center gap-1"
            >
              View All
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="bg-neutral-900 rounded-lg border border-white/10 overflow-hidden">
          {isLoadingEvents ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-neutral-500 mx-auto mb-2" />
              <p className="text-neutral-500 text-sm">Loading appointments...</p>
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
              <p className="text-neutral-500">No upcoming appointments</p>
              <Link
                href="/command-center/schedule"
                className="mt-3 inline-flex items-center gap-2 text-sm text-brand-green hover:underline"
              >
                Schedule an appointment
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="p-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-2 h-2 rounded-full mt-2 ${getEventTypeColor(event.eventType)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-white">{event.title}</h3>
                          {event.customer && (
                            <p className="text-sm text-neutral-400">{event.customer.name}</p>
                          )}
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${
                          event.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                          event.status === 'completed' ? 'bg-white/10 text-neutral-400' :
                          'bg-brand-green/20 text-blue-400'
                        }`}>
                          {event.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-neutral-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatEventDate(event)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatEventTime(event)}
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span className="truncate max-w-[200px]">{event.location}</span>
                          </div>
                        )}
                      </div>

                      {event.assignedToName && (
                        <p className="text-xs text-neutral-500 mt-1">
                          Assigned to: {event.assignedToName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={index}
                href={action.href}
                className="bg-neutral-900 rounded-lg border border-white/10 p-6 hover:border-white/20 transition-shadow"
              >
                <div className="flex items-start space-x-4">
                  <div className={`${action.color} p-3 rounded-lg flex-shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{action.title}</h3>
                    <p className="text-sm text-neutral-400 mt-1">{action.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* System Info */}
      <div className="bg-brand-green/10 border border-blue-500/20 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-2 h-2 bg-brand-green rounded-full"></div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-brand-green">Admin Panel</h3>
            <p className="text-sm text-blue-400 mt-1">
              Manage site content, team members, and integrations. Check the{' '}
              <Link href="/admin/settings" className="underline font-medium">settings page</Link>{' '}
              for configuration options.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
