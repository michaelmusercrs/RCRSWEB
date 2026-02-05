'use client';

/**
 * RCRS Command Center - Schedule Management
 *
 * Displays job schedule, upcoming appointments, and crew assignments.
 * Used by all staff to view schedules, with edit access for managers.
 *
 * Role-based: Requires schedule.view permission
 */

import * as React from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Truck,
  CheckCircle2,
  AlertCircle,
  Plus,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';

// Demo schedule data
const SCHEDULE_STATS = {
  todayJobs: 5,
  thisWeek: 18,
  unassigned: 2,
  completedToday: 3,
};

const TODAY_SCHEDULE = [
  {
    id: 'SCH-001',
    time: '8:00 AM',
    customer: 'John Smith',
    address: '123 Main St, Hartselle, AL',
    type: 'Roof Replacement',
    crew: 'Team Alpha',
    crewLead: 'Hunter Rivers',
    status: 'completed',
    duration: '6 hours',
  },
  {
    id: 'SCH-002',
    time: '8:30 AM',
    customer: 'Sarah Johnson',
    address: '456 Oak Ave, Decatur, AL',
    type: 'Storm Damage Inspection',
    crew: 'Team Beta',
    crewLead: 'Aaron Lussi',
    status: 'in-progress',
    duration: '2 hours',
  },
  {
    id: 'SCH-003',
    time: '10:00 AM',
    customer: 'Mike Williams',
    address: '789 Pine St, Huntsville, AL',
    type: 'Gutter Installation',
    crew: 'Team Gamma',
    crewLead: 'Greg Muse',
    status: 'in-progress',
    duration: '4 hours',
  },
  {
    id: 'SCH-004',
    time: '1:00 PM',
    customer: 'Jennifer Davis',
    address: '321 Elm Rd, Athens, AL',
    type: 'Shingle Repair',
    crew: 'Team Alpha',
    crewLead: 'Hunter Rivers',
    status: 'scheduled',
    duration: '3 hours',
  },
  {
    id: 'SCH-005',
    time: '2:30 PM',
    customer: 'Robert Brown',
    address: '654 Maple Dr, Madison, AL',
    type: 'Free Inspection',
    crew: null,
    crewLead: null,
    status: 'unassigned',
    duration: '1 hour',
  },
];

const UPCOMING_WEEK = [
  { date: 'Wed, Feb 5', jobs: 4 },
  { date: 'Thu, Feb 6', jobs: 5 },
  { date: 'Fri, Feb 7', jobs: 3 },
  { date: 'Sat, Feb 8', jobs: 2 },
  { date: 'Mon, Feb 10', jobs: 6 },
];

// Stat card component
interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: 'lime' | 'blue' | 'orange' | 'purple';
}

function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  const colorClasses = {
    lime: 'bg-lime-500/10 text-lime-400',
    blue: 'bg-blue-500/10 text-blue-400',
    orange: 'bg-orange-500/10 text-orange-400',
    purple: 'bg-purple-500/10 text-purple-400',
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
        </div>
        <div className={cn('rounded-lg p-3', colorClasses[color])}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const statusStyles: Record<string, string> = {
    completed: 'bg-lime-500/20 text-lime-400',
    'in-progress': 'bg-blue-500/20 text-blue-400',
    scheduled: 'bg-purple-500/20 text-purple-400',
    unassigned: 'bg-orange-500/20 text-orange-400',
  };

  const statusLabels: Record<string, string> = {
    completed: 'Completed',
    'in-progress': 'In Progress',
    scheduled: 'Scheduled',
    unassigned: 'Unassigned',
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
      statusStyles[status] || 'bg-zinc-500/20 text-zinc-400'
    )}>
      {status === 'completed' && <CheckCircle2 size={12} />}
      {status === 'unassigned' && <AlertCircle size={12} />}
      {statusLabels[status] || status}
    </span>
  );
}

export default function SchedulePage() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = React.useState(new Date());

  // Check permission
  const userRole = (user?.role === 'owner' || user?.role === 'admin') ? 'Owner' :
                   user?.role === 'office' ? 'Office' :
                   user?.role === 'project_manager' ? 'Manager' :
                   user?.role === 'driver' ? 'Driver' : 'Sales';
  const canView = hasPermission(userRole as 'Owner' | 'Admin' | 'Manager' | 'Sales' | 'Driver' | 'Office', 'schedule.view');
  const canEdit = hasPermission(userRole as 'Owner' | 'Admin' | 'Manager' | 'Sales' | 'Driver' | 'Office', 'schedule.edit');

  if (!canView) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Calendar className="mx-auto h-12 w-12 text-zinc-600" />
          <h2 className="mt-4 text-xl font-semibold text-white">Access Restricted</h2>
          <p className="mt-2 text-zinc-400">
            You do not have permission to view the Schedule.
          </p>
        </div>
      </div>
    );
  }

  const formattedDate = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Job Schedule</h1>
          <p className="mt-1 text-zinc-400">
            View and manage crew assignments and job appointments
          </p>
        </div>
        {canEdit && (
          <button className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 font-medium text-zinc-900 transition-colors hover:bg-lime-400">
            <Plus size={18} />
            Schedule Job
          </button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Jobs"
          value={SCHEDULE_STATS.todayJobs}
          icon={Calendar}
          color="lime"
        />
        <StatCard
          title="This Week"
          value={SCHEDULE_STATS.thisWeek}
          icon={Clock}
          color="blue"
        />
        <StatCard
          title="Unassigned"
          value={SCHEDULE_STATS.unassigned}
          icon={AlertCircle}
          color="orange"
        />
        <StatCard
          title="Completed Today"
          value={SCHEDULE_STATS.completedToday}
          icon={CheckCircle2}
          color="purple"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's Schedule */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900">
            {/* Date Navigation */}
            <div className="flex items-center justify-between border-b border-zinc-800 p-4">
              <button
                onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() - 1)))}
                className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="text-center">
                <h2 className="text-lg font-semibold text-white">{formattedDate}</h2>
                <p className="text-sm text-zinc-500">{SCHEDULE_STATS.todayJobs} jobs scheduled</p>
              </div>
              <button
                onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() + 1)))}
                className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Schedule List */}
            <div className="divide-y divide-zinc-800">
              {TODAY_SCHEDULE.map((job) => (
                <div
                  key={job.id}
                  className={cn(
                    'p-4 transition-colors hover:bg-zinc-800/50',
                    job.status === 'unassigned' && 'bg-orange-500/5'
                  )}
                >
                  <div className="flex items-start gap-4">
                    {/* Time */}
                    <div className="w-20 shrink-0 text-center">
                      <p className="text-lg font-bold text-white">{job.time.split(' ')[0]}</p>
                      <p className="text-xs text-zinc-500">{job.time.split(' ')[1]}</p>
                    </div>

                    {/* Job Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-white">{job.type}</h3>
                          <p className="text-sm text-zinc-400">{job.customer}</p>
                        </div>
                        <StatusBadge status={job.status} />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-1.5 text-zinc-400">
                          <MapPin size={14} />
                          <span>{job.address}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-zinc-400">
                          <Clock size={14} />
                          <span>{job.duration}</span>
                        </div>
                      </div>

                      {job.crew ? (
                        <div className="mt-3 flex items-center gap-4">
                          <div className="flex items-center gap-1.5 text-sm">
                            <Truck size={14} className="text-lime-400" />
                            <span className="text-zinc-300">{job.crew}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm">
                            <User size={14} className="text-lime-400" />
                            <span className="text-zinc-300">{job.crewLead}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3">
                          {canEdit && (
                            <button className="rounded-lg bg-orange-500/10 px-3 py-1.5 text-sm font-medium text-orange-400 transition-colors hover:bg-orange-500/20">
                              Assign Crew
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Week */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-4 font-semibold text-white">Upcoming Week</h3>
            <div className="space-y-2">
              {UPCOMING_WEEK.map((day) => (
                <div
                  key={day.date}
                  className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-2"
                >
                  <span className="text-sm text-zinc-300">{day.date}</span>
                  <span className="rounded-full bg-lime-500/20 px-2 py-0.5 text-xs font-medium text-lime-400">
                    {day.jobs} jobs
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-4 font-semibold text-white">Quick Actions</h3>
            <div className="space-y-2">
              <button className="flex w-full items-center gap-3 rounded-lg bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white">
                <Calendar size={18} className="text-lime-400" />
                View Full Calendar
              </button>
              <button className="flex w-full items-center gap-3 rounded-lg bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white">
                <Truck size={18} className="text-blue-400" />
                Crew Availability
              </button>
              <button className="flex w-full items-center gap-3 rounded-lg bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white">
                <MapPin size={18} className="text-purple-400" />
                Route Optimization
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-3 font-semibold text-white">Status Legend</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-lime-500" />
                <span className="text-sm text-zinc-400">Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span className="text-sm text-zinc-400">In Progress</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
                <span className="text-sm text-zinc-400">Scheduled</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                <span className="text-sm text-zinc-400">Unassigned</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
