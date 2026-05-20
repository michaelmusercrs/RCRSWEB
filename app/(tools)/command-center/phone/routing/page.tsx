'use client';

/**
 * RCRS Command Center - Call Routing
 *
 * Read-only view of FreePBX inbound routes + time conditions.
 * Editing happens in FreePBX directly (owner is the only one who should
 * be reconfiguring trunks/routes). UI exists so the team can see the
 * current who-answers-when logic at a glance.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  RefreshCw,
  Clock,
  Phone,
  Moon,
  AlertCircle,
  Power,
} from 'lucide-react';

interface Route {
  routeId: string;
  name: string;
  did: string;
  destination: string;
  enabled: boolean;
  timeCondition?: {
    name: string;
    matches: string[];
    matchedDestination: string;
    unmatchedDestination: string;
  };
  afterHours?: string;
}

function formatDid(d: string): string {
  const digits = d.replace(/\D/g, '').replace(/^1/, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return d || '—';
}

function prettyDestination(dest: string): string {
  if (!dest) return '—';
  // FreePBX destination string format: `app-blackhole,hangup,1` or `ext-queues,600,1`
  if (dest.includes('ext-queues')) return `Queue ${dest.split(',')[1] ?? ''}`;
  if (dest.includes('ext-group')) return `Ring group ${dest.split(',')[1] ?? ''}`;
  if (dest.includes('ext-local')) return `Ext ${dest.split(',')[1] ?? ''}`;
  if (dest.includes('vmu')) return `Voicemail ${dest.split(',')[1] ?? ''}`;
  if (dest.includes('ivr')) return `IVR ${dest.split(',')[1] ?? ''}`;
  if (dest.includes('app-announcement')) return `Announcement`;
  if (dest.includes('app-blackhole')) return `Hang up`;
  return dest;
}

export default function CallRoutingPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/freepbx/routes');
      const json = await res.json();
      setConfigured(Boolean(json.configured));
      setRoutes(Array.isArray(json.data) ? json.data : []);
      setError(json.error || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load routes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/command-center/phone" className="text-gray-400 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Call Routing</h1>
                  <p className="text-sm text-gray-400">Who answers when</p>
                </div>
              </div>
            </div>
            <button
              onClick={fetchData}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!configured && (
          <div className="bg-amber-900/20 border border-amber-800/60 rounded-xl p-4 mb-6 text-amber-200 text-sm">
            <div className="font-medium mb-1 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              FreePBX not configured
            </div>
            <p className="text-amber-200/80 text-xs">
              Inbound routes load from FreePBX once <code className="text-amber-300">FREEPBX_URL</code> +{' '}
              <code className="text-amber-300">FREEPBX_API_KEY</code> are set.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-6 text-red-400 text-sm">
            {error}
          </div>
        )}

        {routes.length === 0 && !loading && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <Activity className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400">
              {configured ? 'No inbound routes configured' : 'Connect FreePBX to see routing'}
            </p>
          </div>
        )}

        <div className="space-y-4">
          {routes.map(r => (
            <div key={r.routeId} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${r.enabled ? 'bg-[#39FF14]' : 'bg-gray-600'}`} />
                  <div>
                    <h2 className="font-semibold">{r.name}</h2>
                    <p className="text-xs text-gray-500 font-mono">{formatDid(r.did)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Power className={`w-3.5 h-3.5 ${r.enabled ? 'text-[#39FF14]' : 'text-gray-600'}`} />
                  <span className={r.enabled ? 'text-[#39FF14]' : 'text-gray-500'}>
                    {r.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gray-950/50 rounded-lg p-3 border border-gray-800">
                    <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Default destination
                    </div>
                    <div className="text-sm">{prettyDestination(r.destination)}</div>
                  </div>

                  {r.afterHours && (
                    <div className="bg-gray-950/50 rounded-lg p-3 border border-gray-800">
                      <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                        <Moon className="w-3 h-3" /> After hours
                      </div>
                      <div className="text-sm">{prettyDestination(r.afterHours)}</div>
                    </div>
                  )}
                </div>

                {r.timeCondition && (
                  <div className="bg-gray-950/50 rounded-lg p-3 border border-gray-800">
                    <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Time condition: {r.timeCondition.name}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-[#39FF14] text-xs">Match →</span>{' '}
                        {prettyDestination(r.timeCondition.matchedDestination)}
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs">No match →</span>{' '}
                        {prettyDestination(r.timeCondition.unmatchedDestination)}
                      </div>
                    </div>
                    {r.timeCondition.matches.length > 0 && (
                      <div className="mt-2 text-xs text-gray-500">
                        {r.timeCondition.matches.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
