'use client';

/**
 * RCRS Command Center - Financial Reports Dashboard
 *
 * Comprehensive financial reporting page that displays:
 * - Revenue summary (MTD, QTD, YTD)
 * - Expense summary and profitability
 * - Rep performance table
 * - Monthly trend visualization
 * - Outstanding invoices with aging buckets
 * - Sync to Google Sheets functionality
 * - CSV export options
 *
 * Uses standard accounting terminology compatible with QuickBooks.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Users,
  FileSpreadsheet,
  Download,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Filter,
} from 'lucide-react';
import CommandCenterLayout from '@/components/command-center/CommandCenterLayout';

// ===========================================================================
// Types
// ===========================================================================

interface FinancialData {
  timestamp: string;
  lifetime?: {
    generatedAt: string;
    source: string;
    totalIncome: number;
    totalCOGS: number;
    grossProfit: number;
    grossMargin: number;
    totalExpenses: number;
    netOperatingIncome: number;
    netOtherIncome: number;
    netIncome: number;
    netMargin: number;
    salesCommissionTotal: number;
    subcontractorPayTotal: number;
    jobMaterialsTotal: number;
    payrollTotal: number;
    advertisingTotal: number;
    assets: number;
    liabilities: number;
    equity: number;
    accountsReceivable: number;
    cashOnHand: number;
  };
  incomeStatement: {
    grossRevenue: number;
    revenueThisMonth: number;
    revenueLastMonth: number;
    revenueYTD: number;
    monthOverMonthGrowth: number;
    yearOverYearGrowth: number;
    costOfGoodsSold: number;
    materialCosts: number;
    laborCosts: number;
    grossProfit: number;
    grossMargin: number;
    operatingExpenses: number;
    netOperatingIncome: number;
    netMargin: number;
  };
  balanceSheet: {
    accountsReceivable: number;
    accountsPayable: number;
    pipelineValue: number;
  };
  cashFlow: {
    cashInflow: number;
    cashOutflow: number;
    netCashFlow: number;
    accountsReceivable: number;
    accountsPayable: number;
  };
  invoices: {
    totalInvoices: number;
    paidCount: number;
    paidAmount: number;
    outstandingCount: number;
    accountsReceivable: number;
    overdueCount: number;
    overdueAmount: number;
  };
  aging: {
    bucket: string;
    label: string;
    count: number;
    amount: number;
    percentOfTotal: number;
  }[];
  repPerformance: {
    repName: string;
    grossRevenue: number;
    totalCommissions: number;
    jobCount: number;
    avgJobSize: number;
    closeRate: number;
    percentOfTotal: number;
  }[];
  monthlyBreakdown: {
    period: string;
    periodLabel: string;
    grossRevenue: number;
    costOfGoodsSold: number;
    grossProfit: number;
    operatingExpenses: number;
    netOperatingIncome: number;
    grossMargin: number;
    netMargin: number;
    jobCount: number;
    avgJobSize: number;
  }[];
  alerts: {
    alertId: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    amount?: number;
  }[];
}

// ===========================================================================
// Helpers
// ===========================================================================

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Text-based bar chart for monthly trends
function TextBar({ value, maxValue, color }: { value: number; maxValue: number; color: string }) {
  const width = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
  return (
    <div className="w-full bg-gray-700 rounded-full h-3">
      <div
        className={`h-3 rounded-full ${color}`}
        style={{ width: `${Math.min(width, 100)}%` }}
      />
    </div>
  );
}

// ===========================================================================
// Component
// ===========================================================================

export default function FinancialReportsPage() {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [exportType, setExportType] = useState<string>('summary');
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: '',
    to: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateRange.from) params.set('dateFrom', dateRange.from);
      if (dateRange.to) params.set('dateTo', dateRange.to);

      const res = await fetch(`/api/financial/summary?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/financial/sync-to-sheets', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setSyncResult(`Synced ${json.totalRowsSynced} rows across 5 sheets.`);
        setLastSyncTime(json.timestamp);
      } else {
        setSyncResult(`Partial sync: ${json.message}`);
        setLastSyncTime(json.timestamp);
      }
    } catch (err) {
      setSyncResult(`Sync failed: ${String(err)}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams({ type: exportType, format: 'csv' });
    if (dateRange.from) params.set('dateFrom', dateRange.from);
    if (dateRange.to) params.set('dateTo', dateRange.to);
    window.open(`/api/financial/export?${params.toString()}`, '_blank');
  };

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <CommandCenterLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Financial Reports</h1>
            <p className="text-gray-400 text-sm mt-1">
              Comprehensive P&L, revenue analysis, and accounts receivable reporting
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Date Range */}
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={dateRange.from}
                onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                className="bg-transparent text-white text-sm border-none outline-none w-32"
                placeholder="From"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                className="bg-transparent text-white text-sm border-none outline-none w-32"
                placeholder="To"
              />
              {(dateRange.from || dateRange.to) && (
                <button
                  onClick={() => setDateRange({ from: '', to: '' })}
                  className="text-gray-500 hover:text-white text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Refresh */}
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#39FF14] animate-spin" />
            <span className="ml-3 text-gray-400">Loading financial data...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-300">{error}</span>
          </div>
        )}

        {data && !loading && (
          <>
            {/* ============================================================= */}
            {/* Lifetime Totals (real QuickBooks numbers, not estimates) */}
            {/* ============================================================= */}
            {data.lifetime && (
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <h2 className="text-sm font-semibold text-[#39FF14] uppercase tracking-wide">
                    Lifetime — Real QuickBooks Numbers
                  </h2>
                  <span className="text-[10px] text-gray-500">
                    From {data.lifetime.source.split('—')[0].trim()} · pulled {data.lifetime.generatedAt}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  <div className="bg-gradient-to-br from-[#39FF14]/10 to-gray-900 rounded-xl p-4 border border-[#39FF14]/30">
                    <span className="text-gray-400 text-[10px] uppercase tracking-wide">Lifetime Revenue</span>
                    <div className="text-2xl font-bold text-white mt-1">
                      {formatCurrency(data.lifetime.totalIncome)}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1">
                      {formatFullCurrency(data.lifetime.totalIncome)}
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <span className="text-gray-400 text-[10px] uppercase tracking-wide">Gross Profit</span>
                    <div className="text-2xl font-bold text-white mt-1">
                      {formatCurrency(data.lifetime.grossProfit)}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      {formatPercent(data.lifetime.grossMargin * 100)} margin
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <span className="text-gray-400 text-[10px] uppercase tracking-wide">Net Income</span>
                    <div className={`text-2xl font-bold mt-1 ${data.lifetime.netIncome >= 0 ? 'text-white' : 'text-red-400'}`}>
                      {formatCurrency(data.lifetime.netIncome)}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      {formatPercent(data.lifetime.netMargin * 100)} net
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <span className="text-gray-400 text-[10px] uppercase tracking-wide">A/R Outstanding</span>
                    <div className="text-2xl font-bold text-white mt-1">
                      {formatCurrency(data.lifetime.accountsReceivable)}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">balance sheet</div>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <span className="text-gray-400 text-[10px] uppercase tracking-wide">Cash on Hand</span>
                    <div className="text-2xl font-bold text-white mt-1">
                      {formatCurrency(data.lifetime.cashOnHand)}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">bank accounts</div>
                  </div>
                </div>

                {/* Cost-of-revenue breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                  <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">Job Materials</div>
                    <div className="text-base font-semibold text-white mt-1">{formatCurrency(data.lifetime.jobMaterialsTotal)}</div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">Subcontractor Pay</div>
                    <div className="text-base font-semibold text-white mt-1">{formatCurrency(data.lifetime.subcontractorPayTotal)}</div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">Sales Commission</div>
                    <div className="text-base font-semibold text-white mt-1">{formatCurrency(data.lifetime.salesCommissionTotal)}</div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">Payroll</div>
                    <div className="text-base font-semibold text-white mt-1">{formatCurrency(data.lifetime.payrollTotal)}</div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">Advertising / Marketing</div>
                    <div className="text-base font-semibold text-white mt-1">{formatCurrency(data.lifetime.advertisingTotal)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* KPI Cards - Revenue Summary (current period estimates) */}
            {/* ============================================================= */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* MTD Revenue */}
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-xs uppercase tracking-wide">MTD Gross Revenue</span>
                  <DollarSign className="w-4 h-4 text-[#39FF14]" />
                </div>
                <div className="text-xl font-bold text-white">
                  {formatCurrency(data.incomeStatement.revenueThisMonth)}
                </div>
                <div className={`flex items-center text-xs mt-1 ${data.incomeStatement.monthOverMonthGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {data.incomeStatement.monthOverMonthGrowth >= 0 ? (
                    <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 mr-0.5" />
                  )}
                  {formatPercent(Math.abs(data.incomeStatement.monthOverMonthGrowth))} vs last month
                </div>
              </div>

              {/* QTD Revenue */}
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-xs uppercase tracking-wide">YTD Gross Revenue</span>
                  <TrendingUp className="w-4 h-4 text-[#39FF14]" />
                </div>
                <div className="text-xl font-bold text-white">
                  {formatCurrency(data.incomeStatement.revenueYTD)}
                </div>
                <div className={`flex items-center text-xs mt-1 ${data.incomeStatement.yearOverYearGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {data.incomeStatement.yearOverYearGrowth >= 0 ? (
                    <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 mr-0.5" />
                  )}
                  {formatPercent(Math.abs(data.incomeStatement.yearOverYearGrowth))} YoY
                </div>
              </div>

              {/* Gross Profit */}
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-xs uppercase tracking-wide">YTD Gross Profit</span>
                  <BarChart3 className="w-4 h-4 text-[#39FF14]" />
                </div>
                <div className="text-xl font-bold text-white">
                  {formatCurrency(data.incomeStatement.grossProfit)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Gross Margin: {formatPercent(data.incomeStatement.grossMargin)}
                </div>
              </div>

              {/* Net Operating Income */}
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-xs uppercase tracking-wide">Net Operating Income</span>
                  {data.incomeStatement.netOperatingIncome >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-[#39FF14]" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div className={`text-xl font-bold ${data.incomeStatement.netOperatingIncome >= 0 ? 'text-white' : 'text-red-400'}`}>
                  {formatCurrency(data.incomeStatement.netOperatingIncome)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Net Margin: {formatPercent(data.incomeStatement.netMargin)}
                </div>
              </div>
            </div>

            {/* ============================================================= */}
            {/* Income Statement & Balance Sheet */}
            {/* ============================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Income Statement */}
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-[#39FF14]" />
                  Income Statement (YTD)
                </h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-gray-300">Gross Revenue</span>
                    <span className="text-white font-medium">{formatFullCurrency(data.incomeStatement.revenueYTD)}</span>
                  </div>
                  <div className="flex justify-between py-1 pl-4">
                    <span className="text-gray-400">Material Costs</span>
                    <span className="text-gray-300">({formatFullCurrency(data.incomeStatement.materialCosts)})</span>
                  </div>
                  <div className="flex justify-between py-1 pl-4">
                    <span className="text-gray-400">Labor Costs</span>
                    <span className="text-gray-300">({formatFullCurrency(data.incomeStatement.laborCosts)})</span>
                  </div>
                  <div className="border-t border-gray-600 my-1" />
                  <div className="flex justify-between py-1">
                    <span className="text-gray-300">Cost of Goods Sold (COGS)</span>
                    <span className="text-gray-300">({formatFullCurrency(data.incomeStatement.costOfGoodsSold)})</span>
                  </div>
                  <div className="flex justify-between py-1 font-medium">
                    <span className="text-white">Gross Profit</span>
                    <span className="text-[#39FF14]">{formatFullCurrency(data.incomeStatement.grossProfit)}</span>
                  </div>
                  <div className="flex justify-between py-1 pl-4">
                    <span className="text-gray-400">Operating Expenses</span>
                    <span className="text-gray-300">({formatFullCurrency(data.incomeStatement.operatingExpenses)})</span>
                  </div>
                  <div className="border-t border-gray-600 my-1" />
                  <div className="flex justify-between py-1 font-bold">
                    <span className="text-white">Net Operating Income</span>
                    <span className={data.incomeStatement.netOperatingIncome >= 0 ? 'text-[#39FF14]' : 'text-red-400'}>
                      {formatFullCurrency(data.incomeStatement.netOperatingIncome)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-400">Gross Margin</span>
                    <span className="text-gray-300">{formatPercent(data.incomeStatement.grossMargin)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-400">Net Margin</span>
                    <span className="text-gray-300">{formatPercent(data.incomeStatement.netMargin)}</span>
                  </div>
                </div>
              </div>

              {/* Balance Sheet & Cash Flow */}
              <div className="space-y-6">
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                  <h2 className="text-lg font-semibold text-white mb-4">Balance Sheet Items</h2>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1">
                      <span className="text-gray-300">Accounts Receivable</span>
                      <span className="text-white font-medium">{formatFullCurrency(data.balanceSheet.accountsReceivable)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-300">Accounts Payable</span>
                      <span className="text-white font-medium">{formatFullCurrency(data.balanceSheet.accountsPayable)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-300">Pipeline Value</span>
                      <span className="text-gray-400">{formatFullCurrency(data.balanceSheet.pipelineValue)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                  <h2 className="text-lg font-semibold text-white mb-4">Cash Flow (This Month)</h2>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1">
                      <span className="text-gray-300">Cash Inflow</span>
                      <span className="text-green-400">{formatFullCurrency(data.cashFlow.cashInflow)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-300">Cash Outflow</span>
                      <span className="text-red-400">({formatFullCurrency(data.cashFlow.cashOutflow)})</span>
                    </div>
                    <div className="border-t border-gray-600 my-1" />
                    <div className="flex justify-between py-1 font-bold">
                      <span className="text-white">Net Cash Flow</span>
                      <span className={data.cashFlow.netCashFlow >= 0 ? 'text-[#39FF14]' : 'text-red-400'}>
                        {formatFullCurrency(data.cashFlow.netCashFlow)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================= */}
            {/* Monthly Revenue Trend (text-based bar chart) */}
            {/* ============================================================= */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#39FF14]" />
                Monthly Revenue vs COGS (Last 12 Months)
              </h2>
              <div className="space-y-3">
                {/* Legend */}
                <div className="flex items-center gap-4 text-xs text-gray-400 mb-2">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-[#39FF14]" />
                    <span>Gross Revenue</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-red-500" />
                    <span>COGS</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-blue-500" />
                    <span>Net Operating Income</span>
                  </div>
                </div>

                {(() => {
                  const maxRevenue = Math.max(...data.monthlyBreakdown.map(m => m.grossRevenue), 1);
                  return data.monthlyBreakdown.map((month) => (
                    <div key={month.period} className="flex items-center gap-3">
                      <div className="w-20 text-xs text-gray-400 shrink-0 text-right">
                        {month.periodLabel}
                      </div>
                      <div className="flex-1 space-y-1">
                        <TextBar value={month.grossRevenue} maxValue={maxRevenue} color="bg-[#39FF14]" />
                        <TextBar value={month.costOfGoodsSold} maxValue={maxRevenue} color="bg-red-500" />
                        <TextBar value={Math.max(0, month.netOperatingIncome)} maxValue={maxRevenue} color="bg-blue-500" />
                      </div>
                      <div className="w-28 text-right shrink-0">
                        <div className="text-xs text-white">{formatCurrency(month.grossRevenue)}</div>
                        <div className="text-xs text-gray-500">{formatPercent(month.grossMargin)} margin</div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* ============================================================= */}
            {/* Rep Performance Table */}
            {/* ============================================================= */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#39FF14]" />
                Sales Rep Performance
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-400 font-medium">Sales Rep</th>
                      <th className="text-right py-2 px-3 text-gray-400 font-medium">Gross Revenue</th>
                      <th className="text-right py-2 px-3 text-gray-400 font-medium">Commissions</th>
                      <th className="text-right py-2 px-3 text-gray-400 font-medium">Jobs</th>
                      <th className="text-right py-2 px-3 text-gray-400 font-medium">Avg Job Size</th>
                      <th className="text-right py-2 px-3 text-gray-400 font-medium">Close Rate</th>
                      <th className="text-right py-2 px-3 text-gray-400 font-medium">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.repPerformance.slice(0, 20).map((rep, idx) => (
                      <tr
                        key={rep.repName}
                        className={`border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors ${idx === 0 ? 'bg-[#39FF14]/5' : ''}`}
                      >
                        <td className="py-2 px-3 text-white font-medium">
                          {idx === 0 && <span className="text-[#39FF14] mr-1">*</span>}
                          {rep.repName}
                        </td>
                        <td className="py-2 px-3 text-right text-white">{formatFullCurrency(rep.grossRevenue)}</td>
                        <td className="py-2 px-3 text-right text-gray-300">{formatFullCurrency(rep.totalCommissions)}</td>
                        <td className="py-2 px-3 text-right text-gray-300">{rep.jobCount}</td>
                        <td className="py-2 px-3 text-right text-gray-300">{formatFullCurrency(rep.avgJobSize)}</td>
                        <td className="py-2 px-3 text-right text-gray-300">{formatPercent(rep.closeRate)}</td>
                        <td className="py-2 px-3 text-right">
                          <span className="text-[#39FF14]">{formatPercent(rep.percentOfTotal)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-600">
                      <td className="py-2 px-3 text-white font-bold">TOTAL</td>
                      <td className="py-2 px-3 text-right text-white font-bold">
                        {formatFullCurrency(data.repPerformance.reduce((sum, r) => sum + r.grossRevenue, 0))}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-300 font-bold">
                        {formatFullCurrency(data.repPerformance.reduce((sum, r) => sum + r.totalCommissions, 0))}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-300 font-bold">
                        {data.repPerformance.reduce((sum, r) => sum + r.jobCount, 0)}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-300">-</td>
                      <td className="py-2 px-3 text-right text-gray-300">-</td>
                      <td className="py-2 px-3 text-right text-[#39FF14] font-bold">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* ============================================================= */}
            {/* Outstanding Invoices / AR Aging */}
            {/* ============================================================= */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#39FF14]" />
                Accounts Receivable Aging
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                {data.aging.map((bucket) => {
                  let borderColor = 'border-gray-600';
                  let textColor = 'text-gray-300';
                  if (bucket.bucket === '90+') {
                    borderColor = 'border-red-500';
                    textColor = 'text-red-400';
                  } else if (bucket.bucket === '61-90') {
                    borderColor = 'border-orange-500';
                    textColor = 'text-orange-400';
                  } else if (bucket.bucket === '31-60') {
                    borderColor = 'border-yellow-500';
                    textColor = 'text-yellow-400';
                  } else if (bucket.bucket === '1-30') {
                    borderColor = 'border-blue-500';
                    textColor = 'text-blue-400';
                  } else if (bucket.bucket === 'current') {
                    borderColor = 'border-[#39FF14]';
                    textColor = 'text-[#39FF14]';
                  }

                  return (
                    <div key={bucket.bucket} className={`bg-gray-900 rounded-lg p-3 border ${borderColor}`}>
                      <div className="text-xs text-gray-400 mb-1">{bucket.label}</div>
                      <div className={`text-lg font-bold ${textColor}`}>
                        {formatCurrency(bucket.amount)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {bucket.count} invoice{bucket.count !== 1 ? 's' : ''} ({formatPercent(bucket.percentOfTotal)})
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Invoice Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-700">
                <div>
                  <div className="text-xs text-gray-400">Total Invoices</div>
                  <div className="text-white font-medium">{data.invoices.totalInvoices}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Paid</div>
                  <div className="text-green-400 font-medium">{data.invoices.paidCount} ({formatFullCurrency(data.invoices.paidAmount)})</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Outstanding (AR)</div>
                  <div className="text-yellow-400 font-medium">{data.invoices.outstandingCount} ({formatFullCurrency(data.invoices.accountsReceivable)})</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Overdue</div>
                  <div className="text-red-400 font-medium">{data.invoices.overdueCount} ({formatFullCurrency(data.invoices.overdueAmount)})</div>
                </div>
              </div>
            </div>

            {/* ============================================================= */}
            {/* Financial Alerts */}
            {/* ============================================================= */}
            {data.alerts.length > 0 && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  Financial Alerts ({data.alerts.length})
                </h2>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {data.alerts.slice(0, 10).map((alert) => (
                    <div
                      key={alert.alertId}
                      className={`flex items-start gap-3 p-3 rounded-lg ${
                        alert.severity === 'critical' ? 'bg-red-900/20 border border-red-800' :
                        alert.severity === 'warning' ? 'bg-yellow-900/20 border border-yellow-800' :
                        'bg-blue-900/20 border border-blue-800'
                      }`}
                    >
                      <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
                        alert.severity === 'critical' ? 'text-red-400' :
                        alert.severity === 'warning' ? 'text-yellow-400' :
                        'text-blue-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white">{alert.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{alert.description}</div>
                      </div>
                      {alert.amount !== undefined && (
                        <div className="text-sm font-medium text-white shrink-0">
                          {formatFullCurrency(alert.amount)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* Sync & Export Actions */}
            {/* ============================================================= */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#39FF14]" />
                Data Sync & Export
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Google Sheets Sync */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-300">Sync to Google Sheets</h3>
                  <p className="text-xs text-gray-500">
                    Writes all financial data to the master Google Sheet as separate tabs:
                    Financial_Summary, Revenue_By_Rep, Job_Profitability, Outstanding_Invoices, Monthly_Trends
                  </p>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex items-center gap-2 bg-[#39FF14] hover:bg-[#32e012] text-black px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {syncing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4" />
                    )}
                    {syncing ? 'Syncing...' : 'Sync All Financial Data'}
                  </button>
                  {syncResult && (
                    <div className="flex items-center gap-2 text-xs">
                      <CheckCircle className="w-3.5 h-3.5 text-[#39FF14]" />
                      <span className="text-gray-300">{syncResult}</span>
                    </div>
                  )}
                  {lastSyncTime && (
                    <div className="text-xs text-gray-500">
                      Last synced: {new Date(lastSyncTime).toLocaleString()}
                    </div>
                  )}
                </div>

                {/* CSV Export */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-300">Export as CSV</h3>
                  <p className="text-xs text-gray-500">
                    Download financial data as CSV files for import into QuickBooks,
                    Excel, or other accounting software.
                  </p>
                  <div className="flex items-center gap-2">
                    <select
                      value={exportType}
                      onChange={e => setExportType(e.target.value)}
                      className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#39FF14]"
                    >
                      <option value="summary">Financial Summary (P&L)</option>
                      <option value="commissions">Commissions by Rep</option>
                      <option value="invoices">Accounts Receivable</option>
                      <option value="profitability">Job Profitability</option>
                    </select>
                    <button
                      onClick={handleExport}
                      className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </CommandCenterLayout>
  );
}
