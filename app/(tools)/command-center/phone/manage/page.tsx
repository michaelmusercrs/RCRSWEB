'use client';

/**
 * RCRS Command Center - Phone Management Page
 *
 * Phone system management with:
 * - Extension directory with status indicators
 * - Ring group configuration display
 * - Feature codes reference
 * - Quick links to individual extension pages
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Settings,
  ArrowLeft,
  Phone,
  Users,
  Wifi,
  WifiOff,
  Hash,
  ChevronDown,
  ChevronRight,
  Voicemail,
  Shield,
  Zap,
  PhoneForwarded,
  PhoneOff,
  Mic,
  ArrowRightLeft,
  Info,
  ExternalLink,
  Copy,
  CheckCircle,
} from 'lucide-react';

// =============================================================================
// DATA (mirrored from lib/phone-data.ts for client-side use)
// =============================================================================

type ExtensionStatus = 'online' | 'busy' | 'offline' | 'dnd' | 'ringing';

interface Extension {
  extension: string;
  name: string;
  email: string;
  role: string;
  voicemailEnabled: boolean;
  status: ExtensionStatus;
  department: string;
}

interface RingGroup {
  groupNumber: string;
  name: string;
  description: string;
  strategy: string;
  members: { extension: string; ringDelay: number }[];
  ringTimeout: number;
  failoverDestination: string;
}

interface FeatureCode {
  code: string;
  name: string;
  description: string;
  category: string;
}

const EXTENSIONS: Extension[] = [
  { extension: '101', name: 'Michael Muse', email: 'michaelmuse@rivercityroofingsolutions.com', role: 'Owner', voicemailEnabled: true, status: 'online', department: 'Executive' },
  { extension: '102', name: 'Chris Muse', email: 'chrismuse@rivercityroofingsolutions.com', role: 'Owner', voicemailEnabled: true, status: 'online', department: 'Executive' },
  { extension: '103', name: 'Sara Hill', email: 'sara@rivercityroofingsolutions.com', role: 'Admin', voicemailEnabled: true, status: 'online', department: 'Administration' },
  { extension: '104', name: 'Tia', email: 'tia@rivercityroofingsolutions.com', role: 'User', voicemailEnabled: true, status: 'online', department: 'Office' },
  { extension: '105', name: 'Destin', email: 'destin@rivercityroofingsolutions.com', role: 'Manager', voicemailEnabled: true, status: 'online', department: 'Operations' },
  { extension: '106', name: 'John', email: 'john@rivercityroofingsolutions.com', role: 'User', voicemailEnabled: true, status: 'offline', department: 'Office' },
  { extension: '107', name: 'Bart', email: 'bart@rivercityroofingsolutions.com', role: 'User', voicemailEnabled: true, status: 'offline', department: 'Office' },
  { extension: '108', name: 'Boston', email: 'boston@rivercityroofingsolutions.com', role: 'User', voicemailEnabled: true, status: 'offline', department: 'Office' },
];

const RING_GROUPS: RingGroup[] = [
  {
    groupNumber: '600',
    name: 'Main Line',
    description: 'Primary incoming call ring group for main company number',
    strategy: 'ringall',
    members: [
      { extension: '103', ringDelay: 0 },
      { extension: '104', ringDelay: 0 },
      { extension: '105', ringDelay: 0 },
      { extension: '106', ringDelay: 5 },
      { extension: '102', ringDelay: 5 },
      { extension: '107', ringDelay: 5 },
      { extension: '108', ringDelay: 5 },
    ],
    ringTimeout: 30,
    failoverDestination: 'voicemail:103',
  },
];

const FEATURE_CODES: FeatureCode[] = [
  { code: '*97', name: 'Check Voicemail', description: 'Access your voicemail box', category: 'voicemail' },
  { code: '*98', name: 'Check Voicemail (Any)', description: 'Access any voicemail box (requires PIN)', category: 'voicemail' },
  { code: '*72', name: 'Forward All Calls', description: 'Forward all incoming calls to another number', category: 'forwarding' },
  { code: '*73', name: 'Cancel Forward', description: 'Cancel call forwarding', category: 'forwarding' },
  { code: '*90', name: 'Forward Busy', description: 'Forward calls when busy', category: 'forwarding' },
  { code: '*91', name: 'Cancel Forward Busy', description: 'Cancel forward when busy', category: 'forwarding' },
  { code: '*92', name: 'Forward No Answer', description: 'Forward calls when no answer', category: 'forwarding' },
  { code: '*93', name: 'Cancel Forward No Answer', description: 'Cancel forward when no answer', category: 'forwarding' },
  { code: '*78', name: 'Enable DND', description: 'Enable Do Not Disturb - sends calls to voicemail', category: 'dnd' },
  { code: '*79', name: 'Disable DND', description: 'Disable Do Not Disturb', category: 'dnd' },
  { code: '*1', name: 'Record Call', description: 'Start recording current call (in-call feature)', category: 'recording' },
  { code: '*2', name: 'Blind Transfer', description: 'Transfer call without announcement', category: 'transfer' },
  { code: '##', name: 'Attended Transfer', description: 'Transfer with announcement to recipient', category: 'transfer' },
  { code: '*60', name: 'Blacklist Last Caller', description: 'Add last caller to blacklist', category: 'misc' },
  { code: '*69', name: 'Call Return', description: 'Call back the last incoming caller', category: 'misc' },
  { code: '*65', name: 'Speak My Extension', description: 'Hear your extension number spoken', category: 'misc' },
];

const MAIN_DID = '(256) 515-4245';

// =============================================================================
// HELPERS
// =============================================================================

function getStatusInfo(status: ExtensionStatus): { label: string; color: string; dotColor: string } {
  switch (status) {
    case 'online': return { label: 'Online', color: 'text-[#39FF14]', dotColor: 'bg-[#39FF14]' };
    case 'busy': return { label: 'Busy', color: 'text-yellow-400', dotColor: 'bg-yellow-400' };
    case 'ringing': return { label: 'Ringing', color: 'text-cyan-400', dotColor: 'bg-cyan-400' };
    case 'dnd': return { label: 'DND', color: 'text-red-400', dotColor: 'bg-red-400' };
    case 'offline': return { label: 'Offline', color: 'text-gray-500', dotColor: 'bg-gray-600' };
    default: return { label: 'Unknown', color: 'text-gray-500', dotColor: 'bg-gray-600' };
  }
}

function getRoleBadge(role: string): { color: string; bgColor: string } {
  switch (role) {
    case 'Owner': return { color: 'text-[#39FF14]', bgColor: 'bg-[#39FF14]/10' };
    case 'Admin': return { color: 'text-purple-400', bgColor: 'bg-purple-500/10' };
    case 'Manager': return { color: 'text-blue-400', bgColor: 'bg-blue-500/10' };
    default: return { color: 'text-gray-400', bgColor: 'bg-gray-500/10' };
  }
}

function getExtensionName(ext: string): string {
  const found = EXTENSIONS.find(e => e.extension === ext);
  return found ? found.name : `Ext ${ext}`;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Voicemail; color: string }> = {
  voicemail: { label: 'Voicemail', icon: Voicemail, color: 'text-purple-400' },
  forwarding: { label: 'Call Forwarding', icon: PhoneForwarded, color: 'text-blue-400' },
  dnd: { label: 'Do Not Disturb', icon: PhoneOff, color: 'text-red-400' },
  recording: { label: 'Recording', icon: Mic, color: 'text-green-400' },
  transfer: { label: 'Transfer', icon: ArrowRightLeft, color: 'text-cyan-400' },
  misc: { label: 'Miscellaneous', icon: Zap, color: 'text-yellow-400' },
};

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function PhoneManagePage() {
  const [activeTab, setActiveTab] = useState<'extensions' | 'ringgroups' | 'features'>('extensions');
  const [expandedGroup, setExpandedGroup] = useState<string | null>('600');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const onlineCount = EXTENSIONS.filter(e => e.status === 'online').length;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCode(text);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  // Group feature codes by category
  const featuresByCategory = FEATURE_CODES.reduce<Record<string, FeatureCode[]>>((acc, fc) => {
    if (!acc[fc.category]) acc[fc.category] = [];
    acc[fc.category].push(fc);
    return acc;
  }, {});

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
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Phone Management</h1>
                  <p className="text-sm text-gray-400">
                    Main Line: {MAIN_DID}
                  </p>
                </div>
              </div>
            </div>
            <Link
              href="/command-center/phone"
              className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          {[
            { key: 'extensions' as const, label: 'Extensions', icon: Phone, count: EXTENSIONS.length },
            { key: 'ringgroups' as const, label: 'Ring Groups', icon: Users, count: RING_GROUPS.length },
            { key: 'features' as const, label: 'Feature Codes', icon: Hash, count: FEATURE_CODES.length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-[#39FF14]/10 text-[#39FF14]'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key
                  ? 'bg-[#39FF14]/20 text-[#39FF14]'
                  : 'bg-gray-700 text-gray-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ===================================================================== */}
        {/* EXTENSIONS TAB */}
        {/* ===================================================================== */}
        {activeTab === 'extensions' && (
          <div>
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-sm text-gray-400 mb-1">Total Extensions</div>
                <div className="text-2xl font-bold">{EXTENSIONS.length}</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-sm text-[#39FF14] mb-1">Online</div>
                <div className="text-2xl font-bold text-[#39FF14]">{onlineCount}</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-sm text-gray-500 mb-1">Offline</div>
                <div className="text-2xl font-bold text-gray-500">{EXTENSIONS.length - onlineCount}</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-sm text-purple-400 mb-1">Voicemail Enabled</div>
                <div className="text-2xl font-bold text-purple-400">
                  {EXTENSIONS.filter(e => e.voicemailEnabled).length}
                </div>
              </div>
            </div>

            {/* Extensions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {EXTENSIONS.map(ext => {
                const statusInfo = getStatusInfo(ext.status);
                const roleBadge = getRoleBadge(ext.role);

                return (
                  <Link
                    key={ext.extension}
                    href={`/command-center/phone/${ext.extension}`}
                    className="group bg-gray-900 border border-gray-800 hover:border-[#39FF14]/30 rounded-xl p-5 transition-all"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${statusInfo.dotColor}`} />
                        <span className={`text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${roleBadge.color} ${roleBadge.bgColor}`}>
                        {ext.role}
                      </span>
                    </div>

                    {/* Extension Number */}
                    <div className="text-3xl font-bold text-white mb-1 group-hover:text-[#39FF14] transition-colors">
                      {ext.extension}
                    </div>

                    {/* Name */}
                    <div className="text-sm font-medium text-gray-300 mb-1">{ext.name}</div>
                    <div className="text-xs text-gray-500 mb-3">{ext.department}</div>

                    {/* Info Row */}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {ext.voicemailEnabled && (
                        <span className="flex items-center gap-1">
                          <Voicemail className="w-3 h-3" />
                          VM
                        </span>
                      )}
                      <span className="truncate">{ext.email}</span>
                    </div>

                    {/* Link indicator */}
                    <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-600 flex items-center gap-1 group-hover:text-[#39FF14] transition-colors">
                      View details
                      <ExternalLink className="w-3 h-3" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* RING GROUPS TAB */}
        {/* ===================================================================== */}
        {activeTab === 'ringgroups' && (
          <div className="space-y-4">
            {RING_GROUPS.map(group => {
              const isExpanded = expandedGroup === group.groupNumber;
              const primaryMembers = group.members.filter(m => m.ringDelay === 0);
              const secondaryMembers = group.members.filter(m => m.ringDelay > 0);

              return (
                <div
                  key={group.groupNumber}
                  className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
                >
                  {/* Group Header */}
                  <div
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
                    onClick={() => setExpandedGroup(isExpanded ? null : group.groupNumber)}
                  >
                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{group.name}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">
                          #{group.groupNumber}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">{group.description}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>{group.members.length} members</span>
                      <span>Strategy: <span className="text-white">{group.strategy}</span></span>
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </div>
                  </div>

                  {/* Group Details */}
                  {isExpanded && (
                    <div className="border-t border-gray-800 p-5 space-y-5">
                      {/* Config Details */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <span className="text-xs text-gray-500 uppercase tracking-wider">Strategy</span>
                          <p className="text-sm text-white mt-0.5 capitalize">{group.strategy}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 uppercase tracking-wider">Ring Timeout</span>
                          <p className="text-sm text-white mt-0.5">{group.ringTimeout}s</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 uppercase tracking-wider">Failover</span>
                          <p className="text-sm text-white mt-0.5">
                            {group.failoverDestination.replace('voicemail:', 'VM: Ext ')}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 uppercase tracking-wider">Total Members</span>
                          <p className="text-sm text-white mt-0.5">{group.members.length}</p>
                        </div>
                      </div>

                      {/* Primary Ring */}
                      <div>
                        <h4 className="text-sm font-medium text-[#39FF14] mb-2 flex items-center gap-2">
                          <Zap className="w-4 h-4" />
                          Primary Ring (Immediate)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {primaryMembers.map(member => {
                            const ext = EXTENSIONS.find(e => e.extension === member.extension);
                            const statusInfo = ext ? getStatusInfo(ext.status) : getStatusInfo('offline');
                            return (
                              <Link
                                key={member.extension}
                                href={`/command-center/phone/${member.extension}`}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                              >
                                <div className={`w-2 h-2 rounded-full ${statusInfo.dotColor}`} />
                                <span className="font-mono text-sm text-[#39FF14]">{member.extension}</span>
                                <span className="text-sm text-gray-300">{ext?.name || 'Unknown'}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>

                      {/* Secondary Ring */}
                      {secondaryMembers.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            Secondary Ring (After Delay)
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {secondaryMembers.map(member => {
                              const ext = EXTENSIONS.find(e => e.extension === member.extension);
                              const statusInfo = ext ? getStatusInfo(ext.status) : getStatusInfo('offline');
                              return (
                                <Link
                                  key={member.extension}
                                  href={`/command-center/phone/${member.extension}`}
                                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                                >
                                  <div className={`w-2 h-2 rounded-full ${statusInfo.dotColor}`} />
                                  <span className="font-mono text-sm text-blue-400">{member.extension}</span>
                                  <span className="text-sm text-gray-300">{ext?.name || 'Unknown'}</span>
                                  <span className="text-xs text-gray-500 ml-auto">+{member.ringDelay}s</span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Info Box */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-400">
                  <p className="font-medium text-gray-300 mb-1">About Ring Groups</p>
                  <p>
                    Ring groups determine how incoming calls to the main line are distributed.
                    Primary members ring immediately, secondary members ring after a delay.
                    If no one answers within the timeout, the call goes to the failover destination (voicemail).
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* FEATURE CODES TAB */}
        {/* ===================================================================== */}
        {activeTab === 'features' && (
          <div className="space-y-6">
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 mb-6">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-400">
                  <p className="font-medium text-gray-300 mb-1">Phone System Feature Codes</p>
                  <p>
                    Dial these codes from any extension to activate phone system features.
                    Click a code to copy it to your clipboard.
                  </p>
                </div>
              </div>
            </div>

            {Object.entries(featuresByCategory).map(([category, codes]) => {
              const config = CATEGORY_CONFIG[category] || { label: category, icon: Zap, color: 'text-gray-400' };
              const CategoryIcon = config.icon;

              return (
                <div key={category} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
                    <CategoryIcon className={`w-4 h-4 ${config.color}`} />
                    <h3 className="font-medium">{config.label}</h3>
                    <span className="text-xs text-gray-500 ml-auto">{codes.length} codes</span>
                  </div>
                  <div className="divide-y divide-gray-800">
                    {codes.map(fc => (
                      <div
                        key={fc.code}
                        className="flex items-center gap-4 px-5 py-3 hover:bg-gray-800/30 transition-colors"
                      >
                        <button
                          onClick={() => copyToClipboard(fc.code)}
                          className="flex items-center gap-2 font-mono text-lg font-bold text-[#39FF14] hover:text-[#39FF14]/80 transition-colors min-w-[60px]"
                          title="Click to copy"
                        >
                          {fc.code}
                          {copiedCode === fc.code ? (
                            <CheckCircle className="w-3.5 h-3.5 text-[#39FF14]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-gray-600 opacity-0 group-hover:opacity-100" />
                          )}
                        </button>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-200">{fc.name}</div>
                          <div className="text-xs text-gray-500">{fc.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
