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
  ChevronUp
} from 'lucide-react';
import { inventoryProducts } from '@/lib/inventoryData';

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

  // New order form state
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
    salesRep: '',
    jobNumber: '',
    jobName: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    shippingAddress: '',
    city: '',
    state: 'AL',
    zipCode: '',
    requestedDeliveryDate: '',
    specialInstructions: '',
    priority: 'Normal',
    materials: []
  });

  const [selectedProduct, setSelectedProduct] = useState('');
  const [productQty, setProductQty] = useState(1);

  useEffect(() => {
    fetchOrders();
  }, []);

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

  const toggleOrderExpand = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const addProductToOrder = () => {
    if (!selectedProduct || productQty < 1) return;

    const product = inventoryProducts.find(p => p.productId === selectedProduct);
    if (!product) return;

    const item: MaterialOrderItem = {
      productId: product.productId,
      productName: product.productName,
      quantity: productQty,
      unitCost: product.cost,
      unitPrice: product.price,
      totalCost: product.cost * productQty,
      totalPrice: product.price * productQty
    };

    setNewOrder(prev => ({
      ...prev,
      materials: [...prev.materials, item]
    }));

    setSelectedProduct('');
    setProductQty(1);
  };

  const removeProductFromOrder = (productId: string) => {
    setNewOrder(prev => ({
      ...prev,
      materials: prev.materials.filter(m => m.productId !== productId)
    }));
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
        body: JSON.stringify({
          action: 'create',
          ...newOrder,
          totalCost: totals.totalCost,
          totalPrice: totals.totalPrice,
          createdBy: 'current-user' // Would be from auth context
        })
      });

      if (response.ok) {
        setShowCreateModal(false);
        setNewOrder({
          salesRep: '',
          jobNumber: '',
          jobName: '',
          customerName: '',
          customerPhone: '',
          customerEmail: '',
          shippingAddress: '',
          city: '',
          state: 'AL',
          zipCode: '',
          requestedDeliveryDate: '',
          specialInstructions: '',
          priority: 'Normal',
          materials: []
        });
        fetchOrders();
      }
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      Draft: 'bg-gray-100 text-gray-800',
      Pending: 'bg-yellow-100 text-yellow-800',
      Approved: 'bg-blue-100 text-blue-800',
      Ordered: 'bg-purple-100 text-purple-800',
      Shipped: 'bg-cyan-100 text-cyan-800',
      Delivered: 'bg-green-100 text-green-800',
      Cancelled: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      Normal: 'bg-gray-100 text-gray-600',
      Rush: 'bg-orange-100 text-orange-800',
      Urgent: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[priority]}`}>
        {priority}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const filteredOrders = orders.filter(order => {
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      if (!order.orderId.toLowerCase().includes(lower) &&
          !order.jobName.toLowerCase().includes(lower) &&
          !order.customerName.toLowerCase().includes(lower)) {
        return false;
      }
    }
    if (statusFilter !== 'all' && order.status !== statusFilter) {
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
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
              <h1 className="text-xl font-semibold text-neutral-900">Material Orders</h1>
              <p className="text-sm text-neutral-500">Create and manage material order requests</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Order
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="px-6 py-4 bg-white border-b border-neutral-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
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
      <div className="px-6 py-4">
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div key={order.orderId} className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
              {/* Order Header */}
              <div
                className="p-4 cursor-pointer hover:bg-neutral-50"
                onClick={() => toggleOrderExpand(order.orderId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <Package className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-neutral-900">{order.orderId}</span>
                        {getStatusBadge(order.status)}
                        {getPriorityBadge(order.priority)}
                      </div>
                      <div className="text-sm text-neutral-500">
                        {order.jobName} • {order.customerName}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-medium text-neutral-900">{formatCurrency(order.totalPrice)}</div>
                      <div className="text-sm text-neutral-500">{order.materials.length} items</div>
                    </div>
                    {expandedOrders.has(order.orderId) ? (
                      <ChevronUp className="w-5 h-5 text-neutral-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-neutral-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Order Details (Expanded) */}
              {expandedOrders.has(order.orderId) && (
                <div className="border-t border-neutral-200 p-4 bg-neutral-50">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Customer Info */}
                    <div>
                      <h4 className="font-medium text-neutral-900 mb-2">Customer Information</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-neutral-600">
                          <MapPin className="w-4 h-4" />
                          {order.shippingAddress}, {order.city}, {order.state} {order.zipCode}
                        </div>
                        <div className="flex items-center gap-2 text-neutral-600">
                          <Phone className="w-4 h-4" />
                          {order.customerPhone}
                        </div>
                        {order.customerEmail && (
                          <div className="flex items-center gap-2 text-neutral-600">
                            <Mail className="w-4 h-4" />
                            {order.customerEmail}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-neutral-600">
                          <Calendar className="w-4 h-4" />
                          Delivery: {order.requestedDeliveryDate}
                        </div>
                      </div>
                      {order.specialInstructions && (
                        <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800">
                          <strong>Instructions:</strong> {order.specialInstructions}
                        </div>
                      )}
                    </div>

                    {/* Materials */}
                    <div>
                      <h4 className="font-medium text-neutral-900 mb-2">Materials</h4>
                      <div className="space-y-2">
                        {order.materials.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm py-2 border-b border-neutral-200 last:border-0">
                            <div>
                              <span className="font-medium">{item.productName}</span>
                              <span className="text-neutral-500 ml-2">x{item.quantity}</span>
                            </div>
                            <span className="font-medium">{formatCurrency(item.totalPrice)}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between pt-2 font-medium">
                          <span>Total</span>
                          <span className="text-green-600">{formatCurrency(order.totalPrice)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">New Material Order</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Job Info */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Sales Rep</label>
                  <input
                    type="text"
                    value={newOrder.salesRep}
                    onChange={(e) => setNewOrder({ ...newOrder, salesRep: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Job Number</label>
                  <input
                    type="text"
                    value={newOrder.jobNumber}
                    onChange={(e) => setNewOrder({ ...newOrder, jobNumber: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2"
                    placeholder="JOB-2024-####"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Job Name</label>
                <input
                  type="text"
                  value={newOrder.jobName}
                  onChange={(e) => setNewOrder({ ...newOrder, jobName: e.target.value })}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2"
                  placeholder="Customer Name - Project Description"
                />
              </div>

              {/* Customer Info */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={newOrder.customerName}
                    onChange={(e) => setNewOrder({ ...newOrder, customerName: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newOrder.customerPhone}
                    onChange={(e) => setNewOrder({ ...newOrder, customerPhone: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Shipping Address</label>
                <input
                  type="text"
                  value={newOrder.shippingAddress}
                  onChange={(e) => setNewOrder({ ...newOrder, shippingAddress: e.target.value })}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2"
                  placeholder="Street address"
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">City</label>
                  <input
                    type="text"
                    value={newOrder.city}
                    onChange={(e) => setNewOrder({ ...newOrder, city: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">State</label>
                  <input
                    type="text"
                    value={newOrder.state}
                    onChange={(e) => setNewOrder({ ...newOrder, state: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">ZIP</label>
                  <input
                    type="text"
                    value={newOrder.zipCode}
                    onChange={(e) => setNewOrder({ ...newOrder, zipCode: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {/* Delivery & Priority */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Requested Delivery Date</label>
                  <input
                    type="date"
                    value={newOrder.requestedDeliveryDate}
                    onChange={(e) => setNewOrder({ ...newOrder, requestedDeliveryDate: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Priority</label>
                  <select
                    value={newOrder.priority}
                    onChange={(e) => setNewOrder({ ...newOrder, priority: e.target.value as MaterialOrder['priority'] })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Rush">Rush</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Materials */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Materials</label>
                <div className="flex gap-2 mb-4">
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="flex-1 border border-neutral-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Select a product...</option>
                    {inventoryProducts.map(p => (
                      <option key={p.productId} value={p.productId}>
                        {p.productName} - {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.price)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={productQty}
                    onChange={(e) => setProductQty(parseInt(e.target.value) || 1)}
                    className="w-20 border border-neutral-300 rounded-lg px-3 py-2"
                  />
                  <button
                    onClick={addProductToOrder}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Add
                  </button>
                </div>

                {newOrder.materials.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {newOrder.materials.map((item) => (
                      <div key={item.productId} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                        <div>
                          <span className="font-medium">{item.productName}</span>
                          <span className="text-neutral-500 ml-2">x{item.quantity}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-medium">{formatCurrency(item.totalPrice)}</span>
                          <button
                            onClick={() => removeProductFromOrder(item.productId)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg font-medium">
                      <span>Total</span>
                      <span className="text-green-600">{formatCurrency(calculateTotals().totalPrice)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Special Instructions */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Special Instructions</label>
                <textarea
                  value={newOrder.specialInstructions}
                  onChange={(e) => setNewOrder({ ...newOrder, specialInstructions: e.target.value })}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="Gate codes, delivery instructions, etc."
                />
              </div>
            </div>

            <div className="p-6 border-t border-neutral-200 flex justify-end gap-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitOrder}
                disabled={newOrder.materials.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
