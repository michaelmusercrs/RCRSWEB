'use client';

/**
 * RCRS Command Center - Site Settings (Feature Toggles)
 *
 * Admin page for toggling public-facing site features.
 * Reads/writes via the existing /api/admin/settings endpoint.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Settings,
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Image,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface FeatureToggle {
  key: string;
  label: string;
  description: string;
  icon: typeof Image;
  value: boolean;
}

// =============================================================================
// Main Component
// =============================================================================

export default function SiteSettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Feature toggles state
  const [showBeforeAfterGallery, setShowBeforeAfterGallery] = useState(false);

  const isOwner = user?.role === 'owner' || user?.role === 'admin';

  // Load current settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/admin/settings', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            setShowBeforeAfterGallery(data.data.showBeforeAfterGallery ?? false);
            setLastUpdated(data.data.lastUpdated ?? null);
          }
        }
      } catch (err) {
        console.error('Failed to load site settings:', err);
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  // Save settings
  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError('');

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          showBeforeAfterGallery,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSaved(true);
          setLastUpdated(new Date().toISOString());
          setTimeout(() => setSaved(false), 3000);
        } else {
          setError(data.error || 'Failed to save');
        }
      } else {
        setError('Failed to save settings');
      }
    } catch (err) {
      console.error('Failed to save site settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Feature toggles configuration
  const features: FeatureToggle[] = [
    {
      key: 'showBeforeAfterGallery',
      label: 'Before & After Gallery',
      description: 'Show the before/after photo gallery on the public website. When disabled, the gallery section is hidden from visitors.',
      icon: Image,
      value: showBeforeAfterGallery,
    },
  ];

  const toggleHandlers: Record<string, (val: boolean) => void> = {
    showBeforeAfterGallery: setShowBeforeAfterGallery,
  };

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
          <p className="text-zinc-400">Only owners and admins can manage site settings.</p>
          <Link
            href="/command-center"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-lime-400 hover:text-lime-300"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/command-center"
            className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            Dashboard
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-500/10">
                <Settings size={20} className="text-lime-400" />
              </div>
              Site Settings
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Control which features are visible on the public website.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || loading}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all',
            saved
              ? 'bg-lime-500/20 text-lime-400 border border-lime-500/30'
              : 'bg-lime-500 text-black hover:bg-lime-400 disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Saving...
            </>
          ) : saved ? (
            <>
              <CheckCircle size={16} />
              Saved
            </>
          ) : (
            <>
              <Save size={16} />
              Save Changes
            </>
          )}
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Feature Toggles Card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="border-b border-zinc-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Feature Toggles</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Enable or disable public-facing sections of the website.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.key}
                  className="flex items-center justify-between gap-4 px-6 py-5 transition-colors hover:bg-zinc-800/30"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                        feature.value
                          ? 'bg-lime-500/10 text-lime-400'
                          : 'bg-zinc-700/50 text-zinc-500'
                      )}
                    >
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-white">{feature.label}</h3>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                            feature.value
                              ? 'bg-lime-500/15 text-lime-400'
                              : 'bg-zinc-700 text-zinc-400'
                          )}
                        >
                          {feature.value ? (
                            <>
                              <Eye size={12} /> Visible
                            </>
                          ) : (
                            <>
                              <EyeOff size={12} /> Hidden
                            </>
                          )}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-zinc-400 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={() => toggleHandlers[feature.key](!feature.value)}
                    className="shrink-0 focus:outline-none focus:ring-2 focus:ring-lime-500/50 rounded-full"
                    aria-label={`Toggle ${feature.label}`}
                  >
                    {feature.value ? (
                      <ToggleRight size={40} className="text-lime-400" />
                    ) : (
                      <ToggleLeft size={40} className="text-zinc-600" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h3 className="text-sm font-medium text-zinc-300 mb-2">How it works</h3>
        <ul className="space-y-2 text-sm text-zinc-500">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" />
            Changes take effect within 60 seconds on the live site (cached for performance).
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" />
            The public API at <code className="text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded text-xs">/api/site-config</code> serves these toggles (no auth required, read-only).
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" />
            Settings are stored in Vercel Blob storage and persist across deployments.
          </li>
        </ul>
      </div>

      {/* Last Updated Footer */}
      {lastUpdated && (
        <p className="text-center text-xs text-zinc-600">
          Last updated: {new Date(lastUpdated).toLocaleString()}
        </p>
      )}
    </div>
  );
}
