'use client';

/**
 * Chris View — Q&A / Feedback review console.
 *
 * Shows the pending queue from /api/chrisview-feedback so Michael or
 * Sara can triage what Chris flagged. Gated by ADMIN_REVIEW_KEY passed
 * as ?adminKey=… in the URL (until proper auth is wired in).
 *
 * Lives at /chrisview/qa-admin?adminKey=YOUR_KEY
 */

import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, AlertTriangle, MessageSquare, RefreshCw } from 'lucide-react';

interface FeedbackRow {
  id: string;
  timestamp: string;
  kind: string;
  pageId: string;
  pageUrl: string;
  valueShown: string;
  suggestedValue: string;
  message: string;
  ip: string;
  status: string;
  reviewedBy: string;
  reviewedAt: string;
  resolution: string;
}

export default function QaAdminPage() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved' | 'rejected'>('pending');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const u = new URL(window.location.href);
    setAdminKey(u.searchParams.get('adminKey') || '');
  }, []);

  async function load() {
    if (!adminKey) return;
    setLoading(true);
    setError('');
    try {
      const qs = filter === 'all' ? '' : `&status=${filter}`;
      const res = await fetch(`/api/chrisview-feedback?adminKey=${encodeURIComponent(adminKey)}${qs}`);
      const data = await res.json() as { rows?: FeedbackRow[]; error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setRows(data.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (adminKey) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey, filter]);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <a href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#39FF14]" />Q&amp;A / Feedback Review
          </h1>
          <button
            onClick={load}
            disabled={loading || !adminKey}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14] hover:bg-[#39FF14]/20 rounded-lg text-xs font-medium disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Reload
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        {!adminKey && (
          <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded text-amber-200 text-sm">
            Add <code className="text-amber-300">?adminKey=YOUR_KEY</code> to the URL to view the queue.
          </div>
        )}

        <div className="flex gap-2 text-xs">
          {(['pending', 'resolved', 'rejected', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded ${filter === s ? 'bg-[#39FF14] text-black font-semibold' : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'}`}
            >
              {s}
            </button>
          ))}
          <span className="ml-auto text-zinc-500 self-center">{rows.length} {filter}</span>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{error}</div>
        )}

        {loading && <div className="flex items-center gap-2 text-zinc-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>}

        {!loading && rows.length === 0 && (
          <div className="text-zinc-500 text-sm text-center py-12">No {filter} items.</div>
        )}

        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {r.kind === 'mistake' ? (
                    <span className="text-[10px] font-mono bg-red-500/20 text-red-300 px-2 py-0.5 rounded uppercase">Mistake</span>
                  ) : r.kind === 'request' ? (
                    <span className="text-[10px] font-mono bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded uppercase">Request</span>
                  ) : (
                    <span className="text-[10px] font-mono bg-zinc-500/20 text-zinc-300 px-2 py-0.5 rounded uppercase">Note</span>
                  )}
                  <span className="text-xs text-zinc-400">
                    on <a href={r.pageUrl} className="text-[#39FF14] hover:underline">{r.pageId || r.pageUrl}</a>
                  </span>
                  <span className="text-[10px] text-zinc-600 font-mono">{new Date(r.timestamp).toLocaleString()}</span>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${r.status === 'pending' ? 'bg-amber-500/20 text-amber-300' : r.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-700 text-zinc-300'}`}>
                  {r.status}
                </span>
              </div>
              {(r.valueShown || r.suggestedValue) && (
                <div className="text-xs text-zinc-400 mb-2 flex flex-wrap gap-4">
                  {r.valueShown && <div><span className="text-zinc-500 uppercase font-mono text-[10px]">shown:</span> <code className="text-red-300">{r.valueShown}</code></div>}
                  {r.suggestedValue && <div><span className="text-zinc-500 uppercase font-mono text-[10px]">should be:</span> <code className="text-emerald-300">{r.suggestedValue}</code></div>}
                </div>
              )}
              <div className="text-sm text-white whitespace-pre-wrap">{r.message}</div>
              {r.resolution && (
                <div className="mt-2 text-xs text-zinc-400 border-t border-zinc-800 pt-2">
                  <span className="text-zinc-500 uppercase font-mono text-[10px]">resolution by {r.reviewedBy} on {r.reviewedAt}:</span>
                  <div className="text-zinc-300 mt-1">{r.resolution}</div>
                </div>
              )}
              <div className="text-[10px] text-zinc-600 font-mono mt-2">id: {r.id} · ip: {r.ip}</div>
            </div>
          ))}
        </div>

        <p className="text-xs text-zinc-500 mt-6">
          To resolve an item: open the master sheet <code className="text-zinc-400">chrisview_feedback</code> tab and edit the
          <code className="text-zinc-400 mx-1">status</code>, <code className="text-zinc-400 mx-1">reviewedBy</code>,
          <code className="text-zinc-400 mx-1">reviewedAt</code>, and <code className="text-zinc-400 mx-1">resolution</code> columns.
        </p>

        <div className="mt-8 border-t border-zinc-800 pt-6 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Related master-sheet tabs</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="font-mono text-[#39FF14] mb-1">chrisview_qa</div>
              <p className="text-zinc-400">Every Q&amp;A from the Ask Claude widget logged here. Audit history of what Chris asked and what Claude answered.</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="font-mono text-[#39FF14] mb-1">chrisview_feedback</div>
              <p className="text-zinc-400">This queue. Mistakes / requests / notes Chris submitted via the Flag tab.</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="font-mono text-[#39FF14] mb-1">chrisview_corrections</div>
              <p className="text-zinc-400">Hand-corrections that overlay raw data. Add a row like <code className="text-amber-300">annual:2024:net</code> with the corrected value and it propagates to every chart. Status must be <code className="text-zinc-300">active</code> to apply.</p>
            </div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200">
            <strong>Heads-up:</strong> Q&amp;A widget needs <code className="text-amber-300">ANTHROPIC_API_KEY</code> set in Vercel project env vars (Production scope). Until then it returns &ldquo;AI not configured&rdquo;. To set it: <code className="text-amber-100">vercel env add ANTHROPIC_API_KEY production</code> then <code className="text-amber-100">vercel --prod</code>.
          </div>
        </div>
      </main>
    </div>
  );
}
