'use client';

/**
 * Warehouse TV Display
 *
 * Fullscreen, dark-themed kiosk page designed for the warehouse TV
 * (cast via /api/portal/delivery/iot action=display). Shows today's
 * loading plan + optimized delivery route + per-bay pull list, all
 * pulled live from the 18-stage pipeline. No mock data.
 *
 * Auto-refreshes every 30s.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  Package,
  Clock,
  CheckCircle,
  MapPin,
  Weight,
  Loader2,
  AlertTriangle,
  Navigation,
  Volume2,
  RotateCcw,
} from 'lucide-react';

interface PlannedStop {
  orderId: string;
  jobNumber: string;
  jobName: string;
  customerName: string;
  address: string;
  city: string;
  state: string;
  priority: 'normal' | 'rush' | 'urgent';
  scheduledTime?: string;
  driverName?: string;
  currentStage: string;
  stopOrder: number;
  distanceFromPrevMiles?: number;
  cumulativeMiles?: number;
  etaMinutesFromStart?: number;
  totalWeightLbs: number;
  itemCount: number;
}

interface LoadingPlanItem {
  itemId: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unit: string;
  weightLbs: number;
  location: string;
  loadOrder: number;
  audioMessage: string;
  orderId: string;
  jobName: string;
  pulled: boolean;
}

interface DailyLoadingPlan {
  date: string;
  totalOrders: number;
  totalStops: number;
  totalDistanceMiles: number;
  totalWeightLbs: number;
  unrouted: number;
  stops: PlannedStop[];
  loadingSequence: LoadingPlanItem[];
  generatedAt: string;
}

const STAGE_LABELS: Record<string, string> = {
  ORDER_REVIEWED: 'Reviewed',
  DRIVER_ASSIGNED: 'Driver Assigned',
  WAREHOUSE_NOTIFIED: 'Warehouse Notified',
  MATERIALS_PULLED: 'Pulled',
  LOAD_VERIFIED: 'Loaded',
  DEPARTURE_CONFIRMED: 'Departed',
  EN_ROUTE: 'En Route',
  ARRIVED_AT_SITE: 'At Site',
  UNLOADING: 'Unloading',
  DELIVERY_CONFIRMED: 'Delivered',
};

const STAGE_COLORS: Record<string, string> = {
  ORDER_REVIEWED: 'bg-zinc-700/60 text-zinc-200',
  DRIVER_ASSIGNED: 'bg-purple-500/30 text-purple-200',
  WAREHOUSE_NOTIFIED: 'bg-yellow-500/30 text-yellow-200',
  MATERIALS_PULLED: 'bg-amber-500/30 text-amber-200',
  LOAD_VERIFIED: 'bg-orange-500/30 text-orange-200',
  DEPARTURE_CONFIRMED: 'bg-cyan-500/30 text-cyan-200',
  EN_ROUTE: 'bg-sky-500/30 text-sky-200',
  ARRIVED_AT_SITE: 'bg-teal-500/30 text-teal-200',
  UNLOADING: 'bg-emerald-500/30 text-emerald-200',
  DELIVERY_CONFIRMED: 'bg-brand-green/30 text-brand-green',
};

const PRIORITY_GLOW: Record<string, string> = {
  normal: '',
  rush: 'shadow-orange-500/50 ring-1 ring-orange-500/40',
  urgent: 'shadow-red-500/60 ring-2 ring-red-500/60',
};

export default function WarehouseDisplayPage() {
  const [plan, setPlan] = useState<DailyLoadingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  const fetchPlan = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/delivery/loading-plan');
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load plan');
      }
      const data = await res.json();
      setPlan(data);
      setError(null);
    } catch (err) {
      console.error('[warehouse-display] fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load plan');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + 30-second auto-refresh
  useEffect(() => {
    fetchPlan();
    const t = setInterval(fetchPlan, 30000);
    return () => clearInterval(t);
  }, [fetchPlan]);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (loading && !plan) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-20 h-20 text-brand-green animate-spin mx-auto mb-4" />
          <p className="text-2xl text-zinc-300">Loading warehouse plan...</p>
        </div>
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-2xl">
          <AlertTriangle className="w-20 h-20 text-red-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-2">Plan Unavailable</h2>
          <p className="text-zinc-400 text-lg">{error}</p>
        </div>
      </div>
    );
  }

  if (!plan) return null;

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

  // Group loading sequence by warehouse bay for the picker view
  const loadingByLocation: Record<string, LoadingPlanItem[]> = {};
  for (const item of plan.loadingSequence) {
    if (!loadingByLocation[item.location]) loadingByLocation[item.location] = [];
    loadingByLocation[item.location].push(item);
  }

  const upcomingStops = plan.stops.filter(
    (s) =>
      ![
        'EN_ROUTE',
        'ARRIVED_AT_SITE',
        'UNLOADING',
        'DELIVERY_CONFIRMED',
      ].includes(s.currentStage)
  );

  return (
    <div className="min-h-screen bg-black text-white p-6 overflow-hidden">
      {/* Header — date, time, KPIs */}
      <header className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-5xl font-black text-white tracking-tight">
            River City Roofing
          </h1>
          <p className="text-2xl text-zinc-400 mt-1">{formatDate(now)}</p>
        </div>
        <div className="text-right">
          <div className="text-7xl font-black text-brand-green tabular-nums">
            {formatTime(now)}
          </div>
          <p className="text-sm text-zinc-500">
            Updated {new Date(plan.generatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={<Truck className="w-8 h-8" />}
          value={plan.totalStops}
          label="Stops Today"
          color="text-brand-green"
        />
        <KpiCard
          icon={<Package className="w-8 h-8" />}
          value={plan.loadingSequence.length}
          label="Items to Load"
          color="text-cyan-400"
        />
        <KpiCard
          icon={<Weight className="w-8 h-8" />}
          value={`${(plan.totalWeightLbs / 1000).toFixed(1)}k`}
          label="lbs Total Load"
          color="text-amber-400"
        />
        <KpiCard
          icon={<Navigation className="w-8 h-8" />}
          value={plan.totalDistanceMiles}
          label="Route Miles"
          color="text-purple-400"
        />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left: Today's Route (delivery order) */}
        <div className="col-span-7">
          <h2 className="text-3xl font-black text-white mb-4 flex items-center gap-3">
            <Navigation className="w-7 h-7 text-brand-green" />
            Today&apos;s Route
            <span className="text-sm font-medium text-zinc-500">
              (optimized · nearest neighbor)
            </span>
          </h2>
          <div className="space-y-3">
            {upcomingStops.length === 0 ? (
              <div className="text-center py-12 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                <CheckCircle className="w-16 h-16 text-brand-green mx-auto mb-3" />
                <p className="text-2xl font-bold text-white">All deliveries dispatched</p>
                <p className="text-zinc-500 mt-1">Nothing left to load.</p>
              </div>
            ) : (
              upcomingStops.map((stop) => (
                <div
                  key={stop.orderId}
                  className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-4 ${
                    PRIORITY_GLOW[stop.priority] || ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-brand-green/15 border border-brand-green/40 flex items-center justify-center flex-shrink-0">
                      <span className="text-3xl font-black text-brand-green">
                        {stop.stopOrder}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-2xl font-bold text-white truncate">
                          {stop.jobName}
                        </h3>
                        {stop.priority !== 'normal' && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
                              stop.priority === 'urgent'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-orange-500/20 text-orange-400'
                            }`}
                          >
                            {stop.priority}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            STAGE_COLORS[stop.currentStage] || 'bg-zinc-700/60 text-zinc-200'
                          }`}
                        >
                          {STAGE_LABELS[stop.currentStage] || stop.currentStage}
                        </span>
                      </div>
                      <div className="text-zinc-400 text-base flex items-center gap-2">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">
                          {stop.address}, {stop.city}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        {stop.driverName && (
                          <span className="text-cyan-400 font-medium">
                            {stop.driverName}
                          </span>
                        )}
                        {stop.scheduledTime && (
                          <span className="flex items-center gap-1 text-zinc-500">
                            <Clock className="w-3 h-3" />
                            {stop.scheduledTime}
                          </span>
                        )}
                        {typeof stop.cumulativeMiles === 'number' && (
                          <span className="text-zinc-500">
                            {stop.cumulativeMiles} mi
                            {typeof stop.etaMinutesFromStart === 'number' && (
                              <> · ETA +{stop.etaMinutesFromStart}m</>
                            )}
                          </span>
                        )}
                        <span className="text-zinc-500">
                          {stop.itemCount} items · {stop.totalWeightLbs} lbs
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Loading Sequence by Bay */}
        <div className="col-span-5">
          <h2 className="text-3xl font-black text-white mb-4 flex items-center gap-3">
            <Package className="w-7 h-7 text-brand-green" />
            Pull List
            <span className="text-sm font-medium text-zinc-500">
              (last stop loaded first)
            </span>
          </h2>
          <div className="space-y-4 max-h-[calc(100vh-380px)] overflow-y-auto pr-2">
            {Object.keys(loadingByLocation).length === 0 ? (
              <div className="text-center py-12 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                <Package className="w-16 h-16 text-zinc-700 mx-auto mb-3" />
                <p className="text-xl text-zinc-500">Nothing to pull</p>
              </div>
            ) : (
              Object.entries(loadingByLocation).map(([location, items]) => (
                <div
                  key={location}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4"
                >
                  <h3 className="text-lg font-bold text-brand-green mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {location}
                    <span className="text-xs font-medium text-zinc-500">
                      ({items.length} {items.length === 1 ? 'item' : 'items'})
                    </span>
                  </h3>
                  <div className="space-y-1.5">
                    {items.map((item) => (
                      <div
                        key={item.itemId}
                        className={`flex items-center justify-between p-2 rounded-lg ${
                          item.pulled
                            ? 'bg-brand-green/10 border border-brand-green/30'
                            : 'bg-zinc-800/50 border border-zinc-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {item.pulled ? (
                            <CheckCircle className="w-5 h-5 text-brand-green flex-shrink-0" />
                          ) : (
                            <span className="w-5 h-5 rounded-full border-2 border-zinc-600 flex-shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-white font-medium text-sm truncate">
                              <span className="text-amber-400 font-black mr-1">
                                {item.quantity}×
                              </span>
                              {item.productName}
                            </div>
                            <div className="text-xs text-zinc-500 truncate">
                              {item.jobName} · {item.weightLbs} lbs
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between text-sm text-zinc-600">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Volume2 className="w-4 h-4" />
            TTS announcements via warehouse speaker
          </span>
          {plan.unrouted > 0 && (
            <span className="text-orange-400 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              {plan.unrouted} unrouted (no coords)
            </span>
          )}
        </div>
        <span className="flex items-center gap-1">
          <RotateCcw className="w-3 h-3" /> Auto-refresh every 30s
        </span>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  color: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4">
      <div className={`${color}`}>{icon}</div>
      <div>
        <div className={`text-4xl font-black ${color} tabular-nums`}>{value}</div>
        <div className="text-sm text-zinc-500 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}
