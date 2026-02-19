'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const CHART_COLORS = ['#39FF14', '#00D4FF', '#FF6B6B', '#FFD93D', '#A855F7', '#F97316'];

interface ChartDataItem {
  name: string;
  commissions: number;
  transactions: number;
  avgPerTransaction: number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function CommissionBarChart({ data }: { data: ChartDataItem[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical">
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
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CommissionPieChart({ data }: { data: ChartDataItem[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="commissions"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => typeof value === 'number' ? formatCurrency(value) : value} />
      </PieChart>
    </ResponsiveContainer>
  );
}
