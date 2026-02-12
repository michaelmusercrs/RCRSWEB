'use client';

import { Layout, Database, ArrowRightLeft, Globe, Server, Zap } from 'lucide-react';

const portalFeatures = [
  { name: 'Sales Portal', path: '/portal/sales', features: 6, role: 'Sales' },
  { name: 'Logistics', path: '/portal/delivery', features: 5, role: 'Drivers' },
  { name: 'Inventory', path: '/portal/inventory', features: 4, role: 'Office' },
  { name: 'Calendar', path: '/portal/calendar', features: 4, role: 'All' },
  { name: 'Training Hub', path: '/portal/training', features: 3, role: 'All' },
  { name: 'Chat', path: '/portal/chat', features: 3, role: 'All' },
  { name: 'RoofStack HQ', path: '/command-center', features: 5, role: 'Admin' },
  { name: 'Customer Portal', path: '/customer-portal', features: 6, role: 'Customers' },
];

const dataFlowSteps = [
  { from: 'Customer/Lead', to: 'Website Form', color: 'bg-blue-500' },
  { from: 'Website Form', to: 'Google Sheets', color: 'bg-brand-green' },
  { from: 'Google Sheets', to: 'Portal API', color: 'bg-amber-500' },
  { from: 'Portal API', to: 'Dashboard', color: 'bg-purple-500' },
];

const integrations = [
  { name: 'Google Sheets', type: 'Data Store', status: 'Active', color: 'text-green-400' },
  { name: 'JobNimbus', type: 'CRM', status: 'Active', color: 'text-green-400' },
  { name: 'TeamUp', type: 'Calendar', status: 'Active', color: 'text-green-400' },
  { name: 'GroupMe', type: 'Messaging', status: 'Active', color: 'text-green-400' },
  { name: 'Vercel Blob', type: 'File Storage', status: 'Active', color: 'text-green-400' },
  { name: 'Google Analytics', type: 'Analytics', status: 'Active', color: 'text-green-400' },
];

const systemStats = [
  { label: 'Total Pages', value: '367+' },
  { label: 'API Routes', value: '180+' },
  { label: 'Components', value: '85+' },
  { label: 'Library Files', value: '95+' },
];

const maxFeatures = Math.max(...portalFeatures.map(f => f.features));

export default function PlatformOnboardingInfographic() {
  return (
    <div className="p-6 sm:p-8 space-y-8">
      {/* Title */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-white mb-1">RoofStack Platform & Tools Overview</h3>
        <p className="text-sm text-neutral-400">Feature map, data flow, integrations & system architecture</p>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {systemStats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
            <p className="text-2xl font-bold text-brand-green">{stat.value}</p>
            <p className="text-xs text-neutral-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Portal Feature Map */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Layout size={18} className="text-blue-400" />
          <span className="text-sm font-semibold text-white">Portal Feature Map</span>
        </div>
        <div className="space-y-3">
          {portalFeatures.map((portal) => {
            const barWidth = maxFeatures > 0 ? (portal.features / maxFeatures) * 100 : 0;
            return (
              <div key={portal.name}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-medium">{portal.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-500">{portal.role}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-neutral-400">
                    <span className="font-mono text-neutral-500">{portal.path}</span>
                    <span>{portal.features} features</span>
                  </div>
                </div>
                <div className="h-3 rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500/80 to-cyan-400/80 transition-all duration-700"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data Flow Diagram */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <ArrowRightLeft size={18} className="text-brand-green" />
          <span className="text-sm font-semibold text-white">Data Flow Pipeline</span>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-0">
          {dataFlowSteps.map((step, idx) => (
            <div key={step.from} className="flex items-center gap-2 sm:flex-1">
              <div className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-center">
                <div className={`w-3 h-3 rounded-full ${step.color} mx-auto mb-2`} />
                <p className="text-xs font-medium text-white">{step.from}</p>
              </div>
              {idx < dataFlowSteps.length - 1 && (
                <div className="text-neutral-600 flex-shrink-0 rotate-90 sm:rotate-0">
                  <ArrowRightLeft size={14} />
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-neutral-500 text-center mt-3">
          Data flows from customer input through Sheets storage to portal dashboards
        </p>
      </div>

      {/* Integration Hub */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={18} className="text-purple-400" />
          <span className="text-sm font-semibold text-white">Integration Hub</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {integrations.map((int) => (
            <div key={int.name} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">{int.name}</p>
                <p className="text-xs text-neutral-500">{int.type}</p>
              </div>
              <span className={`text-xs font-semibold ${int.color}`}>{int.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture Layers */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Server size={18} className="text-amber-400" />
          <span className="text-sm font-semibold text-white">Architecture Layers</span>
        </div>
        <div className="space-y-2">
          {[
            { layer: 'Frontend', tech: 'Next.js 14, React 18, Tailwind CSS', color: 'from-blue-500/60 to-cyan-400/40', width: '100%' },
            { layer: 'API Layer', tech: '180+ serverless routes on Vercel', color: 'from-brand-green/60 to-emerald-400/40', width: '90%' },
            { layer: 'Auth', tech: 'JWT admin + token-based customer', color: 'from-amber-500/60 to-yellow-400/40', width: '70%' },
            { layer: 'Data', tech: 'Google Sheets API + JobNimbus', color: 'from-purple-500/60 to-pink-400/40', width: '85%' },
            { layer: 'Storage', tech: 'Vercel Blob for files & uploads', color: 'from-red-500/60 to-orange-400/40', width: '60%' },
          ].map((item) => (
            <div key={item.layer} className="flex items-center gap-3">
              <span className="text-xs text-neutral-400 w-16 text-right flex-shrink-0">{item.layer}</span>
              <div className="flex-1">
                <div
                  className={`h-8 rounded-lg bg-gradient-to-r ${item.color} flex items-center px-3 transition-all duration-700`}
                  style={{ width: item.width }}
                >
                  <span className="text-[11px] font-medium text-white truncate">{item.tech}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Insights */}
      <div className="rounded-xl border border-brand-green/20 bg-brand-green/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={18} className="text-brand-green" />
          <span className="text-sm font-semibold text-brand-green">Key Takeaways</span>
        </div>
        <ul className="space-y-2">
          {[
            '8 portal sections serve different roles -- know which ones are yours.',
            'All data flows through Google Sheets as the single source of truth.',
            '6 active integrations connect the platform to external tools and services.',
            '180+ API routes handle everything from lead capture to commission tracking.',
            'The platform serves 367+ pages across public site and internal portals.',
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
