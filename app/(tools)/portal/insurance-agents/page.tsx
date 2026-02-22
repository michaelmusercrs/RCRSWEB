'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Building2, MapPin, Phone, Mail, User, Calendar,
  Plus, Search, Filter, Clock, CheckCircle, ChevronDown, ChevronRight,
  RefreshCw, Loader2, X, Star, Navigation, Globe
} from 'lucide-react';

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
  visitedByName: string;
  visitDate: string;
  duration?: number;
  notes: string;
  outcome?: string;
}

const AREA_OPTIONS = ['Decatur', 'Madison', 'Huntsville', 'Athens', 'Hartselle'];
const COMPANY_COLORS: Record<string, string> = {
  'State Farm': 'bg-red-100 text-red-800',
  'Alfa Insurance': 'bg-blue-100 text-blue-800',
  'Allstate': 'bg-indigo-100 text-indigo-800',
  'Country Financial': 'bg-green-100 text-green-800',
  'Howard Kilgore': 'bg-amber-100 text-amber-800',
  'Farmers Insurance': 'bg-orange-100 text-orange-800',
  'Shelter Insurance': 'bg-purple-100 text-purple-800',
  'Erie Insurance': 'bg-cyan-100 text-cyan-800',
};

export default function InsuranceAgentsPage() {
  const [agents, setAgents] = useState<InsuranceAgent[]>([]);
  const [suggestions, setSuggestions] = useState<InsuranceAgent[]>([]);
  const [areaSummary, setAreaSummary] = useState<{ area: string; agentCount: number; lastVisit: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showVisitModal, setShowVisitModal] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestLocation, setSuggestLocation] = useState('Decatur');

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ action: 'list' });
      if (cityFilter) params.set('city', cityFilter);
      if (companyFilter) params.set('company', companyFilter);

      const [agentsRes, summaryRes] = await Promise.all([
        fetch(`/api/portal/insurance-agents?${params}`),
        fetch('/api/portal/insurance-agents?action=areaSummary'),
      ]);
      if (agentsRes.ok) setAgents(await agentsRes.json());
      if (summaryRes.ok) setAreaSummary(await summaryRes.json());
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setLoading(false);
    }
  }, [cityFilter, companyFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const loadSuggestions = async (location: string) => {
    try {
      const res = await fetch(`/api/portal/insurance-agents?action=suggest&location=${location}&limit=5`);
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

  const filteredAgents = agents.filter(a => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return a.agentName.toLowerCase().includes(q) || a.company.toLowerCase().includes(q) || a.officeName.toLowerCase().includes(q);
    }
    return true;
  });

  const uniqueCompanies = [...new Set(agents.map(a => a.company))].sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/portal" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Insurance Agents</h1>
            <p className="text-sm text-gray-500">Track local insurance agent relationships</p>
          </div>
        </div>
        <button onClick={fetchData} className="p-2 hover:bg-gray-100 rounded-lg">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Area Cards — Rick's Schedule Filler */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {areaSummary.map(area => (
          <button
            key={area.area}
            onClick={() => handleSuggest(area.area)}
            className="bg-white rounded-xl p-4 shadow-sm border hover:border-blue-300 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-blue-500" />
              <span className="font-semibold">{area.area}</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">{area.agentCount}</div>
            <div className="text-xs text-gray-500">
              {area.lastVisit ? `Last visit: ${new Date(area.lastVisit).toLocaleDateString()}` : 'No visits yet'}
            </div>
          </button>
        ))}
      </div>

      {/* Suggestions Panel */}
      {showSuggestions && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold">Suggested Visits in {suggestLocation}</h3>
            </div>
            <div className="flex gap-2">
              {AREA_OPTIONS.map(area => (
                <button
                  key={area}
                  onClick={() => handleSuggest(area)}
                  className={`px-2 py-1 text-xs rounded-full ${area === suggestLocation ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-blue-100'}`}
                >
                  {area}
                </button>
              ))}
              <button onClick={() => setShowSuggestions(false)} className="p-1 hover:bg-blue-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {suggestions.map(agent => (
              <div key={agent.agentId} className="bg-white rounded-lg p-3 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COMPANY_COLORS[agent.company] || 'bg-gray-100 text-gray-800'}`}>
                    {agent.company}
                  </span>
                  {!agent.lastVisitDate && <span className="text-xs text-amber-600 font-medium">Never visited</span>}
                </div>
                <p className="font-medium">{agent.agentName}</p>
                <p className="text-sm text-gray-600">{agent.address}</p>
                <div className="flex items-center gap-2 mt-2">
                  <a href={`tel:${agent.phone}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <Phone className="w-3 h-3" /> {agent.phone}
                  </a>
                  <button
                    onClick={() => setShowVisitModal(agent.agentId)}
                    className="ml-auto flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100"
                  >
                    <CheckCircle className="w-3 h-3" /> Log Visit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">All Areas</option>
          {AREA_OPTIONS.map(area => <option key={area} value={area}>{area}</option>)}
        </select>
        <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">All Companies</option>
          {uniqueCompanies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Agents Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Area</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Assigned To</th>
              <th className="px-4 py-3">Last Visit</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredAgents.map(agent => (
              <tr key={agent.agentId} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{agent.agentName}</div>
                  <div className="text-xs text-gray-500">{agent.address}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COMPANY_COLORS[agent.company] || 'bg-gray-100 text-gray-800'}`}>
                    {agent.company}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{agent.city}</td>
                <td className="px-4 py-3">
                  <a href={`tel:${agent.phone}`} className="text-sm text-blue-600 hover:underline">{agent.phone}</a>
                </td>
                <td className="px-4 py-3 text-sm">
                  {agent.assignedRep || <span className="text-gray-400">Unassigned</span>}
                </td>
                <td className="px-4 py-3 text-sm">
                  {agent.lastVisitDate ? new Date(agent.lastVisitDate).toLocaleDateString() : <span className="text-amber-500">Never</span>}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setShowVisitModal(agent.agentId)}
                    className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100"
                  >
                    Log Visit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredAgents.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No agents found</p>
          </div>
        )}
      </div>

      {/* Visit Modal */}
      {showVisitModal && (
        <VisitModal
          agentId={showVisitModal}
          agents={agents}
          onClose={() => setShowVisitModal(null)}
          onSaved={() => { setShowVisitModal(null); fetchData(); }}
        />
      )}
    </div>
  );
}

function VisitModal({ agentId, agents, onClose, onSaved }: {
  agentId: string;
  agents: InsuranceAgent[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const agent = agents.find(a => a.agentId === agentId);
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('');
  const [duration, setDuration] = useState('30');
  const [followUpDate, setFollowUpDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
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
      if (res.ok) onSaved();
    } catch (error) {
      console.error('Failed to record visit:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Log Visit</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          {agent && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium">{agent.agentName}</p>
              <p className="text-sm text-gray-600">{agent.company} — {agent.city}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
            <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Outcome</label>
            <select value={outcome} onChange={e => setOutcome(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select...</option>
              <option value="positive">Positive — Good reception</option>
              <option value="neutral">Neutral — Dropped off materials</option>
              <option value="not_available">Not available — Left card</option>
              <option value="referral">Got a referral</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full px-3 py-2 border rounded-lg" placeholder="What was discussed..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Date</label>
            <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg" />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Visit
          </button>
        </div>
      </div>
    </div>
  );
}
