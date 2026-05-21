'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Eye, Search, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface LeadRecord {
  leadId: string;
  customerName: string;
  customerAddress: string;
  accessToken?: string;
  salesRepName?: string;
  salesRepSlug?: string;
  createdAt?: string;
}

export default function CustomerPortalPreview() {
  const { user, isLoading } = useAuth();
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<LeadRecord | null>(null);
  const [loadingLeads, setLoadingLeads] = useState(true);

  const load = useCallback(async () => {
    setLoadingLeads(true);
    try {
      const res = await fetch('/api/portal/leads?limit=50');
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || data.data || []);
      }
    } finally {
      setLoadingLeads(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (isLoading) {
    return <div className="min-h-screen bg-neutral-950 flex items-center justify-center"><Loader2 className="animate-spin text-brand-green" size={32} /></div>;
  }
  if (!user || !['owner', 'admin', 'manager'].includes(user.role)) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400">
        <div className="text-center"><AlertTriangle className="mx-auto mb-3 text-red-400" size={40} /><p>Owner / admin / manager only.</p></div>
      </div>
    );
  }

  const filtered = search
    ? leads.filter(l =>
        (l.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.customerAddress || '').toLowerCase().includes(search.toLowerCase())
      )
    : leads;

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/portal/admin/customer-portal-config" className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center"><ArrowLeft size={18} className="text-neutral-400" /></Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2"><Eye size={20} className="text-emerald-400" /> View as Customer</h1>
              <p className="text-sm text-neutral-400">Verify exactly what a customer sees — no analytics events fire from preview.</p>
            </div>
          </div>
          <div className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30">PREVIEW MODE</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Lead picker */}
        <aside className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3 max-h-[calc(100vh-180px)] overflow-y-auto">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or address…"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          {loadingLeads ? (
            <p className="text-sm text-neutral-500 italic flex items-center gap-2"><Loader2 className="animate-spin" size={14} /> Loading leads…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-neutral-500 italic">No leads found.</p>
          ) : (
            filtered.map(l => (
              <button
                key={l.leadId}
                onClick={() => setSelected(l)}
                className={`w-full text-left p-3 rounded-xl transition-colors ${selected?.leadId === l.leadId ? 'bg-emerald-500/[0.08] border border-emerald-500/30' : 'bg-white/[0.02] border border-white/5 hover:border-white/10'}`}
              >
                <div className="text-sm font-medium text-white truncate">{l.customerName || '(no name)'}</div>
                <div className="text-xs text-neutral-500 truncate mt-0.5">{l.customerAddress || '(no address)'}</div>
                {l.salesRepName && <div className="text-xs text-neutral-600 mt-0.5">→ {l.salesRepName}</div>}
              </button>
            ))
          )}
        </aside>

        {/* Preview iframe */}
        <section className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
          {!selected ? (
            <div className="h-full min-h-[60vh] flex items-center justify-center text-neutral-500 text-sm">
              ← Pick a lead on the left to preview its customer portal.
            </div>
          ) : !selected.accessToken ? (
            <div className="h-full min-h-[60vh] flex items-center justify-center text-amber-300 text-sm">
              This lead has no access token. Portal cannot be previewed.
            </div>
          ) : (
            <>
              <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-200 flex items-center justify-between">
                <span>PREVIEW · Showing portal for <strong>{selected.customerName}</strong> · Token: <code className="bg-black/30 px-1.5 py-0.5 rounded">{selected.accessToken.slice(0, 8)}…</code></span>
                <a href={`/customer/welcome/${selected.accessToken}?preview=1`} target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-100">Open in new tab</a>
              </div>
              <iframe
                key={selected.leadId}
                src={`/customer/welcome/${selected.accessToken}?preview=1`}
                className="w-full"
                style={{ height: 'calc(100vh - 240px)', background: '#fff' }}
                sandbox="allow-same-origin allow-scripts allow-popups"
                title={`Customer portal preview — ${selected.customerName}`}
              />
            </>
          )}
        </section>
      </main>
    </div>
  );
}
