'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  Package,
  Truck,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  MapPin,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Navigation,
  Eye,
  RotateCcw,
  Receipt,
  ClipboardCheck,
  Loader2,
  XCircle,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

// Pipeline order shape — matches what /api/portal/material-orders returns
// (which delegates to /api/portal/pipeline). Field names track the
// PipelineOrder type in lib/material-order-pipeline.ts.
interface PipelineOrderItem {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  pulledQty?: number;
  verifiedQty?: number;
  deliveredQty?: number;
  returnedQty?: number;
}

interface PipelineOrder {
  orderId: string;
  currentStage: string;
  priority: 'normal' | 'rush' | 'urgent';
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  jobNumber: string;
  jobName: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryZip: string;
  requestedDeliveryDate: string;
  scheduledDeliveryDate?: string;
  assignedDriverName?: string;
  items: PipelineOrderItem[];
  totalPrice: number;
  paymentStatus: string;
  cancelled: boolean;
  specialInstructions?: string;
  notes?: string;
}

// 18 pipeline stages — labels + colors matching delivery/pipeline page
const STAGE_LABELS: Record<string, string> = {
  ORDER_CREATED: 'Order Created',
  ORDER_REVIEWED: 'Reviewed',
  DRIVER_ASSIGNED: 'Driver Assigned',
  WAREHOUSE_NOTIFIED: 'Warehouse Notified',
  MATERIALS_PULLED: 'Materials Pulled',
  LOAD_VERIFIED: 'Load Verified',
  DEPARTURE_CONFIRMED: 'Departed',
  EN_ROUTE: 'En Route',
  ARRIVED_AT_SITE: 'At Site',
  UNLOADING: 'Unloading',
  DELIVERY_CONFIRMED: 'Delivered',
  SIGNATURE_CAPTURED: 'Signed',
  QC_PHOTOS: 'QC Photos',
  OFFICE_NOTIFIED: 'Office Notified',
  BILLING_REVIEW: 'Billing Review',
  INVOICE_SENT: 'Invoice Sent',
  PAYMENT_RECEIVED: 'Paid',
  JOB_CLOSED: 'Closed',
};

const STAGE_BADGE_COLORS: Record<string, string> = {
  ORDER_CREATED: 'bg-blue-500/15 text-blue-400',
  ORDER_REVIEWED: 'bg-indigo-500/15 text-indigo-400',
  DRIVER_ASSIGNED: 'bg-purple-500/15 text-purple-400',
  WAREHOUSE_NOTIFIED: 'bg-yellow-500/15 text-yellow-400',
  MATERIALS_PULLED: 'bg-amber-500/15 text-amber-400',
  LOAD_VERIFIED: 'bg-orange-500/15 text-orange-400',
  DEPARTURE_CONFIRMED: 'bg-cyan-500/15 text-cyan-400',
  EN_ROUTE: 'bg-sky-500/15 text-sky-400',
  ARRIVED_AT_SITE: 'bg-teal-500/15 text-teal-400',
  UNLOADING: 'bg-emerald-500/15 text-emerald-400',
  DELIVERY_CONFIRMED: 'bg-green-500/15 text-green-400',
  SIGNATURE_CAPTURED: 'bg-lime-500/15 text-lime-400',
  QC_PHOTOS: 'bg-lime-600/15 text-lime-300',
  OFFICE_NOTIFIED: 'bg-zinc-700/40 text-zinc-300',
  BILLING_REVIEW: 'bg-rose-500/15 text-rose-400',
  INVOICE_SENT: 'bg-pink-500/15 text-pink-400',
  PAYMENT_RECEIVED: 'bg-brand-green/20 text-brand-green',
  JOB_CLOSED: 'bg-zinc-700/40 text-zinc-500',
};

const PRIORITY_BADGE_COLORS: Record<string, string> = {
  normal: 'bg-zinc-700/50 text-zinc-500',
  rush: 'bg-orange-500/20 text-orange-400',
  urgent: 'bg-red-500/20 text-red-400',
};

// Stages considered "delivered" for the Returns / Track UI gating
const DELIVERED_STAGES = new Set([
  'DELIVERY_CONFIRMED',
  'SIGNATURE_CAPTURED',
  'QC_PHOTOS',
  'OFFICE_NOTIFIED',
  'BILLING_REVIEW',
  'INVOICE_SENT',
  'PAYMENT_RECEIVED',
  'JOB_CLOSED',
]);

const IN_TRANSIT_STAGES = new Set([
  'DEPARTURE_CONFIRMED',
  'EN_ROUTE',
  'ARRIVED_AT_SITE',
  'UNLOADING',
]);

export default function MaterialOrdersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const [orders, setOrders] = useState<PipelineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [seeding, setSeeding] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await fetch('/api/portal/material-orders');
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Seed test orders — tries JN first (any job with "test" in the name),
  // falls back to 4 hardcoded fake jobs. All tagged with [TEST] for easy
  // cleanup. Admin/owner only.
  const seedTestOrders = async () => {
    setSeeding(true);
    setSeedMessage(null);
    try {
      const res = await fetch('/api/admin/seed-test-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 4 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Seed failed');
      setSeedMessage(
        `${data.summary.created} created · ${data.summary.skipped} skipped · ` +
        (data.summary.jnConfigured
          ? `${data.summary.jnJobsFound} JN test jobs found`
          : 'JN not configured, used fallbacks')
      );
      await fetchOrders();
    } catch (err) {
      setSeedMessage(
        `Seed failed: ${err instanceof Error ? err.message : 'unknown error'}`
      );
    } finally {
      setSeeding(false);
    }
  };

  // Cancel all [TEST]-tagged orders and release their holds
  const cleanupTestOrders = async () => {
    if (!confirm('Cancel all [TEST] orders? This releases their inventory holds.')) return;
    setCleaning(true);
    setSeedMessage(null);
    try {
      const res = await fetch('/api/admin/seed-test-orders', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Cleanup failed');
      setSeedMessage(`Cancelled ${data.cancelled} test order${data.cancelled === 1 ? '' : 's'}`);
      await fetchOrders();
    } catch (err) {
      setSeedMessage(
        `Cleanup failed: ${err instanceof Error ? err.message : 'unknown error'}`
      );
    } finally {
      setCleaning(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const refresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const toggleOrderExpand = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getStageBadge = (stage: string) => {
    const label = STAGE_LABELS[stage] || stage;
    const color = STAGE_BADGE_COLORS[stage] || 'bg-zinc-700/50 text-zinc-400';
    return (
      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${color}`}>
        {label}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => (
    <span
      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
        PRIORITY_BADGE_COLORS[priority] || PRIORITY_BADGE_COLORS.normal
      }`}
    >
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );

  const filteredOrders = orders.filter((order) => {
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      if (
        !order.orderId.toLowerCase().includes(lower) &&
        !order.jobName.toLowerCase().includes(lower) &&
        !order.jobNumber.toLowerCase().includes(lower) &&
        !order.customerName.toLowerCase().includes(lower)
      ) {
        return false;
      }
    }
    if (stageFilter !== 'all' && order.currentStage !== stageFilter) return false;
    if (order.cancelled) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-brand-green/10 border border-brand-green/30 flex items-center justify-center">
              <Package className="text-brand-green" size={32} />
            </div>
            <div className="absolute inset-0 rounded-2xl border-2 border-brand-green/30 animate-ping opacity-50" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold text-white">Loading Orders</h2>
            <p className="text-sm text-zinc-500 mt-1">Fetching material orders...</p>
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
              <h1 className="text-lg font-bold text-white">Material Orders</h1>
              <p className="text-xs text-zinc-500">Create and manage material order requests</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-800 transition-colors text-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={seedTestOrders}
                  disabled={seeding || cleaning}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-500/15 text-purple-300 border border-purple-500/30 rounded-xl hover:bg-purple-500/25 transition-colors text-sm font-bold disabled:opacity-50"
                  title="Create a few test orders from JobNimbus jobs named 'test', or fallback fake jobs"
                >
                  {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Seed Test Orders
                </button>
                <button
                  onClick={cleanupTestOrders}
                  disabled={seeding || cleaning}
                  className="flex items-center gap-2 px-3 py-2 bg-red-500/15 text-red-300 border border-red-500/30 rounded-xl hover:bg-red-500/25 transition-colors text-sm font-bold disabled:opacity-50"
                  title="Cancel all [TEST]-tagged orders and release their holds"
                >
                  {cleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Cleanup Tests
                </button>
              </>
            )}
            <Link
              href="/portal/delivery/pipeline"
              className="flex items-center gap-2 px-3 py-2 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-800 transition-colors text-sm"
            >
              <Truck className="w-4 h-4" /> Pipeline View
            </Link>
            <Link
              href="/portal/orders/new"
              className="flex items-center gap-2 px-3 py-2 bg-brand-green text-black rounded-xl hover:brightness-90 transition-all text-sm font-bold"
            >
              <Plus className="w-4 h-4" /> New Order
            </Link>
          </div>
        </div>
        {seedMessage && (
          <div className="mt-3 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-xs text-purple-200">
            {seedMessage}
          </div>
        )}
      </header>

      {/* Filters */}
      <div className="px-4 md:px-6 py-3 bg-zinc-900/50 border-b border-zinc-800">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input
                type="text"
                placeholder="Search by order ID, job, or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm placeholder-zinc-600 focus:ring-1 focus:ring-brand-green focus:border-brand-green"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-600" />
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm focus:ring-1 focus:ring-brand-green"
            >
              <option value="all">All Stages</option>
              {Object.entries(STAGE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="px-4 md:px-6 py-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 mx-auto mb-4 text-zinc-700" />
            <h3 className="text-base font-bold text-white mb-1">No Orders Found</h3>
            <p className="text-zinc-500 text-sm">Create a new material order to get started</p>
            <Link
              href="/portal/orders/new"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-brand-green text-black rounded-xl hover:brightness-90 transition-all text-sm font-bold"
            >
              <Plus className="w-4 h-4" /> New Order
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const isExpanded = expandedOrders.has(order.orderId);
              const isDelivered = DELIVERED_STAGES.has(order.currentStage);
              const isInTransit = IN_TRANSIT_STAGES.has(order.currentStage);

              return (
                <div key={order.orderId} className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                  {/* Order Header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                    onClick={() => toggleOrderExpand(order.orderId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center flex-shrink-0">
                          <Package className="w-5 h-5 text-brand-green" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-sm">{order.orderId}</span>
                            {getStageBadge(order.currentStage)}
                            {getPriorityBadge(order.priority)}
                          </div>
                          <p className="text-xs text-zinc-500 truncate">
                            {order.jobName} · {order.customerName}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        <div className="text-right">
                          <div className="font-bold text-brand-green text-sm">
                            {formatCurrency(order.totalPrice)}
                          </div>
                          <div className="text-[11px] text-zinc-600">{order.items.length} items</div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-zinc-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-600" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Order Details (Expanded) */}
                  {isExpanded && (
                    <div className="border-t border-zinc-800 p-4 bg-zinc-900/50">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-bold text-white text-sm mb-2">Customer & Delivery</h4>
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center gap-2 text-zinc-400">
                              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">
                                {order.deliveryAddress}, {order.deliveryCity}, {order.deliveryState} {order.deliveryZip}
                              </span>
                            </div>
                            {order.customerPhone && (
                              <div className="flex items-center gap-2 text-zinc-400">
                                <Phone className="w-3.5 h-3.5" />
                                <a href={`tel:${order.customerPhone}`} className="text-brand-green">
                                  {order.customerPhone}
                                </a>
                              </div>
                            )}
                            {order.customerEmail && (
                              <div className="flex items-center gap-2 text-zinc-400">
                                <Mail className="w-3.5 h-3.5" /> {order.customerEmail}
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-zinc-400">
                              <Calendar className="w-3.5 h-3.5" /> Requested: {formatDate(order.requestedDeliveryDate)}
                            </div>
                            {order.scheduledDeliveryDate && (
                              <div className="flex items-center gap-2 text-zinc-400">
                                <Clock className="w-3.5 h-3.5" /> Scheduled: {formatDate(order.scheduledDeliveryDate)}
                              </div>
                            )}
                            {order.assignedDriverName && (
                              <div className="flex items-center gap-2 text-zinc-400">
                                <Truck className="w-3.5 h-3.5" /> Driver: {order.assignedDriverName}
                              </div>
                            )}
                            <div className="text-zinc-600">
                              Created by {order.createdByName} · {formatDate(order.createdAt)}
                            </div>
                          </div>
                          {order.specialInstructions && (
                            <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-sm text-yellow-400">
                              <span className="font-bold">⚠ Instructions:</span> {order.specialInstructions}
                            </div>
                          )}
                        </div>

                        <div>
                          <h4 className="font-bold text-white text-sm mb-2">Materials</h4>
                          <div className="space-y-1">
                            {order.items.map((item) => (
                              <div
                                key={item.productId}
                                className="flex items-center justify-between text-sm py-1.5 border-b border-zinc-800/60 last:border-0"
                              >
                                <div className="min-w-0 flex-1">
                                  <span className="font-medium text-zinc-300">{item.productName}</span>
                                  <span className="text-zinc-600 ml-2 text-xs">×{item.quantity} {item.unit}</span>
                                </div>
                                <span className="font-bold text-zinc-300 text-xs flex-shrink-0">
                                  {formatCurrency(item.totalPrice)}
                                </span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between pt-2 font-bold text-sm">
                              <span className="text-zinc-400">Total</span>
                              <span className="text-brand-green">{formatCurrency(order.totalPrice)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-zinc-800 flex flex-wrap gap-2">
                        <Link
                          href={`/portal/orders/${order.orderId}`}
                          className="flex items-center gap-1 px-3 py-1.5 bg-brand-green text-black rounded-lg hover:brightness-90 text-xs font-bold transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Details
                        </Link>
                        <Link
                          href="/portal/delivery/pipeline"
                          className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 text-xs font-medium transition-colors"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" /> Pipeline View
                        </Link>
                        {isInTransit && (
                          <Link
                            href={`/portal/delivery/${order.orderId}`}
                            className="flex items-center gap-1 px-3 py-1.5 bg-brand-green/15 text-brand-green rounded-lg hover:bg-brand-green/25 text-xs font-bold transition-colors"
                          >
                            <Navigation className="w-3.5 h-3.5" /> Track
                          </Link>
                        )}
                        {isDelivered && (
                          <>
                            <Link
                              href={`/portal/orders/${order.orderId}/return`}
                              className="flex items-center gap-1 px-3 py-1.5 bg-orange-500/15 text-orange-400 rounded-lg hover:bg-orange-500/25 text-xs font-bold transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Return
                            </Link>
                            <Link
                              href={`/portal/orders/${order.orderId}?tab=invoice`}
                              className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/15 text-purple-400 rounded-lg hover:bg-purple-500/25 text-xs font-bold transition-colors"
                            >
                              <Receipt className="w-3.5 h-3.5" /> Invoice
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
