/**
 * Admin Dashboard Home
 * Overview and quick actions for admin panel
 * Fetches real data from APIs
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Upload,
  FileText,
  Users,
  TrendingUp,
  Package,
  Calendar,
  Clock,
  MapPin,
  ChevronRight,
  RefreshCw,
  DollarSign,
  Briefcase,
  AlertTriangle,
  CheckCircle,
  Activity,
} from 'lucide-react';

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

interface DashboardStats {
  blogPosts: number;
  teamMembers: number;
  upcomingEvents: number;
  totalCommissions: string;
  activeJobs: number;
  lowStockItems: number;
  pendingApprovals: number;
}

export default function AdminDashboard() {
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    blogPosts: 0,
    teamMembers: 0,
    upcomingEvents: 0,
    totalCommissions: '$0',
    activeJobs: 0,
    lowStockItems: 0,
    pendingApprovals: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    fetchUpcomingEvents();
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      // Fetch all stats in parallel
      const [teamRes, salesRes, inventoryRes, approvalsRes, blogRes] = await Promise.allSettled([
        fetch('/api/admin/team-members'),
        fetch('/api/command-center/sales?period=all'),
        fetch('/api/portal/inventory'),
        fetch('/api/profile/pending?history=false'),
        fetch('/api/cms/blog'),
      ]);

      const newStats: Partial<DashboardStats> = {};

      if (teamRes.status === 'fulfilled' && teamRes.value.ok) {
        const data = await teamRes.value.json();
        newStats.teamMembers = data.members?.length || 0;
      }

      if (salesRes.status === 'fulfilled' && salesRes.value.ok) {
        const data = await salesRes.value.json();
        if (data.success && data.data?.summary) {
          newStats.totalCommissions = new Intl.NumberFormat('en-US', {
            style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0,
          }).format(data.data.summary.totalCommissions);
        }
      }

      if (inventoryRes.status === 'fulfilled' && inventoryRes.value.ok) {
        const items = await inventoryRes.value.json();
        if (Array.isArray(items)) {
          newStats.lowStockItems = items.filter((i: any) => i.currentQty <= i.minQty && i.currentQty > 0).length;
        }
      }

      if (approvalsRes.status === 'fulfilled' && approvalsRes.value.ok) {
        const data = await approvalsRes.value.json();
        newStats.pendingApprovals = data.edits?.filter((e: any) => e.status === 'pending').length || 0;
      }

      if (blogRes.status === 'fulfilled' && blogRes.value.ok) {
        const data = await blogRes.value.json();
        newStats.blogPosts = Array.isArray(data) ? data.length : 0;
      }

      setStats(prev => ({ ...prev, ...newStats }));
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const fetchUpcomingEvents = async () => {
    setIsLoadingEvents(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const response = await fetch(`/api/calendar/events?startDate=${today}&endDate=${nextWeek}`);
      const data = await response.json();
      if (data.success) {
        setUpcomingEvents(data.events.slice(0, 5));
        setStats(prev => ({ ...prev, upcomingEvents: data.events.length }));
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
    if (start.toDateString() === today.toDateString()) return 'Today';
    if (start.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getEventTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      inspection: 'bg-[#39FF14]',
      installation: 'bg-lime-500',
      delivery: 'bg-purple-500',
      meeting: 'bg-blue-500',
      repair: 'bg-amber-500',
      estimate: 'bg-orange-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  const statCards = [
    { label: 'Team Members', value: stats.teamMembers.toString(), icon: Users, color: 'bg-blue-500/20', iconColor: 'text-blue-400' },
    { label: 'Blog Posts', value: stats.blogPosts.toString(), icon: FileText, color: 'bg-purple-500/20', iconColor: 'text-purple-400' },
    { label: 'Upcoming Events', value: isLoadingEvents ? '-' : stats.upcomingEvents.toString(), icon: Calendar, color: 'bg-orange-500/20', iconColor: 'text-orange-400' },
    { label: 'Total Commissions', value: stats.totalCommissions, icon: DollarSign, color: 'bg-[#39FF14]/20', iconColor: 'text-[#39FF14]' },
  ];

  const alertCards = [
    ...(stats.lowStockItems > 0 ? [{
      label: `${stats.lowStockItems} Low Stock Items`,
      href: '/admin/inventory',
      icon: AlertTriangle,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
    }] : []),
    ...(stats.pendingApprovals > 0 ? [{
      label: `${stats.pendingApprovals} Pending Approvals`,
      href: '/admin/approvals',
      icon: Clock,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10 border-yellow-500/20',
    }] : []),
  ];

  const quickActions = [
    { title: 'View Schedule', description: 'Team schedule & appointments', href: '/command-center/schedule', icon: Calendar, color: 'bg-[#39FF14]/20' },
    { title: 'Manage Inventory', description: 'Stock levels & low stock alerts', href: '/admin/inventory', icon: Package, color: 'bg-blue-500/20' },
    { title: 'Upload Image', description: 'Photos for blog, projects, team', href: '/admin/upload', icon: Upload, color: 'bg-purple-500/20' },
    { title: 'Add Team Member', description: 'Add a new team profile', href: '/admin/team', icon: Users, color: 'bg-orange-500/20' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-neutral-400 mt-2">Welcome to River City Roofing Solutions admin panel</p>
        </div>
        <button
          onClick={() => { fetchStats(); fetchUpcomingEvents(); }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-neutral-300 rounded-lg transition-colors text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isLoadingStats ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Alert Banners */}
      {alertCards.length > 0 && (
        <div className="space-y-3">
          {alertCards.map((alert, i) => {
            const Icon = alert.icon;
            return (
              <Link key={i} href={alert.href} className={`flex items-center gap-3 p-4 rounded-xl border ${alert.bg} hover:opacity-80 transition-opacity`}>
                <Icon className={`w-5 h-5 ${alert.color}`} />
                <span className={`font-medium ${alert.color}`}>{alert.label}</span>
                <ChevronRight className={`w-4 h-4 ml-auto ${alert.color}`} />
              </Link>
            );
          })}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-gray-900 rounded-xl border border-gray-700/50 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-400">{stat.label}</p>
                  <p className="text-3xl font-bold text-white mt-2">
                    {isLoadingStats ? <span className="text-neutral-600">—</span> : stat.value}
                  </p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className={`w-6 h-6 ${stat.iconColor}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upcoming Events */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Upcoming Appointments</h2>
          <Link href="/command-center/schedule" className="text-sm text-[#39FF14] hover:underline flex items-center gap-1">
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-700/50 overflow-hidden">
          {isLoadingEvents ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-neutral-500 mx-auto mb-2" />
              <p className="text-neutral-500 text-sm">Loading appointments...</p>
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
              <p className="text-neutral-500">No upcoming appointments</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="p-4 hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={`w-2 h-2 rounded-full mt-2 ${getEventTypeColor(event.eventType)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-white">{event.title}</h3>
                          {event.customer && <p className="text-sm text-neutral-400">{event.customer.name}</p>}
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${
                          event.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                          event.status === 'completed' ? 'bg-gray-700 text-neutral-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {event.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-neutral-500">
                        <div className="flex items-center gap-1"><Calendar className="w-4 h-4" />{formatEventDate(event)}</div>
                        <div className="flex items-center gap-1"><Clock className="w-4 h-4" />{formatEventTime(event)}</div>
                        {event.location && (
                          <div className="flex items-center gap-1"><MapPin className="w-4 h-4" /><span className="truncate max-w-[200px]">{event.location}</span></div>
                        )}
                      </div>
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
              <Link key={index} href={action.href} className="bg-gray-900 rounded-xl border border-gray-700/50 p-6 hover:border-[#39FF14]/30 transition-colors group">
                <div className="flex items-start space-x-4">
                  <div className={`${action.color} p-3 rounded-lg flex-shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white group-hover:text-[#39FF14] transition-colors">{action.title}</h3>
                    <p className="text-sm text-neutral-400 mt-1">{action.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
