'use client';

/**
 * RCRS Command Center - Extension Detail Page
 *
 * Shows detailed information for a specific extension including:
 * - Extension info (number, name, email, role)
 * - Voicemail status
 * - Call forwarding settings
 * - Recent calls placeholder
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
// PLACEHOLDER DATA
// =============================================================================

// Recent calls placeholder data
const RECENT_CALLS_PLACEHOLDER = [
  {
    id: '1',
    type: 'incoming' as const,
    number: '(256) 555-0123',
    name: 'John Smith',
    duration: '3:45',
    time: '10:30 AM',
    date: 'Today',
  },
  {
    id: '2',
    type: 'outgoing' as const,
    number: '(256) 555-0456',
    name: 'ABC Roofing Supplies',
    duration: '12:20',
    time: '9:15 AM',
    date: 'Today',
  },
  {
    id: '3',
    type: 'missed' as const,
    number: '(256) 555-0789',
    name: 'Unknown',
    duration: null,
    time: '4:45 PM',
    date: 'Yesterday',
  },
  {
    id: '4',
    type: 'incoming' as const,
    number: '(256) 555-0321',
    name: 'Sarah Johnson',
    duration: '8:12',
    time: '2:30 PM',
    date: 'Yesterday',
  },
];

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

  // Placeholder state for settings
  const [dndEnabled, setDndEnabled] = React.useState(false);
  const [forwardingEnabled, setForwardingEnabled] = React.useState(false);
  const [forwardNumber, setForwardNumber] = React.useState('');

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
    ringing: { color: 'bg-blue-500', text: 'text-blue-400', label: 'Ringing' },
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
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
                Placeholder Data
              </span>
            </div>

            <div className="space-y-2">
              {RECENT_CALLS_PLACEHOLDER.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-800/30 p-3"
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
            </div>

            <div className="mt-4 flex items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-800/20 p-4">
              <p className="text-sm text-zinc-500">
                Call history integration coming soon
              </p>
            </div>
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
                    <span className="text-purple-400">3</span> new messages
                  </p>
                </div>
                <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-400">
                  Placeholder
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
