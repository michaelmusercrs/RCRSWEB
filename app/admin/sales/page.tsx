'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Trophy, TrendingUp, DollarSign, Users,
  Award, Flame, Star, Loader2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

// Types matching the API response
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
  dateRange: {
    start: string | null;
    end: string | null;
  };
  avgTransactionValue: number;
  uniqueReps: number;
}

interface SalesApiResponse {
  success: boolean;
  data: {
    summary: SalesSummary;
    leaderboard: LeaderboardEntry[];
  };
}

const CHART_COLORS = ['#39FF14', '#00D4FF', '#FF6B6B', '#FFD93D', '#A855F7', '#F97316'];

type SortBy = 'commissions' | 'transactions' | 'average';

export default function SalesCommissionsPage() {
  const [sortBy, setSortBy] = useState<SortBy>('commissions');
  const [selectedRep, setSelectedRep] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Fetch sales data from API
  useEffect(() => {
    async function fetchSalesData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/command-center/sales?period=all');
        if (!res.ok) {
          throw new Error(`API returned ${res.status}`);
        }
        const json: SalesApiResponse = await res.json();
        if (!json.success || !json.data) {
          throw new Error('API returned unsuccessful response');
        }
        setSummary(json.data.summary);
        setLeaderboard(json.data.leaderboard || []);
      } catch (err) {
        console.error('Failed to fetch sales data:', err);
        setError('Failed to load sales data');
        setSummary(null);
        setLeaderboard([]);
      } finally {
        setLoading(false);
      }
    }
    fetchSalesData();
  }, []);

  // Sort leaderboard data
  const sortedReps = useMemo(() => {
    return [...leaderboard].sort((a, b) => {
      switch (sortBy) {
        case 'transactions':
          return b.transactionCount - a.transactionCount;
        case 'average':
          return b.avgTransaction - a.avgTransaction;
        default:
          return b.totalCommissions - a.totalCommissions;
      }
    });
  }, [sortBy, leaderboard]);

  // Build YTD chart data from leaderboard
  const ytdData = useMemo(() => {
    return sortedReps.map(rep => ({
      name: rep.name.split(' ')[0],
      commissions: rep.totalCommissions,
      transactions: rep.transactionCount,
      avgPerTransaction: rep.avgTransaction,
    }));
  }, [sortedReps]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-yellow-400" />;
    if (index === 1) return <Award className="w-5 h-5 text-neutral-500" />;
    if (index === 2) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="text-neutral-500 font-bold">#{index + 1}</span>;
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-brand-green animate-spin mx-auto mb-4" />
          <p className="text-neutral-400 text-lg">Loading sales data...</p>
        </div>
      </div>
    );
  }

  // Error or empty state
  if (error || !summary || leaderboard.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Sales & Commissions</h1>
          <p className="text-neutral-400 mt-2">
            Track sales performance, commissions, and rep rankings
          </p>
        </div>
        <div className="bg-neutral-900 rounded-xl border border-white/10 p-12 text-center">
          <DollarSign className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-neutral-300 mb-2">No sales data available</h2>
          <p className="text-neutral-500">
            Connect JobNimbus to see real-time sales and commission data.
          </p>
        </div>
      </div>
    );
  }

  const topPerformer = sortedReps[0];
  const totalTransactions = summary.transactionCount;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Sales & Commissions</h1>
          <p className="text-neutral-400 mt-2">
            Track sales performance, commissions, and rep rankings
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-green text-black">
            All Time
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-neutral-900 rounded-xl border border-white/10 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-400">Total Commissions</p>
              <p className="text-2xl font-bold text-white mt-1">
                {formatCurrency(summary.totalCommissions)}
              </p>
              <p className="text-xs text-neutral-500 mt-1">All time earnings</p>
            </div>
            <div className="bg-brand-green/20 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-brand-green" />
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 rounded-xl border border-white/10 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-400">Total Transactions</p>
              <p className="text-2xl font-bold text-white mt-1">
                {totalTransactions.toLocaleString()}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Avg: {formatCurrency(summary.avgTransactionValue)} per deal
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 rounded-xl border border-white/10 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-400">Active Reps</p>
              <p className="text-2xl font-bold text-white mt-1">
                {summary.uniqueReps}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                {summary.dateRange.start && summary.dateRange.end
                  ? `${new Date(summary.dateRange.start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${new Date(summary.dateRange.end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                  : 'Date range unavailable'}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 rounded-xl border border-white/10 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-400">Top Performer</p>
              <p className="text-xl font-bold text-white mt-1">
                {topPerformer.name.split(' ')[0]}
              </p>
              <p className="text-xs text-brand-green font-semibold mt-1">
                {formatCurrency(topPerformer.totalCommissions)}
              </p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Trophy className="w-6 h-6 text-yellow-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <div className="lg:col-span-1 bg-neutral-900 rounded-xl border border-white/10 overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center">
                <Trophy className="w-5 h-5 text-yellow-500 mr-2" />
                Leaderboard
              </h2>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="text-sm border border-white/10 rounded-lg px-3 py-1 focus:ring-2 focus:ring-brand-green focus:border-transparent bg-white/5 text-white"
              >
                <option value="commissions">By Commissions</option>
                <option value="transactions">By Transactions</option>
                <option value="average">By Avg/Deal</option>
              </select>
            </div>
          </div>
          <div className="divide-y divide-white/5">
            {sortedReps.map((rep, index) => (
              <div
                key={rep.name}
                onClick={() => setSelectedRep(selectedRep === rep.name ? null : rep.name)}
                className={`p-4 hover:bg-white/5 cursor-pointer transition-colors ${
                  selectedRep === rep.name ? 'bg-brand-green/10' : ''
                } ${index === 0 ? 'bg-yellow-50/50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 flex items-center justify-center">
                      {getRankBadge(index)}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{rep.name}</p>
                      <p className="text-xs text-neutral-500">{rep.transactionCount} deals</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white">
                      {formatCurrency(rep.totalCommissions)}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Avg: {formatCurrency(rep.avgTransaction)}
                    </p>
                  </div>
                </div>
                {selectedRep === rep.name && (
                  <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-neutral-500">Share of Total</p>
                      <p className="font-medium">{rep.percentOfTotal}%</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Rank</p>
                      <p className="font-medium">#{rep.rank}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Charts Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Commission Chart - All Time by Rep */}
          <div className="bg-neutral-900 rounded-xl border border-white/10 p-6">
            <h2 className="text-lg font-bold text-white mb-4">Commissions by Rep</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ytdData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12 }}
                    stroke="#6b7280"
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} stroke="#6b7280" width={70} />
                  <Tooltip
                    formatter={(value) => typeof value === 'number' ? formatCurrency(value) : value}
                    contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Bar dataKey="commissions" name="Total Commissions" fill="#39FF14" radius={[0, 4, 4, 0]}>
                    {ytdData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Commission Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-neutral-900 rounded-xl border border-white/10 p-6">
              <h2 className="text-lg font-bold text-white mb-4">Commission Share</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ytdData}
                      dataKey="commissions"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {ytdData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => typeof value === 'number' ? formatCurrency(value) : value} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-neutral-900 rounded-xl border border-white/10 p-6">
              <h2 className="text-lg font-bold text-white mb-4">Performance Metrics</h2>
              <div className="space-y-4">
                {sortedReps.slice(0, 4).map((rep, index) => {
                  const maxCommission = sortedReps[0]?.totalCommissions || 1;
                  const percentage = (rep.totalCommissions / maxCommission) * 100;

                  return (
                    <div key={rep.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-neutral-300">{rep.name.split(' ')[0]}</span>
                        <span className="text-neutral-500">{formatCurrency(rep.totalCommissions)}</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-3">
                        <div
                          className="h-3 rounded-full transition-all"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: CHART_COLORS[index],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Individual Rep Cards */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center">
          <Users className="w-5 h-5 mr-2 text-neutral-400" />
          Rep Performance Cards
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedReps.map((rep, index) => (
            <div
              key={rep.name}
              className={`bg-neutral-900 rounded-xl border border-white/10 overflow-hidden transition-all hover:border-white/20 ${
                index === 0 ? 'border-yellow-400 ring-2 ring-yellow-400/20' : 'border-white/10'
              }`}
            >
              <div className={`p-4 ${index === 0 ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-gradient-to-r from-gray-800 to-gray-900'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                      index === 0 ? 'bg-white text-yellow-400' : 'bg-brand-green text-black'
                    }`}>
                      {rep.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h3 className={`font-bold ${index === 0 ? 'text-black' : 'text-white'}`}>
                        {rep.name}
                      </h3>
                      <p className={`text-sm ${index === 0 ? 'text-yellow-900' : 'text-neutral-500'}`}>
                        Sales Representative
                      </p>
                    </div>
                  </div>
                  {index === 0 && (
                    <div className="flex items-center space-x-1">
                      <Flame className="w-5 h-5 text-orange-600" />
                      <span className="text-xs font-bold text-orange-600">HOT</span>
                    </div>
                  )}
                  {index < 3 && (
                    <div className="w-8 h-8 flex items-center justify-center">
                      {getRankBadge(index)}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wide">Total Earned</p>
                    <p className="text-lg font-bold text-white">
                      {formatCurrencyFull(rep.totalCommissions)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wide">Total Deals</p>
                    <p className="text-lg font-bold text-white">{rep.transactionCount}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wide">Avg Per Deal</p>
                    <p className="text-sm font-semibold text-brand-green">
                      {formatCurrency(rep.avgTransaction)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wide">Share of Total</p>
                    <p className="text-sm font-semibold text-neutral-300">
                      {rep.percentOfTotal}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Banner */}
      <div className="bg-gradient-to-r from-black to-gray-900 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold flex items-center">
              <Star className="w-6 h-6 text-brand-green mr-2" />
              Grand Total Commissions
            </h3>
            <p className="text-neutral-500 mt-1">All time earnings across all sales representatives</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-brand-green">
              {formatCurrencyFull(summary.totalCommissions)}
            </p>
            <p className="text-sm text-neutral-500 mt-1">
              {totalTransactions.toLocaleString()} total transactions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
