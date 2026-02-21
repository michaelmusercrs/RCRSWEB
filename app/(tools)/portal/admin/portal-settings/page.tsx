'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Settings, Users, Shield, Eye, EyeOff, MessageSquare,
  Cloud, Upload, Calendar, FileText, Loader2, Save, CheckCircle,
  AlertTriangle, ChevronDown, ChevronUp, BarChart3, Zap
} from 'lucide-react';

interface PortalSettings {
  showWeather: boolean;
  showHailReports: boolean;
  showStormReport: boolean;
  showHailRecon: boolean;
  showWeatherAlerts: boolean;
  showRiskScore: boolean;
  showAppointments: boolean;
  showDocuments: boolean;
  showMessages: boolean;
  showJobProgress: boolean;
  showDeliveryTracking: boolean;
  allowFileUpload: boolean;
  allowMessages: boolean;
}

interface RepOverride {
  repSlug: string;
  repName: string;
  showWeather: boolean | null;
  showHailReports: boolean | null;
  showStormReport: boolean | null;
  showHailRecon: boolean | null;
  showWeatherAlerts: boolean | null;
  showRiskScore: boolean | null;
  showAppointments: boolean | null;
  showDocuments: boolean | null;
  showMessages: boolean | null;
  showJobProgress: boolean | null;
  showDeliveryTracking: boolean | null;
  allowFileUpload: boolean | null;
  allowMessages: boolean | null;
  updatedAt: string;
  updatedBy: string;
}

interface TeamMemberInfo {
  slug: string;
  name: string;
  position: string;
  category: string;
}

type SettingKey = keyof PortalSettings;

const SETTING_CONFIG: {
  key: SettingKey;
  label: string;
  description: string;
  icon: typeof Eye;
  section: 'visibility' | 'actions';
}[] = [
  { key: 'showJobProgress', label: 'Job Progress', description: 'Show project phases and progress bar', icon: BarChart3, section: 'visibility' },
  { key: 'showAppointments', label: 'Appointments', description: 'Show scheduled appointments', icon: Calendar, section: 'visibility' },
  { key: 'showDocuments', label: 'Documents', description: 'Show estimates, invoices, contracts', icon: FileText, section: 'visibility' },
  { key: 'showMessages', label: 'Messages', description: 'Show communication history', icon: MessageSquare, section: 'visibility' },
  { key: 'showWeather', label: 'Weather', description: '5-day weather forecast', icon: Cloud, section: 'visibility' },
  { key: 'showHailReports', label: 'Hail Reports', description: 'Nearby hail activity (NWS)', icon: AlertTriangle, section: 'visibility' },
  { key: 'showStormReport', label: 'Storm Report', description: 'Full storm damage risk report', icon: Shield, section: 'visibility' },
  { key: 'showHailRecon', label: 'HailRecon Data', description: 'Historical hail data since 2011', icon: Cloud, section: 'visibility' },
  { key: 'showWeatherAlerts', label: 'Weather Alerts', description: 'Active NWS weather alerts', icon: AlertTriangle, section: 'visibility' },
  { key: 'showRiskScore', label: 'Risk Score', description: 'Storm damage risk score', icon: Shield, section: 'visibility' },
  { key: 'showDeliveryTracking', label: 'Delivery Tracking', description: 'Material delivery status tracking', icon: Eye, section: 'visibility' },
  { key: 'allowFileUpload', label: 'File Uploads', description: 'Customer can upload photos/documents', icon: Upload, section: 'actions' },
  { key: 'allowMessages', label: 'Send Messages', description: 'Customer can send messages to rep', icon: MessageSquare, section: 'actions' },
];

export default function PortalSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [globalSettings, setGlobalSettings] = useState<PortalSettings>({
    showWeather: false,
    showHailReports: false,
    showStormReport: false,
    showHailRecon: false,
    showWeatherAlerts: false,
    showRiskScore: false,
    showAppointments: false,
    showDocuments: false,
    showMessages: false,
    showJobProgress: false,
    showDeliveryTracking: false,
    allowFileUpload: false,
    allowMessages: false,
  });

  const [repOverrides, setRepOverrides] = useState<RepOverride[]>([]);
  const [teamMembersList, setTeamMembersList] = useState<TeamMemberInfo[]>([]);
  const [expandedRep, setExpandedRep] = useState<string | null>(null);
  const [savingRep, setSavingRep] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/portal-settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();

      if (data.success) {
        setGlobalSettings(data.globalSettings);
        setRepOverrides(data.repOverrides || []);
        setTeamMembersList(data.teamMembers || []);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError('Failed to load portal settings');
    } finally {
      setLoading(false);
    }
  };

  const saveGlobalSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      const response = await fetch('/api/admin/portal-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'global', settings: globalSettings }),
      });

      if (!response.ok) throw new Error('Failed to save settings');
      const data = await response.json();

      if (data.success) {
        setSaveSuccess('Global settings saved');
        setTimeout(() => setSaveSuccess(null), 3000);
      }
    } catch (err) {
      console.error('Error saving global settings:', err);
      setError('Failed to save global settings');
    } finally {
      setSaving(false);
    }
  };

  const getRepOverride = (repSlug: string): RepOverride | undefined => {
    return repOverrides.find(r => r.repSlug === repSlug);
  };

  const getRepSettingValue = (repSlug: string, key: SettingKey): boolean | null => {
    const override = getRepOverride(repSlug);
    if (!override) return null;
    return override[key] as boolean | null;
  };

  const setRepSettingValue = (repSlug: string, repName: string, key: SettingKey, value: boolean | null) => {
    setRepOverrides(prev => {
      const existing = prev.find(r => r.repSlug === repSlug);
      if (existing) {
        return prev.map(r =>
          r.repSlug === repSlug ? { ...r, [key]: value } : r
        );
      } else {
        // Create new override with all null values except the changed one
        const newOverride: RepOverride = {
          repSlug,
          repName,
          showWeather: null,
          showHailReports: null,
          showStormReport: null,
          showHailRecon: null,
          showWeatherAlerts: null,
          showRiskScore: null,
          showAppointments: null,
          showDocuments: null,
          showMessages: null,
          showJobProgress: null,
          showDeliveryTracking: null,
          allowFileUpload: null,
          allowMessages: null,
          updatedAt: '',
          updatedBy: '',
          [key]: value,
        };
        return [...prev, newOverride];
      }
    });
  };

  const saveRepSettings = async (repSlug: string) => {
    const override = repOverrides.find(r => r.repSlug === repSlug);
    if (!override) return;

    try {
      setSavingRep(repSlug);
      setError(null);
      const response = await fetch('/api/admin/portal-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'rep',
          repSlug,
          settings: {
            repName: override.repName,
            showWeather: override.showWeather,
            showHailReports: override.showHailReports,
            showStormReport: override.showStormReport,
            showHailRecon: override.showHailRecon,
            showWeatherAlerts: override.showWeatherAlerts,
            showRiskScore: override.showRiskScore,
            showAppointments: override.showAppointments,
            showDocuments: override.showDocuments,
            showMessages: override.showMessages,
            showJobProgress: override.showJobProgress,
            showDeliveryTracking: override.showDeliveryTracking,
            allowFileUpload: override.allowFileUpload,
            allowMessages: override.allowMessages,
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to save rep settings');
      const data = await response.json();

      if (data.success) {
        setSaveSuccess(`Settings saved for ${override.repName}`);
        setTimeout(() => setSaveSuccess(null), 3000);
      }
    } catch (err) {
      console.error('Error saving rep settings:', err);
      setError(`Failed to save settings for ${override.repName}`);
    } finally {
      setSavingRep(null);
    }
  };

  const getEffectiveValue = (repSlug: string, key: SettingKey): boolean => {
    const repValue = getRepSettingValue(repSlug, key);
    if (repValue !== null) return repValue;
    return globalSettings[key];
  };

  const hasAnyOverride = (repSlug: string): boolean => {
    const override = getRepOverride(repSlug);
    if (!override) return false;
    return SETTING_CONFIG.some(s => override[s.key] !== null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-brand-green/20 border border-brand-green/30 flex items-center justify-center">
              <Settings className="text-brand-green" size={32} />
            </div>
            <div className="absolute inset-0 rounded-2xl border-2 border-brand-green/30 animate-ping" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-white">Loading Settings</h2>
            <p className="text-sm text-zinc-400 mt-1">Fetching portal configuration...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/portal/admin"
                className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
              >
                <ArrowLeft size={18} className="text-zinc-400" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Shield className="text-brand-green" size={22} />
                  Portal Settings
                </h1>
                <p className="text-sm text-zinc-400">Configure customer portal features globally and per-rep</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Success / Error Banners */}
      {saveSuccess && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className="flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">
            <CheckCircle size={16} />
            {saveSuccess}
          </div>
        </div>
      )}
      {error && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            <AlertTriangle size={16} />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Global Defaults Section */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center">
              <Settings size={20} className="text-brand-green" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Global Defaults</h2>
              <p className="text-sm text-zinc-400">These apply to all customer portals unless overridden per-rep</p>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            {/* Visibility Settings */}
            <div className="p-4 border-b border-zinc-800">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                <Eye size={14} />
                Visible Sections
              </h3>
            </div>
            <div className="divide-y divide-zinc-800">
              {SETTING_CONFIG.filter(s => s.section === 'visibility').map(setting => {
                const Icon = setting.icon;
                return (
                  <label
                    key={setting.key}
                    className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} className="text-zinc-400" />
                      <div>
                        <p className="text-white font-medium text-sm">{setting.label}</p>
                        <p className="text-xs text-zinc-500">{setting.description}</p>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={globalSettings[setting.key]}
                      onChange={(val) => setGlobalSettings({ ...globalSettings, [setting.key]: val })}
                    />
                  </label>
                );
              })}
            </div>

            {/* Action Settings */}
            <div className="p-4 border-t border-b border-zinc-800">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                <Zap size={14} />
                Customer Actions
              </h3>
            </div>
            <div className="divide-y divide-zinc-800">
              {SETTING_CONFIG.filter(s => s.section === 'actions').map(setting => {
                const Icon = setting.icon;
                return (
                  <label
                    key={setting.key}
                    className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} className="text-zinc-400" />
                      <div>
                        <p className="text-white font-medium text-sm">{setting.label}</p>
                        <p className="text-xs text-zinc-500">{setting.description}</p>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={globalSettings[setting.key]}
                      onChange={(val) => setGlobalSettings({ ...globalSettings, [setting.key]: val })}
                    />
                  </label>
                );
              })}
            </div>

            {/* Save Button */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
              <button
                onClick={saveGlobalSettings}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-green text-black font-medium rounded-xl hover:bg-brand-green/90 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Save Global Defaults
              </button>
            </div>
          </div>
        </section>

        {/* Per-Rep Overrides Section */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center">
              <Users size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Per-Rep Overrides</h2>
              <p className="text-sm text-zinc-400">
                Override global settings for specific team members. Use &quot;Inherit&quot; to use the global default.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {teamMembersList.map(member => {
              const isExpanded = expandedRep === member.slug;
              const hasOverrides = hasAnyOverride(member.slug);

              return (
                <div
                  key={member.slug}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden"
                >
                  {/* Rep Header */}
                  <button
                    onClick={() => setExpandedRep(isExpanded ? null : member.slug)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                        {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="text-left">
                        <p className="text-white font-medium text-sm">{member.name}</p>
                        <p className="text-xs text-zinc-500">{member.position} - {member.category}</p>
                      </div>
                      {hasOverrides && (
                        <span className="px-2 py-0.5 rounded-full bg-brand-green/20 text-blue-400 text-xs font-medium">
                          Custom
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Mini status indicators */}
                      <div className="hidden sm:flex items-center gap-1">
                        {SETTING_CONFIG.map(s => {
                          const effective = getEffectiveValue(member.slug, s.key);
                          const repVal = getRepSettingValue(member.slug, s.key);
                          const isOverridden = repVal !== null;
                          return (
                            <div
                              key={s.key}
                              className={`w-2 h-2 rounded-full ${
                                effective
                                  ? isOverridden ? 'bg-blue-400' : 'bg-brand-green'
                                  : isOverridden ? 'bg-red-400' : 'bg-zinc-600'
                              }`}
                              title={`${s.label}: ${effective ? 'On' : 'Off'}${isOverridden ? ' (override)' : ' (global)'}`}
                            />
                          );
                        })}
                      </div>
                      {isExpanded ? (
                        <ChevronUp size={18} className="text-zinc-400" />
                      ) : (
                        <ChevronDown size={18} className="text-zinc-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Settings */}
                  {isExpanded && (
                    <div className="border-t border-zinc-800">
                      <div className="p-4">
                        <div className="grid gap-3">
                          {SETTING_CONFIG.map(setting => {
                            const Icon = setting.icon;
                            const repValue = getRepSettingValue(member.slug, setting.key);
                            const effectiveValue = getEffectiveValue(member.slug, setting.key);

                            return (
                              <div
                                key={setting.key}
                                className="flex items-center justify-between px-4 py-3 bg-zinc-800/50 rounded-xl"
                              >
                                <div className="flex items-center gap-3">
                                  <Icon size={16} className="text-zinc-400" />
                                  <div>
                                    <p className="text-white text-sm font-medium">{setting.label}</p>
                                    <p className="text-xs text-zinc-500">
                                      Effective: <span className={effectiveValue ? 'text-brand-green' : 'text-red-400'}>
                                        {effectiveValue ? 'On' : 'Off'}
                                      </span>
                                      {repValue === null && (
                                        <span className="text-zinc-600"> (from global)</span>
                                      )}
                                    </p>
                                  </div>
                                </div>

                                {/* Three-state toggle: On / Off / Inherit */}
                                <ThreeStateToggle
                                  value={repValue}
                                  globalValue={globalSettings[setting.key]}
                                  onChange={(val) => setRepSettingValue(member.slug, member.name, setting.key, val)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Save button for this rep */}
                      <div className="px-4 pb-4">
                        <button
                          onClick={() => saveRepSettings(member.slug)}
                          disabled={savingRep === member.slug}
                          className="flex items-center gap-2 px-5 py-2 bg-brand-green text-black font-medium rounded-xl hover:bg-brand-green transition-colors disabled:opacity-50 text-sm"
                        >
                          {savingRep === member.slug ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Save size={14} />
                          )}
                          Save {member.name}&apos;s Settings
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Legend */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Legend</h3>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-brand-green" />
              <span className="text-zinc-400">On (inherited from global)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-400" />
              <span className="text-zinc-400">On (rep override)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-zinc-600" />
              <span className="text-zinc-400">Off (inherited from global)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <span className="text-zinc-400">Off (rep override)</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// Toggle switch component (simple on/off)
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        onChange(!checked);
      }}
      className={`relative w-12 h-6 rounded-full transition-colors ${
        checked ? 'bg-brand-green' : 'bg-zinc-700'
      }`}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

// Three-state toggle component (On / Off / Inherit)
function ThreeStateToggle({
  value,
  globalValue,
  onChange,
}: {
  value: boolean | null;
  globalValue: boolean;
  onChange: (val: boolean | null) => void;
}) {
  // Cycle: null -> true -> false -> null
  const getNextValue = (): boolean | null => {
    if (value === null) return true;
    if (value === true) return false;
    return null;
  };

  const getLabel = (): string => {
    if (value === null) return 'Inherit';
    if (value === true) return 'On';
    return 'Off';
  };

  const getStyle = (): string => {
    if (value === null) {
      return globalValue
        ? 'bg-zinc-700 text-brand-green border-zinc-600'
        : 'bg-zinc-700 text-zinc-400 border-zinc-600';
    }
    if (value === true) return 'bg-brand-green/20 text-blue-400 border-blue-500/40';
    return 'bg-red-500/20 text-red-400 border-red-500/40';
  };

  return (
    <button
      onClick={() => onChange(getNextValue())}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all min-w-[72px] ${getStyle()}`}
    >
      {getLabel()}
      {value === null && (
        <span className="ml-1 text-[10px] opacity-60">
          ({globalValue ? 'On' : 'Off'})
        </span>
      )}
    </button>
  );
}
