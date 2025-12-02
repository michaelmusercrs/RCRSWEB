'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Edit, Trash2, Eye, Search, Calendar,
  User, Tag, Save, X, Loader2, FileText, ExternalLink, RefreshCw
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
        // Create new post
        await fetch('/api/cms/blog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(post),
        });
      } else {
        // Update existing
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

  // Edit Modal
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
    <div className="min-h-screen bg-neutral-900">
      {/* Header */}
      <div className="bg-neutral-800 border-b border-neutral-700 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal/admin" className="text-neutral-400 hover:text-white">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Blog Posts</h1>
              <p className="text-sm text-neutral-400">{posts.length} articles (Google Sheets)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadPosts}
              disabled={isLoading}
              className="p-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg"
            >
              <RefreshCw size={18} className={`text-neutral-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleCreate}
              className="bg-brand-green hover:bg-lime-400 text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Plus size={18} />
              New Post
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
          <input
            type="text"
            placeholder="Search posts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-10 pr-4 py-3 text-white"
          />
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="animate-spin mx-auto text-brand-green" size={32} />
            <p className="text-neutral-400 mt-2">Loading posts from Google Sheets...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto text-neutral-600" size={48} />
            <p className="text-neutral-400 mt-4">No blog posts yet</p>
            <p className="text-neutral-500 text-sm mt-2">
              Click "New Post" to create one, or run setup to import existing posts
            </p>
            <button
              onClick={async () => {
                setIsLoading(true);
                try {
                  await fetch('/api/cms/setup', { method: 'POST' });
                  await loadPosts();
                } catch (error) {
                  console.error('Error setting up:', error);
                } finally {
                  setIsLoading(false);
                }
              }}
              className="mt-4 bg-neutral-700 hover:bg-neutral-600 text-white px-4 py-2 rounded-lg"
            >
              Import Default Posts
            </button>
          </div>
        ) : (
          /* Posts List */
          <div className="space-y-3">
            {filteredPosts.map(post => (
              <div
                key={post.id || post.slug}
                className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 hover:border-neutral-600 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  <div className="w-24 h-16 bg-neutral-700 rounded-lg overflow-hidden flex-shrink-0">
                    {post.image && (
                      <img
                        src={post.image}
                        alt={post.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white truncate">{post.title}</h3>
                      {!post.published && (
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs rounded">Draft</span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-400 line-clamp-1 mb-2">{post.excerpt}</p>
                    <div className="flex items-center gap-4 text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {post.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        {post.author}
                      </span>
                      {post.keywords && (
                        <span className="flex items-center gap-1">
                          <Tag size={12} />
                          {post.keywords}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      href={`/blog/${post.slug}`}
                      target="_blank"
                      className="p-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg"
                      title="View"
                    >
                      <Eye size={16} className="text-neutral-400" />
                    </Link>
                    <button
                      onClick={() => setEditingPost(post)}
                      className="p-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg"
                      title="Edit"
                    >
                      <Edit size={16} className="text-neutral-400" />
                    </button>
                    <button
                      onClick={() => handleDelete(post.slug)}
                      className="p-2 bg-neutral-700 hover:bg-red-600 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 size={16} className="text-neutral-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    // Generate slug from title if new
    const slug = formData.slug || formData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    await onSave({ ...formData, slug });
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-neutral-900">
      {/* Header */}
      <div className="bg-neutral-800 border-b border-neutral-700 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onCancel} className="text-neutral-400 hover:text-white">
              <X size={20} />
            </button>
            <h1 className="text-xl font-bold text-white">
              {isNew ? 'New Blog Post' : 'Edit Blog Post'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="bg-neutral-700 hover:bg-neutral-600 text-white font-bold px-4 py-2 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="bg-brand-green hover:bg-lime-400 text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Save to Sheets
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">Title</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter post title..."
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white text-lg"
            required
          />
        </div>

        {/* Slug */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            URL Slug
            <span className="text-neutral-500 font-normal ml-2">
              (auto-generated from title if empty)
            </span>
          </label>
          <div className="flex items-center bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden">
            <span className="text-neutral-500 px-3">/blog/</span>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="post-url-slug"
              className="flex-1 bg-transparent py-3 pr-4 text-white outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Author */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Author</label>
            <select
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white"
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
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Date</label>
            <input
              type="text"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              placeholder="Month Day, Year"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white"
            />
          </div>
        </div>

        {/* Published */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="published"
            checked={formData.published}
            onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
            className="w-5 h-5 rounded border-neutral-600 bg-neutral-700 text-brand-green"
          />
          <label htmlFor="published" className="text-neutral-300">Published (visible on website)</label>
        </div>

        {/* Image */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">Featured Image</label>
          <div className="flex gap-4">
            <input
              type="text"
              value={formData.image}
              onChange={(e) => setFormData({ ...formData, image: e.target.value })}
              placeholder="/uploads/image.jpg"
              className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white"
            />
            {formData.image && (
              <div className="w-20 h-14 bg-neutral-700 rounded-lg overflow-hidden">
                <img
                  src={formData.image}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        </div>

        {/* Keywords */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Keywords
            <span className="text-neutral-500 font-normal ml-2">(comma separated)</span>
          </label>
          <input
            type="text"
            value={formData.keywords}
            onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
            placeholder="roofing, shingles, storm damage"
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white"
          />
        </div>

        {/* Excerpt */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Excerpt
            <span className="text-neutral-500 font-normal ml-2">(short summary for listings)</span>
          </label>
          <textarea
            value={formData.excerpt}
            onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
            placeholder="Brief summary of the post..."
            rows={2}
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white resize-none"
          />
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">Content</label>
          <textarea
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            placeholder="Full blog post content..."
            rows={12}
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white resize-y font-mono text-sm"
          />
        </div>

        {/* Preview Link */}
        {!isNew && formData.slug && (
          <div className="pt-4 border-t border-neutral-700">
            <Link
              href={`/blog/${formData.slug}`}
              target="_blank"
              className="inline-flex items-center gap-2 text-brand-green hover:underline"
            >
              <ExternalLink size={16} />
              View live post
            </Link>
          </div>
        )}
      </form>
    </div>
  );
}
