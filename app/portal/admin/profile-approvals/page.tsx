'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Check,
  X,
  Loader2,
  AlertCircle,
  User,
  MessageSquare,
  Image as ImageIcon,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PendingProfileChange, ProfileReview, ProfileImage } from '@/lib/profile-types';

type TabType = 'profile' | 'reviews' | 'images';

export default function ProfileApprovalsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [profileChanges, setProfileChanges] = useState<PendingProfileChange[]>([]);
  const [pendingReviews, setPendingReviews] = useState<ProfileReview[]>([]);
  const [pendingImages, setPendingImages] = useState<ProfileImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && user && !hasPermission('*')) {
      router.push('/portal/dashboard');
    }
    if (!authLoading && !user) {
      router.push('/portal');
    }
  }, [user, authLoading, hasPermission, router]);

  // Load pending items
  useEffect(() => {
    if (!user || !hasPermission('*')) return;
    loadPendingItems();
  }, [user, hasPermission]);

  const loadPendingItems = async () => {
    setIsLoading(true);

    try {
      // Load pending profile changes
      const profileResponse = await fetch('/api/profile?pending=true');
      if (profileResponse.ok) {
        const data = await profileResponse.json();
        setProfileChanges(data.changes || []);
      }

      // Load pending reviews
      const reviewsResponse = await fetch('/api/profile/reviews?pending=true');
      if (reviewsResponse.ok) {
        const data = await reviewsResponse.json();
        setPendingReviews(data.reviews || []);
      }

      // Load pending images
      const imagesResponse = await fetch('/api/profile/images?pending=true');
      if (imagesResponse.ok) {
        const data = await imagesResponse.json();
        setPendingImages(data.images || []);
      }
    } catch (error) {
      console.error('Error loading pending items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveProfileChange = async (changeId: string) => {
    setProcessing(changeId);
    setMessage(null);

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changeId,
          action: 'approve',
          reviewedBy: user?.name,
        }),
      });

      if (response.ok) {
        setProfileChanges(prev => prev.filter(c => c.id !== changeId));
        setMessage({ type: 'success', text: 'Change approved successfully' });
      } else {
        throw new Error('Failed to approve change');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to approve change' });
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectProfileChange = async (changeId: string) => {
    setProcessing(changeId);
    setMessage(null);

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changeId,
          action: 'reject',
          reviewedBy: user?.name,
          comment: rejectionReason,
        }),
      });

      if (response.ok) {
        setProfileChanges(prev => prev.filter(c => c.id !== changeId));
        setMessage({ type: 'success', text: 'Change rejected' });
        setShowRejectModal(null);
        setRejectionReason('');
      } else {
        throw new Error('Failed to reject change');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to reject change' });
    } finally {
      setProcessing(null);
    }
  };

  const handleApproveReview = async (reviewId: string) => {
    setProcessing(reviewId);

    try {
      const response = await fetch('/api/profile/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reviewId,
          approved: true,
          approvedBy: user?.name,
        }),
      });

      if (response.ok) {
        setPendingReviews(prev => prev.filter(r => r.id !== reviewId));
        setMessage({ type: 'success', text: 'Review approved' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to approve review' });
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectReview = async (reviewId: string) => {
    setProcessing(reviewId);

    try {
      const response = await fetch(`/api/profile/reviews?id=${reviewId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setPendingReviews(prev => prev.filter(r => r.id !== reviewId));
        setMessage({ type: 'success', text: 'Review rejected and deleted' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to reject review' });
    } finally {
      setProcessing(null);
    }
  };

  const handleApproveImage = async (imageUrl: string) => {
    // Note: In a real implementation, you'd update a database record
    // For now, we just remove from pending list
    setPendingImages(prev => prev.filter(i => i.url !== imageUrl));
    setMessage({ type: 'success', text: 'Image approved' });
  };

  const handleRejectImage = async (imageUrl: string) => {
    setProcessing(imageUrl);

    try {
      const response = await fetch(`/api/profile/images?url=${encodeURIComponent(imageUrl)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setPendingImages(prev => prev.filter(i => i.url !== imageUrl));
        setMessage({ type: 'success', text: 'Image rejected and deleted' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to reject image' });
    } finally {
      setProcessing(null);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const totalPending = profileChanges.length + pendingReviews.length + pendingImages.length;

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

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

      <div className="relative z-10 max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/portal/dashboard"
              className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-2"
            >
              <ArrowLeft size={16} />
              Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Sparkles size={24} className="text-brand-green" />
              Profile Approvals
            </h1>
            <p className="text-neutral-400">
              Review and approve pending profile changes, reviews, and images
            </p>
          </div>

          {totalPending > 0 && (
            <div className="px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-xl">
              <span className="text-yellow-400 font-medium">{totalPending} pending</span>
            </div>
          )}
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
              <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            )}
            <p className={`text-sm ${message.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
              {message.text}
            </p>
            <button onClick={() => setMessage(null)} className="ml-auto text-neutral-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
              activeTab === 'profile'
                ? 'bg-brand-green text-black'
                : 'bg-white/5 text-neutral-400 hover:bg-white/10'
            }`}
          >
            <FileText size={16} />
            Profile Changes
            {profileChanges.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'profile' ? 'bg-black/20' : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {profileChanges.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
              activeTab === 'reviews'
                ? 'bg-brand-green text-black'
                : 'bg-white/5 text-neutral-400 hover:bg-white/10'
            }`}
          >
            <MessageSquare size={16} />
            Reviews
            {pendingReviews.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'reviews' ? 'bg-black/20' : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {pendingReviews.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('images')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
              activeTab === 'images'
                ? 'bg-brand-green text-black'
                : 'bg-white/5 text-neutral-400 hover:bg-white/10'
            }`}
          >
            <ImageIcon size={16} />
            Images
            {pendingImages.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'images' ? 'bg-black/20' : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {pendingImages.length}
              </span>
            )}
          </button>
        </div>

        {/* Profile Changes Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            {profileChanges.length === 0 ? (
              <div className="text-center py-12 bg-white/[0.02] border border-white/5 rounded-2xl">
                <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">All Caught Up!</h3>
                <p className="text-neutral-400">No pending profile changes to review.</p>
              </div>
            ) : (
              profileChanges.map(change => (
                <div
                  key={change.id}
                  className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden"
                >
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02]"
                    onClick={() => toggleExpanded(change.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-brand-green/20 flex items-center justify-center">
                        <User size={20} className="text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{change.repName}</h3>
                        <p className="text-sm text-neutral-400">
                          Changed: <span className="text-brand-green">{change.fieldName}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-neutral-500">
                        {new Date(change.submittedAt).toLocaleDateString()}
                      </span>
                      {expandedItems.has(change.id) ? (
                        <ChevronUp size={20} className="text-neutral-400" />
                      ) : (
                        <ChevronDown size={20} className="text-neutral-400" />
                      )}
                    </div>
                  </div>

                  {expandedItems.has(change.id) && (
                    <div className="p-4 border-t border-white/5 bg-black/20">
                      <div className="grid md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="text-xs text-neutral-500 block mb-1">Old Value</label>
                          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <p className="text-red-300 text-sm whitespace-pre-wrap">
                              {change.oldValue || '(empty)'}
                            </p>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-neutral-500 block mb-1">New Value</label>
                          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                            <p className="text-green-300 text-sm whitespace-pre-wrap">
                              {change.newValue || '(empty)'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Link
                          href={`/team/${change.repSlug}`}
                          target="_blank"
                          className="text-sm text-brand-green hover:text-lime-400 flex items-center gap-1"
                        >
                          <Eye size={14} />
                          View current profile
                        </Link>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowRejectModal(change.id)}
                            disabled={processing === change.id}
                            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-colors disabled:opacity-50"
                          >
                            <X size={16} className="inline mr-1" />
                            Reject
                          </button>
                          <button
                            onClick={() => handleApproveProfileChange(change.id)}
                            disabled={processing === change.id}
                            className="px-4 py-2 bg-brand-green hover:bg-green-400 text-black font-medium rounded-xl transition-colors disabled:opacity-50"
                          >
                            {processing === change.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <>
                                <Check size={16} className="inline mr-1" />
                                Approve
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {pendingReviews.length === 0 ? (
              <div className="text-center py-12 bg-white/[0.02] border border-white/5 rounded-2xl">
                <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">All Caught Up!</h3>
                <p className="text-neutral-400">No pending reviews to approve.</p>
              </div>
            ) : (
              pendingReviews.map(review => (
                <div
                  key={review.id}
                  className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white">{review.customerName}</span>
                        <div className="flex">
                          {[...Array(review.rating)].map((_, i) => (
                            <span key={i} className="text-yellow-400">★</span>
                          ))}
                        </div>
                      </div>
                      <div className="text-xs text-neutral-500">
                        For: <span className="text-brand-green">{review.repSlug}</span>
                        {' • '}
                        {review.source}
                        {' • '}
                        {new Date(review.date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <p className="text-neutral-300 mb-4">"{review.text}"</p>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleRejectReview(review.id)}
                      disabled={processing === review.id}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-colors disabled:opacity-50"
                    >
                      <X size={16} className="inline mr-1" />
                      Reject
                    </button>
                    <button
                      onClick={() => handleApproveReview(review.id)}
                      disabled={processing === review.id}
                      className="px-4 py-2 bg-brand-green hover:bg-green-400 text-black font-medium rounded-xl transition-colors disabled:opacity-50"
                    >
                      {processing === review.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <>
                          <Check size={16} className="inline mr-1" />
                          Approve
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Images Tab */}
        {activeTab === 'images' && (
          <div>
            {pendingImages.length === 0 ? (
              <div className="text-center py-12 bg-white/[0.02] border border-white/5 rounded-2xl">
                <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">All Caught Up!</h3>
                <p className="text-neutral-400">No pending images to approve.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingImages.map(image => (
                  <div
                    key={image.id}
                    className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden"
                  >
                    <div className="relative aspect-square">
                      <Image
                        src={image.url}
                        alt={image.filename}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 rounded text-xs text-white capitalize">
                        {image.type}
                      </div>
                    </div>

                    <div className="p-4">
                      <p className="text-sm text-white truncate mb-1">{image.filename}</p>
                      <p className="text-xs text-neutral-500 mb-3">
                        {new Date(image.uploadedAt).toLocaleDateString()}
                      </p>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRejectImage(image.url)}
                          disabled={processing === image.url}
                          className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded-xl transition-colors disabled:opacity-50"
                        >
                          <X size={14} className="inline mr-1" />
                          Reject
                        </button>
                        <button
                          onClick={() => handleApproveImage(image.url)}
                          className="flex-1 px-3 py-2 bg-brand-green hover:bg-green-400 text-black text-sm font-medium rounded-xl transition-colors"
                        >
                          <Check size={14} className="inline mr-1" />
                          Approve
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rejection Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-white mb-4">Reject Change</h3>
              <p className="text-neutral-400 text-sm mb-4">
                Please provide a reason for rejecting this change (optional):
              </p>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Reason for rejection..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:border-red-500 focus:outline-none resize-none mb-4"
                rows={3}
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowRejectModal(null);
                    setRejectionReason('');
                  }}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRejectProfileChange(showRejectModal)}
                  disabled={processing === showRejectModal}
                  className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {processing === showRejectModal ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Confirm Rejection'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
