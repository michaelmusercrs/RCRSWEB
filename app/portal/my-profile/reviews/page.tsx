'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Star,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Check,
  X,
  Loader2,
  AlertCircle,
  Clock,
  Edit,
  Save,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { teamMembers } from '@/lib/teamData';
import { ProfileReview, REVIEW_SOURCES } from '@/lib/profile-types';

export default function MyProfileReviewsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [reviews, setReviews] = useState<ProfileReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [repSlug, setRepSlug] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingReview, setEditingReview] = useState<ProfileReview | null>(null);

  // New review form state
  const [newReview, setNewReview] = useState({
    customerName: '',
    rating: 5,
    text: '',
    source: 'google' as ProfileReview['source'],
    date: new Date().toISOString().split('T')[0],
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/portal');
    }
  }, [user, authLoading, router]);

  // Find team member and load reviews
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      setIsLoading(true);

      // Find team member
      const member = teamMembers.find(m =>
        m.email.toLowerCase() === user.email.toLowerCase()
      );

      if (member) {
        setRepSlug(member.slug);

        // Load reviews from API
        try {
          const response = await fetch(`/api/profile/reviews?repSlug=${member.slug}`);
          if (response.ok) {
            const data = await response.json();
            setReviews(data.reviews || []);
          }
        } catch (error) {
          console.error('Error loading reviews:', error);
        }
      }

      setIsLoading(false);
    };

    loadData();
  }, [user]);

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repSlug) return;

    // Validate
    if (!newReview.customerName.trim() || !newReview.text.trim()) {
      setMessage({ type: 'error', text: 'Please fill in customer name and review text' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/profile/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repSlug,
          ...newReview,
          createdBy: user?.name,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setReviews(prev => [data.review, ...prev]);
        setNewReview({
          customerName: '',
          rating: 5,
          text: '',
          source: 'google',
          date: new Date().toISOString().split('T')[0],
        });
        setShowAddForm(false);
        setMessage({ type: 'success', text: 'Review added successfully! Pending admin approval.' });
      } else {
        throw new Error(data.error || 'Failed to add review');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to add review' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleVisibility = async (review: ProfileReview) => {
    try {
      const response = await fetch('/api/profile/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: review.id,
          visible: !review.visible,
        }),
      });

      if (response.ok) {
        setReviews(prev =>
          prev.map(r => r.id === review.id ? { ...r, visible: !r.visible } : r)
        );
      }
    } catch (error) {
      console.error('Error toggling visibility:', error);
    }
  };

  const handleToggleFeatured = async (review: ProfileReview) => {
    try {
      const response = await fetch('/api/profile/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: review.id,
          featured: !review.featured,
        }),
      });

      if (response.ok) {
        setReviews(prev =>
          prev.map(r => r.id === review.id ? { ...r, featured: !r.featured } : r)
        );
      }
    } catch (error) {
      console.error('Error toggling featured:', error);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return;

    try {
      const response = await fetch(`/api/profile/reviews?id=${reviewId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setReviews(prev => prev.filter(r => r.id !== reviewId));
        setMessage({ type: 'success', text: 'Review deleted successfully' });
      } else {
        throw new Error('Failed to delete review');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete review' });
    }
  };

  const renderStars = (rating: number, interactive: boolean = false, onChange?: (rating: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => onChange?.(star)}
            className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
          >
            <Star
              size={interactive ? 24 : 16}
              className={star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-neutral-600'}
            />
          </button>
        ))}
      </div>
    );
  };

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

  if (!repSlug) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 p-6">
        <div className="max-w-2xl mx-auto text-center py-12">
          <AlertCircle size={48} className="mx-auto text-yellow-500 mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Profile Not Found</h1>
          <p className="text-neutral-400 mb-6">
            We couldn't find your team profile. Please contact an administrator.
          </p>
          <Link
            href="/portal/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const visibleCount = reviews.filter(r => r.visible && r.approved).length;
  const pendingCount = reviews.filter(r => !r.approved).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/portal/my-profile"
              className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-2"
            >
              <ArrowLeft size={16} />
              Back to Profile
            </Link>
            <h1 className="text-2xl font-bold text-white">Manage Reviews</h1>
            <p className="text-neutral-400">
              Add reviews you've received and choose which to display on your profile
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-green hover:bg-green-400 text-black font-medium rounded-xl transition-colors"
          >
            <Plus size={16} />
            Add Review
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl text-center">
            <div className="text-2xl font-bold text-white">{reviews.length}</div>
            <div className="text-sm text-neutral-400">Total Reviews</div>
          </div>
          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl text-center">
            <div className="text-2xl font-bold text-brand-green">{visibleCount}</div>
            <div className="text-sm text-neutral-400">Visible on Profile</div>
          </div>
          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl text-center">
            <div className="text-2xl font-bold text-yellow-400">{pendingCount}</div>
            <div className="text-sm text-neutral-400">Pending Approval</div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${
              message.type === 'success'
                ? 'bg-green-500/10 border border-green-500/30'
                : 'bg-red-500/10 border border-red-500/30'
            }`}
          >
            {message.type === 'success' ? (
              <Check size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`text-sm ${message.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                {message.text}
              </p>
            </div>
            <button onClick={() => setMessage(null)} className="text-neutral-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Add Review Form */}
        {showAddForm && (
          <div className="mb-8 p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Add New Review</h2>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddReview} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    value={newReview.customerName}
                    onChange={e => setNewReview(prev => ({ ...prev, customerName: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:border-brand-green focus:outline-none"
                    placeholder="John Smith"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Review Source
                  </label>
                  <select
                    value={newReview.source}
                    onChange={e => setNewReview(prev => ({ ...prev, source: e.target.value as ProfileReview['source'] }))}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-brand-green focus:outline-none"
                  >
                    {REVIEW_SOURCES.map(source => (
                      <option key={source.value} value={source.value}>
                        {source.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Rating *
                  </label>
                  <div className="pt-1">
                    {renderStars(newReview.rating, true, rating => setNewReview(prev => ({ ...prev, rating })))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Review Date
                  </label>
                  <input
                    type="date"
                    value={newReview.date}
                    onChange={e => setNewReview(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-brand-green focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Review Text *
                </label>
                <textarea
                  value={newReview.text}
                  onChange={e => setNewReview(prev => ({ ...prev, text: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:border-brand-green focus:outline-none resize-none"
                  placeholder="Enter the customer's review..."
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-green hover:bg-green-400 text-black font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save Review
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare size={48} className="mx-auto text-neutral-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No Reviews Yet</h3>
            <p className="text-neutral-400 mb-4">
              Add reviews you've received to display them on your profile page.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-green hover:bg-green-400 text-black font-medium rounded-xl transition-colors"
            >
              <Plus size={16} />
              Add Your First Review
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map(review => (
              <div
                key={review.id}
                className={`p-6 rounded-2xl border transition-colors ${
                  review.visible && review.approved
                    ? 'bg-white/[0.04] border-brand-green/30'
                    : 'bg-white/[0.02] border-white/5'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-white">{review.customerName}</span>
                      {renderStars(review.rating)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <span>{new Date(review.date).toLocaleDateString()}</span>
                      <span>•</span>
                      <span className="capitalize">{review.source}</span>
                      {!review.approved && (
                        <>
                          <span>•</span>
                          <span className="text-yellow-500 flex items-center gap-1">
                            <Clock size={12} />
                            Pending approval
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {review.approved && (
                      <>
                        <button
                          onClick={() => handleToggleVisibility(review)}
                          className={`p-2 rounded-lg transition-colors ${
                            review.visible
                              ? 'bg-brand-green/20 text-brand-green'
                              : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                          }`}
                          title={review.visible ? 'Hide from profile' : 'Show on profile'}
                        >
                          {review.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                        <button
                          onClick={() => handleToggleFeatured(review)}
                          className={`p-2 rounded-lg transition-colors ${
                            review.featured
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                          }`}
                          title={review.featured ? 'Remove featured' : 'Feature this review'}
                        >
                          <Star size={16} className={review.featured ? 'fill-yellow-400' : ''} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDeleteReview(review.id)}
                      className="p-2 bg-white/5 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 rounded-lg transition-colors"
                      title="Delete review"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <p className="text-neutral-300 leading-relaxed">"{review.text}"</p>

                {review.visible && review.approved && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <span className="text-xs text-brand-green">
                      <Eye size={12} className="inline mr-1" />
                      Visible on your profile
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Info Note */}
        <div className="mt-8 p-4 bg-brand-green/10 border border-blue-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-300">How Reviews Work</h3>
              <ul className="text-sm text-blue-200/70 mt-2 space-y-1">
                <li>- Add reviews you've received from customers (Google, Facebook, etc.)</li>
                <li>- New reviews require admin approval before becoming visible</li>
                <li>- Toggle visibility to control which reviews appear on your profile</li>
                <li>- Featured reviews will be shown more prominently</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
