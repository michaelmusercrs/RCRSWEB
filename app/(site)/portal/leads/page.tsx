'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MapPin, Clock, Phone, Mail, User, ChevronRight,
  Loader2, Search, Filter, CheckCircle, AlertCircle,
  Calendar, DollarSign, FileText, ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface Lead {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  source: string;
  notes: string;
  estimatedValue: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
  assignedTo: string | null;
  assignedToName: string | null;
  assignedAt: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  assigned: 'Assigned',
  contacted: 'Contacted',
  scheduled: 'Scheduled',
  inspected: 'Inspected',
  quoted: 'Quoted',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  assigned: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  contacted: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  scheduled: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  inspected: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  quoted: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  closed_won: 'bg-green-500/20 text-green-400 border-green-500/30',
  closed_lost: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'border-gray-600',
  medium: 'border-blue-600',
  high: 'border-orange-500',
  urgent: 'border-red-500',
};

const STATUS_FLOW = ['assigned', 'contacted', 'scheduled', 'inspected', 'quoted', 'closed_won', 'closed_lost'];

// ============================================================================
// Component
// ============================================================================

export default function PortalLeadsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLead, setExpandedLead] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads');
      const data = await res.json();
      if (data.success) setLeads(data.leads);
    } catch (e) {
      console.error('Failed to fetch leads:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const updateStatus = async (leadId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) fetchLeads();
    } catch (e) {
      console.error('Status update failed:', e);
    }
  };

  const filtered = leads.filter(l => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return l.customerName.toLowerCase().includes(q) || l.zip.includes(q) || l.city.toLowerCase().includes(q);
    }
    return true;
  });

  // Group by status for pipeline view
  const activeLeads = filtered.filter(l => !['closed_won', 'closed_lost'].includes(l.status));
  const closedLeads = filtered.filter(l => ['closed_won', 'closed_lost'].includes(l.status));

  // Stats
  const totalActive = leads.filter(l => !['closed_won', 'closed_lost'].includes(l.status)).length;
  const totalWon = leads.filter(l => l.status === 'closed_won').length;
  const totalValue = leads.filter(l => l.status !== 'closed_lost').reduce((s, l) => s + (l.estimatedValue || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">My Leads</h1>
        <p className="text-gray-400 text-sm mt-1">Leads assigned to you — update status as you progress</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{totalActive}</div>
          <div className="text-gray-400 text-xs mt-1">Active Leads</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{totalWon}</div>
          <div className="text-gray-400 text-xs mt-1">Closed Won</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">${totalValue.toLocaleString()}</div>
          <div className="text-gray-400 text-xs mt-1">Pipeline Value</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search leads..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1 border border-gray-700">
          {['all', 'assigned', 'contacted', 'scheduled', 'quoted'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                statusFilter === s ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              )}
            >
              {s === 'all' ? 'All' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Lead Cards */}
      {filtered.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
          <User className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No leads yet. Leads will appear here when assigned to you.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(lead => (
            <div
              key={lead.id}
              className={cn(
                'bg-gray-800/50 border rounded-xl overflow-hidden transition-all',
                PRIORITY_COLORS[lead.priority] || 'border-gray-700',
                lead.priority === 'urgent' && 'border-l-4'
              )}
            >
              {/* Card Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-700/30"
                onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-white">{lead.customerName}</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {lead.city ? `${lead.city}, ` : ''}{lead.zip}
                      </span>
                      {lead.estimatedValue > 0 && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {lead.estimatedValue.toLocaleString()}
                        </span>
                      )}
                      <span className="text-gray-500 text-xs">{lead.source}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('px-2 py-1 rounded-full text-xs border', STATUS_COLORS[lead.status])}>
                      {STATUS_LABELS[lead.status] || lead.status}
                    </span>
                    <ChevronRight className={cn(
                      'w-4 h-4 text-gray-500 transition-transform',
                      expandedLead === lead.id && 'rotate-90'
                    )} />
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedLead === lead.id && (
                <div className="px-4 pb-4 border-t border-gray-700/50 pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {lead.customerPhone && (
                      <a href={`tel:${lead.customerPhone}`} className="flex items-center gap-2 text-blue-400 hover:underline">
                        <Phone className="w-4 h-4" /> {lead.customerPhone}
                      </a>
                    )}
                    {lead.customerEmail && (
                      <a href={`mailto:${lead.customerEmail}`} className="flex items-center gap-2 text-blue-400 hover:underline">
                        <Mail className="w-4 h-4" /> {lead.customerEmail}
                      </a>
                    )}
                    {lead.address && (
                      <div className="flex items-center gap-2 text-gray-300 col-span-2">
                        <MapPin className="w-4 h-4 text-gray-500" /> {lead.address}, {lead.city}, {lead.state} {lead.zip}
                      </div>
                    )}
                  </div>

                  {lead.notes && (
                    <div className="text-sm text-gray-400 bg-gray-800 rounded-lg p-3">
                      <FileText className="w-3 h-3 inline mr-1" /> {lead.notes}
                    </div>
                  )}

                  {/* Status Pipeline */}
                  <div>
                    <span className="text-xs text-gray-500 mb-2 block">Update Status:</span>
                    <div className="flex flex-wrap gap-2">
                      {STATUS_FLOW.map(s => (
                        <button
                          key={s}
                          onClick={() => updateStatus(lead.id, s)}
                          disabled={lead.status === s}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                            lead.status === s
                              ? STATUS_COLORS[s]
                              : 'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'
                          )}
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 pt-2">
                    Assigned {lead.assignedAt ? new Date(lead.assignedAt).toLocaleDateString() : '—'} • Created by {lead.createdByName}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
