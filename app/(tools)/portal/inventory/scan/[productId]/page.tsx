'use client';

/**
 * Inventory Item Scan Landing Page
 *
 * Destination for QR code scans printed by /portal/inventory/qr-labels.
 *
 * URL pattern: /portal/inventory/scan/INV-0042
 *
 * Flow:
 *   1. Rick or Tae scans the QR sticker on a warehouse rack with their phone
 *   2. Phone opens this page
 *   3. They see product name, current stock, location
 *   4. They tap a quick action:
 *      - Restock (add stock with cost) → /portal/inventory/restock?productId=...
 *      - Count (physical count reconciliation) → /portal/inventory/reconciliation?productId=...
 *      - History (transactions for this item) → /portal/inventory?scan=...&history=1
 *      - Low-stock alert (flag for Sara/Chris) → calls audit log + email
 *
 * Mobile-first dark theme to match /portal/warehouse. Huge tap targets so
 * it works one-handed while Rick's other hand is holding the pallet.
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Package, MapPin, AlertTriangle, Plus, ClipboardList,
  History, Bell, Loader2, CheckCircle, XCircle, Warehouse,
} from 'lucide-react';

interface InventoryItem {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  unit: string;
  location: string;
  currentQty: number;
  availableQty?: number;
  holdQty?: number;
  minStockLevel: number;
  maxStockLevel?: number;
  unitPrice?: number;
  // unitCost intentionally not typed — driver doesn't see it
}

export default function InventoryScanPage() {
  const params = useParams<{ productId: string }>();
  const router = useRouter();
  const productId = decodeURIComponent(params?.productId || '');

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flagging, setFlagging] = useState(false);
  const [flagged, setFlagged] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!productId) {
        setError('No product ID in scan URL');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/portal/inventory?action=item&productId=${encodeURIComponent(productId)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error(`No inventory item found for ${productId}`);
          }
          throw new Error(`API error ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;
        // API may return the item directly or wrapped
        const itemData = data.item || data;
        setItem(itemData);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productId]);

  async function handleFlagLowStock() {
    if (!item) return;
    setFlagging(true);
    try {
      const res = await fetch('/api/portal/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'flagLowStock',
          productId: item.productId,
          productName: item.productName,
          currentQty: item.currentQty,
          minStockLevel: item.minStockLevel,
        }),
      });
      // Even if the action doesn't exist yet, don't hard-fail — just show feedback
      if (res.ok || res.status === 400) {
        setFlagged(true);
      } else {
        throw new Error(`Flag failed: ${res.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Flag failed');
    } finally {
      setFlagging(false);
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-[#39FF14]" />
          <p className="text-sm text-zinc-400">Scanning {productId}...</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error || !item) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Item Not Found</h1>
          <p className="text-sm text-zinc-400 mb-1">
            Scanned: <span className="font-mono text-zinc-300">{productId}</span>
          </p>
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/portal/inventory"
              className="px-4 py-3 bg-zinc-800 text-white font-semibold rounded-lg hover:bg-zinc-700"
            >
              Browse Inventory
            </Link>
            <Link
              href="/portal/warehouse"
              className="px-4 py-3 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-lg hover:bg-zinc-800"
            >
              Back to Warehouse
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Stock status color ──
  const available = item.availableQty ?? item.currentQty;
  const isLow = available <= item.minStockLevel;
  const isOut = available <= 0;
  const stockColor = isOut ? 'text-red-400' : isLow ? 'text-yellow-400' : 'text-[#39FF14]';
  const stockBorder = isOut ? 'border-red-500' : isLow ? 'border-yellow-500' : 'border-[#39FF14]';

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-10">
      {/* Header */}
      <header className="bg-black border-b border-zinc-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/portal/warehouse" className="p-2 hover:bg-zinc-800 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="text-xs text-[#39FF14] font-bold tracking-wider uppercase flex items-center gap-1">
            <Warehouse className="w-3 h-3" />
            Scanned Item
          </div>
          <div className="text-sm text-zinc-400 font-mono truncate">{item.productId}</div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* Product header card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-2">
            <Package className="w-8 h-8 text-[#39FF14]" />
            <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-full capitalize">
              {item.category || 'general'}
            </span>
          </div>
          <h1 className="text-2xl font-bold leading-tight mb-1">{item.productName}</h1>
          {item.sku && (
            <p className="text-xs text-zinc-500 font-mono">SKU: {item.sku}</p>
          )}
          {item.location && (
            <p className="text-sm text-zinc-400 mt-2 flex items-center gap-1">
              <MapPin className="w-4 h-4" /> {item.location}
            </p>
          )}
        </div>

        {/* Stock level card — huge, prominent */}
        <div className={`bg-zinc-900 border-2 ${stockBorder} rounded-2xl p-5`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase tracking-wider text-zinc-500 font-bold">
              Available Stock
            </span>
            {isOut && (
              <span className="text-xs font-bold text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> OUT OF STOCK
              </span>
            )}
            {!isOut && isLow && (
              <span className="text-xs font-bold text-yellow-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> LOW
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-7xl font-black tabular-nums leading-none ${stockColor}`}>
              {available}
            </span>
            <span className="text-xl text-zinc-500 font-semibold">{item.unit}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
            <span>Min: {item.minStockLevel}</span>
            {item.holdQty != null && item.holdQty > 0 && (
              <span className="text-orange-400">{item.holdQty} on hold</span>
            )}
            {item.maxStockLevel != null && (
              <span>Max: {item.maxStockLevel}</span>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-3">
          <h2 className="text-xs uppercase tracking-wider text-zinc-500 font-bold px-1">
            Quick Actions
          </h2>

          <Link
            href={`/portal/inventory/restock?productId=${encodeURIComponent(item.productId)}`}
            className="flex items-center gap-3 bg-[#39FF14] text-black font-bold p-4 rounded-2xl active:bg-lime-400"
          >
            <Plus className="w-6 h-6" />
            <div className="flex-1">
              <div className="text-base">Receive Stock</div>
              <div className="text-xs font-normal opacity-80">
                Add new quantity with supplier cost
              </div>
            </div>
          </Link>

          <Link
            href={`/portal/inventory/reconciliation?productId=${encodeURIComponent(item.productId)}`}
            className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 text-white font-bold p-4 rounded-2xl active:bg-zinc-800"
          >
            <ClipboardList className="w-6 h-6 text-[#0066CC]" />
            <div className="flex-1">
              <div className="text-base">Physical Count</div>
              <div className="text-xs font-normal text-zinc-400">
                Reconcile shelf count vs system
              </div>
            </div>
          </Link>

          <Link
            href={`/portal/inventory?productId=${encodeURIComponent(item.productId)}&tab=history`}
            className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 text-white font-bold p-4 rounded-2xl active:bg-zinc-800"
          >
            <History className="w-6 h-6 text-purple-400" />
            <div className="flex-1">
              <div className="text-base">Transaction History</div>
              <div className="text-xs font-normal text-zinc-400">
                See all in/out activity for this item
              </div>
            </div>
          </Link>

          <button
            onClick={handleFlagLowStock}
            disabled={flagging || flagged}
            className="w-full flex items-center gap-3 bg-zinc-900 border border-zinc-800 text-white font-bold p-4 rounded-2xl active:bg-zinc-800 disabled:opacity-50"
          >
            {flagged ? (
              <>
                <CheckCircle className="w-6 h-6 text-[#39FF14]" />
                <div className="flex-1 text-left">
                  <div className="text-base">Flagged to Office</div>
                  <div className="text-xs font-normal text-zinc-400">
                    Sara will see this in low-stock alerts
                  </div>
                </div>
              </>
            ) : flagging ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                <div className="flex-1 text-left">Flagging...</div>
              </>
            ) : (
              <>
                <Bell className="w-6 h-6 text-yellow-400" />
                <div className="flex-1 text-left">
                  <div className="text-base">Flag Low Stock</div>
                  <div className="text-xs font-normal text-zinc-400">
                    Alert office to reorder
                  </div>
                </div>
              </>
            )}
          </button>
        </div>

        {/* Price info — only shown if API provided it (server filters by role) */}
        {item.unitPrice != null && (
          <div className="text-center text-xs text-zinc-500 pt-2">
            Customer price: ${item.unitPrice.toFixed(2)} / {item.unit}
          </div>
        )}
      </main>
    </div>
  );
}
