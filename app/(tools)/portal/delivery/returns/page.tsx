'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  RotateCcw,
  Truck,
  ClipboardCheck,
  Plus,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  X,
  Trash2,
  Camera,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  Calendar,
  FileText,
  BarChart3,
  Archive,
  Eye,
  Edit,
  Save,
  XCircle,
  PackageCheck,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Timer,
  Hash,
  User,
  MessageSquare,
  ChevronUp,
} from 'lucide-react';
import AddressAutocomplete, { AddressResult } from '@/components/AddressAutocomplete';

// ---- Types ----

type ReturnType = 'return' | 'pickup';
type ReturnDestination = 'internal' | 'distributor';
type ReturnReason = 'unused_materials' | 'wrong_order' | 'damaged' | 'customer_request' | 'job_complete';
type ReturnStatus = 'pending' | 'scheduled' | 'picked_up' | 'inspected' | 'restocked' | 'completed';
type Priority = 'low' | 'normal' | 'high' | 'urgent';
type ItemCondition = 'new' | 'good' | 'damaged' | 'unusable';
type RestockDecision = 'restock' | 'dispose' | 'hold_for_review';

interface ReturnItem {
  id: string;
  name: string;
  expectedQty: number;
  actualQty?: number;
  unit: string;
  condition?: ItemCondition;
  restockDecision?: RestockDecision;
  notes?: string;
  photosRequired: boolean;
  photosUploaded: number;
}

interface ReturnTicket {
  id: string;
  customerName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  returnType: ReturnType;
  returnDestination: ReturnDestination;
  distributorName?: string;
  distributorLocation?: string;
  creditMemoNumber?: string;
  creditMemoAmount?: number;
  routeAssistanceNeeded?: boolean;
  reason: ReturnReason;
  status: ReturnStatus;
  priority: Priority;
  items: ReturnItem[];
  specialInstructions?: string;
  createdDate: string;
  scheduledDate?: string;
  completedDate?: string;
  assignedDriver?: string;
  totalEstimatedValue: number;
  photoRequirements: {
    beforePickup: boolean;
    afterPickup: boolean;
    conditionClose: boolean;
    truckLoaded: boolean;
  };
}

// Distributors for return-to-distributor flow
const DISTRIBUTORS = [
  { name: 'Advance Build Products', locations: ['Huntsville, AL', 'Decatur, AL'] },
  { name: 'Beacon', locations: ['Huntsville, AL', 'Decatur, AL', 'Birmingham, AL'] },
  { name: 'Gold Eagle', locations: ['Huntsville, AL', 'Decatur, AL'] },
  { name: "Lowe's", locations: ['Huntsville, AL', 'Madison, AL', 'Decatur, AL'] },
  { name: 'Home Depot', locations: ['Huntsville, AL', 'Madison, AL', 'Decatur, AL'] },
];

// ---- Reason labels ----

const REASON_LABELS: Record<ReturnReason, string> = {
  unused_materials: 'Unused Materials',
  wrong_order: 'Wrong Order',
  damaged: 'Damaged',
  customer_request: 'Customer Request',
  job_complete: 'Job Complete',
};

const STATUS_LABELS: Record<ReturnStatus, string> = {
  pending: 'Pending',
  scheduled: 'Scheduled',
  picked_up: 'Picked Up',
  inspected: 'Inspected',
  restocked: 'Restocked',
  completed: 'Completed',
};

const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

const CONDITION_LABELS: Record<ItemCondition, string> = {
  new: 'New / Unopened',
  good: 'Good / Usable',
  damaged: 'Damaged',
  unusable: 'Unusable',
};

const RESTOCK_LABELS: Record<RestockDecision, string> = {
  restock: 'Restock',
  dispose: 'Dispose',
  hold_for_review: 'Hold for Review',
};

// ---- Mock Data ----

const MOCK_TICKETS: ReturnTicket[] = [
  {
    id: 'RTN-2026-001',
    customerName: 'Johnson Residence',
    address: '1420 Governors Dr SW',
    city: 'Huntsville',
    state: 'AL',
    zip: '35801',
    returnType: 'pickup',
    returnDestination: 'internal',
    creditMemoNumber: 'CM-2026-001',
    reason: 'unused_materials',
    status: 'pending',
    priority: 'normal',
    items: [
      { id: 'i1', name: 'Owens Corning Duration Shingles (Onyx Black)', expectedQty: 8, unit: 'bundles', photosRequired: true, photosUploaded: 0 },
      { id: 'i2', name: 'Synthetic Underlayment Roll', expectedQty: 2, unit: 'rolls', photosRequired: true, photosUploaded: 0 },
      { id: 'i3', name: 'Galvanized Roofing Nails (1.25")', expectedQty: 1, unit: 'box', photosRequired: false, photosUploaded: 0 },
    ],
    specialInstructions: 'Materials are stacked in the garage. Customer will leave garage open after 9 AM.',
    createdDate: '2026-02-08',
    totalEstimatedValue: 485.00,
    photoRequirements: { beforePickup: true, afterPickup: true, conditionClose: true, truckLoaded: true },
  },
  {
    id: 'RTN-2026-002',
    customerName: 'Smith Commercial',
    address: '4925 University Dr NW',
    city: 'Huntsville',
    state: 'AL',
    zip: '35816',
    returnType: 'return',
    returnDestination: 'distributor',
    distributorName: 'Beacon',
    distributorLocation: 'Huntsville, AL',
    routeAssistanceNeeded: true,
    reason: 'wrong_order',
    status: 'scheduled',
    priority: 'high',
    items: [
      { id: 'i4', name: 'GAF Timberline HDZ Shingles (Charcoal)', expectedQty: 15, unit: 'bundles', photosRequired: true, photosUploaded: 0 },
      { id: 'i5', name: 'Step Flashing (Aluminum)', expectedQty: 4, unit: 'packs', photosRequired: false, photosUploaded: 0 },
    ],
    specialInstructions: 'Wrong color delivered. Correct color is Weathered Wood. Customer needs re-delivery ASAP.',
    createdDate: '2026-02-07',
    scheduledDate: '2026-02-11',
    assignedDriver: 'Marcus Thompson',
    totalEstimatedValue: 1120.00,
    photoRequirements: { beforePickup: true, afterPickup: false, conditionClose: true, truckLoaded: true },
  },
  {
    id: 'RTN-2026-003',
    customerName: 'Davis Property Management',
    address: '808 Madison St SE',
    city: 'Madison',
    state: 'AL',
    zip: '35758',
    returnType: 'pickup',
    returnDestination: 'internal',
    reason: 'job_complete',
    status: 'picked_up',
    priority: 'low',
    items: [
      { id: 'i6', name: 'Ridge Cap Shingles', expectedQty: 3, actualQty: 3, unit: 'bundles', condition: 'new', photosRequired: true, photosUploaded: 2 },
      { id: 'i7', name: 'Pipe Boot Flashing (3")', expectedQty: 2, actualQty: 2, unit: 'pieces', condition: 'new', photosRequired: false, photosUploaded: 0 },
      { id: 'i8', name: 'Drip Edge (10ft, White)', expectedQty: 6, actualQty: 5, unit: 'pieces', condition: 'good', photosRequired: true, photosUploaded: 1 },
      { id: 'i9', name: 'Ice & Water Shield', expectedQty: 1, actualQty: 1, unit: 'roll', condition: 'good', photosRequired: false, photosUploaded: 0 },
    ],
    createdDate: '2026-02-06',
    scheduledDate: '2026-02-09',
    assignedDriver: 'James Wilson',
    totalEstimatedValue: 312.50,
    photoRequirements: { beforePickup: true, afterPickup: true, conditionClose: true, truckLoaded: false },
  },
  {
    id: 'RTN-2026-004',
    customerName: 'Heritage Church',
    address: '2200 Whitesburg Dr S',
    city: 'Huntsville',
    state: 'AL',
    zip: '35801',
    returnType: 'return',
    returnDestination: 'distributor',
    distributorName: 'Advance Build Products',
    distributorLocation: 'Huntsville, AL',
    routeAssistanceNeeded: true,
    reason: 'damaged',
    status: 'inspected',
    priority: 'urgent',
    items: [
      { id: 'i10', name: 'CertainTeed Landmark Shingles (Moire Black)', expectedQty: 20, actualQty: 20, unit: 'bundles', condition: 'damaged', restockDecision: 'hold_for_review', notes: 'Water damage on 12 bundles, packaging split. Remaining 8 look okay.', photosRequired: true, photosUploaded: 6 },
      { id: 'i11', name: 'Synthetic Felt Underlayment', expectedQty: 4, actualQty: 4, unit: 'rolls', condition: 'damaged', restockDecision: 'dispose', notes: 'Rolls were left in rain, completely soaked through.', photosRequired: true, photosUploaded: 3 },
      { id: 'i12', name: 'Roof Cement (1 gal)', expectedQty: 2, actualQty: 2, unit: 'cans', condition: 'good', restockDecision: 'restock', notes: 'Sealed, no damage.', photosRequired: false, photosUploaded: 0 },
    ],
    specialInstructions: 'Insurance claim may be filed. Document all damage thoroughly. Keep damaged materials separate.',
    createdDate: '2026-02-05',
    scheduledDate: '2026-02-07',
    assignedDriver: 'Marcus Thompson',
    totalEstimatedValue: 1875.00,
    photoRequirements: { beforePickup: true, afterPickup: true, conditionClose: true, truckLoaded: true },
  },
  {
    id: 'RTN-2026-005',
    customerName: 'Martinez Residence',
    address: '3315 Memorial Pkwy NW',
    city: 'Huntsville',
    state: 'AL',
    zip: '35810',
    returnType: 'pickup',
    returnDestination: 'internal',
    creditMemoNumber: 'CM-2026-005',
    creditMemoAmount: 395.00,
    reason: 'customer_request',
    status: 'completed',
    priority: 'normal',
    items: [
      { id: 'i13', name: 'Owens Corning TruDefinition Shingles (Desert Tan)', expectedQty: 5, actualQty: 5, unit: 'bundles', condition: 'new', restockDecision: 'restock', photosRequired: true, photosUploaded: 4 },
      { id: 'i14', name: 'Starter Strip Shingles', expectedQty: 2, actualQty: 2, unit: 'bundles', condition: 'new', restockDecision: 'restock', photosRequired: false, photosUploaded: 0 },
    ],
    specialInstructions: 'Customer changed mind on color. Switching to Brownwood.',
    createdDate: '2026-02-03',
    scheduledDate: '2026-02-05',
    completedDate: '2026-02-05',
    assignedDriver: 'James Wilson',
    totalEstimatedValue: 395.00,
    photoRequirements: { beforePickup: true, afterPickup: false, conditionClose: false, truckLoaded: true },
  },
];

// ---- Helper functions ----

function generateId(): string {
  return `RTN-2026-${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}`;
}

function generateItemId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---- Status / Priority colors ----

function getStatusColor(status: ReturnStatus): string {
  switch (status) {
    case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'scheduled': return 'bg-brand-green/20 text-blue-400 border-blue-500/30';
    case 'picked_up': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'inspected': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'restocked': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/30';
  }
}

function getPriorityColor(priority: Priority): string {
  switch (priority) {
    case 'low': return 'bg-gray-400/20 text-neutral-400 border-gray-500/30';
    case 'normal': return 'bg-brand-green/20 text-blue-400 border-blue-500/30';
    case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'urgent': return 'bg-red-500/20 text-red-400 border-red-500/30';
  }
}

function getConditionColor(condition: ItemCondition): string {
  switch (condition) {
    case 'new': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'good': return 'bg-brand-green/20 text-blue-400 border-blue-500/30';
    case 'damaged': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'unusable': return 'bg-red-500/20 text-red-400 border-red-500/30';
  }
}

function getRestockColor(decision: RestockDecision): string {
  switch (decision) {
    case 'restock': return 'bg-green-500/20 text-green-400';
    case 'dispose': return 'bg-red-500/20 text-red-400';
    case 'hold_for_review': return 'bg-yellow-500/20 text-yellow-400';
  }
}

// ---- Component ----

type TabView = 'queue' | 'create' | 'process' | 'dashboard' | 'history';

export default function ReturnPickupPage() {
  const [activeTab, setActiveTab] = useState<TabView>('queue');
  const [tickets, setTickets] = useState<ReturnTicket[]>(MOCK_TICKETS);
  const [selectedTicket, setSelectedTicket] = useState<ReturnTicket | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<ReturnType | 'all'>('all');
  const [historySearch, setHistorySearch] = useState('');
  const [historyReasonFilter, setHistoryReasonFilter] = useState<ReturnReason | 'all'>('all');

  // Create form state
  const [formCustomer, setFormCustomer] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('Huntsville');
  const [formState, setFormState] = useState('AL');
  const [formZip, setFormZip] = useState('');
  const [formType, setFormType] = useState<ReturnType>('return');
  const [formDestination, setFormDestination] = useState<ReturnDestination>('internal');
  const [formDistributor, setFormDistributor] = useState('');
  const [formDistributorLocation, setFormDistributorLocation] = useState('');
  const [formReason, setFormReason] = useState<ReturnReason>('unused_materials');
  const [formPriority, setFormPriority] = useState<Priority>('normal');
  const [formInstructions, setFormInstructions] = useState('');
  const [formItems, setFormItems] = useState<{ name: string; qty: number; unit: string }[]>([
    { name: '', qty: 1, unit: 'bundles' },
  ]);
  const [formPhotos, setFormPhotos] = useState({
    beforePickup: true,
    afterPickup: false,
    conditionClose: true,
    truckLoaded: false,
  });
  const [showCreateSuccess, setShowCreateSuccess] = useState(false);

  // Processing state
  const [processingItems, setProcessingItems] = useState<ReturnItem[]>([]);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // ---- Filtered tickets ----

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (typeFilter !== 'all' && t.returnType !== typeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          t.id.toLowerCase().includes(q) ||
          t.customerName.toLowerCase().includes(q) ||
          t.address.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tickets, statusFilter, typeFilter, searchQuery]);

  const activeTickets = useMemo(() => filteredTickets.filter(t => t.status !== 'completed'), [filteredTickets]);
  const completedTickets = useMemo(() => {
    return tickets.filter(t => {
      if (t.status !== 'completed') return false;
      if (historyReasonFilter !== 'all' && t.reason !== historyReasonFilter) return false;
      if (historySearch) {
        const q = historySearch.toLowerCase();
        return (
          t.id.toLowerCase().includes(q) ||
          t.customerName.toLowerCase().includes(q) ||
          t.address.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tickets, historySearch, historyReasonFilter]);

  // ---- Dashboard stats ----

  const dashboardStats = useMemo(() => {
    const thisMonth = tickets.filter(t => t.createdDate.startsWith('2026-02'));
    const totalReturns = thisMonth.length;
    const totalValue = thisMonth.reduce((sum, t) => sum + t.totalEstimatedValue, 0);
    const completedThisMonth = thisMonth.filter(t => t.status === 'completed');
    const avgProcessingDays = completedThisMonth.length > 0
      ? completedThisMonth.reduce((sum, t) => {
          const created = new Date(t.createdDate).getTime();
          const completed = new Date(t.completedDate || t.createdDate).getTime();
          return sum + (completed - created) / (1000 * 60 * 60 * 24);
        }, 0) / completedThisMonth.length
      : 0;
    const reasonCounts: Record<ReturnReason, number> = {
      unused_materials: 0,
      wrong_order: 0,
      damaged: 0,
      customer_request: 0,
      job_complete: 0,
    };
    thisMonth.forEach(t => { reasonCounts[t.reason]++; });
    const statusCounts: Record<ReturnStatus, number> = {
      pending: 0,
      scheduled: 0,
      picked_up: 0,
      inspected: 0,
      restocked: 0,
      completed: 0,
    };
    thisMonth.forEach(t => { statusCounts[t.status]++; });
    const pendingCount = tickets.filter(t => t.status === 'pending').length;
    const inProgressCount = tickets.filter(t => !['pending', 'completed'].includes(t.status)).length;

    return {
      totalReturns,
      totalValue,
      avgProcessingDays,
      reasonCounts,
      statusCounts,
      pendingCount,
      inProgressCount,
      completedCount: completedThisMonth.length,
    };
  }, [tickets]);

  // ---- Handlers ----

  function handleSelectTicket(ticket: ReturnTicket) {
    setSelectedTicket(ticket);
    setProcessingItems(ticket.items.map(item => ({ ...item })));
    setExpandedItemId(null);
    setActiveTab('process');
  }

  function handleCreateReturn() {
    const validItems = formItems.filter(i => i.name.trim());
    if (!formCustomer.trim() || !formAddress.trim() || validItems.length === 0) return;

    const newTicket: ReturnTicket = {
      id: generateId(),
      customerName: formCustomer.trim(),
      address: formAddress.trim(),
      city: formCity.trim(),
      state: formState.trim(),
      zip: formZip.trim(),
      returnType: formType,
      returnDestination: formDestination,
      distributorName: formDestination === 'distributor' ? formDistributor : undefined,
      distributorLocation: formDestination === 'distributor' ? formDistributorLocation : undefined,
      routeAssistanceNeeded: formDestination === 'distributor',
      creditMemoNumber: formDestination === 'internal' ? `CM-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}` : undefined,
      reason: formReason,
      status: 'pending',
      priority: formPriority,
      items: validItems.map(i => ({
        id: generateItemId(),
        name: i.name,
        expectedQty: i.qty,
        unit: i.unit,
        photosRequired: formPhotos.conditionClose,
        photosUploaded: 0,
      })),
      specialInstructions: formInstructions.trim() || undefined,
      createdDate: new Date().toISOString().slice(0, 10),
      totalEstimatedValue: Math.round(validItems.reduce((s, i) => s + i.qty * 35, 0) * 100) / 100,
      photoRequirements: { ...formPhotos },
    };

    setTickets(prev => [newTicket, ...prev]);
    setShowCreateSuccess(true);
    setTimeout(() => setShowCreateSuccess(false), 3000);

    // Reset form
    setFormCustomer('');
    setFormAddress('');
    setFormCity('Huntsville');
    setFormState('AL');
    setFormZip('');
    setFormType('return');
    setFormDestination('internal');
    setFormDistributor('');
    setFormDistributorLocation('');
    setFormReason('unused_materials');
    setFormPriority('normal');
    setFormInstructions('');
    setFormItems([{ name: '', qty: 1, unit: 'bundles' }]);
    setFormPhotos({ beforePickup: true, afterPickup: false, conditionClose: true, truckLoaded: false });
  }

  function addFormItem() {
    setFormItems(prev => [...prev, { name: '', qty: 1, unit: 'bundles' }]);
  }

  function removeFormItem(index: number) {
    setFormItems(prev => prev.filter((_, i) => i !== index));
  }

  function updateFormItem(index: number, field: 'name' | 'qty' | 'unit', value: string | number) {
    setFormItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  function updateProcessingItem(itemId: string, field: keyof ReturnItem, value: unknown) {
    setProcessingItems(prev =>
      prev.map(item => item.id === itemId ? { ...item, [field]: value } : item)
    );
  }

  function handleSaveProcessing() {
    if (!selectedTicket) return;
    setTickets(prev =>
      prev.map(t =>
        t.id === selectedTicket.id
          ? { ...t, items: processingItems, status: 'inspected' as ReturnStatus }
          : t
      )
    );
    setSelectedTicket(prev => prev ? { ...prev, items: processingItems, status: 'inspected' } : null);
  }

  function handleAdvanceStatus(ticketId: string) {
    const statusOrder: ReturnStatus[] = ['pending', 'scheduled', 'picked_up', 'inspected', 'restocked', 'completed'];
    setTickets(prev =>
      prev.map(t => {
        if (t.id !== ticketId) return t;
        const idx = statusOrder.indexOf(t.status);
        if (idx < statusOrder.length - 1) {
          const nextStatus = statusOrder[idx + 1];
          const update: Partial<ReturnTicket> = { status: nextStatus };
          if (nextStatus === 'scheduled') update.scheduledDate = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
          if (nextStatus === 'completed') update.completedDate = new Date().toISOString().slice(0, 10);
          return { ...t, ...update };
        }
        return t;
      })
    );
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(prev => {
        if (!prev) return null;
        const idx = statusOrder.indexOf(prev.status);
        if (idx < statusOrder.length - 1) {
          const nextStatus = statusOrder[idx + 1];
          return { ...prev, status: nextStatus };
        }
        return prev;
      });
    }
  }

  // ---- Tab Navigation ----

  const tabs: { key: TabView; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'queue', label: 'Return Queue', icon: <ClipboardCheck className="w-4 h-4" />, count: activeTickets.length },
    { key: 'create', label: 'Create Return', icon: <Plus className="w-4 h-4" /> },
    { key: 'process', label: 'Process Return', icon: <PackageCheck className="w-4 h-4" /> },
    { key: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'history', label: 'History', icon: <Archive className="w-4 h-4" />, count: completedTickets.length },
  ];

  // ---- Render Helpers ----

  function renderStatusBadge(status: ReturnStatus) {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(status)}`}>
        {STATUS_LABELS[status]}
      </span>
    );
  }

  function renderPriorityBadge(priority: Priority) {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getPriorityColor(priority)}`}>
        {priority === 'urgent' && <AlertTriangle className="w-3 h-3 mr-1" />}
        {PRIORITY_LABELS[priority]}
      </span>
    );
  }

  // ---- Queue Tab ----

  function renderQueue() {
    return (
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Search tickets, customers, addresses..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50 focus:border-[#39FF14]/50"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as ReturnStatus | 'all')}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50"
          >
            <option value="all">All Statuses</option>
            {(Object.keys(STATUS_LABELS) as ReturnStatus[]).filter(s => s !== 'completed').map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as ReturnType | 'all')}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50"
          >
            <option value="all">All Types</option>
            <option value="return">Return</option>
            <option value="pickup">Pickup</option>
          </select>
        </div>

        {/* Summary Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-yellow-400">{dashboardStats.pendingCount}</div>
            <div className="text-xs text-yellow-400/70">Pending</div>
          </div>
          <div className="bg-brand-green/10 border border-blue-500/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-400">{dashboardStats.inProgressCount}</div>
            <div className="text-xs text-blue-400/70">In Progress</div>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-400">{dashboardStats.completedCount}</div>
            <div className="text-xs text-green-400/70">Completed (Month)</div>
          </div>
        </div>

        {/* Ticket List */}
        {activeTickets.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            <RotateCcw className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">No active return tickets</p>
            <p className="text-sm mt-1">Create a new return ticket to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTickets.map(ticket => (
              <div
                key={ticket.id}
                className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-[#39FF14]/30 transition-colors cursor-pointer"
                onClick={() => handleSelectTicket(ticket)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono text-[#39FF14]">{ticket.id}</span>
                      {renderStatusBadge(ticket.status)}
                      {renderPriorityBadge(ticket.priority)}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        ticket.returnType === 'return'
                          ? 'bg-brand-green/20 text-indigo-400 border border-indigo-500/30'
                          : 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                      }`}>
                        {ticket.returnType === 'return' ? <RotateCcw className="w-3 h-3 mr-1" /> : <Truck className="w-3 h-3 mr-1" />}
                        {ticket.returnType === 'return' ? 'Return' : 'Pickup'}
                      </span>
                      {ticket.returnDestination === 'distributor' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          → {ticket.distributorName}
                        </span>
                      )}
                      {ticket.returnDestination === 'internal' && ticket.creditMemoNumber && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {ticket.creditMemoNumber}
                        </span>
                      )}
                    </div>
                    <h3 className="text-white font-medium mt-1">{ticket.customerName}</h3>
                    <div className="flex items-center gap-1 text-sm text-neutral-500 mt-0.5">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{ticket.address}, {ticket.city}, {ticket.state} {ticket.zip}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {ticket.items.length} item{ticket.items.length !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {REASON_LABELS[ticket.reason]}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Created {ticket.createdDate}
                      </span>
                      {ticket.scheduledDate && (
                        <span className="flex items-center gap-1 text-blue-400">
                          <Clock className="w-3 h-3" />
                          Scheduled {ticket.scheduledDate}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium text-white">${ticket.totalEstimatedValue.toFixed(2)}</div>
                    <div className="text-xs text-neutral-500 mt-1">Est. Value</div>
                    <button
                      onClick={e => { e.stopPropagation(); handleAdvanceStatus(ticket.id); }}
                      className="mt-2 px-3 py-1 text-xs rounded bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30 hover:bg-[#39FF14]/20 transition-colors"
                    >
                      Advance Status
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---- Create Tab ----

  function renderCreate() {
    const isFormValid = formCustomer.trim() && formAddress.trim() && formItems.some(i => i.name.trim());
    return (
      <div className="space-y-6">
        {showCreateSuccess && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
            <span className="text-green-400">Return ticket created successfully!</span>
          </div>
        )}

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-5">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#39FF14]" />
            New Return / Pickup Ticket
          </h3>

          {/* Customer & Address */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-neutral-500 mb-1">Customer Name *</label>
              <input
                type="text"
                value={formCustomer}
                onChange={e => setFormCustomer(e.target.value)}
                placeholder="e.g., Johnson Residence"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50 focus:border-[#39FF14]/50"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-500 mb-1">Address *</label>
              <AddressAutocomplete
                onAddressSelect={(result: AddressResult) => {
                  const streetParts: string[] = [];
                  if (result.streetNumber) streetParts.push(result.streetNumber);
                  if (result.street) streetParts.push(result.street);
                  setFormAddress(streetParts.length > 0 ? streetParts.join(' ') : result.formattedAddress.split(',')[0]);
                  if (result.city) setFormCity(result.city);
                  if (result.state) setFormState(result.state);
                  if (result.zip) setFormZip(result.zip);
                }}
                defaultValue={formAddress}
                placeholder="Start typing address..."
                className="!bg-gray-900 !border-gray-700 !placeholder-gray-600 focus:!ring-2 focus:!ring-[#39FF14]/50 focus:!border-[#39FF14]/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-neutral-500 mb-1">City</label>
              <input
                type="text"
                value={formCity}
                onChange={e => setFormCity(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-500 mb-1">State</label>
              <input
                type="text"
                value={formState}
                onChange={e => setFormState(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-500 mb-1">ZIP</label>
              <input
                type="text"
                value={formZip}
                onChange={e => setFormZip(e.target.value)}
                placeholder="35801"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50"
              />
            </div>
          </div>

          {/* Type, Reason, Priority */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-neutral-500 mb-1">Return Type</label>
              <select
                value={formType}
                onChange={e => setFormType(e.target.value as ReturnType)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50"
              >
                <option value="return">Return</option>
                <option value="pickup">Pickup</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-neutral-500 mb-1">Reason</label>
              <select
                value={formReason}
                onChange={e => setFormReason(e.target.value as ReturnReason)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50"
              >
                {(Object.keys(REASON_LABELS) as ReturnReason[]).map(r => (
                  <option key={r} value={r}>{REASON_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-neutral-500 mb-1">Priority</label>
              <select
                value={formPriority}
                onChange={e => setFormPriority(e.target.value as Priority)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50"
              >
                {(Object.keys(PRIORITY_LABELS) as Priority[]).map(p => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Return Destination */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-neutral-500 mb-2">Return Destination</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormDestination('internal')}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    formDestination === 'internal'
                      ? 'bg-[#39FF14]/10 border-[#39FF14]/30 text-[#39FF14]'
                      : 'bg-gray-900 border-gray-700 text-neutral-500 hover:border-gray-600'
                  }`}
                >
                  <RotateCcw className="w-5 h-5 mb-2" />
                  <div className="font-medium text-sm">Return to Us</div>
                  <div className="text-xs opacity-70 mt-1">Retired material → Credit Memo</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormDestination('distributor')}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    formDestination === 'distributor'
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      : 'bg-gray-900 border-gray-700 text-neutral-500 hover:border-gray-600'
                  }`}
                >
                  <Truck className="w-5 h-5 mb-2" />
                  <div className="font-medium text-sm">Return to Distributor</div>
                  <div className="text-xs opacity-70 mt-1">Route assistance needed</div>
                </button>
              </div>
            </div>

            {formDestination === 'distributor' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <div>
                  <label className="block text-sm text-blue-400 mb-1">Distributor</label>
                  <select
                    value={formDistributor}
                    onChange={e => {
                      setFormDistributor(e.target.value);
                      setFormDistributorLocation('');
                    }}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="">Select distributor...</option>
                    {DISTRIBUTORS.map(d => (
                      <option key={d.name} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-blue-400 mb-1">Location</label>
                  <select
                    value={formDistributorLocation}
                    onChange={e => setFormDistributorLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    disabled={!formDistributor}
                  >
                    <option value="">Select location...</option>
                    {DISTRIBUTORS.find(d => d.name === formDistributor)?.locations.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {formDestination === 'internal' && (
              <div className="p-3 bg-[#39FF14]/5 border border-[#39FF14]/20 rounded-lg">
                <div className="flex items-center gap-2 text-[#39FF14] text-sm">
                  <FileText className="w-4 h-4" />
                  <span className="font-medium">A credit memo will be generated automatically upon completion</span>
                </div>
              </div>
            )}
          </div>

          {/* Items */}
          <div>
            <label className="block text-sm text-neutral-500 mb-2">Items to Return *</label>
            <div className="space-y-2">
              {formItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item.name}
                    onChange={e => updateFormItem(idx, 'name', e.target.value)}
                    placeholder="Material name (e.g., Shingles)"
                    className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50"
                  />
                  <input
                    type="number"
                    value={item.qty}
                    onChange={e => updateFormItem(idx, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    className="w-20 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50"
                  />
                  <select
                    value={item.unit}
                    onChange={e => updateFormItem(idx, 'unit', e.target.value)}
                    className="w-28 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50"
                  >
                    <option value="bundles">Bundles</option>
                    <option value="rolls">Rolls</option>
                    <option value="pieces">Pieces</option>
                    <option value="boxes">Boxes</option>
                    <option value="packs">Packs</option>
                    <option value="cans">Cans</option>
                    <option value="gallons">Gallons</option>
                    <option value="sheets">Sheets</option>
                    <option value="bags">Bags</option>
                    <option value="linear ft">Linear Ft</option>
                  </select>
                  {formItems.length > 1 && (
                    <button
                      onClick={() => removeFormItem(idx)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addFormItem}
              className="mt-2 flex items-center gap-1 text-sm text-[#39FF14] hover:text-[#39FF14]/80 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>

          {/* Special Instructions */}
          <div>
            <label className="block text-sm text-neutral-500 mb-1">Special Instructions</label>
            <textarea
              value={formInstructions}
              onChange={e => setFormInstructions(e.target.value)}
              placeholder="Access notes, staging location, special handling requirements..."
              rows={3}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50 resize-none"
            />
          </div>

          {/* Photo Requirements */}
          <div>
            <label className="block text-sm text-neutral-500 mb-2">Photo Requirements</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: 'beforePickup' as const, label: 'Before Pickup' },
                { key: 'afterPickup' as const, label: 'After Pickup' },
                { key: 'conditionClose' as const, label: 'Condition Close-up' },
                { key: 'truckLoaded' as const, label: 'Truck Loaded' },
              ].map(opt => (
                <label
                  key={opt.key}
                  className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    formPhotos[opt.key]
                      ? 'bg-[#39FF14]/10 border-[#39FF14]/30 text-[#39FF14]'
                      : 'bg-gray-900 border-gray-700 text-neutral-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formPhotos[opt.key]}
                    onChange={e => setFormPhotos(prev => ({ ...prev, [opt.key]: e.target.checked }))}
                    className="sr-only"
                  />
                  <Camera className="w-4 h-4 shrink-0" />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleCreateReturn}
              disabled={!isFormValid}
              className={`px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                isFormValid
                  ? 'bg-[#39FF14] text-black hover:bg-[#39FF14]/90'
                  : 'bg-gray-700 text-neutral-500 cursor-not-allowed'
              }`}
            >
              <Plus className="w-4 h-4" />
              Create Return Ticket
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Process Tab ----

  function renderProcess() {
    if (!selectedTicket) {
      return (
        <div className="text-center py-16 text-neutral-500">
          <PackageCheck className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg">No return selected for processing</p>
          <p className="text-sm mt-1">Select a return from the queue to begin inspection</p>
          <button
            onClick={() => setActiveTab('queue')}
            className="mt-4 px-4 py-2 bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30 rounded-lg hover:bg-[#39FF14]/20 transition-colors text-sm"
          >
            Go to Queue
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-mono text-[#39FF14]">{selectedTicket.id}</span>
                {renderStatusBadge(selectedTicket.status)}
                {renderPriorityBadge(selectedTicket.priority)}
              </div>
              <h3 className="text-lg font-semibold text-white">{selectedTicket.customerName}</h3>
              <div className="text-sm text-neutral-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />
                {selectedTicket.address}, {selectedTicket.city}, {selectedTicket.state} {selectedTicket.zip}
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
                <span>{REASON_LABELS[selectedTicket.reason]}</span>
                <span>{selectedTicket.returnType === 'return' ? 'Return' : 'Pickup'}</span>
                {selectedTicket.assignedDriver && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {selectedTicket.assignedDriver}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleAdvanceStatus(selectedTicket.id)}
                className="px-3 py-1.5 text-sm rounded-lg bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30 hover:bg-[#39FF14]/20 transition-colors"
              >
                Advance Status
              </button>
            </div>
          </div>
          {selectedTicket.specialInstructions && (
            <div className="mt-3 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
              <div className="text-xs text-yellow-400 font-medium mb-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Special Instructions
              </div>
              <p className="text-sm text-yellow-400/80">{selectedTicket.specialInstructions}</p>
            </div>
          )}
        </div>

        {/* Photo Requirements */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <Camera className="w-4 h-4 text-[#39FF14]" />
            Required Photos
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { key: 'beforePickup' as const, label: 'Before Pickup' },
              { key: 'afterPickup' as const, label: 'After Pickup' },
              { key: 'conditionClose' as const, label: 'Condition Close-up' },
              { key: 'truckLoaded' as const, label: 'Truck Loaded' },
            ].map(opt => (
              <div
                key={opt.key}
                className={`p-3 rounded-lg border text-center text-sm ${
                  selectedTicket.photoRequirements[opt.key]
                    ? 'bg-[#39FF14]/5 border-[#39FF14]/30 text-[#39FF14]'
                    : 'bg-gray-900/50 border-gray-700 text-neutral-400'
                }`}
              >
                <Camera className="w-5 h-5 mx-auto mb-1" />
                {opt.label}
                {selectedTicket.photoRequirements[opt.key] && (
                  <div className="text-xs mt-1 opacity-70">Required</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Item Assessment */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-white flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-[#39FF14]" />
              Item Condition Assessment ({processingItems.length} items)
            </h4>
            <button
              onClick={handleSaveProcessing}
              className="px-4 py-1.5 text-sm rounded-lg bg-[#39FF14] text-black font-medium hover:bg-[#39FF14]/90 transition-colors flex items-center gap-1"
            >
              <Save className="w-4 h-4" />
              Save Assessment
            </button>
          </div>

          <div className="space-y-3">
            {processingItems.map(item => {
              const isExpanded = expandedItemId === item.id;
              const qtyMatch = item.actualQty !== undefined && item.actualQty === item.expectedQty;
              const qtyMismatch = item.actualQty !== undefined && item.actualQty !== item.expectedQty;

              return (
                <div key={item.id} className="border border-gray-700 rounded-lg overflow-hidden">
                  {/* Item Header */}
                  <div
                    className="flex items-center justify-between p-3 bg-gray-900/50 cursor-pointer hover:bg-gray-900/80 transition-colors"
                    onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Package className="w-4 h-4 text-neutral-500 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm text-white font-medium truncate block">{item.name}</span>
                        <span className="text-xs text-neutral-500">
                          Expected: {item.expectedQty} {item.unit}
                          {item.actualQty !== undefined && (
                            <span className={qtyMismatch ? ' text-red-400' : ' text-green-400'}>
                              {' '} | Actual: {item.actualQty} {item.unit}
                              {qtyMismatch && ' (MISMATCH)'}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.condition && (
                        <span className={`px-2 py-0.5 rounded text-xs border ${getConditionColor(item.condition)}`}>
                          {CONDITION_LABELS[item.condition]}
                        </span>
                      )}
                      {item.restockDecision && (
                        <span className={`px-2 py-0.5 rounded text-xs ${getRestockColor(item.restockDecision)}`}>
                          {RESTOCK_LABELS[item.restockDecision]}
                        </span>
                      )}
                      {item.photosRequired && (
                        <span className="text-xs text-neutral-500 flex items-center gap-1">
                          <Camera className="w-3 h-3" />
                          {item.photosUploaded}
                        </span>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="p-4 border-t border-gray-700 space-y-4 bg-gray-900/30">
                      {/* Quantity Verification */}
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">Actual Quantity Received</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            value={item.actualQty ?? ''}
                            onChange={e => updateProcessingItem(item.id, 'actualQty', e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder={String(item.expectedQty)}
                            min={0}
                            className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50"
                          />
                          <span className="text-sm text-neutral-500">{item.unit}</span>
                          <span className="text-xs text-neutral-500">(Expected: {item.expectedQty})</span>
                          {qtyMatch && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                          {qtyMismatch && <AlertTriangle className="w-4 h-4 text-red-400" />}
                        </div>
                      </div>

                      {/* Condition Assessment */}
                      <div>
                        <label className="block text-xs text-neutral-500 mb-2">Condition Assessment</label>
                        <div className="grid grid-cols-4 gap-2">
                          {(Object.keys(CONDITION_LABELS) as ItemCondition[]).map(cond => (
                            <button
                              key={cond}
                              onClick={() => updateProcessingItem(item.id, 'condition', cond)}
                              className={`p-2 rounded-lg text-xs font-medium border transition-colors ${
                                item.condition === cond
                                  ? getConditionColor(cond)
                                  : 'bg-gray-800 border-gray-700 text-neutral-500 hover:border-gray-600'
                              }`}
                            >
                              {CONDITION_LABELS[cond]}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Restock Decision */}
                      <div>
                        <label className="block text-xs text-neutral-500 mb-2">Restock Decision</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(Object.keys(RESTOCK_LABELS) as RestockDecision[]).map(dec => (
                            <button
                              key={dec}
                              onClick={() => updateProcessingItem(item.id, 'restockDecision', dec)}
                              className={`p-2 rounded-lg text-xs font-medium border transition-colors ${
                                item.restockDecision === dec
                                  ? `${getRestockColor(dec)} border-current`
                                  : 'bg-gray-800 border-gray-700 text-neutral-500 hover:border-gray-600'
                              }`}
                            >
                              {RESTOCK_LABELS[dec]}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Photo Upload Placeholder */}
                      {item.photosRequired && (
                        <div>
                          <label className="block text-xs text-neutral-500 mb-2">Condition Photos</label>
                          <div className="flex items-center gap-3">
                            <div className="flex gap-2">
                              {[0, 1, 2].map(i => (
                                <div
                                  key={i}
                                  className={`w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${
                                    i < item.photosUploaded
                                      ? 'border-[#39FF14]/50 bg-[#39FF14]/5'
                                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                                  }`}
                                  onClick={() => updateProcessingItem(item.id, 'photosUploaded', Math.max(item.photosUploaded, i + 1))}
                                >
                                  {i < item.photosUploaded ? (
                                    <CheckCircle2 className="w-5 h-5 text-[#39FF14]" />
                                  ) : (
                                    <Camera className="w-5 h-5 text-neutral-400" />
                                  )}
                                </div>
                              ))}
                            </div>
                            <span className="text-xs text-neutral-500">{item.photosUploaded}/3 uploaded</span>
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">Notes</label>
                        <textarea
                          value={item.notes || ''}
                          onChange={e => updateProcessingItem(item.id, 'notes', e.target.value)}
                          placeholder="Condition details, damage description, etc."
                          rows={2}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50 resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ---- Dashboard Tab ----

  function renderDashboard() {
    const { totalReturns, totalValue, avgProcessingDays, reasonCounts, statusCounts } = dashboardStats;
    const maxReasonCount = Math.max(...Object.values(reasonCounts), 1);

    // Build status pipeline
    const statusOrder: ReturnStatus[] = ['pending', 'scheduled', 'picked_up', 'inspected', 'restocked', 'completed'];
    const totalStatusCount = Math.max(Object.values(statusCounts).reduce((a, b) => a + b, 0), 1);

    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 text-neutral-500 mb-2">
              <RotateCcw className="w-4 h-4" />
              <span className="text-xs">Returns This Month</span>
            </div>
            <div className="text-3xl font-bold text-white">{totalReturns}</div>
            <div className="text-xs text-neutral-500 mt-1">Feb 2026</div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 text-neutral-500 mb-2">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs">Returned Value</span>
            </div>
            <div className="text-3xl font-bold text-white">${totalValue.toLocaleString()}</div>
            <div className="text-xs text-neutral-500 mt-1">Estimated materials value</div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 text-neutral-500 mb-2">
              <Timer className="w-4 h-4" />
              <span className="text-xs">Avg Processing Time</span>
            </div>
            <div className="text-3xl font-bold text-white">{avgProcessingDays.toFixed(1)}</div>
            <div className="text-xs text-neutral-500 mt-1">Days to completion</div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 text-neutral-500 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">Restock Rate</span>
            </div>
            <div className="text-3xl font-bold text-[#39FF14]">68%</div>
            <div className="text-xs text-neutral-500 mt-1">Items restocked vs disposed</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Return Reasons Bar Chart */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
            <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#39FF14]" />
              Top Return Reasons
            </h4>
            <div className="space-y-3">
              {(Object.entries(reasonCounts) as [ReturnReason, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([reason, count]) => {
                  const pct = (count / maxReasonCount) * 100;
                  const colors: Record<ReturnReason, string> = {
                    unused_materials: '#39FF14',
                    wrong_order: '#f97316',
                    damaged: '#ef4444',
                    customer_request: '#3b82f6',
                    job_complete: '#a78bfa',
                  };
                  return (
                    <div key={reason}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-neutral-500">{REASON_LABELS[reason]}</span>
                        <span className="text-white font-medium">{count}</span>
                      </div>
                      <div className="w-full bg-gray-900 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: colors[reason] }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Status Pipeline */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
            <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-[#39FF14]" />
              Status Pipeline
            </h4>
            <div className="space-y-3">
              {statusOrder.map(status => {
                const count = statusCounts[status];
                const pct = (count / totalStatusCount) * 100;
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-neutral-500 flex items-center gap-1">
                        {renderStatusBadge(status)}
                      </span>
                      <span className="text-white font-medium">{count}</span>
                    </div>
                    <div className="w-full bg-gray-900 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(pct, count > 0 ? 5 : 0)}%`,
                          backgroundColor: status === 'completed' ? '#39FF14' :
                            status === 'pending' ? '#eab308' :
                            status === 'scheduled' ? '#3b82f6' :
                            status === 'picked_up' ? '#a855f7' :
                            status === 'inspected' ? '#f97316' :
                            '#06b6d4'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pie Chart Visualization */}
            <div className="mt-6 pt-4 border-t border-gray-700">
              <h5 className="text-xs text-neutral-500 mb-3">Distribution</h5>
              <div className="flex items-center justify-center">
                <div className="relative w-32 h-32">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    {(() => {
                      const pieColors: Record<ReturnReason, string> = {
                        unused_materials: '#39FF14',
                        wrong_order: '#f97316',
                        damaged: '#ef4444',
                        customer_request: '#3b82f6',
                        job_complete: '#a78bfa',
                      };
                      const totalItems = Object.values(reasonCounts).reduce((a, b) => a + b, 0) || 1;
                      let accumulated = 0;
                      return (Object.entries(reasonCounts) as [ReturnReason, number][])
                        .filter(([, c]) => c > 0)
                        .map(([reason, count]) => {
                          const pct = (count / totalItems) * 100;
                          const circumference = Math.PI * 2 * 40;
                          const dashLength = (pct / 100) * circumference;
                          const dashOffset = -(accumulated / 100) * circumference;
                          accumulated += pct;
                          return (
                            <circle
                              key={reason}
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke={pieColors[reason]}
                              strokeWidth="20"
                              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                              strokeDashoffset={dashOffset}
                              className="opacity-80"
                            />
                          );
                        });
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-xl font-bold text-white">{totalReturns}</div>
                      <div className="text-[10px] text-neutral-500">Total</div>
                    </div>
                  </div>
                </div>
                <div className="ml-4 space-y-1.5">
                  {(Object.entries(reasonCounts) as [ReturnReason, number][])
                    .filter(([, c]) => c > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([reason, count]) => {
                      const pieColors: Record<ReturnReason, string> = {
                        unused_materials: '#39FF14',
                        wrong_order: '#f97316',
                        damaged: '#ef4444',
                        customer_request: '#3b82f6',
                        job_complete: '#a78bfa',
                      };
                      return (
                        <div key={reason} className="flex items-center gap-2 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pieColors[reason] }} />
                          <span className="text-neutral-500">{REASON_LABELS[reason]}</span>
                          <span className="text-white font-medium ml-auto">{count}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
          <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#39FF14]" />
            Recent Activity
          </h4>
          <div className="space-y-3">
            {tickets.slice(0, 5).map(ticket => (
              <div key={ticket.id} className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[#39FF14]">{ticket.id}</span>
                  <span className="text-sm text-white">{ticket.customerName}</span>
                  {renderStatusBadge(ticket.status)}
                </div>
                <div className="text-xs text-neutral-500">{ticket.createdDate}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---- History Tab ----

  function renderHistory() {
    return (
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Search completed returns..."
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50"
            />
          </div>
          <select
            value={historyReasonFilter}
            onChange={e => setHistoryReasonFilter(e.target.value as ReturnReason | 'all')}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50"
          >
            <option value="all">All Reasons</option>
            {(Object.keys(REASON_LABELS) as ReturnReason[]).map(r => (
              <option key={r} value={r}>{REASON_LABELS[r]}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900/50 border-b border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Ticket</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Reason</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Items</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Value</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Completed</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Driver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {completedTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-neutral-500">
                      No completed returns found
                    </td>
                  </tr>
                ) : (
                  completedTickets.map(ticket => (
                    <tr
                      key={ticket.id}
                      className="hover:bg-white/10 cursor-pointer transition-colors"
                      onClick={() => handleSelectTicket(ticket)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-[#39FF14] text-xs">{ticket.id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white">{ticket.customerName}</div>
                        <div className="text-xs text-neutral-500 truncate max-w-[200px]">{ticket.address}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs ${
                          ticket.returnType === 'return' ? 'text-indigo-400' : 'text-teal-400'
                        }`}>
                          {ticket.returnType === 'return' ? <RotateCcw className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                          {ticket.returnType === 'return' ? 'Return' : 'Pickup'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-400 text-xs">{REASON_LABELS[ticket.reason]}</td>
                      <td className="px-4 py-3 text-neutral-400">{ticket.items.length}</td>
                      <td className="px-4 py-3 text-white font-medium">${ticket.totalEstimatedValue.toFixed(2)}</td>
                      <td className="px-4 py-3 text-neutral-500 text-xs">{ticket.completedDate || '-'}</td>
                      <td className="px-4 py-3 text-neutral-500 text-xs">{ticket.assignedDriver || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ---- Main Render ----

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/portal/delivery"
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-neutral-500" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-[#39FF14]" />
                  Returns & Pickups
                </h1>
                <p className="text-sm text-neutral-500 mt-0.5">Manage material returns, pickups, and restocking</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('create')}
              className="px-4 py-2 bg-[#39FF14] text-black font-medium rounded-lg hover:bg-[#39FF14]/90 transition-colors flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              New Return
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-gray-900/50 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto py-1 -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'border-[#39FF14] text-[#39FF14]'
                    : 'border-transparent text-neutral-500 hover:text-neutral-400 hover:border-gray-600'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                    activeTab === tab.key
                      ? 'bg-[#39FF14]/20 text-[#39FF14]'
                      : 'bg-gray-800 text-neutral-500'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'queue' && renderQueue()}
        {activeTab === 'create' && renderCreate()}
        {activeTab === 'process' && renderProcess()}
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'history' && renderHistory()}
      </main>
    </div>
  );
}
