'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Upload, Check, X, AlertTriangle, RefreshCw, Image as ImgIcon, Filter, Edit } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface SiteImage {
  imageId: string;
  key: string;
  category: string;
  subcategory: string;
  url: string;
  alt: string;
  intent: string;
  aspectRatio: string;
  standardized: string;
  approved: string;
  uploadedBy: string;
  uploadedAt: string;
  approvedBy: string;
  approvedAt: string;
  notes: string;
}

const CATEGORIES = ['city', 'blog', 'service', 'team', 'gallery', 'hero', 'og', 'icon', 'misc'];

export default function SiteImagesAdmin() {
  const { user, isLoading } = useAuth();
  const [images, setImages] = useState<SiteImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'pending'>('all');
  const [selected, setSelected] = useState<SiteImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Upload form
  const [upFile, setUpFile] = useState<File | null>(null);
  const [upKey, setUpKey] = useState('');
  const [upCategory, setUpCategory] = useState('city');
  const [upSubcategory, setUpSubcategory] = useState('');
  const [upAlt, setUpAlt] = useState('');
  const [upIntent, setUpIntent] = useState('');
  const [upLicense, setUpLicense] = useState('owned');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set('category', filterCategory);
      const res = await fetch(`/api/admin/site-images?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setImages(data.images || []);
      }
    } finally {
      setLoading(false);
    }
  }, [filterCategory]);

  useEffect(() => { load(); }, [load]);

  const flash = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const filtered = images.filter(img => {
    if (filterStatus === 'approved' && img.approved !== 'true') return false;
    if (filterStatus === 'pending' && img.approved === 'true') return false;
    return true;
  });

  const stats = {
    total: images.length,
    approved: images.filter(i => i.approved === 'true').length,
    pending: images.filter(i => i.approved !== 'true').length,
    standardized: images.filter(i => i.standardized === 'true').length,
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upFile || !upKey || !upCategory) {
      flash('error', 'File, key, and category are required.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', upFile);
      fd.append('key', upKey);
      fd.append('category', upCategory);
      fd.append('subcategory', upSubcategory);
      fd.append('alt', upAlt);
      fd.append('intent', upIntent);
      fd.append('licenseSource', upLicense);
      const res = await fetch('/api/admin/site-images', { method: 'POST', body: fd });
      if (res.ok) {
        flash('success', 'Uploaded + standardized. Approve to make live.');
        setShowUpload(false);
        setUpFile(null);
        setUpKey('');
        setUpAlt('');
        setUpIntent('');
        await load();
      } else {
        const err = await res.json().catch(() => ({}));
        flash('error', err.error || 'Upload failed.');
      }
    } finally {
      setUploading(false);
    }
  };

  const flipApproval = async (img: SiteImage, approve: boolean) => {
    const res = await fetch('/api/admin/site-images', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: { key: img.key, approved: approve ? 'true' : 'false' },
      }),
    });
    if (res.ok) {
      flash('success', approve ? 'Approved — now live.' : 'Approval revoked.');
      await load();
    } else {
      flash('error', 'Failed to update.');
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-neutral-950 flex items-center justify-center"><Loader2 className="animate-spin text-brand-green" size={32} /></div>;
  }
  if (!user || !['owner', 'admin', 'manager'].includes(user.role)) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400">
        <div className="text-center"><AlertTriangle className="mx-auto mb-3 text-red-400" size={40} /><p>Owner/admin/manager only.</p></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/portal/admin" className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center"><ArrowLeft size={18} className="text-neutral-400" /></Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2"><ImgIcon size={20} className="text-brand-green" /> Site Images</h1>
              <p className="text-sm text-neutral-400">Central registry for every public-facing image. Edit a row → page updates on next request.</p>
            </div>
          </div>
          <button onClick={() => setShowUpload(s => !s)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-green text-black font-semibold text-sm">
            <Upload size={16} /> Upload new image
          </button>
        </div>
      </header>

      {message && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
            {message.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
            {message.text}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Upload form (collapsed by default) */}
        {showUpload && (
          <section className="bg-white/[0.02] border border-emerald-500/20 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Upload + standardize a new image</h2>
            <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1">File (max 8MB, image only)</label>
                <input type="file" accept="image/*" onChange={(e) => setUpFile(e.target.files?.[0] || null)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm" required />
                <p className="text-xs text-neutral-500 mt-1">Will be cropped to category aspect ratio, EXIF stripped, output as WebP.</p>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1">Key (semantic — e.g. <code>city-decatur-hero</code>)</label>
                <input type="text" value={upKey} onChange={(e) => setUpKey(e.target.value)} placeholder="city-decatur-hero" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm" required />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1">Category</label>
                <select value={upCategory} onChange={(e) => setUpCategory(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm">
                  {CATEGORIES.map(c => <option key={c} value={c} className="bg-neutral-900">{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1">Subcategory (slug — e.g. <code>decatur</code>)</label>
                <input type="text" value={upSubcategory} onChange={(e) => setUpSubcategory(e.target.value)} placeholder="decatur" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1">License source</label>
                <select value={upLicense} onChange={(e) => setUpLicense(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm">
                  <option value="owned" className="bg-neutral-900">owned</option>
                  <option value="purchased-stock" className="bg-neutral-900">purchased-stock</option>
                  <option value="customer-permission" className="bg-neutral-900">customer-permission</option>
                  <option value="vendor-supplied" className="bg-neutral-900">vendor-supplied</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1">Alt text (SEO + accessibility)</label>
                <input type="text" value={upAlt} onChange={(e) => setUpAlt(e.target.value)} placeholder="Lake Guntersville at sunset" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1">Intent (one-line — what this should depict)</label>
                <input type="text" value={upIntent} onChange={(e) => setUpIntent(e.target.value)} placeholder="Distinctive Guntersville landmark; should NOT be a generic neighborhood shot" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm" />
              </div>
              <div className="md:col-span-2 flex justify-end gap-3">
                <button type="button" onClick={() => setShowUpload(false)} className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-neutral-300 text-sm font-medium">Cancel</button>
                <button type="submit" disabled={uploading} className="px-5 py-2.5 rounded-xl bg-brand-green text-black font-semibold text-sm disabled:opacity-40 inline-flex items-center gap-1.5">
                  {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />} Upload (pending approval)
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Stats + filters */}
        <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex gap-3 text-xs">
            <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2 px-3"><span className="text-neutral-500">Total:</span> <strong className="text-white">{stats.total}</strong></div>
            <div className="bg-emerald-500/[0.05] border border-emerald-500/20 rounded-lg p-2 px-3"><span className="text-neutral-500">Approved:</span> <strong className="text-emerald-300">{stats.approved}</strong></div>
            <div className="bg-amber-500/[0.05] border border-amber-500/20 rounded-lg p-2 px-3"><span className="text-neutral-500">Pending:</span> <strong className="text-amber-300">{stats.pending}</strong></div>
            <div className="bg-violet-500/[0.05] border border-violet-500/20 rounded-lg p-2 px-3"><span className="text-neutral-500">Standardized:</span> <strong className="text-violet-300">{stats.standardized}</strong></div>
          </div>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <Filter size={12} className="text-neutral-500" />
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-neutral-300">
              <option value="" className="bg-neutral-900">All categories</option>
              {CATEGORIES.map(c => <option key={c} value={c} className="bg-neutral-900">{c}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | 'approved' | 'pending')} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-neutral-300">
              <option value="all" className="bg-neutral-900">All statuses</option>
              <option value="approved" className="bg-neutral-900">Approved only</option>
              <option value="pending" className="bg-neutral-900">Pending only</option>
            </select>
            <button onClick={load} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"><RefreshCw size={12} className={`text-neutral-400 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </section>

        {/* Grid */}
        {loading && images.length === 0 ? (
          <div className="text-center py-16 text-neutral-500"><Loader2 className="animate-spin inline mr-2" size={16} /> Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-neutral-500">
            <ImgIcon size={40} className="mx-auto mb-3 text-neutral-700" />
            <p>No images match the current filter.</p>
            <p className="text-xs mt-2">Run <code className="bg-black/30 px-1.5 py-0.5 rounded">node scripts/seed-site-images.mjs</code> to populate the registry from current site references.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(img => (
              <div key={img.key} className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden flex flex-col">
                <div className="relative aspect-video bg-neutral-900">
                  {img.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img.url} alt={img.alt || img.key} className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-neutral-700 text-xs">no image</div>
                  )}
                  <div className={`absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${img.approved === 'true' ? 'bg-emerald-500/30 text-emerald-200' : 'bg-amber-500/30 text-amber-200'}`}>
                    {img.approved === 'true' ? 'live' : 'pending'}
                  </div>
                </div>
                <div className="p-3 flex-1 flex flex-col">
                  <div className="text-xs font-mono text-neutral-400 truncate">{img.key}</div>
                  <div className="text-[10px] text-neutral-600 uppercase tracking-wider mt-0.5">{img.category} · {img.aspectRatio}</div>
                  {img.intent && <div className="text-xs text-neutral-500 mt-2 line-clamp-2">{img.intent}</div>}
                  <div className="mt-auto pt-3 flex gap-2">
                    {img.approved === 'true' ? (
                      <button onClick={() => flipApproval(img, false)} className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300">Revoke</button>
                    ) : (
                      <button onClick={() => flipApproval(img, true)} className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 inline-flex items-center justify-center gap-1"><Check size={12} /> Approve</button>
                    )}
                    <button onClick={() => setSelected(img)} className="text-xs px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400"><Edit size={12} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detail/edit drawer */}
        {selected && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
            <div className="bg-neutral-950 border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-xs text-neutral-500 uppercase tracking-wider">{selected.category} / {selected.subcategory || '—'}</div>
                    <h3 className="text-lg font-mono text-white">{selected.key}</h3>
                  </div>
                  <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"><X size={14} className="text-neutral-400" /></button>
                </div>
                {selected.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.url} alt={selected.alt} className="w-full rounded-xl mb-4 border border-white/10" />
                )}
                <dl className="text-sm space-y-2">
                  <div><dt className="text-neutral-500 text-xs">URL</dt><dd className="text-neutral-300 font-mono text-xs break-all">{selected.url}</dd></div>
                  <div><dt className="text-neutral-500 text-xs">Alt</dt><dd className="text-neutral-300">{selected.alt || <em className="text-neutral-700">none</em>}</dd></div>
                  <div><dt className="text-neutral-500 text-xs">Intent</dt><dd className="text-neutral-300">{selected.intent || <em className="text-neutral-700">none</em>}</dd></div>
                  <div><dt className="text-neutral-500 text-xs">Aspect / standardized</dt><dd className="text-neutral-300">{selected.aspectRatio} · {selected.standardized === 'true' ? 'standardized' : 'NOT standardized'}</dd></div>
                  <div><dt className="text-neutral-500 text-xs">Status</dt><dd className="text-neutral-300">{selected.approved === 'true' ? `approved by ${selected.approvedBy} at ${selected.approvedAt?.slice(0, 16)}` : 'pending approval'}</dd></div>
                  {selected.notes && <div><dt className="text-neutral-500 text-xs">Notes</dt><dd className="text-neutral-300">{selected.notes}</dd></div>}
                </dl>
                <p className="text-xs text-neutral-500 mt-6">To swap this image, upload a new file with the same key — the new row replaces this one on approval. Or edit URL directly in the Site_Images sheet.</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
