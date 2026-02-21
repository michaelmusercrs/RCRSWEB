'use client';

import { useMemo } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

// =============================================================================
// Types
// =============================================================================

interface DNAProfile {
  closingPower: number;
  volume: number;
  revenue: number;
  dealSize: number;
  consistency: number;
}

// =============================================================================
// Utility
// =============================================================================

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// =============================================================================
// Components
// =============================================================================

export function DNAChart({ dna }: { dna: DNAProfile }) {
  const data = [
    { subject: 'Closing Power', value: dna.closingPower, fullMark: 100 },
    { subject: 'Volume', value: dna.volume, fullMark: 100 },
    { subject: 'Revenue', value: dna.revenue, fullMark: 100 },
    { subject: 'Deal Size', value: dna.dealSize, fullMark: 100 },
    { subject: 'Consistency', value: dna.consistency, fullMark: 100 },
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid stroke="#374151" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: '#9CA3AF', fontSize: 12 }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fill: '#6B7280', fontSize: 10 }}
        />
        <Radar
          name="DNA"
          dataKey="value"
          stroke="#39FF14"
          fill="#39FF14"
          fillOpacity={0.3}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function PerformanceChart({ transactions }: { transactions: Array<{ date: string; amount: number }> }) {
  const weeklyData = useMemo(() => {
    const byWeek: Record<string, number> = {};

    transactions.forEach(t => {
      const date = new Date(t.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];

      byWeek[weekKey] = (byWeek[weekKey] || 0) + t.amount;
    });

    return Object.entries(byWeek)
      .map(([week, amount]) => ({
        week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        amount,
      }))
      .slice(-12);
  }, [transactions]);

  if (weeklyData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-neutral-500">
        No transaction data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={weeklyData}>
        <defs>
          <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#39FF14" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#39FF14" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="week"
          tick={{ fill: '#9CA3AF', fontSize: 10 }}
          axisLine={{ stroke: '#374151' }}
        />
        <YAxis
          tick={{ fill: '#9CA3AF', fontSize: 10 }}
          axisLine={{ stroke: '#374151' }}
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #374151',
            borderRadius: '8px',
          }}
          labelStyle={{ color: '#9CA3AF' }}
          formatter={(value) => [formatCurrency(value as number), 'Amount']}
        />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="#39FF14"
          fillOpacity={1}
          fill="url(#colorAmount)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
