'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Save, Send, ArrowLeft, Loader2, AlertCircle, ImagePlus, X, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

const MIN_TITLE = 30;
const MIN_BODY_CHARS = 1500;
const MIN_BODY_WORDS = 300;
const MIN_META = 120;

export default function NewBlogPost() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const wordCount = body.trim().split(/\s+/).filter(w => w.length > 0).length;
  const charCount = body.length;

  const titleOk = title.length >= MIN_TITLE;
  const bodyCharsOk = charCount >= MIN_BODY_CHARS;
  const bodyWordsOk = wordCount >= MIN_BODY_WORDS;
  const metaOk = metaDescription.length >= MIN_META;
  const imagesOk = images.length >= 1;
  const allValid = titleOk && bodyCharsOk && bodyWordsOk && metaOk && imagesOk;

  const addImage = () => {
    const url = imageUrl.trim();
    if (url && !images.includes(url)) {
      setImages([...images, url]);
      setImageUrl('');
    }
  };

  const removeImage = (idx: number) => {
    setImages(images.filter((_, i) => i !== idx));
  };

  const handleSave = async (status: 'draft' | 'review') => {
    setError('');
    setErrors([]);

    setSaving(true);
    try {
      const res = await fetch('/api/portal/blog', {
        method: 'POST',
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
      setError('Failed to save post');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/portal/blog" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">New Blog Post</h1>
            <p className="text-neutral-400 mt-1">Writing as {user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

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

      {/* Requirements Checklist */}
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

      {/* Title */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-neutral-300 mb-2">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter a compelling title (min 30 characters)..."
          className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white text-lg placeholder-neutral-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
        />
        <p className={`text-xs mt-1 ${titleOk ? 'text-green-400' : 'text-neutral-500'}`}>
          {title.length}/{MIN_TITLE} characters {titleOk ? '✓' : ''}
        </p>
      </div>

      {/* Meta Description */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-neutral-300 mb-2">Meta Description</label>
        <textarea
          value={metaDescription}
          onChange={(e) => setMetaDescription(e.target.value)}
          placeholder="Brief description for search engines (min 120 characters)..."
          rows={3}
          className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none resize-y text-sm"
        />
        <p className={`text-xs mt-1 ${metaOk ? 'text-green-400' : 'text-neutral-500'}`}>
          {metaDescription.length}/{MIN_META} characters {metaOk ? '✓' : ''}
        </p>
      </div>

      {/* Images */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-neutral-300 mb-2">Images</label>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addImage())}
            placeholder="Image URL (e.g. /uploads/blog-image.jpg)"
            className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-neutral-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-sm"
          />
          <button
            onClick={addImage}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 transition-colors"
          >
            <ImagePlus size={18} />
          </button>
        </div>
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg text-sm text-neutral-300">
                <span className="truncate max-w-[200px]">{img}</span>
                <button onClick={() => removeImage(i)} className="text-neutral-500 hover:text-red-400">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className={`text-xs mt-1 ${imagesOk ? 'text-green-400' : 'text-neutral-500'}`}>
          {images.length} image{images.length !== 1 ? 's' : ''} {imagesOk ? '✓' : '(min 1 required)'}
        </p>
      </div>

      {/* Body */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-neutral-300">Body</label>
          <div className="flex items-center gap-4">
            <span className={`text-xs ${bodyWordsOk ? 'text-green-400' : 'text-neutral-500'}`}>
              {wordCount}/{MIN_BODY_WORDS} words {bodyWordsOk ? '✓' : ''}
            </span>
            <span className={`text-xs ${bodyCharsOk ? 'text-green-400' : 'text-neutral-500'}`}>
              {charCount}/{MIN_BODY_CHARS} chars {bodyCharsOk ? '✓' : ''}
            </span>
          </div>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your blog post here (min 1,500 characters / 300 words)..."
          rows={20}
          className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none resize-y font-mono text-sm leading-relaxed"
        />
      </div>

      {/* Info */}
      <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl text-sm text-blue-300">
        <strong>How it works:</strong> Save as draft to continue later, or submit for review when all requirements are met.
        Once approved, your post will be scheduled for the next available Friday. Only 1 post can be published per 7-day window.
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
