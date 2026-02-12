'use client';

// Sales Rep Lead Preferences
// Reps can set county preferences and lead schedule

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MapPin, ArrowLeft, Loader2, CheckCircle, AlertCircle, Save, Map } from 'lucide-react';
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
  const { user } = useAuth();
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

  useEffect(() => {
    if (user) {
      loadPreferences();
    }
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;

    try {
      // Get rep slug from auth context - userId is the team member ID set during login
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
          // Default: all counties enabled
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/portal/sales" className="inline-flex items-center gap-2 text-neutral-500 hover:text-white mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Sales Portal
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <MapPin className="w-8 h-8 text-green-500" />
            Lead Preferences
          </h1>
          <p className="text-neutral-500 mt-1">Configure which areas you want to receive leads for</p>
        </div>

        {/* Current Status */}
        <div className={`mb-6 p-4 rounded-xl border ${
          isReceivingLeads
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isReceivingLeads ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className={isReceivingLeads ? 'text-green-400' : 'text-red-400'}>
              {isReceivingLeads ? 'You are currently receiving leads' : 'You are NOT receiving leads'}
            </span>
          </div>
          {adminOverride && !isReceivingLeads && (
            <p className="text-sm text-yellow-400 mt-2">
              Your leads have been paused by an admin. Contact Chris or Michael with questions.
            </p>
          )}
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 text-sm ${
            message.type === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </div>
        )}

        {/* County Toggles */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Map className="w-5 h-5 text-green-500" />
              Service Counties
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => toggleAll(true)}
                className="px-3 py-1 text-xs bg-green-600/20 text-green-400 rounded hover:bg-green-600/30 transition-colors"
              >
                Enable All
              </button>
              <button
                onClick={() => toggleAll(false)}
                className="px-3 py-1 text-xs bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 transition-colors"
              >
                Disable All
              </button>
            </div>
          </div>

          <p className="text-sm text-neutral-500 mb-4">
            {enabledCount} of {COUNTIES.length} counties enabled
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {COUNTIES.map(county => (
              <button
                key={county}
                onClick={() => toggleCounty(county)}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-all border ${
                  preferences.countiesEnabled[county]
                    ? 'bg-green-600/20 border-green-500/50 text-green-400'
                    : 'bg-gray-700/50 border-gray-600 text-neutral-500'
                }`}
              >
                {county}
                {preferences.countiesEnabled[county] && (
                  <CheckCircle className="w-3 h-3 inline ml-1" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Max Leads Per Day */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Daily Lead Cap</h2>
          <p className="text-sm text-neutral-500 mb-3">Set to 0 for no limit</p>
          <input
            type="number"
            value={preferences.maxLeadsPerDay}
            onChange={(e) => setPreferences(prev => ({ ...prev, maxLeadsPerDay: parseInt(e.target.value) || 0 }))}
            min="0"
            max="50"
            className="w-32 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:outline-none"
          />
        </div>

        {/* Save Button */}
        <button
          onClick={savePreferences}
          disabled={saving}
          className="w-full px-6 py-4 bg-brand-green hover:bg-lime-400 disabled:bg-neutral-700 text-black font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {saving ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
          ) : (
            <><Save className="w-5 h-5" /> Save Preferences</>
          )}
        </button>
      </div>
    </div>
  );
}
