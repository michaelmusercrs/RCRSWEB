'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Search,
  Package,
  Truck,
  FileText,
  DollarSign,
  Shield,
  ClipboardCheck,
  BarChart2,
  Info,
  Play,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

type FlagSeverity = 'green' | 'yellow' | 'red';

interface MaterialReconciliationItem {
  productName: string;
  category: string;
  breakdownQty: number;
  breakdownUnitCost: number;
  breakdownTotal: number;
  inBreakdown: boolean;
  inventoryProductId: string;
  inventoryCurrentQty: number;
  inventoryUnitCost: number;
  trackedInInventory: boolean;
  deliveryTicketId: string;
  deliveryTicketStatus: string;
  deliveredQty: number;
  assignedToDelivery: boolean;
  deliveryCompleted: boolean;
  invoiceId: string;
  invoicedQty: number;
  invoicedUnitPrice: number;
  invoicedTotal: number;
  invoiced: boolean;
  flag: FlagSeverity;
  warnings: string[];
}

interface JobReconciliation {
  jobId: string;
  jobName: string;
  customerName: string;
  breakdownId: string;
  breakdownStatus: string;
  materials: MaterialReconciliationItem[];
  totalBreakdownCost: number;
  totalInvoicedAmount: number;
  totalDeliveredValue: number;
  overallFlag: FlagSeverity;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  warningCount: number;
  warnings: string[];
  reconciledAt: string;
}

interface ReconciliationReport {
  generatedAt: string;
  jobs: JobReconciliation[];
  materialsNotOnDelivery: { jobId: string; jobName: string; productName: string; qty: number }[];
  deliveredNotInvoiced: { jobId: string; jobName: string; productName: string; ticketId: string }[];
  priceMismatches: { jobId: string; jobName: string; productName: string; inventoryPrice: number; invoicedPrice: number; difference: number }[];
  pulledNotDelivered: { jobId: string; jobName: string; productName: string; ticketId: string; ticketStatus: string }[];
  totalJobs: number;
  jobsFullyReconciled: number;
  jobsWithWarnings: number;
  jobsWithErrors: number;
  totalDiscrepancies: number;
}

// ============================================
// HELPERS
// ============================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(iso: string): string {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function FlagBadge({ flag }: { flag: FlagSeverity }) {
  const config = {
    green: { icon: <CheckCircle className="w-4 h-4" />, bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', label: 'Matched' },
    yellow: { icon: <AlertTriangle className="w-4 h-4" />, bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', label: 'Warning' },
    red: { icon: <XCircle className="w-4 h-4" />, bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', label: 'Missing' },
  };
  const c = config[flag];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.border} ${c.text} border`}>
      {c.icon}
      {c.label}
    </span>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function ReconciliationPage() {
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFlag, setFilterFlag] = useState<FlagSeverity | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'issues'>('overview');
  const [lastSyncResult, setLastSyncResult] = useState<string | null>(null);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/inventory/reconciliation');
      const data = await res.json();
      if (data.success && data.report) {
        setReport(data.report);
      } else {
        setError(data.error || 'Failed to load reconciliation data');
      }
    } catch (err) {
      setError('Failed to connect to reconciliation service');
    } finally {
      setLoading(false);
    }
  }, []);

  const runReconciliation = useCallback(async () => {
    setRunning(true);
    setError(null);
    setLastSyncResult(null);
    try {
      const res = await fetch('/api/portal/inventory/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncToSheets: true }),
      });
      const data = await res.json();
      if (data.success && data.report) {
        setReport(data.report);
        if (data.sheetsSync?.success) {
          setLastSyncResult(`Synced ${data.sheetsSync.rowsWritten} jobs to Google Sheets`);
        }
      } else {
        setError(data.error || 'Reconciliation run failed');
      }
    } catch (err) {
      setError('Failed to run reconciliation');
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // ============================================
  // FILTERING
  // ============================================

  const filteredJobs = (report?.jobs || []).filter(job => {
    if (filterFlag !== 'all' && job.overallFlag !== filterFlag) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        job.jobName.toLowerCase().includes(q) ||
        job.customerName.toLowerCase().includes(q) ||
        job.jobId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ============================================
  // EXPAND/COLLAPSE
  // ============================================

  const toggleJob = (jobId: string) => {
    setExpandedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedJobs(new Set(filteredJobs.map(j => j.jobId)));
  };

  const collapseAll = () => {
    setExpandedJobs(new Set());
  };

  // ============================================
  // EXPORT
  // ============================================

  const exportCSV = () => {
    if (!report) return;

    const rows: string[] = [
      ['Job ID', 'Job Name', 'Customer', 'Status', 'Material', 'Category', 'Breakdown Qty', 'Breakdown Cost',
        'In Inventory', 'On Delivery', 'Delivery Status', 'Invoiced', 'Invoice Amount', 'Flag', 'Warnings'].join(',')
    ];

    for (const job of report.jobs) {
      for (const mat of job.materials) {
        rows.push([
          `"${job.jobId}"`,
          `"${job.jobName}"`,
          `"${job.customerName}"`,
          `"${job.breakdownStatus}"`,
          `"${mat.productName}"`,
          `"${mat.category}"`,
          mat.breakdownQty.toString(),
          mat.breakdownTotal.toFixed(2),
          mat.trackedInInventory ? 'Yes' : 'No',
          mat.assignedToDelivery ? 'Yes' : 'No',
          `"${mat.deliveryTicketStatus || 'N/A'}"`,
          mat.invoiced ? 'Yes' : 'No',
          mat.invoicedTotal.toFixed(2),
          mat.flag,
          `"${mat.warnings.join('; ')}"`,
        ].join(','));
      }
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <div className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/portal/inventory/management" className="text-zinc-400 hover:text-white transition">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <Shield className="w-6 h-6 text-[#39FF14]" />
              <div>
                <h1 className="text-xl font-bold">Reconciliation Dashboard</h1>
                <p className="text-xs text-zinc-500">
                  Inventory - Delivery - Invoice cross-check
                  {report && ` | Last run: ${formatDate(report.generatedAt)}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchReport}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 rounded-lg transition disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={runReconciliation}
                disabled={running}
                className="flex items-center gap-2 px-4 py-1.5 text-sm bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#32e612] transition disabled:opacity-50"
              >
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {running ? 'Running...' : 'Run Reconciliation'}
              </button>
            </div>
          </div>

          {/* Sub-nav tabs */}
          <div className="flex gap-1 mt-4">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-t-lg transition ${
                activeTab === 'overview'
                  ? 'bg-neutral-800 text-[#39FF14] border-b-2 border-[#39FF14]'
                  : 'text-zinc-400 hover:text-white hover:bg-neutral-800/50'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('issues')}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-t-lg transition ${
                activeTab === 'issues'
                  ? 'bg-neutral-800 text-[#39FF14] border-b-2 border-[#39FF14]'
                  : 'text-zinc-400 hover:text-white hover:bg-neutral-800/50'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Issues
              {report && report.totalDiscrepancies > 0 && (
                <span className="bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 rounded-full">
                  {report.totalDiscrepancies}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <XCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Success toast */}
        {lastSyncResult && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            {lastSyncResult}
          </div>
        )}

        {/* Loading state */}
        {loading && !report && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#39FF14]" />
            <span className="ml-3 text-zinc-400">Loading reconciliation data...</span>
          </div>
        )}

        {/* Content */}
        {report && activeTab === 'overview' && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
                  <ClipboardCheck className="w-4 h-4" />
                  Total Jobs
                </div>
                <div className="text-2xl font-bold">{report.totalJobs}</div>
              </div>
              <div className="bg-neutral-900 border border-emerald-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 text-emerald-400 text-sm mb-1">
                  <CheckCircle className="w-4 h-4" />
                  Fully Reconciled
                </div>
                <div className="text-2xl font-bold text-emerald-400">{report.jobsFullyReconciled}</div>
              </div>
              <div className="bg-neutral-900 border border-amber-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 text-amber-400 text-sm mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  Warnings
                </div>
                <div className="text-2xl font-bold text-amber-400">{report.jobsWithWarnings}</div>
              </div>
              <div className="bg-neutral-900 border border-red-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 text-red-400 text-sm mb-1">
                  <XCircle className="w-4 h-4" />
                  Errors
                </div>
                <div className="text-2xl font-bold text-red-400">{report.jobsWithErrors}</div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search jobs..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-[#39FF14]/50 text-sm"
                />
              </div>
              <div className="flex items-center gap-1">
                {(['all', 'green', 'yellow', 'red'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilterFlag(f)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition ${
                      filterFlag === f
                        ? f === 'all' ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30'
                        : f === 'green' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : f === 'yellow' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-neutral-800 text-zinc-400 border border-neutral-700 hover:bg-neutral-700'
                    }`}
                  >
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 ml-auto">
                <button onClick={expandAll} className="px-3 py-1.5 text-xs bg-neutral-800 text-zinc-400 rounded-lg hover:bg-neutral-700 transition">
                  Expand All
                </button>
                <button onClick={collapseAll} className="px-3 py-1.5 text-xs bg-neutral-800 text-zinc-400 rounded-lg hover:bg-neutral-700 transition">
                  Collapse
                </button>
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-neutral-800 text-zinc-400 rounded-lg hover:bg-neutral-700 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Job List */}
            <div className="space-y-3">
              {filteredJobs.length === 0 && (
                <div className="text-center py-12 text-zinc-500">
                  <Info className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>No jobs match your filters.</p>
                </div>
              )}

              {filteredJobs.map(job => (
                <div
                  key={job.jobId}
                  className={`bg-neutral-900 border rounded-xl overflow-hidden transition ${
                    job.overallFlag === 'green' ? 'border-emerald-500/20'
                    : job.overallFlag === 'yellow' ? 'border-amber-500/20'
                    : 'border-red-500/20'
                  }`}
                >
                  {/* Job Header */}
                  <button
                    onClick={() => toggleJob(job.jobId)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-800/50 transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <FlagBadge flag={job.overallFlag} />
                      <div>
                        <div className="font-semibold text-white">{job.jobName}</div>
                        <div className="text-xs text-zinc-500">
                          {job.customerName} | {job.breakdownId} | {job.materials.length} materials
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden sm:flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle className="w-3.5 h-3.5" /> {job.greenCount}
                        </span>
                        <span className="flex items-center gap-1 text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5" /> {job.yellowCount}
                        </span>
                        <span className="flex items-center gap-1 text-red-400">
                          <XCircle className="w-3.5 h-3.5" /> {job.redCount}
                        </span>
                      </div>
                      <div className="text-right hidden md:block">
                        <div className="text-sm text-zinc-400">Breakdown: {formatCurrency(job.totalBreakdownCost)}</div>
                        <div className="text-xs text-zinc-500">Invoiced: {formatCurrency(job.totalInvoicedAmount)}</div>
                      </div>
                      {expandedJobs.has(job.jobId) ? (
                        <ChevronUp className="w-5 h-5 text-zinc-500" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-zinc-500" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Material Details */}
                  {expandedJobs.has(job.jobId) && (
                    <div className="border-t border-neutral-800">
                      {/* Job-level warnings */}
                      {job.warnings.length > 0 && (
                        <div className="px-5 py-3 bg-amber-500/5 border-b border-neutral-800">
                          <div className="text-xs font-medium text-amber-400 mb-1">Job Warnings ({job.warnings.length})</div>
                          <ul className="space-y-1">
                            {job.warnings.map((w, i) => (
                              <li key={i} className="text-xs text-amber-300/80 flex items-start gap-1.5">
                                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Material Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-neutral-800 text-xs text-zinc-500">
                              <th className="text-left px-5 py-2">Material</th>
                              <th className="text-center px-3 py-2">
                                <span className="flex items-center justify-center gap-1"><Package className="w-3.5 h-3.5" /> Inventory</span>
                              </th>
                              <th className="text-center px-3 py-2">
                                <span className="flex items-center justify-center gap-1"><Truck className="w-3.5 h-3.5" /> Delivery</span>
                              </th>
                              <th className="text-center px-3 py-2">
                                <span className="flex items-center justify-center gap-1"><FileText className="w-3.5 h-3.5" /> Invoiced</span>
                              </th>
                              <th className="text-center px-3 py-2">
                                <span className="flex items-center justify-center gap-1"><DollarSign className="w-3.5 h-3.5" /> Amount</span>
                              </th>
                              <th className="text-center px-3 py-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {job.materials.map((mat, idx) => (
                              <tr
                                key={idx}
                                className={`border-b border-neutral-800/50 hover:bg-neutral-800/30 transition ${
                                  mat.flag === 'red' ? 'bg-red-500/5' : mat.flag === 'yellow' ? 'bg-amber-500/5' : ''
                                }`}
                              >
                                <td className="px-5 py-3">
                                  <div className="font-medium text-white text-sm">{mat.productName}</div>
                                  <div className="text-xs text-zinc-500">
                                    {mat.category} | {mat.breakdownQty} {mat.breakdownQty === 1 ? 'unit' : 'units'} @ {formatCurrency(mat.breakdownUnitCost)}
                                  </div>
                                  {mat.warnings.length > 0 && (
                                    <div className="mt-1 space-y-0.5">
                                      {mat.warnings.map((w, wi) => (
                                        <div key={wi} className="text-xs text-amber-400/80 flex items-start gap-1">
                                          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                          {w}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td className="text-center px-3 py-3">
                                  {mat.trackedInInventory ? (
                                    <span className="text-emerald-400">
                                      <CheckCircle className="w-4 h-4 mx-auto" />
                                      <div className="text-xs mt-0.5">{mat.inventoryCurrentQty} in stock</div>
                                    </span>
                                  ) : (
                                    <span className="text-red-400">
                                      <XCircle className="w-4 h-4 mx-auto" />
                                      <div className="text-xs mt-0.5">Not found</div>
                                    </span>
                                  )}
                                </td>
                                <td className="text-center px-3 py-3">
                                  {mat.assignedToDelivery ? (
                                    <span className={mat.deliveryCompleted ? 'text-emerald-400' : 'text-amber-400'}>
                                      {mat.deliveryCompleted ? (
                                        <CheckCircle className="w-4 h-4 mx-auto" />
                                      ) : (
                                        <AlertTriangle className="w-4 h-4 mx-auto" />
                                      )}
                                      <div className="text-xs mt-0.5">{mat.deliveryTicketStatus}</div>
                                    </span>
                                  ) : (
                                    <span className="text-red-400">
                                      <XCircle className="w-4 h-4 mx-auto" />
                                      <div className="text-xs mt-0.5">No ticket</div>
                                    </span>
                                  )}
                                </td>
                                <td className="text-center px-3 py-3">
                                  {mat.invoiced ? (
                                    <span className="text-emerald-400">
                                      <CheckCircle className="w-4 h-4 mx-auto" />
                                      <div className="text-xs mt-0.5">{mat.invoiceId}</div>
                                    </span>
                                  ) : (
                                    <span className="text-red-400">
                                      <XCircle className="w-4 h-4 mx-auto" />
                                      <div className="text-xs mt-0.5">Not invoiced</div>
                                    </span>
                                  )}
                                </td>
                                <td className="text-center px-3 py-3">
                                  <div className="text-white font-medium">{formatCurrency(mat.breakdownTotal)}</div>
                                  {mat.invoiced && (
                                    <div className="text-xs text-zinc-500">Inv: {formatCurrency(mat.invoicedTotal)}</div>
                                  )}
                                </td>
                                <td className="text-center px-3 py-3">
                                  <FlagBadge flag={mat.flag} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Job Summary Footer */}
                      <div className="px-5 py-3 bg-neutral-800/30 flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-400">
                        <div className="flex items-center gap-4">
                          <span>Breakdown: <span className="text-white font-medium">{formatCurrency(job.totalBreakdownCost)}</span></span>
                          <span>Delivered: <span className="text-white font-medium">{formatCurrency(job.totalDeliveredValue)}</span></span>
                          <span>Invoiced: <span className="text-white font-medium">{formatCurrency(job.totalInvoicedAmount)}</span></span>
                        </div>
                        <div className="text-zinc-500">
                          Reconciled: {formatDate(job.reconciledAt)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Issues Tab */}
        {report && activeTab === 'issues' && (
          <div className="space-y-6">
            {/* Materials Not on Delivery */}
            <div className="bg-neutral-900 border border-red-500/20 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-neutral-800 flex items-center gap-2">
                <Truck className="w-4 h-4 text-red-400" />
                <h3 className="font-semibold text-red-400">Materials in Breakdown but NOT on Delivery Ticket</h3>
                <span className="ml-auto text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                  {report.materialsNotOnDelivery.length}
                </span>
              </div>
              {report.materialsNotOnDelivery.length === 0 ? (
                <div className="px-5 py-4 text-sm text-zinc-500">No issues found.</div>
              ) : (
                <div className="divide-y divide-neutral-800/50">
                  {report.materialsNotOnDelivery.map((item, i) => (
                    <div key={i} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm text-white font-medium">{item.productName}</div>
                        <div className="text-xs text-zinc-500">{item.jobName} ({item.jobId})</div>
                      </div>
                      <div className="text-sm text-zinc-400">{item.qty} units</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Delivered but Not Invoiced */}
            <div className="bg-neutral-900 border border-red-500/20 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-neutral-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-red-400" />
                <h3 className="font-semibold text-red-400">Materials Delivered but NOT Invoiced</h3>
                <span className="ml-auto text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                  {report.deliveredNotInvoiced.length}
                </span>
              </div>
              {report.deliveredNotInvoiced.length === 0 ? (
                <div className="px-5 py-4 text-sm text-zinc-500">No issues found.</div>
              ) : (
                <div className="divide-y divide-neutral-800/50">
                  {report.deliveredNotInvoiced.map((item, i) => (
                    <div key={i} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm text-white font-medium">{item.productName}</div>
                        <div className="text-xs text-zinc-500">{item.jobName} | Ticket: {item.ticketId}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Price Mismatches */}
            <div className="bg-neutral-900 border border-amber-500/20 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-neutral-800 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-amber-400">Price Mismatches (Inventory vs Invoice)</h3>
                <span className="ml-auto text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                  {report.priceMismatches.length}
                </span>
              </div>
              {report.priceMismatches.length === 0 ? (
                <div className="px-5 py-4 text-sm text-zinc-500">No issues found.</div>
              ) : (
                <div className="divide-y divide-neutral-800/50">
                  {report.priceMismatches.map((item, i) => (
                    <div key={i} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm text-white font-medium">{item.productName}</div>
                        <div className="text-xs text-zinc-500">{item.jobName}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">
                          <span className="text-zinc-400">Inventory:</span> <span className="text-white">{formatCurrency(item.inventoryPrice)}</span>
                          <span className="mx-2 text-zinc-600">|</span>
                          <span className="text-zinc-400">Invoice:</span> <span className="text-white">{formatCurrency(item.invoicedPrice)}</span>
                        </div>
                        <div className={`text-xs ${item.difference > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                          Diff: {item.difference > 0 ? '+' : ''}{formatCurrency(item.difference)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pulled but Not Delivered */}
            <div className="bg-neutral-900 border border-amber-500/20 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-neutral-800 flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-amber-400">Materials Pulled but Delivery Not Completed</h3>
                <span className="ml-auto text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                  {report.pulledNotDelivered.length}
                </span>
              </div>
              {report.pulledNotDelivered.length === 0 ? (
                <div className="px-5 py-4 text-sm text-zinc-500">No issues found.</div>
              ) : (
                <div className="divide-y divide-neutral-800/50">
                  {report.pulledNotDelivered.map((item, i) => (
                    <div key={i} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm text-white font-medium">{item.productName}</div>
                        <div className="text-xs text-zinc-500">{item.jobName} | Ticket: {item.ticketId}</div>
                      </div>
                      <div className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                        {item.ticketStatus}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
