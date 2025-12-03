'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Truck, Package, DollarSign, Calendar, BarChart3, Users,
  Settings, FileText, LogOut, ChevronRight, Loader2, Clock,
  AlertCircle, CheckCircle, MapPin, Bell, Shield, Home,
  TrendingUp, Box, ClipboardList, Eye, Sparkles, UserCircle,
  BookOpen, Image as ImageIcon, Globe, Link2
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { TeamRole } from '@/lib/team-roles';

interface DashboardStats {
  activeDeliveries: number;
  completedToday: number;
  pendingOrders: number;
  totalRevenue: number;
  lowStockItems: number;
  upcomingSchedule: number;
}

// Role-specific navigation items
const getRoleNavigation = (role: TeamRole) => {
  const allNav = {
    // Admin/Owner sees everything
    adminNav: [
      { id: 'operations', label: 'Operations Center', href: '/portal/admin/operations', icon: Shield, color: 'bg-red-500/20 text-red-400' },
      { id: 'customers', label: 'Customer Portals', href: '/portal/customers', icon: Link2, color: 'bg-teal-500/20 text-teal-400' },
      { id: 'office', label: 'Office Portal', href: '/portal/office', icon: BarChart3, color: 'bg-emerald-500/20 text-emerald-400' },
      { id: 'pm', label: 'PM Portal', href: '/portal/pm', icon: Package, color: 'bg-cyan-500/20 text-cyan-400' },
      { id: 'billing', label: 'Billing', href: '/portal/billing', icon: DollarSign, color: 'bg-green-500/20 text-green-400' },
      { id: 'inventory', label: 'Inventory', href: '/portal/inventory', icon: Box, color: 'bg-orange-500/20 text-orange-400' },
      { id: 'schedule', label: 'Schedule', href: '/portal/schedule', icon: Calendar, color: 'bg-purple-500/20 text-purple-400' },
      { id: 'reports', label: 'Reports', href: '/portal/reports', icon: BarChart3, color: 'bg-blue-500/20 text-blue-400' },
      { id: 'users', label: 'User Management', href: '/portal/admin/users', icon: Users, color: 'bg-pink-500/20 text-pink-400' },
      { id: 'team', label: 'Team Bios', href: '/portal/admin/team', icon: UserCircle, color: 'bg-indigo-500/20 text-indigo-400' },
      { id: 'blog', label: 'Blog Posts', href: '/portal/admin/blog', icon: BookOpen, color: 'bg-amber-500/20 text-amber-400' },
      { id: 'images', label: 'Image Library', href: '/portal/admin/images', icon: ImageIcon, color: 'bg-rose-500/20 text-rose-400' },
      { id: 'admin', label: 'Website Settings', href: '/portal/admin', icon: Settings, color: 'bg-violet-500/20 text-violet-400' },
    ],
    // Office staff
    officeNav: [
      { id: 'office', label: 'Order Management', href: '/portal/office', icon: ClipboardList, color: 'bg-emerald-500/20 text-emerald-400' },
      { id: 'billing', label: 'Billing & Invoices', href: '/portal/billing', icon: DollarSign, color: 'bg-green-500/20 text-green-400' },
      { id: 'inventory', label: 'Inventory', href: '/portal/inventory', icon: Box, color: 'bg-orange-500/20 text-orange-400' },
      { id: 'schedule', label: 'Schedule', href: '/portal/schedule', icon: Calendar, color: 'bg-purple-500/20 text-purple-400' },
      { id: 'reports', label: 'Reports', href: '/portal/reports', icon: BarChart3, color: 'bg-blue-500/20 text-blue-400' },
    ],
    // Project Manager
    pmNav: [
      { id: 'pm', label: 'Create Orders', href: '/portal/pm', icon: Package, color: 'bg-cyan-500/20 text-cyan-400' },
      { id: 'schedule', label: 'Schedule', href: '/portal/schedule', icon: Calendar, color: 'bg-purple-500/20 text-purple-400' },
    ],
    // Driver
    driverNav: [
      { id: 'driver', label: 'My Deliveries', href: '/portal/driver', icon: Truck, color: 'bg-blue-500/20 text-blue-400' },
    ],
    // Viewer
    viewerNav: [
      { id: 'office', label: 'View Orders', href: '/portal/office', icon: Eye, color: 'bg-emerald-500/20 text-emerald-400' },
      { id: 'reports', label: 'Reports', href: '/portal/reports', icon: BarChart3, color: 'bg-blue-500/20 text-blue-400' },
    ],
  };

  switch (role) {
    case 'owner':
    case 'admin':
      return allNav.adminNav;
    case 'office':
      return allNav.officeNav;
    case 'project_manager':
      return allNav.pmNav;
    case 'driver':
      return allNav.driverNav;
    case 'viewer':
      return allNav.viewerNav;
    default:
      return [];
  }
};

// Role labels for display
const roleLabels: Record<TeamRole, { label: string; color: string }> = {
  owner: { label: 'Owner', color: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black' },
  admin: { label: 'Administrator', color: 'bg-gradient-to-r from-red-500 to-rose-500 text-white' },
  office: { label: 'Office Staff', color: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white' },
  project_manager: { label: 'Project Manager', color: 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white' },
  driver: { label: 'Driver', color: 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white' },
  viewer: { label: 'Viewer', color: 'bg-gradient-to-r from-neutral-500 to-neutral-600 text-white' },
};

export default function Dashboard() {
  const router = useRouter();
  const { user, isLoading, logout, hasPermission } = useAuth();
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

    if (user) {
      loadStats();
    }
  }, [user]);

  // Loading state
  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

  const navigation = getRoleNavigation(user.role);
  const roleInfo = roleLabels[user.role];

  // Get role-specific stats to show
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

    // Driver sees only their stats
    return baseStats;
  };

  const displayStats = getStatsForRole();

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-brand-green to-emerald-600 p-0.5">
                  <div className="w-full h-full rounded-[10px] bg-neutral-900 flex items-center justify-center">
                    <Image
                      src="/logo-nobg.png"
                      alt="RCRS"
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Dashboard</h1>
                  <p className="text-sm text-neutral-400">River City Roofing Portal</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* View Site */}
                <Link
                  href="/"
                  target="_blank"
                  className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 text-sm transition-colors"
                >
                  <Home size={16} />
                  View Site
                </Link>

                {/* User Info */}
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-white">{user.name}</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleInfo.color}`}>
                      {roleInfo.label}
                    </span>
                  </div>
                  <button
                    onClick={logout}
                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-red-500/20 flex items-center justify-center transition-colors group"
                    title="Sign Out"
                  >
                    <LogOut size={18} className="text-neutral-400 group-hover:text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
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
                ? "Manage orders, billing, and inventory from here."
                : "Full access to all portal features and system administration."
              }
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {displayStats.map((stat, i) => (
              <div
                key={i}
                className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center`}>
                    <stat.icon size={20} className={stat.color} />
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  {isLoadingStats ? (
                    <div className="w-12 h-8 bg-white/10 rounded animate-pulse" />
                  ) : (
                    stat.value
                  )}
                </div>
                <div className="text-sm text-neutral-400">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Navigation Grid */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Package size={18} className="text-brand-green" />
              Quick Access
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {navigation.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="group relative overflow-hidden rounded-2xl border border-white/5 hover:border-white/10 bg-white/[0.02] p-5 transition-all duration-300 hover:bg-white/[0.05]"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <item.icon size={24} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-white group-hover:text-brand-green transition-colors">
                        {item.label}
                      </h4>
                    </div>
                    <ChevronRight size={18} className="text-neutral-500 group-hover:text-brand-green group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Activity - Show only for non-drivers */}
          {user.role !== 'driver' && (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Clock size={18} className="text-neutral-400" />
                Recent Activity
              </h3>
              <div className="space-y-3">
                {[
                  { action: 'Delivery completed', detail: 'Job #1234 - 123 Oak St', time: '5 min ago', color: 'text-green-400' },
                  { action: 'New order created', detail: 'Job #1235 - 456 Pine Ave', time: '15 min ago', color: 'text-blue-400' },
                  { action: 'Invoice sent', detail: 'INV-2024-0089 - $2,450.00', time: '1 hour ago', color: 'text-purple-400' },
                ].map((activity, i) => (
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
                ))}
              </div>
            </div>
          )}

          {/* Driver-specific: Today's Route */}
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
                  <Truck size={18} />
                  View Deliveries
                </Link>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
