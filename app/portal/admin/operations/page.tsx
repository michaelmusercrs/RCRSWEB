'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, BarChart3, Truck, Package, DollarSign, Users, Calendar,
  AlertTriangle, CheckCircle2, Clock, TrendingUp, MapPin, Settings,
  RefreshCw, Download, Eye, ChevronRight, Shield, Activity, FileText
} from 'lucide-react';

interface DashboardStats {
  // Tickets
  totalTickets: number;
  activeTickets: number;
  completedToday: number;
  pendingPickups: number;
  pendingReturns: number;

  // Billing
  totalBilled: number;
  pendingBilling: number;
  overdueInvoices: number;
  totalRevenue: number;

  // Inventory
  lowStockItems: number;
  totalProducts: number;
  pendingRestocks: number;

  // Team
  activeDrivers: number;
  totalTeamMembers: number;

  // Alerts
  billingAlerts: number;
  lossAlerts: number;
}

interface RecentActivity {
  id: string;
  type: 'ticket' | 'invoice' | 'inventory' | 'team';
  action: string;
  description: string;
  user: string;
  timestamp: string;
}

export default function AdminOperationsPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalTickets: 0,
    activeTickets: 0,
    completedToday: 0,
    pendingPickups: 0,
    pendingReturns: 0,
    totalBilled: 0,
    pendingBilling: 0,
    overdueInvoices: 0,
    totalRevenue: 0,
    lowStockItems: 0,
    totalProducts: 0,
    pendingRestocks: 0,
    activeDrivers: 0,
    totalTeamMembers: 9,
    billingAlerts: 0,
    lossAlerts: 0,
  });

  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setRefreshing(true);
    try {
      const [ticketsRes, inventoryRes, billingRes] = await Promise.all([
        fetch('/api/portal/tickets'),
        fetch('/api/portal/inventory'),
        fetch('/api/portal/billing?action=summary'),
      ]);

      const tickets = await ticketsRes.json();
      const inventory = await inventoryRes.json();

      const ticketArr = Array.isArray(tickets) ? tickets : tickets.tickets || [];
      const inventoryArr = Array.isArray(inventory) ? inventory : inventory.inventory || [];

      const today = new Date().toISOString().slice(0, 10);
      const activeStatuses = ['created', 'assigned', 'materials_pulled', 'load_verified', 'en_route', 'arrived'];

      setStats(prev => ({
        ...prev,
        totalTickets: ticketArr.length,
        activeTickets: ticketArr.filter((t: any) => activeStatuses.includes(t.status)).length,
        completedToday: ticketArr.filter((t: any) => t.completedAt?.startsWith(today)).length,
        pendingPickups: ticketArr.filter((t: any) => t.ticketType === 'pickup' && t.status !== 'completed').length,
        pendingReturns: ticketArr.filter((t: any) => t.ticketType === 'return' && t.status !== 'completed').length,
        totalProducts: inventoryArr.length,
        lowStockItems: inventoryArr.filter((i: any) => i.currentQty <= (i.minQty || 5)).length,
      }));

      // Mock recent activity
      setRecentActivity([
        {
          id: '1',
          type: 'ticket',
          action: 'Delivery Completed',
          description: 'Smith Roof Replacement - Materials delivered',
          user: 'Rick',
          timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        },
        {
          id: '2',
          type: 'invoice',
          action: 'Invoice Created',
          description: 'INV-2024-0125 - $3,450.00',
          user: 'Tia',
          timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        },
        {
          id: '3',
          type: 'ticket',
          action: 'New Order',
          description: 'Johnson Residence - Delivery scheduled',
          user: 'John',
          timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        },
        {
          id: '4',
          type: 'inventory',
          action: 'Stock Adjusted',
          description: 'OC Duration Shingles - 50 SQ added',
          user: 'Destin',
          timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
        },
      ]);

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const quickLinks = [
    { label: 'PM Portal', href: '/portal/pm', icon: Package, color: 'bg-cyan-500/20 text-cyan-400' },
    { label: 'Office Portal', href: '/portal/office', icon: BarChart3, color: 'bg-emerald-500/20 text-emerald-400' },
    { label: 'Billing', href: '/portal/billing', icon: DollarSign, color: 'bg-green-500/20 text-green-400' },
    { label: 'Inventory', href: '/portal/inventory', icon: Package, color: 'bg-orange-500/20 text-orange-400' },
    { label: 'Schedule', href: '/portal/schedule', icon: Calendar, color: 'bg-purple-500/20 text-purple-400' },
    { label: 'Reports', href: '/portal/reports', icon: BarChart3, color: 'bg-blue-500/20 text-blue-400' },
    { label: 'User Management', href: '/portal/admin/users', icon: Users, color: 'bg-pink-500/20 text-pink-400' },
    { label: 'Website Admin', href: '/portal/admin', icon: Settings, color: 'bg-violet-500/20 text-violet-400' },
  ];

  const formatTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto text-brand-green" size={48} />
          <p className="text-neutral-400 mt-4">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background */}
      <div className="fixed inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href="/portal"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={18} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Shield className="text-red-500" size={22} />
                    Admin Operations Center
                  </h1>
                  <p className="text-sm text-neutral-400">Full system visibility and control</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={loadDashboardData}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 text-sm transition-colors"
                >
                  <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                  Refresh
                </button>
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-green text-black font-medium text-sm">
                  <Download size={16} />
                  Export Report
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* Alerts Banner */}
          {(stats.billingAlerts > 0 || stats.lossAlerts > 0 || stats.lowStockItems > 0) && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-4">
              <AlertTriangle className="text-red-500" size={24} />
              <div className="flex-1">
                <p className="text-red-400 font-medium">Attention Required</p>
                <p className="text-red-300 text-sm">
                  {stats.billingAlerts > 0 && `${stats.billingAlerts} billing alerts. `}
                  {stats.lossAlerts > 0 && `${stats.lossAlerts} potential loss alerts. `}
                  {stats.lowStockItems > 0 && `${stats.lowStockItems} low stock items.`}
                </p>
              </div>
              <Link href="/portal/billing" className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30">
                View Alerts
              </Link>
            </div>
          )}

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="text-blue-400" size={18} />
                <span className="text-neutral-400 text-xs">Active Tickets</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.activeTickets}</p>
              <p className="text-xs text-neutral-500">{stats.totalTickets} total</p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="text-green-400" size={18} />
                <span className="text-neutral-400 text-xs">Completed Today</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.completedToday}</p>
              <p className="text-xs text-green-400">+{stats.completedToday} today</p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Package className="text-orange-400" size={18} />
                <span className="text-neutral-400 text-xs">Pending Pickups</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.pendingPickups}</p>
              <p className="text-xs text-neutral-500">{stats.pendingReturns} returns</p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="text-green-400" size={18} />
                <span className="text-neutral-400 text-xs">Pending Billing</span>
              </div>
              <p className="text-2xl font-bold text-white">${stats.pendingBilling.toLocaleString()}</p>
              <p className="text-xs text-yellow-400">{stats.overdueInvoices} overdue</p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="text-yellow-400" size={18} />
                <span className="text-neutral-400 text-xs">Low Stock</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.lowStockItems}</p>
              <p className="text-xs text-neutral-500">{stats.totalProducts} products</p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="text-purple-400" size={18} />
                <span className="text-neutral-400 text-xs">Team Active</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.activeDrivers}</p>
              <p className="text-xs text-neutral-500">{stats.totalTeamMembers} members</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Quick Access */}
            <div className="lg:col-span-2">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Activity size={18} className="text-brand-green" />
                Portal Access
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                {quickLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="group bg-white/[0.02] border border-white/5 rounded-xl p-4 hover:bg-white/[0.05] hover:border-white/10 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${link.color}`}>
                          <Icon size={20} />
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-medium group-hover:text-brand-green transition-colors">
                            {link.label}
                          </p>
                        </div>
                        <ChevronRight className="text-neutral-500 group-hover:text-brand-green group-hover:translate-x-1 transition-all" size={18} />
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Recent Activity */}
              <h2 className="text-lg font-semibold text-white mt-8 mb-4 flex items-center gap-2">
                <Clock size={18} className="text-neutral-400" />
                Recent Activity
              </h2>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                <div className="divide-y divide-white/5">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="p-4 flex items-center gap-4 hover:bg-white/[0.02]">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        activity.type === 'ticket' ? 'bg-blue-500/20' :
                        activity.type === 'invoice' ? 'bg-green-500/20' :
                        activity.type === 'inventory' ? 'bg-orange-500/20' :
                        'bg-purple-500/20'
                      }`}>
                        {activity.type === 'ticket' && <Truck className="text-blue-400" size={18} />}
                        {activity.type === 'invoice' && <FileText className="text-green-400" size={18} />}
                        {activity.type === 'inventory' && <Package className="text-orange-400" size={18} />}
                        {activity.type === 'team' && <Users className="text-purple-400" size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium">{activity.action}</p>
                        <p className="text-neutral-400 text-sm truncate">{activity.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-neutral-500 text-sm">{activity.user}</p>
                        <p className="text-neutral-600 text-xs">{formatTimeAgo(activity.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Team Status */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Users size={18} className="text-purple-400" />
                Team Status
              </h2>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-4">
                {/* Drivers */}
                <div>
                  <p className="text-neutral-400 text-xs uppercase tracking-wider mb-3">Drivers</p>
                  {['Rick', 'Tae'].map((name) => (
                    <div key={name} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 text-sm font-medium">
                          {name[0]}
                        </div>
                        <span className="text-white">{name}</span>
                      </div>
                      <span className="px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs">Available</span>
                    </div>
                  ))}
                </div>

                {/* Project Managers */}
                <div className="pt-2 border-t border-white/5">
                  <p className="text-neutral-400 text-xs uppercase tracking-wider mb-3">Project Managers</p>
                  {['John', 'Bart'].map((name) => (
                    <div key={name} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-sm font-medium">
                          {name[0]}
                        </div>
                        <span className="text-white">{name}</span>
                      </div>
                      <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs">Active</span>
                    </div>
                  ))}
                </div>

                {/* Office */}
                <div className="pt-2 border-t border-white/5">
                  <p className="text-neutral-400 text-xs uppercase tracking-wider mb-3">Office Staff</p>
                  {['Tia', 'Destin'].map((name) => (
                    <div key={name} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-medium">
                          {name[0]}
                        </div>
                        <span className="text-white">{name}</span>
                      </div>
                      <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs">Active</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* System Health */}
              <h2 className="text-lg font-semibold text-white mt-6 mb-4 flex items-center gap-2">
                <Activity size={18} className="text-green-400" />
                System Status
              </h2>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3">
                {[
                  { label: 'Google Sheets Sync', status: 'Connected', ok: true },
                  { label: 'JobNimbus API', status: 'Ready', ok: true },
                  { label: 'GPS Tracking', status: 'Active', ok: true },
                  { label: 'SMS Notifications', status: 'Active', ok: true },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-neutral-400 text-sm">{item.label}</span>
                    <span className={`text-xs ${item.ok ? 'text-green-400' : 'text-red-400'}`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
