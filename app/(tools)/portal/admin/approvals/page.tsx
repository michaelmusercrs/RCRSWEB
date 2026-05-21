'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Check, X, AlertTriangle, User, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface ApprovalItem {
  repSlug: string;
  submittedAt: string;
  submittedBy: string;
  version: string;
  current: {
    bio?: string;
    headshotUrl?: string;
    truckPicUrl?: string;
    certifications?: string;
    yearsExperience?: string;
    favoriteQuote?: string;
    personalReviewIds?: string;
    reviewDisplayMode?: string;
  };
  proposed: Partial<ApprovalItem['current']>;
}

const FIELD_LABELS: Record<string, string> = {
  bio: 'Bio',
  headshotUrl: 'Headshot',
  truckPicUrl: 'Truck photo',
  certifications: 'Certifications',
  yearsExperience: 'Years experience',
  favoriteQuote: 'Favorite quote',
  personalReviewIds: 'Selected reviews',
  reviewDisplayMode: 'Review mode',
};

function ChangeRow({ field, current, proposed }: { field: string; current: string; proposed: string }) {
  if (current === proposed) return null;
  const isImage = field === 'headshotUrl' || field === 'truckPicUrl';
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_1fr] gap-2 py-3 border-b border-white/5">
      <div className="text-xs text-neutral-500 uppercase tracking-wider">{FIELD_LABELS[field] || field}</div>
      <div className="text-xs">
        <div className="text-neutral-600 mb-1">Current</div>
        {isImage ? (
          current ? <img src={current} alt="" className="max-w-[160px] max-h-24 rounded-lg object-cover border border-white/10" /> : <span className="text-neutral-700 italic">(none)</span>
        ) : (
          <div className="text-neutral-400">{current || <span className="text-neutral-700 italic">(empty)</span>}</div>
        )}
      </div>
      <div className="text-xs">
        <div className="text-emerald-400 mb-1">Proposed</div>
        {isImage ? (
          proposed ? <img src={proposed} alt="" className="max-w-[160px] max-h-24 rounded-lg object-cover border border-emerald-500/30" /> : <span className="text-neutral-700 italic">(none)</span>
        ) : (
          <div className="text-emerald-200">{proposed || <span className="text-neutral-700 italic">(empty)</span>}</div>
        )}
      </div>
    </div>
  );
}

export default function ApprovalsAdmin() {
  const { user, isLoading } = useAuth();
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/approvals');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setError(null);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Failed to load approvals');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = async (repSlug: string, action: 'approve' | 'needs-changes') => {
    let notes = '';
    if (action === 'needs-changes') {
      notes = window.prompt('Notes for the rep (optional but helpful):') || '';
    }
    setBusy(repSlug);
    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repSlug, action, notes }),
      });
      if (res.ok) {
        await load();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Action failed.');
      }
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-neutral-950 flex items-center justify-center"><Loader2 className="animate-spin text-brand-green" size={32} /></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/portal/admin" className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
              <ArrowLeft size={18} className="text-neutral-400" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Profile Approvals</h1>
              <p className="text-sm text-neutral-400">Pending rep profile changes — Chris / Michael / Sara approve here</p>
            </div>
          </div>
          <button onClick={load} disabled={loading} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
            <RefreshCw size={16} className={`text-neutral-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="text-center py-12 text-neutral-500"><Loader2 className="animate-spin inline mr-2" size={16} /> Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-neutral-500">
            <Check size={40} className="mx-auto mb-3 text-emerald-500/50" />
            <p>No pending approvals. All caught up.</p>
          </div>
        ) : (
          items.map(item => (
            <section key={item.repSlug} className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
              <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                    <User size={20} className="text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{item.repSlug}</h2>
                    <p className="text-xs text-neutral-500">submitted by {item.submittedBy} at {item.submittedAt?.slice(0, 16).replace('T', ' ')} · v{item.version} → v{(parseInt(item.version || '1') + 1)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => decide(item.repSlug, 'needs-changes')}
                    disabled={busy === item.repSlug}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 text-sm font-medium transition-colors disabled:opacity-40 inline-flex items-center gap-1.5"
                  >
                    <X size={14} /> Needs changes
                  </button>
                  <button
                    onClick={() => decide(item.repSlug, 'approve')}
                    disabled={busy === item.repSlug}
                    className="px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-sm font-medium transition-colors disabled:opacity-40 inline-flex items-center gap-1.5"
                  >
                    {busy === item.repSlug ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Approve & publish
                  </button>
                </div>
              </div>

              <div>
                {Object.keys(FIELD_LABELS).map(field => {
                  const cur = (item.current as Record<string, string | undefined>)[field] || '';
                  const prop = (item.proposed as Record<string, string | undefined>)[field];
                  if (prop === undefined || prop === cur) return null;
                  return <ChangeRow key={field} field={field} current={cur} proposed={prop} />;
                })}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
