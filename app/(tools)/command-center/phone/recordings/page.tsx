'use client';

/**
 * RCRS Command Center - Call Recording Playback
 *
 * Lists recordings from FreePBX with date/parties/duration + a play
 * button. Uses native HTML5 <audio> so we don't pull in a player lib.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Voicemail,
  ArrowLeft,
  RefreshCw,
  Play,
  Pause,
  Download,
  AlertCircle,
  PhoneIncoming,
  PhoneOutgoing,
} from 'lucide-react';

interface Recording {
  recordingId: string;
  callId: string;
  date: string;
  duration: number;
  from: string;
  to: string;
  url: string;
}

function formatDuration(s: number): string {
  if (!s) return '0:00';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatPhone(p: string): string {
  const d = p.replace(/\D/g, '').replace(/^1/, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return p || '—';
}

function formatDate(ts: string): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/freepbx/recordings?limit=50');
      const json = await res.json();
      setConfigured(Boolean(json.configured));
      setRecordings(Array.isArray(json.data) ? json.data : []);
      setError(json.error || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recordings');
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
                <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
                  <Voicemail className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Call Recordings</h1>
                  <p className="text-sm text-gray-400">{recordings.length} stored recordings</p>
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
              Recording playback needs both <code className="text-amber-300">FREEPBX_URL</code>{' '}
              and <code className="text-amber-300">FREEPBX_RECORDINGS_BASE</code> set.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-6 text-red-400 text-sm">
            {error}
          </div>
        )}

        {recordings.length === 0 && !loading && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <Voicemail className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400">
              {configured ? 'No call recordings found yet' : 'Connect FreePBX to load recordings'}
            </p>
          </div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-800">
            {recordings.map(r => {
              const isPlaying = playingId === r.recordingId;
              return (
                <div key={r.recordingId} className="p-4 hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setPlayingId(isPlaying ? null : r.recordingId)}
                      disabled={!r.url}
                      title={r.url ? 'Play recording' : 'Recording URL unavailable'}
                      className="w-10 h-10 rounded-full bg-[#39FF14]/10 hover:bg-[#39FF14]/20 text-[#39FF14] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <PhoneIncoming className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-sm font-medium">{formatPhone(r.from)}</span>
                        <span className="text-xs text-gray-500">→</span>
                        <PhoneOutgoing className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-sm">{formatPhone(r.to)}</span>
                      </div>
                      <div className="text-xs text-gray-500">{formatDate(r.date)}</div>
                    </div>

                    <div className="text-xs text-gray-400 w-16 text-right">
                      {formatDuration(r.duration)}
                    </div>

                    {r.url && (
                      <a
                        href={r.url}
                        download
                        className="p-2 text-gray-400 hover:text-white"
                        title="Download recording"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  {isPlaying && r.url && (
                    <div className="mt-3 ml-14">
                      <audio src={r.url} controls autoPlay className="w-full">
                        Your browser does not support audio playback.
                      </audio>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
