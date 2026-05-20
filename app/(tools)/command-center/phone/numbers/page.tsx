'use client';

/**
 * RCRS Command Center - VoIP Number Management
 *
 * Lists every RCRS VoIP DID (from FREEPBX_VOIP_NUMBERS env JSON) and
 * shows which extension/queue rings, provider, status, and monthly cost.
 *
 * Adding a number means editing the env var (or, longer term, a sheet
 * tab) — owner-only operation.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Phone,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  DollarSign,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface VoipNumber {
  did: string;
  label: string;
  ringsTo: string;
  provider: string;
  status: 'active' | 'inactive' | 'unknown';
  monthlyCostUsd: number;
}

function formatDid(d: string): string {
  const digits = d.replace(/\D/g, '').replace(/^1/, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return d || '—';
}

export default function VoipNumbersPage() {
  const [numbers, setNumbers] = useState<VoipNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(false);
  const [source, setSource] = useState<string>('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/freepbx/numbers');
      const json = await res.json();
      setConfigured(Boolean(json.configured));
      setSource(String(json.source || ''));
      setNumbers(Array.isArray(json.data) ? json.data : []);
      setError(json.error || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load numbers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalMonthly = numbers.reduce((s, n) => s + (n.monthlyCostUsd || 0), 0);

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
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">VoIP Numbers</h1>
                  <p className="text-sm text-gray-400">{numbers.length} DIDs configured</p>
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
        {source === 'stub' && !error && (
          <div className="bg-amber-900/20 border border-amber-800/60 rounded-xl p-4 mb-6 text-amber-200 text-sm">
            <div className="font-medium mb-1 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              No VoIP numbers configured
            </div>
            <p className="text-amber-200/80 text-xs">
              Owner: paste your DID list as JSON into{' '}
              <code className="text-amber-300">FREEPBX_VOIP_NUMBERS</code> env var. Example:
              <br />
              <code className="text-amber-300/90 block mt-2 text-[10px]">
                [&#123;&quot;did&quot;:&quot;+12565154245&quot;,&quot;label&quot;:&quot;Main&quot;,&quot;ringsTo&quot;:&quot;queue:600&quot;,&quot;provider&quot;:&quot;VoIP.ms&quot;,&quot;status&quot;:&quot;active&quot;,&quot;monthlyCostUsd&quot;:0.99&#125;]
              </code>
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-6 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Summary */}
        {numbers.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-sm text-gray-400 mb-1">Total DIDs</div>
              <div className="text-2xl font-bold">{numbers.length}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-sm text-[#39FF14] mb-1">Active</div>
              <div className="text-2xl font-bold text-[#39FF14]">
                {numbers.filter(n => n.status === 'active').length}
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-sm text-gray-500 mb-1">Inactive</div>
              <div className="text-2xl font-bold text-gray-500">
                {numbers.filter(n => n.status === 'inactive').length}
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-sm text-emerald-400 mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" /> Monthly
              </div>
              <div className="text-2xl font-bold text-emerald-400">
                ${totalMonthly.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Numbers list */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {numbers.length === 0 && !loading ? (
            <div className="p-12 text-center">
              <Phone className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400">No DIDs configured</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-800/50 text-xs text-gray-400 uppercase">
                <tr>
                  <th className="text-left px-5 py-3">Number</th>
                  <th className="text-left px-5 py-3">Label</th>
                  <th className="text-left px-5 py-3 hidden sm:table-cell">Rings to</th>
                  <th className="text-left px-5 py-3 hidden md:table-cell">Provider</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-right px-5 py-3">$/mo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-sm">
                {numbers.map(n => (
                  <tr key={n.did} className="hover:bg-gray-800/30">
                    <td className="px-5 py-3 font-mono">{formatDid(n.did)}</td>
                    <td className="px-5 py-3 text-gray-300">{n.label || '—'}</td>
                    <td className="px-5 py-3 hidden sm:table-cell text-gray-400">{n.ringsTo}</td>
                    <td className="px-5 py-3 hidden md:table-cell text-gray-400">{n.provider}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                          n.status === 'active'
                            ? 'bg-[#39FF14]/10 text-[#39FF14]'
                            : n.status === 'inactive'
                              ? 'bg-gray-700 text-gray-400'
                              : 'bg-yellow-500/10 text-yellow-400'
                        }`}
                      >
                        {n.status === 'active' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : n.status === 'inactive' ? (
                          <XCircle className="w-3 h-3" />
                        ) : (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        {n.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-emerald-300">
                      ${n.monthlyCostUsd.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!configured && (
          <div className="mt-4 text-xs text-gray-500">
            Note: FreePBX itself is not yet connected. Numbers here are read from{' '}
            <code className="text-gray-400">FREEPBX_VOIP_NUMBERS</code> only.
          </div>
        )}
      </div>
    </div>
  );
}
