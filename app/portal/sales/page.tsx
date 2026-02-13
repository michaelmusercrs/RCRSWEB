'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Phone, MessageSquare, Calendar, FileText, MapPin, Clock, User,
  ChevronRight, Loader2, LogOut, Home, Search, Filter, Plus,
  TrendingUp, DollarSign, Users, Target, Trophy, Flame, Bell,
  CheckCircle, AlertCircle, ArrowRight, Camera, BarChart3,
  RefreshCw, Send, Star, X, Mail, Building, Briefcase,
  Activity, ArrowUpRight, ArrowDownRight,
  type LucideIcon
} from 'lucide-react';
import { useAuth, ROLE_DEFAULT_ROUTES } from '@/lib/auth-context';
import { TEAM_MEMBERS, TeamRole } from '@/lib/team-roles';
import WeeklyNumbersWidget from '@/components/portal/WeeklyNumbersWidget';

// =============================================================================
// Types
// =============================================================================

interface Lead {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  status: 'new' | 'contacted' | 'scheduled' | 'inspected' | 'quoted' | 'closed_won' | 'closed_lost';
  source: string;
  estimatedValue: number;
  notes: string;
  createdAt: string;
  lastContact?: string;
  scheduledDate?: string;
  assignedTo: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface SalesStats {
  totalLeads: number;
  closedDeals: number;
  pendingQuotes: number;
  scheduledInspections: number;
  monthlyRevenue: number;
  monthlyGoal: number;
  conversionRate: number;
  avgDealSize: number;
  leaderboardPosition: number;
  commissionEarned: number;
  commissionPending: number;
  hotStreak: number;
  teamAvgRevenue: number;
  teamAvgDeals: number;
}

interface ActivityItem {
  id: string;
  type: 'lead_assigned' | 'quote_sent' | 'job_closed' | 'commission_paid' | 'inspection';
  description: string;
  amount?: number;
  timestamp: string;
}

interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  action: () => void;
}

// =============================================================================
// Default data
// =============================================================================

const initialLeads: Lead[] = [];

const defaultStats: SalesStats = {
  totalLeads: 0,
  closedDeals: 0,
  pendingQuotes: 0,
  scheduledInspections: 0,
  monthlyRevenue: 0,
  monthlyGoal: 100000,
  conversionRate: 0,
  avgDealSize: 0,
  leaderboardPosition: 0,
  commissionEarned: 0,
  commissionPending: 0,
  hotStreak: 0,
  teamAvgRevenue: 0,
  teamAvgDeals: 0,
};

// =============================================================================
// Status Badge Component
// =============================================================================

const statusConfig = {
  new: { label: 'New', color: 'bg-blue-500/20 text-blue-400 ring-blue-500/30' },
  contacted: { label: 'Contacted', color: 'bg-purple-500/20 text-purple-400 ring-purple-500/30' },
  scheduled: { label: 'Scheduled', color: 'bg-cyan-500/20 text-cyan-400 ring-cyan-500/30' },
  inspected: { label: 'Inspected', color: 'bg-orange-500/20 text-orange-400 ring-orange-500/30' },
  quoted: { label: 'Quoted', color: 'bg-yellow-500/20 text-yellow-400 ring-yellow-500/30' },
  closed_won: { label: 'Won', color: 'bg-green-500/20 text-green-400 ring-green-500/30' },
  closed_lost: { label: 'Lost', color: 'bg-red-500/20 text-red-400 ring-red-500/30' },
};

const priorityConfig = {
  low: { label: 'Low', color: 'text-neutral-400' },
  medium: { label: 'Medium', color: 'text-blue-400' },
  high: { label: 'High', color: 'text-orange-400' },
  urgent: { label: 'Urgent', color: 'text-red-400' },
};

function StatusBadge({ status }: { status: Lead['status'] }) {
  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${config.color}`}>
      {config.label}
    </span>
  );
}

// =============================================================================
// Role Labels
// =============================================================================

const roleLabels: Record<TeamRole, { label: string; color: string }> = {
  owner: { label: 'Owner', color: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black' },
  admin: { label: 'Administrator', color: 'bg-gradient-to-r from-red-500 to-rose-500 text-white' },
  manager: { label: 'Manager', color: 'bg-gradient-to-r from-orange-500 to-amber-500 text-white' },
  sales: { label: 'Sales Rep', color: 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' },
  office: { label: 'Office Staff', color: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white' },
  project_manager: { label: 'Project Manager', color: 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white' },
  driver: { label: 'Driver', color: 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white' },
  viewer: { label: 'Viewer', color: 'bg-gradient-to-r from-neutral-500 to-neutral-600 text-white' },
};

// =============================================================================
// Sales Rep Dashboard
// =============================================================================

export default function SalesPortal() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [stats, setStats] = useState<SalesStats>(defaultStats);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showQuickCall, setShowQuickCall] = useState(false);

  // Redirect if not authenticated or not a sales role
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/portal');
    }
  }, [user, isLoading, router]);

  // Load data from real APIs
  const loadData = useCallback(async () => {
    if (!user) return;
    setIsLoadingData(true);
    try {
      const [salesRes, leadsRes, commissionsRes] = await Promise.all([
        fetch('/api/command-center/sales?period=month').catch(() => null),
        fetch('/api/dashboard/leads').catch(() => null),
        fetch(`/api/command-center/sales?period=year&rep=${encodeURIComponent(user.name)}`).catch(() => null),
      ]);

      // Process sales leaderboard data
      if (salesRes?.ok) {
        const salesData = await salesRes.json();
        if (salesData.success && salesData.data) {
          const leaderboard = salesData.data.leaderboard || [];
          const summary = salesData.data.summary || {};

          // Find current user in leaderboard
          const rep = leaderboard.find(
            (r: { name: string }) => r.name.toLowerCase().includes(user.name.split(' ')[0].toLowerCase())
          );

          // Calculate team averages
          const teamAvgRevenue = leaderboard.length > 0
            ? leaderboard.reduce((sum: number, r: { totalCommissions: number }) => sum + r.totalCommissions, 0) / leaderboard.length
            : 0;
          const teamAvgDeals = leaderboard.length > 0
            ? leaderboard.reduce((sum: number, r: { transactionCount: number }) => sum + r.transactionCount, 0) / leaderboard.length
            : 0;

          setStats(prev => ({
            ...prev,
            commissionEarned: rep?.totalCommissions || 0,
            closedDeals: rep?.transactionCount || 0,
            avgDealSize: rep?.avgTransaction || 0,
            leaderboardPosition: rep?.rank || 0,
            totalLeads: summary?.transactionCount || 0,
            conversionRate: rep ? ((rep.transactionCount / (summary.transactionCount || 1)) * 100) : 0,
            teamAvgRevenue,
            teamAvgDeals,
          }));

          // Build recent activity from leaderboard data
          const activities: ActivityItem[] = [];
          if (rep) {
            activities.push({
              id: '1',
              type: 'commission_paid',
              description: `Earned $${rep.totalCommissions.toLocaleString()} in commissions this month`,
              amount: rep.totalCommissions,
              timestamp: new Date().toISOString(),
            });
          }
          if (rep?.transactionCount > 0) {
            activities.push({
              id: '2',
              type: 'job_closed',
              description: `Closed ${rep.transactionCount} deals this month`,
              timestamp: new Date().toISOString(),
            });
          }
          setRecentActivity(activities);
        }
      }

      // Process yearly commission data for this rep
      if (commissionsRes?.ok) {
        const commData = await commissionsRes.json();
        if (commData.success && commData.data?.repDetail) {
          const repDetail = commData.data.repDetail;
          setStats(prev => ({
            ...prev,
            commissionPending: Math.max(0, repDetail.totalCommissions - prev.commissionEarned),
            monthlyRevenue: prev.commissionEarned,
          }));

          // Add recent transactions to activity
          if (repDetail.recentTransactions?.length > 0) {
            const txActivities: ActivityItem[] = repDetail.recentTransactions.slice(0, 5).map((tx: { date: string; amount: number }, i: number) => ({
              id: `tx-${i}`,
              type: 'commission_paid' as const,
              description: `Commission payment: $${tx.amount.toLocaleString()}`,
              amount: tx.amount,
              timestamp: tx.date,
            }));
            setRecentActivity(prev => [...prev, ...txActivities].slice(0, 8));
          }
        }
      }

      // Process leads
      if (leadsRes?.ok) {
        const leadsData = await leadsRes.json();
        if (leadsData.success && Array.isArray(leadsData.leads)) {
          const myLeads = leadsData.leads.filter(
            (lead: Lead) => lead.assignedTo?.toLowerCase().includes(user.name.split(' ')[0].toLowerCase())
          );
          setLeads(myLeads.length > 0 ? myLeads : leadsData.leads.slice(0, 10));

          // Update stats from leads
          const activeLeads = myLeads.length > 0 ? myLeads : leadsData.leads.slice(0, 10);
          const pendingQuotes = activeLeads.filter((l: Lead) => l.status === 'quoted').length;
          const scheduledInspections = activeLeads.filter((l: Lead) => l.status === 'scheduled').length;

          setStats(prev => ({
            ...prev,
            pendingQuotes,
            scheduledInspections,
            totalLeads: prev.totalLeads || activeLeads.length,
          }));
        }
      }
    } catch (error) {
      console.error('Error loading sales data:', error);
    } finally {
      setIsLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Quick Actions
  const quickActions: QuickAction[] = [
    {
      id: 'call',
      label: 'Quick Call',
      icon: Phone,
      color: 'bg-green-500/20 text-green-400 hover:bg-green-500/30',
      action: () => setShowQuickCall(true),
    },
    {
      id: 'schedule',
      label: 'Schedule',
      icon: Calendar,
      color: 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30',
      action: () => router.push('/portal/sales/leads?action=schedule'),
    },
    {
      id: 'quote',
      label: 'Send Quote',
      icon: FileText,
      color: 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30',
      action: () => router.push('/portal/sales/leads?action=quote'),
    },
    {
      id: 'photo',
      label: 'Upload Photo',
      icon: Camera,
      color: 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30',
      action: () => router.push('/admin/upload'),
    },
  ];

  const handleCall = (lead: Lead) => {
    window.location.href = `tel:${lead.customerPhone}`;
  };

  const handleText = (lead: Lead) => {
    window.location.href = `sms:${lead.customerPhone}`;
  };

  const handleSendPortalLink = (lead: Lead) => {
    const portalUrl = `https://rivercityroofingsolutions.com/my/${lead.id}`;
    const message = `Hi ${lead.customerName.split(' ')[0]}, here's your customer portal link: ${portalUrl}`;
    window.location.href = `sms:${lead.customerPhone}?body=${encodeURIComponent(message)}`;
  };

  // Activity icon mapping
  const activityIcons: Record<string, { icon: LucideIcon; color: string }> = {
    lead_assigned: { icon: Users, color: 'text-blue-400 bg-blue-500/20' },
    quote_sent: { icon: FileText, color: 'text-purple-400 bg-purple-500/20' },
    job_closed: { icon: CheckCircle, color: 'text-green-400 bg-green-500/20' },
    commission_paid: { icon: DollarSign, color: 'text-yellow-400 bg-yellow-500/20' },
    inspection: { icon: Search, color: 'text-cyan-400 bg-cyan-500/20' },
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-green/20 to-emerald-500/20 border border-brand-green/30 flex items-center justify-center">
              <TrendingUp className="text-brand-green" size={32} />
            </div>
            <div className="absolute inset-0 rounded-2xl border-2 border-brand-green/30 animate-ping" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-white">Sales Portal</h2>
            <p className="text-sm text-zinc-400 mt-1">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  const roleInfo = roleLabels[user.role as TeamRole] || roleLabels.viewer;
  const goalProgress = stats.monthlyGoal > 0 ? (stats.monthlyRevenue / stats.monthlyGoal) * 100 : 0;
  const vsTeamAvg = stats.teamAvgRevenue > 0
    ? ((stats.commissionEarned - stats.teamAvgRevenue) / stats.teamAvgRevenue) * 100
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10 pb-24">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link href="/portal/dashboard" className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-gradient-to-br from-brand-green to-emerald-600 p-0.5">
                  <div className="w-full h-full rounded-[10px] bg-neutral-900 flex items-center justify-center">
                    <Image
                      src="/logo-nobg.png"
                      alt="RCRS"
                      width={28}
                      height={28}
                      className="object-contain"
                    />
                  </div>
                </Link>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">Sales Portal</h1>
                  <p className="text-xs sm:text-sm text-neutral-400 hidden sm:block">Your mobile command center</p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-4">
                <button
                  onClick={loadData}
                  disabled={isLoadingData}
                  className="relative w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <RefreshCw size={18} className={`text-neutral-400 ${isLoadingData ? 'animate-spin' : ''}`} />
                </button>

                <button className="relative w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                  <Bell size={18} className="text-neutral-400" />
                  {stats.pendingQuotes > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs font-bold text-white flex items-center justify-center">
                      {stats.pendingQuotes}
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-white">{user.name}</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleInfo.color}`}>
                      Sales Rep
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

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          {/* Performance Summary */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Hello, {user.name.split(' ')[0]}!</h2>
                <p className="text-sm text-neutral-400">Let's close some deals today</p>
              </div>
              {stats.hotStreak > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/20 rounded-full">
                  <Flame size={16} className="text-orange-400" />
                  <span className="text-sm font-medium text-orange-400">{stats.hotStreak} day streak!</span>
                </div>
              )}
            </div>

            {/* Goal Progress */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-neutral-400">Monthly Commission Progress</span>
                <span className="text-sm font-medium text-white">
                  ${stats.commissionEarned.toLocaleString()} / ${stats.monthlyGoal.toLocaleString()}
                </span>
              </div>
              <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    goalProgress >= 100 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                    goalProgress >= 75 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                    'bg-gradient-to-r from-blue-500 to-cyan-500'
                  }`}
                  style={{ width: `${Math.min(goalProgress, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-neutral-500">{goalProgress.toFixed(0)}% complete</span>
                <span className="text-xs text-neutral-500">
                  {goalProgress < 100
                    ? `$${Math.max(0, stats.monthlyGoal - stats.commissionEarned).toLocaleString()} to go`
                    : 'Goal reached!'}
                </span>
              </div>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Users size={16} className="text-blue-400" />
                  <span className="text-xs text-neutral-400">Active Leads</span>
                </div>
                <span className="text-xl font-bold text-white">{stats.totalLeads}</span>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle size={16} className="text-green-400" />
                  <span className="text-xs text-neutral-400">Deals Closed</span>
                </div>
                <span className="text-xl font-bold text-white">{stats.closedDeals}</span>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy size={16} className="text-yellow-400" />
                  <span className="text-xs text-neutral-400">Rank</span>
                </div>
                <span className="text-xl font-bold text-white">
                  {stats.leaderboardPosition > 0 ? `#${stats.leaderboardPosition}` : '--'}
                </span>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={16} className="text-green-400" />
                  <span className="text-xs text-neutral-400">Commission</span>
                </div>
                <span className="text-xl font-bold text-white">${stats.commissionEarned.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Performance vs Team Average */}
          {stats.teamAvgRevenue > 0 && (
            <div className="mb-6">
              <div className={`bg-white/[0.02] border rounded-2xl p-4 ${
                vsTeamAvg >= 0 ? 'border-green-500/20' : 'border-orange-500/20'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      vsTeamAvg >= 0 ? 'bg-green-500/20' : 'bg-orange-500/20'
                    }`}>
                      {vsTeamAvg >= 0
                        ? <ArrowUpRight size={20} className="text-green-400" />
                        : <ArrowDownRight size={20} className="text-orange-400" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">vs Team Average</p>
                      <p className="text-xs text-neutral-400">
                        Team avg: ${stats.teamAvgRevenue.toLocaleString()} | Avg deals: {Math.round(stats.teamAvgDeals)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${vsTeamAvg >= 0 ? 'text-green-400' : 'text-orange-400'}`}>
                      {vsTeamAvg >= 0 ? '+' : ''}{vsTeamAvg.toFixed(1)}%
                    </p>
                    <p className="text-xs text-neutral-500">
                      {vsTeamAvg >= 0 ? 'above average' : 'below average'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* My Commissions Summary */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-neutral-400 mb-3">My Commissions</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/[0.02] border border-green-500/20 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-green-400">${stats.commissionEarned.toLocaleString()}</p>
                <p className="text-xs text-neutral-500">Earned</p>
              </div>
              <div className="bg-white/[0.02] border border-yellow-500/20 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-yellow-400">${stats.commissionPending.toLocaleString()}</p>
                <p className="text-xs text-neutral-500">Pending</p>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-white">${stats.avgDealSize.toLocaleString()}</p>
                <p className="text-xs text-neutral-500">Avg Deal</p>
              </div>
            </div>
          </div>

          {/* Weekly Numbers */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-neutral-400 mb-3">Rep Weekly Numbers</h3>
            <WeeklyNumbersWidget />
          </div>

          {/* Quick Actions */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-neutral-400 mb-3">Quick Actions</h3>
            <div className="grid grid-cols-4 gap-3">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  onClick={action.action}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl transition-all active:scale-95 ${action.color}`}
                >
                  <action.icon size={24} />
                  <span className="text-xs mt-2 font-medium">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Two column layout for leads and activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Hot Leads */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-neutral-400">Priority Leads</h3>
                <Link href="/portal/sales/leads" className="text-xs text-brand-green hover:text-brand-green/80 flex items-center gap-1">
                  View All <ChevronRight size={14} />
                </Link>
              </div>
              <div className="space-y-3">
                {leads.filter(l => l.priority === 'urgent' || l.priority === 'high').slice(0, 3).map((lead) => (
                  <div
                    key={lead.id}
                    className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-white">{lead.customerName}</h4>
                          <StatusBadge status={lead.status} />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-neutral-400">
                          <MapPin size={14} />
                          <span>{lead.address}, {lead.city}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                          <span className={`text-xs font-medium ${priorityConfig[lead.priority].color}`}>
                            {priorityConfig[lead.priority].label} Priority
                          </span>
                          <span className="text-xs text-neutral-500">
                            Est. ${lead.estimatedValue.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => handleCall(lead)}
                        className="flex flex-col items-center justify-center p-3 bg-green-500/20 hover:bg-green-500/30 rounded-xl transition-colors active:scale-95"
                      >
                        <Phone size={20} className="text-green-400" />
                        <span className="text-xs text-green-400 mt-1">Call</span>
                      </button>
                      <button
                        onClick={() => handleText(lead)}
                        className="flex flex-col items-center justify-center p-3 bg-brand-green/20 hover:bg-brand-green/30 rounded-xl transition-colors active:scale-95"
                      >
                        <MessageSquare size={20} className="text-blue-400" />
                        <span className="text-xs text-blue-400 mt-1">Text</span>
                      </button>
                      <button
                        onClick={() => handleSendPortalLink(lead)}
                        className="flex flex-col items-center justify-center p-3 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl transition-colors active:scale-95"
                      >
                        <Send size={20} className="text-purple-400" />
                        <span className="text-xs text-purple-400 mt-1">Portal</span>
                      </button>
                      <Link
                        href={`/portal/sales/customers/${lead.id}`}
                        className="flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors active:scale-95"
                      >
                        <ArrowRight size={20} className="text-neutral-400" />
                        <span className="text-xs text-neutral-400 mt-1">Details</span>
                      </Link>
                    </div>
                  </div>
                ))}
                {leads.filter(l => l.priority === 'urgent' || l.priority === 'high').length === 0 && (
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 text-center">
                    <Users size={32} className="text-neutral-600 mx-auto mb-2" />
                    <p className="text-neutral-500 text-sm">No high priority leads right now</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity Feed */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-neutral-400">Recent Activity</h3>
                <Link href="/portal/sales/performance" className="text-xs text-brand-green hover:text-brand-green/80 flex items-center gap-1">
                  View All <ChevronRight size={14} />
                </Link>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl divide-y divide-white/5">
                {recentActivity.length > 0 ? (
                  recentActivity.slice(0, 6).map((activity) => {
                    const iconConfig = activityIcons[activity.type] || activityIcons.lead_assigned;
                    const IconComponent = iconConfig.icon;
                    return (
                      <div key={activity.id} className="p-3 flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconConfig.color}`}>
                          <IconComponent size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white">{activity.description}</p>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            {new Date(activity.timestamp).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric'
                            })}
                          </p>
                        </div>
                        {activity.amount && (
                          <span className="text-sm font-medium text-green-400 shrink-0">
                            ${activity.amount.toLocaleString()}
                          </span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center">
                    <Activity size={32} className="text-neutral-600 mx-auto mb-2" />
                    <p className="text-neutral-500 text-sm">No recent activity</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Today's Schedule */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-neutral-400">Today's Inspections</h3>
              <button className="text-xs text-brand-green hover:text-brand-green/80 flex items-center gap-1">
                <Plus size={14} /> Add
              </button>
            </div>
            {leads.filter(l => l.scheduledDate).length > 0 ? (
              <div className="space-y-3">
                {leads.filter(l => l.scheduledDate).slice(0, 2).map((lead) => (
                  <div
                    key={lead.id}
                    className="bg-white/[0.02] border border-cyan-500/20 rounded-2xl p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Clock size={14} className="text-cyan-400" />
                          <span className="text-sm font-medium text-cyan-400">
                            {new Date(lead.scheduledDate!).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                        <h4 className="font-medium text-white">{lead.customerName}</h4>
                        <p className="text-sm text-neutral-400">{lead.address}, {lead.city}</p>
                      </div>
                      <button
                        onClick={() => {
                          const address = `${lead.address}, ${lead.city}, ${lead.state} ${lead.zip}`;
                          window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
                        }}
                        className="w-12 h-12 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-xl flex items-center justify-center transition-colors"
                      >
                        <MapPin size={20} className="text-cyan-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 text-center">
                <Calendar size={32} className="text-neutral-600 mx-auto mb-2" />
                <p className="text-neutral-500 text-sm">No inspections scheduled for today</p>
                <button className="mt-3 text-sm text-brand-green hover:text-brand-green/80">
                  Schedule an inspection
                </button>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/portal/sales/leads"
              className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 hover:bg-white/[0.04] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-green/20 rounded-xl flex items-center justify-center">
                  <Users size={20} className="text-blue-400" />
                </div>
                <div>
                  <h4 className="font-medium text-white group-hover:text-brand-green transition-colors">All Leads</h4>
                  <p className="text-xs text-neutral-500">{stats.totalLeads} active</p>
                </div>
              </div>
            </Link>
            <Link
              href="/portal/sales/customers"
              className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 hover:bg-white/[0.04] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <Briefcase size={20} className="text-purple-400" />
                </div>
                <div>
                  <h4 className="font-medium text-white group-hover:text-brand-green transition-colors">My Customers</h4>
                  <p className="text-xs text-neutral-500">JobNimbus CRM</p>
                </div>
              </div>
            </Link>
            <Link
              href="/portal/sales/performance"
              className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 hover:bg-white/[0.04] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <BarChart3 size={20} className="text-green-400" />
                </div>
                <div>
                  <h4 className="font-medium text-white group-hover:text-brand-green transition-colors">Performance</h4>
                  <p className="text-xs text-neutral-500">Stats & Goals</p>
                </div>
              </div>
            </Link>
            <Link
              href="/portal/sales/settings"
              className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 hover:bg-white/[0.04] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                  <DollarSign size={20} className="text-yellow-400" />
                </div>
                <div>
                  <h4 className="font-medium text-white group-hover:text-brand-green transition-colors">Settings</h4>
                  <p className="text-xs text-neutral-500">Lead Preferences</p>
                </div>
              </div>
            </Link>
          </div>
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t border-white/5 px-4 py-2 z-30 sm:hidden">
          <div className="flex items-center justify-around">
            <Link href="/portal/sales" className="flex flex-col items-center p-2 text-brand-green">
              <Home size={20} />
              <span className="text-xs mt-1">Home</span>
            </Link>
            <Link href="/portal/sales/leads" className="flex flex-col items-center p-2 text-neutral-400 hover:text-white">
              <Users size={20} />
              <span className="text-xs mt-1">Leads</span>
            </Link>
            <button
              onClick={() => setShowQuickCall(true)}
              className="flex flex-col items-center p-3 -mt-4 bg-brand-green rounded-full text-black"
            >
              <Phone size={24} />
            </button>
            <Link href="/portal/sales/performance" className="flex flex-col items-center p-2 text-neutral-400 hover:text-white">
              <BarChart3 size={20} />
              <span className="text-xs mt-1">Stats</span>
            </Link>
            <Link href="/portal/dashboard" className="flex flex-col items-center p-2 text-neutral-400 hover:text-white">
              <Building size={20} />
              <span className="text-xs mt-1">Portal</span>
            </Link>
          </div>
        </nav>
      </div>

      {/* Quick Call Modal */}
      {showQuickCall && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <h3 className="text-lg font-semibold text-white">Quick Call</h3>
              <button
                onClick={() => setShowQuickCall(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center"
              >
                <X size={18} className="text-neutral-400" />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {leads.slice(0, 5).map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => {
                    handleCall(lead);
                    setShowQuickCall(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 bg-white/[0.02] hover:bg-white/[0.05] rounded-xl text-left transition-colors"
                >
                  <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                    <Phone size={18} className="text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">{lead.customerName}</p>
                    <p className="text-sm text-neutral-400">{lead.customerPhone}</p>
                  </div>
                  <StatusBadge status={lead.status} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
