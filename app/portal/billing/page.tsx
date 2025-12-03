'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, DollarSign, AlertTriangle, FileText, Package, Truck,
  CheckCircle2, Clock, RefreshCw, Loader2, Search, Filter, Bell,
  ShoppingCart, Building, AlertCircle, TrendingUp, TrendingDown,
  Eye, Printer, Download, ChevronRight, Calendar, Store, Receipt,
  Shield, XCircle, Check, Flag, BarChart3
} from 'lucide-react';
import type { BillingRecord, BillingAlert, VendorPurchase } from '@/lib/billing-workflow-service';

type TabType = 'dashboard' | 'records' | 'purchases' | 'alerts' | 'reconciliation';

const vendorNames: Record<string, string> = {
  in_house: 'In-House Inventory',
  lowes: 'Lowes',
  advanced_roofing: 'Advanced Roofing',
  gulf_eagle: 'Gulf Eagle',
  abc_supply: 'ABC Supply',
  beacon: 'Beacon',
  other: 'Other Vendor'
};

const statusColors: Record<string, string> = {
  pending_review: 'bg-yellow-500',
  approved: 'bg-blue-500',
  materials_out: 'bg-purple-500',
  delivered: 'bg-cyan-500',
  pending_billing: 'bg-orange-500',
  billed: 'bg-green-500',
  paid: 'bg-emerald-500',
  credit_pending: 'bg-amber-500',
  credited: 'bg-teal-500',
  disputed: 'bg-red-500',
  write_off: 'bg-gray-500',
  flagged: 'bg-red-600'
};

const alertSeverityColors: Record<string, string> = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-blue-500 text-white'
};

export default function BillingPortalPage() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Data states
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [vendorPurchases, setVendorPurchases] = useState<VendorPurchase[]>([]);
  const [alerts, setAlerts] = useState<BillingAlert[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [dashboardRes, recordsRes, purchasesRes, alertsRes, notificationsRes] = await Promise.all([
        fetch('/api/portal/billing?action=dashboard'),
        fetch('/api/portal/billing?action=records'),
        fetch('/api/portal/billing?action=purchases'),
        fetch('/api/portal/billing?action=alerts&unresolved=true'),
        fetch('/api/portal/billing?action=notifications')
      ]);

      const [dashboardData, recordsData, purchasesData, alertsData, notificationsData] = await Promise.all([
        dashboardRes.json(),
        recordsRes.json(),
        purchasesRes.json(),
        alertsRes.json(),
        notificationsRes.json()
      ]);

      setDashboardStats(dashboardData);
      setBillingRecords(recordsData.records || []);
      setVendorPurchases(purchasesData.purchases || []);
      setAlerts(alertsData.alerts || []);
      setNotifications(notificationsData.notifications || []);
    } catch (error) {
      console.error('Error loading billing data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePDF = async (type: string, data: any) => {
    try {
      const response = await fetch('/api/portal/billing/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data })
      });

      const html = await response.text();

      // Open in new window for printing
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    }
  };

  const handleUpdateStatus = async (billingId: string, newStatus: string, reason?: string) => {
    try {
      await fetch('/api/portal/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-billing-status',
          billingId,
          newStatus,
          updatedBy: 'Office Portal',
          updatedByName: 'Office Staff',
          reason
        })
      });
      loadAllData();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleResolveAlert = async (alertId: string, resolution: string) => {
    try {
      await fetch('/api/portal/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve-alert',
          alertId,
          resolvedBy: 'Office Portal',
          resolution
        })
      });
      loadAllData();
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  const handleRunDailyCheck = async () => {
    try {
      const response = await fetch('/api/portal/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run-daily-check' })
      });
      const result = await response.json();
      alert(`Daily check complete:\n- ${result.alertsCreated} alerts created\n- ${result.overdueItems} overdue items found`);
      loadAllData();
    } catch (error) {
      console.error('Error running daily check:', error);
    }
  };

  const filteredRecords = billingRecords.filter(record => {
    const matchesSearch = !searchTerm ||
      record.jobName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.billingId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || record.billingStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto text-brand-green" size={48} />
          <p className="text-neutral-400 mt-4">Loading billing portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900">
      {/* Header */}
      <div className="bg-neutral-800 border-b border-neutral-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal" className="text-neutral-400 hover:text-white">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Billing & Accounting</h1>
              <p className="text-sm text-neutral-400">Loss Prevention & Invoice Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {alerts.length > 0 && (
              <button
                onClick={() => setActiveTab('alerts')}
                className="relative p-2 bg-red-500/20 rounded-lg hover:bg-red-500/30"
              >
                <Bell size={20} className="text-red-400" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                  {alerts.length}
                </span>
              </button>
            )}
            <button
              onClick={loadAllData}
              className="p-2 bg-neutral-700 rounded-lg hover:bg-neutral-600"
            >
              <RefreshCw size={20} className="text-neutral-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-neutral-800 border-b border-neutral-700">
        <div className="max-w-7xl mx-auto flex overflow-x-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'records', label: 'Billing Records', icon: Receipt },
            { id: 'purchases', label: 'Vendor Purchases', icon: Store },
            { id: 'alerts', label: 'Alerts', icon: AlertTriangle, count: alerts.length },
            { id: 'reconciliation', label: 'Reports', icon: FileText },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-brand-green border-b-2 border-brand-green'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
              {tab.count && tab.count > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && dashboardStats && (
          <div className="space-y-6">
            {/* Critical Alerts Banner */}
            {dashboardStats.activeAlerts?.critical > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-4">
                <AlertTriangle className="text-red-500" size={24} />
                <div className="flex-1">
                  <p className="text-red-400 font-semibold">
                    {dashboardStats.activeAlerts.critical} Critical Alert{dashboardStats.activeAlerts.critical > 1 ? 's' : ''} Require Immediate Attention
                  </p>
                  <p className="text-red-400/70 text-sm">Unbilled deliveries, overdue payments, or loss reports</p>
                </div>
                <button
                  onClick={() => setActiveTab('alerts')}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  View Alerts
                </button>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-neutral-800 border border-red-500/30 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                    <AlertCircle className="text-red-400" size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-400">{dashboardStats.overdueItems?.count || 0}</p>
                    <p className="text-sm text-neutral-400">Overdue Billing</p>
                  </div>
                </div>
                <p className="text-red-400/70 text-sm">
                  ${(dashboardStats.overdueItems?.amount || 0).toLocaleString()} unbilled
                </p>
              </div>

              <div className="bg-neutral-800 border border-yellow-500/30 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                    <Clock className="text-yellow-400" size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-400">{dashboardStats.unbilledDeliveries?.count || 0}</p>
                    <p className="text-sm text-neutral-400">Pending Billing</p>
                  </div>
                </div>
                <p className="text-yellow-400/70 text-sm">
                  ${(dashboardStats.unbilledDeliveries?.amount || 0).toLocaleString()} to bill
                </p>
              </div>

              <div className="bg-neutral-800 border border-orange-500/30 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <Shield className="text-orange-400" size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-orange-400">{dashboardStats.pendingApprovals?.count || 0}</p>
                    <p className="text-sm text-neutral-400">Need Approval</p>
                  </div>
                </div>
                <p className="text-orange-400/70 text-sm">
                  ${(dashboardStats.pendingApprovals?.amount || 0).toLocaleString()} pending
                </p>
              </div>

              <div className="bg-neutral-800 border border-purple-500/30 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Store className="text-purple-400" size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-400">{dashboardStats.vendorPaymentsDue?.count || 0}</p>
                    <p className="text-sm text-neutral-400">Vendor Due</p>
                  </div>
                </div>
                <p className="text-purple-400/70 text-sm">
                  ${(dashboardStats.vendorPaymentsDue?.amount || 0).toLocaleString()} to pay
                </p>
              </div>
            </div>

            {/* Weekly Summary */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Weekly Billed</h3>
                  <TrendingUp className="text-green-400" size={24} />
                </div>
                <p className="text-3xl font-bold text-green-400">
                  ${(dashboardStats.weeklyTotals?.billed || 0).toLocaleString()}
                </p>
              </div>

              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Weekly Cost</h3>
                  <TrendingDown className="text-red-400" size={24} />
                </div>
                <p className="text-3xl font-bold text-red-400">
                  ${(dashboardStats.weeklyTotals?.cost || 0).toLocaleString()}
                </p>
              </div>

              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Weekly Profit</h3>
                  <DollarSign className="text-brand-green" size={24} />
                </div>
                <p className="text-3xl font-bold text-brand-green">
                  ${(dashboardStats.weeklyTotals?.profit || 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Today's Activity */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Today's Activity</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-neutral-700/50 rounded-lg">
                  <Truck className="mx-auto text-blue-400 mb-2" size={24} />
                  <p className="text-2xl font-bold text-white">{dashboardStats.todayActivity?.deliveries || 0}</p>
                  <p className="text-sm text-neutral-400">Deliveries</p>
                </div>
                <div className="text-center p-4 bg-neutral-700/50 rounded-lg">
                  <Package className="mx-auto text-orange-400 mb-2" size={24} />
                  <p className="text-2xl font-bold text-white">{dashboardStats.todayActivity?.returns || 0}</p>
                  <p className="text-sm text-neutral-400">Returns</p>
                </div>
                <div className="text-center p-4 bg-neutral-700/50 rounded-lg">
                  <ShoppingCart className="mx-auto text-purple-400 mb-2" size={24} />
                  <p className="text-2xl font-bold text-white">{dashboardStats.todayActivity?.purchases || 0}</p>
                  <p className="text-sm text-neutral-400">Purchases</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={handleRunDailyCheck}
                  className="p-4 bg-neutral-700 rounded-lg hover:bg-neutral-600 text-left"
                >
                  <Shield className="text-brand-green mb-2" size={24} />
                  <p className="text-white font-medium">Run Daily Check</p>
                  <p className="text-neutral-500 text-sm">Find overdue items</p>
                </button>
                <button
                  onClick={() => setActiveTab('records')}
                  className="p-4 bg-neutral-700 rounded-lg hover:bg-neutral-600 text-left"
                >
                  <Receipt className="text-blue-400 mb-2" size={24} />
                  <p className="text-white font-medium">View Unbilled</p>
                  <p className="text-neutral-500 text-sm">Ready to invoice</p>
                </button>
                <button
                  onClick={() => setActiveTab('purchases')}
                  className="p-4 bg-neutral-700 rounded-lg hover:bg-neutral-600 text-left"
                >
                  <Store className="text-purple-400 mb-2" size={24} />
                  <p className="text-white font-medium">Vendor Purchases</p>
                  <p className="text-neutral-500 text-sm">Track expenses</p>
                </button>
                <button
                  onClick={() => setActiveTab('reconciliation')}
                  className="p-4 bg-neutral-700 rounded-lg hover:bg-neutral-600 text-left"
                >
                  <FileText className="text-cyan-400 mb-2" size={24} />
                  <p className="text-white font-medium">Run Reconciliation</p>
                  <p className="text-neutral-500 text-sm">Generate report</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Billing Records Tab */}
        {activeTab === 'records' && (
          <div className="space-y-4">
            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                <input
                  type="text"
                  placeholder="Search records..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-10 pr-4 py-2 text-white"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-white"
              >
                <option value="">All Statuses</option>
                <option value="pending_review">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="materials_out">Materials Out</option>
                <option value="delivered">Delivered</option>
                <option value="pending_billing">Pending Billing</option>
                <option value="billed">Billed</option>
                <option value="paid">Paid</option>
                <option value="flagged">Flagged</option>
              </select>
            </div>

            {/* Records Table */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Record</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Job</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Cost</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Charge</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-700">
                    {filteredRecords.map(record => (
                      <tr key={record.billingId} className="hover:bg-neutral-700/50">
                        <td className="px-4 py-3">
                          <p className="text-white font-medium text-sm">{record.billingId}</p>
                          <p className="text-neutral-500 text-xs">{new Date(record.createdAt).toLocaleDateString()}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white">{record.jobName}</p>
                          <p className="text-neutral-500 text-xs">{record.jobAddress}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            record.transactionType === 'material_delivery' ? 'bg-blue-500/20 text-blue-400' :
                            record.transactionType === 'material_return' ? 'bg-orange-500/20 text-orange-400' :
                            'bg-purple-500/20 text-purple-400'
                          }`}>
                            {record.transactionType.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${statusColors[record.billingStatus]}`}>
                            {record.billingStatus.replace('_', ' ')}
                          </span>
                          {record.requiresApproval && record.billingStatus === 'pending_review' && (
                            <Flag className="inline ml-1 text-orange-400" size={12} />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-red-400 font-medium">${record.totalOurCost.toFixed(2)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-green-400 font-medium">${record.totalChargeAmount.toFixed(2)}</p>
                          <p className="text-neutral-500 text-xs">{record.markup.toFixed(0)}% markup</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleGeneratePDF('invoice', {
                                invoiceNumber: `INV-${record.billingId}`,
                                customerName: record.jobName,
                                jobId: record.jobId,
                                jobName: record.jobName,
                                jobAddress: record.jobAddress,
                                customerAddress: record.jobAddress,
                                customerPhone: '',
                                projectManager: record.createdByName,
                                items: record.materials,
                                subtotal: record.totalChargeAmount,
                                deliveryFee: 75,
                                handlingFee: 25,
                                tax: 0,
                                total: record.totalChargeAmount + 100
                              })}
                              className="p-1.5 bg-brand-green/20 text-brand-green rounded hover:bg-brand-green/30"
                              title="Generate Invoice"
                            >
                              <Printer size={14} />
                            </button>
                            {record.billingStatus === 'pending_review' && (
                              <button
                                onClick={() => handleUpdateStatus(record.billingId, 'approved', 'Approved by office')}
                                className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
                                title="Approve"
                              >
                                <Check size={14} />
                              </button>
                            )}
                            {record.billingStatus === 'delivered' && (
                              <button
                                onClick={() => handleUpdateStatus(record.billingId, 'pending_billing', 'Ready for billing')}
                                className="p-1.5 bg-orange-500/20 text-orange-400 rounded hover:bg-orange-500/30"
                                title="Mark for Billing"
                              >
                                <DollarSign size={14} />
                              </button>
                            )}
                            {record.billingStatus === 'pending_billing' && (
                              <button
                                onClick={() => handleUpdateStatus(record.billingId, 'billed', 'Invoice sent')}
                                className="p-1.5 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30"
                                title="Mark Billed"
                              >
                                <CheckCircle2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Vendor Purchases Tab */}
        {activeTab === 'purchases' && (
          <div className="space-y-4">
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Purchase</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Vendor</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Job</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Payment</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Billed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-700">
                    {vendorPurchases.map(purchase => (
                      <tr key={purchase.purchaseId} className="hover:bg-neutral-700/50">
                        <td className="px-4 py-3">
                          <p className="text-white font-medium">{purchase.invoiceNumber}</p>
                          <p className="text-neutral-500 text-xs">{new Date(purchase.invoiceDate).toLocaleDateString()}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white">{vendorNames[purchase.vendorSource] || purchase.vendorName}</p>
                        </td>
                        <td className="px-4 py-3">
                          {purchase.jobName ? (
                            <p className="text-white">{purchase.jobName}</p>
                          ) : (
                            <span className="text-yellow-400 text-sm">Not assigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white font-bold">${purchase.total.toFixed(2)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            purchase.paymentStatus === 'paid' ? 'bg-green-500/20 text-green-400' :
                            purchase.paymentStatus === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {purchase.paymentStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {purchase.billedToJob ? (
                            <CheckCircle2 className="text-green-400" size={18} />
                          ) : (
                            <XCircle className="text-red-400" size={18} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            {alerts.length === 0 ? (
              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-8 text-center">
                <CheckCircle2 className="mx-auto text-green-400 mb-4" size={48} />
                <p className="text-white text-lg font-semibold">All Clear!</p>
                <p className="text-neutral-400">No active alerts at this time.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map(alert => (
                  <div
                    key={alert.alertId}
                    className={`bg-neutral-800 border rounded-xl p-4 ${
                      alert.severity === 'critical' ? 'border-red-500' :
                      alert.severity === 'high' ? 'border-orange-500' :
                      alert.severity === 'medium' ? 'border-yellow-500' :
                      'border-blue-500'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${alertSeverityColors[alert.severity]}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        <div>
                          <p className="text-white font-semibold">{alert.title}</p>
                          <p className="text-neutral-400 text-sm mt-1">{alert.description}</p>
                          {alert.amount && (
                            <p className="text-brand-green font-bold mt-2">${alert.amount.toLocaleString()}</p>
                          )}
                          <p className="text-neutral-500 text-xs mt-2">
                            Created: {new Date(alert.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const resolution = prompt('Enter resolution notes:');
                          if (resolution) {
                            handleResolveAlert(alert.alertId, resolution);
                          }
                        }}
                        className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 text-sm"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reconciliation Tab */}
        {activeTab === 'reconciliation' && (
          <div className="space-y-6">
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Generate Reports</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <button
                  onClick={async () => {
                    const now = new Date();
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    try {
                      const response = await fetch('/api/portal/billing', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'run-reconciliation',
                          periodStart: weekAgo.toISOString(),
                          periodEnd: now.toISOString(),
                          generatedBy: 'Office Portal'
                        })
                      });
                      const result = await response.json();
                      alert(`Reconciliation Complete:\n` +
                        `- Total Deliveries: ${result.report.totalDeliveries}\n` +
                        `- Unbilled: ${result.report.totalUnbilled} ($${result.report.unbilledAmount.toFixed(2)})\n` +
                        `- Discrepancies Found: ${result.report.discrepancies.length}`);
                    } catch (error) {
                      console.error('Error running reconciliation:', error);
                    }
                  }}
                  className="p-6 bg-neutral-700 rounded-xl hover:bg-neutral-600 text-left"
                >
                  <BarChart3 className="text-blue-400 mb-3" size={32} />
                  <p className="text-white font-semibold text-lg">Weekly Reconciliation</p>
                  <p className="text-neutral-400 text-sm mt-1">Compare deliveries vs billing for the past week</p>
                </button>

                <button
                  onClick={() => handleRunDailyCheck()}
                  className="p-6 bg-neutral-700 rounded-xl hover:bg-neutral-600 text-left"
                >
                  <Shield className="text-green-400 mb-3" size={32} />
                  <p className="text-white font-semibold text-lg">Loss Prevention Check</p>
                  <p className="text-neutral-400 text-sm mt-1">Identify unbilled materials and overdue items</p>
                </button>
              </div>
            </div>

            {/* Loss Prevention Summary */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Loss Prevention Safeguards</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-neutral-700/50 rounded-lg">
                  <CheckCircle2 className="text-green-400" size={24} />
                  <div>
                    <p className="text-white font-medium">Automatic Billing Deadline</p>
                    <p className="text-neutral-400 text-sm">Materials must be billed within 3 days of delivery</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-neutral-700/50 rounded-lg">
                  <CheckCircle2 className="text-green-400" size={24} />
                  <div>
                    <p className="text-white font-medium">Approval Required</p>
                    <p className="text-neutral-400 text-sm">Orders over $5,000 or unusual quantities need manager approval</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-neutral-700/50 rounded-lg">
                  <CheckCircle2 className="text-green-400" size={24} />
                  <div>
                    <p className="text-white font-medium">Markup Validation</p>
                    <p className="text-neutral-400 text-sm">Alerts for markups below 15% or above 100%</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-neutral-700/50 rounded-lg">
                  <CheckCircle2 className="text-green-400" size={24} />
                  <div>
                    <p className="text-white font-medium">Vendor Purchase Tracking</p>
                    <p className="text-neutral-400 text-sm">All vendor purchases must be assigned to jobs and billed</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-neutral-700/50 rounded-lg">
                  <CheckCircle2 className="text-green-400" size={24} />
                  <div>
                    <p className="text-white font-medium">Return Credit Tracking</p>
                    <p className="text-neutral-400 text-sm">Returns are tracked until credit is applied</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
