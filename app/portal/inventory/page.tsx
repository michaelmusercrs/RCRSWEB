'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Package, ArrowLeft, Plus, Minus, AlertTriangle, RefreshCw,
  Search, Loader2, CheckCircle2, Send, BarChart2, Users,
  LogIn, LogOut, Shield, Clock, Check, X, Eye, DollarSign,
  TrendingUp, TrendingDown, Filter, SortAsc, SortDesc, Boxes
} from 'lucide-react';
import type { InventoryItem, RestockRequest } from '@/lib/delivery-portal-service';
import type { RolePermissions, WorkflowStep, UserRole } from '@/lib/portal-auth';

interface PortalUser {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: RolePermissions;
}

export default function InventoryPage() {
  // Auth state
  const [user, setUser] = useState<PortalUser | null>(null);
  const [pin, setPin] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Data state
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [restockRequests, setRestockRequests] = useState<RestockRequest[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<WorkflowStep[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'inventory' | 'count' | 'restock' | 'approvals'>('inventory');
  const [countMode, setCountMode] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'qty' | 'value' | 'category'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showLowOnly, setShowLowOnly] = useState(false);

  // Load data when user is authenticated
  const loadData = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const requests: Promise<Response>[] = [
        fetch('/api/portal/inventory'),
        fetch('/api/portal/inventory?lowStock=true'),
        fetch('/api/portal/restock'),
      ];

      // Load pending approvals if user can approve
      if (user.permissions.canApproveCounts || user.permissions.canApproveRestocks) {
        requests.push(
          fetch(`/api/portal/workflow?userId=${user.userId}&status=pending`)
        );
      }

      const responses = await Promise.all(requests);
      const data = await Promise.all(responses.map(r => r.json()));

      setInventory(data[0] || []);
      setLowStockItems(data[1] || []);
      setRestockRequests(data[2] || []);
      if (data[3]) {
        setPendingApprovals(data[3] || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  // Check for stored session
  useEffect(() => {
    const stored = localStorage.getItem('portalUser');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {}
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError('');

    try {
      const res = await fetch('/api/portal/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login-pin', pin }),
      });

      const data = await res.json();

      if (data.success) {
        setUser(data.user);
        localStorage.setItem('portalUser', JSON.stringify(data.user));
        setPin('');
      } else {
        setAuthError(data.error || 'Invalid PIN');
      }
    } catch (error) {
      setAuthError('Connection error. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('portalUser');
    setActiveTab('inventory');
    setPendingApprovals([]);
  };

  const categories = [...new Set(inventory.map(i => i.category))].filter(Boolean);

  // Memoized stats for dashboard
  const inventoryStats = useMemo(() => {
    const totalItems = inventory.length;
    const totalValue = inventory.reduce((sum, item) => sum + ((item.unitCost || 0) * item.currentQty), 0);
    const lowStockCount = inventory.filter(i => i.currentQty <= i.minQty).length;
    const outOfStockCount = inventory.filter(i => i.currentQty === 0).length;
    const avgStockLevel = totalItems > 0
      ? Math.round(inventory.reduce((sum, i) => sum + ((i.currentQty / i.maxQty) * 100), 0) / totalItems)
      : 0;
    const categoryBreakdown = categories.reduce((acc, cat) => {
      acc[cat] = inventory.filter(i => i.category === cat).length;
      return acc;
    }, {} as Record<string, number>);

    return { totalItems, totalValue, lowStockCount, outOfStockCount, avgStockLevel, categoryBreakdown };
  }, [inventory, categories]);

  // Memoized filtered and sorted inventory
  const filteredInventory = useMemo(() => {
    let items = inventory.filter(item => {
      const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !selectedCategory || item.category === selectedCategory;
      const matchesLowStock = !showLowOnly || item.currentQty <= item.minQty;
      return matchesSearch && matchesCategory && matchesLowStock;
    });

    // Sort items
    items.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.productName.localeCompare(b.productName);
          break;
        case 'qty':
          comparison = a.currentQty - b.currentQty;
          break;
        case 'value':
          comparison = ((a.unitCost || 0) * a.currentQty) - ((b.unitCost || 0) * b.currentQty);
          break;
        case 'category':
          comparison = (a.category || '').localeCompare(b.category || '');
          break;
      }
      return sortDir === 'asc' ? comparison : -comparison;
    });

    return items;
  }, [inventory, searchTerm, selectedCategory, showLowOnly, sortBy, sortDir]);

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const handleCountChange = (productId: string, qty: number) => {
    setCounts(prev => ({ ...prev, [productId]: Math.max(0, qty) }));
  };

  const handleSubmitCounts = async () => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      // Create a workflow for count approval if user can't self-approve
      if (!user.permissions.canApproveCounts) {
        await fetch('/api/portal/workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            type: 'count_approval',
            referenceId: `COUNT-${Date.now()}`,
            title: `Inventory Count - ${Object.keys(counts).length} items`,
            description: `Count submitted by ${user.name}`,
            requestedBy: user.userId,
            workflowData: { counts, countedBy: user.name },
          }),
        });
      } else {
        // User can approve, submit directly
        const promises = Object.entries(counts).map(([productId, actualQty]) =>
          fetch('/api/portal/inventory', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'submitCount',
              productId,
              actualQty,
              countedBy: user.name,
            }),
          })
        );
        await Promise.all(promises);
      }

      setCounts({});
      setCountMode(false);
      loadData();
    } catch (error) {
      console.error('Error submitting counts:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestRestock = async (item: InventoryItem) => {
    if (!user) return;

    try {
      // Create restock request
      const res = await fetch('/api/portal/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: item.productId,
          productName: item.productName,
          currentQty: item.currentQty,
          requestedQty: item.maxQty - item.currentQty,
          supplier: item.supplier,
          priority: item.currentQty === 0 ? 'Urgent' : 'Normal',
          requestedBy: user.name,
        }),
      });

      const restockData = await res.json();

      // Create workflow for approval
      await fetch('/api/portal/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          type: 'restock',
          referenceId: restockData.requestId,
          title: `Restock: ${item.productName}`,
          description: `Request ${item.maxQty - item.currentQty} units from ${item.supplier}`,
          requestedBy: user.userId,
          workflowData: { ...restockData },
        }),
      });

      loadData();
    } catch (error) {
      console.error('Error requesting restock:', error);
    }
  };

  const handleApproveWorkflow = async (workflow: WorkflowStep, approved: boolean) => {
    if (!user) return;

    try {
      await fetch('/api/portal/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: approved ? 'approve' : 'reject',
          workflowId: workflow.workflowId,
          userId: user.userId,
          notes: approved ? 'Approved' : 'Rejected',
        }),
      });

      loadData();
    } catch (error) {
      console.error('Error processing approval:', error);
    }
  };

  // Login Screen
  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="text-brand-green" size={32} />
              </div>
              <h1 className="text-2xl font-bold text-white">Inventory Portal</h1>
              <p className="text-neutral-400 mt-2">Enter your PIN to continue</p>
            </div>

            <form onSubmit={handleLogin}>
              <div className="mb-6">
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter 4-digit PIN"
                  maxLength={4}
                  className="w-full bg-neutral-700 border border-neutral-600 rounded-xl px-4 py-4 text-white text-center text-2xl tracking-widest"
                  autoFocus
                />
                {authError && (
                  <p className="text-red-400 text-sm mt-2 text-center">{authError}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={pin.length !== 4 || isAuthenticating}
                className="w-full bg-brand-green hover:bg-lime-400 disabled:bg-neutral-600 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2"
              >
                {isAuthenticating ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <LogIn size={20} />
                    Sign In
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/portal" className="text-neutral-400 hover:text-white text-sm">
                Back to Portal Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && inventory.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto text-brand-green" size={48} />
          <p className="text-neutral-400 mt-4">Loading inventory...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'inventory', label: 'Inventory', icon: Package, show: user.permissions.canViewInventory },
    { id: 'count', label: 'Weekly Count', icon: BarChart2, show: user.permissions.canSubmitCounts },
    { id: 'restock', label: 'Restock', icon: Send, show: true, badge: restockRequests.filter(r => r.status === 'Pending').length },
    { id: 'approvals', label: 'Approvals', icon: Check, show: user.permissions.canApproveCounts || user.permissions.canApproveRestocks, badge: pendingApprovals.length },
  ].filter(t => t.show);

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
              <h1 className="text-xl font-bold text-white">Inventory Management</h1>
              <p className="text-sm text-neutral-400">{inventory.length} products tracked</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* User Badge */}
            <div className="flex items-center gap-2 bg-neutral-700 px-3 py-2 rounded-lg">
              <Users size={16} className="text-brand-green" />
              <div>
                <p className="text-white text-sm font-medium">{user.name}</p>
                <p className="text-neutral-400 text-xs capitalize">{user.role.replace('_', ' ')}</p>
              </div>
            </div>
            <button
              onClick={loadData}
              className="p-2 bg-neutral-700 rounded-lg hover:bg-neutral-600"
              title="Refresh"
            >
              <RefreshCw size={20} className={`text-neutral-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 bg-red-500/20 rounded-lg hover:bg-red-500/30"
              title="Logout"
            >
              <LogOut size={20} className="text-red-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-neutral-800 border-b border-neutral-700">
        <div className="max-w-6xl mx-auto flex overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-brand-green border-b-2 border-brand-green'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
              {tab.badge && tab.badge > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Dashboard */}
      {activeTab === 'inventory' && (
        <div className="max-w-6xl mx-auto px-4 pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
              <div className="flex items-center gap-2 text-neutral-400 text-sm mb-1">
                <Boxes size={16} />
                Total Products
              </div>
              <div className="text-2xl font-bold text-white">{inventoryStats.totalItems}</div>
            </div>
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
              <div className="flex items-center gap-2 text-neutral-400 text-sm mb-1">
                <DollarSign size={16} />
                Total Value
              </div>
              <div className="text-2xl font-bold text-brand-green">${inventoryStats.totalValue.toLocaleString()}</div>
            </div>
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
              <div className="flex items-center gap-2 text-neutral-400 text-sm mb-1">
                <TrendingUp size={16} />
                Avg Stock Level
              </div>
              <div className={`text-2xl font-bold ${inventoryStats.avgStockLevel >= 50 ? 'text-green-400' : inventoryStats.avgStockLevel >= 25 ? 'text-yellow-400' : 'text-red-400'}`}>
                {inventoryStats.avgStockLevel}%
              </div>
            </div>
            <div className={`bg-neutral-800 border rounded-xl p-4 ${inventoryStats.lowStockCount > 0 ? 'border-red-500' : 'border-neutral-700'}`}>
              <div className="flex items-center gap-2 text-neutral-400 text-sm mb-1">
                <AlertTriangle size={16} className={inventoryStats.lowStockCount > 0 ? 'text-red-400' : ''} />
                Low Stock
              </div>
              <div className={`text-2xl font-bold ${inventoryStats.lowStockCount > 0 ? 'text-red-400' : 'text-white'}`}>
                {inventoryStats.lowStockCount}
                {inventoryStats.outOfStockCount > 0 && (
                  <span className="text-sm font-normal text-red-500 ml-2">({inventoryStats.outOfStockCount} out)</span>
                )}
              </div>
            </div>
          </div>

          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <div className="bg-red-500/20 border border-red-500 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-red-500 flex-shrink-0" size={24} />
                <div>
                  <p className="font-semibold text-red-400">{lowStockItems.length} items need attention</p>
                  <p className="text-sm text-red-400/80">
                    {lowStockItems.map(i => i.productName).slice(0, 3).join(', ')}
                    {lowStockItems.length > 3 && ` +${lowStockItems.length - 3} more`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLowOnly(true)}
                className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white font-medium rounded-lg"
              >
                View All
              </button>
            </div>
          )}
        </div>
      )}

      <div className="max-w-6xl mx-auto p-4">
        {/* Inventory Tab */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-10 pr-4 py-2 text-white"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-white"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <button
                onClick={() => setShowLowOnly(!showLowOnly)}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                  showLowOnly
                    ? 'bg-red-500 text-white'
                    : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white'
                }`}
              >
                <Filter size={16} />
                Low Stock
              </button>
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-neutral-500">Sort by:</span>
              {[
                { key: 'name', label: 'Name' },
                { key: 'qty', label: 'Quantity' },
                { key: 'value', label: 'Value' },
                { key: 'category', label: 'Category' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => toggleSort(key as typeof sortBy)}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${
                    sortBy === key
                      ? 'bg-brand-green text-black font-medium'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {label}
                  {sortBy === key && (sortDir === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />)}
                </button>
              ))}
            </div>

            {/* Results count */}
            <div className="text-sm text-neutral-500">
              Showing {filteredInventory.length} of {inventory.length} products
              {showLowOnly && ' (low stock only)'}
            </div>

            {/* Inventory List */}
            <div className="space-y-2">
              {filteredInventory.map(item => {
                const isLow = item.currentQty <= item.minQty;
                const isOut = item.currentQty === 0;
                const stockPercent = Math.round((item.currentQty / item.maxQty) * 100);
                const itemValue = (item.unitCost || 0) * item.currentQty;
                return (
                  <div
                    key={item.productId}
                    className={`bg-neutral-800 border rounded-xl p-4 ${
                      isOut ? 'border-red-600 bg-red-500/5' : isLow ? 'border-red-500' : 'border-neutral-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white">{item.productName}</h3>
                          {isOut ? (
                            <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded font-bold">OUT OF STOCK</span>
                          ) : isLow && (
                            <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded">LOW</span>
                          )}
                        </div>
                        <p className="text-sm text-neutral-400">{item.sku} - {item.category}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${isOut ? 'text-red-600' : isLow ? 'text-red-500' : 'text-white'}`}>
                          {item.currentQty}
                        </div>
                        <div className="text-xs text-neutral-500">
                          Min: {item.minQty} / Max: {item.maxQty}
                        </div>
                      </div>
                    </div>

                    {/* Stock Level Bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-neutral-500">Stock Level</span>
                        <span className={stockPercent >= 50 ? 'text-green-400' : stockPercent >= 25 ? 'text-yellow-400' : 'text-red-400'}>
                          {stockPercent}%
                        </span>
                      </div>
                      <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            stockPercent >= 50 ? 'bg-green-500' : stockPercent >= 25 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(100, stockPercent)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-700">
                      <div className="flex items-center gap-4 text-sm text-neutral-400">
                        <span>${item.unitCost?.toFixed(2)}/{item.unit}</span>
                        <span className="text-brand-green font-medium">
                          Value: ${itemValue.toLocaleString()}
                        </span>
                        <span>{item.supplier}</span>
                      </div>
                      {(isLow || isOut) && user.permissions.canCreateRestockRequests && (
                        <button
                          onClick={() => handleRequestRestock(item)}
                          className={`px-3 py-1 text-white text-sm font-medium rounded-lg ${
                            isOut ? 'bg-red-600 hover:bg-red-500' : 'bg-red-500 hover:bg-red-400'
                          }`}
                        >
                          {isOut ? 'Urgent Restock' : 'Request Restock'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredInventory.length === 0 && (
                <div className="text-center py-12">
                  <Package className="mx-auto text-neutral-600" size={48} />
                  <p className="text-neutral-400 mt-4">No products match your search</p>
                  <button
                    onClick={() => { setSearchTerm(''); setSelectedCategory(''); setShowLowOnly(false); }}
                    className="mt-2 text-brand-green hover:underline text-sm"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Count Tab */}
        {activeTab === 'count' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Weekly Inventory Count</h2>
                {!user.permissions.canApproveCounts && (
                  <p className="text-sm text-neutral-400">Counts will be submitted for approval</p>
                )}
              </div>
              {!countMode ? (
                <button
                  onClick={() => setCountMode(true)}
                  className="bg-brand-green hover:bg-lime-400 text-black font-bold px-4 py-2 rounded-lg"
                >
                  Start Count
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCountMode(false); setCounts({}); }}
                    className="bg-neutral-700 hover:bg-neutral-600 text-white font-bold px-4 py-2 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitCounts}
                    disabled={Object.keys(counts).length === 0 || isSubmitting}
                    className="bg-brand-green hover:bg-lime-400 disabled:bg-neutral-700 text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2"
                  >
                    {isSubmitting && <Loader2 className="animate-spin" size={18} />}
                    Submit ({Object.keys(counts).length})
                  </button>
                </div>
              )}
            </div>

            {countMode ? (
              <div className="space-y-2">
                {inventory.map(item => (
                  <div key={item.productId} className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-white">{item.productName}</h3>
                        <p className="text-sm text-neutral-400">
                          Expected: {item.currentQty} {item.unit}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCountChange(item.productId, (counts[item.productId] ?? item.currentQty) - 1)}
                          className="w-10 h-10 bg-neutral-700 hover:bg-neutral-600 rounded-lg flex items-center justify-center"
                        >
                          <Minus size={18} className="text-white" />
                        </button>
                        <input
                          type="number"
                          value={counts[item.productId] ?? ''}
                          onChange={(e) => handleCountChange(item.productId, parseInt(e.target.value) || 0)}
                          placeholder={item.currentQty.toString()}
                          className="w-20 bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white text-center"
                        />
                        <button
                          onClick={() => handleCountChange(item.productId, (counts[item.productId] ?? item.currentQty) + 1)}
                          className="w-10 h-10 bg-neutral-700 hover:bg-neutral-600 rounded-lg flex items-center justify-center"
                        >
                          <Plus size={18} className="text-white" />
                        </button>
                      </div>
                    </div>
                    {counts[item.productId] !== undefined && counts[item.productId] !== item.currentQty && (
                      <div className={`mt-2 text-sm ${
                        counts[item.productId] < item.currentQty ? 'text-red-400' : 'text-green-400'
                      }`}>
                        Variance: {counts[item.productId] - item.currentQty}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <BarChart2 className="mx-auto text-neutral-600" size={48} />
                <p className="text-neutral-400 mt-4">Click "Start Count" to begin your weekly inventory count</p>
              </div>
            )}
          </div>
        )}

        {/* Restock Tab */}
        {activeTab === 'restock' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Restock Requests</h2>

            <div className="space-y-3">
              {restockRequests.map(request => (
                <div key={request.requestId} className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-white">{request.productName}</h3>
                      <p className="text-sm text-neutral-400">{request.requestId}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      request.status === 'Pending' ? 'bg-yellow-500/20 text-yellow-500' :
                      request.status === 'Approved' ? 'bg-blue-500/20 text-blue-500' :
                      request.status === 'Ordered' ? 'bg-purple-500/20 text-purple-500' :
                      request.status === 'Received' ? 'bg-green-500/20 text-green-500' :
                      'bg-neutral-500/20 text-neutral-500'
                    }`}>
                      {request.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-neutral-500">Current Qty:</span>
                      <span className="text-white ml-2">{request.currentQty}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500">Requested:</span>
                      <span className="text-white ml-2">{request.requestedQty}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500">Supplier:</span>
                      <span className="text-white ml-2">{request.supplier}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500">Priority:</span>
                      <span className={`ml-2 ${
                        request.priority === 'Urgent' ? 'text-red-500' :
                        request.priority === 'High' ? 'text-orange-500' :
                        'text-white'
                      }`}>
                        {request.priority}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-neutral-500">
                    Requested {new Date(request.requestDate).toLocaleDateString()} by {request.requestedBy}
                  </div>
                </div>
              ))}

              {restockRequests.length === 0 && (
                <div className="text-center py-12">
                  <CheckCircle2 className="mx-auto text-green-500" size={48} />
                  <p className="text-neutral-400 mt-4">No pending restock requests</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Approvals Tab */}
        {activeTab === 'approvals' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Pending Approvals</h2>
              <span className="text-neutral-400 text-sm">
                {pendingApprovals.length} awaiting review
              </span>
            </div>

            <div className="space-y-3">
              {pendingApprovals.map(workflow => (
                <div key={workflow.workflowId} className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                          workflow.workflowType === 'restock' ? 'bg-blue-500/20 text-blue-400' :
                          workflow.workflowType === 'count_approval' ? 'bg-purple-500/20 text-purple-400' :
                          'bg-neutral-500/20 text-neutral-400'
                        }`}>
                          {workflow.workflowType.replace('_', ' ').toUpperCase()}
                        </span>
                        <Clock size={14} className="text-neutral-500" />
                        <span className="text-xs text-neutral-500">
                          {new Date(workflow.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="font-semibold text-white">{workflow.title}</h3>
                      {workflow.description && (
                        <p className="text-sm text-neutral-400">{workflow.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-neutral-700">
                    <div className="flex items-center gap-2 text-sm text-neutral-400">
                      <Users size={14} />
                      <span>Requested by: {workflow.requestedBy}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveWorkflow(workflow, false)}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-lg flex items-center gap-1"
                      >
                        <X size={16} />
                        Reject
                      </button>
                      <button
                        onClick={() => handleApproveWorkflow(workflow, true)}
                        className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 font-medium rounded-lg flex items-center gap-1"
                      >
                        <Check size={16} />
                        Approve
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {pendingApprovals.length === 0 && (
                <div className="text-center py-12">
                  <CheckCircle2 className="mx-auto text-green-500" size={48} />
                  <p className="text-neutral-400 mt-4">No pending approvals</p>
                  <p className="text-neutral-500 text-sm">All workflows have been processed</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
