'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Voicemail,
  Mail,
  MailOpen,
  Search,
  Filter,
  Share2,
  FileText,
  Clock,
  Trash2,
  ChevronDown,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  MessageSquare,
  Link as LinkIcon,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Phone,
  Users,
  RefreshCw,
  X,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface VoicemailMessage {
  id: string;
  callId: string;
  callerPhone: string;
  callerName: string;
  extension: string;
  timestamp: string;
  duration: number;
  audioUrl: string;
  transcription: string;
  isRead: boolean;
  isUrgent: boolean;
  linkedJobId: string;
  linkedContactId: string;
  sharedWith: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface VoicemailStats {
  total: number;
  unread: number;
  urgent: number;
  avgDuration: number;
  byExtension: { extension: string; total: number; unread: number }[];
}

// =============================================================================
// EXTENSIONS (mirrored for client-side display)
// =============================================================================

const EXTENSIONS = [
  { extension: '101', name: 'Michael Muse' },
  { extension: '102', name: 'Chris Muse' },
  { extension: '103', name: 'Sara Hill' },
  { extension: '104', name: 'Tia' },
  { extension: '105', name: 'Destin' },
  { extension: '106', name: 'John' },
  { extension: '107', name: 'Bart' },
  { extension: '108', name: 'Boston' },
];

const TEAM_MEMBERS = [
  { id: 'michael-muse', name: 'Michael Muse' },
  { id: 'chris-muse', name: 'Chris Muse' },
  { id: 'sara-hill', name: 'Sara Hill' },
  { id: 'tia', name: 'Tia' },
  { id: 'destin', name: 'Destin' },
  { id: 'john', name: 'John' },
  { id: 'bart', name: 'Bart' },
  { id: 'boston', name: 'Boston' },
];

// =============================================================================
// HELPERS
// =============================================================================

function formatDuration(seconds: number): string {
  if (seconds === 0) return '0:00';
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
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
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatFullTimestamp(ts: string): string {
  return new Date(ts).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getExtensionName(ext: string): string {
  const found = EXTENSIONS.find(e => e.extension === ext);
  return found ? found.name : `Ext ${ext}`;
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function VoicemailInboxPage() {
  // State
  const [voicemails, setVoicemails] = useState<VoicemailMessage[]>([]);
  const [stats, setStats] = useState<VoicemailStats>({ total: 0, unread: 0, urgent: 0, avgDuration: 0, byExtension: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterExtension, setFilterExtension] = useState('');
  const [filterRead, setFilterRead] = useState<'' | 'true' | 'false'>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // UI state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [shareDropdownId, setShareDropdownId] = useState<string | null>(null);
  const [linkJobDropdownId, setLinkJobDropdownId] = useState<string | null>(null);
  const [linkJobInput, setLinkJobInput] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // =========================================================================
  // DATA FETCHING
  // =========================================================================

  const fetchVoicemails = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterExtension) params.set('extension', filterExtension);
      if (filterRead) params.set('isRead', filterRead);
      if (filterSearch) params.set('search', filterSearch);
      if (filterStartDate) params.set('startDate', filterStartDate);
      if (filterEndDate) params.set('endDate', filterEndDate);

      const res = await fetch(`/api/voicemail?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch voicemails');

      const data = await res.json();
      setVoicemails(data.voicemails || []);
      setStats(data.stats || { total: 0, unread: 0, urgent: 0, avgDuration: 0, byExtension: [] });
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load voicemails');
    } finally {
      setLoading(false);
    }
  }, [filterExtension, filterRead, filterSearch, filterStartDate, filterEndDate]);

  useEffect(() => {
    fetchVoicemails();
  }, [fetchVoicemails]);

  // =========================================================================
  // ACTIONS
  // =========================================================================

  const markRead = async (id: string, isRead: boolean) => {
    setActionLoading(id);
    try {
      await fetch(`/api/voicemail/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead }),
      });
      await fetchVoicemails();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const markAllRead = async () => {
    setActionLoading('mark-all');
    try {
      // Use a special endpoint pattern - patch with markAllRead flag
      await fetch('/api/voicemail/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true, extension: filterExtension }),
      }).catch(() => {
        // Fallback: mark each individually
        return Promise.all(
          voicemails.filter(vm => !vm.isRead).map(vm =>
            fetch(`/api/voicemail/${vm.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isRead: true }),
            })
          )
        );
      });
      await fetchVoicemails();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const deleteVoicemail = async (id: string) => {
    if (!confirm('Delete this voicemail?')) return;
    setActionLoading(id);
    try {
      await fetch(`/api/voicemail/${id}`, { method: 'DELETE' });
      setExpandedId(null);
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      await fetchVoicemails();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} voicemail(s)?`)) return;
    setActionLoading('delete-selected');
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          fetch(`/api/voicemail/${id}`, { method: 'DELETE' })
        )
      );
      setSelectedIds(new Set());
      setExpandedId(null);
      await fetchVoicemails();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const addNote = async (id: string) => {
    const note = noteInputs[id]?.trim();
    if (!note) return;
    setActionLoading(id);
    try {
      await fetch(`/api/voicemail/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      setNoteInputs(prev => ({ ...prev, [id]: '' }));
      await fetchVoicemails();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const shareWithTeam = async (id: string, userIds: string[]) => {
    setActionLoading(id);
    try {
      await fetch(`/api/voicemail/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sharedWith: userIds }),
      });
      setShareDropdownId(null);
      await fetchVoicemails();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const linkToJob = async (id: string) => {
    if (!linkJobInput.trim()) return;
    setActionLoading(id);
    try {
      await fetch(`/api/voicemail/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedJobId: linkJobInput.trim() }),
      });
      setLinkJobDropdownId(null);
      setLinkJobInput('');
      await fetchVoicemails();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const transcribeVoicemail = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch('/api/voicemail/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      await fetchVoicemails();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  // =========================================================================
  // SELECTION
  // =========================================================================

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === voicemails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(voicemails.map(vm => vm.id)));
    }
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  const unreadCount = voicemails.filter(vm => !vm.isRead).length;

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
                  <Voicemail className="w-5 h-5 text-[#39FF14]" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Voicemail Inbox</h1>
                  <p className="text-sm text-gray-400">
                    {stats.total} voicemail{stats.total !== 1 ? 's' : ''}
                    {stats.unread > 0 && (
                      <span className="ml-2 text-[#39FF14]">
                        ({stats.unread} unread)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchVoicemails}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <Link
                href="/command-center/phone/dashboard"
                className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Voicemail className="w-4 h-4" />
              Total
            </div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#39FF14] text-sm mb-1">
              <Mail className="w-4 h-4" />
              Unread
            </div>
            <div className="text-2xl font-bold text-[#39FF14]">{stats.unread}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-red-400 text-sm mb-1">
              <AlertCircle className="w-4 h-4" />
              Urgent
            </div>
            <div className="text-2xl font-bold text-red-400">{stats.urgent}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Clock className="w-4 h-4" />
              Avg Duration
            </div>
            <div className="text-2xl font-bold">{formatDuration(stats.avgDuration)}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search voicemails..."
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50 focus:ring-1 focus:ring-[#39FF14]/25"
              />
            </div>

            {/* Extension Filter */}
            <select
              value={filterExtension}
              onChange={e => setFilterExtension(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#39FF14]/50"
            >
              <option value="">All Extensions</option>
              {EXTENSIONS.map(ext => (
                <option key={ext.extension} value={ext.extension}>
                  {ext.extension} - {ext.name}
                </option>
              ))}
            </select>

            {/* Read/Unread Filter */}
            <select
              value={filterRead}
              onChange={e => setFilterRead(e.target.value as '' | 'true' | 'false')}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#39FF14]/50"
            >
              <option value="">All Messages</option>
              <option value="false">Unread Only</option>
              <option value="true">Read Only</option>
            </select>

            {/* Date Range */}
            <input
              type="date"
              value={filterStartDate}
              onChange={e => setFilterStartDate(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#39FF14]/50"
              placeholder="Start date"
            />
            <input
              type="date"
              value={filterEndDate}
              onChange={e => setFilterEndDate(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#39FF14]/50"
              placeholder="End date"
            />

            {/* Clear Filters */}
            {(filterExtension || filterRead || filterSearch || filterStartDate || filterEndDate) && (
              <button
                onClick={() => {
                  setFilterExtension('');
                  setFilterRead('');
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

        {/* Bulk Actions */}
        {voicemails.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.size === voicemails.length && voicemails.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-[#39FF14] focus:ring-[#39FF14]/25"
                />
                Select All
              </label>
              {selectedIds.size > 0 && (
                <span className="text-sm text-gray-500">
                  {selectedIds.size} selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={actionLoading === 'mark-all'}
                  className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4 inline mr-1" />
                  Mark All Read
                </button>
              )}
              {selectedIds.size > 0 && (
                <button
                  onClick={deleteSelected}
                  disabled={actionLoading === 'delete-selected'}
                  className="px-3 py-1.5 rounded-lg bg-red-900/50 hover:bg-red-900 text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4 inline mr-1" />
                  Delete Selected
                </button>
              )}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-6 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-20">
            <RefreshCw className="w-8 h-8 text-gray-600 animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Loading voicemails...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && voicemails.length === 0 && (
          <div className="text-center py-20">
            <Voicemail className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-400 mb-2">No Voicemails</h3>
            <p className="text-sm text-gray-600">
              {filterSearch || filterExtension || filterRead
                ? 'No voicemails match your filters. Try adjusting your search criteria.'
                : 'Your voicemail inbox is empty. New voicemails will appear here.'}
            </p>
          </div>
        )}

        {/* Voicemail List */}
        {!loading && voicemails.length > 0 && (
          <div className="space-y-2">
            {voicemails.map(vm => {
              const isExpanded = expandedId === vm.id;
              const isSelected = selectedIds.has(vm.id);

              return (
                <div
                  key={vm.id}
                  className={`bg-gray-900 border rounded-xl transition-all ${
                    vm.isRead
                      ? 'border-gray-800'
                      : 'border-[#39FF14]/30 bg-gray-900/80'
                  } ${isSelected ? 'ring-1 ring-[#39FF14]/40' : ''}`}
                >
                  {/* Row Header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-800/50 transition-colors rounded-xl"
                    onClick={() => {
                      setExpandedId(isExpanded ? null : vm.id);
                      if (!vm.isRead && !isExpanded) {
                        markRead(vm.id, true);
                      }
                    }}
                  >
                    {/* Select Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={e => {
                        e.stopPropagation();
                        toggleSelect(vm.id);
                      }}
                      onClick={e => e.stopPropagation()}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-[#39FF14] focus:ring-[#39FF14]/25 flex-shrink-0"
                    />

                    {/* Read/Unread Icon */}
                    <div className="flex-shrink-0">
                      {vm.isRead ? (
                        <MailOpen className="w-5 h-5 text-gray-600" />
                      ) : (
                        <Mail className="w-5 h-5 text-[#39FF14]" />
                      )}
                    </div>

                    {/* Urgent Badge */}
                    {vm.isUrgent && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-900/50 text-red-400 border border-red-800">
                        Urgent
                      </span>
                    )}

                    {/* Caller Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium truncate ${vm.isRead ? 'text-gray-300' : 'text-white'}`}>
                          {vm.callerName || 'Unknown Caller'}
                        </span>
                        <span className="text-sm text-gray-500 flex-shrink-0">
                          {formatPhone(vm.callerPhone)}
                        </span>
                      </div>
                      {vm.transcription && (
                        <p className="text-sm text-gray-500 truncate mt-0.5">
                          {vm.transcription.slice(0, 100)}
                          {vm.transcription.length > 100 ? '...' : ''}
                        </p>
                      )}
                    </div>

                    {/* Extension */}
                    <div className="hidden sm:block text-sm text-gray-500 flex-shrink-0">
                      <Phone className="w-3 h-3 inline mr-1" />
                      {getExtensionName(vm.extension)}
                    </div>

                    {/* Duration */}
                    <div className="text-sm text-gray-500 flex-shrink-0">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {formatDuration(vm.duration)}
                    </div>

                    {/* Time */}
                    <div className="text-sm text-gray-500 flex-shrink-0 w-20 text-right">
                      {formatTimestamp(vm.timestamp)}
                    </div>

                    {/* Linked Badge */}
                    {vm.linkedJobId && (
                      <span className="flex-shrink-0" title={`Linked to job ${vm.linkedJobId}`}>
                        <LinkIcon className="w-4 h-4 text-blue-400" />
                      </span>
                    )}

                    {/* Shared Badge */}
                    {vm.sharedWith.length > 0 && (
                      <span className="flex-shrink-0" title={`Shared with ${vm.sharedWith.length}`}>
                        <Users className="w-4 h-4 text-purple-400" />
                      </span>
                    )}

                    {/* Expand Arrow */}
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    )}
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-gray-800 px-4 py-4 space-y-4">
                      {/* Full Timestamp */}
                      <div className="text-xs text-gray-500">
                        {formatFullTimestamp(vm.timestamp)} | Extension: {vm.extension} ({getExtensionName(vm.extension)}) | Duration: {formatDuration(vm.duration)}
                      </div>

                      {/* Audio Player Placeholder */}
                      <div className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
                        <button
                          onClick={() => setPlayingId(playingId === vm.id ? null : vm.id)}
                          className="w-10 h-10 rounded-full bg-[#39FF14]/10 flex items-center justify-center hover:bg-[#39FF14]/20 transition-colors flex-shrink-0"
                        >
                          {playingId === vm.id ? (
                            <Pause className="w-5 h-5 text-[#39FF14]" />
                          ) : (
                            <Play className="w-5 h-5 text-[#39FF14] ml-0.5" />
                          )}
                        </button>
                        <div className="flex-1">
                          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#39FF14] rounded-full transition-all"
                              style={{ width: playingId === vm.id ? '45%' : '0%' }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>{playingId === vm.id ? '0:' + Math.floor(vm.duration * 0.45).toString().padStart(2, '0') : '0:00'}</span>
                            <span>{formatDuration(vm.duration)}</span>
                          </div>
                        </div>
                        <Volume2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        {vm.audioUrl ? (
                          <span className="text-xs text-gray-500">Audio available</span>
                        ) : (
                          <span className="text-xs text-gray-600">No audio file</span>
                        )}
                      </div>

                      {/* Transcription */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-300 flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            Transcription
                          </h4>
                          {!vm.transcription && (
                            <button
                              onClick={() => transcribeVoicemail(vm.id)}
                              disabled={actionLoading === vm.id}
                              className="text-xs px-2 py-1 rounded bg-[#39FF14]/10 text-[#39FF14] hover:bg-[#39FF14]/20 transition-colors disabled:opacity-50"
                            >
                              {actionLoading === vm.id ? 'Transcribing...' : 'Transcribe'}
                            </button>
                          )}
                        </div>
                        {vm.transcription ? (
                          <div className="bg-gray-800 rounded-lg p-3 text-sm text-gray-300 leading-relaxed">
                            {vm.transcription}
                          </div>
                        ) : (
                          <div className="bg-gray-800 rounded-lg p-3 text-sm text-gray-600 italic">
                            No transcription available. Click &quot;Transcribe&quot; to generate one.
                          </div>
                        )}
                      </div>

                      {/* Notes */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-300 flex items-center gap-1 mb-2">
                          <MessageSquare className="w-4 h-4" />
                          Notes
                        </h4>
                        {vm.notes ? (
                          <div className="bg-gray-800 rounded-lg p-3 text-sm text-gray-300 whitespace-pre-wrap mb-2">
                            {vm.notes}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600 mb-2">No notes yet.</p>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={noteInputs[vm.id] || ''}
                            onChange={e => setNoteInputs(prev => ({ ...prev, [vm.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') addNote(vm.id); }}
                            placeholder="Add a note..."
                            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50"
                          />
                          <button
                            onClick={() => addNote(vm.id)}
                            disabled={!noteInputs[vm.id]?.trim() || actionLoading === vm.id}
                            className="px-3 py-2 rounded-lg bg-[#39FF14]/10 text-[#39FF14] text-sm hover:bg-[#39FF14]/20 transition-colors disabled:opacity-50"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-800">
                        {/* Mark Read/Unread */}
                        <button
                          onClick={() => markRead(vm.id, !vm.isRead)}
                          className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 hover:text-white transition-colors flex items-center gap-1"
                        >
                          {vm.isRead ? (
                            <>
                              <Mail className="w-3.5 h-3.5" />
                              Mark Unread
                            </>
                          ) : (
                            <>
                              <MailOpen className="w-3.5 h-3.5" />
                              Mark Read
                            </>
                          )}
                        </button>

                        {/* Share */}
                        <div className="relative">
                          <button
                            onClick={() => setShareDropdownId(shareDropdownId === vm.id ? null : vm.id)}
                            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 hover:text-white transition-colors flex items-center gap-1"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            Share
                          </button>
                          {shareDropdownId === vm.id && (
                            <div className="absolute left-0 top-full mt-1 z-20 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-2">
                              <div className="text-xs text-gray-500 px-2 mb-1">Share with:</div>
                              {TEAM_MEMBERS.map(member => (
                                <button
                                  key={member.id}
                                  onClick={() => shareWithTeam(vm.id, [member.id])}
                                  className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-700 transition-colors ${
                                    vm.sharedWith.includes(member.id) ? 'text-[#39FF14]' : 'text-gray-300'
                                  }`}
                                >
                                  {member.name}
                                  {vm.sharedWith.includes(member.id) && (
                                    <CheckCircle className="w-3 h-3 inline ml-1" />
                                  )}
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
                            onClick={() => setLinkJobDropdownId(linkJobDropdownId === vm.id ? null : vm.id)}
                            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 hover:text-white transition-colors flex items-center gap-1"
                          >
                            <LinkIcon className="w-3.5 h-3.5" />
                            {vm.linkedJobId ? `Job: ${vm.linkedJobId}` : 'Link to Job'}
                          </button>
                          {linkJobDropdownId === vm.id && (
                            <div className="absolute left-0 top-full mt-1 z-20 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3">
                              <div className="text-xs text-gray-500 mb-2">Enter JobNimbus Job ID:</div>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={linkJobInput}
                                  onChange={e => setLinkJobInput(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') linkToJob(vm.id); }}
                                  placeholder="e.g. JN-12345"
                                  className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50"
                                />
                                <button
                                  onClick={() => linkToJob(vm.id)}
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

                        {/* Delete */}
                        <button
                          onClick={() => deleteVoicemail(vm.id)}
                          disabled={actionLoading === vm.id}
                          className="px-3 py-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-sm text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>

                      {/* Shared With / Linked Info */}
                      {(vm.sharedWith.length > 0 || vm.linkedJobId) && (
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                          {vm.sharedWith.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              Shared with: {vm.sharedWith.map(id => TEAM_MEMBERS.find(m => m.id === id)?.name || id).join(', ')}
                            </span>
                          )}
                          {vm.linkedJobId && (
                            <span className="flex items-center gap-1">
                              <LinkIcon className="w-3 h-3" />
                              Linked to job: {vm.linkedJobId}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
