'use client';

/**
 * Admin Blog Management Page
 * Create, edit, and manage blog posts via /api/cms/blog
 * Dark theme, no redundant header (admin layout provides it)
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  FileText,
  Search,
  Plus,
  Edit2,
  Trash2,
  Eye,
  RefreshCw,
  Calendar,
  User,
  X,
  Save,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  ImageIcon,
} from 'lucide-react';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: string;
  category: string;
  image: string;
  date: string;
  status: 'published' | 'draft' | 'scheduled';
  tags?: string[];
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '', slug: '', excerpt: '', content: '', author: '', category: '', image: '',
    status: 'draft' as 'published' | 'draft' | 'scheduled', tags: '',
  });

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/cms/blog');
      if (!response.ok) throw new Error('Failed to fetch posts');
      const data = await response.json();
      setPosts(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError('Failed to load blog posts. Check your CMS API configuration.');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  useEffect(() => {
    let filtered = [...posts];
    if (selectedStatus !== 'all') filtered = filtered.filter(post => post.status === selectedStatus);
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(post =>
        post.title.toLowerCase().includes(query) || post.excerpt.toLowerCase().includes(query) || post.author.toLowerCase().includes(query)
      );
    }
    setFilteredPosts(filtered);
  }, [posts, searchQuery, selectedStatus]);

  const stats = {
    total: posts.length,
    published: posts.filter(p => p.status === 'published').length,
    drafts: posts.filter(p => p.status === 'draft').length,
  };

  const generateSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      if (name === 'title' && !editingPost) newData.slug = generateSlug(value);
      return newData;
    });
  };

  const handleEdit = (post: BlogPost) => {
    setEditingPost(post);
    setFormData({ title: post.title, slug: post.slug, excerpt: post.excerpt, content: post.content, author: post.author, category: post.category, image: post.image, status: post.status, tags: post.tags?.join(', ') || '' });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({ title: '', slug: '', excerpt: '', content: '', author: '', category: '', image: '', status: 'draft', tags: '' });
    setEditingPost(null);
  };

  const handleSave = async () => {
    if (!formData.title) { alert('Title is required'); return; }
    setSaving(true);
    try {
      const postData = { ...formData, tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean), date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) };
      if (editingPost) {
        const response = await fetch('/api/cms/blog', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingPost.id, ...postData }) });
        if (!response.ok) throw new Error('Failed to update post');
      } else {
        const response = await fetch('/api/cms/blog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(postData) });
        if (!response.ok) throw new Error('Failed to create post');
      }
      setShowAddModal(false); setShowEditModal(false); resetForm(); fetchPosts();
    } catch (err) { console.error('Error saving post:', err); alert('Failed to save post'); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      const response = await fetch(`/api/cms/blog?id=${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete post');
      fetchPosts();
    } catch (err) { console.error('Error deleting post:', err); alert('Failed to delete post'); }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      published: { bg: 'bg-[#39FF14]/10', text: 'text-[#39FF14]', icon: CheckCircle },
      draft: { bg: 'bg-gray-500/10', text: 'text-gray-400', icon: AlertCircle },
      scheduled: { bg: 'bg-amber-500/10', text: 'text-amber-400', icon: Clock },
    };
    return styles[status as keyof typeof styles] || styles.draft;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Blog Management</h1>
          <p className="text-neutral-400 mt-2">Create and manage blog posts</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { resetForm(); setShowAddModal(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#39FF14] hover:bg-lime-400 text-black font-medium text-sm transition-colors">
            <Plus size={16} /> New Post
          </button>
          <button onClick={fetchPosts} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors" title="Refresh">
            <RefreshCw size={16} className={`text-neutral-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/blog" target="_blank" className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-neutral-400 text-sm rounded-lg transition-colors">
            <Eye size={16} /> View Blog
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center"><FileText size={20} className="text-blue-400" /></div>
            <div><p className="text-2xl font-bold text-white">{stats.total}</p><p className="text-xs text-neutral-500">Total Posts</p></div>
          </div>
        </div>
        <div className="bg-gray-900 border border-[#39FF14]/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#39FF14]/10 rounded-lg flex items-center justify-center"><CheckCircle size={20} className="text-[#39FF14]" /></div>
            <div><p className="text-2xl font-bold text-[#39FF14]">{stats.published}</p><p className="text-xs text-neutral-500">Published</p></div>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-500/10 rounded-lg flex items-center justify-center"><AlertCircle size={20} className="text-gray-400" /></div>
            <div><p className="text-2xl font-bold text-gray-400">{stats.drafts}</p><p className="text-xs text-neutral-500">Drafts</p></div>
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex bg-gray-900 border border-gray-700/50 rounded-xl p-1">
          {[{ id: 'all', label: 'All', count: stats.total }, { id: 'published', label: 'Published', count: stats.published }, { id: 'draft', label: 'Drafts', count: stats.drafts }].map(tab => (
            <button key={tab.id} onClick={() => setSelectedStatus(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${selectedStatus === tab.id ? 'bg-[#39FF14] text-black font-medium' : 'text-neutral-400 hover:text-white'}`}>
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
        <div className="flex-1 max-w-md relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input type="text" placeholder="Search posts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-[#39FF14]/50 transition-colors" />
        </div>
      </div>

      {/* Posts Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={32} className="text-[#39FF14] animate-spin" /></div>
      ) : error && posts.length === 0 ? (
        <div className="text-center py-20 bg-gray-900 rounded-xl border border-gray-700/50">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={fetchPosts} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors">Try Again</button>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-20 bg-gray-900 rounded-xl border border-gray-700/50">
          <FileText size={48} className="text-neutral-600 mx-auto mb-4" />
          <p className="text-neutral-400 mb-2">No posts found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map(post => {
            const statusBadge = getStatusBadge(post.status);
            const StatusIcon = statusBadge.icon;
            return (
              <div key={post.id} className="bg-gray-900 border border-gray-700/50 rounded-xl overflow-hidden hover:border-[#39FF14]/30 transition-colors group">
                <div className="relative h-40 bg-gray-800">
                  {post.image ? (<Image src={post.image} alt={post.title} fill className="object-cover" />) : (
                    <div className="w-full h-full flex items-center justify-center"><ImageIcon size={32} className="text-neutral-600" /></div>
                  )}
                  <div className="absolute top-3 right-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                      <StatusIcon size={12} />{post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-white font-semibold mb-2 line-clamp-2 group-hover:text-[#39FF14] transition-colors">{post.title}</h3>
                  <p className="text-sm text-neutral-400 line-clamp-2 mb-3">{post.excerpt}</p>
                  <div className="flex items-center gap-4 text-xs text-neutral-500 mb-4">
                    <span className="flex items-center gap-1"><User size={12} />{post.author}</span>
                    <span className="flex items-center gap-1"><Calendar size={12} />{post.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleEdit(post)} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors">
                      <Edit2 size={14} /> Edit
                    </button>
                    <Link href={`/blog/${post.slug}`} target="_blank" className="flex items-center justify-center gap-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors">
                      <Eye size={14} />
                    </Link>
                    <button onClick={() => handleDelete(post.id)} className="flex items-center justify-center gap-1 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-sm text-neutral-500">Showing {filteredPosts.length} of {posts.length} posts</div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">{editingPost ? 'Edit Post' : 'Create New Post'}</h2>
              <button onClick={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }} className="p-1 hover:bg-gray-800 rounded-lg transition-colors">
                <X size={20} className="text-neutral-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Title *</label>
                <input type="text" name="title" value={formData.title} onChange={handleFormChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-[#39FF14]/50" placeholder="Enter post title" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Slug</label>
                <input type="text" name="slug" value={formData.slug} onChange={handleFormChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-[#39FF14]/50" placeholder="auto-generated" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Excerpt</label>
                <textarea name="excerpt" value={formData.excerpt} onChange={handleFormChange} rows={2}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-[#39FF14]/50 resize-none" placeholder="Brief summary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Content</label>
                <textarea name="content" value={formData.content} onChange={handleFormChange} rows={8}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-[#39FF14]/50 resize-none" placeholder="Full post content..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">Author</label>
                  <input type="text" name="author" value={formData.author} onChange={handleFormChange}
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-[#39FF14]/50" placeholder="Author name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">Category</label>
                  <input type="text" name="category" value={formData.category} onChange={handleFormChange}
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-[#39FF14]/50" placeholder="e.g., Roofing Tips" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Featured Image URL</label>
                <input type="text" name="image" value={formData.image} onChange={handleFormChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-[#39FF14]/50" placeholder="/uploads/blog-image.jpg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">Status</label>
                  <select name="status" value={formData.status} onChange={handleFormChange}
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-[#39FF14]/50">
                    <option value="draft">Draft</option><option value="published">Published</option><option value="scheduled">Scheduled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">Tags (comma separated)</label>
                  <input type="text" name="tags" value={formData.tags} onChange={handleFormChange}
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-[#39FF14]/50" placeholder="roofing, tips, guide" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
              <button onClick={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }} className="px-4 py-2 text-neutral-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-[#39FF14] hover:bg-lime-400 text-black font-medium rounded-xl transition-colors disabled:opacity-50">
                {saving ? (<><Loader2 size={16} className="animate-spin" />Saving...</>) : (<><Save size={16} />{editingPost ? 'Update Post' : 'Create Post'}</>)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
