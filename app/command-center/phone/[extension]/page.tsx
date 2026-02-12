'use client';

/**
 * RCRS Command Center - Extension Detail Page
 *
 * Shows detailed information for a specific extension including:
 * - Extension info (number, name, email, role)
 * - Voicemail status
 * - Call forwarding settings
 * - Call history with FreePBX integration
 * - Quick actions
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Phone,
  ArrowLeft,
  Voicemail,
  PhoneForwarded,
  PhoneOff,
  Mail,
  User,
  Building2,
  Clock,
  Settings,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Hash,
  Ban,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PermissionGate } from '@/components/command-center/PermissionGate';
import {
  getExtensionByNumber,
  getExtensionByEmail,
  FEATURE_CODES,
  getFeatureCodesByCategory,
  formatPhoneNumber,
  type Extension,
  type FeatureCode,
} from '@/lib/phone-data';
import { cn } from '@/lib/utils';

// =============================================================================
// CALL HISTORY - Local demo data + FreePBX integration hook
// =============================================================================

interface CallRecord {
  id: string;
  type: 'incoming' | 'outgoing' | 'missed';
  number: string;
  name: string;
  duration: string | null;
  time: string;
  date: string;
}

// Generate demo call records for an extension
function generateDemoCallHistory(extensionNumber: string): CallRecord[] {
  const names = [
    'John Smith', 'Sarah Johnson', 'Mike Davis', 'Emily Brown',
    'ABC Supply Co.', 'Insurance Adjuster', 'Customer Service',
    'Regional Office', 'Home Depot Pro', 'Bob Williams',
  ];
  const types: Array<'incoming' | 'outgoing' | 'missed'> = ['incoming', 'outgoing', 'missed'];
  const records: CallRecord[] = [];
  const now = new Date();

  for (let i = 0; i < 15; i++) {
    const callDate = new Date(now.getTime() - i * 3600000 * (2 + Math.random() * 6));
    const type = types[Math.floor(Math.random() * (i < 2 ? 3 : 2))]; // More missed calls recently
    const durationMinutes = type === 'missed' ? 0 : Math.floor(Math.random() * 15) + 1;
    const durationSeconds = type === 'missed' ? 0 : Math.floor(Math.random() * 60);

    records.push({
      id: `call-${extensionNumber}-${i}`,
      type,
      number: `(256) ${String(200 + Math.floor(Math.random() * 800)).padStart(3, '0')}-${String(1000 + Math.floor(Math.random() * 9000))}`,
      name: names[i % names.length],
      duration: type === 'missed' ? null : `${durationMinutes}:${String(durationSeconds).padStart(2, '0')}`,
      time: callDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      date: callDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    });
  }

  return records;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function CallTypeIcon({ type }: { type: 'incoming' | 'outgoing' | 'missed' }) {
  switch (type) {
    case 'incoming':
      return <PhoneIncoming className="h-4 w-4 text-lime-400" />;
    case 'outgoing':
      return <PhoneOutgoing className="h-4 w-4 text-blue-400" />;
    case 'missed':
      return <PhoneMissed className="h-4 w-4 text-red-400" />;
  }
}

function FeatureCodeItem({ code }: { code: FeatureCode }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/30 px-3 py-2">
      <div>
        <p className="text-sm font-medium text-white">{code.name}</p>
        <p className="text-xs text-zinc-500">{code.description}</p>
      </div>
      <span className="font-mono text-sm font-semibold text-lime-400">
        {code.code}
      </span>
    </div>
  );
}

function SettingToggle({
  label,
  description,
  enabled,
  onChange,
  disabled = false,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/30 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <button
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled}
        className={cn(
          'relative h-6 w-11 rounded-full transition-colors',
          enabled ? 'bg-lime-500' : 'bg-zinc-700',
          disabled && 'cursor-not-allowed opacity-50'
        )}
        aria-pressed={enabled}
        aria-label={`${label}: ${enabled ? 'enabled' : 'disabled'}`}
      >
        <span
          className={cn(
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
            enabled && 'translate-x-5'
          )}
        />
      </button>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ExtensionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, hasPermission } = useAuth();

  const extensionNumber = params.extension as string;
  const extension = getExtensionByNumber(extensionNumber);

  // Get current user's extension to check if viewing own extension
  const userExtension = user?.email ? getExtensionByEmail(user.email) : undefined;
  const isOwnExtension = userExtension?.extension === extensionNumber;

  // Check permissions
  const canManage = hasPermission('phone.manage');
  const canViewAll = hasPermission('phone.viewAll');
  const canEdit = canManage || isOwnExtension;

  // Settings state
  const [dndEnabled, setDndEnabled] = React.useState(false);
  const [forwardingEnabled, setForwardingEnabled] = React.useState(false);
  const [forwardNumber, setForwardNumber] = React.useState('');

  // Call history state
  const [callHistory, setCallHistory] = React.useState<CallRecord[]>([]);
  const [callHistoryLoading, setCallHistoryLoading] = React.useState(true);
  const [pbxConnected, setPbxConnected] = React.useState(false);
  const [pbxIpAddress, setPbxIpAddress] = React.useState('');
  const [showPbxSetup, setShowPbxSetup] = React.useState(false);
  const [callFilterType, setCallFilterType] = React.useState<string>('all');

  // Load call history
  React.useEffect(() => {
    async function loadCallHistory() {
      try {
        // Try to fetch from FreePBX API first
        const savedPbxIp = typeof window !== 'undefined' ? localStorage.getItem('rcrs-pbx-ip') : null;
        if (savedPbxIp) {
          setPbxIpAddress(savedPbxIp);
          try {
            const response = await fetch(`/api/command-center/phone/calls?extension=${extensionNumber}&pbxIp=${savedPbxIp}`, {
              signal: AbortSignal.timeout(5000),
            });
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.calls) {
                setCallHistory(data.calls);
                setPbxConnected(true);
                setCallHistoryLoading(false);
                return;
              }
            }
          } catch {
            // PBX not reachable, fall through to demo data
          }
        }

        // Fall back to demo data
        setCallHistory(generateDemoCallHistory(extensionNumber));
        setPbxConnected(false);
      } catch {
        setCallHistory(generateDemoCallHistory(extensionNumber));
      } finally {
        setCallHistoryLoading(false);
      }
    }

    if (extensionNumber) {
      loadCallHistory();
    }
  }, [extensionNumber]);

  // If extension not found
  if (!extension) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 p-8">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="mb-2 text-xl font-semibold text-white">
          Extension Not Found
        </h2>
        <p className="mb-6 text-zinc-400">
          Extension {extensionNumber} does not exist in the system.
        </p>
        <Link
          href="/command-center/phone"
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          <ArrowLeft size={16} />
          Back to Phone System
        </Link>
      </div>
    );
  }

  // Status config
  const statusConfig = {
    online: { color: 'bg-lime-500', text: 'text-lime-400', label: 'Available' },
    busy: { color: 'bg-yellow-500', text: 'text-yellow-400', label: 'On Call' },
    ringing: { color: 'bg-brand-green', text: 'text-blue-400', label: 'Ringing' },
    dnd: { color: 'bg-red-500', text: 'text-red-400', label: 'Do Not Disturb' },
    offline: { color: 'bg-zinc-500', text: 'text-zinc-400', label: 'Offline' },
  };

  const status = statusConfig[extension.status];

  // Get voicemail feature codes
  const voicemailCodes = getFeatureCodesByCategory('voicemail');
  const forwardingCodes = getFeatureCodesByCategory('forwarding');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">
              Extension {extension.extension}
            </h1>
            {isOwnExtension && (
              <span className="rounded-full bg-lime-500/20 px-2 py-0.5 text-xs font-medium text-lime-400">
                Your Extension
              </span>
            )}
          </div>
          <p className="mt-1 text-zinc-400">{extension.name}</p>
        </div>
        <PermissionGate permission="phone.manage">
          <button className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700">
            <Settings size={16} />
            Edit Extension
          </button>
        </PermissionGate>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Extension Info */}
        <div className="space-y-6 lg:col-span-2">
          {/* Extension Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-start gap-6">
              {/* Large Extension Number */}
              <div className="flex flex-col items-center rounded-xl border border-zinc-700 bg-zinc-800 p-6">
                <Phone className="mb-2 h-8 w-8 text-lime-400" />
                <span className="text-4xl font-bold text-white">
                  {extension.extension}
                </span>
                <div className="mt-2 flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full', status.color)} />
                  <span className={cn('text-sm font-medium', status.text)}>
                    {status.label}
                  </span>
                </div>
              </div>

              {/* Info Grid */}
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-zinc-500" />
                  <div>
                    <p className="text-xs text-zinc-500">Name</p>
                    <p className="font-medium text-white">{extension.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-zinc-500" />
                  <div>
                    <p className="text-xs text-zinc-500">Email</p>
                    <p className="font-medium text-white">{extension.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-zinc-500" />
                  <div>
                    <p className="text-xs text-zinc-500">Department / Role</p>
                    <p className="font-medium text-white">
                      {extension.department || 'General'} - {extension.role}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Voicemail className="h-5 w-5 text-zinc-500" />
                  <div>
                    <p className="text-xs text-zinc-500">Voicemail</p>
                    <p className="flex items-center gap-2 font-medium text-white">
                      {extension.voicemailEnabled ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-lime-400" />
                          Enabled
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-red-400" />
                          Disabled
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Call Settings */}
          {canEdit && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">
                Call Settings
              </h2>
              <div className="space-y-3">
                <SettingToggle
                  label="Do Not Disturb"
                  description="Send all calls directly to voicemail"
                  enabled={dndEnabled}
                  onChange={setDndEnabled}
                />

                <SettingToggle
                  label="Call Forwarding"
                  description="Forward incoming calls to another number"
                  enabled={forwardingEnabled}
                  onChange={setForwardingEnabled}
                />

                {forwardingEnabled && (
                  <div className="ml-4 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
                    <label className="mb-2 block text-sm font-medium text-white">
                      Forward To
                    </label>
                    <input
                      type="tel"
                      value={forwardNumber}
                      onChange={(e) => setForwardNumber(e.target.value)}
                      placeholder="Enter phone number"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
                    />
                    <p className="mt-2 text-xs text-zinc-500">
                      Or dial <span className="font-mono text-lime-400">*72</span> followed by the number
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent Calls */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Recent Calls</h2>
              <div className="flex items-center gap-2">
                {pbxConnected ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-lime-500/20 px-2.5 py-0.5 text-xs font-medium text-lime-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-lime-400" />
                    PBX Connected
                  </span>
                ) : (
                  <button
                    onClick={() => setShowPbxSetup(!showPbxSetup)}
                    className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-400 hover:bg-amber-500/30 transition-colors"
                  >
                    <Settings size={12} />
                    Demo Data - Connect PBX
                  </button>
                )}
              </div>
            </div>

            {/* PBX Setup Panel */}
            {showPbxSetup && !pbxConnected && (
              <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <h3 className="text-sm font-semibold text-amber-400 mb-2">Connect to FreePBX</h3>
                <p className="text-xs text-zinc-400 mb-3">
                  Enter your FreePBX server IP address to pull live call data via the CDR API.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pbxIpAddress}
                    onChange={(e) => setPbxIpAddress(e.target.value)}
                    placeholder="e.g., 192.168.1.100"
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-lime-500 focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      if (pbxIpAddress) {
                        localStorage.setItem('rcrs-pbx-ip', pbxIpAddress);
                        setShowPbxSetup(false);
                        setCallHistoryLoading(true);
                        // Trigger reload
                        window.location.reload();
                      }
                    }}
                    className="rounded-lg bg-lime-500 px-4 py-2 text-sm font-medium text-black hover:bg-lime-400 transition-colors"
                  >
                    Connect
                  </button>
                </div>
                <p className="text-xs text-zinc-600 mt-2">
                  Requires FreePBX REST API access. Default port: 80/443.
                </p>
              </div>
            )}

            {/* Call Type Filters */}
            <div className="flex gap-2 mb-4">
              {[
                { id: 'all', label: 'All' },
                { id: 'incoming', label: 'Incoming' },
                { id: 'outgoing', label: 'Outgoing' },
                { id: 'missed', label: 'Missed' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCallFilterType(tab.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    callFilterType === tab.id
                      ? "bg-lime-500/20 text-lime-400"
                      : "bg-zinc-800 text-zinc-400 hover:text-white"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Call Records */}
            {callHistoryLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-lime-500/30 border-t-lime-500" />
              </div>
            ) : (
              <div className="space-y-2">
                {callHistory
                  .filter((call) => callFilterType === 'all' || call.type === callFilterType)
                  .map((call) => (
                    <div
                      key={call.id}
                      className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 hover:bg-zinc-800/50 transition-colors"
                    >
                      <CallTypeIcon type={call.type} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-white">
                          {call.name}
                        </p>
                        <p className="text-sm text-zinc-500">{call.number}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-zinc-400">{call.time}</p>
                        <p className="text-xs text-zinc-600">{call.date}</p>
                      </div>
                      {call.duration && (
                        <div className="flex items-center gap-1 text-sm text-zinc-500">
                          <Clock size={12} />
                          {call.duration}
                        </div>
                      )}
                    </div>
                  ))}

                {callHistory.filter((call) => callFilterType === 'all' || call.type === callFilterType).length === 0 && (
                  <div className="rounded-lg bg-zinc-800/30 p-6 text-center">
                    <Phone className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                    <p className="text-sm text-zinc-500">No calls match this filter</p>
                  </div>
                )}
              </div>
            )}

            {/* Call Summary Stats */}
            {!callHistoryLoading && callHistory.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-zinc-800/50 p-3 text-center">
                  <p className="text-lg font-bold text-lime-400">
                    {callHistory.filter((c) => c.type === 'incoming').length}
                  </p>
                  <p className="text-xs text-zinc-500">Incoming</p>
                </div>
                <div className="rounded-lg bg-zinc-800/50 p-3 text-center">
                  <p className="text-lg font-bold text-blue-400">
                    {callHistory.filter((c) => c.type === 'outgoing').length}
                  </p>
                  <p className="text-xs text-zinc-500">Outgoing</p>
                </div>
                <div className="rounded-lg bg-zinc-800/50 p-3 text-center">
                  <p className="text-lg font-bold text-red-400">
                    {callHistory.filter((c) => c.type === 'missed').length}
                  </p>
                  <p className="text-xs text-zinc-500">Missed</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Quick Actions & Feature Codes */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">
              Quick Actions
            </h2>
            <div className="grid gap-3">
              <button className="flex items-center gap-3 rounded-lg bg-lime-500 px-4 py-3 font-medium text-black transition-colors hover:bg-lime-400">
                <Phone size={20} />
                <span>Call This Extension</span>
              </button>

              {extension.voicemailEnabled && (
                <button className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 font-medium text-white transition-colors hover:border-zinc-600 hover:bg-zinc-700">
                  <Voicemail size={20} />
                  <div className="flex-1 text-left">
                    <span>Check Voicemail</span>
                    <span className="ml-2 font-mono text-sm text-lime-400">*97</span>
                  </div>
                </button>
              )}

              <button className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 font-medium text-white transition-colors hover:border-zinc-600 hover:bg-zinc-700">
                <PhoneForwarded size={20} />
                <div className="flex-1 text-left">
                  <span>Forward Calls</span>
                  <span className="ml-2 font-mono text-sm text-lime-400">*72</span>
                </div>
              </button>

              <button className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 font-medium text-white transition-colors hover:border-zinc-600 hover:bg-zinc-700">
                <Ban size={20} />
                <div className="flex-1 text-left">
                  <span>Do Not Disturb</span>
                  <span className="ml-2 font-mono text-sm text-lime-400">*78</span>
                </div>
              </button>
            </div>
          </div>

          {/* Voicemail Feature Codes */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <Voicemail size={20} className="text-purple-400" />
              Voicemail Codes
            </h2>
            <div className="space-y-2">
              {voicemailCodes.map((code) => (
                <FeatureCodeItem key={code.code} code={code} />
              ))}
            </div>
          </div>

          {/* Forwarding Feature Codes */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <PhoneForwarded size={20} className="text-blue-400" />
              Forwarding Codes
            </h2>
            <div className="space-y-2">
              {forwardingCodes.slice(0, 4).map((code) => (
                <FeatureCodeItem key={code.code} code={code} />
              ))}
            </div>
          </div>

          {/* Voicemail Status */}
          {extension.voicemailEnabled && (
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                  <Voicemail className="h-5 w-5 text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Voicemail Box</p>
                  <p className="text-sm text-zinc-400">
                    Dial <span className="font-mono text-purple-400">*97</span> to check messages
                  </p>
                </div>
                <span className="rounded-full bg-lime-500/20 px-2 py-0.5 text-xs font-medium text-lime-400">
                  Active
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
