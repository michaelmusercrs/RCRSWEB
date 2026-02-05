'use client';

import { useState, useMemo } from 'react';
import {
  Trophy, TrendingUp, DollarSign, Users, Calendar,
  ChevronUp, ChevronDown, Award, Target, Flame, Star
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';

// Commission data from Monday meeting tracking
const COMMISSION_DATA = {
  reps: [
    { name: 'Hunter Rivers', totalCommissions: 740163.97, transactions: 1159, startDate: '2019-01-04', lastDate: '2026-01-30' },
    { name: 'Aaron Lussi', totalCommissions: 605777.19, transactions: 1039, startDate: '2020-02-21', lastDate: '2026-01-30' },
    { name: 'Richard Geahr', totalCommissions: 369720.56, transactions: 593, startDate: '2020-09-04', lastDate: '2026-01-16' },
    { name: 'Adam Rudell', totalCommissions: 365956.07, transactions: 605, startDate: '2019-12-27', lastDate: '2026-01-30' },
    { name: 'Brendon Muse', totalCommissions: 342266.30, transactions: 551, startDate: '2019-12-23', lastDate: '2026-01-09' },
    { name: 'Gregory Ray Muse', totalCommissions: 195119.66, transactions: 252, startDate: '2024-05-03', lastDate: '2026-01-16' },
  ],
  grandTotal: 2619003.75,
};

// Simulated monthly data for charts (based on real patterns)
const MONTHLY_DATA = [
  { month: 'Aug 2025', hunter: 45000, aaron: 38000, richard: 22000, adam: 21000, brendon: 18000, greg: 15000 },
  { month: 'Sep 2025', hunter: 52000, aaron: 41000, richard: 28000, adam: 25000, brendon: 22000, greg: 18000 },
  { month: 'Oct 2025', hunter: 48000, aaron: 45000, richard: 25000, adam: 28000, brendon: 20000, greg: 16000 },
  { month: 'Nov 2025', hunter: 55000, aaron: 42000, richard: 30000, adam: 26000, brendon: 24000, greg: 19000 },
  { month: 'Dec 2025', hunter: 38000, aaron: 35000, richard: 18000, adam: 20000, brendon: 15000, greg: 12000 },
  { month: 'Jan 2026', hunter: 62000, aaron: 48000, richard: 32000, adam: 30000, brendon: 28000, greg: 22000 },
];

// Weekly performance data
const WEEKLY_DATA = [
  { week: 'Week 1', total: 145000, target: 130000 },
  { week: 'Week 2', total: 168000, target: 130000 },
  { week: 'Week 3', total: 152000, target: 130000 },
  { week: 'Week 4', total: 178000, target: 130000 },
];

// YTD performance by rep
const YTD_DATA = COMMISSION_DATA.reps.map(rep => ({
  name: rep.name.split(' ')[0],
  commissions: rep.totalCommissions,
  transactions: rep.transactions,
  avgPerTransaction: Math.round(rep.totalCommissions / rep.transactions),
}));

const CHART_COLORS = ['#39FF14', '#00D4FF', '#FF6B6B', '#FFD93D', '#A855F7', '#F97316'];

type ViewMode = 'weekly' | 'monthly' | 'ytd';
type SortBy = 'commissions' | 'transactions' | 'average';

export default function SalesCommissionsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [sortBy, setSortBy] = useState<SortBy>('commissions');
  const [selectedRep, setSelectedRep] = useState<string | null>(null);

  // Sort leaderboard data
  const sortedReps = useMemo(() => {
    return [...COMMISSION_DATA.reps].sort((a, b) => {
      switch (sortBy) {
        case 'transactions':
          return b.transactions - a.transactions;
        case 'average':
          return (b.totalCommissions / b.transactions) - (a.totalCommissions / a.transactions);
        default:
          return b.totalCommissions - a.totalCommissions;
      }
    });
  }, [sortBy]);

  // Calculate stats
  const stats = useMemo(() => {
    const currentMonthTotal = MONTHLY_DATA[MONTHLY_DATA.length - 1];
    const prevMonthTotal = MONTHLY_DATA[MONTHLY_DATA.length - 2];

    const currentSum = Object.values(currentMonthTotal).reduce<number>((acc, val) =>
      typeof val === 'number' ? acc + val : acc, 0);
    const prevSum = Object.values(prevMonthTotal).reduce<number>((acc, val) =>
      typeof val === 'number' ? acc + val : acc, 0);

    const monthGrowth = ((currentSum - prevSum) / prevSum * 100).toFixed(1);

    const weeklyTotal = WEEKLY_DATA.reduce((acc, week) => acc + week.total, 0);
    const weeklyTarget = WEEKLY_DATA.reduce((acc, week) => acc + week.target, 0);

    return {
      totalCommissions: COMMISSION_DATA.grandTotal,
      monthlyGrowth: monthGrowth,
      weeklyTotal,
      weeklyTarget,
      weeklyPct: ((weeklyTotal / weeklyTarget) * 100).toFixed(0),
      topPerformer: sortedReps[0],
    };
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
    if (index === 1) return <Award className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="text-gray-500 font-bold">#{index + 1}</span>;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales & Commissions</h1>
          <p className="text-gray-600 mt-2">
            Track sales performance, commissions, and rep rankings
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('weekly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'weekly'
                ? 'bg-[#39FF14] text-black'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'monthly'
                ? 'bg-[#39FF14] text-black'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setViewMode('ytd')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'ytd'
                ? 'bg-[#39FF14] text-black'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Commissions</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(stats.totalCommissions)}
              </p>
              <p className="text-xs text-gray-500 mt-1">All time earnings</p>
            </div>
            <div className="bg-[#39FF14]/20 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-[#39FF14]" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Monthly Growth</p>
              <p className="text-2xl font-bold text-gray-900 mt-1 flex items-center">
                <span className={parseFloat(stats.monthlyGrowth) >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {parseFloat(stats.monthlyGrowth) >= 0 ? '+' : ''}{stats.monthlyGrowth}%
                </span>
                {parseFloat(stats.monthlyGrowth) >= 0 ? (
                  <ChevronUp className="w-5 h-5 text-green-600 ml-1" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-red-600 ml-1" />
                )}
              </p>
              <p className="text-xs text-gray-500 mt-1">vs last month</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Weekly Target</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.weeklyPct}%
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-[#39FF14] h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(parseInt(stats.weeklyPct), 100)}%` }}
                />
              </div>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Top Performer</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {stats.topPerformer.name.split(' ')[0]}
              </p>
              <p className="text-xs text-[#39FF14] font-semibold mt-1">
                {formatCurrency(stats.topPerformer.totalCommissions)}
              </p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Trophy className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <Trophy className="w-5 h-5 text-yellow-500 mr-2" />
                Leaderboard
              </h2>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-[#39FF14] focus:border-transparent"
              >
                <option value="commissions">By Commissions</option>
                <option value="transactions">By Transactions</option>
                <option value="average">By Avg/Deal</option>
              </select>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {sortedReps.map((rep, index) => (
              <div
                key={rep.name}
                onClick={() => setSelectedRep(selectedRep === rep.name ? null : rep.name)}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedRep === rep.name ? 'bg-[#39FF14]/10' : ''
                } ${index === 0 ? 'bg-yellow-50/50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 flex items-center justify-center">
                      {getRankBadge(index)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{rep.name}</p>
                      <p className="text-xs text-gray-500">{rep.transactions} deals</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">
                      {formatCurrency(rep.totalCommissions)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Avg: {formatCurrency(rep.totalCommissions / rep.transactions)}
                    </p>
                  </div>
                </div>
                {selectedRep === rep.name && (
                  <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Started</p>
                      <p className="font-medium">{new Date(rep.startDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Last Active</p>
                      <p className="font-medium">{new Date(rep.lastDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Charts Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Commission Trend Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Commission Trends</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                {viewMode === 'monthly' ? (
                  <AreaChart data={MONTHLY_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6b7280" />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value) => typeof value === 'number' ? formatCurrency(value) : value}
                      contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="hunter" name="Hunter" stackId="1" stroke="#39FF14" fill="#39FF14" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="aaron" name="Aaron" stackId="1" stroke="#00D4FF" fill="#00D4FF" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="richard" name="Richard" stackId="1" stroke="#FF6B6B" fill="#FF6B6B" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="adam" name="Adam" stackId="1" stroke="#FFD93D" fill="#FFD93D" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="brendon" name="Brendon" stackId="1" stroke="#A855F7" fill="#A855F7" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="greg" name="Greg" stackId="1" stroke="#F97316" fill="#F97316" fillOpacity={0.6} />
                  </AreaChart>
                ) : viewMode === 'weekly' ? (
                  <BarChart data={WEEKLY_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="#6b7280" />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value) => typeof value === 'number' ? formatCurrency(value) : value}
                      contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Bar dataKey="total" name="Actual" fill="#39FF14" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="target" name="Target" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <BarChart data={YTD_DATA} layout="vertical">
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
                    <Bar dataKey="commissions" name="Total Commissions" fill="#39FF14" radius={[0, 4, 4, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Commission Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Commission Share</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={YTD_DATA}
                      dataKey="commissions"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {YTD_DATA.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => typeof value === 'number' ? formatCurrency(value) : value} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Performance Metrics</h2>
              <div className="space-y-4">
                {sortedReps.slice(0, 4).map((rep, index) => {
                  const maxCommission = sortedReps[0].totalCommissions;
                  const percentage = (rep.totalCommissions / maxCommission) * 100;

                  return (
                    <div key={rep.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{rep.name.split(' ')[0]}</span>
                        <span className="text-gray-500">{formatCurrency(rep.totalCommissions)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
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
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
          <Users className="w-5 h-5 mr-2 text-gray-600" />
          Rep Performance Cards
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedReps.map((rep, index) => (
            <div
              key={rep.name}
              className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all hover:shadow-md ${
                index === 0 ? 'border-yellow-400 ring-2 ring-yellow-400/20' : 'border-gray-200'
              }`}
            >
              <div className={`p-4 ${index === 0 ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-gradient-to-r from-gray-800 to-gray-900'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                      index === 0 ? 'bg-white text-yellow-600' : 'bg-[#39FF14] text-black'
                    }`}>
                      {rep.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h3 className={`font-bold ${index === 0 ? 'text-black' : 'text-white'}`}>
                        {rep.name}
                      </h3>
                      <p className={`text-sm ${index === 0 ? 'text-yellow-900' : 'text-gray-400'}`}>
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
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Total Earned</p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrencyFull(rep.totalCommissions)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Total Deals</p>
                    <p className="text-lg font-bold text-gray-900">{rep.transactions}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Per Deal</p>
                    <p className="text-sm font-semibold text-[#39FF14]">
                      {formatCurrency(rep.totalCommissions / rep.transactions)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Active Since</p>
                    <p className="text-sm font-semibold text-gray-700">
                      {new Date(rep.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
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
              <Star className="w-6 h-6 text-[#39FF14] mr-2" />
              Grand Total Commissions
            </h3>
            <p className="text-gray-400 mt-1">All time earnings across all sales representatives</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-[#39FF14]">
              {formatCurrencyFull(COMMISSION_DATA.grandTotal)}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {COMMISSION_DATA.reps.reduce((acc, rep) => acc + rep.transactions, 0).toLocaleString()} total transactions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
