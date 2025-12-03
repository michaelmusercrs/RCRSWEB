'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, BarChart3, Truck, Package, DollarSign, Users, Calendar,
  Download, RefreshCw, Filter, ChevronDown, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, Clock, ArrowRight, Loader2
} from 'lucide-react';

type ReportType = 'delivery' | 'billing' | 'inventory' | 'team' | 'jobflow';

interface FilterState {
  dateFrom: string;
  dateTo: string;
  status: string[];
  ticketType: string;
  driverId: string;
  projectManagerId: string;
}

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>('delivery');
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    dateTo: new Date().toISOString().slice(0, 10),
    status: [],
    ticketType: 'all',
    driverId: '',
    projectManagerId: '',
  });

  const reportTypes = [
    { id: 'delivery', label: 'Deliveries', icon: Truck, color: 'bg-blue-500' },
    { id: 'billing', label: 'Billing', icon: DollarSign, color: 'bg-green-500' },
    { id: 'inventory', label: 'Inventory', icon: Package, color: 'bg-orange-500' },
    { id: 'team', label: 'Team', icon: Users, color: 'bg-purple-500' },
    { id: 'jobflow', label: 'Job Flow', icon: ArrowRight, color: 'bg-cyan-500' },
  ];

  const loadReport = async () => {
    setIsLoading(true);
    // In production, fetch from API with filters
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
  };

  useEffect(() => {
    loadReport();
  }, [activeReport, filters]);

  const handleExport = () => {
    // Generate CSV download
    alert('Report exported to CSV');
  };

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
                  <p className="text-sm text-neutral-400">Comprehensive business insights</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors ${
                    showFilters
                      ? 'bg-brand-green text-black'
                      : 'bg-white/5 hover:bg-white/10 text-neutral-400'
                  }`}
                >
                  <Filter size={16} />
                  Filters
                </button>
                <button
                  onClick={loadReport}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 text-sm"
                >
                  <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                  Refresh
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-green text-black font-medium text-sm"
                >
                  <Download size={16} />
                  Export
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

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white/[0.02] border-b border-white/5">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Ticket Type</label>
                  <select
                    value={filters.ticketType}
                    onChange={(e) => setFilters({ ...filters, ticketType: e.target.value })}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="all">All Types</option>
                    <option value="delivery">Delivery</option>
                    <option value="pickup">Pickup</option>
                    <option value="return">Return</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Driver</label>
                  <select
                    value={filters.driverId}
                    onChange={(e) => setFilters({ ...filters, driverId: e.target.value })}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="">All Drivers</option>
                    <option value="rick">Rick</option>
                    <option value="tae">Tae</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Project Manager</label>
                  <select
                    value={filters.projectManagerId}
                    onChange={(e) => setFilters({ ...filters, projectManagerId: e.target.value })}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="">All PMs</option>
                    <option value="john">John</option>
                    <option value="bart">Bart</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => setFilters({
                      dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                      dateTo: new Date().toISOString().slice(0, 10),
                      status: [],
                      ticketType: 'all',
                      driverId: '',
                      projectManagerId: '',
                    })}
                    className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-300 text-sm rounded-lg"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <main className="max-w-7xl mx-auto px-6 py-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <Loader2 className="animate-spin mx-auto text-brand-green" size={48} />
                <p className="text-neutral-400 mt-4">Loading report data...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Delivery Report */}
              {activeReport === 'delivery' && (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-neutral-400 text-sm">Total Deliveries</span>
                        <TrendingUp className="text-green-400" size={16} />
                      </div>
                      <p className="text-3xl font-bold text-white">156</p>
                      <p className="text-xs text-green-400">+12% from last month</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-neutral-400 text-sm">Completed</span>
                        <CheckCircle2 className="text-green-400" size={16} />
                      </div>
                      <p className="text-3xl font-bold text-white">142</p>
                      <p className="text-xs text-neutral-400">91% completion rate</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-neutral-400 text-sm">Avg Time</span>
                        <Clock className="text-blue-400" size={16} />
                      </div>
                      <p className="text-3xl font-bold text-white">45m</p>
                      <p className="text-xs text-blue-400">-5m improvement</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-neutral-400 text-sm">Material Value</span>
                        <DollarSign className="text-green-400" size={16} />
                      </div>
                      <p className="text-3xl font-bold text-white">$287K</p>
                      <p className="text-xs text-green-400">+18% revenue</p>
                    </div>
                  </div>

                  {/* Driver Performance */}
                  <div className="grid lg:grid-cols-2 gap-6">
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Driver Performance</h3>
                      <div className="space-y-4">
                        {[
                          { name: 'Rick', deliveries: 82, completed: 78, avgTime: 42, value: 156000 },
                          { name: 'Tae', deliveries: 74, completed: 64, avgTime: 48, value: 131450 },
                        ].map((driver) => (
                          <div key={driver.name} className="bg-neutral-800/50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold">
                                  {driver.name[0]}
                                </div>
                                <div>
                                  <p className="text-white font-medium">{driver.name}</p>
                                  <p className="text-neutral-400 text-sm">{driver.deliveries} deliveries</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-white font-bold">${(driver.value / 1000).toFixed(0)}K</p>
                                <p className="text-neutral-400 text-xs">{driver.avgTime}m avg</p>
                              </div>
                            </div>
                            <div className="w-full bg-neutral-700 rounded-full h-2">
                              <div
                                className="bg-brand-green h-2 rounded-full"
                                style={{ width: `${(driver.completed / driver.deliveries) * 100}%` }}
                              />
                            </div>
                            <p className="text-neutral-400 text-xs mt-1">
                              {Math.round((driver.completed / driver.deliveries) * 100)}% on-time rate
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Status Distribution</h3>
                      <div className="space-y-3">
                        {[
                          { status: 'Completed', count: 142, color: 'bg-green-500' },
                          { status: 'In Progress', count: 10, color: 'bg-blue-500' },
                          { status: 'Pending', count: 4, color: 'bg-yellow-500' },
                          { status: 'Cancelled', count: 2, color: 'bg-red-500' },
                        ].map((item) => (
                          <div key={item.status} className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${item.color}`} />
                            <span className="text-neutral-300 flex-1">{item.status}</span>
                            <span className="text-white font-medium">{item.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Billing Report */}
              {activeReport === 'billing' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <p className="text-neutral-400 text-sm mb-1">Total Invoiced</p>
                      <p className="text-3xl font-bold text-white">$425K</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <p className="text-neutral-400 text-sm mb-1">Total Paid</p>
                      <p className="text-3xl font-bold text-green-400">$389K</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <p className="text-neutral-400 text-sm mb-1">Pending</p>
                      <p className="text-3xl font-bold text-yellow-400">$28K</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <p className="text-neutral-400 text-sm mb-1">Overdue</p>
                      <p className="text-3xl font-bold text-red-400">$7.5K</p>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Monthly Trend</h3>
                    <div className="h-64 flex items-end gap-4">
                      {['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, i) => {
                        const height = [65, 78, 72, 85, 92, 88][i];
                        return (
                          <div key={month} className="flex-1 flex flex-col items-center gap-2">
                            <div
                              className="w-full bg-brand-green/80 rounded-t-lg transition-all"
                              style={{ height: `${height}%` }}
                            />
                            <span className="text-neutral-400 text-sm">{month}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Inventory Report */}
              {activeReport === 'inventory' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <p className="text-neutral-400 text-sm mb-1">Total Products</p>
                      <p className="text-3xl font-bold text-white">124</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <p className="text-neutral-400 text-sm mb-1">Total Value</p>
                      <p className="text-3xl font-bold text-white">$89K</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <p className="text-neutral-400 text-sm mb-1">Low Stock</p>
                      <p className="text-3xl font-bold text-yellow-400">8</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <p className="text-neutral-400 text-sm mb-1">Out of Stock</p>
                      <p className="text-3xl font-bold text-red-400">2</p>
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-6">
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">By Category</h3>
                      <div className="space-y-3">
                        {[
                          { name: 'Shingles', count: 24, value: 42500, low: 2 },
                          { name: 'Underlayment', count: 12, value: 12800, low: 1 },
                          { name: 'Flashing', count: 18, value: 9000, low: 0 },
                          { name: 'Fasteners', count: 28, value: 4800, low: 3 },
                          { name: 'Ventilation', count: 16, value: 8100, low: 1 },
                        ].map((cat) => (
                          <div key={cat.name} className="flex items-center justify-between py-2 border-b border-white/5">
                            <div>
                              <p className="text-white">{cat.name}</p>
                              <p className="text-neutral-400 text-sm">{cat.count} products</p>
                            </div>
                            <div className="text-right">
                              <p className="text-white font-medium">${(cat.value / 1000).toFixed(1)}K</p>
                              {cat.low > 0 && (
                                <p className="text-yellow-400 text-xs">{cat.low} low</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Top Moving Items</h3>
                      <div className="space-y-3">
                        {[
                          { name: 'OC Duration 30yr', used: 245, revenue: 24500 },
                          { name: '30lb Felt Paper', used: 180, revenue: 5400 },
                          { name: 'Ice & Water Shield', used: 156, revenue: 6240 },
                        ].map((item, i) => (
                          <div key={item.name} className="flex items-center gap-3 py-2 border-b border-white/5">
                            <span className="text-brand-green font-bold">#{i + 1}</span>
                            <div className="flex-1">
                              <p className="text-white">{item.name}</p>
                              <p className="text-neutral-400 text-sm">{item.used} units sold</p>
                            </div>
                            <p className="text-green-400 font-medium">${(item.revenue / 1000).toFixed(1)}K</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Team Report */}
              {activeReport === 'team' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <p className="text-neutral-400 text-sm mb-1">Total Team</p>
                      <p className="text-3xl font-bold text-white">9</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <p className="text-neutral-400 text-sm mb-1">Active Today</p>
                      <p className="text-3xl font-bold text-green-400">7</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <p className="text-neutral-400 text-sm mb-1">Drivers</p>
                      <p className="text-3xl font-bold text-orange-400">2</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <p className="text-neutral-400 text-sm mb-1">PMs</p>
                      <p className="text-3xl font-bold text-cyan-400">2</p>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Team Performance</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {[
                        { name: 'John (PM)', orders: 85, value: 168500, rate: 94.1 },
                        { name: 'Bart (PM)', orders: 71, value: 118950, rate: 92.3 },
                        { name: 'Rick (Driver)', deliveries: 82, onTime: 78, avgTime: 42 },
                        { name: 'Tae (Driver)', deliveries: 74, onTime: 68, avgTime: 48 },
                      ].map((person) => (
                        <div key={person.name} className="bg-neutral-800/50 rounded-lg p-4">
                          <p className="text-white font-medium mb-2">{person.name}</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {'orders' in person ? (
                              <>
                                <div>
                                  <p className="text-neutral-400">Orders</p>
                                  <p className="text-white font-bold">{person.orders}</p>
                                </div>
                                <div>
                                  <p className="text-neutral-400">Value</p>
                                  <p className="text-white font-bold">${((person.value || 0) / 1000).toFixed(0)}K</p>
                                </div>
                              </>
                            ) : (
                              <>
                                <div>
                                  <p className="text-neutral-400">Deliveries</p>
                                  <p className="text-white font-bold">{person.deliveries}</p>
                                </div>
                                <div>
                                  <p className="text-neutral-400">On-Time</p>
                                  <p className="text-white font-bold">{person.onTime}</p>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Job Flow Report */}
              {activeReport === 'jobflow' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <p className="text-neutral-400 text-sm mb-1">Avg Completion Time</p>
                      <p className="text-3xl font-bold text-white">10h 15m</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <p className="text-neutral-400 text-sm mb-1">In Pipeline</p>
                      <p className="text-3xl font-bold text-blue-400">22</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <p className="text-neutral-400 text-sm mb-1">Bottlenecks</p>
                      <p className="text-3xl font-bold text-yellow-400">2</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <p className="text-neutral-400 text-sm mb-1">Alerts</p>
                      <p className="text-3xl font-bold text-red-400">3</p>
                    </div>
                  </div>

                  {/* Job Flow Visualization */}
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-6">Material Flow Pipeline</h3>
                    <div className="overflow-x-auto">
                      <div className="flex gap-2 min-w-max pb-4">
                        {[
                          { stage: 'Order Created', count: 3, time: 5, color: 'bg-gray-500' },
                          { stage: 'Reviewed', count: 2, time: 15, color: 'bg-cyan-500' },
                          { stage: 'Driver Assigned', count: 2, time: 10, color: 'bg-blue-500' },
                          { stage: 'Materials Pulled', count: 4, time: 45, color: 'bg-yellow-500', bottleneck: true },
                          { stage: 'Load Verified', count: 2, time: 15, color: 'bg-purple-500' },
                          { stage: 'En Route', count: 1, time: 35, color: 'bg-indigo-500' },
                          { stage: 'Delivered', count: 0, time: 20, color: 'bg-teal-500' },
                          { stage: 'Billing', count: 8, time: 480, color: 'bg-orange-500', bottleneck: true },
                        ].map((stage, i) => (
                          <div key={stage.stage} className="flex flex-col items-center">
                            <div className={`relative w-24 p-3 rounded-lg text-center ${
                              stage.bottleneck ? 'bg-yellow-500/20 border-2 border-yellow-500' : 'bg-neutral-800'
                            }`}>
                              {stage.bottleneck && (
                                <AlertTriangle className="absolute -top-2 -right-2 text-yellow-500" size={16} />
                              )}
                              <p className="text-white text-sm font-medium">{stage.stage}</p>
                              <p className={`text-xl font-bold ${stage.count > 0 ? 'text-white' : 'text-neutral-500'}`}>
                                {stage.count}
                              </p>
                              <p className="text-neutral-400 text-xs">{stage.time}m avg</p>
                            </div>
                            {i < 7 && (
                              <ArrowRight className="my-2 text-neutral-500" size={16} />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Alerts */}
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <AlertTriangle className="text-yellow-400" size={20} />
                      Active Alerts
                    </h3>
                    <div className="space-y-3">
                      {[
                        { type: 'stuck', ticket: 'TKT-2024-0156', message: 'Stuck in materials_pulled for 2+ hours', severity: 'high' },
                        { type: 'delay', ticket: 'TKT-2024-0148', message: 'Billing pending for 3+ days', severity: 'medium' },
                        { type: 'overdue', ticket: 'TKT-2024-0142', message: 'Invoice overdue by 7 days', severity: 'high' },
                      ].map((alert, i) => (
                        <div key={i} className={`flex items-center gap-4 p-3 rounded-lg ${
                          alert.severity === 'high' ? 'bg-red-500/10' : 'bg-yellow-500/10'
                        }`}>
                          <AlertTriangle className={
                            alert.severity === 'high' ? 'text-red-400' : 'text-yellow-400'
                          } size={20} />
                          <div className="flex-1">
                            <p className={alert.severity === 'high' ? 'text-red-400' : 'text-yellow-400'}>
                              {alert.message}
                            </p>
                            <p className="text-neutral-400 text-sm">{alert.ticket}</p>
                          </div>
                          <button className="px-3 py-1 bg-white/10 rounded text-white text-sm hover:bg-white/20">
                            View
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
