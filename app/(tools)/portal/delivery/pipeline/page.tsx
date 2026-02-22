'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Package, ArrowLeft, Truck, Clock, CheckCircle, AlertCircle,
  Camera, MapPin, ChevronRight, ChevronDown, Search, Filter,
  Plus, RefreshCw, Eye, FileText, DollarSign, Loader2,
  AlertTriangle, Navigation, ClipboardCheck, Bell, X
} from 'lucide-react';

interface PipelineOrder {
  orderId: string;
  currentStage: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  jobNumber: string;
  jobName: string;
  customerName: string;
  deliveryAddress: string;
  deliveryCity: string;
  assignedDriverName?: string;
  requestedDeliveryDate: string;
  scheduledDeliveryDate?: string;
  totalPrice: number;
  paymentStatus: string;
  cancelled: boolean;
  items: { productName: string; quantity: number; unit: string; unitPrice: number }[];
}

const STAGE_LABELS: Record<string, string> = {
  ORDER_CREATED: 'Order Created',
  ORDER_REVIEWED: 'Order Reviewed',
  DRIVER_ASSIGNED: 'Driver Assigned',
  WAREHOUSE_NOTIFIED: 'Warehouse Notified',
  MATERIALS_PULLED: 'Materials Pulled',
  LOAD_VERIFIED: 'Load Verified',
  DEPARTURE_CONFIRMED: 'Departed',
  EN_ROUTE: 'En Route',
  ARRIVED_AT_SITE: 'At Site',
  UNLOADING: 'Unloading',
  DELIVERY_CONFIRMED: 'Delivered',
  QC_PHOTOS: 'QC Photos',
  OFFICE_NOTIFIED: 'Office Notified',
  BILLING_REVIEW: 'Billing Review',
  INVOICE_SENT: 'Invoice Sent',
  PAYMENT_RECEIVED: 'Payment Received',
  JOB_CLOSED: 'Closed',
};

const STAGE_COLORS: Record<string, string> = {
  ORDER_CREATED: 'bg-blue-100 text-blue-800',
  ORDER_REVIEWED: 'bg-indigo-100 text-indigo-800',
  DRIVER_ASSIGNED: 'bg-purple-100 text-purple-800',
  WAREHOUSE_NOTIFIED: 'bg-yellow-100 text-yellow-800',
  MATERIALS_PULLED: 'bg-amber-100 text-amber-800',
  LOAD_VERIFIED: 'bg-orange-100 text-orange-800',
  DEPARTURE_CONFIRMED: 'bg-cyan-100 text-cyan-800',
  EN_ROUTE: 'bg-sky-100 text-sky-800',
  ARRIVED_AT_SITE: 'bg-teal-100 text-teal-800',
  UNLOADING: 'bg-emerald-100 text-emerald-800',
  DELIVERY_CONFIRMED: 'bg-green-100 text-green-800',
  QC_PHOTOS: 'bg-lime-100 text-lime-800',
  OFFICE_NOTIFIED: 'bg-gray-100 text-gray-800',
  BILLING_REVIEW: 'bg-rose-100 text-rose-800',
  INVOICE_SENT: 'bg-pink-100 text-pink-800',
  PAYMENT_RECEIVED: 'bg-green-200 text-green-900',
  JOB_CLOSED: 'bg-slate-200 text-slate-800',
};

const PRIORITY_COLORS: Record<string, string> = {
  normal: 'text-gray-600',
  rush: 'text-orange-600 font-semibold',
  urgent: 'text-red-600 font-bold',
};

export default function PipelinePage() {
  const [orders, setOrders] = useState<PipelineOrder[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const [ordersRes, statsRes] = await Promise.all([
        fetch('/api/portal/pipeline?action=active'),
        fetch('/api/portal/pipeline?action=stats'),
      ]);
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (error) {
      console.error('Failed to fetch pipeline data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const filteredOrders = orders.filter(o => {
    if (stageFilter && o.currentStage !== stageFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        o.orderId.toLowerCase().includes(q) ||
        o.jobName.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.assignedDriverName || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString() : '—';
  const formatMoney = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/portal/delivery" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Material Order Pipeline</h1>
            <p className="text-sm text-gray-500">18-stage order lifecycle management</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchOrders} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> New Order
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-sm text-gray-500">Active</div>
            <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-sm text-gray-500">Completed</div>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-sm text-gray-500">Rush/Urgent</div>
            <div className="text-2xl font-bold text-orange-600">{(stats.byPriority?.rush || 0) + (stats.byPriority?.urgent || 0)}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-sm text-gray-500">Total Value</div>
            <div className="text-2xl font-bold">{formatMoney(stats.totalValue || 0)}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-sm text-gray-500">Avg Order</div>
            <div className="text-2xl font-bold">{formatMoney(stats.avgOrderValue || 0)}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Stages</option>
          {Object.entries(STAGE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border">
            <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No orders found</p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <div key={order.orderId} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                onClick={() => setExpandedOrder(expandedOrder === order.orderId ? null : order.orderId)}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[order.currentStage] || 'bg-gray-100 text-gray-800'}`}>
                      {STAGE_LABELS[order.currentStage] || order.currentStage}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-gray-500">{order.orderId}</span>
                      <span className={PRIORITY_COLORS[order.priority] || ''}>
                        {order.priority !== 'normal' && `⚡ ${order.priority.toUpperCase()}`}
                      </span>
                    </div>
                    <div className="font-medium truncate">{order.jobName || order.customerName}</div>
                    <div className="text-sm text-gray-500 flex items-center gap-3">
                      {order.assignedDriverName && (
                        <span className="flex items-center gap-1">
                          <Truck className="w-3 h-3" /> {order.assignedDriverName}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {order.deliveryCity}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatDate(order.requestedDeliveryDate)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-medium">{formatMoney(order.totalPrice)}</div>
                    <div className="text-xs text-gray-500">{order.items?.length || 0} items</div>
                  </div>
                </div>
                {expandedOrder === order.orderId ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
              </div>

              {expandedOrder === order.orderId && (
                <div className="border-t px-4 pb-4 space-y-4">
                  {/* Order details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Customer</h4>
                      <p className="font-medium">{order.customerName}</p>
                      <p className="text-sm text-gray-600">{order.deliveryAddress}, {order.deliveryCity}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Schedule</h4>
                      <p className="text-sm">Requested: {formatDate(order.requestedDeliveryDate)}</p>
                      {order.scheduledDeliveryDate && <p className="text-sm">Scheduled: {formatDate(order.scheduledDeliveryDate)}</p>}
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Payment</h4>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        order.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                        order.paymentStatus === 'invoiced' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {order.paymentStatus}
                      </span>
                    </div>
                  </div>

                  {/* Items */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Materials</h4>
                    <div className="bg-gray-50 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-100">
                            <th className="px-3 py-2 text-left">Item</th>
                            <th className="px-3 py-2 text-right">Qty</th>
                            <th className="px-3 py-2 text-right">Price</th>
                            <th className="px-3 py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(order.items || []).map((item, idx) => (
                            <tr key={idx} className="border-b last:border-0">
                              <td className="px-3 py-2">{item.productName}</td>
                              <td className="px-3 py-2 text-right">{item.quantity} {item.unit}</td>
                              <td className="px-3 py-2 text-right">{formatMoney(item.unitPrice)}</td>
                              <td className="px-3 py-2 text-right font-medium">{formatMoney(item.unitPrice * item.quantity)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Link
                      href={`/portal/orders/${order.orderId}`}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                    >
                      <Eye className="w-3.5 h-3.5" /> View Details
                    </Link>
                    <button className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100">
                      <ChevronRight className="w-3.5 h-3.5" /> Advance Stage
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create Order Modal */}
      {showCreateModal && (
        <CreateOrderModal onClose={() => setShowCreateModal(false)} onCreated={() => { setShowCreateModal(false); fetchOrders(); }} />
      )}
    </div>
  );
}

function CreateOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [formData, setFormData] = useState({
    jobNumber: '', jobName: '', customerName: '', customerPhone: '',
    customerEmail: '', deliveryAddress: '', deliveryCity: '', deliveryState: 'AL',
    deliveryZip: '', requestedDeliveryDate: '', priority: 'normal',
    specialInstructions: '', notes: '',
  });
  const [items, setItems] = useState<{ productId: string; quantity: number }[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/portal/inventory?action=list')
      .then(r => r.json())
      .then(data => setProducts(data.items || []))
      .catch(() => {});
  }, []);

  const addItem = () => setItems([...items, { productId: '', quantity: 1 }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: string | number) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    setItems(updated);
  };

  const handleSubmit = async () => {
    if (!formData.jobName || items.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/portal/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createOrder', ...formData, items }),
      });
      if (res.ok) onCreated();
    } catch (error) {
      console.error('Failed to create order:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Create Material Order</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Name *</label>
              <input type="text" value={formData.jobName} onChange={e => setFormData({ ...formData, jobName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Number</label>
              <input type="text" value={formData.jobNumber} onChange={e => setFormData({ ...formData, jobNumber: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
              <input type="text" value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" value={formData.customerPhone} onChange={e => setFormData({ ...formData, customerPhone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address *</label>
              <input type="text" value={formData.deliveryAddress} onChange={e => setFormData({ ...formData, deliveryAddress: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input type="text" value={formData.deliveryCity} onChange={e => setFormData({ ...formData, deliveryCity: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
              <input type="text" value={formData.deliveryZip} onChange={e => setFormData({ ...formData, deliveryZip: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date *</label>
              <input type="date" value={formData.requestedDeliveryDate} onChange={e => setFormData({ ...formData, requestedDeliveryDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="normal">Normal</option>
                <option value="rush">Rush</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Special Instructions</label>
            <textarea value={formData.specialInstructions} onChange={e => setFormData({ ...formData, specialInstructions: e.target.value })}
              rows={2} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Material Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Materials *</label>
              <button onClick={addItem} className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100">
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <select
                  value={item.productId}
                  onChange={e => updateItem(idx, 'productId', e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">Select product...</option>
                  {products.map(p => (
                    <option key={p.productId} value={p.productId}>
                      {p.productName} ({p.currentQty} available)
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                  className="w-20 px-3 py-2 border rounded-lg text-sm"
                />
                <button onClick={() => removeItem(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4 border-2 border-dashed rounded-lg">
                Click &quot;Add Item&quot; to add materials
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !formData.jobName || items.length === 0}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Order
          </button>
        </div>
      </div>
    </div>
  );
}
