'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2, Upload, User, Truck, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface Profile {
  repSlug: string;
  bio: string;
  headshotUrl: string;
  truckPicUrl: string;
  certifications: string;
  yearsExperience: string;
  favoriteQuote: string;
  status?: string;            // 'draft' | 'pending-approval' | 'published' | 'needs-changes'
  pendingDraft?: string;
  rejectionNotes?: string;
  version?: string;
  publishedAt?: string;
  personalReviewIds?: string;
  reviewDisplayMode?: string;
  updatedAt: string;
  updatedBy: string;
}

interface TeamMember {
  slug: string;
  name: string;
}

const ROSTER: TeamMember[] = [
  { slug: 'hunter',  name: 'Hunter Rivers' },
  { slug: 'aaron',   name: 'Aaron Lussi' },
  { slug: 'greg',    name: 'Greg Muse' },
  { slug: 'brendon', name: 'Brendon Muse' },
  { slug: 'adam',    name: 'Adam Rudell' },
  { slug: 'joseph',  name: 'Joseph Dowd' },
  { slug: 'alijah',  name: 'Alijah' },
  { slug: 'travis',  name: 'Travis Wages' },
];

export default function TeamProfilesAdmin() {
  const { user, isLoading: authLoading } = useAuth();
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [selected, setSelected] = useState<string>(ROSTER[0].slug);
  const [draft, setDraft] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'headshot' | 'truck' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/team-profiles');
    if (res.ok) {
      const data = await res.json();
      const map = new Map<string, Profile>();
      for (const p of data.profiles || []) map.set(p.repSlug, p);
      setProfiles(map);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const existing = profiles.get(selected);
    if (existing) {
      // If there's a pendingDraft, render those values for editing
      // (the rep continues from where the last submission was rejected).
      let draftFields: Partial<Profile> = {};
      if (existing.pendingDraft) {
        try { draftFields = JSON.parse(existing.pendingDraft); } catch { /* ignore */ }
      }
      setDraft({
        ...existing,
        ...draftFields,
        repSlug: selected,
      });
    } else {
      setDraft({
        repSlug: selected,
        bio: '',
        headshotUrl: '',
        truckPicUrl: '',
        certifications: '',
        yearsExperience: '',
        favoriteQuote: '',
        status: 'draft',
        updatedAt: '',
        updatedBy: '',
      });
    }
  }, [selected, profiles]);

  const persist = async (intent: 'save-draft' | 'submit-for-approval') => {
    if (!draft) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/team-profiles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: draft, intent }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessage({
          type: 'success',
          text: intent === 'submit-for-approval'
            ? 'Submitted for approval — Chris, Michael, or Sara will review.'
            : 'Saved as draft. Click "Submit for approval" when you\'re ready.',
        });
        await load();
      } else {
        const err = await res.json().catch(() => ({}));
        setMessage({ type: 'error', text: err.error || 'Save failed.' });
      }
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 6000);
    }
  };

  const save = () => persist('save-draft');
  const submit = () => persist('submit-for-approval');

  const uploadPhoto = async (kind: 'headshot' | 'truck', file: File) => {
    setUploading(kind);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('repSlug', selected);
      fd.append('kind', kind);
      const res = await fetch('/api/admin/team-profiles', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        setDraft(d => d ? { ...d, [kind === 'headshot' ? 'headshotUrl' : 'truckPicUrl']: data.url } : d);
        setMessage({ type: 'success', text: `${kind === 'headshot' ? 'Headshot' : 'Truck photo'} uploaded. Click Save to persist.` });
      } else {
        const err = await res.json().catch(() => ({}));
        setMessage({ type: 'error', text: err.error || 'Upload failed.' });
      }
    } finally {
      setUploading(null);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-neutral-950 flex items-center justify-center"><Loader2 className="animate-spin text-brand-green" size={32} /></div>;
  }
  if (!user || !['owner', 'admin', 'manager'].includes(user.role)) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-3 text-red-400" size={40} />
          <p className="mb-4">Owners, admins, and managers only.</p>
          <Link href="/portal/admin" className="px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300">Back to Admin</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/portal/admin" className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
              <ArrowLeft size={18} className="text-neutral-400" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Rep Profiles</h1>
              <p className="text-sm text-neutral-400">Bio + photos that appear on the customer welcome page</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving || !draft}
              title="Save as draft (not visible to customers yet)"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
              Save draft
            </button>
            <button
              onClick={submit}
              disabled={saving || !draft || draft.status === 'pending-approval'}
              title="Submit this profile for Chris/Michael/Sara approval. Until approved, the published version stays live."
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-green text-black font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
              {draft?.status === 'pending-approval' ? 'Awaiting approval' : 'Submit for approval'}
            </button>
          </div>
        </div>
      </header>

      {message && (
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            {message.text}
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
        {/* Rep selector */}
        <aside className="space-y-1">
          {ROSTER.map(rep => {
            const hasProfile = profiles.has(rep.slug) && (profiles.get(rep.slug)?.bio || profiles.get(rep.slug)?.headshotUrl);
            return (
              <button
                key={rep.slug}
                onClick={() => setSelected(rep.slug)}
                className={`w-full flex items-center justify-between text-left px-4 py-2.5 rounded-xl transition-colors ${
                  selected === rep.slug
                    ? 'bg-brand-green/10 border border-brand-green/30 text-brand-green'
                    : 'bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 text-neutral-300'
                }`}
              >
                <span className="text-sm font-medium">{rep.name}</span>
                {hasProfile && <span className="text-xs text-emerald-400">●</span>}
              </button>
            );
          })}
        </aside>

        {/* Profile editor */}
        {draft && (
          <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-5">
            {/* Status banner */}
            {draft.status === 'pending-approval' && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                <Loader2 className="animate-spin" size={14} /> Awaiting approval from Chris, Michael, or Sara. The published version stays live until approved.
              </div>
            )}
            {draft.status === 'needs-changes' && draft.rejectionNotes && (
              <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                <strong>Needs changes:</strong> {draft.rejectionNotes}
              </div>
            )}
            {draft.status === 'published' && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                <CheckCircle size={14} /> Published. Any edits below will go to draft state and require approval to publish.
              </div>
            )}
            {/* Headshot */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2 flex items-center gap-2">
                <User size={14} /> Headshot
              </label>
              <div className="flex items-center gap-4">
                {draft.headshotUrl ? (
                  <img src={draft.headshotUrl} alt="headshot" className="w-24 h-24 rounded-xl object-cover border border-white/10" />
                ) : (
                  <div className="w-24 h-24 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-neutral-600 text-xs">No photo</div>
                )}
                <label className="cursor-pointer px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-neutral-300 inline-flex items-center gap-2">
                  {uploading === 'headshot' ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                  Upload headshot
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto('headshot', e.target.files[0])} />
                </label>
              </div>
            </div>

            {/* Truck photo */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2 flex items-center gap-2">
                <Truck size={14} /> Truck Photo
              </label>
              <div className="flex items-center gap-4">
                {draft.truckPicUrl ? (
                  <img src={draft.truckPicUrl} alt="truck" className="h-24 rounded-xl object-cover border border-white/10" />
                ) : (
                  <div className="w-40 h-24 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-neutral-600 text-xs">No photo</div>
                )}
                <label className="cursor-pointer px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-neutral-300 inline-flex items-center gap-2">
                  {uploading === 'truck' ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                  Upload truck photo
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto('truck', e.target.files[0])} />
                </label>
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Bio</label>
              <textarea
                value={draft.bio}
                onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                placeholder="2-3 sentence intro — where they're from, family, what brought them to RCRS, anything personable. This appears on the customer welcome page."
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-green/50"
              />
            </div>

            {/* Certifications + years + quote */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Certifications</label>
                <input
                  type="text"
                  value={draft.certifications}
                  onChange={(e) => setDraft({ ...draft, certifications: e.target.value })}
                  placeholder="IKO ROOFPRO Craftsman Premier, OC Preferred"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-green/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Years of Experience</label>
                <input
                  type="text"
                  value={draft.yearsExperience}
                  onChange={(e) => setDraft({ ...draft, yearsExperience: e.target.value })}
                  placeholder="e.g. 8 years"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-green/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Favorite Quote (optional)</label>
              <input
                type="text"
                value={draft.favoriteQuote}
                onChange={(e) => setDraft({ ...draft, favoriteQuote: e.target.value })}
                placeholder="Something personable that breaks the ice"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-green/50"
              />
            </div>

            {draft.updatedAt && (
              <p className="text-xs text-neutral-600">Last updated {draft.updatedAt.slice(0, 16).replace('T', ' ')} by {draft.updatedBy}</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
