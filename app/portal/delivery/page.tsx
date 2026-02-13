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
      const response = await fetch(`/api/portal/delivery?date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch delivery routes');
      const data = await response.json();
      const loadedRoutes: DailyRoute[] = Array.isArray(data.routes) ? data.routes : [];

      setRoutes(loadedRoutes);
      if (loadedRoutes.length > 0 && !selectedRoute) {
        setSelectedRoute(loadedRoutes[0]);
      } else if (loadedRoutes.length > 0 && selectedRoute) {
        const updated = loadedRoutes.find(r => r.routeId === selectedRoute.routeId);
        setSelectedRoute(updated || loadedRoutes[0]);
      } else {
        setSelectedRoute(null);
      }

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
      case 'delivered': case 'completed': return 'bg-green-500/20 text-green-400';
      case 'in_progress': return 'bg-brand-green/20 text-brand-green';
      case 'arrived': return 'bg-purple-500/20 text-purple-400';
      case 'pending': case 'planned': return 'bg-zinc-700/50 text-zinc-400';
      case 'skipped': return 'bg-red-500/20 text-red-400';
      default: return 'bg-zinc-700/50 text-zinc-400';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-red-500/40';
      case 'rush': return 'border-orange-500/40';
      default: return 'border-zinc-800';
    }
  };

  const getGoogleMapsRouteUrl = (route: DailyRoute) => {
    const addresses = route.stops.map(s => encodeURIComponent(`${s.address}, ${s.city}, ${s.state} ${s.zip}`));
    return `https://www.google.com/maps/dir/${addresses.join('/')}`;
  };

  const getGoogleMapsUrl = (stop: DeliveryStop) => {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${stop.address}, ${stop.city}, ${stop.state} ${stop.zip}`)}`;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const filteredRoutes = statusFilter === 'all' ? routes : routes.filter(r => r.status === statusFilter);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-brand-green/10 border border-brand-green/30 flex items-center justify-center">
              <Truck className="text-brand-green" size={32} />
            </div>
            <div className="absolute inset-0 rounded-2xl border-2 border-brand-green/30 animate-ping opacity-50" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold text-white">Loading Deliveries</h2>
            <p className="text-sm text-zinc-500 mt-1">Fetching routes and stops...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 md:px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/portal/dashboard" className="text-zinc-500 hover:text-brand-green transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white">Delivery Management</h1>
              <p className="text-xs text-zinc-500">Manage routes and track deliveries</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  view === 'list' ? 'bg-brand-green text-black' : 'text-zinc-400'
                }`}
              >
                List
              </button>
              <button
                onClick={() => setView('map')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  view === 'map' ? 'bg-brand-green text-black' : 'text-zinc-400'
                }`}
              >
                Map
              </button>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-brand-green focus:border-brand-green"
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
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-brand-green"
            />

            <button
              onClick={fetchRoutes}
              className="p-2 text-zinc-400 hover:text-brand-green hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Quick Links Bar */}
      <div className="bg-zinc-900/50 border-b border-zinc-800 px-4 md:px-6 py-2 overflow-x-auto">
        <div className="flex items-center gap-3 text-sm min-w-max">
          <span className="text-zinc-600 text-[11px] font-bold uppercase tracking-wider">Tools:</span>
          <Link href="/portal/delivery/job-breakdowns" className="flex items-center gap-1 text-zinc-500 hover:text-brand-green transition-colors text-xs">
            <FileSignature className="w-3.5 h-3.5" /> Job Breakdowns
          </Link>
          <span className="text-zinc-700">|</span>
          <Link href="/portal/delivery/invoices" className="flex items-center gap-1 text-zinc-500 hover:text-brand-green transition-colors text-xs">
            <FileSignature className="w-3.5 h-3.5" /> Invoices
          </Link>
          <span className="text-zinc-700">|</span>
          <Link href="/portal/inventory/reconciliation" className="flex items-center gap-1 text-zinc-500 hover:text-brand-green transition-colors text-xs">
            <CheckCircle className="w-3.5 h-3.5" /> Reconciliation
          </Link>
          <span className="text-zinc-700">|</span>
          <Link href="/portal/inventory" className="flex items-center gap-1 text-zinc-500 hover:text-brand-green transition-colors text-xs">
            <Package className="w-3.5 h-3.5" /> Inventory
          </Link>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 md:px-6 py-3">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-400">&times;</button>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="bg-zinc-900/60 border-b border-zinc-800 px-4 md:px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-black text-white">{routes.length}</div>
            <div className="text-[11px] text-zinc-500 font-medium">Active Routes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-white">{routes.reduce((sum, r) => sum + r.totalStops, 0)}</div>
            <div className="text-[11px] text-zinc-500 font-medium">Total Stops</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-brand-green">{routes.reduce((sum, r) => sum + r.completedStops, 0)}</div>
            <div className="text-[11px] text-zinc-500 font-medium">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-amber-400">{routes.reduce((sum, r) => sum + (r.totalStops - r.completedStops), 0)}</div>
            <div className="text-[11px] text-zinc-500 font-medium">Remaining</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-red-400">{unassignedTickets.length}</div>
            <div className="text-[11px] text-zinc-500 font-medium">Unassigned</div>
          </div>
        </div>
      </div>

      {/* Unassigned Tickets Banner */}
      {unassignedTickets.length > 0 && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 md:px-6 py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">
                {unassignedTickets.length} ticket{unassignedTickets.length > 1 ? 's' : ''} waiting for assignment
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {unassignedTickets.slice(0, 3).map(ticket => (
                <button
                  key={ticket.ticketId}
                  onClick={() => { setAssigningTicket(ticket); setShowAssignModal(true); }}
                  className="flex items-center gap-1 px-3 py-1 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 text-xs font-medium transition-colors"
                >
                  <UserPlus className="w-3 h-3" />
                  {ticket.jobName || ticket.ticketId}
                </button>
              ))}
              {unassignedTickets.length > 3 && (
                <span className="text-xs text-amber-500 self-center">+{unassignedTickets.length - 3} more</span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row">
        {/* Route List Sidebar */}
        <div className="w-full md:w-80 bg-zinc-900/40 border-r border-zinc-800 md:min-h-[calc(100vh-280px)]">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="font-bold text-white text-sm">Routes ({filteredRoutes.length})</h2>
            <Link href="/portal/delivery/route" className="flex items-center gap-1 text-xs text-brand-green hover:text-brand-green/80 font-medium">
              <Route className="w-3.5 h-3.5" /> Plan Route
            </Link>
          </div>

          {filteredRoutes.length === 0 ? (
            <div className="p-8 text-center">
              <Truck className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
              <p className="text-zinc-500 text-sm">No routes for this date</p>
              <p className="text-zinc-600 text-xs mt-1">Create tickets and assign drivers</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {filteredRoutes.map(route => (
                <button
                  key={route.routeId}
                  onClick={() => setSelectedRoute(route)}
                  className={`w-full text-left p-4 hover:bg-zinc-800/50 transition-colors ${
                    selectedRoute?.routeId === route.routeId ? 'bg-brand-green/5 border-l-4 border-brand-green' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-sm">{route.driverName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${getStatusColor(route.status)}`}>
                      {route.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 space-y-1">
                    <div className="flex items-center gap-2">
                      <Truck className="w-3.5 h-3.5" /> {route.vehicle || 'Vehicle TBD'}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {route.completedStops}/{route.totalStops} stops
                      </span>
                      {route.estimatedDuration && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {formatDuration(route.estimatedDuration)}
                        </span>
                      )}
                    </div>
                  </div>
                  {route.totalStops > 0 && (
                    <div className="mt-2">
                      <div className="w-full bg-zinc-800 rounded-full h-1.5">
                        <div className="bg-brand-green h-1.5 rounded-full transition-all" style={{ width: `${(route.completedStops / route.totalStops) * 100}%` }} />
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 md:p-6">
          {selectedRoute ? (
            <div>
              {/* Route Header */}
              <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 mb-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {selectedRoute.driverName}{selectedRoute.driverName !== 'Unassigned' ? "'s Route" : ' Tickets'}
                    </h2>
                    <p className="text-zinc-500 text-sm">
                      {selectedRoute.vehicle || 'Vehicle TBD'}
                      {selectedRoute.totalDistance ? ` · ${selectedRoute.totalDistance.toFixed(1)} mi` : ''}
                      {selectedRoute.estimatedDuration ? ` · ${formatDuration(selectedRoute.estimatedDuration)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedRoute.stops.length > 0 && (
                      <a
                        href={getGoogleMapsRouteUrl(selectedRoute)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-brand-green/20 text-brand-green rounded-xl hover:bg-brand-green/30 text-sm font-bold transition-colors"
                      >
                        <Navigation className="w-4 h-4" /> Full Route
                      </a>
                    )}
                    {selectedRoute.status === 'planned' && selectedRoute.totalStops > 0 && (
                      <button
                        onClick={() => handleStartRoute(selectedRoute.routeId)}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-green text-black rounded-xl hover:brightness-90 text-sm font-bold transition-all"
                      >
                        <Play className="w-4 h-4" /> Start Route
                      </button>
                    )}
                  </div>
                </div>
                {selectedRoute.totalStops > 0 && (
                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-zinc-800 rounded-full h-2.5">
                      <div className="bg-brand-green h-2.5 rounded-full transition-all" style={{ width: `${(selectedRoute.completedStops / selectedRoute.totalStops) * 100}%` }} />
                    </div>
                    <span className="font-bold text-white text-sm">{selectedRoute.completedStops}/{selectedRoute.totalStops}</span>
                  </div>
                )}
              </div>

              {/* Stops List */}
              <div className="space-y-3">
                {selectedRoute.stops.length === 0 ? (
                  <div className="text-center py-12 bg-zinc-900 rounded-2xl border border-zinc-800">
                    <Package className="w-12 h-12 mx-auto mb-4 text-zinc-700" />
                    <h3 className="text-base font-bold text-white mb-1">No Stops</h3>
                    <p className="text-zinc-500 text-sm">No delivery stops assigned to this route</p>
                  </div>
                ) : (
                  selectedRoute.stops.map((stop, idx) => (
                    <div
                      key={stop.orderId}
                      className={`bg-zinc-900 rounded-2xl border-2 p-5 transition-all ${getPriorityColor(stop.priority)} ${
                        stop.status === 'in_progress' ? 'ring-1 ring-brand-green/30' : ''
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          stop.status === 'delivered' ? 'bg-green-500 text-white' :
                          stop.status === 'in_progress' ? 'bg-brand-green text-black' :
                          'bg-zinc-800 text-zinc-400'
                        }`}>
                          {stop.status === 'delivered' ? <Check className="w-5 h-5" /> : <span className="font-black">{idx + 1}</span>}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between flex-wrap gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-white">{stop.jobName}</h3>
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${getStatusColor(stop.status)}`}>
                                  {stop.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                </span>
                                {stop.priority !== 'normal' && (
                                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                    stop.priority === 'urgent' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                                  }`}>{stop.priority.toUpperCase()}</span>
                                )}
                              </div>
                              <p className="text-zinc-400 text-sm">{stop.customerName}</p>
                            </div>
                            <div className="text-right text-xs">
                              {stop.scheduledTime && <div className="text-zinc-500"><span className="font-medium">Sched:</span> {stop.scheduledTime}</div>}
                              {stop.estimatedArrival && <div className="text-brand-green font-medium">ETA: {stop.estimatedArrival}</div>}
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {stop.address}, {stop.city}</span>
                            <a href={`tel:${stop.customerPhone}`} className="flex items-center gap-1 text-brand-green hover:text-brand-green/80">
                              <Phone className="w-3.5 h-3.5" /> {stop.customerPhone}
                            </a>
                            <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> {stop.itemCount} items</span>
                          </div>

                          {stop.inspectorRequired && (
                            <div className="mt-3 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                              <div className="flex items-center gap-2 text-amber-400 text-sm">
                                <AlertCircle className="w-4 h-4" />
                                <span className="font-bold">Inspector: {stop.inspectorName}</span> — {stop.inspectorArrivalTime}
                              </div>
                            </div>
                          )}

                          {stop.specialInstructions && (
                            <div className="mt-3 p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                              <p className="text-yellow-400 text-sm"><span className="font-bold">⚠ Instructions:</span> {stop.specialInstructions}</p>
                            </div>
                          )}

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <a
                              href={getGoogleMapsUrl(stop)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-3 py-1.5 bg-brand-green/15 text-brand-green rounded-lg hover:bg-brand-green/25 text-xs font-bold transition-colors"
                            >
                              <Navigation className="w-3.5 h-3.5" /> Navigate
                            </a>
                            <Link
                              href={`/portal/delivery/${stop.orderId}`}
                              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 text-xs font-medium transition-colors"
                            >
                              <Package className="w-3.5 h-3.5" /> Details
                            </Link>
                            {stop.status === 'in_progress' && (
                              <>
                                <button className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 text-xs font-bold transition-colors">
                                  <Camera className="w-3.5 h-3.5" /> Photos
                                </button>
                                <button
                                  onClick={() => handleCompleteDelivery(stop.orderId)}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-brand-green text-black rounded-lg hover:brightness-90 text-xs font-bold transition-all"
                                >
                                  <Check className="w-3.5 h-3.5" /> Complete
                                </button>
                              </>
                            )}
                            {stop.status === 'pending' && (
                              <button
                                onClick={() => handleStartDelivery(stop.orderId)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-brand-green text-black rounded-lg hover:brightness-90 text-xs font-bold transition-all"
                              >
                                <Play className="w-3.5 h-3.5" /> Start
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
            <div className="text-center py-16">
              <Route className="w-12 h-12 mx-auto mb-4 text-zinc-700" />
              <h3 className="text-base font-bold text-white mb-2">
                {routes.length === 0 ? 'No Deliveries Scheduled' : 'Select a Route'}
              </h3>
              <p className="text-zinc-500 text-sm mb-4">
                {routes.length === 0 ? 'Create delivery tickets and assign drivers to get started' : 'Select a route from the sidebar to view details'}
              </p>
              {routes.length === 0 && (
                <Link href="/portal/pm" className="inline-flex items-center gap-2 px-4 py-2 bg-brand-green text-black rounded-xl hover:brightness-90 font-bold text-sm transition-all">
                  <Plus className="w-4 h-4" /> Create Delivery Ticket
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Assign Driver Modal */}
      {showAssignModal && assigningTicket && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-white mb-2">Assign Driver</h3>
            <p className="text-sm text-zinc-500 mb-5">
              Assign a driver to: <span className="font-bold text-brand-green">{assigningTicket.jobName || assigningTicket.ticketId}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">Driver</label>
                <select
                  value={selectedDriver}
                  onChange={(e) => setSelectedDriver(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-1 focus:ring-brand-green focus:border-brand-green"
                >
                  <option value="">Select driver...</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name} - {d.vehicle} ({d.status})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">Date</label>
                <input
                  type="date"
                  value={assignDate}
                  onChange={(e) => setAssignDate(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-1 focus:ring-brand-green"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">Time</label>
                <input
                  type="time"
                  value={assignTime}
                  onChange={(e) => setAssignTime(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-1 focus:ring-brand-green"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowAssignModal(false); setAssigningTicket(null); }}
                className="flex-1 px-4 py-2.5 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700 font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignDriver}
                disabled={!selectedDriver}
                className="flex-1 px-4 py-2.5 bg-brand-green text-black rounded-xl hover:brightness-90 font-bold text-sm disabled:bg-zinc-800 disabled:text-zinc-600 transition-all"
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
