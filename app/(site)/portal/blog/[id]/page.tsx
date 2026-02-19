'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  Save, Send, ArrowLeft, Loader2, AlertCircle, CheckCircle, XCircle, Eye,
  ImagePlus, X, CheckCircle2, Calendar, Rocket
} from 'lucide-react';
import Link from 'next/link';

const MIN_TITLE = 30;
const MIN_BODY_CHARS = 1500;
const MIN_BODY_WORDS = 300;
const MIN_META = 120;

interface BlogPost {
  id: string;
  slug: string;
  authorSlug: string;
  authorName: string;
  title: string;
  metaDescription: string;
  body: string;
  images: string[];
  status: 'draft' | 'review' | 'approved' | 'published' | 'rejected';
  createdAt: string;
  updatedAt: string;
  publishDate: string | null;
  publishedAt: string | null;
  rejectionReason: string | null;
}

export default function EditBlogPost() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [post, setPost] = useState<BlogPost | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [publishMessage, setPublishMessage] = useState('');

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const canEdit = post && (post.status === 'draft' || post.status === 'rejected');

  const wordCount = body.trim().split(/\s+/).filter(w => w.length > 0).length;
  const charCount = body.length;
  const titleOk = title.length >= MIN_TITLE;
  const bodyCharsOk = charCount >= MIN_BODY_CHARS;
  const bodyWordsOk = wordCount >= MIN_BODY_WORDS;
  const metaOk = metaDescription.length >= MIN_META;
  const imagesOk = images.length >= 1;
  const allValid = titleOk && bodyCharsOk && bodyWordsOk && metaOk && imagesOk;

  useEffect(() => { loadPost(); }, [id]);

  const loadPost = async () => {
    try {
      const res = await fetch(`/api/portal/blog/${id}`);
      const data = await res.json();
      if (data.success) {
        setPost(data.post);
        setTitle(data.post.title);
        setBody(data.post.body);
        setMetaDescription(data.post.metaDescription || '');
        setImages(data.post.images || []);
      } else {
        setError(data.error);
      }
    } catch {
      setError('Failed to load post');
    } finally {
      setLoading(false);
    }
  };

  const addImage = () => {
    const url = imageUrl.trim();
    if (url && !images.includes(url)) {
      setImages([...images, url]);
      setImageUrl('');
    }
  };

  const removeImage = (idx: number) => setImages(images.filter((_, i) => i !== idx));

  const handleSave = async (status: 'draft' | 'review') => {
    setError(''); setErrors([]);
    setSaving(true);
    try {
      const res = await fetch(`/api/portal/blog/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, metaDescription, images, status }),
      });
      const data = await res.json();
      if (data.success) {
        router.push('/portal/blog');
      } else {
        setError(data.error);
        if (data.errors) setErrors(data.errors);
      }
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (action: 'approve' | 'reject') => {
    let rejectionReason = '';
    if (action === 'reject') {
      rejectionReason = prompt('Reason for rejection:') || '';
      if (!rejectionReason) return;
    }
    try {
      const res = await fetch('/api/portal/blog/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: id, action, rejectionReason }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.message) setPublishMessage(data.message);
        loadPost();
      } else {
        alert(data.error);
      }
    } catch {
      alert('Failed');
    }
  };

  const handlePublish = async () => {
    if (!confirm('Publish this post now? It will go live immediately.')) return;
    setPublishing(true);
    setError('');
    try {
      const res = await fetch('/api/portal/blog/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: id }),
      });
      const data = await res.json();
      if (data.success) {
        setPublishMessage(data.message);
        loadPost();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-blue-400" size={32} />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          {error || 'Post not found'}
        </div>
        <Link href="/portal/blog" className="mt-4 inline-flex items-center gap-2 text-blue-400 hover:text-blue-300">
          <ArrowLeft size={16} /> Back to posts
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/portal/blog" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {canEdit ? 'Edit Post' : 'View Post'}
            </h1>
            <p className="text-neutral-400 mt-1">By {post.authorName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <button
                onClick={() => handleSave('draft')}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 font-medium transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Save Draft
              </button>
              <button
                onClick={() => handleSave('review')}
                disabled={saving || !allValid}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                Submit for Review
              </button>
            </>
          )}
          {isAdmin && post.status === 'review' && (
            <>
              <button
                onClick={() => handleApprove('approve')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-400 font-medium transition-colors"
              >
                <CheckCircle size={18} /> Approve
              </button>
              <button
                onClick={() => handleApprove('reject')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium transition-colors"
              >
                <XCircle size={18} /> Reject
              </button>
            </>
          )}
          {isAdmin && post.status === 'approved' && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-medium transition-all shadow-lg shadow-green-500/25 disabled:opacity-50"
            >
              {publishing ? <Loader2 className="animate-spin" size={18} /> : <Rocket size={18} />}
              Publish Now
            </button>
          )}
        </div>
      </div>

      {/* Status Banners */}
      {publishMessage && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400">
          {publishMessage}
        </div>
      )}
      {post.status === 'rejected' && post.rejectionReason && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          <strong>Rejected:</strong> {post.rejectionReason}
        </div>
      )}
      {post.status === 'approved' && post.publishDate && (
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 flex items-center gap-2">
          <Calendar size={18} />
          <span><strong>Approved!</strong> Scheduled to publish on <strong>{post.publishDate}</strong> (Friday). Admin can publish manually on that day.</span>
        </div>
      )}
      {post.status === 'published' && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 flex items-center gap-2">
          <CheckCircle size={18} />
          <span><strong>Published</strong> on {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : post.publishDate}</span>
        </div>
      )}
      {post.status === 'review' && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400">
          This post is currently under review.
        </div>
      )}

      {(error || errors.length > 0) && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={18} />
            <span className="font-medium">{error}</span>
          </div>
          {errors.length > 1 && (
            <ul className="ml-6 mt-2 space-y-1 text-sm list-disc">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Requirements Checklist (show for editable posts) */}
      {canEdit && (
        <div className="mb-6 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
          <p className="text-sm font-medium text-neutral-300 mb-3">Publishing Requirements</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <RequirementBadge ok={titleOk} label={`Title ≥ ${MIN_TITLE} chars`} current={title.length} />
            <RequirementBadge ok={bodyCharsOk} label={`Body ≥ ${MIN_BODY_CHARS} chars`} current={charCount} />
            <RequirementBadge ok={bodyWordsOk} label={`Body ≥ ${MIN_BODY_WORDS} words`} current={wordCount} />
            <RequirementBadge ok={metaOk} label={`Meta desc ≥ ${MIN_META} chars`} current={metaDescription.length} />
            <RequirementBadge ok={imagesOk} label="At least 1 image" current={images.length} />
          </div>
        </div>
      )}

      {/* Title */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-neutral-300 mb-2">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={!canEdit}
          placeholder="Enter a compelling title (min 30 characters)..."
          className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white text-lg placeholder-neutral-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none disabled:opacity-60"
        />
        {canEdit && (
          <p className={`text-xs mt-1 ${titleOk ? 'text-green-400' : 'text-neutral-500'}`}>
            {title.length}/{MIN_TITLE} characters {titleOk ? '✓' : ''}
          </p>
        )}
      </div>

      {/* Meta Description */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-neutral-300 mb-2">Meta Description</label>
        <textarea
          value={metaDescription}
          onChange={(e) => setMetaDescription(e.target.value)}
          disabled={!canEdit}
          placeholder="Brief description for search engines (min 120 characters)..."
          rows={3}
          className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none resize-y text-sm disabled:opacity-60"
        />
        {canEdit && (
          <p className={`text-xs mt-1 ${metaOk ? 'text-green-400' : 'text-neutral-500'}`}>
            {metaDescription.length}/{MIN_META} characters {metaOk ? '✓' : ''}
          </p>
        )}
      </div>

      {/* Images */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-neutral-300 mb-2">Images</label>
        {canEdit && (
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addImage())}
              placeholder="Image URL (e.g. /uploads/blog-image.jpg)"
              className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-neutral-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-sm"
            />
            <button onClick={addImage} className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 transition-colors">
              <ImagePlus size={18} />
            </button>
          </div>
        )}
        {images.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg text-sm text-neutral-300">
                <span className="truncate max-w-[200px]">{img}</span>
                {canEdit && (
                  <button onClick={() => removeImage(i)} className="text-neutral-500 hover:text-red-400">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">No images added</p>
        )}
      </div>

      {/* Body */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-neutral-300">Body</label>
          <div className="flex items-center gap-4">
            <span className={`text-xs ${bodyWordsOk ? 'text-green-400' : 'text-neutral-500'}`}>
              {wordCount}/{MIN_BODY_WORDS} words
            </span>
            <span className={`text-xs ${bodyCharsOk ? 'text-green-400' : 'text-neutral-500'}`}>
              {charCount}/{MIN_BODY_CHARS} chars
            </span>
          </div>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={!canEdit}
          rows={20}
          placeholder="Write your blog post here (min 1,500 characters / 300 words)..."
          className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none resize-y font-mono text-sm leading-relaxed disabled:opacity-60"
        />
      </div>

      {/* Meta */}
      <div className="text-xs text-neutral-500 flex items-center gap-4">
        <span>Created: {new Date(post.createdAt).toLocaleString()}</span>
        <span>Updated: {new Date(post.updatedAt).toLocaleString()}</span>
        {post.slug && <span>Slug: {post.slug}</span>}
      </div>
    </div>
  );
}

function RequirementBadge({ ok, label, current }: { ok: boolean; label: string; current: number }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${ok ? 'text-green-400' : 'text-neutral-500'}`}>
      <CheckCircle2 size={14} className={ok ? 'text-green-400' : 'text-neutral-600'} />
      <span>{label}</span>
      <span className="text-neutral-600">({current})</span>
    </div>
  );
}
