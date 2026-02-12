'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Truck, MapPin, Clock, CheckCircle2, AlertTriangle,
  RefreshCw, ChevronRight, Package, User, Timer,
  ArrowRight, AlertCircle, Route as RouteIcon
} from 'lucide-react';

interface DriverRoute {
  routeId: string;
  driverId: string;
  driverName: string;
  vehicle: string;
  status: string;
  totalStops: number;
  completedStops: number;
  stops: Array<{
    orderId: string;
    jobName: string;
    customerName: string;
    address: string;
    city: string;
    status: string;
    priority: string;
    scheduledTime?: string;
  }>;
}

interface DeliveryWidgetData {
  totalToday: number;
  completed: number;
  inProgress: number;
  pending: number;
  routes: DriverRoute[];
  nextDelivery: {
    ticketId: string;
    jobName: string;
    customerName: string;
    address: string;
    driverName: string;
    scheduledTime: string;
    priority: string;
  } | null;
  alerts: Array<{
    type: 'late' | 'urgent' | 'issue';
    message: string;
    ticketId?: string;
  }>;
}

export default function DeliveryWidget() {
  const [data, setData] = useState<DeliveryWidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const today = new Date().toISOString().slice(0, 10);
      const response = await fetch(`/api/portal/delivery?date=${today}`);

      if (!response.ok) throw new Error('Failed to fetch');

      const result = await response.json();
      const routes: DriverRoute[] = Array.isArray(result.routes) ? result.routes : [];

      // Calculate stats
      let totalToday = 0;
      let completed = 0;
      let inProgress = 0;
      let nextDelivery: DeliveryWidgetData['nextDelivery'] = null;
      const alerts: DeliveryWidgetData['alerts'] = [];

      for (const route of routes) {
        totalToday += route.totalStops;
        completed += route.completedStops;
        inProgress += route.stops.filter(s =>
          ['in_progress', 'arrived'].includes(s.status)
        ).length;

        // Find next upcoming delivery
        for (const stop of route.stops) {
          if (stop.status === 'pending' && !nextDelivery) {
            nextDelivery = {
              ticketId: stop.orderId,
              jobName: stop.jobName,
              customerName: stop.customerName,
              address: `${stop.address}, ${stop.city}`,
              driverName: route.driverName,
              scheduledTime: stop.scheduledTime || 'TBD',
              priority: stop.priority,
            };
          }

          // Check for urgent deliveries still pending
          if (stop.priority === 'urgent' && stop.status === 'pending') {
            alerts.push({
              type: 'urgent',
              message: `URGENT delivery pending: ${stop.jobName}`,
              ticketId: stop.orderId,
            });
          }
        }
      }

      const pending = totalToday - completed - inProgress;

      setData({
        totalToday,
        completed,
        inProgress,
        pending,
        routes,
        nextDelivery,
        alerts,
      });
    } catch (err) {
      console.error('DeliveryWidget fetch error:', err);
      setError('Failed to load delivery data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 2 minutes
    const interval = setInterval(fetchData, 120000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Truck className="text-lime-400" size={20} />
            Deliveries
          </h3>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-zinc-800 rounded-lg h-16" />
            ))}
          </div>
          <div className="bg-zinc-800 rounded-lg h-24" />
          <div className="bg-zinc-800 rounded-lg h-20" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Truck className="text-lime-400" size={20} />
            Deliveries
          </h3>
          <button onClick={fetchData} className="p-1.5 hover:bg-zinc-800 rounded-lg">
            <RefreshCw size={16} className="text-zinc-400" />
          </button>
        </div>
        <div className="text-center py-6">
          <AlertCircle className="mx-auto text-zinc-600 mb-2" size={32} />
          <p className="text-zinc-400 text-sm">{error || 'No data available'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Truck className="text-lime-400" size={20} />
          Today's Deliveries
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <RefreshCw size={16} className="text-zinc-400" />
          </button>
          <Link
            href="/portal/delivery"
            className="flex items-center gap-1 text-sm text-lime-400 hover:text-lime-300"
          >
            View All
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-zinc-800 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-white">{data.totalToday}</p>
          <p className="text-xs text-zinc-500">Total</p>
        </div>
        <div className="bg-zinc-800 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-400">{data.inProgress}</p>
          <p className="text-xs text-zinc-500">Active</p>
        </div>
        <div className="bg-zinc-800 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-400">{data.completed}</p>
          <p className="text-xs text-zinc-500">Done</p>
        </div>
        <div className="bg-zinc-800 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-orange-400">{data.pending}</p>
          <p className="text-xs text-zinc-500">Pending</p>
        </div>
      </div>

      {/* Progress Bar */}
      {data.totalToday > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
            <span>Progress</span>
            <span>{data.totalToday > 0 ? Math.round((data.completed / data.totalToday) * 100) : 0}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2">
            <div
              className="bg-lime-500 h-2 rounded-full transition-all"
              style={{ width: `${data.totalToday > 0 ? (data.completed / data.totalToday) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="mb-5 space-y-2">
          {data.alerts.slice(0, 3).map((alert, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                alert.type === 'urgent'
                  ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                  : alert.type === 'late'
                  ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
                  : 'bg-orange-500/10 border border-orange-500/30 text-orange-400'
              }`}
            >
              <AlertTriangle size={14} className="flex-shrink-0" />
              <span className="truncate">{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Active Drivers */}
      {data.routes.length > 0 ? (
        <div className="mb-5">
          <h4 className="text-sm font-medium text-zinc-400 mb-3">Active Drivers</h4>
          <div className="space-y-2">
            {data.routes.map(route => {
              const activeStop = route.stops.find(s =>
                ['in_progress', 'arrived'].includes(s.status)
              );

              return (
                <div
                  key={route.routeId}
                  className="bg-zinc-800/50 border border-zinc-800 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        route.status === 'in_progress' ? 'bg-lime-500 animate-pulse' :
                        route.status === 'completed' ? 'bg-green-500' :
                        'bg-zinc-600'
                      }`} />
                      <span className="text-white font-medium text-sm">{route.driverName}</span>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {route.completedStops}/{route.totalStops} stops
                    </span>
                  </div>

                  {/* Mini progress bar */}
                  <div className="w-full bg-zinc-700 rounded-full h-1.5 mb-2">
                    <div
                      className="bg-lime-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${route.totalStops > 0 ? (route.completedStops / route.totalStops) * 100 : 0}%` }}
                    />
                  </div>

                  {activeStop && (
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <MapPin size={12} />
                      <span className="truncate">
                        {activeStop.status === 'arrived' ? 'At: ' : 'Heading to: '}
                        {activeStop.jobName} - {activeStop.address}
                      </span>
                    </div>
                  )}

                  {!activeStop && route.status === 'planned' && (
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <Clock size={12} />
                      <span>Not yet started</span>
                    </div>
                  )}

                  {!activeStop && route.status === 'completed' && (
                    <div className="flex items-center gap-2 text-xs text-green-400">
                      <CheckCircle2 size={12} />
                      <span>Route complete</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-6 mb-5">
          <Truck className="mx-auto text-zinc-700 mb-2" size={32} />
          <p className="text-zinc-500 text-sm">No deliveries scheduled for today</p>
        </div>
      )}

      {/* Next Upcoming Delivery */}
      {data.nextDelivery && (
        <div>
          <h4 className="text-sm font-medium text-zinc-400 mb-3">Next Up</h4>
          <Link
            href="/portal/delivery"
            className="block bg-zinc-800/50 border border-zinc-800 rounded-lg p-3 hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-white font-medium text-sm">{data.nextDelivery.jobName}</p>
                <p className="text-zinc-500 text-xs">{data.nextDelivery.customerName}</p>
              </div>
              {data.nextDelivery.priority !== 'normal' && (
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  data.nextDelivery.priority === 'urgent'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-orange-500/20 text-orange-400'
                }`}>
                  {data.nextDelivery.priority.toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                {data.nextDelivery.address}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {data.nextDelivery.scheduledTime}
              </span>
              <span className="flex items-center gap-1">
                <User size={12} />
                {data.nextDelivery.driverName}
              </span>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
