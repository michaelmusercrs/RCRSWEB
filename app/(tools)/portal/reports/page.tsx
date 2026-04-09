'use client';

/**
 * Portal Reports & Analytics
 *
 * Wired to REAL data sources:
 * - Billing: /api/command-center/financial (commissions.json + invoices)
 * - Team: /api/command-center/sales (commissions.json leaderboard)
 * - Inventory: /api/portal/inventory (unified-inventory-service)
 * - Delivery: /api/portal/pipeline?action=stats + ?action=list (18-stage pipeline)
 * - Job Flow: /api/portal/pipeline?action=stats (stage breakdown + bottleneck detection)
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, BarChart3, Truck, Package, DollarSign, Users,
  Download, RefreshCw, Filter, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, Clock, ArrowRight, Loader2
} from 'lucide-react';

type ReportType = 'billing' | 'team' | 'inventory' | 'delivery' | 'jobflow';

// ---------------------------------------------------------------------------
// Data types matching the real API responses
// ---------------------------------------------------------------------------

interface FinancialSummary {
  totalRevenue: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueYTD: number;
  monthOverMonthGrowth: number;
  grossMargin: number;
  accountsReceivable: number;
  overdueInvoices: number;
  overdueAmount: number;
  outstandingInvoices: number;
}

interface RevenueByPeriod {
  period: string;
  periodLabel: string;
  revenue: number;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  totalCommissions: number;
  transactionCount: number;
  avgTransaction: number;
  percentOfTotal: number;
}

interface SalesSummary {
  totalCommissions: number;
  transactionCount: number;
  avgTransactionValue: number;
  uniqueReps: number;
}

interface InventorySummary {
  totalItems: number;
  lowStockCount: number;
  totalValue?: number;
  totalCost?: number;
}

interface InventoryItem {
  sku?: string;
  name?: string;
  productName?: string;
  category?: string;
  quantity?: number;
  currentQty?: number;
  unit?: string;
  unitPrice?: number;
  minStockLevel?: number;
}

interface CategoryBreakdown {
  category: string;
  label: string;
  itemCount: number;
  totalRetail: number;
  lowStockCount: number;
}

interface PipelineStats {
  total: number;
  active: number;
  completed: number;
  cancelled: number;
  byStage: Record<string, number>;
  byPriority: Record<string, number>;
  totalValue: number;
  avgOrderValue: number;
}

interface PipelineOrderRow {
  orderId: string;
  currentStage: string;
  priority: string;
  createdAt: string;
  jobNumber: string;
  jobName: string;
  customerName: string;
  deliveryCity: string;
  deliveryState: string;
  assignedDriverName?: string;
  totalPrice: number;
  paymentStatus: string;
  cancelled: boolean;
}

// Stage label map (matches lib/material-order-pipeline.ts STAGE_CONFIG)
const STAGE_LABELS: Record<string, string> = {
  ORDER_CREATED: 'Order Created',
  ORDER_REVIEWED: 'Order Reviewed',
  DRIVER_ASSIGNED: 'Driver Assigned',
  WAREHOUSE_NOTIFIED: 'Warehouse Notified',
  MATERIALS_PULLED: 'Materials Pulled',
  LOAD_VERIFIED: 'Load Verified',
  DEPARTURE_CONFIRMED: 'Departure Confirmed',
  EN_ROUTE: 'En Route',
  ARRIVED_AT_SITE: 'Arrived at Site',
  UNLOADING: 'Unloading',
  DELIVERY_CONFIRMED: 'Delivery Confirmed',
  SIGNATURE_CAPTURED: 'Signature Captured',
  QC_PHOTOS: 'QC Photos',
  OFFICE_NOTIFIED: 'Office Notified',
  BILLING_REVIEW: 'Billing Review',
  INVOICE_SENT: 'Invoice Sent',
  PAYMENT_RECEIVED: 'Payment Received',
  JOB_CLOSED: 'Job Closed',
};

// Stages considered "in transit" for delivery report
const DELIVERY_IN_TRANSIT_STAGES = [
  'DEPARTURE_CONFIRMED', 'EN_ROUTE', 'ARRIVED_AT_SITE', 'UNLOADING',
];
const DELIVERY_COMPLETE_STAGES = [
  'DELIVERY_CONFIRMED', 'SIGNATURE_CAPTURED', 'QC_PHOTOS',
  'OFFICE_NOTIFIED', 'BILLING_REVIEW', 'INVOICE_SENT', 'PAYMENT_RECEIVED', 'JOB_CLOSED',
];

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ---------------------------------------------------------------------------
// "No Data" placeholder
// ---------------------------------------------------------------------------

function NoDataPlaceholder({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
        <BarChart3 className="text-neutral-500" size={32} />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-neutral-400 max-w-md">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>('billing');
  const [isLoading, setIsLoading] = useState(true);

  // Billing data
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [revenueByPeriod, setRevenueByPeriod] = useState<RevenueByPeriod[]>([]);

  // Team data
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Inventory data
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  // Pipeline data (delivery + job flow share the same source)
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<PipelineOrderRow[]>([]);

  const reportTypes = [
    { id: 'billing', label: 'Billing', icon: DollarSign, color: 'bg-green-500' },
    { id: 'team', label: 'Team', icon: Users, color: 'bg-purple-500' },
    { id: 'inventory', label: 'Inventory', icon: Package, color: 'bg-orange-500' },
    { id: 'delivery', label: 'Deliveries', icon: Truck, color: 'bg-brand-green' },
    { id: 'jobflow', label: 'Job Flow', icon: ArrowRight, color: 'bg-cyan-500' },
  ];

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    try {
      if (activeReport === 'billing') {
        const [summaryRes, periodRes] = await Promise.all([
          fetch('/api/command-center/financial?action=summary'),
          fetch('/api/command-center/financial?action=revenue-by-period&groupBy=month&periods=6'),
        ]);
        if (summaryRes.ok) {
          const data = await summaryRes.json();
          if (data.success) setFinancialSummary(data.data);
        }
        if (periodRes.ok) {
          const data = await periodRes.json();
          if (data.success) setRevenueByPeriod(data.data || []);
        }
      } else if (activeReport === 'team') {
        const res = await fetch('/api/command-center/sales?period=all');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            setSalesSummary(data.data.summary || null);
            setLeaderboard(data.data.leaderboard || []);
          }
        }
      } else if (activeReport === 'inventory') {
        const [listRes, catRes] = await Promise.all([
          fetch('/api/portal/inventory?action=list'),
          fetch('/api/portal/inventory?action=categories'),
        ]);
        if (listRes.ok) {
          const data = await listRes.json();
          setInventoryItems(data.items || []);
          setInventorySummary({
            totalItems: data.itemCount || (data.items || []).length,
            lowStockCount: 0,
            totalValue: data.totalRetail || 0,
            totalCost: data.totalCost || 0,
          });
        }
        if (catRes.ok) {
          const data = await catRes.json();
          if (Array.isArray(data)) {
            setCategoryBreakdown(data);
            // Update low stock count from category breakdown
            const totalLow = data.reduce((sum: number, c: CategoryBreakdown) => sum + (c.lowStockCount || 0), 0);
            setInventorySummary(prev => prev ? { ...prev, lowStockCount: totalLow } : prev);
          }
        }
      } else if (activeReport === 'delivery' || activeReport === 'jobflow') {
        // Both tabs read from the unified 18-stage pipeline.
        // ?action=stats gives totals + byStage + byPriority + value totals.
        // ?action=list&limit=20 gives recent orders for the activity table.
        const [statsRes, listRes] = await Promise.all([
          fetch('/api/portal/pipeline?action=stats'),
          fetch('/api/portal/pipeline?action=list&limit=20'),
        ]);
        if (statsRes.ok) {
          const stats = await statsRes.json();
          if (stats && typeof stats.total === 'number') setPipelineStats(stats);
        }
        if (listRes.ok) {
          const list = await listRes.json();
          if (Array.isArray(list)) setRecentOrders(list);
        }
      }
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeReport]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background */}
      <div className="fixed inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href="/portal"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={18} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <BarChart3 className="text-brand-green" size={22} />
                    Reports & Analytics
                  </h1>
                  <p className="text-sm text-neutral-400">Real business data from commissions, inventory, and sales</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={loadReport}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 text-sm"
                >
                  <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Report Type Tabs */}
        <div className="border-b border-white/5 bg-black/20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex gap-1 overflow-x-auto">
              {reportTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => setActiveReport(type.id as ReportType)}
                    className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors whitespace-nowrap border-b-2 ${
                      activeReport === type.id
                        ? 'text-brand-green border-brand-green'
                        : 'text-neutral-400 border-transparent hover:text-white'
                    }`}
                  >
                    <Icon size={18} />
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <main className="max-w-7xl mx-auto px-6 py-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-green/20 to-emerald-500/20 border border-brand-green/30 flex items-center justify-center">
                    <Loader2 className="text-brand-green animate-spin" size={32} />
                  </div>
                </div>
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-white">Loading Report</h2>
                  <p className="text-sm text-zinc-400 mt-1">Fetching real data...</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* ============================================================ */}
              {/* BILLING REPORT - Real data from financial API + commissions  */}
              {/* ============================================================ */}
              {activeReport === 'billing' && (
                <div className="space-y-6">
                  {financialSummary ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <p className="text-neutral-400 text-sm mb-1">YTD Revenue</p>
                          <p className="text-3xl font-bold text-white">{formatCurrency(financialSummary.revenueYTD)}</p>
                          <p className="text-xs text-neutral-500 mt-1">Estimated from commissions</p>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <p className="text-neutral-400 text-sm mb-1">This Month</p>
                          <p className="text-3xl font-bold text-green-400">{formatCurrency(financialSummary.revenueThisMonth)}</p>
                          {financialSummary.monthOverMonthGrowth !== 0 && (
                            <p className={`text-xs mt-1 flex items-center gap-1 ${
                              financialSummary.monthOverMonthGrowth >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {financialSummary.monthOverMonthGrowth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                              {financialSummary.monthOverMonthGrowth >= 0 ? '+' : ''}{financialSummary.monthOverMonthGrowth.toFixed(1)}% vs last month
                            </p>
                          )}
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <p className="text-neutral-400 text-sm mb-1">Accounts Receivable</p>
                          <p className="text-3xl font-bold text-yellow-400">{formatCurrency(financialSummary.accountsReceivable)}</p>
                          <p className="text-xs text-neutral-500 mt-1">{financialSummary.outstandingInvoices} outstanding</p>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <p className="text-neutral-400 text-sm mb-1">Overdue</p>
                          <p className={`text-3xl font-bold ${financialSummary.overdueAmount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {formatCurrency(financialSummary.overdueAmount)}
                          </p>
                          <p className="text-xs text-neutral-500 mt-1">{financialSummary.overdueInvoices} invoices</p>
                        </div>
                      </div>

                      {/* Gross Margin */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <p className="text-neutral-400 text-sm mb-1">Gross Margin</p>
                          <p className={`text-3xl font-bold ${financialSummary.grossMargin >= 25 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {financialSummary.grossMargin.toFixed(1)}%
                          </p>
                          <p className="text-xs text-neutral-500 mt-1">{financialSummary.grossMargin >= 25 ? 'Healthy margin' : 'Below 25% target'}</p>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <p className="text-neutral-400 text-sm mb-1">Last Month Revenue</p>
                          <p className="text-3xl font-bold text-white">{formatCurrency(financialSummary.revenueLastMonth)}</p>
                          <p className="text-xs text-neutral-500 mt-1">Previous period comparison</p>
                        </div>
                      </div>

                      {/* Revenue Trend */}
                      {revenueByPeriod.length > 0 && (
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                          <h3 className="text-lg font-semibold text-white mb-4">Monthly Revenue Trend</h3>
                          <div className="h-64 flex items-end gap-4">
                            {revenueByPeriod.map((period) => {
                              const maxRevenue = Math.max(...revenueByPeriod.map(p => p.revenue));
                              const height = maxRevenue > 0 ? (period.revenue / maxRevenue) * 100 : 0;
                              return (
                                <div key={period.period} className="flex-1 flex flex-col items-center gap-2 group relative">
                                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                    {formatCurrency(period.revenue)}
                                  </div>
                                  <div
                                    className="w-full bg-brand-green/80 rounded-t-lg transition-all group-hover:bg-brand-green"
                                    style={{ height: `${Math.max(height, period.revenue > 0 ? 2 : 0)}%` }}
                                  />
                                  <span className="text-neutral-400 text-xs truncate w-full text-center">
                                    {period.periodLabel.split(' ')[0]}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <NoDataPlaceholder
                      title="No Financial Data Available"
                      message="Unable to load financial data. This report requires commission data to be present."
                    />
                  )}
                </div>
              )}

              {/* ============================================================ */}
              {/* TEAM REPORT - Real data from sales/commissions API           */}
              {/* ============================================================ */}
              {activeReport === 'team' && (
                <div className="space-y-6">
                  {salesSummary ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <p className="text-neutral-400 text-sm mb-1">Total Commission Payouts</p>
                          <p className="text-3xl font-bold text-brand-green">{formatCurrency(salesSummary.totalCommissions)}</p>
                          <p className="text-xs text-neutral-500 mt-1">From 1099 records</p>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <p className="text-neutral-400 text-sm mb-1">Total Transactions</p>
                          <p className="text-3xl font-bold text-white">{salesSummary.transactionCount.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <p className="text-neutral-400 text-sm mb-1">Avg Transaction</p>
                          <p className="text-3xl font-bold text-white">{formatCurrency(salesSummary.avgTransactionValue)}</p>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <p className="text-neutral-400 text-sm mb-1">Active Reps</p>
                          <p className="text-3xl font-bold text-white">{salesSummary.uniqueReps}</p>
                        </div>
                      </div>

                      {/* Commission Leaderboard */}
                      {leaderboard.length > 0 && (
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                          <h3 className="text-lg font-semibold text-white mb-4">Commission Leaderboard (All Time)</h3>
                          <div className="space-y-3">
                            {leaderboard.map((rep) => (
                              <div key={rep.name} className="bg-neutral-800/50 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                      rep.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                                      rep.rank === 2 ? 'bg-gray-400/20 text-neutral-400' :
                                      rep.rank === 3 ? 'bg-orange-500/20 text-orange-400' :
                                      'bg-zinc-700 text-neutral-400'
                                    }`}>
                                      #{rep.rank}
                                    </div>
                                    <div>
                                      <p className="text-white font-medium">{rep.name}</p>
                                      <p className="text-neutral-400 text-xs">{rep.transactionCount} transactions</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-brand-green font-bold">{formatCurrency(rep.totalCommissions)}</p>
                                    <p className="text-neutral-400 text-xs">Avg: {formatCurrency(rep.avgTransaction)}</p>
                                  </div>
                                </div>
                                <div className="w-full bg-neutral-700 rounded-full h-2">
                                  <div
                                    className="bg-brand-green h-2 rounded-full"
                                    style={{ width: `${Math.min(rep.percentOfTotal, 100)}%` }}
                                  />
                                </div>
                                <p className="text-neutral-400 text-xs mt-1">
                                  {rep.percentOfTotal.toFixed(1)}% of total commissions
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <NoDataPlaceholder
                      title="No Team Data Available"
                      message="Unable to load sales team data. Commission records are required."
                    />
                  )}
                </div>
              )}

              {/* ============================================================ */}
              {/* INVENTORY REPORT - Real data from inventory API              */}
              {/* ============================================================ */}
              {activeReport === 'inventory' && (
                <div className="space-y-6">
                  {inventorySummary ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <p className="text-neutral-400 text-sm mb-1">Total Products</p>
                          <p className="text-3xl font-bold text-white">{inventorySummary.totalItems}</p>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <p className="text-neutral-400 text-sm mb-1">Total Value</p>
                          <p className="text-3xl font-bold text-white">
                            {inventorySummary.totalValue ? formatCurrency(inventorySummary.totalValue) : '--'}
                          </p>
                          <p className="text-xs text-neutral-500 mt-1">Retail value</p>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <p className="text-neutral-400 text-sm mb-1">Low Stock</p>
                          <p className={`text-3xl font-bold ${inventorySummary.lowStockCount > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                            {inventorySummary.lowStockCount}
                          </p>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <p className="text-neutral-400 text-sm mb-1">Out of Stock</p>
                          <p className={`text-3xl font-bold ${
                            inventoryItems.filter(i => (i.currentQty ?? i.quantity ?? 0) === 0).length > 0 ? 'text-red-400' : 'text-green-400'
                          }`}>
                            {inventoryItems.filter(i => (i.currentQty ?? i.quantity ?? 0) === 0).length}
                          </p>
                        </div>
                      </div>

                      <div className="grid lg:grid-cols-2 gap-6">
                        {/* Categories from real data */}
                        {categoryBreakdown.length > 0 && (
                          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">By Category</h3>
                            <div className="space-y-3">
                              {categoryBreakdown.map((cat) => (
                                <div key={cat.category} className="flex items-center justify-between py-2 border-b border-white/5">
                                  <div>
                                    <p className="text-white">{cat.label || cat.category}</p>
                                    <p className="text-neutral-400 text-sm">{cat.itemCount} products</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-white font-medium">{formatCurrency(cat.totalRetail)}</p>
                                    {cat.lowStockCount > 0 && (
                                      <p className="text-yellow-400 text-xs">{cat.lowStockCount} low stock</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Top items by quantity */}
                        {inventoryItems.length > 0 && (
                          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Top Items by Stock</h3>
                            <div className="space-y-3">
                              {inventoryItems
                                .sort((a, b) => (b.currentQty ?? b.quantity ?? 0) - (a.currentQty ?? a.quantity ?? 0))
                                .slice(0, 8)
                                .map((item, i) => {
                                  const qty = item.currentQty ?? item.quantity ?? 0;
                                  const name = item.productName || item.name || item.sku || 'Unknown';
                                  return (
                                    <div key={item.sku || i} className="flex items-center gap-3 py-2 border-b border-white/5">
                                      <span className="text-brand-green font-bold text-sm">#{i + 1}</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-white truncate">{name}</p>
                                        <p className="text-neutral-400 text-xs">{item.category || 'Uncategorized'}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-white font-medium">{qty} {item.unit || 'units'}</p>
                                        {item.unitPrice ? (
                                          <p className="text-neutral-400 text-xs">{formatCurrency(item.unitPrice)} each</p>
                                        ) : null}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <NoDataPlaceholder
                      title="No Inventory Data Available"
                      message="Inventory data could not be loaded. Ensure the inventory system is configured."
                    />
                  )}
                </div>
              )}

              {/* ============================================================ */}
              {/* DELIVERY REPORT - Real data from 18-stage pipeline           */}
              {/* ============================================================ */}
              {activeReport === 'delivery' && (
                <div className="space-y-6">
                  {pipelineStats ? (
                    <>
                      {/* Top metric cards */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <p className="text-neutral-400 text-sm mb-1">In Transit</p>
                          <p className="text-3xl font-bold text-cyan-400">
                            {DELIVERY_IN_TRANSIT_STAGES.reduce((sum, s) => sum + (pipelineStats.byStage[s] || 0), 0)}
                          </p>
                          <p className="text-xs text-neutral-500 mt-1">Live deliveries on the road</p>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <p className="text-neutral-400 text-sm mb-1">Completed</p>
                          <p className="text-3xl font-bold text-green-400">
                            {DELIVERY_COMPLETE_STAGES.reduce((sum, s) => sum + (pipelineStats.byStage[s] || 0), 0)}
                          </p>
                          <p className="text-xs text-neutral-500 mt-1">Past delivery confirmation</p>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <p className="text-neutral-400 text-sm mb-1">Pipeline Value</p>
                          <p className="text-3xl font-bold text-white">{formatCurrency(pipelineStats.totalValue)}</p>
                          <p className="text-xs text-neutral-500 mt-1">Avg {formatCurrency(pipelineStats.avgOrderValue)}/order</p>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <p className="text-neutral-400 text-sm mb-1">Cancelled</p>
                          <p className="text-3xl font-bold text-red-400">{pipelineStats.cancelled}</p>
                          <p className="text-xs text-neutral-500 mt-1">Out of {pipelineStats.total} total</p>
                        </div>
                      </div>

                      {/* Priority breakdown */}
                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Active Orders by Priority</h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-neutral-400">Normal</p>
                            <p className="text-2xl font-bold text-white">{pipelineStats.byPriority.normal || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-yellow-400">Rush</p>
                            <p className="text-2xl font-bold text-yellow-400">{pipelineStats.byPriority.rush || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-red-400">Urgent</p>
                            <p className="text-2xl font-bold text-red-400">{pipelineStats.byPriority.urgent || 0}</p>
                          </div>
                        </div>
                      </div>

                      {/* Recent deliveries table */}
                      <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/5">
                          <h3 className="text-lg font-semibold text-white">Recent Orders</h3>
                          <p className="text-xs text-neutral-400">Last {recentOrders.length} from the pipeline</p>
                        </div>
                        {recentOrders.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-white/[0.02] text-neutral-400">
                                <tr>
                                  <th className="text-left px-4 py-2 font-medium">Order</th>
                                  <th className="text-left px-4 py-2 font-medium">Job</th>
                                  <th className="text-left px-4 py-2 font-medium">Customer</th>
                                  <th className="text-left px-4 py-2 font-medium">Stage</th>
                                  <th className="text-left px-4 py-2 font-medium">Driver</th>
                                  <th className="text-right px-4 py-2 font-medium">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {recentOrders.map((o) => (
                                  <tr key={o.orderId} className="border-t border-white/5">
                                    <td className="px-4 py-2 font-mono text-xs text-neutral-300">{o.orderId}</td>
                                    <td className="px-4 py-2 text-white">{o.jobName || o.jobNumber}</td>
                                    <td className="px-4 py-2 text-neutral-300">{o.customerName}</td>
                                    <td className="px-4 py-2 text-cyan-400 text-xs">{STAGE_LABELS[o.currentStage] || o.currentStage}</td>
                                    <td className="px-4 py-2 text-neutral-400 text-xs">{o.assignedDriverName || '—'}</td>
                                    <td className="px-4 py-2 text-right text-white">{formatCurrency(o.totalPrice || 0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="px-6 py-8 text-center text-neutral-500 text-sm">
                            No orders in the pipeline yet.
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <NoDataPlaceholder
                      title="Pipeline Not Reachable"
                      message="Could not load /api/portal/pipeline. Verify Google Sheets credentials and the PipelineOrders tab exists."
                    />
                  )}
                </div>
              )}

              {/* ============================================================ */}
              {/* JOB FLOW REPORT - Stage breakdown from same pipeline source  */}
              {/* ============================================================ */}
              {activeReport === 'jobflow' && (
                <div className="space-y-6">
                  {pipelineStats ? (
                    <>
                      {/* Top metric cards */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <p className="text-neutral-400 text-sm mb-1">Total Orders</p>
                          <p className="text-3xl font-bold text-white">{pipelineStats.total}</p>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <p className="text-neutral-400 text-sm mb-1">Active</p>
                          <p className="text-3xl font-bold text-cyan-400">{pipelineStats.active}</p>
                          <p className="text-xs text-neutral-500 mt-1">In flight (not yet closed)</p>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <p className="text-neutral-400 text-sm mb-1">Completed</p>
                          <p className="text-3xl font-bold text-green-400">{pipelineStats.completed}</p>
                          <p className="text-xs text-neutral-500 mt-1">Reached JOB_CLOSED</p>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <p className="text-neutral-400 text-sm mb-1">Completion Rate</p>
                          <p className="text-3xl font-bold text-white">
                            {pipelineStats.total > 0
                              ? Math.round((pipelineStats.completed / pipelineStats.total) * 100)
                              : 0}%
                          </p>
                        </div>
                      </div>

                      {/* Stage funnel */}
                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">18-Stage Pipeline Distribution</h3>
                        <p className="text-xs text-neutral-500 mb-4">
                          How many orders are sitting at each stage right now. Bars highlight bottlenecks.
                        </p>
                        <div className="space-y-2">
                          {Object.entries(STAGE_LABELS).map(([stageKey, label], idx) => {
                            const count = pipelineStats.byStage[stageKey] || 0;
                            const max = Math.max(...Object.values(pipelineStats.byStage), 1);
                            const pct = (count / max) * 100;
                            return (
                              <div key={stageKey} className="flex items-center gap-3">
                                <div className="w-8 text-xs text-neutral-500 text-right">{idx + 1}</div>
                                <div className="w-44 text-xs text-neutral-400 truncate">{label}</div>
                                <div className="flex-1 h-6 bg-white/[0.02] rounded overflow-hidden relative">
                                  <div
                                    className={`h-full ${
                                      count === 0
                                        ? 'bg-transparent'
                                        : pct > 60
                                        ? 'bg-yellow-500/40'
                                        : 'bg-cyan-500/40'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                  <div className="absolute inset-0 flex items-center px-2 text-xs text-white">
                                    {count}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <NoDataPlaceholder
                      title="Pipeline Not Reachable"
                      message="Could not load /api/portal/pipeline. Verify Google Sheets credentials and the PipelineOrders tab exists."
                    />
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
