'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  Plus, Edit, Trash2, FileText, Clock, CheckCircle, XCircle,
  Send, Loader2, AlertCircle, Eye, Calendar, Shield
} from 'lucide-react';

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

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-neutral-500/20 text-neutral-400', icon: FileText },
  review: { label: 'In Review', color: 'bg-yellow-500/20 text-yellow-400', icon: Clock },
  approved: { label: 'Approved', color: 'bg-blue-500/20 text-blue-400', icon: CheckCircle },
  published: { label: 'Published', color: 'bg-green-500/20 text-green-400', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-400', icon: XCircle },
};

export default function BlogListPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingPosts, setPendingPosts] = useState<BlogPost[]>([]);
  const [cooldownDate, setCooldownDate] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  useEffect(() => {
    loadPosts();
    if (isAdmin) loadPending();
  }, [isAdmin]);

  const loadPosts = async () => {
    try {
      const res = await fetch('/api/portal/blog');
      const data = await res.json();
      if (data.success) {
        setPosts(data.posts);
        if (data.cooldownDate) setCooldownDate(data.cooldownDate);
      }
    } catch {
      setError('Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPending = async () => {
    try {
      const res = await fetch('/api/portal/blog/pending');
      const data = await res.json();
      if (data.success) setPendingPosts(data.posts);
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this draft?')) return;
    try {
      const res = await fetch(`/api/portal/blog/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setPosts(posts.filter(p => p.id !== id));
      } else {
        alert(data.error);
      }
    } catch {
      alert('Failed to delete');
    }
  };

  const handleApprove = async (postId: string, action: 'approve' | 'reject') => {
    let rejectionReason = '';
    if (action === 'reject') {
      rejectionReason = prompt('Reason for rejection:') || '';
      if (!rejectionReason) return;
    }
    try {
      const res = await fetch('/api/portal/blog/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, action, rejectionReason }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.message) alert(data.message);
        loadPosts();
        loadPending();
      } else {
        alert(data.error);
      }
    } catch {
      alert('Failed to process');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-blue-400" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Blog Posts</h1>
          <p className="text-neutral-400 mt-1">Write articles for the company blog</p>
        </div>
        <Link
          href="/portal/blog/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium transition-all shadow-lg shadow-blue-500/25"
        >
          <Plus size={18} />
          New Post
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Publish Cooldown Notice */}
      {cooldownDate && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 flex items-center gap-3">
          <Shield size={20} />
          <div>
            <p className="font-medium">Publishing cooldown active</p>
            <p className="text-sm text-amber-400/70">
              Only 1 post per 7 days. Next eligible publish date: <strong>{cooldownDate}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Enforcement Rules Info */}
      <div className="mb-6 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <Calendar size={16} className="text-blue-400" />
          <p className="text-sm font-medium text-neutral-300">Publishing Rules</p>
        </div>
        <ul className="text-xs text-neutral-500 space-y-1 ml-6 list-disc">
          <li>Posts go live on <strong className="text-neutral-400">Fridays only</strong></li>
          <li>Max <strong className="text-neutral-400">1 post per 7 days</strong> (rolling window)</li>
          <li>Title ≥ 30 chars &bull; Body ≥ 1,500 chars &bull; Meta desc ≥ 120 chars &bull; ≥ 1 image</li>
        </ul>
      </div>

      {/* Admin: Pending Review Section */}
      {isAdmin && pendingPosts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-yellow-400 mb-4 flex items-center gap-2">
            <Clock size={20} />
            Pending Review ({pendingPosts.length})
          </h2>
          <div className="space-y-3">
            {pendingPosts.map(post => (
              <div key={post.id} className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white">{post.title}</h3>
                    <p className="text-sm text-neutral-400 mt-1">
                      By {post.authorName} &middot; {new Date(post.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-neutral-500 mt-2 line-clamp-2">{post.body.slice(0, 200)}...</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      href={`/portal/blog/${post.id}`}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 transition-colors"
                    >
                      <Eye size={18} />
                    </Link>
                    <button
                      onClick={() => handleApprove(post.id, 'approve')}
                      className="px-3 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm font-medium transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleApprove(post.id, 'reject')}
                      className="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Posts List */}
      {posts.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="text-neutral-600" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No blog posts yet</h3>
          <p className="text-neutral-500 mb-6">Write your first article to get started.</p>
          <Link
            href="/portal/blog/new"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium"
          >
            <Plus size={18} />
            Write Your First Post
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => {
            const statusCfg = STATUS_CONFIG[post.status];
            const StatusIcon = statusCfg.icon;
            const canEdit = post.status === 'draft' || post.status === 'rejected';

            return (
              <div
                key={post.id}
                className="group bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-2xl p-5 transition-all hover:bg-white/[0.04]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-white truncate">{post.title}</h3>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                        <StatusIcon size={12} />
                        {statusCfg.label}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-500 line-clamp-1 mb-2">{post.body.slice(0, 150)}...</p>
                    <div className="flex items-center gap-4 text-xs text-neutral-500">
                      <span>By {post.authorName}</span>
                      <span>Created {new Date(post.createdAt).toLocaleDateString()}</span>
                      {post.publishDate && <span className="text-blue-400">📅 {post.publishDate}</span>}
                      {post.publishedAt && <span className="text-green-400">✓ Published {new Date(post.publishedAt).toLocaleDateString()}</span>}
                      {post.images && post.images.length > 0 && <span>🖼 {post.images.length} image{post.images.length !== 1 ? 's' : ''}</span>}
                    </div>
                    {post.status === 'rejected' && post.rejectionReason && (
                      <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                        <strong>Feedback:</strong> {post.rejectionReason}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {canEdit ? (
                      <Link
                        href={`/portal/blog/${post.id}`}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 transition-colors"
                      >
                        <Edit size={18} />
                      </Link>
                    ) : (
                      <Link
                        href={`/portal/blog/${post.id}`}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 transition-colors"
                      >
                        <Eye size={18} />
                      </Link>
                    )}
                    {post.status === 'draft' && (
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
