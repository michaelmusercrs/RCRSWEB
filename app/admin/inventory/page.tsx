'use client';

/**
 * Admin Inventory Management Page
 * Integrates with Google Sheets via delivery-portal-service
 * Features: inventory list, search/filter, low stock alerts, add/edit items
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Package,
  Search,
  Plus,
  AlertTriangle,
  Edit2,
  Trash2,
  RefreshCw,
  Filter,
  ChevronDown,
  X,
  Save,
  ArrowLeft,
  Home,
  DollarSign,
  TrendingUp,
  Box,
  Loader2,
} from 'lucide-react';

interface InventoryItem {
  productId: string;
  productName: string;
  category: string;
  sku: string;
  unit: string;
  currentQty: number;
  minQty: number;
  maxQty: number;
  unitCost: number;
  totalValue: number;
  location: string;
  supplier: string;
  lastCountDate?: string;
  lastRestockDate?: string;
  notes?: string;
}

interface RestockRequest {
  requestId: string;
  requestDate: string;
  requestedBy: string;
  productId: string;
  productName: string;
  currentQty: number;
  requestedQty: number;
  supplier: string;
  priority: 'Low' | 'Normal' | 'High' | 'Urgent';
  status: 'Pending' | 'Approved' | 'Ordered' | 'Received' | 'Cancelled';
}

type FilterTab = 'all' | 'low-stock' | 'out-of-stock';

export default function AdminInventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
  const [restockRequests, setRestockRequests] = useState<RestockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [categories, setCategories] = useState<string[]>([]);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state for add/edit
  const [formData, setFormData] = useState({
    productId: '',
    productName: '',
    category: '',
    sku: '',
    unit: 'each',
    currentQty: 0,
    minQty: 10,
    maxQty: 100,
    unitCost: 0,
    location: '',
    supplier: '',
    notes: '',
  });

  // Fetch inventory data
  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/portal/inventory');
      if (!response.ok) throw new Error('Failed to fetch inventory');
      const data = await response.json();

      const items = Array.isArray(data) ? data : [];
      setInventory(items);

      // Extract unique categories
      const uniqueCategories = [...new Set(items.map((item: InventoryItem) => item.category).filter(Boolean))];
      setCategories(uniqueCategories as string[]);
    } catch (err) {
      console.error('Error fetching inventory:', err);
      setError('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch restock requests
  const fetchRestockRequests = useCallback(async () => {
    try {
      const response = await fetch('/api/portal/restock');
      if (!response.ok) return;
      const data = await response.json();
      setRestockRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching restock requests:', err);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
    fetchRestockRequests();
  }, [fetchInventory, fetchRestockRequests]);

  // Filter inventory based on search, category, and tab
  useEffect(() => {
    let filtered = [...inventory];

    // Filter by tab
    if (activeTab === 'low-stock') {
      filtered = filtered.filter(item => item.currentQty <= item.minQty && item.currentQty > 0);
    } else if (activeTab === 'out-of-stock') {
      filtered = filtered.filter(item => item.currentQty === 0);
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.productName.toLowerCase().includes(query) ||
        item.productId.toLowerCase().includes(query) ||
        item.sku?.toLowerCase().includes(query) ||
        item.supplier?.toLowerCase().includes(query)
      );
    }

    setFilteredInventory(filtered);
  }, [inventory, searchQuery, selectedCategory, activeTab]);

  // Calculate stats
  const stats = {
    totalItems: inventory.length,
    lowStock: inventory.filter(item => item.currentQty <= item.minQty && item.currentQty > 0).length,
    outOfStock: inventory.filter(item => item.currentQty === 0).length,
    totalValue: inventory.reduce((sum, item) => sum + item.totalValue, 0),
    pendingRestocks: restockRequests.filter(r => r.status === 'Pending').length,
  };

  // Handle form input changes
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
  };

  // Open edit modal
  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      productId: item.productId,
      productName: item.productName,
      category: item.category,
      sku: item.sku || '',
      unit: item.unit || 'each',
      currentQty: item.currentQty,
      minQty: item.minQty,
      maxQty: item.maxQty,
      unitCost: item.unitCost,
      location: item.location || '',
      supplier: item.supplier || '',
      notes: item.notes || '',
    });
    setShowEditModal(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      productId: '',
      productName: '',
      category: '',
      sku: '',
      unit: 'each',
      currentQty: 0,
      minQty: 10,
      maxQty: 100,
      unitCost: 0,
      location: '',
      supplier: '',
      notes: '',
    });
    setEditingItem(null);
  };

  // Save item (add or update)
  const handleSave = async () => {
    if (!formData.productName) {
      alert('Product name is required');
      return;
    }

    setSaving(true);
    try {
      let response: Response;

      if (editingItem) {
        // Update existing item
        response = await fetch('/api/portal/inventory', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'updateItem',
            productId: formData.productId,
            productName: formData.productName,
            category: formData.category,
            sku: formData.sku,
            unit: formData.unit,
            currentQty: formData.currentQty,
            minQty: formData.minQty,
            maxQty: formData.maxQty,
            unitCost: formData.unitCost,
            location: formData.location,
            supplier: formData.supplier,
            notes: formData.notes,
          }),
        });
      } else {
        // Add new item
        response = await fetch('/api/portal/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: formData.productId || '',
            productName: formData.productName,
            category: formData.category,
            sku: formData.sku,
            unit: formData.unit,
            currentQty: formData.currentQty,
            minQty: formData.minQty,
            maxQty: formData.maxQty,
            unitCost: formData.unitCost,
            location: formData.location,
            supplier: formData.supplier,
            notes: formData.notes,
          }),
        });
      }

      if (!response.ok) throw new Error('Failed to save item');

      setShowAddModal(false);
      setShowEditModal(false);
      resetForm();
      fetchInventory();
    } catch (err) {
      console.error('Error saving item:', err);
      alert('Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  // Get stock status color
  const getStockStatus = (item: InventoryItem) => {
    if (item.currentQty === 0) return { color: 'text-red-400', bg: 'bg-red-500/10', label: 'Out of Stock' };
    if (item.currentQty <= item.minQty) return { color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Low Stock' };
    return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'In Stock' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href="/admin"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={18} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Inventory Management</h1>
                  <p className="text-sm text-neutral-400">Manage stock levels and items</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    resetForm();
                    setShowAddModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-green hover:bg-lime-400 text-black font-medium text-sm transition-colors"
                >
                  <Plus size={16} />
                  Add Item
                </button>
                <button
                  onClick={fetchInventory}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                  title="Refresh"
                >
                  <RefreshCw size={16} className={`text-neutral-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <Link
                  href="/"
                  target="_blank"
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 text-sm transition-colors"
                >
                  <Home size={16} />
                  View Site
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Box size={20} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.totalItems}</p>
                  <p className="text-xs text-neutral-500">Total Items</p>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-amber-500/20 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                  <AlertTriangle size={20} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-400">{stats.lowStock}</p>
                  <p className="text-xs text-neutral-500">Low Stock</p>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-red-500/20 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                  <Package size={20} className="text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-400">{stats.outOfStock}</p>
                  <p className="text-xs text-neutral-500">Out of Stock</p>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <DollarSign size={20} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">${stats.totalValue.toLocaleString()}</p>
                  <p className="text-xs text-neutral-500">Total Value</p>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-500/10 rounded-lg flex items-center justify-center">
                  <TrendingUp size={20} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.pendingRestocks}</p>
                  <p className="text-xs text-neutral-500">Pending Restocks</p>
                </div>
              </div>
            </div>
          </div>

          {/* Low Stock Alert Banner */}
          {stats.lowStock > 0 && (
            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3">
              <AlertTriangle className="text-amber-400 flex-shrink-0" size={20} />
              <div className="flex-1">
                <p className="text-amber-400 font-medium">Low Stock Alert</p>
                <p className="text-sm text-amber-400/70">
                  {stats.lowStock} item{stats.lowStock !== 1 ? 's are' : ' is'} running low on stock and may need reordering.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('low-stock')}
                className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-sm transition-colors"
              >
                View Items
              </button>
            </div>
          )}

          {/* Filter Tabs & Search */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
            {/* Tabs */}
            <div className="flex bg-white/[0.02] border border-white/5 rounded-xl p-1">
              {[
                { id: 'all', label: 'All Items', count: stats.totalItems },
                { id: 'low-stock', label: 'Low Stock', count: stats.lowStock },
                { id: 'out-of-stock', label: 'Out of Stock', count: stats.outOfStock },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as FilterTab)}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'bg-brand-green text-black font-medium'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {/* Search & Category Filter */}
            <div className="flex-1 flex gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                />
              </div>

              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="appearance-none px-4 py-2.5 pr-10 bg-white/[0.02] border border-white/5 rounded-xl text-white focus:outline-none focus:border-brand-green/50 transition-colors cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Inventory Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="text-brand-green animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={fetchInventory}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : filteredInventory.length === 0 ? (
            <div className="text-center py-20">
              <Package size={48} className="text-neutral-600 mx-auto mb-4" />
              <p className="text-neutral-400 mb-2">No items found</p>
              <p className="text-sm text-neutral-500">
                {searchQuery || selectedCategory !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Add your first inventory item to get started'}
              </p>
            </div>
          ) : (
            <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-4 py-3 text-sm font-medium text-neutral-400">Product</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-neutral-400">Category</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-neutral-400">Location</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-neutral-400">Qty</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-neutral-400">Min Qty</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-neutral-400">Unit Cost</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-neutral-400">Value</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-neutral-400">Status</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-neutral-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map((item) => {
                      const status = getStockStatus(item);
                      return (
                        <tr key={item.productId} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-white font-medium">{item.productName}</p>
                              <p className="text-xs text-neutral-500">{item.productId}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-white/5 rounded text-xs text-neutral-400">
                              {item.category || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-neutral-400">
                            {item.location || '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-bold ${status.color}`}>
                              {item.currentQty}
                            </span>
                            <span className="text-neutral-500 text-sm ml-1">{item.unit}</span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-neutral-400">
                            {item.minQty}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-neutral-400">
                            ${item.unitCost.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-white">
                            ${item.totalValue.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs ${status.bg} ${status.color}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                              title="Edit Item"
                            >
                              <Edit2 size={16} className="text-neutral-400 hover:text-white" />
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

          {/* Quick Summary */}
          <div className="mt-6 text-sm text-neutral-500">
            Showing {filteredInventory.length} of {inventory.length} items
            {selectedCategory !== 'all' && ` in ${selectedCategory}`}
          </div>
        </main>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-lg font-semibold text-white">
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  resetForm();
                }}
                className="p-1 hover:bg-white/5 rounded-lg transition-colors"
              >
                <X size={20} className="text-neutral-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-neutral-400 mb-2">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    name="productName"
                    value={formData.productName}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                    placeholder="Enter product name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">
                    Product ID
                  </label>
                  <input
                    type="text"
                    name="productId"
                    value={formData.productId}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                    placeholder="Auto-generated if empty"
                    disabled={!!editingItem}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">
                    SKU
                  </label>
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                    placeholder="SKU code"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">
                    Category
                  </label>
                  <input
                    type="text"
                    name="category"
                    value={formData.category}
                    onChange={handleFormChange}
                    list="categories"
                    className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                    placeholder="e.g., Fasteners"
                  />
                  <datalist id="categories">
                    {categories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">
                    Unit
                  </label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white focus:outline-none focus:border-brand-green/50 transition-colors"
                  >
                    <option value="each">Each</option>
                    <option value="box">Box</option>
                    <option value="bag">Bag</option>
                    <option value="roll">Roll</option>
                    <option value="piece">Piece</option>
                    <option value="tube">Tube</option>
                    <option value="bundle">Bundle</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">
                    Current Quantity
                  </label>
                  <input
                    type="number"
                    name="currentQty"
                    value={formData.currentQty}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">
                    Minimum Qty (Reorder Point)
                  </label>
                  <input
                    type="number"
                    name="minQty"
                    value={formData.minQty}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">
                    Maximum Qty
                  </label>
                  <input
                    type="number"
                    name="maxQty"
                    value={formData.maxQty}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">
                    Unit Cost ($)
                  </label>
                  <input
                    type="number"
                    name="unitCost"
                    value={formData.unitCost}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                    placeholder="e.g., Warehouse A"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">
                    Supplier
                  </label>
                  <input
                    type="text"
                    name="supplier"
                    value={formData.supplier}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                    placeholder="Supplier name"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-neutral-400 mb-2">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleFormChange}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors resize-none"
                    placeholder="Optional notes"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  resetForm();
                }}
                className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-brand-green hover:bg-lime-400 text-black font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    {editingItem ? 'Update Item' : 'Add Item'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
