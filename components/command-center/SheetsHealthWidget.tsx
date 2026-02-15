'use client';

/**
 * Sheets Health Dashboard Widget
 * Shows green/yellow/red status for each connected Google Sheet tab
 */

import * as React from 'react';
import {
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  Clock,
  Loader2,
  Wrench,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SheetHealth {
  sheetName: string;
  status: 'healthy' | 'stale' | 'error' | 'empty';
  rowCount: number;
  lastModified: string | null;
  staleDays: number | null;
  staleThresholdDays: number;
  connectionOk: boolean;
  error: string | null;
  description: string;
}

interface HealthReport {
  spreadsheetTitle: string;
  overallStatus: 'healthy' | 'stale' | 'error';
  totalSheets: number;
  healthyCount: number;
  staleCount: number;
  errorCount: number;
  emptyCount: number;
  sheets: SheetHealth[];
  checkedAt: string;
  apiKeyValid: boolean;
}

const statusConfig = {
  healthy: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', label: 'Healthy' },
  stale: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', label: 'Stale' },
  error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Error' },
  empty: { icon: FileSpreadsheet, color: 'text-zinc-500', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', label: 'Empty' },
};

export function SheetsHealthWidget() {
  const [report, setReport] = React.useState<HealthReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [repairing, setRepairing] = React.useState<string | null>(null);
  const [repairResult, setRepairResult] = React.useState<string | null>(null);

  const fetchHealth = React.useCallback(async () => {
    setLoading(true);
    setRepairResult(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') || '' : '';
      const res = await fetch('/api/admin/sheets-health', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setReport(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch sheets health:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const attemptRepair = async (sheetName: string) => {
    setRepairing(sheetName);
    setRepairResult(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') || '' : '';
      const res = await fetch('/api/admin/sheets-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sheetName }),
      });
      const data = await res.json();
      setRepairResult(data.success ? `✅ "${sheetName}" repaired` : `❌ Repair failed - check logs`);
      // Refresh health after repair
      await fetchHealth();
    } catch {
      setRepairResult('❌ Repair request failed');
    } finally {
      setRepairing(null);
    }
  };

  React.useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const overallCfg = report ? statusConfig[report.overallStatus] : statusConfig.healthy;
  const OverallIcon = overallCfg.icon;

  // Show problem sheets first, then sort alphabetically
  const sortedSheets = React.useMemo(() => {
    if (!report) return [];
    return [...report.sheets].sort((a, b) => {
      const priority = { error: 0, stale: 1, empty: 2, healthy: 3 };
      const diff = priority[a.status] - priority[b.status];
      return diff !== 0 ? diff : a.sheetName.localeCompare(b.sheetName);
    });
  }, [report]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', overallCfg.bg)}>
            <FileSpreadsheet size={20} className={overallCfg.color} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Sheets Health</h2>
            {report && (
              <p className="text-xs text-zinc-500">
                {report.spreadsheetTitle} • {report.totalSheets} tabs monitored
              </p>
            )}
          </div>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh
        </button>
      </div>

      {/* Summary Pills */}
      {report && (
        <div className="mb-4 flex flex-wrap gap-2">
          {report.healthyCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-400">
              <CheckCircle size={12} /> {report.healthyCount} healthy
            </span>
          )}
          {report.staleCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
              <AlertTriangle size={12} /> {report.staleCount} stale
            </span>
          )}
          {report.errorCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
              <XCircle size={12} /> {report.errorCount} errors
            </span>
          )}
          {report.emptyCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
              {report.emptyCount} empty
            </span>
          )}
          {!report.apiKeyValid && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
              <XCircle size={12} /> API Key Invalid
            </span>
          )}
        </div>
      )}

      {/* Repair result banner */}
      {repairResult && (
        <div className="mb-3 rounded-lg border border-zinc-700 bg-zinc-800/50 p-2 text-xs text-zinc-300">
          {repairResult}
        </div>
      )}

      {/* Loading State */}
      {loading && !report && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        </div>
      )}

      {/* Problem sheets always visible */}
      {report && (
        <div className="space-y-2">
          {sortedSheets
            .filter(s => s.status === 'error' || s.status === 'stale')
            .map(sheet => (
              <SheetRow key={sheet.sheetName} sheet={sheet} onRepair={attemptRepair} repairing={repairing} />
            ))}
        </div>
      )}

      {/* Expand/Collapse all sheets */}
      {report && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-zinc-800 bg-zinc-800/30 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? 'Hide' : 'Show'} all {report.totalSheets} sheets
          </button>

          {expanded && (
            <div className="mt-2 space-y-2">
              {sortedSheets
                .filter(s => s.status !== 'error' && s.status !== 'stale')
                .map(sheet => (
                  <SheetRow key={sheet.sheetName} sheet={sheet} onRepair={attemptRepair} repairing={repairing} />
                ))}
            </div>
          )}

          {/* Last checked */}
          <p className="mt-3 text-center text-xs text-zinc-600">
            <Clock size={10} className="mr-1 inline" />
            Checked {new Date(report.checkedAt).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}

function SheetRow({
  sheet,
  onRepair,
  repairing,
}: {
  sheet: SheetHealth;
  onRepair: (name: string) => void;
  repairing: string | null;
}) {
  const cfg = statusConfig[sheet.status];
  const StatusIcon = cfg.icon;

  return (
    <div className={cn('rounded-lg border p-3 flex items-center gap-3', cfg.border, cfg.bg)}>
      <StatusIcon size={16} className={cn(cfg.color, 'shrink-0')} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-white">{sheet.sheetName}</p>
          <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium', cfg.color, cfg.bg)}>
            {cfg.label}
          </span>
        </div>
        <p className="text-xs text-zinc-500 truncate">{sheet.description}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
          <span>{sheet.rowCount.toLocaleString()} rows</span>
          {sheet.lastModified && (
            <span>Updated: {new Date(sheet.lastModified).toLocaleDateString()}</span>
          )}
          {sheet.staleDays !== null && sheet.staleDays > 0 && (
            <span className={sheet.status === 'stale' ? 'text-yellow-400' : ''}>
              {sheet.staleDays}d ago
            </span>
          )}
          {sheet.error && (
            <span className="text-red-400 truncate max-w-[200px]">{sheet.error}</span>
          )}
        </div>
      </div>
      {(sheet.status === 'error' || sheet.status === 'stale') && (
        <button
          onClick={() => onRepair(sheet.sheetName)}
          disabled={repairing === sheet.sheetName}
          className="shrink-0 flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
        >
          {repairing === sheet.sheetName ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Wrench size={12} />
          )}
          Repair
        </button>
      )}
    </div>
  );
}
