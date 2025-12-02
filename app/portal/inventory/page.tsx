'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package, ArrowLeft, Plus, Minus, AlertTriangle, RefreshCw,
  Search, Filter, Loader2, CheckCircle2, Send, BarChart2
} from 'lucide-react';
import type { InventoryItem, RestockRequest } from '@/lib/delivery-portal-service';

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [restockRequests, setRestockRequests] = useState<RestockRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'inventory' | 'count' | 'restock'>('inventory');
  const [countMode, setCountMode] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [invRes, lowStockRes, restockRes] = await Promise.all([
        fetch('/api/portal/inventory'),
        fetch('/api/portal/inventory?lowStock=true'),
        fetch('/api/portal/restock'),
      ]);

      setInventory(await invRes.json());
      setLowStockItems(await lowStockRes.json());
      setRestockRequests(await restockRes.json());
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const categories = [...new Set(inventory.map(i => i.category))].filter(Boolean);

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCountChange = (productId: string, qty: number) => {
    setCounts(prev => ({ ...prev, [productId]: qty }));
  };

  const handleSubmitCounts = async () => {
    setIsSubmitting(true);
    try {
      const promises = Object.entries(counts).map(([productId, actualQty]) =>
        fetch('/api/portal/inventory', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'submitCount',
            productId,
            actualQty,
            countedBy: 'Inventory Count',
          }),
        })
      );

      await Promise.all(promises);
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
    try {
      await fetch('/api/portal/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: item.productId,
          productName: item.productName,
          currentQty: item.currentQty,
          requestedQty: item.maxQty - item.currentQty,
          supplier: item.supplier,
          priority: item.currentQty === 0 ? 'Urgent' : 'Normal',
          requestedBy: 'Inventory Portal',
        }),
      });

      loadData();
    } catch (error) {
      console.error('Error requesting restock:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto text-brand-green" size={48} />
          <p className="text-neutral-400 mt-4">Loading inventory...</p>
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
              <h1 className="text-xl font-bold text-white">Inventory Management</h1>
              <p className="text-sm text-neutral-400">{inventory.length} products tracked</p>
            </div>
          </div>
          <button
            onClick={loadData}
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
            { id: 'inventory', label: 'Inventory', icon: Package },
            { id: 'count', label: 'Weekly Count', icon: BarChart2 },
            { id: 'restock', label: 'Restock Requests', icon: Send },
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
              {tab.id === 'restock' && restockRequests.filter(r => r.status === 'Pending').length > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {restockRequests.filter(r => r.status === 'Pending').length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 pt-4">
          <div className="bg-red-500/20 border border-red-500 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="text-red-500 flex-shrink-0" size={24} />
            <div>
              <p className="font-semibold text-red-400">{lowStockItems.length} items low on stock</p>
              <p className="text-sm text-red-400/80">
                {lowStockItems.map(i => i.productName).slice(0, 3).join(', ')}
                {lowStockItems.length > 3 && ` and ${lowStockItems.length - 3} more`}
              </p>
            </div>
          </div>
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
            </div>

            {/* Inventory List */}
            <div className="space-y-2">
              {filteredInventory.map(item => {
                const isLow = item.currentQty <= item.minQty;
                return (
                  <div
                    key={item.productId}
                    className={`bg-neutral-800 border rounded-xl p-4 ${
                      isLow ? 'border-red-500' : 'border-neutral-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white">{item.productName}</h3>
                          {isLow && (
                            <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded">LOW</span>
                          )}
                        </div>
                        <p className="text-sm text-neutral-400">{item.sku} - {item.category}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${isLow ? 'text-red-500' : 'text-white'}`}>
                          {item.currentQty}
                        </div>
                        <div className="text-xs text-neutral-500">
                          Min: {item.minQty} / Max: {item.maxQty}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-700">
                      <div className="text-sm text-neutral-400">
                        <span>${item.unitCost?.toFixed(2)}/{item.unit}</span>
                        <span className="mx-2">-</span>
                        <span>{item.supplier}</span>
                      </div>
                      {isLow && (
                        <button
                          onClick={() => handleRequestRestock(item)}
                          className="px-3 py-1 bg-red-500 hover:bg-red-400 text-white text-sm font-medium rounded-lg"
                        >
                          Request Restock
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Count Tab */}
        {activeTab === 'count' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Weekly Inventory Count</h2>
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
      </div>
    </div>
  );
}
