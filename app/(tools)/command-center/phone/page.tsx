'use client';

/**
 * RCRS Command Center - Phone System Dashboard
 *
 * Overview dashboard with:
 * - KPI cards: total calls today, missed calls, avg duration, active extensions
 * - Quick links to calls, voicemail, manage sub-pages
 * - Recent call activity feed
 * - Ring group overview
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Voicemail,
  Settings,
  Users,
  Clock,
  ArrowRight,
  RefreshCw,
  Wifi,
  WifiOff,
  ArrowLeft,
  Activity,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface TodaySummary {
  total: number;
  inbound: number;
  outbound: number;
  missed: number;
  completed: number;
  totalDuration: number;
  activeReps: number;
}

interface CallRecord {
  callId: string;
  customerName: string;
  customerPhone: string;
  repName: string;
  repExtension: string;
  direction: 'inbound' | 'outbound';
  status: string;
  startTime: string;
  duration: number;
}

interface NeedsAttentionItem {
  callId: string;
  customerName: string;
  customerPhone: string;
  startTime: string;
  status: string;
}

interface DashboardData {
  today: TodaySummary;
  recentCalls: CallRecord[];
  needsAttention: NeedsAttentionItem[];
  stats: {
    totalCalls: number;
    averageDuration: number;
    missedCalls: number;
    completedCalls: number;
  };
  analytics: {
    dailyVolume: { date: string; count: number }[];
    topReps: { repName: string; count: number; avgDuration: number }[];
    peakHours: { hour: number; count: number }[];
  };
}

// =============================================================================
// EXTENSION DATA (mirrored for client-side)
// =============================================================================

const EXTENSIONS = [
  { extension: '101', name: 'Michael Muse', role: 'Owner', department: 'Executive', status: 'online' },
  { extension: '102', name: 'Chris Muse', role: 'Owner', department: 'Executive', status: 'online' },
  { extension: '103', name: 'Sara Hill', role: 'Admin', department: 'Administration', status: 'online' },
  { extension: '104', name: 'Tia', role: 'User', department: 'Office', status: 'online' },
  { extension: '105', name: 'Destin', role: 'Manager', department: 'Operations', status: 'online' },
  { extension: '106', name: 'John', role: 'User', department: 'Office', status: 'offline' },
  { extension: '107', name: 'Bart', role: 'User', department: 'Office', status: 'offline' },
  { extension: '108', name: 'Boston', role: 'User', department: 'Office', status: 'offline' },
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
  return phone || '--';
}

function formatTime(ts: string): string {
  if (!ts) return '--';
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDirectionIcon(direction: string) {
  if (direction === 'inbound') return PhoneIncoming;
  return PhoneOutgoing;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'text-green-400';
    case 'missed': return 'text-red-400';
    case 'voicemail': return 'text-yellow-400';
    case 'in_progress': return 'text-blue-400';
    case 'ringing': return 'text-cyan-400';
    default: return 'text-gray-400';
  }
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function PhoneDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/command-center/calls?recent=15');
      if (!res.ok) throw new Error('Failed to fetch phone data');
      const json = await res.json();
      setData(json);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onlineCount = EXTENSIONS.filter(e => e.status === 'online').length;
  const offlineCount = EXTENSIONS.filter(e => e.status === 'offline').length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/command-center"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#39FF14]/10 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-[#39FF14]" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Phone System</h1>
                  <p className="text-sm text-gray-400">
                    Dashboard &mdash; (256) 515-4245
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={fetchData}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-6 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <PhoneCall className="w-4 h-4" />
              Calls Today
            </div>
            <div className="text-2xl font-bold">
              {loading ? (
                <span className="text-gray-600">--</span>
              ) : (
                data?.today?.total ?? 0
              )}
            </div>
            {data?.today && (
              <div className="flex gap-3 mt-1 text-xs text-gray-500">
                <span className="text-green-400">{data.today.inbound} in</span>
                <span className="text-blue-400">{data.today.outbound} out</span>
              </div>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-red-400 text-sm mb-1">
              <PhoneMissed className="w-4 h-4" />
              Missed Today
            </div>
            <div className="text-2xl font-bold text-red-400">
              {loading ? (
                <span className="text-gray-600">--</span>
              ) : (
                data?.today?.missed ?? 0
              )}
            </div>
            {data?.needsAttention && data.needsAttention.length > 0 && (
              <div className="text-xs text-red-400/70 mt-1">
                {data.needsAttention.length} need follow-up
              </div>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Clock className="w-4 h-4" />
              Avg Duration
            </div>
            <div className="text-2xl font-bold">
              {loading ? (
                <span className="text-gray-600">--</span>
              ) : (
                formatDuration(data?.stats?.averageDuration ?? 0)
              )}
            </div>
            {data?.today && (
              <div className="text-xs text-gray-500 mt-1">
                {formatDuration(data.today.totalDuration)} total today
              </div>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#39FF14] text-sm mb-1">
              <Wifi className="w-4 h-4" />
              Active Extensions
            </div>
            <div className="text-2xl font-bold text-[#39FF14]">
              {onlineCount}
              <span className="text-sm font-normal text-gray-500 ml-1">/ {EXTENSIONS.length}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {offlineCount} offline
            </div>
          </div>
        </div>

        {/* Quick Navigation */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Link
            href="/command-center/phone/calls"
            className="group bg-gray-900 border border-gray-800 hover:border-[#39FF14]/30 rounded-xl p-5 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <PhoneCall className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium">Call Log</h3>
                  <p className="text-sm text-gray-500">
                    {data?.stats?.totalCalls ?? 0} total calls
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-[#39FF14] transition-colors" />
            </div>
          </Link>

          <Link
            href="/command-center/phone/voicemail"
            className="group bg-gray-900 border border-gray-800 hover:border-[#39FF14]/30 rounded-xl p-5 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Voicemail className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-medium">Voicemail</h3>
                  <p className="text-sm text-gray-500">Inbox &amp; transcriptions</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-[#39FF14] transition-colors" />
            </div>
          </Link>

          <Link
            href="/command-center/phone/manage"
            className="group bg-gray-900 border border-gray-800 hover:border-[#39FF14]/30 rounded-xl p-5 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-medium">Manage</h3>
                  <p className="text-sm text-gray-500">Extensions &amp; settings</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-[#39FF14] transition-colors" />
            </div>
          </Link>
        </div>

        {/* Two-column layout: Recent Calls + Needs Attention */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Recent Calls - 2 cols */}
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h2 className="font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#39FF14]" />
                Recent Calls
              </h2>
              <Link
                href="/command-center/phone/calls"
                className="text-sm text-[#39FF14] hover:text-[#39FF14]/80 transition-colors"
              >
                View all
              </Link>
            </div>

            {loading && (
              <div className="p-10 text-center">
                <RefreshCw className="w-6 h-6 text-gray-600 animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-500">Loading calls...</p>
              </div>
            )}

            {!loading && (!data?.recentCalls || data.recentCalls.length === 0) && (
              <div className="p-10 text-center">
                <Phone className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No recent calls</p>
              </div>
            )}

            {!loading && data?.recentCalls && data.recentCalls.length > 0 && (
              <div className="divide-y divide-gray-800">
                {data.recentCalls.slice(0, 10).map((call) => {
                  const DirIcon = getDirectionIcon(call.direction);
                  return (
                    <div
                      key={call.callId}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-gray-800/50 transition-colors"
                    >
                      <DirIcon className={`w-4 h-4 flex-shrink-0 ${
                        call.direction === 'inbound' ? 'text-green-400' : 'text-blue-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {call.customerName || 'Unknown'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatPhone(call.customerPhone)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {call.repName ? `${call.repName} (ext ${call.repExtension})` : `Ext ${call.repExtension || '--'}`}
                        </div>
                      </div>
                      <span className={`text-xs font-medium ${getStatusColor(call.status)}`}>
                        {call.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-500 w-14 text-right">
                        {formatDuration(call.duration)}
                      </span>
                      <span className="text-xs text-gray-500 w-16 text-right">
                        {formatTime(call.startTime)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sidebar - Needs Attention + Extensions */}
          <div className="space-y-6">
            {/* Needs Attention */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl">
              <div className="px-5 py-4 border-b border-gray-800">
                <h2 className="font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  Needs Follow-up
                </h2>
              </div>

              {!loading && (!data?.needsAttention || data.needsAttention.length === 0) && (
                <div className="p-6 text-center">
                  <p className="text-sm text-gray-500">All caught up</p>
                </div>
              )}

              {!loading && data?.needsAttention && data.needsAttention.length > 0 && (
                <div className="divide-y divide-gray-800">
                  {data.needsAttention.map((item) => (
                    <div key={item.callId} className="px-5 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        <PhoneMissed className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-sm font-medium truncate">
                          {item.customerName || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{formatPhone(item.customerPhone)}</span>
                        <span>{formatTime(item.startTime)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Extension Status */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                <h2 className="font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  Extensions
                </h2>
                <Link
                  href="/command-center/phone/manage"
                  className="text-xs text-[#39FF14] hover:text-[#39FF14]/80 transition-colors"
                >
                  Manage
                </Link>
              </div>
              <div className="divide-y divide-gray-800">
                {EXTENSIONS.map((ext) => (
                  <Link
                    key={ext.extension}
                    href={`/command-center/phone/${ext.extension}`}
                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-800/50 transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      ext.status === 'online' ? 'bg-[#39FF14]' : 'bg-gray-600'
                    }`} />
                    <span className="text-sm flex-1 truncate">{ext.name}</span>
                    <span className="text-xs text-gray-500">{ext.extension}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Top Reps This Week */}
            {data?.analytics?.topReps && data.analytics.topReps.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl">
                <div className="px-5 py-4 border-b border-gray-800">
                  <h2 className="font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#39FF14]" />
                    Top Call Volume (7d)
                  </h2>
                </div>
                <div className="divide-y divide-gray-800">
                  {data.analytics.topReps.map((rep, i) => (
                    <div key={rep.repName || i} className="flex items-center gap-3 px-5 py-2.5">
                      <span className="text-xs text-gray-500 w-5">#{i + 1}</span>
                      <span className="text-sm flex-1 truncate">{rep.repName || 'Unknown'}</span>
                      <span className="text-sm font-medium text-[#39FF14]">{rep.count}</span>
                      <span className="text-xs text-gray-500">avg {formatDuration(rep.avgDuration)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
