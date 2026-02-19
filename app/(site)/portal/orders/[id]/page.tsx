'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
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
  Edit,
  RotateCcw,
  Receipt,
  Printer,
  Ticket,
  Loader2,
} from 'lucide-react';

interface OrderItem {
  itemId: string;
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  pulled: boolean;
  verified: boolean;
}

interface MaterialOrder {
  orderId: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  status: string;
  priority: string;
  jobNumber: string;
  jobName: string;
  jobNimbusId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress: string;
  city: string;
  state: string;
  zipCode: string;
  requestedDeliveryDate: string;
  requestedDeliveryTime?: string;
  scheduledDeliveryDate?: string;
  scheduledDeliveryTime?: string;
  estimatedArrival?: string;
  assignedDriver?: string;
  assignedDriverName?: string;
  assignedVehicle?: string;
  items: OrderItem[];
  totalItems: number;
  totalPrice: number;
  specialInstructions?: string;
  internalNotes?: string;
  approvedBy?: string;
  approvedAt?: string;
  loadedAt?: string;
  loadedBy?: string;
  departedAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  invoiceId?: string;
  invoiceStatus?: string;
  hasBreakdownSheet: boolean;
  inspectorRequired: boolean;
  inspectorName?: string;
  inspectorPhone?: string;
  inspectorArrivalTime?: string;
  qualityCheckComplete: boolean;
  qualityCheckBy?: string;
  qualityCheckAt?: string;
}

const STATUS_STEPS = [
  { key: 'submitted', label: 'Submitted', icon: FileText },
  { key: 'approved', label: 'Approved', icon: CheckCircle },
  { key: 'processing', label: 'Processing', icon: ClipboardCheck },
  { key: 'loading', label: 'Loading', icon: Package },
  { key: 'ready_for_delivery', label: 'Ready', icon: Truck },
  { key: 'in_transit', label: 'In Transit', icon: Navigation },
  { key: 'delivered', label: 'Delivered', icon: MapPin },
  { key: 'completed', label: 'Complete', icon: CheckCircle },
];

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [order, setOrder] = useState<MaterialOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'tracking' | 'quality' | 'invoice'>('details');
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [linkedTicketId, setLinkedTicketId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  async function fetchOrder() {
    try {
      const response = await fetch(`/api/portal/orders/workflow?orderId=${orderId}`);
      if (response.ok) {
        const data = await response.json();
        setOrder(data);
      }
    } catch (error) {
      console.error('Error fetching order:', error);
    } finally {
      setLoading(false);
    }
  }

  async function refreshOrder() {
    setRefreshing(true);
    await fetchOrder();
    setRefreshing(false);
  }

  async function createTicketFromOrder() {
    if (!order) return;
    setCreatingTicket(true);
    try {
      const response = await fetch('/api/portal/material-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-ticket-from-job',
          jobId: order.jobNumber,
          jobName: order.jobName,
          jobAddress: order.customerAddress,
          city: order.city,
          state: order.state,
          zip: order.zipCode,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          customerEmail: order.customerEmail,
          salesRep: order.createdByName,
          createdBy: order.createdBy || 'system',
          createdByName: order.createdByName || 'System',
          requestedDate: order.requestedDeliveryDate,
          priority: order.priority || 'normal',
          specialInstructions: order.specialInstructions,
          materials: (order.items || []).map((item: OrderItem) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            category: item.category,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.ticket?.ticketId) {
          setLinkedTicketId(data.ticket.ticketId);
        }
      }
    } catch (error) {
      console.error('Error creating ticket from order:', error);
    } finally {
      setCreatingTicket(false);
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusIndex = (status: string) => {
    return STATUS_STEPS.findIndex(s => s.key === status);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'delivered':
        return 'bg-green-500/20 text-green-400';
      case 'in_transit':
      case 'ready_for_delivery':
      case 'loading':
        return 'bg-brand-green/20 text-blue-400';
      case 'processing':
      case 'approved':
        return 'bg-purple-500/20 text-purple-400';
      case 'submitted':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'cancelled':
        return 'bg-red-500/20 text-red-400';
      case 'on_hold':
        return 'bg-orange-500/20 text-orange-400';
      default:
        return 'bg-white/10 text-neutral-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500/20 text-red-400';
      case 'rush':
        return 'bg-orange-500/20 text-orange-400';
      default:
        return 'bg-white/10 text-neutral-300';
    }
  };

  const getGoogleMapsUrl = () => {
    if (!order) return '';
    const address = encodeURIComponent(
      `${order.customerAddress}, ${order.city}, ${order.state} ${order.zipCode}`
    );
    return `https://www.google.com/maps/dir/?api=1&destination=${address}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">Order Not Found</h2>
          <p className="text-neutral-500 mb-4">The order you are looking for does not exist.</p>
          <Link href="/portal/orders" className="text-green-400 hover:text-green-400 font-medium">
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const currentStatusIndex = getStatusIndex(order.status);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/portal/orders" className="text-neutral-500 hover:text-neutral-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-neutral-900">{order.orderId}</h1>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                  {order.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(order.priority)}`}>
                  {order.priority.charAt(0).toUpperCase() + order.priority.slice(1)}
                </span>
              </div>
              <p className="text-sm text-neutral-500">{order.jobName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={refreshOrder}
              disabled={refreshing}
              className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {order.status === 'ready_for_delivery' || order.status === 'in_transit' ? (
              <a
                href={getGoogleMapsUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-brand-green text-black rounded-lg hover:bg-blue-700"
              >
                <Navigation className="w-4 h-4" />
                Navigate
              </a>
            ) : null}

            {order.status === 'submitted' && (
              <Link
                href={`/portal/orders/${order.orderId}/edit`}
                className="flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50"
              >
                <Edit className="w-4 h-4" />
                Edit
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Status Progress */}
      <div className="bg-white border-b border-neutral-200 px-6 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            {STATUS_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx === currentStatusIndex;
              const isComplete = idx < currentStatusIndex;
              const isFuture = idx > currentStatusIndex;

              return (
                <div key={step.key} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isComplete
                          ? 'bg-green-600 text-white'
                          : isActive
                          ? 'bg-brand-green text-black'
                          : 'bg-neutral-200 text-neutral-400'
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <span
                      className={`mt-2 text-xs font-medium ${
                        isComplete || isActive ? 'text-neutral-900' : 'text-neutral-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {idx < STATUS_STEPS.length - 1 && (
                    <div
                      className={`w-16 h-0.5 mx-2 ${
                        idx < currentStatusIndex ? 'bg-green-600' : 'bg-neutral-200'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-neutral-200 px-6">
        <div className="flex gap-6">
          {[
            { id: 'details', label: 'Order Details', icon: FileText },
            { id: 'tracking', label: 'Tracking', icon: Truck },
            { id: 'quality', label: 'Quality Check', icon: ClipboardCheck },
            { id: 'invoice', label: 'Invoice', icon: Receipt },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-green-600 text-green-400'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {activeTab === 'details' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Job Info */}
              <div className="bg-neutral-900 rounded-xl border border-neutral-200 p-6">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <Building className="w-5 h-5 text-green-400" />
                  Job Information
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-neutral-500">Job Number</div>
                    <div className="font-medium">{order.jobNumber}</div>
                  </div>
                  <div>
                    <div className="text-sm text-neutral-500">Job Name</div>
                    <div className="font-medium">{order.jobName}</div>
                  </div>
                  {order.jobNimbusId && (
                    <div className="md:col-span-2">
                      <a
                        href={`https://app.jobnimbus.com/contact/${order.jobNimbusId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-green-400 hover:text-green-400 text-sm"
                      >
                        View in JobNimbus
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Info */}
              <div className="bg-neutral-900 rounded-xl border border-neutral-200 p-6">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-green-400" />
                  Customer & Delivery Location
                </h2>
                <div className="space-y-3">
                  <div className="font-medium text-lg">{order.customerName}</div>
                  <div className="flex items-start gap-2 text-neutral-600">
                    <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
                    <div>
                      {order.customerAddress}<br />
                      {order.city}, {order.state} {order.zipCode}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <a
                      href={`tel:${order.customerPhone}`}
                      className="flex items-center gap-1 text-green-400 hover:text-green-400"
                    >
                      <Phone className="w-4 h-4" />
                      {order.customerPhone}
                    </a>
                    {order.customerEmail && (
                      <a
                        href={`mailto:${order.customerEmail}`}
                        className="flex items-center gap-1 text-green-400 hover:text-green-400"
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
                    className="inline-flex items-center gap-2 px-4 py-2 bg-brand-green/20 text-blue-400 rounded-lg hover:bg-blue-200 mt-2"
                  >
                    <Navigation className="w-4 h-4" />
                    Open in Google Maps
                  </a>
                </div>
              </div>

              {/* Materials */}
              <div className="bg-neutral-900 rounded-xl border border-neutral-200 p-6">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-green-400" />
                  Materials ({order.totalItems} items)
                </h2>
                <div className="space-y-3">
                  {order.items.map((item, idx) => (
                    <div
                      key={item.itemId}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        item.verified
                          ? 'bg-green-500/10 border border-green-500/20'
                          : item.pulled
                          ? 'bg-brand-green/10 border border-blue-500/20'
                          : 'bg-neutral-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {item.verified ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : item.pulled ? (
                          <Circle className="w-5 h-5 text-blue-400" />
                        ) : (
                          <Circle className="w-5 h-5 text-neutral-300" />
                        )}
                        <div>
                          <div className="font-medium text-neutral-900">{item.productName}</div>
                          <div className="text-sm text-neutral-500">
                            {item.category} | {formatCurrency(item.unitPrice)}/{item.unit}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">x{item.quantity}</div>
                        <div className="text-sm text-green-400">{formatCurrency(item.totalPrice)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-neutral-200 flex justify-between items-center">
                  <span className="font-semibold text-neutral-900">Total</span>
                  <span className="text-xl font-bold text-green-400">{formatCurrency(order.totalPrice)}</span>
                </div>
              </div>

              {/* Special Instructions */}
              {order.specialInstructions && (
                <div className="bg-yellow-50 rounded-xl border border-yellow-500/20 p-6">
                  <h2 className="text-lg font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Special Instructions
                  </h2>
                  <p className="text-yellow-400">{order.specialInstructions}</p>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Delivery Info */}
              <div className="bg-neutral-900 rounded-xl border border-neutral-200 p-6">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-green-400" />
                  Delivery Schedule
                </h2>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-neutral-500">Requested Date</div>
                    <div className="font-medium">{formatDate(order.requestedDeliveryDate)}</div>
                    {order.requestedDeliveryTime && (
                      <div className="text-sm text-neutral-600">{order.requestedDeliveryTime}</div>
                    )}
                  </div>
                  {order.scheduledDeliveryDate && (
                    <div>
                      <div className="text-sm text-neutral-500">Scheduled Date</div>
                      <div className="font-medium text-green-400">{formatDate(order.scheduledDeliveryDate)}</div>
                      {order.scheduledDeliveryTime && (
                        <div className="text-sm text-green-400">{order.scheduledDeliveryTime}</div>
                      )}
                    </div>
                  )}
                  {order.estimatedArrival && (
                    <div>
                      <div className="text-sm text-neutral-500">Estimated Arrival</div>
                      <div className="font-medium text-blue-400">{order.estimatedArrival}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Inspector Info */}
              {order.inspectorRequired && (
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
                  <h2 className="text-lg font-semibold text-amber-900 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Inspector Coordination
                  </h2>
                  <div className="space-y-2 text-amber-800">
                    {order.inspectorName && (
                      <div>
                        <span className="font-medium">Inspector:</span> {order.inspectorName}
                      </div>
                    )}
                    {order.inspectorPhone && (
                      <a href={`tel:${order.inspectorPhone}`} className="flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        {order.inspectorPhone}
                      </a>
                    )}
                    {order.inspectorArrivalTime && (
                      <div>
                        <span className="font-medium">Arrival Time:</span> {order.inspectorArrivalTime}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Driver Info */}
              {order.assignedDriverName && (
                <div className="bg-neutral-900 rounded-xl border border-neutral-200 p-6">
                  <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-green-400" />
                    Assigned Driver
                  </h2>
                  <div className="space-y-2">
                    <div className="font-medium">{order.assignedDriverName}</div>
                    {order.assignedVehicle && (
                      <div className="text-sm text-neutral-500">Vehicle: {order.assignedVehicle}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Linked Delivery Ticket */}
              {linkedTicketId && (
                <div className="bg-green-50 rounded-xl border border-green-500/20 p-6">
                  <h2 className="text-lg font-semibold text-green-900 mb-2 flex items-center gap-2">
                    <Ticket className="w-5 h-5" />
                    Linked Delivery Ticket
                  </h2>
                  <p className="text-sm text-green-400 mb-3">
                    Ticket <strong>{linkedTicketId}</strong> has been created for this order.
                  </p>
                  <Link
                    href={`/portal/driver?ticket=${linkedTicketId}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    <Truck className="w-4 h-4" />
                    View Ticket
                  </Link>
                </div>
              )}

              {/* Quick Actions */}
              <div className="bg-neutral-900 rounded-xl border border-neutral-200 p-6">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4">Quick Actions</h2>
                <div className="space-y-2">
                  {!linkedTicketId && (
                    <button
                      onClick={createTicketFromOrder}
                      disabled={creatingTicket}
                      className="flex items-center gap-2 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {creatingTicket ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Ticket className="w-4 h-4" />
                      )}
                      Create Delivery Ticket
                    </button>
                  )}
                  <Link
                    href="/portal/driver/loading"
                    className="flex items-center gap-2 w-full px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    Loading Checklist
                  </Link>
                  <Link
                    href={`/portal/orders/${order.orderId}/return`}
                    className="flex items-center gap-2 w-full px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Create Return
                  </Link>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 w-full px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50"
                  >
                    <Printer className="w-4 h-4" />
                    Print Order
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tracking' && (
          <div className="bg-neutral-900 rounded-xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-6">Order Timeline</h2>
            <div className="space-y-6">
              {[
                { time: order.completedAt, label: 'Order Completed', icon: CheckCircle },
                { time: order.deliveredAt, label: 'Materials Delivered', icon: MapPin },
                { time: order.departedAt, label: 'Driver Departed', icon: Navigation },
                { time: order.loadedAt, label: 'Load Verified', user: order.loadedBy, icon: Package },
                { time: order.approvedAt, label: 'Order Approved', user: order.approvedBy, icon: CheckCircle },
                { time: order.createdAt, label: 'Order Submitted', user: order.createdByName, icon: FileText },
              ].filter(e => e.time).map((event, idx) => (
                <div key={idx} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <event.icon className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-neutral-900">{event.label}</div>
                    <div className="text-sm text-neutral-500">
                      {formatDate(event.time!)} at {formatTime(event.time!)}
                      {event.user && ` by ${event.user}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {(order.status === 'in_transit' || order.status === 'ready_for_delivery') && (
              <div className="mt-8 p-4 bg-blue-50 rounded-xl">
                <h3 className="font-semibold text-brand-green mb-2">Live Tracking</h3>
                <p className="text-blue-400 text-sm mb-4">
                  Driver tracking is available when the order is in transit.
                </p>
                <a
                  href={getGoogleMapsUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-green text-black rounded-lg hover:bg-blue-700"
                >
                  <Navigation className="w-4 h-4" />
                  Open Navigation
                </a>
              </div>
            )}
          </div>
        )}

        {activeTab === 'quality' && (
          <div className="bg-neutral-900 rounded-xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-6 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-green-400" />
              Quality Check Checklist
            </h2>

            {order.qualityCheckComplete ? (
              <div className="p-4 bg-green-50 rounded-lg mb-6">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Quality Check Complete</span>
                </div>
                <p className="text-sm text-green-400 mt-1">
                  Completed by {order.qualityCheckBy} on {formatDate(order.qualityCheckAt!)}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-yellow-50 rounded-lg mb-6">
                <div className="flex items-center gap-2 text-yellow-400">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">Quality Check Pending</span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {[
                { id: 1, label: 'All materials match order', required: true },
                { id: 2, label: 'Quantities verified against manifest', required: true },
                { id: 3, label: 'No damaged items', required: true },
                { id: 4, label: 'Delivery location confirmed', required: true },
                { id: 5, label: 'Customer signature obtained', required: true },
                { id: 6, label: 'Photo documentation complete', required: true },
                { id: 7, label: 'Special instructions followed', required: false },
                { id: 8, label: 'Site left clean', required: false },
              ].map(item => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    order.qualityCheckComplete ? 'bg-green-50' : 'bg-neutral-50'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    order.qualityCheckComplete
                      ? 'bg-green-600 text-white'
                      : 'bg-neutral-200 text-neutral-400'
                  }`}>
                    {order.qualityCheckComplete ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </div>
                  <span className={order.qualityCheckComplete ? 'text-green-900' : 'text-neutral-700'}>
                    {item.label}
                    {item.required && <span className="text-red-500 ml-1">*</span>}
                  </span>
                </div>
              ))}
            </div>

            {!order.qualityCheckComplete && order.status === 'delivered' && (
              <div className="mt-6">
                <Link
                  href={`/portal/orders/${order.orderId}/quality-check`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  Complete Quality Check
                </Link>
              </div>
            )}
          </div>
        )}

        {activeTab === 'invoice' && (
          <div className="bg-neutral-900 rounded-xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-6 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-green-400" />
              Invoice
            </h2>

            {order.invoiceId ? (
              <div>
                <div className="p-4 bg-green-50 rounded-lg mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-green-900">Invoice #{order.invoiceId}</div>
                      <div className="text-sm text-green-400">
                        Status: {order.invoiceStatus ? `${order.invoiceStatus.charAt(0).toUpperCase()}${order.invoiceStatus.slice(1)}` : 'Pending'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/portal/invoices/${order.invoiceId}`}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        View Invoice
                      </Link>
                      <button className="px-4 py-2 border border-green-600 text-green-400 rounded-lg hover:bg-green-50">
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {order.hasBreakdownSheet && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-400">
                      <FileText className="w-5 h-5" />
                      <span className="font-medium">Customer Breakdown Sheet</span>
                    </div>
                    <p className="text-sm text-blue-400 mt-1">
                      This invoice has been added to the customer breakdown sheet.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Receipt className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
                <p className="text-neutral-500 mb-4">
                  Invoice will be generated when the order is delivered.
                </p>
                {order.status === 'delivered' || order.status === 'completed' ? (
                  <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    Generate Invoice
                  </button>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
