'use client';

/**
 * Hail Auto-Canvass — Command Center page.
 *
 * Workflow:
 *   1. Pick a recent storm event from the API, OR enter a manual zone
 *      (lat/lng/radius/date) for a brand-new event the API hasn't seen
 *      yet.
 *   2. Click Generate. The server returns every on-file address inside
 *      the zone with a damage-probability score.
 *   3. Sort/filter the list, then assign to reps. Each rep gets a
 *      geographic-K-means cluster so their canvass route is contiguous.
 *
 * Map: SVG-rendered scatter plot of the impact zone. No external map
 * tile provider is loaded — we don't have leaflet/react-leaflet in
 * package.json and per the build prompt we don't add deps unless
 * necessary. The SVG is sufficient to show "rep A's pins are east,
 * rep B's pins are west" which is the actual decision the admin is
 * making. There's also a one-click "Open in OpenStreetMap" link that
 * deeplinks to the storm center so the rep can see real streets.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CloudHail,
  MapPin,
  RefreshCw,
  Loader2,
  Users,
  Target,
  Printer,
  Download,
  AlertTriangle,
  Crosshair,
  ExternalLink,
  Wand2,
} from 'lucide-react';
import { getLeadEligibleReps } from '@/lib/team-roles';

// ---------------------------------------------------------------------------
// Types — kept in sync with lib/hail-canvass-service.ts
// ---------------------------------------------------------------------------

interface StormEvent {
  stormEventId: string;
  date: string;
  lat: number;
  lng: number;
  radiusMiles: number;
  hailSizeMin: number;
  label?: string;
}

interface CanvassAddress {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  leadStatus: 'new' | 'contacted' | 'customer' | 'door_knock' | 'referral' | 'unknown';
  currentRep?: string;
  source: string;
  distanceFromStormMiles: number;
  distanceFromHqMiles: number;
  damageProbability: number;
  lastInteraction?: string;
}

interface GenerateResponse {
  stormEvent: StormEvent;
  hailContext: {
    largestHailInches: number;
    totalEvents: number;
    mostRecentDate?: string;
  };
  addresses: CanvassAddress[];
  count: number;
  generatedAt: string;
  generatedBy: string;
}

type SortKey = 'damage' | 'distance' | 'hq' | 'status';

// ---------------------------------------------------------------------------
// Status colour map — mirrors lead-management page conventions.
// ---------------------------------------------------------------------------

const STATUS_COLOURS: Record<CanvassAddress['leadStatus'], string> = {
  new: 'bg-blue-500/20 text-blue-300 ring-blue-500/30',
  contacted: 'bg-purple-500/20 text-purple-300 ring-purple-500/30',
  customer: 'bg-green-500/20 text-green-300 ring-green-500/30',
  door_knock: 'bg-yellow-500/20 text-yellow-300 ring-yellow-500/30',
  referral: 'bg-cyan-500/20 text-cyan-300 ring-cyan-500/30',
  unknown: 'bg-white/10 text-neutral-300 ring-white/10',
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function HailCanvassPage() {
  // Storm event picker state
  const [stormEvents, setStormEvents] = useState<StormEvent[]>([]);
  const [pickerLoading, setPickerLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  // Manual zone state
  const [manualLat, setManualLat] = useState<string>('34.6059');
  const [manualLng, setManualLng] = useState<string>('-86.9833');
  const [manualRadius, setManualRadius] = useState<string>('5');
  const [manualHailMin, setManualHailMin] = useState<string>('1');
  const [manualDate, setManualDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );

  // Result state
  const [data, setData] = useState<GenerateResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // UI state
  const [sortBy, setSortBy] = useState<SortKey>('damage');
  const [statusFilter, setStatusFilter] = useState<'all' | CanvassAddress['leadStatus']>('all');
  const [selectedReps, setSelectedReps] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  const eligibleReps = useMemo(() => getLeadEligibleReps(), []);

  // -------------------------------------------------------------------------
  // Load storm-event picker on mount.
  // -------------------------------------------------------------------------

  const loadEvents = useCallback(async () => {
    setPickerLoading(true);
    try {
      const res = await fetch('/api/admin/canvass/generate?maxAgeDays=60', {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        setStormEvents(json.data.events as StormEvent[]);
      }
    } catch (err) {
      console.error('Failed to load storm events:', err);
    } finally {
      setPickerLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // -------------------------------------------------------------------------
  // Generate handler.
  // -------------------------------------------------------------------------

  const handleGenerate = useCallback(async () => {
    setGenError(null);
    setData(null);
    setAssignResult(null);
    setAssignError(null);
    setGenerating(true);

    const body: Record<string, unknown> = {};
    if (selectedEventId) {
      body.stormEventId = selectedEventId;
    } else {
      const lat = parseFloat(manualLat);
      const lng = parseFloat(manualLng);
      const radius = parseFloat(manualRadius);
      const hailMin = parseFloat(manualHailMin);
      if (!isFinite(lat) || !isFinite(lng) || !isFinite(radius)) {
        setGenError('Manual zone needs valid lat, lng, radius.');
        setGenerating(false);
        return;
      }
      body.lat = lat;
      body.lng = lng;
      body.radiusMiles = radius;
      body.hailSizeMin = isFinite(hailMin) ? hailMin : 0;
      body.date = manualDate;
    }

    try {
      const res = await fetch('/api/admin/canvass/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setGenError(json.error || `Generate failed (${res.status})`);
      } else {
        setData(json.data as GenerateResponse);
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generate failed');
    } finally {
      setGenerating(false);
    }
  }, [selectedEventId, manualLat, manualLng, manualRadius, manualHailMin, manualDate]);

  // -------------------------------------------------------------------------
  // Filter + sort the address list for display.
  // -------------------------------------------------------------------------

  const visibleAddresses = useMemo(() => {
    if (!data) return [];
    let list = data.addresses;
    if (statusFilter !== 'all') {
      list = list.filter(a => a.leadStatus === statusFilter);
    }
    const sorted = [...list];
    switch (sortBy) {
      case 'damage':
        sorted.sort((a, b) => b.damageProbability - a.damageProbability);
        break;
      case 'distance':
        sorted.sort((a, b) => a.distanceFromStormMiles - b.distanceFromStormMiles);
        break;
      case 'hq':
        sorted.sort((a, b) => a.distanceFromHqMiles - b.distanceFromHqMiles);
        break;
      case 'status':
        sorted.sort((a, b) => a.leadStatus.localeCompare(b.leadStatus));
        break;
    }
    return sorted;
  }, [data, statusFilter, sortBy]);

  // -------------------------------------------------------------------------
  // Assign handler.
  // -------------------------------------------------------------------------

  const handleAssign = useCallback(async () => {
    if (!data) return;
    if (selectedReps.length === 0) {
      setAssignError('Pick at least one rep.');
      return;
    }
    setAssignError(null);
    setAssignResult(null);
    setAssigning(true);
    try {
      const res = await fetch('/api/admin/canvass/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          stormEventId: data.stormEvent.stormEventId,
          addresses: visibleAddresses,
          repSlugs: selectedReps,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setAssignError(json.error || `Assign failed (${res.status})`);
      } else {
        const created = json.data.assignments.filter(
          (a: { created: boolean }) => a.created,
        ).length;
        const updated = json.data.assignments.filter(
          (a: { updated: boolean }) => a.updated,
        ).length;
        setAssignResult(
          `Recorded ${created} new + ${updated} updated route(s) on the Canvass Routes sheet.`,
        );
      }
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Assign failed');
    } finally {
      setAssigning(false);
    }
  }, [data, selectedReps, visibleAddresses]);

  // -------------------------------------------------------------------------
  // CSV export — simple, no PDF dep added.
  // -------------------------------------------------------------------------

  const handleCsvExport = useCallback(() => {
    if (!data) return;
    const rows = [
      [
        'Damage %',
        'Name',
        'Address',
        'Status',
        'Current Rep',
        'Distance from storm (mi)',
        'Distance from HQ (mi)',
        'Last interaction',
      ],
      ...visibleAddresses.map(a => [
        String(a.damageProbability),
        a.name,
        a.address,
        a.leadStatus,
        a.currentRep || '',
        String(a.distanceFromStormMiles),
        String(a.distanceFromHqMiles),
        a.lastInteraction || '',
      ]),
    ];
    const csv = rows
      .map(r => r.map(cell => `"${(cell ?? '').toString().replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canvass-${data.stormEvent.stormEventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, visibleAddresses]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="text-white">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-lg bg-brand-green/20 p-2 ring-1 ring-brand-green/40">
          <CloudHail className="h-6 w-6 text-brand-green" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Hail Auto-Canvass</h1>
          <p className="text-sm text-neutral-400">
            Generate a door-knock list of on-file addresses inside a storm impact zone.
          </p>
        </div>
      </div>

      {/* Top panel — storm-event picker */}
      <section className="mb-6 rounded-xl border border-white/10 bg-neutral-950 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Target className="h-5 w-5 text-brand-green" /> Storm Event
          </h2>
          <button
            onClick={loadEvents}
            className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-1 text-xs text-neutral-300 hover:bg-white/5"
            disabled={pickerLoading}
          >
            <RefreshCw className={`h-3 w-3 ${pickerLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Stored events */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-4">
            <label className="mb-2 block text-xs uppercase tracking-wide text-neutral-400">
              Recent storm reports (last 60 days)
            </label>
            {pickerLoading ? (
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : stormEvents.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No stored events with hail &ge; 0.75&quot;. Use the manual zone instead.
              </p>
            ) : (
              <select
                value={selectedEventId}
                onChange={e => setSelectedEventId(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-black px-3 py-2 text-sm"
              >
                <option value="">— Pick an event —</option>
                {stormEvents.map(ev => (
                  <option key={ev.stormEventId} value={ev.stormEventId}>
                    {ev.date} · {ev.label || `${ev.hailSizeMin}" hail`} ({ev.lat.toFixed(3)},{' '}
                    {ev.lng.toFixed(3)})
                  </option>
                ))}
              </select>
            )}
            <p className="mt-2 text-xs text-neutral-500">
              Sourced from Storm_Reports (existing public-site reports). Pick one OR fill in the
              manual zone.
            </p>
          </div>

          {/* Manual zone */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-4">
            <label className="mb-2 block text-xs uppercase tracking-wide text-neutral-400">
              Manual zone (overrides the picker)
            </label>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <input
                type="number"
                step="0.0001"
                placeholder="Lat"
                value={manualLat}
                onChange={e => setManualLat(e.target.value)}
                className="rounded-md border border-white/10 bg-black px-3 py-2"
              />
              <input
                type="number"
                step="0.0001"
                placeholder="Lng"
                value={manualLng}
                onChange={e => setManualLng(e.target.value)}
                className="rounded-md border border-white/10 bg-black px-3 py-2"
              />
              <input
                type="number"
                step="0.5"
                placeholder="Radius (mi)"
                value={manualRadius}
                onChange={e => setManualRadius(e.target.value)}
                className="rounded-md border border-white/10 bg-black px-3 py-2"
              />
              <input
                type="number"
                step="0.25"
                placeholder='Min hail size (")'
                value={manualHailMin}
                onChange={e => setManualHailMin(e.target.value)}
                className="rounded-md border border-white/10 bg-black px-3 py-2"
              />
              <input
                type="date"
                value={manualDate}
                onChange={e => setManualDate(e.target.value)}
                className="col-span-2 rounded-md border border-white/10 bg-black px-3 py-2"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 rounded-md bg-brand-green px-4 py-2 text-sm font-semibold text-black hover:bg-lime-400 disabled:opacity-60"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Generate canvass list
          </button>
          {genError && (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4" />
              {genError}
            </div>
          )}
        </div>
      </section>

      {/* Results */}
      {data && (
        <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left+center: map */}
          <div className="lg:col-span-2 rounded-xl border border-white/10 bg-neutral-950 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <MapPin className="h-5 w-5 text-brand-green" /> Impact zone
              </h2>
              <a
                href={`https://www.openstreetmap.org/?mlat=${data.stormEvent.lat}&mlon=${data.stormEvent.lng}#map=12/${data.stormEvent.lat}/${data.stormEvent.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-brand-green hover:underline"
              >
                Open in OpenStreetMap <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <ZoneSvg
              stormLat={data.stormEvent.lat}
              stormLng={data.stormEvent.lng}
              radiusMiles={data.stormEvent.radiusMiles}
              addresses={visibleAddresses}
            />
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-neutral-400 md:grid-cols-4">
              <Stat label="Addresses on file" value={data.count} />
              <Stat
                label="Largest hail"
                value={
                  data.hailContext.largestHailInches > 0
                    ? `${data.hailContext.largestHailInches.toFixed(2)}"`
                    : '—'
                }
              />
              <Stat label="NOAA events in zone" value={data.hailContext.totalEvents} />
              <Stat
                label="Generated"
                value={new Date(data.generatedAt).toLocaleTimeString()}
              />
            </div>
          </div>

          {/* Right sidebar: filter + list */}
          <div className="rounded-xl border border-white/10 bg-neutral-950 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Crosshair className="h-5 w-5 text-brand-green" /> Address list
            </h2>
            <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortKey)}
                className="rounded-md border border-white/10 bg-black px-2 py-1"
              >
                <option value="damage">Sort: damage %</option>
                <option value="distance">Sort: distance from storm</option>
                <option value="hq">Sort: distance from HQ</option>
                <option value="status">Sort: lead status</option>
              </select>
              <select
                value={statusFilter}
                onChange={e =>
                  setStatusFilter(e.target.value as 'all' | CanvassAddress['leadStatus'])
                }
                className="rounded-md border border-white/10 bg-black px-2 py-1"
              >
                <option value="all">All statuses</option>
                <option value="new">new</option>
                <option value="contacted">contacted</option>
                <option value="customer">customer</option>
                <option value="door_knock">door_knock</option>
                <option value="referral">referral</option>
                <option value="unknown">unknown</option>
              </select>
            </div>
            <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
              {visibleAddresses.map(a => (
                <div
                  key={a.id}
                  className="rounded-md border border-white/5 bg-black/40 p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{a.name}</div>
                      <div className="truncate text-xs text-neutral-400">{a.address}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-bold text-brand-green">
                        {a.damageProbability}
                      </div>
                      <div className="text-[10px] uppercase text-neutral-500">damage</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    <span
                      className={`rounded-full px-2 py-0.5 ring-1 ${STATUS_COLOURS[a.leadStatus]}`}
                    >
                      {a.leadStatus.replace('_', ' ')}
                    </span>
                    <span className="text-neutral-500">
                      {a.distanceFromStormMiles}mi storm / {a.distanceFromHqMiles}mi HQ
                    </span>
                  </div>
                  {a.currentRep && (
                    <div className="mt-1 text-[11px] text-neutral-500">
                      Rep on file: {a.currentRep}
                    </div>
                  )}
                </div>
              ))}
              {visibleAddresses.length === 0 && (
                <p className="text-sm text-neutral-500">
                  No on-file addresses match. Widen the radius or use the manual zone.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Bottom panel — export + assign */}
      {data && data.count > 0 && (
        <section className="rounded-xl border border-white/10 bg-neutral-950 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Users className="h-5 w-5 text-brand-green" /> Export & assign
          </h2>

          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={handleCsvExport}
              className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
            >
              <Printer className="h-4 w-4" /> Print / Save as PDF
            </button>
            <p className="ml-2 self-center text-xs text-neutral-500">
              Browser print is the PDF path — no extra deps. CSV is the data path.
            </p>
          </div>

          <div className="mb-3 text-sm">
            <span className="text-neutral-400">Choose reps to split this list across:</span>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
            {eligibleReps.map(rep => {
              const checked = selectedReps.includes(rep.slug);
              return (
                <label
                  key={rep.slug}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                    checked
                      ? 'border-brand-green/60 bg-brand-green/10'
                      : 'border-white/10 hover:bg-white/5'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e =>
                      setSelectedReps(prev =>
                        e.target.checked
                          ? [...prev, rep.slug]
                          : prev.filter(s => s !== rep.slug),
                      )
                    }
                  />
                  <span>{rep.name}</span>
                </label>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleAssign}
              disabled={assigning || selectedReps.length === 0}
              className="flex items-center gap-2 rounded-md bg-brand-green px-4 py-2 text-sm font-semibold text-black hover:bg-lime-400 disabled:opacity-60"
            >
              {assigning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              Assign to {selectedReps.length || 0} rep{selectedReps.length === 1 ? '' : 's'}
            </button>
            {assignResult && (
              <span className="text-sm text-green-400">{assignResult}</span>
            )}
            {assignError && (
              <span className="flex items-center gap-1 text-sm text-red-400">
                <AlertTriangle className="h-4 w-4" /> {assignError}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Writes to the Canvass Routes sheet. Idempotent on (stormEventId, repSlug). No
            text / email is sent to the rep — they pick up the route from their command
            center (rep notification channel is owner-gated).
          </p>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG impact-zone map — no external map provider, no extra deps.
// ---------------------------------------------------------------------------

function ZoneSvg({
  stormLat,
  stormLng,
  radiusMiles,
  addresses,
}: {
  stormLat: number;
  stormLng: number;
  radiusMiles: number;
  addresses: CanvassAddress[];
}) {
  const width = 640;
  const height = 360;

  // Project lat/lng to viewport. We use a simple equirectangular projection
  // centred on the storm and scaled so the radius circle fits 90% of the
  // shorter axis. Accurate enough for "show me where the pins are
  // clustered" — not a navigational map.
  const milesPerDegLat = 69; // approx
  const milesPerDegLng = 69 * Math.cos((stormLat * Math.PI) / 180);

  // Determine extent (miles) including some padding around the radius.
  const extentMiles = radiusMiles * 1.1;
  const pxPerMile = Math.min(width, height) * 0.5 / extentMiles;

  const project = (lat: number, lng: number) => {
    const dxMiles = (lng - stormLng) * milesPerDegLng;
    const dyMiles = (lat - stormLat) * milesPerDegLat;
    return {
      x: width / 2 + dxMiles * pxPerMile,
      y: height / 2 - dyMiles * pxPerMile,
    };
  };

  const radiusPx = radiusMiles * pxPerMile;

  return (
    <div className="overflow-hidden rounded-md border border-white/10 bg-black">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`Impact zone: ${radiusMiles}mi around ${stormLat.toFixed(3)},${stormLng.toFixed(3)}`}
      >
        {/* Subtle grid */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#222" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="#0a0a0a" />
        <rect width={width} height={height} fill="url(#grid)" />

        {/* Impact circle */}
        <circle
          cx={width / 2}
          cy={height / 2}
          r={radiusPx}
          fill="rgba(132,204,22,0.08)"
          stroke="rgba(132,204,22,0.6)"
          strokeWidth="1.5"
          strokeDasharray="6 4"
        />

        {/* Storm center marker */}
        <circle cx={width / 2} cy={height / 2} r={6} fill="#84cc16" />
        <circle cx={width / 2} cy={height / 2} r={3} fill="#000" />

        {/* Address pins — colour by damage probability */}
        {addresses.map(a => {
          const { x, y } = project(a.lat, a.lng);
          if (!isFinite(x) || !isFinite(y)) return null;
          const colour =
            a.damageProbability >= 75
              ? '#ef4444'
              : a.damageProbability >= 50
                ? '#f59e0b'
                : a.damageProbability >= 25
                  ? '#3b82f6'
                  : '#a3a3a3';
          return (
            <circle
              key={a.id}
              cx={x}
              cy={y}
              r={3.5}
              fill={colour}
              stroke="#000"
              strokeWidth="0.5"
            >
              <title>
                {a.name} · {a.address} · {a.damageProbability}%
              </title>
            </circle>
          );
        })}

        {/* Scale */}
        <g transform={`translate(20, ${height - 24})`}>
          <line x1="0" y1="0" x2={pxPerMile} y2="0" stroke="#a3a3a3" strokeWidth="2" />
          <text x="0" y="-4" fill="#a3a3a3" fontSize="10">
            1 mi
          </text>
        </g>

        {/* Legend */}
        <g transform={`translate(${width - 150}, 20)`} fontSize="10" fill="#a3a3a3">
          <circle cx="6" cy="0" r="3.5" fill="#ef4444" />
          <text x="14" y="3">
            damage &ge;75
          </text>
          <circle cx="6" cy="14" r="3.5" fill="#f59e0b" />
          <text x="14" y="17">
            50–74
          </text>
          <circle cx="6" cy="28" r="3.5" fill="#3b82f6" />
          <text x="14" y="31">
            25–49
          </text>
          <circle cx="6" cy="42" r="3.5" fill="#a3a3a3" />
          <text x="14" y="45">
            0–24
          </text>
        </g>
      </svg>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/40 p-2">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  );
}
