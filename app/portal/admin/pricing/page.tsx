'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import {
  DollarSign, AlertTriangle, CheckCircle2, Clock, TrendingUp,
  FileText, Upload, Search, Filter, Download, Plus, Eye, Edit,
  AlertCircle, XCircle, RefreshCw, ChevronDown, ChevronRight
} from 'lucide-react';

interface PriceAlert {
  alertId: string;
  alertDate: string;
  productName: string;
  supplier: string;
  invoiceNumber: string;
  invoiceDate: string;
  agreedPrice: number;
  invoicedPrice: number;
  quantity: number;
  totalOvercharge: number;
  status: string;
  assignedTo: string;
}

interface SupplierPricing {
  productId: string;
  productName: string;
  supplier: string;
  sku: string;
  category: string;
  agreedPrice: number;
  listPrice: number;
  discountPercent: number;
  effectiveDate: string;
  expirationDate: string;
}

interface AuditSummary {
  period: string;
  totalInvoices: number;
  totalSpend: number;
  discrepanciesFound: number;
  totalOvercharges: number;
  creditsReceived: number;
  pendingCredits: number;
  topOverchargedProducts: Array<{
    productName: string;
    supplier: string;
    totalOvercharge: number;
    occurrences: number;
  }>;
  supplierSummary: Array<{
    supplier: string;
    invoiceCount: number;
    totalSpend: number;
    discrepancies: number;
    overchargeAmount: number;
  }>;
}

export default function PricingAuditPage() {
  const [activeTab, setActiveTab] = useState<'alerts' | 'pricing' | 'verify' | 'audit'>('alerts');
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [alertSummary, setAlertSummary] = useState<any>(null);
  const [pricing, setPricing] = useState<SupplierPricing[]>([]);
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');

  // Invoice verification state
  const [verifySupplier, setVerifySupplier] = useState('');
  const [verifyInvoiceNum, setVerifyInvoiceNum] = useState('');
  const [verifyLineItems, setVerifyLineItems] = useState<string>('');
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  // New pricing form
  const [showAddPricing, setShowAddPricing] = useState(false);
  const [newPricing, setNewPricing] = useState({
    productName: '',
    supplier: '',
    sku: '',
    category: '',
    agreedPrice: '',
    listPrice: '',
    discountPercent: '',
    effectiveDate: new Date().toISOString().slice(0, 10),
    expirationDate: '',
    contractNumber: '',
    unit: 'each',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'alerts') {
        const res = await fetch('/api/portal/pricing/alerts');
        const data = await res.json();
        setAlerts(data.alerts || []);
        setAlertSummary(data.summary || null);
      } else if (activeTab === 'pricing') {
        const res = await fetch('/api/portal/pricing');
        const data = await res.json();
        setPricing(data || []);
      } else if (activeTab === 'audit') {
        const res = await fetch('/api/portal/pricing/audit');
        const data = await res.json();
        setAuditSummary(data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const updateAlertStatus = async (alertId: string, status: string) => {
    try {
      await fetch('/api/portal/pricing/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, status }),
      });
      loadData();
    } catch (error) {
      console.error('Error updating alert:', error);
    }
  };

  const verifyInvoice = async () => {
    if (!verifySupplier || !verifyLineItems) {
      alert('Please enter supplier and line items');
      return;
    }

    setVerifying(true);
    try {
      // Parse line items (format: SKU, Price, Qty per line)
      const lines = verifyLineItems.split('\n').filter(l => l.trim()).map(line => {
        const parts = line.split(',').map(p => p.trim());
        return {
          sku: parts[0] || '',
          unitPrice: parseFloat(parts[1]) || 0,
          quantity: parseFloat(parts[2]) || 1,
          productName: parts[3] || '',
        };
      });

      const res = await fetch('/api/portal/pricing/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier: verifySupplier,
          lineItems: lines,
          invoiceNumber: verifyInvoiceNum,
          invoiceDate: new Date().toISOString().slice(0, 10),
          createAlerts: true,
        }),
      });

      const data = await res.json();
      setVerificationResult(data);
    } catch (error) {
      console.error('Error verifying invoice:', error);
    }
    setVerifying(false);
  };

  const addPricing = async () => {
    try {
      await fetch('/api/portal/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newPricing,
          agreedPrice: parseFloat(newPricing.agreedPrice) || 0,
          listPrice: parseFloat(newPricing.listPrice) || 0,
          discountPercent: parseFloat(newPricing.discountPercent) || 0,
          lastVerified: new Date().toISOString().slice(0, 10),
          verifiedBy: 'Admin',
        }),
      });
      setShowAddPricing(false);
      setNewPricing({
        productName: '',
        supplier: '',
        sku: '',
        category: '',
        agreedPrice: '',
        listPrice: '',
        discountPercent: '',
        effectiveDate: new Date().toISOString().slice(0, 10),
        expirationDate: '',
        contractNumber: '',
        unit: 'each',
        notes: '',
      });
      loadData();
    } catch (error) {
      console.error('Error adding pricing:', error);
    }
  };

  const setupSheets = async () => {
    try {
      await fetch('/api/portal/pricing/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup' }),
      });
      alert('Pricing sheets created successfully!');
    } catch (error) {
      console.error('Error setting up sheets:', error);
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
    if (supplierFilter !== 'all' && alert.supplier !== supplierFilter) return false;
    return true;
  });

  const uniqueSuppliers = [...new Set(alerts.map(a => a.supplier))];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <AdminLayout
      title="Price Verification & Audit"
      subtitle="Monitor supplier pricing, detect overcharges, and track credits"
      actions={
        <button
          onClick={setupSheets}
          className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-blue/90"
        >
          <RefreshCw className="w-4 h-4" />
          Setup Sheets
        </button>
      }
    >
      <div className="space-y-6">

        {/* Summary Cards */}
        {alertSummary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-red-600 font-medium">Total Overcharges</p>
                  <p className="text-2xl font-bold text-red-700">{formatCurrency(alertSummary.totalOvercharges)}</p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-yellow-600 font-medium">Pending Credits</p>
                  <p className="text-2xl font-bold text-yellow-700">{formatCurrency(alertSummary.pendingCredits)}</p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-green-600 font-medium">Credits Received</p>
                  <p className="text-2xl font-bold text-green-700">{formatCurrency(alertSummary.creditsReceived)}</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-blue-600 font-medium">Open Alerts</p>
                  <p className="text-2xl font-bold text-blue-700">{alertSummary.new + alertSummary.underReview}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-4">
            {[
              { id: 'alerts', label: 'Price Alerts', icon: AlertTriangle },
              { id: 'verify', label: 'Verify Invoice', icon: Search },
              { id: 'pricing', label: 'Agreed Pricing', icon: DollarSign },
              { id: 'audit', label: 'Audit Report', icon: FileText },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-brand-blue text-brand-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-blue" />
          </div>
        ) : (
          <>
            {/* Alerts Tab */}
            {activeTab === 'alerts' && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex gap-4">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="all">All Statuses</option>
                    <option value="New">New</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Disputed">Disputed</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Credit Received">Credit Received</option>
                  </select>

                  <select
                    value={supplierFilter}
                    onChange={(e) => setSupplierFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="all">All Suppliers</option>
                    {uniqueSuppliers.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Alerts Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Product</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Supplier</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Invoice #</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Agreed</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Charged</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Overcharge</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredAlerts.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                            No price alerts found. Use "Verify Invoice" to check for discrepancies.
                          </td>
                        </tr>
                      ) : (
                        filteredAlerts.map(alert => (
                          <tr key={alert.alertId} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm">
                              {new Date(alert.alertDate).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium">{alert.productName}</td>
                            <td className="px-4 py-3 text-sm">{alert.supplier}</td>
                            <td className="px-4 py-3 text-sm">{alert.invoiceNumber}</td>
                            <td className="px-4 py-3 text-sm text-right text-green-600">
                              {formatCurrency(alert.agreedPrice)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-red-600">
                              {formatCurrency(alert.invoicedPrice)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-bold text-red-700">
                              {formatCurrency(alert.totalOvercharge)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                alert.status === 'New' ? 'bg-red-100 text-red-700' :
                                alert.status === 'Under Review' ? 'bg-yellow-100 text-yellow-700' :
                                alert.status === 'Disputed' ? 'bg-orange-100 text-orange-700' :
                                alert.status === 'Resolved' ? 'bg-blue-100 text-blue-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {alert.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={alert.status}
                                onChange={(e) => updateAlertStatus(alert.alertId, e.target.value)}
                                className="text-sm border border-gray-300 rounded px-2 py-1"
                              >
                                <option value="New">New</option>
                                <option value="Under Review">Under Review</option>
                                <option value="Disputed">Disputed</option>
                                <option value="Resolved">Resolved</option>
                                <option value="Credit Received">Credit Received</option>
                              </select>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Verify Invoice Tab */}
            {activeTab === 'verify' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="font-semibold text-lg mb-4">Verify Invoice Prices</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Enter invoice details to check against agreed pricing. Any overcharges will create alerts.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                      <input
                        type="text"
                        value={verifySupplier}
                        onChange={(e) => setVerifySupplier(e.target.value)}
                        placeholder="e.g., ABC Supply, SRS Distribution"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                      <input
                        type="text"
                        value={verifyInvoiceNum}
                        onChange={(e) => setVerifyInvoiceNum(e.target.value)}
                        placeholder="Invoice #"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Line Items (SKU, Price, Qty per line)
                      </label>
                      <textarea
                        value={verifyLineItems}
                        onChange={(e) => setVerifyLineItems(e.target.value)}
                        placeholder="SKU123, 45.99, 10&#10;SKU456, 23.50, 5&#10;SKU789, 156.00, 2"
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Format: SKU, Unit Price, Quantity (one item per line)
                      </p>
                    </div>

                    <button
                      onClick={verifyInvoice}
                      disabled={verifying}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-blue text-white rounded-lg hover:bg-brand-blue/90 disabled:opacity-50"
                    >
                      {verifying ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      Verify Prices
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="font-semibold text-lg mb-4">Verification Results</h3>

                  {!verificationResult ? (
                    <div className="text-center py-12 text-gray-500">
                      Enter invoice details and click "Verify Prices" to see results
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Summary */}
                      <div className={`p-4 rounded-lg ${
                        verificationResult.hasOvercharges ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
                      }`}>
                        <p className={`font-medium ${verificationResult.hasOvercharges ? 'text-red-700' : 'text-green-700'}`}>
                          {verificationResult.message}
                        </p>
                        {verificationResult.hasOvercharges && (
                          <p className="text-sm text-red-600 mt-1">
                            {verificationResult.discrepancyCount} item(s) overcharged by {formatCurrency(verificationResult.totalDiscrepancy)}
                          </p>
                        )}
                      </div>

                      {/* Line Items */}
                      <div className="space-y-2">
                        {verificationResult.results?.map((item: any, idx: number) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg border ${
                              item.status === 'OK' ? 'bg-green-50 border-green-200' :
                              item.status === 'Overcharge' ? 'bg-red-50 border-red-200' :
                              item.status === 'Unknown Product' ? 'bg-yellow-50 border-yellow-200' :
                              'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-sm">{item.sku}</p>
                                <p className="text-xs text-gray-600">{item.productName}</p>
                              </div>
                              <span className={`px-2 py-1 text-xs rounded ${
                                item.status === 'OK' ? 'bg-green-100 text-green-700' :
                                item.status === 'Overcharge' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {item.status}
                              </span>
                            </div>
                            {item.status !== 'Unknown Product' && (
                              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                                <div>
                                  <span className="text-gray-500">Agreed: </span>
                                  <span className="text-green-600 font-medium">{formatCurrency(item.agreedPrice)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Invoiced: </span>
                                  <span className={item.status === 'Overcharge' ? 'text-red-600 font-medium' : ''}>
                                    {formatCurrency(item.unitPrice)}
                                  </span>
                                </div>
                                {item.status === 'Overcharge' && (
                                  <div>
                                    <span className="text-gray-500">Overcharge: </span>
                                    <span className="text-red-600 font-bold">
                                      {formatCurrency(item.priceDiff * item.quantity)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Agreed Pricing Tab */}
            {activeTab === 'pricing' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">
                    {pricing.length} products with agreed pricing
                  </p>
                  <button
                    onClick={() => setShowAddPricing(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-green text-white rounded-lg hover:bg-brand-green/90"
                  >
                    <Plus className="w-4 h-4" />
                    Add Pricing
                  </button>
                </div>

                {/* Add Pricing Form */}
                {showAddPricing && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="font-semibold text-lg mb-4">Add Agreed Pricing</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input
                        type="text"
                        placeholder="Product Name"
                        value={newPricing.productName}
                        onChange={(e) => setNewPricing({ ...newPricing, productName: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Supplier"
                        value={newPricing.supplier}
                        onChange={(e) => setNewPricing({ ...newPricing, supplier: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="SKU"
                        value={newPricing.sku}
                        onChange={(e) => setNewPricing({ ...newPricing, sku: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Category"
                        value={newPricing.category}
                        onChange={(e) => setNewPricing({ ...newPricing, category: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Agreed Price"
                        value={newPricing.agreedPrice}
                        onChange={(e) => setNewPricing({ ...newPricing, agreedPrice: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="List Price"
                        value={newPricing.listPrice}
                        onChange={(e) => setNewPricing({ ...newPricing, listPrice: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Contract #"
                        value={newPricing.contractNumber}
                        onChange={(e) => setNewPricing({ ...newPricing, contractNumber: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="date"
                        placeholder="Effective Date"
                        value={newPricing.effectiveDate}
                        onChange={(e) => setNewPricing({ ...newPricing, effectiveDate: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="date"
                        placeholder="Expiration Date"
                        value={newPricing.expirationDate}
                        onChange={(e) => setNewPricing({ ...newPricing, expirationDate: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={addPricing}
                        className="px-4 py-2 bg-brand-green text-white rounded-lg"
                      >
                        Save Pricing
                      </button>
                      <button
                        onClick={() => setShowAddPricing(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Pricing Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Product</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Supplier</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">SKU</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Category</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">List Price</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Agreed Price</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Discount</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Expires</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {pricing.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                            No agreed pricing records. Add your supplier contracts to start tracking.
                          </td>
                        </tr>
                      ) : (
                        pricing.map(item => (
                          <tr key={item.productId} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium">{item.productName}</td>
                            <td className="px-4 py-3 text-sm">{item.supplier}</td>
                            <td className="px-4 py-3 text-sm font-mono">{item.sku}</td>
                            <td className="px-4 py-3 text-sm">{item.category}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-500">
                              {formatCurrency(item.listPrice)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                              {formatCurrency(item.agreedPrice)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-blue-600">
                              {item.discountPercent}%
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {item.expirationDate ? new Date(item.expirationDate).toLocaleDateString() : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Audit Report Tab */}
            {activeTab === 'audit' && auditSummary && (
              <div className="space-y-6">
                {/* Period Summary */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="font-semibold text-lg mb-4">
                    Audit Summary: {auditSummary.period}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-3xl font-bold text-gray-900">{auditSummary.totalInvoices}</p>
                      <p className="text-sm text-gray-600">Total Invoices</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-3xl font-bold text-gray-900">{formatCurrency(auditSummary.totalSpend)}</p>
                      <p className="text-sm text-gray-600">Total Spend</p>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <p className="text-3xl font-bold text-red-700">{formatCurrency(auditSummary.totalOvercharges)}</p>
                      <p className="text-sm text-red-600">Total Overcharges</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-3xl font-bold text-green-700">{formatCurrency(auditSummary.creditsReceived)}</p>
                      <p className="text-sm text-green-600">Credits Received</p>
                    </div>
                  </div>
                </div>

                {/* Top Overcharged Products */}
                {auditSummary.topOverchargedProducts.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="font-semibold text-lg mb-4">Top Overcharged Products</h3>
                    <div className="space-y-3">
                      {auditSummary.topOverchargedProducts.map((product, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                          <div>
                            <p className="font-medium">{product.productName}</p>
                            <p className="text-sm text-gray-600">{product.supplier} - {product.occurrences} occurrences</p>
                          </div>
                          <p className="text-lg font-bold text-red-700">{formatCurrency(product.totalOvercharge)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Supplier Summary */}
                {auditSummary.supplierSummary.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="font-semibold text-lg mb-4">Supplier Summary</h3>
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Supplier</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Invoices</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Total Spend</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Discrepancies</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Overcharge Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {auditSummary.supplierSummary.map((supplier, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-3 font-medium">{supplier.supplier}</td>
                            <td className="px-4 py-3 text-right">{supplier.invoiceCount}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(supplier.totalSpend)}</td>
                            <td className="px-4 py-3 text-right">{supplier.discrepancies}</td>
                            <td className="px-4 py-3 text-right font-medium text-red-600">
                              {formatCurrency(supplier.overchargeAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
