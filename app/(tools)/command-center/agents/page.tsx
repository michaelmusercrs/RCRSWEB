'use client';

import * as React from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Trophy,
  TrendingUp,
  Edit2,
  ClipboardList,
  X,
  Check,
  Loader2,
  AlertCircle,
  Building2,
  Star,
  RefreshCw,
  History,
  User,
  Clock,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { TEAM_MEMBERS } from '@/lib/team-roles';

interface Agent {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  isActive: string;
  assignedRep: string;
  createdAt: string;
  updatedAt: string;
  visitCount: number;
  totalJobsReferred: number;
  lastVisit: string | null;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  company: string;
  totalJobs: number;
  visits: number;
}

interface Visit {
  visitId?: string;
  id?: string;
  agentId: string;
  agentName: string;
  visitedBy: string;
  visitedByName: string;
  visitDate: string;
  notes: string;
  jobsReferred?: string;
  followUpDate?: string;
  outcome?: string;
}

interface RepSummary {
  name: string;
  visitCount: number;
  uniqueAgents: number;
  lastVisit: string;
}

export default function AgentsPage() {
  const { user } = useAuth();
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [leaderboard, setLeaderboard] = React.useState<LeaderboardEntry[]>([]);
  const [visits, setVisits] = React.useState<Visit[]>([]);
  const [repSummary, setRepSummary] = React.useState<RepSummary[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showAddAgent, setShowAddAgent] = React.useState(false);
  const [showLogVisit, setShowLogVisit] = React.useState<Agent | null>(null);
  const [editingAgent, setEditingAgent] = React.useState<Agent | null>(null);
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [stats, setStats] = React.useState({ totalAgents: 0, activeAgents: 0 });
  const [activeTab, setActiveTab] = React.useState<'agents' | 'visits' | 'reps'>('agents');

  const salesReps = TEAM_MEMBERS.filter(m => m.isActive && (m.role === 'sales' || m.role === 'owner'));

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/command-center/agents?includeVisits=true');
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
        setLeaderboard(data.leaderboard || []);
        setVisits(data.visits || []);
        setRepSummary(data.repSummary || []);
        setStats({ totalAgents: data.totalAgents || 0, activeAgents: data.activeAgents || 0 });
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const filteredAgents = agents.filter(a =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.company.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const neverVisited = agents.filter(a => a.isActive === 'true' && !a.lastVisit).length;

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-lime-500" />
          <p className="text-sm text-zinc-500">Loading agent tracker...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent Visit Tracker</h1>
          <p className="mt-1 text-zinc-400">Track agent relationships, visits, and referral performance</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={() => setShowAddAgent(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 font-medium text-zinc-900 hover:bg-lime-400"
          >
            <Plus size={18} />
            Add Agent
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={cn(
          'rounded-lg px-4 py-3 text-sm font-medium',
          message.type === 'success' ? 'bg-lime-500/10 text-lime-400 border border-lime-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
        )}>
          {message.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="text-xs font-medium text-zinc-500">Total Agents</p>
          <p className="mt-1 text-2xl font-bold text-white">{stats.totalAgents}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="text-xs font-medium text-zinc-500">Active</p>
          <p className="mt-1 text-2xl font-bold text-lime-400">{stats.activeAgents}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="text-xs font-medium text-zinc-500">Total Visits</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {agents.reduce((sum, a) => sum + a.visitCount, 0)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="text-xs font-medium text-zinc-500">Never Visited</p>
          <p className="mt-1 text-2xl font-bold text-amber-400">{neverVisited}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="text-xs font-medium text-zinc-500">Jobs Referred</p>
          <p className="mt-1 text-2xl font-bold text-blue-400">
            {agents.reduce((sum, a) => sum + a.totalJobsReferred, 0)}
          </p>
        </div>
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-300">
            <Trophy size={16} className="text-yellow-400" />
            Agent Leaderboard - Top Referrers
          </h2>
          <div className="space-y-2">
            {leaderboard.slice(0, 5).map(entry => (
              <div key={entry.rank} className="flex items-center gap-3 rounded-lg bg-zinc-800/50 px-3 py-2">
                <span className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                  entry.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                  entry.rank === 2 ? 'bg-zinc-400/20 text-zinc-300' :
                  entry.rank === 3 ? 'bg-orange-500/20 text-orange-400' :
                  'bg-zinc-700 text-zinc-400'
                )}>
                  {entry.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{entry.name}</p>
                  <p className="text-xs text-zinc-500">{entry.company}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-lime-400">{entry.totalJobs} jobs</p>
                  <p className="text-xs text-zinc-500">{entry.visits} visits</p>
                </div>
              </div>
            ))}
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
              ? 'border-lime-500 text-lime-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          )}
        >
          <Building2 className="w-4 h-4 inline mr-1.5" />
          Agents ({stats.activeAgents})
        </button>
        <button
          onClick={() => setActiveTab('visits')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'visits'
              ? 'border-lime-500 text-lime-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          )}
        >
          <History className="w-4 h-4 inline mr-1.5" />
          Visit Log ({visits.length})
        </button>
        <button
          onClick={() => setActiveTab('reps')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'reps'
              ? 'border-lime-500 text-lime-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          )}
        >
          <Users className="w-4 h-4 inline mr-1.5" />
          Rep Report ({repSummary.length})
        </button>
      </div>

      {/* Agents Tab */}
      {activeTab === 'agents' && (
        <>
          {/* Search */}
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-4 text-sm text-white placeholder-zinc-500 focus:border-lime-500 focus:outline-none"
            />
          </div>

          {/* Agent Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAgents.map(agent => (
              <div key={agent.id} className={cn(
                'rounded-xl border bg-zinc-900 p-5 transition-all hover:border-zinc-700',
                agent.isActive === 'true' ? 'border-zinc-800' : 'border-zinc-800/50 opacity-60'
              )}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-white">{agent.name}</h3>
                    {agent.company && (
                      <div className="mt-1 flex items-center gap-1 text-sm text-zinc-400">
                        <Building2 size={13} className="text-zinc-500" />
                        {agent.company}
                      </div>
                    )}
                  </div>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    agent.isActive === 'true' ? 'bg-lime-500/20 text-lime-400' : 'bg-zinc-700 text-zinc-400'
                  )}>
                    {agent.isActive === 'true' ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5">
                  {agent.phone && (
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Phone size={13} className="text-zinc-500" />
                      <a href={`tel:${agent.phone}`} className="hover:text-lime-400">{agent.phone}</a>
                    </div>
                  )}
                  {agent.email && (
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Mail size={13} className="text-zinc-500" />
                      <span className="truncate">{agent.email}</span>
                    </div>
                  )}
                  {agent.address && (
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <MapPin size={13} className="text-zinc-500" />
                      <span className="truncate">{agent.address}</span>
                    </div>
                  )}
                  {agent.assignedRep && (
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Users size={13} className="text-zinc-500" />
                      <span>Rep: {agent.assignedRep}</span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-zinc-800/50 p-2">
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">{agent.visitCount}</p>
                    <p className="text-[10px] text-zinc-500">Visits</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-400">{agent.totalJobsReferred}</p>
                    <p className="text-[10px] text-zinc-500">Jobs</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-zinc-400">
                      {agent.lastVisit
                        ? new Date(agent.lastVisit).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : 'Never'}
                    </p>
                    <p className="text-[10px] text-zinc-500">Last Visit</p>
                  </div>
                </div>

                {agent.notes && (
                  <p className="mt-2 text-xs text-zinc-500 line-clamp-2">{agent.notes}</p>
                )}

                {/* Actions */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setShowLogVisit(agent)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-lime-500/10 px-3 py-1.5 text-sm font-medium text-lime-400 hover:bg-lime-500/20"
                  >
                    <ClipboardList size={14} />
                    Log Visit
                  </button>
                  <button
                    onClick={() => setEditingAgent(agent)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {filteredAgents.length === 0 && (
              <div className="col-span-full flex min-h-[200px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900">
                <div className="text-center">
                  <Users className="mx-auto h-10 w-10 text-zinc-600" />
                  <p className="mt-2 text-zinc-400">
                    {agents.length === 0 ? 'No agents yet. Add your first agent!' : 'No matching agents found'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Visit Log Tab */}
      {activeTab === 'visits' && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={16} className="text-lime-400" />
              <h3 className="text-sm font-semibold text-white">All Visit Activity</h3>
            </div>
            <span className="text-xs text-zinc-500">{visits.length} visits recorded</span>
          </div>
          {visits.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
              <p className="text-zinc-400">No visits recorded yet</p>
              <p className="text-sm text-zinc-500 mt-1">Visits will appear here when reps log them</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-xs font-semibold text-zinc-500 uppercase">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Visited By</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3">Jobs</th>
                    <th className="px-4 py-3">Follow-up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {visits.map((visit, idx) => (
                    <tr key={visit.visitId || visit.id || idx} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-zinc-300 whitespace-nowrap">
                        {visit.visitDate
                          ? new Date(visit.visitDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-white">{visit.agentName || visit.agentId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <User size={13} className="text-zinc-500" />
                          <span className="text-sm text-zinc-300">{visit.visitedByName || visit.visitedBy || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-400 max-w-[300px] truncate">
                        {visit.notes || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {visit.jobsReferred && parseInt(visit.jobsReferred) > 0 ? (
                          <span className="text-sm font-bold text-lime-400">{visit.jobsReferred}</span>
                        ) : (
                          <span className="text-sm text-zinc-600">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-400 whitespace-nowrap">
                        {visit.followUpDate
                          ? new Date(visit.followUpDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Rep Report Tab */}
      {activeTab === 'reps' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} className="text-lime-400" />
              <h3 className="text-sm font-semibold text-white">Rep Visit Frequency Report</h3>
              <span className="text-xs text-zinc-500 ml-auto">Who visited whom and how often</span>
            </div>

            {repSummary.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
                <p className="text-zinc-400">No visit data available yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {repSummary.map((rep, idx) => {
                  const daysSinceVisit = rep.lastVisit
                    ? Math.floor((new Date().getTime() - new Date(rep.lastVisit).getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                  return (
                    <div key={rep.name} className="rounded-lg bg-zinc-800/50 p-4 border border-zinc-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                            idx === 0 ? 'bg-lime-500/20 text-lime-400' :
                            idx === 1 ? 'bg-zinc-400/20 text-zinc-300' :
                            'bg-zinc-700 text-zinc-400'
                          )}>
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-semibold text-white">{rep.name}</p>
                            <p className="text-xs text-zinc-500">
                              Last active: {daysSinceVisit !== null
                                ? (daysSinceVisit === 0 ? 'Today' : `${daysSinceVisit}d ago`)
                                : 'Never'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-6 text-right">
                          <div>
                            <p className="text-lg font-bold text-white">{rep.visitCount}</p>
                            <p className="text-[10px] text-zinc-500">Total Visits</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-blue-400">{rep.uniqueAgents}</p>
                            <p className="text-[10px] text-zinc-500">Unique Agents</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-zinc-300">
                              {rep.visitCount > 0 && rep.uniqueAgents > 0
                                ? (rep.visitCount / rep.uniqueAgents).toFixed(1)
                                : '0'}
                            </p>
                            <p className="text-[10px] text-zinc-500">Avg Visits/Agent</p>
                          </div>
                        </div>
                      </div>

                      {/* This rep's visits */}
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {(() => {
                          // Group visits by agent for this rep
                          const repVisits = visits.filter(v =>
                            (v.visitedByName || v.visitedBy || '') === rep.name
                          );
                          const agentMap: Record<string, { name: string; count: number; lastDate: string }> = {};
                          for (const v of repVisits) {
                            const aName = v.agentName || v.agentId;
                            if (!agentMap[aName]) {
                              agentMap[aName] = { name: aName, count: 0, lastDate: '' };
                            }
                            agentMap[aName].count++;
                            if (v.visitDate > agentMap[aName].lastDate) {
                              agentMap[aName].lastDate = v.visitDate;
                            }
                          }
                          return Object.values(agentMap)
                            .sort((a, b) => b.count - a.count)
                            .map(a => (
                              <div key={a.name} className="rounded bg-zinc-900 px-2 py-1.5 text-xs">
                                <p className="font-medium text-zinc-300 truncate">{a.name}</p>
                                <p className="text-zinc-500">
                                  {a.count}x {' '}
                                  <span className="text-zinc-600">
                                    (last: {new Date(a.lastDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                                  </span>
                                </p>
                              </div>
                            ));
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Agent Modal */}
      {showAddAgent && (
        <AgentFormModal
          onClose={() => setShowAddAgent(false)}
          onSave={async (data) => {
            const res = await fetch('/api/command-center/agents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });
            if (res.ok) {
              setMessage({ type: 'success', text: `Agent "${data.name}" added` });
              setTimeout(() => setMessage(null), 3000);
              await fetchData();
              setShowAddAgent(false);
            } else {
              setMessage({ type: 'error', text: 'Failed to add agent' });
            }
          }}
          salesReps={salesReps}
        />
      )}

      {/* Edit Agent Modal */}
      {editingAgent && (
        <AgentFormModal
          agent={editingAgent}
          onClose={() => setEditingAgent(null)}
          onSave={async (data) => {
            const res = await fetch('/api/command-center/agents', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: editingAgent.id, ...data }),
            });
            if (res.ok) {
              setMessage({ type: 'success', text: `Agent "${data.name}" updated` });
              setTimeout(() => setMessage(null), 3000);
              await fetchData();
              setEditingAgent(null);
            } else {
              setMessage({ type: 'error', text: 'Failed to update agent' });
            }
          }}
          salesReps={salesReps}
        />
      )}

      {/* Log Visit Modal */}
      {showLogVisit && (
        <LogVisitModal
          agent={showLogVisit}
          onClose={() => setShowLogVisit(null)}
          currentUser={user?.name || 'Unknown'}
          onSave={async (data) => {
            const res = await fetch('/api/command-center/agents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'log-visit', ...data }),
            });
            if (res.ok) {
              setMessage({ type: 'success', text: `Visit logged for ${showLogVisit.name}` });
              setTimeout(() => setMessage(null), 3000);
              await fetchData();
              setShowLogVisit(null);
            } else {
              setMessage({ type: 'error', text: 'Failed to log visit' });
            }
          }}
        />
      )}
    </div>
  );
}

// ===========================================================================
// Agent Form Modal
// ===========================================================================

function AgentFormModal({
  agent,
  onClose,
  onSave,
  salesReps,
}: {
  agent?: Agent;
  onClose: () => void;
  onSave: (data: Record<string, string>) => Promise<void>;
  salesReps: { id: string; name: string }[];
}) {
  const [form, setForm] = React.useState({
    name: agent?.name || '',
    company: agent?.company || '',
    phone: agent?.phone || '',
    email: agent?.email || '',
    address: agent?.address || '',
    notes: agent?.notes || '',
    assignedRep: agent?.assignedRep || '',
    isActive: agent?.isActive || 'true',
  });
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h2 className="text-lg font-bold text-white">
            {agent ? 'Edit Agent' : 'Add New Agent'}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none"
                placeholder="Agent name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Company</label>
              <input
                type="text"
                value={form.company}
                onChange={e => setForm({ ...form, company: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none"
                placeholder="Company name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none"
                placeholder="256-555-1234"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none"
                placeholder="agent@company.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Address</label>
            <input
              type="text"
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none"
              placeholder="Business address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Assigned Rep</label>
              <select
                value={form.assignedRep}
                onChange={e => setForm({ ...form, assignedRep: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none"
              >
                <option value="">None</option>
                {salesReps.map(rep => (
                  <option key={rep.id} value={rep.name}>{rep.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Status</label>
              <select
                value={form.isActive}
                onChange={e => setForm({ ...form, isActive: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none resize-none"
              placeholder="Notes about this agent..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-lime-400 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {agent ? 'Save Changes' : 'Add Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===========================================================================
// Log Visit Modal
// ===========================================================================

function LogVisitModal({
  agent,
  onClose,
  currentUser,
  onSave,
}: {
  agent: Agent;
  onClose: () => void;
  currentUser: string;
  onSave: (data: Record<string, string>) => Promise<void>;
}) {
  const [form, setForm] = React.useState({
    agentId: agent.id,
    agentName: agent.name,
    visitedBy: currentUser,
    visitDate: new Date().toISOString().split('T')[0],
    notes: '',
    jobsReferred: '0',
    followUpDate: '',
  });
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">Log Visit</h2>
            <p className="text-sm text-zinc-400">{agent.name} - {agent.company}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Visit Date</label>
              <input
                type="date"
                value={form.visitDate}
                onChange={e => setForm({ ...form, visitDate: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Visited By</label>
              <input
                type="text"
                value={form.visitedBy}
                onChange={e => setForm({ ...form, visitedBy: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Jobs Referred</label>
              <input
                type="number"
                min="0"
                value={form.jobsReferred}
                onChange={e => setForm({ ...form, jobsReferred: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Follow-up Date</label>
              <input
                type="date"
                value={form.followUpDate}
                onChange={e => setForm({ ...form, followUpDate: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Visit Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none resize-none"
              placeholder="What was discussed, any leads mentioned..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-lime-400 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <ClipboardList size={14} />}
              Log Visit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
