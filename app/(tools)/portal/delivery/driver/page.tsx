'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Truck,
  ClipboardCheck,
  Package,
  Camera,
  CheckCircle,
  Circle,
  AlertTriangle,
  Clock,
  MapPin,
  Phone,
  User,
  Navigation,
  ChevronRight,
  Loader2,
  FileText,
  MessageSquare,
  Undo2,
  AlertOctagon,
  Warehouse,
  Route,
  Bell,
  Calendar,
  Shield,
  Info,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface DriverDelivery {
  ticketId: string;
  jobName: string;
  customerName: string;
  customerPhone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  scheduledTime: string;
  priority: 'normal' | 'rush' | 'urgent';
  status: 'assigned' | 'loading' | 'loaded' | 'en_route' | 'arrived' | 'delivered' | 'completed';
  materialCount: number;
  totalWeight: number;
  specialInstructions?: string;
}

interface DriverStats {
  todayDeliveries: number;
  completed: number;
  inProgress: number;
  pending: number;
  totalWeight: number;
  onTimeRate: number;
}

interface Notification {
  id: string;
  message: string;
  time: string;
  priority: 'normal' | 'high';
  read: boolean;
}

// ============================================
// FALLBACK MOCK DATA
// ============================================

const MOCK_STATS: DriverStats = {
  todayDeliveries: 3,
  completed: 0,
  inProgress: 1,
  pending: 2,
  totalWeight: 7248,
  onTimeRate: 96,
};

const MOCK_DELIVERIES: DriverDelivery[] = [
  {
    ticketId: 'DEL-20260211-A1B2',
    jobName: 'Henderson Roof Replacement',
    customerName: 'Mark Henderson',
    customerPhone: '(256) 555-1234',
    address: '1482 Oak Valley Dr',
    city: 'Huntsville',
    state: 'AL',
    zip: '35801',
    scheduledTime: '08:30 AM',
    priority: 'normal',
    status: 'assigned',
    materialCount: 7,
    totalWeight: 3994,
    specialInstructions: 'Gate code #4429. Stack shingles south side.',
  },
  {
    ticketId: 'DEL-20260211-C3D4',
    jobName: 'Whitfield Insurance Repair',
    customerName: 'Sarah Whitfield',
    customerPhone: '(256) 555-8877',
    address: '305 Monroe St SW',
    city: 'Decatur',
    state: 'AL',
    zip: '35601',
    scheduledTime: '11:00 AM',
    priority: 'rush',
    status: 'assigned',
    materialCount: 6,
    totalWeight: 2166,
    specialInstructions: 'Insurance job - take before photos. Inspector at 11:30 AM.',
  },
  {
    ticketId: 'DEL-20260211-E5F6',
    jobName: 'Thompson Gutter Install',
    customerName: 'David Thompson',
    customerPhone: '(256) 555-3301',
    address: '920 Bailey Cove Rd',
    city: 'Huntsville',
    state: 'AL',
    zip: '35802',
    scheduledTime: '2:00 PM',
    priority: 'normal',
    status: 'assigned',
    materialCount: 4,
    totalWeight: 137,
    specialInstructions: 'Stage materials in garage. Ring doorbell.',
  },
];

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: '1', message: 'Henderson delivery assigned to you for 8:30 AM', time: '6:45 AM', priority: 'normal', read: false },
  { id: '2', message: 'RUSH: Whitfield Insurance repair added for 11:00 AM', time: '7:00 AM', priority: 'high', read: false },
  { id: '3', message: 'Thompson Gutter job confirmed for 2:00 PM', time: '7:15 AM', priority: 'normal', read: true },
];

// ============================================
// COMPONENT
// ============================================

export default function DriverPortalPage() {
  const [deliveries, setDeliveries] = useState<DriverDelivery[]>([]);
  const [stats, setStats] = useState<DriverStats>(MOCK_STATS);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingMockData, setIsUsingMockData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDriverData();
  }, []);

  async function fetchDriverData() {
    setIsLoading(true);
    setError(null);

    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/portal/deliveries?date=${today}`);

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const data = await res.json();
      const apiDeliveries: DriverDelivery[] = (data.data?.deliveries || data.deliveries || []).map((d: any) => ({
        ticketId: d.ticketId || d.id || d.deliveryId,
        jobName: d.jobName || d.job_name || 'Delivery',
        customerName: d.customerName || d.customer_name || 'Customer',
        customerPhone: d.customerPhone || d.customer_phone || '',
        address: d.address || d.jobAddress || '',
        city: d.city || '',
        state: d.state || 'AL',
        zip: d.zip || '',
        scheduledTime: d.scheduledTime || d.scheduled_time || '',
        priority: d.priority || 'normal',
        status: d.status || 'assigned',
        materialCount: d.materialCount || d.materials?.length || 0,
        totalWeight: d.totalWeight || d.total_weight || 0,
        specialInstructions: d.specialInstructions || d.special_instructions || undefined,
      }));

      if (apiDeliveries.length > 0) {
        setDeliveries(apiDeliveries);

        // Compute stats from real data
        const completed = apiDeliveries.filter(d => d.status === 'completed' || d.status === 'delivered').length;
        const inProgress = apiDeliveries.filter(d => ['loading', 'loaded', 'en_route', 'arrived'].includes(d.status)).length;
        const pending = apiDeliveries.filter(d => d.status === 'assigned').length;
        const totalWeight = apiDeliveries.reduce((sum, d) => sum + d.totalWeight, 0);

        setStats({
          todayDeliveries: apiDeliveries.length,
          completed,
          inProgress,
          pending,
          totalWeight,
          onTimeRate: stats.onTimeRate, // keep existing rate
        });
        setIsUsingMockData(false);
      } else {
        // API returned empty - use mock data
        setDeliveries(MOCK_DELIVERIES);
        setNotifications(MOCK_NOTIFICATIONS);
        setStats(MOCK_STATS);
        setIsUsingMockData(true);
      }
    } catch (err) {
      console.error('Failed to fetch driver deliveries:', err);
      setError(err instanceof Error ? err.message : 'Failed to load deliveries');
      // Fallback to mock data
      setDeliveries(MOCK_DELIVERIES);
      setNotifications(MOCK_NOTIFICATIONS);
      setStats(MOCK_STATS);
      setIsUsingMockData(true);
    } finally {
      setIsLoading(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]/30';
      case 'delivered': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'en_route': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'arrived': return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'loaded': return 'bg-teal-500/10 text-teal-400 border-teal-500/30';
      case 'loading': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      default: return 'bg-zinc-700 text-zinc-400 border-zinc-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'assigned': return 'Ready to Load';
      case 'loading': return 'Loading';
      case 'loaded': return 'Load Verified';
      case 'en_route': return 'En Route';
      case 'arrived': return 'At Site';
      case 'delivered': return 'Delivered';
      case 'completed': return 'Complete';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'rush': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return '';
    }
  };

  const displayNotifications = isUsingMockData ? MOCK_NOTIFICATIONS : notifications;

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal/delivery" className="text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#39FF14]" />
                Driver Portal
              </h1>
              <p className="text-sm text-zinc-400">
                Your deliveries, tools, and status for today
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bell className="w-5 h-5 text-zinc-400" />
              {displayNotifications.filter(n => !n.read).length > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Demo Data Banner */}
        {isUsingMockData && !isLoading && (
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <Info className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-400">Demo Data - Waiting for real deliveries</p>
              <p className="text-xs text-amber-400/70 mt-0.5">
                {error ? `API Error: ${error}` : 'No deliveries found for today. Showing sample data.'}
              </p>
            </div>
            <button
              onClick={fetchDriverData}
              className="px-3 py-1.5 text-xs font-medium text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-[#39FF14] animate-spin mb-3" />
            <p className="text-sm text-zinc-400">Loading your deliveries...</p>
          </div>
        )}

        {!isLoading && (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-white">{stats.todayDeliveries}</p>
                <p className="text-xs text-zinc-500">Today's Deliveries</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-[#39FF14]">{stats.completed}</p>
                <p className="text-xs text-zinc-500">Completed</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-white">{stats.totalWeight.toLocaleString()}</p>
                <p className="text-xs text-zinc-500">Total lbs</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-[#39FF14]">{stats.onTimeRate}%</p>
                <p className="text-xs text-zinc-500">On-Time Rate</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Link
                href="/portal/delivery/loading-checklist"
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-[#39FF14]/30 transition-colors group"
              >
                <ClipboardCheck className="w-6 h-6 text-[#39FF14] mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-medium text-white">Loading Checklist</p>
                <p className="text-[10px] text-zinc-500 mt-1">Verify materials</p>
              </Link>
              <Link
                href="/portal/delivery/loading-assist"
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-[#39FF14]/30 transition-colors group"
              >
                <MessageSquare className="w-6 h-6 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-medium text-white">Loading Assistant</p>
                <p className="text-[10px] text-zinc-500 mt-1">AI helper</p>
              </Link>
              <Link
                href="/portal/delivery/route"
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-[#39FF14]/30 transition-colors group"
              >
                <Route className="w-6 h-6 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-medium text-white">Route Planner</p>
                <p className="text-[10px] text-zinc-500 mt-1">Optimize route</p>
              </Link>
              <Link
                href="/portal/inventory/warehouse"
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-[#39FF14]/30 transition-colors group"
              >
                <Warehouse className="w-6 h-6 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-medium text-white">Warehouse</p>
                <p className="text-[10px] text-zinc-500 mt-1">Smart controls</p>
              </Link>
            </div>

            {/* Notifications */}
            {displayNotifications.filter(n => !n.read).length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-800">
                  <Bell className="w-4 h-4 text-[#39FF14]" />
                  <h3 className="text-sm font-semibold text-white">Notifications</h3>
                  <span className="px-1.5 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded-full">
                    {displayNotifications.filter(n => !n.read).length}
                  </span>
                </div>
                <div className="divide-y divide-zinc-800/50">
                  {displayNotifications.filter(n => !n.read).map(notif => (
                    <div key={notif.id} className="px-5 py-3 flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        notif.priority === 'high' ? 'bg-amber-400' : 'bg-[#39FF14]'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">{notif.message}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{notif.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Today's Deliveries */}
            <div>
              <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#39FF14]" />
                Today's Deliveries
              </h2>
              <div className="space-y-3">
                {deliveries.map(delivery => (
                  <div
                    key={delivery.ticketId}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors"
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="text-base font-semibold text-white">{delivery.jobName}</h3>
                            {delivery.priority !== 'normal' && (
                              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${getPriorityColor(delivery.priority)}`}>
                                {delivery.priority.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 font-mono">{delivery.ticketId}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded border ${getStatusColor(delivery.status)}`}>
                          {getStatusLabel(delivery.status)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
                        <div className="flex items-center gap-2 text-zinc-400">
                          <User className="w-3.5 h-3.5" />
                          <span>{delivery.customerName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{delivery.scheduledTime}</span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-400 sm:col-span-2">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>{delivery.address}, {delivery.city}, {delivery.state} {delivery.zip}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-zinc-500 mb-3">
                        <span className="flex items-center gap-1">
                          <Package className="w-3.5 h-3.5" />
                          {delivery.materialCount} items
                        </span>
                        <span className="flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5" />
                          {delivery.totalWeight.toLocaleString()} lbs
                        </span>
                      </div>

                      {delivery.specialInstructions && (
                        <div className="flex items-start gap-2 p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-lg mb-3">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span className="text-xs text-amber-400/90">{delivery.specialInstructions}</span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2">
                        {delivery.status === 'assigned' && (
                          <Link
                            href={`/portal/delivery/loading-checklist`}
                            className="flex items-center gap-1.5 px-3 py-2 bg-[#39FF14] text-black font-semibold rounded-lg text-xs hover:bg-[#39FF14]/90 transition-colors"
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                            Start Loading
                          </Link>
                        )}
                        {(delivery.status === 'loaded' || delivery.status === 'en_route') && (
                          <button className="flex items-center gap-1.5 px-3 py-2 bg-[#39FF14] text-black font-semibold rounded-lg text-xs hover:bg-[#39FF14]/90 transition-colors">
                            <Navigation className="w-3.5 h-3.5" />
                            Navigate
                          </button>
                        )}
                        {delivery.status === 'arrived' && (
                          <button className="flex items-center gap-1.5 px-3 py-2 bg-[#39FF14] text-black font-semibold rounded-lg text-xs hover:bg-[#39FF14]/90 transition-colors">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Confirm Delivery
                          </button>
                        )}
                        <a
                          href={`tel:${delivery.customerPhone}`}
                          className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-xs hover:text-white hover:border-zinc-600 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          Call Customer
                        </a>
                        <a
                          href={`https://maps.google.com/maps?daddr=${encodeURIComponent(`${delivery.address}, ${delivery.city}, ${delivery.state} ${delivery.zip}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-xs hover:text-white hover:border-zinc-600 transition-colors"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          Directions
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Safety Reminder */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-[#39FF14] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Daily Safety Reminder</h3>
                  <ul className="text-xs text-zinc-400 space-y-1">
                    <li>- Wear steel-toe boots, gloves, and safety glasses during loading</li>
                    <li>- Use proper lifting technique: bend at knees, keep back straight</li>
                    <li>- Secure all loads with ratchet straps before departing</li>
                    <li>- Perform a walk-around inspection of your vehicle before first trip</li>
                    <li>- Report any safety concerns to warehouse manager immediately</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
