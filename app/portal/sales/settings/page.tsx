'use client';

// Sales Rep Lead Preferences
// Reps can set county preferences and lead schedule

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MapPin, ArrowLeft, Loader2, CheckCircle, AlertCircle, Save, Map,
  Home, Users, Plus, BarChart3, Building, Phone, RefreshCw, Settings,
  Bell, Zap
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const COUNTIES = [
  'Madison', 'Limestone', 'Morgan', 'Marshall', 'Jackson',
  'DeKalb', 'Lawrence', 'Cullman', 'Blount', 'Etowah',
  'Cherokee', 'Colbert', 'Franklin', 'Marion', 'Winston',
];

interface RepPreferences {
  repSlug: string;
  countiesEnabled: Record<string, boolean>;
  maxLeadsPerDay: number;
  preferredAreas: string[];
  excludedAreas: string[];
}

export default function SalesSettingsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [preferences, setPreferences] = useState<RepPreferences>({
    repSlug: '',
    countiesEnabled: {},
    maxLeadsPerDay: 0,
    preferredAreas: [],
    excludedAreas: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isReceivingLeads, setIsReceivingLeads] = useState(true);
  const [adminOverride, setAdminOverride] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/portal');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      loadPreferences();
    }
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;

    try {
      // userId is set from team-roles during login (e.g. "larry-garcia")
      const repSlug = user.userId || user.name.toLowerCase().replace(/\s+/g, '-');

      const [prefRes, availRes] = await Promise.all([
        fetch(`/api/portal/rep-preferences?repSlug=${repSlug}`),
        fetch(`/api/portal/rep-availability?repSlug=${repSlug}`),
      ]);

      if (prefRes.ok) {
        const data = await prefRes.json();
        if (data.data) {
          setPreferences({
            repSlug,
            countiesEnabled: data.data.countiesEnabled || {},
            maxLeadsPerDay: data.data.maxLeadsPerDay || 0,
            preferredAreas: data.data.preferredAreas || [],
            excludedAreas: data.data.excludedAreas || [],
          });
        } else {
          const defaultCounties: Record<string, boolean> = {};
          COUNTIES.forEach(c => defaultCounties[c] = true);
          setPreferences({ repSlug, countiesEnabled: defaultCounties, maxLeadsPerDay: 0, preferredAreas: [], excludedAreas: [] });
        }
      }

      if (availRes.ok) {
        const data = await availRes.json();
        if (data.data) {
          setIsReceivingLeads(data.data.isReceivingLeads !== false);
          setAdminOverride(data.data.adminOverride === true);
        }
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCounty = (county: string) => {
    setPreferences(prev => ({
      ...prev,
      countiesEnabled: {
        ...prev.countiesEnabled,
        [county]: !prev.countiesEnabled[county],
      },
    }));
  };

  const toggleAll = (enabled: boolean) => {
    const updated: Record<string, boolean> = {};
    COUNTIES.forEach(c => updated[c] = enabled);
    setPreferences(prev => ({ ...prev, countiesEnabled: updated }));
  };

  const savePreferences = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/portal/rep-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Preferences saved successfully!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to save preferences' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = Object.values(preferences.countiesEnabled).filter(Boolean).length;

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-[#39FF14]" size={48} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-[#39FF14] mx-auto mb-4" size={48} />
          <p className="text-neutral-400">Loading preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10 pb-24">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link
                  href="/portal/sales"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={20} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">Lead Preferences</h1>
                  <p className="text-xs text-neutral-400">Configure your lead areas & settings</p>
                </div>
              </div>

              <button
                onClick={loadPreferences}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <RefreshCw size={18} className="text-neutral-400" />
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          {/* Current Status Banner */}
          <div className={`mb-6 bg-white/[0.02] border rounded-2xl p-4 ${
            isReceivingLeads ? 'border-[#39FF14]/30' : 'border-red-500/30'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isReceivingLeads ? 'bg-[#39FF14]/20' : 'bg-red-500/20'
              }`}>
                {isReceivingLeads ? (
                  <Zap size={20} className="text-[#39FF14]" />
                ) : (
                  <AlertCircle size={20} className="text-red-400" />
                )}
              </div>
              <div>
                <p className={`text-sm font-medium ${isReceivingLeads ? 'text-[#39FF14]' : 'text-red-400'}`}>
                  {isReceivingLeads ? 'Actively Receiving Leads' : 'Leads Paused'}
                </p>
                <p className="text-xs text-neutral-500">
                  {isReceivingLeads
                    ? `${enabledCount} of ${COUNTIES.length} counties enabled`
                    : adminOverride
                      ? 'Paused by admin — contact Chris or Michael'
                      : 'You are not receiving new leads'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Success/Error Message */}
          {message && (
            <div className={`mb-6 bg-white/[0.02] border rounded-2xl p-4 flex items-center gap-3 ${
              message.type === 'success' ? 'border-[#39FF14]/30' : 'border-red-500/30'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle size={18} className="text-[#39FF14] shrink-0" />
              ) : (
                <AlertCircle size={18} className="text-red-400 shrink-0" />
              )}
              <span className={`text-sm ${message.type === 'success' ? 'text-[#39FF14]' : 'text-red-400'}`}>
                {message.text}
              </span>
            </div>
          )}

          {/* County Toggles */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 sm:p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-white flex items-center gap-2">
                <Map size={16} className="text-[#39FF14]" />
                Service Counties
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleAll(true)}
                  className="px-3 py-1.5 text-xs bg-[#39FF14]/20 text-[#39FF14] rounded-lg hover:bg-[#39FF14]/30 transition-colors font-medium"
                >
                  All On
                </button>
                <button
                  onClick={() => toggleAll(false)}
                  className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors font-medium"
                >
                  All Off
                </button>
              </div>
            </div>

            <p className="text-xs text-neutral-500 mb-4">
              {enabledCount} of {COUNTIES.length} counties enabled
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {COUNTIES.map(county => (
                <button
                  key={county}
                  onClick={() => toggleCounty(county)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                    preferences.countiesEnabled[county]
                      ? 'bg-[#39FF14]/10 border-[#39FF14]/40 text-[#39FF14]'
                      : 'bg-white/[0.02] border-white/5 text-neutral-500 hover:border-white/10'
                  }`}
                >
                  {county}
                  {preferences.countiesEnabled[county] && (
                    <CheckCircle className="w-3 h-3 inline ml-1.5" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Max Leads Per Day */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 sm:p-6 mb-6">
            <h2 className="text-sm font-medium text-white mb-1 flex items-center gap-2">
              <Bell size={16} className="text-[#39FF14]" />
              Daily Lead Cap
            </h2>
            <p className="text-xs text-neutral-500 mb-4">Set to 0 for no limit</p>
            <input
              type="number"
              value={preferences.maxLeadsPerDay}
              onChange={(e) => setPreferences(prev => ({ ...prev, maxLeadsPerDay: parseInt(e.target.value) || 0 }))}
              min="0"
              max="50"
              className="w-32 px-4 py-3 bg-white/[0.02] border border-white/5 rounded-xl text-white focus:ring-1 focus:ring-[#39FF14]/30 focus:border-[#39FF14]/50 focus:outline-none"
            />
          </div>

          {/* Save Button */}
          <button
            onClick={savePreferences}
            disabled={saving}
            className="w-full px-6 py-4 bg-[#39FF14] hover:bg-[#39FF14]/90 disabled:bg-neutral-700 text-black font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#39FF14]/20"
          >
            {saving ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
            ) : (
              <><Save className="w-5 h-5" /> Save Preferences</>
            )}
          </button>
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t border-white/5 px-4 py-2 z-30 sm:hidden">
          <div className="flex items-center justify-around">
            <Link href="/portal/sales" className="flex flex-col items-center p-2 text-neutral-400 hover:text-white">
              <Home size={20} />
              <span className="text-xs mt-1">Home</span>
            </Link>
            <Link href="/portal/sales/leads" className="flex flex-col items-center p-2 text-neutral-400 hover:text-white">
              <Users size={20} />
              <span className="text-xs mt-1">Leads</span>
            </Link>
            <button className="flex flex-col items-center p-3 -mt-4 bg-[#39FF14] rounded-full text-black">
              <Plus size={24} />
            </button>
            <Link href="/portal/sales/performance" className="flex flex-col items-center p-2 text-neutral-400 hover:text-white">
              <BarChart3 size={20} />
              <span className="text-xs mt-1">Stats</span>
            </Link>
            <Link href="/portal/sales/settings" className="flex flex-col items-center p-2 text-[#39FF14]">
              <Settings size={20} />
              <span className="text-xs mt-1">Settings</span>
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}
