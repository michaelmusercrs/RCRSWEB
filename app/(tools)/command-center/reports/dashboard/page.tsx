'use client';

/**
 * RCRS Command Center - Reports Dashboard
 *
 * Comprehensive reporting dashboard that aggregates data from all services.
 * Shows quick stats, daily snapshot, weekly trends, report templates,
 * report history, and scheduled reports.
 *
 * Role-based: Requires reports.view permission
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import * as React from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  FileText,
  Download,
  Calendar,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Phone,
  Package,
  Truck,
  CloudLightning,
  Star,
  Shield,
  ClipboardList,
  Play,
  Eye,
  Send,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import CommandCenterLayout from '@/components/command-center/CommandCenterLayout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MasterReport {
  meta: {
    type: string;
    label: string;
    periodStart: string;
    periodEnd: string;
    generatedAt: string;
  };
  revenue: {
    periodCommissions: number;
    periodTransactions: number;
    allTimeCommissions: number;
    allTimeTransactions: number;
    topReps: { name: string; amount: number; count: number }[];
    avgCommission: number;
  };
  leads: {
    total: number;
    converted: number;
    conversionRate: number;
    byStatus: Record<string, number>;
    bySource: Record<string, number>;
    avgResponseMinutes: number;
    allTimeLeads: number;
  };
  calls: {
    total: number;
    inbound: number;
    outbound: number;
    missed: number;
    voicemails: number;
    avgDurationSeconds: number;
    busiestHour: number;
    missedRate: number;
    allTimeCalls: number;
  };
  jobProgress: {
    totalJobs: number;
    activeJobs: number;
    completedJobs: number;
    byPhase: Record<string, number>;
  };
  inventory: {
    totalItems: number;
    lowStockCount: number;
    estimatedValue: number;
    reorderNeeded: { name: string; current: number; minimum: number }[];
  };
  customerSatisfaction: {
    totalReviews: number;
    avgRating: number;
    fiveStarCount: number;
    fourPlusRate: number;
    surveyResponses: number;
    avgSurveyScore: number;
  };
  weatherEvents: {
    periodEvents: number;
    activeAlerts: number;
    byType: Record<string, number>;
    estimatedLeads: number;
    allTimeEvents: number;
  };
  deliveries: {
    totalRoutes: number;
    completed: number;
    delayed: number;
    onTimeRate: number;
    avgStopsPerRoute: number;
    totalStops: number;
    allTimeRoutes: number;
  };
  timeTracking: {
    totalHours: number;
    totalEntries: number;
    avgHoursPerEntry: number;
    overtimeEntries: number;
    topEmployees: { name: string; hours: number }[];
    allTimeEntries: number;
  };
  warranties: {
    totalWarranties: number;
    active: number;
    expiringSoon: number;
    activeClaims: number;
  };
  subcontractors: {
    total: number;
    active: number;
    avgRating: number;
  };
  openItems: {
    pendingApprovals: number;
    overdueFollowups: number;
    unreadMessages: number;
    totalNotifications: number;
  };
}

interface ReportTemplate {
  id: string;
  name: string;
  sections: string[];
  schedule: string;
  recipients: string[];
}

interface ReportHistoryItem {
  id: string;
  reportName: string;
  type: string;
  period: { start: string; end: string };
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color = 'text-[#39FF14]',
  alert,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-gray-800 rounded-lg p-4 border',
        alert ? 'border-red-500/50' : 'border-white/10'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('w-4 h-4', color)} />
        <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn('text-2xl font-bold', color)}>{value}</div>
      {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
    </div>
  );
}

function SectionHeader({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-[#39FF14]" />
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function MetricRow({
  label,
  value,
  color,
  bar,
}: {
  label: string;
  value: string | number;
  color?: string;
  bar?: number;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <div className="flex items-center gap-3">
        {typeof bar === 'number' && (
          <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[#39FF14]"
              style={{ width: `${Math.min(bar, 100)}%` }}
            />
          </div>
        )}
        <span className={cn('text-sm font-medium', color || 'text-white')}>
          {value}
        </span>
      </div>
    </div>
  );
}

function TextBarChart({
  data,
  maxItems = 5,
}: {
  data: Record<string, number>;
  maxItems?: number;
}) {
  const entries = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxItems);
  const maxVal = entries.length > 0 ? entries[0][1] : 1;

  return (
    <div className="space-y-2">
      {entries.map(([label, val]) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-24 truncate">{label}</span>
          <div className="flex-1 h-4 bg-gray-700 rounded-sm overflow-hidden">
            <div
              className="h-full bg-[#39FF14]/70 rounded-sm"
              style={{ width: `${(val / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-300 w-8 text-right">{val}</span>
        </div>
      ))}
      {entries.length === 0 && (
        <div className="text-xs text-gray-500 text-center py-2">No data</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ReportsDashboardPage() {
  const { user } = useAuth();

  const [report, setReport] = React.useState<MasterReport | null>(null);
  const [summary, setSummary] = React.useState<Record<string, unknown> | null>(null);
  const [templates, setTemplates] = React.useState<ReportTemplate[]>([]);
  const [history, setHistory] = React.useState<ReportHistoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [reportType, setReportType] = React.useState<string>('weekly');
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [expandedSection, setExpandedSection] = React.useState<string | null>(null);

  // Date range for custom reports
  const [customStart, setCustomStart] = React.useState('');
  const [customEnd, setCustomEnd] = React.useState('');

  // Load data
  const loadReport = React.useCallback(async (type: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/master?type=${type}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to load report');
      }
      const data = await res.json();
      setReport(data.report);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTemplates = React.useCallback(async () => {
    try {
      const res = await fetch('/api/reports/configs');
      if (res.ok) {
        const data = await res.json();
        // Merge with built-in templates
        const builtIn: ReportTemplate[] = [
          {
            id: 'daily-ops',
            name: 'Daily Operations Report',
            sections: ['leads', 'calls', 'deliveries', 'weather', 'inventory_alerts'],
            schedule: 'daily',
            recipients: ['michael@rcrsal.com'],
          },
          {
            id: 'weekly-sales',
            name: 'Weekly Sales Report',
            sections: ['revenue', 'commissions', 'lead_conversion', 'rep_performance', 'pipeline'],
            schedule: 'weekly',
            recipients: ['michael@rcrsal.com'],
          },
          {
            id: 'monthly-financial',
            name: 'Monthly Financial Report',
            sections: ['revenue', 'expenses', 'profit_loss', 'accounts_receivable', 'cash_flow'],
            schedule: 'monthly',
            recipients: ['michael@rcrsal.com'],
          },
          {
            id: 'quarterly-business',
            name: 'Quarterly Business Review',
            sections: ['revenue_trends', 'customer_satisfaction', 'rep_rankings', 'warranty_claims'],
            schedule: 'quarterly',
            recipients: ['michael@rcrsal.com'],
          },
        ];
        const configs = data.configs || [];
        setTemplates([
          ...builtIn,
          ...configs.map((c: { id: string; name: string; sections?: { type: string }[]; schedule: string; recipients: string[] }) => ({
            id: c.id,
            name: c.name,
            sections: (c.sections || []).map((s: { type: string }) => s.type),
            schedule: c.schedule,
            recipients: c.recipients,
          })),
        ]);
      }
    } catch {
      // Use built-in templates as fallback
      setTemplates([
        {
          id: 'daily-ops',
          name: 'Daily Operations Report',
          sections: ['leads', 'calls', 'deliveries', 'weather', 'inventory_alerts'],
          schedule: 'daily',
          recipients: ['michael@rcrsal.com'],
        },
        {
          id: 'weekly-sales',
          name: 'Weekly Sales Report',
          sections: ['revenue', 'commissions', 'lead_conversion', 'rep_performance', 'pipeline'],
          schedule: 'weekly',
          recipients: ['michael@rcrsal.com'],
        },
        {
          id: 'monthly-financial',
          name: 'Monthly Financial Report',
          sections: ['revenue', 'expenses', 'profit_loss', 'accounts_receivable', 'cash_flow'],
          schedule: 'monthly',
          recipients: ['michael@rcrsal.com'],
        },
        {
          id: 'quarterly-business',
          name: 'Quarterly Business Review',
          sections: ['revenue_trends', 'customer_satisfaction', 'rep_rankings', 'warranty_claims'],
          schedule: 'quarterly',
          recipients: ['michael@rcrsal.com'],
        },
      ]);
    }
  }, []);

  const loadHistory = React.useCallback(async () => {
    try {
      const res = await fetch('/api/reports/history?limit=10');
      if (res.ok) {
        const data = await res.json();
        setHistory(
          (data.reports || []).map(
            (r: { id: string; reportName: string; type: string; period: { start: string; end: string }; generatedAt: string }) => ({
              id: r.id,
              reportName: r.reportName,
              type: r.type,
              period: r.period,
              generatedAt: r.generatedAt,
            })
          )
        );
      }
    } catch {
      // History may not exist yet
    }
  }, []);

  React.useEffect(() => {
    loadReport(reportType);
    loadTemplates();
    loadHistory();
  }, [reportType, loadReport, loadTemplates, loadHistory]);

  // Generate all reports
  const handleGenerateAll = async () => {
    setGenerating(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const types = ['daily', 'weekly', 'monthly'];
      const results = await Promise.allSettled(
        types.map((t) =>
          fetch(`/api/reports/generate?type=${t}`).then((r) => r.json())
        )
      );
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      setSuccessMsg(`Generated ${successCount}/${types.length} reports successfully`);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate reports');
    } finally {
      setGenerating(false);
    }
  };

  // Generate single report
  const handleGenerate = async (templateId: string) => {
    setGenerating(true);
    setError(null);
    setSuccessMsg(null);
    try {
      // Map template IDs to report types
      const typeMap: Record<string, string> = {
        'daily-ops': 'daily',
        'weekly-sales': 'weekly',
        'monthly-financial': 'monthly',
        'quarterly-business': 'weekly', // Generate with weekly config as fallback
      };
      const type = typeMap[templateId] || 'weekly';
      const res = await fetch(`/api/reports/generate?type=${type}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Generation failed');
      }
      setSuccessMsg(`Report generated successfully`);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  // Sync to Google Sheets
  const handleSyncSheets = async () => {
    setSyncing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/reports/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: reportType }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Sync failed');
      }
      setSuccessMsg(data.message || 'Synced to Google Sheets');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync to Google Sheets');
    } finally {
      setSyncing(false);
    }
  };

  // Format helpers
  const fmtCurrency = (n: number) =>
    '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fmtDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };
  const fmtHour = (h: number) =>
    h > 12 ? `${h - 12}:00 PM` : h === 12 ? '12:00 PM' : h === 0 ? '12:00 AM' : `${h}:00 AM`;

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  // Map TeamRole (lowercase) to Role (capitalized) for permission checks
  const userRole = (user?.role === 'owner' || user?.role === 'admin') ? 'Owner' :
                   user?.role === 'office' ? 'Office' :
                   user?.role === 'project_manager' ? 'Manager' :
                   user?.role === 'driver' ? 'Driver' : 'Sales';
  const canExport = hasPermission(userRole as 'Owner' | 'Admin' | 'Manager' | 'Sales' | 'Driver' | 'Office', 'reports.export');

  return (
    <CommandCenterLayout>
      <div className="min-h-screen bg-gray-900 p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-[#39FF14]" />
              Reports Dashboard
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Comprehensive business intelligence from all data sources
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Report Type Selector */}
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#39FF14] focus:outline-none"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>

            {/* Date Range Picker */}
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#39FF14] focus:outline-none"
              placeholder="Start"
            />
            <span className="text-gray-500 text-sm">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#39FF14] focus:outline-none"
              placeholder="End"
            />

            {/* Action Buttons */}
            <button
              onClick={handleGenerateAll}
              disabled={generating}
              className="flex items-center gap-2 bg-[#39FF14] text-gray-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#39FF14]/90 disabled:opacity-50 transition-colors"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Generate All Reports
            </button>
            <button
              onClick={handleSyncSheets}
              disabled={syncing}
              className="flex items-center gap-2 bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Sync to Google Sheets
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#39FF14] flex-shrink-0" />
            <span className="text-[#39FF14] text-sm">{successMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#39FF14]" />
            <span className="text-gray-400 ml-3">Loading report data...</span>
          </div>
        ) : report ? (
          <>
            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={DollarSign}
                label="Revenue"
                value={fmtCurrency(report.revenue.periodCommissions)}
                subtext={`${report.revenue.periodTransactions} transactions`}
              />
              <StatCard
                icon={ClipboardList}
                label="Active Jobs"
                value={report.jobProgress.activeJobs}
                subtext={`${report.jobProgress.completedJobs} completed`}
                color="text-blue-400"
              />
              <StatCard
                icon={Users}
                label="Open Leads"
                value={report.leads.total}
                subtext={`${report.leads.conversionRate}% conversion`}
                color="text-purple-400"
              />
              <StatCard
                icon={Truck}
                label="Deliveries"
                value={report.deliveries.completed}
                subtext={`${report.deliveries.onTimeRate}% on-time`}
                color="text-amber-400"
              />
            </div>

            {/* Section 1: Today's Snapshot / Period Snapshot */}
            <div className="bg-gray-800 rounded-xl border border-white/10 p-6">
              <SectionHeader title={`${report.meta.label} Snapshot`} icon={Clock}>
                <span className="text-xs text-gray-500">
                  {new Date(report.meta.periodStart).toLocaleDateString()} -{' '}
                  {new Date(report.meta.periodEnd).toLocaleDateString()}
                </span>
              </SectionHeader>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Revenue & Commissions */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-[#39FF14] mb-3 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" /> Revenue
                  </h3>
                  <MetricRow label="Period Revenue" value={fmtCurrency(report.revenue.periodCommissions)} color="text-[#39FF14]" />
                  <MetricRow label="Transactions" value={report.revenue.periodTransactions} />
                  <MetricRow label="Avg Commission" value={fmtCurrency(report.revenue.avgCommission)} />
                  <MetricRow label="All-Time Total" value={fmtCurrency(report.revenue.allTimeCommissions)} color="text-gray-300" />
                </div>

                {/* Leads & Calls */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> Leads & Calls
                  </h3>
                  <MetricRow label="New Leads" value={report.leads.total} />
                  <MetricRow label="Leads Converted" value={report.leads.converted} color="text-[#39FF14]" />
                  <MetricRow label="Avg Response" value={`${report.leads.avgResponseMinutes} min`} />
                  <MetricRow label="Total Calls" value={report.calls.total} />
                  <MetricRow label="Missed Calls" value={report.calls.missed} color={report.calls.missed > 0 ? 'text-red-400' : 'text-white'} />
                  <MetricRow label="Voicemails" value={report.calls.voicemails} />
                </div>

                {/* Operations */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" /> Operations
                  </h3>
                  <MetricRow label="Active Jobs" value={report.jobProgress.activeJobs} />
                  <MetricRow label="Low Stock Items" value={report.inventory.lowStockCount} color={report.inventory.lowStockCount > 0 ? 'text-red-400' : 'text-white'} />
                  <MetricRow label="Inventory Value" value={fmtCurrency(report.inventory.estimatedValue)} />
                  <MetricRow label="Weather Alerts" value={report.weatherEvents.activeAlerts} color={report.weatherEvents.activeAlerts > 0 ? 'text-red-400' : 'text-white'} />
                  <MetricRow label="Hours Logged" value={report.timeTracking.totalHours} />
                  <MetricRow label="Pending Items" value={report.openItems.pendingApprovals + report.openItems.overdueFollowups} color="text-amber-400" />
                </div>
              </div>
            </div>

            {/* Section 2: This Week / Period Trends */}
            <div className="bg-gray-800 rounded-xl border border-white/10 p-6">
              <SectionHeader title="Trends & Breakdowns" icon={TrendingUp} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top Reps */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Top Reps by Revenue</h3>
                  {report.revenue.topReps.length > 0 ? (
                    <div className="space-y-2">
                      {report.revenue.topReps.slice(0, 5).map((rep, i) => (
                        <div key={rep.name} className="flex items-center justify-between py-1.5 border-b border-white/5">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold',
                              i === 0 ? 'bg-[#39FF14] text-gray-900' : 'bg-gray-700 text-gray-300'
                            )}>
                              {i + 1}
                            </span>
                            <span className="text-sm text-white">{rep.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-[#39FF14]">
                              {fmtCurrency(rep.amount)}
                            </span>
                            <span className="text-xs text-gray-500 ml-2">({rep.count} deals)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 text-center py-4">No commission data for this period</div>
                  )}
                </div>

                {/* Lead Sources */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Lead Sources</h3>
                  <TextBarChart data={report.leads.bySource} maxItems={6} />
                </div>

                {/* Job Phases */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Jobs by Phase</h3>
                  <TextBarChart data={report.jobProgress.byPhase} maxItems={6} />
                </div>

                {/* Call Distribution */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Call Breakdown</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-blue-400">{report.calls.inbound}</div>
                      <div className="text-xs text-gray-400">Inbound</div>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-purple-400">{report.calls.outbound}</div>
                      <div className="text-xs text-gray-400">Outbound</div>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                      <div className={cn('text-lg font-bold', report.calls.missed > 0 ? 'text-red-400' : 'text-gray-400')}>
                        {report.calls.missed}
                      </div>
                      <div className="text-xs text-gray-400">Missed</div>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-amber-400">{report.calls.voicemails}</div>
                      <div className="text-xs text-gray-400">Voicemails</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-500 text-center">
                    Avg duration: {fmtDuration(report.calls.avgDurationSeconds)} | Busiest: {fmtHour(report.calls.busiestHour)}
                  </div>
                </div>
              </div>

              {/* Expandable Details */}
              <div className="mt-6 space-y-2">
                {/* Customer Satisfaction */}
                <button
                  onClick={() => toggleSection('satisfaction')}
                  className="w-full flex items-center justify-between bg-gray-700/30 rounded-lg px-4 py-3 hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-400" />
                    <span className="text-sm text-white">Customer Satisfaction</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-amber-400 font-medium">{report.customerSatisfaction.avgRating} avg</span>
                    {expandedSection === 'satisfaction' ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>
                {expandedSection === 'satisfaction' && (
                  <div className="bg-gray-700/20 rounded-lg p-4 ml-4">
                    <MetricRow label="Total Reviews" value={report.customerSatisfaction.totalReviews} />
                    <MetricRow label="Average Rating" value={`${report.customerSatisfaction.avgRating}/5`} color="text-amber-400" bar={report.customerSatisfaction.avgRating * 20} />
                    <MetricRow label="5-Star Reviews" value={report.customerSatisfaction.fiveStarCount} />
                    <MetricRow label="4+ Star Rate" value={`${report.customerSatisfaction.fourPlusRate}%`} bar={report.customerSatisfaction.fourPlusRate} />
                    <MetricRow label="Survey Responses" value={report.customerSatisfaction.surveyResponses} />
                    <MetricRow label="Avg Survey Score" value={report.customerSatisfaction.avgSurveyScore} />
                  </div>
                )}

                {/* Weather Events */}
                <button
                  onClick={() => toggleSection('weather')}
                  className="w-full flex items-center justify-between bg-gray-700/30 rounded-lg px-4 py-3 hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <CloudLightning className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-white">Weather Events</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-blue-400 font-medium">{report.weatherEvents.periodEvents} events</span>
                    {expandedSection === 'weather' ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>
                {expandedSection === 'weather' && (
                  <div className="bg-gray-700/20 rounded-lg p-4 ml-4">
                    <MetricRow label="Period Events" value={report.weatherEvents.periodEvents} />
                    <MetricRow label="Active Alerts" value={report.weatherEvents.activeAlerts} color={report.weatherEvents.activeAlerts > 0 ? 'text-red-400' : 'text-white'} />
                    <MetricRow label="Estimated Leads" value={report.weatherEvents.estimatedLeads} color="text-[#39FF14]" />
                    <MetricRow label="All-Time Events" value={report.weatherEvents.allTimeEvents} />
                    {Object.keys(report.weatherEvents.byType).length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs text-gray-400 mb-2">By Type</div>
                        <TextBarChart data={report.weatherEvents.byType} />
                      </div>
                    )}
                  </div>
                )}

                {/* Warranty Claims */}
                <button
                  onClick={() => toggleSection('warranties')}
                  className="w-full flex items-center justify-between bg-gray-700/30 rounded-lg px-4 py-3 hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-white">Warranties</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-green-400 font-medium">{report.warranties.active} active</span>
                    {expandedSection === 'warranties' ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>
                {expandedSection === 'warranties' && (
                  <div className="bg-gray-700/20 rounded-lg p-4 ml-4">
                    <MetricRow label="Total Warranties" value={report.warranties.totalWarranties} />
                    <MetricRow label="Active" value={report.warranties.active} color="text-green-400" />
                    <MetricRow label="Expiring in 30 Days" value={report.warranties.expiringSoon} color={report.warranties.expiringSoon > 0 ? 'text-amber-400' : 'text-white'} />
                    <MetricRow label="Active Claims" value={report.warranties.activeClaims} color={report.warranties.activeClaims > 0 ? 'text-red-400' : 'text-white'} />
                  </div>
                )}

                {/* Time Tracking */}
                <button
                  onClick={() => toggleSection('time')}
                  className="w-full flex items-center justify-between bg-gray-700/30 rounded-lg px-4 py-3 hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm text-white">Time Tracking</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-cyan-400 font-medium">{report.timeTracking.totalHours}h logged</span>
                    {expandedSection === 'time' ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>
                {expandedSection === 'time' && (
                  <div className="bg-gray-700/20 rounded-lg p-4 ml-4">
                    <MetricRow label="Total Hours" value={report.timeTracking.totalHours} color="text-cyan-400" />
                    <MetricRow label="Total Entries" value={report.timeTracking.totalEntries} />
                    <MetricRow label="Avg Hours/Entry" value={report.timeTracking.avgHoursPerEntry} />
                    <MetricRow label="Overtime Entries" value={report.timeTracking.overtimeEntries} color={report.timeTracking.overtimeEntries > 0 ? 'text-amber-400' : 'text-white'} />
                    {report.timeTracking.topEmployees.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs text-gray-400 mb-2">Top by Hours</div>
                        {report.timeTracking.topEmployees.slice(0, 5).map((emp) => (
                          <MetricRow key={emp.name} label={emp.name} value={`${emp.hours}h`} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Inventory Alerts */}
                {report.inventory.lowStockCount > 0 && (
                  <>
                    <button
                      onClick={() => toggleSection('inventory')}
                      className="w-full flex items-center justify-between bg-gray-700/30 rounded-lg px-4 py-3 hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-red-400" />
                        <span className="text-sm text-white">Low Stock Alerts</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-red-400 font-medium">
                          {report.inventory.lowStockCount} items
                        </span>
                        {expandedSection === 'inventory' ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </button>
                    {expandedSection === 'inventory' && (
                      <div className="bg-gray-700/20 rounded-lg p-4 ml-4">
                        <div className="space-y-2">
                          {report.inventory.reorderNeeded.map((item) => (
                            <div
                              key={item.name}
                              className="flex items-center justify-between py-1.5 border-b border-white/5"
                            >
                              <span className="text-sm text-white">{item.name}</span>
                              <span className="text-sm text-red-400">
                                {item.current}/{item.minimum}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Section 3: Report Templates */}
            <div className="bg-gray-800 rounded-xl border border-white/10 p-6">
              <SectionHeader title="Report Templates" icon={FileText} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="bg-gray-700/30 border border-white/5 rounded-lg p-4 flex items-start justify-between"
                  >
                    <div>
                      <h3 className="text-sm font-semibold text-white">{tmpl.name}</h3>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {tmpl.sections.slice(0, 4).map((s) => (
                          <span
                            key={s}
                            className="px-2 py-0.5 bg-gray-600/50 rounded text-xs text-gray-300"
                          >
                            {s.replace(/_/g, ' ')}
                          </span>
                        ))}
                        {tmpl.sections.length > 4 && (
                          <span className="px-2 py-0.5 bg-gray-600/50 rounded text-xs text-gray-400">
                            +{tmpl.sections.length - 4} more
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-500 capitalize">
                          <Calendar className="w-3 h-3 inline mr-1" />
                          {tmpl.schedule}
                        </span>
                        <span className="text-xs text-gray-500">
                          {tmpl.recipients.length} recipient{tmpl.recipients.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleGenerate(tmpl.id)}
                      disabled={generating}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-lg text-xs text-[#39FF14] font-medium hover:bg-[#39FF14]/20 disabled:opacity-50 transition-colors flex-shrink-0"
                    >
                      {generating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                      Generate
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 4: Recent Reports */}
            <div className="bg-gray-800 rounded-xl border border-white/10 p-6">
              <SectionHeader title="Recent Reports" icon={Clock}>
                <button
                  onClick={loadHistory}
                  className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </SectionHeader>

              {history.length > 0 ? (
                <div className="space-y-2">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-gray-700/20 rounded-lg px-4 py-3 border border-white/5"
                    >
                      <div>
                        <div className="text-sm text-white font-medium">{item.reportName}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {new Date(item.period.start).toLocaleDateString()} -{' '}
                          {new Date(item.period.end).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">
                          {new Date(item.generatedAt).toLocaleString()}
                        </span>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            item.type === 'daily'
                              ? 'bg-blue-500/10 text-blue-400'
                              : item.type === 'weekly'
                              ? 'bg-purple-500/10 text-purple-400'
                              : item.type === 'monthly'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-gray-500/10 text-gray-400'
                          )}
                        >
                          {item.type}
                        </span>
                        <a
                          href={`/api/reports/generate?configId=${item.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                        {canExport && (
                          <button className="text-gray-400 hover:text-white transition-colors">
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No reports generated yet</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Click &quot;Generate All Reports&quot; to create your first reports
                  </p>
                </div>
              )}
            </div>

            {/* Section 5: Scheduled Reports */}
            <div className="bg-gray-800 rounded-xl border border-white/10 p-6">
              <SectionHeader title="Scheduled Reports" icon={Calendar} />

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 px-3 text-xs text-gray-400 font-medium uppercase tracking-wider">
                        Report
                      </th>
                      <th className="text-left py-2 px-3 text-xs text-gray-400 font-medium uppercase tracking-wider">
                        Schedule
                      </th>
                      <th className="text-left py-2 px-3 text-xs text-gray-400 font-medium uppercase tracking-wider">
                        Recipients
                      </th>
                      <th className="text-left py-2 px-3 text-xs text-gray-400 font-medium uppercase tracking-wider">
                        Sections
                      </th>
                      <th className="text-right py-2 px-3 text-xs text-gray-400 font-medium uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates
                      .filter((t) => t.schedule !== 'manual')
                      .map((tmpl) => (
                        <tr key={tmpl.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-3 px-3 text-white">{tmpl.name}</td>
                          <td className="py-3 px-3">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded text-xs font-medium capitalize',
                                tmpl.schedule === 'daily'
                                  ? 'bg-blue-500/10 text-blue-400'
                                  : tmpl.schedule === 'weekly'
                                  ? 'bg-purple-500/10 text-purple-400'
                                  : tmpl.schedule === 'monthly'
                                  ? 'bg-amber-500/10 text-amber-400'
                                  : 'bg-gray-500/10 text-gray-400'
                              )}
                            >
                              {tmpl.schedule}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-gray-400 text-xs">
                            {tmpl.recipients.join(', ')}
                          </td>
                          <td className="py-3 px-3 text-gray-400 text-xs">
                            {tmpl.sections.length} sections
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[#39FF14]/10 text-[#39FF14]">
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Subcontractor Summary (compact) */}
            {report.subcontractors.total > 0 && (
              <div className="bg-gray-800 rounded-xl border border-white/10 p-6">
                <SectionHeader title="Subcontractors" icon={Users} />
                <div className="grid grid-cols-3 gap-4">
                  <StatCard icon={Users} label="Total" value={report.subcontractors.total} color="text-white" />
                  <StatCard icon={CheckCircle2} label="Active" value={report.subcontractors.active} color="text-[#39FF14]" />
                  <StatCard icon={Star} label="Avg Rating" value={report.subcontractors.avgRating} color="text-amber-400" />
                </div>
              </div>
            )}

            {/* Open Items Alert */}
            {(report.openItems.pendingApprovals > 0 ||
              report.openItems.overdueFollowups > 0 ||
              report.openItems.unreadMessages > 0) && (
              <div className="bg-amber-500/5 rounded-xl border border-amber-500/20 p-6">
                <SectionHeader title="Action Items" icon={AlertTriangle} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {report.openItems.pendingApprovals > 0 && (
                    <StatCard
                      icon={ClipboardList}
                      label="Pending Approvals"
                      value={report.openItems.pendingApprovals}
                      color="text-amber-400"
                      alert
                    />
                  )}
                  {report.openItems.overdueFollowups > 0 && (
                    <StatCard
                      icon={Clock}
                      label="Overdue Follow-ups"
                      value={report.openItems.overdueFollowups}
                      color="text-red-400"
                      alert
                    />
                  )}
                  {report.openItems.unreadMessages > 0 && (
                    <StatCard
                      icon={FileText}
                      label="Unread Messages"
                      value={report.openItems.unreadMessages}
                      color="text-blue-400"
                    />
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <p className="text-gray-400">No report data available</p>
          </div>
        )}
      </div>
    </CommandCenterLayout>
  );
}
