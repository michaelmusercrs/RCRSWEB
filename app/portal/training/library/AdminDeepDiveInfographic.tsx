'use client';

import { Server, Shield, Database, Globe, GitBranch, Zap } from 'lucide-react';

const architectureLayers = [
  { layer: 'Client', tech: 'React 18 + Next.js 14 App Router', items: ['367+ pages', '85+ components', 'Tailwind CSS'], color: 'from-blue-500/60 to-cyan-400/40' },
  { layer: 'API', tech: '180+ Serverless Routes (Vercel)', items: ['REST endpoints', 'JWT auth', 'Rate limiting'], color: 'from-brand-green/60 to-emerald-400/40' },
  { layer: 'Data', tech: 'Google Sheets + JobNimbus', items: ['Sheets API', 'JN Sync Engine', 'Webhook listeners'], color: 'from-amber-500/60 to-yellow-400/40' },
  { layer: 'Storage', tech: 'Vercel Blob + Static Assets', items: ['File uploads', 'Training media', 'Public assets'], color: 'from-purple-500/60 to-pink-400/40' },
];

const apiCategories = [
  { category: 'Portal / Sales', count: 25, examples: 'leads, pipeline, commissions' },
  { category: 'Portal / Delivery', count: 15, examples: 'orders, status, checklists' },
  { category: 'Portal / Inventory', count: 12, examples: 'stock, transactions, orders' },
  { category: 'Portal / Training', count: 8, examples: 'modules, quiz-submit, progress' },
  { category: 'Portal / Admin', count: 18, examples: 'users, settings, billing' },
  { category: 'Customer Portal', count: 14, examples: 'auth, timeline, messages' },
  { category: 'Public / Forms', count: 6, examples: 'contact, referral, check-address' },
  { category: 'Webhooks', count: 5, examples: 'jobnimbus, groupme, teamup' },
  { category: 'Integrations', count: 10, examples: 'sheets, jn-sync, calendar' },
];

const securityFeatures = [
  { feature: 'JWT Authentication', scope: 'Admin Portal', strength: 'High' },
  { feature: 'Token-Based Auth', scope: 'Customer Portal', strength: 'Medium' },
  { feature: 'HMAC Validation', scope: 'Webhooks', strength: 'High' },
  { feature: 'Rate Limiting', scope: 'All API Routes', strength: 'High' },
  { feature: 'Input Sanitization', scope: 'Form Inputs', strength: 'High' },
  { feature: 'CORS Policy', scope: 'Cross-Origin', strength: 'Medium' },
  { feature: 'Env Var Secrets', scope: 'API Keys', strength: 'High' },
  { feature: 'validateSession()', scope: 'Protected Routes', strength: 'High' },
];

const sheetsStructure = [
  { tab: 'Contacts', fields: 12, records: '2,400+', usage: 'Customer data' },
  { tab: 'Jobs', fields: 18, records: '1,800+', usage: 'Job lifecycle' },
  { tab: 'Leads', fields: 10, records: '5,200+', usage: 'Lead tracking' },
  { tab: 'Inventory', fields: 8, records: '45+', usage: 'Material stock' },
  { tab: 'Commissions', fields: 9, records: '900+', usage: 'Rep payouts' },
  { tab: 'Deliveries', fields: 11, records: '750+', usage: 'Delivery tickets' },
];

const deploymentSteps = [
  { step: 'Git Push', description: 'Push code to branch', icon: '1' },
  { step: 'PR Review', description: 'Create pull request', icon: '2' },
  { step: 'Preview', description: 'Auto-deploy preview', icon: '3' },
  { step: 'Merge', description: 'Merge to main', icon: '4' },
  { step: 'Deploy', description: 'Auto-deploy prod', icon: '5' },
];

const maxApiCount = Math.max(...apiCategories.map(a => a.count));

export default function AdminDeepDiveInfographic() {
  return (
    <div className="p-6 sm:p-8 space-y-8">
      {/* Title */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-white mb-1">Administration & System Architecture</h3>
        <p className="text-sm text-neutral-400">Architecture, APIs, security, data structure & deployment</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'API Routes', value: '180+', icon: Server, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: 'Security Layers', value: '8', icon: Shield, color: 'text-brand-green', bg: 'bg-brand-green/10 border-brand-green/20' },
          { label: 'Data Tabs', value: '6+', icon: Database, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Deploy Time', value: '~90s', icon: GitBranch, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
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

      {/* Architecture Layers */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Server size={18} className="text-blue-400" />
          <span className="text-sm font-semibold text-white">Architecture Layers</span>
        </div>
        <div className="space-y-3">
          {architectureLayers.map((arch) => (
            <div key={arch.layer} className={`rounded-lg border border-white/10 bg-gradient-to-r ${arch.color} p-4`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-white">{arch.layer}</span>
                <span className="text-xs text-white/70">{arch.tech}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {arch.items.map((item) => (
                  <span key={item} className="text-[11px] px-2 py-0.5 rounded bg-black/20 text-white/80">{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API Route Distribution */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={18} className="text-brand-green" />
          <span className="text-sm font-semibold text-white">API Route Distribution</span>
        </div>
        <div className="space-y-3">
          {apiCategories.map((api) => {
            const barWidth = maxApiCount > 0 ? (api.count / maxApiCount) * 100 : 0;
            return (
              <div key={api.category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white font-medium">{api.category}</span>
                  <div className="flex items-center gap-3 text-xs text-neutral-400">
                    <span className="hidden sm:inline">{api.examples}</span>
                    <span className="font-mono">{api.count} routes</span>
                  </div>
                </div>
                <div className="h-3 rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-green/80 to-emerald-400/80 transition-all duration-700"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Security Matrix */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={18} className="text-amber-400" />
          <span className="text-sm font-semibold text-white">Security Feature Matrix</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {securityFeatures.map((sec) => {
            const strengthColor = sec.strength === 'High'
              ? 'bg-brand-green/10 text-brand-green border-brand-green/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            return (
              <div key={sec.feature} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div>
                  <p className="text-sm font-medium text-white">{sec.feature}</p>
                  <p className="text-[11px] text-neutral-500">{sec.scope}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${strengthColor} flex-shrink-0`}>
                  {sec.strength}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sheets Data Map */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Database size={18} className="text-purple-400" />
          <span className="text-sm font-semibold text-white">Google Sheets Data Map</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-3 text-neutral-400 font-medium">Tab</th>
                <th className="text-center py-2 px-3 text-neutral-400 font-medium">Fields</th>
                <th className="text-center py-2 px-3 text-neutral-400 font-medium">Records</th>
                <th className="text-left py-2 px-3 text-neutral-400 font-medium">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {sheetsStructure.map((tab) => (
                <tr key={tab.tab} className="border-b border-white/5">
                  <td className="py-2 px-3 text-white font-medium">{tab.tab}</td>
                  <td className="py-2 px-3 text-center text-neutral-300">{tab.fields}</td>
                  <td className="py-2 px-3 text-center text-brand-green font-mono">{tab.records}</td>
                  <td className="py-2 px-3 text-neutral-400">{tab.usage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deployment Flow */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <GitBranch size={18} className="text-cyan-400" />
          <span className="text-sm font-semibold text-white">Deployment Pipeline</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {deploymentSteps.map((step, idx) => (
            <div key={step.step} className="flex-1 flex items-center gap-2">
              <div className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-center">
                <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/30 mx-auto mb-2 flex items-center justify-center text-cyan-400 text-xs font-bold">
                  {step.icon}
                </div>
                <p className="text-xs font-semibold text-white">{step.step}</p>
                <p className="text-[10px] text-neutral-500 mt-0.5">{step.description}</p>
              </div>
              {idx < deploymentSteps.length - 1 && (
                <div className="text-neutral-600 flex-shrink-0 rotate-90 sm:rotate-0">
                  <GitBranch size={12} />
                </div>
              )}
            </div>
          ))}
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
            'Portal/Sales has the most API routes (25) -- this is the most feature-rich section.',
            '8 security layers protect the platform from authentication to input validation.',
            'Leads tab has 5,200+ records -- the largest dataset driving the sales pipeline.',
            'Deployment takes ~90 seconds from merge to live -- rapid iteration enabled.',
            'All 6 data tabs sync through Sheets API -- maintain data integrity by using the portal, not direct edits.',
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
