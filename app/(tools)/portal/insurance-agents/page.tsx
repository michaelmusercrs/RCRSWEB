'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Building2, MapPin, Phone, Mail, User, Calendar,
  Plus, Search, Filter, Clock, CheckCircle, ChevronDown, ChevronRight,
  RefreshCw, Loader2, X, Star, Navigation, Globe, ClipboardList,
  AlertTriangle, History, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

interface InsuranceAgent {
  agentId: string;
  agentName: string;
  company: string;
  officeName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  assignedRep?: string;
  lastVisitDate?: string;
  visitFrequency?: string;
  notes: string;
  active: boolean;
}

interface AgentVisit {
  visitId: string;
  agentId: string;
  agentName: string;
  company: string;
  visitedBy: string;
  visitedByName: string;
  visitDate: string;
  duration?: number;
  notes: string;
  outcome?: string;
  followUpDate?: string;
}

const AREA_OPTIONS = ['Decatur', 'Madison', 'Huntsville', 'Athens', 'Hartselle'];

const COMPANY_COLORS: Record<string, string> = {
  'State Farm': 'bg-red-500/20 text-red-400 border-red-500/30',
  'Alfa Insurance': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Allstate': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  'Country Financial': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Howard Kilgore': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Farmers Insurance': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'Shelter Insurance': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Erie Insurance': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  positive: { label: 'Positive', color: 'text-lime-400' },
  neutral: { label: 'Neutral', color: 'text-zinc-400' },
  not_available: { label: 'Not Available', color: 'text-amber-400' },
  referral: { label: 'Got Referral', color: 'text-cyan-400' },
};

function daysSince(dateStr: string | undefined | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function getUrgencyColor(days: number | null): string {
  if (days === null) return 'text-amber-400'; // Never visited
  if (days <= 7) return 'text-lime-400';
  if (days <= 14) return 'text-emerald-400';
  if (days <= 30) return 'text-amber-400';
  return 'text-red-400';
}

export default function InsuranceAgentsPage() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<InsuranceAgent[]>([]);
  const [visits, setVisits] = useState<AgentVisit[]>([]);
  const [suggestions, setSuggestions] = useState<InsuranceAgent[]>([]);
  const [areaSummary, setAreaSummary] = useState<{ area: string; agentCount: number; lastVisit: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [showVisitModal, setShowVisitModal] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestLocation, setSuggestLocation] = useState('Decatur');
  const [activeTab, setActiveTab] = useState<'agents' | 'history'>('agents');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ action: 'list' });
      if (cityFilter) params.set('city', cityFilter);
      if (companyFilter) params.set('company', companyFilter);

      const [agentsRes, summaryRes, visitsRes] = await Promise.all([
        fetch(`/api/portal/insurance-agents?${params}`),
        fetch('/api/portal/insurance-agents?action=areaSummary'),
        fetch('/api/portal/insurance-agents?action=visits&limit=100'),
      ]);
      if (agentsRes.ok) setAgents(await agentsRes.json());
      if (summaryRes.ok) setAreaSummary(await summaryRes.json());
      if (visitsRes.ok) setVisits(await visitsRes.json());
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setLoading(false);
    }
  }, [cityFilter, companyFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const loadSuggestions = async (location: string) => {
    try {
      const repName = user?.name || '';
      const res = await fetch(`/api/portal/insurance-agents?action=suggest&location=${location}&repName=${encodeURIComponent(repName)}&limit=5`);
      if (res.ok) setSuggestions(await res.json());
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };

  const handleSuggest = (location: string) => {
    setSuggestLocation(location);
    setShowSuggestions(true);
    loadSuggestions(location);
  };

  const filteredAgents = useMemo(() => {
    let filtered = agents.filter(a => a.active);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.agentName.toLowerCase().includes(q) ||
        a.company.toLowerCase().includes(q) ||
        a.officeName.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [agents, searchQuery]);

  const uniqueCompanies = useMemo(() => [...new Set(agents.map(a => a.company))].sort(), [agents]);

  // Stats
  const totalAgents = agents.filter(a => a.active).length;
  const neverVisited = agents.filter(a => a.active && !a.lastVisitDate).length;
  const overdue = agents.filter(a => {
    const days = daysSince(a.lastVisitDate);
    return days !== null && days > 30;
  }).length;
  const myVisits = visits.filter(v =>
    v.visitedByName?.toLowerCase().includes((user?.name || '').toLowerCase().split(' ')[0])
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#39FF14]" />
          <p className="text-sm text-zinc-500">Loading insurance agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/portal/dashboard" className="text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#39FF14]" />
                Insurance Agent Tracker
              </h1>
              <p className="text-sm text-zinc-400">
                {totalAgents} agents across {areaSummary.length} areas
              </p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Message */}
        {message && (
          <div className={cn(
            'rounded-lg px-4 py-3 text-sm font-medium',
            message.type === 'success'
              ? 'bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30'
              : 'bg-red-500/10 text-red-400 border border-red-500/30'
          )}>
            {message.text}
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
            <p className="text-xs font-medium text-zinc-500">Total Agents</p>
            <p className="mt-1 text-2xl font-bold text-white">{totalAgents}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
            <p className="text-xs font-medium text-zinc-500">Never Visited</p>
            <p className="mt-1 text-2xl font-bold text-amber-400">{neverVisited}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
            <p className="text-xs font-medium text-zinc-500">Overdue (30+ days)</p>
            <p className="mt-1 text-2xl font-bold text-red-400">{overdue}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
            <p className="text-xs font-medium text-zinc-500">My Visits</p>
            <p className="mt-1 text-2xl font-bold text-[#39FF14]">{myVisits}</p>
          </div>
        </div>

        {/* Area Cards - Quick Navigate */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {areaSummary.map(area => {
            const days = daysSince(area.lastVisit);
            return (
              <button
                key={area.area}
                onClick={() => handleSuggest(area.area)}
                className={cn(
                  'rounded-xl p-4 border transition-all text-left',
                  suggestLocation === area.area && showSuggestions
                    ? 'bg-[#39FF14]/10 border-[#39FF14]/40'
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4 text-[#39FF14]" />
                  <span className="font-semibold text-white text-sm">{area.area}</span>
                </div>
                <div className="text-2xl font-bold text-white">{area.agentCount}</div>
                <div className={cn('text-xs', getUrgencyColor(days))}>
                  {area.lastVisit
                    ? `${days}d ago`
                    : 'No visits yet'}
                </div>
              </button>
            );
          })}
        </div>

        {/* Suggestions Panel */}
        {showSuggestions && (
          <div className="rounded-xl border border-[#39FF14]/30 bg-[#39FF14]/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Navigation className="w-5 h-5 text-[#39FF14]" />
                <h3 className="font-semibold text-white">
                  Suggested Visits in {suggestLocation}
                </h3>
                <span className="text-xs text-zinc-500">Prioritized: never visited, then longest since last visit</span>
              </div>
              <div className="flex items-center gap-2">
                {AREA_OPTIONS.map(area => (
                  <button
                    key={area}
                    onClick={() => handleSuggest(area)}
                    className={cn(
                      'px-2 py-1 text-xs rounded-full transition-colors',
                      area === suggestLocation
                        ? 'bg-[#39FF14] text-zinc-900 font-medium'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    )}
                  >
                    {area}
                  </button>
                ))}
                <button onClick={() => setShowSuggestions(false)} className="p-1 text-zinc-400 hover:text-white rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {suggestions.length === 0 && (
                <div className="col-span-full text-center py-6 text-zinc-500">
                  No agents found in {suggestLocation}
                </div>
              )}
              {suggestions.map(agent => {
                const days = daysSince(agent.lastVisitDate);
                return (
                  <div key={agent.agentId} className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium border',
                        COMPANY_COLORS[agent.company] || 'bg-zinc-700 text-zinc-300 border-zinc-600'
                      )}>
                        {agent.company}
                      </span>
                      {!agent.lastVisitDate && (
                        <span className="flex items-center gap-1 text-xs text-amber-400 font-medium">
                          <AlertTriangle className="w-3 h-3" /> Never visited
                        </span>
                      )}
                      {days !== null && days > 30 && (
                        <span className="flex items-center gap-1 text-xs text-red-400 font-medium">
                          <Clock className="w-3 h-3" /> {days}d overdue
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-white">{agent.agentName}</p>
                    <p className="text-sm text-zinc-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {agent.address}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <a
                        href={`tel:${agent.phone}`}
                        className="flex items-center gap-1 text-xs text-[#39FF14] hover:underline"
                      >
                        <Phone className="w-3 h-3" /> {agent.phone}
                      </a>
                      <button
                        onClick={() => setShowVisitModal(agent.agentId)}
                        className="ml-auto flex items-center gap-1 px-2 py-1 text-xs bg-[#39FF14]/10 text-[#39FF14] rounded hover:bg-[#39FF14]/20 transition-colors"
                      >
                        <CheckCircle className="w-3 h-3" /> Log Visit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('agents')}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'agents'
                ? 'border-[#39FF14] text-[#39FF14]'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            )}
          >
            <Building2 className="w-4 h-4 inline mr-1.5" />
            All Agents ({totalAgents})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'history'
                ? 'border-[#39FF14] text-[#39FF14]'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            )}
          >
            <History className="w-4 h-4 inline mr-1.5" />
            Visit History ({visits.length})
          </button>
        </div>

        {/* Agents Tab */}
        {activeTab === 'agents' && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search agents by name, company, or area..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-zinc-700 rounded-lg bg-zinc-900 text-white placeholder-zinc-500 focus:ring-2 focus:ring-[#39FF14]/30 focus:border-[#39FF14]/50"
                />
              </div>
              <select
                value={cityFilter}
                onChange={e => setCityFilter(e.target.value)}
                className="px-3 py-2 border border-zinc-700 rounded-lg bg-zinc-900 text-white focus:ring-2 focus:ring-[#39FF14]/30"
              >
                <option value="">All Areas</option>
                {AREA_OPTIONS.map(area => <option key={area} value={area}>{area}</option>)}
              </select>
              <select
                value={companyFilter}
                onChange={e => setCompanyFilter(e.target.value)}
                className="px-3 py-2 border border-zinc-700 rounded-lg bg-zinc-900 text-white focus:ring-2 focus:ring-[#39FF14]/30"
              >
                <option value="">All Companies</option>
                {uniqueCompanies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Agent Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAgents.map(agent => {
                const days = daysSince(agent.lastVisitDate);
                const agentVisits = visits.filter(v => v.agentId === agent.agentId);
                return (
                  <div
                    key={agent.agentId}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition-all hover:border-zinc-700"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-white">{agent.agentName}</h3>
                        <span className={cn(
                          'inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium border',
                          COMPANY_COLORS[agent.company] || 'bg-zinc-700 text-zinc-300 border-zinc-600'
                        )}>
                          {agent.company}
                        </span>
                      </div>
                      <div className={cn('text-xs font-medium', getUrgencyColor(days))}>
                        {days === null ? 'Never visited' : `${days}d ago`}
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <MapPin size={13} className="text-zinc-500 flex-shrink-0" />
                        <span className="truncate">{agent.address}, {agent.city}</span>
                      </div>
                      <a
                        href={`tel:${agent.phone}`}
                        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-[#39FF14] transition-colors"
                      >
                        <Phone size={13} className="text-zinc-500" />
                        {agent.phone}
                      </a>
                      {agent.assignedRep && (
                        <div className="flex items-center gap-2 text-sm text-zinc-400">
                          <User size={13} className="text-zinc-500" />
                          <span>Assigned: {agent.assignedRep}</span>
                        </div>
                      )}
                    </div>

                    {/* Mini Stats */}
                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-zinc-800/50 p-2">
                      <div className="text-center">
                        <p className="text-lg font-bold text-white">{agentVisits.length}</p>
                        <p className="text-[10px] text-zinc-500">Visits</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-zinc-400">
                          {agent.lastVisitDate
                            ? new Date(agent.lastVisitDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : 'Never'}
                        </p>
                        <p className="text-[10px] text-zinc-500">Last Visit</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-zinc-400">{agent.city}</p>
                        <p className="text-[10px] text-zinc-500">Area</p>
                      </div>
                    </div>

                    {agent.notes && (
                      <p className="mt-2 text-xs text-zinc-500 line-clamp-2">{agent.notes}</p>
                    )}

                    {/* Actions */}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setShowVisitModal(agent.agentId)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#39FF14]/10 px-3 py-1.5 text-sm font-medium text-[#39FF14] hover:bg-[#39FF14]/20 transition-colors"
                      >
                        <ClipboardList size={14} />
                        Log Visit
                      </button>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(agent.address + ', ' + agent.city + ', ' + agent.state + ' ' + agent.zip)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
                      >
                        <Navigation size={14} />
                        Directions
                      </a>
                    </div>
                  </div>
                );
              })}

              {filteredAgents.length === 0 && (
                <div className="col-span-full flex min-h-[200px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900">
                  <div className="text-center">
                    <Building2 className="mx-auto h-10 w-10 text-zinc-600" />
                    <p className="mt-2 text-zinc-400">No agents found matching your filters</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Visit History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {/* Visit History Summary */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                <History size={16} className="text-[#39FF14]" />
                <h3 className="text-sm font-semibold text-white">Recent Visits</h3>
                <span className="text-xs text-zinc-500 ml-auto">{visits.length} total visits logged</span>
              </div>
              {visits.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardList className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
                  <p className="text-zinc-400">No visits have been logged yet.</p>
                  <p className="text-sm text-zinc-500 mt-1">
                    Click &quot;Log Visit&quot; on any agent card to record your first visit.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {visits.map(visit => {
                    const outcomeInfo = visit.outcome ? OUTCOME_LABELS[visit.outcome] : null;
                    return (
                      <div key={visit.visitId} className="px-4 py-3 hover:bg-zinc-800/50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-white">{visit.agentName}</span>
                              <span className={cn(
                                'px-2 py-0.5 rounded-full text-xs font-medium border',
                                COMPANY_COLORS[visit.company] || 'bg-zinc-700 text-zinc-300 border-zinc-600'
                              )}>
                                {visit.company}
                              </span>
                              {outcomeInfo && (
                                <span className={cn('text-xs font-medium', outcomeInfo.color)}>
                                  {outcomeInfo.label}
                                </span>
                              )}
                            </div>
                            {visit.notes && (
                              <p className="mt-1 text-sm text-zinc-400 line-clamp-2">{visit.notes}</p>
                            )}
                            {visit.followUpDate && (
                              <p className="mt-1 text-xs text-amber-400 flex items-center gap-1">
                                <Calendar size={11} /> Follow up: {new Date(visit.followUpDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm text-zinc-300">
                              {new Date(visit.visitDate).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric'
                              })}
                            </p>
                            <p className="text-xs text-zinc-500">by {visit.visitedByName}</p>
                            {visit.duration && (
                              <p className="text-xs text-zinc-500">{visit.duration} min</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Visit Modal */}
      {showVisitModal && (
        <VisitModal
          agentId={showVisitModal}
          agents={agents}
          onClose={() => setShowVisitModal(null)}
          onSaved={(agentName) => {
            setShowVisitModal(null);
            setMessage({ type: 'success', text: `Visit logged for ${agentName}` });
            setTimeout(() => setMessage(null), 3000);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// Visit Modal - Dark Theme
// =============================================================================

function VisitModal({ agentId, agents, onClose, onSaved }: {
  agentId: string;
  agents: InsuranceAgent[];
  onClose: () => void;
  onSaved: (agentName: string) => void;
}) {
  const agent = agents.find(a => a.agentId === agentId);
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('');
  const [duration, setDuration] = useState('30');
  const [followUpDate, setFollowUpDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/portal/insurance-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'recordVisit',
          agentId,
          visitDate: new Date().toISOString().split('T')[0],
          duration: parseInt(duration) || 30,
          notes,
          outcome,
          followUpDate: followUpDate || undefined,
        }),
      });
      if (res.ok) {
        onSaved(agent?.agentName || 'agent');
      } else {
        setError('Failed to log visit. Please try again.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full border border-zinc-700">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-white">Log Visit</h2>
            {agent && (
              <p className="text-sm text-zinc-400">{agent.agentName} - {agent.company}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}
          {agent && (
            <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
              <p className="font-medium text-white">{agent.officeName}</p>
              <p className="text-sm text-zinc-400 flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3" /> {agent.address}, {agent.city}, {agent.state} {agent.zip}
              </p>
              <a href={`tel:${agent.phone}`} className="text-sm text-[#39FF14] hover:underline flex items-center gap-1 mt-1">
                <Phone className="w-3 h-3" /> {agent.phone}
              </a>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Duration (min)</label>
              <input
                type="number"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-700 rounded-lg bg-zinc-800 text-white focus:ring-2 focus:ring-[#39FF14]/30 focus:border-[#39FF14]/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Outcome</label>
              <select
                value={outcome}
                onChange={e => setOutcome(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-700 rounded-lg bg-zinc-800 text-white focus:ring-2 focus:ring-[#39FF14]/30 focus:border-[#39FF14]/50"
              >
                <option value="">Select...</option>
                <option value="positive">Positive - Good reception</option>
                <option value="neutral">Neutral - Dropped off materials</option>
                <option value="not_available">Not available - Left card</option>
                <option value="referral">Got a referral</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-zinc-700 rounded-lg bg-zinc-800 text-white placeholder-zinc-500 focus:ring-2 focus:ring-[#39FF14]/30 focus:border-[#39FF14]/50 resize-none"
              placeholder="What was discussed, any leads mentioned..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Follow-up Date</label>
            <input
              type="date"
              value={followUpDate}
              onChange={e => setFollowUpDate(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-700 rounded-lg bg-zinc-800 text-white focus:ring-2 focus:ring-[#39FF14]/30 focus:border-[#39FF14]/50"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-zinc-700 rounded-lg text-zinc-400 hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm bg-[#39FF14] text-zinc-900 font-medium rounded-lg hover:bg-[#39FF14]/90 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <ClipboardList className="w-4 h-4" />
            Save Visit
          </button>
        </div>
      </div>
    </div>
  );
}
