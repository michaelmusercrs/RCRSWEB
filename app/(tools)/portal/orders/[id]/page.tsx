'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  Truck,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Circle,
  User,
  Building,
  Navigation,
  Camera,
  FileText,
  ClipboardCheck,
  RefreshCw,
  ExternalLink,
  RotateCcw,
  Receipt,
  Printer,
  Loader2,
  ChevronRight,
} from 'lucide-react';

// Pipeline order shape — matches lib/material-order-pipeline.ts PipelineOrder
interface PipelineOrderItem {
  itemId: string;
  productId: string;
  productName: string;
  sku: string;
  category: string;
  quantity: number;
  unit: string;
  unitCost?: number;     // hidden for sales/driver roles
  unitPrice: number;
  totalCost?: number;    // hidden for sales/driver roles
  totalPrice: number;
  pulledQty: number;
  verifiedQty: number;
  deliveredQty: number;
  returnedQty: number;
  holdId?: string;
  notes?: string;
}

interface PipelineEvent {
  eventId: string;
  orderId: string;
  stage: string;
  timestamp: string;
  performedBy: string;
  performedByName: string;
  performedByRole: string;
  photoUrls: string[];
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAddress?: string;
  notes?: string;
  metadata?: string;
}

interface PipelineOrder {
  orderId: string;
  currentStage: string;
  priority: 'normal' | 'rush' | 'urgent';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
  jobId?: string;
  jobNimbusId?: string;
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
  scheduledDeliveryTime?: string;
  assignedDriverId?: string;
  assignedDriverName?: string;
  items: PipelineOrderItem[];
  totalCost?: number;
  totalPrice: number;
  customerInvoiceId?: string;
  internalInvoiceId?: string;
  paymentStatus: string;
  paymentAmount?: number;
  paymentDate?: string;
  specialInstructions?: string;
  notes?: string;
  cancelled: boolean;
  cancelReason?: string;
  completedAt?: string;
  events: PipelineEvent[];
}

interface PipelineInvoice {
  invoiceId: string;
  orderId: string;
  type: 'customer' | 'internal';
  jobNumber: string;
  jobName: string;
  customerName: string;
  customerEmail?: string;
  items: {
    productName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    unitCost?: number;
    totalCost?: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  costTotal?: number;
  margin?: number;
  status: 'draft' | 'sent' | 'paid' | 'void';
  createdAt: string;
  sentAt?: string;
  paidAt?: string;
  paidAmount?: number;
}

// 18 pipeline stages — order, label, icon, role
const PIPELINE_STAGES = [
  'ORDER_CREATED',
  'ORDER_REVIEWED',
  'DRIVER_ASSIGNED',
  'WAREHOUSE_NOTIFIED',
  'MATERIALS_PULLED',
  'LOAD_VERIFIED',
  'DEPARTURE_CONFIRMED',
  'EN_ROUTE',
  'ARRIVED_AT_SITE',
  'UNLOADING',
  'DELIVERY_CONFIRMED',
  'SIGNATURE_CAPTURED',
  'QC_PHOTOS',
  'OFFICE_NOTIFIED',
  'BILLING_REVIEW',
  'INVOICE_SENT',
  'PAYMENT_RECEIVED',
  'JOB_CLOSED',
] as const;

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

const PRIORITY_BADGE_COLORS: Record<string, string> = {
  normal: 'bg-zinc-700/50 text-zinc-300',
  rush: 'bg-orange-500/20 text-orange-400',
  urgent: 'bg-red-500/20 text-red-400',
};

type Tab = 'details' | 'timeline' | 'invoice';

export default function OrderDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params.id as string;
  const initialTab = (searchParams.get('tab') as Tab) || 'details';

  const [order, setOrder] = useState<PipelineOrder | null>(null);
  const [invoices, setInvoices] = useState<PipelineInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    try {
      const [orderRes, invoiceRes] = await Promise.all([
        fetch(`/api/portal/pipeline?action=order&orderId=${orderId}`),
        fetch(`/api/portal/pipeline?action=invoices&orderId=${orderId}`),
      ]);
      if (orderRes.ok) {
        const data = await orderRes.json();
        setOrder(data);
      } else {
        setOrder(null);
      }
      if (invoiceRes.ok) {
        const inv = await invoiceRes.json();
        setInvoices(Array.isArray(inv) ? inv : []);
      }
    } catch (error) {
      console.error('Error fetching order:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const refreshOrder = () => {
    setRefreshing(true);
    fetchOrder();
  };

  // Advance to the next stage (uses /api/portal/pipeline transitionStage).
  // Stages that require photos/GPS will fail server-side with a clear error
  // — those need to be advanced from the driver/warehouse pages instead.
  const advanceToNextStage = async () => {
    if (!order) return;
    const idx = PIPELINE_STAGES.indexOf(order.currentStage as typeof PIPELINE_STAGES[number]);
    if (idx === -1 || idx >= PIPELINE_STAGES.length - 1) return;
    const nextStage = PIPELINE_STAGES[idx + 1];

    // PAYMENT_RECEIVED requires a payment amount; prompt for it.
    let paymentAmount: number | undefined;
    if (nextStage === 'PAYMENT_RECEIVED') {
      const input = prompt(`Payment amount for order ${order.orderId}?`, String(order.totalPrice));
      if (!input) return;
      const parsed = parseFloat(input);
      if (isNaN(parsed) || parsed <= 0) {
        alert('Invalid payment amount');
        return;
      }
      paymentAmount = parsed;
    }

    setAdvancing(true);
    setAdvanceError(null);
    try {
      const res = await fetch('/api/portal/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transitionStage',
          orderId: order.orderId,
          stage: nextStage,
          paymentAmount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdvanceError(data.error || `Failed to advance to ${nextStage}`);
      } else {
        await fetchOrder();
      }
    } catch (err) {
      console.error('Stage advance failed:', err);
      setAdvanceError(err instanceof Error ? err.message : 'Stage advance failed');
    } finally {
      setAdvancing(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const getGoogleMapsUrl = () => {
    if (!order) return '';
    const address = encodeURIComponent(
      `${order.deliveryAddress}, ${order.deliveryCity}, ${order.deliveryState} ${order.deliveryZip}`
    );
    return `https://www.google.com/maps/dir/?api=1&destination=${address}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-brand-green animate-spin" />
          <p className="text-zinc-500">Loading order...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Package className="w-12 h-12 mx-auto mb-4 text-zinc-700" />
          <h2 className="text-xl font-semibold text-white mb-2">Order Not Found</h2>
          <p className="text-zinc-500 mb-4">
            The order <code className="text-zinc-300">{orderId}</code> does not exist.
          </p>
          <Link href="/portal/orders" className="text-brand-green hover:underline font-medium">
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const currentStageIdx = PIPELINE_STAGES.indexOf(order.currentStage as typeof PIPELINE_STAGES[number]);
  const nextStage = currentStageIdx >= 0 && currentStageIdx < PIPELINE_STAGES.length - 1
    ? PIPELINE_STAGES[currentStageIdx + 1]
    : null;
  const isInTransit = ['DEPARTURE_CONFIRMED', 'EN_ROUTE', 'ARRIVED_AT_SITE', 'UNLOADING'].includes(
    order.currentStage
  );
  const isDelivered = currentStageIdx >= PIPELINE_STAGES.indexOf('DELIVERY_CONFIRMED');

  // Customer-facing invoice (final price only) and internal invoice (with cost)
  const customerInvoice = invoices.find((i) => i.type === 'customer');
  const internalInvoice = invoices.find((i) => i.type === 'internal');

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 md:px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/portal/orders"
              className="text-zinc-500 hover:text-brand-green transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-white">{order.orderId}</h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-green/20 text-brand-green">
                  {STAGE_LABELS[order.currentStage] || order.currentStage}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    PRIORITY_BADGE_COLORS[order.priority] || PRIORITY_BADGE_COLORS.normal
                  }`}
                >
                  {order.priority.charAt(0).toUpperCase() + order.priority.slice(1)}
                </span>
                {order.cancelled && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/20 text-red-400">
                    Cancelled
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 truncate">
                {order.jobName} · {order.customerName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshOrder}
              disabled={refreshing}
              className="p-2 text-zinc-500 hover:text-brand-green hover:bg-zinc-800 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            {isInTransit && (
              <a
                href={getGoogleMapsUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-brand-green text-black rounded-xl hover:brightness-90 text-sm font-bold"
              >
                <Navigation className="w-4 h-4" /> Navigate
              </a>
            )}
            {nextStage && !order.cancelled && (
              <button
                onClick={advanceToNextStage}
                disabled={advancing}
                className="flex items-center gap-2 px-3 py-2 bg-brand-green/15 text-brand-green border border-brand-green/30 rounded-xl hover:bg-brand-green/25 text-sm font-bold disabled:opacity-50"
                title={`Advance to ${STAGE_LABELS[nextStage] || nextStage}`}
              >
                {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                Advance to {STAGE_LABELS[nextStage] || nextStage}
              </button>
            )}
          </div>
        </div>
        {advanceError && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            <strong>Could not advance stage:</strong> {advanceError}
          </div>
        )}
      </header>

      {/* Stage Progress (compact, all 18 stages) */}
      <div className="bg-zinc-900/50 border-b border-zinc-800 px-4 md:px-6 py-4 overflow-x-auto">
        <div className="flex items-center min-w-max">
          {PIPELINE_STAGES.map((stage, idx) => {
            const isComplete = idx < currentStageIdx;
            const isActive = idx === currentStageIdx;
            return (
              <div key={stage} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      isComplete
                        ? 'bg-brand-green text-black'
                        : isActive
                        ? 'bg-brand-green/30 text-brand-green border-2 border-brand-green'
                        : 'bg-zinc-800 text-zinc-600'
                    }`}
                  >
                    {isComplete ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span
                    className={`mt-1 text-[10px] font-medium whitespace-nowrap ${
                      isComplete || isActive ? 'text-zinc-300' : 'text-zinc-600'
                    }`}
                  >
                    {STAGE_LABELS[stage]}
                  </span>
                </div>
                {idx < PIPELINE_STAGES.length - 1 && (
                  <div
                    className={`w-6 h-0.5 mx-1 ${
                      idx < currentStageIdx ? 'bg-brand-green' : 'bg-zinc-800'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 md:px-6">
        <div className="flex gap-6">
          {[
            { id: 'details' as Tab, label: 'Order Details', icon: FileText },
            { id: 'timeline' as Tab, label: 'Timeline', icon: Clock },
            { id: 'invoice' as Tab, label: 'Invoice', icon: Receipt },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-1 py-3 border-b-2 font-medium transition-colors text-sm ${
                activeTab === tab.id
                  ? 'border-brand-green text-brand-green'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        {activeTab === 'details' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Job Info */}
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
                <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <Building className="w-4 h-4 text-brand-green" />
                  Job Information
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-zinc-500">Job Number</div>
                    <div className="font-medium text-white">{order.jobNumber || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Job Name</div>
                    <div className="font-medium text-white">{order.jobName}</div>
                  </div>
                  {order.jobNimbusId && (
                    <div className="md:col-span-2">
                      <a
                        href={`https://app.jobnimbus.com/contact/${order.jobNimbusId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-brand-green hover:underline text-sm"
                      >
                        View in JobNimbus
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Info */}
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
                <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-brand-green" />
                  Customer & Delivery Location
                </h2>
                <div className="space-y-3">
                  <div className="font-medium text-lg text-white">{order.customerName}</div>
                  <div className="flex items-start gap-2 text-zinc-400 text-sm">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      {order.deliveryAddress}
                      <br />
                      {order.deliveryCity}, {order.deliveryState} {order.deliveryZip}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    {order.customerPhone && (
                      <a
                        href={`tel:${order.customerPhone}`}
                        className="flex items-center gap-1 text-brand-green hover:underline text-sm"
                      >
                        <Phone className="w-4 h-4" />
                        {order.customerPhone}
                      </a>
                    )}
                    {order.customerEmail && (
                      <a
                        href={`mailto:${order.customerEmail}`}
                        className="flex items-center gap-1 text-brand-green hover:underline text-sm"
                      >
                        <Mail className="w-4 h-4" />
                        {order.customerEmail}
                      </a>
                    )}
                  </div>
                  <a
                    href={getGoogleMapsUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 bg-brand-green/15 text-brand-green border border-brand-green/30 rounded-lg hover:bg-brand-green/25 text-sm font-medium mt-2"
                  >
                    <Navigation className="w-4 h-4" />
                    Open in Google Maps
                  </a>
                </div>
              </div>

              {/* Materials */}
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
                <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4 text-brand-green" />
                  Materials ({order.items.length} {order.items.length === 1 ? 'item' : 'items'})
                </h2>
                <div className="space-y-2">
                  {order.items.map((item) => {
                    const fullyDelivered = item.deliveredQty >= item.quantity;
                    const partial = item.deliveredQty > 0 && item.deliveredQty < item.quantity;
                    const verified = item.verifiedQty >= item.quantity;
                    const pulled = item.pulledQty >= item.quantity;
                    return (
                      <div
                        key={item.itemId}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          fullyDelivered
                            ? 'bg-brand-green/5 border-brand-green/20'
                            : partial
                            ? 'bg-yellow-500/5 border-yellow-500/20'
                            : verified
                            ? 'bg-cyan-500/5 border-cyan-500/20'
                            : pulled
                            ? 'bg-blue-500/5 border-blue-500/20'
                            : 'bg-zinc-800/50 border-zinc-800'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {fullyDelivered ? (
                            <CheckCircle className="w-5 h-5 text-brand-green flex-shrink-0" />
                          ) : verified || pulled ? (
                            <Circle className="w-5 h-5 text-zinc-400 flex-shrink-0" />
                          ) : (
                            <Circle className="w-5 h-5 text-zinc-600 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-white text-sm truncate">
                              {item.productName}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {item.sku} · {formatCurrency(item.unitPrice)}/{item.unit}
                              {item.pulledQty > 0 && ` · pulled ${item.pulledQty}`}
                              {item.deliveredQty > 0 && ` · delivered ${item.deliveredQty}`}
                              {item.returnedQty > 0 && ` · returned ${item.returnedQty}`}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-medium text-white">×{item.quantity}</div>
                          <div className="text-xs text-brand-green">
                            {formatCurrency(item.totalPrice)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between items-center">
                  <span className="font-bold text-white">Total</span>
                  <span className="text-xl font-bold text-brand-green">
                    {formatCurrency(order.totalPrice)}
                  </span>
                </div>
                {typeof order.totalCost === 'number' && (
                  <div className="mt-1 flex justify-between items-center text-xs text-zinc-500">
                    <span>Cost (internal)</span>
                    <span>{formatCurrency(order.totalCost)}</span>
                  </div>
                )}
              </div>

              {/* Special Instructions */}
              {order.specialInstructions && (
                <div className="bg-yellow-500/5 rounded-xl border border-yellow-500/20 p-6">
                  <h2 className="text-base font-bold text-yellow-400 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Special Instructions
                  </h2>
                  <p className="text-yellow-300 text-sm">{order.specialInstructions}</p>
                </div>
              )}

              {order.notes && (
                <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
                  <h2 className="text-base font-bold text-white mb-2">Internal Notes</h2>
                  <p className="text-zinc-400 text-sm whitespace-pre-wrap">{order.notes}</p>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Delivery Schedule */}
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
                <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-brand-green" />
                  Delivery Schedule
                </h2>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-zinc-500">Requested</div>
                    <div className="font-medium text-white">
                      {formatDate(order.requestedDeliveryDate)}
                    </div>
                  </div>
                  {order.scheduledDeliveryDate && (
                    <div>
                      <div className="text-xs text-zinc-500">Scheduled</div>
                      <div className="font-medium text-brand-green">
                        {formatDate(order.scheduledDeliveryDate)}
                        {order.scheduledDeliveryTime && ` at ${order.scheduledDeliveryTime}`}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Driver Info */}
              {order.assignedDriverName && (
                <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
                  <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-brand-green" />
                    Assigned Driver
                  </h2>
                  <div className="font-medium text-white">{order.assignedDriverName}</div>
                </div>
              )}

              {/* Payment Status */}
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
                <h2 className="text-base font-bold text-white mb-3">Payment Status</h2>
                <div className="text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-zinc-400">Status</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        order.paymentStatus === 'paid'
                          ? 'bg-brand-green/20 text-brand-green'
                          : order.paymentStatus === 'invoiced'
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : order.paymentStatus === 'partial'
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-zinc-700/50 text-zinc-400'
                      }`}
                    >
                      {order.paymentStatus.toUpperCase()}
                    </span>
                  </div>
                  {order.paymentAmount && (
                    <div className="flex justify-between text-zinc-400">
                      <span>Amount</span>
                      <span className="text-white font-medium">
                        {formatCurrency(order.paymentAmount)}
                      </span>
                    </div>
                  )}
                  {order.paymentDate && (
                    <div className="flex justify-between text-zinc-400">
                      <span>Paid on</span>
                      <span>{formatDate(order.paymentDate)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
                <h2 className="text-base font-bold text-white mb-4">Quick Actions</h2>
                <div className="space-y-2">
                  <Link
                    href="/portal/delivery/pipeline"
                    className="flex items-center gap-2 w-full px-3 py-2 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-800 text-sm"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    Pipeline View
                  </Link>
                  <Link
                    href={`/portal/delivery/${order.orderId}`}
                    className="flex items-center gap-2 w-full px-3 py-2 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-800 text-sm"
                  >
                    <Truck className="w-4 h-4" />
                    Driver View
                  </Link>
                  {isDelivered && (
                    <Link
                      href={`/portal/orders/${order.orderId}/return`}
                      className="flex items-center gap-2 w-full px-3 py-2 border border-orange-500/30 text-orange-400 rounded-lg hover:bg-orange-500/10 text-sm"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Create Return
                    </Link>
                  )}
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 w-full px-3 py-2 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-800 text-sm"
                  >
                    <Printer className="w-4 h-4" />
                    Print Order
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <h2 className="text-base font-bold text-white mb-6 flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-green" />
              Stage History ({order.events.length} events)
            </h2>
            <div className="space-y-4">
              {[...order.events].reverse().map((event) => (
                <div key={event.eventId} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-green/10 border border-brand-green/30 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-brand-green" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium text-white text-sm">
                        {STAGE_LABELS[event.stage] || event.stage}
                      </div>
                      <span className="text-xs text-zinc-500">
                        {formatDate(event.timestamp)} at {formatTime(event.timestamp)}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500">
                      by {event.performedByName}
                      {event.performedByRole && ` (${event.performedByRole})`}
                    </div>
                    {event.notes && (
                      <div className="mt-1 text-sm text-zinc-300">{event.notes}</div>
                    )}
                    {event.gpsAddress && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                        <MapPin className="w-3 h-3" />
                        {event.gpsAddress}
                      </div>
                    )}
                    {event.photoUrls && event.photoUrls.length > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-cyan-400">
                        <Camera className="w-3 h-3" />
                        {event.photoUrls.length} {event.photoUrls.length === 1 ? 'photo' : 'photos'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {order.events.length === 0 && (
                <p className="text-zinc-500 text-sm">No stage events recorded yet.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'invoice' && (
          <div className="space-y-6">
            {/* Customer Invoice */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
              <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-brand-green" />
                Customer Invoice
              </h2>
              {customerInvoice ? (
                <div>
                  <div className="flex items-center justify-between p-3 bg-brand-green/5 rounded-lg mb-4">
                    <div>
                      <div className="font-medium text-white">{customerInvoice.invoiceId}</div>
                      <div className="text-xs text-zinc-500">
                        Status:{' '}
                        <span className="font-medium text-brand-green uppercase">
                          {customerInvoice.status}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-brand-green">
                        {formatCurrency(customerInvoice.total)}
                      </div>
                      {customerInvoice.paidAmount && (
                        <div className="text-xs text-zinc-500">
                          Paid: {formatCurrency(customerInvoice.paidAmount)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    {customerInvoice.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between py-1 border-b border-zinc-800/60 last:border-0"
                      >
                        <span className="text-zinc-300">
                          {item.productName} ×{item.quantity}
                        </span>
                        <span className="text-white">{formatCurrency(item.totalPrice)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-zinc-500 text-sm">
                  Customer invoice will be generated automatically when the order reaches Billing
                  Review.
                </p>
              )}
            </div>

            {/* Internal Invoice (cost/margin) */}
            {internalInvoice && (
              <div className="bg-zinc-900 rounded-xl border border-purple-500/20 p-6">
                <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-purple-400" />
                  Internal Invoice
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                    Admin/Office Only
                  </span>
                </h2>
                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-zinc-500">Cost</div>
                    <div className="font-bold text-white">
                      {formatCurrency(internalInvoice.costTotal || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Total</div>
                    <div className="font-bold text-white">
                      {formatCurrency(internalInvoice.total)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Margin</div>
                    <div className="font-bold text-brand-green">
                      {formatCurrency(internalInvoice.margin || 0)}
                    </div>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  {internalInvoice.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between py-1 border-b border-zinc-800/60 last:border-0"
                    >
                      <span className="text-zinc-300">
                        {item.productName} ×{item.quantity}
                      </span>
                      <div className="text-right">
                        <div className="text-white">{formatCurrency(item.totalPrice)}</div>
                        {item.totalCost && (
                          <div className="text-xs text-zinc-500">
                            Cost: {formatCurrency(item.totalCost)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
