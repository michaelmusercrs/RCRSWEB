'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Voicemail,
  Search,
  Filter,
  Share2,
  FileText,
  Clock,
  Users,
  Trash2,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Link as LinkIcon,
  Tag,
  BarChart3,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  RefreshCw,
  Plus,
  Mail,
  Activity,
  Headphones,
  PhoneOff,
  X,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface CallRecord {
  callId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  repId: string;
  repName: string;
  repExtension: string;
  direction: 'inbound' | 'outbound';
  status: string;
  startTime: string;
  endTime: string;
  duration: number;
  recordingUrl: string;
  recordingAvailable: boolean;
  notes: string;
  tags: string[];
  jobNimbusContactId: string;
  createdAt: string;
  updatedAt: string;
}

interface CallStats {
  totalCalls: number;
  totalDuration: number;
  inboundCalls: number;
  outboundCalls: number;
  missedCalls: number;
  completedCalls: number;
  averageDuration: number;
  lastUpdated: string;
}

interface ExtensionInfo {
  extension: string;
  name: string;
  email: string;
  role: string;
  voicemailEnabled: boolean;
  status: 'online' | 'busy' | 'offline' | 'dnd' | 'ringing';
  userId?: string;
  department?: string;
}

// =============================================================================
// EXTENSION DATA (client-side mirror)
// =============================================================================

const EXTENSIONS: ExtensionInfo[] = [
  { extension: '101', name: 'Michael Muse', email: 'michaelmuse@rivercityroofingsolutions.com', role: 'Owner', voicemailEnabled: true, status: 'online', userId: 'michael-muse', department: 'Executive' },
  { extension: '102', name: 'Chris Muse', email: 'chrismuse@rivercityroofingsolutions.com', role: 'Owner', voicemailEnabled: true, status: 'online', userId: 'chris-muse', department: 'Executive' },
  { extension: '103', name: 'Sara Hill', email: 'sara@rivercityroofingsolutions.com', role: 'Admin', voicemailEnabled: true, status: 'online', userId: 'sara-hill', department: 'Administration' },
  { extension: '104', name: 'Tia', email: 'tia@rivercityroofingsolutions.com', role: 'User', voicemailEnabled: true, status: 'online', userId: 'tia', department: 'Office' },
  { extension: '105', name: 'Destin', email: 'destin@rivercityroofingsolutions.com', role: 'Manager', voicemailEnabled: true, status: 'online', userId: 'destin', department: 'Operations' },
  { extension: '106', name: 'John', email: 'john@rivercityroofingsolutions.com', role: 'User', voicemailEnabled: true, status: 'offline', userId: 'john', department: 'Office' },
  { extension: '107', name: 'Bart', email: 'bart@rivercityroofingsolutions.com', role: 'User', voicemailEnabled: true, status: 'offline', userId: 'bart', department: 'Office' },
  { extension: '108', name: 'Boston', email: 'boston@rivercityroofingsolutions.com', role: 'User', voicemailEnabled: true, status: 'offline', userId: 'boston', department: 'Office' },
];

const TEAM_MEMBERS = EXTENSIONS.map(ext => ({ id: ext.userId || ext.extension, name: ext.name }));

// =============================================================================
// HELPERS
// =============================================================================

function formatDuration(seconds: number): string {
  if (seconds === 0) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const min = Math.floor((seconds % 3600) / 60);
  const sec = seconds % 60;
  if (hours > 0) return `${hours}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^1/, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'bg-green-500/10 text-green-400 border-green-500/20';
    case 'missed': return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'voicemail': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'ringing': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'in_progress': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'failed': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  }
}

function getDirectionIcon(direction: string, status: string) {
  if (status === 'missed') return <PhoneMissed className="w-4 h-4 text-red-400" />;
  if (status === 'voicemail') return <Voicemail className="w-4 h-4 text-purple-400" />;
  if (direction === 'inbound') return <PhoneIncoming className="w-4 h-4 text-[#39FF14]" />;
  return <PhoneOutgoing className="w-4 h-4 text-blue-400" />;
}

function getExtStatusColor(status: string): string {
  switch (status) {
    case 'online': return 'bg-[#39FF14]';
    case 'busy': return 'bg-red-500';
    case 'ringing': return 'bg-yellow-500 animate-pulse';
    case 'dnd': return 'bg-orange-500';
    default: return 'bg-gray-600';
  }
}

function getExtStatusLabel(status: string): string {
  switch (status) {
    case 'online': return 'Online';
    case 'busy': return 'Busy';
    case 'ringing': return 'Ringing';
    case 'dnd': return 'DND';
    default: return 'Offline';
  }
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function PhoneDashboardPage() {
  // Data state
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [callStats, setCallStats] = useState<CallStats | null>(null);
  const [unreadVoicemails, setUnreadVoicemails] = useState(0);
  const [totalVoicemails, setTotalVoicemails] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterDirection, setFilterDirection] = useState<'' | 'inbound' | 'outbound'>('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRep, setFilterRep] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // UI
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [shareDropdownId, setShareDropdownId] = useState<string | null>(null);
  const [linkJobDropdownId, setLinkJobDropdownId] = useState<string | null>(null);
  const [linkJobInput, setLinkJobInput] = useState('');
  const [tagInput, setTagInput] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showLogCall, setShowLogCall] = useState(false);

  // Log call form
  const [logCallForm, setLogCallForm] = useState({
    customerName: '',
    customerPhone: '',
    repName: '',
    repExtension: '',
    direction: 'outbound' as 'inbound' | 'outbound',
    duration: 0,
    notes: '',
  });

  // =========================================================================
  // DATA FETCHING
  // =========================================================================

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch calls and voicemail stats in parallel
      const params = new URLSearchParams();
      params.set('limit', '20');
      if (filterDirection) params.set('direction', filterDirection);
      if (filterStatus) params.set('status', filterStatus);
      if (filterRep) params.set('repExtension', filterRep);
      if (filterSearch) params.set('search', filterSearch);
      if (filterStartDate) params.set('startDate', filterStartDate);
      if (filterEndDate) params.set('endDate', filterEndDate);

      const [callsRes, vmRes] = await Promise.all([
        fetch(`/api/calls?${params.toString()}`).then(r => r.json()).catch(() => ({ calls: [], stats: null })),
        fetch('/api/voicemail').then(r => r.json()).catch(() => ({ stats: { unread: 0, total: 0 } })),
      ]);

      setCalls(callsRes.calls || []);
      setCallStats(callsRes.stats || null);
      setUnreadVoicemails(vmRes.stats?.unread || 0);
      setTotalVoicemails(vmRes.stats?.total || 0);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [filterDirection, filterStatus, filterRep, filterSearch, filterStartDate, filterEndDate]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // =========================================================================
  // CALL ACTIONS
  // =========================================================================

  const addCallNote = async (callId: string) => {
    const note = noteInputs[callId]?.trim();
    if (!note) return;
    setActionLoading(callId);
    try {
      await fetch('/api/calls/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId, note, author: 'Admin' }),
      });
      // Also update the call record's notes
      await fetch(`/api/calls/${callId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: note }),
      });
      setNoteInputs(prev => ({ ...prev, [callId]: '' }));
      await fetchDashboardData();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const shareCall = async (callId: string, userId: string) => {
    setActionLoading(callId);
    try {
      await fetch('/api/calls/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId, shareWith: [userId], sharedBy: 'Admin' }),
      });
      setShareDropdownId(null);
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const linkCallToJob = async (callId: string) => {
    if (!linkJobInput.trim()) return;
    setActionLoading(callId);
    try {
      await fetch(`/api/calls/${callId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobNimbusContactId: linkJobInput.trim() }),
      });
      setLinkJobDropdownId(null);
      setLinkJobInput('');
      await fetchDashboardData();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const addTag = async (callId: string) => {
    const tag = tagInput[callId]?.trim();
    if (!tag) return;
    const call = calls.find(c => c.callId === callId);
    if (!call) return;
    setActionLoading(callId);
    try {
      await fetch(`/api/calls/${callId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: [...new Set([...call.tags, tag])] }),
      });
      setTagInput(prev => ({ ...prev, [callId]: '' }));
      await fetchDashboardData();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const logManualCall = async () => {
    if (!logCallForm.customerPhone) return;
    setActionLoading('log-call');
    try {
      await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: logCallForm.customerName || 'Unknown',
          customerPhone: logCallForm.customerPhone,
          repName: logCallForm.repName,
          repExtension: logCallForm.repExtension,
          direction: logCallForm.direction,
          duration: logCallForm.duration,
          notes: logCallForm.notes,
          status: 'completed',
        }),
      });
      setShowLogCall(false);
      setLogCallForm({
        customerName: '',
        customerPhone: '',
        repName: '',
        repExtension: '',
        direction: 'outbound',
        duration: 0,
        notes: '',
      });
      await fetchDashboardData();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  // =========================================================================
  // COMPUTED VALUES
  // =========================================================================

  const todayCalls = calls.filter(c => c.startTime && c.startTime.startsWith(new Date().toISOString().slice(0, 10)));
  const missedToday = todayCalls.filter(c => c.status === 'missed').length;
  const onlineExtensions = EXTENSIONS.filter(e => e.status === 'online').length;
  const busyExtensions = EXTENSIONS.filter(e => e.status === 'busy').length;
  const avgDuration = callStats?.averageDuration || 0;

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/command-center/phone"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#39FF14]/10 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-[#39FF14]" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Phone Dashboard</h1>
                  <p className="text-sm text-gray-400">
                    Real-time call management and analytics
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchDashboardData}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowLogCall(true)}
                className="px-3 py-2 rounded-lg bg-[#39FF14]/10 hover:bg-[#39FF14]/20 text-[#39FF14] text-sm font-medium transition-colors flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Log Call
              </button>
              <Link
                href="/command-center/phone/voicemail"
                className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 hover:text-white transition-colors relative"
              >
                <Voicemail className="w-4 h-4 inline mr-1" />
                Voicemail
                {unreadVoicemails > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#39FF14] text-gray-900 text-[10px] font-bold flex items-center justify-center">
                    {unreadVoicemails > 9 ? '9+' : unreadVoicemails}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Phone className="w-4 h-4" />
              Calls Today
            </div>
            <div className="text-2xl font-bold">{todayCalls.length}</div>
            <div className="text-xs text-gray-500 mt-1">
              {callStats?.totalCalls || 0} total
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-red-400 text-sm mb-1">
              <PhoneMissed className="w-4 h-4" />
              Missed
            </div>
            <div className="text-2xl font-bold text-red-400">{missedToday}</div>
            <div className="text-xs text-gray-500 mt-1">
              {callStats?.missedCalls || 0} total
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-purple-400 text-sm mb-1">
              <Voicemail className="w-4 h-4" />
              Voicemails
            </div>
            <div className="text-2xl font-bold text-purple-400">{totalVoicemails}</div>
            <div className="text-xs text-gray-500 mt-1">
              {unreadVoicemails > 0 && (
                <span className="text-[#39FF14]">{unreadVoicemails} unread</span>
              )}
              {unreadVoicemails === 0 && 'All read'}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Clock className="w-4 h-4" />
              Avg Duration
            </div>
            <div className="text-2xl font-bold">{formatDuration(avgDuration)}</div>
            <div className="text-xs text-gray-500 mt-1">per completed call</div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#39FF14] text-sm mb-1">
              <Activity className="w-4 h-4" />
              Extensions
            </div>
            <div className="text-2xl font-bold text-[#39FF14]">{onlineExtensions}</div>
            <div className="text-xs text-gray-500 mt-1">
              {busyExtensions > 0 ? `${busyExtensions} busy, ` : ''}
              {EXTENSIONS.length - onlineExtensions - busyExtensions} offline
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content - Recent Calls */}
          <div className="lg:col-span-2 space-y-4">
            {/* Call Filters */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search calls..."
                    value={filterSearch}
                    onChange={e => setFilterSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50 focus:ring-1 focus:ring-[#39FF14]/25"
                  />
                </div>

                {/* Direction */}
                <select
                  value={filterDirection}
                  onChange={e => setFilterDirection(e.target.value as '' | 'inbound' | 'outbound')}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#39FF14]/50"
                >
                  <option value="">All Directions</option>
                  <option value="inbound">Inbound</option>
                  <option value="outbound">Outbound</option>
                </select>

                {/* Status */}
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#39FF14]/50"
                >
                  <option value="">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="missed">Missed</option>
                  <option value="voicemail">Voicemail</option>
                  <option value="in_progress">In Progress</option>
                  <option value="ringing">Ringing</option>
                  <option value="failed">Failed</option>
                </select>

                {/* Rep */}
                <select
                  value={filterRep}
                  onChange={e => setFilterRep(e.target.value)}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#39FF14]/50"
                >
                  <option value="">All Reps</option>
                  {EXTENSIONS.map(ext => (
                    <option key={ext.extension} value={ext.extension}>
                      {ext.name}
                    </option>
                  ))}
                </select>

                {/* Date Range */}
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={e => setFilterStartDate(e.target.value)}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#39FF14]/50"
                />
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={e => setFilterEndDate(e.target.value)}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#39FF14]/50"
                />

                {/* Clear */}
                {(filterDirection || filterStatus || filterRep || filterSearch || filterStartDate || filterEndDate) && (
                  <button
                    onClick={() => {
                      setFilterDirection('');
                      setFilterStatus('');
                      setFilterRep('');
                      setFilterSearch('');
                      setFilterStartDate('');
                      setFilterEndDate('');
                    }}
                    className="px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Recent Calls Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Phone className="w-5 h-5 text-[#39FF14]" />
                Recent Calls
              </h2>
              <Link
                href="/command-center/phone/calls"
                className="text-sm text-[#39FF14] hover:text-[#39FF14]/80 transition-colors"
              >
                View All
              </Link>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="text-center py-16">
                <RefreshCw className="w-8 h-8 text-gray-600 animate-spin mx-auto mb-3" />
                <p className="text-gray-500">Loading calls...</p>
              </div>
            )}

            {/* Empty State */}
            {!loading && calls.length === 0 && (
              <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-xl">
                <Phone className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-400 mb-2">No Calls Found</h3>
                <p className="text-sm text-gray-600">
                  {filterSearch || filterDirection || filterStatus || filterRep
                    ? 'No calls match your filters.'
                    : 'No call records yet. Calls will appear here automatically.'}
                </p>
              </div>
            )}

            {/* Call List */}
            {!loading && calls.length > 0 && (
              <div className="space-y-2">
                {calls.map(call => {
                  const isExpanded = expandedCallId === call.callId;

                  return (
                    <div
                      key={call.callId}
                      className="bg-gray-900 border border-gray-800 rounded-xl transition-all hover:border-gray-700"
                    >
                      {/* Call Row */}
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                        onClick={() => setExpandedCallId(isExpanded ? null : call.callId)}
                      >
                        {/* Direction Icon */}
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                          {getDirectionIcon(call.direction, call.status)}
                        </div>

                        {/* Caller/Callee */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white truncate">
                              {call.customerName || 'Unknown'}
                            </span>
                            <span className="text-sm text-gray-500">
                              {formatPhone(call.customerPhone)}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {call.direction === 'inbound' ? 'Received by' : 'Called by'} {call.repName || 'Unknown'}
                            {call.repExtension ? ` (ext ${call.repExtension})` : ''}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border flex-shrink-0 ${getStatusColor(call.status)}`}>
                          {call.status.replace('_', ' ')}
                        </span>

                        {/* Duration */}
                        <div className="text-sm text-gray-500 flex-shrink-0 w-14 text-right">
                          {call.duration > 0 ? formatDuration(call.duration) : '--'}
                        </div>

                        {/* Time */}
                        <div className="text-sm text-gray-500 flex-shrink-0 w-20 text-right">
                          {formatTimestamp(call.startTime)}
                        </div>

                        {/* Tags indicator */}
                        {call.tags.length > 0 && (
                          <Tag className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                        )}

                        {/* JN Link indicator */}
                        {call.jobNimbusContactId && (
                          <LinkIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        )}

                        {/* Expand */}
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        )}
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t border-gray-800 px-4 py-4 space-y-4">
                          {/* Call Details */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div>
                              <span className="text-gray-500 block text-xs">Direction</span>
                              <span className="text-white capitalize">{call.direction}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-xs">Status</span>
                              <span className="text-white capitalize">{call.status.replace('_', ' ')}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-xs">Duration</span>
                              <span className="text-white">{formatDuration(call.duration)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-xs">Extension</span>
                              <span className="text-white">{call.repExtension || 'N/A'}</span>
                            </div>
                          </div>

                          {/* Tags */}
                          <div>
                            <span className="text-xs text-gray-500 block mb-1">Tags</span>
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {call.tags.map(tag => (
                                <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-gray-800 text-gray-300 border border-gray-700">
                                  {tag}
                                </span>
                              ))}
                              <div className="flex gap-1 items-center">
                                <input
                                  type="text"
                                  value={tagInput[call.callId] || ''}
                                  onChange={e => setTagInput(prev => ({ ...prev, [call.callId]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter') addTag(call.callId); }}
                                  placeholder="Add tag..."
                                  className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded-full text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#39FF14]/50 w-24"
                                />
                                {tagInput[call.callId]?.trim() && (
                                  <button
                                    onClick={() => addTag(call.callId)}
                                    className="text-[#39FF14] text-xs hover:text-[#39FF14]/80"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Notes */}
                          <div>
                            <span className="text-xs text-gray-500 block mb-1">Notes</span>
                            {call.notes && (
                              <div className="bg-gray-800 rounded-lg p-2 text-sm text-gray-300 mb-2">
                                {call.notes}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={noteInputs[call.callId] || ''}
                                onChange={e => setNoteInputs(prev => ({ ...prev, [call.callId]: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') addCallNote(call.callId); }}
                                placeholder="Add a note..."
                                className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50"
                              />
                              <button
                                onClick={() => addCallNote(call.callId)}
                                disabled={!noteInputs[call.callId]?.trim() || actionLoading === call.callId}
                                className="px-3 py-1.5 rounded-lg bg-[#39FF14]/10 text-[#39FF14] text-sm hover:bg-[#39FF14]/20 disabled:opacity-50"
                              >
                                Save
                              </button>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-800">
                            {/* Share */}
                            <div className="relative">
                              <button
                                onClick={() => setShareDropdownId(shareDropdownId === call.callId ? null : call.callId)}
                                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 hover:text-white transition-colors flex items-center gap-1"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                                Share
                              </button>
                              {shareDropdownId === call.callId && (
                                <div className="absolute left-0 top-full mt-1 z-20 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-2">
                                  <div className="text-xs text-gray-500 px-2 mb-1">Share with:</div>
                                  {TEAM_MEMBERS.map(member => (
                                    <button
                                      key={member.id}
                                      onClick={() => shareCall(call.callId, member.id)}
                                      className="w-full text-left px-2 py-1.5 rounded text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                                    >
                                      {member.name}
                                    </button>
                                  ))}
                                  <button
                                    onClick={() => setShareDropdownId(null)}
                                    className="w-full text-left px-2 py-1.5 rounded text-sm text-gray-500 hover:bg-gray-700 transition-colors mt-1 border-t border-gray-700 pt-2"
                                  >
                                    Close
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Link to Job */}
                            <div className="relative">
                              <button
                                onClick={() => setLinkJobDropdownId(linkJobDropdownId === call.callId ? null : call.callId)}
                                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 hover:text-white transition-colors flex items-center gap-1"
                              >
                                <LinkIcon className="w-3.5 h-3.5" />
                                {call.jobNimbusContactId ? `JN: ${call.jobNimbusContactId}` : 'Link to Job'}
                              </button>
                              {linkJobDropdownId === call.callId && (
                                <div className="absolute left-0 top-full mt-1 z-20 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3">
                                  <div className="text-xs text-gray-500 mb-2">Enter JobNimbus Contact/Job ID:</div>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={linkJobInput}
                                      onChange={e => setLinkJobInput(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter') linkCallToJob(call.callId); }}
                                      placeholder="e.g. JN-12345"
                                      className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50"
                                    />
                                    <button
                                      onClick={() => linkCallToJob(call.callId)}
                                      disabled={!linkJobInput.trim()}
                                      className="px-2 py-1.5 rounded bg-[#39FF14]/10 text-[#39FF14] text-sm hover:bg-[#39FF14]/20 disabled:opacity-50"
                                    >
                                      Link
                                    </button>
                                  </div>
                                  <button
                                    onClick={() => { setLinkJobDropdownId(null); setLinkJobInput(''); }}
                                    className="text-xs text-gray-500 hover:text-gray-300 mt-2"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Click-to-Call */}
                            <a
                              href={`tel:${call.customerPhone}`}
                              className="px-3 py-1.5 rounded-lg bg-[#39FF14]/10 hover:bg-[#39FF14]/20 text-sm text-[#39FF14] transition-colors flex items-center gap-1 ml-auto"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              {formatPhone(call.customerPhone)}
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Extension Status Panel */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Headphones className="w-4 h-4 text-[#39FF14]" />
                Extension Status
              </h3>
              <div className="space-y-2">
                {EXTENSIONS.map(ext => (
                  <Link
                    key={ext.extension}
                    href={`/command-center/phone/${ext.extension}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors group"
                  >
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-medium text-gray-400 group-hover:text-white">
                        {ext.extension}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-900 ${getExtStatusColor(ext.status)}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-300 group-hover:text-white truncate">{ext.name}</div>
                      <div className="text-[11px] text-gray-600">{ext.department}</div>
                    </div>
                    <span className={`text-[11px] ${
                      ext.status === 'online' ? 'text-[#39FF14]' :
                      ext.status === 'busy' ? 'text-red-400' :
                      ext.status === 'dnd' ? 'text-orange-400' :
                      'text-gray-600'
                    }`}>
                      {getExtStatusLabel(ext.status)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Voicemail Widget */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <Voicemail className="w-4 h-4 text-purple-400" />
                  Voicemail
                </h3>
                {unreadVoicemails > 0 && (
                  <span className="w-6 h-6 rounded-full bg-[#39FF14] text-gray-900 text-xs font-bold flex items-center justify-center">
                    {unreadVoicemails}
                  </span>
                )}
              </div>
              <div className="bg-gray-800 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Total</span>
                  <span className="text-white font-medium">{totalVoicemails}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-gray-400">Unread</span>
                  <span className={`font-medium ${unreadVoicemails > 0 ? 'text-[#39FF14]' : 'text-white'}`}>{unreadVoicemails}</span>
                </div>
              </div>
              <Link
                href="/command-center/phone/voicemail"
                className="block w-full text-center px-3 py-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-sm font-medium transition-colors"
              >
                Open Voicemail Inbox
              </Link>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#39FF14]" />
                Quick Actions
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => setShowLogCall(true)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 hover:text-white transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4 text-[#39FF14]" />
                  Log Manual Call
                </button>
                <Link
                  href="/command-center/phone/calls"
                  className="block w-full text-left px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 hover:text-white transition-colors"
                >
                  <FileText className="w-4 h-4 inline mr-2 text-gray-500" />
                  View Full Call Log
                </Link>
                <Link
                  href="/command-center/phone/manage"
                  className="block w-full text-left px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 hover:text-white transition-colors"
                >
                  <Users className="w-4 h-4 inline mr-2 text-gray-500" />
                  Manage Extensions
                </Link>
              </div>
            </div>

            {/* Call Stats Summary */}
            {callStats && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  Overall Stats
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Calls</span>
                    <span className="text-white">{callStats.totalCalls}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Inbound</span>
                    <span className="text-[#39FF14]">{callStats.inboundCalls}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Outbound</span>
                    <span className="text-blue-400">{callStats.outboundCalls}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Completed</span>
                    <span className="text-white">{callStats.completedCalls}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Missed</span>
                    <span className="text-red-400">{callStats.missedCalls}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-800">
                    <span className="text-gray-500">Total Duration</span>
                    <span className="text-white">{formatDuration(callStats.totalDuration)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Log Call Modal */}
      {showLogCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg mx-4 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Phone className="w-5 h-5 text-[#39FF14]" />
                Log Manual Call
              </h2>
              <button
                onClick={() => setShowLogCall(false)}
                className="p-1 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={logCallForm.customerName}
                    onChange={e => setLogCallForm(prev => ({ ...prev, customerName: e.target.value }))}
                    placeholder="Name"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    value={logCallForm.customerPhone}
                    onChange={e => setLogCallForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                    placeholder="(256) 555-1234"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Direction</label>
                  <select
                    value={logCallForm.direction}
                    onChange={e => setLogCallForm(prev => ({ ...prev, direction: e.target.value as 'inbound' | 'outbound' }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#39FF14]/50"
                  >
                    <option value="outbound">Outbound</option>
                    <option value="inbound">Inbound</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Duration (seconds)</label>
                  <input
                    type="number"
                    value={logCallForm.duration}
                    onChange={e => setLogCallForm(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                    min={0}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Rep Name</label>
                  <select
                    value={logCallForm.repExtension}
                    onChange={e => {
                      const ext = EXTENSIONS.find(x => x.extension === e.target.value);
                      setLogCallForm(prev => ({
                        ...prev,
                        repExtension: e.target.value,
                        repName: ext?.name || '',
                      }));
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#39FF14]/50"
                  >
                    <option value="">Select Rep</option>
                    {EXTENSIONS.map(ext => (
                      <option key={ext.extension} value={ext.extension}>
                        {ext.name} ({ext.extension})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Extension</label>
                  <input
                    type="text"
                    value={logCallForm.repExtension}
                    readOnly
                    className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <textarea
                  value={logCallForm.notes}
                  onChange={e => setLogCallForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Call notes..."
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowLogCall(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={logManualCall}
                  disabled={!logCallForm.customerPhone || actionLoading === 'log-call'}
                  className="flex-1 px-4 py-2 rounded-lg bg-[#39FF14] hover:bg-[#39FF14]/90 text-gray-900 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'log-call' ? 'Saving...' : 'Log Call'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
