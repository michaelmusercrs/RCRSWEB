'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Package,
  ArrowLeft,
  Search,
  Filter,
  Plus,
  Minus,
  Edit3,
  X,
  CheckCircle,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  History,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  BarChart2,
  Warehouse,
  DollarSign,
  Trash2,
} from 'lucide-react';

// Matches the unified-inventory-service InventoryItem shape
interface InventoryItem {
  productId: string;
  productName: string;
  description: string;
  category: string;
  sku: string;
  unit: string;
  currentQty: number;
  holdQty: number;
  availableQty: number;
  minStockLevel: number;
  maxStockLevel: number;
  reorderQty: number;
  unitCost: number;
  unitPrice: number;
  location: string;
  supplier: string;
  lastCountDate: string;
  lastRestockDate: string;
  notes: string;
  active: boolean;
}

// Matches the unified-inventory-service InventoryTransaction shape
interface InventoryTransaction {
  transactionId: string;
  productId: string;
  productName: string;
  type: string;
  quantity: number;
  referenceId: string;
  referenceType: string;
  performedBy: string;
  performedByName: string;
  timestamp: string;
  notes: string;
  previousQty: number;
  newQty: number;
  unitCost?: number;
  unitPrice?: number;
}

const CATEGORY_LABELS: Record<string, string> = {
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

type ViewTab = 'inventory' | 'history' | 'lowStock';

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<ViewTab>('inventory');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [itemHistory, setItemHistory] = useState<InventoryTransaction[]>([]);
  const [loadingItemHistory, setLoadingItemHistory] = useState(false);

  // Edit modal state
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editForm, setEditForm] = useState<Partial<InventoryItem>>({});
  const [saving, setSaving] = useState(false);

  // Add item modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({
    productName: '',
    description: '',
    category: 'accessories',
    sku: '',
    unit: 'each',
    currentQty: 0,
    holdQty: 0,
    minStockLevel: 10,
    maxStockLevel: 100,
    reorderQty: 10,
    unitCost: 0,
    unitPrice: 0,
    location: '',
    supplier: '',
    supplierPartNumber: '',
    weight: 0,
    notes: '',
    active: true,
    lastCountDate: '',
    lastCountBy: '',
    lastRestockDate: '',
  });

  // Quick adjust
  const [adjustingItem, setAdjustingItem] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ action: 'list' });
      if (searchTerm) params.set('search', searchTerm);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (activeTab === 'lowStock') params.set('lowStock', 'true');

      const response = await fetch(`/api/portal/inventory?${params}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        // API returns { items: [...], totalCost, totalRetail, itemCount, holdValue }
        setItems(Array.isArray(data.items) ? data.items : []);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, categoryFilter, activeTab]);

  const fetchHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const response = await fetch('/api/portal/inventory?action=transactions&limit=100', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setTransactions(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const fetchItemHistory = useCallback(async (productId: string) => {
    try {
      setLoadingItemHistory(true);
      const response = await fetch(`/api/portal/inventory?action=transactions&productId=${encodeURIComponent(productId)}&limit=50`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setItemHistory(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching item history:', error);
    } finally {
      setLoadingItemHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  const categories = ['all', ...new Set(items.map(i => i.category).filter(Boolean))].sort();

  const handleQuickAdjust = async (productId: string) => {
    if (adjustQty === 0) return;

    try {
      const response = await fetch('/api/portal/inventory', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateQty',
          productId,
          qtyChange: adjustQty,
          reason: adjustReason || 'Manual adjustment',
        }),
      });

      if (response.ok) {
        setAdjustingItem(null);
        setAdjustQty(0);
        setAdjustReason('');
        fetchInventory();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to adjust stock');
      }
    } catch (error) {
      console.error('Error adjusting stock:', error);
      alert('Failed to adjust stock. Please try again.');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setSaving(true);

    try {
      const response = await fetch('/api/portal/inventory', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateItem',
          productId: editingItem.productId,
          updates: editForm,
        }),
      });

      if (response.ok) {
        setEditingItem(null);
        setEditForm({});
        fetchInventory();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save changes');
      }
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.productName) return;
    setSaving(true);

    try {
      const response = await fetch('/api/portal/inventory', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addItem',
          item: newItem,
        }),
      });

      if (response.ok) {
        setShowAddModal(false);
        setNewItem({
          productName: '',
          description: '',
          category: 'accessories',
          sku: '',
          unit: 'each',
          currentQty: 0,
          holdQty: 0,
          minStockLevel: 10,
          maxStockLevel: 100,
          reorderQty: 10,
          unitCost: 0,
          unitPrice: 0,
          location: '',
          supplier: '',
          supplierPartNumber: '',
          weight: 0,
          notes: '',
          active: true,
          lastCountDate: '',
          lastCountBy: '',
          lastRestockDate: '',
        });
        fetchInventory();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to add item');
      }
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Failed to add item. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const [deletingItem, setDeletingItem] = useState<string | null>(null);

  const handleDeleteItem = async (productId: string, productName: string) => {
    if (!confirm(`Are you sure you want to delete "${productName}"? This will permanently remove it from inventory.`)) {
      return;
    }

    setDeletingItem(productId);
    try {
      const response = await fetch(`/api/portal/inventory?productId=${encodeURIComponent(productId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        fetchInventory();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete item');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item. Please try again.');
    } finally {
      setDeletingItem(null);
    }
  };

  const toggleExpanded = (productId: string) => {
    if (expandedItem === productId) {
      setExpandedItem(null);
    } else {
      setExpandedItem(productId);
      fetchItemHistory(productId);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.currentQty <= 0) return { label: 'Out of Stock', color: 'text-red-400 bg-red-500/10 border-red-500/30' };
    if (item.currentQty <= item.minStockLevel) return { label: 'Low Stock', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    if (item.currentQty >= item.maxStockLevel) return { label: 'Overstocked', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
    return { label: 'In Stock', color: 'text-[#39FF14] bg-[#39FF14]/10 border-[#39FF14]/30' };
  };

  const getCategoryLabel = (cat: string) => CATEGORY_LABELS[cat] || cat;

  const lowStockCount = items.filter(i => i.currentQty <= i.minStockLevel).length;
  const outOfStockCount = items.filter(i => i.currentQty <= 0).length;
  const totalValue = items.reduce((sum, i) => sum + (i.currentQty * i.unitCost), 0);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal/dashboard" className="text-zinc-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-[#39FF14]" />
                Inventory Management
              </h1>
              <p className="text-sm text-zinc-400">
                {items.length} items | {lowStockCount > 0 && (
                  <span className="text-amber-400">{lowStockCount} low stock</span>
                )}
                {lowStockCount === 0 && 'All stocked'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchInventory()}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Item</span>
            </button>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-4 sm:gap-8">
            <div className="flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-[#39FF14]" />
              <span className="text-sm text-zinc-400">
                Total Items: <strong className="text-white">{items.length}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#39FF14]" />
              <span className="text-sm text-zinc-400">
                Total Value: <strong className="text-white">{formatCurrency(totalValue)}</strong>
              </span>
            </div>
            {lowStockCount > 0 && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-amber-400">
                  <strong>{lowStockCount}</strong> items below minimum
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/portal/inventory/warehouse"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#39FF14] hover:text-white bg-[#39FF14]/10 hover:bg-[#39FF14]/20 border border-[#39FF14]/30 rounded-lg transition-colors"
            >
              <Warehouse className="w-3.5 h-3.5" />
              Warehouse Controls
            </Link>
            <Link
              href="/portal/delivery/driver"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <Package className="w-3.5 h-3.5" />
              Driver Portal
            </Link>
            <Link
              href="/portal/inventory/management"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Advanced Management
            </Link>
            <Link
              href="/portal/inventory/reconciliation"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Reconciliation
            </Link>
            <Link
              href="/portal/inventory/forecast"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <TrendingDown className="w-3.5 h-3.5" />
              Forecast
            </Link>
            <Link
              href="/portal/inventory/vendors/pricing"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <DollarSign className="w-3.5 h-3.5" />
              Vendor Pricing
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 sm:px-6">
        <div className="flex gap-1">
          {[
            { id: 'inventory' as ViewTab, label: 'All Inventory', icon: Package },
            { id: 'lowStock' as ViewTab, label: 'Low Stock', icon: AlertTriangle },
            { id: 'history' as ViewTab, label: 'Transaction History', icon: History },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#39FF14] text-[#39FF14]'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'lowStock' && lowStockCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded">
                  {lowStockCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search and Filters */}
      {activeTab !== 'history' && (
        <div className="px-4 sm:px-6 py-4 bg-zinc-950 border-b border-zinc-800">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by name, SKU, supplier..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14]"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-500" />
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#39FF14]"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : getCategoryLabel(cat)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-4 sm:px-6 py-4 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-[#39FF14] animate-spin" />
          </div>
        ) : activeTab === 'history' ? (
          /* Transaction History View */
          <div className="space-y-2">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-[#39FF14] animate-spin" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-16">
                <History className="w-12 h-12 mx-auto mb-4 text-zinc-700" />
                <h3 className="text-lg font-semibold text-white mb-2">No Transactions</h3>
                <p className="text-zinc-400">Transaction history will appear here as inventory changes.</p>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="text-left px-4 py-3 text-zinc-400 font-medium">Date</th>
                        <th className="text-left px-4 py-3 text-zinc-400 font-medium">Item</th>
                        <th className="text-left px-4 py-3 text-zinc-400 font-medium">Type</th>
                        <th className="text-right px-4 py-3 text-zinc-400 font-medium">Qty Change</th>
                        <th className="text-left px-4 py-3 text-zinc-400 font-medium">Reference</th>
                        <th className="text-right px-4 py-3 text-zinc-400 font-medium">Prev / New Qty</th>
                        <th className="text-left px-4 py-3 text-zinc-400 font-medium">By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {transactions.map(tx => (
                        <tr key={tx.transactionId} className="hover:bg-zinc-800/50">
                          <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">
                            {formatDateTime(tx.timestamp)}
                          </td>
                          <td className="px-4 py-3 text-white font-medium">
                            {tx.productName || tx.productId}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded border ${
                                tx.type === 'delivery'
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                  : tx.type === 'restock'
                                  ? 'bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]/30'
                                  : tx.type === 'return'
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                                  : tx.type === 'adjustment'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : 'bg-zinc-700 text-zinc-300 border-zinc-600'
                              }`}
                            >
                              {tx.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            <span
                              className={
                                tx.quantity > 0 ? 'text-[#39FF14]' : 'text-red-400'
                              }
                            >
                              {tx.quantity > 0 ? '+' : ''}
                              {tx.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-400 font-mono text-xs">
                            {tx.referenceId || '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-300 font-mono text-xs">
                            {tx.previousQty} &rarr; {tx.newQty}
                          </td>
                          <td className="px-4 py-3 text-zinc-400 text-xs">
                            {tx.performedByName || tx.performedBy || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 mx-auto mb-4 text-zinc-700" />
            <h2 className="text-xl font-semibold text-white mb-2">
              {activeTab === 'lowStock' ? 'No Low Stock Items' : 'No Inventory Items'}
            </h2>
            <p className="text-zinc-400 mb-4">
              {activeTab === 'lowStock'
                ? 'All items are above their minimum stock levels.'
                : 'Add inventory items to get started.'}
            </p>
          </div>
        ) : (
          /* Inventory Items Grid */
          <div className="space-y-3">
            {items.map(item => {
              const stockStatus = getStockStatus(item);
              const stockPercent = item.maxStockLevel > 0
                ? Math.min(100, (item.currentQty / item.maxStockLevel) * 100)
                : 0;
              const isExpanded = expandedItem === item.productId;

              return (
                <div
                  key={item.productId}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
                >
                  {/* Item Row */}
                  <div
                    className="flex items-center gap-4 px-4 sm:px-6 py-4 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                    onClick={() => toggleExpanded(item.productId)}
                  >
                    {/* Stock Status Indicator */}
                    <div className="hidden sm:flex flex-col items-center gap-1 w-16">
                      <div className="w-full bg-zinc-800 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            item.currentQty <= 0
                              ? 'bg-red-500'
                              : item.currentQty <= item.minStockLevel
                              ? 'bg-amber-500'
                              : 'bg-[#39FF14]'
                          }`}
                          style={{ width: `${stockPercent}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-500">{Math.round(stockPercent)}%</span>
                    </div>

                    {/* Item Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-white truncate">
                          {item.productName}
                        </span>
                        <span
                          className={`shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded border ${stockStatus.color}`}
                        >
                          {stockStatus.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                        {item.sku && <span>SKU: {item.sku}</span>}
                        {item.category && <span>{getCategoryLabel(item.category)}</span>}
                        {item.location && <span>{item.location}</span>}
                        {item.supplier && <span>{item.supplier}</span>}
                      </div>
                    </div>

                    {/* Quantity */}
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-white">
                        {item.currentQty}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {item.unit} (min: {item.minStockLevel})
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setAdjustingItem(
                            adjustingItem === item.productId ? null : item.productId
                          );
                          setAdjustQty(0);
                          setAdjustReason('');
                        }}
                        className="p-2 text-zinc-400 hover:text-[#39FF14] hover:bg-zinc-800 rounded-lg"
                        title="Quick Adjust"
                      >
                        <BarChart2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setEditingItem(item);
                          setEditForm(item);
                        }}
                        className="p-2 text-zinc-400 hover:text-[#39FF14] hover:bg-zinc-800 rounded-lg"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteItem(item.productId, item.productName);
                        }}
                        disabled={deletingItem === item.productId}
                        className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingItem === item.productId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-500" />
                      )}
                    </div>
                  </div>

                  {/* Quick Adjust Panel */}
                  {adjustingItem === item.productId && (
                    <div
                      className="px-4 sm:px-6 py-3 bg-zinc-800/50 border-t border-zinc-800"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">Adjustment</label>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setAdjustQty(prev => prev - 1)}
                              className="p-1.5 bg-zinc-700 text-white rounded hover:bg-zinc-600"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input
                              type="number"
                              value={adjustQty}
                              onChange={e => setAdjustQty(parseInt(e.target.value) || 0)}
                              className="w-20 px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-center text-white font-mono"
                            />
                            <button
                              onClick={() => setAdjustQty(prev => prev + 1)}
                              className="p-1.5 bg-zinc-700 text-white rounded hover:bg-zinc-600"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="flex-1 min-w-[150px]">
                          <label className="block text-xs text-zinc-400 mb-1">Reason</label>
                          <input
                            type="text"
                            value={adjustReason}
                            onChange={e => setAdjustReason(e.target.value)}
                            placeholder="e.g., Physical count, restock..."
                            className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-white placeholder-zinc-600 text-sm"
                          />
                        </div>
                        <button
                          onClick={() => handleQuickAdjust(item.productId)}
                          disabled={adjustQty === 0}
                          className="px-4 py-1.5 bg-[#39FF14] text-black font-semibold rounded hover:bg-[#39FF14]/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          Apply
                        </button>
                        <button
                          onClick={() => setAdjustingItem(null)}
                          className="px-3 py-1.5 text-zinc-400 hover:text-white text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                      {adjustQty !== 0 && (
                        <div className="mt-2 text-xs">
                          <span className="text-zinc-400">New quantity: </span>
                          <span
                            className={
                              item.currentQty + adjustQty <= item.minStockLevel
                                ? 'text-amber-400'
                                : 'text-[#39FF14]'
                            }
                          >
                            {item.currentQty + adjustQty} {item.unit}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expanded History */}
                  {isExpanded && (
                    <div className="px-4 sm:px-6 py-4 bg-zinc-800/30 border-t border-zinc-800">
                      <h4 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                        <History className="w-4 h-4 text-[#39FF14]" />
                        Transaction History for {item.productName}
                      </h4>
                      {loadingItemHistory ? (
                        <div className="flex items-center gap-2 py-4 text-zinc-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading history...
                        </div>
                      ) : itemHistory.length === 0 ? (
                        <p className="text-sm text-zinc-500 py-2">
                          No transaction history for this item.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {itemHistory.map(tx => (
                            <div
                              key={tx.transactionId}
                              className="flex items-center justify-between py-2 px-3 bg-zinc-900/50 rounded text-sm"
                            >
                              <div className="flex items-center gap-3">
                                {tx.quantity > 0 ? (
                                  <TrendingUp className="w-4 h-4 text-[#39FF14] shrink-0" />
                                ) : (
                                  <TrendingDown className="w-4 h-4 text-red-400 shrink-0" />
                                )}
                                <div>
                                  <span className="text-zinc-300">
                                    {tx.type === 'delivery'
                                      ? 'Delivery'
                                      : tx.type === 'restock'
                                      ? 'Restock'
                                      : tx.type === 'return'
                                      ? 'Return'
                                      : tx.type === 'adjustment'
                                      ? 'Adjustment'
                                      : tx.type}
                                  </span>
                                  {tx.referenceId && tx.referenceId !== 'manual' && (
                                    <span className="text-zinc-500 ml-2 font-mono text-xs">
                                      #{tx.referenceId}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-zinc-500 text-xs">
                                  {formatDateTime(tx.timestamp)}
                                </span>
                                <span
                                  className={`font-mono font-semibold ${
                                    tx.quantity > 0 ? 'text-[#39FF14]' : 'text-red-400'
                                  }`}
                                >
                                  {tx.quantity > 0 ? '+' : ''}
                                  {tx.quantity}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-zinc-900 rounded-lg p-3">
                          <div className="text-xs text-zinc-500">Unit Cost</div>
                          <div className="text-sm font-semibold text-white">
                            {formatCurrency(item.unitCost)}
                          </div>
                        </div>
                        <div className="bg-zinc-900 rounded-lg p-3">
                          <div className="text-xs text-zinc-500">Total Value</div>
                          <div className="text-sm font-semibold text-white">
                            {formatCurrency(item.currentQty * item.unitCost)}
                          </div>
                        </div>
                        <div className="bg-zinc-900 rounded-lg p-3">
                          <div className="text-xs text-zinc-500">Min/Max</div>
                          <div className="text-sm font-semibold text-white">
                            {item.minStockLevel} / {item.maxStockLevel}
                          </div>
                        </div>
                        <div className="bg-zinc-900 rounded-lg p-3">
                          <div className="text-xs text-zinc-500">Location</div>
                          <div className="text-sm font-semibold text-white">
                            {item.location || '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Edit Item</h2>
              <button
                onClick={() => setEditingItem(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Product Name</label>
                <input
                  type="text"
                  value={editForm.productName || ''}
                  onChange={e => setEditForm({ ...editForm, productName: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Category</label>
                  <select
                    value={editForm.category || ''}
                    onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">SKU</label>
                  <input
                    type="text"
                    value={editForm.sku || ''}
                    onChange={e => setEditForm({ ...editForm, sku: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Current Qty</label>
                  <input
                    type="number"
                    value={editForm.currentQty || 0}
                    onChange={e => setEditForm({ ...editForm, currentQty: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Min Stock Level</label>
                  <input
                    type="number"
                    value={editForm.minStockLevel || 0}
                    onChange={e => setEditForm({ ...editForm, minStockLevel: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Max Stock Level</label>
                  <input
                    type="number"
                    value={editForm.maxStockLevel || 0}
                    onChange={e => setEditForm({ ...editForm, maxStockLevel: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Unit Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.unitCost || 0}
                    onChange={e => setEditForm({ ...editForm, unitCost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Unit</label>
                  <input
                    type="text"
                    value={editForm.unit || ''}
                    onChange={e => setEditForm({ ...editForm, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Location</label>
                  <input
                    type="text"
                    value={editForm.location || ''}
                    onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Supplier</label>
                  <input
                    type="text"
                    value={editForm.supplier || ''}
                    onChange={e => setEditForm({ ...editForm, supplier: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Notes</label>
                <textarea
                  value={editForm.notes || ''}
                  onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-3">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Add New Item</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Product Name *</label>
                <input
                  type="text"
                  value={newItem.productName}
                  onChange={e => setNewItem({ ...newItem, productName: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  placeholder="Enter product name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Category</label>
                  <select
                    value={newItem.category}
                    onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">SKU</label>
                  <input
                    type="text"
                    value={newItem.sku}
                    onChange={e => setNewItem({ ...newItem, sku: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Initial Qty</label>
                  <input
                    type="number"
                    value={newItem.currentQty}
                    onChange={e => setNewItem({ ...newItem, currentQty: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Min Stock</label>
                  <input
                    type="number"
                    value={newItem.minStockLevel}
                    onChange={e => setNewItem({ ...newItem, minStockLevel: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Max Stock</label>
                  <input
                    type="number"
                    value={newItem.maxStockLevel}
                    onChange={e => setNewItem({ ...newItem, maxStockLevel: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Unit Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newItem.unitCost}
                    onChange={e => setNewItem({ ...newItem, unitCost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Unit</label>
                  <select
                    value={newItem.unit}
                    onChange={e => setNewItem({ ...newItem, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  >
                    <option value="each">each</option>
                    <option value="box">box</option>
                    <option value="bag">bag</option>
                    <option value="roll">roll</option>
                    <option value="piece">piece</option>
                    <option value="tube">tube</option>
                    <option value="bundle">bundle</option>
                    <option value="pallet">pallet</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Location</label>
                  <input
                    type="text"
                    value={newItem.location}
                    onChange={e => setNewItem({ ...newItem, location: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                    placeholder="e.g., Warehouse A"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Supplier</label>
                  <input
                    type="text"
                    value={newItem.supplier}
                    onChange={e => setNewItem({ ...newItem, supplier: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                    placeholder="e.g., ABC Supply"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                disabled={saving || !newItem.productName}
                className="flex items-center gap-2 px-4 py-2 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
