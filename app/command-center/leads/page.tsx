'use client';

/**
 * RCRS Command Center - Lead Management Dashboard
 *
 * Full admin lead management with real API data:
 * - KPI stats (total, conversion, response time, today's leads)
 * - Lead distribution list with rep assignments
 * - Response time leaderboard
 * - Unassigned leads queue
 * - Quick assign and distribution controls
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { canAdminLeadDistro, getSalesReps } from '@/lib/team-roles';
import {
  Users, TrendingUp, Clock, Timer, Target, Zap, BarChart3,
  AlertTriangle, RefreshCw, Loader2, Search, Filter, ChevronDown,
  ChevronRight, Phone, Mail, MapPin, User, ArrowRight, Award,
  PieChart, Activity, ShieldAlert, Plus, Settings, ArrowLeft, X,
  CheckCircle, UserPlus
} from 'lucide-react';

// =============================================================================
// Types matching API responses
// =============================================================================

interface KPIMetrics {
  totalLeads: number;
  totalLeads30d: number;
  conversionRate: number;
  avgResponseMinutes: number;
  activeTimers: number;
  leadsToday: number;
}

interface RepMetrics {
  repSlug: string;
  repName: string;
  totalLeads: number;
  totalLeads30d: number;
  respondedLeads: number;
  missedLeads: number;
  closeRate: number;
  avgResponseMinutes: number | null;
  isReceivingLeads: boolean;
  adminPaused: boolean;
  autoResumeAt: string | null;
}

interface LeadRecord {
  leadId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  salesRepName: string;
  salesRepSlug: string;
  source: string;
  serviceType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface DistributionEntry {
  logId: string;
  customerName: string;
  address: string;
  assignedRep: string;
  assignedRepName: string;
  method: string;
  timestamp: string;
  scores: Record<string, number>;
}

// =============================================================================
// Status colors
// =============================================================================

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-brand-green/20 text-blue-400 ring-blue-500/30',
  contacted: 'bg-purple-500/20 text-purple-400 ring-purple-500/30',
  inspection_scheduled: 'bg-cyan-500/20 text-cyan-400 ring-cyan-500/30',
  estimate_sent: 'bg-yellow-500/20 text-yellow-400 ring-yellow-500/30',
  closed_won: 'bg-green-500/20 text-green-400 ring-green-500/30',
  closed_lost: 'bg-red-500/20 text-red-400 ring-red-500/30',
};

function StatusBadge({ status }: { status: string }) {
  const colorClass = STATUS_COLORS[status] || 'bg-white/10 text-neutral-400 ring-white/10';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${colorClass}`}>
      {(status || 'unknown').replace(/_/g, ' ')}
    </span>
  );
}

// =============================================================================
// Component
// =============================================================================

export default function LeadManagementPage() {
  const { user, isLoading: authLoading } = useAuth();

  // Data state
  const [kpis, setKpis] = useState<KPIMetrics | null>(null);
  const [repMetrics, setRepMetrics] = useState<RepMetrics[]>([]);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [distributions, setDistributions] = useState<DistributionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [repFilter, setRepFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [activeSection, setActiveSection] = useState<'overview' | 'leads' | 'reps' | 'history'>('overview');
  const [assigningLeadId, setAssigningLeadId] = useState<string | null>(null);
  const [selectedRepForAssign, setSelectedRepForAssign] = useState('');

  // Available reps for assignment
  const salesReps = getSalesReps();

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    try {
      const [metricsRes, leadsRes] = await Promise.all([
        fetch('/api/leads/metrics'),
        fetch('/api/leads?includeStats=true'),
      ]);

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        if (metricsData.success && metricsData.data) {
          setKpis(metricsData.data.kpis || null);
          setRepMetrics(metricsData.data.reps || []);
          setDistributions(metricsData.data.recentDistributions || []);
        }
      }

      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        if (leadsData.success) {
          setLeads(leadsData.data || []);
        }
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
      const interval = setInterval(fetchData, 60000);
      return () => clearInterval(interval);
    }
  }, [authLoading, user, fetchData]);

  // ---------------------------------------------------------------------------
  // Assign lead handler
  // ---------------------------------------------------------------------------

  const handleAssignLead = async (leadId: string) => {
    if (!selectedRepForAssign) return;
    try {
      const lead = leads.find(l => l.leadId === leadId);
      if (!lead) return;

      const res = await fetch('/api/leads/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          address: lead.customerAddress,
          customerName: lead.customerName,
          source: lead.source,
          overrideRepSlug: selectedRepForAssign,
        }),
      });

      if (res.ok) {
        // Refresh data
        await fetchData();
      }
    } catch {
      // Silently fail
    } finally {
      setAssigningLeadId(null);
      setSelectedRepForAssign('');
    }
  };

  // ---------------------------------------------------------------------------
  // Filtered data
  // ---------------------------------------------------------------------------

  const filteredLeads = leads.filter(lead => {
    if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
    if (repFilter !== 'all' && lead.salesRepSlug !== repFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (lead.customerName || '').toLowerCase().includes(term) ||
        (lead.customerEmail || '').toLowerCase().includes(term) ||
        (lead.customerPhone || '').includes(term) ||
        (lead.customerAddress || '').toLowerCase().includes(term)
      );
    }
    return true;
  });

  const unassignedLeads = leads.filter(l => !l.salesRepSlug && l.status === 'new');

  // Sort reps by response time for leaderboard
  const sortedRepsByResponse = [...repMetrics]
    .filter(r => r.avgResponseMinutes !== null)
    .sort((a, b) => (a.avgResponseMinutes || 999) - (b.avgResponseMinutes || 999));

  // Lead stats
  const leadsBySource: Record<string, number> = {};
  const leadsByStatus: Record<string, number> = {};
  const leadsByRep: Record<string, number> = {};
  leads.forEach(lead => {
    const src = lead.source || 'unknown';
    leadsBySource[src] = (leadsBySource[src] || 0) + 1;
    const st = lead.status || 'unknown';
    leadsByStatus[st] = (leadsByStatus[st] || 0) + 1;
    const rep = lead.salesRepName || 'Unassigned';
    leadsByRep[rep] = (leadsByRep[rep] || 0) + 1;
  });

  // ---------------------------------------------------------------------------
  // Auth gate
  // ---------------------------------------------------------------------------

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center p-6">
        <div className="text-center">
          <ShieldAlert size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Authentication Required</h2>
          <p className="text-neutral-400 mb-6">You must be logged in to access Lead Management.</p>
          <Link href="/portal" className="px-6 py-3 bg-brand-green text-black font-semibold rounded-xl hover:bg-brand-green/90 transition-colors">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)',
          backgroundSize: '50px 50px',
        }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link
                  href="/command-center"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={20} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Lead Management</h1>
                  <p className="text-xs text-neutral-400">
                    {leads.length} total leads &middot; {kpis?.leadsToday || 0} today
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setLoading(true); fetchData(); }}
                  disabled={loading}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <RefreshCw size={16} className={`text-neutral-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <Link
                  href="/portal/leads/new"
                  className="flex items-center gap-2 px-4 py-2.5 bg-brand-green text-black font-semibold text-sm rounded-xl hover:bg-brand-green/90 transition-colors"
                >
                  <Plus size={16} />
                  New Lead
                </Link>
                {canAdminLeadDistro(user.role) && (
                  <Link
                    href="/portal/admin/lead-distro"
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/5 text-neutral-300 text-sm rounded-xl hover:bg-white/10 transition-colors"
                  >
                    <Settings size={16} />
                    Config
                  </Link>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Error Banner */}
        {error && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
            <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              <AlertTriangle size={16} />
              {error}
              <button onClick={() => setError(null)} className="ml-auto text-red-400/50 hover:text-red-400">
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

          {/* KPI Cards */}
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 animate-pulse">
                  <div className="h-8 w-16 bg-white/5 rounded mb-2" />
                  <div className="h-4 w-24 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-1">
                  <Users size={20} className="text-blue-400" />
                  <span className="text-xs text-neutral-500">30d: {kpis?.totalLeads30d || 0}</span>
                </div>
                <div className="text-3xl font-bold text-white">{kpis?.totalLeads || leads.length}</div>
                <div className="text-sm text-neutral-500 mt-1">Total Leads</div>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-1">
                  <TrendingUp size={20} className="text-brand-green" />
                  <span className="text-xs text-neutral-500">today: {kpis?.leadsToday || 0}</span>
                </div>
                <div className="text-3xl font-bold text-white">{(kpis?.conversionRate || 0).toFixed(1)}%</div>
                <div className="text-sm text-neutral-500 mt-1">Conversion Rate</div>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-1">
                  <Clock size={20} className="text-amber-400" />
                </div>
                <div className="text-3xl font-bold text-white">{(kpis?.avgResponseMinutes || 0).toFixed(0)}m</div>
                <div className="text-sm text-neutral-500 mt-1">Avg Response Time</div>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-1">
                  <Timer size={20} className="text-red-400" />
                </div>
                <div className="text-3xl font-bold text-white">{kpis?.activeTimers || 0}</div>
                <div className="text-sm text-neutral-500 mt-1">Active Timers</div>
              </div>
            </div>
          )}

          {/* Section Navigation */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { key: 'overview' as const, label: 'Overview', icon: PieChart },
              { key: 'leads' as const, label: `Leads (${leads.length})`, icon: Users },
              { key: 'reps' as const, label: 'Rep Performance', icon: Award },
              { key: 'history' as const, label: 'Distribution History', icon: Activity },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  activeSection === key
                    ? 'bg-brand-green/20 text-brand-green ring-1 ring-brand-green/30'
                    : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {/* ================================================================== */}
          {/* OVERVIEW SECTION */}
          {/* ================================================================== */}
          {activeSection === 'overview' && !loading && (
            <div className="space-y-6">
              {/* Two-column: Source breakdown + Status breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Leads by Source */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Target size={18} className="text-brand-green" />
                    Leads by Source
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(leadsBySource)
                      .sort((a, b) => b[1] - a[1])
                      .map(([source, count]) => (
                        <div key={source} className="flex items-center justify-between">
                          <span className="text-sm text-neutral-300 capitalize">{source.replace(/_/g, ' ')}</span>
                          <div className="flex items-center gap-3">
                            <div className="w-32 h-2 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-brand-green/50 rounded-full"
                                style={{ width: `${leads.length > 0 ? (count / leads.length) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-white w-8 text-right">{count}</span>
                          </div>
                        </div>
                      ))}
                    {Object.keys(leadsBySource).length === 0 && (
                      <p className="text-sm text-neutral-500 text-center py-4">No lead data available</p>
                    )}
                  </div>
                </div>

                {/* Leads by Status */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <BarChart3 size={18} className="text-blue-400" />
                    Leads by Status
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(leadsByStatus)
                      .sort((a, b) => b[1] - a[1])
                      .map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <StatusBadge status={status} />
                          <span className="text-sm font-medium text-white">{count}</span>
                        </div>
                      ))}
                    {Object.keys(leadsByStatus).length === 0 && (
                      <p className="text-sm text-neutral-500 text-center py-4">No lead data available</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Leads by Rep */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Users size={18} className="text-purple-400" />
                  Lead Distribution by Rep
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(leadsByRep)
                    .sort((a, b) => b[1] - a[1])
                    .map(([repName, count]) => (
                      <div key={repName} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl border border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <User size={14} className="text-purple-400" />
                          </div>
                          <span className="text-sm text-neutral-300">{repName}</span>
                        </div>
                        <span className="text-lg font-bold text-white">{count}</span>
                      </div>
                    ))}
                  {Object.keys(leadsByRep).length === 0 && (
                    <p className="text-sm text-neutral-500 text-center py-4 col-span-full">No lead data available</p>
                  )}
                </div>
              </div>

              {/* Unassigned leads queue */}
              {unassignedLeads.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-amber-400 mb-4 flex items-center gap-2">
                    <AlertTriangle size={18} />
                    Unassigned Leads ({unassignedLeads.length})
                  </h3>
                  <div className="space-y-3">
                    {unassignedLeads.slice(0, 10).map(lead => (
                      <div key={lead.leadId} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl border border-white/5">
                        <div>
                          <p className="text-sm font-medium text-white">{lead.customerName}</p>
                          <p className="text-xs text-neutral-500">{lead.customerAddress} &middot; {lead.source}</p>
                        </div>
                        {assigningLeadId === lead.leadId ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={selectedRepForAssign}
                              onChange={(e) => setSelectedRepForAssign(e.target.value)}
                              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-green/50"
                            >
                              <option value="">Select rep...</option>
                              {salesReps.map(rep => (
                                <option key={rep.slug} value={rep.slug}>{rep.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleAssignLead(lead.leadId)}
                              disabled={!selectedRepForAssign}
                              className="px-3 py-1.5 bg-brand-green text-black text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-green/90 transition-colors"
                            >
                              Assign
                            </button>
                            <button
                              onClick={() => { setAssigningLeadId(null); setSelectedRepForAssign(''); }}
                              className="p-1.5 text-neutral-400 hover:text-white"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAssigningLeadId(lead.leadId)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm font-medium rounded-lg transition-colors"
                          >
                            <UserPlus size={14} />
                            Assign
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Response Time Leaderboard */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Award size={18} className="text-amber-400" />
                  Response Time Leaderboard
                </h3>
                {sortedRepsByResponse.length > 0 ? (
                  <div className="space-y-2">
                    {sortedRepsByResponse.map((rep, idx) => (
                      <div
                        key={rep.repSlug}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                          idx === 0
                            ? 'bg-brand-green/5 border-brand-green/20'
                            : idx === 1
                            ? 'bg-amber-500/5 border-amber-500/10'
                            : idx === 2
                            ? 'bg-orange-500/5 border-orange-500/10'
                            : 'bg-white/[0.01] border-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                            idx === 0 ? 'bg-brand-green/20 text-brand-green' :
                            idx === 1 ? 'bg-amber-500/20 text-amber-400' :
                            idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                            'bg-white/5 text-neutral-400'
                          }`}>
                            #{idx + 1}
                          </div>
                          <div>
                            <span className="text-sm font-medium text-white">{rep.repName}</span>
                            <div className="flex items-center gap-3 text-xs text-neutral-500">
                              <span>{rep.totalLeads} leads</span>
                              <span>{rep.respondedLeads} responded</span>
                              <span className={rep.isReceivingLeads ? 'text-green-400' : 'text-red-400'}>
                                {rep.isReceivingLeads ? 'Active' : 'Paused'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold tabular-nums ${
                            idx === 0 ? 'text-brand-green' : 'text-neutral-300'
                          }`}>
                            {rep.avgResponseMinutes?.toFixed(0) || '---'}m
                          </div>
                          <div className="text-xs text-neutral-500">avg response</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500 text-center py-8">No response time data available yet</p>
                )}
              </div>
            </div>
          )}

          {/* ================================================================== */}
          {/* LEADS SECTION */}
          {/* ================================================================== */}
          {activeSection === 'leads' && !loading && (
            <div className="space-y-4">
              {/* Search & Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Search leads by name, phone, email, address..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white/[0.02] border border-white/5 rounded-xl pl-11 pr-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/30 text-sm"
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    showFilters ? 'bg-brand-green/20 text-brand-green' : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                  }`}
                >
                  <Filter size={16} />
                  Filters
                </button>
              </div>

              {/* Filter Panel */}
              {showFilters && (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-neutral-400 mb-2 block">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-green/50"
                    >
                      <option value="all">All Statuses</option>
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="inspection_scheduled">Inspection Scheduled</option>
                      <option value="estimate_sent">Estimate Sent</option>
                      <option value="closed_won">Won</option>
                      <option value="closed_lost">Lost</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400 mb-2 block">Assigned Rep</label>
                    <select
                      value={repFilter}
                      onChange={(e) => setRepFilter(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-green/50"
                    >
                      <option value="all">All Reps</option>
                      {salesReps.map(rep => (
                        <option key={rep.slug} value={rep.slug}>{rep.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Leads List */}
              <div className="space-y-3">
                {filteredLeads.length > 0 ? filteredLeads.map(lead => (
                  <div
                    key={lead.leadId}
                    className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="font-semibold text-white">{lead.customerName || 'Unknown'}</h4>
                          <StatusBadge status={lead.status} />
                          {lead.source && (
                            <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-neutral-400">{lead.source.replace(/_/g, ' ')}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-neutral-400">
                          <MapPin size={12} />
                          <span>{lead.customerAddress || 'No address'}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-neutral-500">
                          {lead.salesRepName && (
                            <span className="flex items-center gap-1"><User size={10} />{lead.salesRepName}</span>
                          )}
                          {lead.serviceType && <span>{lead.serviceType}</span>}
                          <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {lead.customerPhone && (
                          <a
                            href={`tel:${lead.customerPhone}`}
                            className="w-8 h-8 rounded-lg bg-green-500/20 hover:bg-green-500/30 flex items-center justify-center transition-colors"
                          >
                            <Phone size={14} className="text-green-400" />
                          </a>
                        )}
                        {lead.customerEmail && (
                          <a
                            href={`mailto:${lead.customerEmail}`}
                            className="w-8 h-8 rounded-lg bg-brand-green/20 hover:bg-brand-green/30 flex items-center justify-center transition-colors"
                          >
                            <Mail size={14} className="text-blue-400" />
                          </a>
                        )}
                        {!lead.salesRepSlug && (
                          <button
                            onClick={() => setAssigningLeadId(lead.leadId)}
                            className="w-8 h-8 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 flex items-center justify-center transition-colors"
                            title="Assign to rep"
                          >
                            <UserPlus size={14} className="text-amber-400" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline assign */}
                    {assigningLeadId === lead.leadId && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                        <select
                          value={selectedRepForAssign}
                          onChange={(e) => setSelectedRepForAssign(e.target.value)}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-green/50"
                        >
                          <option value="">Select rep to assign...</option>
                          {salesReps.map(rep => (
                            <option key={rep.slug} value={rep.slug}>{rep.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAssignLead(lead.leadId)}
                          disabled={!selectedRepForAssign}
                          className="px-4 py-1.5 bg-brand-green text-black text-sm font-medium rounded-lg disabled:opacity-50 hover:bg-brand-green/90 transition-colors"
                        >
                          Assign
                        </button>
                        <button
                          onClick={() => { setAssigningLeadId(null); setSelectedRepForAssign(''); }}
                          className="p-1.5 text-neutral-400 hover:text-white"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )) : (
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center">
                    <Users size={48} className="text-neutral-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No leads found</h3>
                    <p className="text-sm text-neutral-500">
                      {searchTerm || statusFilter !== 'all' || repFilter !== 'all'
                        ? 'Try adjusting your filters or search term'
                        : 'Create a new lead to get started'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================== */}
          {/* REP PERFORMANCE SECTION */}
          {/* ================================================================== */}
          {activeSection === 'reps' && !loading && (
            <div className="space-y-4">
              {repMetrics.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider pb-3 pr-4">Rep</th>
                        <th className="text-center text-xs font-medium text-neutral-500 uppercase tracking-wider pb-3 pr-4">Total</th>
                        <th className="text-center text-xs font-medium text-neutral-500 uppercase tracking-wider pb-3 pr-4">30d</th>
                        <th className="text-center text-xs font-medium text-neutral-500 uppercase tracking-wider pb-3 pr-4">Responded</th>
                        <th className="text-center text-xs font-medium text-neutral-500 uppercase tracking-wider pb-3 pr-4">Missed</th>
                        <th className="text-center text-xs font-medium text-neutral-500 uppercase tracking-wider pb-3 pr-4">Avg Response</th>
                        <th className="text-center text-xs font-medium text-neutral-500 uppercase tracking-wider pb-3 pr-4">Close Rate</th>
                        <th className="text-center text-xs font-medium text-neutral-500 uppercase tracking-wider pb-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {repMetrics.map(rep => (
                        <tr key={rep.repSlug} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 pr-4">
                            <span className="text-sm font-medium text-white">{rep.repName}</span>
                          </td>
                          <td className="py-3 pr-4 text-center">
                            <span className="text-sm text-neutral-300 tabular-nums">{rep.totalLeads}</span>
                          </td>
                          <td className="py-3 pr-4 text-center">
                            <span className="text-sm text-neutral-300 tabular-nums">{rep.totalLeads30d}</span>
                          </td>
                          <td className="py-3 pr-4 text-center">
                            <span className="text-sm text-green-400 tabular-nums">{rep.respondedLeads}</span>
                          </td>
                          <td className="py-3 pr-4 text-center">
                            <span className="text-sm text-red-400 tabular-nums">{rep.missedLeads}</span>
                          </td>
                          <td className="py-3 pr-4 text-center">
                            <span className={`text-sm tabular-nums ${
                              rep.avgResponseMinutes !== null && rep.avgResponseMinutes <= 10
                                ? 'text-green-400'
                                : rep.avgResponseMinutes !== null && rep.avgResponseMinutes <= 30
                                ? 'text-yellow-400'
                                : 'text-neutral-400'
                            }`}>
                              {rep.avgResponseMinutes !== null ? `${rep.avgResponseMinutes.toFixed(0)}m` : '---'}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-center">
                            <span className="text-sm text-neutral-300 tabular-nums">{rep.closeRate.toFixed(1)}%</span>
                          </td>
                          <td className="py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              rep.isReceivingLeads
                                ? 'bg-green-500/20 text-green-400'
                                : rep.adminPaused
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {rep.isReceivingLeads ? 'Active' : rep.adminPaused ? 'Admin Paused' : 'Paused'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center">
                  <Award size={48} className="text-neutral-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No rep metrics yet</h3>
                  <p className="text-sm text-neutral-500">Metrics will appear as leads are distributed and responded to</p>
                </div>
              )}
            </div>
          )}

          {/* ================================================================== */}
          {/* DISTRIBUTION HISTORY SECTION */}
          {/* ================================================================== */}
          {activeSection === 'history' && !loading && (
            <div className="space-y-3">
              {distributions.length > 0 ? distributions.map(entry => (
                <div
                  key={entry.logId}
                  className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium text-white">{entry.customerName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-lg ${
                          entry.method === 'algorithm'
                            ? 'bg-brand-green/10 text-brand-green'
                            : entry.method === 'round_robin'
                            ? 'bg-brand-green/10 text-blue-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {entry.method === 'algorithm' ? 'Auto' : entry.method === 'round_robin' ? 'Round Robin' : 'Manual'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-neutral-500 flex-wrap">
                        <span className="flex items-center gap-1"><MapPin size={10} />{entry.address}</span>
                        <span>Assigned to <strong className="text-neutral-300">{entry.assignedRepName}</strong></span>
                        <span>{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ''}</span>
                      </div>
                    </div>
                    {entry.scores && Object.keys(entry.scores).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 sm:mt-0">
                        {Object.entries(entry.scores).slice(0, 4).map(([rep, score]) => (
                          <span
                            key={rep}
                            className={`text-xs px-2 py-1 rounded-lg tabular-nums ${
                              rep === entry.assignedRep
                                ? 'bg-brand-green/10 text-brand-green'
                                : 'bg-white/5 text-neutral-400'
                            }`}
                          >
                            {rep}: {typeof score === 'number' ? score.toFixed(1) : score}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )) : (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center">
                  <Activity size={48} className="text-neutral-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No distribution history</h3>
                  <p className="text-sm text-neutral-500">Logs will appear here as leads are assigned to reps</p>
                </div>
              )}
            </div>
          )}

          {/* Loading skeleton for sections */}
          {loading && activeSection !== 'overview' && (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 animate-pulse">
                  <div className="h-5 w-48 bg-white/5 rounded mb-2" />
                  <div className="h-4 w-32 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
