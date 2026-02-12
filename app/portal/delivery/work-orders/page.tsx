'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ClipboardList,
  Plus,
  Upload,
  Briefcase,
  History,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  X,
  Check,
  CheckCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Clock,
  Truck,
  Package,
  MapPin,
  Calendar,
  Phone,
  Mail,
  User,
  FileText,
  DollarSign,
  Weight,
  Trash2,
  Eye,
  Play,
  ArrowUpDown,
  Download,
  FileUp,
  RefreshCw,
  Hash,
  Zap,
  RotateCcw,
  Layers,
  ArrowRight,
  Settings,
  Loader2,
} from 'lucide-react';
import AddressAutocomplete, { AddressResult } from '@/components/AddressAutocomplete';

// ============================================
// TYPES
// ============================================

interface WorkOrderAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

interface WorkOrderMaterial {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  weight: number;
}

interface WorkOrderStatusChange {
  from: string;
  to: string;
  changedAt: string;
  changedBy: string;
  notes?: string;
}

interface WorkOrder {
  workOrderId: string;
  jobId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: WorkOrderAddress;
  type: 'delivery' | 'pickup' | 'return' | 'supplement';
  priority: 'low' | 'normal' | 'rush' | 'urgent';
  materials: WorkOrderMaterial[];
  scheduledDate: string;
  scheduledTime: string;
  notes: string;
  specialInstructions: string;
  assignedDriver: string;
  vehicleType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  estimatedCost: number;
  actualCost: number | null;
  photos: string[];
  documents: string[];
  statusHistory: WorkOrderStatusChange[];
}

interface JobData {
  jobId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: WorkOrderAddress;
  materials: WorkOrderMaterial[];
  jobType: string;
  notes: string;
  createdDate: string;
}

interface JNJobForConversion {
  jnid: string;
  jobNumber: string;
  jobName: string;
  customerName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  status: string;
  salesRep: string;
  createdAt: string;
  materialCount: number;
  estimateTotal: number;
}

interface CatalogItem {
  productName: string;
  weightPerUnit: number;
  defaultPrice: number;
  unit: string;
}

interface DriverInfo {
  id: string;
  name: string;
  vehicle: string;
}

interface ParsedRow {
  rowNumber: number;
  data: Partial<WorkOrder>;
  validation: { valid: boolean; errors: string[]; warnings: string[] };
}

// ============================================
// HELPERS
// ============================================

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'text-zinc-400', bg: 'bg-zinc-700' },
  submitted: { label: 'Submitted', color: 'text-blue-400', bg: 'bg-blue-900/40' },
  approved: { label: 'Approved', color: 'text-emerald-400', bg: 'bg-emerald-900/40' },
  scheduled: { label: 'Scheduled', color: 'text-purple-400', bg: 'bg-purple-900/40' },
  in_progress: { label: 'In Progress', color: 'text-yellow-400', bg: 'bg-yellow-900/40' },
  completed: { label: 'Completed', color: 'text-green-400', bg: 'bg-green-900/40' },
  cancelled: { label: 'Cancelled', color: 'text-red-400', bg: 'bg-red-900/40' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof AlertCircle }> = {
  low: { label: 'Low', color: 'text-zinc-400', bg: 'bg-zinc-700', icon: ChevronDown },
  normal: { label: 'Normal', color: 'text-blue-400', bg: 'bg-blue-900/40', icon: ArrowRight },
  rush: { label: 'Rush', color: 'text-orange-400', bg: 'bg-orange-900/40', icon: Zap },
  urgent: { label: 'Urgent', color: 'text-red-400', bg: 'bg-red-900/40', icon: AlertTriangle },
};

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof Truck }> = {
  delivery: { label: 'Delivery', color: 'text-blue-400', icon: Truck },
  pickup: { label: 'Pickup', color: 'text-purple-400', icon: Package },
  return: { label: 'Return', color: 'text-orange-400', icon: RotateCcw },
  supplement: { label: 'Supplement', color: 'text-emerald-400', icon: Layers },
};

function formatDate(dateStr: string): string {
  if (!dateStr) return 'Not set';
  try {
    const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function totalWeight(materials: WorkOrderMaterial[]): number {
  return materials.reduce((sum, m) => sum + m.quantity * m.weight, 0);
}

function totalMaterialCost(materials: WorkOrderMaterial[]): number {
  return materials.reduce((sum, m) => sum + m.quantity * m.unitPrice, 0);
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

type Tab = 'queue' | 'create' | 'upload' | 'jobs' | 'history';

export default function WorkOrdersPage() {
  const [activeTab, setActiveTab] = useState<Tab>('queue');
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [drivers, setDrivers] = useState<DriverInfo[]>([]);
  const [jobs, setJobs] = useState<JobData[]>([]);

  // Fetch data on mount
  const fetchWorkOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/portal/delivery/work-orders');
      if (res.ok) {
        const data = await res.json();
        setWorkOrders(data.workOrders || []);
        setStats(data.stats || {});
      }
    } catch (err) {
      console.error('Failed to fetch work orders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMetadata = useCallback(async () => {
    try {
      const [catalogRes, driversRes, jobsRes] = await Promise.all([
        fetch('/api/portal/delivery/work-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get-catalog' }),
        }),
        fetch('/api/portal/delivery/work-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get-drivers' }),
        }),
        fetch('/api/portal/delivery/work-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get-jobs' }),
        }),
      ]);

      if (catalogRes.ok) {
        const d = await catalogRes.json();
        setCatalog(d.catalog || []);
      }
      if (driversRes.ok) {
        const d = await driversRes.json();
        setDrivers(d.drivers || []);
      }
      if (jobsRes.ok) {
        const d = await jobsRes.json();
        setJobs(d.jobs || []);
      }
    } catch (err) {
      console.error('Failed to fetch metadata:', err);
    }
  }, []);

  useEffect(() => {
    fetchWorkOrders();
    fetchMetadata();
  }, [fetchWorkOrders, fetchMetadata]);

  const tabs: { id: Tab; label: string; icon: typeof ClipboardList }[] = [
    { id: 'queue', label: 'Work Order Queue', icon: ClipboardList },
    { id: 'create', label: 'Create Work Order', icon: Plus },
    { id: 'upload', label: 'Upload Work Orders', icon: Upload },
    { id: 'jobs', label: 'Create from Jobs', icon: Briefcase },
    { id: 'history', label: 'Work Order History', icon: History },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/portal/delivery" className="text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Work Orders & Ticket Creation</h1>
              <p className="text-sm text-zinc-400">Create, manage, and track delivery work orders</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'queue' && (
          <WorkOrderQueue
            workOrders={workOrders}
            stats={stats}
            loading={loading}
            drivers={drivers}
            onRefresh={fetchWorkOrders}
          />
        )}
        {activeTab === 'create' && (
          <CreateWorkOrder
            catalog={catalog}
            drivers={drivers}
            onCreated={() => { fetchWorkOrders(); setActiveTab('queue'); }}
          />
        )}
        {activeTab === 'upload' && (
          <UploadWorkOrders onImported={fetchWorkOrders} />
        )}
        {activeTab === 'jobs' && (
          <CreateFromJobs
            jobs={jobs}
            onCreated={() => { fetchWorkOrders(); setActiveTab('queue'); }}
          />
        )}
        {activeTab === 'history' && (
          <WorkOrderHistory workOrders={workOrders} loading={loading} />
        )}
      </div>
    </div>
  );
}

// ============================================
// TAB 1: WORK ORDER QUEUE
// ============================================

function WorkOrderQueue({
  workOrders,
  stats,
  loading,
  drivers,
  onRefresh,
}: {
  workOrders: WorkOrder[];
  stats: Record<string, number>;
  loading: boolean;
  drivers: DriverInfo[];
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [showQuickAction, setShowQuickAction] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const filtered = useMemo(() => {
    let result = [...workOrders];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(wo =>
        wo.customerName.toLowerCase().includes(q) ||
        wo.workOrderId.toLowerCase().includes(q) ||
        wo.jobId.toLowerCase().includes(q) ||
        wo.address.street.toLowerCase().includes(q)
      );
    }
    if (statusFilter) result = result.filter(wo => wo.status === statusFilter);
    if (typeFilter) result = result.filter(wo => wo.type === typeFilter);
    if (priorityFilter) result = result.filter(wo => wo.priority === priorityFilter);

    // Sort
    const pOrder: Record<string, number> = { urgent: 0, rush: 1, normal: 2, low: 3 };
    const sOrder: Record<string, number> = {
      in_progress: 0, scheduled: 1, approved: 2, submitted: 3, draft: 4, completed: 5, cancelled: 6,
    };

    result.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      if (sortBy === 'priority') {
        aVal = pOrder[a.priority] ?? 9;
        bVal = pOrder[b.priority] ?? 9;
      } else if (sortBy === 'status') {
        aVal = sOrder[a.status] ?? 9;
        bVal = sOrder[b.status] ?? 9;
      } else if (sortBy === 'scheduledDate') {
        aVal = a.scheduledDate || '9999';
        bVal = b.scheduledDate || '9999';
      } else if (sortBy === 'estimatedCost') {
        aVal = a.estimatedCost;
        bVal = b.estimatedCost;
      } else {
        aVal = a.createdAt;
        bVal = b.createdAt;
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [workOrders, search, statusFilter, typeFilter, priorityFilter, sortBy, sortDir]);

  const handleQuickAction = async (workOrderId: string, action: string, extra?: Record<string, string>) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/portal/delivery/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, workOrderId, ...extra }),
      });
      if (res.ok) {
        onRefresh();
        setShowQuickAction(null);
      }
    } catch (err) {
      console.error('Quick action failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const statCards = [
    { key: 'submitted', label: 'Pending', icon: Clock, color: 'text-blue-400' },
    { key: 'approved', label: 'Approved', icon: CheckCircle, color: 'text-emerald-400' },
    { key: 'scheduled', label: 'Scheduled', icon: Calendar, color: 'text-purple-400' },
    { key: 'in_progress', label: 'In Progress', icon: Truck, color: 'text-yellow-400' },
    { key: 'completed', label: 'Completed', icon: CheckCircle2, color: 'text-green-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map(sc => {
          const Icon = sc.icon;
          return (
            <button
              key={sc.key}
              onClick={() => setStatusFilter(statusFilter === sc.key ? '' : sc.key)}
              className={`p-4 rounded-xl border transition-colors ${
                statusFilter === sc.key
                  ? 'border-[#39FF14]/50 bg-[#39FF14]/5'
                  : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${sc.color}`} />
                <span className="text-xs text-zinc-400">{sc.label}</span>
              </div>
              <div className="text-2xl font-bold">{stats[sc.key] || 0}</div>
            </button>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by customer, WO#, job#, address..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
        >
          <option value="">All Types</option>
          <option value="delivery">Delivery</option>
          <option value="pickup">Pickup</option>
          <option value="return">Return</option>
          <option value="supplement">Supplement</option>
        </select>
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          className="px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
        >
          <option value="">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="rush">Rush</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm hover:bg-zinc-700 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Results count */}
      <div className="text-sm text-zinc-400">
        Showing {filtered.length} of {workOrders.length} work orders
        {(search || statusFilter || typeFilter || priorityFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter(''); setPriorityFilter(''); }}
            className="ml-2 text-[#39FF14] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#39FF14]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No work orders found</p>
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-900/80 border-b border-zinc-800">
                  {[
                    { key: 'workOrderId', label: 'WO#' },
                    { key: 'customerName', label: 'Customer' },
                    { key: 'type', label: 'Type' },
                    { key: 'priority', label: 'Priority', sortable: true },
                    { key: 'status', label: 'Status', sortable: true },
                    { key: 'scheduledDate', label: 'Scheduled', sortable: true },
                    { key: 'estimatedCost', label: 'Est. Cost', sortable: true },
                    { key: 'assignedDriver', label: 'Driver' },
                    { key: 'actions', label: 'Actions' },
                  ].map(col => (
                    <th
                      key={col.key}
                      className={`px-4 py-3 text-left font-medium text-zinc-400 ${
                        col.sortable ? 'cursor-pointer hover:text-white' : ''
                      }`}
                      onClick={() => col.sortable && toggleSort(col.key)}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {col.sortable && sortBy === col.key && (
                          sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(wo => {
                  const sc = STATUS_CONFIG[wo.status] || STATUS_CONFIG.draft;
                  const pc = PRIORITY_CONFIG[wo.priority] || PRIORITY_CONFIG.normal;
                  const tc = TYPE_CONFIG[wo.type] || TYPE_CONFIG.delivery;
                  const PriorityIcon = pc.icon;
                  const TypeIcon = tc.icon;

                  return (
                    <tr
                      key={wo.workOrderId}
                      className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedOrder(wo)}
                          className="font-mono text-[#39FF14] hover:underline"
                        >
                          {wo.workOrderId}
                        </button>
                        <div className="text-xs text-zinc-500">{wo.jobId}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{wo.customerName}</div>
                        <div className="text-xs text-zinc-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {wo.address.city}, {wo.address.state}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 ${tc.color}`}>
                          <TypeIcon className="w-3.5 h-3.5" />
                          {tc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${pc.color} ${pc.bg}`}>
                          <PriorityIcon className="w-3 h-3" />
                          {pc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color} ${sc.bg}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {wo.scheduledDate ? (
                          <div>
                            <div className="text-sm">{formatDate(wo.scheduledDate)}</div>
                            {wo.scheduledTime && <div className="text-xs text-zinc-500">{wo.scheduledTime}</div>}
                          </div>
                        ) : (
                          <span className="text-zinc-500 text-xs">Not scheduled</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">{formatCurrency(wo.estimatedCost)}</td>
                      <td className="px-4 py-3">
                        {wo.assignedDriver ? (
                          <div>
                            <div className="text-sm">{wo.assignedDriver}</div>
                            <div className="text-xs text-zinc-500">{wo.vehicleType}</div>
                          </div>
                        ) : (
                          <span className="text-zinc-500 text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSelectedOrder(wo)}
                            className="p-1.5 rounded hover:bg-zinc-700 transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4 text-zinc-400" />
                          </button>
                          {wo.status === 'submitted' && (
                            <button
                              onClick={() => handleQuickAction(wo.workOrderId, 'approve')}
                              className="p-1.5 rounded hover:bg-emerald-900/40 transition-colors"
                              title="Approve"
                              disabled={actionLoading}
                            >
                              <Check className="w-4 h-4 text-emerald-400" />
                            </button>
                          )}
                          {(wo.status === 'approved' || wo.status === 'submitted') && !wo.assignedDriver && (
                            <button
                              onClick={() => setShowQuickAction(wo.workOrderId)}
                              className="p-1.5 rounded hover:bg-purple-900/40 transition-colors"
                              title="Assign driver"
                            >
                              <User className="w-4 h-4 text-purple-400" />
                            </button>
                          )}
                        </div>

                        {/* Inline driver assign dropdown */}
                        {showQuickAction === wo.workOrderId && (
                          <div className="absolute z-10 mt-1 right-0 w-56 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-3">
                            <div className="text-xs text-zinc-400 mb-2">Assign Driver</div>
                            {drivers.map(d => (
                              <button
                                key={d.id}
                                onClick={() => {
                                  handleQuickAction(wo.workOrderId, 'assign-driver', {
                                    driverName: d.name,
                                    vehicleType: d.vehicle,
                                  });
                                }}
                                className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-zinc-700 transition-colors"
                              >
                                <div className="font-medium">{d.name}</div>
                                <div className="text-xs text-zinc-500">{d.vehicle}</div>
                              </button>
                            ))}
                            <button
                              onClick={() => setShowQuickAction(null)}
                              className="w-full mt-2 text-center text-xs text-zinc-500 hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedOrder && (
        <WorkOrderDetailModal
          workOrder={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}

// ============================================
// WORK ORDER DETAIL MODAL
// ============================================

function WorkOrderDetailModal({ workOrder: wo, onClose }: { workOrder: WorkOrder; onClose: () => void }) {
  const sc = STATUS_CONFIG[wo.status] || STATUS_CONFIG.draft;
  const pc = PRIORITY_CONFIG[wo.priority] || PRIORITY_CONFIG.normal;
  const tc = TYPE_CONFIG[wo.type] || TYPE_CONFIG.delivery;
  const TypeIcon = tc.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">{wo.workOrderId}</h2>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color} ${sc.bg}`}>
                {sc.label}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${pc.color} ${pc.bg}`}>
                {pc.label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-400 mt-1">
              <TypeIcon className={`w-4 h-4 ${tc.color}`} />
              {tc.label} | Job: {wo.jobId}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Customer & Address */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Customer</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-zinc-500" />
                  <span>{wo.customerName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-zinc-500" />
                  <span>{wo.customerPhone}</span>
                </div>
                {wo.customerEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-zinc-500" />
                    <span>{wo.customerEmail}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Delivery Details</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-zinc-500" />
                  <span>{wo.address.street}, {wo.address.city}, {wo.address.state} {wo.address.zip}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-zinc-500" />
                  <span>{wo.scheduledDate ? `${formatDate(wo.scheduledDate)} at ${wo.scheduledTime}` : 'Not scheduled'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-zinc-500" />
                  <span>{wo.assignedDriver || 'Unassigned'} {wo.vehicleType && `(${wo.vehicleType})`}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Materials */}
          <div>
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">Materials</h3>
            <div className="border border-zinc-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-800/50">
                    <th className="px-4 py-2 text-left text-zinc-400 font-medium">Product</th>
                    <th className="px-4 py-2 text-right text-zinc-400 font-medium">Qty</th>
                    <th className="px-4 py-2 text-left text-zinc-400 font-medium">Unit</th>
                    <th className="px-4 py-2 text-right text-zinc-400 font-medium">Price</th>
                    <th className="px-4 py-2 text-right text-zinc-400 font-medium">Weight</th>
                    <th className="px-4 py-2 text-right text-zinc-400 font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {wo.materials.map(m => (
                    <tr key={m.id} className="border-t border-zinc-800/50">
                      <td className="px-4 py-2">{m.productName}</td>
                      <td className="px-4 py-2 text-right">{m.quantity}</td>
                      <td className="px-4 py-2">{m.unit}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(m.unitPrice)}</td>
                      <td className="px-4 py-2 text-right">{(m.quantity * m.weight).toLocaleString()} lbs</td>
                      <td className="px-4 py-2 text-right font-medium">{formatCurrency(m.quantity * m.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-700 bg-zinc-800/30">
                    <td className="px-4 py-2 font-medium" colSpan={4}>Totals</td>
                    <td className="px-4 py-2 text-right font-medium">{totalWeight(wo.materials).toLocaleString()} lbs</td>
                    <td className="px-4 py-2 text-right font-medium text-[#39FF14]">{formatCurrency(totalMaterialCost(wo.materials))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="flex items-center justify-between mt-3 text-sm">
              <span className="text-zinc-400">Estimated Total (incl. delivery):</span>
              <span className="text-lg font-bold text-[#39FF14]">{formatCurrency(wo.estimatedCost)}</span>
            </div>
          </div>

          {/* Notes */}
          {(wo.notes || wo.specialInstructions) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {wo.notes && (
                <div className="p-3 bg-zinc-800/50 rounded-lg">
                  <div className="text-xs text-zinc-400 mb-1">Notes</div>
                  <p className="text-sm">{wo.notes}</p>
                </div>
              )}
              {wo.specialInstructions && (
                <div className="p-3 bg-yellow-900/20 border border-yellow-800/30 rounded-lg">
                  <div className="text-xs text-yellow-400 mb-1">Special Instructions</div>
                  <p className="text-sm">{wo.specialInstructions}</p>
                </div>
              )}
            </div>
          )}

          {/* Status Timeline */}
          {wo.statusHistory.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">Status History</h3>
              <div className="space-y-3">
                {wo.statusHistory.map((h, i) => {
                  const toConfig = STATUS_CONFIG[h.to] || STATUS_CONFIG.draft;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${toConfig.color.replace('text-', 'bg-')}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium text-sm ${toConfig.color}`}>{toConfig.label}</span>
                          <span className="text-xs text-zinc-500">{formatDateTime(h.changedAt)}</span>
                        </div>
                        <div className="text-xs text-zinc-500">by {h.changedBy}</div>
                        {h.notes && <div className="text-xs text-zinc-400 mt-1">{h.notes}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-zinc-500">
            <div>Created: {formatDateTime(wo.createdAt)}</div>
            <div>Updated: {formatDateTime(wo.updatedAt)}</div>
            <div>Created by: {wo.createdBy}</div>
            <div>Documents: {wo.documents.length} | Photos: {wo.photos.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// TAB 2: CREATE WORK ORDER
// ============================================

interface MaterialRow {
  key: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  weight: number;
}

function CreateWorkOrder({
  catalog,
  drivers,
  onCreated,
}: {
  catalog: CatalogItem[];
  drivers: DriverInfo[];
  onCreated: () => void;
}) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('Huntsville');
  const [state, setState] = useState('AL');
  const [zip, setZip] = useState('');
  const [type, setType] = useState<'delivery' | 'pickup' | 'return' | 'supplement'>('delivery');
  const [priority, setPriority] = useState<'low' | 'normal' | 'rush' | 'urgent'>('normal');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [assignedDriver, setAssignedDriver] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [notes, setNotes] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [materials, setMaterials] = useState<MaterialRow[]>([
    { key: crypto.randomUUID(), productName: '', quantity: 1, unit: 'bundle', unitPrice: 0, weight: 0 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState('');

  const addMaterialRow = () => {
    setMaterials(prev => [
      ...prev,
      { key: crypto.randomUUID(), productName: '', quantity: 1, unit: 'bundle', unitPrice: 0, weight: 0 },
    ]);
  };

  const removeMaterialRow = (key: string) => {
    if (materials.length <= 1) return;
    setMaterials(prev => prev.filter(m => m.key !== key));
  };

  const updateMaterial = (key: string, field: keyof MaterialRow, value: string | number) => {
    setMaterials(prev =>
      prev.map(m => {
        if (m.key !== key) return m;
        const updated = { ...m, [field]: value };

        // Auto-fill from catalog if product changed
        if (field === 'productName') {
          const cat = catalog.find(c => c.productName === value);
          if (cat) {
            updated.unit = cat.unit;
            updated.unitPrice = cat.defaultPrice;
            updated.weight = cat.weightPerUnit;
          }
        }
        return updated;
      })
    );
  };

  const handleDriverChange = (driverName: string) => {
    setAssignedDriver(driverName);
    const d = drivers.find(dr => dr.name === driverName);
    if (d) setVehicleType(d.vehicle);
  };

  const estCost = useMemo(() => {
    const matCost = materials.reduce((s, m) => s + m.quantity * m.unitPrice, 0);
    const wt = materials.reduce((s, m) => s + m.quantity * m.weight, 0);
    let deliveryFee = 75;
    if (wt > 2000) deliveryFee += (wt - 2000) * 0.05;
    if (priority === 'rush') deliveryFee *= 1.5;
    if (priority === 'urgent') deliveryFee *= 2.0;
    if (type === 'return' || type === 'pickup') return Math.round(deliveryFee);
    return Math.round(matCost + deliveryFee);
  }, [materials, priority, type]);

  const estWeight = useMemo(() => {
    return materials.reduce((s, m) => s + m.quantity * m.weight, 0);
  }, [materials]);

  const handleSubmit = async () => {
    setErrors([]);
    setSuccess('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/portal/delivery/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          customerName,
          customerPhone,
          customerEmail,
          address: { street, city, state, zip },
          type,
          priority,
          materials: materials.map(m => ({
            productName: m.productName,
            quantity: m.quantity,
            unit: m.unit,
            unitPrice: m.unitPrice,
            weight: m.weight,
          })),
          scheduledDate: scheduledDate || undefined,
          scheduledTime: scheduledTime || undefined,
          assignedDriver: assignedDriver || undefined,
          vehicleType: vehicleType || undefined,
          notes,
          specialInstructions,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrors(data.errors || [data.error || 'Failed to create work order']);
      } else {
        setSuccess(`Work order ${data.workOrder.workOrderId} created successfully!`);
        setTimeout(() => onCreated(), 1500);
      }
    } catch (err) {
      setErrors(['Network error. Please try again.']);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Errors */}
      {errors.length > 0 && (
        <div className="p-4 bg-red-900/20 border border-red-800/40 rounded-xl">
          <div className="flex items-center gap-2 text-red-400 font-medium mb-2">
            <AlertCircle className="w-4 h-4" />
            Please fix the following errors:
          </div>
          <ul className="list-disc list-inside text-sm text-red-300 space-y-1">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="p-4 bg-green-900/20 border border-green-800/40 rounded-xl flex items-center gap-2 text-green-400">
          <CheckCircle2 className="w-5 h-5" />
          {success}
        </div>
      )}

      {/* Customer Information */}
      <div className="border border-zinc-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-[#39FF14]" />
          Customer Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Customer Name *</label>
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="John Smith"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Phone *</label>
            <input
              type="tel"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              placeholder="(256) 555-0100"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Email</label>
            <input
              type="email"
              value={customerEmail}
              onChange={e => setCustomerEmail(e.target.value)}
              placeholder="customer@email.com"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
            />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="border border-zinc-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-[#39FF14]" />
          Delivery Address
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm text-zinc-400 mb-1">Street Address *</label>
            <AddressAutocomplete
              onAddressSelect={(result: AddressResult) => {
                const streetParts: string[] = [];
                if (result.streetNumber) streetParts.push(result.streetNumber);
                if (result.street) streetParts.push(result.street);
                setStreet(streetParts.length > 0 ? streetParts.join(' ') : result.formattedAddress.split(',')[0]);
                if (result.city) setCity(result.city);
                if (result.state) setState(result.state);
                if (result.zip) setZip(result.zip);
              }}
              defaultValue={street}
              placeholder="Start typing address..."
              className="!bg-zinc-900 !border-zinc-700 !text-sm !py-2 focus:!border-[#39FF14]/50"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">City *</label>
            <input
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">State *</label>
              <input
                type="text"
                value={state}
                onChange={e => setState(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">ZIP *</label>
              <input
                type="text"
                value={zip}
                onChange={e => setZip(e.target.value)}
                placeholder="35801"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Type & Priority */}
      <div className="border border-zinc-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#39FF14]" />
          Order Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Type */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Work Order Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {(['delivery', 'pickup', 'return', 'supplement'] as const).map(t => {
                const tc = TYPE_CONFIG[t];
                const Icon = tc.icon;
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                      type === t
                        ? 'border-[#39FF14]/50 bg-[#39FF14]/5 text-white'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${type === t ? tc.color : ''}`} />
                    {tc.label}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Priority */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Priority *</label>
            <div className="grid grid-cols-2 gap-2">
              {(['low', 'normal', 'rush', 'urgent'] as const).map(p => {
                const pc = PRIORITY_CONFIG[p];
                const Icon = pc.icon;
                return (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                      priority === p
                        ? `border-[#39FF14]/50 bg-[#39FF14]/5 text-white`
                        : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${priority === p ? pc.color : ''}`} />
                    {pc.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Materials */}
      <div className="border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-[#39FF14]" />
            Materials
          </h3>
          <button
            onClick={addMaterialRow}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[#39FF14]/10 text-[#39FF14] rounded-lg hover:bg-[#39FF14]/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Row
          </button>
        </div>

        <div className="space-y-3">
          {materials.map((mat, idx) => (
            <div key={mat.key} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-12 md:col-span-4">
                {idx === 0 && <label className="block text-xs text-zinc-500 mb-1">Product *</label>}
                <select
                  value={mat.productName}
                  onChange={e => updateMaterial(mat.key, 'productName', e.target.value)}
                  className="w-full px-2 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
                >
                  <option value="">Select product...</option>
                  {catalog.map(c => (
                    <option key={c.productName} value={c.productName}>{c.productName}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-3 md:col-span-2">
                {idx === 0 && <label className="block text-xs text-zinc-500 mb-1">Qty *</label>}
                <input
                  type="number"
                  min="1"
                  value={mat.quantity}
                  onChange={e => updateMaterial(mat.key, 'quantity', parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
                />
              </div>
              <div className="col-span-3 md:col-span-1">
                {idx === 0 && <label className="block text-xs text-zinc-500 mb-1">Unit</label>}
                <input
                  type="text"
                  value={mat.unit}
                  onChange={e => updateMaterial(mat.key, 'unit', e.target.value)}
                  className="w-full px-2 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
                />
              </div>
              <div className="col-span-3 md:col-span-2">
                {idx === 0 && <label className="block text-xs text-zinc-500 mb-1">Unit Price</label>}
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={mat.unitPrice}
                    onChange={e => updateMaterial(mat.key, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className="w-full pl-6 pr-2 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
                  />
                </div>
              </div>
              <div className="col-span-2 md:col-span-2">
                {idx === 0 && <label className="block text-xs text-zinc-500 mb-1">Wt/unit (lb)</label>}
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={mat.weight}
                  onChange={e => updateMaterial(mat.key, 'weight', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
                />
              </div>
              <div className="col-span-1">
                {idx === 0 && <label className="block text-xs text-zinc-500 mb-1">&nbsp;</label>}
                <button
                  onClick={() => removeMaterialRow(mat.key)}
                  disabled={materials.length <= 1}
                  className="p-2 rounded-lg hover:bg-red-900/30 transition-colors disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-zinc-500" />
            <span className="text-sm text-zinc-400">Est. Total:</span>
            <span className="text-lg font-bold text-[#39FF14]">{formatCurrency(estCost)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Weight className="w-4 h-4 text-zinc-500" />
            <span className="text-sm text-zinc-400">Est. Weight:</span>
            <span className="text-lg font-bold">{estWeight.toLocaleString()} lbs</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            {materials.filter(m => m.productName).length} item(s)
          </div>
        </div>
      </div>

      {/* Scheduling */}
      <div className="border border-zinc-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#39FF14]" />
          Scheduling & Assignment
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Scheduled Date</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={e => setScheduledDate(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Scheduled Time</label>
            <input
              type="time"
              value={scheduledTime}
              onChange={e => setScheduledTime(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Assigned Driver</label>
            <select
              value={assignedDriver}
              onChange={e => handleDriverChange(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
            >
              <option value="">Select driver...</option>
              {drivers.map(d => (
                <option key={d.id} value={d.name}>{d.name} ({d.vehicle})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Vehicle</label>
            <input
              type="text"
              value={vehicleType}
              onChange={e => setVehicleType(e.target.value)}
              placeholder="Auto-filled from driver"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="border border-zinc-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#39FF14]" />
          Notes & Instructions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="General notes about this work order..."
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Special Instructions</label>
            <textarea
              value={specialInstructions}
              onChange={e => setSpecialInstructions(e.target.value)}
              rows={4}
              placeholder="Gate codes, delivery location, contact info..."
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => {
            setCustomerName(''); setCustomerPhone(''); setCustomerEmail('');
            setStreet(''); setCity('Huntsville'); setState('AL'); setZip('');
            setType('delivery'); setPriority('normal');
            setScheduledDate(''); setScheduledTime('');
            setAssignedDriver(''); setVehicleType('');
            setNotes(''); setSpecialInstructions('');
            setMaterials([{ key: crypto.randomUUID(), productName: '', quantity: 1, unit: 'bundle', unitPrice: 0, weight: 0 }]);
            setErrors([]); setSuccess('');
          }}
          className="px-6 py-2.5 text-sm text-zinc-400 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          Clear Form
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex items-center gap-2 px-8 py-2.5 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 transition-colors disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Create Work Order
        </button>
      </div>
    </div>
  );
}

// ============================================
// TAB 3: UPLOAD WORK ORDERS
// ============================================

function UploadWorkOrders({ onImported }: { onImported: () => void }) {
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (file.name.endsWith('.json')) setFormat('json');
    else setFormat('csv');

    const reader = new FileReader();
    reader.onload = (ev) => {
      setFileContent(ev.target?.result as string || '');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setFileName(file.name);
    if (file.name.endsWith('.json')) setFormat('json');
    else setFormat('csv');

    const reader = new FileReader();
    reader.onload = (ev) => {
      setFileContent(ev.target?.result as string || '');
    };
    reader.readAsText(file);
  };

  const parseFile = async () => {
    if (!fileContent) return;
    setParsing(true);
    setParsedRows([]);
    setSelectedRows(new Set());
    setImportResult('');

    try {
      const res = await fetch('/api/portal/delivery/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'parse-upload', fileData: fileContent, format }),
      });
      const data = await res.json();
      if (data.rows) {
        setParsedRows(data.rows);
        // Auto-select valid rows
        const valid = new Set<number>();
        data.rows.forEach((r: ParsedRow) => {
          if (r.validation.valid) valid.add(r.rowNumber);
        });
        setSelectedRows(valid);
      }
    } catch (err) {
      console.error('Parse failed:', err);
    } finally {
      setParsing(false);
    }
  };

  const importSelected = async () => {
    const validSelected = parsedRows.filter(
      r => selectedRows.has(r.rowNumber) && r.validation.valid
    );
    if (validSelected.length === 0) return;

    setImporting(true);
    setImportResult('');
    let successCount = 0;

    for (const row of validSelected) {
      try {
        const res = await fetch('/api/portal/delivery/work-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            ...row.data,
          }),
        });
        if (res.ok) successCount++;
      } catch {
        // continue
      }
    }

    setImportResult(`Imported ${successCount} of ${validSelected.length} work orders.`);
    if (successCount > 0) onImported();
    setImporting(false);
  };

  const downloadSample = async () => {
    try {
      const res = await fetch('/api/portal/delivery/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-sample-csv' }),
      });
      const data = await res.json();
      if (data.csv) {
        const blob = new Blob([data.csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'work-order-template.csv';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const toggleRow = (rowNum: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowNum)) next.delete(rowNum);
      else next.add(rowNum);
      return next;
    });
  };

  const validCount = parsedRows.filter(r => r.validation.valid).length;
  const invalidCount = parsedRows.filter(r => !r.validation.valid).length;
  const selectedValidCount = parsedRows.filter(r => selectedRows.has(r.rowNumber) && r.validation.valid).length;

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          dragOver
            ? 'border-[#39FF14] bg-[#39FF14]/5'
            : 'border-zinc-700 hover:border-zinc-600'
        }`}
      >
        <FileUp className="w-12 h-12 mx-auto mb-4 text-zinc-500" />
        <p className="text-lg font-medium mb-2">Drop CSV or JSON file here</p>
        <p className="text-sm text-zinc-400 mb-4">or click to browse</p>
        <input
          type="file"
          accept=".csv,.json"
          onChange={handleFileChange}
          className="hidden"
          id="upload-input"
        />
        <label
          htmlFor="upload-input"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-zinc-800 border border-zinc-600 rounded-lg text-sm cursor-pointer hover:bg-zinc-700 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Choose File
        </label>
        {fileName && (
          <p className="mt-3 text-sm text-[#39FF14]">Selected: {fileName}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={parseFile}
          disabled={!fileContent || parsing}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 transition-colors disabled:opacity-50"
        >
          {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          Preview & Validate
        </button>
        <button
          onClick={downloadSample}
          className="flex items-center gap-2 px-4 py-2.5 text-sm border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download CSV Template
        </button>
      </div>

      {/* Parse Results */}
      {parsedRows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-zinc-400">{parsedRows.length} rows parsed</span>
              <span className="text-green-400">{validCount} valid</span>
              {invalidCount > 0 && <span className="text-red-400">{invalidCount} invalid</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={importSelected}
                disabled={selectedValidCount === 0 || importing}
                className="flex items-center gap-2 px-4 py-2 bg-[#39FF14] text-black font-semibold rounded-lg text-sm hover:bg-[#39FF14]/90 transition-colors disabled:opacity-50"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Import Selected ({selectedValidCount})
              </button>
            </div>
          </div>

          {importResult && (
            <div className="p-3 bg-green-900/20 border border-green-800/40 rounded-lg text-sm text-green-400">
              {importResult}
            </div>
          )}

          <div className="border border-zinc-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-900/80 border-b border-zinc-800">
                    <th className="px-3 py-2 w-10">
                      <input
                        type="checkbox"
                        checked={selectedRows.size === parsedRows.filter(r => r.validation.valid).length}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedRows(new Set(parsedRows.filter(r => r.validation.valid).map(r => r.rowNumber)));
                          } else {
                            setSelectedRows(new Set());
                          }
                        }}
                        className="rounded"
                      />
                    </th>
                    <th className="px-3 py-2 text-left text-zinc-400 font-medium">Row</th>
                    <th className="px-3 py-2 text-left text-zinc-400 font-medium">Status</th>
                    <th className="px-3 py-2 text-left text-zinc-400 font-medium">Customer</th>
                    <th className="px-3 py-2 text-left text-zinc-400 font-medium">Address</th>
                    <th className="px-3 py-2 text-left text-zinc-400 font-medium">Type</th>
                    <th className="px-3 py-2 text-left text-zinc-400 font-medium">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map(row => (
                    <tr key={row.rowNumber} className="border-b border-zinc-800/50">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(row.rowNumber)}
                          onChange={() => toggleRow(row.rowNumber)}
                          disabled={!row.validation.valid}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-2 text-zinc-400">#{row.rowNumber}</td>
                      <td className="px-3 py-2">
                        {row.validation.valid ? (
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400" />
                        )}
                      </td>
                      <td className="px-3 py-2">{row.data.customerName || '-'}</td>
                      <td className="px-3 py-2 text-xs">
                        {row.data.address ? `${(row.data.address as WorkOrderAddress).street}, ${(row.data.address as WorkOrderAddress).city}` : '-'}
                      </td>
                      <td className="px-3 py-2">{row.data.type || '-'}</td>
                      <td className="px-3 py-2 text-xs">
                        {row.validation.errors.length > 0 && (
                          <div className="text-red-400">{row.validation.errors.join('; ')}</div>
                        )}
                        {row.validation.warnings.length > 0 && (
                          <div className="text-yellow-400">{row.validation.warnings.join('; ')}</div>
                        )}
                        {row.validation.valid && row.validation.warnings.length === 0 && (
                          <span className="text-green-400">Ready to import</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// TAB 4: CREATE FROM JOBS
// ============================================

function CreateFromJobs({
  jobs,
  onCreated,
}: {
  jobs: JobData[];
  onCreated: () => void;
}) {
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [previewJob, setPreviewJob] = useState<JobData | null>(null);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{
    total: number; successful: number; failed: number;
    results: Array<{ jobId: string; success: boolean; workOrderId?: string; error?: string }>;
  } | null>(null);

  // JobNimbus integration state
  const [useJN, setUseJN] = useState(false);
  const [jnJobs, setJnJobs] = useState<JNJobForConversion[]>([]);
  const [jnLoading, setJnLoading] = useState(false);
  const [jnError, setJnError] = useState('');
  const [selectedJnIds, setSelectedJnIds] = useState<Set<string>>(new Set());
  const [previewJnJob, setPreviewJnJob] = useState<JNJobForConversion | null>(null);
  const [jnDetailLoading, setJnDetailLoading] = useState(false);
  const [jnConvertResult, setJnConvertResult] = useState<{
    total: number; successful: number; failed: number;
    results: Array<{ jnid: string; success: boolean; workOrderId?: string; error?: string }>;
  } | null>(null);

  // Fetch JN jobs
  const fetchJNJobs = useCallback(async () => {
    setJnLoading(true);
    setJnError('');
    try {
      const res = await fetch('/api/portal/delivery/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch-jn-jobs', limit: 50 }),
      });
      const data = await res.json();
      if (data.jobs && data.jobs.length > 0) {
        setJnJobs(data.jobs);
      } else if (data.jobs && data.jobs.length === 0) {
        setJnError('No jobs found in JobNimbus. The API key may not be configured or there are no jobs.');
      } else if (data.error) {
        setJnError(data.error);
      }
    } catch (err) {
      console.error('Failed to fetch JN jobs:', err);
      setJnError('Failed to connect to JobNimbus. Check API configuration.');
    } finally {
      setJnLoading(false);
    }
  }, []);

  // Load JN jobs when toggled on
  useEffect(() => {
    if (useJN && jnJobs.length === 0 && !jnLoading) {
      fetchJNJobs();
    }
  }, [useJN, jnJobs.length, jnLoading, fetchJNJobs]);

  const toggleJob = (jobId: string) => {
    setSelectedJobIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedJobIds.size === jobs.length) {
      setSelectedJobIds(new Set());
    } else {
      setSelectedJobIds(new Set(jobs.map(j => j.jobId)));
    }
  };

  const toggleJnJob = (jnid: string) => {
    setSelectedJnIds(prev => {
      const next = new Set(prev);
      if (next.has(jnid)) next.delete(jnid);
      else next.add(jnid);
      return next;
    });
  };

  const toggleAllJn = () => {
    if (selectedJnIds.size === jnJobs.length) {
      setSelectedJnIds(new Set());
    } else {
      setSelectedJnIds(new Set(jnJobs.map(j => j.jnid)));
    }
  };

  const handleCreateTickets = async () => {
    if (selectedJobIds.size === 0) return;
    setCreating(true);
    setResult(null);

    try {
      const res = await fetch('/api/portal/delivery/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk-create-from-jobs',
          jobIds: Array.from(selectedJobIds),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        setTimeout(() => {
          onCreated();
        }, 2000);
      }
    } catch (err) {
      console.error('Bulk create failed:', err);
    } finally {
      setCreating(false);
    }
  };

  // Convert selected JN jobs to work orders
  const handleConvertJNJobs = async () => {
    if (selectedJnIds.size === 0) return;
    setCreating(true);
    setJnConvertResult(null);

    const results: Array<{ jnid: string; success: boolean; workOrderId?: string; error?: string }> = [];

    for (const jnid of Array.from(selectedJnIds)) {
      try {
        // Fetch full detail for each selected job
        const detailRes = await fetch('/api/portal/delivery/work-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'fetch-jn-job-detail', jnid }),
        });
        const detail = await detailRes.json();

        if (detail.error) {
          results.push({ jnid, success: false, error: detail.error });
          continue;
        }

        // Convert to work order
        const convertRes = await fetch('/api/portal/delivery/work-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'convert-jn-job', jnJob: detail }),
        });
        const converted = await convertRes.json();

        if (converted.workOrder) {
          // Create the actual work order from the converted data
          const createRes = await fetch('/api/portal/delivery/work-orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create',
              ...converted.workOrder,
              materials: converted.workOrder.materials?.length > 0
                ? converted.workOrder.materials
                : [{ productName: 'TBD - Add materials', quantity: 1, unit: 'lot', unitPrice: 0, weight: 0 }],
            }),
          });
          const created = await createRes.json();
          if (created.success) {
            results.push({ jnid, success: true, workOrderId: created.workOrder?.workOrderId });
          } else {
            results.push({ jnid, success: false, error: created.errors?.join(', ') || created.error });
          }
        } else {
          results.push({ jnid, success: false, error: 'Conversion failed' });
        }
      } catch (err) {
        results.push({ jnid, success: false, error: 'Network error' });
      }
    }

    setJnConvertResult({
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });

    if (results.some(r => r.success)) {
      setTimeout(() => {
        onCreated();
      }, 2000);
    }

    setCreating(false);
  };

  const getJobAge = (dateStr: string) => {
    if (!dateStr) return 0;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  };

  const getAutoPriority = (dateStr: string): string => {
    const age = getJobAge(dateStr);
    if (age > 30) return 'urgent';
    if (age > 21) return 'rush';
    return 'normal';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold">Convert Jobs to Delivery Tickets</h3>
          <p className="text-sm text-zinc-400">Select jobs to create work orders automatically. Priority is set based on job age.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Data Source Toggle */}
          <div className="flex items-center gap-2 bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setUseJN(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                !useJN ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Sample Data
            </button>
            <button
              onClick={() => setUseJN(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                useJN ? 'bg-[#39FF14]/20 text-[#39FF14]' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              Load from JobNimbus
            </button>
          </div>

          {/* Refresh button (JN mode) */}
          {useJN && (
            <button
              onClick={fetchJNJobs}
              disabled={jnLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-400 hover:text-white border border-zinc-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${jnLoading ? 'animate-spin' : ''}`} />
              Refresh from JN
            </button>
          )}

          {/* Create button */}
          {!useJN ? (
            <button
              onClick={handleCreateTickets}
              disabled={selectedJobIds.size === 0 || creating}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 transition-colors disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
              Create Tickets ({selectedJobIds.size})
            </button>
          ) : (
            <button
              onClick={handleConvertJNJobs}
              disabled={selectedJnIds.size === 0 || creating}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 transition-colors disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
              Create from JN ({selectedJnIds.size})
            </button>
          )}
        </div>
      </div>

      {/* Result banner (sample data) */}
      {!useJN && result && (
        <div className={`p-4 rounded-xl border ${
          result.failed === 0
            ? 'bg-green-900/20 border-green-800/40'
            : 'bg-yellow-900/20 border-yellow-800/40'
        }`}>
          <div className="flex items-center gap-2 font-medium mb-2">
            {result.failed === 0 ? (
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
            )}
            <span>Created {result.successful} of {result.total} tickets</span>
          </div>
          <div className="space-y-1 text-sm">
            {result.results.map(r => (
              <div key={r.jobId} className="flex items-center gap-2">
                {r.success ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <X className="w-4 h-4 text-red-400" />
                )}
                <span>{r.jobId}</span>
                {r.workOrderId && <span className="text-[#39FF14] font-mono text-xs">{r.workOrderId}</span>}
                {r.error && <span className="text-red-400 text-xs">{r.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result banner (JN data) */}
      {useJN && jnConvertResult && (
        <div className={`p-4 rounded-xl border ${
          jnConvertResult.failed === 0
            ? 'bg-green-900/20 border-green-800/40'
            : 'bg-yellow-900/20 border-yellow-800/40'
        }`}>
          <div className="flex items-center gap-2 font-medium mb-2">
            {jnConvertResult.failed === 0 ? (
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
            )}
            <span>Created {jnConvertResult.successful} of {jnConvertResult.total} tickets from JobNimbus</span>
          </div>
          <div className="space-y-1 text-sm">
            {jnConvertResult.results.map(r => (
              <div key={r.jnid} className="flex items-center gap-2">
                {r.success ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <X className="w-4 h-4 text-red-400" />
                )}
                <span className="font-mono text-xs">{r.jnid.slice(0, 12)}...</span>
                {r.workOrderId && <span className="text-[#39FF14] font-mono text-xs">{r.workOrderId}</span>}
                {r.error && <span className="text-red-400 text-xs">{r.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* JN Error message */}
      {useJN && jnError && (
        <div className="p-4 rounded-xl border bg-red-900/20 border-red-800/40">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">{jnError}</span>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Falling back to sample data is available. Toggle &quot;Sample Data&quot; to use mock jobs instead.
          </p>
        </div>
      )}

      {/* ==================== SAMPLE DATA TABLE ==================== */}
      {!useJN && (
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-900/80 border-b border-zinc-800">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedJobIds.size === jobs.length && jobs.length > 0}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-zinc-400 font-medium">Job ID</th>
                  <th className="px-4 py-3 text-left text-zinc-400 font-medium">Customer</th>
                  <th className="px-4 py-3 text-left text-zinc-400 font-medium">Address</th>
                  <th className="px-4 py-3 text-left text-zinc-400 font-medium">Type</th>
                  <th className="px-4 py-3 text-left text-zinc-400 font-medium">Materials</th>
                  <th className="px-4 py-3 text-left text-zinc-400 font-medium">Age</th>
                  <th className="px-4 py-3 text-left text-zinc-400 font-medium">Auto Priority</th>
                  <th className="px-4 py-3 text-left text-zinc-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => {
                  const age = getJobAge(job.createdDate);
                  const autoPriority = getAutoPriority(job.createdDate);
                  const pc = PRIORITY_CONFIG[autoPriority] || PRIORITY_CONFIG.normal;
                  const PriorityIcon = pc.icon;

                  return (
                    <tr
                      key={job.jobId}
                      className={`border-b border-zinc-800/50 transition-colors ${
                        selectedJobIds.has(job.jobId) ? 'bg-[#39FF14]/5' : 'hover:bg-zinc-900/50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedJobIds.has(job.jobId)}
                          onChange={() => toggleJob(job.jobId)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-[#39FF14]">{job.jobId}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{job.customerName}</div>
                        <div className="text-xs text-zinc-500">{job.customerPhone}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div>{job.address.street}</div>
                        <div className="text-zinc-500">{job.address.city}, {job.address.state} {job.address.zip}</div>
                      </td>
                      <td className="px-4 py-3">{job.jobType}</td>
                      <td className="px-4 py-3">
                        <span className="text-zinc-400">{job.materials.length} items</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={age > 21 ? 'text-orange-400' : age > 30 ? 'text-red-400' : 'text-zinc-400'}>
                          {age} days
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${pc.color} ${pc.bg}`}>
                          <PriorityIcon className="w-3 h-3" />
                          {pc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setPreviewJob(previewJob?.jobId === job.jobId ? null : job)}
                          className="p-1.5 rounded hover:bg-zinc-700 transition-colors"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4 text-zinc-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== JOBNIMBUS TABLE ==================== */}
      {useJN && (
        <>
          {jnLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#39FF14] mx-auto mb-3" />
                <p className="text-sm text-zinc-400">Loading jobs from JobNimbus...</p>
              </div>
            </div>
          ) : jnJobs.length > 0 ? (
            <div className="border border-zinc-800 rounded-xl overflow-hidden">
              <div className="bg-zinc-900/60 border-b border-zinc-800 px-4 py-2 flex items-center gap-2">
                <Download className="w-4 h-4 text-[#39FF14]" />
                <span className="text-sm text-zinc-400">
                  {jnJobs.length} jobs loaded from JobNimbus
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-900/80 border-b border-zinc-800">
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedJnIds.size === jnJobs.length && jnJobs.length > 0}
                          onChange={toggleAllJn}
                          className="rounded"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-zinc-400 font-medium">Job #</th>
                      <th className="px-4 py-3 text-left text-zinc-400 font-medium">Customer / Job</th>
                      <th className="px-4 py-3 text-left text-zinc-400 font-medium">Address</th>
                      <th className="px-4 py-3 text-left text-zinc-400 font-medium">Status</th>
                      <th className="px-4 py-3 text-left text-zinc-400 font-medium">Sales Rep</th>
                      <th className="px-4 py-3 text-left text-zinc-400 font-medium">Age</th>
                      <th className="px-4 py-3 text-left text-zinc-400 font-medium">Auto Priority</th>
                      <th className="px-4 py-3 text-left text-zinc-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jnJobs.map(jnJob => {
                      const age = getJobAge(jnJob.createdAt);
                      const autoPriority = getAutoPriority(jnJob.createdAt);
                      const pc = PRIORITY_CONFIG[autoPriority] || PRIORITY_CONFIG.normal;
                      const PriorityIcon = pc.icon;

                      return (
                        <tr
                          key={jnJob.jnid}
                          className={`border-b border-zinc-800/50 transition-colors ${
                            selectedJnIds.has(jnJob.jnid) ? 'bg-[#39FF14]/5' : 'hover:bg-zinc-900/50'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedJnIds.has(jnJob.jnid)}
                              onChange={() => toggleJnJob(jnJob.jnid)}
                              className="rounded"
                            />
                          </td>
                          <td className="px-4 py-3 font-mono text-[#39FF14] text-xs">
                            {jnJob.jobNumber || jnJob.jnid.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{jnJob.customerName}</div>
                            {jnJob.jobName && jnJob.jobName !== jnJob.customerName && (
                              <div className="text-xs text-zinc-500">{jnJob.jobName}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <div>{jnJob.address || 'No address'}</div>
                            <div className="text-zinc-500">
                              {[jnJob.city, jnJob.state, jnJob.zip].filter(Boolean).join(', ') || ''}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300">
                              {jnJob.status || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-400">
                            {jnJob.salesRep || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={age > 21 ? 'text-orange-400' : age > 30 ? 'text-red-400' : 'text-zinc-400'}>
                              {age > 0 ? `${age} days` : '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${pc.color} ${pc.bg}`}>
                              <PriorityIcon className="w-3 h-3" />
                              {pc.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setPreviewJnJob(previewJnJob?.jnid === jnJob.jnid ? null : jnJob)}
                              className="p-1.5 rounded hover:bg-zinc-700 transition-colors"
                              title="Preview"
                            >
                              <Eye className="w-4 h-4 text-zinc-400" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : !jnError ? (
            <div className="text-center py-16 text-zinc-500">
              <Download className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No JobNimbus jobs loaded.</p>
              <button
                onClick={fetchJNJobs}
                className="mt-3 text-sm text-[#39FF14] hover:underline"
              >
                Click to load from JobNimbus
              </button>
            </div>
          ) : null}

          {/* JN Preview Panel */}
          {previewJnJob && (
            <div className="border border-zinc-700 rounded-xl p-6 bg-zinc-900">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  JN Job Preview: {previewJnJob.jobNumber || previewJnJob.jnid.slice(0, 12)}
                </h3>
                <button onClick={() => setPreviewJnJob(null)} className="p-1 hover:bg-zinc-800 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-zinc-500">Customer / Job Name</span>
                    <p className="font-medium">{previewJnJob.customerName}</p>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500">Address</span>
                    <p>{previewJnJob.address || 'Not set'}</p>
                    <p className="text-sm text-zinc-400">
                      {[previewJnJob.city, previewJnJob.state, previewJnJob.zip].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500">JN Status</span>
                    <p>{previewJnJob.status || 'Unknown'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500">Sales Rep</span>
                    <p>{previewJnJob.salesRep || 'Unassigned'}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-zinc-500">JN ID</span>
                    <p className="font-mono text-xs text-zinc-400">{previewJnJob.jnid}</p>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500">Job Number</span>
                    <p>{previewJnJob.jobNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500">Created</span>
                    <p>{previewJnJob.createdAt ? formatDate(previewJnJob.createdAt) : 'Unknown'}</p>
                  </div>
                  {previewJnJob.estimateTotal > 0 && (
                    <div>
                      <span className="text-xs text-zinc-500">Estimate Total</span>
                      <p className="text-[#39FF14]">{formatCurrency(previewJnJob.estimateTotal)}</p>
                    </div>
                  )}
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Note</p>
                    <p className="text-xs text-zinc-400">
                      Materials will need to be added manually after creating the work order, as JobNimbus does not store structured material data.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Sample Data Preview Panel */}
      {!useJN && previewJob && (
        <div className="border border-zinc-700 rounded-xl p-6 bg-zinc-900">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Ticket Preview: {previewJob.jobId}</h3>
            <button onClick={() => setPreviewJob(null)} className="p-1 hover:bg-zinc-800 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <span className="text-xs text-zinc-500">Customer</span>
                <p className="font-medium">{previewJob.customerName}</p>
              </div>
              <div>
                <span className="text-xs text-zinc-500">Phone</span>
                <p>{previewJob.customerPhone}</p>
              </div>
              <div>
                <span className="text-xs text-zinc-500">Address</span>
                <p>{previewJob.address.street}</p>
                <p className="text-sm text-zinc-400">{previewJob.address.city}, {previewJob.address.state} {previewJob.address.zip}</p>
              </div>
              <div>
                <span className="text-xs text-zinc-500">Job Type</span>
                <p>{previewJob.jobType}</p>
              </div>
              <div>
                <span className="text-xs text-zinc-500">Notes</span>
                <p className="text-sm text-zinc-400">{previewJob.notes}</p>
              </div>
            </div>
            <div>
              <span className="text-xs text-zinc-500 mb-2 block">Materials (to be delivered)</span>
              <div className="space-y-2">
                {previewJob.materials.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-2 bg-zinc-800/50 rounded-lg">
                    <span className="text-sm">{m.productName}</span>
                    <span className="text-sm text-zinc-400">{m.quantity} {m.unit}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-800 text-sm text-zinc-400">
                Est. Weight: {previewJob.materials.reduce((s, m) => s + m.quantity * m.weight, 0).toLocaleString()} lbs
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// TAB 5: WORK ORDER HISTORY
// ============================================

function WorkOrderHistory({ workOrders, loading }: { workOrders: WorkOrder[]; loading: boolean }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = [...workOrders];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(wo =>
        wo.customerName.toLowerCase().includes(q) ||
        wo.workOrderId.toLowerCase().includes(q) ||
        wo.jobId.toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      result = result.filter(wo => wo.status === statusFilter);
    }

    // Sort by most recent first
    result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return result;
  }, [workOrders, search, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search history..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="text-sm text-zinc-400">{filtered.length} work orders</div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#39FF14]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No work orders match your search</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(wo => {
            const sc = STATUS_CONFIG[wo.status] || STATUS_CONFIG.draft;
            const pc = PRIORITY_CONFIG[wo.priority] || PRIORITY_CONFIG.normal;
            const tc = TYPE_CONFIG[wo.type] || TYPE_CONFIG.delivery;
            const TypeIcon = tc.icon;
            const isExpanded = expandedId === wo.workOrderId;

            return (
              <div key={wo.workOrderId} className="border border-zinc-800 rounded-xl overflow-hidden">
                {/* Header row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : wo.workOrderId)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-zinc-900/50 transition-colors text-left"
                >
                  <div className="flex-shrink-0">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                  </div>
                  <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-6 gap-2 items-center">
                    <div>
                      <div className="font-mono text-[#39FF14] text-sm">{wo.workOrderId}</div>
                      <div className="text-xs text-zinc-500">{wo.jobId}</div>
                    </div>
                    <div>
                      <div className="font-medium text-sm truncate">{wo.customerName}</div>
                      <div className="text-xs text-zinc-500">{wo.address.city}, {wo.address.state}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <TypeIcon className={`w-3.5 h-3.5 ${tc.color}`} />
                      <span className="text-sm">{tc.label}</span>
                    </div>
                    <div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${pc.color} ${pc.bg}`}>
                        {pc.label}
                      </span>
                    </div>
                    <div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color} ${sc.bg}`}>
                        {sc.label}
                      </span>
                    </div>
                    <div className="text-sm text-zinc-400">{formatDate(wo.updatedAt.slice(0, 10))}</div>
                  </div>
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-zinc-800 p-6 bg-zinc-900/30 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-zinc-500">Address:</span>
                        <p>{wo.address.street}, {wo.address.city}, {wo.address.state} {wo.address.zip}</p>
                      </div>
                      <div>
                        <span className="text-zinc-500">Scheduled:</span>
                        <p>{wo.scheduledDate ? `${formatDate(wo.scheduledDate)} at ${wo.scheduledTime}` : 'Not scheduled'}</p>
                      </div>
                      <div>
                        <span className="text-zinc-500">Driver:</span>
                        <p>{wo.assignedDriver || 'Unassigned'} {wo.vehicleType && `(${wo.vehicleType})`}</p>
                      </div>
                      <div>
                        <span className="text-zinc-500">Est. Cost:</span>
                        <p className="font-medium">{formatCurrency(wo.estimatedCost)}</p>
                      </div>
                      <div>
                        <span className="text-zinc-500">Actual Cost:</span>
                        <p className="font-medium">{wo.actualCost !== null ? formatCurrency(wo.actualCost) : '-'}</p>
                      </div>
                      <div>
                        <span className="text-zinc-500">Created by:</span>
                        <p>{wo.createdBy} on {formatDate(wo.createdAt.slice(0, 10))}</p>
                      </div>
                    </div>

                    {/* Materials */}
                    <div>
                      <span className="text-zinc-500 text-sm">Materials:</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {wo.materials.map(m => (
                          <span key={m.id} className="px-2 py-1 bg-zinc-800 rounded text-xs">
                            {m.quantity} {m.unit} {m.productName}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Notes */}
                    {wo.notes && (
                      <div>
                        <span className="text-zinc-500 text-sm">Notes:</span>
                        <p className="text-sm mt-1">{wo.notes}</p>
                      </div>
                    )}

                    {/* Status Timeline */}
                    {wo.statusHistory.length > 0 && (
                      <div>
                        <span className="text-zinc-500 text-sm">Status Timeline:</span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {wo.statusHistory.map((h, i) => {
                            const toConfig = STATUS_CONFIG[h.to] || STATUS_CONFIG.draft;
                            return (
                              <div key={i} className="flex items-center gap-1 text-xs">
                                <div className={`w-2 h-2 rounded-full ${toConfig.color.replace('text-', 'bg-')}`} />
                                <span className={toConfig.color}>{toConfig.label}</span>
                                <span className="text-zinc-600">{formatDateTime(h.changedAt)}</span>
                                {i < wo.statusHistory.length - 1 && <ArrowRight className="w-3 h-3 text-zinc-600 mx-1" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
