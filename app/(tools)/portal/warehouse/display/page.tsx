'use client';

/**
 * Warehouse X88 Kiosk Display
 *
 * Full-screen TV view that runs on the X88 box plugged into the warehouse
 * TV. Designed to be glanceable from 20+ feet — huge type, high contrast,
 * no chrome, auto-rotating panels so every section gets its turn on screen.
 *
 * Panels (5-second rotation):
 *   1. OVERVIEW   — Today's load count, weather, stock/vendor split
 *   2. STOPS      — City grid with counts
 *   3. PIPELINE   — Stage-by-stage ticket counts
 *   4. TICKETS    — Scrolling list of active work orders
 *
 * Open in a kiosk-mode browser (key required — set WAREHOUSE_DISPLAY_KEY
 * on Vercel and pass the same value in the URL):
 *   chromium --kiosk "https://rcrsal.com/portal/warehouse/display?key=<WAREHOUSE_DISPLAY_KEY>"
 *
 * The page itself has NO login — the X88 runs as an anonymous kiosk. The
 * ?key= query param is forwarded to /api/warehouse/today, which accepts it
 * in place of a session (env-gated). Without the key the API returns 401
 * and the display shows "Display offline". All sensitive data (cost,
 * prices) is server-side filtered before the payload reaches the page.
 */

import { useState, useEffect, useRef } from 'react';
import {
  Cloud, Sun, CloudRain, Wind, MapPin, Truck, Package, Clock,
  AlertTriangle, Zap, Warehouse, Store,
} from 'lucide-react';

interface TicketRow {
  ticketId: string;
  jobNumber: string;
  customerName: string;
  address: string;
  status: string;
  itemCount: number;
  totalPieces: number;
  jobnimbusUrl: string | null;
  orderSource?: 'stock' | 'other_vendor';
  supplierName?: string;
}

interface TodayPayload {
  greeting: string;
  timestamp: string;
  weather: {
    temp: number | null;
    condition: string;
    high: number | null;
    low: number | null;
    icon: string;
    isWorkable: boolean | null;
  } | null;
  counts: {
    total: number;
    created: number;
    assigned: number;
    materials_pulled: number;
    en_route: number;
    arrived: number;
  };
  cities: Array<{ city: string; count: number }>;
  totals: { totalPrice: number; totalCost?: number };
  tickets: TicketRow[];
}

type PanelKey = 'overview' | 'stops' | 'pipeline' | 'tickets';
const PANEL_ORDER: PanelKey[] = ['overview', 'stops', 'pipeline', 'tickets'];
const PANEL_ROTATION_MS = 8000; // 8s per panel = ~32s full rotation

function pickWeatherIcon(condition: string) {
  const c = (condition || '').toLowerCase();
  if (c.includes('rain') || c.includes('shower')) return CloudRain;
  if (c.includes('cloud')) return Cloud;
  if (c.includes('wind')) return Wind;
  return Sun;
}

function splitStockVendor(tickets: TicketRow[]): { stock: number; vendor: number } {
  let stock = 0, vendor = 0;
  for (const t of tickets) {
    if (t.orderSource === 'other_vendor') vendor++;
    else stock++;
  }
  return { stock, vendor };
}

export default function WarehouseDisplayPage() {
  const [data, setData] = useState<TodayPayload | null>(null);
  const [error, setError] = useState<string>('');
  const [now, setNow] = useState(new Date());
  const [activePanel, setActivePanel] = useState<PanelKey>('overview');
  const [panelPaused, setPanelPaused] = useState(false);
  const rotationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data fetch + clock ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        // Forward the kiosk display key (if present in the page URL) so the
        // X88 can authenticate without a login session.
        const key = new URLSearchParams(window.location.search).get('key');
        const url = key
          ? `/api/warehouse/today?key=${encodeURIComponent(key)}`
          : '/api/warehouse/today';
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const payload = await res.json();
        if (!cancelled) {
          setData(payload);
          setError('');
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    };

    load();
    const dataInterval = setInterval(load, 30_000);
    const clockInterval = setInterval(() => setNow(new Date()), 1000);

    return () => {
      cancelled = true;
      clearInterval(dataInterval);
      clearInterval(clockInterval);
    };
  }, []);

  // ── Panel rotation ────────────────────────────────────────────────────
  useEffect(() => {
    if (panelPaused) return;
    rotationTimerRef.current = setInterval(() => {
      setActivePanel(prev => {
        const idx = PANEL_ORDER.indexOf(prev);
        return PANEL_ORDER[(idx + 1) % PANEL_ORDER.length];
      });
    }, PANEL_ROTATION_MS);
    return () => {
      if (rotationTimerRef.current) clearInterval(rotationTimerRef.current);
    };
  }, [panelPaused]);

  const WeatherIcon = pickWeatherIcon(data?.weather?.condition || '');
  const split = data ? splitStockVendor(data.tickets) : { stock: 0, vendor: 0 };

  // ── Keyboard / touch manual control (for a curious wanderer) ─────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setActivePanel(prev => PANEL_ORDER[(PANEL_ORDER.indexOf(prev) + 1) % PANEL_ORDER.length]);
      }
      if (e.key === 'ArrowLeft') {
        setActivePanel(prev => PANEL_ORDER[(PANEL_ORDER.indexOf(prev) - 1 + PANEL_ORDER.length) % PANEL_ORDER.length]);
      }
      if (e.key === ' ') setPanelPaused(p => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden font-sans">
      {/* ── Top header bar ────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#39FF14] via-lime-400 to-[#0066CC] p-1">
        <div className="bg-black px-10 py-5 flex items-center justify-between">
          <div>
            <div className="text-6xl font-black text-[#39FF14] tracking-tight">RCRS WAREHOUSE</div>
            <div className="text-2xl text-gray-400 mt-1">
              {data?.greeting || 'Loading'}, {' '}
              <span className="text-white">Rick</span>
              {data && data.counts.total > 0 && (
                <span className="ml-4 text-[#39FF14]">· {data.counts.total} active</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-7xl font-black tabular-nums leading-none">
              {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </div>
            <div className="text-2xl text-gray-400 mt-1">
              {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-900 text-white p-4 text-3xl text-center flex items-center justify-center gap-3">
          <AlertTriangle className="w-8 h-8" /> Display offline: {error}
        </div>
      )}

      {!data && !error && (
        <div className="flex items-center justify-center py-40 text-4xl text-gray-500">
          Loading warehouse data...
        </div>
      )}

      {data && (
        <div className="p-8 space-y-6">
          {/* Panel indicator dots */}
          <div className="flex items-center justify-center gap-3">
            {PANEL_ORDER.map(key => (
              <div
                key={key}
                className={`h-2 rounded-full transition-all ${
                  key === activePanel ? 'w-16 bg-[#39FF14]' : 'w-8 bg-zinc-700'
                }`}
              />
            ))}
            {panelPaused && (
              <span className="ml-3 text-sm text-yellow-400 uppercase tracking-widest">
                Paused
              </span>
            )}
          </div>

          {/* ── PANEL 1: OVERVIEW ────────────────────────────────────── */}
          {activePanel === 'overview' && (
            <div className="grid grid-cols-12 gap-6 animate-fadeIn">
              {/* Weather card */}
              <div className="col-span-4 bg-gradient-to-br from-[#0066CC] to-blue-900 rounded-3xl p-8 flex flex-col justify-between min-h-[360px]">
                <div className="flex items-center justify-between">
                  <WeatherIcon className="w-24 h-24 text-yellow-300" />
                  <div className="text-right">
                    <div className="text-9xl font-black tabular-nums leading-none">
                      {data.weather?.temp != null ? Math.round(data.weather.temp) : '—'}°
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-bold capitalize">
                    {data.weather?.condition || 'Decatur, AL'}
                  </div>
                  {data.weather?.high != null && data.weather?.low != null && (
                    <div className="text-2xl text-blue-200 mt-2">
                      H {Math.round(data.weather.high)}° · L {Math.round(data.weather.low)}°
                    </div>
                  )}
                  {data.weather?.isWorkable === false && (
                    <div className="mt-4 inline-block bg-red-500 text-white text-2xl px-4 py-2 rounded-full font-black">
                      ⚠ NOT WORKABLE
                    </div>
                  )}
                </div>
              </div>

              {/* Today's load count */}
              <div className="col-span-4 bg-gradient-to-br from-[#39FF14]/20 to-lime-900/40 rounded-3xl p-8 border-4 border-[#39FF14] flex flex-col justify-between min-h-[360px]">
                <div className="flex items-center gap-3">
                  <Truck className="w-16 h-16 text-[#39FF14]" />
                  <div className="text-3xl font-black text-[#39FF14]">TODAY</div>
                </div>
                <div>
                  <div className="text-[10rem] font-black tabular-nums text-[#39FF14] leading-none">
                    {data.counts.total}
                  </div>
                  <div className="text-3xl text-lime-200 mt-2">
                    {data.counts.total === 1 ? 'work order' : 'work orders'}
                  </div>
                </div>
              </div>

              {/* Stock vs Vendor split */}
              <div className="col-span-4 grid grid-rows-2 gap-6">
                <div className="bg-gradient-to-br from-emerald-900/60 to-green-950 rounded-3xl p-6 border-4 border-emerald-500 flex flex-col justify-between">
                  <div className="flex items-center gap-3">
                    <Warehouse className="w-12 h-12 text-emerald-400" />
                    <div className="text-2xl font-black text-emerald-300">STOCK</div>
                  </div>
                  <div>
                    <div className="text-8xl font-black tabular-nums text-emerald-400 leading-none">
                      {split.stock}
                    </div>
                    <div className="text-xl text-emerald-300 mt-1">from our shelf</div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-purple-900/60 to-purple-950 rounded-3xl p-6 border-4 border-purple-500 flex flex-col justify-between">
                  <div className="flex items-center gap-3">
                    <Store className="w-12 h-12 text-purple-400" />
                    <div className="text-2xl font-black text-purple-300">VENDOR</div>
                  </div>
                  <div>
                    <div className="text-8xl font-black tabular-nums text-purple-400 leading-none">
                      {split.vendor}
                    </div>
                    <div className="text-xl text-purple-300 mt-1">outside supplier</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── PANEL 2: STOPS ───────────────────────────────────────── */}
          {activePanel === 'stops' && (
            <div className="bg-zinc-900 rounded-3xl p-8 animate-fadeIn min-h-[500px]">
              <div className="flex items-center gap-3 mb-6">
                <MapPin className="w-16 h-16 text-[#0066CC]" />
                <div className="text-5xl font-black text-gray-200">Today&apos;s Stops</div>
              </div>
              {data.cities.length === 0 ? (
                <div className="text-4xl text-gray-500 italic py-16 text-center">
                  No active stops
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-6">
                  {data.cities.slice(0, 12).map(c => (
                    <div
                      key={c.city}
                      className="flex justify-between items-center bg-zinc-800 rounded-2xl px-6 py-5 border border-zinc-700"
                    >
                      <span className="text-4xl font-black tracking-tight">{c.city}</span>
                      <span className="text-6xl font-black text-[#39FF14] tabular-nums">
                        {c.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── PANEL 3: PIPELINE ────────────────────────────────────── */}
          {activePanel === 'pipeline' && (
            <div className="bg-zinc-900 rounded-3xl p-8 animate-fadeIn min-h-[500px]">
              <div className="text-4xl font-black text-gray-200 mb-6 flex items-center gap-3">
                <Clock className="w-14 h-14 text-[#39FF14]" /> Pipeline
              </div>
              <div className="grid grid-cols-6 gap-6">
                {[
                  { key: 'created', label: 'New', color: 'text-blue-400', border: 'border-blue-500' },
                  { key: 'assigned', label: 'Assigned', color: 'text-cyan-400', border: 'border-cyan-500' },
                  { key: 'materials_pulled', label: 'Pulled', color: 'text-yellow-400', border: 'border-yellow-500' },
                  { key: 'en_route', label: 'En Route', color: 'text-orange-400', border: 'border-orange-500' },
                  { key: 'arrived', label: 'On Site', color: 'text-purple-400', border: 'border-purple-500' },
                ].map(s => {
                  const count = data.counts[s.key as keyof typeof data.counts] as number;
                  return (
                    <div
                      key={s.key}
                      className={`bg-black rounded-3xl p-6 text-center border-4 ${s.border}`}
                    >
                      <div className={`text-8xl font-black tabular-nums ${s.color}`}>{count}</div>
                      <div className="text-2xl text-gray-300 mt-2 font-bold uppercase tracking-wide">
                        {s.label}
                      </div>
                    </div>
                  );
                })}
                <div className="bg-black rounded-3xl p-6 text-center border-4 border-[#39FF14]">
                  <div className="text-8xl font-black tabular-nums text-[#39FF14]">
                    {data.tickets.reduce((sum, t) => sum + t.totalPieces, 0)}
                  </div>
                  <div className="text-2xl text-gray-300 mt-2 font-bold uppercase tracking-wide">
                    Pieces
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── PANEL 4: TICKETS ─────────────────────────────────────── */}
          {activePanel === 'tickets' && (
            <div className="bg-zinc-900 rounded-3xl p-8 animate-fadeIn min-h-[500px]">
              <div className="text-4xl font-black text-gray-200 mb-6 flex items-center gap-3">
                <Package className="w-14 h-14 text-[#39FF14]" /> Active Work Orders
              </div>
              {data.tickets.length === 0 ? (
                <div className="text-4xl text-gray-500 italic py-16 text-center">
                  Caught up — no active orders
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-5 max-h-[60vh] overflow-y-auto">
                  {data.tickets.slice(0, 12).map(t => {
                    const isVendor = t.orderSource === 'other_vendor';
                    return (
                      <div
                        key={t.ticketId}
                        className={`bg-black rounded-2xl p-6 border-l-8 ${
                          isVendor ? 'border-purple-500' : 'border-[#39FF14]'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 min-w-0">
                            <div
                              className={`text-4xl font-black tracking-tight ${
                                isVendor ? 'text-purple-400' : 'text-[#39FF14]'
                              }`}
                            >
                              {t.jobNumber}
                            </div>
                            <div className="text-3xl font-bold mt-1 truncate">{t.customerName}</div>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <div className="text-4xl font-black tabular-nums">{t.itemCount}</div>
                            <div className="text-sm text-gray-500 uppercase tracking-wide">
                              items
                            </div>
                          </div>
                        </div>
                        <div className="text-xl text-gray-400 mt-2 truncate">{t.address}</div>
                        <div className="flex items-center gap-2 mt-3">
                          <span
                            className={`text-xs font-black px-2 py-1 rounded ${
                              isVendor
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                            }`}
                          >
                            {isVendor ? 'VENDOR' : 'STOCK'}
                          </span>
                          {isVendor && t.supplierName && (
                            <span className="text-sm text-purple-300">· {t.supplierName}</span>
                          )}
                          <span className="ml-auto text-sm text-gray-500 capitalize">
                            {t.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Auto-refresh footer */}
      <div className="fixed bottom-4 right-4 text-xs text-gray-600 flex items-center gap-2">
        <Zap className="w-3 h-3" />
        Rotating every {PANEL_ROTATION_MS / 1000}s · Data refresh every 30s · Last update{' '}
        {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '—'}
      </div>

      {/* Fade-in animation */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
