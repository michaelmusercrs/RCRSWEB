'use client';

/**
 * /portal/inventory/low-stock — items below reorder point.
 *
 * Phase 4: surfaces all items where currentQty < reorderPoint, sorted by
 * deficit severity (largest gap first). One-click "Create restock PO"
 * generates a draft PO targeting the item's preferredVendor (falls back
 * to supplier name).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, AlertTriangle, Package, Plus, RefreshCw, Loader2,
  CheckCircle2, AlertCircle, Truck, Store,
} from 'lucide-react';

interface InventoryItem {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  category: string;
  currentQty: number;
  minStockLevel: number;
  maxStockLevel: number;
  reorderQty: number;
  reorderPoint?: number;
  preferredVendorId?: string;
  supplier: string;
  location: string;
}

interface Vendor {
  vendorId: string;
  name: string;
  active: boolean;
}

function effective(item: InventoryItem): number {
  return item.reorderPoint && item.reorderPoint > 0 ? item.reorderPoint : item.minStockLevel;
}

function deficit(item: InventoryItem): number {
  return effective(item) - item.currentQty;
}

function severity(item: InventoryItem): 'out' | 'critical' | 'low' {
  if (item.currentQty === 0) return 'out';
  const threshold = effective(item);
  if (item.currentQty <= threshold * 0.25) return 'critical';
  return 'low';
}

export default function LowStockPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [created, setCreated] = useState<string[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, vendRes] = await Promise.all([
        fetch('/api/portal/inventory?action=lowStock'),
        fetch('/api/portal/inventory/vendors?activeOnly=1'),
      ]);
      if (invRes.ok) {
        const json = await invRes.json();
        setItems(Array.isArray(json) ? json : []);
      } else {
        setError(`Failed to load low-stock items (HTTP ${invRes.status})`);
      }
      if (vendRes.ok) {
        const json = await vendRes.json();
        setVendors(json.vendors || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const vendorName = useCallback((id?: string, fallback: string = '') => {
    if (!id) return fallback || 'Unassigned';
    const v = vendors.find(x => x.vendorId === id);
    return v ? v.name : (fallback || id);
  }, [vendors]);

  const createPO = async (item: InventoryItem) => {
    setCreating(item.productId);
    setError(null);
    try {
      const supplier = item.preferredVendorId
        ? vendorName(item.preferredVendorId, item.supplier)
        : (item.supplier || 'Unassigned');
      const qty = item.reorderQty > 0
        ? item.reorderQty
        : Math.max(1, Math.ceil(effective(item) * 2 - item.currentQty));

      const res = await fetch('/api/portal/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createRestockOrder',
          items: [{ productId: item.productId, orderQty: qty }],
          supplier,
          notes: `Auto-generated from low-stock alert (deficit: ${deficit(item)})`,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        setError(`Failed to create PO: ${text || res.status}`);
        return;
      }
      const order = await res.json();
      setCreated(prev => [...prev, item.productId]);
      // refresh to pick up any changes (in case PO drained from list)
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create PO');
    } finally {
      setCreating(null);
    }
  };

  const generateAllDrafts = async () => {
    setBulkRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ensureRestockDrafts' }),
      });
      if (!res.ok) {
        setError(`Failed to generate drafts (HTTP ${res.status})`);
        return;
      }
      const { created: ids } = await res.json();
      if (Array.isArray(ids) && ids.length > 0) {
        setCreated(prev => Array.from(new Set([...prev, ...items.map(i => i.productId)])));
      }
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBulkRunning(false);
    }
  };

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => deficit(b) - deficit(a));
  }, [items]);

  const counts = useMemo(() => {
    const out = sorted.filter(i => severity(i) === 'out').length;
    const crit = sorted.filter(i => severity(i) === 'critical').length;
    const low = sorted.filter(i => severity(i) === 'low').length;
    return { out, crit, low };
  }, [sorted]);

  const sevStyle = (s: 'out' | 'critical' | 'low') => {
    if (s === 'out') return 'bg-red-100 text-red-800 border-red-300';
    if (s === 'critical') return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/portal/inventory" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-600" /> Low Stock Alerts
            </h1>
            <p className="text-sm text-gray-500">
              Items at or below their reorder point.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={generateAllDrafts}
            disabled={bulkRunning || sorted.length === 0}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {bulkRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Generate drafts for all
          </button>
          <button onClick={fetchData} className="p-2 hover:bg-gray-100 rounded-lg" title="Refresh">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-50 rounded-xl border border-red-200 p-3 text-center">
          <div className="text-2xl font-bold text-red-700">{counts.out}</div>
          <div className="text-xs text-red-700 uppercase tracking-wider">Out of stock</div>
        </div>
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-3 text-center">
          <div className="text-2xl font-bold text-orange-700">{counts.crit}</div>
          <div className="text-xs text-orange-700 uppercase tracking-wider">Critical</div>
        </div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-3 text-center">
          <div className="text-2xl font-bold text-yellow-700">{counts.low}</div>
          <div className="text-xs text-yellow-700 uppercase tracking-wider">Low</div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Item list */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading && items.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <p className="font-medium">All inventory is above reorder point.</p>
            <p className="text-xs mt-1">Stock is healthy. Check back after the next round of deliveries.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-3 py-2.5">Item</th>
                <th className="px-3 py-2.5">On hand</th>
                <th className="px-3 py-2.5">Reorder pt</th>
                <th className="px-3 py-2.5">Deficit</th>
                <th className="px-3 py-2.5">Vendor</th>
                <th className="px-3 py-2.5">Severity</th>
                <th className="px-3 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map(item => {
                const sev = severity(item);
                const isCreated = created.includes(item.productId);
                return (
                  <tr key={item.productId} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-400 shrink-0" />
                        <div>
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-xs text-gray-500">{item.sku} · {item.category}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-sm">
                      {item.currentQty} <span className="text-gray-400 text-xs">{item.unit}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-sm text-gray-600">{effective(item)}</td>
                    <td className="px-3 py-2.5 font-mono text-sm font-semibold text-red-700">
                      −{deficit(item)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">
                      <div className="inline-flex items-center gap-1">
                        <Store className="w-3 h-3" />
                        {vendorName(item.preferredVendorId, item.supplier)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${sevStyle(sev)}`}>
                        {sev === 'out' ? 'Out' : sev === 'critical' ? 'Critical' : 'Low'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {isCreated ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700">
                          <CheckCircle2 className="w-4 h-4" /> Draft created
                        </span>
                      ) : (
                        <button
                          onClick={() => createPO(item)}
                          disabled={creating === item.productId}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {creating === item.productId
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Truck className="w-3 h-3" />}
                          Create PO
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-500 text-center">
        Drafts are also surfaced on <Link href="/portal/inventory/restock" className="underline">/portal/inventory/restock</Link>.
      </p>
    </div>
  );
}
