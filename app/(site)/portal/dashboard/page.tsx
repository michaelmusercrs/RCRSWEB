'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Truck, Package, DollarSign, Calendar, BarChart3, Users,
  Loader2, Clock, AlertCircle, CheckCircle, MapPin, Bell,
  TrendingUp, Box, ClipboardList, Eye, Sparkles,
  BookOpen, Image as ImageIcon, Phone, Command, Edit3,
  Target, Megaphone, Plus, MessageSquare, Zap, Sliders,
  Settings, ChevronRight, UserCircle, Shield
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { TeamRole } from '@/lib/team-roles';
import WeeklyNumbersWidget from '@/components/portal/WeeklyNumbersWidget';
import MondayAnnouncementWidget from '@/components/portal/MondayAnnouncementWidget';

interface RecentActivity {
  action: string;
  detail: string;
  time: string;
  color: string;
}

interface DashboardStats {
  activeDeliveries: number;
  completedToday: number;
  pendingOrders: number;
  totalRevenue: number;
  lowStockItems: number;
  upcomingSchedule: number;
  recentActivity?: RecentActivity[];
}

// Role-specific quick-access links (subset - full nav is in the sidebar)
const getRoleQuickLinks = (role: TeamRole) => {
  switch (role) {
    case 'owner':
    case 'admin':
      return [
        { label: 'RoofStack HQ', href: '/command-center', icon: Command, color: 'bg-gradient-to-r from-lime-500/30 to-emerald-500/30 text-lime-400' },
        { label: 'New Lead Wizard', href: '/portal/office/new-lead', icon: Zap, color: 'bg-brand-green/20 text-brand-green' },
        { label: 'Operations', href: '/portal/office', icon: ClipboardList, color: 'bg-emerald-500/20 text-emerald-400' },
        { label: 'Finance', href: '/portal/billing', icon: DollarSign, color: 'bg-green-500/20 text-green-400' },
        { label: 'Materials', href: '/portal/inventory', icon: Box, color: 'bg-orange-500/20 text-orange-400' },
        { label: 'Schedule', href: '/portal/schedule', icon: Calendar, color: 'bg-purple-500/20 text-purple-400' },
      ];
    case 'manager':
      return [
        { label: 'RoofStack HQ', href: '/command-center', icon: Command, color: 'bg-gradient-to-r from-lime-500/30 to-emerald-500/30 text-lime-400' },
        { label: 'Rep Lead Controls', href: '/portal/manager/lead-controls', icon: Users, color: 'bg-orange-500/20 text-orange-400' },
        { label: 'Operations', href: '/portal/office', icon: ClipboardList, color: 'bg-emerald-500/20 text-emerald-400' },
        { label: 'Materials', href: '/portal/inventory', icon: Box, color: 'bg-orange-500/20 text-orange-400' },
      ];
    case 'sales':
      return [
        { label: 'Sales Dashboard', href: '/portal/sales', icon: Target, color: 'bg-green-500/20 text-green-400' },
        { label: 'My Leads', href: '/portal/sales/leads', icon: Users, color: 'bg-blue-500/20 text-blue-400' },
        { label: 'Performance', href: '/portal/sales/performance', icon: TrendingUp, color: 'bg-purple-500/20 text-purple-400' },
        { label: 'New Lead', href: '/portal/leads/new', icon: Plus, color: 'bg-brand-green/20 text-brand-green' },
      ];
    case 'office':
      return [
        { label: 'New Lead Wizard', href: '/portal/office/new-lead', icon: Zap, color: 'bg-brand-green/20 text-brand-green' },
        { label: 'Operations', href: '/portal/office', icon: ClipboardList, color: 'bg-emerald-500/20 text-emerald-400' },
        { label: 'Finance', href: '/portal/billing', icon: DollarSign, color: 'bg-green-500/20 text-green-400' },
        { label: 'Schedule', href: '/portal/schedule', icon: Calendar, color: 'bg-purple-500/20 text-purple-400' },
      ];
    case 'project_manager':
      return [
        { label: 'Create Orders', href: '/portal/pm', icon: Package, color: 'bg-cyan-500/20 text-cyan-400' },
        { label: 'Schedule', href: '/portal/schedule', icon: Calendar, color: 'bg-purple-500/20 text-purple-400' },
      ];
    case 'driver':
      return [
        { label: 'My Deliveries', href: '/portal/driver', icon: Truck, color: 'bg-blue-500/20 text-blue-400' },
      ];
    default:
      return [
        { label: 'View Orders', href: '/portal/office', icon: Eye, color: 'bg-emerald-500/20 text-emerald-400' },
        { label: 'Reports', href: '/portal/reports', icon: BarChart3, color: 'bg-blue-500/20 text-blue-400' },
      ];
  }
};

export default function Dashboard() {
  const router = useRouter();
  const { user, isLoading, hasPermission } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/portal');
    }
  }, [user, isLoading, router]);

  // Load dashboard stats
  useEffect(() => {
    const loadStats = async () => {
      if (!user) return;
      try {
        const response = await fetch('/api/portal/dashboard');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };
    if (user) loadStats();
  }, [user]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-brand-green" size={32} />
      </div>
    );
  }

  const quickLinks = getRoleQuickLinks(user.role);

  const getStatsForRole = () => {
    const baseStats = [
      { label: 'Active Deliveries', value: stats?.activeDeliveries || 0, icon: Truck, color: 'text-blue-400' },
      { label: 'Completed Today', value: stats?.completedToday || 0, icon: CheckCircle, color: 'text-green-400' },
    ];
    if (['owner', 'admin', 'office'].includes(user.role)) {
      return [
        ...baseStats,
        { label: 'Pending Orders', value: stats?.pendingOrders || 0, icon: Clock, color: 'text-orange-400' },
        { label: 'Low Stock Items', value: stats?.lowStockItems || 0, icon: AlertCircle, color: 'text-red-400' },
      ];
    }
    if (user.role === 'project_manager') {
      return [
        ...baseStats,
        { label: 'Pending Orders', value: stats?.pendingOrders || 0, icon: Clock, color: 'text-orange-400' },
        { label: 'Upcoming', value: stats?.upcomingSchedule || 0, icon: Calendar, color: 'text-purple-400' },
      ];
    }
    return baseStats;
  };

  const displayStats = getStatsForRole();

  return (
    <div>
      {/* Welcome Section */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles size={20} className="text-brand-green" />
          <span className="text-sm text-brand-green font-medium">Welcome back</span>
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">
          Hello, {user.name.split(' ')[0]}!
        </h2>
        <p className="text-neutral-400">
          {user.role === 'driver'
            ? "Check your assigned deliveries and update their status."
            : user.role === 'project_manager'
            ? "Create material orders and manage your job schedules."
            : user.role === 'office' || user.role === 'viewer'
            ? "Manage operations, finance, and materials from here."
            : "Full access to all RoofStack features and system administration."
          }
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {displayStats.map((stat, i) => (
          <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:bg-white/[0.04] transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                <stat.icon size={20} className={stat.color} />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {isLoadingStats ? <div className="w-12 h-8 bg-white/10 rounded animate-pulse" /> : stat.value}
            </div>
            <div className="text-sm text-neutral-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Monday Announcement Widget */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Megaphone size={18} className="text-amber-400 flex-shrink-0" />
          Monday Meeting
        </h3>
        <MondayAnnouncementWidget />
      </div>

      {/* Weekly Numbers Widget - Sales/Admin only */}
      {['sales', 'owner', 'admin', 'manager'].includes(user.role) && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ClipboardList size={18} className="text-brand-green flex-shrink-0" />
            Weekly Numbers
          </h3>
          <WeeklyNumbersWidget compact />
        </div>
      )}

      {/* Quick Access Grid */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Package size={18} className="text-brand-green flex-shrink-0" />
          Quick Access
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map((item, i) => (
            <Link
              key={i}
              href={item.href}
              className="group relative overflow-hidden rounded-2xl border border-white/5 hover:border-white/10 bg-white/[0.02] p-5 transition-all duration-300 hover:bg-white/[0.05]"
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0`}>
                  <item.icon size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white group-hover:text-brand-green transition-colors truncate">{item.label}</h4>
                </div>
                <ChevronRight size={18} className="text-neutral-500 group-hover:text-brand-green group-hover:translate-x-1 transition-all flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      {user.role !== 'driver' && (
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock size={18} className="text-neutral-400" />
            Recent Activity
          </h3>
          <div className="space-y-3">
            {isLoadingStats ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-neutral-400" size={24} />
              </div>
            ) : stats?.recentActivity && stats.recentActivity.length > 0 ? (
              stats.recentActivity.map((activity, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${activity.color.replace('text-', 'bg-')}`} />
                    <div>
                      <p className="text-sm font-medium text-white">{activity.action}</p>
                      <p className="text-xs text-neutral-500">{activity.detail}</p>
                    </div>
                  </div>
                  <span className="text-xs text-neutral-500">{activity.time}</span>
                </div>
              ))
            ) : (
              <p className="text-center text-neutral-500 py-4">No recent activity</p>
            )}
          </div>
        </div>
      )}

      {/* Driver: Today's Route */}
      {user.role === 'driver' && (
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <MapPin size={18} className="text-blue-400" />
            Today's Route
          </h3>
          <div className="text-center py-8">
            <Truck size={48} className="text-neutral-600 mx-auto mb-4" />
            <p className="text-neutral-400 mb-4">View your assigned deliveries and start your route.</p>
            <Link
              href="/portal/driver"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/25"
            >
              <Truck size={18} /> View Deliveries
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
