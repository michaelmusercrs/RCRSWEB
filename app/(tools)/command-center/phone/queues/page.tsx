'use client';

/**
 * RCRS Command Center - Queue Dashboard
 *
 * Live FreePBX queue dashboard with waiting calls, avg wait, abandon rate
 * and per-queue member roster.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  ArrowLeft,
  RefreshCw,
  Clock,
  PhoneMissed,
  PhoneCall,
  AlertCircle,
  PauseCircle,
  CheckCircle2,
} from 'lucide-react';

interface QueueMember {
  extension: string;
  paused: boolean;
}

interface Queue {
  queueId: string;
  name: string;
  strategy: string;
  members: QueueMember[];
  waitingCalls: number;
  avgWaitSeconds: number;
  abandonRate: number;
  completedToday: number;
}

function formatDuration(s: number): string {
  if (!s) return '0:00';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function QueueDashboardPage() {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/freepbx/queues');
      const json = await res.json();
      setConfigured(Boolean(json.configured));
      setQueues(Array.isArray(json.data) ? json.data : []);
      setError(json.error || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queues');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Poll queue status every 15s — it's the most volatile FreePBX data.
    const id = setInterval(fetchData, 15_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const totalWaiting = queues.reduce((s, q) => s + q.waitingCalls, 0);

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
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Queue Dashboard</h1>
                  <p className="text-sm text-gray-400">Live queue status from FreePBX</p>
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
              Set <code className="text-amber-300">FREEPBX_URL</code> and{' '}
              <code className="text-amber-300">FREEPBX_API_KEY</code> to see live queue data.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-6 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-sm text-gray-400 mb-1 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Queues
            </div>
            <div className="text-2xl font-bold">{queues.length}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-sm text-red-400 mb-1 flex items-center gap-2">
              <PhoneCall className="w-4 h-4" />
              Waiting
            </div>
            <div className={`text-2xl font-bold ${totalWaiting > 0 ? 'text-red-400' : ''}`}>
              {totalWaiting}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-sm text-gray-400 mb-1 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Completed Today
            </div>
            <div className="text-2xl font-bold">
              {queues.reduce((s, q) => s + q.completedToday, 0)}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-sm text-yellow-400 mb-1 flex items-center gap-2">
              <PhoneMissed className="w-4 h-4" />
              Abandon Rate
            </div>
            <div className="text-2xl font-bold text-yellow-400">
              {queues.length > 0
                ? `${(queues.reduce((s, q) => s + q.abandonRate, 0) / queues.length).toFixed(1)}%`
                : '—'}
            </div>
          </div>
        </div>

        {/* Queue list */}
        {queues.length === 0 && !loading && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <Users className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400">
              {configured ? 'No queues configured in FreePBX' : 'Connect FreePBX to load queues'}
            </p>
          </div>
        )}

        <div className="space-y-4">
          {queues.map(q => (
            <div key={q.queueId} className="bg-gray-900 border border-gray-800 rounded-xl">
              <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">{q.name}</h2>
                  <p className="text-xs text-gray-500">
                    #{q.queueId} &middot; Strategy: <span className="text-white">{q.strategy}</span>
                  </p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-xs text-gray-500">Waiting</span>
                    <div className={`font-bold ${q.waitingCalls > 0 ? 'text-red-400' : ''}`}>
                      {q.waitingCalls}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Avg wait
                    </span>
                    <div className="font-bold">{formatDuration(q.avgWaitSeconds)}</div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Abandon</span>
                    <div className="font-bold">{q.abandonRate.toFixed(1)}%</div>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                  Members ({q.members.length})
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {q.members.map(m => (
                    <Link
                      key={m.extension}
                      href={`/command-center/phone/${m.extension}`}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                        m.paused
                          ? 'bg-yellow-900/20 border border-yellow-800/40 text-yellow-300'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                      }`}
                    >
                      {m.paused ? (
                        <PauseCircle className="w-3.5 h-3.5" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-[#39FF14]" />
                      )}
                      <span className="font-mono text-xs">{m.extension}</span>
                      {m.paused && <span className="text-[10px] uppercase">paused</span>}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
