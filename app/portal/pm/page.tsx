'use client';

import { useState, useEffect } from 'react';
import {
  FileUp, Package, Truck, RotateCcw, Plus, Search, Filter,
  Calendar, MapPin, User, Phone, ChevronRight, AlertCircle,
  CheckCircle2, Clock, Loader2, X, ArrowLeft, FileText
} from 'lucide-react';
import Link from 'next/link';

interface MaterialItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  category: string;
}

interface InventoryItem {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  currentQty: number;
  unit: string;
  unitCost: number;
  retailPrice: number;
}

interface Ticket {
  ticketId: string;
  ticketType: 'delivery' | 'pickup' | 'return';
  status: string;
  jobName: string;
  jobAddress: string;
  createdAt: string;
  scheduledDate?: string;
  assignedDriverName?: string;
  totalMaterialCost: number;
}

interface PMUser {
  userId: string;
  name: string;
  email: string;
  role: string;
}

export default function PMPortal() {
  const [user, setUser] = useState<PMUser | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'create' | 'tickets' | 'returns'>('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Create order form
  const [orderForm, setOrderForm] = useState({
    ticketType: 'delivery' as 'delivery' | 'pickup' | 'return',
    jobId: '',
    jobName: '',
    jobAddress: '',
    city: '',
    state: 'AL',
    zip: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    requestedDate: '',
    requestedTime: '',
    priority: 'normal' as 'normal' | 'rush' | 'urgent',
    specialInstructions: '',
    returnReason: '',
    pickupReason: '',
    relatedTicketId: '',
  });
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Check for logged in PM user
    const stored = sessionStorage.getItem('portalUser');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.role === 'project_manager' || parsed.role === 'owner' || parsed.role === 'admin') {
        setUser(parsed);
        loadData();
      }
    }
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ticketsRes, inventoryRes] = await Promise.all([
        fetch('/api/portal/tickets'),
        fetch('/api/portal/inventory'),
      ]);

      if (ticketsRes.ok) {
        const data = await ticketsRes.json();
        setTickets(data.tickets || []);
      }
      if (inventoryRes.ok) {
        const data = await inventoryRes.json();
        setInventory(data.inventory || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMaterial = (item: InventoryItem, qty: number) => {
    const existing = selectedMaterials.find(m => m.productId === item.productId);
    if (existing) {
      setSelectedMaterials(prev => prev.map(m =>
        m.productId === item.productId
          ? { ...m, quantity: m.quantity + qty, totalPrice: (m.quantity + qty) * m.unitPrice }
          : m
      ));
    } else {
      setSelectedMaterials(prev => [...prev, {
        productId: item.productId,
        productName: item.productName,
        quantity: qty,
        unit: item.unit,
        unitPrice: item.retailPrice,
        totalPrice: qty * item.retailPrice,
        category: item.category,
      }]);
    }
  };

  const handleRemoveMaterial = (productId: string) => {
    setSelectedMaterials(prev => prev.filter(m => m.productId !== productId));
  };

  const handleSubmitOrder = async () => {
    if (!user) return;
    if (selectedMaterials.length === 0 && orderForm.ticketType === 'delivery') {
      alert('Please add at least one material');
      return;
    }
    if (!orderForm.jobName || !orderForm.jobAddress || !orderForm.requestedDate) {
      alert('Please fill in required fields');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...orderForm,
          createdBy: user.userId,
          createdByName: user.name,
          createdByRole: user.role,
          materials: selectedMaterials,
          projectManager: user.name,
          pmEmail: user.email,
        }),
      });

      if (response.ok) {
        alert(`${orderForm.ticketType.charAt(0).toUpperCase() + orderForm.ticketType.slice(1)} ticket created successfully!`);
        setOrderForm({
          ticketType: 'delivery',
          jobId: '',
          jobName: '',
          jobAddress: '',
          city: '',
          state: 'AL',
          zip: '',
          customerName: '',
          customerPhone: '',
          customerEmail: '',
          requestedDate: '',
          requestedTime: '',
          priority: 'normal',
          specialInstructions: '',
          returnReason: '',
          pickupReason: '',
          relatedTicketId: '',
        });
        setSelectedMaterials([]);
        setActiveTab('tickets');
        loadData();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create ticket');
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
      alert('Error creating ticket');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredInventory = inventory.filter(item =>
    item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const myTickets = tickets.filter(t => t.jobName); // PM sees their tickets
  const pendingTickets = myTickets.filter(t => ['created', 'assigned', 'materials_pulled'].includes(t.status));
  const activeTickets = myTickets.filter(t => ['load_verified', 'en_route', 'arrived'].includes(t.status));
  const completedTickets = myTickets.filter(t => t.status === 'completed');

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="bg-neutral-900 rounded-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Access Required</h1>
          <p className="text-neutral-400 mb-6">Please log in to access the Project Manager portal.</p>
          <Link
            href="/portal"
            className="inline-flex items-center gap-2 bg-brand-green hover:bg-brand-green/90 text-white font-medium px-6 py-3 rounded-xl transition-colors"
          >
            <ArrowLeft size={18} />
            Back to Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/portal" className="text-neutral-400 hover:text-white transition-colors">
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-white">Project Manager Portal</h1>
                <p className="text-sm text-neutral-400">Welcome, {user.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('create')}
                className="flex items-center gap-2 bg-brand-green hover:bg-brand-green/90 text-white font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <Plus size={18} />
                New Order
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-neutral-900/50 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Package },
              { id: 'create', label: 'Create Order', icon: Plus },
              { id: 'tickets', label: 'My Tickets', icon: Truck },
              { id: 'returns', label: 'Returns/Pickups', icon: RotateCcw },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? 'text-brand-green border-brand-green'
                      : 'text-neutral-400 border-transparent hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                    <Clock className="text-yellow-500" size={20} />
                  </div>
                  <span className="text-neutral-400">Pending</span>
                </div>
                <p className="text-3xl font-bold text-white">{pendingTickets.length}</p>
              </div>
              <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Truck className="text-blue-500" size={20} />
                  </div>
                  <span className="text-neutral-400">In Progress</span>
                </div>
                <p className="text-3xl font-bold text-white">{activeTickets.length}</p>
              </div>
              <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="text-green-500" size={20} />
                  </div>
                  <span className="text-neutral-400">Completed</span>
                </div>
                <p className="text-3xl font-bold text-white">{completedTickets.length}</p>
              </div>
              <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <FileText className="text-purple-500" size={20} />
                  </div>
                  <span className="text-neutral-400">Total Orders</span>
                </div>
                <p className="text-3xl font-bold text-white">{myTickets.length}</p>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-neutral-900 rounded-xl border border-neutral-800">
              <div className="p-4 border-b border-neutral-800">
                <h2 className="text-lg font-semibold text-white">Recent Orders</h2>
              </div>
              <div className="divide-y divide-neutral-800">
                {myTickets.slice(0, 5).map(ticket => (
                  <div key={ticket.ticketId} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        ticket.ticketType === 'delivery' ? 'bg-blue-500/20' :
                        ticket.ticketType === 'pickup' ? 'bg-orange-500/20' : 'bg-purple-500/20'
                      }`}>
                        {ticket.ticketType === 'delivery' ? <Truck className="text-blue-500" size={20} /> :
                         ticket.ticketType === 'pickup' ? <Package className="text-orange-500" size={20} /> :
                         <RotateCcw className="text-purple-500" size={20} />}
                      </div>
                      <div>
                        <p className="font-medium text-white">{ticket.jobName}</p>
                        <p className="text-sm text-neutral-400">{ticket.jobAddress}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        ticket.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        ticket.status === 'en_route' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {ticket.status.replace(/_/g, ' ')}
                      </span>
                      <p className="text-xs text-neutral-500 mt-1">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
                {myTickets.length === 0 && (
                  <div className="p-8 text-center text-neutral-400">
                    No orders yet. Create your first order!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Order Form */}
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Create New Order</h2>

              {/* Ticket Type */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-300 mb-2">Order Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'delivery', label: 'Delivery', icon: Truck, color: 'blue' },
                    { value: 'pickup', label: 'Pickup', icon: Package, color: 'orange' },
                    { value: 'return', label: 'Return', icon: RotateCcw, color: 'purple' },
                  ].map(type => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        onClick={() => setOrderForm(prev => ({ ...prev, ticketType: type.value as typeof orderForm.ticketType }))}
                        className={`p-3 rounded-lg border transition-colors flex flex-col items-center gap-2 ${
                          orderForm.ticketType === type.value
                            ? `border-${type.color}-500 bg-${type.color}-500/10`
                            : 'border-neutral-700 hover:border-neutral-600'
                        }`}
                      >
                        <Icon size={20} className={orderForm.ticketType === type.value ? `text-${type.color}-500` : 'text-neutral-400'} />
                        <span className={`text-sm font-medium ${orderForm.ticketType === type.value ? 'text-white' : 'text-neutral-400'}`}>
                          {type.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Job Info */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Job Name *</label>
                  <input
                    type="text"
                    value={orderForm.jobName}
                    onChange={e => setOrderForm(prev => ({ ...prev, jobName: e.target.value }))}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-green"
                    placeholder="Smith Roof Replacement"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Job ID</label>
                  <input
                    type="text"
                    value={orderForm.jobId}
                    onChange={e => setOrderForm(prev => ({ ...prev, jobId: e.target.value }))}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-green"
                    placeholder="JOB-001"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-300 mb-1">Address *</label>
                <input
                  type="text"
                  value={orderForm.jobAddress}
                  onChange={e => setOrderForm(prev => ({ ...prev, jobAddress: e.target.value }))}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-green"
                  placeholder="123 Main St"
                />
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">City *</label>
                  <input
                    type="text"
                    value={orderForm.city}
                    onChange={e => setOrderForm(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-green"
                    placeholder="Huntsville"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">State</label>
                  <input
                    type="text"
                    value={orderForm.state}
                    onChange={e => setOrderForm(prev => ({ ...prev, state: e.target.value }))}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-green"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">ZIP</label>
                  <input
                    type="text"
                    value={orderForm.zip}
                    onChange={e => setOrderForm(prev => ({ ...prev, zip: e.target.value }))}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-green"
                    placeholder="35801"
                  />
                </div>
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={orderForm.customerName}
                    onChange={e => setOrderForm(prev => ({ ...prev, customerName: e.target.value }))}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-green"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Customer Phone</label>
                  <input
                    type="tel"
                    value={orderForm.customerPhone}
                    onChange={e => setOrderForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-green"
                  />
                </div>
              </div>

              {/* Date & Priority */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Date *</label>
                  <input
                    type="date"
                    value={orderForm.requestedDate}
                    onChange={e => setOrderForm(prev => ({ ...prev, requestedDate: e.target.value }))}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-green"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Time</label>
                  <input
                    type="time"
                    value={orderForm.requestedTime}
                    onChange={e => setOrderForm(prev => ({ ...prev, requestedTime: e.target.value }))}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-green"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Priority</label>
                  <select
                    value={orderForm.priority}
                    onChange={e => setOrderForm(prev => ({ ...prev, priority: e.target.value as typeof orderForm.priority }))}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-green"
                  >
                    <option value="normal">Normal</option>
                    <option value="rush">Rush (+$50)</option>
                    <option value="urgent">Urgent (+$100)</option>
                  </select>
                </div>
              </div>

              {/* Return/Pickup specific fields */}
              {orderForm.ticketType === 'return' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Return Reason</label>
                  <textarea
                    value={orderForm.returnReason}
                    onChange={e => setOrderForm(prev => ({ ...prev, returnReason: e.target.value }))}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-green"
                    rows={2}
                    placeholder="Reason for return..."
                  />
                </div>
              )}

              {orderForm.ticketType === 'pickup' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Pickup Reason</label>
                  <textarea
                    value={orderForm.pickupReason}
                    onChange={e => setOrderForm(prev => ({ ...prev, pickupReason: e.target.value }))}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-green"
                    rows={2}
                    placeholder="Reason for pickup..."
                  />
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-300 mb-1">Special Instructions</label>
                <textarea
                  value={orderForm.specialInstructions}
                  onChange={e => setOrderForm(prev => ({ ...prev, specialInstructions: e.target.value }))}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-green"
                  rows={2}
                  placeholder="Gate code, delivery location, etc..."
                />
              </div>

              {/* Selected Materials Summary */}
              {selectedMaterials.length > 0 && (
                <div className="bg-neutral-800 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-medium text-white mb-2">Selected Materials ({selectedMaterials.length})</h3>
                  <div className="space-y-2">
                    {selectedMaterials.map(m => (
                      <div key={m.productId} className="flex items-center justify-between text-sm">
                        <span className="text-neutral-300">{m.quantity} {m.unit} - {m.productName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white">${m.totalPrice.toFixed(2)}</span>
                          <button
                            onClick={() => handleRemoveMaterial(m.productId)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="border-t border-neutral-700 pt-2 mt-2 flex justify-between font-medium">
                      <span className="text-white">Total</span>
                      <span className="text-brand-green">
                        ${selectedMaterials.reduce((sum, m) => sum + m.totalPrice, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleSubmitOrder}
                disabled={isLoading}
                className="w-full bg-brand-green hover:bg-brand-green/90 disabled:bg-neutral-700 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                Create {orderForm.ticketType.charAt(0).toUpperCase() + orderForm.ticketType.slice(1)} Ticket
              </button>
            </div>

            {/* Material Selection */}
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Select Materials</h2>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-brand-green"
                  placeholder="Search materials..."
                />
              </div>

              <div className="max-h-[600px] overflow-y-auto space-y-2">
                {filteredInventory.map(item => (
                  <div key={item.productId} className="bg-neutral-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-white">{item.productName}</p>
                        <p className="text-xs text-neutral-400">{item.category} • {item.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-white">${item.retailPrice.toFixed(2)}/{item.unit}</p>
                        <p className="text-xs text-neutral-400">{item.currentQty} in stock</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {[1, 5, 10, 25].map(qty => (
                        <button
                          key={qty}
                          onClick={() => handleAddMaterial(item, qty)}
                          disabled={item.currentQty < qty}
                          className="flex-1 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:text-neutral-600 text-white text-sm py-1 rounded transition-colors"
                        >
                          +{qty}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {filteredInventory.length === 0 && (
                  <div className="text-center py-8 text-neutral-400">
                    No materials found
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="bg-neutral-900 rounded-xl border border-neutral-800">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">My Delivery Tickets</h2>
              <button
                onClick={loadData}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <RotateCcw size={18} />
              </button>
            </div>
            <div className="divide-y divide-neutral-800">
              {myTickets.filter(t => t.ticketType === 'delivery').map(ticket => (
                <div key={ticket.ticketId} className="p-4 hover:bg-neutral-800/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <Truck className="text-blue-500" size={24} />
                      </div>
                      <div>
                        <p className="font-medium text-white">{ticket.jobName}</p>
                        <div className="flex items-center gap-2 text-sm text-neutral-400">
                          <MapPin size={14} />
                          <span>{ticket.jobAddress}</span>
                        </div>
                        {ticket.scheduledDate && (
                          <div className="flex items-center gap-2 text-sm text-neutral-400">
                            <Calendar size={14} />
                            <span>{new Date(ticket.scheduledDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        ticket.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        ticket.status === 'en_route' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {ticket.status.replace(/_/g, ' ')}
                      </span>
                      <p className="text-sm font-medium text-white mt-1">
                        ${ticket.totalMaterialCost.toFixed(2)}
                      </p>
                      {ticket.assignedDriverName && (
                        <p className="text-xs text-neutral-400">Driver: {ticket.assignedDriverName}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {myTickets.filter(t => t.ticketType === 'delivery').length === 0 && (
                <div className="p-8 text-center text-neutral-400">
                  No delivery tickets yet
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'returns' && (
          <div className="bg-neutral-900 rounded-xl border border-neutral-800">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Returns & Pickups</h2>
              <button
                onClick={() => {
                  setOrderForm(prev => ({ ...prev, ticketType: 'return' }));
                  setActiveTab('create');
                }}
                className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={16} />
                New Return
              </button>
            </div>
            <div className="divide-y divide-neutral-800">
              {myTickets.filter(t => t.ticketType === 'pickup' || t.ticketType === 'return').map(ticket => (
                <div key={ticket.ticketId} className="p-4 hover:bg-neutral-800/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        ticket.ticketType === 'pickup' ? 'bg-orange-500/20' : 'bg-purple-500/20'
                      }`}>
                        {ticket.ticketType === 'pickup'
                          ? <Package className="text-orange-500" size={24} />
                          : <RotateCcw className="text-purple-500" size={24} />
                        }
                      </div>
                      <div>
                        <p className="font-medium text-white">{ticket.jobName}</p>
                        <div className="flex items-center gap-2 text-sm text-neutral-400">
                          <MapPin size={14} />
                          <span>{ticket.jobAddress}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          ticket.ticketType === 'pickup' ? 'bg-orange-500/20 text-orange-400' : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {ticket.ticketType}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        ticket.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        ticket.status === 'picked_up' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {ticket.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {myTickets.filter(t => t.ticketType === 'pickup' || t.ticketType === 'return').length === 0 && (
                <div className="p-8 text-center text-neutral-400">
                  No return or pickup tickets yet
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
