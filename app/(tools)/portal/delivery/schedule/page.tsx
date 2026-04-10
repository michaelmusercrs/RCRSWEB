'use client';

/**
 * Delivery Schedule (Week View)
 *
 * Purpose:
 *   Give John, Bart, Chris, Michael (and other authorized staff) a calendar
 *   view of driver assignments for the current week so they can reassign
 *   deliveries with a click.
 *
 * Role gating:
 *   UI restricts access to owner / admin / manager / project_manager / office.
 *   The API route enforces the same check server-side — this is just UX.
 *
 * Data flow:
 *   - GET  /api/portal/delivery/work-orders                (list all, filter client-side to current week)
 *   - POST /api/portal/delivery/work-orders { action: 'schedule' | 'assign-driver' }
 *
 * Week math:
 *   getWeekStart() returns the Monday at 00:00 local for a given date.
 *   Weeks are Mon–Sun and navigate in 7-day steps.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  AlertCircle,
  X,
  Loader2,
  Truck,
  User as UserIcon,
  Clock,
  Package,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getDrivers } from '@/lib/team-roles';

// --- Types (mirror work-order-service.WorkOrder, but only the fields we use) ---
interface WorkOrderAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

interface ScheduleWorkOrder {
  workOrderId: string;
  jobId: string;
  jobNumber?: string;
  customerName: string;
  address: WorkOrderAddress;
  type: string;
  priority: 'low' | 'normal' | 'rush' | 'urgent';
  status: string;
  scheduledDate: string;   // YYYY-MM-DD (may be empty)
  scheduledTime: string;   // HH:MM or empty
  assignedDriver: string;  // may be empty
  vehicleType: string;
}

// Roles allowed to use this page. Must match the server-side gate in
// app/api/portal/delivery/work-orders/route.ts (ALLOWED_SCHEDULER_ROLES).
const ALLOWED_ROLES = ['owner', 'admin', 'manager', 'project_manager', 'office'];

// Statuses that belong on the schedule grid. Completed/cancelled drop off.
const SCHEDULED_STATUSES = new Set(['scheduled', 'assigned', 'in_progress']);

const PRIORITY_PILL: Record<string, string> = {
  low:     'bg-zinc-700/40 text-zinc-300 border-zinc-600/40',
  normal:  'bg-brand-green/10 text-brand-green border-brand-green/30',
  rush:    'bg-orange-500/10 text-orange-300 border-orange-500/30',
  urgent:  'bg-red-500/10 text-red-300 border-red-500/30',
};

// --- Date helpers (all operate in local time) ---

/** Return the Monday 00:00 local for the week containing `d`. */
function getWeekStart(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = out.getDay(); // 0 = Sun, 1 = Mon, ... 6 = Sat
  const diff = dow === 0 ? -6 : 1 - dow; // Monday offset
  out.setDate(out.getDate() + diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** YYYY-MM-DD in local time (not UTC — matches how users think about days). */
function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const startStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = sameMonth
    ? weekEnd.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })
    : weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// --- Page ---

export default function DeliverySchedulePage() {
  const { user, isLoading: authLoading } = useAuth();

  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [workOrders, setWorkOrders] = useState<ScheduleWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ScheduleWorkOrder | null>(null);

  // Modal form state (reassign / reschedule)
  const [formDriver, setFormDriver] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const allowed = !!user && ALLOWED_ROLES.includes(user.role);
  const drivers = useMemo(() => getDrivers(), []);

  // Week columns (7 dates)
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const weekYMDs = useMemo(() => weekDates.map(toYMD), [weekDates]);

  const loadWorkOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/delivery/work-orders', {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const json = await res.json();
      const list: ScheduleWorkOrder[] = json.workOrders || [];
      setWorkOrders(list);
    } catch (err) {
      console.error('Failed to load work orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to load work orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) void loadWorkOrders();
  }, [allowed, loadWorkOrders]);

  // Filter to this week's scheduled deliveries
  const weekWorkOrders = useMemo(() => {
    const firstYMD = weekYMDs[0];
    const lastYMD = weekYMDs[6];
    return workOrders.filter(wo => {
      if (!SCHEDULED_STATUSES.has(wo.status)) return false;
      if (!wo.scheduledDate) return false;
      return wo.scheduledDate >= firstYMD && wo.scheduledDate <= lastYMD;
    });
  }, [workOrders, weekYMDs]);

  // Unassigned row: scheduled in this week but no driver
  const unassignedRow = useMemo(
    () => weekWorkOrders.filter(wo => !wo.assignedDriver?.trim()),
    [weekWorkOrders]
  );

  // Index by driver name + YMD for fast cell lookup
  const cellIndex = useMemo(() => {
    const map = new Map<string, ScheduleWorkOrder[]>();
    for (const wo of weekWorkOrders) {
      if (!wo.assignedDriver?.trim()) continue;
      const key = `${wo.assignedDriver}|${wo.scheduledDate}`;
      const arr = map.get(key) || [];
      arr.push(wo);
      map.set(key, arr);
    }
    return map;
  }, [weekWorkOrders]);

  function getCell(driverName: string, ymd: string): ScheduleWorkOrder[] {
    return cellIndex.get(`${driverName}|${ymd}`) || [];
  }

  function openModal(wo: ScheduleWorkOrder) {
    setSelected(wo);
    setFormDriver(wo.assignedDriver || '');
    setFormDate(wo.scheduledDate || toYMD(new Date()));
    setFormTime(wo.scheduledTime || '09:00');
    setModalError(null);
  }

  function closeModal() {
    setSelected(null);
    setSaving(false);
    setModalError(null);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setModalError(null);

    try {
      // If the date or time changed, call `schedule` — it also updates driver
      // in one shot (scheduleWorkOrder accepts an optional driverName).
      const dateChanged = formDate !== selected.scheduledDate;
      const timeChanged = formTime !== selected.scheduledTime;
      const driverChanged = formDriver !== (selected.assignedDriver || '');

      if (!dateChanged && !timeChanged && !driverChanged) {
        closeModal();
        return;
      }

      if (dateChanged || timeChanged) {
        // `schedule` requires date+time. If either is missing we bail.
        if (!formDate || !formTime) {
          setModalError('Date and time are both required to reschedule.');
          setSaving(false);
          return;
        }
        const res = await fetch('/api/portal/delivery/work-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'schedule',
            workOrderId: selected.workOrderId,
            scheduledDate: formDate,
            scheduledTime: formTime,
            driverName: formDriver || undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || `Server returned ${res.status}`);
        }
      } else if (driverChanged) {
        // Only the driver changed. Use assign-driver — but note that the
        // API requires driverName, so an "unassign" needs the schedule path
        // with the existing date/time and an empty driverName (which the
        // service treats as "leave unchanged"). For a true unassign we call
        // assign-driver with a sentinel value is not supported, so we just
        // block empty-driver in that branch and tell the user.
        if (!formDriver.trim()) {
          setModalError('To unassign a driver, change the date or time as well (driver-only unassign not supported by the API).');
          setSaving(false);
          return;
        }
        const res = await fetch('/api/portal/delivery/work-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'assign-driver',
            workOrderId: selected.workOrderId,
            driverName: formDriver,
            vehicleType: selected.vehicleType || '',
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || `Server returned ${res.status}`);
        }
      }

      await loadWorkOrders();
      closeModal();
    } catch (err) {
      console.error('Save failed:', err);
      setModalError(err instanceof Error ? err.message : 'Save failed');
      setSaving(false);
    }
  }

  // --- Render: auth loading ---
  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
      </div>
    );
  }

  // --- Render: access denied ---
  if (!allowed) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto">
            <Lock className="text-red-400" size={32} />
          </div>
          <h1 className="text-2xl font-bold">Access Restricted</h1>
          <p className="text-zinc-400 text-sm">
            Only owners, admins, managers, project managers, and office staff
            can view the delivery schedule. Drivers see their assignments on
            their own route page.
          </p>
          <Link
            href="/portal/delivery"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-brand-green/40 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Delivery
          </Link>
        </div>
      </div>
    );
  }

  // --- Render: main ---
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 md:px-6 py-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              href="/portal/delivery"
              className="text-zinc-500 hover:text-brand-green transition-colors"
              aria-label="Back to delivery"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-brand-green" />
              <h1 className="text-lg md:text-xl font-bold">Delivery Schedule</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadWorkOrders()}
              disabled={loading}
              className="p-2 text-zinc-400 hover:text-brand-green hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link
              href="/portal/delivery/work-orders"
              className="flex items-center gap-2 bg-brand-green text-black font-semibold text-sm px-3 py-2 rounded-lg hover:bg-brand-green/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> New Work Order
            </Link>
          </div>
        </div>
      </header>

      {/* Week picker */}
      <div className="bg-zinc-900/60 border-b border-zinc-800 px-4 md:px-6 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart(w => addDays(w, -7))}
              className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-brand-green/40 text-zinc-300 hover:text-brand-green transition-colors"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setWeekStart(getWeekStart(new Date()))}
              className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-brand-green/40 text-zinc-300 hover:text-brand-green text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              This Week
            </button>
            <button
              onClick={() => setWeekStart(w => addDays(w, 7))}
              className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-brand-green/40 text-zinc-300 hover:text-brand-green transition-colors"
              aria-label="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="text-sm font-semibold text-zinc-200">
            {formatWeekRange(weekStart)}
          </div>
          <div className="text-xs text-zinc-500">
            {weekWorkOrders.length} scheduled · {unassignedRow.length} unassigned
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 md:px-6 py-3">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-400"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="px-4 md:px-6 py-6 overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Column headers */}
          <div className="grid grid-cols-[160px_repeat(7,minmax(0,1fr))] gap-2 mb-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex items-center">
              Driver
            </div>
            {weekDates.map((d, i) => {
              const isToday = toYMD(d) === toYMD(new Date());
              return (
                <div
                  key={i}
                  className={`text-center px-2 py-1 rounded-lg border ${
                    isToday
                      ? 'border-brand-green/40 bg-brand-green/5'
                      : 'border-zinc-800 bg-zinc-900/40'
                  }`}
                >
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-brand-green' : 'text-zinc-500'}`}>
                    {DOW_LABELS[i]}
                  </div>
                  <div className={`text-lg font-black ${isToday ? 'text-brand-green' : 'text-zinc-200'}`}>
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Unassigned row */}
          <DriverRow
            name="Unassigned"
            sub={`${unassignedRow.length} ticket${unassignedRow.length === 1 ? '' : 's'}`}
            accent="amber"
            weekYMDs={weekYMDs}
            cells={weekYMDs.map(ymd =>
              unassignedRow.filter(wo => wo.scheduledDate === ymd)
            )}
            onCardClick={openModal}
          />

          {/* Driver rows */}
          {drivers.map(d => {
            const cells = weekYMDs.map(ymd => getCell(d.name, ymd));
            const total = cells.reduce((sum, c) => sum + c.length, 0);
            return (
              <DriverRow
                key={d.id}
                name={d.name}
                sub={`${total} ticket${total === 1 ? '' : 's'} this week`}
                accent="green"
                weekYMDs={weekYMDs}
                cells={cells}
                onCardClick={openModal}
              />
            );
          })}

          {drivers.length === 0 && (
            <div className="mt-6 text-center text-zinc-500 text-sm py-10 border border-dashed border-zinc-800 rounded-xl">
              No active drivers found. Add a driver in Team Management.
            </div>
          )}
        </div>

        {loading && workOrders.length === 0 && (
          <div className="mt-6 flex items-center justify-center gap-2 text-zinc-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading work orders…
          </div>
        )}
      </div>

      {/* Reassign modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center px-4"
          onClick={closeModal}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                  {selected.jobNumber || selected.workOrderId}
                </div>
                <h2 className="text-lg font-bold text-white mt-1">{selected.customerName}</h2>
                <div className="text-xs text-zinc-400 mt-1">
                  {selected.address?.street}, {selected.address?.city}
                </div>
              </div>
              <button
                onClick={closeModal}
                className="text-zinc-500 hover:text-white"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Driver */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  Reassign to
                </label>
                <select
                  value={formDriver}
                  onChange={e => setFormDriver(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-green focus:border-brand-green"
                >
                  <option value="">— Unassign —</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Date + time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-green focus:border-brand-green"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={e => setFormTime(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-green focus:border-brand-green"
                  />
                </div>
              </div>

              {modalError && (
                <div className="flex items-start gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={closeModal}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-brand-green hover:bg-brand-green/90 text-black text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

interface DriverRowProps {
  name: string;
  sub: string;
  accent: 'green' | 'amber';
  weekYMDs: string[];
  cells: ScheduleWorkOrder[][];
  onCardClick: (wo: ScheduleWorkOrder) => void;
}

function DriverRow({ name, sub, accent, weekYMDs, cells, onCardClick }: DriverRowProps) {
  const accentClass =
    accent === 'amber'
      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
      : 'bg-zinc-900/40 border-zinc-800 text-zinc-200';

  const iconColor = accent === 'amber' ? 'text-amber-400' : 'text-brand-green';

  return (
    <div className="grid grid-cols-[160px_repeat(7,minmax(0,1fr))] gap-2 mb-2">
      <div className={`rounded-lg border px-3 py-2 ${accentClass}`}>
        <div className="flex items-center gap-2">
          {accent === 'amber' ? (
            <AlertCircle className={`w-4 h-4 ${iconColor}`} />
          ) : (
            <UserIcon className={`w-4 h-4 ${iconColor}`} />
          )}
          <span className="text-sm font-bold truncate">{name}</span>
        </div>
        <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>
      </div>

      {weekYMDs.map((ymd, i) => (
        <div
          key={ymd}
          className="min-h-[90px] rounded-lg border border-zinc-800 bg-zinc-900/30 p-1.5 space-y-1"
        >
          {cells[i].length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-700 text-[10px]">
              —
            </div>
          ) : (
            cells[i].map(wo => (
              <WorkOrderCard key={wo.workOrderId} wo={wo} onClick={() => onCardClick(wo)} />
            ))
          )}
        </div>
      ))}
    </div>
  );
}

function WorkOrderCard({ wo, onClick }: { wo: ScheduleWorkOrder; onClick: () => void }) {
  const pill = PRIORITY_PILL[wo.priority] || PRIORITY_PILL.normal;
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700 hover:border-brand-green/40 rounded-md px-2 py-1.5 transition-colors group"
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-bold text-zinc-400 group-hover:text-brand-green truncate">
          {wo.jobNumber || wo.workOrderId}
        </span>
        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${pill}`}>
          {wo.priority}
        </span>
      </div>
      <div className="text-xs font-semibold text-white truncate mt-0.5">
        {wo.customerName}
      </div>
      <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
        {wo.scheduledTime && (
          <span className="inline-flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" /> {wo.scheduledTime}
          </span>
        )}
        {wo.type && (
          <span className="inline-flex items-center gap-0.5 capitalize">
            {wo.type === 'delivery' ? <Truck className="w-2.5 h-2.5" /> : <Package className="w-2.5 h-2.5" />}
            {wo.type}
          </span>
        )}
      </div>
    </button>
  );
}
