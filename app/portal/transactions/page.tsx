'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  Search,
  Truck,
  RotateCcw,
  ClipboardCheck,
  Image as ImageIcon,
  DollarSign,
  BarChart3,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface InventoryTransaction {
  inventoryId: string;
  itemId: string;
  dateTime: string;
  amount: number;
  referenceNumber: string;
  price: number;
  cost: number;
  deliveryPhoto?: string;
  status: 'completed' | 'pending' | 'cancelled';
  type: 'delivery' | 'restock' | 'return' | 'adjustment' | 'count';
  product?: {
    productId: string;
    productName: string;
    category: string;
  };
}

interface TransactionStats {
  totalTransactions: number;
  deliveryCount: number;
  restockCount: number;
  totalDeliveryValue: number;
  totalRestockCost: number;
  profitMargin: number;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  useEffect(() => {
    fetchTransactions();
  }, []);

  async function fetchTransactions() {
    try {
      const response = await fetch('/api/portal/transactions');
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Search filter
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.inventoryId.toLowerCase().includes(lower) ||
        t.referenceNumber.toLowerCase().includes(lower) ||
        t.product?.productName?.toLowerCase().includes(lower) ||
        t.itemId.toLowerCase().includes(lower)
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(t => t.type === typeFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case 'quarter':
          startDate = new Date(now.setMonth(now.getMonth() - 3));
          break;
        default:
          startDate = new Date(0);
      }

      filtered = filtered.filter(t => new Date(t.dateTime) >= startDate);
    }

    return filtered;
  }, [transactions, searchTerm, typeFilter, dateFilter]);

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'delivery':
        return <Truck className="w-4 h-4 text-blue-500" />;
      case 'restock':
        return <Package className="w-4 h-4 text-green-500" />;
      case 'return':
        return <RotateCcw className="w-4 h-4 text-orange-500" />;
      case 'count':
        return <ClipboardCheck className="w-4 h-4 text-purple-500" />;
      default:
        return <Package className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      delivery: 'bg-blue-100 text-blue-800',
      restock: 'bg-green-100 text-green-800',
      return: 'bg-orange-100 text-orange-800',
      adjustment: 'bg-yellow-100 text-yellow-800',
      count: 'bg-purple-100 text-purple-800'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[type] || 'bg-gray-100 text-gray-800'}`}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/portal/inventory" className="text-neutral-500 hover:text-neutral-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-neutral-900">Transaction History</h1>
              <p className="text-sm text-neutral-500">View all inventory transactions and activity logs</p>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      {stats && (
        <div className="px-6 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-lg border border-neutral-200 p-4">
              <div className="flex items-center gap-2 text-neutral-500 text-sm mb-1">
                <BarChart3 className="w-4 h-4" />
                Total Transactions
              </div>
              <div className="text-2xl font-bold text-neutral-900">{stats.totalTransactions}</div>
            </div>
            <div className="bg-white rounded-lg border border-neutral-200 p-4">
              <div className="flex items-center gap-2 text-blue-500 text-sm mb-1">
                <Truck className="w-4 h-4" />
                Deliveries
              </div>
              <div className="text-2xl font-bold text-neutral-900">{stats.deliveryCount}</div>
            </div>
            <div className="bg-white rounded-lg border border-neutral-200 p-4">
              <div className="flex items-center gap-2 text-green-500 text-sm mb-1">
                <Package className="w-4 h-4" />
                Restocks
              </div>
              <div className="text-2xl font-bold text-neutral-900">{stats.restockCount}</div>
            </div>
            <div className="bg-white rounded-lg border border-neutral-200 p-4">
              <div className="flex items-center gap-2 text-neutral-500 text-sm mb-1">
                <TrendingUp className="w-4 h-4" />
                Delivery Value
              </div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalDeliveryValue)}</div>
            </div>
            <div className="bg-white rounded-lg border border-neutral-200 p-4">
              <div className="flex items-center gap-2 text-neutral-500 text-sm mb-1">
                <TrendingDown className="w-4 h-4" />
                Restock Cost
              </div>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalRestockCost)}</div>
            </div>
            <div className="bg-white rounded-lg border border-neutral-200 p-4">
              <div className="flex items-center gap-2 text-neutral-500 text-sm mb-1">
                <DollarSign className="w-4 h-4" />
                Profit Margin
              </div>
              <div className={`text-2xl font-bold ${stats.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(stats.profitMargin)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-6 py-4 bg-white border-b border-neutral-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-500" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="delivery">Deliveries</option>
              <option value="restock">Restocks</option>
              <option value="return">Returns</option>
              <option value="adjustment">Adjustments</option>
              <option value="count">Counts</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-neutral-500" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="quarter">Last 90 Days</option>
            </select>
          </div>
        </div>

        <div className="mt-2 text-sm text-neutral-500">
          Showing {paginatedTransactions.length} of {filteredTransactions.length} transactions
        </div>
      </div>

      {/* Transactions Table */}
      <div className="px-6 py-4">
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Date/Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Product</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Reference</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Qty</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Value</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Photo</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {paginatedTransactions.map((transaction) => (
                <>
                  <tr
                    key={transaction.inventoryId}
                    className="hover:bg-neutral-50 cursor-pointer"
                    onClick={() => toggleRow(transaction.inventoryId)}
                  >
                    <td className="px-4 py-3 text-sm text-neutral-900">
                      {formatDate(transaction.dateTime)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(transaction.type)}
                        {getTypeBadge(transaction.type)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-neutral-900">
                        {transaction.product?.productName || transaction.itemId}
                      </div>
                      <div className="text-xs text-neutral-500">{transaction.itemId}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {transaction.referenceNumber}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-medium ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-neutral-900">
                      {formatCurrency(Math.abs(transaction.amount) * (transaction.type === 'delivery' ? transaction.price : transaction.cost))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {transaction.deliveryPhoto ? (
                        <ImageIcon className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {expandedRows.has(transaction.inventoryId) ? (
                        <ChevronUp className="w-4 h-4 text-neutral-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-neutral-400" />
                      )}
                    </td>
                  </tr>
                  {expandedRows.has(transaction.inventoryId) && (
                    <tr className="bg-neutral-50">
                      <td colSpan={8} className="px-4 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-neutral-500">Transaction ID:</span>
                            <div className="font-medium">{transaction.inventoryId}</div>
                          </div>
                          <div>
                            <span className="text-neutral-500">Unit Price:</span>
                            <div className="font-medium">{formatCurrency(transaction.price)}</div>
                          </div>
                          <div>
                            <span className="text-neutral-500">Unit Cost:</span>
                            <div className="font-medium">{formatCurrency(transaction.cost)}</div>
                          </div>
                          <div>
                            <span className="text-neutral-500">Status:</span>
                            <div className="font-medium capitalize text-green-600">{transaction.status}</div>
                          </div>
                          {transaction.deliveryPhoto && (
                            <div className="col-span-2 md:col-span-4">
                              <span className="text-neutral-500">Delivery Photo:</span>
                              <div className="font-medium text-blue-600">{transaction.deliveryPhoto}</div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-neutral-200 flex items-center justify-between">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="text-sm text-neutral-600">
                Page {currentPage} of {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
