'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  Package,
  Clock,
  CheckCircle,
  Cloud,
  Sun,
  Wind,
  Thermometer,
  MapPin,
  User,
  Weight,
  Loader2,
  ArrowRight,
  RotateCcw,
  Megaphone,
  Zap,
  CircleDot,
  Timer,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Priority = 'normal' | 'rush' | 'urgent';
type DeliveryStatus =
  | 'pending'
  | 'loading'
  | 'loaded'
  | 'in_transit'
  | 'delivered'
  | 'returned';
type BayStatus = 'available' | 'loading' | 'departing';

interface DeliveryTicket {
  id: string;
  customerName: string;
  city: string;
  materialCount: number;
  estimatedWeightLbs: number;
  priority: Priority;
  status: DeliveryStatus;
  driverName: string;
  scheduledTime: string;
  loadingBay?: number;
}

interface LoadingBay {
  bayNumber: number;
  status: BayStatus;
  currentTicketId: string | null;
  driverName: string | null;
}

interface WeatherData {
  tempF: number;
  condition: string;
  windMph: number;
  workable: boolean;
}

interface DailyStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  returns: number;
}

// ---------------------------------------------------------------------------
// Mock Data Generators
// ---------------------------------------------------------------------------

function generateMockDeliveries(): DeliveryTicket[] {
  return [
    {
      id: 'DLV-2401',
      customerName: 'Johnson Residence',
      city: 'Madison',
      materialCount: 48,
      estimatedWeightLbs: 3200,
      priority: 'urgent',
      status: 'loading',
      driverName: 'Marcus Johnson',
      scheduledTime: '7:30 AM',
      loadingBay: 1,
    },
    {
      id: 'DLV-2402',
      customerName: 'Oakwood Apartments',
      city: 'Huntsville',
      materialCount: 96,
      estimatedWeightLbs: 6400,
      priority: 'rush',
      status: 'loading',
      driverName: 'Carlos Rivera',
      scheduledTime: '8:00 AM',
      loadingBay: 2,
    },
    {
      id: 'DLV-2403',
      customerName: 'First Baptist Church',
      city: 'Decatur',
      materialCount: 120,
      estimatedWeightLbs: 8100,
      priority: 'normal',
      status: 'pending',
      driverName: 'Tony Williams',
      scheduledTime: '8:30 AM',
    },
    {
      id: 'DLV-2404',
      customerName: 'Martinez Home',
      city: 'Athens',
      materialCount: 36,
      estimatedWeightLbs: 2400,
      priority: 'normal',
      status: 'pending',
      driverName: 'Marcus Johnson',
      scheduledTime: '10:00 AM',
    },
    {
      id: 'DLV-2405',
      customerName: 'Riverfront Office Park',
      city: 'Huntsville',
      materialCount: 200,
      estimatedWeightLbs: 13500,
      priority: 'rush',
      status: 'loaded',
      driverName: 'Tony Ramirez',
      scheduledTime: '9:15 AM',
      loadingBay: 3,
    },
    {
      id: 'DLV-2406',
      customerName: 'Greenfield Estates HOA',
      city: 'Madison',
      materialCount: 64,
      estimatedWeightLbs: 4300,
      priority: 'normal',
      status: 'in_transit',
      driverName: 'James Mitchell',
      scheduledTime: '6:45 AM',
    },
    {
      id: 'DLV-2407',
      customerName: 'Thompson Residence',
      city: 'Harvest',
      materialCount: 42,
      estimatedWeightLbs: 2800,
      priority: 'urgent',
      status: 'pending',
      driverName: 'Carlos Rivera',
      scheduledTime: '11:00 AM',
    },
    {
      id: 'DLV-2408',
      customerName: 'Valley Elementary School',
      city: 'Huntsville',
      materialCount: 156,
      estimatedWeightLbs: 10500,
      priority: 'normal',
      status: 'delivered',
      driverName: 'James Mitchell',
      scheduledTime: '6:00 AM',
    },
    {
      id: 'DLV-2409',
      customerName: 'Clark Duplex',
      city: 'Decatur',
      materialCount: 28,
      estimatedWeightLbs: 1900,
      priority: 'normal',
      status: 'returned',
      driverName: 'Tony Ramirez',
      scheduledTime: '7:00 AM',
    },
  ];
}

function generateMockBays(deliveries: DeliveryTicket[]): LoadingBay[] {
  return [1, 2, 3].map((num) => {
    const ticket = deliveries.find(
      (d) => d.loadingBay === num && (d.status === 'loading' || d.status === 'loaded')
    );
    let status: BayStatus = 'available';
    if (ticket) {
      status = ticket.status === 'loaded' ? 'departing' : 'loading';
    }
    return {
      bayNumber: num,
      status,
      currentTicketId: ticket?.id ?? null,
      driverName: ticket?.driverName ?? null,
    };
  });
}

function generateMockWeather(): WeatherData {
  return {
    tempF: 62,
    condition: 'Partly Cloudy',
    windMph: 8,
    workable: true,
  };
}

function computeStats(deliveries: DeliveryTicket[]): DailyStats {
  return {
    total: deliveries.length,
    completed: deliveries.filter((d) => d.status === 'delivered').length,
    inProgress: deliveries.filter((d) =>
      ['loading', 'loaded', 'in_transit'].includes(d.status)
    ).length,
    pending: deliveries.filter((d) => d.status === 'pending').length,
    returns: deliveries.filter((d) => d.status === 'returned').length,
  };
}

const ANNOUNCEMENTS = [
  'REMINDER: All drivers must complete pre-trip inspection before departure.',
  'Bay 2 forklift scheduled for maintenance at 2 PM today.',
  'New load securement straps available in the supply room.',
  'Safety meeting Thursday 7:00 AM -- attendance mandatory.',
  'Shingle delivery from ABC Supply expected at 1:30 PM.',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PriorityBadge({ priority }: { priority: Priority }) {
  const config: Record<Priority, { bg: string; text: string; label: string }> = {
    normal: { bg: 'bg-slate-600', text: 'text-slate-200', label: 'NORMAL' },
    rush: { bg: 'bg-amber-600', text: 'text-amber-100', label: 'RUSH' },
    urgent: { bg: 'bg-red-600', text: 'text-white', label: 'URGENT' },
  };
  const c = config[priority];
  return (
    <span
      className={`${c.bg} ${c.text} px-3 py-1 rounded font-bold text-sm uppercase tracking-wider inline-flex items-center gap-1`}
    >
      {priority === 'urgent' && <Zap className="w-4 h-4" />}
      {priority === 'rush' && <Timer className="w-4 h-4" />}
      {c.label}
    </span>
  );
}

function StatusBadge({ status }: { status: DeliveryStatus }) {
  const config: Record<
    DeliveryStatus,
    { bg: string; text: string; label: string; icon: React.ReactNode }
  > = {
    pending: {
      bg: 'bg-gray-700 border border-gray-500',
      text: 'text-neutral-400',
      label: 'PENDING',
      icon: <Clock className="w-4 h-4" />,
    },
    loading: {
      bg: 'bg-blue-700 border border-blue-400',
      text: 'text-blue-100',
      label: 'LOADING',
      icon: <Loader2 className="w-4 h-4 animate-spin" />,
    },
    loaded: {
      bg: 'bg-indigo-700 border border-indigo-400',
      text: 'text-indigo-100',
      label: 'LOADED',
      icon: <Package className="w-4 h-4" />,
    },
    in_transit: {
      bg: 'bg-brand-green/20 border border-brand-green',
      text: 'text-brand-green',
      label: 'IN TRANSIT',
      icon: <Truck className="w-4 h-4" />,
    },
    delivered: {
      bg: 'bg-emerald-800 border border-emerald-500',
      text: 'text-emerald-200',
      label: 'DELIVERED',
      icon: <CheckCircle className="w-4 h-4" />,
    },
    returned: {
      bg: 'bg-red-900 border border-red-500',
      text: 'text-red-300',
      label: 'RETURNED',
      icon: <RotateCcw className="w-4 h-4" />,
    },
  };
  const c = config[status];
  return (
    <span
      className={`${c.bg} ${c.text} px-3 py-1 rounded font-bold text-sm uppercase tracking-wider inline-flex items-center gap-1.5`}
    >
      {c.icon}
      {c.label}
    </span>
  );
}

function DeliveryCard({ ticket }: { ticket: DeliveryTicket }) {
  const borderColor =
    ticket.priority === 'urgent'
      ? 'border-red-500'
      : ticket.priority === 'rush'
        ? 'border-amber-500'
        : 'border-gray-700';

  return (
    <div
      className={`bg-gray-900 border-2 ${borderColor} rounded-xl p-5 flex flex-col gap-3 transition-all`}
    >
      {/* Row 1: Ticket ID + Priority + Status */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-2xl font-bold text-white tracking-wide">
          {ticket.id}
        </span>
        <div className="flex items-center gap-2">
          <PriorityBadge priority={ticket.priority} />
          <StatusBadge status={ticket.status} />
        </div>
      </div>

      {/* Row 2: Customer + City */}
      <div className="flex items-center gap-4 text-xl">
        <span className="text-white font-semibold truncate">
          {ticket.customerName}
        </span>
        <span className="text-neutral-500 flex items-center gap-1 shrink-0">
          <MapPin className="w-5 h-5" />
          {ticket.city}
        </span>
      </div>

      {/* Row 3: Details */}
      <div className="flex items-center gap-6 text-lg text-neutral-400 flex-wrap">
        <span className="flex items-center gap-1.5">
          <Package className="w-5 h-5 text-brand-green" />
          {ticket.materialCount} pcs
        </span>
        <span className="flex items-center gap-1.5">
          <Weight className="w-5 h-5 text-brand-green" />
          {ticket.estimatedWeightLbs.toLocaleString()} lbs
        </span>
        <span className="flex items-center gap-1.5">
          <User className="w-5 h-5 text-brand-green" />
          {ticket.driverName}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-5 h-5 text-brand-green" />
          {ticket.scheduledTime}
        </span>
        {ticket.loadingBay && (
          <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
            <ArrowRight className="w-5 h-5" />
            Bay {ticket.loadingBay}
          </span>
        )}
      </div>
    </div>
  );
}

function LoadingBayCard({ bay }: { bay: LoadingBay }) {
  const statusConfig: Record<
    BayStatus,
    { bg: string; border: string; glow: string; label: string; dotColor: string }
  > = {
    available: {
      bg: 'bg-gray-900',
      border: 'border-gray-600',
      glow: '',
      label: 'AVAILABLE',
      dotColor: 'bg-white/50',
    },
    loading: {
      bg: 'bg-gray-900',
      border: 'border-blue-500',
      glow: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]',
      label: 'LOADING',
      dotColor: 'bg-brand-green animate-pulse',
    },
    departing: {
      bg: 'bg-gray-900',
      border: 'border-brand-green',
      glow: 'shadow-[0_0_20px_rgba(57,255,20,0.3)]',
      label: 'DEPARTING',
      dotColor: 'bg-brand-green animate-pulse',
    },
  };
  const c = statusConfig[bay.status];

  return (
    <div
      className={`${c.bg} border-2 ${c.border} ${c.glow} rounded-xl p-5 flex flex-col items-center gap-3 min-w-[220px]`}
    >
      <div className="text-4xl font-black text-white">BAY {bay.bayNumber}</div>
      <div className="flex items-center gap-2">
        <span className={`w-3.5 h-3.5 rounded-full ${c.dotColor}`} />
        <span
          className={`text-xl font-bold uppercase tracking-wider ${
            bay.status === 'available'
              ? 'text-neutral-500'
              : bay.status === 'loading'
                ? 'text-blue-400'
                : 'text-brand-green'
          }`}
        >
          {c.label}
        </span>
      </div>
      {bay.currentTicketId ? (
        <div className="text-center mt-1">
          <div className="text-lg font-semibold text-white">
            {bay.currentTicketId}
          </div>
          <div className="text-base text-neutral-500">{bay.driverName}</div>
        </div>
      ) : (
        <div className="text-neutral-400 text-lg italic mt-1">No active load</div>
      )}
    </div>
  );
}

function WeatherWidget({ weather }: { weather: WeatherData }) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex items-center gap-5 min-w-[300px]">
      <div className="flex flex-col items-center">
        {weather.condition.toLowerCase().includes('sun') ||
        weather.condition.toLowerCase().includes('clear') ? (
          <Sun className="w-10 h-10 text-yellow-400" />
        ) : (
          <Cloud className="w-10 h-10 text-neutral-500" />
        )}
        <span className="text-sm text-neutral-500 mt-1">{weather.condition}</span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Thermometer className="w-5 h-5 text-brand-green" />
          <span className="text-2xl font-bold text-white">{weather.tempF}&deg;F</span>
        </div>
        <div className="flex items-center gap-2">
          <Wind className="w-5 h-5 text-brand-green" />
          <span className="text-lg text-neutral-400">{weather.windMph} mph</span>
        </div>
      </div>
      <div
        className={`ml-auto px-4 py-2 rounded-lg text-lg font-bold ${
          weather.workable
            ? 'bg-brand-green/20 text-brand-green border border-brand-green'
            : 'bg-red-900/50 text-red-400 border border-red-500'
        }`}
      >
        {weather.workable ? 'WORKABLE' : 'NOT WORKABLE'}
      </div>
    </div>
  );
}

function StatsBar({ stats }: { stats: DailyStats }) {
  const items = [
    { label: 'Total', value: stats.total, color: 'text-white', bg: 'bg-gray-800' },
    {
      label: 'Completed',
      value: stats.completed,
      color: 'text-emerald-400',
      bg: 'bg-emerald-900/40',
    },
    {
      label: 'In Progress',
      value: stats.inProgress,
      color: 'text-blue-400',
      bg: 'bg-blue-900/40',
    },
    {
      label: 'Pending',
      value: stats.pending,
      color: 'text-neutral-500',
      bg: 'bg-gray-800',
    },
    {
      label: 'Returns',
      value: stats.returns,
      color: 'text-red-400',
      bg: 'bg-red-900/40',
    },
  ];

  return (
    <div className="flex items-stretch gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className={`${item.bg} border border-gray-700 rounded-xl px-6 py-3 flex flex-col items-center justify-center min-w-[140px]`}
        >
          <span className={`text-4xl font-black ${item.color}`}>{item.value}</span>
          <span className="text-sm text-neutral-500 uppercase tracking-wider font-semibold">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function AnnouncementBanner({ messages }: { messages: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length === 0) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [messages.length]);

  if (messages.length === 0) return null;

  return (
    <div className="bg-amber-900/30 border border-amber-600/50 rounded-xl px-6 py-3 flex items-center gap-4 overflow-hidden">
      <Megaphone className="w-7 h-7 text-amber-400 shrink-0" />
      <div className="relative flex-1 h-8 overflow-hidden">
        <span
          key={index}
          className="absolute inset-0 flex items-center text-lg text-amber-200 font-medium animate-[fadeSlide_0.5s_ease-out]"
        >
          {messages[index]}
        </span>
      </div>
      <div className="flex gap-1.5 shrink-0">
        {messages.map((_, i) => (
          <span
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i === index ? 'bg-amber-400' : 'bg-amber-800'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function WarehouseDisplayPage() {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [deliveries, setDeliveries] = useState<DeliveryTicket[]>([]);
  const [bays, setBays] = useState<LoadingBay[]>([]);
  const [weather, setWeather] = useState<WeatherData>(generateMockWeather());
  const [stats, setStats] = useState<DailyStats>({
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    returns: 0,
  });
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadData = useCallback(() => {
    const d = generateMockDeliveries();
    setDeliveries(d);
    setBays(generateMockBays(d));
    setWeather(generateMockWeather());
    setStats(computeStats(d));
    setLastRefresh(new Date());
  }, []);

  // Clock tick every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Initial load + auto-refresh every 30 seconds
  useEffect(() => {
    loadData();
    const refresh = setInterval(loadData, 30000);
    return () => clearInterval(refresh);
  }, [loadData]);

  // Sort: urgent first, then rush, then normal; within each group sort by status priority
  const statusOrder: Record<DeliveryStatus, number> = {
    loading: 0,
    loaded: 1,
    pending: 2,
    in_transit: 3,
    delivered: 4,
    returned: 5,
  };
  const priorityOrder: Record<Priority, number> = {
    urgent: 0,
    rush: 1,
    normal: 2,
  };

  const sortedDeliveries = [...deliveries].sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return statusOrder[a.status] - statusOrder[b.status];
  });

  // Separate active vs completed for display
  const activeDeliveries = sortedDeliveries.filter(
    (d) => !['delivered', 'returned'].includes(d.status)
  );
  const completedDeliveries = sortedDeliveries.filter((d) =>
    ['delivered', 'returned'].includes(d.status)
  );

  return (
    <>
      {/* Inline keyframes for announcement animation */}
      <style jsx global>{`
        @keyframes fadeSlide {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="min-h-screen max-h-screen bg-black text-white flex flex-col overflow-hidden">
        {/* ========== HEADER ========== */}
        <header className="bg-gray-950 border-b-2 border-brand-green px-8 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-brand-green rounded-lg flex items-center justify-center">
              <Truck className="w-7 h-7 text-black" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">
                RCRS <span className="text-brand-green">WAREHOUSE</span>
              </h1>
              <p className="text-sm text-neutral-500 -mt-0.5">
                River City Roofing Solutions
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-5xl font-mono font-bold text-brand-green tabular-nums tracking-wider">
              {formatTime(currentTime)}
            </div>
            <div className="text-lg text-neutral-500 mt-0.5">
              {formatDate(currentTime)}
            </div>
          </div>
        </header>

        {/* ========== MAIN CONTENT ========== */}
        <main className="flex-1 grid grid-cols-[1fr_340px] grid-rows-[auto_1fr_auto] gap-4 p-5 overflow-hidden">
          {/* --- Stats Bar (top, spans full width) --- */}
          <div className="col-span-2 flex items-center justify-between gap-4">
            <StatsBar stats={stats} />
            <WeatherWidget weather={weather} />
          </div>

          {/* --- Delivery Queue (left column) --- */}
          <div className="flex flex-col gap-3 overflow-hidden">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <CircleDot className="w-6 h-6 text-brand-green" />
                Today&apos;s Delivery Queue
                <span className="text-brand-green ml-1">
                  ({activeDeliveries.length} active)
                </span>
              </h2>
              <span className="text-sm text-neutral-500">
                Last refresh: {formatTime(lastRefresh)}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3 scrollbar-thin">
              {activeDeliveries.map((ticket) => (
                <DeliveryCard key={ticket.id} ticket={ticket} />
              ))}

              {completedDeliveries.length > 0 && (
                <>
                  <div className="flex items-center gap-3 pt-2">
                    <div className="h-px flex-1 bg-gray-800" />
                    <span className="text-sm text-neutral-500 uppercase tracking-wider font-semibold">
                      Completed / Returned
                    </span>
                    <div className="h-px flex-1 bg-gray-800" />
                  </div>
                  {completedDeliveries.map((ticket) => (
                    <div key={ticket.id} className="opacity-50">
                      <DeliveryCard ticket={ticket} />
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* --- Right Sidebar: Loading Bays --- */}
          <div className="flex flex-col gap-4 overflow-hidden">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Package className="w-6 h-6 text-brand-green" />
              Loading Bays
            </h2>
            <div className="flex flex-col gap-4">
              {bays.map((bay) => (
                <LoadingBayCard key={bay.bayNumber} bay={bay} />
              ))}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Quick Legend */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm text-neutral-500 uppercase tracking-wider font-semibold mb-3">
                Status Legend
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-white/50" />
                  <span className="text-neutral-500">Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-brand-green animate-pulse" />
                  <span className="text-neutral-500">Loading</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-brand-green animate-pulse" />
                  <span className="text-neutral-500">Departing</span>
                </div>
              </div>
            </div>
          </div>

          {/* --- Announcement Banner (bottom, spans full width) --- */}
          <div className="col-span-2">
            <AnnouncementBanner messages={ANNOUNCEMENTS} />
          </div>
        </main>
      </div>
    </>
  );
}
