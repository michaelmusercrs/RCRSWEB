// Server Component - no client interactivity needed

import { Truck, Package, ClipboardCheck, BarChart3, TrendingUp, Zap } from 'lucide-react';

const deliveryLifecycle = [
  { status: 'Ordered', description: 'Material order placed', icon: '1', color: 'bg-blue-500' },
  { status: 'Staged', description: 'Pulled & ready at warehouse', icon: '2', color: 'bg-amber-500' },
  { status: 'In Transit', description: 'Driver departed', icon: '3', color: 'bg-purple-500' },
  { status: 'Delivered', description: 'Confirmed at jobsite', icon: '4', color: 'bg-brand-green' },
];

const inventoryItems = [
  { name: '3-Tab Shingles', stock: 340, capacity: 500, unit: 'bundles' },
  { name: 'Architectural Shingles', stock: 280, capacity: 400, unit: 'bundles' },
  { name: 'Synthetic Underlayment', stock: 85, capacity: 150, unit: 'rolls' },
  { name: 'Drip Edge (10ft)', stock: 120, capacity: 200, unit: 'pieces' },
  { name: 'Ridge Cap', stock: 65, capacity: 100, unit: 'bundles' },
  { name: 'Pipe Boots', stock: 42, capacity: 80, unit: 'pieces' },
  { name: 'Ice & Water Shield', stock: 30, capacity: 60, unit: 'rolls' },
  { name: 'Starter Strip', stock: 55, capacity: 100, unit: 'rolls' },
];

const checklistItems = [
  { item: 'Materials match delivery ticket', critical: true },
  { item: 'Quantities verified', critical: true },
  { item: 'No damaged materials loaded', critical: true },
  { item: 'Load properly secured', critical: true },
  { item: 'Truck photographed', critical: false },
  { item: 'Delivery address confirmed', critical: true },
  { item: 'Special instructions reviewed', critical: false },
  { item: 'PPE on truck', critical: true },
];

const deliveryVolume = [
  { month: 'Sep', count: 42 },
  { month: 'Oct', count: 58 },
  { month: 'Nov', count: 51 },
  { month: 'Dec', count: 35 },
  { month: 'Jan', count: 48 },
  { month: 'Feb', count: 62 },
];

const maxDeliveries = Math.max(...deliveryVolume.map(d => d.count));

export default function FieldOperationsInfographic() {
  return (
    <div className="p-6 sm:p-8 space-y-8">
      {/* Title */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-white mb-1">Field Operations & Delivery</h3>
        <p className="text-sm text-neutral-400">Delivery lifecycle, inventory levels, checklists & volume trends</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Deliveries/Month', value: '49', icon: Truck, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: 'On-Time Rate', value: '94%', icon: ClipboardCheck, color: 'text-brand-green', bg: 'bg-brand-green/10 border-brand-green/20' },
          { label: 'Material Items', value: '8', icon: Package, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Avg Load Time', value: '35 min', icon: BarChart3, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className={`rounded-xl border p-4 ${kpi.bg}`}>
              <Icon size={18} className={`${kpi.color} mb-2`} />
              <p className="text-xl font-bold text-white">{kpi.value}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      {/* Delivery Lifecycle */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Truck size={18} className="text-blue-400" />
          <span className="text-sm font-semibold text-white">Delivery Lifecycle</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {deliveryLifecycle.map((step, idx) => (
            <div key={step.status} className="flex-1 flex items-center gap-2">
              <div className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-center">
                <div className={`w-8 h-8 rounded-full ${step.color} mx-auto mb-2 flex items-center justify-center text-white text-sm font-bold`}>
                  {step.icon}
                </div>
                <p className="text-sm font-semibold text-white">{step.status}</p>
                <p className="text-[11px] text-neutral-400 mt-1">{step.description}</p>
              </div>
              {idx < deliveryLifecycle.length - 1 && (
                <div className="text-neutral-600 flex-shrink-0 rotate-90 sm:rotate-0">
                  <TrendingUp size={14} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Inventory Levels */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package size={18} className="text-amber-400" />
          <span className="text-sm font-semibold text-white">Current Inventory Levels</span>
        </div>
        <div className="space-y-3">
          {inventoryItems.map((item) => {
            const pct = item.capacity > 0 ? (item.stock / item.capacity) * 100 : 0;
            const isLow = pct < 40;
            return (
              <div key={item.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white font-medium">{item.name}</span>
                  <span className={`text-xs font-mono ${isLow ? 'text-amber-400' : 'text-neutral-400'}`}>
                    {item.stock}/{item.capacity} {item.unit}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isLow
                        ? 'bg-gradient-to-r from-amber-500/80 to-yellow-400/80'
                        : 'bg-gradient-to-r from-brand-green/80 to-emerald-400/80'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-brand-green/80" />
              <span>Healthy Stock</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-amber-500/80" />
              <span>Low Stock (&lt;40%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Checklist */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardCheck size={18} className="text-brand-green" />
          <span className="text-sm font-semibold text-white">Loading Checklist (8 Items)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {checklistItems.map((item) => (
            <div key={item.item} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
              <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                item.critical ? 'bg-red-500/20 border border-red-500/30' : 'bg-white/10 border border-white/10'
              }`}>
                <span className="text-[10px]">{item.critical ? '!' : '-'}</span>
              </div>
              <span className="text-xs text-neutral-300">{item.item}</span>
              {item.critical && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/10 text-red-400 ml-auto flex-shrink-0">Required</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Delivery Volume Trend */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-purple-400" />
          <span className="text-sm font-semibold text-white">Monthly Delivery Volume</span>
        </div>
        <div className="space-y-3">
          {deliveryVolume.map((month) => {
            const barWidth = maxDeliveries > 0 ? (month.count / maxDeliveries) * 100 : 0;
            return (
              <div key={month.month}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white font-medium w-8">{month.month}</span>
                  <span className="text-xs text-neutral-400 font-mono">{month.count} deliveries</span>
                </div>
                <div className="h-3 rounded-full bg-neutral-800 overflow-hidden ml-8">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500/80 to-pink-400/80 transition-all duration-700"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key Insights */}
      <div className="rounded-xl border border-brand-green/20 bg-brand-green/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={18} className="text-brand-green" />
          <span className="text-sm font-semibold text-brand-green">Key Insights</span>
        </div>
        <ul className="space-y-2">
          {[
            '94% on-time delivery rate -- every missed delivery impacts customer satisfaction.',
            'Ice & Water Shield and Pipe Boots are below 50% stock -- reorder soon.',
            'February shows highest delivery volume (62) -- ensure adequate driver coverage.',
            'Loading checklist has 6 critical items that must pass before departure.',
            'Average load time of 35 minutes -- aim to maintain or improve this benchmark.',
          ].map((insight, i) => (
            <li key={i} className="text-sm text-neutral-300 flex gap-2">
              <span className="text-brand-green flex-shrink-0">&#8226;</span>
              {insight}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
