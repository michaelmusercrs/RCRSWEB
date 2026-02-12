'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Truck, MapPin, Clock, Package, CheckCircle2, AlertCircle,
  RefreshCw, Navigation, Route, Play, GripVertical, Trash2, Plus,
  ExternalLink, RotateCcw, Target, Flag, Zap, ArrowUpDown
} from 'lucide-react';
import DeliveryMap, { MapDelivery } from '@/components/delivery/DeliveryMap';
import { MultiStopNavigateButton } from '@/components/delivery/NavigateButton';

interface Driver {
  id: string;
  name: string;
  vehicle: string;
  phone: string;
}

interface DeliveryTicket {
  ticketId: string;
  ticketType: string;
  status: string;
  jobName: string;
  jobAddress: string;
  city: string;
  state: string;
  zip: string;
  customerName: string;
  customerPhone: string;
  materials: Array<{
    productName: string;
    quantity: number;
    unit: string;
  }>;
  priority: 'normal' | 'rush' | 'urgent';
  scheduledDate?: string;
  scheduledTime?: string;
  specialInstructions?: string;
}

interface RouteStop {
  order: number;
  ticket: DeliveryTicket;
  estimatedArrival?: string;
  distanceFromPrevious?: number;
  durationFromPrevious?: number;
}

interface OptimizedRoute {
  stops: RouteStop[];
  totalDistance: number;
  totalDuration: number;
  estimatedEndTime: string;
}

// Warehouse location
const WAREHOUSE = {
  address: '2710 Memorial Pkwy SW',
  city: 'Huntsville',
  state: 'AL',
  zip: '35801',
};

// City coordinates for distance estimation
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'Huntsville': { lat: 34.7304, lng: -86.5861 },
  'Madison': { lat: 34.6993, lng: -86.7483 },
  'Decatur': { lat: 34.6059, lng: -86.9833 },
  'Athens': { lat: 34.8025, lng: -86.9717 },
  'Harvest': { lat: 34.8537, lng: -86.7517 },
  'Hazel Green': { lat: 34.9320, lng: -86.5722 },
  'Florence': { lat: 34.7998, lng: -87.6772 },
};

// Simple distance calculation (Haversine)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Get city coords or default to Huntsville
function getCityCoords(city: string): { lat: number; lng: number } {
  return CITY_COORDS[city] || CITY_COORDS['Huntsville'];
}

export default function RoutePlanningPage() {
  const router = useRouter();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [tickets, setTickets] = useState<DeliveryTicket[]>([]);
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    const storedDriver = sessionStorage.getItem('driver');
    if (!storedDriver) {
      router.push('/portal');
      return;
    }
    const driverData = JSON.parse(storedDriver);
    setDriver(driverData);
    loadTickets(driverData.id);
  }, [router]);

  const loadTickets = async (driverId: string) => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const response = await fetch(`/api/portal/tickets?driverId=${driverId}&date=${today}`);
      const data = await response.json();
      const allTickets = Array.isArray(data) ? data : [];

      // Filter to only pending/active tickets
      const pendingTickets = allTickets.filter((t: DeliveryTicket) =>
        !['delivered', 'proof_captured', 'qc_photos', 'completed', 'cancelled'].includes(t.status)
      );

      setTickets(pendingTickets);

      // Initialize route with current order
      const initialStops: RouteStop[] = pendingTickets.map((ticket: DeliveryTicket, idx: number) => ({
        order: idx + 1,
        ticket,
      }));
      setRouteStops(initialStops);

      // Calculate initial metrics
      if (initialStops.length > 0) {
        calculateRouteMetrics(initialStops);
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateRouteMetrics = (stops: RouteStop[]): RouteStop[] => {
    if (stops.length === 0) return stops;

    let totalDistance = 0;
    let totalDuration = 0;
    const startTime = new Date();
    startTime.setMinutes(startTime.getMinutes() + 15); // Start in 15 min

    const warehouseCoords = CITY_COORDS['Huntsville'];
    let prevCoords = warehouseCoords;

    const updatedStops = stops.map((stop, idx) => {
      const cityCoords = getCityCoords(stop.ticket.city);
      const distance = calculateDistance(prevCoords.lat, prevCoords.lng, cityCoords.lat, cityCoords.lng);
      const duration = Math.round((distance / 30) * 60); // Assume 30 mph average
      const stopTime = 15 + (stop.ticket.materials?.length || 0) * 2; // Time at stop

      totalDistance += distance;
      totalDuration += duration + stopTime;

      const arrivalTime = new Date(startTime.getTime() + totalDuration * 60000);

      prevCoords = cityCoords;

      return {
        ...stop,
        order: idx + 1,
        estimatedArrival: arrivalTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        distanceFromPrevious: Math.round(distance * 10) / 10,
        durationFromPrevious: duration,
      };
    });

    return updatedStops;
  };

  const optimizeRoute = () => {
    setIsOptimizing(true);

    // Simple nearest neighbor optimization
    setTimeout(() => {
      const warehouseCoords = CITY_COORDS['Huntsville'];
      const remaining = [...routeStops];
      const optimized: RouteStop[] = [];

      // First, add urgent stops
      const urgent = remaining.filter(s => s.ticket.priority === 'urgent');
      const rush = remaining.filter(s => s.ticket.priority === 'rush');
      const normal = remaining.filter(s => s.ticket.priority === 'normal');

      // Sort urgent and rush by distance from warehouse
      const sortByDistance = (stops: RouteStop[], fromCoords: { lat: number; lng: number }) => {
        return stops.sort((a, b) => {
          const coordsA = getCityCoords(a.ticket.city);
          const coordsB = getCityCoords(b.ticket.city);
          const distA = calculateDistance(fromCoords.lat, fromCoords.lng, coordsA.lat, coordsA.lng);
          const distB = calculateDistance(fromCoords.lat, fromCoords.lng, coordsB.lat, coordsB.lng);
          return distA - distB;
        });
      };

      // Add urgent first
      let currentCoords = warehouseCoords;
      sortByDistance(urgent, currentCoords).forEach(stop => {
        optimized.push(stop);
        currentCoords = getCityCoords(stop.ticket.city);
      });

      // Then rush
      sortByDistance(rush, currentCoords).forEach(stop => {
        optimized.push(stop);
        currentCoords = getCityCoords(stop.ticket.city);
      });

      // Then normal using nearest neighbor
      const normalRemaining = [...normal];
      while (normalRemaining.length > 0) {
        let nearestIdx = 0;
        let nearestDist = Infinity;

        normalRemaining.forEach((stop, idx) => {
          const coords = getCityCoords(stop.ticket.city);
          const dist = calculateDistance(currentCoords.lat, currentCoords.lng, coords.lat, coords.lng);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestIdx = idx;
          }
        });

        const nearest = normalRemaining.splice(nearestIdx, 1)[0];
        optimized.push(nearest);
        currentCoords = getCityCoords(nearest.ticket.city);
      }

      const withMetrics = calculateRouteMetrics(optimized);
      setRouteStops(withMetrics);
      setIsOptimizing(false);
    }, 500);
  };

  const moveStop = (fromIndex: number, toIndex: number) => {
    const newStops = [...routeStops];
    const [removed] = newStops.splice(fromIndex, 1);
    newStops.splice(toIndex, 0, removed);
    const withMetrics = calculateRouteMetrics(newStops);
    setRouteStops(withMetrics);
  };

  const removeStop = (index: number) => {
    const newStops = routeStops.filter((_, idx) => idx !== index);
    const withMetrics = calculateRouteMetrics(newStops);
    setRouteStops(withMetrics);
  };

  const resetRoute = () => {
    const initialStops: RouteStop[] = tickets.map((ticket, idx) => ({
      order: idx + 1,
      ticket,
    }));
    const withMetrics = calculateRouteMetrics(initialStops);
    setRouteStops(withMetrics);
  };

  // Convert to map deliveries
  const mapDeliveries: MapDelivery[] = routeStops.map(stop => ({
    id: stop.ticket.ticketId,
    jobName: stop.ticket.jobName,
    address: stop.ticket.jobAddress,
    city: stop.ticket.city,
    state: stop.ticket.state,
    zip: stop.ticket.zip,
    status: 'pending' as const,
    priority: stop.ticket.priority,
    scheduledTime: stop.estimatedArrival,
    customerName: stop.ticket.customerName,
    itemCount: stop.ticket.materials?.length || 0,
  }));

  // Calculate totals
  const totalDistance = routeStops.reduce((sum, stop) => sum + (stop.distanceFromPrevious || 0), 0);
  const totalDuration = routeStops.reduce((sum, stop) => sum + (stop.durationFromPrevious || 0) + 15, 0);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      moveStop(draggedIndex, index);
      setDraggedIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  if (!driver) return null;

  return (
    <div className="min-h-screen bg-neutral-900">
      {/* Header */}
      <div className="bg-brand-green sticky top-0 z-20">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/portal/delivery')}
                className="p-2 hover:bg-black/10 rounded-lg"
              >
                <ArrowLeft size={20} className="text-black" />
              </button>
              <div>
                <h1 className="font-bold text-black">Route Planning</h1>
                <p className="text-sm text-black/70">{routeStops.length} stops</p>
              </div>
            </div>
            <button
              onClick={() => driver && loadTickets(driver.id)}
              disabled={isLoading}
              className="p-2 hover:bg-black/10 rounded-lg"
            >
              <RefreshCw size={20} className={`text-black ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="bg-black/10 px-4 py-3 flex items-center gap-4 overflow-x-auto">
          <div className="flex items-center gap-2 text-black">
            <Route size={18} />
            <span className="font-bold">{Math.round(totalDistance * 10) / 10}</span>
            <span className="text-black/70 text-sm">miles</span>
          </div>
          <div className="w-px h-6 bg-black/20" />
          <div className="flex items-center gap-2 text-black">
            <Clock size={18} />
            <span className="font-bold">{Math.floor(totalDuration / 60)}h {totalDuration % 60}m</span>
            <span className="text-black/70 text-sm">est.</span>
          </div>
          <div className="w-px h-6 bg-black/20" />
          <div className="flex items-center gap-2 text-black">
            <Flag size={18} />
            <span className="font-bold">{routeStops[routeStops.length - 1]?.estimatedArrival || '--:--'}</span>
            <span className="text-black/70 text-sm">ETA last</span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="p-4">
        <DeliveryMap
          deliveries={mapDeliveries}
          height="200px"
          showWarehouse={true}
        />
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex gap-3">
        <button
          onClick={optimizeRoute}
          disabled={isOptimizing || routeStops.length < 2}
          className="flex-1 bg-brand-green hover:bg-brand-green disabled:bg-neutral-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
        >
          {isOptimizing ? (
            <RefreshCw size={20} className="animate-spin" />
          ) : (
            <Zap size={20} />
          )}
          Optimize Route
        </button>
        <button
          onClick={resetRoute}
          className="px-4 bg-neutral-700 hover:bg-neutral-600 text-white rounded-xl flex items-center justify-center"
        >
          <RotateCcw size={20} />
        </button>
      </div>

      {/* Route List */}
      <div className="px-4 pb-32">
        {isLoading ? (
          <div className="text-center py-12">
            <RefreshCw className="animate-spin mx-auto text-brand-green" size={32} />
            <p className="text-neutral-400 mt-2">Loading deliveries...</p>
          </div>
        ) : routeStops.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="mx-auto text-neutral-600" size={48} />
            <p className="text-neutral-400 mt-2">No pending deliveries to route</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Start - Warehouse */}
            <div className="bg-neutral-800 border border-brand-green/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-green rounded-full flex items-center justify-center">
                  <Target size={20} className="text-black" />
                </div>
                <div>
                  <p className="text-white font-semibold">Start: Warehouse</p>
                  <p className="text-neutral-400 text-sm">{WAREHOUSE.address}, {WAREHOUSE.city}</p>
                </div>
              </div>
            </div>

            {/* Stops */}
            {routeStops.map((stop, index) => (
              <div
                key={stop.ticket.ticketId}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`bg-neutral-800 border rounded-xl overflow-hidden ${
                  draggedIndex === index
                    ? 'border-brand-green opacity-50'
                    : stop.ticket.priority === 'urgent'
                    ? 'border-red-500/50'
                    : stop.ticket.priority === 'rush'
                    ? 'border-orange-500/50'
                    : 'border-neutral-700'
                }`}
              >
                {/* Priority banner */}
                {stop.ticket.priority !== 'normal' && (
                  <div className={`px-4 py-1 text-xs font-semibold ${
                    stop.ticket.priority === 'urgent'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-orange-500/20 text-orange-400'
                  }`}>
                    {stop.ticket.priority === 'urgent' ? 'URGENT' : 'RUSH'}
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Drag handle + Order number */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="cursor-grab active:cursor-grabbing text-neutral-500 hover:text-white">
                        <GripVertical size={20} />
                      </div>
                      <div className="w-8 h-8 bg-brand-green/20 text-brand-green rounded-full flex items-center justify-center font-bold text-sm">
                        {stop.order}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-white truncate">{stop.ticket.jobName}</h3>
                          <p className="text-sm text-neutral-400">{stop.ticket.customerName}</p>
                        </div>
                        <button
                          onClick={() => removeStop(index)}
                          className="p-1 text-neutral-500 hover:text-red-400"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mt-2 text-sm text-neutral-400">
                        <MapPin size={14} />
                        <span className="truncate">{stop.ticket.jobAddress}, {stop.ticket.city}</span>
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-sm">
                        {stop.estimatedArrival && (
                          <div className="flex items-center gap-1 text-brand-green">
                            <Clock size={14} />
                            <span>ETA {stop.estimatedArrival}</span>
                          </div>
                        )}
                        {stop.distanceFromPrevious && (
                          <div className="flex items-center gap-1 text-neutral-500">
                            <Route size={14} />
                            <span>{stop.distanceFromPrevious} mi</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-neutral-500">
                          <Package size={14} />
                          <span>{stop.ticket.materials?.length || 0} items</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* End - Return to Warehouse */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neutral-700 rounded-full flex items-center justify-center">
                  <Flag size={20} className="text-neutral-400" />
                </div>
                <div>
                  <p className="text-white font-semibold">End: Return to Warehouse</p>
                  <p className="text-neutral-400 text-sm">{WAREHOUSE.address}, {WAREHOUSE.city}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-neutral-800 border-t border-neutral-700 p-4 safe-area-pb">
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/portal/delivery')}
            className="px-4 py-3 bg-neutral-700 hover:bg-neutral-600 rounded-xl text-white font-semibold"
          >
            Cancel
          </button>
          <div className="flex-1">
            {routeStops.length > 0 ? (
              <MultiStopNavigateButton
                stops={routeStops.map(s => ({
                  address: s.ticket.jobAddress,
                  city: s.ticket.city,
                  state: s.ticket.state,
                  zip: s.ticket.zip,
                }))}
                origin={WAREHOUSE}
                returnToOrigin={true}
                size="lg"
                fullWidth
                label="Start Route"
              />
            ) : (
              <button
                disabled
                className="w-full py-3 bg-neutral-700 text-neutral-500 rounded-xl font-semibold"
              >
                No Stops to Navigate
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
