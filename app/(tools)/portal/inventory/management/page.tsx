'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Package,
  ArrowLeft,
  Search,
  Plus,
  Edit3,
  X,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Save,
  Loader2,
  BarChart2,
  Warehouse,
  DollarSign,
  ClipboardCheck,
  Bell,
  ShoppingCart,
  Tags,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Truck,
  Clock,
  FileText,
  Check,
  Info,
  Minus,
  Eye,
  Download,
  Filter,
} from 'lucide-react';

// ============================================
// TYPES (mirrors service types for client)
// ============================================

type InventoryCategory =
  | 'shingles' | 'underlayment' | 'flashing' | 'gutters' | 'nails_fasteners'
  | 'sealants' | 'lumber' | 'ventilation' | 'accessories' | 'safety_equipment';

interface InventoryItem {
  productId: string;
  productName: string;
  category: InventoryCategory;
  sku: string;
  unit: string;
  currentQty: number;
  minStockLevel: number;
  maxStockLevel: number;
  reorderQty: number;
  unitCost: number;
  unitPrice: number;
  supplier: string;
  supplierPartNumber: string;
  location: string;
  weight: number;
  lastCountDate: string;
  lastCountBy: string;
  lastRestockDate: string;
  notes: string;
}

interface StockAlert {
  productId: string;
  productName: string;
  category: InventoryCategory;
  currentQty: number;
  minStockLevel: number;
  severity: 'warning' | 'critical' | 'out_of_stock';
  daysUntilStockout: number;
  location: string;
  supplier: string;
}

interface CountSession {
  sessionId: string;
  startedAt: string;
  startedBy: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  completedAt?: string;
  totalItems: number;
  countedItems: number;
  discrepancies: number;
  counts: CountRecord[];
}

interface CountRecord {
  productId: string;
  productName: string;
  systemQty: number;
  countedQty: number;
  countedBy: string;
  countedAt: string;
  notes?: string;
  discrepancy: number;
  resolved: boolean;
  resolution?: string;
  adjustedQty?: number;
  resolvedBy?: string;
  resolvedAt?: string;
  reason?: string;
}

interface RestockOrder {
  orderId: string;
  supplier: string;
  status: string;
  items: RestockOrderItem[];
  totalCost: number;
  createdAt: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  orderedAt?: string;
  shippedAt?: string;
  receivedAt?: string;
  expectedDelivery?: string;
  notes?: string;
}

interface RestockOrderItem {
  productId: string;
  productName: string;
  sku: string;
  orderQty: number;
  unitCost: number;
  totalCost: number;
  receivedQty?: number;
  receivedAt?: string;
}

interface PricingReport {
  productId: string;
  productName: string;
  category: InventoryCategory;
  unitCost: number;
  unitPrice: number;
  markup: number;
  marginPercent: number;
  flag?: 'negative_margin' | 'low_markup' | 'high_markup';
}

interface CategoryMargin {
  category: InventoryCategory;
  itemCount: number;
  avgCost: number;
  avgPrice: number;
  avgMarkup: number;
  avgMarginPercent: number;
  totalCostValue: number;
  totalRetailValue: number;
}

interface CategoryBreakdown {
  category: InventoryCategory;
  label: string;
  itemCount: number;
  totalQty: number;
  totalCostValue: number;
  totalRetailValue: number;
}

interface ActivityItem {
  type: string;
  description: string;
  timestamp: string;
  by: string;
}

interface RestockSuggestion {
  productId: string;
  productName: string;
  currentQty: number;
  minStockLevel: number;
  suggestedQty: number;
  supplier: string;
  estimatedCost: number;
}

// ============================================
// CONSTANTS
// ============================================

const CATEGORY_LABELS: Record<InventoryCategory, string> = {
  shingles: 'Shingles',
  underlayment: 'Underlayment',
  flashing: 'Flashing',
  gutters: 'Gutters',
  nails_fasteners: 'Nails & Fasteners',
  sealants: 'Sealants',
  lumber: 'Lumber',
  ventilation: 'Ventilation',
  accessories: 'Accessories',
  safety_equipment: 'Safety Equipment',
};

const API_BASE = '/api/portal/inventory/management';

type Tab = 'dashboard' | 'count' | 'alerts' | 'restock' | 'pricing';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <BarChart2 className="w-4 h-4" /> },
  { id: 'count', label: 'Weekly Count', icon: <ClipboardCheck className="w-4 h-4" /> },
  { id: 'alerts', label: 'Low Stock & Alerts', icon: <Bell className="w-4 h-4" /> },
  { id: 'restock', label: 'Restock Portal', icon: <ShoppingCart className="w-4 h-4" /> },
  { id: 'pricing', label: 'Pricing & Margins', icon: <Tags className="w-4 h-4" /> },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(val: number): string {
  return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'out_of_stock': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'critical': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'warning': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    default: return 'bg-zinc-800 text-zinc-400';
  }
}

function severityBadge(severity: string): string {
  switch (severity) {
    case 'out_of_stock': return 'bg-red-500/20 text-red-400';
    case 'critical': return 'bg-amber-500/20 text-amber-400';
    case 'warning': return 'bg-yellow-500/20 text-yellow-400';
    default: return 'bg-zinc-700 text-zinc-400';
  }
}

function orderStatusColor(status: string): string {
  switch (status) {
    case 'draft': return 'bg-zinc-700 text-zinc-300';
    case 'submitted': return 'bg-brand-green/20 text-blue-400';
    case 'approved': return 'bg-emerald-500/20 text-emerald-400';
    case 'ordered': return 'bg-cyan-500/20 text-cyan-400';
    case 'shipped': return 'bg-purple-500/20 text-purple-400';
    case 'received': return 'bg-green-500/20 text-green-400';
    case 'cancelled': return 'bg-red-500/20 text-red-400';
    default: return 'bg-zinc-700 text-zinc-300';
  }
}

function activityIcon(type: string) {
  switch (type) {
    case 'count': return <ClipboardCheck className="w-4 h-4 text-blue-400" />;
    case 'restock': return <Truck className="w-4 h-4 text-emerald-400" />;
    case 'alert': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    case 'pricing': return <DollarSign className="w-4 h-4 text-purple-400" />;
    default: return <Info className="w-4 h-4 text-zinc-400" />;
  }
}

// Mini CSS sparkline from array of numbers
function MiniSparkline({ data, color = '#39FF14' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function InventoryManagementPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Dashboard Data ---
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [categories, setCategories] = useState<CategoryBreakdown[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [inventoryValue, setInventoryValue] = useState({ totalCost: 0, totalRetail: 0, itemCount: 0 });

  // --- Count Data ---
  const [activeCountSession, setActiveCountSession] = useState<CountSession | null>(null);
  const [countHistory, setCountHistory] = useState<CountSession[]>([]);
  const [countInputs, setCountInputs] = useState<Record<string, { qty: string; notes: string }>>({});
  const [countSearch, setCountSearch] = useState('');
  const [countCategoryFilter, setCountCategoryFilter] = useState('all');
  const [submittingCount, setSubmittingCount] = useState(false);
  const [resolveModal, setResolveModal] = useState<CountRecord | null>(null);
  const [resolveForm, setResolveForm] = useState({ resolution: 'adjust_system', adjustedQty: 0, reason: 'miscount' });

  // --- Alert Data ---
  const [alertSearch, setAlertSearch] = useState('');
  const [trendData, setTrendData] = useState<Record<string, number[]>>({});

  // --- Restock Data ---
  const [restockOrders, setRestockOrders] = useState<RestockOrder[]>([]);
  const [suggestions, setSuggestions] = useState<RestockSuggestion[]>([]);
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [poItems, setPoItems] = useState<{ productId: string; orderQty: number }[]>([]);
  const [poSupplier, setPoSupplier] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [restockStatusFilter, setRestockStatusFilter] = useState('all');
  const [receiveModal, setReceiveModal] = useState<RestockOrder | null>(null);
  const [receiveInputs, setReceiveInputs] = useState<Record<string, string>>({});
  const [receiveCostInputs, setReceiveCostInputs] = useState<Record<string, string>>({});
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // --- Pricing Data ---
  const [pricingReport, setPricingReport] = useState<PricingReport[]>([]);
  const [pricingIssues, setPricingIssues] = useState<PricingReport[]>([]);
  const [marginData, setMarginData] = useState<CategoryMargin[]>([]);
  const [pricingSearch, setPricingSearch] = useState('');
  const [editPricing, setEditPricing] = useState<{ productId: string; cost: string; price: string; reason: string } | null>(null);
  const [bulkAdjust, setBulkAdjust] = useState<{ category: string; percent: string; type: 'cost' | 'price' | 'both' } | null>(null);
  const [pricingHistoryModal, setPricingHistoryModal] = useState<{ productId: string; history: any[] } | null>(null);
  const [pricingSortField, setPricingSortField] = useState<'productName' | 'markup' | 'marginPercent' | 'unitCost' | 'unitPrice'>('productName');
  const [pricingSortDir, setPricingSortDir] = useState<'asc' | 'desc'>('asc');

  // General
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, alertsRes, catRes, actRes, valRes] = await Promise.all([
        fetch(API_BASE),
        fetch(`${API_BASE}?view=alerts`),
        fetch(`${API_BASE}?view=category-breakdown`),
        fetch(`${API_BASE}?view=activity`),
        fetch(`${API_BASE}?view=inventory-value`),
      ]);

      const invData = await invRes.json();
      const alertsData = await alertsRes.json();
      const catData = await catRes.json();
      const actData = await actRes.json();
      const valData = await valRes.json();

      setInventory(invData.inventory || []);
      setAlerts(alertsData.alerts || []);
      setCategories(catData.categories || []);
      setActivity(actData.activity || []);
      setInventoryValue(valData);
    } catch (err) {
      setError('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCountData = useCallback(async () => {
    try {
      const [activeRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}?view=active-count`),
        fetch(`${API_BASE}?view=count-history`),
      ]);
      const activeData = await activeRes.json();
      const historyData = await historyRes.json();
      setActiveCountSession(activeData.session || null);
      setCountHistory(historyData.sessions || []);
    } catch (err) {
      console.error('Failed to fetch count data');
    }
  }, []);

  const fetchRestockData = useCallback(async () => {
    try {
      const [ordersRes, suggestRes] = await Promise.all([
        fetch(`${API_BASE}?view=restock-orders`),
        fetch(`${API_BASE}?view=suggestions`),
      ]);
      const ordersData = await ordersRes.json();
      const suggestData = await suggestRes.json();
      setRestockOrders(ordersData.orders || []);
      setSuggestions(suggestData.suggestions || []);
    } catch (err) {
      console.error('Failed to fetch restock data');
    }
  }, []);

  const fetchPricingData = useCallback(async () => {
    try {
      const [reportRes, issuesRes, marginsRes] = await Promise.all([
        fetch(`${API_BASE}?view=pricing-report`),
        fetch(`${API_BASE}?view=pricing-issues`),
        fetch(`${API_BASE}?view=margins`),
      ]);
      const reportData = await reportRes.json();
      const issuesData = await issuesRes.json();
      const marginsData = await marginsRes.json();
      setPricingReport(reportData.report || []);
      setPricingIssues(issuesData.issues || []);
      setMarginData(marginsData.margins || []);
    } catch (err) {
      console.error('Failed to fetch pricing data');
    }
  }, []);

  const fetchTrendForItem = useCallback(async (productId: string) => {
    try {
      const res = await fetch(`${API_BASE}?view=stock-trend&productId=${productId}&days=14`);
      const data = await res.json();
      if (data.trend) {
        setTrendData(prev => ({ ...prev, [productId]: data.trend.map((t: any) => t.qty) }));
      }
    } catch (err) {
      // Silently fail for trend data
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === 'count') fetchCountData();
    if (activeTab === 'restock') fetchRestockData();
    if (activeTab === 'pricing') fetchPricingData();
  }, [activeTab, fetchCountData, fetchRestockData, fetchPricingData]);

  // Fetch trends for alert items
  useEffect(() => {
    if (activeTab === 'alerts' && alerts.length > 0) {
      alerts.forEach(a => {
        if (!trendData[a.productId]) fetchTrendForItem(a.productId);
      });
    }
  }, [activeTab, alerts, trendData, fetchTrendForItem]);

  // ============================================
  // API ACTIONS
  // ============================================

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), type === 'warning' ? 6000 : 3000);
  };

  const apiPost = async (body: any) => {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const startCount = async () => {
    setActionLoading(true);
    try {
      const data = await apiPost({ action: 'start-count', countedBy: 'Admin' });
      if (data.success) {
        setActiveCountSession(data.session);
        showToast('Weekly count session started');
        await fetchCountData();
      } else {
        showToast(data.error || 'Failed to start count', 'error');
      }
    } catch { showToast('Error starting count', 'error'); }
    finally { setActionLoading(false); }
  };

  const submitCountRecord = async (productId: string) => {
    const input = countInputs[productId];
    if (!input || input.qty === '') return;
    setSubmittingCount(true);
    try {
      const data = await apiPost({
        action: 'record-count',
        productId,
        countedQty: parseInt(input.qty),
        countedBy: 'Admin',
        notes: input.notes || undefined,
      });
      if (data.success) {
        showToast(`Count recorded for ${productId}`);
        await fetchCountData();
        // Clear input
        setCountInputs(prev => {
          const next = { ...prev };
          delete next[productId];
          return next;
        });
      } else {
        showToast(data.error || 'Failed to record count', 'error');
      }
    } catch { showToast('Error recording count', 'error'); }
    finally { setSubmittingCount(false); }
  };

  const submitResolveDiscrepancy = async () => {
    if (!resolveModal) return;
    setActionLoading(true);
    try {
      const data = await apiPost({
        action: 'resolve-discrepancy',
        productId: resolveModal.productId,
        resolution: resolveForm.resolution,
        adjustedQty: resolveForm.adjustedQty,
        reason: resolveForm.reason,
      });
      if (data.success) {
        showToast('Discrepancy resolved');
        setResolveModal(null);
        await fetchCountData();
        await fetchData();
      } else {
        showToast(data.error || 'Failed to resolve', 'error');
      }
    } catch { showToast('Error resolving discrepancy', 'error'); }
    finally { setActionLoading(false); }
  };

  const createRestockOrder = async () => {
    if (poItems.length === 0) return;
    setActionLoading(true);
    try {
      const data = await apiPost({
        action: 'create-restock-order',
        items: poItems,
        supplier: poSupplier || undefined,
        notes: poNotes || undefined,
      });
      if (data.success) {
        showToast(`PO ${data.order.orderId} created`);
        setShowCreatePO(false);
        setPoItems([]);
        setPoSupplier('');
        setPoNotes('');
        await fetchRestockData();
      } else {
        showToast(data.error || 'Failed to create PO', 'error');
      }
    } catch { showToast('Error creating PO', 'error'); }
    finally { setActionLoading(false); }
  };

  const approveOrder = async (orderId: string) => {
    setActionLoading(true);
    try {
      const data = await apiPost({ action: 'approve-restock', orderId });
      if (data.success) {
        showToast(`PO ${orderId} approved`);
        await fetchRestockData();
      } else {
        showToast(data.error || 'Failed to approve', 'error');
      }
    } catch { showToast('Error approving order', 'error'); }
    finally { setActionLoading(false); }
  };

  const receiveOrder = async (orderId: string) => {
    if (!receiveModal) return;
    setActionLoading(true);
    const receivedItems = receiveModal.items.map(item => {
      const costRaw = receiveCostInputs[item.productId];
      const parsedCost = costRaw && costRaw.trim() !== '' ? parseFloat(costRaw) : NaN;
      return {
        productId: item.productId,
        receivedQty: parseInt(receiveInputs[item.productId] || String(item.orderQty)),
        // Only include actualUnitCost when the receiver entered one. Blank
        // means "trust the quoted cost" — no PricingRecord written.
        ...(Number.isFinite(parsedCost) ? { actualUnitCost: parsedCost } : {}),
      };
    });
    try {
      const data = await apiPost({
        action: 'receive-and-verify-restock',
        orderId,
        receivedItems,
      });
      if (data.success) {
        const discrepancies = (data.discrepancies || []) as Array<{
          productName: string;
          countMatchesOrder?: boolean;
          costMatchesQuote?: boolean;
        }>;
        if (discrepancies.length > 0) {
          const lines = discrepancies.map(d => {
            const issues: string[] = [];
            if (d.countMatchesOrder === false) issues.push('qty');
            if (d.costMatchesQuote === false) issues.push('cost');
            return `${d.productName} (${issues.join(' + ')})`;
          });
          showToast(`PO ${orderId} received with discrepancies: ${lines.join('; ')}`, 'warning');
        } else {
          showToast(`PO ${orderId} received — counts and costs verified`);
        }
        setReceiveModal(null);
        setReceiveInputs({});
        setReceiveCostInputs({});
        await fetchRestockData();
        await fetchData();
      } else {
        showToast(data.error || 'Failed to receive', 'error');
      }
    } catch { showToast('Error receiving order', 'error'); }
    finally { setActionLoading(false); }
  };

  const savePricing = async () => {
    if (!editPricing) return;
    setActionLoading(true);
    try {
      const data = await apiPost({
        action: 'update-pricing',
        productId: editPricing.productId,
        newCost: parseFloat(editPricing.cost),
        newPrice: parseFloat(editPricing.price),
        reason: editPricing.reason || undefined,
      });
      if (data.success) {
        showToast('Pricing updated');
        setEditPricing(null);
        await fetchPricingData();
        await fetchData();
      } else {
        showToast(data.error || 'Failed to update pricing', 'error');
      }
    } catch { showToast('Error updating pricing', 'error'); }
    finally { setActionLoading(false); }
  };

  const addToPO = (productId: string, qty: number) => {
    setPoItems(prev => {
      const existing = prev.find(i => i.productId === productId);
      if (existing) {
        return prev.map(i => i.productId === productId ? { ...i, orderQty: qty } : i);
      }
      return [...prev, { productId, orderQty: qty }];
    });
    if (!showCreatePO) setShowCreatePO(true);
    setActiveTab('restock');
  };

  const restockAllCritical = () => {
    const criticalItems = alerts.filter(a => a.severity === 'out_of_stock' || a.severity === 'critical');
    const items = criticalItems.map(a => {
      const inv = inventory.find(i => i.productId === a.productId);
      return { productId: a.productId, orderQty: inv?.reorderQty || 10 };
    });
    setPoItems(items);
    if (items.length > 0 && criticalItems.length > 0) {
      setPoSupplier('');
    }
    setShowCreatePO(true);
    setActiveTab('restock');
  };

  const fetchPricingHistory = async (productId: string) => {
    try {
      const res = await fetch(`${API_BASE}?view=pricing-history&productId=${productId}`);
      const data = await res.json();
      setPricingHistoryModal({ productId, history: data.history || [] });
    } catch {
      showToast('Error fetching pricing history', 'error');
    }
  };

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const lowStockCount = useMemo(() => inventory.filter(i => i.currentQty <= i.minStockLevel && i.currentQty > 0).length, [inventory]);
  const outOfStockCount = useMemo(() => inventory.filter(i => i.currentQty === 0).length, [inventory]);

  const countItems = useMemo(() => {
    let items = [...inventory];
    if (countSearch) {
      const q = countSearch.toLowerCase();
      items = items.filter(i => i.productName.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q) || i.productId.toLowerCase().includes(q));
    }
    if (countCategoryFilter !== 'all') {
      items = items.filter(i => i.category === countCategoryFilter);
    }
    // Sort by location
    return items.sort((a, b) => a.location.localeCompare(b.location));
  }, [inventory, countSearch, countCategoryFilter]);

  const filteredAlerts = useMemo(() => {
    if (!alertSearch) return alerts;
    const q = alertSearch.toLowerCase();
    return alerts.filter(a => a.productName.toLowerCase().includes(q) || a.productId.toLowerCase().includes(q));
  }, [alerts, alertSearch]);

  const filteredOrders = useMemo(() => {
    if (restockStatusFilter === 'all') return restockOrders;
    return restockOrders.filter(o => o.status === restockStatusFilter);
  }, [restockOrders, restockStatusFilter]);

  const sortedPricingReport = useMemo(() => {
    let items = [...pricingReport];
    if (pricingSearch) {
      const q = pricingSearch.toLowerCase();
      items = items.filter(i => i.productName.toLowerCase().includes(q) || i.productId.toLowerCase().includes(q) || CATEGORY_LABELS[i.category].toLowerCase().includes(q));
    }
    items.sort((a, b) => {
      const aVal = a[pricingSortField];
      const bVal = b[pricingSortField];
      if (typeof aVal === 'string') return pricingSortDir === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      return pricingSortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return items;
  }, [pricingReport, pricingSearch, pricingSortField, pricingSortDir]);

  const countProgress = useMemo(() => {
    if (!activeCountSession) return null;
    const total = activeCountSession.totalItems;
    const counted = activeCountSession.counts?.length || 0;
    return { total, counted, percent: total > 0 ? Math.round((counted / total) * 100) : 0 };
  }, [activeCountSession]);

  const activeDiscrepancies = useMemo(() => {
    if (!activeCountSession) return [];
    return activeCountSession.counts?.filter(c => c.discrepancy !== 0 && !c.resolved) || [];
  }, [activeCountSession]);

  // ============================================
  // RENDER HELPERS
  // ============================================

  const maxCatValue = useMemo(() => Math.max(...categories.map(c => c.totalRetailValue), 1), [categories]);

  // ============================================
  // LOADING / ERROR
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#39FF14] mx-auto mb-3" />
          <p className="text-zinc-400">Loading inventory management...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border max-w-md ${
          toast.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
          toast.type === 'warning' ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' :
          'bg-red-500/20 border-red-500/30 text-red-400'
        }`}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span className="text-sm">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/portal/inventory" className="text-zinc-400 hover:text-white transition">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <Warehouse className="w-6 h-6 text-[#39FF14]" />
              <div>
                <h1 className="text-xl font-bold">Inventory Management</h1>
                <p className="text-xs text-zinc-500">{inventoryValue.itemCount} SKUs | {formatCurrency(inventoryValue.totalCost)} cost value</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/portal/inventory/reconciliation"
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition"
              >
                <CheckCircle className="w-4 h-4 text-[#39FF14]" />
                Reconciliation
              </Link>
              <button
                onClick={() => { fetchData(); fetchCountData(); fetchRestockData(); fetchPricingData(); }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 overflow-x-auto pb-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm rounded-t-lg whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? 'bg-zinc-800 text-[#39FF14] border-b-2 border-[#39FF14]'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.id === 'alerts' && alerts.length > 0 && (
                  <span className="bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 rounded-full">{alerts.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* ============================================ */}
        {/* TAB 1: DASHBOARD */}
        {/* ============================================ */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-400 text-sm">Total SKUs</span>
                  <Package className="w-5 h-5 text-[#39FF14]" />
                </div>
                <p className="text-2xl font-bold">{inventoryValue.itemCount}</p>
                <p className="text-xs text-zinc-500 mt-1">{categories.length} categories</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-400 text-sm">Total Value (Cost)</span>
                  <DollarSign className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-2xl font-bold">{formatCurrency(inventoryValue.totalCost)}</p>
                <p className="text-xs text-zinc-500 mt-1">Retail: {formatCurrency(inventoryValue.totalRetail)}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-400 text-sm">Low Stock Items</span>
                  <TrendingDown className="w-5 h-5 text-amber-400" />
                </div>
                <p className="text-2xl font-bold text-amber-400">{lowStockCount}</p>
                <p className="text-xs text-zinc-500 mt-1">Below minimum level</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-400 text-sm">Out of Stock</span>
                  <AlertOctagon className="w-5 h-5 text-red-400" />
                </div>
                <p className="text-2xl font-bold text-red-400">{outOfStockCount}</p>
                <p className="text-xs text-zinc-500 mt-1">Zero quantity</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Category Breakdown Chart */}
              <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4">Category Breakdown (Retail Value)</h3>
                <div className="space-y-3">
                  {categories.map(cat => (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-zinc-400">{cat.label} ({cat.itemCount})</span>
                        <span className="text-zinc-300">{formatCurrency(cat.totalRetailValue)}</span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-3">
                        <div
                          className="bg-[#39FF14]/70 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${(cat.totalRetailValue / maxCatValue) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Low Stock Alerts Panel */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-zinc-300">Stock Alerts</h3>
                  <button onClick={() => setActiveTab('alerts')} className="text-xs text-[#39FF14] hover:underline">View All</button>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {alerts.slice(0, 8).map(alert => (
                    <div key={alert.productId} className={`p-2.5 rounded-lg border ${severityColor(alert.severity)}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium truncate mr-2">{alert.productName}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${severityBadge(alert.severity)}`}>
                          {alert.severity === 'out_of_stock' ? 'OOS' : alert.severity === 'critical' ? 'CRIT' : 'LOW'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs opacity-70">Qty: {alert.currentQty} / {alert.minStockLevel} min</span>
                        {alert.daysUntilStockout > 0 && (
                          <span className="text-xs opacity-70">{alert.daysUntilStockout}d left</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {alerts.length === 0 && (
                    <p className="text-sm text-zinc-500 text-center py-4">All stock levels healthy</p>
                  )}
                </div>
              </div>
            </div>

            {/* Activity Feed + Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Activity Feed */}
              <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {activity.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 py-2 border-b border-zinc-800 last:border-0">
                      <div className="mt-0.5">{activityIcon(item.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-300">{item.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-zinc-500">{formatDateTime(item.timestamp)}</span>
                          <span className="text-xs text-zinc-600">by {item.by}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => { setActiveTab('count'); setTimeout(startCount, 100); }}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition text-left"
                  >
                    <ClipboardCheck className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-sm font-medium">Start Weekly Count</p>
                      <p className="text-xs text-zinc-500">Begin inventory count session</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('alerts')}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition text-left"
                  >
                    <Bell className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="text-sm font-medium">View Alerts ({alerts.length})</p>
                      <p className="text-xs text-zinc-500">Check stock warnings</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { setShowCreatePO(true); setActiveTab('restock'); }}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition text-left"
                  >
                    <ShoppingCart className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="text-sm font-medium">Create Purchase Order</p>
                      <p className="text-xs text-zinc-500">Order new stock</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('pricing')}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition text-left"
                  >
                    <Tags className="w-5 h-5 text-purple-400" />
                    <div>
                      <p className="text-sm font-medium">Pricing Review</p>
                      <p className="text-xs text-zinc-500">{pricingIssues.length} issues found</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* TAB 2: WEEKLY COUNT */}
        {/* ============================================ */}
        {activeTab === 'count' && (
          <div className="space-y-6">
            {/* Count Session Controls */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-300">
                    {activeCountSession ? `Active Count: ${activeCountSession.sessionId}` : 'No Active Count Session'}
                  </h3>
                  {activeCountSession && (
                    <p className="text-xs text-zinc-500 mt-1">
                      Started by {activeCountSession.startedBy} at {formatDateTime(activeCountSession.startedAt)}
                    </p>
                  )}
                </div>
                {!activeCountSession && (
                  <button
                    onClick={startCount}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 transition disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                    Start New Count
                  </button>
                )}
              </div>

              {/* Progress Bar */}
              {countProgress && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                    <span>{countProgress.counted} of {countProgress.total} items counted</span>
                    <span>{countProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2.5">
                    <div
                      className="bg-[#39FF14] h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${countProgress.percent}%` }}
                    />
                  </div>
                  {activeDiscrepancies.length > 0 && (
                    <p className="text-xs text-amber-400 mt-2">
                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                      {activeDiscrepancies.length} unresolved discrepancies
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Discrepancy Resolution Panel */}
            {activeDiscrepancies.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-amber-400 mb-3">Unresolved Discrepancies</h3>
                <div className="space-y-2">
                  {activeDiscrepancies.map(rec => (
                    <div key={rec.productId} className="flex items-center justify-between bg-zinc-900/50 rounded-lg p-3">
                      <div>
                        <p className="text-sm text-zinc-300">{rec.productName}</p>
                        <p className="text-xs text-zinc-500">
                          System: {rec.systemQty} | Counted: {rec.countedQty} |
                          <span className={rec.discrepancy < 0 ? ' text-red-400' : ' text-amber-400'}> Diff: {rec.discrepancy > 0 ? '+' : ''}{rec.discrepancy}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setResolveModal(rec);
                          setResolveForm({ resolution: 'adjust_system', adjustedQty: rec.countedQty, reason: 'miscount' });
                        }}
                        className="px-3 py-1.5 text-xs bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition"
                      >
                        Resolve
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Count List - filters */}
            {activeCountSession && (
              <>
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Search items..."
                      value={countSearch}
                      onChange={e => setCountSearch(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-[#39FF14]/50"
                    />
                  </div>
                  <select
                    value={countCategoryFilter}
                    onChange={e => setCountCategoryFilter(e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]/50"
                  >
                    <option value="all">All Categories</option>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Count Grid */}
                <div className="space-y-1">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs text-zinc-500 font-medium">
                    <div className="col-span-3">Product</div>
                    <div className="col-span-2">SKU / Location</div>
                    <div className="col-span-1 text-center">System Qty</div>
                    <div className="col-span-2 text-center">Counted Qty</div>
                    <div className="col-span-2">Notes</div>
                    <div className="col-span-2 text-center">Action</div>
                  </div>

                  {countItems.map(item => {
                    const countRecord = activeCountSession?.counts?.find(c => c.productId === item.productId);
                    const input = countInputs[item.productId];
                    const isCounted = !!countRecord;
                    const hasDiscrepancy = countRecord && countRecord.discrepancy !== 0;

                    return (
                      <div
                        key={item.productId}
                        className={`grid grid-cols-12 gap-2 px-4 py-2.5 rounded-lg text-sm items-center ${
                          isCounted && hasDiscrepancy && !countRecord.resolved
                            ? countRecord.discrepancy < 0 ? 'bg-red-500/10 border border-red-500/20' : 'bg-amber-500/10 border border-amber-500/20'
                            : isCounted ? 'bg-emerald-500/5 border border-emerald-500/10' : 'bg-zinc-900 border border-zinc-800'
                        }`}
                      >
                        <div className="col-span-3">
                          <p className="text-zinc-200 truncate">{item.productName}</p>
                          <p className="text-xs text-zinc-500">{CATEGORY_LABELS[item.category]}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-zinc-400">{item.sku}</p>
                          <p className="text-xs text-zinc-500">{item.location}</p>
                        </div>
                        <div className="col-span-1 text-center">
                          <span className="text-zinc-300 font-medium">{item.currentQty}</span>
                          <span className="text-xs text-zinc-600 ml-1">{item.unit}</span>
                        </div>
                        <div className="col-span-2 text-center">
                          {isCounted ? (
                            <div className="flex items-center justify-center gap-1">
                              <span className={`font-medium ${hasDiscrepancy ? (countRecord.discrepancy < 0 ? 'text-red-400' : 'text-amber-400') : 'text-emerald-400'}`}>
                                {countRecord.countedQty}
                              </span>
                              {hasDiscrepancy && (
                                <span className={`text-xs ${countRecord.discrepancy < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                                  ({countRecord.discrepancy > 0 ? '+' : ''}{countRecord.discrepancy})
                                </span>
                              )}
                              {isCounted && !hasDiscrepancy && <CheckCircle className="w-3 h-3 text-emerald-400" />}
                            </div>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              placeholder="Qty"
                              value={input?.qty || ''}
                              onChange={e => setCountInputs(prev => ({ ...prev, [item.productId]: { ...prev[item.productId], qty: e.target.value, notes: prev[item.productId]?.notes || '' } }))}
                              className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-[#39FF14]/50"
                            />
                          )}
                        </div>
                        <div className="col-span-2">
                          {isCounted ? (
                            <span className="text-xs text-zinc-500">{countRecord.notes || '-'}</span>
                          ) : (
                            <input
                              type="text"
                              placeholder="Notes"
                              value={input?.notes || ''}
                              onChange={e => setCountInputs(prev => ({ ...prev, [item.productId]: { ...prev[item.productId], qty: prev[item.productId]?.qty || '', notes: e.target.value } }))}
                              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-[#39FF14]/50"
                            />
                          )}
                        </div>
                        <div className="col-span-2 text-center">
                          {isCounted ? (
                            <span className="text-xs text-emerald-400">Counted</span>
                          ) : (
                            <button
                              onClick={() => submitCountRecord(item.productId)}
                              disabled={submittingCount || !input?.qty}
                              className="px-3 py-1 text-xs bg-[#39FF14]/20 text-[#39FF14] rounded hover:bg-[#39FF14]/30 transition disabled:opacity-30"
                            >
                              {submittingCount ? '...' : 'Submit'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Count History */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-zinc-300 mb-4">Count History</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-zinc-500 border-b border-zinc-800">
                      <th className="text-left py-2 px-3">Session ID</th>
                      <th className="text-left py-2 px-3">Date</th>
                      <th className="text-left py-2 px-3">Started By</th>
                      <th className="text-center py-2 px-3">Items</th>
                      <th className="text-center py-2 px-3">Discrepancies</th>
                      <th className="text-center py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countHistory.map(session => (
                      <tr key={session.sessionId} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="py-2.5 px-3 text-zinc-300 font-mono text-xs">{session.sessionId}</td>
                        <td className="py-2.5 px-3 text-zinc-400">{formatDate(session.startedAt)}</td>
                        <td className="py-2.5 px-3 text-zinc-400">{session.startedBy}</td>
                        <td className="py-2.5 px-3 text-center text-zinc-300">{session.countedItems}/{session.totalItems}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={session.discrepancies > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                            {session.discrepancies}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            session.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                            session.status === 'in_progress' ? 'bg-brand-green/20 text-blue-400' :
                            'bg-zinc-700 text-zinc-400'
                          }`}>
                            {session.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Resolve Discrepancy Modal */}
            {resolveModal && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-md w-full p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Resolve Discrepancy</h3>
                    <button onClick={() => setResolveModal(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-zinc-800 rounded-lg p-3">
                      <p className="text-sm text-zinc-300">{resolveModal.productName}</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        System: {resolveModal.systemQty} | Counted: {resolveModal.countedQty} | Diff: {resolveModal.discrepancy > 0 ? '+' : ''}{resolveModal.discrepancy}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Resolution</label>
                      <select
                        value={resolveForm.resolution}
                        onChange={e => setResolveForm(f => ({ ...f, resolution: e.target.value }))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]/50"
                      >
                        <option value="adjust_system">Adjust System to Match Count</option>
                        <option value="recount">Request Recount</option>
                        <option value="write_off">Write Off</option>
                        <option value="no_action">No Action</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Adjusted Quantity</label>
                      <input
                        type="number"
                        min="0"
                        value={resolveForm.adjustedQty}
                        onChange={e => setResolveForm(f => ({ ...f, adjustedQty: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Reason</label>
                      <select
                        value={resolveForm.reason}
                        onChange={e => setResolveForm(f => ({ ...f, reason: e.target.value }))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]/50"
                      >
                        <option value="damaged">Damaged</option>
                        <option value="miscount">Miscount</option>
                        <option value="theft">Theft/Shrinkage</option>
                        <option value="received_not_logged">Received Not Logged</option>
                        <option value="used_not_logged">Used Not Logged</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setResolveModal(null)}
                        className="flex-1 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={submitResolveDiscrepancy}
                        disabled={actionLoading}
                        className="flex-1 px-4 py-2 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 transition disabled:opacity-50"
                      >
                        {actionLoading ? 'Saving...' : 'Resolve'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* TAB 3: LOW STOCK & ALERTS */}
        {/* ============================================ */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            {/* Search + Bulk Action */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search alerts..."
                  value={alertSearch}
                  onChange={e => setAlertSearch(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-[#39FF14]/50"
                />
              </div>
              {alerts.filter(a => a.severity === 'critical' || a.severity === 'out_of_stock').length > 0 && (
                <button
                  onClick={restockAllCritical}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition text-sm"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Restock All Critical ({alerts.filter(a => a.severity === 'critical' || a.severity === 'out_of_stock').length})
                </button>
              )}
            </div>

            {/* Alert Cards */}
            <div className="space-y-3">
              {filteredAlerts.map(alert => (
                <div key={alert.productId} className={`border rounded-xl p-4 ${severityColor(alert.severity)}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${severityBadge(alert.severity)}`}>
                          {alert.severity === 'out_of_stock' ? 'OUT OF STOCK' : alert.severity === 'critical' ? 'CRITICAL' : 'WARNING'}
                        </span>
                        <span className="text-xs opacity-60">{alert.productId}</span>
                      </div>
                      <h4 className="font-medium text-sm">{alert.productName}</h4>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs opacity-80">
                        <span>Current: <strong>{alert.currentQty}</strong></span>
                        <span>Min Level: <strong>{alert.minStockLevel}</strong></span>
                        {alert.daysUntilStockout > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            ~{alert.daysUntilStockout} days until stockout
                          </span>
                        )}
                        <span>{CATEGORY_LABELS[alert.category]}</span>
                        <span>{alert.location}</span>
                        <span>{alert.supplier}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {/* Sparkline */}
                      {trendData[alert.productId] && (
                        <MiniSparkline
                          data={trendData[alert.productId]}
                          color={alert.severity === 'out_of_stock' ? '#ef4444' : alert.severity === 'critical' ? '#f59e0b' : '#eab308'}
                        />
                      )}
                      <button
                        onClick={() => {
                          const inv = inventory.find(i => i.productId === alert.productId);
                          addToPO(alert.productId, inv?.reorderQty || 10);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-900/50 rounded-lg hover:bg-zinc-900 transition"
                      >
                        <ShoppingCart className="w-3 h-3" />
                        Add to PO
                      </button>
                    </div>
                  </div>
                  {/* Stock Level Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs opacity-60 mb-1">
                      <span>0</span>
                      <span>Min: {alert.minStockLevel}</span>
                    </div>
                    <div className="w-full bg-black/20 rounded-full h-2 relative">
                      <div
                        className={`h-2 rounded-full ${
                          alert.severity === 'out_of_stock' ? 'bg-red-500' :
                          alert.severity === 'critical' ? 'bg-amber-500' : 'bg-yellow-500'
                        }`}
                        style={{ width: `${Math.min((alert.currentQty / (alert.minStockLevel * 2)) * 100, 100)}%` }}
                      />
                      {/* Min level marker */}
                      <div
                        className="absolute top-0 h-2 w-0.5 bg-white/40"
                        style={{ left: '50%' }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {filteredAlerts.length === 0 && (
                <div className="text-center py-12 text-zinc-500">
                  <CheckCircle className="w-10 h-10 mx-auto mb-3 text-emerald-400/50" />
                  <p>No stock alerts - all items above minimum levels</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* TAB 4: RESTOCK PORTAL */}
        {/* ============================================ */}
        {activeTab === 'restock' && (
          <div className="space-y-6">
            {/* Create PO Panel */}
            {showCreatePO && (
              <div className="bg-zinc-900 border border-[#39FF14]/30 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-[#39FF14]">Create Purchase Order</h3>
                  <button onClick={() => { setShowCreatePO(false); setPoItems([]); }} className="text-zinc-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Auto-Suggestions */}
                {poItems.length === 0 && suggestions.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-zinc-400 mb-2">Suggested items (low stock):</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.slice(0, 6).map(s => (
                        <button
                          key={s.productId}
                          onClick={() => setPoItems(prev => [...prev, { productId: s.productId, orderQty: s.suggestedQty }])}
                          className="text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 hover:border-[#39FF14]/50 transition"
                        >
                          + {s.productName} ({s.suggestedQty})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* PO Items Table */}
                {poItems.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {poItems.map((poItem, idx) => {
                      const inv = inventory.find(i => i.productId === poItem.productId);
                      return (
                        <div key={idx} className="flex items-center gap-3 bg-zinc-800 rounded-lg p-3">
                          <div className="flex-1">
                            <p className="text-sm text-zinc-300">{inv?.productName || poItem.productId}</p>
                            <p className="text-xs text-zinc-500">{inv?.sku} | {inv?.supplier}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              value={poItem.orderQty}
                              onChange={e => {
                                const val = parseInt(e.target.value) || 1;
                                setPoItems(prev => prev.map((item, i) => i === idx ? { ...item, orderQty: val } : item));
                              }}
                              className="w-20 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-[#39FF14]/50"
                            />
                            <span className="text-xs text-zinc-500">{inv?.unit}</span>
                            <span className="text-xs text-zinc-400 w-20 text-right">{formatCurrency((inv?.unitCost || 0) * poItem.orderQty)}</span>
                            <button onClick={() => setPoItems(prev => prev.filter((_, i) => i !== idx))} className="text-zinc-500 hover:text-red-400">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {/* Add manual item */}
                    <div className="flex gap-2">
                      <select
                        onChange={e => {
                          if (e.target.value) {
                            const inv = inventory.find(i => i.productId === e.target.value);
                            setPoItems(prev => [...prev, { productId: e.target.value, orderQty: inv?.reorderQty || 10 }]);
                            e.target.value = '';
                          }
                        }}
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]/50"
                      >
                        <option value="">+ Add item...</option>
                        {inventory.filter(i => !poItems.find(p => p.productId === i.productId)).map(i => (
                          <option key={i.productId} value={i.productId}>{i.productName} ({i.sku})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Supplier + Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Supplier</label>
                    <input
                      type="text"
                      placeholder="Auto-detected from items"
                      value={poSupplier}
                      onChange={e => setPoSupplier(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Notes</label>
                    <input
                      type="text"
                      placeholder="Optional notes..."
                      value={poNotes}
                      onChange={e => setPoNotes(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]/50"
                    />
                  </div>
                </div>

                {/* Order Summary + Submit */}
                <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
                  <div>
                    <span className="text-sm text-zinc-400">{poItems.length} items</span>
                    <span className="text-lg font-bold text-white ml-3">
                      {formatCurrency(poItems.reduce((sum, p) => {
                        const inv = inventory.find(i => i.productId === p.productId);
                        return sum + (inv?.unitCost || 0) * p.orderQty;
                      }, 0))}
                    </span>
                    <span className="text-xs text-zinc-500 ml-1">estimated</span>
                  </div>
                  <button
                    onClick={createRestockOrder}
                    disabled={actionLoading || poItems.length === 0}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 transition disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    Create PO
                  </button>
                </div>
              </div>
            )}

            {!showCreatePO && (
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-300">Purchase Orders</h3>
                <button
                  onClick={() => setShowCreatePO(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 transition text-sm"
                >
                  <Plus className="w-4 h-4" />
                  New Purchase Order
                </button>
              </div>
            )}

            {/* Status Filter */}
            <div className="flex gap-2 flex-wrap">
              {['all', 'draft', 'submitted', 'approved', 'ordered', 'shipped', 'received', 'cancelled'].map(status => (
                <button
                  key={status}
                  onClick={() => setRestockStatusFilter(status)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition ${
                    restockStatusFilter === status
                      ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>

            {/* Orders List */}
            <div className="space-y-3">
              {filteredOrders.map(order => (
                <div key={order.orderId} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800/50 transition"
                    onClick={() => setExpandedOrder(expandedOrder === order.orderId ? null : order.orderId)}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2.5 py-1 rounded font-medium ${orderStatusColor(order.status)}`}>
                        {order.status.toUpperCase()}
                      </span>
                      <div>
                        <span className="text-sm font-medium text-zinc-200">{order.orderId}</span>
                        <span className="text-xs text-zinc-500 ml-2">{order.supplier}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-zinc-300">{formatCurrency(order.totalCost)}</span>
                      <span className="text-xs text-zinc-500">{order.items.length} items</span>
                      <span className="text-xs text-zinc-500">{formatDate(order.createdAt)}</span>
                      {expandedOrder === order.orderId ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                    </div>
                  </div>

                  {expandedOrder === order.orderId && (
                    <div className="border-t border-zinc-800 p-4 bg-zinc-800/30">
                      {/* Order Details */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-xs">
                        <div>
                          <span className="text-zinc-500">Created By</span>
                          <p className="text-zinc-300">{order.createdBy}</p>
                        </div>
                        {order.approvedBy && (
                          <div>
                            <span className="text-zinc-500">Approved By</span>
                            <p className="text-zinc-300">{order.approvedBy}</p>
                          </div>
                        )}
                        {order.expectedDelivery && (
                          <div>
                            <span className="text-zinc-500">Expected Delivery</span>
                            <p className="text-zinc-300">{formatDate(order.expectedDelivery)}</p>
                          </div>
                        )}
                        {order.notes && (
                          <div>
                            <span className="text-zinc-500">Notes</span>
                            <p className="text-zinc-300">{order.notes}</p>
                          </div>
                        )}
                      </div>

                      {/* Items */}
                      <table className="w-full text-sm mb-4">
                        <thead>
                          <tr className="text-xs text-zinc-500 border-b border-zinc-700">
                            <th className="text-left py-2">Product</th>
                            <th className="text-left py-2">SKU</th>
                            <th className="text-center py-2">Ordered</th>
                            <th className="text-center py-2">Received</th>
                            <th className="text-right py-2">Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items.map(item => (
                            <tr key={item.productId} className="border-b border-zinc-700/50">
                              <td className="py-2 text-zinc-300">{item.productName}</td>
                              <td className="py-2 text-zinc-400 text-xs">{item.sku}</td>
                              <td className="py-2 text-center text-zinc-300">{item.orderQty}</td>
                              <td className="py-2 text-center">
                                {item.receivedQty !== undefined ? (
                                  <span className={item.receivedQty === item.orderQty ? 'text-emerald-400' : 'text-amber-400'}>
                                    {item.receivedQty}
                                  </span>
                                ) : (
                                  <span className="text-zinc-600">-</span>
                                )}
                              </td>
                              <td className="py-2 text-right text-zinc-300">{formatCurrency(item.totalCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {(order.status === 'draft' || order.status === 'submitted') && (
                          <button
                            onClick={() => approveOrder(order.orderId)}
                            disabled={actionLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition"
                          >
                            <Check className="w-3 h-3" />
                            Approve
                          </button>
                        )}
                        {(order.status === 'approved' || order.status === 'shipped') && (
                          <button
                            onClick={() => {
                              setReceiveModal(order);
                              const inputs: Record<string, string> = {};
                              order.items.forEach(i => { inputs[i.productId] = String(i.orderQty); });
                              setReceiveInputs(inputs);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-green/20 text-blue-400 rounded-lg hover:bg-brand-green/30 transition"
                          >
                            <Truck className="w-3 h-3" />
                            Receive Goods
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {filteredOrders.length === 0 && (
                <div className="text-center py-12 text-zinc-500">
                  <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No purchase orders found</p>
                </div>
              )}
            </div>

            {/* Receive Goods Modal */}
            {receiveModal && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-lg w-full p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Receive Goods - {receiveModal.orderId}</h3>
                    <button onClick={() => setReceiveModal(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
                  </div>
                  <p className="text-xs text-zinc-500 mb-4">
                    Enter the actual quantity received and, if different from the quoted unit
                    cost, the supplier-invoiced cost. Leave cost blank to keep the quoted cost.
                  </p>
                  <div className="space-y-3 mb-4">
                    {receiveModal.items.map(item => (
                      <div key={item.productId} className="bg-zinc-800 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-zinc-300">{item.productName}</p>
                          <p className="text-xs text-zinc-500">
                            Ordered: {item.orderQty} @ ${item.unitCost.toFixed(2)}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500 w-16">Received</span>
                            <input
                              type="number"
                              min="0"
                              placeholder={String(item.orderQty)}
                              value={receiveInputs[item.productId] || ''}
                              onChange={e => setReceiveInputs(prev => ({ ...prev, [item.productId]: e.target.value }))}
                              className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#39FF14]/50"
                            />
                          </label>
                          <label className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500 w-16">Cost $</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder={item.unitCost.toFixed(2)}
                              value={receiveCostInputs[item.productId] || ''}
                              onChange={e => setReceiveCostInputs(prev => ({ ...prev, [item.productId]: e.target.value }))}
                              className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#39FF14]/50"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setReceiveModal(null); setReceiveInputs({}); setReceiveCostInputs({}); }} className="flex-1 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition">Cancel</button>
                    <button
                      onClick={() => receiveOrder(receiveModal.orderId)}
                      disabled={actionLoading}
                      className="flex-1 px-4 py-2 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 transition disabled:opacity-50"
                    >
                      {actionLoading ? 'Processing...' : 'Confirm Receipt'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* TAB 5: PRICING & MARGINS */}
        {/* ============================================ */}
        {activeTab === 'pricing' && (
          <div className="space-y-6">
            {/* Pricing Issues */}
            {pricingIssues.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Pricing Issues ({pricingIssues.length})
                </h3>
                <div className="space-y-2">
                  {pricingIssues.map(issue => (
                    <div key={issue.productId} className="flex items-center justify-between bg-zinc-900/50 rounded-lg p-3">
                      <div>
                        <p className="text-sm text-zinc-300">{issue.productName}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs">
                          <span className="text-zinc-500">Cost: {formatCurrency(issue.unitCost)}</span>
                          <span className="text-zinc-500">Price: {formatCurrency(issue.unitPrice)}</span>
                          <span className={`font-medium ${
                            issue.flag === 'negative_margin' ? 'text-red-400' :
                            issue.flag === 'low_markup' ? 'text-amber-400' : 'text-purple-400'
                          }`}>
                            {issue.flag === 'negative_margin' ? 'NEGATIVE MARGIN' :
                             issue.flag === 'low_markup' ? 'LOW MARKUP' : 'HIGH MARKUP'} ({issue.markup}%)
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setEditPricing({ productId: issue.productId, cost: String(issue.unitCost), price: String(issue.unitPrice), reason: '' })}
                        className="px-3 py-1.5 text-xs bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition"
                      >
                        Fix Pricing
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Category Margin Analysis */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-zinc-300 mb-4">Category Margin Analysis</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-zinc-500 border-b border-zinc-800">
                      <th className="text-left py-2 px-2">Category</th>
                      <th className="text-center py-2 px-2">Items</th>
                      <th className="text-right py-2 px-2">Avg Cost</th>
                      <th className="text-right py-2 px-2">Avg Price</th>
                      <th className="text-right py-2 px-2">Avg Markup %</th>
                      <th className="text-right py-2 px-2">Avg Margin %</th>
                      <th className="text-right py-2 px-2">Total Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marginData.map(m => (
                      <tr key={m.category} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="py-2.5 px-2 text-zinc-300">{CATEGORY_LABELS[m.category]}</td>
                        <td className="py-2.5 px-2 text-center text-zinc-400">{m.itemCount}</td>
                        <td className="py-2.5 px-2 text-right text-zinc-400">{formatCurrency(m.avgCost)}</td>
                        <td className="py-2.5 px-2 text-right text-zinc-300">{formatCurrency(m.avgPrice)}</td>
                        <td className="py-2.5 px-2 text-right">
                          <span className={m.avgMarkup < 20 ? 'text-amber-400' : m.avgMarkup > 100 ? 'text-purple-400' : 'text-emerald-400'}>
                            {m.avgMarkup}%
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span className={m.avgMarginPercent < 15 ? 'text-amber-400' : 'text-emerald-400'}>
                            {m.avgMarginPercent}%
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right text-zinc-300">{formatCurrency(m.totalRetailValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Margin Bar Chart */}
              <div className="mt-4 space-y-2">
                {marginData.map(m => (
                  <div key={m.category + '-bar'} className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500 w-28 text-right truncate">{CATEGORY_LABELS[m.category]}</span>
                    <div className="flex-1 bg-zinc-800 rounded-full h-4 relative">
                      <div
                        className={`h-4 rounded-full ${m.avgMarginPercent < 0 ? 'bg-red-500' : m.avgMarginPercent < 20 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(Math.max(m.avgMarginPercent, 0), 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-400 w-12 text-right">{m.avgMarginPercent}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Full Pricing Table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h3 className="text-sm font-semibold text-zinc-300">Full Pricing Table</h3>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={pricingSearch}
                      onChange={e => setPricingSearch(e.target.value)}
                      className="bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-1.5 text-sm focus:outline-none focus:border-[#39FF14]/50 w-48"
                    />
                  </div>
                  <button
                    onClick={() => setBulkAdjust({ category: 'all', percent: '', type: 'both' })}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition"
                  >
                    <Edit3 className="w-3 h-3" />
                    Bulk Adjust
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-zinc-500 border-b border-zinc-800">
                      <th className="text-left py-2 px-2">
                        <button className="hover:text-white" onClick={() => { setPricingSortField('productName'); setPricingSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                          Product {pricingSortField === 'productName' && (pricingSortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />)}
                        </button>
                      </th>
                      <th className="text-left py-2 px-2">Category</th>
                      <th className="text-right py-2 px-2">
                        <button className="hover:text-white" onClick={() => { setPricingSortField('unitCost'); setPricingSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                          Cost {pricingSortField === 'unitCost' && (pricingSortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />)}
                        </button>
                      </th>
                      <th className="text-right py-2 px-2">
                        <button className="hover:text-white" onClick={() => { setPricingSortField('unitPrice'); setPricingSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                          Price {pricingSortField === 'unitPrice' && (pricingSortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />)}
                        </button>
                      </th>
                      <th className="text-right py-2 px-2">
                        <button className="hover:text-white" onClick={() => { setPricingSortField('markup'); setPricingSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                          Markup % {pricingSortField === 'markup' && (pricingSortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />)}
                        </button>
                      </th>
                      <th className="text-right py-2 px-2">
                        <button className="hover:text-white" onClick={() => { setPricingSortField('marginPercent'); setPricingSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                          Margin % {pricingSortField === 'marginPercent' && (pricingSortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />)}
                        </button>
                      </th>
                      <th className="text-center py-2 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPricingReport.map(item => (
                      <tr
                        key={item.productId}
                        className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 ${
                          item.flag === 'negative_margin' ? 'bg-red-500/5' :
                          item.flag === 'low_markup' ? 'bg-amber-500/5' :
                          item.flag === 'high_markup' ? 'bg-purple-500/5' : ''
                        }`}
                      >
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            {item.flag && (
                              <AlertTriangle className={`w-3 h-3 flex-shrink-0 ${
                                item.flag === 'negative_margin' ? 'text-red-400' :
                                item.flag === 'low_markup' ? 'text-amber-400' : 'text-purple-400'
                              }`} />
                            )}
                            <span className="text-zinc-300 truncate">{item.productName}</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-xs text-zinc-500">{CATEGORY_LABELS[item.category]}</td>
                        <td className="py-2 px-2 text-right text-zinc-400">{formatCurrency(item.unitCost)}</td>
                        <td className="py-2 px-2 text-right text-zinc-300">{formatCurrency(item.unitPrice)}</td>
                        <td className="py-2 px-2 text-right">
                          <span className={
                            item.markup < 0 ? 'text-red-400 font-medium' :
                            item.markup < 20 ? 'text-amber-400' :
                            item.markup > 200 ? 'text-purple-400 font-medium' :
                            'text-emerald-400'
                          }>
                            {item.markup}%
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <span className={item.marginPercent < 0 ? 'text-red-400' : item.marginPercent < 15 ? 'text-amber-400' : 'text-emerald-400'}>
                            {item.marginPercent}%
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setEditPricing({ productId: item.productId, cost: String(item.unitCost), price: String(item.unitPrice), reason: '' })}
                              className="p-1 text-zinc-500 hover:text-[#39FF14] transition"
                              title="Edit pricing"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => fetchPricingHistory(item.productId)}
                              className="p-1 text-zinc-500 hover:text-blue-400 transition"
                              title="Price history"
                            >
                              <Clock className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Edit Pricing Modal */}
            {editPricing && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-sm w-full p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Update Pricing</h3>
                    <button onClick={() => setEditPricing(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
                  </div>
                  <p className="text-xs text-zinc-500 mb-4">{editPricing.productId}</p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Unit Cost ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editPricing.cost}
                        onChange={e => setEditPricing(p => p ? { ...p, cost: e.target.value } : null)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Selling Price ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editPricing.price}
                        onChange={e => setEditPricing(p => p ? { ...p, price: e.target.value } : null)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]/50"
                      />
                    </div>
                    {/* Preview margin */}
                    {editPricing.cost && editPricing.price && (
                      <div className="bg-zinc-800 rounded-lg p-3 text-xs">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Markup:</span>
                          <span className={parseFloat(editPricing.price) < parseFloat(editPricing.cost) ? 'text-red-400' : 'text-emerald-400'}>
                            {parseFloat(editPricing.cost) > 0
                              ? (((parseFloat(editPricing.price) - parseFloat(editPricing.cost)) / parseFloat(editPricing.cost)) * 100).toFixed(1)
                              : '0'}%
                          </span>
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-zinc-500">Margin:</span>
                          <span className={parseFloat(editPricing.price) < parseFloat(editPricing.cost) ? 'text-red-400' : 'text-emerald-400'}>
                            {parseFloat(editPricing.price) > 0
                              ? (((parseFloat(editPricing.price) - parseFloat(editPricing.cost)) / parseFloat(editPricing.price)) * 100).toFixed(1)
                              : '0'}%
                          </span>
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Reason (optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Supplier price increase"
                        value={editPricing.reason}
                        onChange={e => setEditPricing(p => p ? { ...p, reason: e.target.value } : null)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]/50"
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => setEditPricing(null)} className="flex-1 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition">Cancel</button>
                      <button
                        onClick={savePricing}
                        disabled={actionLoading}
                        className="flex-1 px-4 py-2 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 transition disabled:opacity-50"
                      >
                        {actionLoading ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Pricing History Modal */}
            {pricingHistoryModal && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-lg w-full p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Price History - {pricingHistoryModal.productId}</h3>
                    <button onClick={() => setPricingHistoryModal(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
                  </div>
                  {pricingHistoryModal.history.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-4">No pricing history available</p>
                  ) : (
                    <div className="space-y-3">
                      {pricingHistoryModal.history.map((h: any, idx: number) => (
                        <div key={idx} className="bg-zinc-800 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-zinc-500">{formatDate(h.date)}</span>
                            <span className="text-xs text-zinc-500">by {h.changedBy}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-zinc-500">Cost: </span>
                              <span className="text-red-400/70 line-through">{formatCurrency(h.oldCost)}</span>
                              <span className="text-emerald-400 ml-1">{formatCurrency(h.newCost)}</span>
                            </div>
                            <div>
                              <span className="text-zinc-500">Price: </span>
                              <span className="text-red-400/70 line-through">{formatCurrency(h.oldPrice)}</span>
                              <span className="text-emerald-400 ml-1">{formatCurrency(h.newPrice)}</span>
                            </div>
                          </div>
                          {h.reason && <p className="text-xs text-zinc-400 mt-1">{h.reason}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setPricingHistoryModal(null)}
                    className="w-full mt-4 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* Bulk Pricing Adjust Modal */}
            {bulkAdjust && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-sm w-full p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Bulk Price Adjustment</h3>
                    <button onClick={() => setBulkAdjust(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Category</label>
                      <select
                        value={bulkAdjust.category}
                        onChange={e => setBulkAdjust(b => b ? { ...b, category: e.target.value } : null)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]/50"
                      >
                        <option value="all">All Categories</option>
                        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Adjust</label>
                      <select
                        value={bulkAdjust.type}
                        onChange={e => setBulkAdjust(b => b ? { ...b, type: e.target.value as any } : null)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]/50"
                      >
                        <option value="both">Both Cost & Price</option>
                        <option value="cost">Cost Only</option>
                        <option value="price">Price Only</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Adjustment % (positive = increase)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 5 for 5% increase"
                        value={bulkAdjust.percent}
                        onChange={e => setBulkAdjust(b => b ? { ...b, percent: e.target.value } : null)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]/50"
                      />
                    </div>
                    <div className="bg-zinc-800 rounded-lg p-3 text-xs text-zinc-400">
                      This will adjust {bulkAdjust.type === 'both' ? 'cost and price' : bulkAdjust.type} by {bulkAdjust.percent || '0'}% for {bulkAdjust.category === 'all' ? 'all items' : CATEGORY_LABELS[bulkAdjust.category as InventoryCategory]}.
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => setBulkAdjust(null)} className="flex-1 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition">Cancel</button>
                      <button
                        onClick={async () => {
                          if (!bulkAdjust.percent) return;
                          const pct = parseFloat(bulkAdjust.percent) / 100;
                          const items = bulkAdjust.category === 'all'
                            ? pricingReport
                            : pricingReport.filter(p => p.category === bulkAdjust.category);
                          setActionLoading(true);
                          for (const item of items) {
                            const newCost = bulkAdjust.type === 'price' ? item.unitCost : Math.round(item.unitCost * (1 + pct) * 100) / 100;
                            const newPrice = bulkAdjust.type === 'cost' ? item.unitPrice : Math.round(item.unitPrice * (1 + pct) * 100) / 100;
                            await apiPost({
                              action: 'update-pricing',
                              productId: item.productId,
                              newCost,
                              newPrice,
                              reason: `Bulk ${bulkAdjust.percent}% adjustment`,
                            });
                          }
                          setActionLoading(false);
                          setBulkAdjust(null);
                          showToast(`${items.length} items updated`);
                          await fetchPricingData();
                          await fetchData();
                        }}
                        disabled={actionLoading || !bulkAdjust.percent}
                        className="flex-1 px-4 py-2 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 transition disabled:opacity-50"
                      >
                        {actionLoading ? 'Updating...' : 'Apply'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
