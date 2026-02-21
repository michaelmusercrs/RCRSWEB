'use client';

import { useState, useEffect } from 'react';
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
  DollarSign,
  Calendar,
  MapPin,
  Phone,
  Mail,
  FileText,
  Upload,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Navigation,
  Eye,
  RotateCcw,
  Receipt,
  Ticket,
  Loader2,
  ClipboardCheck
} from 'lucide-react';
import { inventoryProducts } from '@/lib/inventoryData';
import AddressAutocomplete, { AddressResult } from '@/components/AddressAutocomplete';

interface MaterialOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  totalCost: number;
  totalPrice: number;
}

interface MaterialOrder {
  orderId: string;
  salesRep: string;
  jobNumber: string;
  jobName: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  shippingAddress: string;
  city: string;
  state: string;
  zipCode: string;
  orderDate: string;
  requestedDeliveryDate: string;
  materials: MaterialOrderItem[];
  totalCost: number;
  totalPrice: number;
  specialInstructions?: string;
  priority: 'Normal' | 'Rush' | 'Urgent';
  status: 'Draft' | 'Pending' | 'Approved' | 'Ordered' | 'Shipped' | 'Delivered' | 'Cancelled';
  createdBy: string;
  approvedBy?: string;
}

export default function MaterialOrdersPage() {
  const [orders, setOrders] = useState<MaterialOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const [newOrder, setNewOrder] = useState<{
    salesRep: string;
    jobNumber: string;
    jobName: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    shippingAddress: string;
    city: string;
    state: string;
    zipCode: string;
    requestedDeliveryDate: string;
    specialInstructions: string;
    priority: 'Normal' | 'Rush' | 'Urgent';
    materials: MaterialOrderItem[];
  }>({
    salesRep: '', jobNumber: '', jobName: '', customerName: '', customerPhone: '', customerEmail: '',
    shippingAddress: '', city: '', state: 'AL', zipCode: '', requestedDeliveryDate: '',
    specialInstructions: '', priority: 'Normal', materials: []
  });

  const [selectedProduct, setSelectedProduct] = useState('');
  const [productQty, setProductQty] = useState(1);
  const [creatingTicketFor, setCreatingTicketFor] = useState<string | null>(null);
  const [orderTicketMap, setOrderTicketMap] = useState<Record<string, string>>({});

  useEffect(() => { fetchOrders(); }, []);

  async function fetchOrders() {
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
    }
  }

  const createTicketFromOrder = async (orderId: string) => {
    setCreatingTicketFor(orderId);
    try {
      const response = await fetch('/api/portal/material-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-ticket-from-order', orderId, createdBy: 'current-user', createdByName: 'User' }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.ticket?.ticketId) {
          setOrderTicketMap(prev => ({ ...prev, [orderId]: data.ticket.ticketId }));
        }
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
    } finally {
      setCreatingTicketFor(null);
    }
  };

  const toggleOrderExpand = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) newExpanded.delete(orderId); else newExpanded.add(orderId);
    setExpandedOrders(newExpanded);
  };

  const addProductToOrder = () => {
    if (!selectedProduct || productQty < 1) return;
    const product = inventoryProducts.find(p => p.productId === selectedProduct);
    if (!product) return;
    setNewOrder(prev => ({
      ...prev,
      materials: [...prev.materials, {
        productId: product.productId, productName: product.productName, quantity: productQty,
        unitCost: product.cost, unitPrice: product.price, totalCost: product.cost * productQty, totalPrice: product.price * productQty
      }]
    }));
    setSelectedProduct('');
    setProductQty(1);
  };

  const removeProductFromOrder = (productId: string) => {
    setNewOrder(prev => ({ ...prev, materials: prev.materials.filter(m => m.productId !== productId) }));
  };

  const calculateTotals = () => {
    const totalCost = newOrder.materials.reduce((sum, m) => sum + m.totalCost, 0);
    const totalPrice = newOrder.materials.reduce((sum, m) => sum + m.totalPrice, 0);
    return { totalCost, totalPrice, margin: totalPrice - totalCost };
  };

  const handleSubmitOrder = async () => {
    const totals = calculateTotals();
    try {
      const response = await fetch('/api/portal/material-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...newOrder, totalCost: totals.totalCost, totalPrice: totals.totalPrice, createdBy: 'current-user' })
      });
      if (response.ok) {
        setShowCreateModal(false);
        setNewOrder({
          salesRep: '', jobNumber: '', jobName: '', customerName: '', customerPhone: '', customerEmail: '',
          shippingAddress: '', city: '', state: 'AL', zipCode: '', requestedDeliveryDate: '',
          specialInstructions: '', priority: 'Normal', materials: []
        });
        fetchOrders();
      }
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      Draft: 'bg-zinc-700/50 text-zinc-400',
      Pending: 'bg-yellow-500/20 text-yellow-400',
      Approved: 'bg-brand-green/20 text-brand-green',
      Ordered: 'bg-purple-500/20 text-purple-400',
      Shipped: 'bg-cyan-500/20 text-cyan-400',
      Delivered: 'bg-green-500/20 text-green-400',
      Cancelled: 'bg-red-500/20 text-red-400'
    };
    return <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${colors[status] || 'bg-zinc-700/50 text-zinc-400'}`}>{status}</span>;
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      Normal: 'bg-zinc-700/50 text-zinc-500',
      Rush: 'bg-orange-500/20 text-orange-400',
      Urgent: 'bg-red-500/20 text-red-400'
    };
    return <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${colors[priority]}`}>{priority}</span>;
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const filteredOrders = orders.filter(order => {
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      if (!order.orderId.toLowerCase().includes(lower) && !order.jobName.toLowerCase().includes(lower) && !order.customerName.toLowerCase().includes(lower)) return false;
    }
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
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
          <div className="flex items-center gap-2">
            <Link
              href="/portal/delivery"
              className="flex items-center gap-2 px-3 py-2 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-800 transition-colors text-sm"
            >
              <Truck className="w-4 h-4" /> Deliveries
            </Link>
            <Link
              href="/portal/orders/new"
              className="flex items-center gap-2 px-3 py-2 bg-brand-green text-black rounded-xl hover:brightness-90 transition-all text-sm font-bold"
            >
              <Plus className="w-4 h-4" /> New Order
            </Link>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="px-4 md:px-6 py-3 bg-zinc-900/50 border-b border-zinc-800">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm placeholder-zinc-600 focus:ring-1 focus:ring-brand-green focus:border-brand-green"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-600" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm focus:ring-1 focus:ring-brand-green"
            >
              <option value="all">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Ordered">Ordered</option>
              <option value="Shipped">Shipped</option>
              <option value="Delivered">Delivered</option>
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
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <div key={order.orderId} className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                {/* Order Header */}
                <div className="p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors" onClick={() => toggleOrderExpand(order.orderId)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center flex-shrink-0">
                        <Package className="w-5 h-5 text-brand-green" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm">{order.orderId}</span>
                          {getStatusBadge(order.status)}
                          {getPriorityBadge(order.priority)}
                        </div>
                        <p className="text-xs text-zinc-500 truncate">{order.jobName} · {order.customerName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      <div className="text-right">
                        <div className="font-bold text-brand-green text-sm">{formatCurrency(order.totalPrice)}</div>
                        <div className="text-[11px] text-zinc-600">{order.materials.length} items</div>
                      </div>
                      {expandedOrders.has(order.orderId) ? <ChevronUp className="w-4 h-4 text-zinc-600" /> : <ChevronDown className="w-4 h-4 text-zinc-600" />}
                    </div>
                  </div>
                </div>

                {/* Order Details (Expanded) */}
                {expandedOrders.has(order.orderId) && (
                  <div className="border-t border-zinc-800 p-4 bg-zinc-900/50">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-bold text-white text-sm mb-2">Customer Information</h4>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center gap-2 text-zinc-400">
                            <MapPin className="w-3.5 h-3.5" /> {order.shippingAddress}, {order.city}, {order.state} {order.zipCode}
                          </div>
                          <div className="flex items-center gap-2 text-zinc-400">
                            <Phone className="w-3.5 h-3.5" />
                            <a href={`tel:${order.customerPhone}`} className="text-brand-green">{order.customerPhone}</a>
                          </div>
                          {order.customerEmail && (
                            <div className="flex items-center gap-2 text-zinc-400">
                              <Mail className="w-3.5 h-3.5" /> {order.customerEmail}
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-zinc-400">
                            <Calendar className="w-3.5 h-3.5" /> Delivery: {order.requestedDeliveryDate}
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
                          {order.materials.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm py-1.5 border-b border-zinc-800/60 last:border-0">
                              <div>
                                <span className="font-medium text-zinc-300">{item.productName}</span>
                                <span className="text-zinc-600 ml-2">x{item.quantity}</span>
                              </div>
                              <span className="font-bold text-zinc-300">{formatCurrency(item.totalPrice)}</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between pt-2 font-bold text-sm">
                            <span className="text-zinc-400">Total</span>
                            <span className="text-brand-green">{formatCurrency(order.totalPrice)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {orderTicketMap[order.orderId] && (
                      <div className="mt-3 p-3 bg-brand-green/10 border border-brand-green/20 rounded-xl text-sm">
                        <div className="flex items-center gap-2 text-brand-green">
                          <Ticket className="w-4 h-4" />
                          <span>Delivery Ticket: <strong>{orderTicketMap[order.orderId]}</strong></span>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-zinc-800 flex flex-wrap gap-2">
                      <Link
                        href={`/portal/orders/${order.orderId}`}
                        className="flex items-center gap-1 px-3 py-1.5 bg-brand-green text-black rounded-lg hover:brightness-90 text-xs font-bold transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Details
                      </Link>
                      {!orderTicketMap[order.orderId] && (
                        <button
                          onClick={(e) => { e.stopPropagation(); createTicketFromOrder(order.orderId); }}
                          disabled={creatingTicketFor === order.orderId}
                          className="flex items-center gap-1 px-3 py-1.5 bg-brand-green/15 text-brand-green rounded-lg hover:bg-brand-green/25 text-xs font-bold disabled:opacity-50 transition-colors"
                        >
                          {creatingTicketFor === order.orderId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ticket className="w-3.5 h-3.5" />}
                          Create Ticket
                        </button>
                      )}
                      <Link
                        href="/portal/driver/loading"
                        className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 text-xs font-medium transition-colors"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" /> Loading Checklist
                      </Link>
                      {(order.status === 'Shipped' || order.status === 'Delivered') && (
                        <Link
                          href={`/portal/orders/${order.orderId}?tab=tracking`}
                          className="flex items-center gap-1 px-3 py-1.5 bg-brand-green/15 text-brand-green rounded-lg hover:bg-brand-green/25 text-xs font-bold transition-colors"
                        >
                          <Navigation className="w-3.5 h-3.5" /> Track
                        </Link>
                      )}
                      {order.status === 'Delivered' && (
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
            ))}
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900 z-10">
              <h2 className="text-lg font-bold text-white">New Material Order</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">Sales Rep</label>
                  <input type="text" value={newOrder.salesRep} onChange={(e) => setNewOrder({ ...newOrder, salesRep: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-zinc-600 focus:ring-1 focus:ring-brand-green" placeholder="Your name" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">Job Number</label>
                  <input type="text" value={newOrder.jobNumber} onChange={(e) => setNewOrder({ ...newOrder, jobNumber: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-zinc-600 focus:ring-1 focus:ring-brand-green" placeholder="JOB-2024-####" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">Job Name</label>
                <input type="text" value={newOrder.jobName} onChange={(e) => setNewOrder({ ...newOrder, jobName: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-zinc-600 focus:ring-1 focus:ring-brand-green" placeholder="Customer Name - Project" />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">Customer Name</label>
                  <input type="text" value={newOrder.customerName} onChange={(e) => setNewOrder({ ...newOrder, customerName: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-1 focus:ring-brand-green" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">Phone</label>
                  <input type="tel" value={newOrder.customerPhone} onChange={(e) => setNewOrder({ ...newOrder, customerPhone: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-1 focus:ring-brand-green" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">Shipping Address</label>
                <AddressAutocomplete
                  onAddressSelect={(result: AddressResult) => {
                    const streetParts: string[] = [];
                    if (result.streetNumber) streetParts.push(result.streetNumber);
                    if (result.street) streetParts.push(result.street);
                    const streetAddr = streetParts.length > 0 ? streetParts.join(' ') : result.formattedAddress.split(',')[0];
                    setNewOrder({ ...newOrder, shippingAddress: streetAddr, city: result.city || newOrder.city, state: result.state || newOrder.state, zipCode: result.zip || newOrder.zipCode });
                  }}
                  defaultValue={newOrder.shippingAddress}
                  placeholder="Start typing address..."
                  className="!bg-zinc-800 !border-zinc-700 !text-white !placeholder-zinc-600 focus:!ring-1 focus:!ring-brand-green focus:!border-brand-green"
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">City</label>
                  <input type="text" value={newOrder.city} onChange={(e) => setNewOrder({ ...newOrder, city: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-1 focus:ring-brand-green" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">State</label>
                  <input type="text" value={newOrder.state} onChange={(e) => setNewOrder({ ...newOrder, state: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-1 focus:ring-brand-green" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">ZIP</label>
                  <input type="text" value={newOrder.zipCode} onChange={(e) => setNewOrder({ ...newOrder, zipCode: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-1 focus:ring-brand-green" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">Requested Delivery Date</label>
                  <input type="date" value={newOrder.requestedDeliveryDate} onChange={(e) => setNewOrder({ ...newOrder, requestedDeliveryDate: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-1 focus:ring-brand-green" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">Priority</label>
                  <select value={newOrder.priority} onChange={(e) => setNewOrder({ ...newOrder, priority: e.target.value as MaterialOrder['priority'] })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-1 focus:ring-brand-green">
                    <option value="Normal">Normal</option>
                    <option value="Rush">Rush</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-2">Materials</label>
                <div className="flex gap-2 mb-4">
                  <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-1 focus:ring-brand-green">
                    <option value="">Select a product...</option>
                    {inventoryProducts.map(p => (
                      <option key={p.productId} value={p.productId}>{p.productName} - {formatCurrency(p.price)}</option>
                    ))}
                  </select>
                  <input type="number" min="1" value={productQty} onChange={(e) => setProductQty(parseInt(e.target.value) || 1)}
                    className="w-20 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:ring-1 focus:ring-brand-green" />
                  <button onClick={addProductToOrder} className="px-4 py-2.5 bg-brand-green text-black rounded-xl hover:brightness-90 font-bold text-sm transition-all">Add</button>
                </div>

                {newOrder.materials.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {newOrder.materials.map((item) => (
                      <div key={item.productId} className="flex items-center justify-between p-3 bg-zinc-800/60 rounded-xl">
                        <div>
                          <span className="font-medium text-white text-sm">{item.productName}</span>
                          <span className="text-zinc-500 ml-2 text-xs">x{item.quantity}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-zinc-300 text-sm">{formatCurrency(item.totalPrice)}</span>
                          <button onClick={() => removeProductFromOrder(item.productId)} className="text-red-400 hover:text-red-300">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between p-3 bg-brand-green/10 border border-brand-green/20 rounded-xl font-bold text-sm">
                      <span className="text-zinc-400">Total</span>
                      <span className="text-brand-green">{formatCurrency(calculateTotals().totalPrice)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">Special Instructions</label>
                <textarea value={newOrder.specialInstructions} onChange={(e) => setNewOrder({ ...newOrder, specialInstructions: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm resize-none placeholder-zinc-600 focus:ring-1 focus:ring-brand-green" rows={3} placeholder="Gate codes, delivery instructions, etc." />
              </div>
            </div>

            <div className="p-5 border-t border-zinc-800 flex justify-end gap-3 sticky bottom-0 bg-zinc-900">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2.5 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700 text-sm font-medium transition-colors">
                Cancel
              </button>
              <button onClick={handleSubmitOrder} disabled={newOrder.materials.length === 0}
                className="px-4 py-2.5 bg-brand-green text-black rounded-xl hover:brightness-90 font-bold text-sm disabled:bg-zinc-800 disabled:text-zinc-600 transition-all">
                Submit Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
