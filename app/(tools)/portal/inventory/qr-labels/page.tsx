'use client';

/**
 * QR Label Generator
 *
 * Prints QR labels for warehouse racks. Each label encodes the canonical
 * inventory product ID (INV-XXXX) so a scanner can look up the item.
 *
 * Workflow:
 *   1. Office staff opens this page
 *   2. Selects which items need labels (or "select all")
 *   3. Hits Print — labels render in a grid sized for Avery 5160-style sheets
 *   4. Sticks the labels on warehouse racks
 *   5. Loading-assist + receiving + count pages can scan them via the
 *      <QRScanner /> component (browser camera, no native app)
 *
 * Each QR encodes a URL: https://rcrsal.com/portal/inventory?scan=INV-XXXX
 * — that way scanning with any phone camera (not just our app) opens
 * the right item directly. Adds redundancy: if our scanner doesn't work,
 * the iPhone camera still does.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Printer,
  CheckSquare,
  Square,
  Search,
  Loader2,
  QrCode,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import QRCode from 'qrcode';

interface InventoryItem {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  unit: string;
  location: string;
  currentQty: number;
  minStockLevel: number;
}

// QR labels encode a deep-link to the dedicated scan landing page at
// /portal/inventory/scan/[productId]. Any phone camera that reads a QR
// opens the URL directly — no native app required.
const SCAN_URL_BASE = '/portal/inventory/scan/';

export default function QRLabelsPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [labelSize, setLabelSize] = useState<'small' | 'medium' | 'large'>('medium');

  // Load the inventory catalog
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/portal/inventory?action=list');
        if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const list: InventoryItem[] = (data.items || []).map((i: {
          productId: string;
          productName: string;
          sku: string;
          category: string;
          unit: string;
          location: string;
          currentQty: number;
          minStockLevel: number;
        }) => ({
          productId: i.productId,
          productName: i.productName,
          sku: i.sku,
          category: i.category,
          unit: i.unit,
          location: i.location || 'Unknown',
          currentQty: i.currentQty,
          minStockLevel: i.minStockLevel,
        }));
        setItems(list);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load catalog');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Build the absolute URL for a product (so scanning from any phone camera works)
  const buildScanUrl = useCallback((productId: string) => {
    if (typeof window === 'undefined') return `${SCAN_URL_BASE}${productId}`;
    return `${window.location.origin}${SCAN_URL_BASE}${productId}`;
  }, []);

  // Generate QR data URLs for the SELECTED items only (cheaper than all)
  const generateQRs = useCallback(async () => {
    const newMap: Record<string, string> = { ...qrMap };
    const toGenerate = Array.from(selected).filter((id) => !newMap[id]);
    if (toGenerate.length === 0) return;

    for (const productId of toGenerate) {
      try {
        const url = buildScanUrl(productId);
        const dataUrl = await QRCode.toDataURL(url, {
          width: 240,
          margin: 1,
          errorCorrectionLevel: 'M',
        });
        newMap[productId] = dataUrl;
      } catch (err) {
        console.error(`QR generation failed for ${productId}:`, err);
      }
    }
    setQrMap(newMap);
  }, [selected, qrMap, buildScanUrl]);

  // Auto-generate when selection changes
  useEffect(() => {
    generateQRs();
  }, [generateQRs]);

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category));
    return ['all', ...Array.from(set).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return items.filter((i) => {
      if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
      if (!s) return true;
      return (
        i.productName.toLowerCase().includes(s) ||
        i.productId.toLowerCase().includes(s) ||
        i.sku.toLowerCase().includes(s) ||
        i.location.toLowerCase().includes(s)
      );
    });
  }, [items, search, categoryFilter]);

  const toggleSelect = (productId: string) => {
    const next = new Set(selected);
    if (next.has(productId)) next.delete(productId);
    else next.add(productId);
    setSelected(next);
  };

  const selectAllFiltered = () => {
    const next = new Set(selected);
    for (const i of filtered) next.add(i.productId);
    setSelected(next);
  };

  const clearSelection = () => setSelected(new Set());

  const handlePrint = () => {
    if (selected.size === 0) {
      alert('Select at least one item to print labels for.');
      return;
    }
    window.print();
  };

  const selectedItems = useMemo(
    () => items.filter((i) => selected.has(i.productId)),
    [items, selected]
  );

  // Label size classes — small=24/sheet, medium=12/sheet, large=6/sheet
  const sizeClasses = {
    small: { container: 'w-32 h-32', qr: 'w-20 h-20', text: 'text-[8px]', name: 'text-[9px]' },
    medium: { container: 'w-44 h-44', qr: 'w-28 h-28', text: 'text-[10px]', name: 'text-xs' },
    large: { container: 'w-60 h-60', qr: 'w-40 h-40', text: 'text-xs', name: 'text-sm' },
  };
  const cls = sizeClasses[labelSize];

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-brand-green animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .label-grid {
            display: grid !important;
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)) !important;
            gap: 8px !important;
          }
          .label {
            background: white !important;
            color: black !important;
            border: 1px solid #999 !important;
            page-break-inside: avoid;
          }
          .label * {
            color: black !important;
          }
        }
        .print-only { display: none; }
      `}</style>

      {/* Toolbar */}
      <header className="no-print bg-zinc-900 border-b border-zinc-800 px-4 md:px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/portal/inventory" className="text-zinc-500 hover:text-brand-green">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-brand-green" />
                QR Labels
              </h1>
              <p className="text-xs text-zinc-500">
                {selected.size} of {items.length} selected
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={labelSize}
              onChange={(e) => setLabelSize(e.target.value as 'small' | 'medium' | 'large')}
              className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white"
            >
              <option value="small">Small (24/sheet)</option>
              <option value="medium">Medium (12/sheet)</option>
              <option value="large">Large (6/sheet)</option>
            </select>
            <button
              onClick={selectAllFiltered}
              className="flex items-center gap-2 px-3 py-2 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-800 text-sm"
            >
              <CheckSquare className="w-4 h-4" />
              Select All
            </button>
            <button
              onClick={clearSelection}
              className="flex items-center gap-2 px-3 py-2 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-800 text-sm"
            >
              Clear
            </button>
            <button
              onClick={handlePrint}
              disabled={selected.size === 0}
              className="flex items-center gap-2 px-3 py-2 bg-brand-green text-black rounded-xl hover:brightness-90 text-sm font-bold disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              Print {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="no-print px-4 md:px-6 py-3 bg-zinc-900/50 border-b border-zinc-800">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input
              type="text"
              placeholder="Search by name, ID, SKU, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-brand-green/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-600" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'all' ? 'All Categories' : c.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Item picker (hidden when printing) */}
      <div className="no-print px-4 md:px-6 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filtered.map((item) => {
            const isSelected = selected.has(item.productId);
            return (
              <button
                key={item.productId}
                onClick={() => toggleSelect(item.productId)}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
                  isSelected
                    ? 'bg-brand-green/10 border-brand-green/40'
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {isSelected ? (
                  <CheckSquare className="w-5 h-5 text-brand-green flex-shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-5 h-5 text-zinc-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white truncate">
                    {item.productName}
                  </div>
                  <div className="text-xs text-zinc-500 truncate">
                    {item.productId} · {item.location}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            No items match your filter.
          </div>
        )}
      </div>

      {/* Print preview / actual print output */}
      <div className="px-4 md:px-6 py-4 print-only">
        <div className="label-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {selectedItems.map((item) => (
            <div
              key={item.productId}
              className={`label ${cls.container} bg-white text-black border-2 border-black rounded p-2 flex flex-col items-center justify-between`}
            >
              {qrMap[item.productId] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrMap[item.productId]}
                  alt={`QR for ${item.productId}`}
                  className={`${cls.qr}`}
                />
              ) : (
                <div className={`${cls.qr} bg-neutral-100 flex items-center justify-center`}>
                  <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                </div>
              )}
              <div className="text-center w-full">
                <div className={`${cls.name} font-bold leading-tight line-clamp-2`}>
                  {item.productName}
                </div>
                <div className={`${cls.text} font-mono mt-0.5`}>{item.productId}</div>
                <div className={`${cls.text} text-neutral-600 mt-0.5`}>
                  {item.location}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Screen-only preview of selected items so user can see what will print */}
      {selectedItems.length > 0 && (
        <div className="no-print px-4 md:px-6 py-6 border-t border-zinc-800 bg-zinc-900/30">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">
            Print Preview ({selectedItems.length} labels)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {selectedItems.map((item) => (
              <div
                key={item.productId}
                className={`${cls.container} bg-white text-black border-2 border-black rounded p-2 flex flex-col items-center justify-between`}
              >
                {qrMap[item.productId] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrMap[item.productId]}
                    alt={`QR for ${item.productId}`}
                    className={cls.qr}
                  />
                ) : (
                  <div className={`${cls.qr} bg-neutral-100 flex items-center justify-center`}>
                    <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                  </div>
                )}
                <div className="text-center w-full">
                  <div className={`${cls.name} font-bold leading-tight line-clamp-2`}>
                    {item.productName}
                  </div>
                  <div className={`${cls.text} font-mono mt-0.5`}>{item.productId}</div>
                  <div className={`${cls.text} text-neutral-600 mt-0.5`}>{item.location}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
