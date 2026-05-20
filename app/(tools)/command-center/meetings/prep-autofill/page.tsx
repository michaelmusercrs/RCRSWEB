'use client';

/**
 * Monday Meeting Prep Auto-Fill — Admin UI
 *
 * Big "Generate prep for Monday {date}" button. Shows the proposed deck
 * sections with edit-in-place fields. Save writes to the `Monday Prep`
 * sheet tab (idempotent on weekStart). Owner reviews + edits before the
 * 10am meeting; the meeting page reads from that tab on Monday morning.
 *
 * Hard rules surfaced in the UI:
 *   - Three leaderboards (Sales / Commission / Activity) are shown in
 *     separate cards. The page never adds them together.
 *   - Missing data shows as "—" (em-dash) with a small "no data" badge.
 *     Never falls back to 0 or a guess.
 *   - Proposed auto-announcements with confidence <0.7 are tagged "needs
 *     owner review" and rendered with a yellow border until edited.
 *   - Save is a no-op until the owner clicks it. Nothing auto-sends.
 *
 * Access: owner / admin (enforced server-side by the API).
 *
 * @author RCRS Development Team
 */

import * as React from 'react';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Cloud,
  Megaphone,
  TrendingUp,
  Trophy,
  DollarSign,
  Activity,
  Save,
  Edit3,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { LoadingSpinner, PermissionGate } from '@/components/command-center';
import { cn } from '@/lib/utils';

// =============================================================================
// Types — mirror lib/monday-prep-autofill PrepData
// =============================================================================

interface TracedFigure {
  value: number | null;
  source: string;
  missing?: boolean;
  note?: string;
}

interface RepSalesEntry {
  name: string;
  inspected: number;
  signed: number;
  revenue: number;
  approved: number;
  goal: number;
  present: string;
}

interface CommissionLeaderEntry {
  name: string;
  amountPaid: number;
}

interface ActivityRepEntry {
  name: string;
  doorsKnocked: number;
  appointmentsSet: number;
  contractsSigned: number;
  revenueClosed: number;
}

interface ProposedAnnouncement {
  title: string;
  content: string;
  source: string;
  confidence: number;
  needsOwnerReview: boolean;
}

interface WeatherCallout {
  summary: string;
  workableDays: number | null;
  stormDays: string[];
  hasAlerts: boolean;
  alertHeadlines: string[];
  source: string;
}

interface PrepData {
  weekStart: string;
  generatedAt: string;
  salesAccrual: {
    teamRevenue: TracedFigure;
    teamSigned: TracedFigure;
    teamInspected: TracedFigure;
    perRep: RepSalesEntry[];
    weekOverWeekRevenueChange: number | null;
    source: string;
  };
  commissionLeaderboard: {
    top5: CommissionLeaderEntry[];
    totalPaidYTD: TracedFigure;
    source: string;
  };
  activityLeaderboard: {
    top5: ActivityRepEntry[];
    totalDoors: TracedFigure;
    totalAppts: TracedFigure;
    source: string;
  };
  highlights: {
    topPerformerByRevenue: { name: string; revenue: number } | null;
    biggestCloserBySigned: { name: string; signed: number } | null;
    biggestCommissionCheck: { name: string; amount: number } | null;
  };
  customerWins: {
    loadVerifiedCount: TracedFigure;
    loadVerifiedTotal: TracedFigure;
    source: string;
  };
  weather: WeatherCallout | null;
  recentStorms: { hailReportCount: TracedFigure; source: string };
  missedCalls: TracedFigure;
  openLeadsByRep: Array<{ name: string; count: number }>;
  proposedAnnouncements: ProposedAnnouncement[];
  dataSources: string[];
  warnings: string[];
}

interface SavedMeta {
  generatedAt: string;
  reviewed: boolean;
  approved: boolean;
  approvedBy: string;
  approvedAt: string;
  updatedAt: string;
}

interface AutofillResponse {
  success: boolean;
  data: PrepData;
  savedDraft: PrepData | null;
  savedMeta: SavedMeta | null;
  cached: boolean;
  error?: string;
}

// =============================================================================
// Small UI helpers
// =============================================================================

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function fmtFigure(f: TracedFigure, currency = false): React.ReactNode {
  if (f.missing || f.value === null) {
    return (
      <span title={f.note || 'No data available'} className="text-zinc-500 italic">
        — <span className="text-[10px] uppercase tracking-wide ml-1 px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">no data</span>
      </span>
    );
  }
  return currency ? fmtCurrency(f.value) : f.value.toLocaleString('en-US');
}

function SectionCard({
  title,
  icon: Icon,
  hint,
  children,
}: {
  title: string;
  icon: React.ElementType;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="p-4 border-b border-zinc-800 bg-zinc-800/30 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-500/20">
          <Icon className="h-5 w-5 text-lime-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {hint && <p className="text-xs text-zinc-500 mt-0.5">{hint}</p>}
        </div>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

// Formats the upcoming-Monday date for the page header
function formatMondayDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getNextMondayISO(): string {
  const now = new Date();
  const ct = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const dow = ct.getDay();
  const daysUntilMon = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
  ct.setDate(ct.getDate() + daysUntilMon);
  const y = ct.getFullYear();
  const m = String(ct.getMonth() + 1).padStart(2, '0');
  const d = String(ct.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// =============================================================================
// Main Page
// =============================================================================

export default function MondayPrepAutofillPage() {
  const [weekStart, setWeekStart] = useState<string>(getNextMondayISO());
  const [data, setData] = useState<PrepData | null>(null);
  const [savedMeta, setSavedMeta] = useState<SavedMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<PrepData | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const generate = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const url = `/api/admin/monday-prep?weekStart=${weekStart}${force ? '&force=1' : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json: AutofillResponse = await res.json();
      if (!json.success) throw new Error(json.error || 'Generation failed');
      // Prefer the saved draft if one exists (so the owner sees their edits),
      // falling back to the freshly generated proposal.
      const initial = json.savedDraft || json.data;
      setData(json.data);
      setEditing(initial);
      setSavedMeta(json.savedMeta);
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  // No auto-fire on mount — user clicks the button to generate

  const save = useCallback(async (approve = false) => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/monday-prep', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStart,
          sections: editing,
          reviewed: true,
          approved: approve,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Save failed');
      setIsDirty(false);
      setSuccess(approve ? 'Approved and saved to Monday Prep tab.' : 'Draft saved.');
      setSavedMeta({
        generatedAt: editing.generatedAt,
        reviewed: true,
        approved: approve,
        approvedBy: json.data?.approvedBy || '',
        approvedAt: json.data?.approvedAt || '',
        updatedAt: new Date().toISOString(),
      });
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [editing, weekStart]);

  const updateAnnouncement = (index: number, patch: Partial<ProposedAnnouncement>) => {
    if (!editing) return;
    const next = {
      ...editing,
      proposedAnnouncements: editing.proposedAnnouncements.map((a, i) =>
        i === index ? { ...a, ...patch } : a
      ),
    };
    setEditing(next);
    setIsDirty(true);
  };

  return (
    <PermissionGate
      permissions={['dashboard.viewAll']}
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 max-w-md">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-400 mb-2">Owner / Admin only</h2>
            <p className="text-zinc-400 mb-4">
              The Monday prep auto-fill exposes commission cash and per-rep
              numbers. Owner / admin access required.
            </p>
            <Link
              href="/command-center/meetings"
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition"
            >
              <ArrowLeft size={18} />
              Back to Meetings
            </Link>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <Link
              href="/command-center/meetings"
              className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-2 transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Meeting Hub
            </Link>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-lime-400" />
              Monday Prep Auto-Fill
            </h1>
            <p className="text-zinc-400 mt-1">
              Pre-populates this week&apos;s meeting deck so you don&apos;t
              spend 30 minutes pulling numbers Monday morning.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={weekStart}
              onChange={(e) => {
                setWeekStart(e.target.value);
                setData(null);
                setEditing(null);
                setSavedMeta(null);
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white"
            />
            <button
              onClick={() => generate(false)}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-lime-500 text-zinc-900 font-semibold hover:bg-lime-400 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              Generate prep for Monday {formatMondayDate(weekStart)}
            </button>
            {data && (
              <button
                onClick={() => generate(true)}
                disabled={loading}
                title="Force regenerate (bypass 30 min cache)"
                className="p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
            )}
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-lime-500/10 border border-lime-500/20 text-lime-400">
            <CheckCircle2 size={20} />
            <span>{success}</span>
          </div>
        )}
        {isDirty && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
            <Edit3 size={16} />
            <span>Unsaved changes — click Save Draft or Approve &amp; Save below.</span>
          </div>
        )}

        {/* Saved meta banner */}
        {savedMeta && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-400 flex flex-wrap items-center gap-4">
            {savedMeta.approved ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-lime-500/20 text-lime-400">
                <CheckCircle2 size={12} /> Approved by {savedMeta.approvedBy || 'unknown'}
              </span>
            ) : savedMeta.reviewed ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-green/20 text-blue-400">
                Reviewed (draft)
              </span>
            ) : null}
            {savedMeta.updatedAt && <span>Last updated {new Date(savedMeta.updatedAt).toLocaleString()}</span>}
            {savedMeta.generatedAt && (
              <span>Originally generated {new Date(savedMeta.generatedAt).toLocaleString()}</span>
            )}
          </div>
        )}

        {/* Empty state */}
        {!data && !loading && (
          <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-12 text-center">
            <Sparkles className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400">
              Click <span className="text-lime-400 font-semibold">Generate</span> to
              pull this week&apos;s numbers, weather, and proposed announcements.
            </p>
            <p className="text-zinc-500 text-xs mt-2">
              Cached 30 min. Use the refresh button to force-rebuild.
            </p>
          </div>
        )}

        {/* Loading state */}
        {loading && !data && (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {/* Generated content */}
        {data && editing && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* === Highlights / KPI ribbon === */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                <p className="text-xs uppercase tracking-wider text-zinc-500">Top performer (Sales)</p>
                <p className="text-lg font-bold text-lime-400 mt-1">
                  {data.highlights.topPerformerByRevenue
                    ? `${data.highlights.topPerformerByRevenue.name} · ${fmtCurrency(data.highlights.topPerformerByRevenue.revenue)}`
                    : <span className="text-zinc-500 italic">— no data</span>}
                </p>
                <p className="text-[10px] text-zinc-600 mt-1">Accrual ($$$$$ column) — NOT QB cash</p>
              </div>
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                <p className="text-xs uppercase tracking-wider text-zinc-500">Biggest closer</p>
                <p className="text-lg font-bold text-purple-400 mt-1">
                  {data.highlights.biggestCloserBySigned
                    ? `${data.highlights.biggestCloserBySigned.name} · ${data.highlights.biggestCloserBySigned.signed} signed`
                    : <span className="text-zinc-500 italic">— no data</span>}
                </p>
                <p className="text-[10px] text-zinc-600 mt-1">By contracts signed</p>
              </div>
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                <p className="text-xs uppercase tracking-wider text-zinc-500">Biggest commission check (YTD)</p>
                <p className="text-lg font-bold text-emerald-400 mt-1">
                  {data.highlights.biggestCommissionCheck
                    ? `${data.highlights.biggestCommissionCheck.name} · ${fmtCurrency(data.highlights.biggestCommissionCheck.amount)}`
                    : <span className="text-zinc-500 italic">— no data</span>}
                </p>
                <p className="text-[10px] text-zinc-600 mt-1">QB 1099 cash paid out</p>
              </div>
            </div>

            {/* === Sales accrual === */}
            <SectionCard
              title="Sales — Accrual ($$$$$)"
              icon={TrendingUp}
              hint="Monday meeting numbers. NOT commissions — see next card."
            >
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded bg-zinc-800/50">
                  <p className="text-[10px] uppercase text-zinc-500">Team revenue</p>
                  <p className="font-bold text-lime-400">{fmtFigure(data.salesAccrual.teamRevenue, true)}</p>
                </div>
                <div className="p-2 rounded bg-zinc-800/50">
                  <p className="text-[10px] uppercase text-zinc-500">Signed</p>
                  <p className="font-bold text-purple-400">{fmtFigure(data.salesAccrual.teamSigned)}</p>
                </div>
                <div className="p-2 rounded bg-zinc-800/50">
                  <p className="text-[10px] uppercase text-zinc-500">Inspected</p>
                  <p className="font-bold text-cyan-400">{fmtFigure(data.salesAccrual.teamInspected)}</p>
                </div>
              </div>
              <p className="text-xs text-zinc-500">
                Week over week:{' '}
                {data.salesAccrual.weekOverWeekRevenueChange === null ? (
                  <span className="italic">no prior data</span>
                ) : (
                  <span className={data.salesAccrual.weekOverWeekRevenueChange > 0 ? 'text-lime-400' : 'text-red-400'}>
                    {data.salesAccrual.weekOverWeekRevenueChange > 0 ? '+' : ''}
                    {data.salesAccrual.weekOverWeekRevenueChange}%
                  </span>
                )}
              </p>
              {data.salesAccrual.perRep.length > 0 && (
                <div className="text-xs">
                  <p className="text-zinc-500 mb-1">Per rep:</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {data.salesAccrual.perRep.map((r) => (
                      <div key={r.name} className="flex justify-between p-1.5 rounded bg-zinc-800/30">
                        <span className="text-zinc-300">{r.name}</span>
                        <span className="text-lime-400">{fmtCurrency(r.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-[10px] text-zinc-600 italic">Source: {data.salesAccrual.source}</p>
            </SectionCard>

            {/* === Commission (QB cash) === */}
            <SectionCard
              title="Commission — QB 1099 Cash (YTD)"
              icon={DollarSign}
              hint="Real money paid out via QuickBooks. Never combined with sales."
            >
              <div className="text-center p-2 rounded bg-zinc-800/50">
                <p className="text-[10px] uppercase text-zinc-500">Total paid YTD</p>
                <p className="font-bold text-emerald-400 text-xl">
                  {fmtFigure(data.commissionLeaderboard.totalPaidYTD, true)}
                </p>
              </div>
              {data.commissionLeaderboard.top5.length > 0 ? (
                <div className="space-y-1">
                  {data.commissionLeaderboard.top5.map((c, i) => (
                    <div key={c.name} className="flex justify-between p-1.5 rounded bg-zinc-800/30 text-xs">
                      <span className="text-zinc-300">#{i + 1} {c.name}</span>
                      <span className="text-emerald-400">{fmtCurrency(c.amountPaid)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic">— no commission data</p>
              )}
              <p className="text-[10px] text-zinc-600 italic">Source: {data.commissionLeaderboard.source}</p>
            </SectionCard>

            {/* === Activity (self-reported) === */}
            <SectionCard
              title="Activity — Self-Reported"
              icon={Activity}
              hint="Doors/appts/signed from /portal/sales/weekly-numbers. Separate from sales + commission."
            >
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 rounded bg-zinc-800/50">
                  <p className="text-[10px] uppercase text-zinc-500">Total doors</p>
                  <p className="font-bold text-cyan-400">{fmtFigure(data.activityLeaderboard.totalDoors)}</p>
                </div>
                <div className="p-2 rounded bg-zinc-800/50">
                  <p className="text-[10px] uppercase text-zinc-500">Total appts</p>
                  <p className="font-bold text-cyan-400">{fmtFigure(data.activityLeaderboard.totalAppts)}</p>
                </div>
              </div>
              {data.activityLeaderboard.top5.length > 0 ? (
                <div className="space-y-1">
                  {data.activityLeaderboard.top5.map((a) => (
                    <div key={a.name} className="flex justify-between p-1.5 rounded bg-zinc-800/30 text-xs">
                      <span className="text-zinc-300">{a.name}</span>
                      <span className="text-purple-400">{a.contractsSigned} signed · {a.doorsKnocked} doors</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic">— no self-reported activity this week</p>
              )}
              <p className="text-[10px] text-zinc-600 italic">Source: {data.activityLeaderboard.source}</p>
            </SectionCard>

            {/* === Weather === */}
            <SectionCard
              title="Weather Callout (this week)"
              icon={Cloud}
              hint="7-day forecast for Decatur AL (Open-Meteo)"
            >
              {data.weather ? (
                <>
                  <p className="text-sm text-zinc-300">{data.weather.summary}</p>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 rounded bg-zinc-800/50">
                      <p className="text-[10px] uppercase text-zinc-500">Workable days</p>
                      <p className="font-bold text-lime-400">
                        {data.weather.workableDays === null ? '—' : `${data.weather.workableDays} / 7`}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-zinc-800/50">
                      <p className="text-[10px] uppercase text-zinc-500">Storm days</p>
                      <p className="font-bold text-orange-400">{data.weather.stormDays.length}</p>
                    </div>
                  </div>
                  {data.weather.hasAlerts && (
                    <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                      <strong>Active alerts:</strong>
                      <ul className="list-disc list-inside mt-1">
                        {data.weather.alertHeadlines.map((h, i) => <li key={i}>{h}</li>)}
                      </ul>
                    </div>
                  )}
                  <p className="text-[10px] text-zinc-600 italic">Source: {data.weather.source}</p>
                </>
              ) : (
                <p className="text-xs text-zinc-500 italic">— weather data unavailable</p>
              )}
            </SectionCard>

            {/* === Customer wins + operational === */}
            <SectionCard
              title="Customer Wins + Ops"
              icon={Trophy}
              hint="Loads verified, missed calls, open leads"
            >
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 rounded bg-zinc-800/50">
                  <p className="text-[10px] uppercase text-zinc-500">Loads verified</p>
                  <p className="font-bold text-lime-400">{fmtFigure(data.customerWins.loadVerifiedCount)}</p>
                </div>
                <div className="p-2 rounded bg-zinc-800/50">
                  <p className="text-[10px] uppercase text-zinc-500">Loads $ total</p>
                  <p className="font-bold text-lime-400">{fmtFigure(data.customerWins.loadVerifiedTotal, true)}</p>
                </div>
                <div className="p-2 rounded bg-zinc-800/50">
                  <p className="text-[10px] uppercase text-zinc-500">Missed calls</p>
                  <p className="font-bold text-red-400">{fmtFigure(data.missedCalls)}</p>
                </div>
                <div className="p-2 rounded bg-zinc-800/50">
                  <p className="text-[10px] uppercase text-zinc-500">Recent hail</p>
                  <p className="font-bold text-orange-400">{fmtFigure(data.recentStorms.hailReportCount)}</p>
                </div>
              </div>
              {data.openLeadsByRep.length > 0 && (
                <div className="text-xs">
                  <p className="text-zinc-500 mb-1">Open leads by rep:</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {data.openLeadsByRep.slice(0, 8).map((r) => (
                      <div key={r.name} className="flex justify-between p-1.5 rounded bg-zinc-800/30">
                        <span className="text-zinc-300">{r.name}</span>
                        <span className="text-cyan-400">{r.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>

            {/* === Proposed announcements === */}
            <div className="lg:col-span-2">
              <SectionCard
                title="Proposed Announcements"
                icon={Megaphone}
                hint="Yellow border = confidence < 0.7, owner review required before deck."
              >
                {editing.proposedAnnouncements.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">
                    No announcement candidates found from last week&apos;s notes.
                    Add manually in the meeting prep page.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {editing.proposedAnnouncements.map((a, i) => (
                      <div
                        key={i}
                        className={cn(
                          'p-3 rounded-lg border space-y-2',
                          a.needsOwnerReview
                            ? 'border-yellow-500/40 bg-yellow-500/5'
                            : 'border-zinc-700 bg-zinc-800/30'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-medium',
                              a.confidence >= 0.85 ? 'bg-lime-500/20 text-lime-400'
                                : a.confidence >= 0.7 ? 'bg-brand-green/20 text-blue-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            )}
                          >
                            confidence {(a.confidence * 100).toFixed(0)}%
                          </span>
                          {a.needsOwnerReview && (
                            <span className="text-[10px] text-yellow-400 uppercase tracking-wide">needs review</span>
                          )}
                        </div>
                        <input
                          type="text"
                          value={a.title}
                          onChange={(e) => updateAnnouncement(i, { title: e.target.value })}
                          placeholder="Title"
                          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-white"
                        />
                        <textarea
                          value={a.content}
                          onChange={(e) => updateAnnouncement(i, { content: e.target.value })}
                          rows={2}
                          placeholder="Content"
                          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-white"
                        />
                        <p className="text-[10px] text-zinc-600 italic">{a.source}</p>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>

            {/* === Warnings + data sources === */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.warnings.length > 0 && (
                <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                  <h3 className="text-sm font-semibold text-yellow-400 flex items-center gap-2 mb-2">
                    <AlertCircle size={16} /> Warnings
                  </h3>
                  <ul className="text-xs text-yellow-300 space-y-1 list-disc list-inside">
                    {data.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <h3 className="text-sm font-semibold text-zinc-300 mb-2">Data sources</h3>
                <ul className="text-[11px] text-zinc-500 space-y-1 list-disc list-inside">
                  {data.dataSources.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </div>

            {/* === Save bar === */}
            <div className="lg:col-span-2 flex items-center justify-between py-4 border-t border-zinc-800">
              <p className="text-xs text-zinc-500">
                Generated {new Date(data.generatedAt).toLocaleString()} · weekStart {data.weekStart}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => save(false)}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-700 text-white font-medium hover:bg-zinc-600 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Save Draft
                </button>
                <button
                  onClick={() => save(true)}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-lime-500 text-zinc-900 font-semibold hover:bg-lime-400 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                  Approve &amp; Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGate>
  );
}
