'use client';

/**
 * RCRS Command Center - Meeting Charts Components
 *
 * Recharts-based graphs for the Monday meeting presentation.
 * Matches existing dark theme (zinc-900 bg, #39FF14 brand green).
 * Used in both the presentation slides and the finalize/approval page.
 */

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, Legend, Cell,
} from 'recharts';

// ============================================================================
// Shared constants
// ============================================================================

const CHART_COLORS = ['#39FF14', '#00D4FF', '#FF6B6B', '#FFD93D', '#A855F7', '#F97316', '#EC4899', '#14B8A6', '#8B5CF6', '#F59E0B'];

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

const tooltipStyle = {
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  color: '#fff',
};

// ============================================================================
// Types
// ============================================================================

interface RevenueTrendItem {
  label: string;
  revenue: number;
  inspected: number;
  damage: number;
  signed: number;
}

interface CommissionTrendItem {
  label: string;
  commissions: number;
  transactions: number;
}

interface RepSalesItem {
  name: string;
  revenue: number;
}

interface RepCommissionItem {
  name: string;
  commissions: number;
}

interface QuarterlyItem {
  label: string;
  revenue: number;
  commissions: number;
}

// ============================================================================
// 1. Revenue Trend Chart (Bar)
// ============================================================================

export function RevenueTrendChart({ data, height = 350 }: { data: RevenueTrendItem[]; height?: number }) {
  if (!data || data.length === 0) return <EmptyChart label="No revenue data" />;

  return (
    <div className="bg-zinc-800/80 rounded-2xl p-6 border border-zinc-700">
      <h3 className="text-2xl font-bold text-white mb-4">Revenue Trend</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
          <XAxis dataKey="label" tick={{ fill: '#a1a1aa', fontSize: 12 }} stroke="#3f3f46" />
          <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} stroke="#3f3f46" tickFormatter={formatCurrency} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
          />
          <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === data.length - 1 ? '#39FF14' : '#22c55e'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================================
// 2. Commission Trend Chart (Area)
// ============================================================================

export function CommissionTrendChart({ data, height = 350 }: { data: CommissionTrendItem[]; height?: number }) {
  if (!data || data.length === 0) return <EmptyChart label="No commission data" />;

  return (
    <div className="bg-zinc-800/80 rounded-2xl p-6 border border-zinc-700">
      <h3 className="text-2xl font-bold text-white mb-4">Commission Payouts</h3>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="commGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#00D4FF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
          <XAxis dataKey="label" tick={{ fill: '#a1a1aa', fontSize: 12 }} stroke="#3f3f46" />
          <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} stroke="#3f3f46" tickFormatter={formatCurrency} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [
              name === 'commissions' ? formatCurrency(Number(value)) : Number(value).toLocaleString(),
              name === 'commissions' ? 'Commissions' : 'Transactions'
            ]}
          />
          <Area
            type="monotone"
            dataKey="commissions"
            name="commissions"
            stroke="#00D4FF"
            strokeWidth={2}
            fill="url(#commGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================================
// 3. Rep Sales Comparison (Horizontal Bar)
// ============================================================================

export function RepSalesChart({ data, height = 400 }: { data: RepSalesItem[]; height?: number }) {
  if (!data || data.length === 0) return <EmptyChart label="No rep sales data" />;

  const chartHeight = Math.max(height, data.length * 45);

  return (
    <div className="bg-zinc-800/80 rounded-2xl p-6 border border-zinc-700">
      <h3 className="text-2xl font-bold text-white mb-4">Sales by Rep</h3>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
          <XAxis type="number" tick={{ fill: '#a1a1aa', fontSize: 12 }} stroke="#3f3f46" tickFormatter={formatCurrency} />
          <YAxis dataKey="name" type="category" tick={{ fill: '#d4d4d8', fontSize: 13 }} stroke="#3f3f46" width={120} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatCurrency(Number(value)), 'Revenue']} />
          <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================================
// 4. Rep Commission Comparison (Horizontal Bar)
// ============================================================================

export function RepCommissionsChart({ data, height = 400 }: { data: RepCommissionItem[]; height?: number }) {
  if (!data || data.length === 0) return <EmptyChart label="No rep commission data" />;

  const chartHeight = Math.max(height, data.length * 45);

  return (
    <div className="bg-zinc-800/80 rounded-2xl p-6 border border-zinc-700">
      <h3 className="text-2xl font-bold text-white mb-4">Commissions by Rep</h3>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
          <XAxis type="number" tick={{ fill: '#a1a1aa', fontSize: 12 }} stroke="#3f3f46" tickFormatter={formatCurrency} />
          <YAxis dataKey="name" type="category" tick={{ fill: '#d4d4d8', fontSize: 13 }} stroke="#3f3f46" width={120} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatCurrency(Number(value)), 'Commissions']} />
          <Bar dataKey="commissions" name="Commissions" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================================
// 5. Key Metrics Over Time (Multi-line)
// ============================================================================

export function KeyMetricsChart({ data, height = 350 }: { data: RevenueTrendItem[]; height?: number }) {
  if (!data || data.length === 0) return <EmptyChart label="No metrics data" />;

  return (
    <div className="bg-zinc-800/80 rounded-2xl p-6 border border-zinc-700">
      <h3 className="text-2xl font-bold text-white mb-4">Key Metrics Over Time</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
          <XAxis dataKey="label" tick={{ fill: '#a1a1aa', fontSize: 12 }} stroke="#3f3f46" />
          <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} stroke="#3f3f46" />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ color: '#a1a1aa' }} />
          <Line type="monotone" dataKey="inspected" name="Inspected" stroke="#39FF14" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="damage" name="Damage" stroke="#FF6B6B" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="signed" name="Signed" stroke="#00D4FF" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================================
// 6. Quarterly Breakdown (Grouped Bar)
// ============================================================================

export function QuarterlyChart({ data, height = 350 }: { data: QuarterlyItem[]; height?: number }) {
  if (!data || data.length === 0) return <EmptyChart label="No quarterly data" />;

  return (
    <div className="bg-zinc-800/80 rounded-2xl p-6 border border-zinc-700">
      <h3 className="text-2xl font-bold text-white mb-4">Quarter-over-Quarter ({new Date().getFullYear()})</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
          <XAxis dataKey="label" tick={{ fill: '#a1a1aa', fontSize: 14 }} stroke="#3f3f46" />
          <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} stroke="#3f3f46" tickFormatter={formatCurrency} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
          <Legend wrapperStyle={{ color: '#a1a1aa' }} />
          <Bar dataKey="revenue" name="Sales Revenue" fill="#39FF14" radius={[4, 4, 0, 0]} />
          <Bar dataKey="commissions" name="Commissions" fill="#00D4FF" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================================
// Empty state
// ============================================================================

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="bg-zinc-800/80 rounded-2xl p-8 border border-zinc-700 flex items-center justify-center h-[200px]">
      <p className="text-xl text-zinc-500">{label}</p>
    </div>
  );
}

// ============================================================================
// Combined presentation views
// ============================================================================

export interface ChartData {
  revenueTrend: RevenueTrendItem[];
  commissionTrend: CommissionTrendItem[];
  repSales: RepSalesItem[];
  repCommissions: RepCommissionItem[];
  keyMetrics: RevenueTrendItem[];
  quarterly: QuarterlyItem[];
}

export function SalesChartsSlide({ data }: { data: ChartData | null }) {
  if (!data) return <EmptyChart label="Loading chart data..." />;

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-4xl font-bold text-center text-white mb-2">Sales Performance</h2>
      <div className="grid grid-cols-2 gap-6">
        <RevenueTrendChart data={data.revenueTrend} height={280} />
        <RepSalesChart data={data.repSales} height={280} />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <KeyMetricsChart data={data.keyMetrics} height={250} />
        <QuarterlyChart data={data.quarterly} height={250} />
      </div>
    </div>
  );
}

export function CommissionChartsSlide({ data }: { data: ChartData | null }) {
  if (!data) return <EmptyChart label="Loading chart data..." />;

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-4xl font-bold text-center text-white mb-2">Commission Performance</h2>
      <div className="grid grid-cols-2 gap-6">
        <CommissionTrendChart data={data.commissionTrend} height={280} />
        <RepCommissionsChart data={data.repCommissions} height={280} />
      </div>
      <QuarterlyChart data={data.quarterly} height={280} />
    </div>
  );
}
