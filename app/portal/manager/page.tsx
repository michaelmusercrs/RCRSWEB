'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3, Package, Truck, AlertTriangle, Plus, RefreshCw,
  ArrowLeft, Clock, CheckCircle2, MapPin, User, DollarSign,
  TrendingUp, Calendar, Loader2, ChevronRight
} from 'lucide-react';
import type { DashboardStats, MaterialOrder, Delivery, Driver } from '@/lib/delivery-portal-service';

export default function ManagerDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [orders, setOrders] = useState<MaterialOrder[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'deliveries' | 'create'>('overview');
  const [showCreateOrder, setShowCreateOrder] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const [statsRes, ordersRes, deliveriesRes, driversRes] = await Promise.all([
        fetch('/api/portal/dashboard'),
        fetch('/api/portal/orders'),
        fetch('/api/portal/deliveries'),
        fetch('/api/portal/drivers'),
      ]);

      setStats(await statsRes.json());
      setOrders(await ordersRes.json());
      setDeliveries(await deliveriesRes.json());
      setDrivers(await driversRes.json());
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch('/api/portal/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobName: formData.get('jobName'),
          jobAddress: formData.get('jobAddress'),
          customerName: formData.get('customerName'),
          customerPhone: formData.get('customerPhone'),
          projectManager: formData.get('projectManager'),
          materials: formData.get('materials'),
          specialInstructions: formData.get('specialInstructions'),
          requestedDeliveryDate: formData.get('requestedDeliveryDate'),
          priority: formData.get('priority'),
          createdBy: 'Manager Portal',
        }),
      });

      if (response.ok) {
        setShowCreateOrder(false);
        form.reset();
        loadDashboard();
      }
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };

  const handleScheduleDelivery = async (order: MaterialOrder, driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return;

    try {
      await fetch('/api/portal/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.orderId,
          driver: driverId,
          driverName: driver.name,
          status: 'Scheduled',
          scheduledDate: order.requestedDeliveryDate,
          scheduledTime: '8:00 AM',
          jobName: order.jobName,
          jobAddress: order.jobAddress,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          materials: order.materials,
        }),
      });

      loadDashboard();
    } catch (error) {
      console.error('Error scheduling delivery:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto text-brand-green" size={48} />
          <p className="text-neutral-400 mt-4">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900">
      {/* Header */}
      <div className="bg-neutral-800 border-b border-neutral-700 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal" className="text-neutral-400 hover:text-white">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Manager Dashboard</h1>
              <p className="text-sm text-neutral-400">River City Roofing Delivery Portal</p>
            </div>
          </div>
          <button
            onClick={loadDashboard}
            className="p-2 bg-neutral-700 rounded-lg hover:bg-neutral-600"
          >
            <RefreshCw size={20} className="text-neutral-400" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-neutral-800 border-b border-neutral-700">
        <div className="max-w-6xl mx-auto flex overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'orders', label: 'Orders', icon: Package },
            { id: 'deliveries', label: 'Deliveries', icon: Truck },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-brand-green border-b-2 border-brand-green'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Truck className="text-blue-500" size={20} />
                  </div>
                  <span className="text-neutral-400 text-sm">Today's Deliveries</span>
                </div>
                <div className="text-2xl font-bold text-white">{stats.deliveries.todayTotal}</div>
                <div className="text-sm text-green-500">{stats.deliveries.completedToday} completed</div>
              </div>

              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                    <Package className="text-yellow-500" size={20} />
                  </div>
                  <span className="text-neutral-400 text-sm">Pending Orders</span>
                </div>
                <div className="text-2xl font-bold text-white">{stats.orders.pending}</div>
                <div className="text-sm text-neutral-500">{stats.orders.thisWeek} this week</div>
              </div>

              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="text-red-500" size={20} />
                  </div>
                  <span className="text-neutral-400 text-sm">Low Stock Items</span>
                </div>
                <div className="text-2xl font-bold text-white">{stats.inventory.lowStockItems}</div>
                <Link href="/portal/inventory" className="text-sm text-red-400 hover:underline">
                  View items
                </Link>
              </div>

              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <DollarSign className="text-green-500" size={20} />
                  </div>
                  <span className="text-neutral-400 text-sm">Inventory Value</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  ${stats.inventory.totalValue.toLocaleString()}
                </div>
                <div className="text-sm text-neutral-500">{stats.inventory.totalProducts} products</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setShowCreateOrder(true)}
                className="bg-brand-green hover:bg-lime-400 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Create Material Order
              </button>

              <Link
                href="/portal/inventory"
                className="bg-neutral-800 border border-neutral-700 hover:border-neutral-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2"
              >
                <Package size={20} />
                Manage Inventory
              </Link>
            </div>

            {/* Active Deliveries */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-brand-green" />
                Active Deliveries
              </h3>
              <div className="space-y-3">
                {deliveries
                  .filter(d => ['Loaded', 'En Route', 'Arrived'].includes(d.status))
                  .slice(0, 5)
                  .map(delivery => (
                    <div key={delivery.deliveryId} className="flex items-center justify-between p-3 bg-neutral-700/50 rounded-lg">
                      <div>
                        <div className="font-medium text-white">{delivery.jobName}</div>
                        <div className="text-sm text-neutral-400">{delivery.driverName}</div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        delivery.status === 'Loaded' ? 'bg-blue-500 text-white' :
                        delivery.status === 'En Route' ? 'bg-purple-500 text-white' :
                        'bg-orange-500 text-white'
                      }`}>
                        {delivery.status}
                      </span>
                    </div>
                  ))}
                {deliveries.filter(d => ['Loaded', 'En Route', 'Arrived'].includes(d.status)).length === 0 && (
                  <p className="text-neutral-500 text-center py-4">No active deliveries</p>
                )}
              </div>
            </div>

            {/* Driver Status */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <User size={18} className="text-brand-green" />
                Driver Status
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {drivers.map(driver => (
                  <div key={driver.id} className="flex items-center gap-3 p-3 bg-neutral-700/50 rounded-lg">
                    <div className={`w-3 h-3 rounded-full ${
                      driver.status === 'Available' ? 'bg-green-500' :
                      driver.status === 'On Delivery' ? 'bg-blue-500' :
                      'bg-neutral-500'
                    }`} />
                    <div>
                      <div className="font-medium text-white">{driver.name}</div>
                      <div className="text-xs text-neutral-400">{driver.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Material Orders</h2>
              <button
                onClick={() => setShowCreateOrder(true)}
                className="bg-brand-green hover:bg-lime-400 text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Plus size={18} />
                New Order
              </button>
            </div>

            <div className="space-y-3">
              {orders.map(order => (
                <div key={order.orderId} className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{order.jobName}</h3>
                        {order.priority === 'Rush' && (
                          <span className="px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded">RUSH</span>
                        )}
                        {order.priority === 'Urgent' && (
                          <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded">URGENT</span>
                        )}
                      </div>
                      <p className="text-sm text-neutral-400">{order.orderId}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      order.status === 'Pending' ? 'bg-yellow-500/20 text-yellow-500' :
                      order.status === 'Scheduled' ? 'bg-blue-500/20 text-blue-500' :
                      order.status === 'In Progress' ? 'bg-purple-500/20 text-purple-500' :
                      order.status === 'Delivered' ? 'bg-green-500/20 text-green-500' :
                      'bg-neutral-500/20 text-neutral-500'
                    }`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-neutral-500">Customer:</span>
                      <span className="text-white ml-2">{order.customerName}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500">Delivery Date:</span>
                      <span className="text-white ml-2">{order.requestedDeliveryDate}</span>
                    </div>
                  </div>

                  <div className="text-sm text-neutral-300 mb-3">
                    <span className="text-neutral-500">Materials:</span>
                    <p className="mt-1">{order.materials}</p>
                  </div>

                  {order.status === 'Pending' && (
                    <div className="flex items-center gap-2 pt-3 border-t border-neutral-700">
                      <span className="text-sm text-neutral-400">Assign Driver:</span>
                      <select
                        onChange={(e) => e.target.value && handleScheduleDelivery(order, e.target.value)}
                        className="bg-neutral-700 text-white px-3 py-1 rounded text-sm"
                        defaultValue=""
                      >
                        <option value="">Select driver...</option>
                        {drivers
                          .filter(d => d.status === 'Available')
                          .map(driver => (
                            <option key={driver.id} value={driver.id}>{driver.name}</option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}

              {orders.length === 0 && (
                <div className="text-center py-12">
                  <Package className="mx-auto text-neutral-600" size={48} />
                  <p className="text-neutral-400 mt-2">No orders yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Deliveries Tab */}
        {activeTab === 'deliveries' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">All Deliveries</h2>

            <div className="space-y-3">
              {deliveries.map(delivery => (
                <div key={delivery.deliveryId} className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-white">{delivery.jobName}</h3>
                      <p className="text-sm text-neutral-400">{delivery.deliveryId}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      delivery.status === 'Scheduled' ? 'bg-yellow-500/20 text-yellow-500' :
                      delivery.status === 'Loaded' ? 'bg-blue-500/20 text-blue-500' :
                      delivery.status === 'En Route' ? 'bg-purple-500/20 text-purple-500' :
                      delivery.status === 'Arrived' ? 'bg-orange-500/20 text-orange-500' :
                      delivery.status === 'Delivered' ? 'bg-green-500/20 text-green-500' :
                      'bg-neutral-500/20 text-neutral-500'
                    }`}>
                      {delivery.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-neutral-400">
                      <User size={14} />
                      {delivery.driverName || 'Unassigned'}
                    </div>
                    <div className="flex items-center gap-2 text-neutral-400">
                      <Calendar size={14} />
                      {delivery.scheduledDate} @ {delivery.scheduledTime}
                    </div>
                    <div className="flex items-center gap-2 text-neutral-400 col-span-2">
                      <MapPin size={14} />
                      {delivery.jobAddress}
                    </div>
                  </div>

                  {delivery.status === 'Delivered' && delivery.deliveredTime && (
                    <div className="flex items-center gap-2 text-green-500 text-sm mt-3 pt-3 border-t border-neutral-700">
                      <CheckCircle2 size={14} />
                      Delivered at {new Date(delivery.deliveredTime).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}

              {deliveries.length === 0 && (
                <div className="text-center py-12">
                  <Truck className="mx-auto text-neutral-600" size={48} />
                  <p className="text-neutral-400 mt-2">No deliveries yet</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      {showCreateOrder && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-neutral-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Create Material Order</h2>
              <button
                onClick={() => setShowCreateOrder(false)}
                className="text-neutral-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Job Name *</label>
                <input
                  name="jobName"
                  required
                  className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Smith Residence"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Job Address *</label>
                <input
                  name="jobAddress"
                  required
                  className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  placeholder="123 Main St, Huntsville, AL 35801"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Customer Name *</label>
                  <input
                    name="customerName"
                    required
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Customer Phone *</label>
                  <input
                    name="customerPhone"
                    required
                    type="tel"
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Project Manager</label>
                <input
                  name="projectManager"
                  className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Materials Needed *</label>
                <textarea
                  name="materials"
                  required
                  rows={3}
                  className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  placeholder="30 bundles OC Duration (Onyx Black)&#10;5 rolls synthetic underlayment&#10;2 rolls ice & water shield"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Special Instructions</label>
                <textarea
                  name="specialInstructions"
                  rows={2}
                  className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Gate code, stacking location, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Delivery Date *</label>
                  <input
                    name="requestedDeliveryDate"
                    required
                    type="date"
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Priority</label>
                  <select
                    name="priority"
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Rush">Rush</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateOrder(false)}
                  className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white font-bold py-3 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-brand-green hover:bg-lime-400 text-black font-bold py-3 rounded-lg"
                >
                  Create Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
