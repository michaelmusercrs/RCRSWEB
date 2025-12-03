'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2, ArrowLeft, Plus, FileText, Package, Truck, DollarSign,
  Clock, CheckCircle2, AlertCircle, Search, Filter, RefreshCw, Loader2,
  ChevronRight, Users, Calendar, MapPin, Phone, Mail, Eye, CreditCard
} from 'lucide-react';
import type { DeliveryTicket, Invoice, TicketStatus } from '@/lib/delivery-workflow-service';
import type { Driver } from '@/lib/delivery-portal-service';
import type { InventoryItem } from '@/lib/delivery-portal-service';

type TabType = 'dashboard' | 'tickets' | 'invoices' | 'create';

const statusColors: Record<TicketStatus, string> = {
  created: 'bg-gray-500',
  assigned: 'bg-cyan-500',
  materials_pulled: 'bg-yellow-500',
  load_verified: 'bg-blue-500',
  en_route: 'bg-purple-500',
  arrived: 'bg-orange-500',
  delivered: 'bg-teal-500',
  picked_up: 'bg-teal-500',
  proof_captured: 'bg-indigo-500',
  qc_photos: 'bg-pink-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-500',
};

export default function OfficePage() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [tickets, setTickets] = useState<DeliveryTicket[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedTicket, setSelectedTicket] = useState<DeliveryTicket | null>(null);

  // Stats
  const [stats, setStats] = useState({
    activeTickets: 0,
    completedToday: 0,
    pendingInvoices: 0,
    pendingAmount: 0,
  });

  // New ticket form
  const [newTicket, setNewTicket] = useState({
    jobName: '',
    jobAddress: '',
    city: '',
    state: 'AL',
    zip: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    projectManager: '',
    pmPhone: '',
    pmEmail: '',
    requestedDate: new Date().toISOString().slice(0, 10),
    requestedTime: '',
    priority: 'normal' as 'normal' | 'rush' | 'urgent',
    specialInstructions: '',
    materials: [] as { productId: string; productName: string; quantity: number; unit: string; unitPrice: number; totalPrice: number; category: string }[],
    assignedDriver: '',
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [ticketsRes, invoicesRes, driversRes, inventoryRes] = await Promise.all([
        fetch('/api/portal/tickets'),
        fetch('/api/portal/invoices'),
        fetch('/api/portal/drivers'),
        fetch('/api/portal/inventory'),
      ]);

      const ticketsData = await ticketsRes.json();
      const invoicesData = await invoicesRes.json();
      const driversData = await driversRes.json();
      const inventoryData = await inventoryRes.json();

      setTickets(Array.isArray(ticketsData) ? ticketsData : []);
      setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
      setDrivers(Array.isArray(driversData) ? driversData : []);
      setInventory(Array.isArray(inventoryData) ? inventoryData : []);

      // Calculate stats
      const today = new Date().toISOString().slice(0, 10);
      const activeStatuses: TicketStatus[] = ['created', 'materials_pulled', 'load_verified', 'en_route', 'arrived', 'delivered', 'proof_captured', 'qc_photos'];
      const ticketArr = Array.isArray(ticketsData) ? ticketsData : [];
      const invoiceArr = Array.isArray(invoicesData) ? invoicesData : [];

      setStats({
        activeTickets: ticketArr.filter((t: DeliveryTicket) => activeStatuses.includes(t.status)).length,
        completedToday: ticketArr.filter((t: DeliveryTicket) => t.completedAt?.startsWith(today)).length,
        pendingInvoices: invoiceArr.filter((i: Invoice) => i.status === 'pending' || i.status === 'sent').length,
        pendingAmount: invoiceArr.filter((i: Invoice) => i.status === 'pending' || i.status === 'sent').reduce((sum: number, i: Invoice) => sum + i.total, 0),
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    try {
      const response = await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          createdBy: 'Office Portal',
          ...newTicket,
        }),
      });

      const result = await response.json();
      if (result.success) {
        // Reset form
        setNewTicket({
          jobName: '',
          jobAddress: '',
          city: '',
          state: 'AL',
          zip: '',
          customerName: '',
          customerPhone: '',
          customerEmail: '',
          projectManager: '',
          pmPhone: '',
          pmEmail: '',
          requestedDate: new Date().toISOString().slice(0, 10),
          requestedTime: '',
          priority: 'normal',
          specialInstructions: '',
          materials: [],
          assignedDriver: '',
        });
        setActiveTab('tickets');
        loadAllData();
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
    }
  };

  const handleAssignDriver = async (ticketId: string, driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return;

    try {
      await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign-driver',
          ticketId,
          driverId,
          driverName: driver.name,
          vehicle: driver.vehicle,
          scheduledDate: new Date().toISOString().slice(0, 10),
          scheduledTime: '09:00',
        }),
      });
      loadAllData();
    } catch (error) {
      console.error('Error assigning driver:', error);
    }
  };

  const handlePullMaterials = async (ticketId: string) => {
    try {
      await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pull-materials',
          ticketId,
          pulledBy: 'Warehouse',
        }),
      });
      loadAllData();
    } catch (error) {
      console.error('Error pulling materials:', error);
    }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    try {
      await fetch('/api/portal/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark-paid',
          invoiceId,
          paymentMethod: 'Check',
        }),
      });
      loadAllData();
    } catch (error) {
      console.error('Error marking invoice paid:', error);
    }
  };

  const addMaterial = (item: InventoryItem, quantity: number) => {
    setNewTicket(prev => ({
      ...prev,
      materials: [
        ...prev.materials,
        {
          productId: item.productId,
          productName: item.productName,
          quantity,
          unit: item.unit,
          unitPrice: item.unitCost,
          totalPrice: item.unitCost * quantity,
          category: item.category,
        },
      ],
    }));
  };

  const removeMaterial = (productId: string) => {
    setNewTicket(prev => ({
      ...prev,
      materials: prev.materials.filter(m => m.productId !== productId),
    }));
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = !searchTerm ||
      ticket.jobName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.ticketId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = !searchTerm ||
      invoice.jobName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.invoiceId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto text-brand-green" size={48} />
          <p className="text-neutral-400 mt-4">Loading office portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900">
      {/* Header */}
      <div className="bg-neutral-800 border-b border-neutral-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal" className="text-neutral-400 hover:text-white">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Office Portal</h1>
              <p className="text-sm text-neutral-400">Job Tracking & Invoicing</p>
            </div>
          </div>
          <button
            onClick={loadAllData}
            className="p-2 bg-neutral-700 rounded-lg hover:bg-neutral-600"
          >
            <RefreshCw size={20} className="text-neutral-400" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-neutral-800 border-b border-neutral-700">
        <div className="max-w-7xl mx-auto flex overflow-x-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Building2 },
            { id: 'tickets', label: 'Delivery Tickets', icon: Package },
            { id: 'invoices', label: 'Invoices', icon: DollarSign },
            { id: 'create', label: 'New Order', icon: Plus },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
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

      <div className="max-w-7xl mx-auto p-4">
        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Truck className="text-blue-400" size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{stats.activeTickets}</p>
                    <p className="text-sm text-neutral-400">Active Deliveries</p>
                  </div>
                </div>
              </div>

              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="text-green-400" size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{stats.completedToday}</p>
                    <p className="text-sm text-neutral-400">Completed Today</p>
                  </div>
                </div>
              </div>

              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                    <FileText className="text-yellow-400" size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{stats.pendingInvoices}</p>
                    <p className="text-sm text-neutral-400">Pending Invoices</p>
                  </div>
                </div>
              </div>

              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-green/20 rounded-lg flex items-center justify-center">
                    <DollarSign className="text-brand-green" size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">${stats.pendingAmount.toLocaleString()}</p>
                    <p className="text-sm text-neutral-400">Pending Amount</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Tickets */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Recent Tickets</h2>
                <button
                  onClick={() => setActiveTab('tickets')}
                  className="text-brand-green text-sm hover:underline"
                >
                  View All
                </button>
              </div>
              <div className="space-y-2">
                {tickets.slice(0, 5).map(ticket => (
                  <div
                    key={ticket.ticketId}
                    className="flex items-center justify-between p-3 bg-neutral-700/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${statusColors[ticket.status]}`} />
                      <div>
                        <p className="text-white font-medium">{ticket.jobName}</p>
                        <p className="text-neutral-400 text-sm">{ticket.customerName}</p>
                      </div>
                    </div>
                    <span className="text-neutral-500 text-sm">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Invoices */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Recent Invoices</h2>
                <button
                  onClick={() => setActiveTab('invoices')}
                  className="text-brand-green text-sm hover:underline"
                >
                  View All
                </button>
              </div>
              <div className="space-y-2">
                {invoices.slice(0, 5).map(invoice => (
                  <div
                    key={invoice.invoiceId}
                    className="flex items-center justify-between p-3 bg-neutral-700/50 rounded-lg"
                  >
                    <div>
                      <p className="text-white font-medium">{invoice.jobName}</p>
                      <p className="text-neutral-400 text-sm">{invoice.invoiceId}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">${invoice.total.toLocaleString()}</p>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        invoice.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                        invoice.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-neutral-500/20 text-neutral-400'
                      }`}>
                        {invoice.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tickets List */}
        {activeTab === 'tickets' && (
          <div className="space-y-4">
            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                <input
                  type="text"
                  placeholder="Search tickets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-10 pr-4 py-2 text-white"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-white"
              >
                <option value="">All Statuses</option>
                <option value="created">Created</option>
                <option value="materials_pulled">Materials Pulled</option>
                <option value="load_verified">Load Verified</option>
                <option value="en_route">En Route</option>
                <option value="arrived">Arrived</option>
                <option value="delivered">Delivered</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* Tickets Table */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Ticket</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Driver</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-700">
                    {filteredTickets.map(ticket => (
                      <tr key={ticket.ticketId} className="hover:bg-neutral-700/50">
                        <td className="px-4 py-3">
                          <p className="text-white font-medium">{ticket.jobName}</p>
                          <p className="text-neutral-500 text-xs">{ticket.ticketId}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white">{ticket.customerName}</p>
                          <p className="text-neutral-500 text-xs">{ticket.customerPhone}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${statusColors[ticket.status]}`}>
                            {ticket.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {ticket.assignedDriverName ? (
                            <p className="text-white">{ticket.assignedDriverName}</p>
                          ) : ticket.status === 'created' ? (
                            <select
                              onChange={(e) => handleAssignDriver(ticket.ticketId, e.target.value)}
                              className="bg-neutral-700 border border-neutral-600 rounded px-2 py-1 text-sm text-white"
                            >
                              <option value="">Assign...</option>
                              {drivers.filter(d => d.status === 'Available').map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-neutral-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white font-medium">${ticket.totalMaterialCost?.toLocaleString()}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {ticket.status === 'created' && ticket.assignedDriver && (
                              <button
                                onClick={() => handlePullMaterials(ticket.ticketId)}
                                className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded hover:bg-yellow-500/30"
                              >
                                Pull Materials
                              </button>
                            )}
                            <button className="p-1 text-neutral-400 hover:text-white">
                              <Eye size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Invoices List */}
        {activeTab === 'invoices' && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-10 pr-4 py-2 text-white"
              />
            </div>

            {/* Invoices Table */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Invoice</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Due</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-700">
                    {filteredInvoices.map(invoice => (
                      <tr key={invoice.invoiceId} className="hover:bg-neutral-700/50">
                        <td className="px-4 py-3">
                          <p className="text-white font-medium">{invoice.invoiceId}</p>
                          <p className="text-neutral-500 text-xs">{invoice.jobName}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white">{invoice.customerName}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white">{new Date(invoice.createdAt).toLocaleDateString()}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white">{invoice.dueDate}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white font-bold">${invoice.total.toLocaleString()}</p>
                          <p className="text-neutral-500 text-xs">
                            Materials: ${invoice.subtotal.toLocaleString()}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            invoice.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                            invoice.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            invoice.status === 'sent' ? 'bg-blue-500/20 text-blue-400' :
                            invoice.status === 'overdue' ? 'bg-red-500/20 text-red-400' :
                            'bg-neutral-500/20 text-neutral-400'
                          }`}>
                            {invoice.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {(invoice.status === 'pending' || invoice.status === 'sent') && (
                              <button
                                onClick={() => handleMarkPaid(invoice.invoiceId)}
                                className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded hover:bg-green-500/30 flex items-center gap-1"
                              >
                                <CreditCard size={12} />
                                Mark Paid
                              </button>
                            )}
                            <button className="p-1 text-neutral-400 hover:text-white">
                              <Eye size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Create New Ticket */}
        {activeTab === 'create' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <h2 className="text-xl font-bold text-white">Create Material Order</h2>

            {/* Job Info */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 space-y-4">
              <h3 className="text-lg font-semibold text-white">Job Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Job Name *</label>
                  <input
                    type="text"
                    value={newTicket.jobName}
                    onChange={(e) => setNewTicket({ ...newTicket, jobName: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                    placeholder="Smith Residence Roof"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    value={newTicket.customerName}
                    onChange={(e) => setNewTicket({ ...newTicket, customerName: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                    placeholder="John Smith"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-neutral-400 mb-1">Address *</label>
                  <input
                    type="text"
                    value={newTicket.jobAddress}
                    onChange={(e) => setNewTicket({ ...newTicket, jobAddress: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                    placeholder="123 Main St"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">City *</label>
                  <input
                    type="text"
                    value={newTicket.city}
                    onChange={(e) => setNewTicket({ ...newTicket, city: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                    placeholder="Huntsville"
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm text-neutral-400 mb-1">State</label>
                    <input
                      type="text"
                      value={newTicket.state}
                      onChange={(e) => setNewTicket({ ...newTicket, state: e.target.value })}
                      className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm text-neutral-400 mb-1">ZIP *</label>
                    <input
                      type="text"
                      value={newTicket.zip}
                      onChange={(e) => setNewTicket({ ...newTicket, zip: e.target.value })}
                      className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                      placeholder="35801"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Customer Phone *</label>
                  <input
                    type="tel"
                    value={newTicket.customerPhone}
                    onChange={(e) => setNewTicket({ ...newTicket, customerPhone: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                    placeholder="(256) 555-1234"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Customer Email</label>
                  <input
                    type="email"
                    value={newTicket.customerEmail}
                    onChange={(e) => setNewTicket({ ...newTicket, customerEmail: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                    placeholder="john@email.com"
                  />
                </div>
              </div>
            </div>

            {/* Project Manager */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 space-y-4">
              <h3 className="text-lg font-semibold text-white">Project Manager</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Name *</label>
                  <input
                    type="text"
                    value={newTicket.projectManager}
                    onChange={(e) => setNewTicket({ ...newTicket, projectManager: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newTicket.pmPhone}
                    onChange={(e) => setNewTicket({ ...newTicket, pmPhone: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={newTicket.pmEmail}
                    onChange={(e) => setNewTicket({ ...newTicket, pmEmail: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Details */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 space-y-4">
              <h3 className="text-lg font-semibold text-white">Delivery Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Requested Date *</label>
                  <input
                    type="date"
                    value={newTicket.requestedDate}
                    onChange={(e) => setNewTicket({ ...newTicket, requestedDate: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Preferred Time</label>
                  <input
                    type="time"
                    value={newTicket.requestedTime}
                    onChange={(e) => setNewTicket({ ...newTicket, requestedTime: e.target.value })}
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Priority</label>
                  <select
                    value={newTicket.priority}
                    onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as 'normal' | 'rush' | 'urgent' })}
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="normal">Normal</option>
                    <option value="rush">Rush (+$50)</option>
                    <option value="urgent">Urgent (+$100)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Special Instructions</label>
                <textarea
                  value={newTicket.specialInstructions}
                  onChange={(e) => setNewTicket({ ...newTicket, specialInstructions: e.target.value })}
                  rows={2}
                  className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white resize-none"
                  placeholder="Gate code, delivery location, etc."
                />
              </div>
            </div>

            {/* Materials */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 space-y-4">
              <h3 className="text-lg font-semibold text-white">Materials</h3>

              {/* Selected Materials */}
              {newTicket.materials.length > 0 && (
                <div className="space-y-2 mb-4">
                  {newTicket.materials.map(mat => (
                    <div key={mat.productId} className="flex items-center justify-between p-3 bg-neutral-700/50 rounded-lg">
                      <div>
                        <p className="text-white">{mat.productName}</p>
                        <p className="text-neutral-500 text-sm">{mat.quantity} {mat.unit} @ ${mat.unitPrice.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-white font-bold">${mat.totalPrice.toFixed(2)}</p>
                        <button
                          onClick={() => removeMaterial(mat.productId)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <AlertCircle size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between p-3 bg-brand-green/20 rounded-lg">
                    <span className="text-brand-green font-semibold">Total Materials</span>
                    <span className="text-brand-green font-bold">
                      ${newTicket.materials.reduce((sum, m) => sum + m.totalPrice, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Add Materials */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                {inventory.slice(0, 12).map(item => (
                  <button
                    key={item.productId}
                    onClick={() => addMaterial(item, 1)}
                    disabled={newTicket.materials.some(m => m.productId === item.productId)}
                    className="p-3 bg-neutral-700 rounded-lg text-left hover:bg-neutral-600 disabled:opacity-50"
                  >
                    <p className="text-white font-medium text-sm">{item.productName}</p>
                    <p className="text-neutral-400 text-xs">{item.category}</p>
                    <p className="text-brand-green font-bold mt-1">${item.unitCost.toFixed(2)}/{item.unit}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleCreateTicket}
              disabled={!newTicket.jobName || !newTicket.customerName || !newTicket.jobAddress || newTicket.materials.length === 0}
              className="w-full bg-brand-green hover:bg-lime-400 disabled:bg-neutral-700 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              Create Delivery Ticket
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
