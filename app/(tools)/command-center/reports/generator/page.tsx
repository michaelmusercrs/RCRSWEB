'use client';

/**
 * RCRS Command Center - Custom Report Generator
 *
 * Build custom reports with module selection, filters, column pickers,
 * saved templates, scheduling, and export capabilities.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  Calendar,
  Download,
  Eye,
  Settings,
  Clock,
  Users,
  RefreshCw,
  TrendingUp,
  BarChart3,
  Plus,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  AlertTriangle,
  Filter,
  Search,
  X,
  Loader2,
  DollarSign,
  Package,
  Trash2,
  Save,
  Play,
  Copy,
  Mail,
  Columns,
  SlidersHorizontal,
  History,
  BookmarkPlus,
  Bookmark,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReportSection {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  order: number;
}

interface ReportConfig {
  id: string;
  name: string;
  type: string;
  sections: ReportSection[];
  recipients: string[];
  schedule: string;
  format: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

interface ReportHistoryItem {
  id: string;
  configId: string;
  reportName: string;
  type: string;
  period: { start: string; end: string };
  generatedAt: string;
  generatedBy: string;
  sentTo: string[];
  sentAt?: string;
  htmlContent?: string;
}

// Module definitions for the builder
interface ReportModule {
  id: string;
  label: string;
  description: string;
  icon: typeof FileText;
  sectionType: string;
  defaultColumns: string[];
}

// Filter condition
interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODULES: ReportModule[] = [
  {
    id: 'sales',
    label: 'Sales Summary',
    description: 'Revenue, deals closed, conversion rates, top performers',
    icon: DollarSign,
    sectionType: 'sales_summary',
    defaultColumns: ['totalRevenue', 'dealsClosed', 'avgDealSize', 'topRep', 'conversionRate'],
  },
  {
    id: 'leads',
    label: 'Lead Activity',
    description: 'New leads, pipeline stages, response times, follow-ups',
    icon: Users,
    sectionType: 'lead_activity',
    defaultColumns: ['newLeads', 'contacted', 'scheduled', 'quoted', 'closed', 'avgResponseTime'],
  },
  {
    id: 'jobs',
    label: 'Job Performance',
    description: 'Job completion, delivery status, team performance',
    icon: BarChart3,
    sectionType: 'team_performance',
    defaultColumns: ['name', 'sales', 'leads', 'responseTime', 'rating'],
  },
  {
    id: 'inventory',
    label: 'Inventory & Deliveries',
    description: 'Stock levels, low-stock alerts, delivery tracking',
    icon: Package,
    sectionType: 'inventory_levels',
    defaultColumns: ['totalItems', 'lowStockItems', 'reorderNeeded'],
  },
  {
    id: 'finance',
    label: 'Financial Overview',
    description: 'Revenue trends, call stats, open items, weather alerts',
    icon: TrendingUp,
    sectionType: 'revenue',
    defaultColumns: ['totalRevenue', 'dealsClosed', 'avgDealSize', 'newLeads'],
  },
];

const COLUMN_OPTIONS: Record<string, { label: string; key: string }[]> = {
  sales: [
    { label: 'Total Revenue', key: 'totalRevenue' },
    { label: 'Deals Closed', key: 'dealsClosed' },
    { label: 'Avg Deal Size', key: 'avgDealSize' },
    { label: 'Top Rep', key: 'topRep' },
    { label: 'New Leads', key: 'newLeads' },
    { label: 'Conversion Rate', key: 'conversionRate' },
  ],
  leads: [
    { label: 'New Leads', key: 'newLeads' },
    { label: 'Contacted', key: 'contacted' },
    { label: 'Scheduled', key: 'scheduled' },
    { label: 'Quoted', key: 'quoted' },
    { label: 'Closed', key: 'closed' },
    { label: 'Reassigned', key: 'reassigned' },
    { label: 'Avg Response Time', key: 'avgResponseTime' },
  ],
  jobs: [
    { label: 'Rep Name', key: 'name' },
    { label: 'Sales Volume', key: 'sales' },
    { label: 'Lead Count', key: 'leads' },
    { label: 'Response Time', key: 'responseTime' },
    { label: 'Rating', key: 'rating' },
  ],
  inventory: [
    { label: 'Total Items', key: 'totalItems' },
    { label: 'Low Stock Items', key: 'lowStockItems' },
    { label: 'Reorder Needed', key: 'reorderNeeded' },
  ],
  finance: [
    { label: 'Total Revenue', key: 'totalRevenue' },
    { label: 'Deals Closed', key: 'dealsClosed' },
    { label: 'Avg Deal Size', key: 'avgDealSize' },
    { label: 'New Leads', key: 'newLeads' },
    { label: 'Conversion Rate', key: 'conversionRate' },
  ],
};

const FILTER_FIELDS = [
  { label: 'Status', value: 'status' },
  { label: 'Rep Name', value: 'repName' },
  { label: 'Revenue', value: 'revenue' },
  { label: 'Lead Source', value: 'leadSource' },
  { label: 'Date Created', value: 'createdAt' },
  { label: 'City', value: 'city' },
  { label: 'Deal Value', value: 'dealValue' },
];

const FILTER_OPERATORS = [
  { label: 'equals', value: 'eq' },
  { label: 'not equals', value: 'neq' },
  { label: 'contains', value: 'contains' },
  { label: 'greater than', value: 'gt' },
  { label: 'less than', value: 'lt' },
  { label: 'is empty', value: 'empty' },
];

const SCHEDULE_OPTIONS = [
  { label: 'Manual only', value: 'manual' },
  { label: 'Daily at 8 AM', value: '0 8 * * *' },
  { label: 'Weekly (Monday)', value: '0 8 * * 1' },
  { label: 'Bi-weekly', value: '0 8 1,15 * *' },
  { label: 'Monthly (1st)', value: '0 8 1 * *' },
  { label: 'Quarterly', value: '0 8 1 1,4,7,10 *' },
];

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ReportGeneratorPage() {
  // Saved configs & history
  const [configs, setConfigs] = useState<ReportConfig[]>([]);
  const [history, setHistory] = useState<ReportHistoryItem[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Builder state
  const [reportName, setReportName] = useState('Custom Report');
  const [reportType, setReportType] = useState<string>('custom');
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set(['sales']));
  const [selectedColumns, setSelectedColumns] = useState<Record<string, Set<string>>>({});
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [schedule, setSchedule] = useState('manual');
  const [recipients, setRecipients] = useState('');
  const [format, setFormat] = useState<'html' | 'summary'>('html');

  // UI state
  const [activeView, setActiveView] = useState<'builder' | 'templates' | 'history'>('builder');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [showColumnPicker, setShowColumnPicker] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ---------------------------------------------------------------------------
  // Notification helper
  // ---------------------------------------------------------------------------

  function notify(type: 'success' | 'error', message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }

  // ---------------------------------------------------------------------------
  // Fetch saved configs and history
  // ---------------------------------------------------------------------------

  const fetchConfigs = useCallback(async () => {
    setLoadingConfigs(true);
    try {
      const res = await fetch('/api/reports/configs');
      if (res.ok) {
        const data = await res.json();
        setConfigs(data.data || []);
      }
    } catch {
      // Silently fail - configs may not exist yet
    } finally {
      setLoadingConfigs(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/reports/history?limit=25');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.data || []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
    fetchHistory();
  }, [fetchConfigs, fetchHistory]);

  // Initialize default columns for selected modules
  useEffect(() => {
    const updated = { ...selectedColumns };
    selectedModules.forEach((modId) => {
      if (!updated[modId]) {
        const mod = MODULES.find((m) => m.id === modId);
        if (mod) {
          updated[modId] = new Set(mod.defaultColumns);
        }
      }
    });
    setSelectedColumns(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModules]);

  // ---------------------------------------------------------------------------
  // Build sections from builder state
  // ---------------------------------------------------------------------------

  const buildSections = useCallback((): ReportSection[] => {
    const sections: ReportSection[] = [];
    let order = 0;
    selectedModules.forEach((modId) => {
      const mod = MODULES.find((m) => m.id === modId);
      if (mod) {
        sections.push({
          id: `section-${modId}`,
          name: mod.label,
          type: mod.sectionType,
          enabled: true,
          order: order++,
        });
      }
    });
    return sections;
  }, [selectedModules]);

  // ---------------------------------------------------------------------------
  // Generate report
  // ---------------------------------------------------------------------------

  const handleGenerate = useCallback(async () => {
    if (selectedModules.size === 0) {
      notify('error', 'Select at least one report module');
      return;
    }

    setGenerating(true);
    try {
      // First save a temporary config
      const sections = buildSections();
      const recipientList = recipients
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);

      const configRes = await fetch('/api/reports/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: reportName,
          type: reportType,
          sections,
          recipients: recipientList,
          schedule,
          format,
          isActive: schedule !== 'manual',
          createdBy: 'admin',
        }),
      });

      if (!configRes.ok) throw new Error('Failed to save report config');
      const configData = await configRes.json();
      const configId = configData.data.id;

      // Generate the report
      const dateRange = dateStart && dateEnd ? { start: new Date(dateStart).toISOString(), end: new Date(dateEnd).toISOString() } : undefined;
      const genRes = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId, dateRange }),
      });

      if (!genRes.ok) throw new Error('Failed to generate report');
      const genData = await genRes.json();

      // Show preview
      if (genData.data?.htmlContent) {
        setPreviewHtml(genData.data.htmlContent);
      }

      notify('success', 'Report generated successfully');
      fetchConfigs();
      fetchHistory();
    } catch (err: unknown) {
      notify('error', err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }, [selectedModules, buildSections, reportName, reportType, recipients, schedule, format, dateStart, dateEnd, fetchConfigs, fetchHistory]);

  // ---------------------------------------------------------------------------
  // Save template
  // ---------------------------------------------------------------------------

  const handleSaveTemplate = useCallback(async () => {
    if (!reportName.trim()) {
      notify('error', 'Enter a report name');
      return;
    }
    if (selectedModules.size === 0) {
      notify('error', 'Select at least one module');
      return;
    }

    setSaving(true);
    try {
      const sections = buildSections();
      const recipientList = recipients
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);

      const res = await fetch('/api/reports/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: reportName,
          type: reportType,
          sections,
          recipients: recipientList,
          schedule,
          format,
          isActive: schedule !== 'manual',
          createdBy: 'admin',
        }),
      });

      if (!res.ok) throw new Error('Failed to save template');
      notify('success', 'Template saved');
      fetchConfigs();
    } catch (err: unknown) {
      notify('error', err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [reportName, selectedModules, buildSections, reportType, recipients, schedule, format, fetchConfigs]);

  // ---------------------------------------------------------------------------
  // Load a saved template into the builder
  // ---------------------------------------------------------------------------

  function loadTemplate(config: ReportConfig) {
    setReportName(config.name);
    setReportType(config.type);
    setSchedule(config.schedule);
    setFormat(config.format as 'html' | 'summary');
    setRecipients(config.recipients.join(', '));

    // Map sections back to modules
    const modIds = new Set<string>();
    config.sections.forEach((s) => {
      const mod = MODULES.find((m) => m.sectionType === s.type);
      if (mod) modIds.add(mod.id);
    });
    setSelectedModules(modIds);
    setActiveView('builder');
    notify('success', `Loaded template: ${config.name}`);
  }

  // ---------------------------------------------------------------------------
  // Export as CSV (simple client-side)
  // ---------------------------------------------------------------------------

  function exportCsv() {
    // Build a simple CSV from the selected modules and their columns
    let csv = 'Module,Columns\n';
    selectedModules.forEach((modId) => {
      const mod = MODULES.find((m) => m.id === modId);
      const cols = selectedColumns[modId] ? Array.from(selectedColumns[modId]).join('; ') : 'All';
      csv += `"${mod?.label || modId}","${cols}"\n`;
    });

    // Add filter info
    if (filters.length > 0) {
      csv += '\nFilters\n';
      csv += 'Field,Operator,Value\n';
      filters.forEach((f) => {
        csv += `"${f.field}","${f.operator}","${f.value}"\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportName.replace(/\s+/g, '_')}_config.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify('success', 'CSV exported');
  }

  // ---------------------------------------------------------------------------
  // Toggle module
  // ---------------------------------------------------------------------------

  function toggleModule(modId: string) {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(modId)) {
        next.delete(modId);
      } else {
        next.add(modId);
      }
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Toggle column
  // ---------------------------------------------------------------------------

  function toggleColumn(modId: string, colKey: string) {
    setSelectedColumns((prev) => {
      const modCols = new Set(prev[modId] || []);
      if (modCols.has(colKey)) {
        modCols.delete(colKey);
      } else {
        modCols.add(colKey);
      }
      return { ...prev, [modId]: modCols };
    });
  }

  // ---------------------------------------------------------------------------
  // Add/remove filter
  // ---------------------------------------------------------------------------

  function addFilter() {
    setFilters((prev) => [
      ...prev,
      {
        id: `f-${Date.now()}`,
        field: 'status',
        operator: 'eq',
        value: '',
      },
    ]);
  }

  function removeFilter(id: string) {
    setFilters((prev) => prev.filter((f) => f.id !== id));
  }

  function updateFilter(id: string, key: keyof FilterCondition, value: string) {
    setFilters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [key]: value } : f))
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Notification toast */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
            notification.type === 'success'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}
        >
          {notification.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {notification.message}
          <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-70">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Report Generator</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Build custom reports, save templates, and schedule automated delivery
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchConfigs(); fetchHistory(); }}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-zinc-300 hover:bg-neutral-800"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-1 rounded-lg bg-neutral-900 border border-white/10 p-1 w-fit">
        {([
          { key: 'builder' as const, label: 'Report Builder', icon: SlidersHorizontal },
          { key: 'templates' as const, label: 'Saved Templates', icon: Bookmark },
          { key: 'history' as const, label: 'History', icon: History },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveView(key)}
            className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeView === key
                ? 'bg-[#39FF14]/20 text-[#39FF14]'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ======= Builder View ======= */}
      {activeView === 'builder' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column: Module Selection & Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Report Name & Type */}
            <div className="rounded-xl border border-white/10 bg-neutral-900 p-5">
              <h2 className="mb-4 text-lg font-semibold text-white">Report Details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-400">Report Name</label>
                  <input
                    type="text"
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none focus:ring-1 focus:ring-[#39FF14]"
                    placeholder="My Custom Report"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-400">Report Type</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-[#39FF14] focus:outline-none"
                  >
                    <option value="custom">Custom</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Module Selection */}
            <div className="rounded-xl border border-white/10 bg-neutral-900 p-5">
              <h2 className="mb-4 text-lg font-semibold text-white">Select Modules</h2>
              <p className="mb-4 text-sm text-zinc-500">Choose which data sections to include in your report</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {MODULES.map((mod) => {
                  const isSelected = selectedModules.has(mod.id);
                  return (
                    <button
                      key={mod.id}
                      onClick={() => toggleModule(mod.id)}
                      className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                        isSelected
                          ? 'border-[#39FF14]/50 bg-[#39FF14]/5'
                          : 'border-white/10 bg-neutral-800 hover:border-white/20'
                      }`}
                    >
                      <div className={`rounded-lg p-2 ${isSelected ? 'bg-[#39FF14]/20 text-[#39FF14]' : 'bg-zinc-700 text-zinc-400'}`}>
                        <mod.icon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                            {mod.label}
                          </span>
                          {isSelected && <CheckCircle size={16} className="text-[#39FF14] shrink-0" />}
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-500">{mod.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Column Selector (per selected module) */}
            {selectedModules.size > 0 && (
              <div className="rounded-xl border border-white/10 bg-neutral-900 p-5">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                  <Columns size={18} className="text-zinc-400" />
                  Column Selection
                </h2>
                <div className="space-y-3">
                  {Array.from(selectedModules).map((modId) => {
                    const mod = MODULES.find((m) => m.id === modId);
                    const cols = COLUMN_OPTIONS[modId] || [];
                    const activeCols = selectedColumns[modId] || new Set();
                    const isOpen = showColumnPicker === modId;

                    return (
                      <div key={modId} className="rounded-lg border border-white/5 bg-neutral-800">
                        <button
                          onClick={() => setShowColumnPicker(isOpen ? null : modId)}
                          className="flex w-full items-center justify-between p-3 text-sm"
                        >
                          <span className="font-medium text-zinc-300">{mod?.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">{activeCols.size}/{cols.length} columns</span>
                            {isOpen ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
                          </div>
                        </button>
                        {isOpen && (
                          <div className="border-t border-white/5 p-3">
                            <div className="flex flex-wrap gap-2">
                              {cols.map((col) => {
                                const isActive = activeCols.has(col.key);
                                return (
                                  <button
                                    key={col.key}
                                    onClick={() => toggleColumn(modId, col.key)}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                                      isActive
                                        ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30'
                                        : 'bg-neutral-700 text-zinc-400 border border-transparent hover:text-zinc-300'
                                    }`}
                                  >
                                    {col.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filter Builder */}
            <div className="rounded-xl border border-white/10 bg-neutral-900 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Filter size={18} className="text-zinc-400" />
                  Filters
                </h2>
                <button
                  onClick={addFilter}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#39FF14]/10 px-3 py-1.5 text-xs font-medium text-[#39FF14] hover:bg-[#39FF14]/20"
                >
                  <Plus size={12} />
                  Add Condition
                </button>
              </div>

              {filters.length === 0 ? (
                <p className="py-4 text-center text-sm text-zinc-500">
                  No filters applied. Click &quot;Add Condition&quot; to filter your report data.
                </p>
              ) : (
                <div className="space-y-2">
                  {filters.map((f, idx) => (
                    <div key={f.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-neutral-800 p-3">
                      {idx > 0 && (
                        <span className="rounded-md bg-zinc-700 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-400">AND</span>
                      )}
                      <select
                        value={f.field}
                        onChange={(e) => updateFilter(f.id, 'field', e.target.value)}
                        className="rounded-lg border border-white/10 bg-neutral-700 px-2 py-1.5 text-xs text-white focus:border-[#39FF14] focus:outline-none"
                      >
                        {FILTER_FIELDS.map((ff) => (
                          <option key={ff.value} value={ff.value}>{ff.label}</option>
                        ))}
                      </select>
                      <select
                        value={f.operator}
                        onChange={(e) => updateFilter(f.id, 'operator', e.target.value)}
                        className="rounded-lg border border-white/10 bg-neutral-700 px-2 py-1.5 text-xs text-white focus:border-[#39FF14] focus:outline-none"
                      >
                        {FILTER_OPERATORS.map((op) => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                      {f.operator !== 'empty' && (
                        <input
                          type="text"
                          value={f.value}
                          onChange={(e) => updateFilter(f.id, 'value', e.target.value)}
                          placeholder="Value..."
                          className="flex-1 min-w-[120px] rounded-lg border border-white/10 bg-neutral-700 px-2 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none"
                        />
                      )}
                      <button
                        onClick={() => removeFilter(f.id)}
                        className="rounded-lg p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Date Range */}
            <div className="rounded-xl border border-white/10 bg-neutral-900 p-5">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                <Calendar size={18} className="text-zinc-400" />
                Date Range
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-400">Start Date</label>
                  <input
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-[#39FF14] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-400">End Date</label>
                  <input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-[#39FF14] focus:outline-none"
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { label: 'Today', fn: () => { const d = new Date().toISOString().split('T')[0]; setDateStart(d); setDateEnd(d); } },
                  { label: 'This Week', fn: () => { const now = new Date(); const start = new Date(now); start.setDate(now.getDate() - now.getDay()); setDateStart(start.toISOString().split('T')[0]); setDateEnd(now.toISOString().split('T')[0]); } },
                  { label: 'This Month', fn: () => { const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), 1); setDateStart(start.toISOString().split('T')[0]); setDateEnd(now.toISOString().split('T')[0]); } },
                  { label: 'Last 30 Days', fn: () => { const now = new Date(); const start = new Date(now); start.setDate(now.getDate() - 30); setDateStart(start.toISOString().split('T')[0]); setDateEnd(now.toISOString().split('T')[0]); } },
                  { label: 'Last 90 Days', fn: () => { const now = new Date(); const start = new Date(now); start.setDate(now.getDate() - 90); setDateStart(start.toISOString().split('T')[0]); setDateEnd(now.toISOString().split('T')[0]); } },
                  { label: 'All Time', fn: () => { setDateStart(''); setDateEnd(''); } },
                ].map((q) => (
                  <button
                    key={q.label}
                    onClick={q.fn}
                    className="rounded-lg border border-white/10 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-neutral-700"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Settings & Actions */}
          <div className="space-y-6">
            {/* Schedule */}
            <div className="rounded-xl border border-white/10 bg-neutral-900 p-5">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                <Clock size={18} className="text-zinc-400" />
                Schedule
              </h2>
              <select
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-[#39FF14] focus:outline-none"
              >
                {SCHEDULE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {schedule !== 'manual' && (
                <p className="mt-2 text-xs text-zinc-500">
                  Report will be automatically generated and sent to recipients on the scheduled cadence.
                </p>
              )}
            </div>

            {/* Recipients */}
            <div className="rounded-xl border border-white/10 bg-neutral-900 p-5">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                <Mail size={18} className="text-zinc-400" />
                Recipients
              </h2>
              <textarea
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="email@example.com, another@example.com"
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none resize-none"
              />
              <p className="mt-1.5 text-xs text-zinc-500">Separate multiple emails with commas</p>
            </div>

            {/* Format */}
            <div className="rounded-xl border border-white/10 bg-neutral-900 p-5">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                <Settings size={18} className="text-zinc-400" />
                Output Format
              </h2>
              <div className="flex gap-2">
                {([
                  { key: 'html' as const, label: 'Full HTML' },
                  { key: 'summary' as const, label: 'Summary' },
                ]).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFormat(key)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      format === key
                        ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30'
                        : 'bg-neutral-800 text-zinc-400 border border-white/10 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleGenerate}
                disabled={generating || selectedModules.size === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#39FF14] px-4 py-3 text-sm font-bold text-neutral-950 transition-colors hover:bg-[#39FF14]/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                {generating ? 'Generating...' : 'Generate Report'}
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleSaveTemplate}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-neutral-900 px-3 py-2.5 text-sm font-medium text-zinc-300 hover:bg-neutral-800 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <BookmarkPlus size={14} />}
                  Save Template
                </button>
                <button
                  onClick={exportCsv}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-neutral-900 px-3 py-2.5 text-sm font-medium text-zinc-300 hover:bg-neutral-800"
                >
                  <Download size={14} />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Builder Summary */}
            <div className="rounded-xl border border-white/10 bg-neutral-900 p-5">
              <h3 className="mb-3 text-sm font-semibold text-zinc-400 uppercase tracking-wide">Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Modules</span>
                  <span className="text-white font-medium">{selectedModules.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Filters</span>
                  <span className="text-white font-medium">{filters.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Date Range</span>
                  <span className="text-white font-medium text-xs">
                    {dateStart && dateEnd ? `${dateStart} to ${dateEnd}` : 'All time'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Schedule</span>
                  <span className="text-white font-medium text-xs">
                    {SCHEDULE_OPTIONS.find((s) => s.value === schedule)?.label || schedule}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Format</span>
                  <span className="text-white font-medium">{format.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======= Templates View ======= */}
      {activeView === 'templates' && (
        <div className="rounded-xl border border-white/10 bg-neutral-900">
          <div className="border-b border-white/10 p-4">
            <h2 className="text-lg font-semibold text-white">Saved Report Templates</h2>
            <p className="text-sm text-zinc-400">Load a saved template to quickly generate reports</p>
          </div>

          {loadingConfigs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[#39FF14]" />
            </div>
          ) : configs.length === 0 ? (
            <div className="py-12 text-center">
              <Bookmark size={32} className="mx-auto mb-3 text-zinc-600" />
              <p className="text-zinc-400">No saved templates yet</p>
              <p className="mt-1 text-sm text-zinc-500">Build a report and save it as a template</p>
              <button
                onClick={() => setActiveView('builder')}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#39FF14]/20 px-4 py-2 text-sm font-medium text-[#39FF14] hover:bg-[#39FF14]/30"
              >
                <Plus size={14} />
                Create Report
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {configs.map((config) => (
                <div key={config.id} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-zinc-400 shrink-0" />
                      <h3 className="font-medium text-white truncate">{config.name}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                        config.isActive ? 'bg-green-500/20 text-green-400' : 'bg-zinc-500/20 text-zinc-400'
                      }`}>
                        {config.isActive ? 'Active' : 'Manual'}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                      <span>{config.type}</span>
                      <span>&middot;</span>
                      <span>{config.sections.filter((s) => s.enabled).length} modules</span>
                      <span>&middot;</span>
                      <span>{SCHEDULE_OPTIONS.find((s) => s.value === config.schedule)?.label || config.schedule}</span>
                      {config.recipients.length > 0 && (
                        <>
                          <span>&middot;</span>
                          <span>{config.recipients.length} recipient{config.recipients.length !== 1 ? 's' : ''}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => loadTemplate(config)}
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-[#39FF14] hover:bg-[#39FF14]/10"
                    >
                      <Copy size={12} />
                      Load
                    </button>
                    <button
                      onClick={async () => {
                        setGenerating(true);
                        try {
                          const res = await fetch('/api/reports/generate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ configId: config.id }),
                          });
                          if (!res.ok) throw new Error('Failed to generate');
                          const data = await res.json();
                          if (data.data?.htmlContent) setPreviewHtml(data.data.htmlContent);
                          notify('success', 'Report generated');
                          fetchHistory();
                        } catch {
                          notify('error', 'Failed to generate report');
                        } finally {
                          setGenerating(false);
                        }
                      }}
                      disabled={generating}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#39FF14]/10 px-3 py-1.5 text-xs font-medium text-[#39FF14] hover:bg-[#39FF14]/20 disabled:opacity-50"
                    >
                      <Play size={12} />
                      Run
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======= History View ======= */}
      {activeView === 'history' && (
        <div className="rounded-xl border border-white/10 bg-neutral-900">
          <div className="border-b border-white/10 p-4">
            <h2 className="text-lg font-semibold text-white">Report History</h2>
            <p className="text-sm text-zinc-400">Previously generated reports</p>
          </div>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[#39FF14]" />
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center">
              <History size={32} className="mx-auto mb-3 text-zinc-600" />
              <p className="text-zinc-400">No reports generated yet</p>
              <p className="mt-1 text-sm text-zinc-500">Generate your first report from the builder</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase text-zinc-500">
                    <th className="px-4 py-3 text-left font-medium">Report</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">Period</th>
                    <th className="px-4 py-3 text-left font-medium">Generated</th>
                    <th className="px-4 py-3 text-left font-medium">Sent To</th>
                    <th className="px-4 py-3 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((report) => (
                    <tr key={report.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-white">{report.reportName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-300 capitalize">
                          {report.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                        {new Date(report.period.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' - '}
                        {new Date(report.period.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                        {new Date(report.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {report.sentTo.length > 0 ? (
                          <span title={report.sentTo.join(', ')}>
                            {report.sentTo.length} recipient{report.sentTo.length !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-zinc-600">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={async () => {
                            // Fetch the full report to get HTML
                            try {
                              const res = await fetch(`/api/reports/history?limit=100`);
                              if (res.ok) {
                                const data = await res.json();
                                const full = (data.data || []).find((r: ReportHistoryItem) => r.id === report.id);
                                if (full?.htmlContent) {
                                  setPreviewHtml(full.htmlContent);
                                } else {
                                  notify('error', 'No HTML content available for this report');
                                }
                              }
                            } catch {
                              notify('error', 'Failed to load report');
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#39FF14] hover:bg-[#39FF14]/10"
                        >
                          <Eye size={12} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ======= Preview Modal ======= */}
      {previewHtml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setPreviewHtml(null)}>
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl border border-white/10 bg-neutral-900 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Preview header */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <h3 className="text-lg font-semibold text-white">Report Preview</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // Download as HTML file
                    const blob = new Blob([previewHtml], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${reportName.replace(/\s+/g, '_')}.html`;
                    a.click();
                    URL.revokeObjectURL(url);
                    notify('success', 'Report downloaded');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#39FF14]/10 px-3 py-1.5 text-xs font-medium text-[#39FF14] hover:bg-[#39FF14]/20"
                >
                  <Download size={12} />
                  Download HTML
                </button>
                <button
                  onClick={() => {
                    // Simple print dialog for PDF
                    const win = window.open('', '_blank');
                    if (win) {
                      win.document.write(previewHtml);
                      win.document.close();
                      setTimeout(() => win.print(), 500);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-600"
                >
                  <FileText size={12} />
                  Print / PDF
                </button>
                <button
                  onClick={() => setPreviewHtml(null)}
                  className="rounded-lg p-1.5 text-zinc-500 hover:text-white hover:bg-white/10"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            {/* Preview body */}
            <div className="flex-1 overflow-y-auto">
              <iframe
                srcDoc={previewHtml}
                className="h-[70vh] w-full border-0"
                title="Report Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
