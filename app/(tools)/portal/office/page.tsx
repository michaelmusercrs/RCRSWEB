'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Building2, ArrowLeft, Plus, FileText, Package, Truck, DollarSign,
  Clock, CheckCircle2, AlertCircle, Search, Filter, RefreshCw, Loader2,
  ChevronRight, Users, Calendar, MapPin, Phone, Mail, Eye, CreditCard, Command,
  AlertTriangle, TrendingUp, Send, X, ArrowUpRight, ArrowDownRight, ClipboardList
} from 'lucide-react';
import DeptNotesWidget from '@/components/portal/DeptNotesWidget';
import type { DeliveryTicket, Invoice, TicketStatus } from '@/lib/delivery-workflow-service';
import type { Driver } from '@/lib/delivery-portal-service';
import type { InventoryItem } from '@/lib/delivery-portal-service';

type TabType = 'dashboard' | 'tickets' | 'billing' | 'create';

// Billing-specific types
type InvoiceStatusFilter = 'all' | 'draft' | 'sent' | 'pending' | 'paid' | 'overdue' | 'cancelled';

interface BillingDashboardStats {
  unbilledDeliveries: { count: number; amount: number };
  overdueItems: { count: number; amount: number };
  pendingApprovals: { count: number; amount: number };
  vendorPaymentsDue: { count: number; amount: number };
  activeAlerts: { critical: number; high: number; medium: number; low: number };
  todayActivity: { deliveries: number; returns: number; purchases: number };
  weeklyTotals: { billed: number; cost: number; profit: number };
}

interface PipelineOrder {
  orderId: string;
  jobNumber: string;
  customerName: string;
  jobAddress: string;
  currentStage: string;
  totalCost: number;
  totalPrice: number;
  priority: string;
  updatedAt: string;
  createdAt: string;
}

interface RevenueSummary {
  totalRevenue: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueYTD: number;
  monthOverMonthGrowth: number;
  paidThisMonth: number;
  overdueAmount: number;
  outstandingInvoices: number;
}

interface PaymentModalState {
  isOpen: boolean;
  invoiceId: string;
  invoiceTotal: number;
  customerName: string;
  balanceDue: number;
}

const statusColors: Record<TicketStatus, string> = {
  created: 'bg-white/50',
  assigned: 'bg-cyan-500',
  materials_pulled: 'bg-yellow-500',
  load_verified: 'bg-brand-green',
  en_route: 'bg-purple-500',
  arrived: 'bg-orange-500',
  delivered: 'bg-teal-500',
  picked_up: 'bg-teal-500',
  proof_captured: 'bg-brand-green',
  qc_photos: 'bg-pink-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-500',
};

const invoiceStatusStyles: Record<string, string> = {
  draft: 'bg-neutral-500/20 text-neutral-400',
  sent: 'bg-blue-500/20 text-blue-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
  paid: 'bg-green-500/20 text-green-400',
  overdue: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-neutral-600/20 text-neutral-500',
  viewed: 'bg-cyan-500/20 text-cyan-400',
  approved: 'bg-brand-green/20 text-brand-green',
  disputed: 'bg-orange-500/20 text-orange-400',
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

  // Billing state
  const [billingStats, setBillingStats] = useState<BillingDashboardStats | null>(null);
  const [pipelineOrders, setPipelineOrders] = useState<PipelineOrder[]>([]);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<InvoiceStatusFilter>('all');
  const [billingSearchTerm, setBillingSearchTerm] = useState('');
  const [revenueSummary, setRevenueSummary] = useState<RevenueSummary | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [paymentModal, setPaymentModal] = useState<PaymentModalState>({
    isOpen: false,
    invoiceId: '',
    invoiceTotal: 0,
    customerName: '',
    balanceDue: 0,
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'check' as string,
    reference: '',
    notes: '',
  });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  // Full invoices from invoice-service (richer data than delivery-workflow invoices)
  const [fullInvoices, setFullInvoices] = useState<any[]>([]);

  // Stats
  const [stats, setStats] = useState({
    activeTickets: 0,
    completedToday: 0,
    pendingInvoices: 0,
    pendingAmount: 0,
    overdueInvoices: 0,
    overdueAmount: 0,
    paidThisMonth: 0,
    billingReviewCount: 0,
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

  // Helper to safely extract data from API responses
  const extractData = (data: any, key: string) => {
    if (Array.isArray(data)) return data;
    if (data?.data?.[key]) return data.data[key];
    if (data?.[key]) return data[key];
    if (data?.data && Array.isArray(data.data)) return data.data;
    return [];
  };

  const loadAllData = useCallback(async () => {
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

      const ticketArr = extractData(ticketsData, 'tickets');
      const invoiceArr = extractData(invoicesData, 'invoices');

      setTickets(Array.isArray(ticketArr) ? ticketArr : []);
      setInvoices(Array.isArray(invoiceArr) ? invoiceArr : []);
      setDrivers(Array.isArray(driversData) ? driversData : extractData(driversData, 'drivers'));
      setInventory(Array.isArray(inventoryData) ? inventoryData : extractData(inventoryData, 'inventory'));

      // Calculate stats
      const today = new Date().toISOString().slice(0, 10);
      const thisMonthStart = new Date().toISOString().slice(0, 7);
      const activeStatuses: TicketStatus[] = ['created', 'materials_pulled', 'load_verified', 'en_route', 'arrived', 'delivered', 'proof_captured', 'qc_photos'];
      const safeTickets = Array.isArray(ticketArr) ? ticketArr : [];
      const safeInvoices = Array.isArray(invoiceArr) ? invoiceArr : [];

      const overdueInvs = safeInvoices.filter((i: Invoice) =>
        i.status === 'overdue' || (
          (i.status === 'pending' || i.status === 'sent') &&
          i.dueDate && i.dueDate < today
        )
      );

      const paidThisMonth = safeInvoices
        .filter((i: Invoice) => i.status === 'paid' && i.paidAt && i.paidAt.startsWith(thisMonthStart))
        .reduce((sum: number, i: Invoice) => sum + (i.total || 0), 0);

      setStats({
        activeTickets: safeTickets.filter((t: DeliveryTicket) => activeStatuses.includes(t.status)).length,
        completedToday: safeTickets.filter((t: DeliveryTicket) => t.completedAt?.startsWith(today)).length,
        pendingInvoices: safeInvoices.filter((i: Invoice) => i.status === 'pending' || i.status === 'sent').length,
        pendingAmount: safeInvoices.filter((i: Invoice) => i.status === 'pending' || i.status === 'sent').reduce((sum: number, i: Invoice) => sum + (i.total || 0), 0),
        overdueInvoices: overdueInvs.length,
        overdueAmount: overdueInvs.reduce((sum: number, i: Invoice) => sum + (i.total || 0), 0),
        paidThisMonth,
        billingReviewCount: 0,
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load billing-specific data
  const loadBillingData = useCallback(async () => {
    setBillingLoading(true);
    try {
      const [billingDashRes, pipelineRes, fullInvoicesRes] = await Promise.allSettled([
        fetch('/api/portal/billing?action=dashboard'),
        fetch('/api/portal/material-orders?status=BILLING_REVIEW'),
        fetch('/api/portal/delivery/invoices'),
      ]);

      // Billing dashboard stats
      if (billingDashRes.status === 'fulfilled' && billingDashRes.value.ok) {
        const data = await billingDashRes.value.json();
        setBillingStats(data);
      }

      // Pipeline orders at BILLING_REVIEW stage
      if (pipelineRes.status === 'fulfilled' && pipelineRes.value.ok) {
        const data = await pipelineRes.value.json();
        const orders = data?.orders || (Array.isArray(data) ? data : []);
        // Filter to BILLING_REVIEW stage
        const billingReviewOrders = orders.filter((o: any) => o.currentStage === 'BILLING_REVIEW');
        setPipelineOrders(billingReviewOrders);
        setStats(prev => ({ ...prev, billingReviewCount: billingReviewOrders.length }));
      }

      // Full invoices from invoice-service
      if (fullInvoicesRes.status === 'fulfilled' && fullInvoicesRes.value.ok) {
        const data = await fullInvoicesRes.value.json();
        const invs = data?.invoices || data?.data?.invoices || [];
        setFullInvoices(Array.isArray(invs) ? invs : []);
      }

      // Revenue summary from financial API (try, fallback to commission data)
      try {
        const finRes = await fetch('/api/command-center/financial?action=summary');
        if (finRes.ok) {
          const finData = await finRes.json();
          const summary = finData?.data || finData;
          setRevenueSummary({
            totalRevenue: summary.totalRevenue || 0,
            revenueThisMonth: summary.revenueThisMonth || 0,
            revenueLastMonth: summary.revenueLastMonth || 0,
            revenueYTD: summary.revenueYTD || 0,
            monthOverMonthGrowth: summary.monthOverMonthGrowth || 0,
            paidThisMonth: summary.cashInflow || 0,
            overdueAmount: summary.overdueAmount || 0,
            outstandingInvoices: summary.outstandingInvoices || 0,
          });
        }
      } catch {
        // Financial API requires admin, ok to fail for office role
      }
    } catch (error) {
      console.error('Error loading billing data:', error);
    } finally {
      setBillingLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Load billing data when billing tab is activated
  useEffect(() => {
    if (activeTab === 'billing' || activeTab === 'dashboard') {
      loadBillingData();
    }
  }, [activeTab, loadBillingData]);

  const handleCreateTicket = async () => {
    try {
      const response = await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          createdBy: 'Operations',
          ...newTicket,
        }),
      });

      const result = await response.json();
      if (result.success) {
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

  // Quick mark-paid (for simple delivery invoices)
  const handleQuickMarkPaid = async (invoiceId: string) => {
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
      loadBillingData();
    } catch (error) {
      console.error('Error marking invoice paid:', error);
    }
  };

  // Record payment with details (for full invoices)
  const handleRecordPayment = async () => {
    if (!paymentModal.invoiceId || !paymentForm.amount) return;
    setPaymentSubmitting(true);

    try {
      const res = await fetch('/api/portal/delivery/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record-payment',
          invoiceId: paymentModal.invoiceId,
          payment: {
            date: new Date().toISOString().slice(0, 10),
            amount: parseFloat(paymentForm.amount),
            method: paymentForm.method,
            reference: paymentForm.reference,
            notes: paymentForm.notes,
          },
        }),
      });

      if (res.ok) {
        setPaymentModal({ isOpen: false, invoiceId: '', invoiceTotal: 0, customerName: '', balanceDue: 0 });
        setPaymentForm({ amount: '', method: 'check', reference: '', notes: '' });
        loadAllData();
        loadBillingData();
      }
    } catch (error) {
      console.error('Error recording payment:', error);
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // Send invoice action
  const handleSendInvoice = async (invoiceId: string) => {
    try {
      await fetch('/api/portal/delivery/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', invoiceId }),
      });
      loadBillingData();
      loadAllData();
    } catch (error) {
      console.error('Error sending invoice:', error);
    }
  };

  // Create invoice from pipeline order
  const handleCreateInvoiceFromOrder = async (order: PipelineOrder) => {
    try {
      await fetch('/api/portal/delivery/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          data: {
            jobId: order.jobNumber,
            customerName: order.customerName,
            jobAddress: { street: order.jobAddress, city: '', state: 'AL', zip: '' },
            billingAddress: { street: order.jobAddress, city: '', state: 'AL', zip: '' },
            type: 'final',
            terms: 'Net 30',
            notes: `Created from pipeline order ${order.orderId}`,
            lineItems: [{
              id: `li-${Date.now()}`,
              description: `Roofing materials and delivery - Order ${order.orderId}`,
              category: 'materials',
              quantity: 1,
              unit: 'job',
              unitPrice: order.totalPrice || order.totalCost,
              total: order.totalPrice || order.totalCost,
              taxable: false,
            }],
          },
        }),
      });
      loadBillingData();
      loadAllData();
    } catch (error) {
      console.error('Error creating invoice from order:', error);
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

  // Combine delivery-workflow invoices + full invoice-service invoices for billing tab
  const allBillingInvoices = (() => {
    const merged = new Map<string, any>();

    // Add delivery-workflow invoices
    for (const inv of invoices) {
      merged.set(inv.invoiceId, {
        invoiceId: inv.invoiceId,
        jobName: inv.jobName,
        customerName: inv.customerName,
        customerEmail: inv.customerEmail || '',
        status: inv.status,
        total: inv.total || 0,
        subtotal: inv.subtotal || 0,
        balanceDue: inv.total || 0,
        amountPaid: 0,
        dueDate: inv.dueDate || '',
        createdAt: inv.createdAt || '',
        paidAt: inv.paidAt || '',
        type: 'delivery',
        source: 'delivery-workflow',
      });
    }

    // Add/overlay full invoices (richer data)
    for (const inv of fullInvoices) {
      merged.set(inv.invoiceId, {
        invoiceId: inv.invoiceId,
        jobName: inv.jobId || inv.jobName || '',
        customerName: inv.customerName || '',
        customerEmail: inv.customerEmail || '',
        status: inv.status || 'draft',
        total: inv.total || 0,
        subtotal: inv.subtotal || 0,
        balanceDue: inv.balanceDue ?? inv.total ?? 0,
        amountPaid: inv.amountPaid || 0,
        dueDate: inv.dueDate || '',
        createdAt: inv.createdAt || '',
        paidAt: inv.paidAt || '',
        type: inv.type || 'final',
        source: 'invoice-service',
        payments: inv.payments || [],
      });
    }

    return Array.from(merged.values());
  })();

  // Filter billing invoices
  const filteredBillingInvoices = allBillingInvoices.filter(inv => {
    const today = new Date().toISOString().slice(0, 10);
    const isOverdue = inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'draft'
      && inv.dueDate && inv.dueDate < today && inv.balanceDue > 0;

    const effectiveStatus = isOverdue ? 'overdue' : inv.status;

    const matchesSearch = !billingSearchTerm ||
      inv.invoiceId.toLowerCase().includes(billingSearchTerm.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(billingSearchTerm.toLowerCase()) ||
      inv.jobName.toLowerCase().includes(billingSearchTerm.toLowerCase());

    const matchesStatus = invoiceStatusFilter === 'all' || effectiveStatus === invoiceStatusFilter;

    return matchesSearch && matchesStatus;
  });

  // Stats counts for billing tab filter buttons
  const billingCounts = (() => {
    const today = new Date().toISOString().slice(0, 10);
    const counts: Record<string, number> = { all: allBillingInvoices.length, draft: 0, sent: 0, pending: 0, paid: 0, overdue: 0 };
    for (const inv of allBillingInvoices) {
      const isOverdue = inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'draft'
        && inv.dueDate && inv.dueDate < today && inv.balanceDue > 0;
      const s = isOverdue ? 'overdue' : inv.status;
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  })();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Building2 className="text-emerald-400" size={28} />
            </div>
            <div className="absolute inset-0 rounded-2xl">
              <Loader2 className="absolute -top-2 -right-2 animate-spin text-brand-green" size={20} />
            </div>
          </div>
          <div className="text-center">
            <p className="text-white font-medium">Loading Operations</p>
            <p className="text-sm text-neutral-500">Fetching orders and tickets...</p>
          </div>
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
              <h1 className="text-xl font-bold text-white">Operations & Billing</h1>
              <p className="text-sm text-neutral-400">Job Tracking, Invoicing & Payments</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/command-center"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-brand-green/20 to-emerald-500/20 hover:from-brand-green/30 hover:to-emerald-500/30 border border-brand-green/30 text-brand-green text-sm font-medium transition-all"
            >
              <Command size={16} />
              <span className="hidden sm:inline">RoofStack HQ</span>
            </Link>
            <button
              onClick={() => { loadAllData(); loadBillingData(); }}
              className="p-2 bg-neutral-700 rounded-lg hover:bg-neutral-600"
            >
              <RefreshCw size={20} className="text-neutral-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-neutral-800 border-b border-neutral-700">
        <div className="max-w-7xl mx-auto flex overflow-x-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Building2 },
            { id: 'billing', label: 'Billing', icon: CreditCard, badge: stats.overdueInvoices > 0 ? stats.overdueInvoices : undefined },
            { id: 'tickets', label: 'Deliveries', icon: Package },
            { id: 'create', label: 'New Order', icon: Plus },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap relative ${
                activeTab === tab.id
                  ? 'text-brand-green border-b-2 border-brand-green'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
              {'badge' in tab && tab.badge ? (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        {/* ============================================================ */}
        {/* DASHBOARD TAB */}
        {/* ============================================================ */}
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
                  <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="text-red-400" size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{stats.overdueInvoices}</p>
                    <p className="text-sm text-neutral-400">Overdue</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Monday Notes */}
            <DeptNotesWidget category="office" />

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => { setActiveTab('billing'); setInvoiceStatusFilter('overdue'); }}
                className="flex items-center gap-4 p-4 bg-neutral-800 border border-neutral-700 rounded-xl hover:border-red-500/30 hover:bg-red-500/5 transition-all text-left"
              >
                <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center shrink-0">
                  <AlertTriangle className="text-red-400" size={20} />
                </div>
                <div>
                  <p className="text-white font-medium">View Overdue</p>
                  <p className="text-sm text-neutral-400">
                    {stats.overdueInvoices} invoice{stats.overdueInvoices !== 1 ? 's' : ''} - ${stats.overdueAmount.toLocaleString()}
                  </p>
                </div>
              </button>

              <button
                onClick={() => { setActiveTab('billing'); setInvoiceStatusFilter('pending'); }}
                className="flex items-center gap-4 p-4 bg-neutral-800 border border-neutral-700 rounded-xl hover:border-yellow-500/30 hover:bg-yellow-500/5 transition-all text-left"
              >
                <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center shrink-0">
                  <Clock className="text-yellow-400" size={20} />
                </div>
                <div>
                  <p className="text-white font-medium">Pending Invoices</p>
                  <p className="text-sm text-neutral-400">
                    {stats.pendingInvoices} pending - ${stats.pendingAmount.toLocaleString()}
                  </p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('create')}
                className="flex items-center gap-4 p-4 bg-neutral-800 border border-brand-green/30 rounded-xl hover:bg-brand-green/5 transition-all text-left"
              >
                <div className="w-10 h-10 bg-brand-green/20 rounded-lg flex items-center justify-center shrink-0">
                  <Plus className="text-brand-green" size={20} />
                </div>
                <div>
                  <p className="text-white font-medium">Create New Order</p>
                  <p className="text-sm text-neutral-400">Start a new delivery ticket</p>
                </div>
              </button>
            </div>

            {/* Revenue Summary (if available) */}
            {revenueSummary && (
              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp size={20} className="text-brand-green" />
                  Revenue Summary
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-neutral-700/40 rounded-lg p-3">
                    <p className="text-sm text-neutral-400">This Month</p>
                    <p className="text-xl font-bold text-white">${(revenueSummary.revenueThisMonth / 1000).toFixed(0)}K</p>
                    {revenueSummary.monthOverMonthGrowth !== 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        {revenueSummary.monthOverMonthGrowth > 0 ? (
                          <ArrowUpRight size={14} className="text-brand-green" />
                        ) : (
                          <ArrowDownRight size={14} className="text-red-400" />
                        )}
                        <span className={`text-xs font-medium ${revenueSummary.monthOverMonthGrowth > 0 ? 'text-brand-green' : 'text-red-400'}`}>
                          {Math.abs(revenueSummary.monthOverMonthGrowth).toFixed(1)}% vs last month
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="bg-neutral-700/40 rounded-lg p-3">
                    <p className="text-sm text-neutral-400">Year to Date</p>
                    <p className="text-xl font-bold text-white">${(revenueSummary.revenueYTD / 1000).toFixed(0)}K</p>
                  </div>
                  <div className="bg-neutral-700/40 rounded-lg p-3">
                    <p className="text-sm text-neutral-400">Outstanding</p>
                    <p className="text-xl font-bold text-yellow-400">{revenueSummary.outstandingInvoices}</p>
                    <p className="text-xs text-neutral-500">invoices unpaid</p>
                  </div>
                  <div className="bg-neutral-700/40 rounded-lg p-3">
                    <p className="text-sm text-neutral-400">Overdue Total</p>
                    <p className="text-xl font-bold text-red-400">${revenueSummary.overdueAmount.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Pipeline: Orders Awaiting Billing Review */}
            {pipelineOrders.length > 0 && (
              <div className="bg-neutral-800 border border-orange-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <ClipboardList size={20} className="text-orange-400" />
                    Awaiting Billing Review
                    <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-orange-500/20 text-orange-400">
                      {pipelineOrders.length}
                    </span>
                  </h2>
                  <button
                    onClick={() => { setActiveTab('billing'); setInvoiceStatusFilter('all'); }}
                    className="text-brand-green text-sm hover:underline"
                  >
                    View in Billing
                  </button>
                </div>
                <div className="space-y-2">
                  {pipelineOrders.slice(0, 5).map(order => (
                    <div
                      key={order.orderId}
                      className="flex items-center justify-between p-3 bg-neutral-700/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-orange-400" />
                        <div>
                          <p className="text-white font-medium">{order.customerName}</p>
                          <p className="text-neutral-400 text-xs">{order.orderId} - {order.jobAddress}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-white font-bold">${(order.totalPrice || order.totalCost || 0).toLocaleString()}</p>
                        <button
                          onClick={() => handleCreateInvoiceFromOrder(order)}
                          className="px-2 py-1 bg-brand-green/20 text-brand-green text-xs rounded hover:bg-brand-green/30 flex items-center gap-1"
                        >
                          <FileText size={12} />
                          Invoice
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                {tickets.length === 0 && (
                  <p className="text-neutral-500 text-center py-4">No delivery tickets yet</p>
                )}
              </div>
            </div>

            {/* Recent Invoices */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Recent Invoices</h2>
                <button
                  onClick={() => setActiveTab('billing')}
                  className="text-brand-green text-sm hover:underline"
                >
                  View All
                </button>
              </div>
              <div className="space-y-2">
                {allBillingInvoices.slice(0, 5).map(invoice => (
                  <div
                    key={invoice.invoiceId}
                    className="flex items-center justify-between p-3 bg-neutral-700/50 rounded-lg"
                  >
                    <div>
                      <p className="text-white font-medium">{invoice.customerName || invoice.jobName}</p>
                      <p className="text-neutral-400 text-sm">{invoice.invoiceId}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">${(invoice.total || 0).toLocaleString()}</p>
                      <span className={`text-xs px-2 py-0.5 rounded ${invoiceStatusStyles[invoice.status] || 'bg-neutral-500/20 text-neutral-400'}`}>
                        {invoice.status}
                      </span>
                    </div>
                  </div>
                ))}
                {allBillingInvoices.length === 0 && (
                  <p className="text-neutral-500 text-center py-4">No invoices yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* BILLING TAB */}
        {/* ============================================================ */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            {/* Billing Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-green/20 rounded-lg flex items-center justify-center">
                    <DollarSign className="text-brand-green" size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">${stats.pendingAmount.toLocaleString()}</p>
                    <p className="text-sm text-neutral-400">Outstanding</p>
                  </div>
                </div>
              </div>

              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="text-green-400" size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">${stats.paidThisMonth.toLocaleString()}</p>
                    <p className="text-sm text-neutral-400">Paid This Month</p>
                  </div>
                </div>
              </div>

              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="text-red-400" size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-400">${stats.overdueAmount.toLocaleString()}</p>
                    <p className="text-sm text-neutral-400">Overdue</p>
                  </div>
                </div>
              </div>

              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <ClipboardList className="text-orange-400" size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{stats.billingReviewCount}</p>
                    <p className="text-sm text-neutral-400">Awaiting Review</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Billing Workflow Stats (from billing-workflow-service) */}
            {billingStats && (
              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-3">Billing Workflow</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-neutral-700/40 rounded-lg p-3">
                    <p className="text-xs text-neutral-500">Unbilled Deliveries</p>
                    <p className="text-lg font-bold text-yellow-400">{billingStats.unbilledDeliveries.count}</p>
                    <p className="text-xs text-neutral-500">${billingStats.unbilledDeliveries.amount.toLocaleString()}</p>
                  </div>
                  <div className="bg-neutral-700/40 rounded-lg p-3">
                    <p className="text-xs text-neutral-500">Vendor Payments Due</p>
                    <p className="text-lg font-bold text-orange-400">{billingStats.vendorPaymentsDue.count}</p>
                    <p className="text-xs text-neutral-500">${billingStats.vendorPaymentsDue.amount.toLocaleString()}</p>
                  </div>
                  <div className="bg-neutral-700/40 rounded-lg p-3">
                    <p className="text-xs text-neutral-500">Weekly Billed</p>
                    <p className="text-lg font-bold text-brand-green">${billingStats.weeklyTotals.billed.toLocaleString()}</p>
                  </div>
                  <div className="bg-neutral-700/40 rounded-lg p-3">
                    <p className="text-xs text-neutral-500">Weekly Profit</p>
                    <p className="text-lg font-bold text-brand-green">${billingStats.weeklyTotals.profit.toLocaleString()}</p>
                  </div>
                </div>
                {(billingStats.activeAlerts.critical > 0 || billingStats.activeAlerts.high > 0) && (
                  <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                    <AlertTriangle size={16} className="text-red-400" />
                    <span className="text-sm text-red-400">
                      {billingStats.activeAlerts.critical} critical, {billingStats.activeAlerts.high} high priority alerts
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Pipeline Orders at BILLING_REVIEW stage */}
            {pipelineOrders.length > 0 && (
              <div className="bg-neutral-800 border border-orange-500/20 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <ClipboardList size={16} />
                  Pipeline - Billing Review (Stage 15)
                </h3>
                <div className="space-y-2">
                  {pipelineOrders.map(order => (
                    <div
                      key={order.orderId}
                      className="flex items-center justify-between p-3 bg-neutral-700/50 rounded-lg hover:bg-neutral-700/70 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          order.priority === 'urgent' ? 'bg-red-500' :
                          order.priority === 'rush' ? 'bg-orange-500' : 'bg-blue-500'
                        }`} />
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">{order.customerName}</p>
                          <p className="text-neutral-500 text-xs truncate">{order.orderId} - {order.jobAddress}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-white font-bold text-sm">${(order.totalPrice || order.totalCost || 0).toLocaleString()}</p>
                          <p className="text-neutral-500 text-xs">
                            {order.priority !== 'normal' && (
                              <span className={`${order.priority === 'urgent' ? 'text-red-400' : 'text-orange-400'} font-medium`}>
                                {order.priority}
                              </span>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => handleCreateInvoiceFromOrder(order)}
                          className="px-3 py-1.5 bg-brand-green/20 text-brand-green text-xs rounded-lg hover:bg-brand-green/30 font-medium flex items-center gap-1"
                        >
                          <FileText size={12} />
                          Create Invoice
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status Filter Tabs + Search */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex gap-1 overflow-x-auto pb-1">
                {(['all', 'draft', 'sent', 'pending', 'paid', 'overdue'] as InvoiceStatusFilter[]).map(status => (
                  <button
                    key={status}
                    onClick={() => setInvoiceStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      invoiceStatusFilter === status
                        ? status === 'overdue' ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : status === 'paid' ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : 'bg-brand-green/20 text-brand-green border border-brand-green/30'
                        : 'bg-neutral-700 text-neutral-400 border border-neutral-600 hover:text-white'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                    {billingCounts[status] > 0 && (
                      <span className="ml-1 text-[10px] opacity-70">({billingCounts[status]})</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                <input
                  type="text"
                  placeholder="Search invoices by ID, customer, or job..."
                  value={billingSearchTerm}
                  onChange={(e) => setBillingSearchTerm(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-10 pr-4 py-2 text-white text-sm placeholder-neutral-500 focus:border-brand-green/50 focus:outline-none"
                />
              </div>
            </div>

            {/* Invoices Table */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden">
              {billingLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-brand-green" size={24} />
                  <span className="ml-2 text-neutral-400 text-sm">Loading billing data...</span>
                </div>
              )}
              {!billingLoading && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Invoice</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Created</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Due</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-700">
                      {filteredBillingInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                            {billingSearchTerm || invoiceStatusFilter !== 'all'
                              ? 'No invoices match your filters'
                              : 'No invoices found'}
                          </td>
                        </tr>
                      ) : (
                        filteredBillingInvoices.map(invoice => {
                          const today = new Date().toISOString().slice(0, 10);
                          const isOverdue = invoice.status !== 'paid' && invoice.status !== 'cancelled' && invoice.status !== 'draft'
                            && invoice.dueDate && invoice.dueDate < today && (invoice.balanceDue ?? invoice.total) > 0;
                          const displayStatus = isOverdue ? 'overdue' : invoice.status;
                          const daysOverdue = isOverdue
                            ? Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))
                            : 0;

                          return (
                            <tr key={invoice.invoiceId} className="hover:bg-neutral-700/50">
                              <td className="px-4 py-3">
                                <p className="text-white font-medium text-sm">{invoice.invoiceId}</p>
                                <p className="text-neutral-500 text-xs">{invoice.type || 'final'}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-white text-sm">{invoice.customerName || '-'}</p>
                                <p className="text-neutral-500 text-xs truncate max-w-[200px]">{invoice.jobName}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-white text-sm">
                                  {invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : '-'}
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <p className={`text-sm ${isOverdue ? 'text-red-400 font-medium' : 'text-white'}`}>
                                  {invoice.dueDate || '-'}
                                </p>
                                {isOverdue && (
                                  <p className="text-red-500 text-xs">{daysOverdue}d overdue</p>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-white font-bold text-sm">${(invoice.total || 0).toLocaleString()}</p>
                                {invoice.amountPaid > 0 && invoice.amountPaid < invoice.total && (
                                  <p className="text-neutral-500 text-xs">
                                    Paid: ${invoice.amountPaid.toLocaleString()} / Due: ${(invoice.balanceDue || 0).toLocaleString()}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${invoiceStatusStyles[displayStatus] || 'bg-neutral-500/20 text-neutral-400'}`}>
                                  {displayStatus}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  {/* Record Payment */}
                                  {displayStatus !== 'paid' && displayStatus !== 'cancelled' && displayStatus !== 'draft' && (
                                    <button
                                      onClick={() => {
                                        setPaymentModal({
                                          isOpen: true,
                                          invoiceId: invoice.invoiceId,
                                          invoiceTotal: invoice.total || 0,
                                          customerName: invoice.customerName,
                                          balanceDue: invoice.balanceDue ?? invoice.total ?? 0,
                                        });
                                        setPaymentForm({
                                          amount: String(invoice.balanceDue ?? invoice.total ?? 0),
                                          method: 'check',
                                          reference: '',
                                          notes: '',
                                        });
                                      }}
                                      className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded hover:bg-green-500/30 flex items-center gap-1"
                                      title="Record Payment"
                                    >
                                      <CreditCard size={12} />
                                      Pay
                                    </button>
                                  )}
                                  {/* Send */}
                                  {(invoice.status === 'draft' && invoice.source === 'invoice-service') && (
                                    <button
                                      onClick={() => handleSendInvoice(invoice.invoiceId)}
                                      className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded hover:bg-blue-500/30 flex items-center gap-1"
                                      title="Send Invoice"
                                    >
                                      <Send size={12} />
                                      Send
                                    </button>
                                  )}
                                  {/* Quick mark paid for simple invoices */}
                                  {(invoice.status === 'pending' || invoice.status === 'sent') && invoice.source === 'delivery-workflow' && (
                                    <button
                                      onClick={() => handleQuickMarkPaid(invoice.invoiceId)}
                                      className="px-2 py-1 bg-brand-green/20 text-brand-green text-xs rounded hover:bg-brand-green/30"
                                      title="Quick Mark Paid"
                                    >
                                      <CheckCircle2 size={12} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Table Footer */}
              <div className="flex items-center justify-between border-t border-neutral-700 px-4 py-3">
                <p className="text-sm text-neutral-500">
                  Showing {filteredBillingInvoices.length} of {allBillingInvoices.length} invoices
                </p>
                <div className="flex items-center gap-2">
                  <Link
                    href="/command-center/billing"
                    className="text-brand-green text-xs hover:underline flex items-center gap-1"
                  >
                    Full Billing Center <ChevronRight size={14} />
                  </Link>
                  <button
                    onClick={() => { loadAllData(); loadBillingData(); }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-neutral-700 rounded-lg text-xs text-neutral-400 hover:text-white transition-colors"
                  >
                    <RefreshCw size={12} />
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TICKETS TAB */}
        {/* ============================================================ */}
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
                    {filteredTickets.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                          No delivery tickets found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* CREATE NEW TICKET TAB */}
        {/* ============================================================ */}
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

      {/* ============================================================ */}
      {/* PAYMENT MODAL */}
      {/* ============================================================ */}
      {paymentModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-800 border border-neutral-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-neutral-700">
              <div>
                <h3 className="text-lg font-bold text-white">Record Payment</h3>
                <p className="text-sm text-neutral-400">{paymentModal.customerName} - {paymentModal.invoiceId}</p>
              </div>
              <button
                onClick={() => setPaymentModal({ isOpen: false, invoiceId: '', invoiceTotal: 0, customerName: '', balanceDue: 0 })}
                className="p-1 text-neutral-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-neutral-700/40 rounded-lg p-3 flex justify-between">
                <span className="text-neutral-400">Invoice Total</span>
                <span className="text-white font-bold">${paymentModal.invoiceTotal.toLocaleString()}</span>
              </div>
              <div className="bg-neutral-700/40 rounded-lg p-3 flex justify-between">
                <span className="text-neutral-400">Balance Due</span>
                <span className="text-brand-green font-bold">${paymentModal.balanceDue.toLocaleString()}</span>
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-1">Payment Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-1">Payment Method</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                  className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="check">Check</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="insurance">Insurance</option>
                  <option value="financing">Financing</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-1">Reference / Check #</label>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Check #1234"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-1">Notes</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white resize-none"
                  placeholder="Payment notes..."
                />
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t border-neutral-700">
              <button
                onClick={() => setPaymentModal({ isOpen: false, invoiceId: '', invoiceTotal: 0, customerName: '', balanceDue: 0 })}
                className="flex-1 px-4 py-2 bg-neutral-700 text-neutral-300 rounded-lg hover:bg-neutral-600"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={!paymentForm.amount || parseFloat(paymentForm.amount) <= 0 || paymentSubmitting}
                className="flex-1 px-4 py-2 bg-brand-green text-black font-bold rounded-lg hover:bg-lime-400 disabled:bg-neutral-700 disabled:text-neutral-500 flex items-center justify-center gap-2"
              >
                {paymentSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CreditCard size={16} />
                )}
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
