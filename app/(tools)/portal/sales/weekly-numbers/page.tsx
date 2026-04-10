'use client';

/**
 * RCRS Sales Portal - Weekly Numbers Submission Form
 *
 * Lets a sales rep submit their week's activity numbers. Matches the Monday
 * meeting sheet columns (Inspected / Damage / Signed / Repair / Gutter / $$$$$ /
 * Approved / Goal / Referrals / Agents / Present / Home Show).
 *
 * Sales reps submit for themselves (locked to auth.user.name). Admins / owners /
 * managers get a rep picker so they can enter numbers on behalf of anyone.
 *
 * POSTs to /api/portal/sales/weekly-numbers which calls
 * meetingNumbersService.submitNumbers() under the hood.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Save,
  CheckCircle,
  AlertCircle,
  Calendar,
  DollarSign,
  Home,
  Target,
  Users,
  TrendingUp,
  FileText,
  ClipboardList,
  History,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

// =============================================================================
// Types
// =============================================================================

interface HistoryRecord {
  meetingDate: string;
  repName: string;
  inspected: number;
  damage: number;
  signed: number;
  repair: number;
  gutter: number;
  revenue: number;
  approved: number;
  goal: number;
  referrals: number;
  agents: number;
  homeShow: number;
}

interface FormState {
  weekOf: string;
  inspected: string;
  damage: string;
  signed: string;
  repair: string;
  gutter: string;
  revenue: string;
  approved: string;
  goal: string;
  referrals: string;
  agents: string;
  homeShow: string;
  notes: string;
}

// =============================================================================
// Helpers
// =============================================================================

function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return '$0';
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/** Monday (YYYY-MM-DD) of the week containing the given date. */
function mondayOf(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun, 1 = Mon
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const EMPTY_FORM = (weekOf: string): FormState => ({
  weekOf,
  inspected: '',
  damage: '',
  signed: '',
  repair: '',
  gutter: '',
  revenue: '',
  approved: '',
  goal: '',
  referrals: '',
  agents: '',
  homeShow: '',
  notes: '',
});

// Roster shown in admin rep-picker (kept in sync with lib/team-roles.ts
// SALES_REP_CANONICAL — plain string list so we don't pull server helpers).
const SALES_REPS = [
  'Hunter Rivers',
  'Aaron Lussi',
  'Greg Muse',
  'Brendon Muse',
  'Adam Rudell',
  'Joseph Dowd',
  'Alijah',
  'Travis Wages',
  'Rick',
];

// =============================================================================
// Page
// =============================================================================

export default function WeeklyNumbersPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const isAdminLike =
    !!user && ['owner', 'admin', 'manager'].includes(user.role);

  const [form, setForm] = useState<FormState>(() => EMPTY_FORM(mondayOf()));
  const [targetRep, setTargetRep] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Auth gate
  useEffect(() => {
    if (!isLoading && !user) router.replace('/portal/login');
  }, [isLoading, user, router]);

  // Default targetRep to the logged-in user once auth loads
  useEffect(() => {
    if (user && !targetRep) setTargetRep(user.name);
  }, [user, targetRep]);

  // Load history for the currently selected rep
  const loadHistory = useCallback(async (rep: string) => {
    if (!rep) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(
        `/api/portal/sales/weekly-numbers?rep=${encodeURIComponent(rep)}&limit=4`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.records)) {
        setHistory(data.records);
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (targetRep) loadHistory(targetRep);
  }, [targetRep, loadHistory]);

  // Form change handler
  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !user) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const payload: Record<string, unknown> = {
        weekOf: form.weekOf,
        inspected: Number(form.inspected) || 0,
        damage: Number(form.damage) || 0,
        signed: Number(form.signed) || 0,
        repair: Number(form.repair) || 0,
        gutter: Number(form.gutter) || 0,
        revenue: Number(form.revenue) || 0,
        approved: Number(form.approved) || 0,
        goal: Number(form.goal) || 0,
        referrals: Number(form.referrals) || 0,
        agents: Number(form.agents) || 0,
        homeShow: Number(form.homeShow) || 0,
        present: '1',
        notes: form.notes,
      };

      if (isAdminLike && targetRep && targetRep !== user.name) {
        payload.repName = targetRep;
      }

      const res = await fetch('/api/portal/sales/weekly-numbers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Submission failed');
      }

      setMessage({ type: 'success', text: data.message || 'Weekly numbers saved!' });
      // Clear the form but keep the week selector
      setForm(EMPTY_FORM(form.weekOf));
      // Reload history to reflect the new row
      loadHistory(targetRep);
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Submission failed';
      setMessage({ type: 'error', text });
    } finally {
      setSubmitting(false);
    }
  };

  // Totals for the "Your last 4 weeks" summary row
  const historyTotals = useMemo(() => {
    return history.reduce(
      (acc, r) => ({
        inspected: acc.inspected + r.inspected,
        signed: acc.signed + r.signed,
        revenue: acc.revenue + r.revenue,
        approved: acc.approved + r.approved,
      }),
      { inspected: 0, signed: 0, revenue: 0, approved: 0 },
    );
  }, [history]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
          backgroundSize: '50px 50px',
        }} />
      </div>

      <div className="relative z-10 pb-24">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link
                  href="/portal/sales"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={20} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    Weekly Numbers
                  </h1>
                  <p className="text-xs text-neutral-400">
                    Submit your week's activity — straight into the Monday meeting sheet
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-xs text-neutral-500">
                <ClipboardList size={14} />
                {isAdminLike ? 'Admin mode' : `Logged in as ${user.name}`}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          {/* Message banner */}
          {message && (
            <div
              className={`mb-4 rounded-xl px-4 py-3 border flex items-start gap-3 ${
                message.type === 'success'
                  ? 'bg-brand-green/10 border-brand-green/30 text-brand-green'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle size={18} className="mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
              )}
              <div className="text-sm">{message.text}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Week + Rep row */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-neutral-400 flex items-center gap-1 mb-2">
                    <Calendar size={12} /> Week of (Monday)
                  </label>
                  <input
                    type="date"
                    value={form.weekOf}
                    onChange={e => update('weekOf', e.target.value)}
                    required
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-green transition-colors"
                  />
                  <p className="text-[10px] text-neutral-500 mt-1">
                    Defaults to this Monday. Auto-adjusted server-side.
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-400 flex items-center gap-1 mb-2">
                    <Users size={12} /> Sales rep
                  </label>
                  {isAdminLike ? (
                    <select
                      value={targetRep}
                      onChange={e => setTargetRep(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-green transition-colors"
                    >
                      <option value={user.name}>{user.name} (me)</option>
                      {SALES_REPS.filter(r => r !== user.name).map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={user.name}
                      readOnly
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-neutral-400 text-sm cursor-not-allowed"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Activity grid */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Home size={14} className="text-brand-green" /> Activity
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                <NumberField label="Inspected" value={form.inspected} onChange={v => update('inspected', v)} />
                <NumberField label="Damage" value={form.damage} onChange={v => update('damage', v)} />
                <NumberField label="Signed" value={form.signed} onChange={v => update('signed', v)} />
                <NumberField label="Repair" value={form.repair} onChange={v => update('repair', v)} />
                <NumberField label="Gutter" value={form.gutter} onChange={v => update('gutter', v)} />
                <NumberField label="Home Show" value={form.homeShow} onChange={v => update('homeShow', v)} />
              </div>
            </div>

            {/* Revenue + Goals */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <DollarSign size={14} className="text-brand-green" /> Revenue &amp; Goals
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                <NumberField
                  label="Revenue ($$$$$)"
                  value={form.revenue}
                  onChange={v => update('revenue', v)}
                  step="0.01"
                />
                <NumberField label="Approved" value={form.approved} onChange={v => update('approved', v)} />
                <NumberField label="Goal" value={form.goal} onChange={v => update('goal', v)} />
              </div>
            </div>

            {/* Relationships */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Target size={14} className="text-brand-green" /> Relationships
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <NumberField label="Referrals" value={form.referrals} onChange={v => update('referrals', v)} />
                <NumberField label="Insurance Agent Visits" value={form.agents} onChange={v => update('agents', v)} />
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <FileText size={14} className="text-brand-green" /> Notes
              </h2>
              <textarea
                value={form.notes}
                onChange={e => update('notes', e.target.value)}
                rows={3}
                placeholder="Any context, blockers, or wins from the week..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-brand-green transition-colors"
              />
              <p className="text-[10px] text-neutral-500 mt-1">
                Not saved to the sheet — just a scratch pad for your own reference.
              </p>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setForm(EMPTY_FORM(mondayOf()))}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-sm font-medium transition-colors"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-brand-green text-black text-sm font-semibold hover:bg-brand-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} /> Submit Numbers
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Last 4 weeks trend */}
          <section className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <History size={14} className="text-brand-green" />
                Your last 4 weeks
              </h2>
              {loadingHistory && <Loader2 size={14} className="text-neutral-500 animate-spin" />}
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-500 text-xs border-b border-white/5">
                    <th className="px-3 py-2 font-medium">Week</th>
                    <th className="px-3 py-2 font-medium text-right">Inspected</th>
                    <th className="px-3 py-2 font-medium text-right">Signed</th>
                    <th className="px-3 py-2 font-medium text-right">Approved</th>
                    <th className="px-3 py-2 font-medium text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 && !loadingHistory && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-neutral-500 text-xs">
                        No recent weeks on file yet.
                      </td>
                    </tr>
                  )}
                  {history.map(rec => (
                    <tr key={rec.meetingDate} className="border-b border-white/5 last:border-0">
                      <td className="px-3 py-2 text-neutral-200">{prettyDate(rec.meetingDate)}</td>
                      <td className="px-3 py-2 text-right text-neutral-200">{rec.inspected}</td>
                      <td className="px-3 py-2 text-right text-neutral-200">{rec.signed}</td>
                      <td className="px-3 py-2 text-right text-neutral-200">{rec.approved}</td>
                      <td className="px-3 py-2 text-right text-brand-green font-medium">
                        {formatCurrency(rec.revenue)}
                      </td>
                    </tr>
                  ))}
                  {history.length > 0 && (
                    <tr className="bg-white/[0.02]">
                      <td className="px-3 py-2 text-xs text-neutral-400 font-semibold">
                        <TrendingUp size={12} className="inline mr-1" /> Total
                      </td>
                      <td className="px-3 py-2 text-right text-white font-semibold">{historyTotals.inspected}</td>
                      <td className="px-3 py-2 text-right text-white font-semibold">{historyTotals.signed}</td>
                      <td className="px-3 py-2 text-right text-white font-semibold">{historyTotals.approved}</td>
                      <td className="px-3 py-2 text-right text-brand-green font-semibold">
                        {formatCurrency(historyTotals.revenue)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

// =============================================================================
// Small input component
// =============================================================================

function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-neutral-400 mb-1 block">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step={step || '1'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="0"
        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-green transition-colors"
      />
    </div>
  );
}
