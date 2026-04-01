'use client';

/**
 * RCRS Command Center - Call Log Page
 *
 * Full call history with:
 * - Searchable, filterable call table
 * - Filters by date range, direction, extension, status
 * - Call stats summary
 * - Pagination
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Search,
  Clock,
  ArrowLeft,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Voicemail,
  Phone,
  Download,
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
  recordingAvailable: boolean;
  notes: string;
  tags: string[];
}

interface CallStats {
  totalCalls: number;
  totalDuration: number;
  inboundCalls: number;
  outboundCalls: number;
  missedCalls: number;
  completedCalls: number;
  averageDuration: number;
}

interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// =============================================================================
// EXTENSION DATA (client-side mirror)
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

// =============================================================================
// HELPERS
// =============================================================================

function formatDuration(seconds: number): string {
  if (seconds === 0) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const min = Math.floor((seconds % 3600) / 60);
  const sec = seconds % 60;
  if (hours > 0) {
    return `${hours}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^1/, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone || '--';
}

function formatDateTime(ts: string): string {
  if (!ts) return '--';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatTimeShort(ts: string): string {
  if (!ts) return '--';
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffHrs < 24) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getExtensionName(ext: string): string {
  const found = EXTENSIONS.find(e => e.extension === ext);
  return found ? found.name : `Ext ${ext}`;
}

function getStatusDisplay(status: string): { label: string; color: string; bgColor: string } {
  switch (status) {
    case 'completed':
      return { label: 'Completed', color: 'text-green-400', bgColor: 'bg-green-500/10' };
    case 'missed':
      return { label: 'Missed', color: 'text-red-400', bgColor: 'bg-red-500/10' };
    case 'voicemail':
      return { label: 'Voicemail', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' };
    case 'in_progress':
      return { label: 'In Progress', color: 'text-blue-400', bgColor: 'bg-blue-500/10' };
    case 'ringing':
      return { label: 'Ringing', color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' };
    case 'failed':
      return { label: 'Failed', color: 'text-gray-400', bgColor: 'bg-gray-500/10' };
    default:
      return { label: status, color: 'text-gray-400', bgColor: 'bg-gray-500/10' };
  }
}

function getDirectionIcon(direction: string) {
  if (direction === 'inbound') return PhoneIncoming;
  return PhoneOutgoing;
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

const PAGE_SIZE = 25;

export default function CallLogPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, limit: PAGE_SIZE, offset: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDirection, setFilterDirection] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterExtension, setFilterExtension] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const currentPage = Math.floor(pagination.offset / PAGE_SIZE);
  const totalPages = Math.ceil(pagination.total / PAGE_SIZE);

  const fetchCalls = useCallback(async (offset = 0) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(offset));

      if (searchQuery) params.set('search', searchQuery);
      if (filterDirection) params.set('direction', filterDirection);
      if (filterStatus) params.set('status', filterStatus);
      if (filterExtension) params.set('repExtension', filterExtension);
      if (filterStartDate) params.set('startDate', filterStartDate);
      if (filterEndDate) params.set('endDate', filterEndDate);

      const res = await fetch(`/api/calls?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch calls');

      const json = await res.json();
      setCalls(json.calls || []);
      setStats(json.stats || null);
      setPagination(json.pagination || { total: 0, limit: PAGE_SIZE, offset: 0, hasMore: false });
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load calls');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterDirection, filterStatus, filterExtension, filterStartDate, filterEndDate]);

  useEffect(() => {
    fetchCalls(0);
  }, [fetchCalls]);

  const goToPage = (page: number) => {
    fetchCalls(page * PAGE_SIZE);
  };

  const hasActiveFilters = searchQuery || filterDirection || filterStatus || filterExtension || filterStartDate || filterEndDate;

  const clearFilters = () => {
    setSearchQuery('');
    setFilterDirection('');
    setFilterStatus('');
    setFilterExtension('');
    setFilterStartDate('');
    setFilterEndDate('');
  };

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
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <PhoneCall className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Call Log</h1>
                  <p className="text-sm text-gray-400">
                    {pagination.total} total call{pagination.total !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchCalls(pagination.offset)}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <Link
                href="/command-center/phone"
                className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <PhoneCall className="w-4 h-4" />
                Total
              </div>
              <div className="text-2xl font-bold">{stats.totalCalls}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-green-400 text-sm mb-1">
                <PhoneIncoming className="w-4 h-4" />
                Inbound
              </div>
              <div className="text-2xl font-bold text-green-400">{stats.inboundCalls}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-blue-400 text-sm mb-1">
                <PhoneOutgoing className="w-4 h-4" />
                Outbound
              </div>
              <div className="text-2xl font-bold text-blue-400">{stats.outboundCalls}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-400 text-sm mb-1">
                <PhoneMissed className="w-4 h-4" />
                Missed
              </div>
              <div className="text-2xl font-bold text-red-400">{stats.missedCalls}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <Clock className="w-4 h-4" />
                Avg Duration
              </div>
              <div className="text-2xl font-bold">{formatDuration(stats.averageDuration)}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-[#39FF14] text-sm mb-1">
                <Phone className="w-4 h-4" />
                Completed
              </div>
              <div className="text-2xl font-bold text-[#39FF14]">{stats.completedCalls}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search by name, phone, or notes..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50 focus:ring-1 focus:ring-[#39FF14]/25"
              />
            </div>

            {/* Direction */}
            <select
              value={filterDirection}
              onChange={e => setFilterDirection(e.target.value)}
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
              <option value="failed">Failed</option>
            </select>

            {/* Extension */}
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
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>

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
            <p className="text-gray-500">Loading calls...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && calls.length === 0 && (
          <div className="text-center py-20">
            <PhoneCall className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-400 mb-2">No Calls Found</h3>
            <p className="text-sm text-gray-600">
              {hasActiveFilters
                ? 'No calls match your filters. Try adjusting your search criteria.'
                : 'No call records yet. Calls will appear here as they come in.'}
            </p>
          </div>
        )}

        {/* Call Table */}
        {!loading && calls.length > 0 && (
          <>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-4">
              {/* Table Header */}
              <div className="hidden sm:grid grid-cols-[40px_1fr_120px_100px_100px_80px_80px] gap-2 px-4 py-3 bg-gray-800/50 text-xs font-medium text-gray-400 uppercase tracking-wider">
                <div></div>
                <div>Caller / Contact</div>
                <div>Extension</div>
                <div>Status</div>
                <div>Date</div>
                <div className="text-right">Duration</div>
                <div></div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-gray-800">
                {calls.map(call => {
                  const DirIcon = getDirectionIcon(call.direction);
                  const statusInfo = getStatusDisplay(call.status);
                  const isExpanded = expandedId === call.callId;

                  return (
                    <div key={call.callId}>
                      <div
                        className="grid grid-cols-1 sm:grid-cols-[40px_1fr_120px_100px_100px_80px_80px] gap-2 px-4 py-3 hover:bg-gray-800/30 transition-colors cursor-pointer items-center"
                        onClick={() => setExpandedId(isExpanded ? null : call.callId)}
                      >
                        {/* Direction Icon */}
                        <div className="hidden sm:flex">
                          <DirIcon className={`w-4 h-4 ${
                            call.direction === 'inbound' ? 'text-green-400' : 'text-blue-400'
                          }`} />
                        </div>

                        {/* Caller Info */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 sm:gap-0 sm:flex-col sm:items-start">
                            <DirIcon className={`w-4 h-4 sm:hidden ${
                              call.direction === 'inbound' ? 'text-green-400' : 'text-blue-400'
                            }`} />
                            <span className="font-medium text-sm truncate">
                              {call.customerName || 'Unknown Caller'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">{formatPhone(call.customerPhone)}</div>
                        </div>

                        {/* Extension */}
                        <div className="hidden sm:block text-sm text-gray-400">
                          <span className="text-xs text-gray-500">Ext </span>
                          {call.repExtension || '--'}
                          <div className="text-xs text-gray-500 truncate">
                            {call.repName || (call.repExtension ? getExtensionName(call.repExtension) : '--')}
                          </div>
                        </div>

                        {/* Status */}
                        <div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color} ${statusInfo.bgColor}`}>
                            {statusInfo.label}
                          </span>
                        </div>

                        {/* Date */}
                        <div className="text-sm text-gray-400">
                          {formatTimeShort(call.startTime)}
                        </div>

                        {/* Duration */}
                        <div className="text-sm text-gray-400 sm:text-right">
                          {formatDuration(call.duration)}
                        </div>

                        {/* Actions */}
                        <div className="hidden sm:flex justify-end gap-1">
                          {call.recordingAvailable && (
                            <button
                              className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-500 hover:text-white transition-colors"
                              title="Recording available"
                              onClick={e => e.stopPropagation()}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded Row */}
                      {isExpanded && (
                        <div className="border-t border-gray-800 bg-gray-800/20 px-4 py-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500 text-xs uppercase tracking-wider">Call ID</span>
                              <p className="text-gray-300 font-mono text-xs mt-0.5">{call.callId}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs uppercase tracking-wider">Start Time</span>
                              <p className="text-gray-300 mt-0.5">{formatDateTime(call.startTime)}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs uppercase tracking-wider">End Time</span>
                              <p className="text-gray-300 mt-0.5">{formatDateTime(call.endTime)}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs uppercase tracking-wider">Direction</span>
                              <p className="text-gray-300 mt-0.5 capitalize">{call.direction}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs uppercase tracking-wider">Email</span>
                              <p className="text-gray-300 mt-0.5">{call.customerEmail || '--'}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs uppercase tracking-wider">Recording</span>
                              <p className="text-gray-300 mt-0.5">{call.recordingAvailable ? 'Available' : 'Not available'}</p>
                            </div>
                            {call.notes && (
                              <div className="sm:col-span-3">
                                <span className="text-gray-500 text-xs uppercase tracking-wider">Notes</span>
                                <p className="text-gray-300 mt-0.5 whitespace-pre-wrap">{call.notes}</p>
                              </div>
                            )}
                            {call.tags.length > 0 && (
                              <div className="sm:col-span-3">
                                <span className="text-gray-500 text-xs uppercase tracking-wider">Tags</span>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {call.tags.map(tag => (
                                    <span
                                      key={tag}
                                      className="px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 text-xs"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing {pagination.offset + 1}
                  {' '}-{' '}
                  {Math.min(pagination.offset + calls.length, pagination.total)} of{' '}
                  {pagination.total}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 0}
                    className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 7) {
                      page = i;
                    } else if (currentPage < 4) {
                      page = i;
                    } else if (currentPage > totalPages - 4) {
                      page = totalPages - 7 + i;
                    } else {
                      page = currentPage - 3 + i;
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          page === currentPage
                            ? 'bg-[#39FF14]/20 text-[#39FF14]'
                            : 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white'
                        }`}
                      >
                        {page + 1}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={!pagination.hasMore}
                    className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
