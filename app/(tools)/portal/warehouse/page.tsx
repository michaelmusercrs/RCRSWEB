'use client';

/**
 * Warehouse Mobile Dashboard (Rick / Tae)
 *
 * Phone-first layout. Shows today's work orders, lets the driver mark
 * status changes, and provides a GPS opt-in toggle. Each ticket has a
 * direct "Open in JobNimbus" button. Cost data is hidden — driver role
 * doesn't see cost on delivery-side surfaces.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Truck,
  Package,
  ExternalLink,
  Camera,
  CheckCircle2,
  Clock,
  RefreshCw,
  Navigation,
  Sun,
  Cloud,
  CloudRain,
  Phone,
  AlertTriangle,
  Plus,
  RotateCcw,
  Building2,
  Users,
  X,
  ImageIcon,
  Circle,
  ChevronRight,
  ClipboardCheck,
  Search,
} from 'lucide-react';
import JobSearchAutocomplete, { type JobSearchHit } from '@/components/JobSearchAutocomplete';

interface Ticket {
  ticketId: string;
  jobNumber: string;
  customerName: string;
  address: string;
  city: string;
  status: string;
  itemCount: number;
  totalPieces: number;
  notes: string;
  jobnimbusUrl: string | null;
  /**
   * 'stock' = pulled from our warehouse (default for legacy tickets).
   * 'other_vendor' = pickup/pass-through from SRS/ABC/etc. — don't touch our
   * inventory.
   */
  orderSource?: 'stock' | 'other_vendor';
  supplierName?: string;
  materials?: Array<{ productName: string; quantity: number; unit?: string }>;
  /** YYYY-MM-DD delivery date (Chicago). Null on legacy/unmigrated tickets. */
  scheduledDate?: string | null;
  scheduleSource?: 'parsed' | 'default' | 'office' | null;
  /** Computed server-side: scheduled before today and still not delivered. */
  overdue?: boolean;
}

interface TodayPayload {
  greeting: string;
  weather: { temp: number | null; condition: string; high: number | null; low: number | null; isWorkable: boolean | null } | null;
  counts: { total: number; created: number; assigned: number; materials_pulled: number; en_route: number; arrived: number; overdue?: number; today?: number; upcoming?: number };
  cities: Array<{ city: string; count: number }>;
  tickets: Ticket[];
  /** Date-aware buckets; absent on an older API build (fall back to tickets). */
  sections?: { overdue: Ticket[]; today: Ticket[]; upcoming: Ticket[] };
}

function countBySource(tickets: Ticket[] | undefined | null): { stock: number; vendor: number } {
  const list = tickets || [];
  let vendor = 0;
  for (const t of list) {
    if (t.orderSource === 'other_vendor') vendor++;
  }
  return { stock: list.length - vendor, vendor };
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  created: { label: 'New', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  assigned: { label: 'Assigned', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
  materials_pulled: { label: 'Pulled', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  load_verified: { label: 'Loaded', color: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  en_route: { label: 'En Route', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  arrived: { label: 'On Site', color: 'bg-pink-500/20 text-pink-300 border-pink-500/40' },
};

function pickWeatherIcon(condition: string) {
  const c = (condition || '').toLowerCase();
  if (c.includes('rain')) return CloudRain;
  if (c.includes('cloud')) return Cloud;
  return Sun;
}

interface SuggestedAgent {
  agentId: string;
  agentName: string;
  company: string;
  city: string;
  address: string;
  daysSinceVisit: number | null;
}

// 'returnMemo' is the merged Return / Credit Memo modal — a STOCK vs OUTSIDE
// toggle inside it replaces the old separate 'creditMemo' / 'vendorReturn'
// modals.
type ModalType = null | 'newTicket' | 'returnMemo' | 'photo' | 'pullList';
type ReturnMode = 'stock' | 'outside';
type PhotoMode = 'job_site_before' | 'delivery_proof' | 'job_site_after';

export default function WarehousePage() {
  const [data, setData] = useState<TodayPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string>('');
  const watchIdRef = useRef<number | null>(null);

  // Driver self-service modals
  const [modal, setModal] = useState<ModalType>(null);
  const [modalContext, setModalContext] = useState<{
    ticketId?: string;
    jobNumber?: string;
    photoMode?: PhotoMode;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  // Pull-checklist: which line-item indices Rick has checked off as pulled.
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  // Autofill from JobNimbus by R-number (New Work Order / Credit Memo / Vendor Return).
  const [jobPrefill, setJobPrefill] = useState<Partial<JobSearchHit>>({});
  // Credit-memo return lines. `fromDelivery` lines are autopopulated from the
  // job's original delivery ticket (returnQty capped at delivered qty);
  // non-fromDelivery lines were added from the stock-catalog dropdown (no cap).
  const [returnLines, setReturnLines] = useState<Array<{ productId: string; productName: string; quantity: number; unit?: string; checked: boolean; returnQty: number; fromDelivery: boolean }>>([]);
  // STOCK (our inventory → credit memo) vs OUTSIDE (vendor return → Sara).
  const [returnMode, setReturnMode] = useState<ReturnMode>('stock');
  // Stock catalog for the add-item dropdown (names + units only — no cost).
  const [catalogItems, setCatalogItems] = useState<Array<{ productId: string; productName: string; unit?: string }>>([]);
  const [addProductId, setAddProductId] = useState('');

  // Suggested agents widget
  const [suggestedAgents, setSuggestedAgents] = useState<SuggestedAgent[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/warehouse/today', { cache: 'no-store' });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const payload = await res.json();
      setData(payload);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch suggested agents — only when the day is light. The widget shows
  // up below the ticket list to give Rick something productive to do on
  // slow days. Pull recommendations for his current city or default area.
  const fetchSuggestedAgents = useCallback(async (city?: string) => {
    try {
      const params = new URLSearchParams({ action: 'suggest', limit: '4' });
      if (city) params.set('location', city);
      const res = await fetch(`/api/portal/insurance-agents?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      const agents = (data.suggestions || data.agents || []).map((a: Record<string, unknown>) => ({
        agentId: a.agentId,
        agentName: a.agentName,
        company: a.company,
        city: a.city,
        address: a.address,
        daysSinceVisit: a.daysSinceLastVisit ?? null,
      }));
      setSuggestedAgents(agents);
    } catch {
      // best-effort — widget just stays empty
    }
  }, []);

  useEffect(() => {
    // Fetch suggestions only when there are 3 or fewer active orders
    // ("slow day" threshold)
    if (data && data.counts.total <= 3) {
      const topCity = data.cities[0]?.city;
      fetchSuggestedAgents(topCity);
    } else {
      setSuggestedAgents([]);
    }
  }, [data, fetchSuggestedAgents]);

  // Fetch the stock catalog for the Return / Credit Memo add-item dropdown.
  // Driver role — the API strips cost server-side; we only keep id/name/unit.
  const loadCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/inventory?action=list');
      if (!res.ok) return;
      const data = await res.json();
      const items = ((data.items || []) as Array<Record<string, unknown>>)
        .map(i => ({
          productId: String(i.productId || ''),
          productName: String(i.productName || ''),
          unit: i.unit ? String(i.unit) : undefined,
        }))
        .filter(i => i.productId && i.productName);
      setCatalogItems(items);
    } catch {
      // best-effort — dropdown just stays empty
    }
  }, []);

  const openModal = (type: ModalType, ctx: typeof modalContext = {}) => {
    if (type === 'pullList') setCheckedItems(new Set());
    if (type === 'returnMemo') {
      setReturnMode('stock');
      setAddProductId('');
      if (catalogItems.length === 0) void loadCatalog();
    }
    setJobPrefill({});
    setReturnLines([]);
    setModalContext(ctx);
    setModal(type);
  };
  const closeModal = () => {
    setModal(null);
    setModalContext({});
    setSubmitting(false);
    setCheckedItems(new Set());
    setJobPrefill({});
    setReturnLines([]);
    setAddProductId('');
  };

  // When a JobNimbus job is picked in the Credit Memo modal, pull that job's
  // original delivery materials so Rick checks off what's coming back instead
  // of typing line items. Reads the canonical Tickets tab via ?reference=.
  const loadReturnLines = useCallback(async (rNumber: string) => {
    // Replace only the delivery-sourced lines — dropdown-added stock lines
    // survive a job (re)pick.
    if (!rNumber) { setReturnLines(prev => prev.filter(l => !l.fromDelivery)); return; }
    try {
      const res = await fetch(`/api/portal/tickets?reference=${encodeURIComponent(rNumber)}`);
      if (!res.ok) { setReturnLines(prev => prev.filter(l => !l.fromDelivery)); return; }
      const t = await res.json();
      const mats = (t?.materials || []) as Array<{ productId: string; productName: string; quantity: number; unit?: string }>;
      const deliveryLines = mats.map(m => ({
        productId: m.productId, productName: m.productName, quantity: m.quantity || 0,
        unit: m.unit, checked: false, returnQty: m.quantity || 0, fromDelivery: true,
      }));
      setReturnLines(prev => [
        ...deliveryLines,
        ...prev.filter(l => !l.fromDelivery && !deliveryLines.some(d => d.productId === l.productId)),
      ]);
    } catch {
      setReturnLines(prev => prev.filter(l => !l.fromDelivery));
    }
  }, []);

  // Add a stock item from the catalog dropdown to the return lines.
  // Rick picks the item; qty defaults to 1 (no delivered-qty cap since this
  // item wasn't on the original delivery ticket).
  const addStockLine = () => {
    const item = catalogItems.find(c => c.productId === addProductId);
    if (!item) return;
    setReturnLines(prev => prev.some(l => l.productId === item.productId)
      ? prev
      : [...prev, {
          productId: item.productId, productName: item.productName, quantity: 0,
          unit: item.unit, checked: true, returnQty: 1, fromDelivery: false,
        }]);
    setAddProductId('');
  };

  const toggleItem = (idx: number) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  // Finalize the pull: (1) upload the "loaded truck" photo, (2) attach it,
  // (3) advance the ticket to materials_pulled if needed, (4) fire verify-load
  // (which runs the load-verified aftermath: invoice + breakdown + deduction).
  const submitLoaded = async (ticket: Ticket, file: File) => {
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('customerId', ticket.ticketId);
      fd.append('customerName', ticket.jobNumber || '');
      const upload = await fetch('/api/customer/upload', { method: 'POST', body: fd });
      if (!upload.ok) throw new Error('Photo upload failed');
      const { url } = await upload.json();

      await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-photo', ticketId: ticket.ticketId,
          photoType: 'truck_loaded', photoUrl: url, uploadedBy: 'driver',
        }),
      });

      if (ticket.status === 'created' || ticket.status === 'assigned') {
        await fetch('/api/portal/tickets', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'pull-materials', ticketId: ticket.ticketId }),
        });
      }

      const res = await fetch('/api/portal/tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-load', ticketId: ticket.ticketId, proofPhotoUrl: url }),
      });
      if (!res.ok) throw new Error('Failed to mark loaded');
      closeModal();
      refresh();
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
      setSubmitting(false);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // GPS opt-in toggle — sends pings to /api/warehouse/gps-ping which fires
  // Tuya stub events at proximity thresholds. Persists choice in localStorage.
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('rcrs_warehouse_gps') : null;
    if (saved === 'on') setGpsEnabled(true);
  }, []);

  useEffect(() => {
    if (!gpsEnabled) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsStatus('');
      return;
    }
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsStatus('GPS not available on this device');
      return;
    }

    const sendPing = async (pos: GeolocationPosition) => {
      try {
        const res = await fetch('/api/warehouse/gps-ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }),
        });
        if (res.ok) {
          const j = await res.json();
          setGpsStatus(`${j.distanceMiles}mi from warehouse${j.triggered.length > 0 ? ` · fired ${j.triggered.join(', ')}` : ''}`);
        }
      } catch {
        setGpsStatus('GPS ping failed');
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      sendPing,
      err => setGpsStatus(`GPS error: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );
    watchIdRef.current = watchId;

    return () => {
      navigator.geolocation.clearWatch(watchId);
      watchIdRef.current = null;
    };
  }, [gpsEnabled]);

  const toggleGps = () => {
    const next = !gpsEnabled;
    setGpsEnabled(next);
    localStorage.setItem('rcrs_warehouse_gps', next ? 'on' : 'off');
  };

  const updateStatus = async (ticketId: string, action: string, payload: Record<string, unknown> = {}) => {
    try {
      const res = await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ticketId, ...payload }),
      });
      if (res.ok) refresh();
      else alert('Failed to update ticket');
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // Submit handlers for the self-service modals
  const submitNewTicket = async (form: FormData) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ticketType: 'delivery',
          createdBy: 'driver-self',
          createdByName: 'Warehouse',
          createdByRole: 'driver',
          jobNumber: form.get('jobNumber'),
          jobName: form.get('jobName'),
          customerName: form.get('customerName'),
          jobAddress: form.get('jobAddress'),
          city: form.get('city'),
          state: form.get('state') || 'AL',
          materials: [],
          specialInstructions: form.get('notes'),
          requestedDate: new Date().toISOString().slice(0, 10),
          priority: 'normal',
        }),
      });
      if (res.ok) {
        closeModal();
        refresh();
      } else {
        alert('Failed to create ticket');
      }
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const submitVendorReturn = async (form: FormData) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/portal/vendor-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobNumber: form.get('jobNumber'),
          customerName: form.get('customerName'),
          pickupAddress: form.get('pickupAddress'),
          vendorName: form.get('vendorName'),
          vendorReceiptNumber: form.get('receiptNumber'),
          notes: form.get('notes'),
          lines: [
            {
              description: form.get('description'),
              quantity: Number(form.get('quantity')) || 1,
              unit: form.get('unit') || undefined,
              estimatedValue: form.get('estValue') ? Number(form.get('estValue')) : undefined,
            },
          ],
        }),
      });
      if (res.ok) {
        closeModal();
        alert('Vendor return submitted. Sara has been notified.');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Failed: ${err.error || res.statusText}`);
      }
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const submitCreditMemo = async (form: FormData) => {
    // Credit memo = return ticket. It MUST carry the actual line items coming
    // back, or the credit posts $0 and restocks nothing (the old bug).
    const lines = returnLines
      .filter(l => l.checked && l.returnQty > 0)
      .map(l => ({ productId: l.productId, productName: l.productName, quantity: l.returnQty, unit: l.unit }));
    if (lines.length === 0) {
      alert('Select at least one item being returned (with a quantity).');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ticketType: 'return',
          createdBy: 'driver-self',
          createdByName: 'Warehouse',
          createdByRole: 'driver',
          jobNumber: form.get('jobNumber') || jobPrefill.rNumber || '',
          customerName: form.get('customerName') || jobPrefill.customerName || '',
          jobAddress: form.get('jobAddress') || jobPrefill.address || '',
          city: form.get('city') || jobPrefill.city || '',
          state: (form.get('state') as string) || jobPrefill.state || 'AL',
          returnReason: form.get('reason'),
          materials: lines,
          requestedDate: new Date().toISOString().slice(0, 10),
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok) {
        closeModal();
        refresh();
        alert(`Credit memo created${result.interofficeInvoiceId ? ` (${result.interofficeInvoiceId})` : ''}. Inventory restocked & posted to the credit ledger.`);
      } else {
        alert(`Failed: ${result.error || res.statusText}`);
      }
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const submitPhoto = async (file: File) => {
    if (!modalContext.ticketId || !modalContext.photoMode) return;
    setSubmitting(true);
    try {
      // Upload to /api/customer/upload (existing Vercel Blob endpoint)
      const fd = new FormData();
      fd.append('file', file);
      fd.append('customerId', modalContext.ticketId);
      fd.append('customerName', modalContext.jobNumber || '');
      const upload = await fetch('/api/customer/upload', { method: 'POST', body: fd });
      if (!upload.ok) throw new Error('Upload failed');
      const { url } = await upload.json();

      // Attach the photo to the ticket
      const res = await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-photo',
          ticketId: modalContext.ticketId,
          photoType: modalContext.photoMode,
          photoUrl: url,
          uploadedBy: 'driver',
        }),
      });
      if (res.ok) {
        closeModal();
        refresh();
      } else {
        alert('Failed to attach photo');
      }
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const WeatherIcon = pickWeatherIcon(data?.weather?.condition || '');

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 bg-black/95 backdrop-blur border-b border-zinc-800">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">{data?.greeting || 'Warehouse'}</div>
            <div className="text-2xl font-black text-[#39FF14]">RCRS Warehouse</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="p-2 rounded-lg bg-zinc-800 active:bg-zinc-700"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link
              href="/portal/warehouse/display"
              target="_blank"
              className="p-2 rounded-lg bg-zinc-800 active:bg-zinc-700"
              title="Open TV display"
            >
              <ExternalLink className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-xl p-3 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}

        {/* Top stats card */}
        {data && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-[#39FF14]/20 to-lime-900/40 rounded-2xl p-4 border border-[#39FF14]/40">
              <div className="flex items-center gap-2 text-[#39FF14] text-xs font-semibold uppercase">
                <Truck className="w-4 h-4" /> Today
              </div>
              <div className="text-5xl font-black text-[#39FF14] tabular-nums leading-tight mt-1">
                {data.counts.total}
              </div>
              <div className="text-xs text-lime-200">{data.counts.total === 1 ? 'work order' : 'work orders'}</div>
            </div>
            <div className="bg-gradient-to-br from-blue-900/40 to-zinc-900 rounded-2xl p-4 border border-blue-800/50">
              <div className="flex items-center gap-2 text-blue-300 text-xs font-semibold uppercase">
                <WeatherIcon className="w-4 h-4" /> Weather
              </div>
              <div className="text-5xl font-black tabular-nums leading-tight mt-1">
                {data.weather?.temp != null ? `${Math.round(data.weather.temp)}°` : '—'}
              </div>
              <div className="text-xs text-blue-200 capitalize truncate">
                {data.weather?.condition || 'Decatur'}
              </div>
            </div>
          </div>
        )}

        {/* GPS opt-in */}
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Navigation className={`w-5 h-5 ${gpsEnabled ? 'text-[#39FF14]' : 'text-gray-500'}`} />
              <div>
                <div className="font-bold">Warehouse Auto-Ready</div>
                <div className="text-xs text-gray-400">
                  {gpsEnabled
                    ? 'GPS sharing on — lights/garage/HVAC will trigger as you approach'
                    : 'Tap to enable GPS auto-triggers'}
                </div>
              </div>
            </div>
            <button
              onClick={toggleGps}
              className={`px-4 py-2 rounded-full font-bold text-sm ${
                gpsEnabled ? 'bg-[#39FF14] text-black' : 'bg-zinc-700 text-gray-300'
              }`}
            >
              {gpsEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
          {gpsEnabled && gpsStatus && (
            <div className="mt-3 text-xs text-gray-400 font-mono bg-black/40 rounded-lg px-3 py-2">
              {gpsStatus}
            </div>
          )}
        </div>

        {/* Today's route — multi-stop Google Maps deep link */}
        {data && data.tickets.length > 0 && (() => {
          // Build a Google Maps directions URL with all stops in order.
          // Format: https://www.google.com/maps/dir/?api=1&origin=...&destination=...&waypoints=...|...
          // Origin = warehouse, destination = last stop, waypoints = everything in between.
          // Filter out tickets without an address.
          const withAddr = data.tickets.filter(t => t.address && t.address.trim().length > 0);
          if (withAddr.length === 0) return null;

          const warehouse = '3325 Central Pkwy SW, Decatur, AL 35603';
          const stops = withAddr.map(t => t.address);
          const destination = stops[stops.length - 1];
          const waypoints = stops.slice(0, -1);

          const params = new URLSearchParams({
            api: '1',
            origin: warehouse,
            destination,
            travelmode: 'driving',
          });
          if (waypoints.length > 0) {
            params.set('waypoints', waypoints.join('|'));
          }
          const mapsUrl = `https://www.google.com/maps/dir/?${params.toString()}`;

          return (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-gradient-to-br from-[#0066CC] to-blue-900 rounded-2xl p-4 border border-blue-700 active:from-[#0066CC]/80"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center">
                    <Navigation className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-white">Today&apos;s Route</div>
                    <div className="text-xs text-blue-200">
                      {withAddr.length} stop{withAddr.length === 1 ? '' : 's'} · open in Google Maps
                    </div>
                  </div>
                </div>
                <ExternalLink className="w-5 h-5 text-white/70" />
              </div>
            </a>
          );
        })()}

        {/* Quick actions — 6-up grid for self-service */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => openModal('newTicket')}
            className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800 active:bg-zinc-800 flex flex-col items-center gap-1.5"
          >
            <Plus className="w-6 h-6 text-[#39FF14]" />
            <div className="font-bold text-xs text-center">New Ticket</div>
          </button>
          <button
            onClick={() => openModal('returnMemo')}
            className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800 active:bg-zinc-800 flex flex-col items-center gap-1.5"
          >
            <RotateCcw className="w-6 h-6 text-orange-400" />
            <div className="font-bold text-xs text-center">Return / Credit Memo</div>
          </button>
          <Link
            href="/portal/inventory/restock"
            className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800 active:bg-zinc-800 flex flex-col items-center gap-1.5"
          >
            <Package className="w-6 h-6 text-[#0066CC]" />
            <div className="font-bold text-xs text-center">Receive Stock</div>
          </Link>
          <Link
            href="/portal/inventory/reconciliation"
            className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800 active:bg-zinc-800 flex flex-col items-center gap-1.5"
          >
            <Camera className="w-6 h-6 text-[#39FF14]" />
            <div className="font-bold text-xs text-center">Weekly Count</div>
          </Link>
          <Link
            href="/portal/insurance-agents"
            className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800 active:bg-zinc-800 flex flex-col items-center gap-1.5"
          >
            <Users className="w-6 h-6 text-blue-400" />
            <div className="font-bold text-xs text-center">Agents</div>
          </Link>
        </div>

        {/* Tickets list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-300">Active Work Orders</h2>
            {(() => {
              const split = countBySource(data?.tickets);
              return (
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-[#39FF14]/15 text-[#39FF14] border border-[#39FF14]/30 font-bold">
                    Stock: {split.stock}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 font-bold">
                    Vendor: {split.vendor}
                  </span>
                </div>
              );
            })()}
          </div>

          {loading && !data && (
            <div className="text-center text-gray-500 py-8">Loading...</div>
          )}

          {data && data.tickets.length === 0 && (
            <div className="bg-zinc-900 rounded-2xl p-8 text-center border border-zinc-800">
              <CheckCircle2 className="w-10 h-10 text-[#39FF14] mx-auto mb-2" />
              <div className="text-lg font-bold">All caught up</div>
              <div className="text-sm text-gray-500">
                {data.sections?.upcoming.length
                  ? `Nothing due today — ${data.sections.upcoming.length} upcoming scheduled ahead`
                  : 'No active orders right now'}
              </div>
            </div>
          )}

          {(() => {
            // Shared card renderer — used by the date-aware sections below
            // (and by the flat-list fallback when the API predates sections).
            const todayLocal = new Date().toLocaleDateString('en-CA');
            const renderTicketCard = (t: Ticket) => {
              const status = STATUS_LABELS[t.status] || { label: t.status, color: 'bg-gray-700 text-gray-300' };
              return (
                <div key={t.ticketId} className={`bg-zinc-900 rounded-2xl p-4 border ${t.overdue ? 'border-red-600' : 'border-zinc-800'}`}>
                  {t.overdue && (
                    <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-1.5 mb-2 text-xs font-black text-red-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      OVERDUE — was scheduled {t.scheduledDate}
                    </div>
                  )}
                  {!t.overdue && t.scheduledDate && t.scheduledDate !== todayLocal && (
                    <div className="bg-blue-900/30 border border-blue-700/40 rounded-lg px-3 py-1.5 mb-2 text-xs font-bold text-blue-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                      Scheduled {t.scheduledDate}
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-2xl font-black text-[#39FF14]">{t.jobNumber}</div>
                      <div className="text-base font-bold mt-0.5">{t.customerName}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {/* Source badge — green STOCK vs purple VENDOR so Rick
                          spots at a glance whether to pull from our
                          warehouse or drive to an outside supplier. */}
                      {t.orderSource === 'other_vendor' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-purple-500/15 text-purple-300 border-purple-500/40">
                          VENDOR
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#39FF14]/15 text-[#39FF14] border-[#39FF14]/40">
                          STOCK
                        </span>
                      )}
                      <span className={`px-2 py-1 rounded-full text-xs font-bold border ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-400 flex items-center gap-1.5 mb-3">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{t.address}</span>
                  </div>
                  <button
                    onClick={() => openModal('pullList', { ticketId: t.ticketId, jobNumber: t.jobNumber })}
                    className="w-full flex items-center justify-between gap-2 bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2.5 mb-3 active:bg-zinc-800"
                  >
                    <span className="flex items-center gap-2 text-sm text-gray-200">
                      <Package className="w-4 h-4 text-[#39FF14]" /> {t.itemCount} items · {t.totalPieces} pieces
                    </span>
                    <span className="flex items-center gap-1 text-[#39FF14] font-bold text-xs">
                      Open Pull List <ChevronRight className="w-4 h-4" />
                    </span>
                  </button>
                  {t.notes && (
                    <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-2 text-xs text-yellow-200 mb-3">
                      {t.notes}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {t.jobnimbusUrl && (
                      <a
                        href={t.jobnimbusUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-[#0066CC] text-white text-sm font-bold py-2.5 rounded-lg flex items-center justify-center gap-1 active:bg-[#0066CC]/80"
                      >
                        <ExternalLink className="w-4 h-4" /> JN Job
                      </a>
                    )}
                    {(t.status === 'created' || t.status === 'assigned') && (
                      <button
                        onClick={() => updateStatus(t.ticketId, 'pull-materials')}
                        className="bg-yellow-500 text-black text-sm font-bold py-2.5 rounded-lg active:bg-yellow-600"
                      >
                        Pull Materials
                      </button>
                    )}
                    {t.status === 'materials_pulled' && (
                      <button
                        onClick={() => updateStatus(t.ticketId, 'verify-load')}
                        className="bg-orange-500 text-white text-sm font-bold py-2.5 rounded-lg active:bg-orange-600"
                      >
                        Mark Loaded
                      </button>
                    )}
                    {t.status === 'load_verified' && (
                      <button
                        onClick={() => updateStatus(t.ticketId, 'start-delivery')}
                        className="bg-purple-500 text-white text-sm font-bold py-2.5 rounded-lg active:bg-purple-600"
                      >
                        Start Delivery
                      </button>
                    )}
                    {t.status === 'en_route' && (
                      <button
                        onClick={() => updateStatus(t.ticketId, 'mark-arrived')}
                        className="bg-pink-500 text-white text-sm font-bold py-2.5 rounded-lg active:bg-pink-600"
                      >
                        Arrived
                      </button>
                    )}
                    {t.status === 'arrived' && (
                      <button
                        onClick={() => updateStatus(t.ticketId, 'complete-delivery')}
                        className="bg-[#39FF14] text-black text-sm font-bold py-2.5 rounded-lg active:bg-lime-500"
                      >
                        Delivered
                      </button>
                    )}
                  </div>

                  {/* Photo capture row — pre-delivery + post-delivery */}
                  {(t.status === 'arrived' || t.status === 'en_route') && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        onClick={() => openModal('photo', { ticketId: t.ticketId, jobNumber: t.jobNumber, photoMode: 'job_site_before' })}
                        className="bg-zinc-800 text-white text-xs font-bold py-2 rounded-lg active:bg-zinc-700 flex items-center justify-center gap-1"
                      >
                        <Camera className="w-3.5 h-3.5" /> Pre-Photo
                      </button>
                      <button
                        onClick={() => openModal('photo', { ticketId: t.ticketId, jobNumber: t.jobNumber, photoMode: 'delivery_proof' })}
                        className="bg-zinc-800 text-white text-xs font-bold py-2 rounded-lg active:bg-zinc-700 flex items-center justify-center gap-1"
                      >
                        <ImageIcon className="w-3.5 h-3.5" /> Drop-Off
                      </button>
                    </div>
                  )}
                </div>
              );
            };

            const sections = data?.sections;
            // Older API build (no sections): flat list, unchanged behavior.
            if (!sections) {
              return <div className="space-y-3">{(data?.tickets || []).map(renderTicketCard)}</div>;
            }
            return (
              <div className="space-y-4">
                {/* OVERDUE — always on top, loud. */}
                {sections.overdue.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-red-400 font-black text-sm uppercase tracking-wide">
                      <AlertTriangle className="w-4 h-4" /> Overdue ({sections.overdue.length})
                    </div>
                    <div className="space-y-3">{sections.overdue.map(renderTicketCard)}</div>
                  </div>
                )}

                {/* TODAY — includes undated tickets so nothing can hide. */}
                {sections.today.length > 0 && (
                  <div>
                    {(sections.overdue.length > 0 || sections.upcoming.length > 0) && (
                      <div className="flex items-center gap-2 mb-2 text-gray-400 font-black text-sm uppercase tracking-wide">
                        <Truck className="w-4 h-4" /> Today ({sections.today.length})
                      </div>
                    )}
                    <div className="space-y-3">{sections.today.map(renderTicketCard)}</div>
                  </div>
                )}

                {/* UPCOMING — collapsed; count visible so Rick knows what's ahead. */}
                {sections.upcoming.length > 0 && (
                  <details className="bg-zinc-900 rounded-2xl border border-zinc-800">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-gray-300 select-none flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      Upcoming ({sections.upcoming.length}) — scheduled after today
                    </summary>
                    <div className="p-3 pt-0 space-y-3">{sections.upcoming.map(renderTicketCard)}</div>
                  </details>
                )}
              </div>
            );
          })()}
        </div>

        {/* Suggested agents — slow day filler */}
        {suggestedAgents.length > 0 && (
          <div className="bg-gradient-to-br from-blue-900/30 to-zinc-900 rounded-2xl p-4 border border-blue-700/30">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-blue-300" />
              <h3 className="font-bold text-blue-200">Slow day? Drop in on these agents</h3>
            </div>
            <div className="space-y-2">
              {suggestedAgents.map(a => (
                <Link
                  key={a.agentId}
                  href={`/portal/insurance-agents?agentId=${a.agentId}`}
                  className="block bg-zinc-900/80 rounded-xl p-3 border border-zinc-800 active:bg-zinc-800"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm">{a.agentName}</div>
                      <div className="text-xs text-blue-300">{a.company}</div>
                      <div className="text-xs text-gray-500 truncate mt-0.5">{a.address}, {a.city}</div>
                    </div>
                    <span className="text-xs text-gray-500 shrink-0 ml-2">
                      {a.daysSinceVisit == null ? 'never' : `${a.daysSinceVisit}d ago`}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Office contact */}
        <a
          href="tel:2562748530"
          className="block bg-zinc-900 rounded-2xl p-4 border border-zinc-800 text-center"
        >
          <Phone className="w-5 h-5 inline-block mr-2 text-[#0066CC]" />
          <span className="font-bold">Call Office (256) 274-8530</span>
        </a>
      </main>

      {/* ===================== MODALS ===================== */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-end md:items-center justify-center p-4">
          <div className="bg-zinc-950 rounded-2xl border border-zinc-800 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-5 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {modal === 'newTicket' && 'New Work Order'}
                {modal === 'returnMemo' && 'Return / Credit Memo'}
                {modal === 'pullList' && 'Pull List'}
                {modal === 'photo' && (
                  modalContext.photoMode === 'job_site_before' ? 'Pre-Delivery Photo' :
                  modalContext.photoMode === 'delivery_proof' ? 'Drop-Off Proof Photo' :
                  'Job Site Photo'
                )}
              </h2>
              <button onClick={closeModal} className="p-1 rounded-lg hover:bg-zinc-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              {modal === 'newTicket' && (
                <form
                  onSubmit={e => { e.preventDefault(); submitNewTicket(new FormData(e.currentTarget)); }}
                  className="space-y-3"
                >
                  <p className="text-xs text-gray-500">
                    Use this when you need to start a delivery yourself instead of waiting for the email.
                    Sara will be notified just like the email-driven workflow.
                  </p>
                  <div className="text-[11px] text-[#39FF14] font-semibold flex items-center gap-1">
                    <Search className="w-3 h-3" /> Type the R-number to auto-fill from JobNimbus
                  </div>
                  <JobSearchAutocomplete
                    onSelect={setJobPrefill}
                    onInputChange={v => setJobPrefill(p => ({ ...p, rNumber: v }))}
                    placeholder="R-number, customer, or address…"
                  />
                  <input type="hidden" name="jobNumber" value={jobPrefill.rNumber || ''} readOnly />
                  <div key={jobPrefill.jnid || 'blank'} className="space-y-3">
                    <input name="customerName" defaultValue={jobPrefill.customerName || ''} placeholder="Customer name" required className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500" />
                    <input name="jobName" defaultValue={jobPrefill.jobName || ''} placeholder="Job name (optional)" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500" />
                    <input name="jobAddress" defaultValue={jobPrefill.address || ''} placeholder="Address" required className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500" />
                    <div className="grid grid-cols-2 gap-2">
                      <input name="city" defaultValue={jobPrefill.city || ''} placeholder="City" required className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500" />
                      <input name="state" defaultValue={jobPrefill.state || 'AL'} placeholder="State" className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500" />
                    </div>
                  </div>
                  <textarea name="notes" placeholder="Special instructions / what you're loading" rows={3} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500" />
                  <button type="submit" disabled={submitting} className="w-full bg-[#39FF14] text-black font-bold py-3 rounded-lg active:bg-lime-500 disabled:opacity-50">
                    {submitting ? 'Creating…' : 'Create Ticket'}
                  </button>
                </form>
              )}

              {modal === 'returnMemo' && (
                <div className="space-y-3">
                  {/* STOCK vs OUTSIDE toggle */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setReturnMode('stock')}
                      className={`rounded-xl px-3 py-2.5 border text-sm font-bold flex flex-col items-center gap-0.5 ${
                        returnMode === 'stock'
                          ? 'bg-[#39FF14]/15 border-[#39FF14]/50 text-[#39FF14]'
                          : 'bg-zinc-900 border-zinc-700 text-gray-400'
                      }`}
                    >
                      <span className="flex items-center gap-1.5"><Package className="w-4 h-4" /> STOCK</span>
                      <span className="text-[10px] font-normal">Our inventory → credit memo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnMode('outside')}
                      className={`rounded-xl px-3 py-2.5 border text-sm font-bold flex flex-col items-center gap-0.5 ${
                        returnMode === 'outside'
                          ? 'bg-purple-500/15 border-purple-500/50 text-purple-300'
                          : 'bg-zinc-900 border-zinc-700 text-gray-400'
                      }`}
                    >
                      <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4" /> OUTSIDE</span>
                      <span className="text-[10px] font-normal">Vendor material → Sara</span>
                    </button>
                  </div>

                  {returnMode === 'stock' && (
                    <form
                      onSubmit={e => { e.preventDefault(); submitCreditMemo(new FormData(e.currentTarget)); }}
                      className="space-y-3"
                    >
                      <p className="text-xs text-gray-500">
                        Use when you bring OUR materials back from a job. Restocks inventory and posts a credit
                        memo against the job&apos;s material ledger.
                      </p>
                      <div className="text-[11px] text-[#39FF14] font-semibold flex items-center gap-1">
                        <Search className="w-3 h-3" /> Type the R-number to pull the job &amp; its delivered items
                      </div>
                      <JobSearchAutocomplete
                        onSelect={hit => { setJobPrefill(hit); loadReturnLines(hit.rNumber); }}
                        onInputChange={v => setJobPrefill(p => ({ ...p, rNumber: v }))}
                        placeholder="R-number, customer, or address…"
                      />
                      <input type="hidden" name="jobNumber" value={jobPrefill.rNumber || ''} readOnly />
                      <div key={jobPrefill.jnid || 'blank'} className="space-y-3">
                        <input name="customerName" defaultValue={jobPrefill.customerName || ''} placeholder="Customer name" required className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500" />
                        <input name="jobAddress" defaultValue={jobPrefill.address || ''} placeholder="Pickup address (optional)" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500" />
                        <input name="city" defaultValue={jobPrefill.city || ''} placeholder="City" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500" />
                        <input type="hidden" name="state" value={jobPrefill.state || 'AL'} readOnly />
                      </div>
                      <div className="border-t border-zinc-800 pt-3">
                        <div className="text-xs text-gray-400 font-semibold uppercase mb-2">Items coming back</div>
                        {returnLines.length === 0 ? (
                          <div className="text-xs text-gray-500 bg-zinc-900 rounded-lg p-3 text-center">
                            Pick a job above to load its delivered items, or add stock items below.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {returnLines.map((l, i) => (
                              <div key={i} className={`flex items-center gap-2 rounded-lg border px-2 py-2 ${l.checked ? 'bg-[#39FF14]/10 border-[#39FF14]/40' : 'bg-zinc-900 border-zinc-700'}`}>
                                <button
                                  type="button"
                                  onClick={() => setReturnLines(rl => rl.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)))}
                                >
                                  {l.checked ? <CheckCircle2 className="w-5 h-5 text-[#39FF14]" /> : <Circle className="w-5 h-5 text-zinc-500" />}
                                </button>
                                <span className="flex-1 text-sm text-white truncate">{l.productName}</span>
                                <input
                                  type="number"
                                  min={0}
                                  {...(l.fromDelivery ? { max: l.quantity } : {})}
                                  step={1}
                                  value={l.returnQty}
                                  onChange={e => {
                                    const raw = Math.max(0, Number(e.target.value) || 0);
                                    const v = l.fromDelivery ? Math.min(l.quantity, raw) : raw;
                                    setReturnLines(rl => rl.map((x, j) => (j === i ? { ...x, returnQty: v, checked: v > 0 } : x)));
                                  }}
                                  className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white text-right"
                                />
                                <span className="text-[10px] text-gray-500 w-10">
                                  {l.fromDelivery ? `/ ${l.quantity}` : (l.unit || 'added')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Add any stock item from the catalog (not on the delivery) */}
                        <div className="flex items-center gap-2 mt-2">
                          <select
                            value={addProductId}
                            onChange={e => setAddProductId(e.target.value)}
                            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-2 text-sm text-white"
                          >
                            <option value="">+ Add stock item…</option>
                            {catalogItems
                              .filter(c => !returnLines.some(l => l.productId === c.productId))
                              .map(c => (
                                <option key={c.productId} value={c.productId}>{c.productName}</option>
                              ))}
                          </select>
                          <button
                            type="button"
                            onClick={addStockLine}
                            disabled={!addProductId}
                            className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm font-bold text-[#39FF14] disabled:opacity-40"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <textarea name="reason" placeholder="What came back and why" rows={2} required className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500" />
                      <button type="submit" disabled={submitting} className="w-full bg-orange-500 text-white font-bold py-3 rounded-lg active:bg-orange-600 disabled:opacity-50">
                        {submitting ? 'Submitting…' : 'Create Credit Memo'}
                      </button>
                    </form>
                  )}

                  {returnMode === 'outside' && (
                    <form
                      onSubmit={e => { e.preventDefault(); submitVendorReturn(new FormData(e.currentTarget)); }}
                      className="space-y-3"
                    >
                      <p className="text-xs text-gray-500">
                        Use when you pick up materials from a job that came from an OUTSIDE vendor (SRS, ABC, GAF Direct, etc.) — NOT our inventory. Sara will chase the vendor credit. Our stock is NOT restocked.
                      </p>
                      <div className="text-[11px] text-[#39FF14] font-semibold flex items-center gap-1">
                        <Search className="w-3 h-3" /> Type the R-number to auto-fill from JobNimbus
                      </div>
                      <JobSearchAutocomplete
                        onSelect={setJobPrefill}
                        onInputChange={v => setJobPrefill(p => ({ ...p, rNumber: v }))}
                        placeholder="R-number, customer, or address…"
                      />
                      <input type="hidden" name="jobNumber" value={jobPrefill.rNumber || ''} readOnly />
                      <div key={jobPrefill.jnid || 'blank'} className="space-y-3">
                        <input name="customerName" defaultValue={jobPrefill.customerName || ''} placeholder="Customer name" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500" />
                        <input name="pickupAddress" defaultValue={jobPrefill.address || ''} placeholder="Pickup address" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500" />
                      </div>
                      <input name="vendorName" placeholder="Vendor (SRS, ABC, GAF…)" required className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500" />
                      <input name="receiptNumber" placeholder="Vendor receipt # (if known)" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500" />
                      <div className="border-t border-zinc-800 pt-3 space-y-2">
                        <div className="text-xs text-gray-400 font-semibold uppercase">Material picked up</div>
                        <input name="description" placeholder="Description" required className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500" />
                        <div className="grid grid-cols-3 gap-2">
                          <input name="quantity" type="number" step="1" placeholder="Qty" required className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500" />
                          <input name="unit" placeholder="Unit" className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500" />
                          <input name="estValue" type="number" step="0.01" placeholder="Est. $" className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500" />
                        </div>
                      </div>
                      <textarea name="notes" placeholder="Notes for Sara" rows={2} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500" />
                      <button type="submit" disabled={submitting} className="w-full bg-purple-500 text-white font-bold py-3 rounded-lg active:bg-purple-600 disabled:opacity-50">
                        {submitting ? 'Submitting…' : 'Send to Sara'}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {modal === 'photo' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">
                    {modalContext.photoMode === 'job_site_before' && 'Snap the job site BEFORE you unload — captures the existing condition.'}
                    {modalContext.photoMode === 'delivery_proof' && 'Snap the materials AFTER you drop them off — proof they arrived.'}
                  </p>
                  <label className="block bg-zinc-900 border-2 border-dashed border-[#39FF14]/40 rounded-2xl p-8 text-center cursor-pointer active:bg-zinc-800">
                    <Camera className="w-10 h-10 text-[#39FF14] mx-auto mb-2" />
                    <div className="font-bold">Tap to take photo</div>
                    <div className="text-xs text-gray-500 mt-1">Camera or gallery</div>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      disabled={submitting}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) submitPhoto(file);
                      }}
                    />
                  </label>
                  {submitting && (
                    <div className="text-center text-sm text-gray-400">Uploading…</div>
                  )}
                </div>
              )}

              {modal === 'pullList' && (() => {
                const plTicket = data?.tickets.find(t => t.ticketId === modalContext.ticketId);
                if (!plTicket) return <div className="text-sm text-gray-400">Ticket not found — pull to refresh.</div>;
                const mats = plTicket.materials || [];
                const allChecked = mats.length > 0 && mats.every((_, i) => checkedItems.has(i));
                return (
                  <div className="space-y-3">
                    <div>
                      <div className="text-base font-bold">{plTicket.customerName}</div>
                      <div className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                        <MapPin className="w-3.5 h-3.5" /> {plTicket.address}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-gray-400">
                        <ClipboardCheck className="w-3.5 h-3.5" /> Check each item as you pull it
                      </span>
                      <span className={`font-bold ${allChecked ? 'text-[#39FF14]' : 'text-gray-300'}`}>
                        {checkedItems.size} / {mats.length} pulled
                      </span>
                    </div>
                    {mats.length === 0 ? (
                      <div className="text-sm text-gray-500 bg-zinc-900 rounded-lg p-4 text-center">
                        No line items on this ticket.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {mats.map((m, i) => {
                          const done = checkedItems.has(i);
                          return (
                            <button
                              key={i}
                              onClick={() => toggleItem(i)}
                              className={`w-full flex items-center gap-3 rounded-lg border px-3 py-3 text-left ${done ? 'bg-[#39FF14]/10 border-[#39FF14]/40' : 'bg-zinc-900 border-zinc-700'}`}
                            >
                              {done
                                ? <CheckCircle2 className="w-6 h-6 text-[#39FF14] flex-shrink-0" />
                                : <Circle className="w-6 h-6 text-zinc-500 flex-shrink-0" />}
                              <span className={`flex-1 text-sm font-semibold ${done ? 'text-gray-300 line-through' : 'text-white'}`}>
                                {m.productName}
                              </span>
                              <span className="text-sm font-bold text-[#39FF14] flex-shrink-0">
                                {m.quantity}{m.unit ? ` ${m.unit}` : ''}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="border-t border-zinc-800 pt-3">
                      {!allChecked ? (
                        <div className="text-center text-xs text-gray-500 py-2">
                          {mats.length === 0 ? 'Nothing to pull.' : `Check off all ${mats.length} items to load the truck.`}
                        </div>
                      ) : (
                        <label className={`block bg-zinc-900 border-2 border-dashed border-[#39FF14]/50 rounded-2xl p-6 text-center cursor-pointer active:bg-zinc-800 ${submitting ? 'opacity-50 pointer-events-none' : ''}`}>
                          <Camera className="w-9 h-9 text-[#39FF14] mx-auto mb-2" />
                          <div className="font-bold">Take Photo of Loaded Truck</div>
                          <div className="text-xs text-gray-500 mt-1">Required — proof it&apos;s loaded</div>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            disabled={submitting}
                            onChange={e => { const f = e.target.files?.[0]; if (f) submitLoaded(plTicket, f); }}
                          />
                        </label>
                      )}
                      {submitting && (
                        <div className="text-center text-sm text-gray-400 mt-2">Loading truck & posting invoice…</div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
