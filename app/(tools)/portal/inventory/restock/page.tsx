'use client';

/**
 * Restock (Receive Stock) Page
 *
 * The ONE place where the driver (Rick) sees and enters cost. Every other
 * surface strips cost for the driver role — here Rick types the supplier
 * price when a shipment arrives at the warehouse.
 *
 * Flow:
 *   1. Load /api/portal/auth GET to get the signed-in user's role.
 *   2. Client-side gate — canSeeCostOnInventoryEntry(role) must pass, else
 *      show an "Access restricted" screen. (Server-side gating on the API
 *      is already in place via canSeeCostOnInventoryEntry + addStock case.)
 *   3. Load suppliers from /api/portal/customer-breakdowns?action=dropdowns
 *      and inventory from /api/portal/inventory?action=list&purpose=restock
 *      (cost is included for driver because purpose=restock triggers the
 *      inventory-entry cost guard).
 *   4. Rick builds a list of lines: product + qty + unit cost. Line totals
 *      and the running grand total update live.
 *   5. On submit: POST each line to /api/portal/inventory with
 *      action: 'addStock' (type='restock'). After all lines succeed, POST
 *      action: 'logRestockReceived' so one aggregate audit entry lands
 *      alongside the per-line INVENTORY_ADD_STOCK entries the API already
 *      writes.
 *   6. Success summary shows supplier + total items only — cost is NOT
 *      displayed after save ("served its purpose, should vanish").
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Package,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Truck,
  Receipt,
  Calendar,
} from 'lucide-react';
import { canSeeCostOnInventoryEntry } from '@/lib/cost-visibility';

interface InventoryItem {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  currentQty: number;
  unitCost: number; // included because purpose=restock
  supplier: string;
}

interface SupplierOption {
  name: string;
  category?: string;
  active?: boolean;
}

interface RestockLine {
  lineId: string;
  productId: string;
  productName: string;
  unit: string;
  currentQty: number;
  quantity: string; // string for controlled input, parsed on submit
  unitCost: string; // string for controlled input
}

interface AuthPayload {
  authenticated: boolean;
  user?: { userId: string; name: string; email: string; role: string };
}

const todayIso = () => new Date().toISOString().split('T')[0];

function makeLineId() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyLine(): RestockLine {
  return {
    lineId: makeLineId(),
    productId: '',
    productName: '',
    unit: '',
    currentQty: 0,
    quantity: '',
    unitCost: '',
  };
}

export default function RestockPage() {
  // Auth / role state
  const [role, setRole] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Data
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state
  const [supplier, setSupplier] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receivedDate, setReceivedDate] = useState(todayIso());
  const [lines, setLines] = useState<RestockLine[]>([emptyLine()]);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<
    | null
    | {
        supplier: string;
        receiptNumber: string;
        totalItems: number;
        totalQty: number;
        lineSummaries: Array<{ productName: string; quantity: number; unit: string }>;
      }
  >(null);

  // ── Auth check ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/portal/auth', { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) {
            setRole(null);
            setAuthChecked(true);
          }
          return;
        }
        const data: AuthPayload = await res.json();
        if (!cancelled) {
          setRole(data.user?.role || null);
          setAuthChecked(true);
        }
      } catch {
        if (!cancelled) {
          setRole(null);
          setAuthChecked(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Load suppliers + inventory once we know the role is allowed ────────
  const allowed = canSeeCostOnInventoryEntry(role);

  useEffect(() => {
    if (!authChecked || !allowed) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [dropRes, invRes] = await Promise.all([
          fetch('/api/portal/customer-breakdowns?action=dropdowns', { credentials: 'include' }),
          fetch('/api/portal/inventory?action=list&purpose=restock&includeCost=1', {
            credentials: 'include',
          }),
        ]);

        if (!dropRes.ok) throw new Error(`Dropdowns ${dropRes.status}`);
        if (!invRes.ok) throw new Error(`Inventory ${invRes.status}`);

        const dropJson = await dropRes.json();
        const invJson = await invRes.json();

        const sups: SupplierOption[] = Array.isArray(dropJson?.config?.suppliers)
          ? dropJson.config.suppliers
          : [];
        const items: InventoryItem[] = Array.isArray(invJson?.items)
          ? invJson.items.map((i: any) => ({
              productId: String(i.productId || ''),
              productName: String(i.productName || ''),
              sku: String(i.sku || ''),
              unit: String(i.unit || ''),
              currentQty: Number(i.currentQty || 0),
              unitCost: Number(i.unitCost || 0),
              supplier: String(i.supplier || ''),
            }))
          : [];

        if (!cancelled) {
          setSuppliers(sups);
          setInventory(items);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authChecked, allowed]);

  // ── Derived ────────────────────────────────────────────────────────────
  const grandTotal = useMemo(() => {
    let total = 0;
    for (const line of lines) {
      const qty = parseFloat(line.quantity);
      const cost = parseFloat(line.unitCost);
      if (Number.isFinite(qty) && Number.isFinite(cost)) {
        total += qty * cost;
      }
    }
    return total;
  }, [lines]);

  const filledLineCount = useMemo(() => {
    return lines.filter((l) => {
      const qty = parseFloat(l.quantity);
      const cost = parseFloat(l.unitCost);
      return l.productId && Number.isFinite(qty) && qty > 0 && Number.isFinite(cost) && cost >= 0;
    }).length;
  }, [lines]);

  // ── Line handlers ──────────────────────────────────────────────────────
  const addLine = useCallback(() => {
    setLines((prev) => [...prev, emptyLine()]);
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.lineId !== lineId)));
  }, []);

  const updateLine = useCallback(
    (lineId: string, patch: Partial<RestockLine>) => {
      setLines((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l)));
    },
    [],
  );

  // When the user picks a product from the datalist, auto-fill productId +
  // current qty + unit + seed the unit cost with the last known cost (they
  // can override if the supplier price changed).
  const handleProductPick = useCallback(
    (lineId: string, typedValue: string) => {
      const match = inventory.find(
        (i) =>
          `${i.productName} (${i.sku})` === typedValue ||
          i.productName === typedValue ||
          i.sku === typedValue,
      );
      if (match) {
        updateLine(lineId, {
          productId: match.productId,
          productName: match.productName,
          unit: match.unit,
          currentQty: match.currentQty,
          unitCost:
            match.unitCost && match.unitCost > 0 ? String(match.unitCost.toFixed(2)) : '',
        });
      } else {
        updateLine(lineId, {
          productId: '',
          productName: typedValue,
          unit: '',
          currentQty: 0,
        });
      }
    },
    [inventory, updateLine],
  );

  // ── Submit ─────────────────────────────────────────────────────────────
  const canSubmit =
    !submitting && supplier.trim().length > 0 && filledLineCount > 0 && !loading;

  const resetForm = useCallback(() => {
    setSupplier('');
    setReceiptNumber('');
    setReceivedDate(todayIso());
    setLines([emptyLine()]);
    setSubmitError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitError(null);

    if (!supplier.trim()) {
      setSubmitError('Supplier is required.');
      return;
    }

    // Cost is OPTIONAL — Rick just enters what came in (qty). If he knows the
    // supplier price he can type it, but it's not required; the office
    // cost-verifies the shipment afterward. Only qty + product are mandatory.
    const validLines = lines
      .map((l) => {
        const quantity = parseFloat(l.quantity);
        const parsedCost = parseFloat(l.unitCost);
        const unitCost = Number.isFinite(parsedCost) && parsedCost >= 0 ? parsedCost : 0;
        return { line: l, quantity, unitCost };
      })
      .filter(
        (x) =>
          x.line.productId &&
          Number.isFinite(x.quantity) &&
          x.quantity > 0,
      );

    if (validLines.length === 0) {
      setSubmitError('Add at least one item with a product and quantity.');
      return;
    }

    setSubmitting(true);
    try {
      let totalCost = 0;
      let totalQty = 0;
      const lineSummaries: Array<{ productName: string; quantity: number; unit: string }> = [];

      for (const { line, quantity, unitCost } of validLines) {
        const res = await fetch('/api/portal/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            action: 'addStock',
            productId: line.productId,
            quantity,
            type: 'restock',
            referenceId: receiptNumber.trim() || `restock-${receivedDate}`,
            referenceType: 'restock',
            notes:
              `Restock from ${supplier.trim()}` +
              (receiptNumber.trim() ? ` (receipt ${receiptNumber.trim()})` : '') +
              (unitCost > 0 ? ` @ $${unitCost.toFixed(2)}/${line.unit || 'unit'}` : ''),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            `Failed to add ${line.productName}: ${body?.error || res.statusText}`,
          );
        }
        totalCost += quantity * unitCost;
        totalQty += quantity;
        lineSummaries.push({
          productName: line.productName,
          quantity,
          unit: line.unit,
        });
      }

      // One aggregate audit-log entry for the whole shipment.
      // Route handles the dynamic import of audit-logger.
      await fetch('/api/portal/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'logRestockReceived',
          supplier: supplier.trim(),
          receiptNumber: receiptNumber.trim(),
          receivedDate,
          totalItems: validLines.length,
          totalQty,
          totalCost,
        }),
      }).catch((err) => {
        // Non-blocking — the stock is already added. Surface to console only.
        console.error('[restock] audit log call failed:', err);
      });

      setSuccess({
        supplier: supplier.trim(),
        receiptNumber: receiptNumber.trim(),
        totalItems: validLines.length,
        totalQty,
        lineSummaries,
      });
      resetForm();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submit failed.');
    } finally {
      setSubmitting(false);
    }
  }, [supplier, lines, receiptNumber, receivedDate, resetForm]);

  // ── Render: auth guard ─────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#39FF14]" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 flex flex-col items-center justify-center text-center">
        <AlertTriangle className="w-12 h-12 text-amber-400 mb-4" />
        <h1 className="text-xl font-bold mb-2">Access restricted</h1>
        <p className="text-sm text-zinc-400 max-w-xs mb-6">
          Receiving stock is limited to warehouse and office roles. Ask Sara or a manager
          if you need access.
        </p>
        <Link
          href="/portal/warehouse"
          className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm font-semibold"
        >
          Back to warehouse
        </Link>
      </div>
    );
  }

  // ── Render: success screen ─────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
        <div className="px-4 pt-4 pb-2 flex items-center gap-3">
          <Link
            href="/portal/warehouse"
            className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold">Stock Received</h1>
            <p className="text-xs text-zinc-500">Inventory updated</p>
          </div>
        </div>

        <div className="flex-1 px-4 pt-6">
          <div className="bg-zinc-900 rounded-2xl border border-[#39FF14]/40 p-5">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="w-8 h-8 text-[#39FF14]" />
              <div>
                <div className="text-lg font-bold">Shipment recorded</div>
                <div className="text-xs text-zinc-500">
                  From {success.supplier}
                  {success.receiptNumber ? ` · Receipt ${success.receiptNumber}` : ''}
                </div>
              </div>
            </div>

            {/* NOTE: cost is intentionally NOT displayed after save.
                Qty and supplier only. Cost served its purpose and vanishes. */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
                <div className="text-xs text-zinc-500">Lines</div>
                <div className="text-2xl font-bold">{success.totalItems}</div>
              </div>
              <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
                <div className="text-xs text-zinc-500">Total units</div>
                <div className="text-2xl font-bold">{success.totalQty}</div>
              </div>
            </div>

            <div className="space-y-1.5 mb-5">
              {success.lineSummaries.map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
                >
                  <span className="truncate pr-2">{s.productName}</span>
                  <span className="text-[#39FF14] font-semibold whitespace-nowrap">
                    +{s.quantity} {s.unit}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => setSuccess(null)}
                className="w-full py-3 rounded-xl bg-[#39FF14] text-black font-bold text-sm active:bg-[#2ee600]"
              >
                Receive another shipment
              </button>
              <Link
                href="/portal/warehouse"
                className="w-full py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm font-semibold text-center"
              >
                Back to warehouse
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: main form ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-28">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-zinc-900 sticky top-0 bg-zinc-950 z-10">
        <Link
          href="/portal/warehouse"
          className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center active:bg-zinc-800"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold leading-tight">Receive Stock</h1>
          <p className="text-xs text-zinc-500">Enter supplier, cost + quantity</p>
        </div>
        <Package className="w-6 h-6 text-[#39FF14]" />
      </div>

      {loading ? (
        <div className="p-8 flex flex-col items-center gap-3 text-zinc-500">
          <Loader2 className="w-6 h-6 animate-spin text-[#39FF14]" />
          <span className="text-sm">Loading suppliers & inventory…</span>
        </div>
      ) : loadError ? (
        <div className="p-4">
          <div className="bg-red-950/40 border border-red-500/40 rounded-xl p-4 text-sm">
            <div className="font-semibold text-red-300 mb-1">Load failed</div>
            <div className="text-red-200/80">{loadError}</div>
          </div>
        </div>
      ) : (
        <>
          {/* Datalists shared by all line rows */}
          <datalist id="restock-suppliers">
            {suppliers.map((s) => (
              <option key={s.name} value={s.name} />
            ))}
          </datalist>
          <datalist id="restock-products">
            {inventory.map((i) => (
              <option
                key={i.productId}
                value={`${i.productName} (${i.sku})`}
                label={`${i.currentQty} ${i.unit} on hand`}
              />
            ))}
          </datalist>

          {/* Section 1: Supplier info */}
          <section className="p-4 space-y-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Truck className="w-4 h-4 text-[#39FF14]" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-300">
                  Who delivered this?
                </h2>
              </div>

              <div>
                <label className="text-xs text-zinc-500 block mb-1">Supplier</label>
                <input
                  type="text"
                  list="restock-suppliers"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Start typing… (ABC, SRS, Beacon…)"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-3 text-base focus:border-[#39FF14] focus:outline-none"
                  autoComplete="off"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 block mb-1 flex items-center gap-1">
                    <Receipt className="w-3 h-3" />
                    Receipt / Invoice #
                  </label>
                  <input
                    type="text"
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-3 text-base focus:border-[#39FF14] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Received
                  </label>
                  <input
                    type="date"
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-3 text-base focus:border-[#39FF14] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Items */}
          <section className="px-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-300">
                Items ({lines.length})
              </h2>
              <button
                onClick={addLine}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#39FF14]/10 border border-[#39FF14]/40 text-[#39FF14] text-xs font-bold active:bg-[#39FF14]/20"
              >
                <Plus className="w-3.5 h-3.5" /> Add item
              </button>
            </div>

            {lines.map((line, idx) => {
              const qty = parseFloat(line.quantity);
              const cost = parseFloat(line.unitCost);
              const lineTotal =
                Number.isFinite(qty) && Number.isFinite(cost) ? qty * cost : 0;
              return (
                <div
                  key={line.lineId}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="text-xs text-zinc-500">Line {idx + 1}</div>
                    {lines.length > 1 && (
                      <button
                        onClick={() => removeLine(line.lineId)}
                        className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-red-400 active:bg-red-900/30"
                        aria-label="Remove line"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Product</label>
                    <input
                      type="text"
                      list="restock-products"
                      value={line.productName}
                      onChange={(e) => handleProductPick(line.lineId, e.target.value)}
                      placeholder="Search products…"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-3 text-base focus:border-[#39FF14] focus:outline-none"
                      autoComplete="off"
                    />
                    {line.productId && (
                      <div className="text-[11px] text-zinc-500 mt-1">
                        On hand: {line.currentQty} {line.unit}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-500 block mb-1">
                        Qty {line.unit && `(${line.unit})`}
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.lineId, { quantity: e.target.value })
                        }
                        placeholder="0"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-3 text-base focus:border-[#39FF14] focus:outline-none"
                      />
                    </div>
                    <div>
                      {/* THE one cost field visible to the driver. */}
                      <label className="text-xs text-zinc-500 block mb-1">Unit cost (optional)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                          $
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={line.unitCost}
                          onChange={(e) =>
                            updateLine(line.lineId, { unitCost: e.target.value })
                          }
                          placeholder="0.00"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-6 pr-3 py-3 text-base focus:border-[#39FF14] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
                    <span className="text-xs text-zinc-500">Line total</span>
                    <span className="text-sm font-bold text-[#39FF14]">
                      ${lineTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Section 3: Submit */}
          <section className="px-4 pb-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Total cost</span>
                <span className="text-2xl font-bold text-[#39FF14]">
                  ${grandTotal.toFixed(2)}
                </span>
              </div>
              <div className="text-xs text-zinc-500 text-right">
                {filledLineCount} line{filledLineCount === 1 ? '' : 's'} ready
              </div>

              {submitError && (
                <div className="bg-red-950/40 border border-red-500/40 rounded-lg p-3 text-xs text-red-200">
                  {submitError}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full py-4 rounded-xl bg-[#39FF14] text-black font-bold text-base active:bg-[#2ee600] disabled:bg-zinc-800 disabled:text-zinc-600 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Receiving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" /> Receive Stock
                  </>
                )}
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
