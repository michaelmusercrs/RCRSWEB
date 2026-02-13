'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Phone, MessageSquare, Calendar, FileText, MapPin, Clock, User,
  ChevronRight, Loader2, LogOut, Home, Search, Filter, Plus,
  TrendingUp, DollarSign, Users, Target, Trophy, Flame, Bell,
  CheckCircle, AlertCircle, ArrowRight, Camera, BarChart3,
  RefreshCw, Send, Star, X, Mail, Building, Briefcase, ArrowLeft,
  SortAsc, SortDesc, Grid, List, ChevronDown, Copy, History,
  Timer
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { TeamRole } from '@/lib/team-roles';

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
  accessToken?: string;
}

type ActiveTab = 'active' | 'history';

type SortField = 'createdAt' | 'priority' | 'estimatedValue' | 'customerName' | 'status';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'list' | 'grid';

// =============================================================================
// Lead Data - Loaded from CRM/JobNimbus integration
// =============================================================================

// Leads are loaded from the CRM system via API
// Empty array displayed when no leads are assigned to the current user
const initialLeads: Lead[] = [];

// =============================================================================
// Status Configuration
// =============================================================================

const statusConfig = {
  new: { label: 'New', color: 'bg-blue-500/20 text-blue-400 ring-blue-500/30', order: 1 },
  contacted: { label: 'Contacted', color: 'bg-purple-500/20 text-purple-400 ring-purple-500/30', order: 2 },
  scheduled: { label: 'Scheduled', color: 'bg-cyan-500/20 text-cyan-400 ring-cyan-500/30', order: 3 },
  inspected: { label: 'Inspected', color: 'bg-orange-500/20 text-orange-400 ring-orange-500/30', order: 4 },
  quoted: { label: 'Quoted', color: 'bg-yellow-500/20 text-yellow-400 ring-yellow-500/30', order: 5 },
  closed_won: { label: 'Won', color: 'bg-green-500/20 text-green-400 ring-green-500/30', order: 6 },
  closed_lost: { label: 'Lost', color: 'bg-red-500/20 text-red-400 ring-red-500/30', order: 7 },
};

const priorityConfig = {
  low: { label: 'Low', color: 'text-neutral-400', bgColor: 'bg-neutral-500/20', order: 4 },
  medium: { label: 'Medium', color: 'text-blue-400', bgColor: 'bg-blue-500/20', order: 3 },
  high: { label: 'High', color: 'text-orange-400', bgColor: 'bg-orange-500/20', order: 2 },
  urgent: { label: 'Urgent', color: 'text-red-400', bgColor: 'bg-red-500/20', order: 1 },
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
// Response Timer Component
// =============================================================================

function ResponseTimer({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState('');
  const [colorClass, setColorClass] = useState('text-green-400');

  useEffect(() => {
    function update() {
      const diffMs = Date.now() - new Date(createdAt).getTime();
      const totalMinutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      if (totalMinutes < 10) {
        setColorClass('text-green-400');
      } else if (totalMinutes < 30) {
        setColorClass('text-yellow-400');
      } else {
        setColorClass('text-red-400');
      }

      if (hours > 0) {
        setElapsed(`${hours}h ${minutes}m`);
      } else {
        setElapsed(`${minutes}m`);
      }
    }

    update();
    const interval = setInterval(update, 30000); // update every 30s
    return () => clearInterval(interval);
  }, [createdAt]);

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${colorClass}`}>
      <Timer size={12} />
      {elapsed}
    </span>
  );
}

// =============================================================================
// Leads Management Page
// =============================================================================

export default function LeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, logout } = useAuth();

  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Lead['status'] | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<Lead['priority'] | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showUpdateStatus, setShowUpdateStatus] = useState(false);

  // New state for API integration
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('active');
  const [copiedLeadId, setCopiedLeadId] = useState<string | null>(null);
  const [contactingLeadId, setContactingLeadId] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/portal');
    }
  }, [user, isLoading, router]);

  // Fetch leads from API
  useEffect(() => {
    if (!user?.userId) return;

    async function fetchLeads() {
      setFetchLoading(true);
      setFetchError(null);
      try {
        const res = await fetch(`/api/leads?salesRep=${encodeURIComponent(user!.userId)}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch leads (${res.status})`);
        }
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          // Map API lead records to local Lead shape
          const mapped: Lead[] = json.data.map((r: any) => ({
            id: r.leadId || r.id,
            customerName: r.customerName || r.name || '',
            customerPhone: r.customerPhone || r.phone || '',
            customerEmail: r.customerEmail || r.email || '',
            address: r.customerAddress || r.address || '',
            city: r.city || '',
            state: r.state || '',
            zip: r.zip || '',
            status: r.status || 'new',
            source: r.source || '',
            estimatedValue: r.estimatedValue || 0,
            notes: r.message || r.notes || '',
            createdAt: r.createdAt || new Date().toISOString(),
            lastContact: r.lastContact || r.updatedAt,
            scheduledDate: r.scheduledDate,
            assignedTo: r.salesRepSlug || r.assignedTo || '',
            priority: r.priority || r.urgency || 'medium',
            accessToken: r.accessToken,
          }));
          setLeads(mapped);
        } else {
          // API returned success: false or unexpected shape
          setLeads([]);
        }
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Failed to load leads');
      } finally {
        setFetchLoading(false);
      }
    }

    fetchLeads();
  }, [user?.userId]);

  // Filter and sort leads
  const filteredLeads = useMemo(() => {
    let result = [...leads];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(lead =>
        lead.customerName.toLowerCase().includes(term) ||
        lead.address.toLowerCase().includes(term) ||
        lead.city.toLowerCase().includes(term) ||
        lead.customerPhone.includes(term) ||
        lead.customerEmail.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(lead => lead.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      result = result.filter(lead => lead.priority === priorityFilter);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'priority':
          comparison = priorityConfig[a.priority].order - priorityConfig[b.priority].order;
          break;
        case 'estimatedValue':
          comparison = a.estimatedValue - b.estimatedValue;
          break;
        case 'customerName':
          comparison = a.customerName.localeCompare(b.customerName);
          break;
        case 'status':
          comparison = statusConfig[a.status].order - statusConfig[b.status].order;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [leads, searchTerm, statusFilter, priorityFilter, sortField, sortOrder]);

  // Handle status update - calls API and updates local state
  const handleStatusUpdate = async (leadId: string, newStatus: Lead['status']) => {
    try {
      const res = await fetch('/api/leads/contact-made', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, repSlug: user?.userId, status: newStatus }),
      });
      // Update local state regardless of API response for responsiveness
      setLeads(prev => prev.map(lead =>
        lead.id === leadId ? { ...lead, status: newStatus, lastContact: new Date().toISOString() } : lead
      ));
    } catch {
      // Still update locally for offline-first behavior
      setLeads(prev => prev.map(lead =>
        lead.id === leadId ? { ...lead, status: newStatus, lastContact: new Date().toISOString() } : lead
      ));
    }
    setShowUpdateStatus(false);
    setSelectedLead(null);
  };

  // Handle calling a lead
  const handleCall = (lead: Lead) => {
    window.location.href = `tel:${lead.customerPhone}`;
  };

  // Handle texting a lead
  const handleText = (lead: Lead) => {
    window.location.href = `sms:${lead.customerPhone}`;
  };

  // Handle emailing a lead
  const handleEmail = (lead: Lead) => {
    const subject = encodeURIComponent('River City Roofing Solutions - Follow Up');
    const body = encodeURIComponent(`Hi ${lead.customerName.split(' ')[0]},\n\nThank you for your interest in River City Roofing Solutions. I wanted to follow up regarding your inquiry.\n\nPlease let me know a good time to discuss your roofing needs.\n\nBest regards,\n${user?.name || 'Your Sales Rep'}\nRiver City Roofing Solutions\n(256) 274-8530`);
    window.location.href = `mailto:${lead.customerEmail}?subject=${subject}&body=${body}`;
  };

  // Handle scheduling - opens Google Calendar
  const handleSchedule = (lead: Lead) => {
    const title = encodeURIComponent(`Roof Inspection - ${lead.customerName}`);
    const details = encodeURIComponent(`Customer: ${lead.customerName}\nPhone: ${lead.customerPhone}\nEmail: ${lead.customerEmail}\nAddress: ${lead.address}, ${lead.city} ${lead.state} ${lead.zip}\nSource: ${lead.source}`);
    const location = encodeURIComponent(`${lead.address}, ${lead.city}, ${lead.state} ${lead.zip}`);
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`, '_blank');
  };

  // Handle directions
  const handleDirections = (lead: Lead) => {
    const address = `${lead.address}, ${lead.city}, ${lead.state} ${lead.zip}`;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
  };

  // Handle marking a lead as contacted
  const handleMarkContacted = async (lead: Lead) => {
    setContactingLeadId(lead.id);
    try {
      const res = await fetch('/api/leads/contact-made', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, repSlug: user?.userId }),
      });
      if (res.ok) {
        setLeads(prev => prev.map(l =>
          l.id === lead.id ? { ...l, status: 'contacted' as const, lastContact: new Date().toISOString() } : l
        ));
      }
    } catch {
      // Silently fail - user can retry
    } finally {
      setContactingLeadId(null);
    }
  };

  // Handle copying portal link to clipboard
  const handleCopyPortalLink = async (lead: Lead) => {
    if (!lead.accessToken) return;
    const portalUrl = `${window.location.origin}/my/${lead.accessToken}`;
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopiedLeadId(lead.id);
      setTimeout(() => setCopiedLeadId(null), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = portalUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedLeadId(lead.id);
      setTimeout(() => setCopiedLeadId(null), 2000);
    }
  };

  // Separate active vs history leads
  const activeLeads = useMemo(() =>
    filteredLeads.filter(l => l.status !== 'closed_won' && l.status !== 'closed_lost'),
    [filteredLeads]
  );

  const historyLeads = useMemo(() =>
    filteredLeads.filter(l => l.status === 'closed_won' || l.status === 'closed_lost'),
    [filteredLeads]
  );

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

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
                <Link
                  href="/portal/sales"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={20} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">Lead Management</h1>
                  <p className="text-xs text-neutral-400">{filteredLeads.length} leads</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    showFilters ? 'bg-brand-green/20 text-brand-green' : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                  }`}
                >
                  <Filter size={18} />
                </button>
                <button
                  onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  {viewMode === 'list' ? <Grid size={18} className="text-neutral-400" /> : <List size={18} className="text-neutral-400" />}
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Search by name, address, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/5 rounded-xl pl-12 pr-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/30"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 mb-4 space-y-4">
              {/* Status Filter */}
              <div>
                <label className="text-xs text-neutral-400 mb-2 block">Status</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      statusFilter === 'all'
                        ? 'bg-brand-green/20 text-brand-green ring-1 ring-brand-green/30'
                        : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                    }`}
                  >
                    All
                  </button>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => setStatusFilter(key as Lead['status'])}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        statusFilter === key ? config.color : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                      }`}
                    >
                      {config.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="text-xs text-neutral-400 mb-2 block">Priority</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setPriorityFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      priorityFilter === 'all'
                        ? 'bg-brand-green/20 text-brand-green ring-1 ring-brand-green/30'
                        : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                    }`}
                  >
                    All
                  </button>
                  {Object.entries(priorityConfig).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => setPriorityFilter(key as Lead['priority'])}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        priorityFilter === key ? `${config.bgColor} ${config.color}` : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                      }`}
                    >
                      {config.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort Options */}
              <div>
                <label className="text-xs text-neutral-400 mb-2 block">Sort By</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { field: 'priority' as SortField, label: 'Priority' },
                    { field: 'createdAt' as SortField, label: 'Date' },
                    { field: 'estimatedValue' as SortField, label: 'Value' },
                    { field: 'status' as SortField, label: 'Status' },
                    { field: 'customerName' as SortField, label: 'Name' },
                  ].map(({ field, label }) => (
                    <button
                      key={field}
                      onClick={() => {
                        if (sortField === field) {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField(field);
                          setSortOrder('asc');
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                        sortField === field
                          ? 'bg-brand-green/20 text-brand-green ring-1 ring-brand-green/30'
                          : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                      }`}
                    >
                      {label}
                      {sortField === field && (
                        sortOrder === 'asc' ? <SortAsc size={12} /> : <SortDesc size={12} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab Switcher: Active / History */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('active')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'active'
                  ? 'bg-brand-green/20 text-brand-green ring-1 ring-brand-green/30'
                  : 'bg-white/5 text-neutral-400 hover:bg-white/10'
              }`}
            >
              <Target size={16} />
              Active ({activeLeads.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'history'
                  ? 'bg-brand-green/20 text-brand-green ring-1 ring-brand-green/30'
                  : 'bg-white/5 text-neutral-400 hover:bg-white/10'
              }`}
            >
              <History size={16} />
              History ({historyLeads.length})
            </button>
          </div>

          {/* Loading State */}
          {fetchLoading && (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center">
              <Loader2 size={36} className="animate-spin text-brand-green mx-auto mb-4" />
              <p className="text-sm text-neutral-400">Loading leads...</p>
            </div>
          )}

          {/* Error State */}
          {fetchError && !fetchLoading && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center mb-4">
              <AlertCircle size={36} className="text-red-400 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-red-400 mb-1">Failed to load leads</h3>
              <p className="text-xs text-red-400/70 mb-3">{fetchError}</p>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl text-sm transition-colors"
              >
                <RefreshCw size={14} />
                Retry
              </button>
            </div>
          )}

          {/* Active Leads Tab */}
          {!fetchLoading && activeTab === 'active' && (
            <>
              {activeLeads.length > 0 ? (
                <div className={viewMode === 'grid' ? 'grid sm:grid-cols-2 gap-3' : 'space-y-3'}>
                  {activeLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-semibold text-white">{lead.customerName}</h4>
                            <StatusBadge status={lead.status} />
                            <span className={`text-xs font-medium ${priorityConfig[lead.priority].color}`}>
                              {priorityConfig[lead.priority].label}
                            </span>
                            {/* Response Timer for new leads */}
                            {lead.status === 'new' && (
                              <ResponseTimer createdAt={lead.createdAt} />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-neutral-400">
                            <MapPin size={14} />
                            <span>{lead.address}, {lead.city}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-xs text-neutral-500 flex-wrap">
                            {lead.source && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/5 text-neutral-400">
                                {lead.source.replace(/_/g, ' ')}
                              </span>
                            )}
                            {lead.assignedTo && (
                              <span className="inline-flex items-center gap-1">
                                <User size={10} />
                                {lead.assignedTo}
                              </span>
                            )}
                            {lead.estimatedValue > 0 && (
                              <span>Est. ${lead.estimatedValue.toLocaleString()}</span>
                            )}
                            {lead.lastContact && (
                              <span>Last: {new Date(lead.lastContact).toLocaleDateString()}</span>
                            )}
                            <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Mark Contacted banner for new leads */}
                      {lead.status === 'new' && (
                        <div className="mb-3 p-2.5 bg-[#39FF14]/10 border border-[#39FF14]/20 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Bell size={14} className="text-[#39FF14]" />
                            <span className="text-xs text-[#39FF14] font-medium">New lead - respond quickly!</span>
                          </div>
                          <button
                            onClick={() => handleMarkContacted(lead)}
                            disabled={contactingLeadId === lead.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#39FF14]/20 hover:bg-[#39FF14]/30 text-[#39FF14] rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            {contactingLeadId === lead.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <CheckCircle size={12} />
                            )}
                            Mark Contacted
                          </button>
                        </div>
                      )}

                      {/* Action Buttons - Large Touch Targets */}
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                        <button
                          onClick={() => handleCall(lead)}
                          className="flex flex-col items-center justify-center p-2.5 bg-green-500/20 hover:bg-green-500/30 rounded-xl transition-colors active:scale-95"
                        >
                          <Phone size={18} className="text-green-400" />
                          <span className="text-[10px] text-green-400 mt-0.5">Call</span>
                        </button>
                        <button
                          onClick={() => handleText(lead)}
                          className="flex flex-col items-center justify-center p-2.5 bg-brand-green/20 hover:bg-brand-green/30 rounded-xl transition-colors active:scale-95"
                        >
                          <MessageSquare size={18} className="text-blue-400" />
                          <span className="text-[10px] text-blue-400 mt-0.5">Text</span>
                        </button>
                        <button
                          onClick={() => handleEmail(lead)}
                          className="flex flex-col items-center justify-center p-2.5 bg-violet-500/20 hover:bg-violet-500/30 rounded-xl transition-colors active:scale-95"
                        >
                          <Mail size={18} className="text-violet-400" />
                          <span className="text-[10px] text-violet-400 mt-0.5">Email</span>
                        </button>
                        <button
                          onClick={() => handleSchedule(lead)}
                          className="flex flex-col items-center justify-center p-2.5 bg-orange-500/20 hover:bg-orange-500/30 rounded-xl transition-colors active:scale-95"
                        >
                          <Calendar size={18} className="text-orange-400" />
                          <span className="text-[10px] text-orange-400 mt-0.5">Schedule</span>
                        </button>
                        <button
                          onClick={() => handleDirections(lead)}
                          className="flex flex-col items-center justify-center p-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-xl transition-colors active:scale-95"
                        >
                          <MapPin size={18} className="text-cyan-400" />
                          <span className="text-[10px] text-cyan-400 mt-0.5">Map</span>
                        </button>
                        <button
                          onClick={() => handleCopyPortalLink(lead)}
                          disabled={!lead.accessToken}
                          className={`flex flex-col items-center justify-center p-2.5 rounded-xl transition-colors active:scale-95 ${
                            copiedLeadId === lead.id
                              ? 'bg-brand-green/20'
                              : 'bg-amber-500/20 hover:bg-amber-500/30'
                          } ${!lead.accessToken ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          {copiedLeadId === lead.id ? (
                            <>
                              <CheckCircle size={18} className="text-brand-green" />
                              <span className="text-[10px] text-brand-green mt-0.5">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={18} className="text-amber-400" />
                              <span className="text-[10px] text-amber-400 mt-0.5">Portal</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedLead(lead);
                            setShowUpdateStatus(true);
                          }}
                          className="flex flex-col items-center justify-center p-2.5 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl transition-colors active:scale-95"
                        >
                          <RefreshCw size={18} className="text-purple-400" />
                          <span className="text-[10px] text-purple-400 mt-0.5">Status</span>
                        </button>
                        <Link
                          href={`/portal/sales/customers/${lead.id}`}
                          className="flex flex-col items-center justify-center p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors active:scale-95"
                        >
                          <ArrowRight size={18} className="text-neutral-400" />
                          <span className="text-[10px] text-neutral-400 mt-0.5">Details</span>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center">
                  <Users size={48} className="text-neutral-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No active leads found</h3>
                  <p className="text-sm text-neutral-500 mb-4">
                    {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                      ? 'Try adjusting your filters or search term'
                      : 'New leads will appear here when assigned to you'}
                  </p>
                  {(searchTerm || statusFilter !== 'all' || priorityFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setStatusFilter('all');
                        setPriorityFilter('all');
                      }}
                      className="text-sm text-brand-green hover:text-brand-green/80"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* History Tab */}
          {!fetchLoading && activeTab === 'history' && (
            <>
              {historyLeads.length > 0 ? (
                <div className="space-y-3">
                  {/* History Summary */}
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-center">
                      <div className="text-2xl font-bold text-green-400">
                        {historyLeads.filter(l => l.status === 'closed_won').length}
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">Won</div>
                      <div className="text-sm font-medium text-green-400 mt-1">
                        ${historyLeads
                          .filter(l => l.status === 'closed_won')
                          .reduce((sum, l) => sum + l.estimatedValue, 0)
                          .toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-center">
                      <div className="text-2xl font-bold text-red-400">
                        {historyLeads.filter(l => l.status === 'closed_lost').length}
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">Lost</div>
                      <div className="text-sm font-medium text-red-400 mt-1">
                        ${historyLeads
                          .filter(l => l.status === 'closed_lost')
                          .reduce((sum, l) => sum + l.estimatedValue, 0)
                          .toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Win Rate */}
                  {historyLeads.length > 0 && (
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-neutral-400">Win Rate</span>
                        <span className="text-sm font-bold text-brand-green">
                          {Math.round(
                            (historyLeads.filter(l => l.status === 'closed_won').length / historyLeads.length) * 100
                          )}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-green rounded-full transition-all duration-500"
                          style={{
                            width: `${(historyLeads.filter(l => l.status === 'closed_won').length / historyLeads.length) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* History Lead Cards */}
                  {historyLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 opacity-80"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-semibold text-white">{lead.customerName}</h4>
                            <StatusBadge status={lead.status} />
                          </div>
                          <div className="flex items-center gap-2 text-sm text-neutral-400">
                            <MapPin size={14} />
                            <span>{lead.address}, {lead.city}</span>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
                            <span>
                              {lead.status === 'closed_won' ? 'Value' : 'Est.'}: ${lead.estimatedValue.toLocaleString()}
                            </span>
                            <span>{lead.source}</span>
                            <span>Closed: {new Date(lead.lastContact || lead.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <Link
                          href={`/portal/sales/customers/${lead.id}`}
                          className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                        >
                          <ArrowRight size={16} className="text-neutral-400" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center">
                  <History size={48} className="text-neutral-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No history yet</h3>
                  <p className="text-sm text-neutral-500">Closed leads (won and lost) will appear here</p>
                </div>
              )}
            </>
          )}
        </main>

        {/* Floating New Lead Button (desktop) */}
        <Link
          href="/portal/leads/new"
          className="fixed bottom-24 right-6 sm:bottom-8 sm:right-8 w-14 h-14 bg-brand-green hover:bg-brand-green/90 rounded-full flex items-center justify-center shadow-lg shadow-brand-green/20 transition-all hover:scale-105 active:scale-95 z-30"
          title="Add new lead"
        >
          <Plus size={28} className="text-black" />
        </Link>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t border-white/5 px-4 py-2 z-30 sm:hidden">
          <div className="flex items-center justify-around">
            <Link href="/portal/sales" className="flex flex-col items-center p-2 text-neutral-400 hover:text-white">
              <Home size={20} />
              <span className="text-xs mt-1">Home</span>
            </Link>
            <Link href="/portal/sales/leads" className="flex flex-col items-center p-2 text-brand-green">
              <Users size={20} />
              <span className="text-xs mt-1">Leads</span>
            </Link>
            <Link href="/portal/leads/new" className="flex flex-col items-center p-3 -mt-4 bg-brand-green rounded-full text-black">
              <Plus size={24} />
            </Link>
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

      {/* Update Status Modal */}
      {showUpdateStatus && selectedLead && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <h3 className="text-lg font-semibold text-white">Update Status</h3>
              <button
                onClick={() => {
                  setShowUpdateStatus(false);
                  setSelectedLead(null);
                }}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center"
              >
                <X size={18} className="text-neutral-400" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-neutral-400 mb-4">
                Update status for <span className="text-white font-medium">{selectedLead.customerName}</span>
              </p>
              <div className="space-y-2">
                {Object.entries(statusConfig).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => handleStatusUpdate(selectedLead.id, key as Lead['status'])}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                      selectedLead.status === key
                        ? config.color
                        : 'bg-white/[0.02] hover:bg-white/[0.05] text-neutral-300'
                    }`}
                  >
                    <span className="font-medium">{config.label}</span>
                    {selectedLead.status === key && <CheckCircle size={18} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
