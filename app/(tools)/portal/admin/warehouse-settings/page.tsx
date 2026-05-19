'use client';

/**
 * Warehouse Settings Page
 *
 * Admin-only page for tuning the warehouse geofence used by the
 * Phase 5 auto-LOAD_VERIFIED trigger (`/api/warehouse/gps-ping`).
 *
 * Lets admin:
 *   - Pin the warehouse lat/lng (drop-in numeric, or "use my current location")
 *   - Set geofence radius in METERS (default 100m)
 *   - Toggle auto-LOAD_VERIFIED on/off
 *
 * Backed by /api/portal/admin/warehouse-settings (GET/PUT).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Crosshair,
  Power,
  PowerOff,
} from 'lucide-react';

interface WarehouseSettings {
  settingsId: string;
  warehouseLat: number;
  warehouseLng: number;
  geofenceRadiusMeters: number;
  autoLoadVerifiedEnabled: boolean;
  updatedAt: string;
  updatedBy: string;
}

export default function WarehouseSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settings, setSettings] = useState<WarehouseSettings | null>(null);
  const [form, setForm] = useState({
    warehouseLat: '',
    warehouseLng: '',
    geofenceRadiusMeters: '',
    autoLoadVerifiedEnabled: true,
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/portal/admin/warehouse-settings', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
      setSettings(data.settings);
      setForm({
        warehouseLat: String(data.settings.warehouseLat ?? ''),
        warehouseLng: String(data.settings.warehouseLng ?? ''),
        geofenceRadiusMeters: String(data.settings.geofenceRadiusMeters ?? '100'),
        autoLoadVerifiedEnabled: Boolean(data.settings.autoLoadVerifiedEnabled),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const lat = Number(form.warehouseLat);
      const lng = Number(form.warehouseLng);
      const radius = Number(form.geofenceRadiusMeters);
      if (!Number.isFinite(lat) || Math.abs(lat) > 90) throw new Error('Latitude must be -90 to 90');
      if (!Number.isFinite(lng) || Math.abs(lng) > 180) throw new Error('Longitude must be -180 to 180');
      if (!Number.isFinite(radius) || radius < 10) throw new Error('Radius must be at least 10 meters');

      const res = await fetch('/api/portal/admin/warehouse-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseLat: lat,
          warehouseLng: lng,
          geofenceRadiusMeters: radius,
          autoLoadVerifiedEnabled: form.autoLoadVerifiedEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);

      setSettings(data.settings);
      setSuccess('Settings saved');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const useCurrentLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError('Geolocation not available in this browser');
      return;
    }
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          warehouseLat: String(pos.coords.latitude),
          warehouseLng: String(pos.coords.longitude),
        }));
        setSuccess('Filled with your current GPS — click Save to apply');
        setTimeout(() => setSuccess(''), 4000);
      },
      (err) => setError(`GPS error: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          href="/portal/admin"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-green transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Link>

        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <MapPin className="w-7 h-7 text-brand-green" />
          Warehouse Settings
        </h1>
        <p className="text-gray-400 mb-8">
          Pin the warehouse location and tune the geofence used by the auto-LOAD_VERIFIED
          driver workflow. When a driver crosses outside the radius with materials pulled,
          the order auto-advances to Stage 6.
        </p>

        {loading && (
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading settings...
          </div>
        )}

        {error && (
          <div className="bg-red-950 border border-red-700 rounded-lg p-4 mb-4 text-red-300 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-green-950 border border-green-700 rounded-lg p-4 mb-4 text-green-300 flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {!loading && settings && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Warehouse Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={form.warehouseLat}
                  onChange={(e) => setForm({ ...form, warehouseLat: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
                  placeholder="34.5536"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Warehouse Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={form.warehouseLng}
                  onChange={(e) => setForm({ ...form, warehouseLng: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
                  placeholder="-86.9806"
                />
              </div>
            </div>

            <button
              onClick={useCurrentLocation}
              className="inline-flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm"
            >
              <Crosshair className="w-4 h-4" />
              Use my current GPS
            </button>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Geofence Radius (meters)
              </label>
              <input
                type="number"
                min={10}
                max={50000}
                step={10}
                value={form.geofenceRadiusMeters}
                onChange={(e) => setForm({ ...form, geofenceRadiusMeters: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
                placeholder="100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Default 100m (~330 ft). Drivers cross this circle to auto-fire LOAD_VERIFIED.
              </p>
            </div>

            <div className="border-t border-zinc-800 pt-4">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.autoLoadVerifiedEnabled}
                  onChange={(e) =>
                    setForm({ ...form, autoLoadVerifiedEnabled: e.target.checked })
                  }
                  className="w-5 h-5 accent-brand-green"
                />
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {form.autoLoadVerifiedEnabled ? (
                      <Power className="w-4 h-4 text-brand-green" />
                    ) : (
                      <PowerOff className="w-4 h-4 text-gray-500" />
                    )}
                    Auto-LOAD_VERIFIED on geofence exit
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    When ON: a driver pinging GPS from outside the geofence with an
                    order in MATERIALS_PULLED state auto-advances to LOAD_VERIFIED.
                    When OFF: driver must tap "Confirm" manually.
                  </p>
                </div>
              </label>
            </div>

            <div className="border-t border-zinc-800 pt-4 flex justify-between items-center">
              <div className="text-xs text-gray-500">
                {settings.updatedAt
                  ? `Last updated ${new Date(settings.updatedAt).toLocaleString()} by ${settings.updatedBy || 'unknown'}`
                  : 'No prior changes recorded'}
              </div>
              <button
                onClick={onSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-brand-green text-black font-semibold rounded hover:bg-brand-green/80 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Settings
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
