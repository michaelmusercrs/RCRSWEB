'use client';

/**
 * Driver Map (Office View)
 *
 * Live map showing where Rick / Tae / any driver currently is. Office can
 * use this to intercept drivers with extra material, route them to a
 * detour, or just confirm they're moving on schedule.
 *
 * Reads from /api/portal/driver-locations every 15s. Uses the Google Maps
 * JavaScript API loaded via script tag (no npm dependency).
 *
 * Allowed roles: office, admin, owner, manager.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { MapPin, Truck, RefreshCw, Phone, ArrowLeft, Clock } from 'lucide-react';

interface DriverLocation {
  userId: string;
  userName: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  distanceMiles: number;
  updatedAt: string;
  ageSeconds: number | null;
}

const WAREHOUSE_LAT = 34.5536;
const WAREHOUSE_LNG = -86.9806;

declare global {
  interface Window {
    google?: any;
    __initDriverMap?: () => void;
  }
}

function ageLabel(seconds: number | null): { label: string; color: string } {
  if (seconds == null) return { label: 'unknown', color: 'text-gray-400' };
  if (seconds < 60) return { label: `${seconds}s ago`, color: 'text-green-400' };
  if (seconds < 300) return { label: `${Math.floor(seconds / 60)}m ago`, color: 'text-green-400' };
  if (seconds < 900) return { label: `${Math.floor(seconds / 60)}m ago`, color: 'text-yellow-400' };
  if (seconds < 3600) return { label: `${Math.floor(seconds / 60)}m ago`, color: 'text-orange-400' };
  return { label: `${Math.floor(seconds / 3600)}h ago`, color: 'text-red-400' };
}

export default function DriverMapPage() {
  const [drivers, setDrivers] = useState<DriverLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/driver-locations', { cache: 'no-store' });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setDrivers(data.drivers || []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
    const interval = setInterval(fetchDrivers, 15_000);
    return () => clearInterval(interval);
  }, [fetchDrivers]);

  // Initialize the map once the Google Maps script has loaded
  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstanceRef.current) return;
    if (typeof window === 'undefined' || !window.google) return;

    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: WAREHOUSE_LAT, lng: WAREHOUSE_LNG },
      zoom: 11,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
      ],
    });

    // Warehouse pin
    new window.google.maps.Marker({
      position: { lat: WAREHOUSE_LAT, lng: WAREHOUSE_LNG },
      map: mapInstanceRef.current,
      title: 'RCRS Warehouse',
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#0066CC',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
    });
  }, [mapReady]);

  // Sync driver markers to the map whenever the data changes
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return;

    const seenUserIds = new Set<string>();

    for (const d of drivers) {
      seenUserIds.add(d.userId);
      const existing = markersRef.current.get(d.userId);
      const position = { lat: d.lat, lng: d.lng };

      if (existing) {
        existing.setPosition(position);
      } else {
        const marker = new window.google.maps.Marker({
          position,
          map: mapInstanceRef.current,
          title: `${d.userName} (${d.distanceMiles}mi from warehouse)`,
          label: {
            text: d.userName.charAt(0).toUpperCase(),
            color: '#000',
            fontWeight: 'bold',
            fontSize: '14px',
          },
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 16,
            fillColor: '#39FF14',
            fillOpacity: 1,
            strokeColor: '#000000',
            strokeWeight: 2,
          },
        });
        marker.addListener('click', () => setSelectedDriver(d.userId));
        markersRef.current.set(d.userId, marker);
      }
    }

    // Remove markers for drivers that are no longer in the list
    for (const [userId, marker] of markersRef.current.entries()) {
      if (!seenUserIds.has(userId)) {
        marker.setMap(null);
        markersRef.current.delete(userId);
      }
    }

    // Auto-fit bounds when there are drivers
    if (drivers.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend({ lat: WAREHOUSE_LAT, lng: WAREHOUSE_LNG });
      drivers.forEach(d => bounds.extend({ lat: d.lat, lng: d.lng }));
      mapInstanceRef.current.fitBounds(bounds, 80);
    }
  }, [drivers]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
        strategy="afterInteractive"
        onLoad={() => setMapReady(true)}
      />

      {/* Header */}
      <header className="bg-black/95 border-b border-zinc-800 sticky top-0 z-20">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal/manager" className="p-2 rounded-lg bg-zinc-800">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="text-xs text-gray-500 uppercase">Office View</div>
              <div className="text-xl font-black text-[#39FF14]">Driver Map</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchDrivers} className="p-2 rounded-lg bg-zinc-800">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
        {/* Map */}
        <div className="md:col-span-2 h-[60vh] md:h-[calc(100vh-64px)] bg-zinc-900">
          <div ref={mapRef} className="w-full h-full" />
          {!mapReady && (
            <div className="flex items-center justify-center h-full text-gray-500">
              Loading map…
            </div>
          )}
        </div>

        {/* Driver list */}
        <div className="bg-zinc-950 border-l border-zinc-800 max-h-[40vh] md:max-h-[calc(100vh-64px)] overflow-y-auto">
          <div className="p-4 border-b border-zinc-800">
            <div className="text-sm font-bold text-gray-400 uppercase">Active Drivers</div>
            <div className="text-2xl font-black text-[#39FF14]">{drivers.length}</div>
          </div>

          {error && (
            <div className="m-4 bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          {!loading && drivers.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              No drivers reporting GPS right now
            </div>
          )}

          <div className="divide-y divide-zinc-800">
            {drivers.map(d => {
              const age = ageLabel(d.ageSeconds);
              const isSelected = selectedDriver === d.userId;
              return (
                <button
                  key={d.userId}
                  onClick={() => {
                    setSelectedDriver(d.userId);
                    if (mapInstanceRef.current) {
                      mapInstanceRef.current.setCenter({ lat: d.lat, lng: d.lng });
                      mapInstanceRef.current.setZoom(14);
                    }
                  }}
                  className={`w-full text-left p-4 hover:bg-zinc-900 transition-colors ${isSelected ? 'bg-zinc-900' : ''}`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-[#39FF14]/20 border border-[#39FF14] flex items-center justify-center text-[#39FF14] font-black">
                        {d.userName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold">{d.userName}</div>
                        <div className={`text-xs ${age.color} flex items-center gap-1`}>
                          <Clock className="w-3 h-3" /> {age.label}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 tabular-nums">
                      {d.distanceMiles}mi
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 ml-11">
                    {d.lat.toFixed(4)}, {d.lng.toFixed(4)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
