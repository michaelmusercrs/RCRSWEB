'use client';

/**
 * Inventory Order History
 *
 * Unified view of inventory-affecting orders across three types:
 *   - Restocks: incoming supplier orders (warehouse-side, +inventory)
 *   - Material orders: outgoing tickets to jobs (warehouse-side, -inventory)
 *   - Credit memos: returns/restocks against a job (+inventory back)
 *
 * All three pull from existing APIs:
 *   - /api/portal/inventory?action=list-restocks  (RestockOrder[])
 *   - /api/portal/tickets?type=delivery|return    (DeliveryTicket[])
 *   - /api/portal/credit-memos?job=…              (only when filtering by job)
 *
 * Cost columns are gated server-side via cost-visibility — driver and sales
 * roles will see `—` for cost; office/admin/manager/PM see real numbers.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  Package,
  Truck,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
} from 'lucide-react';

type TabId = 'restocks' | 'material' | 'credits';

interface RestockOrder {
  orderId: string;
  supplier: string;
  status: string;
  items: Array<{
    productName: string;
    orderQty: number;
    receivedQty?: number;
    unitCost: number;
    actualUnitCost?: number;
    totalCost: number;
  }>;
  totalCost: number;
  actualTotalCost?: number;
  createdAt: string;
  createdByName: string;
  receivedAt?: string;
  receivedByName?: string;
  countVerifiedAt?: string;
  costVerifiedAt?: string;
  notes?: string;
}

interface DeliveryTicket {
  ticketId: string;
  referenceNumber: string;
  ticketType: 'delivery' | 'pickup' | 'return';
  status: string;
  jobNumber?: string;
  customerName?: string;
  jobAddress?: string;
  city?: string;
  state?: string;
  createdAt: string;
  createdByName?: string;
  loadVerifiedAt?: string;
  materials?: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitCost?: number;
    unitPrice?: number;
  }>;
}

interface CreditMemoRecord {
  invoiceId: string;
  ticketId: string;
  referenceNumber: string;
  jobNumber: string;
  jobName: string;
  customerName: string;
  totalCost: number;
  createdAt: string;
  createdByName: string;
  status: string;
  lines: Array<{ productName: string; quantity: number; lineCost: number }>;
  notes?: string;
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function fmtMoney(n?: number | null) {
  if (n == null || isNaN(n)) return '—';
  return `$${n.toFixed(2)}`;
}

function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls =
    s === 'received' || s === 'completed' || s === 'posted'
      ? 'bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]/30'
      : s === 'cancelled' || s === 'voided'
      ? 'bg-red-500/10 text-red-400 border-red-500/30'
      : s === 'ordered' || s === 'shipped' || s === 'en_route' || s === 'delivered'
      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      : 'bg-zinc-700/40 text-zinc-300 border-zinc-600/30';
  return (
    <span
      className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${cls}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function OrderHistoryPage() {
  const [tab, setTab] = useState<TabId>('restocks');
  const [search, setSearch] = useState('');

  const [restocks, setRestocks] = useState<RestockOrder[]>([]);
  const [restocksLoading, setRestocksLoading] = useState(false);
  const [material, setMaterial] = useState<DeliveryTicket[]>([]);
  const [materialLoading, setMaterialLoading] = useState(false);
  const [credits, setCredits] = useState<CreditMemoRecord[]>([]);
  const [creditsLoading, setCreditsLoading] = useState(false);

  const loadRestocks = useCallback(async () => {
    setRestocksLoading(true);
    try {
      const res = await fetch('/api/portal/inventory?action=restockOrders');
      const data = await res.json();
      setRestocks(Array.isArray(data) ? data : data.orders || []);
    } catch {
      setRestocks([]);
    } finally {
      setRestocksLoading(false);
    }
  }, []);

  const loadMaterial = useCallback(async () => {
    setMaterialLoading(true);
    try {
      // Pull delivery + return tickets from the CANONICAL Tickets tab (all
      // real orders, incl. every email-created delivery) — not the legacy
      // Delivery Tickets tab. We filter in memory below.
      const res = await fetch('/api/portal/tickets?source=canonical&limit=1000');
      const data = await res.json();
      const list: DeliveryTicket[] = Array.isArray(data) ? data : [];
      // Sort newest first
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setMaterial(list);
    } catch {
      setMaterial([]);
    } finally {
      setMaterialLoading(false);
    }
  }, []);

  const loadCredits = useCallback(async () => {
    setCreditsLoading(true);
    try {
      // No global credit-memo list endpoint yet — query by ticket=manual* gives
      // nothing useful. Instead, derive from material tickets that are returns
      // (those auto-create credit memos), AND query for manual ones by sweeping
      // a few recent job numbers. Cheaper: use the material list filtered to
      // return tickets, since each return ticket maps to a CM.
      const res = await fetch('/api/portal/tickets?source=canonical&type=return&limit=1000');
      const data = await res.json();
      const returns: DeliveryTicket[] = Array.isArray(data) ? data : [];

      // For each return ticket, fetch its CM record so we get the CM id +
      // total cost. Cap parallelism to avoid hammering the sheet.
      const records: CreditMemoRecord[] = [];
      const slice = returns.slice(0, 30); // most recent 30 only
      const all = await Promise.all(
        slice.map(async t => {
          try {
            const r = await fetch(
              `/api/portal/credit-memos?ticket=${encodeURIComponent(t.ticketId)}`,
            );
            const d = await r.json();
            return (d.records || []) as CreditMemoRecord[];
          } catch {
            return [] as CreditMemoRecord[];
          }
        }),
      );
      for (const arr of all) records.push(...arr);
      records.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setCredits(records);
    } catch {
      setCredits([]);
    } finally {
      setCreditsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'restocks' && restocks.length === 0) loadRestocks();
    if (tab === 'material' && material.length === 0) loadMaterial();
    if (tab === 'credits' && credits.length === 0) loadCredits();
  }, [tab, restocks.length, material.length, credits.length, loadRestocks, loadMaterial, loadCredits]);

  const filteredRestocks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return restocks;
    return restocks.filter(r =>
      [r.orderId, r.supplier, r.status, r.notes, r.createdByName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [restocks, search]);

  const filteredMaterial = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return material;
    return material.filter(t =>
      [t.referenceNumber, t.jobNumber, t.customerName, t.status, t.jobAddress, t.city]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [material, search]);

  const filteredCredits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return credits;
    return credits.filter(c =>
      [c.invoiceId, c.jobNumber, c.customerName, c.notes, c.createdByName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [credits, search]);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            href="/portal/inventory"
            className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Inventory
          </Link>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-[#39FF14]" />
            Order History
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800">
          {[
            { id: 'restocks' as TabId, label: 'Restocks', icon: Truck, count: restocks.length, hint: 'Incoming +inventory' },
            { id: 'material' as TabId, label: 'Material orders', icon: Package, count: material.length, hint: 'Outgoing −inventory' },
            { id: 'credits' as TabId, label: 'Credit memos', icon: Receipt, count: credits.length, hint: 'Returns +inventory' },
          ].map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 -mb-px text-sm transition-colors ${
                  active
                    ? 'border-[#39FF14] text-[#39FF14]'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
                title={t.hint}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                {t.count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by R-number, customer, supplier, order id…"
            className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
          />
        </div>

        {/* Tab content */}
        {tab === 'restocks' && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium">Order</th>
                    <th className="text-left py-2 px-3 font-medium">Supplier</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-right py-2 px-3 font-medium">Lines</th>
                    <th className="text-right py-2 px-3 font-medium">Quoted</th>
                    <th className="text-right py-2 px-3 font-medium">Actual</th>
                    <th className="text-left py-2 px-3 font-medium">Created</th>
                    <th className="text-left py-2 px-3 font-medium">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {restocksLoading && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-zinc-500">
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        Loading restocks…
                      </td>
                    </tr>
                  )}
                  {!restocksLoading && filteredRestocks.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-zinc-500">
                        No restock orders yet.
                      </td>
                    </tr>
                  )}
                  {filteredRestocks.map(r => {
                    const fullyVerified = r.countVerifiedAt && r.costVerifiedAt;
                    return (
                      <tr key={r.orderId} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-mono text-xs text-zinc-300">
                          {r.orderId}
                          {fullyVerified && (
                            <CheckCircle2
                              className="w-3.5 h-3.5 text-[#39FF14] inline ml-1.5"
                              aria-label="Count + cost verified"
                            />
                          )}
                        </td>
                        <td className="py-2 px-3">{r.supplier}</td>
                        <td className="py-2 px-3">
                          <StatusPill status={r.status} />
                        </td>
                        <td className="py-2 px-3 text-right text-zinc-400">
                          {r.items?.length || 0}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {fmtMoney(r.totalCost)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {fmtMoney(r.actualTotalCost ?? null)}
                        </td>
                        <td className="py-2 px-3 text-xs text-zinc-400">
                          {fmtDate(r.createdAt)}
                          <div className="text-[10px] text-zinc-500">by {r.createdByName || '—'}</div>
                        </td>
                        <td className="py-2 px-3 text-xs text-zinc-400">
                          {fmtDate(r.receivedAt)}
                          {r.receivedByName && (
                            <div className="text-[10px] text-zinc-500">by {r.receivedByName}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'material' && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium">Ticket</th>
                    <th className="text-left py-2 px-3 font-medium">Type</th>
                    <th className="text-left py-2 px-3 font-medium">Job</th>
                    <th className="text-left py-2 px-3 font-medium">Customer</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-right py-2 px-3 font-medium">Lines</th>
                    <th className="text-left py-2 px-3 font-medium">Created</th>
                    <th className="text-left py-2 px-3 font-medium">Load verified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {materialLoading && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-zinc-500">
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        Loading tickets…
                      </td>
                    </tr>
                  )}
                  {!materialLoading && filteredMaterial.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-zinc-500">
                        No material orders yet.
                      </td>
                    </tr>
                  )}
                  {filteredMaterial.map(t => (
                    <tr key={t.ticketId} className="hover:bg-zinc-800/30">
                      <td className="py-2 px-3 font-mono text-xs text-zinc-300">
                        {t.referenceNumber || t.ticketId}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                            t.ticketType === 'return'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              : t.ticketType === 'pickup'
                              ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                              : 'bg-zinc-700/40 text-zinc-300 border-zinc-600/30'
                          }`}
                        >
                          {t.ticketType}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-xs text-[#39FF14]">
                        {t.jobNumber || '—'}
                      </td>
                      <td className="py-2 px-3">{t.customerName || '—'}</td>
                      <td className="py-2 px-3">
                        <StatusPill status={t.status} />
                      </td>
                      <td className="py-2 px-3 text-right text-zinc-400">
                        {t.materials?.length || 0}
                      </td>
                      <td className="py-2 px-3 text-xs text-zinc-400">
                        {fmtDate(t.createdAt)}
                        {t.createdByName && (
                          <div className="text-[10px] text-zinc-500">by {t.createdByName}</div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-xs text-zinc-400">
                        {t.loadVerifiedAt ? (
                          <>
                            {fmtDate(t.loadVerifiedAt)}
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#39FF14] inline ml-1" />
                          </>
                        ) : (
                          <span className="text-zinc-600 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'credits' && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium">Credit memo</th>
                    <th className="text-left py-2 px-3 font-medium">Job</th>
                    <th className="text-left py-2 px-3 font-medium">Customer</th>
                    <th className="text-right py-2 px-3 font-medium">Lines</th>
                    <th className="text-right py-2 px-3 font-medium">Credited</th>
                    <th className="text-left py-2 px-3 font-medium">Created</th>
                    <th className="text-left py-2 px-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {creditsLoading && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-zinc-500">
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        Loading credit memos…
                      </td>
                    </tr>
                  )}
                  {!creditsLoading && filteredCredits.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-zinc-500">
                        No credit memos in the last 30 returns.
                      </td>
                    </tr>
                  )}
                  {filteredCredits.map(c => (
                    <tr key={c.invoiceId} className="hover:bg-zinc-800/30">
                      <td className="py-2 px-3 font-mono text-xs text-[#39FF14]">{c.invoiceId}</td>
                      <td className="py-2 px-3 font-mono text-xs text-zinc-300">{c.jobNumber}</td>
                      <td className="py-2 px-3">{c.customerName}</td>
                      <td className="py-2 px-3 text-right text-zinc-400">{c.lines.length}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-amber-300">
                        −{fmtMoney(c.totalCost)}
                      </td>
                      <td className="py-2 px-3 text-xs text-zinc-400">
                        {fmtDate(c.createdAt)}
                        {c.createdByName && (
                          <div className="text-[10px] text-zinc-500">by {c.createdByName}</div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-xs text-zinc-500 max-w-[260px] truncate" title={c.notes}>
                        {c.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredCredits.length > 0 && (
              <div className="px-3 py-2 text-[11px] text-zinc-500 border-t border-zinc-800">
                Showing credit memos derived from the most recent 30 return tickets. Filter by R-number to narrow further.
                <span className="inline-block ml-2">
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  Manual credit memos created via /portal/credit-memos for a specific job appear here too once that job has a return ticket.
                </span>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
