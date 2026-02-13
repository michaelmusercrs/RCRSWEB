/**
 * Admin Dashboard - System Metrics & Health
 * Real-time system status and integration health checks
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Activity,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
  Server,
  Database,
  Globe,
  Clock,
  Users,
  FileText,
  Package,
  Shield,
  Loader2,
  ExternalLink,
  Zap,
} from 'lucide-react';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'checking';
  latency?: number;
  message?: string;
  lastChecked?: string;
}

export default function AdminDashboard() {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([
    { name: 'Google Sheets API', status: 'checking' },
    { name: 'JobNimbus CRM', status: 'checking' },
    { name: 'Calendar (TeamUp)', status: 'checking' },
    { name: 'Vercel Blob Storage', status: 'checking' },
    { name: 'Admin Auth', status: 'checking' },
  ]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastFullCheck, setLastFullCheck] = useState<string | null>(null);
  const [envInfo, setEnvInfo] = useState<{ env: string; nodeVersion: string }>({
    env: process.env.NODE_ENV || 'development',
    nodeVersion: '',
  });

  useEffect(() => {
    runHealthChecks();
  }, []);

  const checkEndpoint = async (url: string, name: string): Promise<HealthCheck> => {
    const start = Date.now();
    try {
      const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(10000) });
      const latency = Date.now() - start;
      if (res.ok) {
        return { name, status: 'healthy', latency, message: `${res.status} OK`, lastChecked: new Date().toISOString() };
      }
      return { name, status: 'degraded', latency, message: `HTTP ${res.status}`, lastChecked: new Date().toISOString() };
    } catch (err: any) {
      return { name, status: 'down', message: err.message || 'Connection failed', lastChecked: new Date().toISOString() };
    }
  };

  const runHealthChecks = async () => {
    setIsChecking(true);
    setHealthChecks(prev => prev.map(h => ({ ...h, status: 'checking' as const })));

    const results = await Promise.all([
      checkEndpoint('/api/portal/inventory', 'Google Sheets API'),
      checkEndpoint('/api/admin/jobnimbus', 'JobNimbus CRM'),
      checkEndpoint('/api/calendar/events?startDate=2026-01-01&endDate=2026-01-02', 'Calendar (TeamUp)'),
      checkEndpoint('/api/admin/settings', 'Vercel Blob Storage'),
      checkEndpoint('/api/admin/auth', 'Admin Auth'),
    ]);

    setHealthChecks(results);
    setLastFullCheck(new Date().toISOString());
    setIsChecking(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-[#39FF14]" />;
      case 'degraded': return <AlertCircle className="w-5 h-5 text-amber-400" />;
      case 'down': return <XCircle className="w-5 h-5 text-red-400" />;
      default: return <Loader2 className="w-5 h-5 text-neutral-500 animate-spin" />;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy': return 'border-[#39FF14]/20 bg-[#39FF14]/5';
      case 'degraded': return 'border-amber-500/20 bg-amber-500/5';
      case 'down': return 'border-red-500/20 bg-red-500/5';
      default: return 'border-gray-700 bg-gray-800/50';
    }
  };

  const healthyCount = healthChecks.filter(h => h.status === 'healthy').length;
  const totalCount = healthChecks.length;
  const overallStatus = healthyCount === totalCount ? 'All Systems Operational' :
    healthChecks.some(h => h.status === 'down') ? 'System Issues Detected' : 'Partial Degradation';
  const overallColor = healthyCount === totalCount ? 'text-[#39FF14]' :
    healthChecks.some(h => h.status === 'down') ? 'text-red-400' : 'text-amber-400';

  const adminPages = [
    { name: 'Sales & Commissions', href: '/admin/sales', icon: Zap, desc: 'Real commission data from JN' },
    { name: 'Inventory', href: '/admin/inventory', icon: Package, desc: 'Stock levels & alerts' },
    { name: 'Team Management', href: '/admin/team', icon: Users, desc: 'Add/edit team members' },
    { name: 'Blog Management', href: '/admin/blog', icon: FileText, desc: 'Create & edit posts' },
    { name: 'System Settings', href: '/admin/system', icon: Shield, desc: 'Feature flags & API keys' },
    { name: 'Settings', href: '/admin/settings', icon: Globe, desc: 'Site configuration' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">System Dashboard</h1>
          <p className="text-neutral-400 mt-2">Monitor integrations and system health</p>
        </div>
        <button
          onClick={runHealthChecks}
          disabled={isChecking}
          className="flex items-center gap-2 px-4 py-2 bg-[#39FF14] hover:bg-lime-400 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
          Run Health Check
        </button>
      </div>

      {/* Overall Status Banner */}
      <div className={`p-6 rounded-xl border ${
        healthyCount === totalCount ? 'border-[#39FF14]/30 bg-[#39FF14]/5' :
        healthChecks.some(h => h.status === 'down') ? 'border-red-500/30 bg-red-500/5' :
        'border-amber-500/30 bg-amber-500/5'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Activity className={`w-8 h-8 ${overallColor}`} />
            <div>
              <h2 className={`text-xl font-bold ${overallColor}`}>{overallStatus}</h2>
              <p className="text-neutral-400 text-sm mt-1">
                {healthyCount}/{totalCount} services operational
                {lastFullCheck && ` • Last checked ${new Date(lastFullCheck).toLocaleTimeString()}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Health Check Cards */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Integration Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {healthChecks.map((check) => (
            <div key={check.name} className={`rounded-xl border p-5 ${getStatusBg(check.status)}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(check.status)}
                  <div>
                    <h3 className="font-semibold text-white">{check.name}</h3>
                    <p className="text-sm text-neutral-400 mt-1">{check.message || 'Checking...'}</p>
                  </div>
                </div>
                {check.latency !== undefined && (
                  <span className={`text-xs font-mono px-2 py-1 rounded ${
                    check.latency < 500 ? 'bg-[#39FF14]/10 text-[#39FF14]' :
                    check.latency < 2000 ? 'bg-amber-500/10 text-amber-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>
                    {check.latency}ms
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Navigation */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Admin Sections</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {adminPages.map((page) => {
            const Icon = page.icon;
            return (
              <Link
                key={page.href}
                href={page.href}
                className="bg-gray-900 rounded-xl border border-gray-700/50 p-5 hover:border-[#39FF14]/30 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-800 rounded-lg group-hover:bg-[#39FF14]/10 transition-colors">
                    <Icon className="w-5 h-5 text-neutral-400 group-hover:text-[#39FF14] transition-colors" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white group-hover:text-[#39FF14] transition-colors">{page.name}</h3>
                    <p className="text-sm text-neutral-500">{page.desc}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Environment Info */}
      <div className="bg-gray-900 rounded-xl border border-gray-700/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-neutral-400" />
          Environment Info
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-neutral-500">Environment</p>
            <p className="font-mono text-white mt-1">{envInfo.env}</p>
          </div>
          <div>
            <p className="text-neutral-500">Framework</p>
            <p className="font-mono text-white mt-1">Next.js 14</p>
          </div>
          <div>
            <p className="text-neutral-500">Platform</p>
            <p className="font-mono text-white mt-1">Vercel</p>
          </div>
          <div>
            <p className="text-neutral-500">Database</p>
            <p className="font-mono text-white mt-1">Google Sheets + Blob</p>
          </div>
        </div>
      </div>
    </div>
  );
}
