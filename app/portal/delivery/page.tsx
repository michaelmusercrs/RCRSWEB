'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Truck,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  Navigation,
  Package,
  Phone,
  Calendar,
  Filter,
  Search,
  RefreshCw,
  ChevronRight,
  Route,
  Play,
  Pause,
  Check,
  Camera,
  FileSignature,
  User,
  Plus,
  UserPlus
} from 'lucide-react';

interface DeliveryStop {
  orderId: string;
  jobName: string;
  customerName: string;
  customerPhone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  scheduledTime?: string;
  estimatedArrival?: string;
  priority: 'normal' | 'rush' | 'urgent';
  status: 'pending' | 'in_progress' | 'arrived' | 'delivered' | 'skipped';
  itemCount: number;
  specialInstructions?: string;
  inspectorRequired: boolean;
  inspectorName?: string;
  inspectorArrivalTime?: string;
}

interface DailyRoute {
  routeId: string;
  date: string;
  driverId: string;
  driverName: string;
  vehicle: string;
  status: 'planned' | 'in_progress' | 'completed';
  stops: DeliveryStop[];
  totalStops: number;
  completedStops: number;
  totalDistance?: number;
  estimatedDuration?: number;
}

interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  vehicle: string;
  licensePlate: string;
  status: string;
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
  materials: Array<{ productName: string; quantity: number; unit: string }>;
  priority: 'normal' | 'rush' | 'urgent';
  scheduledDate?: string;
  scheduledTime?: string;
  specialInstructions?: string;
  assignedDriver?: string;
  assignedDriverName?: string;
  assignedVehicle?: string;
  requestedDate?: string;
}

export default function DeliveryManagementPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [routes, setRoutes] = useState<DailyRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<DailyRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [unassignedTickets, setUnassignedTickets] = useState<DeliveryTicket[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningTicket, setAssigningTicket] = useState<DeliveryTicket | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [assignDate, setAssignDate] = useState(selectedDate);
  const [assignTime, setAssignTime] = useState('08:00');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRoutes();
  }, [selectedDate]);

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      const response = await fetch('/api/portal/drivers');
      if (response.ok) {
        const data = await response.json();
        setDrivers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching drivers:', err);
    }
  };

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch routes from the delivery API (which groups tickets by driver)
      const response = await fetch(`/api/portal/delivery?date=${selectedDate}`);
      if (!response.ok) {
        throw new Error('Failed to fetch delivery routes');
      }
      const data = await response.json();
      const loadedRoutes: DailyRoute[] = Array.isArray(data.routes) ? data.routes : [];

      setRoutes(loadedRoutes);
      if (loadedRoutes.length > 0 && !selectedRoute) {
        setSelectedRoute(loadedRoutes[0]);
      } else if (loadedRoutes.length > 0 && selectedRoute) {
        // Update selected route if it still exists
        const updated = loadedRoutes.find(r => r.routeId === selectedRoute.routeId);
        setSelectedRoute(updated || loadedRoutes[0]);
      } else {
        setSelectedRoute(null);
      }

      // Also fetch unassigned tickets (created but no driver)
      const ticketsRes = await fetch(`/api/portal/tickets?status=created`);
      if (ticketsRes.ok) {
        const ticketsData = await ticketsRes.json();
        setUnassignedTickets(Array.isArray(ticketsData) ? ticketsData : []);
      }
    } catch (err) {
      console.error('Error fetching routes:', err);
      setError('Failed to load delivery data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedRoute]);

  const handleAssignDriver = async () => {
    if (!assigningTicket || !selectedDriver) return;

    const driver = drivers.find(d => d.id === selectedDriver);
    if (!driver) return;

    try {
      const response = await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign-driver',
          ticketId: assigningTicket.ticketId,
          driverId: driver.id,
          driverName: driver.name,
          vehicle: driver.vehicle,
          scheduledDate: assignDate,
          scheduledTime: assignTime,
        }),
      });

      if (response.ok) {
        setShowAssignModal(false);
        setAssigningTicket(null);
        setSelectedDriver('');
        fetchRoutes();
      }
    } catch (err) {
      console.error('Error assigning driver:', err);
    }
  };

  const handleStartRoute = async (routeId: string) => {
    try {
      await fetch('/api/portal/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_route', routeId }),
      });
      fetchRoutes();
    } catch (err) {
      console.error('Error starting route:', err);
    }
  };

  const handleStartDelivery = async (ticketId: string) => {
    try {
      await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-delivery', ticketId }),
      });
      fetchRoutes();
    } catch (err) {
      console.error('Error starting delivery:', err);
    }
  };

  const handleCompleteDelivery = async (ticketId: string) => {
    try {
      await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete-delivery', ticketId }),
      });
      fetchRoutes();
    } catch (err) {
      console.error('Error completing delivery:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      case 'in_progress':
        return 'bg-brand-green/20 text-blue-400';
      case 'arrived':
        return 'bg-purple-500/20 text-purple-400';
      case 'pending':
      case 'planned':
        return 'bg-white/10 text-neutral-300';
      case 'skipped':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-white/10 text-neutral-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500/20 text-red-400 border-red-500/20';
      case 'rush':
        return 'bg-orange-500/20 text-orange-400 border-orange-200';
      default:
        return 'bg-white/5 border-white/10';
    }
  };

  const getGoogleMapsRouteUrl = (route: DailyRoute) => {
    const addresses = route.stops.map(s =>
      encodeURIComponent(`${s.address}, ${s.city}, ${s.state} ${s.zip}`)
    );
    return `https://www.google.com/maps/dir/${addresses.join('/')}`;
  };

  const getGoogleMapsUrl = (stop: DeliveryStop) => {
    const address = encodeURIComponent(`${stop.address}, ${stop.city}, ${stop.state} ${stop.zip}`);
    return `https://www.google.com/maps/dir/?api=1&destination=${address}`;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const filteredRoutes = statusFilter === 'all'
    ? routes
    : routes.filter(r => r.status === statusFilter);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-brand-green/10 border border-blue-500/20 flex items-center justify-center">
              <Truck className="text-blue-400" size={32} />
            </div>
            <div className="absolute inset-0 rounded-2xl border-2 border-blue-500/30 animate-ping opacity-50" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-neutral-900">Loading Deliveries</h2>
            <p className="text-sm text-neutral-500 mt-1">Fetching routes and stops...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/portal/dashboard" className="text-neutral-500 hover:text-neutral-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-neutral-900">Delivery Management</h1>
              <p className="text-sm text-neutral-500">Manage routes and track deliveries</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-neutral-100 rounded-lg p-1">
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  view === 'list' ? 'bg-white shadow' : ''
                }`}
              >
                List
              </button>
              <button
                onClick={() => setView('map')}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  view === 'map' ? 'bg-white shadow' : ''
                }`}
              >
                Map
              </button>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Routes</option>
              <option value="planned">Planned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
            />

            <button
              onClick={fetchRoutes}
              className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Quick Links Bar */}
      <div className="bg-neutral-50 border-b border-neutral-200 px-6 py-2">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-neutral-400 text-xs font-medium uppercase tracking-wide">Tools:</span>
          <Link
            href="/portal/delivery/job-breakdowns"
            className="flex items-center gap-1 text-neutral-500 hover:text-green-400 transition-colors"
          >
            <FileSignature className="w-3.5 h-3.5" />
            Job Breakdowns
          </Link>
          <span className="text-neutral-300">|</span>
          <Link
            href="/portal/delivery/invoices"
            className="flex items-center gap-1 text-neutral-500 hover:text-green-400 transition-colors"
          >
            <FileSignature className="w-3.5 h-3.5" />
            Invoices
          </Link>
          <span className="text-neutral-300">|</span>
          <Link
            href="/portal/inventory/reconciliation"
            className="flex items-center gap-1 text-neutral-500 hover:text-green-400 transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Reconciliation
          </Link>
          <span className="text-neutral-300">|</span>
          <Link
            href="/portal/inventory"
            className="flex items-center gap-1 text-neutral-500 hover:text-green-400 transition-colors"
          >
            <Package className="w-3.5 h-3.5" />
            Inventory
          </Link>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-500/20 px-6 py-3">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-400">
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-neutral-900">
              {routes.length}
            </div>
            <div className="text-sm text-neutral-500">Active Routes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-neutral-900">
              {routes.reduce((sum, r) => sum + r.totalStops, 0)}
            </div>
            <div className="text-sm text-neutral-500">Total Stops</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {routes.reduce((sum, r) => sum + r.completedStops, 0)}
            </div>
            <div className="text-sm text-neutral-500">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">
              {routes.reduce((sum, r) => sum + (r.totalStops - r.completedStops), 0)}
            </div>
            <div className="text-sm text-neutral-500">Remaining</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">
              {unassignedTickets.length}
            </div>
            <div className="text-sm text-neutral-500">Unassigned</div>
          </div>
        </div>
      </div>

      {/* Unassigned Tickets Banner */}
      {unassignedTickets.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">
                {unassignedTickets.length} ticket{unassignedTickets.length > 1 ? 's' : ''} waiting for driver assignment
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {unassignedTickets.slice(0, 3).map(ticket => (
                <button
                  key={ticket.ticketId}
                  onClick={() => {
                    setAssigningTicket(ticket);
                    setShowAssignModal(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 text-sm"
                >
                  <UserPlus className="w-3 h-3" />
                  {ticket.jobName || ticket.ticketId}
                </button>
              ))}
              {unassignedTickets.length > 3 && (
                <span className="text-sm text-amber-600 self-center">
                  +{unassignedTickets.length - 3} more
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row">
        {/* Route List Sidebar */}
        <div className="w-full md:w-80 bg-white border-r border-neutral-200 md:min-h-[calc(100vh-280px)]">
          <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
            <h2 className="font-semibold text-neutral-900">Routes ({filteredRoutes.length})</h2>
            <Link
              href="/portal/delivery/route"
              className="flex items-center gap-1 text-sm text-green-400 hover:text-green-400"
            >
              <Route className="w-4 h-4" />
              Plan Route
            </Link>
          </div>

          {filteredRoutes.length === 0 ? (
            <div className="p-8 text-center">
              <Truck className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
              <p className="text-neutral-500 text-sm">No routes for this date</p>
              <p className="text-neutral-400 text-xs mt-1">Create tickets and assign drivers to see routes here</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-200">
              {filteredRoutes.map(route => (
                <button
                  key={route.routeId}
                  onClick={() => setSelectedRoute(route)}
                  className={`w-full text-left p-4 hover:bg-neutral-50 transition-colors ${
                    selectedRoute?.routeId === route.routeId ? 'bg-green-50 border-l-4 border-green-600' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-neutral-900">{route.driverName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(route.status)}`}>
                      {route.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  </div>
                  <div className="text-sm text-neutral-500 space-y-1">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4" />
                      {route.vehicle || 'Vehicle TBD'}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {route.completedStops}/{route.totalStops} stops
                      </span>
                      {route.estimatedDuration && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDuration(route.estimatedDuration)}
                        </span>
                      )}
                    </div>
                  </div>
                  {route.totalStops > 0 && (
                    <div className="mt-2">
                      <div className="w-full bg-neutral-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${(route.completedStops / route.totalStops) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {selectedRoute ? (
            <div>
              {/* Route Header */}
              <div className="bg-neutral-900 rounded-xl border border-neutral-200 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-neutral-900">
                      {selectedRoute.driverName}{selectedRoute.driverName !== 'Unassigned' ? "'s Route" : ' Tickets'}
                    </h2>
                    <p className="text-neutral-500">
                      {selectedRoute.vehicle || 'Vehicle TBD'}
                      {selectedRoute.totalDistance ? ` | ${selectedRoute.totalDistance.toFixed(1)} miles` : ''}
                      {selectedRoute.estimatedDuration ? ` | ${formatDuration(selectedRoute.estimatedDuration)} estimated` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {selectedRoute.stops.length > 0 && (
                      <a
                        href={getGoogleMapsRouteUrl(selectedRoute)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-brand-green text-black rounded-lg hover:bg-blue-700"
                      >
                        <Navigation className="w-4 h-4" />
                        Full Route
                      </a>
                    )}

                    {selectedRoute.status === 'planned' && selectedRoute.totalStops > 0 && (
                      <button
                        onClick={() => handleStartRoute(selectedRoute.routeId)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        <Play className="w-4 h-4" />
                        Start Route
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress */}
                {selectedRoute.totalStops > 0 && (
                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-neutral-200 rounded-full h-3">
                      <div
                        className="bg-green-600 h-3 rounded-full transition-all"
                        style={{ width: `${(selectedRoute.completedStops / selectedRoute.totalStops) * 100}%` }}
                      />
                    </div>
                    <span className="font-medium text-neutral-900">
                      {selectedRoute.completedStops}/{selectedRoute.totalStops} Complete
                    </span>
                  </div>
                )}
              </div>

              {/* Stops List */}
              <div className="space-y-4">
                {selectedRoute.stops.length === 0 ? (
                  <div className="text-center py-12 bg-neutral-900 rounded-xl border border-neutral-200">
                    <Package className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">No Stops</h3>
                    <p className="text-neutral-500">No delivery stops assigned to this route</p>
                  </div>
                ) : (
                  selectedRoute.stops.map((stop, idx) => (
                    <div
                      key={stop.orderId}
                      className={`bg-neutral-900 rounded-xl border-2 p-6 transition-all ${getPriorityColor(stop.priority)} ${
                        stop.status === 'in_progress' ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Stop Number */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          stop.status === 'delivered'
                            ? 'bg-green-600 text-white'
                            : stop.status === 'in_progress'
                            ? 'bg-brand-green text-black'
                            : 'bg-neutral-200 text-neutral-600'
                        }`}>
                          {stop.status === 'delivered' ? (
                            <Check className="w-5 h-5" />
                          ) : (
                            <span className="font-bold">{idx + 1}</span>
                          )}
                        </div>

                        {/* Stop Details */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-neutral-900">{stop.jobName}</h3>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(stop.status)}`}>
                                  {stop.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                </span>
                                {stop.priority !== 'normal' && (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    stop.priority === 'urgent' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                                  }`}>
                                    {stop.priority.toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <p className="text-neutral-600">{stop.customerName}</p>
                            </div>

                            <div className="text-right">
                              {stop.scheduledTime && (
                                <div className="text-sm text-neutral-500">
                                  <span className="font-medium">Scheduled:</span> {stop.scheduledTime}
                                </div>
                              )}
                              {stop.estimatedArrival && (
                                <div className="text-sm text-blue-400">
                                  <span className="font-medium">ETA:</span> {stop.estimatedArrival}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-neutral-500">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {stop.address}, {stop.city}
                            </div>
                            <a
                              href={`tel:${stop.customerPhone}`}
                              className="flex items-center gap-1 text-green-400 hover:text-green-400"
                            >
                              <Phone className="w-4 h-4" />
                              {stop.customerPhone}
                            </a>
                            <div className="flex items-center gap-1">
                              <Package className="w-4 h-4" />
                              {stop.itemCount} items
                            </div>
                          </div>

                          {/* Inspector Alert */}
                          {stop.inspectorRequired && (
                            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                              <div className="flex items-center gap-2 text-amber-800">
                                <AlertCircle className="w-4 h-4" />
                                <span className="font-medium">Inspector Required</span>
                              </div>
                              <div className="text-sm text-amber-700 mt-1">
                                {stop.inspectorName} - Arriving at {stop.inspectorArrivalTime}
                              </div>
                            </div>
                          )}

                          {/* Special Instructions */}
                          {stop.specialInstructions && (
                            <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-500/20">
                              <div className="text-sm text-yellow-400">
                                <span className="font-medium">Instructions:</span> {stop.specialInstructions}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <a
                              href={getGoogleMapsUrl(stop)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-3 py-1.5 bg-brand-green/20 text-blue-400 rounded-lg hover:bg-blue-200 text-sm"
                            >
                              <Navigation className="w-4 h-4" />
                              Navigate
                            </a>
                            <Link
                              href={`/portal/delivery/${stop.orderId}`}
                              className="flex items-center gap-1 px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 text-sm"
                            >
                              <Package className="w-4 h-4" />
                              Details
                            </Link>
                            {stop.status === 'in_progress' && (
                              <>
                                <button className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-200 text-sm">
                                  <Camera className="w-4 h-4" />
                                  Photos
                                </button>
                                <button
                                  onClick={() => handleCompleteDelivery(stop.orderId)}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                                >
                                  <Check className="w-4 h-4" />
                                  Complete Delivery
                                </button>
                              </>
                            )}
                            {stop.status === 'pending' && (
                              <button
                                onClick={() => handleStartDelivery(stop.orderId)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                              >
                                <Play className="w-4 h-4" />
                                Start Delivery
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Route className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
              <h3 className="text-lg font-medium text-neutral-900 mb-2">
                {routes.length === 0 ? 'No Deliveries Scheduled' : 'Select a Route'}
              </h3>
              <p className="text-neutral-500 mb-4">
                {routes.length === 0
                  ? 'Create delivery tickets and assign drivers to get started'
                  : 'Select a route from the sidebar to view details'
                }
              </p>
              {routes.length === 0 && (
                <Link
                  href="/portal/pm"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Plus className="w-4 h-4" />
                  Create Delivery Ticket
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Assign Driver Modal */}
      {showAssignModal && assigningTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-neutral-900 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Assign Driver</h3>
            <p className="text-sm text-neutral-500 mb-4">
              Assign a driver to: <span className="font-medium">{assigningTicket.jobName || assigningTicket.ticketId}</span>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Driver</label>
                <select
                  value={selectedDriver}
                  onChange={(e) => setSelectedDriver(e.target.value)}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select driver...</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} - {d.vehicle} ({d.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Date</label>
                <input
                  type="date"
                  value={assignDate}
                  onChange={(e) => setAssignDate(e.target.value)}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Time</label>
                <input
                  type="time"
                  value={assignTime}
                  onChange={(e) => setAssignTime(e.target.value)}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setAssigningTicket(null);
                }}
                className="flex-1 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignDriver}
                disabled={!selectedDriver}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-neutral-300"
              >
                Assign Driver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
