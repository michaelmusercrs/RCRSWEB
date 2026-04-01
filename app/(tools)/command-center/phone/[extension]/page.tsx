'use client';

/**
 * RCRS Command Center - Extension Detail Page
 *
 * Individual extension view with:
 * - Extension info and status
 * - Ring group membership
 * - Recent calls for this extension
 * - Voicemails for this extension
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Voicemail,
  ArrowLeft,
  RefreshCw,
  Clock,
  Mail,
  Shield,
  Users,
  Wifi,
  WifiOff,
  Building,
  ExternalLink,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

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
  notes: string;
}

interface VoicemailRecord {
  id: string;
  callerPhone: string;
  callerName: string;
  extension: string;
  timestamp: string;
  duration: number;
  transcription: string;
  isRead: boolean;
}

// =============================================================================
// EXTENSION DATA (client-side mirror)
// =============================================================================

type ExtensionStatus = 'online' | 'busy' | 'offline' | 'dnd' | 'ringing';

interface Extension {
  extension: string;
  name: string;
  email: string;
  role: string;
  voicemailEnabled: boolean;
  status: ExtensionStatus;
  userId: string;
  department: string;
}

const EXTENSIONS: Extension[] = [
  { extension: '101', name: 'Michael Muse', email: 'michaelmuse@rivercityroofingsolutions.com', role: 'Owner', voicemailEnabled: true, status: 'online', userId: 'michael-muse', department: 'Executive' },
  { extension: '102', name: 'Chris Muse', email: 'chrismuse@rivercityroofingsolutions.com', role: 'Owner', voicemailEnabled: true, status: 'online', userId: 'chris-muse', department: 'Executive' },
  { extension: '103', name: 'Sara Hill', email: 'sara@rivercityroofingsolutions.com', role: 'Admin', voicemailEnabled: true, status: 'online', userId: 'sara-hill', department: 'Administration' },
  { extension: '104', name: 'Tia', email: 'tia@rivercityroofingsolutions.com', role: 'User', voicemailEnabled: true, status: 'online', userId: 'tia', department: 'Office' },
  { extension: '105', name: 'Destin', email: 'destin@rivercityroofingsolutions.com', role: 'Manager', voicemailEnabled: true, status: 'online', userId: 'destin', department: 'Operations' },
  { extension: '106', name: 'John', email: 'john@rivercityroofingsolutions.com', role: 'User', voicemailEnabled: true, status: 'offline', userId: 'john', department: 'Office' },
  { extension: '107', name: 'Bart', email: 'bart@rivercityroofingsolutions.com', role: 'User', voicemailEnabled: true, status: 'offline', userId: 'bart', department: 'Office' },
  { extension: '108', name: 'Boston', email: 'boston@rivercityroofingsolutions.com', role: 'User', voicemailEnabled: true, status: 'offline', userId: 'boston', department: 'Office' },
];

const RING_GROUP_MEMBERS: Record<string, { groupName: string; delay: number }> = {
  '103': { groupName: 'Main Line (600)', delay: 0 },
  '104': { groupName: 'Main Line (600)', delay: 0 },
  '105': { groupName: 'Main Line (600)', delay: 0 },
  '106': { groupName: 'Main Line (600)', delay: 5 },
  '102': { groupName: 'Main Line (600)', delay: 5 },
  '107': { groupName: 'Main Line (600)', delay: 5 },
  '108': { groupName: 'Main Line (600)', delay: 5 },
};

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
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateTime(ts: string): string {
  if (!ts) return '--';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getStatusInfo(status: ExtensionStatus): { label: string; color: string; dotColor: string; bgColor: string } {
  switch (status) {
    case 'online': return { label: 'Online', color: 'text-[#39FF14]', dotColor: 'bg-[#39FF14]', bgColor: 'bg-[#39FF14]/10' };
    case 'busy': return { label: 'Busy', color: 'text-yellow-400', dotColor: 'bg-yellow-400', bgColor: 'bg-yellow-400/10' };
    case 'ringing': return { label: 'Ringing', color: 'text-cyan-400', dotColor: 'bg-cyan-400', bgColor: 'bg-cyan-400/10' };
    case 'dnd': return { label: 'Do Not Disturb', color: 'text-red-400', dotColor: 'bg-red-400', bgColor: 'bg-red-400/10' };
    case 'offline': return { label: 'Offline', color: 'text-gray-500', dotColor: 'bg-gray-600', bgColor: 'bg-gray-600/10' };
    default: return { label: 'Unknown', color: 'text-gray-500', dotColor: 'bg-gray-600', bgColor: 'bg-gray-600/10' };
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'text-green-400';
    case 'missed': return 'text-red-400';
    case 'voicemail': return 'text-yellow-400';
    case 'in_progress': return 'text-blue-400';
    default: return 'text-gray-400';
  }
}

function getDirectionIcon(direction: string) {
  if (direction === 'inbound') return PhoneIncoming;
  return PhoneOutgoing;
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function ExtensionDetailPage() {
  const params = useParams();
  const extensionNumber = params.extension as string;

  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [voicemails, setVoicemails] = useState<VoicemailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'calls' | 'voicemail'>('calls');

  // Find extension info
  const ext = EXTENSIONS.find(e => e.extension === extensionNumber);
  const ringGroupInfo = RING_GROUP_MEMBERS[extensionNumber];
  const statusInfo = ext ? getStatusInfo(ext.status) : getStatusInfo('offline');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch calls for this extension
      const callsRes = await fetch(`/api/calls?repExtension=${extensionNumber}&limit=20`);
      if (callsRes.ok) {
        const callsData = await callsRes.json();
        setCalls(callsData.calls || []);
      }

      // Fetch voicemails for this extension
      try {
        const vmRes = await fetch(`/api/voicemail?extension=${extensionNumber}`);
        if (vmRes.ok) {
          const vmData = await vmRes.json();
          setVoicemails(vmData.voicemails || []);
        }
      } catch {
        // Voicemail API may not exist yet
        setVoicemails([]);
      }

      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [extensionNumber]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Call stats for this extension
  const totalCalls = calls.length;
  const inboundCalls = calls.filter(c => c.direction === 'inbound').length;
  const outboundCalls = calls.filter(c => c.direction === 'outbound').length;
  const missedCalls = calls.filter(c => c.status === 'missed').length;
  const avgDuration = totalCalls > 0
    ? Math.round(calls.reduce((sum, c) => sum + c.duration, 0) / calls.filter(c => c.status === 'completed').length || 1)
    : 0;
  const unreadVoicemails = voicemails.filter(vm => !vm.isRead).length;

  // Extension not found
  if (!ext) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="border-b border-gray-800 bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              <Link
                href="/command-center/phone/manage"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-xl font-bold">Extension Not Found</h1>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <Phone className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-400 mb-2">Extension {extensionNumber} not found</h2>
          <p className="text-sm text-gray-600 mb-6">This extension does not exist in the directory.</p>
          <Link
            href="/command-center/phone/manage"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Extensions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/command-center/phone/manage"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${statusInfo.bgColor} flex items-center justify-center`}>
                  <Phone className={`w-5 h-5 ${statusInfo.color}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold">Extension {extensionNumber}</h1>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color} ${statusInfo.bgColor}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`} />
                      {statusInfo.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">{ext.name}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
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
        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-6 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Extension Info Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">Name</span>
              <p className="text-lg font-medium text-white mt-0.5">{ext.name}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">Department</span>
              <p className="text-sm text-gray-300 mt-0.5 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-gray-500" />
                {ext.department}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">Role</span>
              <p className="text-sm text-gray-300 mt-0.5 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-gray-500" />
                {ext.role}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">Email</span>
              <p className="text-sm text-gray-300 mt-0.5 flex items-center gap-1.5 truncate">
                <Mail className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                <span className="truncate">{ext.email}</span>
              </p>
            </div>
          </div>

          {/* Additional Info Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-800">
            <div className="flex items-center gap-2 text-sm">
              <Voicemail className={`w-4 h-4 ${ext.voicemailEnabled ? 'text-purple-400' : 'text-gray-600'}`} />
              <span className={ext.voicemailEnabled ? 'text-gray-300' : 'text-gray-500'}>
                Voicemail {ext.voicemailEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            {ringGroupInfo && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-gray-300">
                  {ringGroupInfo.groupName}
                  {ringGroupInfo.delay > 0 ? ` (+${ringGroupInfo.delay}s delay)` : ' (primary)'}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              {ext.status === 'online' ? (
                <Wifi className="w-4 h-4 text-[#39FF14]" />
              ) : (
                <WifiOff className="w-4 h-4 text-gray-600" />
              )}
              <span className={statusInfo.color}>{statusInfo.label}</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <PhoneCall className="w-4 h-4" />
              Total Calls
            </div>
            <div className="text-2xl font-bold">{totalCalls}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-green-400 text-sm mb-1">
              <PhoneIncoming className="w-4 h-4" />
              Inbound
            </div>
            <div className="text-2xl font-bold text-green-400">{inboundCalls}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-blue-400 text-sm mb-1">
              <PhoneOutgoing className="w-4 h-4" />
              Outbound
            </div>
            <div className="text-2xl font-bold text-blue-400">{outboundCalls}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-red-400 text-sm mb-1">
              <PhoneMissed className="w-4 h-4" />
              Missed
            </div>
            <div className="text-2xl font-bold text-red-400">{missedCalls}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Clock className="w-4 h-4" />
              Avg Duration
            </div>
            <div className="text-2xl font-bold">{formatDuration(avgDuration)}</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-4 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab('calls')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'calls'
                ? 'bg-[#39FF14]/10 text-[#39FF14]'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <PhoneCall className="w-4 h-4" />
            Recent Calls
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === 'calls'
                ? 'bg-[#39FF14]/20 text-[#39FF14]'
                : 'bg-gray-700 text-gray-500'
            }`}>
              {totalCalls}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('voicemail')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'voicemail'
                ? 'bg-[#39FF14]/10 text-[#39FF14]'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Voicemail className="w-4 h-4" />
            Voicemails
            {unreadVoicemails > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#39FF14]/20 text-[#39FF14]">
                {unreadVoicemails}
              </span>
            )}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-16">
            <RefreshCw className="w-8 h-8 text-gray-600 animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Loading...</p>
          </div>
        )}

        {/* ================================================================= */}
        {/* CALLS TAB */}
        {/* ================================================================= */}
        {!loading && activeTab === 'calls' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {calls.length === 0 ? (
              <div className="text-center py-16">
                <PhoneCall className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-gray-400 mb-1">No Calls</h3>
                <p className="text-xs text-gray-600">No call records found for this extension.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {calls.map(call => {
                  const DirIcon = getDirectionIcon(call.direction);
                  return (
                    <div
                      key={call.callId}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-gray-800/30 transition-colors"
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
                        {call.notes && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">{call.notes}</p>
                        )}
                      </div>

                      <span className={`text-xs font-medium ${getStatusColor(call.status)}`}>
                        {call.status.replace('_', ' ')}
                      </span>

                      <span className="text-xs text-gray-500 w-12 text-right">
                        {formatDuration(call.duration)}
                      </span>

                      <span className="text-xs text-gray-500 w-20 text-right">
                        {formatTime(call.startTime)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* View All Link */}
            {totalCalls > 0 && (
              <Link
                href={`/command-center/phone/calls?extension=${extensionNumber}`}
                className="flex items-center justify-center gap-1 px-5 py-3 border-t border-gray-800 text-sm text-[#39FF14] hover:bg-gray-800/30 transition-colors"
              >
                View all calls for ext {extensionNumber}
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* VOICEMAIL TAB */}
        {/* ================================================================= */}
        {!loading && activeTab === 'voicemail' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {voicemails.length === 0 ? (
              <div className="text-center py-16">
                <Voicemail className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-gray-400 mb-1">No Voicemails</h3>
                <p className="text-xs text-gray-600">No voicemails found for extension {extensionNumber}.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {voicemails.map(vm => (
                  <div
                    key={vm.id}
                    className={`px-5 py-4 hover:bg-gray-800/30 transition-colors ${
                      !vm.isRead ? 'border-l-2 border-l-[#39FF14]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <Voicemail className={`w-4 h-4 flex-shrink-0 ${vm.isRead ? 'text-gray-600' : 'text-[#39FF14]'}`} />
                      <span className={`font-medium text-sm ${vm.isRead ? 'text-gray-300' : 'text-white'}`}>
                        {vm.callerName || 'Unknown Caller'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatPhone(vm.callerPhone)}
                      </span>
                      <span className="text-xs text-gray-500 ml-auto">
                        {formatDuration(vm.duration)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTime(vm.timestamp)}
                      </span>
                    </div>
                    {vm.transcription && (
                      <p className="text-xs text-gray-500 ml-7 line-clamp-2">
                        {vm.transcription}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* View All Link */}
            {voicemails.length > 0 && (
              <Link
                href={`/command-center/phone/voicemail?extension=${extensionNumber}`}
                className="flex items-center justify-center gap-1 px-5 py-3 border-t border-gray-800 text-sm text-[#39FF14] hover:bg-gray-800/30 transition-colors"
              >
                View all voicemails for ext {extensionNumber}
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
