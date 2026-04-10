'use client';

/**
 * System Health Dashboard
 *
 * Owner/admin only. Dark theme matching command center.
 * Shows cron statuses, webhook health, sheet tab sizes, and inventory sync info.
 * Auto-refreshes every 60 seconds.
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Activity,
  Database,
  Package,
  Loader2,
  Wifi,
  HelpCircle,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CronStatus {
  name: string;
  lastRunAt: string | null;
  status: 'success' | 'error' | 'unknown';
  duration?: number;
  details?: string;
}

interface WebhookStatus {
  name: string;
  lastReceivedAt: string | null;
  totalReceived: number;
  lastError?: string;
}

interface SheetTabInfo {
  tabName: string;
  rowCount: number;
  status: 'ok' | 'large' | 'empty';
}

interface SystemHealthData {
  success: boolean;
  crons: CronStatus[];
  webhooks: WebhookStatus[];
  sheets: SheetTabInfo[];
  inventory: {
    portalItemCount: number;
    legacySyncDirection: string;
  };
  timestamp: string;
}

// ── Expected intervals (in minutes) for staleness detection ───────────────────

const EXPECTED_INTERVALS: Record<string, number> = {
  'check-lead-timers': 2,
  'auto-reassign': 5,
  'backup-sheets': 60,
  'low-stock-alert': 1440,       // 24hr
  'sync-inventory-tab': 10,
  'meeting-reset': 10080,        // weekly
  'weekly-numbers-reminder': 10080, // weekly
  'publish-blog': 1440,          // daily
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(isoStr: string | null): string {
  if (!isoStr) return 'Never';
  const diff = Date.now() - new Date(isoStr).getTime();
  if (diff < 0) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h ago`;
}

function isStale(cron: CronStatus): boolean {
  if (!cron.lastRunAt) return true;
  const expectedMin = EXPECTED_INTERVALS[cron.name];
  if (!expectedMin) return false;
  const elapsed = Date.now() - new Date(cron.lastRunAt).getTime();
  return elapsed > expectedMin * 2 * 60000;
}

function formatMs(ms?: number): string {
  if (ms === undefined) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function cronDisplayName(name: string): string {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SystemHealthPage() {
  const [data, setData] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/portal/system-health', { cache: 'no-store' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 60000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  // Count totals for the header
  const cronOk = data?.crons.filter(c => c.status === 'success' && !isStale(c)).length ?? 0;
  const cronTotal = data?.crons.length ?? 0;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/command-center"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">System Health</h1>
              <p className="text-sm text-gray-400">
                {lastRefresh
                  ? `Last refreshed ${timeAgo(lastRefresh.toISOString())} · auto-refresh 60s`
                  : 'Loading...'}
              </p>
            </div>
          </div>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {!data && loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#39FF14]" />
          </div>
        )}

        {data && (
          <div className="space-y-8">
            {/* ── Cron Status ─────────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-5 h-5 text-[#39FF14]" />
                <h2 className="text-lg font-semibold">Cron Jobs</h2>
                <span className="text-sm text-gray-400">
                  {cronOk}/{cronTotal} healthy
                </span>
              </div>
              <div className="bg-white/5 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400">
                      <th className="text-left py-3 px-4 font-medium">Cron Name</th>
                      <th className="text-left py-3 px-4 font-medium">Last Run</th>
                      <th className="text-center py-3 px-4 font-medium">Status</th>
                      <th className="text-right py-3 px-4 font-medium">Duration</th>
                      <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.crons.map((cron) => {
                      const stale = isStale(cron);
                      const isOk = cron.status === 'success' && !stale;
                      const isErr = cron.status === 'error';
                      const isUnknown = cron.status === 'unknown';

                      return (
                        <tr key={cron.name} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-3 px-4 font-medium">{cronDisplayName(cron.name)}</td>
                          <td className="py-3 px-4 text-gray-400">{timeAgo(cron.lastRunAt)}</td>
                          <td className="py-3 px-4 text-center">
                            {isOk && (
                              <span className="inline-flex items-center gap-1 text-green-400">
                                <CheckCircle className="w-4 h-4" /> OK
                              </span>
                            )}
                            {isErr && (
                              <span className="inline-flex items-center gap-1 text-red-400">
                                <XCircle className="w-4 h-4" /> Error
                              </span>
                            )}
                            {stale && !isErr && !isUnknown && (
                              <span className="inline-flex items-center gap-1 text-yellow-400">
                                <AlertTriangle className="w-4 h-4" /> Stale
                              </span>
                            )}
                            {isUnknown && (
                              <span className="inline-flex items-center gap-1 text-gray-500">
                                <HelpCircle className="w-4 h-4" /> Unknown
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-400 font-mono text-xs">
                            {formatMs(cron.duration)}
                          </td>
                          <td className="py-3 px-4 text-gray-500 text-xs truncate max-w-[300px] hidden md:table-cell">
                            {cron.details || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Webhook Status ───────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Wifi className="w-5 h-5 text-[#39FF14]" />
                <h2 className="text-lg font-semibold">Webhooks</h2>
              </div>
              <div className="bg-white/5 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400">
                      <th className="text-left py-3 px-4 font-medium">Webhook</th>
                      <th className="text-left py-3 px-4 font-medium">Last Received</th>
                      <th className="text-right py-3 px-4 font-medium">Total Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.webhooks.map((wh) => (
                      <tr key={wh.name} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-3 px-4 font-medium">{wh.name}</td>
                        <td className="py-3 px-4 text-gray-400">
                          {wh.lastReceivedAt ? timeAgo(wh.lastReceivedAt) : 'Not tracked yet'}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-400 font-mono">
                          {wh.totalReceived > 0 ? wh.totalReceived : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Sheet Tab Sizes (CSS bar chart) ─────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Database className="w-5 h-5 text-[#39FF14]" />
                <h2 className="text-lg font-semibold">Google Sheet Tabs</h2>
                <span className="text-sm text-gray-400">
                  {data.sheets.length} tabs
                </span>
              </div>
              <div className="bg-white/5 rounded-xl p-4 space-y-2 max-h-[500px] overflow-y-auto">
                {data.sheets.map((tab) => {
                  const maxRows = Math.max(...data.sheets.map(s => s.rowCount), 1);
                  const pct = Math.max((tab.rowCount / maxRows) * 100, 1);
                  const barColor =
                    tab.rowCount > 10000
                      ? '#ef4444'    // red
                      : tab.rowCount > 5000
                        ? '#eab308'  // yellow
                        : '#39FF14'; // green

                  return (
                    <div key={tab.tabName} className="flex items-center gap-3">
                      <div className="w-44 text-xs text-gray-400 truncate shrink-0" title={tab.tabName}>
                        {tab.tabName}
                      </div>
                      <div className="flex-1 bg-white/5 rounded-full h-5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: barColor }}
                        />
                      </div>
                      <div className="w-20 text-right text-xs font-mono text-gray-400 shrink-0">
                        {tab.rowCount.toLocaleString()} rows
                      </div>
                      {tab.status === 'large' && (
                        <span className="shrink-0" aria-label="Large tab (>5000 rows)">
                          <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        </span>
                      )}
                      {tab.status === 'empty' && (
                        <span className="text-[10px] text-gray-600 shrink-0">empty</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ── Inventory Sync ───────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Package className="w-5 h-5 text-[#39FF14]" />
                <h2 className="text-lg font-semibold">Inventory Sync</h2>
              </div>
              <div className="bg-white/5 rounded-xl p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Portal Items</p>
                    <p className="text-2xl font-bold text-[#39FF14]">{data.inventory.portalItemCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Sync Direction</p>
                    <p className="text-sm font-medium">{data.inventory.legacySyncDirection}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Legacy Status</p>
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-green-400" />
                      <span className="text-sm">Read-only mirror</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
