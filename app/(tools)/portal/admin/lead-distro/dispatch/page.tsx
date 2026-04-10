'use client';

// Lead Distribution Dispatch View
// Office-facing queue for routing inbound unassigned leads to sales reps.
// Dark theme, brand-green accents, lucide icons.
//
// Role gate: owner, admin, office, manager, project_manager.
// Drivers and sales reps NOT allowed — they have their own views.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  Settings,
  Loader2,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Eye,
  UserPlus,
  Inbox,
  Clock,
  Users,
  Trophy,
  MapPin,
  X,
  Search,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

// ─────────────────────────────────────────────────────────────────────────────
// Types (must match the API route shapes)
// ─────────────────────────────────────────────────────────────────────────────

interface DispatchLead {
  leadId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  source: string;
  sourceDetails?: string;
  status: string;
  salesRepSlug: string;
  salesRepName: string;
  assignedAt?: string;
  createdAt: string;
}

interface DispatchStats {
  unassignedCount: number;
  assignedTodayCount: number;
  avgResponseMinutesToday: number | null;
  topAssigneeToday: { name: string; slug: string; count: number } | null;
}

interface DispatchSalesRep {
  slug: string;
  name: string;
  email: string;
}

interface DispatchResponse {
  success: boolean;
  unassigned: DispatchLead[];
  recentlyAssigned: DispatchLead[];
  stats: DispatchStats;
  salesReps: DispatchSalesRep[];
  error?: string;
}

interface PreviewScore {
  repSlug: string;
  repName: string;
  totalScore: number;
  isEligible: boolean;
  disqualifyReason?: string;
  factors?: Record<string, { score: number; explanation: string }>;
}

const ALLOWED_ROLES = ['owner', 'admin', 'office', 'manager', 'project_manager'];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatWhen(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const now = Date.now();
  const diffMin = Math.floor((now - d.getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function extractCityZip(address: string): string {
  if (!address) return '';
  // Best effort: try to pull "City, ST ZIP" from common address formats
  const match = address.match(/,\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})/);
  if (match) return `${match[1].trim()}, ${match[2]} ${match[3]}`;
  // Fall back to the last comma-chunk
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  return parts.slice(-2).join(', ');
}

function statusLabel(status: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    new: { label: 'New', className: 'bg-blue-500/10 text-blue-300 border-blue-500/30' },
    contacted: { label: 'Contacted', className: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30' },
    inspection_scheduled: { label: 'Inspection', className: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' },
    estimate_sent: { label: 'Estimate', className: 'bg-violet-500/10 text-violet-300 border-violet-500/30' },
    closed_won: { label: 'Won', className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
    closed_lost: { label: 'Lost', className: 'bg-red-500/10 text-red-300 border-red-500/30' },
  };
  return map[status] || { label: status, className: 'bg-neutral-700 text-neutral-300 border-neutral-600' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function LeadDistroDispatchPage() {
  const { user, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [unassigned, setUnassigned] = useState<DispatchLead[]>([]);
  const [recentlyAssigned, setRecentlyAssigned] = useState<DispatchLead[]>([]);
  const [stats, setStats] = useState<DispatchStats>({
    unassignedCount: 0,
    assignedTodayCount: 0,
    avgResponseMinutesToday: null,
    topAssigneeToday: null,
  });
  const [salesReps, setSalesReps] = useState<DispatchSalesRep[]>([]);
  const [search, setSearch] = useState('');

  // Preview modal state
  const [previewOpenFor, setPreviewOpenFor] = useState<DispatchLead | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewScores, setPreviewScores] = useState<PreviewScore[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Assign modal state
  const [assignOpenFor, setAssignOpenFor] = useState<DispatchLead | null>(null);
  const [assignSelectedSlug, setAssignSelectedSlug] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState<string>('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignRecommendedSlug, setAssignRecommendedSlug] = useState<string | null>(null);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadData = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoading(true);
    setRefreshing(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/portal/admin/lead-distro', { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed with ${res.status}`);
      }
      const data: DispatchResponse = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load dispatch queue');
      setUnassigned(data.unassigned || []);
      setRecentlyAssigned(data.recentlyAssigned || []);
      setStats(
        data.stats || {
          unassignedCount: 0,
          assignedTodayCount: 0,
          avgResponseMinutesToday: null,
          topAssigneeToday: null,
        }
      );
      setSalesReps(data.salesReps || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load dispatch queue';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    if (!ALLOWED_ROLES.includes(user.role)) return;
    loadData();
  }, [authLoading, user, loadData]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const filteredUnassigned = useMemo(() => {
    if (!search.trim()) return unassigned;
    const q = search.toLowerCase();
    return unassigned.filter(
      l =>
        l.customerName.toLowerCase().includes(q) ||
        l.customerAddress.toLowerCase().includes(q) ||
        l.source.toLowerCase().includes(q) ||
        l.customerPhone.includes(q)
    );
  }, [unassigned, search]);

  const recentAssignedTop20 = useMemo(
    () => recentlyAssigned.slice(0, 20),
    [recentlyAssigned]
  );

  // ── Preview modal handlers ────────────────────────────────────────────────

  const openPreview = useCallback(async (lead: DispatchLead) => {
    setPreviewOpenFor(lead);
    setPreviewScores([]);
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/admin/lead-distro/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: lead.customerAddress }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Preview failed (${res.status})`);
      }
      const data = await res.json();
      const scores: PreviewScore[] = Array.isArray(data.preview)
        ? data.preview
        : Array.isArray(data.data)
        ? data.data
        : [];
      setPreviewScores(scores);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const closePreview = useCallback(() => {
    setPreviewOpenFor(null);
    setPreviewScores([]);
    setPreviewError(null);
  }, []);

  // ── Assign modal handlers ─────────────────────────────────────────────────

  const openAssign = useCallback(
    async (lead: DispatchLead) => {
      setAssignOpenFor(lead);
      setAssignNotes('');
      setAssignError(null);
      setAssignSubmitting(false);
      setAssignRecommendedSlug(null);

      // Default selection = first active sales rep (will be overridden by
      // the recommendation below if the preview call succeeds).
      setAssignSelectedSlug(salesReps[0]?.slug || '');

      // Try to fetch the recommendation to pre-select the top-scoring rep.
      try {
        const res = await fetch('/api/admin/lead-distro/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: lead.customerAddress }),
        });
        if (res.ok) {
          const data = await res.json();
          const scores: PreviewScore[] = Array.isArray(data.preview)
            ? data.preview
            : Array.isArray(data.data)
            ? data.data
            : [];
          const topEligible = scores.find(s => s.isEligible);
          if (topEligible) {
            setAssignRecommendedSlug(topEligible.repSlug);
            setAssignSelectedSlug(topEligible.repSlug);
          }
        }
      } catch {
        // Non-fatal — user can still pick manually.
      }
    },
    [salesReps]
  );

  const closeAssign = useCallback(() => {
    setAssignOpenFor(null);
    setAssignSelectedSlug('');
    setAssignNotes('');
    setAssignError(null);
    setAssignSubmitting(false);
    setAssignRecommendedSlug(null);
  }, []);

  const submitAssign = useCallback(async () => {
    if (!assignOpenFor || !assignSelectedSlug) {
      setAssignError('Please select a sales rep.');
      return;
    }
    setAssignSubmitting(true);
    setAssignError(null);

    try {
      const res = await fetch(`/api/leads/${assignOpenFor.leadId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repSlug: assignSelectedSlug,
          customerName: assignOpenFor.customerName,
          customerEmail: assignOpenFor.customerEmail,
          customerPhone: assignOpenFor.customerPhone,
          customerAddress: assignOpenFor.customerAddress,
          notes: assignNotes || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Assignment failed (${res.status})`);
      }

      // Optimistic: drop the row from the unassigned list
      setUnassigned(prev => prev.filter(l => l.leadId !== assignOpenFor.leadId));

      const repName =
        salesReps.find(r => r.slug === assignSelectedSlug)?.name || assignSelectedSlug;
      setSuccessMsg(`Assigned ${assignOpenFor.customerName} to ${repName}.`);
      setTimeout(() => setSuccessMsg(null), 4000);

      closeAssign();

      // Refresh KPIs + recently assigned list silently
      loadData({ silent: true });
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setAssignSubmitting(false);
    }
  }, [assignOpenFor, assignSelectedSlug, assignNotes, salesReps, closeAssign, loadData]);

  // ── Auth / role gate ───────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={32} />
      </div>
    );
  }

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="mx-auto mb-4 text-red-400" size={48} />
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-neutral-400 mb-6">
            Only office, admin, owner, manager, and project managers can dispatch leads.
          </p>
          <Link
            href="/portal/admin"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Admin
          </Link>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const unassignedCountColor = stats.unassignedCount > 5 ? 'text-red-400' : 'text-brand-green';

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-white">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-white/5 bg-neutral-950/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/portal/admin"
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-neutral-400 hover:text-white"
              aria-label="Back to admin"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-white truncate">
                Lead Distribution
              </h1>
              <p className="text-xs text-neutral-500 hidden md:block">
                Dispatch inbound leads to sales reps
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData()}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 transition-colors text-sm disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link
              href="/portal/admin/lead-distro"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-green/10 hover:bg-brand-green/20 text-brand-green border border-brand-green/30 transition-colors text-sm"
            >
              <Settings size={14} />
              <span className="hidden sm:inline">Distribution Config</span>
              <span className="sm:hidden">Config</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* ── Toast messages ──────────────────────────────────────────────── */}
        {errorMsg && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
            <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ── KPI Row (4 across) ─────────────────────────────────────────── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <KpiCard
            icon={<Inbox size={18} />}
            label="Unassigned leads"
            value={stats.unassignedCount.toString()}
            valueClass={unassignedCountColor}
            loading={loading}
          />
          <KpiCard
            icon={<Users size={18} />}
            label="Assigned today"
            value={stats.assignedTodayCount.toString()}
            valueClass="text-white"
            loading={loading}
          />
          <KpiCard
            icon={<Clock size={18} />}
            label="Avg response (today)"
            value={
              stats.avgResponseMinutesToday == null
                ? '—'
                : `${Math.round(stats.avgResponseMinutesToday)}m`
            }
            valueClass="text-white"
            loading={loading}
          />
          <KpiCard
            icon={<Trophy size={18} />}
            label="Top earner today"
            value={
              stats.topAssigneeToday
                ? `${stats.topAssigneeToday.name} · ${stats.topAssigneeToday.count}`
                : '—'
            }
            valueClass="text-white text-base"
            loading={loading}
          />
        </section>

        {/* ── Unassigned queue ────────────────────────────────────────────── */}
        <section className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-brand-green/10 rounded-xl flex items-center justify-center">
                <Inbox size={16} className="text-brand-green" />
              </div>
              <div>
                <h2 className="text-sm md:text-base font-semibold text-white">
                  Unassigned queue
                </h2>
                <p className="text-xs text-neutral-500">
                  {filteredUnassigned.length} lead
                  {filteredUnassigned.length === 1 ? '' : 's'} waiting for assignment
                </p>
              </div>
            </div>
            <div className="relative w-full sm:w-72">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
              />
              <input
                type="text"
                placeholder="Search name, address, source..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center">
              <Loader2 className="mx-auto animate-spin text-brand-green mb-3" size={24} />
              <p className="text-sm text-neutral-400">Loading dispatch queue...</p>
            </div>
          ) : filteredUnassigned.length === 0 ? (
            <div className="p-10 text-center">
              <Inbox className="mx-auto text-neutral-700 mb-3" size={36} />
              <p className="text-sm text-neutral-400">
                {unassigned.length === 0
                  ? 'No unassigned leads in the queue. Nice work!'
                  : 'No leads match your search.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-xs text-neutral-500 uppercase tracking-wide">
                    <th className="px-5 py-3 font-medium">Source</th>
                    <th className="px-5 py-3 font-medium">Customer</th>
                    <th className="px-5 py-3 font-medium">Location</th>
                    <th className="px-5 py-3 font-medium">Created</th>
                    <th className="px-5 py-3 font-medium">Address</th>
                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUnassigned.map(lead => (
                    <tr
                      key={lead.leadId}
                      className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 border border-white/10 text-neutral-300 capitalize">
                          {lead.source.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-white truncate max-w-[180px]">
                          {lead.customerName || '—'}
                        </div>
                        {lead.customerPhone && (
                          <div className="text-xs text-neutral-500 truncate max-w-[180px]">
                            {lead.customerPhone}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-neutral-300">
                        {extractCityZip(lead.customerAddress) || '—'}
                      </td>
                      <td className="px-5 py-3 text-neutral-400 whitespace-nowrap">
                        {formatWhen(lead.createdAt)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 text-neutral-400 text-xs max-w-[260px]">
                          <MapPin size={12} className="flex-shrink-0" />
                          <span className="truncate">{lead.customerAddress || '—'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => openPreview(lead)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 text-xs transition-colors"
                          >
                            <Eye size={12} />
                            Preview
                          </button>
                          <button
                            onClick={() => openAssign(lead)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-green/10 hover:bg-brand-green/20 border border-brand-green/30 text-brand-green text-xs font-semibold transition-colors"
                          >
                            <UserPlus size={12} />
                            Assign
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Recently assigned ───────────────────────────────────────────── */}
        <section className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3">
            <div className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center">
              <Users size={16} className="text-neutral-400" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-semibold text-white">
                Recently assigned
              </h2>
              <p className="text-xs text-neutral-500">
                Last {recentAssignedTop20.length} assignments
              </p>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="mx-auto animate-spin text-neutral-500" size={20} />
            </div>
          ) : recentAssignedTop20.length === 0 ? (
            <div className="p-8 text-center text-sm text-neutral-500">
              No recent assignments yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-xs text-neutral-500 uppercase tracking-wide">
                    <th className="px-5 py-3 font-medium">Customer</th>
                    <th className="px-5 py-3 font-medium">Assigned to</th>
                    <th className="px-5 py-3 font-medium">When</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAssignedTop20.map(lead => {
                    const badge = statusLabel(lead.status);
                    return (
                      <tr
                        key={lead.leadId}
                        className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.03] transition-colors cursor-pointer"
                        onClick={() => {
                          window.location.href = `/portal/leads`;
                        }}
                      >
                        <td className="px-5 py-3">
                          <div className="font-medium text-white truncate max-w-[220px]">
                            {lead.customerName || '—'}
                          </div>
                          <div className="text-xs text-neutral-500 truncate max-w-[220px]">
                            {extractCityZip(lead.customerAddress)}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-neutral-300">
                          {lead.salesRepName || lead.salesRepSlug || '—'}
                        </td>
                        <td className="px-5 py-3 text-neutral-400 whitespace-nowrap">
                          {formatWhen(lead.assignedAt || lead.createdAt)}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs border ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* ── Preview Modal ────────────────────────────────────────────────── */}
      {previewOpenFor && (
        <Modal onClose={closePreview} title="Algorithm recommendation">
          <div className="mb-4">
            <p className="text-sm text-neutral-400">For lead:</p>
            <p className="text-white font-medium">{previewOpenFor.customerName}</p>
            <p className="text-xs text-neutral-500">{previewOpenFor.customerAddress}</p>
          </div>
          {previewLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto animate-spin text-brand-green mb-3" size={24} />
              <p className="text-sm text-neutral-400">Scoring reps...</p>
            </div>
          ) : previewError ? (
            <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
              {previewError}
            </div>
          ) : previewScores.length === 0 ? (
            <div className="py-10 text-center text-sm text-neutral-500">
              No scores returned for this address.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {previewScores.map((score, idx) => (
                <div
                  key={score.repSlug}
                  className={`px-4 py-3 rounded-lg border ${
                    idx === 0 && score.isEligible
                      ? 'bg-brand-green/10 border-brand-green/30'
                      : score.isEligible
                      ? 'bg-white/5 border-white/10'
                      : 'bg-red-500/5 border-red-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {idx === 0 && score.isEligible && (
                        <Trophy size={14} className="text-brand-green" />
                      )}
                      <span className="text-white font-medium text-sm">
                        {score.repName}
                      </span>
                      {!score.isEligible && (
                        <span className="text-xs text-red-400 ml-2">Ineligible</span>
                      )}
                    </div>
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        idx === 0 && score.isEligible
                          ? 'text-brand-green'
                          : 'text-neutral-300'
                      }`}
                    >
                      {score.totalScore.toFixed(1)}
                    </span>
                  </div>
                  {score.disqualifyReason && (
                    <p className="text-xs text-red-300/80 mt-1">{score.disqualifyReason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-white/5">
            <button
              onClick={closePreview}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 text-sm transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                const lead = previewOpenFor;
                closePreview();
                if (lead) openAssign(lead);
              }}
              className="px-4 py-2 rounded-lg bg-brand-green/10 hover:bg-brand-green/20 border border-brand-green/30 text-brand-green text-sm font-semibold transition-colors"
            >
              Assign this lead
            </button>
          </div>
        </Modal>
      )}

      {/* ── Assign Modal ─────────────────────────────────────────────────── */}
      {assignOpenFor && (
        <Modal onClose={closeAssign} title="Assign lead">
          <div className="mb-4">
            <p className="text-sm text-neutral-400">Customer:</p>
            <p className="text-white font-medium">{assignOpenFor.customerName}</p>
            <p className="text-xs text-neutral-500">{assignOpenFor.customerAddress}</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                Sales rep
              </label>
              <select
                value={assignSelectedSlug}
                onChange={e => setAssignSelectedSlug(e.target.value)}
                disabled={assignSubmitting}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-green/50 disabled:opacity-50"
              >
                {salesReps.length === 0 && <option value="">No sales reps</option>}
                {salesReps.map(rep => (
                  <option key={rep.slug} value={rep.slug}>
                    {rep.name}
                    {assignRecommendedSlug === rep.slug ? ' (recommended)' : ''}
                  </option>
                ))}
              </select>
              {assignRecommendedSlug && (
                <p className="text-xs text-brand-green mt-1.5">
                  Pre-selected by the distribution algorithm
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                Notes (optional)
              </label>
              <textarea
                value={assignNotes}
                onChange={e => setAssignNotes(e.target.value)}
                disabled={assignSubmitting}
                rows={3}
                placeholder="Any context for the rep..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 disabled:opacity-50 resize-none"
              />
            </div>

            {assignError && (
              <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                {assignError}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-white/5">
            <button
              onClick={closeAssign}
              disabled={assignSubmitting}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 text-sm transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={submitAssign}
              disabled={assignSubmitting || !assignSelectedSlug}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-brand-green to-emerald-500 text-black text-sm font-semibold transition-opacity disabled:opacity-50"
            >
              {assignSubmitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <UserPlus size={14} />
              )}
              Assign
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  valueClass,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 md:p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-neutral-500 uppercase tracking-wide">{label}</span>
        <span className="text-neutral-500">{icon}</span>
      </div>
      {loading ? (
        <div className="h-7 w-16 bg-white/5 rounded animate-pulse" />
      ) : (
        <div className={`text-2xl md:text-3xl font-bold tabular-nums ${valueClass || 'text-white'}`}>
          {value}
        </div>
      )}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
