'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2, CheckCircle, AlertTriangle, Eye } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface PortalConfig {
  enabledTiles: string[];
  allowedRepDataFields: string[];
  allowedDocTypes: string[];
  maxPhotosPerJob: number;
  tokenExpiryDays: number;
  layoutOrder: string[];
  analyticsEnabled: boolean;
  watermarkCustomerName: boolean;
  weatherTileLocation: string;
  weatherDisclaimer: string;
}

const TILE_OPTIONS: Array<{ key: string; label: string; desc: string }> = [
  { key: 'rep-intro',         label: 'Rep Introduction', desc: 'Headshot, bio, certifications, quote, call button' },
  { key: 'next-steps',        label: 'What Happens Next', desc: 'Welcome message + expectations' },
  { key: 'photo-gallery',     label: 'Job Photo Gallery', desc: 'Rep-approved photos from this job' },
  { key: 'iko-visualizer',    label: 'IKO Roof Visualizer', desc: 'Link to IKO\'s free visualizer' },
  { key: 'weather-forecast',  label: '5-Day Weather Forecast', desc: 'Huntsville-area; not a project schedule' },
  { key: 'about-rcrs',        label: 'About RCRS', desc: 'Company blurb + certifications + phone' },
  { key: 'contact',           label: 'Contact Card', desc: 'Phone / text / email links to assigned rep' },
];

const FIELD_OPTIONS = [
  'name', 'phone', 'email', 'bio', 'headshotUrl', 'truckPicUrl',
  'certifications', 'yearsExperience', 'favoriteQuote',
];

export default function CustomerPortalConfigPage() {
  const { user, isLoading } = useAuth();
  const [config, setConfig] = useState<PortalConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/customer-portal-config');
    if (res.ok) {
      const data = await res.json();
      setConfig(data.config);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/customer-portal-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Customer portal config saved.' });
      } else {
        const err = await res.json().catch(() => ({}));
        setMessage({ type: 'error', text: err.error || 'Save failed.' });
      }
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const toggleTile = (key: string) => {
    if (!config) return;
    setConfig({
      ...config,
      enabledTiles: config.enabledTiles.includes(key)
        ? config.enabledTiles.filter(k => k !== key)
        : [...config.enabledTiles, key],
    });
  };

  const toggleField = (f: string) => {
    if (!config) return;
    setConfig({
      ...config,
      allowedRepDataFields: config.allowedRepDataFields.includes(f)
        ? config.allowedRepDataFields.filter(x => x !== f)
        : [...config.allowedRepDataFields, f],
    });
  };

  if (isLoading || !config) {
    return <div className="min-h-screen bg-neutral-950 flex items-center justify-center"><Loader2 className="animate-spin text-brand-green" size={32} /></div>;
  }
  if (!user || !['owner', 'admin'].includes(user.role)) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-3 text-red-400" size={40} />
          <p>Owner / admin only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/portal/admin" className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center"><ArrowLeft size={18} className="text-neutral-400" /></Link>
            <div>
              <h1 className="text-xl font-bold text-white">Customer Portal Config</h1>
              <p className="text-sm text-neutral-400">Admin ceiling — defines what reps can show their customers</p>
            </div>
          </div>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-green text-black font-semibold text-sm disabled:opacity-40">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Save
          </button>
        </div>
      </header>

      {message && (
        <div className="max-w-5xl mx-auto px-6 pt-4">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
            {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            {message.text}
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Tiles */}
        <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-2">Tiles Available to Customer Portal</h2>
          <p className="text-sm text-neutral-400 mb-4">Reps can choose which of these to show their customers. Disabled tiles are hidden across the entire system.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {TILE_OPTIONS.map(t => {
              const on = config.enabledTiles.includes(t.key);
              return (
                <button
                  key={t.key}
                  onClick={() => toggleTile(t.key)}
                  className={`text-left p-4 rounded-xl border transition-colors ${on ? 'bg-emerald-500/[0.05] border-emerald-500/30' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">{t.label}</div>
                      <div className="text-xs text-neutral-500 mt-1">{t.desc}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-md ${on ? 'bg-emerald-500/20 text-emerald-300' : 'bg-neutral-700/40 text-neutral-500'}`}>
                      {on ? 'ON' : 'OFF'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Field allowlist */}
        <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-2">Rep Fields Allowed on Customer Portal</h2>
          <p className="text-sm text-neutral-400 mb-4">Fail-safe: NEW rep-profile fields default to OFF. Only fields in this list can be rendered. Defense in depth.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {FIELD_OPTIONS.map(f => {
              const on = config.allowedRepDataFields.includes(f);
              return (
                <button
                  key={f}
                  onClick={() => toggleField(f)}
                  className={`text-left px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${on ? 'bg-emerald-500/[0.05] border-emerald-500/30 text-emerald-300' : 'bg-white/[0.02] border-white/5 text-neutral-500 hover:border-white/10'}`}
                >
                  <code>{f}</code> · {on ? 'visible' : 'hidden'}
                </button>
              );
            })}
          </div>
        </section>

        {/* Numeric settings */}
        <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Max photos per job</label>
            <input type="number" value={config.maxPhotosPerJob} onChange={(e) => setConfig({ ...config, maxPhotosPerJob: parseInt(e.target.value) || 12 })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Token expiry (days)</label>
            <input type="number" value={config.tokenExpiryDays} onChange={(e) => setConfig({ ...config, tokenExpiryDays: parseInt(e.target.value) || 90 })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm" />
          </div>
          <div className="sm:col-span-2 flex items-center gap-4 mt-2">
            <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
              <input type="checkbox" checked={config.analyticsEnabled} onChange={(e) => setConfig({ ...config, analyticsEnabled: e.target.checked })} />
              Analytics enabled
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
              <input type="checkbox" checked={config.watermarkCustomerName} onChange={(e) => setConfig({ ...config, watermarkCustomerName: e.target.checked })} />
              Watermark photos with customer first name
            </label>
          </div>
        </section>

        {/* Weather */}
        <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-2">Weather Tile</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Location</label>
              <input type="text" value={config.weatherTileLocation} onChange={(e) => setConfig({ ...config, weatherTileLocation: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Disclaimer text</label>
              <textarea value={config.weatherDisclaimer} onChange={(e) => setConfig({ ...config, weatherDisclaimer: e.target.value })} rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm" />
              <p className="text-xs text-neutral-500 mt-1">This text appears with the forecast. Required per stated rule — customers should not interpret the forecast as a project install schedule.</p>
            </div>
          </div>
        </section>

        {/* View as customer link */}
        <section className="bg-white/[0.02] border border-emerald-500/20 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center"><Eye size={20} className="text-emerald-400" /></div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white mb-1">View as customer</h2>
              <p className="text-sm text-neutral-400 mb-3">Open any lead's portal exactly as the customer sees it — verify no internal data leaks before any real customer hits it.</p>
              <Link href="/portal/admin/customer-portal-preview" className="inline-block px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-sm font-medium">
                Open preview tool →
              </Link>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
