'use client';

/**
 * Returns Tickets — full flow (Phase 3)
 *
 * Dark-themed, mobile-friendly returns workflow. Mirrors the delivery
 * driver flow: pickup → in_transit → received → credited → completed.
 *
 * Two flavors:
 *   - Return-to-Warehouse  (Restock + emit credit memo back to job cost)
 *   - Return-to-Distributor (Beacon / Gold Eagle / Advance / Lowe's / Home Depot)
 *
 * Driver-side: each stage transition can attach photos + GPS via the
 * shared DriverPhotoUploader (which handles compression, progress, and
 * the offline queue automatically).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  RotateCcw,
  Package,
  Building2,
  Camera,
  MapPin,
  Plus,
  RefreshCw,
  Loader2,
  X,
  CheckCircle,
  ChevronRight,
  ChevronDown,
  Clock,
  FileText,
  DollarSign,
  AlertTriangle,
  Search,
  Truck,
} from 'lucide-react';
import DriverPhotoUploader, { type UploadedPhoto } from '@/components/portal/DriverPhotoUploader';

interface ReturnItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  reason: string;
}

interface ReturnTicket {
  ticketId: string;
  type: 'return_to_warehouse' | 'return_to_distributor';
  status: 'created' | 'picked_up' | 'in_transit' | 'received' | 'credited' | 'completed' | 'cancelled';
  orderId?: string;
  jobId?: string;
  jobName?: string;
  items: ReturnItem[];
  distributor?: string;
  creditMemoNumber?: string;
  creditAmount?: number;
  createdAt: string;
  createdByName: string;
  pickupPhotos: string[];
  transitPhotos: string[];
  deliveryPhotos: string[];
  gpsPickup?: string;
  gpsDelivery?: string;
  notes: string;
  completedAt?: string;
}

interface CatalogItem {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  unit: string;
  currentQty: number;
  unitCost: number;
  unitPrice: number;
}

const STATUS_FLOW: ReturnTicket['status'][] = [
  'created',
  'picked_up',
  'in_transit',
  'received',
  'credited',
  'completed',
];

const STATUS_LABELS: Record<ReturnTicket['status'], string> = {
  created: 'Created',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  received: 'Received',
  credited: 'Credited',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<ReturnTicket['status'], string> = {
  created: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
  picked_up: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
  in_transit: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400',
  received: 'bg-[#39FF14]/15 border-[#39FF14]/30 text-[#39FF14]',
  credited: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
  completed: 'bg-zinc-700/40 border-zinc-700 text-zinc-300',
  cancelled: 'bg-red-500/15 border-red-500/30 text-red-400',
};

const DISTRIBUTORS = [
  'Advance Build Products Huntsville',
  'Beacon Huntsville',
  'Gold Eagle Huntsville',
  'Gold Eagle Decatur',
  "Lowe's",
  'Home Depot',
];

const REASONS = [
  'Excess (not used)',
  'Wrong material delivered',
  'Damaged on arrival',
  'Customer changed order',
  'Color mismatch',
  'Other',
];

function formatDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatMoney(n?: number) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function ReturnsPage() {
  const [tickets, setTickets] = useState<ReturnTicket[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [driverTicket, setDriverTicket] = useState<ReturnTicket | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);

      const [ticketsRes, catalogRes] = await Promise.all([
        fetch(`/api/portal/delivery/returns?${params}`),
        fetch('/api/portal/inventory?action=list'),
      ]);

      if (!ticketsRes.ok) {
        const j = await ticketsRes.json().catch(() => ({}));
        throw new Error(j.error || `Returns load failed (${ticketsRes.status})`);
      }
      const ticketsData = await ticketsRes.json();
      setTickets(ticketsData.tickets || []);

      if (catalogRes.ok) {
        const cd = await catalogRes.json();
        setCatalog(cd.items || []);
      }
    } catch (err) {
      console.error('[returns] fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load returns');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredTickets = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return tickets;
    return tickets.filter(
      (t) =>
        t.ticketId.toLowerCase().includes(s) ||
        (t.jobName || '').toLowerCase().includes(s) ||
        (t.distributor || '').toLowerCase().includes(s) ||
        t.items.some((it) => it.productName.toLowerCase().includes(s))
    );
  }, [tickets, search]);

  const stats = useMemo(() => {
    const active = tickets.filter((t) => !['completed', 'cancelled'].includes(t.status)).length;
    const toWarehouse = tickets.filter((t) => t.type === 'return_to_warehouse').length;
    const toDistributor = tickets.filter((t) => t.type === 'return_to_distributor').length;
    const totalCredit = tickets.reduce((sum, t) => sum + (t.creditAmount || 0), 0);
    return { total: tickets.length, active, toWarehouse, toDistributor, totalCredit };
  }, [tickets]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#39FF14] mx-auto mb-3" />
          <p className="text-zinc-400">Loading returns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Link
                href="/portal/delivery"
                className="text-zinc-400 hover:text-white transition"
                aria-label="Back to delivery"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 text-[#39FF14]" />
              <div>
                <h1 className="text-lg sm:text-xl font-bold">Returns</h1>
                <p className="text-xs text-zinc-500 hidden sm:block">
                  Material returns to warehouse or back to distributors
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
                aria-label="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-3 py-2 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 transition text-sm"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Return</span>
                <span className="sm:hidden">New</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3">
          <StatCard label="Total" value={stats.total} icon={<FileText />} color="text-white" />
          <StatCard
            label="Active"
            value={stats.active}
            icon={<Clock />}
            color="text-amber-400"
          />
          <StatCard
            label="To Warehouse"
            value={stats.toWarehouse}
            icon={<Package />}
            color="text-[#39FF14]"
          />
          <StatCard
            label="To Distributor"
            value={stats.toDistributor}
            icon={<Building2 />}
            color="text-cyan-400"
          />
          <StatCard
            label="Credit Tracked"
            value={formatMoney(stats.totalCredit)}
            icon={<DollarSign />}
            color="text-emerald-400"
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticket, job, item..."
              className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-[#39FF14]"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
          >
            <option value="">All Types</option>
            <option value="return_to_warehouse">Return to Warehouse</option>
            <option value="return_to_distributor">Return to Distributor</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
          >
            <option value="">All Statuses</option>
            {STATUS_FLOW.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Tickets List */}
        <div className="space-y-3">
          {filteredTickets.length === 0 ? (
            <div className="text-center py-12 bg-zinc-900 rounded-2xl border border-zinc-800">
              <RotateCcw className="w-12 h-12 mx-auto text-zinc-700 mb-3" />
              <p className="text-zinc-400">No return tickets found</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 px-4 py-2 bg-[#39FF14] text-black text-sm font-semibold rounded-lg hover:bg-[#39FF14]/90"
              >
                Create your first return
              </button>
            </div>
          ) : (
            filteredTickets.map((ticket) => (
              <TicketRow
                key={ticket.ticketId}
                ticket={ticket}
                expanded={expanded === ticket.ticketId}
                onToggle={() =>
                  setExpanded(expanded === ticket.ticketId ? null : ticket.ticketId)
                }
                onDriverMode={() => setDriverTicket(ticket)}
                onChanged={fetchData}
              />
            ))
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateReturnModal
          catalog={catalog}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            fetchData();
          }}
        />
      )}

      {/* Driver mode */}
      {driverTicket && (
        <DriverModeModal
          ticket={driverTicket}
          onClose={() => setDriverTicket(null)}
          onAdvanced={() => {
            fetchData();
            setDriverTicket(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================
// SUBCOMPONENTS
// ============================================

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-zinc-500">{label}</span>
        <span className={`${color} opacity-60`}>
          <span className="block w-4 h-4">{icon}</span>
        </span>
      </div>
      <div className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function TicketRow({
  ticket,
  expanded,
  onToggle,
  onDriverMode,
  onChanged,
}: {
  ticket: ReturnTicket;
  expanded: boolean;
  onToggle: () => void;
  onDriverMode: () => void;
  onChanged: () => void;
}) {
  const [advancing, setAdvancing] = useState(false);
  const currentIdx = STATUS_FLOW.indexOf(ticket.status);
  const nextStatus = ticket.status === 'cancelled' ? null : STATUS_FLOW[currentIdx + 1] || null;

  const totalQty = ticket.items.reduce((s, i) => s + i.quantity, 0);
  const totalValue = ticket.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const advance = async () => {
    if (!nextStatus) return;
    setAdvancing(true);
    try {
      const res = await fetch('/api/portal/delivery/returns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: ticket.ticketId, status: nextStatus }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`Status update failed: ${j.error || res.status}`);
      } else {
        onChanged();
      }
    } finally {
      setAdvancing(false);
    }
  };

  const cancel = async () => {
    if (!confirm(`Cancel return ${ticket.ticketId}?`)) return;
    setAdvancing(true);
    try {
      await fetch('/api/portal/delivery/returns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: ticket.ticketId, status: 'cancelled' }),
      });
      onChanged();
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-3 sm:p-4 flex items-center gap-3 hover:bg-zinc-800/50 transition text-left"
      >
        <div
          className={`p-2 rounded-lg flex-shrink-0 ${
            ticket.type === 'return_to_warehouse'
              ? 'bg-[#39FF14]/10 text-[#39FF14]'
              : 'bg-cyan-500/10 text-cyan-400'
          }`}
        >
          {ticket.type === 'return_to_warehouse' ? (
            <Package className="w-5 h-5" />
          ) : (
            <Building2 className="w-5 h-5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-zinc-500">{ticket.ticketId}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium uppercase ${STATUS_COLORS[ticket.status]}`}
            >
              {STATUS_LABELS[ticket.status]}
            </span>
          </div>
          <div className="text-sm font-semibold truncate mt-0.5">
            {ticket.type === 'return_to_warehouse'
              ? 'Return to Warehouse'
              : `Return to ${ticket.distributor || 'Distributor'}`}
          </div>
          <div className="text-xs text-zinc-500 truncate">
            {ticket.jobName || 'No job'} · {ticket.items.length} item{ticket.items.length === 1 ? '' : 's'} ({totalQty} units) · {formatDate(ticket.createdAt)}
          </div>
        </div>

        <div className="hidden sm:block text-right">
          <div className="text-sm font-semibold">{formatMoney(totalValue)}</div>
          {ticket.creditAmount && (
            <div className="text-xs text-emerald-400">{formatMoney(ticket.creditAmount)} credit</div>
          )}
        </div>

        {expanded ? (
          <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-500 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 p-3 sm:p-4 space-y-4">
          {/* Items */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-2">Items</h4>
            <div className="space-y-1.5">
              {ticket.items.map((it, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 bg-zinc-950 rounded-lg text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{it.productName}</div>
                    <div className="text-xs text-zinc-500">
                      {it.quantity} × {formatMoney(it.unitPrice)} = {formatMoney(it.quantity * it.unitPrice)}
                    </div>
                  </div>
                  {it.reason && (
                    <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                      {it.reason}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Photos */}
          <PhotoStrip
            label="Pickup photos"
            urls={ticket.pickupPhotos}
            gps={ticket.gpsPickup}
          />
          <PhotoStrip label="In-transit photos" urls={ticket.transitPhotos} />
          <PhotoStrip
            label="Destination photos"
            urls={ticket.deliveryPhotos}
            gps={ticket.gpsDelivery}
          />

          {/* Credit info */}
          {ticket.creditMemoNumber && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
              <div className="text-xs text-emerald-400 uppercase font-semibold">Credit Memo</div>
              <div className="text-sm text-white mt-1">
                {ticket.creditMemoNumber}{' '}
                {ticket.creditAmount && (
                  <span className="text-emerald-400 font-semibold">
                    {formatMoney(ticket.creditAmount)}
                  </span>
                )}
              </div>
            </div>
          )}

          {ticket.notes && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
              <div className="text-xs text-zinc-500 uppercase font-semibold">Notes</div>
              <p className="text-sm text-zinc-300 mt-1 whitespace-pre-wrap">{ticket.notes}</p>
            </div>
          )}

          {/* Actions */}
          {ticket.status !== 'completed' && ticket.status !== 'cancelled' && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={onDriverMode}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition"
              >
                <Truck className="w-4 h-4 text-[#39FF14]" />
                Driver Mode
              </button>
              {nextStatus && (
                <button
                  onClick={advance}
                  disabled={advancing}
                  className="flex items-center gap-2 px-3 py-2 bg-[#39FF14] text-black font-semibold text-sm rounded-lg hover:bg-[#39FF14]/90 disabled:opacity-50"
                >
                  {advancing && <Loader2 className="w-4 h-4 animate-spin" />}
                  Mark {STATUS_LABELS[nextStatus]}
                </button>
              )}
              <button
                onClick={cancel}
                disabled={advancing}
                className="ml-auto flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg hover:bg-red-500/20 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PhotoStrip({ label, urls, gps }: { label: string; urls: string[]; gps?: string }) {
  if (urls.length === 0 && !gps) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-zinc-500 uppercase flex items-center gap-2">
          <Camera className="w-3 h-3" />
          {label}
        </h4>
        {gps && (
          <a
            href={`https://www.google.com/maps?q=${encodeURIComponent(gps)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#39FF14] hover:underline flex items-center gap-1"
          >
            <MapPin className="w-3 h-3" />
            GPS
          </a>
        )}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {urls.map((u, idx) => (
          <a
            key={idx}
            href={u}
            target="_blank"
            rel="noopener noreferrer"
            className="aspect-square bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden hover:border-[#39FF14] transition"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="w-full h-full object-cover" />
          </a>
        ))}
      </div>
    </div>
  );
}

// ============================================
// CREATE MODAL
// ============================================

function CreateReturnModal({
  catalog,
  onClose,
  onCreated,
}: {
  catalog: CatalogItem[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [type, setType] = useState<'return_to_warehouse' | 'return_to_distributor'>(
    'return_to_warehouse'
  );
  const [jobName, setJobName] = useState('');
  const [distributor, setDistributor] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{ productId: string; quantity: number; reason: string }[]>([
    { productId: '', quantity: 1, reason: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addItem = () => setItems([...items, { productId: '', quantity: 1, reason: '' }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, patch: Partial<typeof items[0]>) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const validItems = items.filter((it) => it.productId && it.quantity > 0);
  const total = validItems.reduce((sum, it) => {
    const product = catalog.find((p) => p.productId === it.productId);
    return sum + (product?.unitPrice || 0) * it.quantity;
  }, 0);

  const submit = async () => {
    setError(null);

    if (validItems.length === 0) {
      setError('Add at least one item with product + quantity');
      return;
    }
    if (type === 'return_to_distributor' && !distributor) {
      setError('Select a distributor');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/portal/delivery/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          jobName: jobName.trim() || undefined,
          distributor: type === 'return_to_distributor' ? distributor : undefined,
          items: validItems,
          notes: notes.trim(),
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Create failed (${res.status})`);
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl max-w-xl w-full max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
          <h2 className="font-bold text-white">Create Return Ticket</h2>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Type */}
          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500 mb-2">
              Return Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => setType('return_to_warehouse')}
                className={`p-3 rounded-lg border text-left transition ${
                  type === 'return_to_warehouse'
                    ? 'border-[#39FF14] bg-[#39FF14]/10'
                    : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900'
                }`}
              >
                <Package className="w-5 h-5 mb-1 text-[#39FF14]" />
                <div className="font-semibold text-white text-sm">To Warehouse</div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  Restock + credit memo to job cost
                </div>
              </button>
              <button
                onClick={() => setType('return_to_distributor')}
                className={`p-3 rounded-lg border text-left transition ${
                  type === 'return_to_distributor'
                    ? 'border-cyan-400 bg-cyan-400/10'
                    : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900'
                }`}
              >
                <Building2 className="w-5 h-5 mb-1 text-cyan-400" />
                <div className="font-semibold text-white text-sm">To Distributor</div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  Back to Beacon / Lowe&apos;s / etc.
                </div>
              </button>
            </div>
          </div>

          {type === 'return_to_distributor' && (
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">
                Distributor *
              </label>
              <select
                value={distributor}
                onChange={(e) => setDistributor(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
              >
                <option value="">Select distributor...</option>
                {DISTRIBUTORS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">
              Job Name / Reference
            </label>
            <input
              type="text"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="e.g. Smith - 123 Main St"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-[#39FF14]"
            />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase text-zinc-500">Items</label>
              <button
                onClick={addItem}
                className="flex items-center gap-1 px-2 py-1 text-xs text-[#39FF14] hover:bg-[#39FF14]/10 rounded"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => {
                const product = catalog.find((p) => p.productId === item.productId);
                return (
                  <div
                    key={idx}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 space-y-2"
                  >
                    <div className="flex gap-2 items-start">
                      <select
                        value={item.productId}
                        onChange={(e) => updateItem(idx, { productId: e.target.value })}
                        className="flex-1 min-w-0 px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:border-[#39FF14]"
                      >
                        <option value="">Select product...</option>
                        {catalog.map((p) => (
                          <option key={p.productId} value={p.productId}>
                            {p.productName} ({p.productId})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(idx, { quantity: parseInt(e.target.value) || 1 })
                        }
                        className="w-16 px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:border-[#39FF14]"
                      />
                      {items.length > 1 && (
                        <button
                          onClick={() => removeItem(idx)}
                          className="p-1.5 text-red-400 hover:bg-red-500/10 rounded"
                          aria-label="Remove item"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={item.reason}
                        onChange={(e) => updateItem(idx, { reason: e.target.value })}
                        className="flex-1 px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:border-[#39FF14]"
                      >
                        <option value="">Reason...</option>
                        {REASONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      {product && (
                        <div className="text-xs text-zinc-500 self-center whitespace-nowrap">
                          {formatMoney(product.unitPrice * item.quantity)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-right mt-2 text-sm">
              Total: <span className="font-semibold text-white">{formatMoney(total)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional context..."
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-[#39FF14]"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-zinc-950/95 backdrop-blur-sm border-t border-zinc-800 p-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || validItems.length === 0}
            className="px-4 py-2 text-sm bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Return
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// DRIVER MODE
// ============================================

function DriverModeModal({
  ticket,
  onClose,
  onAdvanced,
}: {
  ticket: ReturnTicket;
  onClose: () => void;
  onAdvanced: () => void;
}) {
  // Determine which photo bucket we're populating based on current status
  const stageForUpload = useMemo(() => {
    switch (ticket.status) {
      case 'created':
        return { key: 'pickupPhotos', label: 'Pickup at Job Site', stage: 'RETURN_PICKUP' };
      case 'picked_up':
        return { key: 'transitPhotos', label: 'On the Way', stage: 'RETURN_TRANSIT' };
      case 'in_transit':
        return { key: 'deliveryPhotos', label: 'Drop-off Photo', stage: 'RETURN_DELIVERY' };
      default:
        return { key: 'deliveryPhotos', label: 'Photo', stage: 'RETURN_DELIVERY' };
    }
  }, [ticket.status]);

  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creditMemo, setCreditMemo] = useState(ticket.creditMemoNumber || '');
  const [creditAmount, setCreditAmount] = useState(ticket.creditAmount || 0);

  const advance = async () => {
    setError(null);
    setSubmitting(true);

    const currentIdx = STATUS_FLOW.indexOf(ticket.status);
    const nextStatus = STATUS_FLOW[currentIdx + 1];

    if (!nextStatus) {
      setError('Already at final stage');
      setSubmitting(false);
      return;
    }

    try {
      // GPS for transitions that need a location stamp
      let gps: string | undefined;
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 6000,
              maximumAge: 60_000,
            });
          });
          gps = `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`;
        } catch {
          // GPS denied — non-fatal
        }
      }

      const photoUrls = uploadedPhotos.map((p) => p.url);
      const updates: any = {};
      if (photoUrls.length > 0) updates[stageForUpload.key] = photoUrls;

      // Stamp GPS at pickup (creating → picked_up) and at drop-off
      if (ticket.status === 'created' && gps) updates.gpsPickup = gps;
      if (ticket.status === 'in_transit' && gps) updates.gpsDelivery = gps;

      // Credit info — only relevant once received
      if (ticket.status === 'received' || ticket.status === 'credited') {
        if (creditMemo) updates.creditMemoNumber = creditMemo;
        if (creditAmount > 0) updates.creditAmount = creditAmount;
      }

      const res = await fetch('/api/portal/delivery/returns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.ticketId,
          status: nextStatus,
          ...updates,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Update failed (${res.status})`);
      }

      onAdvanced();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const isCreditStage = ticket.status === 'received' || ticket.status === 'credited';
  const currentIdx = STATUS_FLOW.indexOf(ticket.status);
  const nextStatus = STATUS_FLOW[currentIdx + 1];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-zinc-950 border-t sm:border border-zinc-800 sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-white truncate">{ticket.ticketId}</h2>
            <p className="text-xs text-zinc-500 truncate">
              {ticket.type === 'return_to_warehouse'
                ? 'Return to Warehouse'
                : `Return to ${ticket.distributor || 'Distributor'}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded ml-2"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status flow */}
        <div className="px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center justify-between text-[10px] font-medium text-zinc-500 mb-2">
            {STATUS_FLOW.map((s, idx) => (
              <span
                key={s}
                className={`uppercase ${idx <= currentIdx ? 'text-[#39FF14]' : ''}`}
              >
                {STATUS_LABELS[s].split(' ')[0]}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {STATUS_FLOW.map((s, idx) => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full ${
                  idx <= currentIdx ? 'bg-[#39FF14]' : 'bg-zinc-800'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Items summary */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="text-xs font-semibold text-zinc-500 uppercase mb-2">Items returning</div>
            {ticket.items.map((it, idx) => (
              <div key={idx} className="flex justify-between text-sm py-1">
                <span className="truncate">
                  {it.quantity} × {it.productName}
                </span>
                <span className="text-zinc-400 whitespace-nowrap ml-2">
                  {formatMoney(it.quantity * it.unitPrice)}
                </span>
              </div>
            ))}
          </div>

          {/* Photo upload (skip for credited → completed) */}
          {nextStatus && nextStatus !== 'completed' && (
            <DriverPhotoUploader
              ticketId={ticket.ticketId}
              stage={stageForUpload.stage}
              label={stageForUpload.label}
              helpText="Photo gets attached to this stage transition"
              onChange={setUploadedPhotos}
              maxPhotos={6}
            />
          )}

          {/* Credit memo (only when distributor return has been received) */}
          {isCreditStage && ticket.type === 'return_to_distributor' && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-emerald-400 uppercase">
                Distributor Credit Memo
              </div>
              <input
                type="text"
                value={creditMemo}
                onChange={(e) => setCreditMemo(e.target.value)}
                placeholder="Credit memo #"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-white text-sm focus:outline-none focus:border-emerald-400"
              />
              <input
                type="number"
                value={creditAmount || ''}
                onChange={(e) => setCreditAmount(parseFloat(e.target.value) || 0)}
                placeholder="Credit amount ($)"
                step="0.01"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-white text-sm focus:outline-none focus:border-emerald-400"
              />
            </div>
          )}

          {/* Confirmation copy when about to receive (will trigger restock or job credit) */}
          {ticket.status === 'in_transit' && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300">
              <strong className="block mb-1">Next: Mark as Received</strong>
              {ticket.type === 'return_to_warehouse' ? (
                <>This will ADD the listed quantities back into stock and credit the job cost.</>
              ) : (
                <>This logs the drop-off at {ticket.distributor}. Inventory is NOT touched — we never owned it again until they issue a credit memo.</>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-zinc-950/95 backdrop-blur-sm border-t border-zinc-800 p-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-lg"
          >
            Close
          </button>
          {nextStatus && (
            <button
              onClick={advance}
              disabled={submitting}
              className="flex-1 sm:flex-none px-4 py-2 text-sm bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <CheckCircle className="w-4 h-4" />
              Mark {STATUS_LABELS[nextStatus]}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
