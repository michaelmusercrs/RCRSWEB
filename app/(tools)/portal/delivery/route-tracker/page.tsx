'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Navigation,
  Truck,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  Square,
  Camera,
  FileText,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Plus,
  Search,
  Filter,
  ChevronRight,
  ChevronDown,
  Package,
  Users,
  Target,
  AlertCircle,
  Star,
  Settings,
  Route,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface RouteStop {
  id: string;
  order: number;
  address: string;
  lat: number;
  lng: number;
  customerName: string;
  jobId?: string;
  type: 'pickup' | 'delivery' | 'inspection' | 'meeting' | 'other';
  estimatedArrival: string;
  actualArrival?: string;
  departedAt?: string;
  duration?: number;
  status: 'pending' | 'en_route' | 'arrived' | 'completed' | 'skipped';
  notes: string;
  signature?: string;
  photos: string[];
}

interface RouteData {
  id: string;
  date: string;
  driverId: string;
  driverName: string;
  vehicleId?: string;
  stops: RouteStop[];
  startLocation: { address: string; lat: number; lng: number };
  startTime: string;
  endTime?: string;
  totalMiles: number;
  totalStops: number;
  completedStops: number;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  optimizedOrder?: number[];
  estimatedTotalTime: number;
  actualTotalTime?: number;
  createdAt: string;
  updatedAt: string;
}

interface RouteAnalytics {
  totalRoutes: number;
  avgStopsPerRoute: number;
  avgMilesPerRoute: number;
  avgTimePerStop: number;
  onTimeRate: number;
  completionRate: number;
  byDriver: {
    driverSlug: string;
    name: string;
    routes: number;
    avgMiles: number;
    onTimeRate: number;
  }[];
}

// =============================================================================
// Constants
// =============================================================================

const STOP_TYPE_COLORS: Record<string, string> = {
  pickup: 'bg-blue-600',
  delivery: 'bg-green-600',
  inspection: 'bg-yellow-600',
  meeting: 'bg-purple-600',
  other: 'bg-gray-600',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-gray-400',
  en_route: 'text-yellow-400',
  arrived: 'text-blue-400',
  completed: 'text-[#39FF14]',
  skipped: 'text-red-400',
};

// =============================================================================
// Component
// =============================================================================

export default function RouteTrackerPage() {
  const [activeTab, setActiveTab] = useState<
    'active' | 'planning' | 'history' | 'stats'
  >('active');
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [analytics, setAnalytics] = useState<RouteAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active route actions
  const [actionLoading, setActionLoading] = useState('');
  const [departNotes, setDepartNotes] = useState('');
  const [skipReason, setSkipReason] = useState('');
  const [showSkipModal, setShowSkipModal] = useState<{
    routeId: string;
    stopId: string;
  } | null>(null);

  // Route planning state
  const [planDate, setPlanDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [planDriverId, setPlanDriverId] = useState('');
  const [planDriverName, setPlanDriverName] = useState('');
  const [planStops, setPlanStops] = useState<
    {
      address: string;
      lat: number;
      lng: number;
      customerName: string;
      type: RouteStop['type'];
      jobId?: string;
    }[]
  >([]);
  const [newStopAddress, setNewStopAddress] = useState('');
  const [newStopCustomer, setNewStopCustomer] = useState('');
  const [newStopType, setNewStopType] = useState<RouteStop['type']>('delivery');
  const [newStopLat, setNewStopLat] = useState('34.7304');
  const [newStopLng, setNewStopLng] = useState('-86.5861');

  // History state
  const [historyFilter, setHistoryFilter] = useState('');
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/routes?limit=50');
      if (!res.ok) throw new Error('Failed to fetch routes');
      const data = await res.json();
      setRoutes(data.routes || []);
      setAnalytics(data.analytics || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  // -------------------------------------------------------------------------
  // Route actions
  // -------------------------------------------------------------------------

  const handleRouteAction = async (
    routeId: string,
    action: string,
    extra?: Record<string, unknown>
  ) => {
    setActionLoading(`${routeId}-${action}`);
    try {
      const res = await fetch(`/api/routes/${routeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Action failed');
      }
      await fetchRoutes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading('');
      setDepartNotes('');
    }
  };

  const handleOptimizeRoute = async (routeId: string) => {
    setActionLoading(`${routeId}-optimize`);
    try {
      const res = await fetch('/api/routes/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeId }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Optimization failed');
      }
      await fetchRoutes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading('');
    }
  };

  // -------------------------------------------------------------------------
  // Route planning
  // -------------------------------------------------------------------------

  const addPlanStop = () => {
    if (!newStopAddress || !newStopCustomer) return;
    setPlanStops([
      ...planStops,
      {
        address: newStopAddress,
        lat: parseFloat(newStopLat) || 34.7304,
        lng: parseFloat(newStopLng) || -86.5861,
        customerName: newStopCustomer,
        type: newStopType,
      },
    ]);
    setNewStopAddress('');
    setNewStopCustomer('');
    setNewStopLat('34.7304');
    setNewStopLng('-86.5861');
  };

  const removePlanStop = (idx: number) => {
    setPlanStops(planStops.filter((_, i) => i !== idx));
  };

  const movePlanStop = (idx: number, direction: 'up' | 'down') => {
    const arr = [...planStops];
    const target = direction === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setPlanStops(arr);
  };

  const optimizePlanStops = async () => {
    if (planStops.length <= 1) return;
    try {
      const res = await fetch('/api/routes/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stops: planStops }),
      });
      if (!res.ok) throw new Error('Optimization failed');
      const data = await res.json();
      if (data.optimizedStops) {
        setPlanStops(data.optimizedStops);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const createRoute = async () => {
    if (!planDriverId || !planDriverName || planStops.length === 0) {
      setError('Fill in driver info and add at least one stop');
      return;
    }
    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: planDriverId,
          driverName: planDriverName,
          date: planDate,
          stops: planStops,
        }),
      });
      if (!res.ok) throw new Error('Failed to create route');
      setPlanStops([]);
      setPlanDriverId('');
      setPlanDriverName('');
      setActiveTab('active');
      await fetchRoutes();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  const formatTime = (iso: string) => {
    if (!iso) return '--';
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDate = (iso: string) => {
    if (!iso) return '--';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const openGoogleMaps = (address: string) => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
      '_blank'
    );
  };

  const activeRoutes = routes.filter((r) => r.status === 'active');
  const plannedRoutes = routes.filter((r) => r.status === 'planned');
  const completedRoutes = routes.filter(
    (r) => r.status === 'completed' || r.status === 'cancelled'
  );

  const filteredHistory = historyFilter
    ? completedRoutes.filter(
        (r) =>
          r.driverName.toLowerCase().includes(historyFilter.toLowerCase()) ||
          r.date.includes(historyFilter)
      )
    : completedRoutes;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/portal/delivery"
              className="text-gray-400 hover:text-white"
            >
              <ArrowRight className="h-5 w-5 rotate-180" />
            </Link>
            <Route className="h-6 w-6 text-[#39FF14]" />
            <h1 className="text-xl font-bold">Route Tracker</h1>
          </div>
          <button
            onClick={fetchRoutes}
            className="rounded bg-gray-700 px-3 py-1.5 text-sm hover:bg-gray-600"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded bg-red-900/50 px-4 py-2 text-red-300">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-700 px-6">
        <div className="flex gap-1">
          {(
            [
              { key: 'active', label: 'Active Routes', icon: Navigation, count: activeRoutes.length },
              { key: 'planning', label: 'Plan Route', icon: Plus },
              { key: 'history', label: 'History', icon: Clock, count: completedRoutes.length },
              { key: 'stats', label: 'Driver Stats', icon: Target },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-[#39FF14] text-[#39FF14]'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {'count' in tab && tab.count !== undefined && tab.count > 0 && (
                <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#39FF14] border-t-transparent" />
          </div>
        ) : (
          <>
            {/* ============================================================= */}
            {/* ACTIVE ROUTES TAB */}
            {/* ============================================================= */}
            {activeTab === 'active' && (
              <div className="space-y-6">
                {/* Also show planned routes */}
                {plannedRoutes.length > 0 && (
                  <div>
                    <h2 className="mb-3 text-lg font-semibold text-gray-300">
                      Planned Routes
                    </h2>
                    <div className="space-y-4">
                      {plannedRoutes.map((route) => (
                        <div
                          key={route.id}
                          className="rounded-lg border border-gray-700 bg-gray-800 p-4"
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Truck className="h-5 w-5 text-gray-400" />
                              <div>
                                <span className="font-medium">
                                  {route.driverName}
                                </span>
                                <span className="ml-2 text-sm text-gray-400">
                                  {formatDate(route.date)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-400">
                                {route.totalStops} stops &middot;{' '}
                                {route.totalMiles} mi &middot;{' '}
                                ~{route.estimatedTotalTime} min
                              </span>
                              <button
                                onClick={() => handleOptimizeRoute(route.id)}
                                disabled={
                                  actionLoading === `${route.id}-optimize`
                                }
                                className="rounded bg-blue-600 px-3 py-1 text-sm hover:bg-blue-500 disabled:opacity-50"
                              >
                                {actionLoading === `${route.id}-optimize`
                                  ? 'Optimizing...'
                                  : 'Optimize'}
                              </button>
                              <button
                                onClick={() =>
                                  handleRouteAction(route.id, 'start')
                                }
                                disabled={
                                  actionLoading === `${route.id}-start`
                                }
                                className="flex items-center gap-1 rounded bg-[#39FF14] px-3 py-1 text-sm font-medium text-black hover:bg-[#32e612] disabled:opacity-50"
                              >
                                <Play className="h-3 w-3" /> Start
                              </button>
                            </div>
                          </div>
                          {/* Stop list */}
                          <div className="space-y-2">
                            {route.stops.map((stop) => (
                              <div
                                key={stop.id}
                                className="flex items-center gap-3 rounded bg-gray-700/50 px-3 py-2 text-sm"
                              >
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-600 text-xs font-bold">
                                  {stop.order}
                                </span>
                                <span
                                  className={`rounded px-2 py-0.5 text-xs font-medium text-white ${STOP_TYPE_COLORS[stop.type]}`}
                                >
                                  {stop.type}
                                </span>
                                <span className="font-medium">
                                  {stop.customerName}
                                </span>
                                <span className="text-gray-400">
                                  {stop.address}
                                </span>
                                <span className="ml-auto text-gray-400">
                                  ETA {formatTime(stop.estimatedArrival)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active routes */}
                {activeRoutes.length === 0 && plannedRoutes.length === 0 && (
                  <div className="flex flex-col items-center py-20 text-gray-500">
                    <Navigation className="mb-3 h-12 w-12" />
                    <p className="text-lg">No active routes</p>
                    <p className="text-sm">
                      Create a route in the Plan Route tab to get started
                    </p>
                  </div>
                )}

                {activeRoutes.map((route) => (
                  <div
                    key={route.id}
                    className="rounded-lg border border-[#39FF14]/30 bg-gray-800 p-5"
                  >
                    {/* Route header */}
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#39FF14]/20">
                          <Truck className="h-5 w-5 text-[#39FF14]" />
                        </div>
                        <div>
                          <h3 className="font-bold">{route.driverName}</h3>
                          <p className="text-sm text-gray-400">
                            Started {formatTime(route.startTime)} &middot;{' '}
                            {route.totalMiles} mi total
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          handleRouteAction(route.id, 'complete')
                        }
                        disabled={
                          actionLoading === `${route.id}-complete`
                        }
                        className="flex items-center gap-1 rounded bg-red-600 px-3 py-1.5 text-sm hover:bg-red-500 disabled:opacity-50"
                      >
                        <Square className="h-3 w-3" /> End Route
                      </button>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-gray-400">Progress</span>
                        <span className="text-[#39FF14]">
                          {route.completedStops}/{route.totalStops} stops
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-700">
                        <div
                          className="h-full rounded-full bg-[#39FF14] transition-all"
                          style={{
                            width: `${
                              route.totalStops > 0
                                ? (route.completedStops / route.totalStops) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Stops */}
                    <div className="space-y-3">
                      {route.stops.map((stop) => (
                        <div
                          key={stop.id}
                          className={`rounded-lg border p-4 ${
                            stop.status === 'arrived'
                              ? 'border-blue-500 bg-blue-900/20'
                              : stop.status === 'en_route'
                              ? 'border-yellow-500 bg-yellow-900/20'
                              : stop.status === 'completed'
                              ? 'border-[#39FF14]/30 bg-[#39FF14]/5'
                              : stop.status === 'skipped'
                              ? 'border-red-500/30 bg-red-900/10'
                              : 'border-gray-700 bg-gray-700/30'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-gray-600 text-sm font-bold">
                                {stop.order}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {stop.customerName}
                                  </span>
                                  <span
                                    className={`rounded px-2 py-0.5 text-xs font-medium text-white ${STOP_TYPE_COLORS[stop.type]}`}
                                  >
                                    {stop.type}
                                  </span>
                                  <span
                                    className={`text-xs font-medium ${STATUS_COLORS[stop.status]}`}
                                  >
                                    {stop.status.replace('_', ' ')}
                                  </span>
                                </div>
                                <p className="mt-1 flex items-center gap-1 text-sm text-gray-400">
                                  <MapPin className="h-3 w-3" /> {stop.address}
                                </p>
                                <p className="mt-0.5 text-xs text-gray-500">
                                  ETA: {formatTime(stop.estimatedArrival)}
                                  {stop.actualArrival &&
                                    ` | Arrived: ${formatTime(stop.actualArrival)}`}
                                  {stop.departedAt &&
                                    ` | Left: ${formatTime(stop.departedAt)}`}
                                  {stop.duration !== undefined &&
                                    stop.duration > 0 &&
                                    ` | ${stop.duration} min on site`}
                                </p>
                                {stop.notes && (
                                  <p className="mt-1 text-xs text-gray-400 italic">
                                    {stop.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Navigate button */}
                              <button
                                onClick={() => openGoogleMaps(stop.address)}
                                className="rounded bg-gray-600 p-2 text-sm hover:bg-gray-500"
                                title="Navigate"
                              >
                                <Navigation className="h-4 w-4" />
                              </button>

                              {/* Action buttons based on status */}
                              {(stop.status === 'pending' ||
                                stop.status === 'en_route') && (
                                <>
                                  <button
                                    onClick={() =>
                                      handleRouteAction(route.id, 'arrive', {
                                        stopId: stop.id,
                                      })
                                    }
                                    disabled={
                                      actionLoading ===
                                      `${route.id}-arrive`
                                    }
                                    className="rounded bg-blue-600 px-3 py-2 text-sm hover:bg-blue-500 disabled:opacity-50"
                                  >
                                    Arrived
                                  </button>
                                  <button
                                    onClick={() =>
                                      setShowSkipModal({
                                        routeId: route.id,
                                        stopId: stop.id,
                                      })
                                    }
                                    className="rounded bg-gray-600 px-3 py-2 text-sm hover:bg-gray-500"
                                  >
                                    Skip
                                  </button>
                                </>
                              )}

                              {stop.status === 'arrived' && (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={departNotes}
                                    onChange={(e) =>
                                      setDepartNotes(e.target.value)
                                    }
                                    placeholder="Notes..."
                                    className="w-32 rounded bg-gray-700 px-2 py-1.5 text-sm text-white placeholder-gray-500"
                                  />
                                  <button
                                    onClick={() =>
                                      handleRouteAction(route.id, 'depart', {
                                        stopId: stop.id,
                                        notes: departNotes || undefined,
                                      })
                                    }
                                    disabled={
                                      actionLoading ===
                                      `${route.id}-depart`
                                    }
                                    className="rounded bg-[#39FF14] px-3 py-2 text-sm font-medium text-black hover:bg-[#32e612] disabled:opacity-50"
                                  >
                                    Depart
                                  </button>
                                </div>
                              )}

                              {stop.status === 'completed' && (
                                <CheckCircle className="h-5 w-5 text-[#39FF14]" />
                              )}
                              {stop.status === 'skipped' && (
                                <XCircle className="h-5 w-5 text-red-400" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ============================================================= */}
            {/* PLAN ROUTE TAB */}
            {/* ============================================================= */}
            {activeTab === 'planning' && (
              <div className="mx-auto max-w-3xl space-y-6">
                <h2 className="text-lg font-bold">Plan a New Route</h2>

                {/* Route info */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="mb-1 block text-sm text-gray-400">
                      Date
                    </label>
                    <input
                      type="date"
                      value={planDate}
                      onChange={(e) => setPlanDate(e.target.value)}
                      className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-400">
                      Driver ID
                    </label>
                    <input
                      type="text"
                      value={planDriverId}
                      onChange={(e) => setPlanDriverId(e.target.value)}
                      placeholder="e.g. john-smith"
                      className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-400">
                      Driver Name
                    </label>
                    <input
                      type="text"
                      value={planDriverName}
                      onChange={(e) => setPlanDriverName(e.target.value)}
                      placeholder="John Smith"
                      className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white placeholder-gray-500"
                    />
                  </div>
                </div>

                {/* Add stop form */}
                <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                  <h3 className="mb-3 font-medium">Add Stop</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">
                        Customer Name
                      </label>
                      <input
                        type="text"
                        value={newStopCustomer}
                        onChange={(e) => setNewStopCustomer(e.target.value)}
                        placeholder="Customer name"
                        className="w-full rounded bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">
                        Address
                      </label>
                      <input
                        type="text"
                        value={newStopAddress}
                        onChange={(e) => setNewStopAddress(e.target.value)}
                        placeholder="123 Main St, Huntsville, AL"
                        className="w-full rounded bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">
                        Latitude
                      </label>
                      <input
                        type="text"
                        value={newStopLat}
                        onChange={(e) => setNewStopLat(e.target.value)}
                        className="w-full rounded bg-gray-700 px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">
                        Longitude
                      </label>
                      <input
                        type="text"
                        value={newStopLng}
                        onChange={(e) => setNewStopLng(e.target.value)}
                        className="w-full rounded bg-gray-700 px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">
                        Stop Type
                      </label>
                      <select
                        value={newStopType}
                        onChange={(e) =>
                          setNewStopType(e.target.value as RouteStop['type'])
                        }
                        className="w-full rounded bg-gray-700 px-3 py-2 text-sm text-white"
                      >
                        <option value="delivery">Delivery</option>
                        <option value="pickup">Pickup</option>
                        <option value="inspection">Inspection</option>
                        <option value="meeting">Meeting</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={addPlanStop}
                        disabled={!newStopAddress || !newStopCustomer}
                        className="flex items-center gap-1 rounded bg-[#39FF14] px-4 py-2 text-sm font-medium text-black hover:bg-[#32e612] disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" /> Add Stop
                      </button>
                    </div>
                  </div>
                </div>

                {/* Stop list */}
                {planStops.length > 0 && (
                  <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-medium">
                        Stops ({planStops.length})
                      </h3>
                      <button
                        onClick={optimizePlanStops}
                        className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm hover:bg-blue-500"
                      >
                        <Target className="h-3 w-3" /> Optimize Route
                      </button>
                    </div>
                    <div className="space-y-2">
                      {planStops.map((stop, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 rounded bg-gray-700/50 px-3 py-2"
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-600 text-xs font-bold">
                            {idx + 1}
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-medium text-white ${STOP_TYPE_COLORS[stop.type]}`}
                          >
                            {stop.type}
                          </span>
                          <div className="flex-1">
                            <span className="text-sm font-medium">
                              {stop.customerName}
                            </span>
                            <span className="ml-2 text-sm text-gray-400">
                              {stop.address}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => movePlanStop(idx, 'up')}
                              disabled={idx === 0}
                              className="rounded p-1 text-gray-400 hover:bg-gray-600 hover:text-white disabled:opacity-30"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => movePlanStop(idx, 'down')}
                              disabled={idx === planStops.length - 1}
                              className="rounded p-1 text-gray-400 hover:bg-gray-600 hover:text-white disabled:opacity-30"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => removePlanStop(idx)}
                              className="rounded p-1 text-red-400 hover:bg-red-900/30"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Save route */}
                <button
                  onClick={createRoute}
                  disabled={
                    !planDriverId ||
                    !planDriverName ||
                    planStops.length === 0
                  }
                  className="w-full rounded bg-[#39FF14] py-3 text-lg font-bold text-black hover:bg-[#32e612] disabled:opacity-50"
                >
                  Save Route
                </button>
              </div>
            )}

            {/* ============================================================= */}
            {/* HISTORY TAB */}
            {/* ============================================================= */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={historyFilter}
                      onChange={(e) => setHistoryFilter(e.target.value)}
                      placeholder="Filter by driver name or date..."
                      className="w-full rounded bg-gray-800 border border-gray-700 py-2 pl-10 pr-3 text-white placeholder-gray-500"
                    />
                  </div>
                </div>

                {filteredHistory.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-gray-500">
                    <Clock className="mb-3 h-10 w-10" />
                    <p>No route history yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700 text-left text-gray-400">
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Driver</th>
                          <th className="px-3 py-2">Stops</th>
                          <th className="px-3 py-2">Miles</th>
                          <th className="px-3 py-2">Time</th>
                          <th className="px-3 py-2">Completion</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistory.map((route) => (
                          <>
                            <tr
                              key={route.id}
                              className="cursor-pointer border-b border-gray-800 hover:bg-gray-800/50"
                              onClick={() =>
                                setExpandedRoute(
                                  expandedRoute === route.id
                                    ? null
                                    : route.id
                                )
                              }
                            >
                              <td className="px-3 py-3">
                                {formatDate(route.date)}
                              </td>
                              <td className="px-3 py-3 font-medium">
                                {route.driverName}
                              </td>
                              <td className="px-3 py-3">
                                {route.completedStops}/{route.totalStops}
                              </td>
                              <td className="px-3 py-3">
                                {route.totalMiles} mi
                              </td>
                              <td className="px-3 py-3">
                                {route.actualTotalTime
                                  ? `${route.actualTotalTime} min`
                                  : '--'}
                              </td>
                              <td className="px-3 py-3">
                                <span
                                  className={
                                    route.totalStops > 0 &&
                                    route.completedStops / route.totalStops >=
                                      0.9
                                      ? 'text-[#39FF14]'
                                      : route.totalStops > 0 &&
                                        route.completedStops /
                                          route.totalStops >=
                                          0.7
                                      ? 'text-yellow-400'
                                      : 'text-red-400'
                                  }
                                >
                                  {route.totalStops > 0
                                    ? Math.round(
                                        (route.completedStops /
                                          route.totalStops) *
                                          100
                                      )
                                    : 0}
                                  %
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <span
                                  className={`rounded px-2 py-0.5 text-xs ${
                                    route.status === 'completed'
                                      ? 'bg-[#39FF14]/20 text-[#39FF14]'
                                      : 'bg-red-900/30 text-red-400'
                                  }`}
                                >
                                  {route.status}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-gray-400">
                                {expandedRoute === route.id ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </td>
                            </tr>
                            {expandedRoute === route.id && (
                              <tr key={`${route.id}-detail`}>
                                <td colSpan={8} className="bg-gray-800/50 px-6 py-4">
                                  <div className="space-y-2">
                                    {route.stops.map((stop) => (
                                      <div
                                        key={stop.id}
                                        className="flex items-center gap-3 text-sm"
                                      >
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-600 text-xs">
                                          {stop.order}
                                        </span>
                                        <span
                                          className={`rounded px-1.5 py-0.5 text-xs text-white ${STOP_TYPE_COLORS[stop.type]}`}
                                        >
                                          {stop.type}
                                        </span>
                                        <span className="font-medium">
                                          {stop.customerName}
                                        </span>
                                        <span className="text-gray-400">
                                          {stop.address}
                                        </span>
                                        <span
                                          className={`ml-auto text-xs ${STATUS_COLORS[stop.status]}`}
                                        >
                                          {stop.status}
                                        </span>
                                        {stop.duration !== undefined &&
                                          stop.duration > 0 && (
                                            <span className="text-xs text-gray-500">
                                              {stop.duration} min
                                            </span>
                                          )}
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================= */}
            {/* DRIVER STATS TAB */}
            {/* ============================================================= */}
            {activeTab === 'stats' && (
              <div className="space-y-6">
                {/* Summary cards */}
                {analytics && (
                  <>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                        <p className="text-sm text-gray-400">Total Routes</p>
                        <p className="mt-1 text-2xl font-bold">
                          {analytics.totalRoutes}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                        <p className="text-sm text-gray-400">
                          Avg Stops/Route
                        </p>
                        <p className="mt-1 text-2xl font-bold">
                          {analytics.avgStopsPerRoute}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                        <p className="text-sm text-gray-400">
                          Avg Miles/Route
                        </p>
                        <p className="mt-1 text-2xl font-bold">
                          {analytics.avgMilesPerRoute}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                        <p className="text-sm text-gray-400">
                          Completion Rate
                        </p>
                        <p className="mt-1 text-2xl font-bold text-[#39FF14]">
                          {analytics.completionRate}%
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                        <p className="text-sm text-gray-400">
                          Avg Time/Stop
                        </p>
                        <p className="mt-1 text-2xl font-bold">
                          {analytics.avgTimePerStop} min
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                        <p className="text-sm text-gray-400">On-Time Rate</p>
                        <p className="mt-1 text-2xl font-bold">
                          {analytics.onTimeRate}%
                        </p>
                      </div>
                    </div>

                    {/* Per-driver breakdown */}
                    {analytics.byDriver.length > 0 && (
                      <div>
                        <h3 className="mb-3 text-lg font-semibold">
                          Driver Performance
                        </h3>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {analytics.byDriver.map((driver) => (
                            <div
                              key={driver.driverSlug}
                              className="rounded-lg border border-gray-700 bg-gray-800 p-4"
                            >
                              <div className="mb-3 flex items-center gap-2">
                                <Users className="h-4 w-4 text-[#39FF14]" />
                                <span className="font-medium">
                                  {driver.name}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                                <div>
                                  <p className="text-gray-400">Routes</p>
                                  <p className="font-bold">{driver.routes}</p>
                                </div>
                                <div>
                                  <p className="text-gray-400">Avg Mi</p>
                                  <p className="font-bold">
                                    {driver.avgMiles}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-400">On-Time</p>
                                  <p
                                    className={`font-bold ${
                                      driver.onTimeRate >= 90
                                        ? 'text-[#39FF14]'
                                        : driver.onTimeRate >= 70
                                        ? 'text-yellow-400'
                                        : 'text-red-400'
                                    }`}
                                  >
                                    {driver.onTimeRate}%
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {analytics.totalRoutes === 0 && (
                      <div className="flex flex-col items-center py-16 text-gray-500">
                        <Target className="mb-3 h-10 w-10" />
                        <p>No completed routes yet</p>
                        <p className="text-sm">
                          Stats will appear once routes are completed
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Skip modal */}
      {showSkipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg bg-gray-800 p-6">
            <h3 className="mb-3 text-lg font-bold">Skip Stop</h3>
            <p className="mb-3 text-sm text-gray-400">
              Please provide a reason for skipping this stop.
            </p>
            <textarea
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              placeholder="Reason for skipping..."
              className="mb-4 w-full rounded bg-gray-700 px-3 py-2 text-white placeholder-gray-500"
              rows={3}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSkipModal(null);
                  setSkipReason('');
                }}
                className="rounded bg-gray-700 px-4 py-2 text-sm hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (skipReason.trim()) {
                    handleRouteAction(showSkipModal.routeId, 'skip', {
                      stopId: showSkipModal.stopId,
                      reason: skipReason,
                    });
                    setShowSkipModal(null);
                    setSkipReason('');
                  }
                }}
                disabled={!skipReason.trim()}
                className="rounded bg-red-600 px-4 py-2 text-sm hover:bg-red-500 disabled:opacity-50"
              >
                Skip Stop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
