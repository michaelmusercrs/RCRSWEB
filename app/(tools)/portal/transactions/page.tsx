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
  ChevronUp,
  RefreshCw,
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

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.inventoryId.toLowerCase().includes(lower) ||
        t.referenceNumber.toLowerCase().includes(lower) ||
        t.product?.productName?.toLowerCase().includes(lower) ||
        t.itemId.toLowerCase().includes(lower)
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(t => t.type === typeFilter);
    }

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
        return <Truck className="w-4 h-4 text-blue-400" />;
      case 'restock':
        return <Package className="w-4 h-4 text-green-400" />;
      case 'return':
        return <RotateCcw className="w-4 h-4 text-orange-400" />;
      case 'count':
        return <ClipboardCheck className="w-4 h-4 text-purple-400" />;
      default:
        return <Package className="w-4 h-4 text-zinc-500" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      delivery: 'bg-blue-500/20 text-blue-400',
      restock: 'bg-green-500/20 text-green-400',
      return: 'bg-orange-500/20 text-orange-400',
      adjustment: 'bg-yellow-500/20 text-yellow-400',
      count: 'bg-purple-500/20 text-purple-400'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[type] || 'bg-zinc-500/20 text-zinc-400'}`}>
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 animate-spin text-[#39FF14] mx-auto mb-4" />
          <p className="text-zinc-400">Loading transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/portal/inventory" className="text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Transaction History</h1>
              <p className="text-sm text-zinc-400">View all inventory transactions and activity logs</p>
            </div>
          </div>
          <button
            onClick={fetchTransactions}
            className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
      </header>

      {/* Stats Cards */}
      {stats && (
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Transactions', value: stats.totalTransactions, color: 'text-white', icon: BarChart3 },
              { label: 'Deliveries', value: stats.deliveryCount, color: 'text-blue-400', icon: Truck },
              { label: 'Restocks', value: stats.restockCount, color: 'text-green-400', icon: Package },
              { label: 'Delivery Value', value: formatCurrency(stats.totalDeliveryValue), color: 'text-[#39FF14]', icon: TrendingUp },
              { label: 'Restock Cost', value: formatCurrency(stats.totalRestockCost), color: 'text-red-400', icon: TrendingDown },
              { label: 'Profit Margin', value: formatCurrency(stats.profitMargin), color: stats.profitMargin >= 0 ? 'text-[#39FF14]' : 'text-red-400', icon: DollarSign },
            ].map((stat) => (
              <div key={stat.label} className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <div className="flex items-center gap-2 text-zinc-500 text-sm mb-1">
                  <stat.icon className="w-4 h-4" />
                  {stat.label}
                </div>
                <div className={`text-2xl font-bold ${stat.color}`}>
                  {typeof stat.value === 'number' ? stat.value : stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-[#39FF14]/30 focus:border-[#39FF14]/50 bg-zinc-800 text-white placeholder-zinc-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-500" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="border border-zinc-700 rounded-lg px-3 py-2 bg-zinc-800 text-white focus:ring-2 focus:ring-[#39FF14]/30"
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
              <Calendar className="w-4 h-4 text-zinc-500" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border border-zinc-700 rounded-lg px-3 py-2 bg-zinc-800 text-white focus:ring-2 focus:ring-[#39FF14]/30"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="quarter">Last 90 Days</option>
              </select>
            </div>
          </div>

          <div className="mt-2 text-sm text-zinc-500">
            Showing {paginatedTransactions.length} of {filteredTransactions.length} transactions
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="max-w-7xl mx-auto px-6 pb-6">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-800/50 border-b border-zinc-800">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Date/Time</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Reference</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Qty</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Value</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Photo</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {paginatedTransactions.map((transaction) => (
                  <>
                    <tr
                      key={transaction.inventoryId}
                      className="hover:bg-zinc-800/50 cursor-pointer transition-colors"
                      onClick={() => toggleRow(transaction.inventoryId)}
                    >
                      <td className="px-4 py-3 text-sm text-zinc-300">
                        {formatDate(transaction.dateTime)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(transaction.type)}
                          {getTypeBadge(transaction.type)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-white">
                          {transaction.product?.productName || transaction.itemId}
                        </div>
                        <div className="text-xs text-zinc-500">{transaction.itemId}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-400">
                        {transaction.referenceNumber}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-medium ${transaction.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-white">
                        {formatCurrency(Math.abs(transaction.amount) * (transaction.type === 'delivery' ? transaction.price : transaction.cost))}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {transaction.deliveryPhoto ? (
                          <ImageIcon className="w-4 h-4 text-green-400 mx-auto" />
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {expandedRows.has(transaction.inventoryId) ? (
                          <ChevronUp className="w-4 h-4 text-zinc-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-500" />
                        )}
                      </td>
                    </tr>
                    {expandedRows.has(transaction.inventoryId) && (
                      <tr key={`${transaction.inventoryId}-detail`} className="bg-zinc-800/30">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-zinc-500">Transaction ID:</span>
                              <div className="font-medium text-white">{transaction.inventoryId}</div>
                            </div>
                            <div>
                              <span className="text-zinc-500">Unit Price:</span>
                              <div className="font-medium text-white">{formatCurrency(transaction.price)}</div>
                            </div>
                            <div>
                              <span className="text-zinc-500">Unit Cost:</span>
                              <div className="font-medium text-white">{formatCurrency(transaction.cost)}</div>
                            </div>
                            <div>
                              <span className="text-zinc-500">Status:</span>
                              <div className="font-medium capitalize text-green-400">{transaction.status}</div>
                            </div>
                            {transaction.deliveryPhoto && (
                              <div className="col-span-2 md:col-span-4">
                                <span className="text-zinc-500">Delivery Photo:</span>
                                <div className="font-medium text-[#39FF14]">{transaction.deliveryPhoto}</div>
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
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-zinc-700 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <div className="text-sm text-zinc-500">
                Page {currentPage} of {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-zinc-700 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}

          {paginatedTransactions.length === 0 && (
            <div className="p-8 text-center">
              <BarChart3 className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white">No transactions found</h3>
              <p className="text-zinc-500">Try adjusting your filters or search term</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
