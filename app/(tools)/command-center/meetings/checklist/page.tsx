'use client';

/**
 * RCRS Command Center - Monday Morning Prep Checklist
 *
 * Interactive checklist for Michael (owner) and Sara (admin) to prepare
 * for and run the Monday morning team meeting. Includes:
 * - Before Meeting tasks (7:00 AM)
 * - During Meeting tasks (8:00 AM)
 * - After Meeting tasks
 * - Rep Submission Status panel (who submitted weekly numbers)
 * - Quick Stats panel (revenue, inspections, contracts, top performer)
 *
 * Checklist state persists in localStorage.
 * Access: Owner/Admin only (dashboard.viewAll permission)
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  Users,
  DollarSign,
  ClipboardCheck,
  FileSearch,
  BarChart3,
  Presentation,
  Pencil,
  Archive,
  Loader2,
  TrendingUp,
  CalendarCheck,
} from 'lucide-react';
import { LoadingSpinner, PermissionGate } from '@/components/command-center';

// =============================================================================
// Types
// =============================================================================

interface ChecklistItem {
  id: string;
  label: string;
  description?: string;
  link?: string;
  linkLabel?: string;
  action?: 'sync';
  icon: React.ElementType;
}

interface ChecklistSection {
  title: string;
  time?: string;
  items: ChecklistItem[];
}

interface RepSubmission {
  repName: string;
  submitted: boolean;
  revenue?: number;
  inspected?: number;
  signed?: number;
}

interface QuickStats {
  totalRevenue: number;
  totalInspections: number;
  totalSigned: number;
  topPerformer: string;
  topPerformerRevenue: number;
}

interface WeeklyRecord {
  repName?: string;
  week?: string;
  doorsKnocked?: number;
  appointmentsSet?: number;
  inspectionsCompleted?: number;
  estimatesGiven?: number;
  contractsSigned?: number;
  revenueClosed?: number;
  leadsGenerated?: number;
  followUpsMade?: number;
  notes?: string;
  submittedAt?: string;
  // New field names
  inspected?: number;
  damage?: number;
  signed?: number;
  repair?: number;
  gutter?: number;
  revenue?: number;
  approved?: number;
  goal?: number;
  referrals?: number;
  agents?: number;
  present?: string;
  homeShow?: number;
}

// =============================================================================
// Constants
// =============================================================================

const ACTIVE_SALES_REPS = [
  'Hunter Rivers',
  'Aaron Lussi',
  'Greg Muse',
  'Brendon Muse',
  'Adam Rudell',
  'Joseph Dowd',
  'Boston Muse',
  'Alijah',
  'Travis Wages',
  'Rick',
];

const CHECKLIST_SECTIONS: ChecklistSection[] = [
  {
    title: 'Before Meeting',
    time: '7:00 AM',
    items: [
      {
        id: 'sync-numbers',
        label: 'Sync latest meeting numbers',
        description: 'Pull the latest data from Google Sheets',
        action: 'sync',
        icon: RefreshCw,
      },
      {
        id: 'check-submissions',
        label: 'Check which reps have submitted weekly numbers',
        description: 'Review the Rep Submission Status panel below',
        icon: Users,
      },
      {
        id: 'review-announcements',
        label: 'Review department announcements',
        link: '/portal/monday-notes/admin',
        linkLabel: 'Monday Notes Admin',
        icon: ClipboardCheck,
      },
      {
        id: 'verify-leaderboard',
        label: 'Verify sales leaderboard data',
        link: '/command-center/sales/leaderboard',
        linkLabel: 'Sales Leaderboard',
        icon: BarChart3,
      },
      {
        id: 'review-commissions',
        label: 'Review commission numbers',
        link: '/command-center/sales',
        linkLabel: 'Sales Dashboard',
        icon: DollarSign,
      },
      {
        id: 'prepare-slides',
        label: 'Prepare meeting slides',
        link: '/command-center/meetings/prep',
        linkLabel: 'Meeting Prep',
        icon: FileSearch,
      },
    ],
  },
  {
    title: 'During Meeting',
    time: '8:00 AM',
    items: [
      {
        id: 'open-presentation',
        label: 'Open presentation mode',
        link: '/command-center/meetings/present',
        linkLabel: 'Present',
        icon: Presentation,
      },
      {
        id: 'collect-numbers',
        label: 'Collect any missing rep numbers',
        description: 'Follow up with reps who have not submitted',
        icon: Pencil,
      },
      {
        id: 'note-action-items',
        label: 'Note action items from department updates',
        description: 'Capture tasks and follow-ups',
        icon: ClipboardCheck,
      },
    ],
  },
  {
    title: 'After Meeting',
    items: [
      {
        id: 'verify-all-numbers',
        label: 'Verify all reps\' numbers are in the system',
        description: 'Re-check the submission panel for completeness',
        icon: CheckCircle2,
      },
      {
        id: 'update-corrections',
        label: 'Update any corrections',
        description: 'Fix any data entry errors from the meeting',
        icon: Pencil,
      },
      {
        id: 'archive-notes',
        label: 'Archive meeting notes',
        description: 'Save notes and action items for the week',
        icon: Archive,
      },
    ],
  },
];

const LOCALSTORAGE_KEY = 'monday-checklist-state';

/**
 * Get the ISO week string for the previous week (the week reps are reporting on).
 */
function getPreviousISOWeek(): string {
  const now = new Date();
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d = new Date(Date.UTC(lastWeek.getFullYear(), lastWeek.getMonth(), lastWeek.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Format an ISO week string like "2026-W13" into a readable label.
 */
function formatWeekLabel(weekStr: string): string {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekStr;
  return `Week ${parseInt(match[2])}, ${match[1]}`;
}

// =============================================================================
// Checklist Item Component
// =============================================================================

interface ChecklistItemRowProps {
  item: ChecklistItem;
  checked: boolean;
  onToggle: () => void;
  onSync?: () => void;
  syncing?: boolean;
  submissionCount?: string;
}

function ChecklistItemRow({
  item,
  checked,
  onToggle,
  onSync,
  syncing,
  submissionCount,
}: ChecklistItemRowProps) {
  const Icon = item.icon;

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
        checked
          ? 'bg-lime-500/5 border-lime-500/20'
          : 'bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className={`mt-0.5 flex-shrink-0 flex h-5 w-5 items-center justify-center rounded border transition-colors ${
          checked
            ? 'bg-lime-500 border-lime-500 text-zinc-900'
            : 'border-zinc-600 hover:border-zinc-400'
        }`}
      >
        {checked && (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Icon */}
      <div className={`flex-shrink-0 mt-0.5 ${checked ? 'text-lime-400/60' : 'text-zinc-500'}`}>
        <Icon size={18} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-sm font-medium ${
              checked ? 'text-zinc-500 line-through' : 'text-white'
            }`}
          >
            {item.label}
          </span>
          {item.id === 'check-submissions' && submissionCount && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300">
              {submissionCount}
            </span>
          )}
        </div>
        {item.description && (
          <p className={`text-xs mt-0.5 ${checked ? 'text-zinc-600' : 'text-zinc-500'}`}>
            {item.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          {item.link && (
            <Link
              href={item.link}
              className="inline-flex items-center gap-1 text-xs text-lime-400 hover:text-lime-300 transition-colors"
            >
              <ExternalLink size={12} />
              {item.linkLabel || 'Open'}
            </Link>
          )}
          {item.action === 'sync' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSync?.();
              }}
              disabled={syncing}
              className="inline-flex items-center gap-1 text-xs text-lime-400 hover:text-lime-300 disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors"
            >
              {syncing ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function MondayChecklistPage() {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [repSubmissions, setRepSubmissions] = useState<RepSubmission[]>([]);
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const previousWeek = getPreviousISOWeek();

  // ─── Load checklist state from localStorage ────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCALSTORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Only load state from the same week to avoid stale checks
        if (parsed.week === previousWeek && parsed.items) {
          setCheckedItems(parsed.items);
        }
      }
    } catch {
      // Invalid localStorage data, start fresh
    }
  }, [previousWeek]);

  // ─── Save checklist state to localStorage ──────────────────────────────────
  const saveChecklist = useCallback(
    (items: Record<string, boolean>) => {
      try {
        localStorage.setItem(
          LOCALSTORAGE_KEY,
          JSON.stringify({ week: previousWeek, items })
        );
      } catch {
        // localStorage full or unavailable
      }
    },
    [previousWeek]
  );

  // ─── Toggle a checklist item ───────────────────────────────────────────────
  const toggleItem = useCallback(
    (id: string) => {
      setCheckedItems((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        saveChecklist(next);
        return next;
      });
    },
    [saveChecklist]
  );

  // ─── Sync meeting numbers ─────────────────────────────────────────────────
  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/command-center/meetings/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: new Date().getFullYear() }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSyncMessage({
          type: 'success',
          text: `Synced successfully. ${json.data?.recordCount ?? ''} records updated.`,
        });
      } else {
        setSyncMessage({
          type: 'error',
          text: json.error || 'Sync failed. Check the console for details.',
        });
      }
    } catch (err) {
      setSyncMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Network error during sync.',
      });
    } finally {
      setSyncing(false);
    }
  }, []);

  // ─── Fetch rep submission data ─────────────────────────────────────────────
  const fetchSubmissions = useCallback(async () => {
    setLoadingSubmissions(true);
    setSubmissionError(null);
    try {
      const res = await fetch(
        `/api/portal/weekly-numbers?allReps=true&weekStart=${previousWeek}&weekEnd=${previousWeek}`
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to fetch weekly numbers');
      }

      const records: WeeklyRecord[] = json.records || [];

      // Build submission map from actual records
      const submittedMap = new Map<string, WeeklyRecord>();
      for (const rec of records) {
        const name = rec.repName || '';
        if (name) {
          submittedMap.set(name.toLowerCase(), rec);
        }
      }

      // Check each active rep
      const submissions: RepSubmission[] = ACTIVE_SALES_REPS.map((repName) => {
        const rec = submittedMap.get(repName.toLowerCase());
        return {
          repName,
          submitted: !!rec,
          revenue: rec ? (rec.revenue ?? rec.revenueClosed ?? 0) : undefined,
          inspected: rec ? (rec.inspected ?? rec.doorsKnocked ?? 0) : undefined,
          signed: rec ? (rec.signed ?? rec.contractsSigned ?? 0) : undefined,
        };
      });

      setRepSubmissions(submissions);

      // Calculate quick stats from submitted records
      const submittedReps = submissions.filter((s) => s.submitted);
      let totalRevenue = 0;
      let totalInspections = 0;
      let totalSigned = 0;
      let topPerformer = 'N/A';
      let topPerformerRevenue = 0;

      for (const rep of submittedReps) {
        const rev = rep.revenue || 0;
        totalRevenue += rev;
        totalInspections += rep.inspected || 0;
        totalSigned += rep.signed || 0;
        if (rev > topPerformerRevenue) {
          topPerformerRevenue = rev;
          topPerformer = rep.repName;
        }
      }

      setQuickStats({
        totalRevenue,
        totalInspections,
        totalSigned,
        topPerformer,
        topPerformerRevenue,
      });
    } catch (err) {
      setSubmissionError(
        err instanceof Error ? err.message : 'Failed to load submission data'
      );
      setRepSubmissions(
        ACTIVE_SALES_REPS.map((repName) => ({
          repName,
          submitted: false,
        }))
      );
    } finally {
      setLoadingSubmissions(false);
    }
  }, [previousWeek]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // ─── Computed values ──────────────────────────────────────────────────────
  const submittedCount = repSubmissions.filter((r) => r.submitted).length;
  const totalReps = repSubmissions.length;
  const submissionCountLabel = `${submittedCount}/${totalReps} reps submitted`;

  const totalItems = CHECKLIST_SECTIONS.reduce((sum, s) => sum + s.items.length, 0);
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const progressPct = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

  // ─── Format currency ──────────────────────────────────────────────────────
  const fmtCurrency = (val: number) =>
    val.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });

  return (
    <PermissionGate
      permissions={['dashboard.viewAll']}
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 max-w-md">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-400 mb-2">Access Denied</h2>
            <p className="text-zinc-400 mb-4">
              Only Owners and Admins can access the Monday checklist.
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
        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <div>
          <Link
            href="/command-center/meetings"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Meeting Hub
          </Link>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <CalendarCheck className="h-8 w-8 text-lime-400" />
            Monday Morning Prep Checklist
          </h1>
          <p className="text-zinc-400 mt-1">
            Reviewing: <span className="text-white font-medium">{formatWeekLabel(previousWeek)}</span>
          </p>
        </div>

        {/* ─── Progress Bar ────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-zinc-300">
              Progress: {checkedCount}/{totalItems} tasks
            </span>
            <span className="text-sm font-bold text-lime-400">{progressPct}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-lime-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* ─── Sync Message ────────────────────────────────────────────────── */}
        {syncMessage && (
          <div
            className={`flex items-center gap-3 p-4 rounded-lg border ${
              syncMessage.type === 'success'
                ? 'bg-lime-500/10 border-lime-500/20 text-lime-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {syncMessage.type === 'success' ? (
              <CheckCircle2 size={20} />
            ) : (
              <AlertCircle size={20} />
            )}
            <span className="text-sm">{syncMessage.text}</span>
          </div>
        )}

        {/* ─── Main Grid ──────────────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column: Checklist (2 cols wide) */}
          <div className="lg:col-span-2 space-y-6">
            {CHECKLIST_SECTIONS.map((section) => (
              <div
                key={section.title}
                className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden"
              >
                {/* Section Header */}
                <div className="p-4 border-b border-zinc-800 bg-zinc-800/30">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-500/20">
                      <Clock className="h-5 w-5 text-lime-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">{section.title}</h2>
                      {section.time && (
                        <p className="text-sm text-zinc-500">{section.time}</p>
                      )}
                    </div>
                    {/* Section completion count */}
                    <div className="ml-auto">
                      <span className="text-xs text-zinc-500">
                        {section.items.filter((i) => checkedItems[i.id]).length}/
                        {section.items.length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section Items */}
                <div className="p-4 space-y-2">
                  {section.items.map((item) => (
                    <ChecklistItemRow
                      key={item.id}
                      item={item}
                      checked={!!checkedItems[item.id]}
                      onToggle={() => toggleItem(item.id)}
                      onSync={item.action === 'sync' ? handleSync : undefined}
                      syncing={syncing}
                      submissionCount={
                        item.id === 'check-submissions' ? submissionCountLabel : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Status Panels */}
          <div className="space-y-6">
            {/* ─── Rep Submission Status ──────────────────────────────────── */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
              <div className="p-4 border-b border-zinc-800 bg-zinc-800/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-500/20">
                      <Users className="h-5 w-5 text-lime-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">Rep Submissions</h2>
                      <p className="text-xs text-zinc-500">{formatWeekLabel(previousWeek)}</p>
                    </div>
                  </div>
                  <button
                    onClick={fetchSubmissions}
                    disabled={loadingSubmissions}
                    className="p-2 rounded-lg text-zinc-500 hover:text-lime-400 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw
                      size={16}
                      className={loadingSubmissions ? 'animate-spin' : ''}
                    />
                  </button>
                </div>
              </div>

              <div className="p-4">
                {loadingSubmissions ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="md" />
                  </div>
                ) : submissionError ? (
                  <div className="text-center py-6">
                    <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                    <p className="text-sm text-red-400">{submissionError}</p>
                    <button
                      onClick={fetchSubmissions}
                      className="mt-2 text-xs text-lime-400 hover:text-lime-300"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Summary bar */}
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-zinc-800">
                      <span className="text-sm text-zinc-400">Submitted</span>
                      <span
                        className={`text-sm font-bold ${
                          submittedCount === totalReps
                            ? 'text-lime-400'
                            : submittedCount > 0
                            ? 'text-yellow-400'
                            : 'text-red-400'
                        }`}
                      >
                        {submittedCount}/{totalReps}
                      </span>
                    </div>

                    {/* Rep list */}
                    <div className="space-y-1.5">
                      {repSubmissions.map((rep) => (
                        <div
                          key={rep.repName}
                          className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-zinc-800/50"
                        >
                          <div className="flex items-center gap-2">
                            {rep.submitted ? (
                              <CheckCircle2 size={16} className="text-lime-400 flex-shrink-0" />
                            ) : (
                              <XCircle size={16} className="text-red-400 flex-shrink-0" />
                            )}
                            <span
                              className={`text-sm ${
                                rep.submitted ? 'text-zinc-300' : 'text-zinc-500'
                              }`}
                            >
                              {rep.repName}
                            </span>
                          </div>
                          {rep.submitted && rep.revenue !== undefined && rep.revenue > 0 && (
                            <span className="text-xs text-zinc-500 font-mono">
                              {fmtCurrency(rep.revenue)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ─── Quick Stats ────────────────────────────────────────────── */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
              <div className="p-4 border-b border-zinc-800 bg-zinc-800/30">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-500/20">
                    <TrendingUp className="h-5 w-5 text-lime-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Quick Stats</h2>
                    <p className="text-xs text-zinc-500">{formatWeekLabel(previousWeek)}</p>
                  </div>
                </div>
              </div>

              <div className="p-4">
                {loadingSubmissions ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="md" />
                  </div>
                ) : quickStats ? (
                  <div className="space-y-4">
                    {/* Total Revenue */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign size={16} className="text-lime-400" />
                        <span className="text-sm text-zinc-400">Total Revenue</span>
                      </div>
                      <span className="text-lg font-bold text-white">
                        {fmtCurrency(quickStats.totalRevenue)}
                      </span>
                    </div>

                    {/* Inspections */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileSearch size={16} className="text-blue-400" />
                        <span className="text-sm text-zinc-400">Inspections</span>
                      </div>
                      <span className="text-lg font-bold text-white">
                        {quickStats.totalInspections}
                      </span>
                    </div>

                    {/* Contracts Signed */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck size={16} className="text-purple-400" />
                        <span className="text-sm text-zinc-400">Contracts Signed</span>
                      </div>
                      <span className="text-lg font-bold text-white">
                        {quickStats.totalSigned}
                      </span>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-zinc-800" />

                    {/* Top Performer */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <BarChart3 size={16} className="text-yellow-400" />
                        <span className="text-sm text-zinc-400">Top Performer</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-white font-semibold">
                          {quickStats.topPerformer}
                        </span>
                        {quickStats.topPerformerRevenue > 0 && (
                          <span className="text-sm text-lime-400 font-mono">
                            {fmtCurrency(quickStats.topPerformerRevenue)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 text-center py-4">
                    No data available for this week.
                  </p>
                )}
              </div>
            </div>

            {/* ─── Quick Links ────────────────────────────────────────────── */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
              <div className="p-4 border-b border-zinc-800 bg-zinc-800/30">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                  Quick Links
                </h2>
              </div>
              <div className="p-3 space-y-1">
                {[
                  { href: '/command-center/meetings/prep', label: 'Meeting Prep' },
                  { href: '/command-center/meetings/present', label: 'Presentation Mode' },
                  { href: '/command-center/sales/leaderboard', label: 'Sales Leaderboard' },
                  { href: '/command-center/sales', label: 'Commission Dashboard' },
                  { href: '/portal/monday-notes/admin', label: 'Monday Notes Admin' },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between p-2.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  >
                    <span>{link.label}</span>
                    <ExternalLink size={14} />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Reset Button ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end py-4 border-t border-zinc-800">
          <button
            onClick={() => {
              setCheckedItems({});
              saveChecklist({});
            }}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Reset all checkboxes
          </button>
        </div>
      </div>
    </PermissionGate>
  );
}
