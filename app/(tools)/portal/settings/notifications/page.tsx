'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Bell, BellOff, Mail, MessageSquare, Smartphone, Globe,
  Loader2, Save, CheckCircle, AlertTriangle, ChevronDown, ChevronUp,
  Shield, Clock, User, Users, Settings, RefreshCw, Info, X, Search
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

// =============================================================================
// TYPES (mirrors notification-service.ts)
// =============================================================================

type NotificationChannel = 'email' | 'sms' | 'groupme' | 'in_app';
type NotificationTrigger =
  | 'lead_assigned'
  | 'appointment_reminder'
  | 'customer_viewed_portal'
  | 'customer_sent_message'
  | 'delivery_status_change'
  | 'payment_received'
  | 'inspection_scheduled'
  | 'rep_arrived_at_job';

interface ChannelPreferences {
  email: boolean;
  sms: boolean;
  groupme: boolean;
  in_app: boolean;
}

interface NullableChannelPreferences {
  email: boolean | null;
  sms: boolean | null;
  groupme: boolean | null;
  in_app: boolean | null;
}

type NotificationPreferences = Record<NotificationTrigger, ChannelPreferences>;
type NotificationOverrides = Record<NotificationTrigger, NullableChannelPreferences>;

interface ReminderTiming {
  minutesBefore: number;
  additionalReminders: number[];
}

interface TriggerMeta {
  key: NotificationTrigger;
  label: string;
  description: string;
}

interface ChannelMeta {
  key: NotificationChannel;
  label: string;
}

interface ResolvedPreference {
  trigger: NotificationTrigger;
  channels: ChannelPreferences;
  sources: Record<NotificationChannel, 'admin' | 'rep' | 'customer'>;
}

interface CustomerOverride {
  customerId: string;
  customerName: string;
  repSlug: string;
  overrides: NotificationOverrides;
  updatedAt: string;
}

// =============================================================================
// CHANNEL ICON MAP
// =============================================================================

const CHANNEL_ICONS: Record<NotificationChannel, typeof Mail> = {
  email: Mail,
  sms: Smartphone,
  groupme: MessageSquare,
  in_app: Bell,
};

// Source badge colors
const SOURCE_COLORS: Record<string, string> = {
  admin: 'bg-blue-900/40 text-blue-400 border-blue-800',
  rep: 'bg-purple-900/40 text-purple-400 border-purple-800',
  customer: 'bg-amber-900/40 text-amber-400 border-amber-800',
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function NotificationSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const repSlug = (user as any)?.userId || user?.name?.toLowerCase().replace(/\s+/g, '-') || '';

  // ─── State ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'my' | 'admin' | 'customers'>('my');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Metadata
  const [triggers, setTriggers] = useState<TriggerMeta[]>([]);
  const [channels, setChannels] = useState<ChannelMeta[]>([]);

  // Admin defaults
  const [adminPreferences, setAdminPreferences] = useState<NotificationPreferences | null>(null);
  const [adminReminderTiming, setAdminReminderTiming] = useState<ReminderTiming>({ minutesBefore: 60, additionalReminders: [1440] });

  // Rep overrides
  const [repOverrides, setRepOverrides] = useState<NotificationOverrides | null>(null);
  const [repReminderTiming, setRepReminderTiming] = useState<Partial<ReminderTiming> | null>(null);

  // Resolved (read-only display)
  const [resolvedPrefs, setResolvedPrefs] = useState<ResolvedPreference[]>([]);

  // Customer overrides
  const [customerOverrides, setCustomerOverrides] = useState<CustomerOverride[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');

  // Expanded sections
  const [expandedTriggers, setExpandedTriggers] = useState<Set<string>>(new Set());

  // ─── Load Data ─────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load resolved preferences to get metadata and current effective prefs
      const resolvedRes = await fetch(`/api/notifications/preferences?level=resolved&repSlug=${repSlug}`);
      if (resolvedRes.ok) {
        const data = await resolvedRes.json();
        if (data.success) {
          setResolvedPrefs(data.data.preferences || []);
          if (data.metadata) {
            setTriggers(data.metadata.triggers || []);
            setChannels(data.metadata.channels || []);
          }
        }
      }

      // Load rep overrides
      const repRes = await fetch(`/api/notifications/preferences?level=rep&repSlug=${repSlug}`);
      if (repRes.ok) {
        const data = await repRes.json();
        if (data.success) {
          setRepOverrides(data.data.overrides || null);
          setRepReminderTiming(data.data.reminderTiming || null);
          if (data.adminDefaults) {
            setAdminPreferences(data.adminDefaults);
          }
        }
      }

      // Load admin config
      if (isAdmin) {
        const adminRes = await fetch('/api/notifications/preferences?level=admin');
        if (adminRes.ok) {
          const data = await adminRes.json();
          if (data.success) {
            setAdminPreferences(data.data.defaults || null);
            setAdminReminderTiming(data.data.reminderTiming || { minutesBefore: 60, additionalReminders: [1440] });
          }
        }
      }

      // Load customer overrides for this rep
      const custRes = await fetch(`/api/notifications/preferences?level=rep_customers&repSlug=${repSlug}`);
      if (custRes.ok) {
        const data = await custRes.json();
        if (data.success) {
          setCustomerOverrides(data.data || []);
        }
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
      setMessage({ type: 'error', text: 'Failed to load notification preferences' });
    }
    setLoading(false);
  }, [repSlug, isAdmin]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  // ─── Save Handlers ────────────────────────────────────────────────────

  const saveAdminDefaults = async () => {
    if (!adminPreferences) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'admin',
          preferences: adminPreferences,
          reminderTiming: adminReminderTiming,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Company notification defaults saved!' });
        // Reload resolved to reflect changes
        loadData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save admin defaults' });
    }
    setSaving(false);
  };

  const saveRepOverrides = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'rep',
          repSlug,
          repName: user?.name || repSlug,
          overrides: repOverrides || createEmptyOverrides(),
          reminderTiming: repReminderTiming,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Your notification preferences saved!' });
        loadData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save your preferences' });
    }
    setSaving(false);
  };

  const saveCustomerOverride = async (override: CustomerOverride) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'customer',
          customerId: override.customerId,
          customerName: override.customerName,
          repSlug: override.repSlug || repSlug,
          overrides: override.overrides,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Preferences saved for ${override.customerName}` });
        loadData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save customer preferences' });
    }
    setSaving(false);
  };

  // ─── Toggle Helpers ───────────────────────────────────────────────────

  const createEmptyOverrides = (): NotificationOverrides => {
    const overrides: Record<string, NullableChannelPreferences> = {};
    for (const t of triggers) {
      overrides[t.key] = { email: null, sms: null, groupme: null, in_app: null };
    }
    return overrides as NotificationOverrides;
  };

  const toggleAdminChannel = (trigger: NotificationTrigger, channel: NotificationChannel) => {
    if (!adminPreferences) return;
    setAdminPreferences(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [trigger]: {
          ...prev[trigger],
          [channel]: !prev[trigger][channel],
        },
      };
    });
  };

  const toggleRepChannel = (trigger: NotificationTrigger, channel: NotificationChannel) => {
    setRepOverrides(prev => {
      const current = prev || createEmptyOverrides();
      const currentVal = current[trigger]?.[channel];

      // Cycle: null (inherit) -> true (on) -> false (off) -> null (inherit)
      let newVal: boolean | null;
      if (currentVal === null || currentVal === undefined) {
        newVal = true;
      } else if (currentVal === true) {
        newVal = false;
      } else {
        newVal = null; // back to inherit
      }

      return {
        ...current,
        [trigger]: {
          ...current[trigger],
          [channel]: newVal,
        },
      };
    });
  };

  const toggleCustomerChannel = (
    customerId: string,
    trigger: NotificationTrigger,
    channel: NotificationChannel
  ) => {
    setCustomerOverrides(prev =>
      prev.map(co => {
        if (co.customerId !== customerId) return co;
        const currentVal = co.overrides?.[trigger]?.[channel];
        let newVal: boolean | null;
        if (currentVal === null || currentVal === undefined) {
          newVal = true;
        } else if (currentVal === true) {
          newVal = false;
        } else {
          newVal = null;
        }
        return {
          ...co,
          overrides: {
            ...co.overrides,
            [trigger]: {
              ...(co.overrides?.[trigger] || { email: null, sms: null, groupme: null, in_app: null }),
              [channel]: newVal,
            },
          },
        };
      })
    );
  };

  const toggleTriggerExpand = (trigger: string) => {
    setExpandedTriggers(prev => {
      const next = new Set(prev);
      if (next.has(trigger)) next.delete(trigger);
      else next.add(trigger);
      return next;
    });
  };

  // ─── Render Helpers ───────────────────────────────────────────────────

  const getAdminValue = (trigger: NotificationTrigger, channel: NotificationChannel): boolean => {
    return adminPreferences?.[trigger]?.[channel] ?? false;
  };

  const getRepOverrideValue = (trigger: NotificationTrigger, channel: NotificationChannel): boolean | null => {
    return repOverrides?.[trigger]?.[channel] ?? null;
  };

  const getEffectiveValue = (trigger: NotificationTrigger, channel: NotificationChannel): boolean => {
    const resolved = resolvedPrefs.find(r => r.trigger === trigger);
    return resolved?.channels[channel] ?? false;
  };

  const getSource = (trigger: NotificationTrigger, channel: NotificationChannel): string => {
    const resolved = resolvedPrefs.find(r => r.trigger === trigger);
    return resolved?.sources[channel] ?? 'admin';
  };

  // Three-state toggle button component
  const TriStateToggle = ({
    value,
    adminDefault,
    onChange,
    label,
  }: {
    value: boolean | null;
    adminDefault: boolean;
    onChange: () => void;
    label: string;
  }) => {
    const isInherited = value === null || value === undefined;
    const effectiveValue = isInherited ? adminDefault : value;

    return (
      <button
        onClick={onChange}
        className={`relative w-10 h-6 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-green/50 ${
          isInherited
            ? effectiveValue
              ? 'bg-green-900/40 border border-dashed border-green-600'
              : 'bg-neutral-800 border border-dashed border-neutral-600'
            : effectiveValue
              ? 'bg-green-600'
              : 'bg-neutral-700 border border-neutral-600'
        }`}
        title={
          isInherited
            ? `Inherited from ${adminDefault ? 'enabled' : 'disabled'} (click to override)`
            : `${value ? 'Enabled' : 'Disabled'} (click to change, or click again to inherit)`
        }
        aria-label={label}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200 ${
            effectiveValue ? 'left-4' : 'left-0.5'
          } ${
            isInherited
              ? 'bg-neutral-400'
              : effectiveValue
                ? 'bg-white'
                : 'bg-neutral-500'
          }`}
        />
        {isInherited && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" title="Inherited" />
        )}
      </button>
    );
  };

  // Simple on/off toggle (for admin)
  const SimpleToggle = ({
    value,
    onChange,
    label,
  }: {
    value: boolean;
    onChange: () => void;
    label: string;
  }) => (
    <button
      onClick={onChange}
      className={`relative w-10 h-6 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-green/50 ${
        value ? 'bg-green-600' : 'bg-neutral-700 border border-neutral-600'
      }`}
      aria-label={label}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-200 ${
          value ? 'left-4' : 'left-0.5'
        }`}
      />
    </button>
  );

  // ─── Loading ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-green mx-auto mb-3" />
          <p className="text-neutral-400">Loading notification preferences...</p>
        </div>
      </div>
    );
  }

  // ─── Main Render ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <div className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/portal/dashboard" className="text-neutral-400 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Bell className="w-5 h-5 text-[#39FF14]" />
                  Notification Settings
                </h1>
                <p className="text-sm text-neutral-400 mt-0.5">
                  Configure when and how you receive notifications
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/portal/settings/notifications/push"
                className="px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg inline-flex items-center gap-1.5"
                title="Push notifications via ntfy.sh"
              >
                <Smartphone className="w-4 h-4" />
                Push (ntfy)
              </Link>
              <button
                onClick={loadData}
                className="text-neutral-400 hover:text-white p-2 rounded-lg hover:bg-neutral-800 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`max-w-6xl mx-auto px-4 mt-4`}>
          <div className={`flex items-center gap-2 p-3 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-900/20 border-green-800 text-green-400'
              : 'bg-red-900/20 border-red-800 text-red-400'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
            <span className="text-sm">{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="max-w-6xl mx-auto px-4 mt-6">
        <div className="flex gap-1 bg-neutral-900 rounded-lg p-1 border border-neutral-800">
          <button
            onClick={() => setActiveTab('my')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'my'
                ? 'bg-neutral-800 text-[#39FF14] shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            My Preferences
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                activeTab === 'admin'
                  ? 'bg-neutral-800 text-[#39FF14] shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              Company Defaults
            </button>
          )}
          <button
            onClick={() => setActiveTab('customers')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'customers'
                ? 'bg-neutral-800 text-[#39FF14] shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            Per-Customer
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* ──────────── MY PREFERENCES TAB ──────────── */}
        {activeTab === 'my' && (
          <div className="space-y-6">
            {/* Legend */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-neutral-300 mb-2 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-400" />
                How it works
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Each toggle has three states: <span className="text-blue-400 font-medium">inherited</span> (dashed border, uses company default),{' '}
                <span className="text-green-400 font-medium">on</span> (solid green), or{' '}
                <span className="text-neutral-400 font-medium">off</span> (solid dark).
                Click to cycle through states. A <span className="inline-block w-2 h-2 bg-blue-500 rounded-full align-middle" /> dot means inherited.
              </p>
              <div className="flex flex-wrap gap-3 mt-3 text-xs">
                <span className={`px-2 py-1 rounded border ${SOURCE_COLORS.admin}`}>Admin default</span>
                <span className={`px-2 py-1 rounded border ${SOURCE_COLORS.rep}`}>Your override</span>
                <span className={`px-2 py-1 rounded border ${SOURCE_COLORS.customer}`}>Customer-specific</span>
              </div>
            </div>

            {/* Matrix */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-0 bg-neutral-900/80 border-b border-neutral-800 sticky top-[73px] z-10">
                <div className="p-3 text-sm font-semibold text-neutral-400">Trigger</div>
                {channels.map(ch => {
                  const Icon = CHANNEL_ICONS[ch.key];
                  return (
                    <div key={ch.key} className="p-3 text-center">
                      <Icon className="w-4 h-4 mx-auto text-neutral-400 mb-1" />
                      <span className="text-xs text-neutral-500">{ch.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Trigger rows */}
              {triggers.map(trigger => {
                const isExpanded = expandedTriggers.has(trigger.key);
                return (
                  <div key={trigger.key} className="border-b border-neutral-800 last:border-b-0">
                    <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-0 items-center hover:bg-neutral-800/40 transition-colors">
                      {/* Trigger info */}
                      <button
                        onClick={() => toggleTriggerExpand(trigger.key)}
                        className="p-3 text-left flex items-center gap-2"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                        )}
                        <div>
                          <span className="text-sm font-medium text-neutral-200">{trigger.label}</span>
                          {isExpanded && (
                            <p className="text-xs text-neutral-500 mt-0.5">{trigger.description}</p>
                          )}
                        </div>
                      </button>

                      {/* Channel toggles */}
                      {channels.map(ch => {
                        const overrideVal = getRepOverrideValue(trigger.key, ch.key);
                        const adminVal = getAdminValue(trigger.key, ch.key);
                        const source = getSource(trigger.key, ch.key);
                        return (
                          <div key={ch.key} className="p-3 flex flex-col items-center gap-1">
                            <TriStateToggle
                              value={overrideVal}
                              adminDefault={adminVal}
                              onChange={() => toggleRepChannel(trigger.key, ch.key)}
                              label={`${trigger.label} - ${ch.label}`}
                            />
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SOURCE_COLORS[source]}`}>
                              {source}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Expanded details */}
                    {isExpanded && trigger.key === 'appointment_reminder' && (
                      <div className="px-4 pb-4 bg-neutral-900/60">
                        <div className="ml-6 flex items-center gap-4 text-sm">
                          <Clock className="w-4 h-4 text-neutral-500" />
                          <label className="text-neutral-400">Remind me</label>
                          <select
                            className="bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-white focus:border-[#39FF14] focus:outline-none"
                            value={repReminderTiming?.minutesBefore ?? adminReminderTiming.minutesBefore}
                            onChange={e => {
                              const val = parseInt(e.target.value);
                              setRepReminderTiming(prev => ({ ...prev, minutesBefore: val }));
                            }}
                          >
                            <option value={15}>15 minutes before</option>
                            <option value={30}>30 minutes before</option>
                            <option value={60}>1 hour before</option>
                            <option value={120}>2 hours before</option>
                            <option value={1440}>24 hours before</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {isExpanded && trigger.key === 'rep_arrived_at_job' && (
                      <div className="px-4 pb-4 bg-neutral-900/60">
                        <div className="ml-6 flex items-center gap-2 text-xs text-neutral-500">
                          <Info className="w-3 h-3" />
                          <span>Location-based check-in is a future feature. This trigger can be manually activated for now.</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Save button */}
            <div className="flex justify-end">
              <button
                onClick={saveRepOverrides}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#39FF14] text-black font-bold rounded-lg hover:bg-[#32e612] disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save My Preferences
              </button>
            </div>
          </div>
        )}

        {/* ──────────── ADMIN DEFAULTS TAB ──────────── */}
        {activeTab === 'admin' && isAdmin && adminPreferences && (
          <div className="space-y-6">
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-neutral-300 mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                Company Defaults
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                These settings define the baseline notification preferences for the entire company.
                Individual reps can override these for themselves, and reps can further customize per customer.
              </p>
            </div>

            {/* Admin Matrix */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-0 bg-neutral-900/80 border-b border-neutral-800">
                <div className="p-3 text-sm font-semibold text-neutral-400">Trigger</div>
                {channels.map(ch => {
                  const Icon = CHANNEL_ICONS[ch.key];
                  return (
                    <div key={ch.key} className="p-3 text-center">
                      <Icon className="w-4 h-4 mx-auto text-neutral-400 mb-1" />
                      <span className="text-xs text-neutral-500">{ch.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Trigger rows */}
              {triggers.map(trigger => (
                <div key={trigger.key} className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-0 items-center border-b border-neutral-800 last:border-b-0 hover:bg-neutral-800/40 transition-colors">
                  <div className="p-3">
                    <span className="text-sm font-medium text-neutral-200">{trigger.label}</span>
                    <p className="text-xs text-neutral-500 mt-0.5">{trigger.description}</p>
                  </div>
                  {channels.map(ch => (
                    <div key={ch.key} className="p-3 flex justify-center">
                      <SimpleToggle
                        value={adminPreferences[trigger.key]?.[ch.key] ?? false}
                        onChange={() => toggleAdminChannel(trigger.key, ch.key)}
                        label={`${trigger.label} - ${ch.label}`}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Reminder Timing */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-neutral-300 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#39FF14]" />
                Default Appointment Reminder Timing
              </h3>
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">Primary reminder</label>
                  <select
                    className="bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:border-[#39FF14] focus:outline-none"
                    value={adminReminderTiming.minutesBefore}
                    onChange={e => setAdminReminderTiming(prev => ({ ...prev, minutesBefore: parseInt(e.target.value) }))}
                  >
                    <option value={15}>15 minutes before</option>
                    <option value={30}>30 minutes before</option>
                    <option value={60}>1 hour before</option>
                    <option value={120}>2 hours before</option>
                    <option value={1440}>24 hours before</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">Additional reminder</label>
                  <select
                    className="bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:border-[#39FF14] focus:outline-none"
                    value={adminReminderTiming.additionalReminders[0] || 0}
                    onChange={e => {
                      const val = parseInt(e.target.value);
                      setAdminReminderTiming(prev => ({
                        ...prev,
                        additionalReminders: val > 0 ? [val] : [],
                      }));
                    }}
                  >
                    <option value={0}>None</option>
                    <option value={60}>1 hour before</option>
                    <option value={120}>2 hours before</option>
                    <option value={1440}>24 hours before</option>
                    <option value={2880}>48 hours before</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Save */}
            <div className="flex justify-end">
              <button
                onClick={saveAdminDefaults}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#39FF14] text-black font-bold rounded-lg hover:bg-[#32e612] disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Company Defaults
              </button>
            </div>
          </div>
        )}

        {/* ──────────── PER-CUSTOMER TAB ──────────── */}
        {activeTab === 'customers' && (
          <div className="space-y-6">
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-neutral-300 mb-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                Per-Customer Notification Overrides
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Customize notification preferences for individual homeowners. These override both company
                defaults and your personal settings for the selected customer.
              </p>
            </div>

            {customerOverrides.length === 0 ? (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-8 text-center">
                <BellOff className="w-8 h-8 text-neutral-600 mx-auto mb-3" />
                <p className="text-neutral-400 text-sm">No customer-specific overrides configured yet.</p>
                <p className="text-neutral-500 text-xs mt-1">
                  Customer overrides can be set from the customer detail page or by adding one below.
                </p>
              </div>
            ) : (
              <>
                {/* Search */}
                {customerOverrides.length > 5 && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                      type="text"
                      placeholder="Search customers..."
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:border-[#39FF14] focus:outline-none"
                    />
                  </div>
                )}

                {/* Customer list */}
                {customerOverrides
                  .filter(co =>
                    !customerSearch ||
                    co.customerName.toLowerCase().includes(customerSearch.toLowerCase()) ||
                    co.customerId.toLowerCase().includes(customerSearch.toLowerCase())
                  )
                  .map(co => (
                    <div key={co.customerId} className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
                      {/* Customer header */}
                      <button
                        onClick={() => setSelectedCustomer(prev => prev === co.customerId ? null : co.customerId)}
                        className="w-full flex items-center justify-between p-4 hover:bg-neutral-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-neutral-800 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-neutral-400" />
                          </div>
                          <div className="text-left">
                            <span className="text-sm font-medium text-neutral-200">{co.customerName}</span>
                            <span className="text-xs text-neutral-500 ml-2">{co.customerId}</span>
                          </div>
                        </div>
                        {selectedCustomer === co.customerId ? (
                          <ChevronUp className="w-4 h-4 text-neutral-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-neutral-500" />
                        )}
                      </button>

                      {/* Expanded customer matrix */}
                      {selectedCustomer === co.customerId && (
                        <div className="border-t border-neutral-800">
                          {/* Column headers */}
                          <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-0 bg-neutral-900/80 border-b border-neutral-800">
                            <div className="p-2 pl-4 text-xs font-medium text-neutral-500">Trigger</div>
                            {channels.map(ch => {
                              const Icon = CHANNEL_ICONS[ch.key];
                              return (
                                <div key={ch.key} className="p-2 text-center">
                                  <Icon className="w-3 h-3 mx-auto text-neutral-500" />
                                </div>
                              );
                            })}
                          </div>

                          {/* Rows */}
                          {triggers.map(trigger => (
                            <div key={trigger.key} className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-0 items-center border-b border-neutral-800/50 last:border-b-0 hover:bg-neutral-800/30 transition-colors">
                              <div className="p-2 pl-4">
                                <span className="text-xs text-neutral-300">{trigger.label}</span>
                              </div>
                              {channels.map(ch => {
                                const overrideVal = co.overrides?.[trigger.key]?.[ch.key] ?? null;
                                const adminVal = getAdminValue(trigger.key, ch.key);
                                return (
                                  <div key={ch.key} className="p-2 flex justify-center">
                                    <TriStateToggle
                                      value={overrideVal}
                                      adminDefault={adminVal}
                                      onChange={() => toggleCustomerChannel(co.customerId, trigger.key, ch.key)}
                                      label={`${co.customerName} - ${trigger.label} - ${ch.label}`}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          ))}

                          {/* Save per-customer */}
                          <div className="p-3 flex justify-end border-t border-neutral-800">
                            <button
                              onClick={() => saveCustomerOverride(co)}
                              disabled={saving}
                              className="flex items-center gap-2 px-4 py-2 bg-[#39FF14] text-black font-bold text-sm rounded-lg hover:bg-[#32e612] disabled:opacity-50 transition-colors"
                            >
                              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                              Save for {co.customerName}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
