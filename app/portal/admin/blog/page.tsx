'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import {
  Plus, Edit, Trash2, Eye, Search, Calendar,
  User, Tag, Save, X, Loader2, FileText, ExternalLink, RefreshCw, Upload, Image as ImageIcon
} from 'lucide-react';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  date: string;
  author: string;
  image: string;
  keywords: string;
  excerpt: string;
  content: string;
  published: boolean;
}

export default function BlogAdmin() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/cms/blog');
      const data = await response.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPosts = posts.filter(post =>
    post.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.author?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = async (post: BlogPost) => {
    try {
      if (isCreating) {
        await fetch('/api/cms/blog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(post),
        });
      } else {
        await fetch('/api/cms/blog', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(post),
        });
      }
      await loadPosts();
      setEditingPost(null);
      setIsCreating(false);
    } catch (error) {
      console.error('Error saving post:', error);
    }
  };

  const handleDelete = async (slug: string) => {
    if (confirm('Are you sure you want to delete this post?')) {
      try {
        await fetch(`/api/cms/blog?slug=${slug}`, { method: 'DELETE' });
        await loadPosts();
      } catch (error) {
        console.error('Error deleting post:', error);
      }
    }
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingPost({
      id: '',
      slug: '',
      title: '',
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      author: 'Chris Muse',
      image: '/uploads/',
      keywords: '',
      excerpt: '',
      content: '',
      published: true,
    });
  };

  if (editingPost) {
    return (
      <BlogEditor
        post={editingPost}
        isNew={isCreating}
        onSave={handleSave}
        onCancel={() => { setEditingPost(null); setIsCreating(false); }}
      />
    );
  }

  return (
    <AdminLayout
      title="Blog Posts"
      subtitle={`${posts.length} articles synced with Google Sheets`}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={loadPosts}
            disabled={isLoading}
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <RefreshCw size={18} className={`text-neutral-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium transition-all shadow-lg shadow-blue-500/25"
          >
            <Plus size={18} />
            New Post
          </button>
        </div>
      }
    >
      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={20} />
        <input
          type="text"
          placeholder="Search posts by title or author..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-12 pr-4 py-4 text-white placeholder-neutral-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
        />
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Loader2 className="animate-spin text-blue-400" size={32} />
          </div>
          <p className="text-neutral-400">Loading posts from Google Sheets...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="text-neutral-600" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No blog posts yet</h3>
          <p className="text-neutral-500 mb-6 max-w-sm mx-auto">
            Get started by creating your first blog post or import default posts.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleCreate}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium"
            >
              Create First Post
            </button>
            <button
              onClick={async () => {
                setIsLoading(true);
                try {
                  await fetch('/api/cms/setup', { method: 'POST' });
                  await loadPosts();
                } catch (error) {
                  console.error('Error:', error);
                } finally {
                  setIsLoading(false);
                }
              }}
              className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 transition-colors"
            >
              Import Defaults
            </button>
          </div>
        </div>
      ) : (
        /* Posts Grid */
        <div className="space-y-4">
          {filteredPosts.map(post => (
            <div
              key={post.id || post.slug}
              className="group bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-2xl p-5 transition-all hover:bg-white/[0.04]"
            >
              <div className="flex items-start gap-5">
                {/* Thumbnail */}
                <div className="w-32 h-20 bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
                  {post.image ? (
                    <img
                      src={post.image}
                      alt={post.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileText size={24} className="text-neutral-600" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                      {post.title}
                    </h3>
                    {!post.published && (
                      <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full font-medium">
                        Draft
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-400 line-clamp-1 mb-3">{post.excerpt}</p>
                  <div className="flex items-center gap-4 text-xs text-neutral-500">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      {post.date}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <User size={14} />
                      {post.author}
                    </span>
                    {post.keywords && (
                      <span className="flex items-center gap-1.5">
                        <Tag size={14} />
                        {post.keywords}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link
                    href={`/blog/${post.slug}`}
                    target="_blank"
                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                    title="View"
                  >
                    <Eye size={18} className="text-neutral-400" />
                  </Link>
                  <button
                    onClick={() => setEditingPost(post)}
                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-blue-500/20 flex items-center justify-center transition-colors"
                    title="Edit"
                  >
                    <Edit size={18} className="text-neutral-400 hover:text-blue-400" />
                  </button>
                  <button
                    onClick={() => handleDelete(post.slug)}
                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={18} className="text-neutral-400 hover:text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

function BlogEditor({
  post,
  isNew,
  onSave,
  onCancel,
}: {
  post: BlogPost;
  isNew: boolean;
  onSave: (post: BlogPost) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState(post);
  const [isSaving, setIsSaving] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const slug = formData.slug || formData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    await onSave({ ...formData, slug });
    setIsSaving(false);
  };

  return (
    <AdminLayout
      title={isNew ? 'New Blog Post' : 'Edit Blog Post'}
      subtitle={isNew ? 'Create a new article' : `Editing: ${post.title}`}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Save to Sheets
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Featured Image with Large Preview */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
          <label className="block text-sm font-medium text-neutral-300 mb-4 flex items-center gap-2">
            <ImageIcon size={16} className="text-blue-400" />
            Featured Image
          </label>
          <div className="flex flex-col md:flex-row gap-6">
            {/* Image Preview */}
            <div className="w-full md:w-64 h-40 bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
              {formData.image && !imageError ? (
                <img
                  src={formData.image}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-neutral-500">
                  <ImageIcon size={32} className="mb-2" />
                  <span className="text-xs">No image selected</span>
                </div>
              )}
            </div>

            {/* Image URL Input */}
            <div className="flex-1">
              <input
                type="text"
                value={formData.image}
                onChange={(e) => {
                  setFormData({ ...formData, image: e.target.value });
                  setImageError(false);
                }}
                placeholder="/uploads/blog-image.jpg"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-blue-500/50 transition-all outline-none mb-3"
              />
              <p className="text-xs text-neutral-500 mb-3">
                Enter an image path from /uploads/ or use an external URL
              </p>

              {/* Quick Image Selection */}
              <div className="flex flex-wrap gap-2">
                {[
                  '/uploads/service-residential.png',
                  '/uploads/service-commercial.png',
                  '/uploads/service-storm.jpg',
                  '/uploads/service-chimney.png',
                  '/uploads/service-leafx.png',
                ].map(img => (
                  <button
                    key={img}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, image: img });
                      setImageError(false);
                    }}
                    className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 hover:border-blue-500/50 transition-colors"
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
          <label className="block text-sm font-medium text-neutral-300 mb-2">Title</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter post title..."
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white text-lg placeholder-neutral-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            required
          />
        </div>

        {/* Slug */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            URL Slug
            <span className="text-neutral-500 font-normal ml-2">(auto-generated if empty)</span>
          </label>
          <div className="flex items-center bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
            <span className="text-neutral-500 px-4 bg-white/5">/blog/</span>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="post-url-slug"
              className="flex-1 bg-transparent py-3 pr-4 text-white placeholder-neutral-500 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Author */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <label className="block text-sm font-medium text-neutral-300 mb-2">Author</label>
            <select
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500/50 transition-all outline-none"
            >
              <option value="Chris Muse">Chris Muse</option>
              <option value="Michael Muse">Michael Muse</option>
              <option value="Sara Hill">Sara Hill</option>
              <option value="John">John</option>
              <option value="Bart">Bart</option>
              <option value="Boston">Boston</option>
            </select>
          </div>

          {/* Date */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <label className="block text-sm font-medium text-neutral-300 mb-2">Date</label>
            <input
              type="text"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              placeholder="Month Day, Year"
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-blue-500/50 transition-all outline-none"
            />
          </div>
        </div>

        {/* Published Toggle */}
        <div className="flex items-center gap-3 p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
          <input
            type="checkbox"
            id="published"
            checked={formData.published}
            onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
            className="w-5 h-5 rounded border-neutral-600 bg-neutral-700 text-blue-500 focus:ring-blue-500"
          />
          <label htmlFor="published" className="text-neutral-300">
            Published <span className="text-neutral-500 text-sm">(visible on website)</span>
          </label>
        </div>

        {/* Keywords */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Keywords <span className="text-neutral-500 font-normal">(comma separated)</span>
          </label>
          <input
            type="text"
            value={formData.keywords}
            onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
            placeholder="roofing, shingles, storm damage"
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-blue-500/50 transition-all outline-none"
          />
        </div>

        {/* Excerpt */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Excerpt <span className="text-neutral-500 font-normal">(short summary)</span>
          </label>
          <textarea
            value={formData.excerpt}
            onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
            placeholder="Brief summary of the post..."
            rows={2}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-blue-500/50 transition-all outline-none resize-none"
          />
        </div>

        {/* Content */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
          <label className="block text-sm font-medium text-neutral-300 mb-2">Content</label>
          <textarea
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            placeholder="Full blog post content..."
            rows={15}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-blue-500/50 transition-all outline-none resize-y font-mono text-sm"
          />
        </div>

        {/* Preview Link */}
        {!isNew && formData.slug && (
          <div className="pt-4 border-t border-white/5">
            <Link
              href={`/blog/${formData.slug}`}
              target="_blank"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ExternalLink size={16} />
              View live post
            </Link>
          </div>
        )}
      </form>
    </AdminLayout>
  );
}
